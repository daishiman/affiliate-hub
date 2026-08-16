#!/usr/bin/env python3
# /// script
# name: schedule-graph
# purpose: Compute deterministic feature/task ready sets and non-conflicting worktree batches.
# inputs: ["argv: --graph FILE --leases FILE --ready-source self|bd-bridge --ready-json FILE? --eval-log FILE?"]
# outputs: ["stdout: JSON schedule", "file: optional eval-log JSON receipt"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: optional eval-log receipt only
# ///
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from _common import ContractError, atomic_json, contained, dump, load_json, repository_eval_root, run, utc_now
from node_transaction import ensure_no_pending_transaction, graph_operation_lock
from schedule_graph_nodes import blocking_dependencies, is_schedulable, touches


ACTIVE_LEASE_STATES = {
    "reserving", "claimed", "in_progress", "pending_review", "pending_merge",
    "claim_pending_local_repair",
}

# qa-069 MVP-first: MVP 適合 rank 第一・node_id 辞書順 tie-break。未設定 (None) を deferred より前に置くのは、既存資産 (全て未設定) を品質系明示 task より
# 優先し、一括書き換え禁止 (scope_out) の下で現行挙動から劣化させないため。
# bd-bridge.py 側の同名定数と一致必須 (test_bd_bridge_mvp_ready_order.py が固定する)。
MVP_FIT_RANK: dict[str | None, int] = {"direct": 0, "enabling": 1, None: 2, "deferred": 3}


def _mvp_fit(node: dict[str, Any]) -> str | None:
    """mvp_alignment.mvp_fit を fail-closed で読む。fallback はキー欠落 / null のみ。

    enum 外の非 null 値を未設定 rank へ丸めると不正 metadata が黙って通る (AC-3 の裏面)。
    validate-graph-schema.py PASS 済み graph では到達しない防衛線として ContractError で落とす。
    """
    alignment = node.get("mvp_alignment")
    if alignment is None:
        return None
    node_ref = node.get("graph_node_id") or node.get("id") or "<unknown>"
    if not isinstance(alignment, dict):
        raise ContractError(f"{node_ref}: mvp_alignment must be an object or null")
    fit = alignment.get("mvp_fit")
    if fit is None:
        return None
    if fit not in MVP_FIT_RANK:
        raise ContractError(f"{node_ref}: unsupported mvp_fit {fit!r} (expected direct|enabling|deferred)")
    return fit


def _mvp_established(by_id: dict[str, dict[str, Any]], candidates: list[dict[str, Any]]) -> dict[str, bool | None]:
    """selection_receipt に載る feature の MVP 成立状況を全 graph から計算する。

    --scope に依存させないのは、mvp_established が feature の graph 上の事実であり、
    閲覧範囲で真偽が変わると冪等 (AC-2) の「同一入力」が曖昧になるため。
    direct task 0 件は空虚な真で true と誤読させないため null とする (design §5)。
    掲載対象は candidates に現れる parent_feature 集合 + candidates 中の feature 自身のみ。
    """
    feature_ids: set[str] = set()
    for node in candidates:
        parent = node.get("parent_feature")
        if isinstance(parent, str) and parent:
            feature_ids.add(parent)
        if node.get("artifact_kind", node.get("kind")) == "feature":
            feature_ids.add(str(node.get("graph_node_id") or node.get("id")))
    result: dict[str, bool | None] = {}
    for feature_id in sorted(feature_ids):
        direct = [
            node for node in by_id.values()
            if node.get("parent_feature") == feature_id and _mvp_fit(node) == "direct"
        ]
        result[feature_id] = (
            None if not direct
            else all(node.get("status") in {"done", "closed"} for node in direct)
        )
    return result


def _deferral_reason(node: dict[str, Any], established: dict[str, bool | None]) -> str | None:
    """deferred 行の繰り延べ理由。状況別 3+1 種の固定文字列 (design §5)。"""
    if _mvp_fit(node) != "deferred":
        return None
    parent = node.get("parent_feature")
    if not isinstance(parent, str) or not parent:
        return "quality-after-mvp: parent feature なしのため mvp_established 判定対象外、繰り延べ順序のみ適用"
    state = established.get(parent)
    if state is None:
        return "quality-after-mvp: MVP 未定義 (direct task 0 件) のため繰り延べ順序のみ適用"
    if state:
        return "quality-after-mvp: parent feature の MVP 成立済み。deferred rank による繰り延べ順序のみ適用"
    return "quality-after-mvp: parent feature の MVP (direct 全件 done) が未成立のため繰り延べ"


