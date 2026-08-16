"""The published spec-state schema mirrors the writer's version boundary."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema


ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "plugins" / "system-spec-harness" / "schemas" / "spec-state.schema.json"
LIVE_STATE = ROOT / "system-spec" / "spec-state.json"


def validator() -> jsonschema.Draft202012Validator:
    return jsonschema.Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8")))


def test_live_exact_legacy_state_remains_readable() -> None:
    validator().validate(json.loads(LIVE_STATE.read_text(encoding="utf-8")))


def test_current_state_requires_design_application_contract_marker() -> None:
    # LIVE_STATE がすでに 1.1 + marker を持つ場合でも、marker 欠落を fail にする契約を検査する。
    state = json.loads(LIVE_STATE.read_text(encoding="utf-8"))
    state["schema_version"] = "1.1"
    state.pop("design_application_contract_version", None)
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(state)
    state["design_application_contract_version"] = "1.0"
    validator().validate(state)


def test_unknown_versions_and_malformed_design_applications_are_rejected() -> None:
    state = json.loads(LIVE_STATE.read_text(encoding="utf-8"))
    state["schema_version"] = "2.0"
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(state)

    current = copy.deepcopy(state)
    current["schema_version"] = "1.1"
    current["design_application_contract_version"] = "1.0"
    current["qa_log"][0]["design_applications"] = [{"principle": "incomplete"}]
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(current)
