#!/usr/bin/env python3
# /// script
# name: audit-decompose-live-trial
# purpose: Derive C14 live-trial evidence from repository state, preview data, the implementation publication gate, and real adapter receipts.
# inputs: ["snapshot|audit plus explicit repository, preview, scenario, plugin, and output paths; audit additionally requires --run-mode (dry-run|apply) and --run-binding (none|beads|github)"]
# outputs: ["JSON state snapshot or audit report"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: the explicit --output path only
# ///
"""C14 decompose live-trial の決定論的な監査ヘルパー。

このヘルパーは被験 skill の代わりに preview を生成しない。skill 実行前の管理対象状態を
snapshot し、skill が生成した一つの preview と、実 adapter の dry-run receipt だけから
受け入れ証拠を導出する。試験中に監査コードを即席生成して期待値を自己申告することを防ぐ。

状態 snapshot、publication route、証跡整合性は sibling module に分離した (責務分割)。
provenance は全 module と scenario 契約の合成 identity で測るため、どれかを試験中に書き換えても
`provenance_valid` が落ちる。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
STATE_MODULE = "audit_live_trial_state.py"
PUBLICATION_MODULE = "audit_decompose_publication.py"
INTEGRITY_MODULE = "audit_decompose_integrity.py"
SCENARIO_CONTRACT = "live-trial-positive-scenarios.json"


def _load_sibling(filename: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


STATE = _load_sibling(STATE_MODULE, "audit_live_trial_state")
PUBLICATION = _load_sibling(PUBLICATION_MODULE, "audit_decompose_publication")
INTEGRITY = _load_sibling(INTEGRITY_MODULE, "audit_decompose_integrity")
AuditError = STATE.AuditError
_load_object = STATE.load_object
_write_object = STATE.write_object
_sha256 = STATE.sha256_of
_run_json = STATE.run_json
_git_status = STATE.git_status
_content_inventory = STATE.content_inventory
_state_comparison = STATE.state_comparison

SCENARIO_ID = "C14-OUT1-positive-macro-decomposition-r15"
BINDINGS = PUBLICATION.BINDINGS
RUN_MODES = ("dry-run", "apply")
AUDIT_MODULES = (
    Path(__file__).resolve(),
    HERE / STATE_MODULE,
    HERE / PUBLICATION_MODULE,
    HERE / INTEGRITY_MODULE,
    HERE / SCENARIO_CONTRACT,
)


def _helper_identity() -> dict[str, Any]:
    """監査実装 (本 module + 状態層 module) 全体の同一性を返す。"""
    return STATE.composite_identity(list(AUDIT_MODULES))


def capture_state(repo_root: Path) -> dict[str, Any]:
    return STATE.capture_state(repo_root, audit_implementation=_helper_identity())


def _graph_measurements(nodes: list[dict[str, Any]], threshold: dict[str, Any]) -> dict[str, Any]:
    features = [node for node in nodes if node.get("artifact_kind") == "feature"]
    architectures = [node for node in nodes if node.get("artifact_kind") == "architecture"]
    tasks = [node for node in nodes if node.get("artifact_kind") == "task"]
    ids = {
        node.get("graph_node_id")
        for node in nodes
        if isinstance(node.get("graph_node_id"), str)
    }
    if len(ids) != len(nodes):
        raise AuditError("preview nodes require unique string graph_node_id values")

    dependencies = {
        node["graph_node_id"]: [
            dependency
            for dependency in node.get("depends_on", [])
            if dependency in ids
        ]
        for node in nodes
    }
    visiting: set[str] = set()
    visited: set[str] = set()
    cyclic = False

    def visit(node_id: str) -> None:
        nonlocal cyclic
        if node_id in visiting:
            cyclic = True
            return
        if node_id in visited:
            return
        visiting.add(node_id)
        for dependency in dependencies[node_id]:
            visit(dependency)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in dependencies:
        visit(node_id)

    feature_ids = {node["graph_node_id"] for node in features}
    fan_out = {
        node["graph_node_id"]: len(
            [dependency for dependency in node.get("depends_on", []) if dependency in feature_ids]
        )
        for node in features
    }
    measured = max(fan_out.values()) if fan_out else None
    maximum = threshold.get("max_value")
    threshold_pass = (
        isinstance(measured, int)
        and isinstance(maximum, int)
        and measured <= maximum
    )
    return {
        "produced_node_count": len(nodes),
        "feature_count": len(features),
        "architecture_count": len(architectures),
        "task_count": len(tasks),
        "acyclic": not cyclic,
        "metric": threshold.get("metric"),
        "per_feature": fan_out,
        "measured_max": measured,
        "declared_max": maximum,
        "threshold_pass": threshold_pass,
    }


_schema_receipt = PUBLICATION.schema_receipt
_violations_of = PUBLICATION.violations_of
_state_graph = PUBLICATION.state_graph
_publication_decisions = PUBLICATION.publication_decisions
_persisted_bindings = PUBLICATION.persisted_bindings
_binding_projections = PUBLICATION.binding_projections
_suppression_from = PUBLICATION.suppression_from


def audit(
    *,
    repo_root: Path,
    preview_path: Path,
    scenario_path: Path,
    pre_state_path: Path,
    plugin_root: Path,
    run_mode: str,
    run_binding: str,
) -> dict[str, Any]:
    if run_mode not in RUN_MODES:
        raise AuditError(f"run mode must be one of {RUN_MODES}: {run_mode}")
    if run_binding not in BINDINGS:
        raise AuditError(f"run binding must be one of {BINDINGS}: {run_binding}")
    preview = _load_object(preview_path)
    nodes = preview.get("nodes")
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise AuditError("preview.nodes must be an object array")
    scenarios = _load_object(scenario_path).get("scenarios")
    if not isinstance(scenarios, list):
        raise AuditError("scenario file requires scenarios[]")
    scenario = next(
        (
            item
            for item in scenarios
            if isinstance(item, dict) and item.get("scenario_id") == SCENARIO_ID
        ),
        None,
    )
    if not isinstance(scenario, dict):
        raise AuditError(f"scenario not found: {SCENARIO_ID}")
    threshold = scenario.get("declared_granularity_threshold")
    if not isinstance(threshold, dict):
        raise AuditError("scenario requires declared_granularity_threshold")

    features = [node for node in nodes if node.get("artifact_kind") == "feature"]
    preview_consistency = INTEGRITY.preview_consistency(preview, features)
    graph = _graph_measurements(nodes, threshold)
    # DAG と粒度は skill が生成した preview で測る。publication は run 終了時の実 graph で
    # 判定する。同じ node 集合の別の時点であり、混ぜると昇格が観測できなくなる。
    state_graph = _state_graph(repo_root)
    state_features = [
        node for node in state_graph["nodes"] if node.get("artifact_kind") == "feature"
    ]
    pre_state = _load_object(pre_state_path)
    local = _state_comparison(pre_state, capture_state(repo_root))
    delta = local["publication_delta"]
    helper = _helper_identity()
    helper_pre = pre_state.get("audit_implementation")
    helper_provenance_valid = (
        isinstance(helper_pre, dict)
        and helper_pre.get("sha256") == helper["sha256"]
        and helper["tracked_in_index"]
        and helper["index_matches_worktree"]
    )
    decisions = _publication_decisions(repo_root, plugin_root, state_graph, state_features)
    draft_ids = sorted(node_id for node_id, gate in decisions.items() if not gate["publishable"])
    candidate_ids = sorted(node_id for node_id, gate in decisions.items() if gate["publishable"])
    # 昇格が run に帰属することの証拠は pre-state 差分から取る。以前はここで監査側が決めた
    # evaluator 名を candidate に要求していたが、それは実装の正規 lifecycle 経路が書く値では
    # なく監査の合言葉でしかない。合言葉を要求すると、trial 側は正規経路の代わりに監査を
    # 満たすためだけの細工をすることになり、判定の正本がまた実装から離れる。
    # fixture は node を一件も持たない状態から始まるので、「pre-state に無かった node が
    # candidate になっている」ことが、その candidate を fixture が播いたのではないことの
    # 直接証拠になる。
    pre_node_ids = set(pre_state["publication_inventory"]["node_linkages"])
    lifecycle_ids = sorted(node_id for node_id in candidate_ids if node_id not in pre_node_ids)
    projections = _binding_projections(
        repo_root, plugin_root, state_graph, state_features, decisions, delta, run_binding
    )
    persisted_bindings = _persisted_bindings(state_graph["nodes"])
    # 申告 (--run-binding) と実測 (graph に残った tracker_binding) の突合。ここが無いと、
    # 実際には none で登録された run に github を申告しても監査は気付かず、0 件の理由を
    # 「draft gate が効いた」と取り違えたまま緑を返す。
    run_binding_attested = set(persisted_bindings) == {run_binding}
    adapter_suppression = {
        f"{binding}:{entry['route']}:{entry['node']}": _suppression_from(entry["receipt"])
        for binding, projection in projections.items()
        for entry in projection["candidate_route_receipts"]
    }
    schema = _schema_receipt(repo_root, plugin_root, preview)
    violations = _violations_of(schema)
    structural_violations = [
        item
        for item in violations
        if not isinstance(item, dict) or item.get("code") != "artifact_missing"
    ]
    state_schema = _schema_receipt(repo_root, plugin_root, state_graph)
    evidence_binding = INTEGRITY.evidence_binding(state_features)
    negative_controls = INTEGRITY.gate_negative_controls(
        document=state_graph,
        baseline=state_schema,
        blocked_ids=draft_ids,
        validate=lambda document: _schema_receipt(repo_root, plugin_root, document),
    )

    write_counts = {
        "local_issue_files": delta["issues"]["added_count"],
        "beads_export_records": delta["beads_export"]["added_count"],
        "beads_linked_nodes": len(delta["linked_nodes"]["beads"]),
        "github_linked_nodes": len(delta["linked_nodes"]["github"]),
    }
    # draft ゲートの検査。判定は実装側 probe の返り値からしか作らないので、実装のゲートを
    # 壊すと draft も publishable になり discriminates が False へ落ちる (mutation test)。
    gate = {
        "decided_by": "plugins/dev-graph/scripts/validate-graph-schema.py (code=active_not_ready)",
        "draft_node_ids": draft_ids,
        "candidate_node_ids": candidate_ids,
        "lifecycle_candidate_ids": lifecycle_ids,
        "excludes_every_draft": bool(draft_ids),
        "admits_promoted_candidate": bool(candidate_ids),
        "promotion_attributable_to_run": (
            bool(lifecycle_ids) and set(candidate_ids) == set(lifecycle_ids)
        ),
    }
    gate["discriminates"] = gate["excludes_every_draft"] and gate["admits_promoted_candidate"]
    draft_publication_zero = all(
        projection["observed"]["unproven_zero_count"] == 0
        for projection in projections.values()
    )
    binding_observations_distinct = (
        len({
            json.dumps(
                {
                    "routes": projection["routes"],
                    "invocations": projection["candidate_route_invocations"],
                    "argv": [
                        entry["receipt"]["argv"][1:]
                        for entry in projection["candidate_route_receipts"]
                    ],
                    "declarable": projection["route_declarable"],
                    "persisted": projection["persisted_node_ids"],
                    "attribution": projection["zero_attribution"],
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            for projection in projections.values()
        })
        == len(BINDINGS)
    )
    if run_mode == "dry-run":
        mode_checks = {
            "local_state_unchanged": local["mutation_suppressed"],
            "no_publication_written": all(value == 0 for value in write_counts.values()),
        }
    else:
        # 実書込み run では graph/content が動くのが正常。ここで「何も動いていないこと」を
        # 要求すると監査は構造的に必ず赤くなり、dry-run 前提でしか緑にならなくなる。
        mode_checks = {
            "local_state_advanced": not local["mutation_suppressed"],
            "graph_store_written": not local["checks"]["graph_sha_unchanged"],
        }
    passed = all([
        bool(nodes),
        bool(features),
        bool(graph["architecture_count"]),
        graph["acyclic"],
        graph["threshold_pass"],
        not bool(graph["task_count"]),
        gate["discriminates"],
        gate["promotion_attributable_to_run"],
        evidence_binding["all_bound"],
        negative_controls["all_rejected"],
        preview_consistency["consistent"],
        draft_publication_zero,
        binding_observations_distinct,
        run_binding_attested,
        all(adapter_suppression.values()),
        all(mode_checks.values()),
        not structural_violations,
        helper_provenance_valid,
    ])
    return {
        "scenario_id": SCENARIO_ID,
        "preview": str(preview_path),
        "run_mode": run_mode,
        "run_binding": run_binding,
        "audit_implementation": {
            **helper,
            "same_as_pre_state": (
                isinstance(helper_pre, dict)
                and helper_pre.get("sha256") == helper["sha256"]
            ),
            "provenance_valid": helper_provenance_valid,
        },
        "graph": graph,
        "preview_consistency": preview_consistency,
        "publication_gate": gate,
        "evidence_binding": evidence_binding,
        "gate_negative_controls": negative_controls,
        "publication_decisions": decisions,
        "binding_projections": projections,
        "persisted_bindings": persisted_bindings,
        "run_binding_attested": run_binding_attested,
        "binding_source": (
            "tracker_binding persisted in the run's graph store; --run-binding is only "
            "cross-checked against it and never used as an observation"
        ),
        "binding_observations_distinct": binding_observations_distinct,
        "draft_publication_zero": draft_publication_zero,
        "local_state": local,
        "adapter_mutation_suppression": adapter_suppression,
        "derived_write_counts": write_counts,
        "write_count_source": (
            "pre/post publication_inventory diff: issues/ files, .beads/issues.jsonl records, "
            "graph node issue/beads/project linkages"
        ),
        "run_mode_checks": mode_checks,
        "schema_validation": {
            "stdin_path_used": (
                "--graph" in schema["argv"]
                and schema["argv"][schema["argv"].index("--graph") + 1] == "-"
            ),
            "receipt": schema,
            "violation_count": len(violations),
            "structural_violations": structural_violations,
            "structural_contract_valid": not structural_violations,
        },
        "pass": passed,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    snapshot = commands.add_parser("snapshot")
    snapshot.add_argument("--repo-root", required=True, type=Path)
    snapshot.add_argument("--output", required=True, type=Path)
    audit_parser = commands.add_parser("audit")
    audit_parser.add_argument("--repo-root", required=True, type=Path)
    audit_parser.add_argument("--preview", required=True, type=Path)
    audit_parser.add_argument("--scenario", required=True, type=Path)
    audit_parser.add_argument("--pre-state", required=True, type=Path)
    audit_parser.add_argument("--plugin-dir", required=True, type=Path)
    # 既定値を置かない: 監査が自分の run 条件を推測すると、dry-run 抑止・binding 無効化・
    # draft ゲートのどれで 0 件になったかを取り違える (本 helper の既知欠陥の温床)。
    audit_parser.add_argument("--run-mode", required=True, choices=RUN_MODES)
    audit_parser.add_argument("--run-binding", required=True, choices=BINDINGS)
    audit_parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    try:
        if args.command == "snapshot":
            result = capture_state(args.repo_root.resolve(strict=True))
        else:
            result = audit(
                repo_root=args.repo_root.resolve(strict=True),
                preview_path=args.preview.resolve(strict=True),
                scenario_path=args.scenario.resolve(strict=True),
                pre_state_path=args.pre_state.resolve(strict=True),
                plugin_root=args.plugin_dir.resolve(strict=True),
                run_mode=args.run_mode,
                run_binding=args.run_binding,
            )
        _write_object(args.output, result)
    except (AuditError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return os.EX_DATAERR
    return os.EX_OK


if __name__ == "__main__":
    raise SystemExit(main())
