#!/usr/bin/env python3
"""Prepare one exact-SKU source-pixel packshot for private human review.

The source must already be recorded in a checked-in intake manifest. New
catalogue candidates use ``data/catalogue-intake.json``; foundational products
may use ``data/foundational-packshot-intake.json`` through ``--intake``. The
script refuses a source whose bytes do not match that record, uses the removal
model only to create an alpha mask, and keeps the source RGB pixels as the
package image. Output is private review material, never publication approval.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import io
import json
import os
import platform
import re
import shutil
import struct
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INTAKE = ROOT / "data/catalogue-intake.json"
DEFAULT_OUTPUT_ROOT = ROOT / ".cache/catalogue-reviewed-packshots"
DIRECT_REQUIREMENTS = ROOT / "scripts/requirements-packshots.txt"
RUNTIME_LOCK = ROOT / "scripts/requirements-packshots.lock.txt"
PIPELINE_VERSION = "exact-sku-source-pixel-isolation-v3"
REQUIRED_PYTHON = (3, 12)
ORT_INTRA_OP_NUM_THREADS = 1
ORT_INTER_OP_NUM_THREADS = 1
ORT_EXECUTION_MODE = "ORT_SEQUENTIAL"
CANVAS_SIZE = 2_000
SUBJECT_LONGEST_EDGE = 1_640
MAX_SOURCE_BYTES = 20 * 1024 * 1024
MAX_SOURCE_AREA = 30_000_000
MASK_THRESHOLD = 32
SURFACES = {
    "peach": "#f1d3cc",
    "pink": "#edcbd3",
    "dark": "#392825",
}
CANDIDATE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FORMAT_MIME = {
    "AVIF": "image/avif",
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}
FORMAT_SUFFIX = {
    "AVIF": ".avif",
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}
BOOTSTRAP_DISTRIBUTIONS = {"pip", "setuptools", "wheel"}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-id", required=True)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--intake", type=Path, default=DEFAULT_INTAKE)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--model", default="isnet-general-use")
    parser.add_argument("--provider", choices=("cpu",), required=True)
    return parser.parse_args()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_sha256(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def review_run_token(
    *,
    candidate_id: str,
    source_sha256: str,
    model_sha256: str,
    provider: str,
    session_options: dict[str, Any],
    output_sha256: str,
) -> str:
    """Bind immutable run identity to pixels and the inference contract."""

    return json_sha256({
        "candidate": candidate_id,
        "source": source_sha256,
        "model": model_sha256,
        "provider": provider,
        "sessionOptions": session_options,
        "output": output_sha256,
        "pipeline": PIPELINE_VERSION,
    })[:12]


def dependency_versions() -> dict[str, str]:
    versions: dict[str, str] = {}
    for name in ("rembg", "onnxruntime", "numpy", "Pillow", "scipy"):
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = "unavailable"
    return versions


def canonical_distribution_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def expected_session_options_contract() -> dict[str, Any]:
    """Return the execution settings that every inference session must bind."""

    return {
        "configurationSource": "explicit-onnxruntime-session-options",
        "intraOpNumThreads": ORT_INTRA_OP_NUM_THREADS,
        "interOpNumThreads": ORT_INTER_OP_NUM_THREADS,
        "executionMode": ORT_EXECUTION_MODE,
        "deterministicCompute": True,
        "usePerSessionThreads": True,
    }


def verified_session_options_contract(options: Any) -> dict[str, Any]:
    """Read back an ONNX session object and reject any contract drift."""

    try:
        actual = {
            "configurationSource": "explicit-onnxruntime-session-options",
            "intraOpNumThreads": int(options.intra_op_num_threads),
            "interOpNumThreads": int(options.inter_op_num_threads),
            "executionMode": options.execution_mode.name,
            "deterministicCompute": bool(options.use_deterministic_compute),
            "usePerSessionThreads": bool(options.use_per_session_threads),
        }
    except Exception as error:
        raise RuntimeError("could not read back deterministic ONNX Runtime session options") from error

    expected = expected_session_options_contract()
    if actual != expected:
        raise RuntimeError(
            "ONNX Runtime did not retain the deterministic session options "
            f"(expected {expected}, received {actual})"
        )
    return actual


def deterministic_session_options() -> tuple[Any, dict[str, Any]]:
    """Construct and verify the ONNX session contract without environment defaults."""

    import onnxruntime as ort

    try:
        options = ort.SessionOptions()
        options.intra_op_num_threads = ORT_INTRA_OP_NUM_THREADS
        options.inter_op_num_threads = ORT_INTER_OP_NUM_THREADS
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.use_deterministic_compute = True
        options.use_per_session_threads = True
    except Exception as error:
        raise RuntimeError("could not bind deterministic ONNX Runtime session options") from error
    return options, verified_session_options_contract(options)


def verified_loaded_session_contract(
    session: Any,
    expected_providers: list[str],
) -> dict[str, Any]:
    """Read the effective contract back from the loaded ONNX session."""

    try:
        inner_session = session.inner_session
        actual_providers = list(inner_session.get_providers())
        effective_options = inner_session.get_session_options()
    except Exception as error:
        raise RuntimeError("could not inspect the loaded ONNX Runtime session") from error
    if actual_providers != expected_providers:
        raise RuntimeError(
            "loaded ONNX Runtime provider chain changed "
            f"(expected {expected_providers}, received {actual_providers})"
        )
    return verified_session_options_contract(effective_options)


def locked_dependencies(
    lock_path: Path = RUNTIME_LOCK,
    lock_payload: bytes | None = None,
) -> dict[str, str]:
    """Read the complete hash lock and reject unhashed or duplicate entries."""

    if lock_payload is None:
        try:
            lock_payload = lock_path.read_bytes()
        except FileNotFoundError as error:
            raise RuntimeError(f"packshot runtime lock is unavailable: {lock_path}") from error
    lines = lock_payload.decode("utf-8").splitlines()
    entries: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        match = re.fullmatch(r"([A-Za-z0-9_.-]+)==([^\\\s;]+)\s*\\?", line)
        if match:
            entries.append((index, canonical_distribution_name(match.group(1)), match.group(2)))
    if not entries:
        raise RuntimeError("packshot runtime lock contains no pinned distributions")

    locked: dict[str, str] = {}
    for position, (start, name, version) in enumerate(entries):
        stop = entries[position + 1][0] if position + 1 < len(entries) else len(lines)
        if not any("--hash=sha256:" in line for line in lines[start:stop]):
            raise RuntimeError(f"packshot runtime lock entry is not hash-bound: {name}")
        if name in locked:
            raise RuntimeError(f"packshot runtime lock contains a duplicate entry: {name}")
        locked[name] = version
    return locked


def validate_runtime() -> dict[str, Any]:
    """Fail closed unless this is the dedicated, fully locked CPU runtime."""

    if sys.version_info[:2] != REQUIRED_PYTHON:
        expected = ".".join(map(str, REQUIRED_PYTHON))
        raise RuntimeError(f"packshot processing requires Python {expected}")

    direct = [
        line.strip()
        for line in DIRECT_REQUIREMENTS.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if direct != ["rembg[cpu]==2.0.77"]:
        raise RuntimeError("packshot direct requirements must contain only rembg[cpu]==2.0.77")

    try:
        lock_payload = RUNTIME_LOCK.read_bytes()
    except FileNotFoundError as error:
        raise RuntimeError(f"packshot runtime lock is unavailable: {RUNTIME_LOCK}") from error
    locked = locked_dependencies(RUNTIME_LOCK, lock_payload)
    if locked.get("rembg") != "2.0.77" or "onnxruntime" not in locked:
        raise RuntimeError("packshot runtime lock is not rooted in rembg[cpu]==2.0.77")

    installed: dict[str, str] = {}
    for distribution in importlib.metadata.distributions():
        name = distribution.metadata.get("Name")
        if name:
            installed[canonical_distribution_name(name)] = distribution.version
    missing = sorted(name for name in locked if name not in installed)
    mismatched = sorted(
        f"{name}=={installed[name]} (lock: {version})"
        for name, version in locked.items()
        if name in installed and installed[name] != version
    )
    unlocked = sorted(
        name
        for name in installed
        if name not in locked and name not in BOOTSTRAP_DISTRIBUTIONS
    )
    if missing or mismatched or unlocked:
        problems = []
        if missing:
            problems.append(f"missing: {', '.join(missing)}")
        if mismatched:
            problems.append(f"version mismatch: {', '.join(mismatched)}")
        if unlocked:
            problems.append(f"unlocked: {', '.join(unlocked)}")
        raise RuntimeError("packshot runtime does not match the lock (" + "; ".join(problems) + ")")

    provider, provider_chain = execution_provider("cpu")
    if provider != "CPUExecutionProvider" or provider_chain != ["CPUExecutionProvider"]:
        raise RuntimeError("packshot runtime did not resolve to the CPU-only provider chain")
    _, session_options = deterministic_session_options()
    return {
        "pythonVersion": platform.python_version(),
        "pythonImplementation": platform.python_implementation(),
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "runtimeLockPath": str(RUNTIME_LOCK.relative_to(ROOT)),
        "runtimeLockSha256": hashlib.sha256(lock_payload).hexdigest(),
        "lockedDistributionCount": len(locked),
        "lockedDistributions": dict(sorted(locked.items())),
        "executionProvider": provider,
        "providerChain": provider_chain,
        "sessionOptions": session_options,
    }


def find_candidate(intake_path: Path, candidate_id: str) -> dict[str, Any]:
    if not CANDIDATE_ID.fullmatch(candidate_id):
        raise ValueError("candidate id must be a lowercase hyphenated identifier")
    manifest = json.loads(intake_path.read_text())
    matches = [item for item in manifest.get("candidates", []) if item.get("id") == candidate_id]
    if len(matches) != 1:
        raise ValueError(f"expected one intake candidate named {candidate_id}, found {len(matches)}")
    return matches[0]


def read_validated_source(candidate: dict[str, Any], source_path: Path) -> tuple[bytes, str, int]:
    """Read once, then bind validation, decoding and the identity copy to those bytes."""

    try:
        with source_path.open("rb") as source:
            source_payload = source.read(MAX_SOURCE_BYTES + 1)
    except (FileNotFoundError, IsADirectoryError) as error:
        raise ValueError(f"source file does not exist: {source_path}") from error
    source_byte_size = len(source_payload)
    if source_byte_size <= 0 or source_byte_size > MAX_SOURCE_BYTES:
        raise ValueError("source file is empty or exceeds 20 MB")
    asset = candidate.get("asset", {})
    expected = asset.get("sourceAssetSha256")
    if not isinstance(expected, str) or len(expected) != 64:
        raise ValueError("intake candidate has no valid sourceAssetSha256")
    actual = hashlib.sha256(source_payload).hexdigest()
    if actual != expected:
        raise ValueError(f"source hash mismatch: expected {expected}, received {actual}")
    if source_byte_size != asset.get("sourceAssetByteSize"):
        raise ValueError("source byte size does not match the intake snapshot")
    source_url = asset.get("sourceUrl")
    if not isinstance(source_url, str) or not source_url.startswith("https://"):
        raise ValueError("intake candidate has no secure source URL")
    return source_payload, actual, source_byte_size


def execution_provider(requested: str) -> tuple[str, list[str]]:
    import onnxruntime as ort

    available = set(ort.get_available_providers())
    if requested != "cpu":
        raise RuntimeError("the exact-SKU packshot operator supports only the CPU provider")
    if "CPUExecutionProvider" not in available:
        raise RuntimeError("CPUExecutionProvider is unavailable")
    return "CPUExecutionProvider", ["CPUExecutionProvider"]


def model_path(model: str) -> Path:
    root = Path(os.environ.get("U2NET_HOME", ROOT / ".u2net"))
    return root / f"{model}.onnx"


def srgb_profile_bytes() -> bytes:
    from PIL import ImageCms

    profile = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    # LittleCMS stamps profile creation time in the ICC header. Fix only that
    # metadata field so identical source pixels and a locked runtime stay hash-stable.
    profile[24:36] = struct.pack(">6H", 2026, 7, 22, 0, 0, 0)
    stable = bytes(profile)
    ImageCms.ImageCmsProfile(io.BytesIO(stable))
    return stable


def to_srgb(opened: Any) -> tuple[Any, str]:
    from PIL import ImageCms

    embedded = opened.info.get("icc_profile")
    if not embedded:
        return opened.convert("RGBA"), "untagged-assumed-srgb"
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    source_profile = ImageCms.ImageCmsProfile(io.BytesIO(embedded))
    converted = ImageCms.profileToProfile(
        opened.convert("RGB"), source_profile, profile, outputMode="RGB"
    )
    return converted.convert("RGBA"), "embedded-profile-converted-to-srgb"


def component_removal_metrics(
    inferred_count: int,
    retained_count: int,
    raw_foreground: int,
    cleaned_foreground: int,
) -> dict[str, Any]:
    removed_foreground = raw_foreground - cleaned_foreground
    if removed_foreground < 0:
        raise ValueError("cleaned foreground cannot exceed inferred foreground")
    removed_fraction = removed_foreground / max(1, raw_foreground)
    if removed_fraction > 0.05:
        raise ValueError(
            f"component cleanup would remove {removed_fraction:.2%} of inferred foreground"
        )
    return {
        "inferredComponentCount": inferred_count,
        "retainedComponentCount": retained_count,
        "removedComponentCount": inferred_count - retained_count,
        "rawForegroundPixelCount": raw_foreground,
        "removedForegroundPixelCount": removed_foreground,
        "removedForegroundFraction": round(float(removed_fraction), 6),
        "componentReviewRequired": bool(removed_fraction > 0.01),
    }


def clean_mask(mask: Any) -> tuple[Any, dict[str, Any]]:
    import numpy as np
    from scipy import ndimage

    alpha = np.asarray(mask.convert("L"), dtype=np.uint8)
    labels, count = ndimage.label(alpha >= MASK_THRESHOLD)
    if count == 0:
        raise ValueError("background-removal mask is empty")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    largest = int(areas.max(initial=0))
    minimum = max(24, int(largest * 0.003), int(alpha.size * 0.00005))
    keep = np.flatnonzero(areas >= minimum)
    cleaned = np.where(np.isin(labels, keep), alpha, 0).astype(np.uint8)
    raw_foreground = int((alpha >= MASK_THRESHOLD).sum())
    cleaned_foreground = int((cleaned >= MASK_THRESHOLD).sum())
    component_metrics = component_removal_metrics(
        int(count), int(len(keep)), raw_foreground, cleaned_foreground
    )
    cleaned[cleaned < 12] = 0
    cleaned[cleaned > 244] = 255
    return cleaned, component_metrics


def alpha_bounds(alpha: Any) -> tuple[int, int, int, int]:
    import numpy as np

    ys, xs = np.nonzero(alpha >= MASK_THRESHOLD)
    if not len(xs) or not len(ys):
        raise ValueError("cleaned mask has no foreground")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edge_contact(alpha: Any) -> float:
    import numpy as np

    band = max(1, round(min(alpha.shape) * 0.012))
    edges = np.zeros_like(alpha, dtype=bool)
    edges[:band, :] = True
    edges[-band:, :] = True
    edges[:, :band] = True
    edges[:, -band:] = True
    return float(np.logical_and(alpha >= MASK_THRESHOLD, edges).sum() / max(1, edges.sum()))


def resize_premultiplied(subject: Any, target: tuple[int, int]) -> Any:
    import numpy as np
    from PIL import Image

    pixels = np.asarray(subject.convert("RGBA"), dtype=np.float32)
    alpha = pixels[:, :, 3:4] / 255.0
    premultiplied = np.concatenate((pixels[:, :, :3] * alpha, pixels[:, :, 3:4]), axis=2)
    resized_channels = []
    for channel in range(4):
        layer = Image.fromarray(np.clip(premultiplied[:, :, channel], 0, 255).astype(np.uint8), "L")
        resized_channels.append(np.asarray(layer.resize(target, Image.Resampling.LANCZOS), dtype=np.float32))
    resized = np.stack(resized_channels, axis=2)
    resized_alpha = resized[:, :, 3:4]
    safe_alpha = np.maximum(resized_alpha / 255.0, 1 / 255.0)
    rgb = np.where(resized_alpha > 0, resized[:, :, :3] / safe_alpha, 0)
    rgba = np.concatenate((np.clip(rgb, 0, 255), np.clip(resized_alpha, 0, 255)), axis=2).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def normalize(source: Any, alpha: Any) -> tuple[Any, dict[str, Any]]:
    import numpy as np
    from PIL import Image

    left, top, right, bottom = alpha_bounds(alpha)
    source_pixels = np.asarray(source.convert("RGBA")).copy()
    source_pixels[:, :, 3] = alpha
    isolated = Image.fromarray(source_pixels, "RGBA")
    subject = isolated.crop((left, top, right, bottom))
    scale = SUBJECT_LONGEST_EDGE / max(subject.size)
    target = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    resized = resize_premultiplied(subject, target)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset = ((CANVAS_SIZE - resized.width) // 2, (CANVAS_SIZE - resized.height) // 2)
    canvas.alpha_composite(resized, offset)
    output_alpha = np.asarray(canvas.getchannel("A"), dtype=np.uint8)
    return canvas, {
        "sourceAlphaBounds": [left, top, right, bottom],
        "sourceForegroundFraction": round(float((alpha >= MASK_THRESHOLD).sum() / alpha.size), 6),
        "sourceEdgeContactFraction": round(edge_contact(alpha), 6),
        "subjectTargetSize": [resized.width, resized.height],
        "subjectScale": round(scale, 6),
        "outputAlphaBounds": list(alpha_bounds(output_alpha)),
        "transparentPixelCount": int((output_alpha == 0).sum()),
        "partialAlphaPixelCount": int(np.logical_and(output_alpha > 0, output_alpha < 255).sum()),
        "opaquePixelCount": int((output_alpha == 255).sum()),
    }


def review_sheet(source: Any, output: Any, path: Path, profile: bytes) -> None:
    from PIL import Image, ImageDraw, ImageFont, ImageOps

    panel = 800
    sheet = Image.new("RGB", (panel * 4, panel), "#fffaf7")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    source_preview = ImageOps.contain(source.convert("RGB"), (650, 650), Image.Resampling.LANCZOS)
    sheet.paste(source_preview, ((panel - source_preview.width) // 2, 80 + (650 - source_preview.height) // 2))
    draw.text((24, 24), "Identity master", font=font, fill="#30211f")
    for index, (name, color) in enumerate(SURFACES.items(), start=1):
        surface = Image.new("RGBA", (panel, panel), color)
        preview = ImageOps.contain(output, (650, 650), Image.Resampling.LANCZOS)
        surface.alpha_composite(preview, ((panel - preview.width) // 2, 80 + (650 - preview.height) // 2))
        sheet.paste(surface.convert("RGB"), (index * panel, 0))
        draw.text((index * panel + 24, 24), name.capitalize(), font=font, fill="#ffffff" if name == "dark" else "#30211f")
    sheet.save(path, "JPEG", quality=94, subsampling=0, icc_profile=profile)


def process_source(
    source: Any,
    model: str,
    requested_provider: str,
) -> tuple[Any, str, Path, str, dict[str, Any], dict[str, Any]]:
    from rembg import new_session, remove

    provider, providers = execution_provider(requested_provider)
    weights = model_path(model)
    if not weights.is_file():
        raise ValueError(f"model weights are unavailable: {weights}")
    weights_sha256 = file_sha256(weights)
    session_options, _ = deterministic_session_options()
    session = new_session(model, sess_opts=session_options, providers=providers)
    session_contract = verified_loaded_session_contract(session, providers)
    if file_sha256(weights) != weights_sha256:
        raise ValueError("model weights changed while the inference session was loading")
    mask = remove(source, session=session, only_mask=True, post_process_mask=True)
    if file_sha256(weights) != weights_sha256:
        raise ValueError("model weights changed during inference")
    alpha, component_metrics = clean_mask(mask)
    output, metrics = normalize(source, alpha)
    return (
        output,
        provider,
        weights,
        weights_sha256,
        session_contract,
        {**component_metrics, **metrics},
    )


def sync_path(path: Path) -> None:
    with path.open("rb") as handle:
        os.fsync(handle.fileno())


def sync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(value, indent=2) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        sync_directory(path.parent)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def verify_artifacts(
    identity_path: Path,
    output_path: Path,
    sheet_path: Path,
    source_sha256: str,
    profile_sha256: str,
) -> dict[str, dict[str, Any]]:
    from PIL import Image

    if file_sha256(identity_path) != source_sha256:
        raise ValueError("cached identity master no longer matches the source")
    with Image.open(output_path) as image:
        image.verify()
    with Image.open(output_path) as image:
        profile = image.info.get("icc_profile")
        if image.format != "PNG" or image.mode != "RGBA" or image.size != (CANVAS_SIZE, CANVAS_SIZE):
            raise ValueError("review master failed PNG, RGBA, or dimension verification")
        if not profile or hashlib.sha256(profile).hexdigest() != profile_sha256:
            raise ValueError("review master is missing the bound sRGB profile")
        extrema = image.getchannel("A").getextrema()
        if extrema[0] != 0 or extrema[1] == 0:
            raise ValueError("review master does not contain transparent and visible pixels")
    with Image.open(sheet_path) as sheet:
        sheet.verify()
    with Image.open(sheet_path) as sheet:
        profile = sheet.info.get("icc_profile")
        if sheet.format != "JPEG" or sheet.size != (3_200, 800):
            raise ValueError("surface review failed JPEG or dimension verification")
        if not profile or hashlib.sha256(profile).hexdigest() != profile_sha256:
            raise ValueError("surface review is missing the bound sRGB profile")
    return {
        "identityMaster": {
            "path": identity_path.name,
            "sha256": file_sha256(identity_path),
            "byteSize": identity_path.stat().st_size,
        },
        "reviewMaster": {
            "path": output_path.name,
            "sha256": file_sha256(output_path),
            "byteSize": output_path.stat().st_size,
        },
        "surfaceReview": {
            "path": sheet_path.name,
            "sha256": file_sha256(sheet_path),
            "byteSize": sheet_path.stat().st_size,
        },
    }


def main() -> int:
    args = arguments()
    if not CANDIDATE_ID.fullmatch(args.candidate_id):
        raise ValueError("candidate id must be a lowercase hyphenated identifier")
    runtime = validate_runtime()

    from PIL import Image, ImageOps, PngImagePlugin

    Image.MAX_IMAGE_PIXELS = MAX_SOURCE_AREA
    intake_path = args.intake.resolve()
    source_path = args.source.resolve()
    output_base = args.output_root.resolve()
    lexical_output_root = output_base / args.candidate_id
    output_root = lexical_output_root.resolve()
    if lexical_output_root.is_symlink() or output_root != lexical_output_root:
        raise ValueError("candidate output cannot be a symlink or alias")
    if output_root.parent != output_base:
        raise ValueError("candidate output must stay inside the review cache")

    candidate = find_candidate(intake_path, args.candidate_id)
    source_payload, source_sha256, source_byte_size = read_validated_source(candidate, source_path)
    with Image.open(io.BytesIO(source_payload)) as decoded:
        source_format = decoded.format or "unknown"
        if getattr(decoded, "is_animated", False) or getattr(decoded, "n_frames", 1) != 1:
            raise ValueError("animated or multi-frame sources are not supported")
        if decoded.width * decoded.height > MAX_SOURCE_AREA:
            raise ValueError("decoded source exceeds 30 megapixels")
        opened = ImageOps.exif_transpose(decoded)
        opened.load()
        if opened.width * opened.height > MAX_SOURCE_AREA:
            raise ValueError("oriented source exceeds 30 megapixels")
    asset = candidate.get("asset", {})
    if [opened.width, opened.height] != [asset.get("sourceAssetWidth"), asset.get("sourceAssetHeight")]:
        raise ValueError("decoded source dimensions do not match the intake snapshot")
    decoded_mime = FORMAT_MIME.get(source_format)
    if decoded_mime is None or decoded_mime != asset.get("sourceAssetMimeType"):
        raise ValueError("decoded source MIME type does not match the intake snapshot")
    source, color_treatment = to_srgb(opened)
    output, provider, _weights, model_sha256, session_options, metrics = process_source(
        source, args.model, args.provider
    )
    if provider != runtime["executionProvider"]:
        raise ValueError("execution provider changed after runtime validation")
    if session_options != runtime["sessionOptions"]:
        raise ValueError("ONNX Runtime session options changed after runtime validation")
    if file_sha256(RUNTIME_LOCK) != runtime["runtimeLockSha256"]:
        raise ValueError("packshot runtime lock changed during processing")

    candidate_root = output_root
    runs_root = candidate_root / "runs"
    if runs_root.is_symlink() or runs_root.resolve() != runs_root:
        raise ValueError("candidate runs directory cannot be a symlink or alias")
    runs_root.mkdir(parents=True, exist_ok=True)
    pending_root = Path(tempfile.mkdtemp(prefix=".pending-", dir=runs_root))
    final_root: Path | None = None
    try:
        source_suffix = FORMAT_SUFFIX[source_format]
        identity_path = pending_root / f"identity-master{source_suffix}"
        output_path = pending_root / "packshot-review.png"
        sheet_path = pending_root / "surface-review.jpg"
        audit_path = pending_root / "audit.json"
        identity_path.write_bytes(source_payload)
        profile = srgb_profile_bytes()
        profile_sha256 = hashlib.sha256(profile).hexdigest()
        png_info = PngImagePlugin.PngInfo()
        png_info.add_text("JeloCare pipeline", PIPELINE_VERSION)
        png_info.add_text("JeloCare candidate", args.candidate_id)
        png_info.add_text("JeloCare color space", "sRGB IEC61966-2.1")
        output.save(
            output_path,
            "PNG",
            optimize=True,
            pnginfo=png_info,
            icc_profile=profile,
        )
        review_sheet(source, output, sheet_path, profile)
        artifacts = verify_artifacts(
            identity_path,
            output_path,
            sheet_path,
            source_sha256,
            profile_sha256,
        )

        generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        blockers = [
            "manual-full-resolution-identity-comparison-required",
            "manual-peach-pink-dark-edge-review-required",
            "intake-rights-and-market-gates-remain-authoritative",
        ]
        if metrics["componentReviewRequired"]:
            blockers.append("manual-removed-component-review-required")
        audit = {
            "schemaVersion": 1,
            "pipelineVersion": PIPELINE_VERSION,
            "generatedAt": generated_at,
            "candidate": {
                "id": candidate["id"],
                "brand": candidate["brand"],
                "variant": candidate["variant"],
                "size": candidate["size"],
                "gtin": candidate.get("identity", {}).get("gtin"),
                **(
                    {
                        "canonicalIdentifier": candidate.get("identity", {}).get(
                            "canonicalIdentifier"
                        )
                    }
                    if candidate.get("identity", {}).get("canonicalIdentifier")
                    else {}
                ),
                "intakeSha256": json_sha256(candidate),
            },
            "source": {
                "url": candidate.get("asset", {}).get("sourceUrl"),
                "sha256": source_sha256,
                "byteSize": source_byte_size,
                "format": source_format,
                "width": source.width,
                "height": source.height,
                "colorTreatment": color_treatment,
                "cachedPath": identity_path.name,
            },
            "processing": {
                "tool": "rembg alpha mask over source RGB pixels",
                "model": args.model,
                "modelSha256": model_sha256,
                "provider": provider,
                "sessionOptions": session_options,
                "dependencyVersions": dependency_versions(),
                "runtime": runtime,
                "canvas": CANVAS_SIZE,
                "subjectLongestEdge": SUBJECT_LONGEST_EDGE,
                "operations": [
                    "alpha-mask-inference",
                    "audited-small-component-removal",
                    "transparent-trim",
                    "premultiplied-lanczos-resample",
                    "centre-on-transparent-srgb-canvas",
                ],
                "packageRgbOrigin": "identity-master-source-pixels-only",
            },
            "artifacts": artifacts,
            "output": {
                "path": output_path.name,
                "sha256": artifacts["reviewMaster"]["sha256"],
                "byteSize": artifacts["reviewMaster"]["byteSize"],
                "mimeType": "image/png",
                "colorSpace": "sRGB IEC61966-2.1",
                "colorProfileSha256": profile_sha256,
                "width": output.width,
                "height": output.height,
                "hasAlpha": True,
                **metrics,
            },
            "review": {
                "status": "private-review-required",
                "identityApproved": False,
                "artApproved": False,
                "surfaceReviewPath": sheet_path.name,
                "surfaceReviewSha256": artifacts["surfaceReview"]["sha256"],
                "publicationBlockers": blockers,
            },
            "policy": "Private review material. This audit does not document rights or approve publication.",
        }
        audit_path.write_text(json.dumps(audit, indent=2) + "\n")
        for artifact_path in (identity_path, output_path, sheet_path, audit_path):
            sync_path(artifact_path)
        sync_directory(pending_root)
        with audit_path.open(encoding="utf-8") as handle:
            persisted_audit = json.load(handle)
        if persisted_audit != audit:
            raise ValueError("persisted audit no longer matches the verified run")

        run_token = review_run_token(
            candidate_id=args.candidate_id,
            source_sha256=source_sha256,
            model_sha256=model_sha256,
            provider=provider,
            session_options=session_options,
            output_sha256=artifacts["reviewMaster"]["sha256"],
        )
        run_id = f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{run_token}-{uuid.uuid4().hex[:8]}"
        final_root = runs_root / run_id
        os.replace(pending_root, final_root)
        sync_directory(runs_root)
        audit_path = final_root / audit_path.name
        output_path = final_root / output_path.name
        sheet_path = final_root / sheet_path.name
        pointer = {
            "schemaVersion": 1,
            "candidateId": args.candidate_id,
            "run": f"runs/{run_id}",
            "auditSha256": file_sha256(audit_path),
            "artifacts": artifacts,
            "status": audit["review"]["status"],
        }
        atomic_json(candidate_root / "latest.json", pointer)
    except BaseException:
        if pending_root.exists():
            shutil.rmtree(pending_root)
        raise

    print(json.dumps({
        "candidateId": args.candidate_id,
        "output": str(output_path),
        "surfaceReview": str(sheet_path),
        "audit": str(audit_path),
        "latest": str(candidate_root / "latest.json"),
        "outputSha256": audit["output"]["sha256"],
        "status": audit["review"]["status"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
