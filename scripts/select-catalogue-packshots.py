#!/usr/bin/env python3
"""Build an identity-bound, review-gated release of transparent packshots.

Selection is refused until preparation covers every current candidate. Schema-v1
audits created by the already-running July 2026 job remain usable only after an
exact completion, identity, source-preview, and output-hash recomputation. Human
approval is bound to the complete release hash and to every selected barcode.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import textwrap
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIT = ROOT / ".cache/catalogue-packshots/packshot-audit.json"
DEFAULT_CANDIDATES = ROOT / ".cache/openbeautyfacts-candidates.json"
DEFAULT_CANDIDATE_META = ROOT / ".cache/openbeautyfacts-candidate-meta.json"
DEFAULT_DECISIONS = ROOT / ".cache/catalogue-packshot-decisions.json"
DEFAULT_OUTPUT = ROOT / ".cache/catalogue-packshots/selection"
HASH_LENGTH = 64


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--candidate-meta", type=Path, default=DEFAULT_CANDIDATE_META)
    parser.add_argument("--decisions", type=Path, default=DEFAULT_DECISIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--target", type=int, default=977)
    parser.add_argument("--sheet-size", type=int, default=24)
    return parser.parse_args()


def read_json_bytes(path: Path) -> tuple[Any, bytes]:
    payload = path.resolve().read_bytes()
    return json.loads(payload), payload


def sha256(payload: bytes | str) -> str:
    if isinstance(payload, str):
        payload = payload.encode()
    return hashlib.sha256(payload).hexdigest()


def stable_json_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(payload)


def valid_hash(value: Any) -> bool:
    return isinstance(value, str) and len(value) == HASH_LENGTH and all(character in "0123456789abcdef" for character in value)


def inside(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def relative(path: str, approved_root: Path) -> Path:
    resolved = (ROOT / path).resolve()
    if not inside(resolved, approved_root):
        raise ValueError(f"review asset is outside {approved_root.relative_to(ROOT)}: {path}")
    return resolved


def valid_review_time(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    if parsed.tzinfo is None:
        return False
    return parsed <= datetime.now(timezone.utc).astimezone(parsed.tzinfo) + timedelta(minutes=5)


def input_context(
    audit_manifest: dict[str, Any],
    audit_bytes: bytes,
    candidates: list[dict[str, Any]],
    candidate_bytes: bytes,
    candidate_meta: dict[str, Any],
    candidate_meta_bytes: bytes,
    target: int,
) -> dict[str, Any]:
    if not candidates:
        raise RuntimeError("Candidate manifest is empty.")
    candidate_ids = [str(candidate.get("barcode", "")) for candidate in candidates]
    if len(set(candidate_ids)) != len(candidate_ids) or any(not value.isdigit() for value in candidate_ids):
        raise RuntimeError("Candidate manifest contains missing or duplicate barcodes.")
    if candidate_meta.get("candidateCount") != len(candidates):
        raise RuntimeError("Candidate metadata count does not match the candidate manifest.")
    candidate_manifest_sha256 = sha256(candidate_bytes)
    if candidate_meta.get("candidateManifestSha256") not in (None, candidate_manifest_sha256):
        raise RuntimeError("Candidate metadata is bound to a different candidate manifest.")
    if candidate_meta.get("requestedPublishedCount") != target:
        raise RuntimeError("Candidate metadata target does not match selection target.")
    source_snapshot_sha256 = candidate_meta.get("sourceSnapshotSha256")
    if not valid_hash(source_snapshot_sha256):
        raise RuntimeError("Candidate metadata has no valid source snapshot hash.")

    audits = audit_manifest.get("audits", [])
    failures = audit_manifest.get("failures", [])
    summary = audit_manifest.get("summary", {})
    if not isinstance(audits, list) or not isinstance(failures, list):
        raise RuntimeError("Audit manifest records are invalid.")
    audit_ids = [str(item.get("barcode", "")) for item in audits]
    failure_ids = [str(item.get("barcode", "")) for item in failures]
    if len(set(audit_ids)) != len(audit_ids) or len(set(failure_ids)) != len(failure_ids):
        raise RuntimeError("Audit manifest contains duplicate result barcodes.")
    if set(audit_ids) & set(failure_ids):
        raise RuntimeError("A barcode appears as both processed and failed.")
    complete_by_counts = (
        summary.get("requested") == len(candidates)
        and summary.get("processed") == len(audits)
        and summary.get("failed") == len(failures)
        and len(audits) + len(failures) == len(candidates)
        and set(audit_ids) | set(failure_ids) == set(candidate_ids)
    )
    schema_version = audit_manifest.get("schemaVersion")
    if schema_version == 2:
        expected_input_sha = stable_json_sha256(candidates)
        if not audit_manifest.get("complete") or audit_manifest.get("inputSha256") != expected_input_sha:
            raise RuntimeError("Schema-v2 preparation is incomplete or bound to different candidates.")
        if audit_manifest.get("candidateCount") != len(candidates) or not complete_by_counts:
            raise RuntimeError("Schema-v2 preparation summary does not reconcile.")
    elif schema_version == 1:
        if not complete_by_counts:
            raise RuntimeError("Legacy preparation is still running or does not cover every current candidate.")
    else:
        raise RuntimeError(f"Unsupported packshot audit schema: {schema_version!r}")

    return {
        "auditSchemaVersion": schema_version,
        "auditManifestSha256": sha256(audit_bytes),
        "candidateManifestSha256": candidate_manifest_sha256,
        "candidateMetadataSha256": sha256(candidate_meta_bytes),
        "sourceSnapshotSha256": source_snapshot_sha256,
    }


def visual_rank(item: dict[str, Any]) -> tuple[float, int]:
    """Prefer validated, clean, legible single-subject cutouts."""
    audit = item["audit"]
    candidate = item["candidate"]
    width_fraction = max(float(audit.get("subject_width_fraction", 0)), 0.001)
    height_fraction = max(float(audit.get("subject_height_fraction", 0)), 0.001)
    foreground_fraction = float(audit.get("foreground_fraction", 0))
    solidity = min(foreground_fraction / (width_fraction * height_fraction), 1.0)
    source_short_edge = min(int(audit.get("source_width", 0)), int(audit.get("source_height", 0)))
    sharpness = min(float(audit.get("sharpness", 0)), 100.0)
    edge_contact = float(audit.get("edge_contact_fraction", 0))
    component_count = max(int(audit.get("component_count", 1)), 1)
    reasons = set(audit.get("reasons", []))

    score = 120.0 if candidate.get("sourcePhotoValidated") else 0.0
    score += min(source_short_edge, 1200) / 24
    score += sharpness * 0.45
    score += min(solidity, 0.72) * 80
    score += min(height_fraction, 0.82) * 35
    score -= max(0.30 - solidity, 0) * 180
    score -= max(0.12 - foreground_fraction, 0) * 160
    score -= edge_contact * 600
    score -= max(component_count - 1, 0) * 18
    score -= 24 if "complex-foreground" in reasons else 0
    return score, -int(item["candidate_index"])


def selection_hash(selected: list[dict[str, Any]]) -> str:
    return sha256("\n".join(
        f"{item['candidate']['barcode']}:{item['audit']['output_sha256']}"
        for item in selected
    ))


def release_hash(context: dict[str, Any], selected: list[dict[str, Any]], target: int) -> str:
    lines = [
        "schema:2",
        f"target:{target}",
        f"audit-schema:{context['auditSchemaVersion']}",
        f"candidate-manifest:{context['candidateManifestSha256']}",
        f"candidate-metadata:{context['candidateMetadataSha256']}",
        f"source-snapshot:{context['sourceSnapshotSha256']}",
        f"audit-manifest:{context['auditManifestSha256']}",
    ]
    for item in selected:
        audit = item["audit"]
        lines.append("\t".join([
            str(item["candidate"]["barcode"]),
            item["candidateSha256"],
            str(audit["source_sha256"]),
            item["reviewSourceSha256"],
            str(audit["output_sha256"]),
            str(audit["status"]),
            str(audit["processing_model"]),
            str(audit["processing_version"]),
            str(audit.get("processing_provider", "CPUExecutionProvider")),
            str(audit.get("processing_model_sha256", "legacy-unrecorded")),
            item["pipelineFingerprint"],
        ]))
    return sha256("\n".join(lines))


def checkerboard(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), "#fffaf7")
    draw = ImageDraw.Draw(image)
    square = 12
    for y in range(0, height, square):
        for x in range(0, width, square):
            if (x // square + y // square) % 2:
                draw.rectangle((x, y, x + square - 1, y + square - 1), fill="#f1dfdb")
    return image


def font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    candidates = [
        ROOT / "public/fonts/Inter-Regular.ttf",
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def preview(path: Path, width: int, height: int, transparent: bool) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
    image.thumbnail((width - 10, height - 10), Image.Resampling.LANCZOS)
    surface = checkerboard(width, height) if transparent else Image.new("RGBA", (width, height), "#f2e2de")
    surface.alpha_composite(image, ((width - image.width) // 2, (height - image.height) // 2))
    return surface.convert("RGB")


def contact_sheet(items: list[dict[str, Any]], output: Path, page: int, total_pages: int, digest: str) -> None:
    columns = 4
    tile_width = 460
    tile_height = 352
    rows = math.ceil(len(items) / columns)
    header_height = 54
    sheet = Image.new("RGB", (columns * tile_width, header_height + rows * tile_height), "#fffaf7")
    draw = ImageDraw.Draw(sheet)
    body_font = font(13)
    small_font = font(11)
    draw.text((14, 14), f"JeloCare identity + source + cutout review · {page + 1}/{total_pages} · {digest[:16]}", font=body_font, fill="#30211f")

    for index, item in enumerate(items):
        audit = item["audit"]
        candidate = item["candidate"]
        column = index % columns
        row = index // columns
        x = column * tile_width
        y = header_height + row * tile_height
        source = preview(item["reviewSourcePath"], 214, 252, False)
        cutout = preview(item["outputPath"], 214, 252, True)
        sheet.paste(source, (x + 8, y + 7))
        sheet.paste(cutout, (x + 238, y + 7))
        identity = f"{candidate['brand']} · {candidate['name']} · {candidate.get('quantity', '')}"
        for line_index, line in enumerate(textwrap.wrap(identity, width=62)[:2]):
            draw.text((x + 9, y + 266 + line_index * 15), line, font=body_font, fill="#30211f")
        validation = "SOURCE PHOTO VALIDATED" if candidate.get("sourcePhotoValidated") else "SOURCE IDENTITY NEEDS REVIEW"
        status = str(audit["status"]).upper()
        color = "#2e7658" if candidate.get("sourcePhotoValidated") else "#9a6420"
        draw.text((x + 9, y + 298), f"{candidate['barcode']} · {status} · {validation}", font=small_font, fill=color)
        draw.text((x + 9, y + 315), f"source {audit['source_sha256'][:10]} · cutout {audit['output_sha256'][:10]}", font=small_font, fill="#70504a")
        reason = " · ".join(audit.get("reasons", []))
        draw.text((x + 9, y + 332), reason[:74] or "source content → transparent canvas", font=small_font, fill="#715b56")

    output.mkdir(parents=True, exist_ok=True)
    sheet.save(output / f"selected-{page + 1:02d}.jpg", "JPEG", quality=94, subsampling=0)


def review_html(selected: list[dict[str, Any]], output: Path, release_sha256: str) -> None:
    cards: list[str] = []
    for item in selected:
        candidate = item["candidate"]
        audit = item["audit"]
        source_href = Path(item["reviewSourcePath"]).relative_to(output.parent).as_posix()
        output_href = Path(item["outputPath"]).relative_to(output.parent).as_posix()
        cards.append(f"""
        <article id="p-{html.escape(str(candidate['barcode']))}">
          <div class="pair"><a href="../{html.escape(source_href)}"><img src="../{html.escape(source_href)}" alt="Source"></a><a class="alpha" href="../{html.escape(output_href)}"><img src="../{html.escape(output_href)}" alt="Cutout"></a></div>
          <h2>{html.escape(str(candidate['brand']))} · {html.escape(str(candidate['name']))}</h2>
          <p>{html.escape(str(candidate.get('quantity', '')))} · {html.escape(str(candidate['barcode']))}</p>
          <p class="{'ok' if candidate.get('sourcePhotoValidated') else 'warn'}">{'Source photo validated' if candidate.get('sourcePhotoValidated') else 'Verify source identity manually'} · {html.escape(str(audit['status']))}</p>
          <code>source {audit['source_sha256']}<br>cutout {audit['output_sha256']}</code>
        </article>""")
    document = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JeloCare packshot review</title>
    <style>body{{margin:0;background:#fffaf7;color:#30211f;font:14px system-ui;padding:24px}}header{{position:sticky;top:0;background:#fffaf7eF;backdrop-filter:blur(18px);padding:14px 0;z-index:2}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:20px}}article{{background:#fff;border-radius:24px;padding:16px;box-shadow:0 12px 40px #58342d12}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}a{{min-height:360px;display:grid;place-items:center;background:#f2e2de;border-radius:16px}}.alpha{{background-color:#fff;background-image:linear-gradient(45deg,#f1dfdb 25%,transparent 25%),linear-gradient(-45deg,#f1dfdb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f1dfdb 75%),linear-gradient(-45deg,transparent 75%,#f1dfdb 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}}img{{max-width:100%;max-height:520px}}h2{{font-size:17px;font-weight:500}}p{{color:#70504a}}.ok{{color:#2e7658}}.warn{{color:#9a6420}}code{{font-size:11px;word-break:break-all}}</style>
    <header><strong>Review identity, full source, cutout, and edges</strong><br><code>release {release_sha256}</code></header><main>{''.join(cards)}</main></html>"""
    (output / "review.html").write_text(document)


