#!/usr/bin/env python3
# /// script
# name: test-spec-transition
# version: 0.2.0
# purpose: run-system-spec-elicit の core transition acceptance tests (IN1/OUT1/resume/single-writer)。
# inputs: [pytest collection]
# outputs: [pytest result]
# network: false
# write-scope: tmp_path only
# requires-python: ">=3.9"
# ///
"""Core transition acceptance tests; foundation and knowledge cases are split out."""
from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

from spec_transition_support import (
    record_foundation_sources,
    valid_foundation as _valid_foundation,
)

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
VALIDATOR = PLUGIN_ROOT / "scripts" / "validate-coverage-matrix.py"
TAXONOMY = (
    PLUGIN_ROOT / "skills" / "ref-system-design-knowledge" / "references" / "system-category-taxonomy.json"
)
FIXTURES = SKILL_DIR / "fixtures"
TURNS = FIXTURES / "hearing-turns.json"
GOLDEN_RESUME = FIXTURES / "expected-resume-spec-state.json"
GOLDEN_FINAL = FIXTURES / "expected-final-spec-state.json"


def _load_mod():
    path = SKILL_DIR / "scripts" / "apply-spec-transition.py"
    spec = importlib.util.spec_from_file_location("apply_spec_transition", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_mod()


def _taxonomy() -> dict:
    return json.loads(TAXONOMY.read_text(encoding="utf-8"))


def _design_applications() -> list[dict]:
    return [{
        "knowledge_ref": "ddd.md#Bounded Context",
        "principle": "Bounded Context",
        "applicability": "applied",
        "rationale": "テスト対象を単一境界として扱う",
        "tradeoffs": ["境界分割時は再評価する"],
    }]


def _turns() -> list:
    return json.loads(TURNS.read_text(encoding="utf-8"))


def _run_validator(matrix: Path, require_complete: bool = False, require_foundation: bool = False) -> int:
    argv = [sys.executable, str(VALIDATOR), "--matrix", str(matrix)]
    if require_complete:
        argv.append("--require-complete")
    if require_foundation:
        argv.append("--require-foundation")
    return subprocess.run(argv, capture_output=True, text=True).returncode


def test_IN1_validator_exit0_on_resume_fixture():
    assert GOLDEN_RESUME.is_file()
    assert _run_validator(GOLDEN_RESUME) == 0


def test_IN1_validator_exit0_on_final_fixture_loop():
    assert _run_validator(GOLDEN_FINAL) == 0


def test_OUT1_final_require_complete_exit0():
    assert _run_validator(GOLDEN_FINAL, require_complete=True) == 0


def test_resume_require_complete_fails():
    assert _run_validator(GOLDEN_RESUME, require_complete=True) == 1


def test_five_loop_resume_persists_state():
    state = mod.init_state(_taxonomy())
    processed = mod.run_chunk(state, _turns(), max_loops=5)
    assert processed == 5
    hp = state["hearing_progress"]
    assert hp["loop_count"] == 5
    assert hp["complete"] is False
    assert hp["next_question"]
    assert mod.count_unresolved(state) == 4
    assert state == json.loads(GOLDEN_RESUME.read_text(encoding="utf-8"))


def test_resume_then_finish_reaches_complete():
    turns = _turns()
    state = mod.init_state(_taxonomy())
    mod.run_chunk(state, turns, max_loops=5)
    assert state["hearing_progress"]["complete"] is False
    mod.run_chunk(state, turns[5:], max_loops=5)
    hp = state["hearing_progress"]
    assert hp["complete"] is True and hp["next_question"] is None
    assert mod.count_unresolved(state) == 0
    record_foundation_sources(mod, state)
    mod.set_foundation(state, _valid_foundation())
    for category, row in state["matrix"].items():
        for platform, cell in row.items():
            if isinstance(cell, dict) and cell.get("state") == "確定":
                mod.apply_cell_op(
                    state,
                    {"action": "set-serves", "category": category, "platform": platform, "serves_goals": ["G1"]},
                )
    assert state == json.loads(GOLDEN_FINAL.read_text(encoding="utf-8"))
    assert _run_validator(GOLDEN_FINAL, require_foundation=True) == 0


def _confirmed_state():
    state = mod.init_state(_taxonomy())
    mod.apply_turn(
        state,
        {"qa_id": "qa-001", "question": "q", "answer": "a",
         "design_applications": _design_applications(),
         "ops": [{"action": "confirm", "category": "database", "platform": "web"}]},
    )
    assert state["matrix"]["database"]["web"]["state"] == "確定"
    return state


def test_apply_turn_preserves_valid_design_application_as_separate_interpretation():
    state = mod.init_state(_taxonomy())
    assert state["design_application_contract_version"] == "1.0"
    mod.apply_turn(
        state,
        {
            "qa_id": "qa-design-001",
            "question": "永続化方式は?",
            "answer": "SQLite 単一ファイル",
            "design_applications": [
                {
                    "knowledge_ref": "ddd.md#Bounded Context / Context Map",
                    "principle": "Bounded Context / Context Map",
                    "applicability": "not_applicable",
                    "rationale": "単一利用者の単純 CRUD で文脈間翻訳が無い",
                    "tradeoffs": ["複数業務語彙が生じたら再評価する"],
                }
            ],
            "ops": [{"action": "confirm", "category": "database", "platform": "web"}],
        },
    )
    qa = state["qa_log"][0]
    assert qa["answer"] == "SQLite 単一ファイル"
    assert qa["design_applications"][0]["applicability"] == "not_applicable"
    assert qa["design_applications"][0]["rationale"] == "単一利用者の単純 CRUD で文脈間翻訳が無い"


@pytest.mark.parametrize(
    "application",
    [
        {},
        {"knowledge_ref": "ddd.md", "principle": "DDD", "applicability": "maybe", "rationale": "x", "tradeoffs": ["x"]},
        {"knowledge_ref": "ddd.md", "principle": "DDD", "applicability": "applied", "rationale": "x", "tradeoffs": []},
    ],
)
def test_apply_turn_rejects_malformed_design_application(application):
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.apply_turn(
            state,
            {
                "qa_id": "qa-design-bad",
                "question": "q",
                "answer": "a",
                "design_applications": [application],
                "ops": [{"action": "confirm", "category": "database", "platform": "web"}],
            },
        )
    assert state["qa_log"] == []


def test_add_category_appends_row_without_touching_confirmed():
    state = _confirmed_state()
    before = copy.deepcopy(state["matrix"])
    mod.add_category(state, {"id": "dev-workflow", "label": "開発フロー"})
    for category, row in before.items():
        assert state["matrix"][category] == row
    assert set(state["matrix"]["dev-workflow"]) == set(mod.CANONICAL_PLATFORMS)
    assert all(cell["state"] == "未収集" for cell in state["matrix"]["dev-workflow"].values())
    assert state["category_aggregate"]["dev-workflow"] == "未着手"
    assert {"id": "dev-workflow", "label": "開発フロー"} in state["categories"]


def test_add_category_existing_id_rejected_no_rollback():
    state = _confirmed_state()
    with pytest.raises(mod.TransitionError):
        mod.add_category(state, {"id": "database", "label": "上書き試行"})
    assert state["matrix"]["database"]["web"]["state"] == "確定"


@pytest.mark.parametrize(
    "category",
    [
        {"id": "Dev_Workflow", "label": "開発フロー"}, {"id": "dev-workflow"},
        {"id": "", "label": "開発フロー"}, {"id": "dev-workflow", "label": "  "}, ["dev-workflow"],
    ],
)
def test_add_category_invalid_input_rejected(category):
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.add_category(state, category)


def test_add_category_state_passes_validator_loop(tmp_path):
    state = mod.init_state(_taxonomy())
    mod.add_category(state, {"id": "dev-workflow", "label": "開発フロー"})
    out = tmp_path / "spec-state.json"
    out.write_text(mod.dump_state(state), encoding="utf-8")
    assert _run_validator(out) == 0


def test_confirm_then_exclude_rollback_rejected():
    state = _confirmed_state()
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "exclude", "category": "database", "platform": "web", "reason": "x"})