def _selection_receipt(by_id: dict[str, dict[str, Any]], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    """選定理由の receipt (qa-069 SI-5 / AC-4)。既存 plan キーへは触れない additive 出力。

    order_index は features/tasks 分割前の単一 candidates リストの通し番号 (design §6)。
    mvp_alignment 未設定 node も null で必ず記録し、判断根拠が無いことを silent drop させない。
    """
    established = _mvp_established(by_id, candidates)
    entries: list[dict[str, Any]] = []
    for index, node in enumerate(candidates):
        fit = _mvp_fit(node)
        alignment = node.get("mvp_alignment") if isinstance(node.get("mvp_alignment"), dict) else {}
        entries.append({
            "graph_node_id": node.get("graph_node_id") or node.get("id"),
            "artifact_kind": node.get("artifact_kind", node.get("kind")),
            "order_index": index,
            "mvp_fit": fit,
            "sort_rank": MVP_FIT_RANK[fit],
            "purpose": alignment.get("purpose"),
            "background": alignment.get("background"),
            "rationale": alignment.get("rationale"),
            "deferral_reason": _deferral_reason(node, established),
        })
    return {"policy": "mvp-first/v1", "mvp_established": established, "entries": entries}


def _sha(value: bytes | None) -> str | None:
    return hashlib.sha256(value).hexdigest() if value is not None else None


def _canonical_digest(value: Any) -> str:
    """graph の意味的 digest。整形差 (空白・key 順) で stale 判定が揺れないようにする。

    C05 render-graph-html が registration receipt の鮮度検査に使う式と同一。parity manifest
    側も同じ式で `source_graph_digest` を作る契約にし、比較を単純な文字列一致へ落とす。
    """
    return "sha256:" + hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _read_optional(path: Path | None) -> bytes | None:
    return path.read_bytes() if path is not None and path.exists() else None


def _lease_path(args: argparse.Namespace, root: Path | None) -> tuple[Path | None, str]:
    if args.leases:
        requested = Path(args.leases)
        requested = requested if requested.is_absolute() else (root or Path.cwd()) / requested
        if not requested.is_file():
            raise ContractError(f"explicit lease snapshot does not exist: {requested}")
        resolved = requested.resolve(strict=True)
        if root is not None:
            cp = run(["git", "-C", str(root), "rev-parse", "--git-common-dir"], check=False)
            if cp.returncode == 0:
                common = Path(cp.stdout.strip())
                common = common if common.is_absolute() else root / common
                canonical = (common.resolve(strict=True) / "dev-graph" / "leases.json").resolve(strict=True)
                if resolved != canonical:
                    raise ContractError(f"lease snapshot is not the git-common authority: {resolved}")
                return resolved, "git_common_dir"
            contained(resolved, root, must_exist=True)
        return resolved, "explicit_non_git_fixture"
    if root is None:
        # Compatibility for direct library callers. The public command always supplies --repo-root.
        return None, "legacy_unset"
    cp = run(["git", "-C", str(root), "rev-parse", "--git-common-dir"], check=False)
    if cp.returncode:
        raise ContractError("--repo-root requires a Git repository or an explicit --leases snapshot")
    common = Path(cp.stdout.strip())
    common = common if common.is_absolute() else root / common
    return common.resolve(strict=True) / "dev-graph" / "leases.json", "git_common_dir"


def _active(lease: dict[str, Any], now: datetime) -> bool:
    if lease.get("state") not in ACTIVE_LEASE_STATES:
        return False
    expires = lease.get("expires_at")
    if expires is None:
        return True
    try:
        expiry = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("lease snapshot contains an invalid expires_at") from exc
    if expiry.tzinfo is None:
        raise ContractError("lease expires_at must be timezone-aware")
    return expiry > now


def _scope_ids(scope: str | None, by_id: dict[str, dict[str, Any]]) -> set[str]:
    if scope is None:
        return set(by_id)
    if scope not in by_id:
        raise ContractError(f"unknown --scope graph node: {scope}")
    selected = {scope}
    changed = True
    while changed:
        changed = False
        for node_id, node in by_id.items():
            if node_id not in selected and node.get("parent_feature") in selected:
                selected.add(node_id)
                changed = True
    return selected


def _tracker_side_unmapped(value: Any) -> list[dict[str, Any]]:
    """C28 側で ready から落ちた候補 (unmapped/conflicts) を schedule report へ引き継ぐ。

    ここで捨てると「tracker では ready だが graph 管理から外れている課題」が
    最終レポートに一切現れず、silent drop になる。判断はしないが必ず見せる。
    """
    if not isinstance(value, dict):
        return []
    carried: list[dict[str, Any]] = []
    for key in ("unmapped", "conflicts"):
        rows = value.get(key)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if isinstance(row, dict):
                carried.append({**row, "reason": row.get("reason") or f"tracker_{key}", "source": "bd-bridge"})
    return carried


def _ready_entries(path: Path | None) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], bytes | None, Any]:
    if path is None:
        return {}, [], None, None
    before = path.read_bytes()
    value = json.loads(before.decode("utf-8"))
    raw = value.get("ready_set", value) if isinstance(value, dict) else value
    if not isinstance(raw, list):
        raise ContractError("bd ready payload must contain ready_set[]")
    mapped: dict[str, dict[str, Any]] = {}
    unmapped: list[dict[str, Any]] = _tracker_side_unmapped(value)
    provenance = value.get("parity_provenance") if isinstance(value, dict) else None
    for item in raw:
        if not isinstance(item, dict):
            unmapped.append({"value": item, "reason": "not_an_object"})
            continue
        external = item.get("external_ref")
        if not isinstance(external, str) or not external:
            unmapped.append({**item, "reason": "missing_external_ref"})
            continue
        if external in mapped:
            raise ContractError(f"duplicate external_ref in Beads ready payload: {external}")
        mapped[external] = item
    return mapped, unmapped, before, provenance


