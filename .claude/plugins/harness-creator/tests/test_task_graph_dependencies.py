"""system-dev-planner保存edgeとconsumer依存投影の向き契約。"""
from __future__ import annotations

import importlib.util
from copy import deepcopy
from pathlib import Path

import pytest


SCRIPT = Path(__file__).parents[1] / "scripts" / "task-graph-dependencies.py"
SPEC = importlib.util.spec_from_file_location("task_graph_dependencies", SCRIPT)
assert SPEC and SPEC.loader
DEPS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPS)


def system_plan_graph() -> dict:
    """P01→P02/P03のsystem-dev-planner実形状を最小化したfixture。"""
    return {
        "schema_version": "1.0.0",
        "nodes": [
            {"id": "P01", "phase_ref": "P01", "depends_on": []},
            {"id": "P02", "phase_ref": "P02", "depends_on": ["P01"]},
            {"id": "P03", "phase_ref": "P03", "depends_on": ["P01", "P02"]},
        ],
        # 保存契約は producer -> consumer のforward edge。
        "edges": [
            {"type": "depends_on", "from": "P01", "to": "P02"},
            {"type": "depends_on", "from": "P01", "to": "P03"},
            {"type": "depends_on", "from": "P02", "to": "P03"},
        ],
    }


def dependency_pairs(graph: dict) -> set[tuple[str, str]]:
    return {
        (edge["from"], edge["to"])
        for edge in graph["edges"]
        if edge.get("type") == "depends_on"
    }


def test_forward_explicit_edges_are_reverse_equivalent_and_normalized() -> None:
    source = system_plan_graph()
    before = deepcopy(source)

    normalized = DEPS.normalize_dependency_edges(source)

    assert source == before
    assert dependency_pairs(normalized) == {
        ("P02", "P01"),
        ("P03", "P01"),
        ("P03", "P02"),
    }


def test_zero_and_multiple_node_dependencies_are_supported() -> None:
    normalized = DEPS.normalize_dependency_edges(system_plan_graph())
    assert dependency_pairs(normalized) == {
        ("P02", "P01"),
        ("P03", "P01"),
        ("P03", "P02"),
    }


def test_legacy_edge_only_consumer_to_producer_remains_supported() -> None:
    legacy = {
        "nodes": [{"id": "P01"}, {"id": "P02"}],
        "edges": [{"type": "depends_on", "from": "P02", "to": "P01"}],
    }
    assert dependency_pairs(DEPS.normalize_dependency_edges(legacy)) == {("P02", "P01")}


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda graph: graph.update(
                edges=[
                    {"type": "depends_on", "from": "P02", "to": "P01"},
                    {"type": "depends_on", "from": "P03", "to": "P01"},
                    {"type": "depends_on", "from": "P03", "to": "P02"},
                ]
            ),
            "forward",
        ),
        (lambda graph: graph.update(edges=[]), "required"),
        (lambda graph: graph["edges"].pop(), "disagrees"),
        (
            lambda graph: graph["edges"].append(
                {"type": "depends_on", "from": "UNKNOWN", "to": "P03"}
            ),
            "unknown",
        ),
        (
            lambda graph: graph["edges"].append(deepcopy(graph["edges"][0])),
            "duplicate",
        ),
        (
            lambda graph: graph["edges"].__setitem__(
                2, {"type": "depends_on", "from": "P01", "to": "P03"}
            ),
            "duplicate",
        ),
        (
            lambda graph: graph["edges"].__setitem__(
                2, {"type": "depends_on", "from": "P02", "to": "P01"}
            ),
            "disagrees",
        ),
    ],
)
def test_node_contract_rejects_non_equivalent_explicit_edges(mutate, message: str) -> None:
    graph = system_plan_graph()
    mutate(graph)
    with pytest.raises(ValueError, match=message):
        DEPS.normalize_dependency_edges(graph)


def test_unknown_node_dependency_fails_closed() -> None:
    graph = system_plan_graph()
    graph["nodes"][1]["depends_on"] = ["UNKNOWN"]
    with pytest.raises(ValueError, match="unknown"):
        DEPS.normalize_dependency_edges(graph)


def test_cycle_fails_closed() -> None:
    graph = {
        "nodes": [
            {"id": "P01", "depends_on": ["P02"]},
            {"id": "P02", "depends_on": ["P01"]},
        ],
        "edges": [
            {"type": "depends_on", "from": "P02", "to": "P01"},
            {"type": "depends_on", "from": "P01", "to": "P02"},
        ],
    }
    with pytest.raises(ValueError, match="cycle"):
        DEPS.normalize_dependency_edges(graph)


def test_partial_node_contract_fails_closed() -> None:
    graph = system_plan_graph()
    del graph["nodes"][0]["depends_on"]
    with pytest.raises(ValueError, match="every node"):
        DEPS.normalize_dependency_edges(graph)
