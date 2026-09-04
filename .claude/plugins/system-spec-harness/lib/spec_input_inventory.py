"""Public, versioned API for fingerprinting the inputs evaluated by system-spec-harness.

mtime は per-file に残すが指紋へは混ぜない。clone / checkout / touch で
中身が変わっていなくても STALE になると、赤の意味が失われる。
拡張子判定は Path.suffix ではなく name.endswith を使う（`.md` という
ファイル名で suffix が空になり、node 側と指紋が割れるのを防ぐ）。
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional, Union


API_VERSION = "1.0.0"
INPUT_DIRS = ("docs/spec", "system-spec")
INPUT_EXTENSIONS = (".md",)
INPUT_FILES = ("system-spec/spec-state.json",)


def is_input(relative: str) -> bool:
    posix = Path(relative).as_posix()
    if posix in INPUT_FILES:
        return True
    if not any(posix.endswith(extension) for extension in INPUT_EXTENSIONS):
        return False
    return any(posix == directory or posix.startswith(f"{directory}/") for directory in INPUT_DIRS)


def fold(entries) -> str:
    """Fold path and content digests only; mtimes are deliberately informational."""
    ordered = sorted(entries, key=lambda entry: entry["path"])
    return hashlib.sha256(
        "\n".join(f"{entry['path']}:{entry['sha256']}" for entry in ordered).encode("utf-8")
    ).hexdigest()


def _iter_files(root: Path) -> list[str]:
    found: list[str] = []
    for directory in INPUT_DIRS:
        base = root / directory
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.is_file() and any(path.name.endswith(extension) for extension in INPUT_EXTENSIONS):
                found.append(path.relative_to(root).as_posix())
    for relative in INPUT_FILES:
        if (root / relative).is_file():
            found.append(relative)
    return sorted(set(found))


def build_inventory(root: Optional[Union[Path, str]] = None) -> dict:
    base = (Path(root) if root is not None else Path.cwd()).resolve()
    entries = []
    for relative in _iter_files(base):
        path = base / relative
        entries.append(
            {
                "path": relative,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "mtime": int(path.stat().st_mtime),
            }
        )
    return {"file_count": len(entries), "sha256": fold(entries), "files": entries}


def combined_digest(root: Optional[Union[Path, str]] = None) -> str:
    return build_inventory(root)["sha256"]
