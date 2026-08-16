# /// script
# name: schedule-graph-nodes
# purpose: Keep C16 graph-node predicates independent from schedule payload and lease I/O.
# inputs: ["in-memory graph node and node index"]
# outputs: ["schedulability, touch-set, and dependency decisions"]
# requires-python = ">=3.10"
# dependencies: ["_common.py"]
# contexts: [B, C, E]
# network: false
# write-scope: none
# ///
"""Pure C16 node predicates shared by the scheduler and focused tests.

This module owns graph-node shape, schedulability, and dependency decisions;
the entrypoint owns payload parsing, lease evaluation, and receipt rendering.
"""
from __future__ import annotations

from typing import Any

from _common import ContractError


def touches(node: dict[str, Any]) -> set[str]:
    """Return the canonical graph-node `resource_scope: string[]` value.

    Older prototypes used ``{"touches": [...]}``, but that shape contradicts
    graph-node.schema.json and silently erased every scope during scheduling.
    Reject the stale shape instead of producing an unsafe parallel batch.
    """
    values = node.get("resource_scope", [])
    if not isinstance(values, list) or any(
        not isinstance(value, str) or not value for value in values
    ):
        node_id = node.get("graph_node_id") or node.get("id") or "<unknown>"
        raise ContractError(f"{node_id}: resource_scope must be a non-empty string[]")
    return set(values)


def is_schedulable(node: dict[str, Any]) -> bool:
    """Return whether C16 may consider a node for a ready recommendation."""
    readiness = node.get("implementation_readiness") or {}
    return (
        node.get("status") == "active"
        and node.get("confirmation_status") == "confirmed"
        and node.get("evaluation_status") == "pass"
        and isinstance(readiness, dict)
        and readiness.get("status") == "complete"
    )


def blocking_dependencies(
    node: dict[str, Any], by_id: dict[str, dict[str, Any]], done: set[str]
) -> list[str]:
    """Return unfinished dependencies without copying macro feature edges.

    P01 is a package entry point. Its own ``depends_on`` is an intra-feature
    list; its parent feature's macro dependencies are evaluated dynamically as
    an entry gate. Malformed graph data stops schedule generation rather than
    silently removing a candidate from the report.
    """
    dependencies = node.get("depends_on", [])
    if not isinstance(dependencies, list):
        raise ContractError(f"{node.get('graph_node_id') or node.get('id')}: depends_on must be a list")
    blocking = [dep for dep in dependencies if dep not in done]
    if node.get("artifact_kind", node.get("kind")) != "task" or node.get("phase_ref") != "P01":
        return sorted(set(blocking))
    parent_id = node.get("parent_feature")
    if not isinstance(parent_id, str) or parent_id not in by_id:
        raise ContractError(
            f"{node.get('graph_node_id') or node.get('id')}: P01 task requires a graph parent_feature"
        )
    upstream = by_id[parent_id].get("depends_on", [])
    if not isinstance(upstream, list):
        raise ContractError(f"{parent_id}: depends_on must be a list")
    blocking.extend(dep for dep in upstream if dep not in done)
    return sorted(set(blocking))