def _schedule(args: argparse.Namespace, root: Path | None, graph_path: Path) -> int:
    ensure_no_pending_transaction(graph_path)
    graph_before = graph_path.read_bytes()
    data = json.loads(graph_before.decode("utf-8"))
    nodes = data.get("nodes", []) if isinstance(data, dict) else data
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise ContractError("graph nodes must be an array of objects")
    by_id = {(node.get("graph_node_id") or node.get("id")): node for node in nodes}
    if None in by_id or len(by_id) != len(nodes):
        raise ContractError("graph nodes require unique IDs")
    selected = _scope_ids(args.scope, by_id)
    done = {node_id for node_id, node in by_id.items() if node.get("status") in {"done", "closed"}}

    ready_path: Path | None = None
    if args.ready_json:
        candidate = Path(args.ready_json)
        candidate = candidate if candidate.is_absolute() else (root or Path.cwd()) / candidate
        ready_path = candidate.resolve(strict=True)
        if root is not None:
            contained(ready_path, root, must_exist=True)
    ready_by_id, unmapped, tracker_before, parity_provenance = _ready_entries(ready_path)
    beads_present = any(
        node.get("tracker_binding") == "beads" and is_schedulable(node)
        for node_id, node in by_id.items() if node_id in selected
    )
    if beads_present and ready_path is None:
        raise ContractError("schedulable beads nodes require --ready-json from bd-bridge ready parity output")
    if beads_present:
        # node 単位の parity は下で再照合するが、それは manifest に載った node しか見ない。
        # snapshot 生成後に追加/削除された node は node 単位検査では原理的に捕まらないため、
        # graph 全体の digest 一致を停止条件にして stale snapshot での推薦を禁じる。
        if not isinstance(parity_provenance, dict):
            raise ContractError("beads ready payload requires parity_provenance (generated_at/source_graph_digest) from bd-bridge")
        graph_digest = _canonical_digest(data)
        observed = parity_provenance.get("source_graph_digest")
        if observed != graph_digest:
            raise ContractError(
                "beads parity snapshot is stale: parity manifest source_graph_digest "
                f"{observed} != current graph {graph_digest} (regenerate the parity manifest)"
            )

    ready_ids: set[str] = set()
    for node_id, node in by_id.items():
        if node_id not in selected:
            continue
        if not is_schedulable(node):
            continue
        blockers = blocking_dependencies(node, by_id, done)
        if blockers:
            unmapped.append({
                "external_ref": node_id,
                "reason": "dependency_unsatisfied",
                "blocking_depends_on": blockers,
                "source": "schedule-graph",
            })
            continue
        binding = node.get("tracker_binding")
        if binding == "beads":
            entry = ready_by_id.get(node_id)
            parity = entry.get("edge_parity") if entry else None
            status_matches = entry is not None and entry.get("graph_status") == node.get("status")
            dependency_matches = entry is not None and sorted(entry.get("graph_depends_on", [])) == sorted(node.get("depends_on", []))
            if entry and isinstance(parity, dict) and parity.get("confirmed") is True and status_matches and dependency_matches:
                ready_ids.add(node_id)
            elif entry:
                unmapped.append({
                    "external_ref": node_id,
                    "reason": "beads_parity_stale_or_unconfirmed",
                    "expected_status": node.get("status"),
                    "observed_status": entry.get("graph_status"),
                    "expected_depends_on": node.get("depends_on", []),
                    "observed_depends_on": entry.get("graph_depends_on"),
                    "observed_edge_parity": parity,
                    "source": "schedule-graph",
                })
            else:
                unmapped.append({
                    "external_ref": node_id,
                    "reason": "ready_payload_entry_absent",
                    "source": "schedule-graph",
                })
        elif binding in {"github", "none"}:
            ready_ids.add(node_id)
        elif binding is None and args.ready_source == "bd-bridge":
            # Compatibility with pre-binding fixtures; not used by the public command.
            if node_id in ready_by_id:
                ready_ids.add(node_id)
            else:
                unmapped.append({
                    "external_ref": node_id,
                    "reason": "ready_payload_entry_absent",
                    "source": "schedule-graph",
                })
        elif binding is None:
            ready_ids.add(node_id)
        else:
            raise ContractError(f"{node_id}: unresolved tracker_binding {binding!r}")
    for external, item in ready_by_id.items():
        if external not in by_id:
            unmapped.append({**item, "reason": "graph_node_missing", "source": "schedule-graph"})

    lease_path, lease_source = _lease_path(args, root)
    lease_before = _read_optional(lease_path)
    active_leases: list[dict[str, Any]] = []
    if lease_before is not None:
        lease_data = json.loads(lease_before.decode("utf-8"))
        raw_leases = lease_data.get("leases", lease_data) if isinstance(lease_data, (dict, list)) else None
        if not isinstance(raw_leases, list) or not all(isinstance(item, dict) for item in raw_leases):
            raise ContractError("lease snapshot must contain leases[] objects")
        now = datetime.now(timezone.utc)
        active_leases = [item for item in raw_leases if _active(item, now)]
    leased_ids = {item.get("graph_node_id") for item in active_leases}
    leased_touches = {
        str(value) for item in active_leases for value in item.get("resource_scope", [])
    }
    lease_conflicts = {
        node_id for node_id in ready_ids
        if node_id in leased_ids or touches(by_id[node_id]) & leased_touches
    }
    # qa-069: MVP 適合 rank 第一、node_id 辞書順 tie-break (design §3 INV-1)。
    # 順序決定点はこの 1 行のみ (単一 writer 原則)。batches()/features 分割は順序を継承する。
    candidates = [
        by_id[node_id]
        for node_id in sorted(
            ready_ids - lease_conflicts,
            key=lambda nid: (MVP_FIT_RANK[_mvp_fit(by_id[nid])], nid),
        )
    ]
    features = [node for node in candidates if node.get("artifact_kind", node.get("kind")) == "feature"]
    tasks = [node for node in candidates if node not in features]

    conflict_pairs: list[dict[str, Any]] = []
    sorted_ready = sorted(ready_ids)
    for index, left in enumerate(sorted_ready):
        for right in sorted_ready[index + 1:]:
            overlap = sorted(touches(by_id[left]) & touches(by_id[right]))
            if overlap:
                conflict_pairs.append({"left": left, "right": right, "resources": overlap, "kind": "ready_pair"})
    for node_id in sorted(lease_conflicts):
        conflict_pairs.append({
            "left": node_id,
            "right": "active-lease",
            "resources": sorted(touches(by_id[node_id]) & leased_touches),
            "kind": "lease",
        })

    def batches(items: list[dict[str, Any]]) -> list[list[str]]:
        result: list[list[str]] = []
        for node in items:
            node_id = node.get("graph_node_id") or node.get("id")
            scope = touches(node)
            placed = False
            for batch in result:
                if args.max_parallel is not None and len(batch) >= args.max_parallel:
                    continue
                occupied = set().union(*(touches(by_id[member]) for member in batch))
                if not scope & occupied:
                    batch.append(node_id)
                    placed = True
                    break
            if not placed:
                result.append([node_id])
        return result

    feature_batches, task_batches = batches(features), batches(tasks)
    hints = []
    for node in tasks:
        node_id = node.get("graph_node_id") or node.get("id")
        branch = f"devgraph/{node_id}"
        hints.append({
            "graph_node_id": node_id,
            "suggested_branch": branch,
            "claim_command": f"/dev-graph worktree claim {node_id} --branch {branch} --session-id <session>",
        })

    graph_after = graph_path.read_bytes()
    tracker_after = _read_optional(ready_path)
    lease_after = _read_optional(lease_path)
    if graph_before != graph_after:
        raise ContractError("schedule calculation changed the canonical graph")
    if tracker_before != tracker_after:
        raise ContractError("schedule calculation observed a changing tracker parity snapshot")
    if lease_before != lease_after:
        raise ContractError("schedule calculation observed a changing lease snapshot")
    plan = {
        "ready_set": {
            "features": [node.get("graph_node_id") or node.get("id") for node in features],
            "tasks": [node.get("graph_node_id") or node.get("id") for node in tasks],
        },
        "batches": {"features": feature_batches, "tasks": task_batches},
        "selection_receipt": _selection_receipt(by_id, candidates),
        "conflicts": sorted(lease_conflicts),
        "conflict_pairs": conflict_pairs,
        "assignment_hints": hints,
        "unmapped": unmapped,
        "parity_provenance": parity_provenance,
        "ready_source": "binding-aware" if args.ready_source == "auto" else args.ready_source,
        "scope": args.scope,
        "max_parallel": args.max_parallel,
        "lease_source": lease_source,
        "read_only": True,
        "graph_sha256_before": _sha(graph_before),
        "graph_sha256_after": _sha(graph_after),
        "tracker_sha256_before": _sha(tracker_before),
        "tracker_sha256_after": _sha(tracker_after),
        "lease_sha256_before": _sha(lease_before),
        "lease_sha256_after": _sha(lease_after),
        "executed_at": utc_now(),
    }
    if args.eval_log:
        if root is None:
            raise ContractError("--eval-log requires --repo-root")
        eval_root = repository_eval_root(root)
        target = Path(args.eval_log)
        target = target if target.is_absolute() else root / target
        target = contained(target, eval_root, must_exist=False)
        atomic_json(target, plan)
        plan["eval_log"] = target.relative_to(root).as_posix()
    dump(plan)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--graph", required=True)
    parser.add_argument("--ready-source", choices=("auto", "self", "bd-bridge"), default="auto")
    parser.add_argument("--ready-json")
    parser.add_argument("--leases", required=True)
    parser.add_argument("--repo-root")
    parser.add_argument("--scope")
    parser.add_argument("--max-parallel", type=int)
    parser.add_argument("--eval-log")
    args = parser.parse_args()
    if args.max_parallel is not None and args.max_parallel < 1:
        raise ContractError("--max-parallel must be at least 1")

    root = Path(args.repo_root).resolve(strict=True) if args.repo_root else None
    graph_path = Path(args.graph)
    graph_path = graph_path if graph_path.is_absolute() else (root or Path.cwd()) / graph_path
    graph_path = graph_path.resolve(strict=True)
    if root is not None:
        contained(graph_path, root, must_exist=True)
    with graph_operation_lock(graph_path, exclusive=False):
        return _schedule(args, root, graph_path)


if __name__ == "__main__":
    try: raise SystemExit(main())
    except (ContractError, OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
