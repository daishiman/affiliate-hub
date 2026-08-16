"""C19 が独立 completeness evaluator の完走前に import しない契約を固定する。"""
import json
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
SKILL = PLUGIN / "skills" / "run-dev-graph-system-spec" / "SKILL.md"
DELEGATE = PLUGIN / "skills" / "run-dev-graph-system-spec" / "prompts" / "R2-delegate.md"
SCENARIOS = PLUGIN / "tests" / "fixtures" / "live-trial-positive-scenarios.json"


def test_outer_skill_waits_for_forked_evaluator_and_never_substitutes_report() -> None:
    skill = SKILL.read_text(encoding="utf-8")
    delegate = DELEGATE.read_text(encoding="utf-8")

    for text in (skill, delegate):
        assert "完全な `agentId`" in text
        assert "native `task-notification`" in text
        assert "TaskStop" in text
        assert "completeness-report.json" in text
    assert "TaskOutput" not in skill.split("allowed-tools:", 1)[1].split("\n", 1)[0]
    assert "outer session が `completeness-report.json` を Write/Edit" in delegate


def test_bounded_resume_scenario_does_not_rerun_the_evaluator() -> None:
    scenarios = json.loads(SCENARIOS.read_text(encoding="utf-8"))["scenarios"]
    scenario = next(item for item in scenarios if item["component_id"] == "C19")
    fragments = scenario["task_contract"]["required_fragments"]

    assert scenario["scenario_id"].endswith("-bounded")
    assert "validate-system-spec-resume.py" in fragments
    assert "reuse-confirmed" in fragments
    assert any(
        "assign-system-spec-completeness-evaluator" in skill
        for skill in scenario["forbidden_invoked_skills"]
    )
