from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

from plugin_layout_contract import built_component_contracts, optional_source_inventory


PLUGIN = Path(__file__).resolve().parents[1]
COMPONENT_IDS = {"C01", "C02", "C03", "C04", "C05", "C14", "C15", "C18", "C19"}
WIRING_TOKENS = {
    "intermediate.jsonl",
    "original_goal",
    "original_goal_hash",
    "merged_directive_for_next",
    "required_keys",
    "hashlib.sha256",
}


def _components() -> list[dict]:
    components = built_component_contracts(PLUGIN)
    found = {item["id"] for item in components}
    assert found == COMPONENT_IDS, (
        f"built loop component set drift; missing={sorted(COMPONENT_IDS - found)}, "
        f"extra={sorted(found - COMPONENT_IDS)}"
    )
    return components


def _skill_text(component: dict) -> str:
    return component["skill_path"].read_text(encoding="utf-8")


def _frontmatter(text: str) -> dict:
    assert text.startswith("---\n")
    return yaml.safe_load(text.split("\n---\n", 1)[0][4:])


@pytest.mark.parametrize("component", _components(), ids=lambda item: item["id"])
def test_run_skill_frontmatter_runtime_contract_is_complete(component: dict) -> None:
    text = _skill_text(component)
    fm = _frontmatter(text)

    assert fm["combinators"] == ["with-goal-seek", "with-feedback-contract"]
    assert fm["goal_seek"] == {"engine": "inline", "fork": "subagent", "max_loops": 5}
    assert fm["feedback_contract"]["max_iterations"] == 3
    criteria = fm["feedback_contract"]["criteria"]
    assert criteria
    criterion_ids = [item["id"] for item in criteria]
    assert len(criterion_ids) == len(set(criterion_ids))
    responsibilities = fm["responsibilities"]
    responsibility_ids = [item["id"] for item in responsibilities]
    assert responsibilities and len(responsibility_ids) == len(set(responsibility_ids))
    for responsibility in responsibilities:
        assert isinstance(responsibility["prompt_required"], bool)
        assert responsibility["summary"].strip()

    required = [item for item in responsibilities if item["prompt_required"]]
    expected_refs = [f"prompts/{item['id']}.md" for item in required]
    assert fm["responsibility_refs"] == expected_refs
    assert {"Skill", "Agent", "AskUserQuestion"} <= set(fm["allowed-tools"])
    assert any(
        item["loop_scope"] == "outer" and item["verify_by"] == "live-trial"
        for item in fm["feedback_contract"]["criteria"]
    )


def test_source_inventory_matches_built_frontmatter_when_available() -> None:
    """source checkout は inventory parity、downstream は built runtime contract を正本にする。"""

    inventory = optional_source_inventory(PLUGIN)
    if inventory is None:
        # _components() が EVALS exact-set と全 built source pin を既に fail-closed 検査する。
        assert {item["id"] for item in _components()} == COMPONENT_IDS
        return

    source_components = {item["id"]: item for item in inventory["components"]}
    for component in _components():
        component_id = component["id"]
        assert component_id in source_components
        source = source_components[component_id]
        fm = component["frontmatter"]
        assert fm["combinators"] == source["combinators"]
        assert fm["goal_seek"] == source["goal_seek"]
        assert fm["feedback_contract"] == {
            "max_iterations": 3,
            "criteria": source["feedback_contract"]["criteria"],
        }
        assert [item["id"] for item in fm["responsibilities"]] == [
            item["id"] for item in source["responsibilities"]
        ]
        for actual, expected in zip(
            fm["responsibilities"], source["responsibilities"], strict=True
        ):
            assert actual["prompt_required"] is expected["prompt_required"]
            assert actual["summary"] == expected["summary"]


@pytest.mark.parametrize("component", _components(), ids=lambda item: item["id"])
def test_run_skill_has_executable_goal_seek_wiring(component: dict) -> None:
    text = _skill_text(component)
    assert "## ゴールシーク実行" in text
    assert "### 完了チェックリスト" in text
    assert "### ゴールシーク配線" in text
    assert "### ゴールシーク検証" in text
    assert len(re.findall(r"^- \[ \] ", text, flags=re.MULTILINE)) >= 4
    assert WIRING_TOKENS <= {token for token in WIRING_TOKENS if token in text}


@pytest.mark.parametrize("component", _components(), ids=lambda item: item["id"])
def test_required_responsibility_prompts_are_concrete_and_one_to_one(component: dict) -> None:
    skill_dir = PLUGIN / "skills" / component["name"]
    fm = _frontmatter(_skill_text(component))
    prompt_paths = [skill_dir / ref for ref in fm["responsibility_refs"]]
    assert set(prompt_paths) == set((skill_dir / "prompts").glob("*.md"))

    layer2_contracts: set[str] = set()
    required = [item for item in fm["responsibilities"] if item["prompt_required"]]
    for responsibility, path in zip(required, prompt_paths, strict=True):
        body = path.read_text(encoding="utf-8")
        assert responsibility["id"] in body
        assert responsibility["summary"] in body
        for layer in range(1, 8):
            assert re.search(rf"^## Layer {layer}:", body, flags=re.MULTILINE)
        for heading in ("入力契約", "出力契約", "責務境界", "受入条件"):
            assert f"### {heading}" in body
        match = re.search(r"^## Layer 2:.*?(?=^## Layer 3:)", body, flags=re.MULTILINE | re.DOTALL)
        assert match
        assert match.group(0) not in layer2_contracts
        layer2_contracts.add(match.group(0))
