#!/usr/bin/env python3
"""Create source-faithful, transparent catalogue packshots for human review.

This operator tool never invents or redraws packaging. It downloads the full-size
Open Beauty Facts front image, extracts the photographed foreground, places it on
a consistent transparent canvas, and writes side-by-side contact sheets. Nothing
is publishable until the generated audit is accepted by a human review pass.

Install the isolated dependency set with:
  python3 -m venv .cache/rembg-venv
  .cache/rembg-venv/bin/pip install -r scripts/requirements-packshots.txt
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.metadata
import io
import json
import math
import os
import sys
import time
import urllib.request
from urllib.parse import urlparse
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from rembg import new_session, remove
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / ".cache/openbeautyfacts-candidates.json"
DEFAULT_OUTPUT = ROOT / ".cache/catalogue-packshots"
CANVAS_SIZE = 1000
SUBJECT_SIZE = 820
MAX_SOURCE_PIXELS = 1600
MAX_SOURCE_AREA = 25_000_000
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
USER_AGENT = "JeloCarePackshotPipeline/1.0 (hello@dyrane.tech)"
MASK_THRESHOLD = 32
WORKER_SESSION: Any | None = None
WORKER_MODEL_SHA256 = ""
PIPELINE_VERSION = "rembg-2.0.77-normalization-v3-lossless"


@dataclass
class PackshotAudit:
    barcode: str
    brand: str
    name: str
    source_url: str
    full_source_url: str
    source_sha256: str
    status: str
    reasons: list[str]
    source_width: int
    source_height: int
    processed_width: int
    processed_height: int
    foreground_fraction: float
    subject_width_fraction: float
    subject_height_fraction: float
    minimum_margin_fraction: float
    edge_contact_fraction: float
    component_count: int
    sharpness: float
    source_cache_path: str
    output_path: str
    output_sha256: str
    output_bytes: int
    candidate_sha256: str
    source_cache_sha256: str
    processing_model: str
    processing_model_sha256: str
    processing_version: str
    processing_provider: str
    pipeline_fingerprint: str


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model", default="u2net")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--ids", default="", help="Comma-separated barcodes")
    parser.add_argument("--sheet-size", type=int, default=36)
    parser.add_argument("--workers", type=int, default=0, help="0 chooses a provider-aware default")
    parser.add_argument("--provider", choices=("auto", "coreml", "cpu"), default="auto")
    parser.add_argument("--resume", action="store_true")
    return parser.parse_args()


def full_image_url(source_url: str) -> str:
    for suffix in (".400.jpg", ".200.jpg"):
        if source_url.lower().endswith(suffix):
            return f"{source_url[:-len(suffix)]}.full.jpg"
    return source_url


def json_sha256(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def model_file(model: str) -> Path:
    model_root = Path(os.environ.get("U2NET_HOME", ROOT / ".u2net"))
    return model_root / f"{model}.onnx"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_sha256(model: str) -> str:
    path = model_file(model)
    return file_sha256(path) if path.exists() else ""


def dependency_versions() -> dict[str, str]:
    names = ("rembg", "onnxruntime", "numpy", "Pillow", "scipy")
    versions: dict[str, str] = {}
    for name in names:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = "unavailable"
    return versions


def pipeline_fingerprint(model: str, provider: str, weights_sha256: str) -> str:
    return json_sha256({
        "pipelineVersion": PIPELINE_VERSION,
        "model": model,
        "modelSha256": weights_sha256,
        "provider": provider,
        "dependencies": dependency_versions(),
        "canvas": CANVAS_SIZE,
        "subjectLongestEdge": SUBJECT_SIZE,
        "outputEncoding": "lossless-webp",
    })


def download(url: str) -> bytes:
    parsed_host = urlparse(url).hostname
    if parsed_host != "images.openbeautyfacts.org":
        raise ValueError("source image host is not approved")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "image/jpeg,image/png,image/webp,*/*;q=0.1"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        if urlparse(response.geturl()).hostname != "images.openbeautyfacts.org":
            raise ValueError("source image redirect host is not approved")
        content_length = int(response.headers.get("content-length") or 0)
        if content_length > MAX_DOWNLOAD_BYTES:
            raise ValueError("source image exceeds 12 MB")
        payload = response.read(MAX_DOWNLOAD_BYTES + 1)
    if not payload or len(payload) > MAX_DOWNLOAD_BYTES:
        raise ValueError("source image is empty or exceeds 12 MB")
    return payload


def decode(payload: bytes) -> Image.Image:
    opened = Image.open(io.BytesIO(payload))
    if opened.width * opened.height > MAX_SOURCE_AREA:
        raise ValueError("source image exceeds the decoded pixel limit")
    image = ImageOps.exif_transpose(opened).convert("RGBA")
    if max(image.size) > MAX_SOURCE_PIXELS:
        image.thumbnail((MAX_SOURCE_PIXELS, MAX_SOURCE_PIXELS), Image.Resampling.LANCZOS)
    return image


def execution_provider(requested: str) -> tuple[str, list[str]]:
    available = set(ort.get_available_providers())
    if requested == "coreml" and "CoreMLExecutionProvider" not in available:
        raise RuntimeError("CoreMLExecutionProvider is unavailable")
    use_coreml = requested == "coreml" or (requested == "auto" and "CoreMLExecutionProvider" in available)
    if use_coreml:
        return "CoreMLExecutionProvider", ["CoreMLExecutionProvider", "CPUExecutionProvider"]
    return "CPUExecutionProvider", ["CPUExecutionProvider"]


def mask_components(alpha: np.ndarray) -> tuple[np.ndarray, int]:
    binary = alpha >= MASK_THRESHOLD
    labels, count = ndimage.label(binary)
    if count == 0:
        return np.zeros_like(alpha, dtype=np.uint8), 0
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    largest = int(areas.max(initial=0))
    minimum = max(24, int(largest * 0.018), int(alpha.size * 0.00035))
    keep_labels = np.flatnonzero(areas >= minimum)
    kept = np.isin(labels, keep_labels)
    softened = np.where(kept, alpha, 0).astype(np.uint8)
    softened[softened < 12] = 0
    softened[softened > 244] = 255
    return softened, int(len(keep_labels))


def alpha_bounds(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(alpha >= MASK_THRESHOLD)
    if not len(xs) or not len(ys):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edge_contact(alpha: np.ndarray) -> float:
    height, width = alpha.shape
    band = max(1, round(min(width, height) * 0.012))
    edge = np.zeros_like(alpha, dtype=bool)
    edge[:band, :] = True
    edge[-band:, :] = True
    edge[:, :band] = True
    edge[:, -band:] = True
    return float(np.logical_and(alpha >= MASK_THRESHOLD, edge).sum() / max(1, edge.sum()))


def image_sharpness(image: Image.Image, alpha: np.ndarray) -> float:
    grayscale = image.convert("L").filter(ImageFilter.FIND_EDGES)
    values = np.asarray(grayscale, dtype=np.float32)
    foreground = values[alpha >= 32]
    if not foreground.size:
        return 0.0
    return float(np.std(foreground))


def normalize_cutout(cutout: Image.Image, alpha: np.ndarray) -> tuple[Image.Image, dict[str, float | int]]:
    bounds = alpha_bounds(alpha)
    if not bounds:
        raise ValueError("foreground mask is empty")
    left, top, right, bottom = bounds
    pixels = np.asarray(cutout.convert("RGBA")).copy()
    pixels[:, :, 3] = alpha
    cleaned = Image.fromarray(pixels, mode="RGBA")
    subject = cleaned.crop(bounds)
    scale = SUBJECT_SIZE / max(subject.size)
    target_width = max(1, round(subject.width * scale))
    target_height = max(1, round(subject.height * scale))
    subject = subject.resize((target_width, target_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - subject.width) // 2
    y = (CANVAS_SIZE - subject.height) // 2
    canvas.alpha_composite(subject, (x, y))
    return canvas, {
        "subject_width_fraction": (right - left) / cutout.width,
        "subject_height_fraction": (bottom - top) / cutout.height,
        "foreground_fraction": float((alpha >= MASK_THRESHOLD).sum() / alpha.size),
        "minimum_margin_fraction": min(
            left / cutout.width,
            top / cutout.height,
            (cutout.width - right) / cutout.width,
            (cutout.height - bottom) / cutout.height,
        ),
    }


def classification(
    source: Image.Image,
    metrics: dict[str, float | int],
    contact: float,
    components: int,
    sharpness: float,
) -> tuple[str, list[str]]:
    reasons: list[str] = []
    longest = max(source.size)
    shortest = min(source.size)
    foreground = float(metrics["foreground_fraction"])
    subject_width = float(metrics["subject_width_fraction"])
    subject_height = float(metrics["subject_height_fraction"])
    minimum_margin = float(metrics["minimum_margin_fraction"])

    if longest < 600:
        reasons.append("limited-source-resolution")
    if shortest < 240:
        reasons.append("narrow-source")
    if foreground < 0.025:
        reasons.append("subject-too-small")
    if foreground > 0.82:
        reasons.append("background-likely-retained")
    if contact > 0.1:
        reasons.append("likely-clipped")
    elif contact > 0.025:
        reasons.append("tight-source-edge")
    if minimum_margin < 0.004 and "likely-clipped" not in reasons:
        reasons.append("likely-clipped")
    elif minimum_margin < 0.015 and "tight-source-edge" not in reasons:
        reasons.append("tight-source-edge")
    if subject_width > 0.985 or subject_height > 0.985:
        reasons.append("insufficient-source-padding")
    if components > 7:
        reasons.append("complex-foreground")
    if sharpness < 13:
        reasons.append("soft-source")

    blocking = {
        "subject-too-small",
        "background-likely-retained",
        "likely-clipped",
        "soft-source",
    }
    if any(reason in blocking for reason in reasons):
        return "quarantine", reasons
    if reasons:
        return "review", reasons
    return "ready", ["source-faithful-transparent-cutout"]


def prepare_one(
    product: dict[str, Any],
    session: Any,
    model: str,
    provider: str,
    weights_sha256: str,
    output_root: Path,
) -> PackshotAudit:
    barcode = str(product["barcode"])
    source_url = str(product["sourceImageUrl"])
    full_url = full_image_url(source_url)
    retrieved_url = full_url
    try:
        payload = download(retrieved_url)
        source = decode(payload)
    except Exception:
        if retrieved_url == source_url:
            raise
        retrieved_url = source_url
        payload = download(retrieved_url)
        source = decode(payload)
    source_width, source_height = source.size
    source_cache_path = output_root / "sources" / f"{barcode}.webp"
    source_cache_path.parent.mkdir(parents=True, exist_ok=True)
    source_preview = source.copy()
    source_preview.thumbnail((700, 700), Image.Resampling.LANCZOS)
    source_preview.convert("RGB").save(source_cache_path, "WEBP", quality=84, method=5)
    source_cache_sha256 = file_sha256(source_cache_path)
    cutout = remove(source, session=session, post_process_mask=True).convert("RGBA")
    alpha = np.asarray(cutout.getchannel("A"), dtype=np.uint8)
    alpha, components = mask_components(alpha)
    contact = edge_contact(alpha)
    sharpness = image_sharpness(source, alpha)
    normalized, metrics = normalize_cutout(cutout, alpha)
    status, reasons = classification(source, metrics, contact, components, sharpness)

    output_path = output_root / "images" / f"{barcode}.webp"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(output_path, "WEBP", lossless=True, method=6, exact=True)
    output_bytes = output_path.read_bytes()
    return PackshotAudit(
        barcode=barcode,
        brand=str(product["brand"]),
        name=str(product["name"]),
        source_url=source_url,
        full_source_url=retrieved_url,
        source_sha256=hashlib.sha256(payload).hexdigest(),
        status=status,
        reasons=reasons,
        source_width=source_width,
        source_height=source_height,
        processed_width=CANVAS_SIZE,
        processed_height=CANVAS_SIZE,
        foreground_fraction=round(float(metrics["foreground_fraction"]), 5),
        subject_width_fraction=round(float(metrics["subject_width_fraction"]), 5),
        subject_height_fraction=round(float(metrics["subject_height_fraction"]), 5),
        minimum_margin_fraction=round(float(metrics["minimum_margin_fraction"]), 5),
        edge_contact_fraction=round(contact, 5),
        component_count=components,
        sharpness=round(sharpness, 3),
        source_cache_path=str(source_cache_path.relative_to(ROOT)),
        output_path=str(output_path.relative_to(ROOT)),
        output_sha256=hashlib.sha256(output_bytes).hexdigest(),
        output_bytes=len(output_bytes),
        candidate_sha256=json_sha256(product),
        source_cache_sha256=source_cache_sha256,
        processing_model=model,
        processing_model_sha256=weights_sha256,
        processing_version=PIPELINE_VERSION,
        processing_provider=provider,
        pipeline_fingerprint=pipeline_fingerprint(model, provider, weights_sha256),
    )


def initialize_worker(model: str, providers: list[str]) -> None:
    global WORKER_MODEL_SHA256, WORKER_SESSION
    WORKER_SESSION = new_session(model, providers=providers)
    WORKER_MODEL_SHA256 = model_sha256(model)
    if not WORKER_MODEL_SHA256:
        raise RuntimeError(f"model weights are unavailable for {model}")


def prepare_in_worker(product: dict[str, Any], model: str, provider: str, output_root: str) -> PackshotAudit:
    if WORKER_SESSION is None:
        raise RuntimeError("background-removal worker was not initialized")
    try:
        return prepare_one(product, WORKER_SESSION, model, provider, WORKER_MODEL_SHA256, Path(output_root))
    except Exception as error:
        # urllib exceptions may retain an unpicklable response stream. Return a
        # plain exception so one bad source never breaks the process pool.
        raise RuntimeError(str(error)) from None


def contact_sheet(
    audits: list[PackshotAudit],
    products: dict[str, dict[str, Any]],
    output_root: Path,
    page: int,
) -> None:
    columns = 6
    rows = math.ceil(len(audits) / columns)
    tile_width = 240
    tile_height = 246
    sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "#fffaf7")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, audit in enumerate(audits):
        column = index % columns
        row = index // columns
        x = column * tile_width
        y = row * tile_height
        try:
            source = Image.open(ROOT / audit.source_cache_path).convert("RGBA")
            source.thumbnail((104, 176), Image.Resampling.LANCZOS)
            source_preview = Image.new("RGB", (108, 180), "#f0ded9")
            source_preview.paste(source.convert("RGB"), ((108 - source.width) // 2, (180 - source.height) // 2))
            sheet.paste(source_preview, (x + 8, y + 8))
        except Exception:
            draw.rectangle((x + 8, y + 8, x + 116, y + 188), fill="#ecd0cc")
        normalized = Image.open(ROOT / audit.output_path).convert("RGBA")
        normalized.thumbnail((108, 180), Image.Resampling.LANCZOS)
        presentation = Image.new("RGBA", (108, 180), "#f8e6e2")
        presentation.alpha_composite(normalized, ((108 - normalized.width) // 2, (180 - normalized.height) // 2))
        sheet.paste(presentation.convert("RGB"), (x + 124, y + 8))
        color = {"ready": "#2e7658", "review": "#a56d24", "quarantine": "#ad3e4a"}[audit.status]
        label = f"{audit.brand} · {audit.name}"[:36]
        draw.text((x + 8, y + 194), label, font=font, fill="#30211f")
        draw.text((x + 8, y + 209), f"{audit.barcode} · {audit.status.upper()}", font=font, fill=color)
        draw.text((x + 8, y + 224), " · ".join(audit.reasons)[:44], font=font, fill="#715b56")

    sheets = output_root / "sheets"
    sheets.mkdir(parents=True, exist_ok=True)
    sheet.save(sheets / f"packshots-{page + 1:02d}.jpg", "JPEG", quality=90, subsampling=0)


def batched(values: list[PackshotAudit], size: int) -> Iterable[list[PackshotAudit]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def write_manifest(
    manifest_path: Path,
    products: list[dict[str, Any]],
    audits: list[PackshotAudit],
    failures: list[dict[str, str]],
    model: str,
    requested_provider: str,
    input_sha256: str,
    complete: bool,
) -> None:
    weights = sorted({audit.processing_model_sha256 for audit in audits if audit.processing_model_sha256})
    payload = {
        "schemaVersion": 2,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "complete": complete,
        "inputSha256": input_sha256,
        "candidateCount": len(products),
        "processing": {
            "model": model,
            "requestedProvider": requested_provider,
            "providers": sorted({audit.processing_provider for audit in audits}),
            "modelWeightsSha256": weights,
            "dependencyVersions": dependency_versions(),
            "tool": "rembg 2.0.77",
            "canvas": CANVAS_SIZE,
            "subjectLongestEdge": SUBJECT_SIZE,
            "policy": "Private production input only. No raw background-extracted output is publication-eligible. A final asset must preserve the exact package in a manually reviewed, rights-documented, magazine-ready photograph or styled composite.",
        },
        "summary": {
            "requested": len(products),
            "processed": len(audits),
            "failed": len(failures),
            "ready": sum(audit.status == "ready" for audit in audits),
            "review": sum(audit.status == "review" for audit in audits),
            "quarantine": sum(audit.status == "quarantine" for audit in audits),
        },
        "failures": failures,
        "audits": [asdict(audit) for audit in sorted(audits, key=lambda item: item.barcode)],
    }
    temporary = manifest_path.with_suffix(f"{manifest_path.suffix}.partial")
    temporary.write_text(json.dumps(payload, indent=2) + "\n")
    temporary.replace(manifest_path)


def main() -> int:
    args = arguments()
    args.input = args.input.resolve()
    args.output = args.output.resolve()
    products = json.loads(args.input.read_text())
    selected_ids = {value.strip() for value in args.ids.split(",") if value.strip()}
    if selected_ids:
        products = [product for product in products if str(product["barcode"]) in selected_ids]
    products = products[args.offset :]
    if args.limit:
        products = products[: args.limit]
    input_sha256 = json_sha256(products)
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "packshot-audit.json"
    provider, providers = execution_provider(args.provider)
    current_model_sha256 = model_sha256(args.model)
    current_pipeline_fingerprint = pipeline_fingerprint(args.model, provider, current_model_sha256) if current_model_sha256 else ""
    prior: dict[str, PackshotAudit] = {}
    if args.resume and manifest_path.exists():
        prior_manifest = json.loads(manifest_path.read_text())
        if (
            prior_manifest.get("schemaVersion") == 2
            and prior_manifest.get("inputSha256") == input_sha256
            and current_model_sha256
        ):
            for item in prior_manifest.get("audits", []):
                try:
                    audit = PackshotAudit(**item)
                except (TypeError, KeyError):
                    continue
                if (
                    audit.processing_version == PIPELINE_VERSION
                    and audit.processing_model == args.model
                    and audit.processing_provider == provider
                    and audit.processing_model_sha256 == current_model_sha256
                    and audit.pipeline_fingerprint == current_pipeline_fingerprint
                ):
                    prior[audit.barcode] = audit

    audits: list[PackshotAudit] = []
    failures: list[dict[str, str]] = []
    pending: list[dict[str, Any]] = []
    for product in products:
        barcode = str(product["barcode"])
        candidate_sha = json_sha256(product)
        cached = prior.get(barcode)
        output_path = ROOT / cached.output_path if cached else None
        source_cache_path = ROOT / cached.source_cache_path if cached else None
        if (
            cached
            and cached.candidate_sha256 == candidate_sha
            and cached.source_url == str(product["sourceImageUrl"])
            and output_path and output_path.exists()
            and source_cache_path and source_cache_path.exists()
            and file_sha256(output_path) == cached.output_sha256
            and file_sha256(source_cache_path) == cached.source_cache_sha256
        ):
            audits.append(cached)
        else:
            pending.append(product)

    workers = args.workers if args.workers > 0 else (4 if provider == "CoreMLExecutionProvider" else min(8, os.cpu_count() or 1))
    print(f"Loading {args.model} through {provider} in {workers} worker(s)…", flush=True)
    processed = len(audits)
    with concurrent.futures.ProcessPoolExecutor(
        max_workers=workers,
        initializer=initialize_worker,
        initargs=(args.model, providers),
    ) as executor:
        future_map = {
            executor.submit(prepare_in_worker, product, args.model, provider, str(args.output)): product
            for product in pending
        }
        for future in concurrent.futures.as_completed(future_map):
            product = future_map[future]
            barcode = str(product["barcode"])
            processed += 1
            try:
                audit = future.result()
                audits.append(audit)
                print(f"{processed}/{len(products)} {barcode} {audit.status}", flush=True)
            except Exception as error:  # noqa: BLE001 - failure is isolated per source record.
                failures.append({"barcode": barcode, "reason": str(error)})
                print(f"{processed}/{len(products)} {barcode} failed: {error}", file=sys.stderr, flush=True)
            write_manifest(manifest_path, products, audits, failures, args.model, provider, input_sha256, False)

    audits.sort(key=lambda audit: audit.barcode)
    write_manifest(manifest_path, products, audits, failures, args.model, provider, input_sha256, True)

    product_map = {str(product["barcode"]): product for product in products}
    for page, page_audits in enumerate(batched(audits, args.sheet_size)):
        contact_sheet(page_audits, product_map, args.output, page)
    print(json.dumps(json.loads(manifest_path.read_text())["summary"], indent=2))
    print(f"Audit: {manifest_path.relative_to(ROOT)}")
    print(f"Contact sheets: {(args.output / 'sheets').relative_to(ROOT)}")
    # Source drift is isolated and recorded. Selection is the hard gate: it
    # fails unless enough eligible, hashed outputs exist for the public target.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
