from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from plugin_layout_contract import (
    built_component_contracts,
    optional_source_inventory,
    repository_root,
    skill_frontmatter,
    source_inventory_path,
)


PLUGIN = Path(__file__).resolve().parents[1]
EVALS = PLUGIN / "EVALS.json"


def _contracts() -> list[tuple[str, str, Path, list[str]]]:
    inventory = optional_source_inventory(PLUGIN)
    source_components = (
        {item["id"]: item for item in inventory["components"]}
        if inventory is not None
        else None
    )
    rows: list[tuple[str, str, Path, list[str]]] = []
    for component in built_component_contracts(PLUGIN):
        component_id = component["id"]
        test_contract = component["evaluation"]
        skill = component["skill_path"]
        built_ids = {
            item["id"]
            for item in component["frontmatter"]["feedback_contract"]["criteria"]
        }
        declared = set(test_contract["criteria"])
        assert declared == built_ids, (
            f"{component_id}: built criteria-test mapping drift; "
            f"missing={sorted(built_ids - declared)}, extra={sorted(declared - built_ids)}"
        )
        if source_components is not None:
            assert component_id in source_components, (
                f"{component_id}: source inventory component is missing"
            )
            inventory_ids = {
                item["id"]
                for item in source_components[component_id]["feedback_contract"]["criteria"]
            }
            assert declared == inventory_ids, (
                f"{component_id}: source inventory criteria-test mapping drift; "
                f"missing={sorted(inventory_ids - declared)}, "
                f"extra={sorted(declared - inventory_ids)}"
            )
        for criterion_id, markers in test_contract["criteria"].items():
            rows.append((component_id, criterion_id, skill, markers))
    return rows


def _criteria_clauses(text: str) -> dict[str, str]:
    """Parse only the dedicated acceptance section; markers elsewhere do not count."""

    match = re.search(
        r"^## Criteria acceptance\s*$\n(?P<body>.*?)(?=^## |\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    assert match, "missing `## Criteria acceptance` section"
    clauses: dict[str, str] = {}
    for line in match.group("body").splitlines():
        item = re.match(r"^- `criteria:(?P<id>[A-Z]+[0-9]+)`:\s*(?P<body>.+)$", line)
        if not item:
            continue
        criterion_id = item.group("id")
        assert criterion_id not in clauses, f"duplicate criteria clause: {criterion_id}"
        clauses[criterion_id] = item.group("body")
    return clauses


@pytest.mark.parametrize(
    ("component_id", "criterion_id", "skill_path", "markers"),
    _contracts(),
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_skill_criterion_has_dedicated_acceptance_clause(
    component_id: str,
    criterion_id: str,
    skill_path: Path,
    markers: list[str],
) -> None:
    """Every inventory criterion has one named clause; unrelated text cannot satisfy it."""

    text = skill_path.read_text(encoding="utf-8")
    clauses = _criteria_clauses(text)
    assert f"source: plugin-plans/dev-graph/component-inventory.json#{component_id}" in text
    expected = {
        item["id"] for item in skill_frontmatter(skill_path)["feedback_contract"]["criteria"]
    }
    assert set(clauses) == expected
    folded = clauses[criterion_id].casefold()
    missing = [
        marker for marker in markers if marker.casefold() not in folded
        and marker.casefold() != f"criteria:{criterion_id}".casefold()
    ]
    assert not missing, f"{component_id}/{criterion_id}: missing acceptance markers {missing}"


def test_criteria_harness_covers_every_loop_skill() -> None:
    expected: set[str] = set()
    source_prefix = "plugin-plans/dev-graph/component-inventory.json#"
    for skill_path in sorted((PLUGIN / "skills").glob("*/SKILL.md")):
        source = skill_frontmatter(skill_path).get("source")
        if isinstance(source, str) and source.startswith(source_prefix):
            component_id = source.removeprefix(source_prefix)
            assert component_id not in expected, f"duplicate built component source: {component_id}"
            expected.add(component_id)
    configured = set(
        json.loads(EVALS.read_text(encoding="utf-8"))["criteria_tests"]["components"]
    )
    assert configured == expected

    inventory = optional_source_inventory(PLUGIN)
    if inventory is not None:
        source_expected = {
            item["id"]
            for item in inventory["components"]
            if (item.get("harness_coverage") or {}).get("kind_pass")
            == "loop=criteria-test+content-review-verdict"
        }
        assert configured == source_expected


def test_optional_source_inventory_accepts_downstream_and_source_layouts(
    tmp_path: Path,
) -> None:
    downstream_plugin = tmp_path / "downstream" / ".claude" / "plugins" / "dev-graph"
    downstream_plugin.mkdir(parents=True)
    assert optional_source_inventory(downstream_plugin) is None

    # caller 側に同名 source artifact があっても downstream built authority は変わらない。
    downstream_inventory = source_inventory_path(downstream_plugin)
    downstream_inventory.parent.mkdir(parents=True)
    downstream_inventory.write_text("not-json", encoding="utf-8")
    assert optional_source_inventory(downstream_plugin) is None

    plugin = tmp_path / "source" / "plugins" / "dev-graph"
    plugin.mkdir(parents=True)
    inventory_path = source_inventory_path(plugin)
    with pytest.raises(AssertionError, match="source layout is missing"):
        optional_source_inventory(plugin)

    inventory_path.parent.mkdir(parents=True)
    inventory_path.write_text('{"components": [{"id": "C01"}]}', encoding="utf-8")
    assert optional_source_inventory(plugin) == {"components": [{"id": "C01"}]}


def test_optional_source_inventory_fails_closed_when_present_but_malformed(
    tmp_path: Path,
) -> None:
    plugin = tmp_path / "plugins" / "dev-graph"
    plugin.mkdir(parents=True)
    inventory_path = source_inventory_path(plugin)
    inventory_path.parent.mkdir(parents=True)
    inventory_path.write_text('{"components": "not-a-list"}', encoding="utf-8")

    with pytest.raises(AssertionError, match="components must be a list"):
        optional_source_inventory(plugin)


def test_repository_root_resolves_source_and_downstream_layouts(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source_plugin = source / "plugins" / "dev-graph"
    source_plugin.mkdir(parents=True)
    assert repository_root(source_plugin) == source

    downstream = tmp_path / "downstream"
    downstream_plugin = downstream / ".claude" / "plugins" / "dev-graph"
    downstream_plugin.mkdir(parents=True)
    assert repository_root(downstream_plugin) == downstream


def test_repository_root_rejects_ambiguous_layout(tmp_path: Path) -> None:
    plugin = tmp_path / "vendor" / "dev-graph"
    plugin.mkdir(parents=True)
    with pytest.raises(AssertionError, match="unsupported dev-graph plugin layout"):
        repository_root(plugin)
