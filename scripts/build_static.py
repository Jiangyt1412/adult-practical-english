#!/usr/bin/env python3
"""Prepare a static deployment directory for the private Sites preview."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FILES = [
    "index.html",
    "lesson-01.html",
    "styles.css",
    "app.js",
    "manifest.json",
    "sw.js",
    ".nojekyll",
]
DIRECTORIES = ["assets", "data"]


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for name in FILES:
        shutil.copy2(ROOT / name, DIST / name)
    for name in DIRECTORIES:
        shutil.copytree(ROOT / name, DIST / name)


if __name__ == "__main__":
    main()
