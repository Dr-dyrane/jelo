#!/usr/bin/env python3
"""Validate the portable packet structure, JSON, scripts, paths, and secrets."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


REQUIRED = {
    "START_HERE.md",
    "JeloCare-X-Field-Kit.md",
    "SKILL.md",
    "CAPABILITY_MATRIX.md",
    "manifest.json",
    "references/voice-and-humour.md",
    "references/reply-engine.md",
    "references/safety-evidence-rights.md",
    "references/zapshot-spec.md",
    "references/publishing-and-measurement.md",
    "templates/work-order.json",
    "templates/candidate.json",
    "templates/campaign-record.json",
    "templates/zapshot-recipe.json",
    "templates/publication-unit.json",
    "schemas/field-kit.schema.json",
    "scripts/render_zapshot.py",
    "scripts/self_test.py",
    "scripts/hash_assets.py",
    "scripts/build_packet.py",
}

SECRET_PATTERNS = {
    "OpenAI-style key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "Slack-style token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{12,}\b"),
    "assigned secret": re.compile(
        r"(?i)\b(password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*['\"][^'\"\n]{6,}['\"]"
    ),
}

ABSOLUTE_PATH = re.compile(r"^(?:/Users/|/var/|/home/|[A-Za-z]:[\\/])")


def walk_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)


def valid_datetime(value: Any) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None


def validate_publication_unit(value: Any) -> list:
    errors = []
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        return ["publication unit must be a schemaVersion 1 object"]
    preview = value.get("preview")
    confirmation = value.get("confirmation")
    receipt = value.get("receipt")
    if not isinstance(preview, dict) or not isinstance(confirmation, dict) or not isinstance(receipt, dict):
        return ["publication unit requires preview, confirmation, and receipt objects"]

    preview_state = preview.get("state")
    if preview_state not in {"draft", "ready-for-approval"}:
        errors.append("preview.state must be draft or ready-for-approval")
    if preview.get("duplicateCheck") not in {"not-run", "clear", "duplicate"}:
        errors.append("preview.duplicateCheck is invalid")
    media_filename = preview.get("mediaFilename")
    media_sha = preview.get("mediaSha256")
    if (media_filename is None) != (media_sha is None):
        errors.append("preview media filename and SHA-256 must both be present or both be null")
    if media_sha is not None and not valid_sha256(media_sha):
        errors.append("preview.mediaSha256 must be lowercase SHA-256")
    if preview_state == "ready-for-approval":
        if preview.get("duplicateCheck") != "clear":
            errors.append("ready preview requires duplicateCheck clear")
        if not isinstance(preview.get("targetUrl"), str) or not preview["targetUrl"].startswith("https://"):
            errors.append("ready preview requires an HTTPS targetUrl")
        if not valid_datetime(preview.get("checkedAt")):
            errors.append("ready preview requires a timezone-aware checkedAt")
        if not isinstance(preview.get("exactCopy"), str) or not preview["exactCopy"].strip():
            errors.append("ready preview requires non-empty exactCopy")
        if preview.get("additionalActions") != []:
            errors.append("ready preview may not bundle additional actions")

    if confirmation.get("received") is True:
        if preview_state != "ready-for-approval":
            errors.append("confirmation requires a ready preview")
        if not valid_datetime(confirmation.get("receivedAt")):
            errors.append("confirmation requires a timezone-aware receivedAt")
        if confirmation.get("confirmedTargetUrl") != preview.get("targetUrl"):
            errors.append("confirmed target must match the preview")
        if confirmation.get("confirmedExactCopy") != preview.get("exactCopy"):
            errors.append("confirmed copy must match the preview")
        if confirmation.get("confirmedMediaSha256") != preview.get("mediaSha256"):
            errors.append("confirmed media SHA-256 must match the preview")
    elif any(
        confirmation.get(field) is not None
        for field in (
            "receivedAt",
            "confirmedTargetUrl",
            "confirmedExactCopy",
            "confirmedMediaSha256",
        )
    ):
        errors.append("unreceived confirmation must not contain confirmed values")

    receipt_state = receipt.get("state")
    if receipt_state not in {"not-submitted", "submitted-unverified", "live-verified"}:
        errors.append("receipt.state must be not-submitted, submitted-unverified, or live-verified")
    if receipt_state in {"submitted-unverified", "live-verified"}:
        if preview_state != "ready-for-approval":
            errors.append("any submitted receipt requires a ready preview")
        if confirmation.get("received") is not True:
            errors.append("any submitted receipt requires exact action-time confirmation")
    if receipt_state == "not-submitted" and any(
        receipt.get(field) is not None
        for field in (
            "publicUrl",
            "externalId",
            "submittedAt",
            "verifiedAt",
            "targetMatched",
            "copyMatched",
            "mediaMatched",
            "replyAncestryMatched",
        )
    ):
        errors.append("not-submitted receipt must not contain action or verification evidence")
    if receipt_state == "submitted-unverified" and not valid_datetime(receipt.get("submittedAt")):
        errors.append("submitted-unverified receipt requires submittedAt")
    if receipt_state == "live-verified":
        if confirmation.get("received") is not True:
            errors.append("live verification requires exact confirmation")
        if not isinstance(receipt.get("publicUrl"), str) or not receipt["publicUrl"].startswith("https://"):
            errors.append("live verification requires an HTTPS publicUrl")
        if not isinstance(receipt.get("externalId"), str) or not receipt["externalId"].strip():
            errors.append("live verification requires an externalId")
        if not valid_datetime(receipt.get("submittedAt")) or not valid_datetime(receipt.get("verifiedAt")):
            errors.append("live verification requires submittedAt and verifiedAt")
        for field in ("targetMatched", "copyMatched", "mediaMatched", "replyAncestryMatched"):
            if receipt.get(field) is not True:
                errors.append(f"live verification requires {field} true")
    return errors


def publication_contract_self_test(template: dict) -> list:
    errors = []
    if validate_publication_unit(template):
        errors.append("shipped publication template violates its contract")

    unsafe_ready = copy.deepcopy(template)
    unsafe_ready["preview"]["state"] = "ready-for-approval"
    if not validate_publication_unit(unsafe_ready):
        errors.append("negative test failed: not-run duplicate check reached ready")

    false_live = copy.deepcopy(template)
    false_live["receipt"]["state"] = "live-verified"
    if not validate_publication_unit(false_live):
        errors.append("negative test failed: incomplete receipt reached live-verified")

    unconfirmed_submission = copy.deepcopy(template)
    unconfirmed_submission["receipt"].update(
        {"submittedAt": "2026-09-04T05:02:00Z", "state": "submitted-unverified"}
    )
    if not validate_publication_unit(unconfirmed_submission):
        errors.append("negative test failed: unconfirmed draft reached submitted-unverified")

    confirmation_on_draft = copy.deepcopy(template)
    confirmation_on_draft["confirmation"].update(
        {
            "received": True,
            "receivedAt": "2026-09-04T05:01:00Z",
            "confirmedTargetUrl": "https://x.com/example/status/1",
            "confirmedExactCopy": "Synthetic approval-contract test.",
            "confirmedMediaSha256": None,
        }
    )
    if not validate_publication_unit(confirmation_on_draft):
        errors.append("negative test failed: confirmation attached to draft preview")

    ready = copy.deepcopy(template)
    ready["preview"].update(
        {
            "targetUrl": "https://x.com/example/status/1",
            "checkedAt": "2026-09-04T05:00:00Z",
            "duplicateCheck": "clear",
            "exactCopy": "Synthetic approval-contract test.",
            "state": "ready-for-approval",
        }
    )
    if validate_publication_unit(ready):
        errors.append("positive test failed: safe ready preview was rejected")

    submitted = copy.deepcopy(ready)
    submitted["confirmation"].update(
        {
            "received": True,
            "receivedAt": "2026-09-04T05:01:00Z",
            "confirmedTargetUrl": submitted["preview"]["targetUrl"],
            "confirmedExactCopy": submitted["preview"]["exactCopy"],
            "confirmedMediaSha256": None,
        }
    )
    submitted["receipt"].update(
        {"submittedAt": "2026-09-04T05:02:00Z", "state": "submitted-unverified"}
    )
    if validate_publication_unit(submitted):
        errors.append("positive test failed: confirmed submission was rejected")

    live = copy.deepcopy(submitted)
    live["receipt"].update(
        {
            "publicUrl": "https://x.com/jelocare/status/2",
            "externalId": "2",
            "submittedAt": "2026-09-04T05:02:00Z",
            "verifiedAt": "2026-09-04T05:02:30Z",
            "targetMatched": True,
            "copyMatched": True,
            "mediaMatched": True,
            "replyAncestryMatched": True,
            "state": "live-verified",
        }
    )
    if validate_publication_unit(live):
        errors.append("positive test failed: complete live receipt was rejected")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    directory = args.directory.resolve()
    errors = []

    present = {path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file()}
    for missing in sorted(REQUIRED - present):
        errors.append(f"missing required file: {missing}")

    media_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".m4a", ".mp3", ".wav"}
    for path in directory.rglob("*"):
        if not path.is_file() or "__pycache__" in path.parts or path.name == "SHA256SUMS":
            continue
        relative = path.relative_to(directory).as_posix()
        if path.stat().st_size > 2_000_000:
            errors.append(f"unexpected file larger than 2 MB: {relative}")
        if path.suffix.lower() in media_extensions:
            errors.append(f"packet must not bundle reusable media: {relative}")
        if path.suffix.lower() == ".json":
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
            except Exception as error:
                errors.append(f"invalid JSON {relative}: {error}")
                continue
            for string in walk_strings(value):
                if ABSOLUTE_PATH.match(string):
                    errors.append(f"absolute path in {relative}: {string}")
        if path.suffix.lower() in {".md", ".json", ".py", ".txt"}:
            text = path.read_text(encoding="utf-8")
            for label, pattern in SECRET_PATTERNS.items():
                if pattern.search(text):
                    errors.append(f"{label} found in {relative}")
        if path.suffix.lower() == ".py":
            try:
                compile(path.read_text(encoding="utf-8"), str(path), "exec")
            except SyntaxError as error:
                errors.append(f"Python syntax error in {relative}: {error}")

    manifest_path = directory / "manifest.json"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if manifest.get("packetId") != "jelocare-x-field-kit":
                errors.append("manifest.packetId must be jelocare-x-field-kit")
            if manifest.get("version") != "1.0.0":
                errors.append("manifest.version must be 1.0.0")
        except Exception:
            pass

    publication_path = directory / "templates/publication-unit.json"
    if publication_path.is_file():
        try:
            publication_template = json.loads(publication_path.read_text(encoding="utf-8"))
            errors.extend(publication_contract_self_test(publication_template))
        except Exception as error:
            errors.append(f"publication contract tests failed to run: {error}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"PASS: {len(present)} packet files; structure, JSON, scripts, paths, and secret scan clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
