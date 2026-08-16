#!/usr/bin/env python3
# /// script
# name: audit-decompose-integrity
# purpose: Verify C14 evidence binding, preview consistency, and falsifiable publication-gate controls.
# inputs: imported Python API (preview/state graph, repository root, plugin root, baseline receipt)
# outputs: integrity measurement dictionaries
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: none
# ///
"""C14 live-trial の改ざん耐性と反証可能性を測る責務。

実書込み・binding・publication route の監査は audit_decompose_live_trial.py と
audit_decompose_publication.py が担当する。この module は、昇格証跡が最終 node 内容へ
束縛されていること、preview の重複配列が正本 nodes と矛盾しないこと、正準 validator が
同じ run の gate 違反を実際に拒否することだけを担当する。
"""

from __future__ import annotations

import copy
import hashlib
import json
from typing import Any, Callable


EVALUATED_DIGEST_EXCLUDED = ("confirmation_evidence",)
EVALUATED_DIGEST_RECIPE = (
    "sha256(json.dumps({k: v for k, v in node.items() if "
    "k != 'confirmation_evidence'}, ensure_ascii=False, sort_keys=True, "
    "separators=(',', ':')).encode('utf-8')).hexdigest()"
)


def gate_conditions(node: dict[str, Any]) -> dict[str, bool]:
    readiness = node.get("implementation_readiness") or {}
    if not isinstance(readiness, dict):
        raise ValueError("feature implementation_readiness must be an object")
    return {
        "confirmation_confirmed": node.get("confirmation_status") == "confirmed",
        "evaluation_pass": node.get("evaluation_status") == "pass",
        "readiness_complete": readiness.get("status") == "complete",
    }


def is_publication_candidate(node: dict[str, Any]) -> bool:
    return all(gate_conditions(node).values())


def evaluation_digest(node: dict[str, Any]) -> str:
    """node 内容から evaluated_digest の正準値を再計算する。"""
    payload = {
        key: value
        for key, value in node.items()
        if key not in EVALUATED_DIGEST_EXCLUDED
    }
    canonical = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def evidence_binding(features: list[dict[str, Any]]) -> dict[str, Any]:
    """confirmation_evidence が最終 node 内容へ束縛されているかを測る。"""
    checks: list[dict[str, Any]] = []
    for node in features:
        evidence = node.get("confirmation_evidence")
        if not isinstance(evidence, dict):
            raise ValueError(
                f"{node.get('graph_node_id')}: confirmation_evidence must be an object"
            )
        declared = evidence.get("evaluated_digest")
        expected = evaluation_digest(node)
        promoted = is_publication_candidate(node)
        evaluator = evidence.get("evaluator")
        evidence_ref = evidence.get("evidence_ref")
        fields_present = (
            isinstance(evaluator, str)
            and bool(evaluator.strip())
            and isinstance(evidence_ref, str)
            and bool(evidence_ref.strip())
        )
        bound = (
            fields_present and declared == expected
            if promoted
            else declared is None or declared == expected
        )
        checks.append(
            {
                "graph_node_id": node.get("graph_node_id"),
                "promoted": promoted,
                "declared_digest": declared,
                "expected_digest": expected,
                "digest_matches": declared == expected,
                "evidence_fields_present": fields_present,
                "bound": bound,
            }
        )
    return {
        "recipe": EVALUATED_DIGEST_RECIPE,
        "excluded_fields": list(EVALUATED_DIGEST_EXCLUDED),
        "checks": checks,
        "all_bound": all(check["bound"] for check in checks),
    }


