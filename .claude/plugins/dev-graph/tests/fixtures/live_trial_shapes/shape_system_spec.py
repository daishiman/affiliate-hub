#!/usr/bin/env python3
"""C19 bounded resume fixture.

scenario: ``C19-OUT1-positive-system-spec-lineage-r3-bounded``
contract: "A digest-bound system-spec-harness PASS bundle is preloaded. C19 must
validate and import it without rerunning elicitation, doc fetch, compile, or the
completeness evaluator. The trial is bounded by wall-clock and token budgets."
"""
from __future__ import annotations

import json
from pathlib import Path

from .base_shape import finalize, scaffold
from .system_spec_confirmed_bundle import content


SHAPE = "system-spec"


def _plugin_version() -> str:
    manifest = (
        Path(__file__).resolve().parents[4]
        / "system-spec-harness"
        / ".claude-plugin"
        / "plugin.json"
    )
    return str(json.loads(manifest.read_text(encoding="utf-8"))["version"])


PLACED_CONTENT = content(_plugin_version())

TASK_CONTRACT: dict[str, object] = {
    "scenario_id": "C19-OUT1-positive-system-spec-lineage-r3-bounded",
    "harness_plugin": "system-spec-harness",
    "workflow_mode": "reuse-confirmed",
    "placed_inputs": tuple(PLACED_CONTENT),
    "absent_artifacts": (),
    "required_entry_points": (
        "run-system-spec-elicit",
        "run-system-spec-doc-fetch",
        "run-system-spec-compile",
        "assign-system-spec-completeness-evaluator",
    ),
    "observation_keywords": (
        ("validate-system-spec-resume.py", "reuse-confirmed"),
        ("source_lineage", "confirmation_evidence"),
        ("C02", "upsert-node.py"),
    ),
}


def build(out: Path) -> None:
    """Create an initialized repository with immutable upstream PASS evidence."""
    scaffold(out, kind=SHAPE)
    for relative, body in PLACED_CONTENT.items():
        target = out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body, encoding="utf-8")
    finalize(out)
