#!/usr/bin/env python3
# /// script
# name: validate-system-spec-boundary
# purpose: Prove system-spec generation signatures exist upstream and are not duplicated in dev-graph runtime code.
# inputs: []
# outputs: [stdout JSON positive_control/dev_graph_hits, exit 0 boundary intact / 2 duplicate or vacuous control]
# contexts: [C]
# network: false
# write-scope: none
# dependencies: []
# requires-python = ">=3.11"
# ///
"""Use positive controls to prevent a vacuous "duplicate logic = 0" claim."""
from __future__ import annotations

import json
import re
from pathlib import Path


DEV_GRAPH = Path(__file__).resolve().parents[1]
HARNESS = DEV_GRAPH.parent / "system-spec-harness"
SIGNATURES = {
    "elicitation_cell_transition": re.compile(r"^def apply_cell_op\(", re.MULTILINE),
    "elicitation_turn_transition": re.compile(r"^def apply_turn\(", re.MULTILINE),
    "spec_compiler": re.compile(r"^def compile_docset\(", re.MULTILINE),
}


def count(root: Path, pattern: re.Pattern[str]) -> list[str]:
    hits: list[str] = []
    for path in sorted(root.rglob("*.py")):
        if "tests" in path.parts or "__pycache__" in path.parts:
            continue
        if pattern.search(path.read_text(encoding="utf-8", errors="replace")):
            hits.append(path.relative_to(root).as_posix())
    return hits


def main() -> int:
    controls = {name: count(HARNESS, pattern) for name, pattern in SIGNATURES.items()}
    duplicates = {name: count(DEV_GRAPH, pattern) for name, pattern in SIGNATURES.items()}
    vacuous = sorted(name for name, hits in controls.items() if not hits)
    present = {name: hits for name, hits in duplicates.items() if hits}
    report = {
        "validator": "validate-system-spec-boundary",
        "valid": not vacuous and not present,
        "positive_control": controls,
        "dev_graph_hits": duplicates,
        "vacuous_controls": vacuous,
        "duplicate_signatures": present,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
