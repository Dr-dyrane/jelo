#!/usr/bin/env python3
"""Replay the two reviewed Naturium alpha repairs without network access.

The retained rollout was an interactive repair of destructive alpha masks. This
script checks every durable input before use, repeats the exact NumPy/SciPy/Pillow
operations, packages the PNG with the original text chunks and stable ICC
profile, and refuses any byte drift from the reviewed output.

Generated files are optional. Verification always happens in memory first, so a
successful exit proves both reviewed output SHA-256 values even when
``--output-dir`` is omitted.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import io
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_ROOT = ROOT / "data/catalogue-packshot-alpha-repair-evidence"
PREPARE_SCRIPT = ROOT / "scripts/prepare-reviewed-packshot.py"
RUNTIME_LOCK = ROOT / "scripts/requirements-packshots.lock.txt"

PIPELINE_VERSION = "deterministic-source-rgb-destructive-alpha-repair-v1"
PREPARE_SCRIPT_SHA256 = "98eac79846ced28ec9366cad48142093bea93a8181d9b278b23b4572728d4563"
RUNTIME_LOCK_SHA256 = "2d1aa42c51632e4466779be5c327ddc56cc5ab631e77e4627a8939b245babd05"
COLOR_PROFILE_SHA256 = "2bb2c5d0a923a30b44c059e69fab438ac220b3fd6f1dd42f34987be0d8b98758"
REQUIRED_PYTHON = (3, 12)
REQUIRED_DISTRIBUTIONS = {
    "numpy": "2.4.6",
    "Pillow": "12.3.0",
    "scipy": "1.18.0",
}
MASK_THRESHOLD = 32


@dataclass(frozen=True)
class Artifact:
    relative_path: str
    sha256: str
    byte_size: int

    @property
    def path(self) -> Path:
        return ROOT / self.relative_path


@dataclass(frozen=True)
class ReplaySubject:
    candidate_id: str
    source_url: str
    source: Artifact
    precursor: Artifact
    output: Artifact
    surface_review: Artifact
    reference: Artifact | None
    expected_metrics: dict[str, Any]


SUBJECTS = {
    "naturium-smoother-glycolic-acid-body-lotion-8oz": ReplaySubject(
        candidate_id="naturium-smoother-glycolic-acid-body-lotion-8oz",
        source_url=(
            "https://naturium.com/cdn/shop/files/"
            "NATR-Smoother_glycolic_body_lotion_front.webp?v=1774292492&width=2048"
        ),
        source=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-smoother-glycolic-acid-body-lotion-8oz/source.png",
            "71f0a36856697f912bd72e9988b370815dd3bb43364bd036e742315accab71d6",
            394_940,
        ),
        precursor=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-smoother-glycolic-acid-body-lotion-8oz/precursor.png",
            "2102164cec10b43e248153b84d2d89f6770984ad4df13d1f8dd941b787e78ce7",
            392_088,
        ),
        output=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-smoother-glycolic-acid-body-lotion-8oz/output.png",
            "e1715a3073184a090c50da6744a10c12f427a4b706820b5303e9b7c4a7c89d4a",
            422_450,
        ),
        surface_review=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-smoother-glycolic-acid-body-lotion-8oz/surface-review.jpg",
            "4aa242cb228a4f5fb032b05b1b3623ce0a3c15f913a8920479ffea263e1c015f",
            180_341,
        ),
        reference=None,
        expected_metrics={
            "restoredPrecursorComponentCount": 1,
            "restoredPrecursorForegroundPixelCount": 1_150_630,
            "finalSourceComponentCount": 1,
            "finalSourceForegroundPixelCount": 1_084_598,
            "addedForegroundPixelCount": 0,
            "removedForegroundPixelCount": 66_032,
            "removedForegroundFraction": 0.05738769,
            "sourceEdgeContactFractionBefore": 0.05988,
            "sourceEdgeContactFractionAfter": 0.0,
            "sourceAlphaBounds": [620, 37, 1378, 1865],
            "sourceForegroundFraction": 0.271149,
            "subjectTargetSize": [680, 1640],
            "subjectScale": 0.897155,
            "outputAlphaBounds": [660, 180, 1340, 1820],
            "transparentPixelCount": 3_118_855,
            "partialAlphaPixelCount": 21_717,
            "opaquePixelCount": 859_428,
            "outputComponentCount": 1,
            "outputHolePixelCount": 0,
            "outputEdgeAlphaMax": 0,
        },
    ),
    "naturium-kp-body-scrub-mask-8oz": ReplaySubject(
        candidate_id="naturium-kp-body-scrub-mask-8oz",
        source_url=(
            "https://naturium.com/cdn/shop/files/"
            "NATR-KP_Scrub_Front.webp?v=1774290427&width=2048"
        ),
        source=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-kp-body-scrub-mask-8oz/source.png",
            "d752e5e94722a34541b2522fb98d002026857dd684a864c9ca35a7336c574ef4",
            363_205,
        ),
        precursor=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-kp-body-scrub-mask-8oz/precursor.png",
            "78ceb70e267aded1eb510b24f62e3a4a6cff9b156fb9336098ebe83a9a415685",
            297_158,
        ),
        output=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-kp-body-scrub-mask-8oz/output.png",
            "5cc956c30672fdcd7c56db2bf156a330b48fe23dbb0cb84feb05e78fd9228edd",
            369_935,
        ),
        surface_review=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-kp-body-scrub-mask-8oz/surface-review.jpg",
            "cb9924c912576e53e8519202d4d4049e097d9a07594edf64aca0c0ed41879c72",
            171_840,
        ),
        reference=Artifact(
            "data/catalogue-packshot-alpha-repair-evidence/"
            "naturium-kp-body-scrub-mask-8oz/shared-official-background-reference.png",
            "ef31f7fc497c3d704c4fffa697b131e94cfa08136b9f5f5b3bf6bf49a3668c2b",
            235_893,
        ),
        expected_metrics={
            "restoredPrecursorComponentCount": 4,
            "restoredPrecursorForegroundPixelCount": 841_143,
            "finalSourceComponentCount": 1,
            "finalSourceForegroundPixelCount": 1_112_335,
            "addedForegroundPixelCount": 271_193,
            "removedForegroundPixelCount": 1,
            "removedForegroundFraction": 0.00000119,
            "sourceEdgeContactFractionBefore": 0.0,
            "sourceEdgeContactFractionAfter": 0.0,
            "sourceAlphaBounds": [606, 48, 1392, 1867],
            "sourceForegroundFraction": 0.278084,
            "subjectTargetSize": [709, 1640],
            "subjectScale": 0.901594,
            "outputAlphaBounds": [645, 180, 1354, 1820],
            "transparentPixelCount": 3_089_925,
            "partialAlphaPixelCount": 10_887,
            "opaquePixelCount": 899_188,
            "outputComponentCount": 1,
            "outputHolePixelCount": 0,
            "outputEdgeAlphaMax": 0,
        },
    ),
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path: Path, expected_sha256: str, expected_size: int | None = None) -> None:
    if not path.is_file():
        raise RuntimeError(f"required replay input is unavailable: {path}")
    if expected_size is not None and path.stat().st_size != expected_size:
        raise RuntimeError(f"replay input byte size changed: {path}")
    if file_sha256(path) != expected_sha256:
        raise RuntimeError(f"replay input SHA-256 changed: {path}")


def verify_runtime() -> Any:
    if sys.version_info[:2] != REQUIRED_PYTHON:
        raise RuntimeError("alpha repair replay requires Python 3.12")
    for distribution, expected in REQUIRED_DISTRIBUTIONS.items():
        actual = importlib.metadata.version(distribution)
        if actual != expected:
            raise RuntimeError(
                f"alpha repair replay requires {distribution}=={expected}, found {actual}"
            )
    verify_file(PREPARE_SCRIPT, PREPARE_SCRIPT_SHA256)
    verify_file(RUNTIME_LOCK, RUNTIME_LOCK_SHA256)
    spec = importlib.util.spec_from_file_location("reviewed_packshot_prep", PREPARE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load the bound packshot preparation helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    profile = module.srgb_profile_bytes()
    if hashlib.sha256(profile).hexdigest() != COLOR_PROFILE_SHA256:
        raise RuntimeError("stable output color profile changed")
    return module


def verify_subject_artifacts(subject: ReplaySubject) -> None:
    for artifact in (subject.source, subject.precursor, subject.output, subject.surface_review):
        verify_file(artifact.path, artifact.sha256, artifact.byte_size)
    if subject.reference is not None:
        verify_file(subject.reference.path, subject.reference.sha256, subject.reference.byte_size)


def restore_alpha(
    path: Path,
    bbox: tuple[int, int, int, int],
    target: tuple[int, int],
    offset: tuple[int, int],
) -> Any:
    import numpy as np
    from PIL import Image

    opened = Image.open(path).convert("RGBA")
    alpha = opened.getchannel("A").crop(
        (offset[0], offset[1], offset[0] + target[0], offset[1] + target[1])
    )
    alpha = alpha.resize(
        (bbox[2] - bbox[0], bbox[3] - bbox[1]), Image.Resampling.LANCZOS
    )
    restored = Image.new("L", (2000, 2000), 0)
    restored.paste(alpha, (bbox[0], bbox[1]))
    return np.asarray(restored, dtype=np.uint8)


def bottom_curve(rgb: Any, x0: int, x1: int) -> tuple[Any, Any]:
    import numpy as np
    from scipy.ndimage import median_filter
    from scipy.signal import savgol_filter

    floating = rgb.astype(float)
    vertical_gradient = np.linalg.norm(floating[2:] - floating[:-2], axis=2)
    xs = np.arange(x0, x1 + 1)
    raw = 1840 + np.argmax(vertical_gradient[1839:1880, xs], axis=0)
    median = median_filter(raw, 31, mode="nearest")
    return xs, savgol_filter(median, 101, 2, mode="interp")


def replay_smoother(subject: ReplaySubject, prep: Any) -> tuple[Any, Any, Any]:
    import numpy as np
    from PIL import Image

    source, _ = prep.to_srgb(Image.open(subject.source.path))
    rgb = np.asarray(source.convert("RGB"))
    before = restore_alpha(
        subject.precursor.path,
        (620, 37, 1378, 2000),
        (633, 1640),
        (683, 180),
    )
    repaired = before.copy()
    xs, curve = bottom_curve(rgb, 740, 1270)
    for x, bottom in zip(xs, curve):
        repaired[int(np.floor(bottom)) + 1 :, x] = 0
    repaired[1875:] = 0
    output, normalization = prep.normalize(source, repaired)
    return output, before, (repaired, normalization)


def replay_kp(subject: ReplaySubject, prep: Any) -> tuple[Any, Any, Any]:
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    from scipy.ndimage import percentile_filter
    from scipy.signal import savgol_filter

    if subject.reference is None:
        raise RuntimeError("KP replay requires the bound shared-official-background reference")
    source, _ = prep.to_srgb(Image.open(subject.source.path))
    reference, _ = prep.to_srgb(Image.open(subject.reference.path))
    rgb = np.asarray(source.convert("RGB"))
    reference_rgb = np.asarray(reference.convert("RGB"))
    difference = np.max(
        np.abs(rgb.astype(np.int16) - reference_rgb.astype(np.int16)), axis=2
    )

    left = np.full(2000, np.nan)
    right = np.full(2000, np.nan)
    for y in range(48, 1867):
        xs = np.where(difference[y, 500:950] >= 4)[0] + 500
        if len(xs):
            left[y] = xs.min()
        xs = np.where(difference[y, 1050:1500] >= 4)[0] + 1050
        if len(xs):
            right[y] = xs.max()

    indices = np.arange(2000)

    def smoothed_path(values: Any, percentile: int) -> Any:
        present = np.isfinite(values)
        interpolated = np.interp(indices, indices[present], values[present])
        filtered = percentile_filter(
            interpolated, size=101, percentile=percentile, mode="nearest"
        )
        return savgol_filter(filtered, 101, 2, mode="interp")

    left = smoothed_path(left, 70)
    right = smoothed_path(right, 30)
    for y in range(48, 151):
        blend = max(0, min(1, (y - 100) / 50))
        left[y] = (1 - blend) * 610 + blend * left[y]
        right[y] = (1 - blend) * 1391 + blend * right[y]

    geometry = np.zeros((2000, 2000), dtype=np.uint8)
    for y in range(48, 1867):
        start = int(np.ceil(left[y]))
        stop = int(np.floor(right[y]))
        geometry[y, start : stop + 1] = 255
    xs, curve = bottom_curve(rgb, 730, 1280)
    for x, bottom in zip(xs, curve):
        geometry[int(np.floor(bottom)) + 1 :, x] = 0
    geometry[1875:] = 0

    before = restore_alpha(
        subject.precursor.path,
        (657, 77, 1281, 1866),
        (572, 1640),
        (714, 180),
    )
    near = ndimage.binary_dilation(geometry > 0, iterations=3)
    repaired = np.maximum(geometry, np.where(near, before, 0).astype(np.uint8))
    repaired[geometry == 255] = 255
    output, normalization = prep.normalize(source, repaired)
    return output, before, (repaired, normalization)


def edge_contact(alpha: Any) -> float:
    import numpy as np

    band = max(1, round(min(alpha.shape) * 0.012))
    edges = np.zeros_like(alpha, dtype=bool)
    edges[:band, :] = True
    edges[-band:, :] = True
    edges[:, :band] = True
    edges[:, -band:] = True
    return float(np.logical_and(alpha >= MASK_THRESHOLD, edges).sum() / edges.sum())


def repair_metrics(before: Any, repaired: Any, output: Any, normalization: dict[str, Any]) -> dict[str, Any]:
    import numpy as np
    from scipy import ndimage

    before_mask = before >= MASK_THRESHOLD
    final_mask = repaired >= MASK_THRESHOLD
    output_alpha = np.asarray(output.getchannel("A"), dtype=np.uint8)
    output_mask = output_alpha >= MASK_THRESHOLD
    added = int(np.logical_and(final_mask, ~before_mask).sum())
    removed = int(np.logical_and(before_mask, ~final_mask).sum())
    before_count = int(before_mask.sum())
    holes = int(ndimage.binary_fill_holes(output_mask).sum() - output_mask.sum())
    edges = np.concatenate(
        (output_alpha[0, :], output_alpha[-1, :], output_alpha[:, 0], output_alpha[:, -1])
    )
    return {
        "restoredPrecursorComponentCount": int(ndimage.label(before_mask)[1]),
        "restoredPrecursorForegroundPixelCount": before_count,
        "finalSourceComponentCount": int(ndimage.label(final_mask)[1]),
        "finalSourceForegroundPixelCount": int(final_mask.sum()),
        "addedForegroundPixelCount": added,
        "removedForegroundPixelCount": removed,
        "removedForegroundFraction": round(removed / max(1, before_count), 8),
        "sourceEdgeContactFractionBefore": round(edge_contact(before), 6),
        "sourceEdgeContactFractionAfter": round(edge_contact(repaired), 6),
        "sourceAlphaBounds": normalization["sourceAlphaBounds"],
        "sourceForegroundFraction": normalization["sourceForegroundFraction"],
        "subjectTargetSize": normalization["subjectTargetSize"],
        "subjectScale": normalization["subjectScale"],
        "outputAlphaBounds": normalization["outputAlphaBounds"],
        "transparentPixelCount": normalization["transparentPixelCount"],
        "partialAlphaPixelCount": normalization["partialAlphaPixelCount"],
        "opaquePixelCount": normalization["opaquePixelCount"],
        "outputComponentCount": int(ndimage.label(output_mask)[1]),
        "outputHolePixelCount": holes,
        "outputEdgeAlphaMax": int(edges.max(initial=0)),
    }


def packaged_png(subject: ReplaySubject, output: Any, profile: bytes) -> bytes:
    from PIL import PngImagePlugin

    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("JeloCare pipeline", PIPELINE_VERSION)
    metadata.add_text("JeloCare candidate", subject.candidate_id)
    metadata.add_text("JeloCare source sha256", subject.source.sha256)
    metadata.add_text("JeloCare source URL", subject.source_url)
    buffer = io.BytesIO()
    output.convert("RGBA").save(
        buffer,
        "PNG",
        optimize=True,
        pnginfo=metadata,
        icc_profile=profile,
    )
    return buffer.getvalue()


def replay(subject: ReplaySubject, prep: Any) -> tuple[bytes, dict[str, Any]]:
    verify_subject_artifacts(subject)
    if subject.candidate_id == "naturium-smoother-glycolic-acid-body-lotion-8oz":
        output, before, state = replay_smoother(subject, prep)
    elif subject.candidate_id == "naturium-kp-body-scrub-mask-8oz":
        output, before, state = replay_kp(subject, prep)
    else:
        raise RuntimeError(f"no reviewed replay implementation for {subject.candidate_id}")
    repaired, normalization = state
    actual_metrics = repair_metrics(before, repaired, output, normalization)
    if actual_metrics != subject.expected_metrics:
        raise RuntimeError(
            f"repair metrics changed for {subject.candidate_id}: "
            f"expected {subject.expected_metrics}, received {actual_metrics}"
        )
    payload = packaged_png(subject, output, prep.srgb_profile_bytes())
    if len(payload) != subject.output.byte_size:
        raise RuntimeError(f"replayed output byte size changed for {subject.candidate_id}")
    actual_sha256 = hashlib.sha256(payload).hexdigest()
    if actual_sha256 != subject.output.sha256:
        raise RuntimeError(f"replayed output SHA-256 changed for {subject.candidate_id}")
    if payload != subject.output.path.read_bytes():
        raise RuntimeError(f"replayed output bytes differ for {subject.candidate_id}")
    return payload, actual_metrics


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--candidate-id",
        action="append",
        choices=tuple(SUBJECTS),
        help="Replay one candidate; repeat to select both. Defaults to both.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Optionally write verified PNG bytes to this directory.",
    )
    parser.add_argument("--json", action="store_true", help="Emit a JSON verification report.")
    return parser.parse_args()


def main() -> int:
    args = arguments()
    prep = verify_runtime()
    selected = args.candidate_id or list(SUBJECTS)
    results = []
    for candidate_id in selected:
        subject = SUBJECTS[candidate_id]
        payload, metrics = replay(subject, prep)
        if args.output_dir is not None:
            args.output_dir.mkdir(parents=True, exist_ok=True)
            target = args.output_dir / f"{candidate_id}.png"
            target.write_bytes(payload)
        results.append(
            {
                "candidateId": candidate_id,
                "outputSha256": subject.output.sha256,
                "outputByteSize": subject.output.byte_size,
                "metrics": metrics,
            }
        )
    report = {
        "pipelineVersion": PIPELINE_VERSION,
        "replayScriptSha256": file_sha256(Path(__file__).resolve()),
        "prepareScriptSha256": PREPARE_SCRIPT_SHA256,
        "runtimeLockSha256": RUNTIME_LOCK_SHA256,
        "colorProfileSha256": COLOR_PROFILE_SHA256,
        "results": results,
    }
    if args.json:
        print(json.dumps(report, sort_keys=True, separators=(",", ":")))
    else:
        for result in results:
            print(
                f"verified {result['candidateId']} "
                f"sha256={result['outputSha256']} bytes={result['outputByteSize']}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