def approval_signature(item: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(item["candidate"]["barcode"]),
        str(item["audit"]["output_sha256"]),
        str(item["audit"]["source_sha256"]),
        str(item["candidateSha256"]),
    )


def main() -> int:
    args = arguments()
    if args.target < 1 or args.sheet_size < 1:
        raise ValueError("target and sheet size must be positive")
    audit_manifest, audit_bytes = read_json_bytes(args.audit)
    candidates, candidate_bytes = read_json_bytes(args.candidates)
    candidate_meta, candidate_meta_bytes = read_json_bytes(args.candidate_meta)
    context = input_context(
        audit_manifest,
        audit_bytes,
        candidates,
        candidate_bytes,
        candidate_meta,
        candidate_meta_bytes,
        args.target,
    )
    decisions = json.loads(args.decisions.resolve().read_text()) if args.decisions.exists() else {
        "schemaVersion": 2,
        "reviewedAllSelected": False,
        "approved": [],
        "rejected": [],
    }
    rejected = {str(item["barcode"]): str(item["reason"]) for item in decisions.get("rejected", [])}
    audits = {str(item["barcode"]): item for item in audit_manifest["audits"]}
    selected: list[dict[str, Any]] = []
    eligible: list[dict[str, Any]] = []
    image_root = (ROOT / ".cache/catalogue-packshots/images").resolve()
    source_root = (ROOT / ".cache/catalogue-packshots/sources").resolve()

    for candidate_index, candidate in enumerate(candidates):
        barcode = str(candidate["barcode"])
        audit = audits.get(barcode)
        if not audit or barcode in rejected:
            continue
        if audit.get("brand") != candidate.get("brand") or audit.get("name") != candidate.get("name") or audit.get("source_url") != candidate.get("sourceImageUrl"):
            raise RuntimeError(f"{barcode}: audit identity/source does not match the current candidate")
        candidate_sha = stable_json_sha256(candidate)
        if audit.get("candidate_sha256") and audit["candidate_sha256"] != candidate_sha:
            raise RuntimeError(f"{barcode}: prepared candidate hash is stale")
        image_path = relative(str(audit["output_path"]), image_root)
        source_path = relative(str(audit["source_cache_path"]), source_root)
        if not image_path.exists() or sha256(image_path.read_bytes()) != audit.get("output_sha256"):
            raise RuntimeError(f"{barcode}: prepared output is missing or changed")
        if not source_path.exists():
            raise RuntimeError(f"{barcode}: review source is missing")
        source_preview_sha = sha256(source_path.read_bytes())
        if audit.get("source_cache_sha256") and audit["source_cache_sha256"] != source_preview_sha:
            raise RuntimeError(f"{barcode}: review source changed after preparation")
        pipeline = audit.get("pipeline_fingerprint") or stable_json_sha256({
            "legacy": True,
            "model": audit.get("processing_model"),
            "version": audit.get("processing_version"),
            "provider": audit.get("processing_provider", "CPUExecutionProvider"),
        })
        eligible.append({
            "candidate": candidate,
            "audit": audit,
            "candidate_index": candidate_index,
            "candidateSha256": candidate_sha,
            "reviewSourceSha256": source_preview_sha,
            "pipelineFingerprint": pipeline,
            "reviewSourcePath": source_path,
            "outputPath": image_path,
        })

    for eligible_status in ("ready", "review"):
        ranked = sorted(
            (item for item in eligible if item["audit"].get("status") == eligible_status),
            key=visual_rank,
            reverse=True,
        )
        for item in ranked:
            selected.append(item)
            if len(selected) == args.target:
                break
        if len(selected) == args.target:
            break
    if len(selected) != args.target:
        raise RuntimeError(f"Selected {len(selected)}/{args.target}; preparation or visual rejects leave too few eligible packshots.")

    selection_sha256 = selection_hash(selected)
    release_sha256 = release_hash(context, selected, args.target)
    expected_approvals = {approval_signature(item) for item in selected}
    actual_approvals = {
        (
            str(item.get("barcode", "")),
            str(item.get("outputSha256", "")),
            str(item.get("sourceSha256", "")),
            str(item.get("candidateSha256", "")),
        )
        for item in decisions.get("approved", [])
    }
    review_is_current = bool(
        decisions.get("schemaVersion") == 2
        and decisions.get("reviewedAllSelected") is True
        and decisions.get("releaseSha256") == release_sha256
        and valid_review_time(decisions.get("reviewedAt"))
        and isinstance(decisions.get("reviewer"), str)
        and len(decisions["reviewer"].strip()) >= 2
        and actual_approvals == expected_approvals
    )

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    selected_for_manifest = [{key: value for key, value in item.items() if key not in {"candidate_index", "reviewSourcePath", "outputPath"}} for item in selected]
    manifest = {
        "schemaVersion": 2,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "releaseSha256": release_sha256,
        "selectionSha256": selection_sha256,
        "target": args.target,
        **context,
        "selectionPolicy": "Source-photo-validated records first within each eligibility tier, then source resolution, sharpness, subject solidity, edge safety and mask simplicity; quarantine and explicit visual rejects are excluded.",
        "publicationEligibility": "private-production-input-only",
        "publicAssetPolicy": "A raw cutout cannot be public. Final publication requires a rights-documented photograph or an identity-verified, magazine-ready styled composite with exact label, variant and size plus manual source-vs-output QA.",
        "processing": audit_manifest["processing"],
        "humanReview": {
            "reviewedAllSelected": review_is_current,
            "reviewedAt": decisions.get("reviewedAt") if review_is_current else None,
            "reviewer": decisions.get("reviewer") if review_is_current else None,
            "reviewScope": "product-identity-source-and-cutout",
            "approvedCount": len(actual_approvals & expected_approvals),
            "rejectedCount": len(rejected),
        },
        "selected": selected_for_manifest,
    }
    (output / "selected-packshots.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    total_pages = math.ceil(len(selected) / args.sheet_size)
    sheets = output / "sheets"
    for page in range(total_pages):
        start = page * args.sheet_size
        contact_sheet(selected[start : start + args.sheet_size], sheets, page, total_pages, release_sha256)
    review_html(selected, output, release_sha256)
    template = {
        "schemaVersion": 2,
        "releaseSha256": release_sha256,
        "reviewedAllSelected": False,
        "reviewer": "",
        "reviewedAt": None,
        "approved": [],
        "pending": [
            {
                "barcode": signature[0],
                "outputSha256": signature[1],
                "sourceSha256": signature[2],
                "candidateSha256": signature[3],
            }
            for signature in sorted(expected_approvals)
        ],
        "rejected": decisions.get("rejected", []),
    }
    (output / "review-template.json").write_text(json.dumps(template, indent=2) + "\n")

    print(json.dumps({
        "selected": len(selected),
        "releaseSha256": release_sha256,
        "selectionSha256": selection_sha256,
        "auditSchemaVersion": context["auditSchemaVersion"],
        "humanReviewCurrent": review_is_current,
        "approved": len(actual_approvals & expected_approvals),
        "visualRejects": len(rejected),
        "contactSheets": total_pages,
        "reviewHtml": str((output / "review.html").relative_to(ROOT)),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
