"""Compatibility import for the provider-owned, versioned inventory API."""
from __future__ import annotations

import importlib.util
from pathlib import Path


_PUBLIC = Path(__file__).resolve().parents[3] / "lib" / "spec_input_inventory.py"
_SPEC = importlib.util.spec_from_file_location("system_spec_inventory_public", _PUBLIC)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"cannot load public inventory API: {_PUBLIC}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

API_VERSION = _MODULE.API_VERSION
INPUT_DIRS = _MODULE.INPUT_DIRS
INPUT_EXTENSIONS = _MODULE.INPUT_EXTENSIONS
INPUT_FILES = _MODULE.INPUT_FILES
is_input = _MODULE.is_input
fold = _MODULE.fold
_iter_files = _MODULE._iter_files
build_inventory = _MODULE.build_inventory
combined_digest = _MODULE.combined_digest
