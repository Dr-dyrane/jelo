#!/usr/bin/env python3
"""Build a sorted, fixed-timestamp ZIP of the JeloCare X Field Kit."""

from __future__ import annotations

import argparse
import hashlib
import zipfile
from pathlib import Path


ARCHIVE_ROOT = "JeloCare-X-Field-Kit-v1.0.0"
FIXED_TIME = (2026, 9, 4, 4, 46, 38)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    output = (
        args.output.resolve()
        if args.output
        else directory.parent / "JeloCare-X-Field-Kit-v1.0.0.zip"
    )
    files = [
        path
        for path in directory.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and path.suffix.lower() != ".zip"
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        output,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for path in sorted(files):
            relative = path.relative_to(directory).as_posix()
            info = zipfile.ZipInfo(f"{ARCHIVE_ROOT}/{relative}", FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            mode = 0o755 if path.parent.name == "scripts" and path.suffix == ".py" else 0o644
            info.external_attr = (mode & 0xFFFF) << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    digest = sha256(output)
    checksum_path = output.with_suffix(output.suffix + ".sha256")
    checksum_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(f"Built {output} ({output.stat().st_size} bytes)")
    print(f"SHA-256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
