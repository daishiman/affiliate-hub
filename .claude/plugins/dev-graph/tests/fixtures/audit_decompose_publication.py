"""C14 decompose live-trial の publication / binding 観測 support module。"""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent


def _load_state():
    path = HERE / "audit_live_trial_state.py"
    spec = importlib.util.spec_from_file_location("audit_live_trial_state_publication", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


STATE = _load_state()
AuditError = STATE.AuditError
_load_object = STATE.load_object
_run_json = STATE.run_json

BINDINGS = ("none", "beads", "github")
BINDING_ROUTES: dict[str, tuple[str, ...]] = {
    "none": (),
    "beads": ("beads_issue",),
    "github": ("github_issue", "github_project_item"),
}


def schema_receipt(repo_root: Path, plugin_root: Path, graph: dict[str, Any]) -> dict[str, Any]:
    return _run_json(
        [
            "python3",
            str(plugin_root / "scripts/validate-graph-schema.py"),
            "--graph",
            "-",
            "--repo-root",
            str(repo_root),
        ],
        stdin=json.dumps(graph, ensure_ascii=False),
    )


def violations_of(receipt: dict[str, Any]) -> list[dict[str, Any]]:
    violations = receipt["payload"].get("violations")
    if not isinstance(violations, list):
        raise AuditError("schema receipt requires violations[]")
    return violations


def _violation_keys(receipt: dict[str, Any], node_id: str) -> set[str]:
    return {
        f"{item.get('code')}|{item.get('detail')}"
        for item in violations_of(receipt)
        if isinstance(item, dict) and item.get("node") == node_id
    }


def state_graph(repo_root: Path) -> dict[str, Any]:
    """run 終了時点の実 graph envelope を返す。"""
    config = _load_object(repo_root / ".dev-graph/config.json")
    relative = (config.get("local_state") or {}).get("graph")
    if not isinstance(relative, str):
        raise AuditError("config.local_state.graph must be a string")
    graph = _load_object(repo_root / relative)
    nodes = graph.get("nodes")
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise AuditError("graph.nodes must be an object array")
    return graph


def _publication_gate(
    repo_root: Path,
    plugin_root: Path,
    graph: dict[str, Any],
    node_id: str,
) -> dict[str, Any]:
    """publication 可否を skill 実装側の schema validator に判定させる。"""
    probe = copy.deepcopy(graph)
    targets = [
        node
        for node in probe.get("nodes", [])
        if isinstance(node, dict) and node.get("graph_node_id") == node_id
    ]
    if not targets:
        raise AuditError(f"publication probe target is absent from the run's graph: {node_id}")
    for node in targets:
        node["status"] = "active"
    receipt = schema_receipt(repo_root, plugin_root, probe)
    blocking = [
        item
        for item in violations_of(receipt)
        if isinstance(item, dict)
        and item.get("node") == node_id
        and item.get("code") == "active_not_ready"
    ]
    return {
        "node": node_id,
        "probe": "status=active",
        "decided_by": receipt["argv"],
        "blocking_violations": blocking,
        "publishable": not blocking,
    }


def publication_decisions(
    repo_root: Path,
    plugin_root: Path,
    graph: dict[str, Any],
    features: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    if not features:
        raise AuditError("the run's graph must contain at least one produced feature")
    decisions: dict[str, dict[str, Any]] = {}
    for node in features:
        node_id = node.get("graph_node_id")
        if not isinstance(node_id, str):
            raise AuditError("produced feature requires a string graph_node_id")
        gate = _publication_gate(repo_root, plugin_root, graph, node_id)
        gate["declared_input"] = {
            "confirmation_status": node.get("confirmation_status"),
            "evaluation_status": node.get("evaluation_status"),
            "readiness_status": (node.get("implementation_readiness") or {}).get("status"),
            "evaluator": (node.get("confirmation_evidence") or {}).get("evaluator"),
        }
        decisions[node_id] = gate
    return decisions


def _route_argv(
    route: str,
    repo_root: Path,
    plugin_root: Path,
    node: dict[str, Any],
) -> list[str]:
    scripts = plugin_root / "scripts"
    node_id = node["graph_node_id"]
    title = node.get("title")
    if not isinstance(title, str):
        raise AuditError(f"publication candidate requires a title: {node_id}")
    description = node.get("purpose") if isinstance(node.get("purpose"), str) else title
    body = json.dumps(
        {
            "graph_node_id": node_id,
            "acceptance": node.get("acceptance", []),
            "implementation_readiness": node.get("implementation_readiness"),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    if route == "beads_issue":
        return [
            "python3",
            str(scripts / "bd-bridge.py"),
            "--op",
            "create",
            "--repo-root",
            str(repo_root),
            "--graph-node-id",
            node_id,
            "--title",
            title,
            "--description",
            description,
            "--artifact-kind",
            "feature",
            "--dry-run",
        ]
    if route == "github_issue":
        return [
            "python3",
            str(scripts / "gh-bridge.py"),
            "--op",
            "issue-create",
            "--repo",
            "example/dev-graph-live-trial",
            "--title",
            title,
            "--body",
            body,
            "--dry-run",
        ]
    if route == "github_project_item":
        return [
            "python3",
            str(scripts / "gh-bridge.py"),
            "--op",
            "project-item-add",
            "--content-id",
            node_id,
            "--project-id",
            node_id,
            "--dry-run",
        ]
    raise AuditError(f"unknown projection route: {route}")


def _observed_publications(
    binding: str,
    delta: dict[str, Any],
    draft_ids: set[str],
) -> dict[str, Any]:
    """pre/post の実差分から、その binding で起票された対象を取り出す。"""
    if binding == "beads":
        published = list(delta["linked_nodes"]["beads"])
        # JSONL は passive export。Dolt DB の代替正本ではなく、帰属不能な副作用を
        # fail-closed で検知する補助信号としてだけ扱う。
        unattributed = list(delta["beads_export"]["added"])
    elif binding == "github":
        published = list(delta["linked_nodes"]["github"])
        unattributed = []
    else:
        published = []
        unattributed = list(delta["issues"]["added"])
    draft_published = sorted(set(published) & draft_ids)
    return {
        "published_node_ids": sorted(published),
        "unattributed_artifacts": sorted(unattributed),
        "draft_published_node_ids": draft_published,
        "unproven_zero_count": len(draft_published) + len(unattributed),
    }


def persisted_bindings(nodes: list[dict[str, Any]]) -> dict[str, list[str]]:
    """run graph に実際に残った tracker_binding を binding ごとに集める。"""
    persisted: dict[str, list[str]] = {}
    for node in nodes:
        node_id = node.get("graph_node_id")
        binding = node.get("tracker_binding")
        if not isinstance(node_id, str) or not isinstance(binding, str):
            raise AuditError("run graph node requires string graph_node_id and tracker_binding")
        persisted.setdefault(binding, []).append(node_id)
    return {binding: sorted(ids) for binding, ids in sorted(persisted.items())}


def _binding_reachability(
    repo_root: Path,
    plugin_root: Path,
    graph: dict[str, Any],
    baseline_keys: dict[str, set[str]],
    node_id: str,
    binding: str,
) -> dict[str, Any]:
    """binding 宣言可否を実装側の schema 規則に決めさせる。"""
    probe = copy.deepcopy(graph)
    targets = [
        node
        for node in probe.get("nodes", [])
        if isinstance(node, dict) and node.get("graph_node_id") == node_id
    ]
    if not targets:
        raise AuditError(f"binding probe target is absent from the run's graph: {node_id}")
    for node in targets:
        node["tracker_binding"] = binding
    receipt = schema_receipt(repo_root, plugin_root, probe)
    introduced = sorted(_violation_keys(receipt, node_id) - baseline_keys.get(node_id, set()))
    return {
        "node": node_id,
        "probe": f"tracker_binding={binding}",
        "decided_by": receipt["argv"],
        "blocking_rules": introduced,
        "declarable": not introduced,
    }


def binding_projections(
    repo_root: Path,
    plugin_root: Path,
    graph: dict[str, Any],
    features: list[dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
    delta: dict[str, Any],
    run_binding: str,
) -> dict[str, dict[str, Any]]:
    by_id = {node["graph_node_id"]: node for node in features}
    draft_ids = {node_id for node_id, gate in decisions.items() if not gate["publishable"]}
    candidate_ids = sorted(
        node_id for node_id, gate in decisions.items() if gate["publishable"]
    )
    baseline_receipt = schema_receipt(repo_root, plugin_root, graph)
    baseline_keys = {
        node_id: _violation_keys(baseline_receipt, node_id) for node_id in by_id
    }
    persisted = persisted_bindings(graph["nodes"])
    projections: dict[str, dict[str, Any]] = {}
    for binding in BINDINGS:
        routes = BINDING_ROUTES[binding]
        probes = [
            _binding_reachability(
                repo_root, plugin_root, graph, baseline_keys, node_id, binding
            )
            for node_id in sorted(by_id)
        ]
        declarable = any(probe["declarable"] for probe in probes)
        persisted_ids = persisted.get(binding, [])
        receipts = [
            {
                "node": node_id,
                "route": route,
                "receipt": _run_json(_route_argv(route, repo_root, plugin_root, by_id[node_id])),
            }
            for node_id in candidate_ids
            for route in routes
        ]
        observed = _observed_publications(binding, delta, draft_ids)
        if not persisted_ids:
            attribution = "not-exercised-by-run" if declarable else "binding-route-unreachable"
        elif not routes:
            attribution = "binding-route-absent"
        elif receipts:
            attribution = "draft-gate"
        else:
            attribution = "no-live-candidate"
        projections[binding] = {
            "routes": list(routes),
            "route_declarable": declarable,
            "declaration_probes": probes,
            "persisted_node_ids": persisted_ids,
            "exercised_by_run": bool(persisted_ids),
            "candidate_route_receipts": receipts,
            "candidate_route_invocations": len(receipts),
            "draft_node_ids": sorted(draft_ids),
            "observed": observed,
            # 互換用の要約と、draft/candidate を混同しない二つの帰属を併記する。
            "zero_attribution": attribution,
            "draft_zero_attribution": "draft-gate" if draft_ids else "no-draft-node",
            "candidate_zero_attribution": (
                "external-adapter-dry-run" if receipts else attribution
            ),
        }
    return projections


def suppression_from(receipt: dict[str, Any]) -> bool:
    payload = receipt["payload"]
    if payload.get("op") == "create":
        return isinstance(payload.get("dry_run_preview"), dict)
    return payload.get("dry_run") is True and payload.get("mutation_suppressed") is True