def test_confirm_then_reconfirm_rejected():
    state = _confirmed_state()
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "confirm", "category": "database", "platform": "web", "qa_ref": "qa-999"})


def test_reopen_only_from_confirmed():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "reopen", "category": "database", "platform": "web", "reason": "x"})


def test_reopen_requires_reason():
    state = _confirmed_state()
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "reopen", "category": "database", "platform": "web"})


def test_reopen_then_reconfirm_allowed():
    state = _confirmed_state()
    mod.apply_cell_op(state, {"action": "reopen", "category": "database", "platform": "web", "reason": "追加要件が判明"})
    assert state["matrix"]["database"]["web"]["state"] == "未収集"
    assert state["reopen_log"][-1]["reason"] == "追加要件が判明"
    mod.apply_cell_op(state, {"action": "confirm", "category": "database", "platform": "web", "qa_ref": "qa-002"})
    assert state["matrix"]["database"]["web"] == {"state": "確定", "qa_ref": "qa-002"}


def test_confirm_requires_qa_ref():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "confirm", "category": "database", "platform": "web"})


def test_exclude_requires_reason_or_approval():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "exclude", "category": "database", "platform": "mobile"})


def test_unknown_action_and_unknown_cell():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "frobnicate", "category": "database", "platform": "web"})
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "confirm", "category": "nope", "platform": "web", "qa_ref": "q"})
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "confirm", "category": "database", "platform": "nope", "qa_ref": "q"})


