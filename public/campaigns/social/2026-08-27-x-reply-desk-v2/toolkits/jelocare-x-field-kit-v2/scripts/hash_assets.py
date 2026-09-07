#!/usr/bin/env python3
"""Write portable SHA-256 sums for the field kit or a render output folder."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", default="SHA256SUMS")
    args = parser.parse_args()
    directory = args.directory.resolve()
    output = directory / args.output
    files = [
        path
        for path in directory.rglob("*")
        if path.is_file()
        and path.resolve() != output.resolve()
        and "__pycache__" not in path.parts
        and path.suffix.lower() != ".zip"
    ]
    output.write_text(
        "".join(
            f"{digest(path)}  {path.relative_to(directory).as_posix()}\n"
            for path in sorted(files)
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(files)} hashes to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