def preview_consistency(
    preview: dict[str, Any], features: list[dict[str, Any]]
) -> dict[str, Any]:
    """`preview.nodes` を正本とし、便宜配列との lifecycle 乖離を検出する。"""
    canonical = {
        node.get("graph_node_id"): node
        for node in features
        if isinstance(node.get("graph_node_id"), str)
    }
    divergent: list[dict[str, Any]] = []
    mirrors = {
        key: value
        for key, value in preview.items()
        if key != "nodes" and isinstance(value, list)
    }
    for key, entries in mirrors.items():
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("artifact_kind") != "feature":
                continue
            node_id = entry.get("graph_node_id")
            base = canonical.get(node_id)
            if base is None:
                divergent.append(
                    {"array": key, "graph_node_id": node_id, "reason": "absent_from_nodes"}
                )
            elif gate_conditions(entry) != gate_conditions(base):
                divergent.append(
                    {
                        "array": key,
                        "graph_node_id": node_id,
                        "reason": "gate_status_diverges_from_nodes",
                        "nodes": gate_conditions(base),
                        key: gate_conditions(entry),
                    }
                )
    return {
        "canonical_array": "nodes",
        "mirror_arrays": sorted(mirrors),
        "divergent": divergent,
        "consistent": not divergent,
    }


def _violation_keys(receipt: dict[str, Any], node_id: str) -> set[tuple[str, str]]:
    violations = receipt["payload"].get("violations")
    if not isinstance(violations, list):
        raise ValueError("schema receipt requires violations[]")
    return {
        (str(item.get("code")), str(item.get("detail")))
        for item in violations
        if isinstance(item, dict) and item.get("node") == node_id
    }


def _mutate_pass_without_readiness(node: dict[str, Any]) -> str:
    node["confirmation_status"] = "confirmed"
    node["evaluation_status"] = "pass"
    node["confirmation_evidence"] = {
        "evaluator": "audit-negative-control",
        "evidence_ref": "in-memory gate negative control",
        "evaluated_digest": evaluation_digest(node),
    }
    return "confirmation_status=confirmed, evaluation_status=pass, readiness incomplete"


def _mutate_publication_intent(node: dict[str, Any]) -> str:
    node["github_publication"] = {
        "mode": "issue",
        "project_aliases": [],
        "labels": [],
        "milestone": None,
    }
    return "github_publication.mode=issue on a gate-blocked feature"


def gate_negative_controls(
    *,
    document: dict[str, Any],
    baseline: dict[str, Any],
    blocked_ids: list[str],
    validate: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    """同じ run の graph を二通り壊し、正準 validator が該当節で拒否するか測る。"""
    if not blocked_ids:
        return {
            "executed": False,
            "reason": "no gate-blocked feature in the produced graph",
            "controls": [],
            "all_rejected": False,
        }
    target = blocked_ids[0]
    controls: list[dict[str, Any]] = []
    for name, mutate, expected_clause in (
        (
            "readiness_clause",
            _mutate_pass_without_readiness,
            "$.implementation_readiness.status",
        ),
        (
            "publication_intent_on_blocked_node",
            _mutate_publication_intent,
            "$.confirmation_status",
        ),
    ):
        mutated = copy.deepcopy(document)
        node = next(
            (
                item
                for item in mutated.get("nodes", [])
                if isinstance(item, dict) and item.get("graph_node_id") == target
            ),
            None,
        )
        if node is None:
            raise ValueError(f"blocked feature vanished from graph: {target}")
        mutation = mutate(node)
        receipt = validate(mutated)
        new_keys = _violation_keys(receipt, target) - _violation_keys(baseline, target)
        controls.append(
            {
                "control": name,
                "mutated_node": target,
                "mutation": mutation,
                "expected_clause": expected_clause,
                "new_violations": [
                    {"code": code, "detail": detail}
                    for code, detail in sorted(new_keys)
                ],
                "clause_fired": any(
                    detail.startswith(expected_clause) for _, detail in new_keys
                ),
                "rejected": (
                    bool(new_keys) and receipt["payload"].get("valid") is not True
                ),
            }
        )
    return {
        "executed": True,
        "controls": controls,
        "all_rejected": all(
            control["rejected"] and control["clause_fired"] for control in controls
        ),
    }