def test_derive_aggregate_truth_table():
    assert mod.derive_aggregate([]) == "未着手"
    assert mod.derive_aggregate(["未収集", "未収集"]) == "未着手"
    assert mod.derive_aggregate(["対象外", "対象外"]) == "対象外"
    assert mod.derive_aggregate(["確定", "未収集"]) == "収集中"
    assert mod.derive_aggregate(["確定", "対象外"]) == "確定"


def test_init_state_all_uncollected():
    state = mod.init_state(_taxonomy())
    assert state["platforms"] == list(mod.CANONICAL_PLATFORMS)
    for row in state["matrix"].values():
        assert set(row) == set(mod.CANONICAL_PLATFORMS)
        assert all(cell["state"] == "未収集" for cell in row.values())
    assert set(state["category_aggregate"].values()) == {"未着手"}
    assert state["hearing_progress"]["next_question"]


def test_init_state_missing_platform_rejected():
    taxonomy = copy.deepcopy(_taxonomy())
    taxonomy["platforms"] = [platform for platform in taxonomy["platforms"] if platform["id"] != "tablet"]
    with pytest.raises(mod.TransitionError):
        mod.init_state(taxonomy)


def test_set_targets_normalizes_dicts_and_strings():
    state = mod.init_state(_taxonomy())
    assert state["targets"] == []
    mod.set_targets(state, [{"target_id": "react", "category": "frontend"}, "postgres"])
    assert state["targets"] == [{"target_id": "react", "category": "frontend"}, {"target_id": "postgres"}]


def test_set_targets_replaces_previous():
    state = mod.init_state(_taxonomy())
    mod.set_targets(state, [{"target_id": "a"}])
    mod.set_targets(state, [{"target_id": "b", "category": "backend"}])
    assert state["targets"] == [{"target_id": "b", "category": "backend"}]


def test_set_targets_rejects_missing_id_and_duplicates():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.set_targets(state, [{"category": "frontend"}])
    with pytest.raises(mod.TransitionError):
        mod.set_targets(state, ["react", "react"])
    with pytest.raises(mod.TransitionError):
        mod.set_targets(state, [123])


