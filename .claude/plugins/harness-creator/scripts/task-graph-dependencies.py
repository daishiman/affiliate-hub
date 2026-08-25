#!/usr/bin/env python3
# /// script
# name: task-graph-dependencies
# purpose: nodes[].depends_on 正本と legacy dependency edges を consumer 用 canonical edges へ read-only 投影する共有 helper。
# inputs: import API normalize_dependency_edges(graph)
# outputs: in-memory normalized graph (input/source file は不変)
# exit: N/A (library helper; invalid graph raises ValueError)
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.10"
# ///
"""task graph の依存表現を consumer 向け canonical edges へ投影する。

system-dev-planner shape は ``nodes[].depends_on`` が正本で、保存する明示
edge は ``producer -> consumer``。その reverse-equivalence を検証後、
consumer 用に ``consumer -> producer`` へ正規化する。従来の edge-only
shape は後方互換のため ``consumer -> producer`` として扱う。
"""
from __future__ import annotations


def _fail(detail: str) -> ValueError:
    return ValueError(f"task dependency graph invalid: {detail}")


def _assert_acyclic(node_ids: set[str], pairs: set[tuple[str, str]]) -> None:
    dependencies: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    for consumer, producer in pairs:
        dependencies[consumer].add(producer)

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, path: tuple[str, ...]) -> None:
        if node_id in visiting:
            start = path.index(node_id)
            raise _fail("cycle: " + " -> ".join(path[start:] + (node_id,)))
        if node_id in visited:
            return
        visiting.add(node_id)
        for dependency in sorted(dependencies[node_id]):
            visit(dependency, path + (node_id,))
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in sorted(node_ids):
        visit(node_id, ())


def normalize_dependency_edges(graph: dict) -> dict:
    """depends_on を検証し、consumer->producer edge を決定論投影する。

    入力は変更しない。node-level 契約が存在する場合は全 node で必須とし、
    明示 dependency edge は forward 向きで完全な reverse-equivalence だけを
    許す。未知参照・重複・循環・部分的 node 契約は fail-closed で
    拒否する。
    """
    if not isinstance(graph, dict):
        raise _fail("graph must be an object")
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", []) or []
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise _fail("nodes and edges must be arrays")

    node_ids: set[str] = set()
    node_contract: list[bool] = []
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            raise _fail(f"nodes[{index}] must be an object")
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id:
            raise _fail(f"nodes[{index}].id must be a non-empty string")
        if node_id in node_ids:
            raise _fail(f"duplicate node id: {node_id}")
        node_ids.add(node_id)
        node_contract.append("depends_on" in node)

    explicit_pairs: list[tuple[str, str]] = []
    other_edges: list[dict] = []
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict):
            raise _fail(f"edges[{index}] must be an object")
        if edge.get("type") != "depends_on":
            other_edges.append(edge)
            continue
        consumer, producer = edge.get("from"), edge.get("to")
        if not isinstance(consumer, str) or not isinstance(producer, str):
            raise _fail(f"edges[{index}] dependency endpoints must be strings")
        if consumer not in node_ids or producer not in node_ids:
            raise _fail(f"unknown dependency edge: {consumer} -> {producer}")
        explicit_pairs.append((consumer, producer))
    if len(explicit_pairs) != len(set(explicit_pairs)):
        raise _fail("duplicate dependency edge")

    if any(node_contract) and not all(node_contract):
        raise _fail("depends_on must be present on every node or none")

    if all(node_contract) and nodes:
        derived_pairs: list[tuple[str, str]] = []
        for index, node in enumerate(nodes):
            dependencies = node.get("depends_on")
            if (
                not isinstance(dependencies, list)
                or any(not isinstance(item, str) or not item for item in dependencies)
            ):
                raise _fail(f"nodes[{index}].depends_on must be a string array")
            if len(dependencies) != len(set(dependencies)):
                raise _fail(f"duplicate dependency in node {node['id']}")
            for producer in dependencies:
                if producer not in node_ids:
                    raise _fail(f"unknown dependency: {node['id']} -> {producer}")
                derived_pairs.append((node["id"], producer))
        pairs = set(derived_pairs)
        expected_forward_pairs = {
            (producer, consumer) for consumer, producer in pairs
        }
        explicit_pair_set = set(explicit_pairs)
        if pairs and not explicit_pairs:
            raise _fail(
                "explicit forward dependency edges are required for "
                "nodes[].depends_on"
            )
        if explicit_pair_set != expected_forward_pairs:
            if explicit_pair_set == pairs:
                raise _fail(
                    "explicit dependency edges must use forward "
                    "producer -> consumer orientation"
                )
            raise _fail(
                "nodes[].depends_on disagrees with explicit forward "
                "dependency edges"
            )
    else:
        pairs = set(explicit_pairs)

    _assert_acyclic(node_ids, pairs)
    normalized = dict(graph)
    normalized["edges"] = other_edges + [
        {"type": "depends_on", "from": consumer, "to": producer}
        for consumer, producer in sorted(pairs)
    ]
    return normalized