def test_cli_set_targets_string_and_file(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    inline = json.dumps([{"target_id": "react", "category": "frontend"}])
    assert mod.main(["set-targets", "--state", str(state_path), "--targets", inline]) == 0
    assert json.loads(state_path.read_text(encoding="utf-8"))["targets"] == [{"target_id": "react", "category": "frontend"}]
    target_file = tmp_path / "targets.json"
    target_file.write_text(json.dumps({"targets": ["postgres"]}), encoding="utf-8")
    assert mod.main(["set-targets", "--state", str(state_path), "--targets", str(target_file)]) == 0
    assert json.loads(state_path.read_text(encoding="utf-8"))["targets"] == [{"target_id": "postgres"}]


def test_cli_set_targets_bad_id_returns_1(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    assert mod.main(["set-targets", "--state", str(state_path), "--targets", json.dumps([{"category": "frontend"}])]) == 1


def test_cli_init_chunk_apply_aggregate(tmp_path):
    state_path = tmp_path / "spec-state.json"
    turns_path = tmp_path / "turns.json"
    turns_path.write_text(TURNS.read_text(encoding="utf-8"), encoding="utf-8")
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    assert mod.main(["chunk", "--state", str(state_path), "--turns", str(turns_path), "--max-loops", "5"]) == 0
    assert json.loads(state_path.read_text(encoding="utf-8"))["hearing_progress"]["complete"] is False
    reopen = json.dumps({"action": "reopen", "category": "database", "platform": "web", "reason": "再確認"})
    assert mod.main(["apply", "--state", str(state_path), "--op", reopen]) == 0
    assert mod.main(["aggregate", "--state", str(state_path)]) == 0


def test_cli_apply_rollback_returns_1(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["qa_log"].append({
        "id": "qa-001",
        "question": "q",
        "answer": "a",
        "design_applications": _design_applications(),
    })
    state_path.write_text(mod.dump_state(state), encoding="utf-8")
    confirm = json.dumps({"action": "confirm", "category": "database", "platform": "web", "qa_ref": "qa-001"})
    assert mod.main(["apply", "--state", str(state_path), "--op", confirm]) == 0
    bad = json.dumps({"action": "exclude", "category": "database", "platform": "web", "reason": "x"})
    assert mod.main(["apply", "--state", str(state_path), "--op", bad]) == 1


def test_writer_rejects_confirm_without_design_applications():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError, match="design_applications は非空配列必須"):
        mod.apply_turn(
            state,
            {
                "qa_id": "qa-no-design",
                "question": "q",
                "answer": "a",
                "ops": [
                    {
                        "action": "confirm",
                        "category": "database",
                        "platform": "web",
                    }
                ],
            },
        )
    assert not mod._has_entry(state["qa_log"], "qa-no-design")


def test_cli_bad_taxonomy_returns_1(tmp_path):
    missing = tmp_path / "nope.json"
    assert mod.main(["init", "--taxonomy", str(missing), "--out", str(tmp_path / "o.json")]) == 1


def test_cli_legacy_state_is_read_only_until_explicit_init_migration(tmp_path):
    legacy_path = tmp_path / "legacy-spec-state.json"
    legacy = mod.init_state(_taxonomy())
    legacy["schema_version"] = "1.0"
    legacy.pop("design_application_contract_version")
    legacy_path.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")

    assert mod.main(["aggregate", "--state", str(legacy_path)]) == 1

    migrated_path = tmp_path / "migrated-spec-state.json"
    assert mod.main([
        "init",
        "--taxonomy",
        str(TAXONOMY),
        "--state",
        str(legacy_path),
        "--out",
        str(migrated_path),
    ]) == 0
    migrated = json.loads(migrated_path.read_text(encoding="utf-8"))
    assert migrated["schema_version"] == "1.1"
    assert migrated["design_application_contract_version"] == "1.0"
    assert all(
        cell == {"state": "未収集"}
        for row in migrated["matrix"].values()
        for cell in row.values()
    )
    assert mod.main(["aggregate", "--state", str(migrated_path)]) == 0


@pytest.mark.parametrize(
    "broken",
    [
        {},
        {"schema_version": "1.1"},
        {"schema_version": "1.1", "design_application_contract_version": "2.0"},
        {"schema_version": "1.0", "design_application_contract_version": "1.0"},
        {"schema_version": "2.0"},
    ],
)
def test_init_rejects_noncanonical_existing_state_instead_of_repairing(broken):
    with pytest.raises(mod.TransitionError):
        mod.init_state(_taxonomy(), broken)


def test_cli_stdout_emit(capsys):
    assert mod.main(["init", "--taxonomy", str(TAXONOMY)]) == 0
    assert json.loads(capsys.readouterr().out)["schema_version"] == "1.1"
