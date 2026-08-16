#!/usr/bin/env python3
# /// script
# name: bd-bridge
# purpose: Be the single deterministic CLI choke point for allowed Beads task, edge, mirror and gate operations.
# inputs: ["argv: --op OP and operation fields"]
# outputs: ["stdout: normalized JSON receipt"]
# requires-python = ">=3.10"
# dependencies: [../lib/bd_bridge_contracts.py, ../lib/bd_bridge_graph.py, ../lib/bd_bridge_projection.py, ../lib/bd_bridge_audit.py]
# contexts: [A, B, C, E]
# network: true
# write-scope: approved bd CLI only; never direct .beads I/O
# ///
"""Beads 操作の単一決定的 CLI。argv 解析・bd 実行・receipt 出力だけをここに置く。

判定ロジックは責務ごとに ``plugins/dev-graph/lib/bd_bridge_*.py`` へ分離した
(HarnessHub-w7n7: Beads mutation と純粋判定の責務境界)。

  bd_bridge_contracts    受理語彙の exact-set と、外部 I/O を持たない純粋判定
  bd_bridge_graph        canonical graph / parity manifest / spec markdown の read-only 解決
  bd_bridge_projection   graph node → Beads issue の投影 (単体・exact-13・feature rollup)
  bd_bridge_audit        書かずに数える監査 (orphan 棚卸し・node 削除 preflight)

bd / git を叩く lib 関数は実行関数を ``bd=`` ``git=`` で受け取る。本 module の薄い
ラッパが **呼び出し時に** module 変数を渡すため、``monkeypatch.setattr(mod, "bd", ...)``
は分離前と同じく全経路へ効く。``_ready_with_parity`` だけは parity manifest 生成側
(build-parity-manifest.py) と ``status_map`` の exact-set 一致を AST で固定されている
ため、本ファイル内の top-level 関数として残す。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from _common import ContractError, contained, dump, git, load_json, run  # noqa: F401

_LIB_DIR = str(Path(__file__).resolve().parents[1] / "lib")
if _LIB_DIR not in sys.path:
    sys.path.insert(0, _LIB_DIR)
# lib を毎回 exec し直す。本 script は test から spec_from_file_location で何度も読み込まれ、
# そのとき ``_common`` も別インスタンスとして sys.modules へ再登録されうる。lib がキャッシュ
# されたままだと lib 側の ContractError だけが旧世代のクラスになり、``pytest.raises`` や
# ``except ContractError`` が同名の別クラスを取り逃がす (fail-closed が黙って素通りする)。
for _stale in ("bd_bridge_contracts", "bd_bridge_graph", "bd_bridge_projection", "bd_bridge_audit"):
    sys.modules.pop(_stale, None)

import bd_bridge_audit as _audit  # noqa: E402
import bd_bridge_graph as _graph  # noqa: E402
import bd_bridge_projection as _projection  # noqa: E402
from bd_bridge_contracts import (  # noqa: E402,F401
    FRONTMATTER_NODE_ID,
    MUTATIONS,
    MVP_FIT_RANK,
    ORPHAN_DISPOSITIONS,
    PHASES,
    PRIORITY_ALIASES,
    REMOVAL_DISPOSITIONS,
    RFC3339_UTC,
    SHA256,
    UNMAPPED_REASONS,
    UPDATE_FIELDS,
    verify_parity,
)
from bd_bridge_contracts import dependency_ids as _dependency_ids  # noqa: E402,F401
from bd_bridge_contracts import external_ref as _external_ref  # noqa: E402
from bd_bridge_contracts import issue_row as _issue  # noqa: E402
from bd_bridge_contracts import normalize_priority as _normalize_priority  # noqa: E402
from bd_bridge_contracts import requested_update_fields as _requested_update_fields  # noqa: E402,F401
from bd_bridge_contracts import rows as _rows  # noqa: E402
from bd_bridge_contracts import unmapped_reason as _unmapped_reason  # noqa: E402
from bd_bridge_contracts import update_argv as _update_argv  # noqa: E402
from bd_bridge_contracts import validate_update_fields as _validate_update_fields  # noqa: E402,F401
from bd_bridge_contracts import workspace_identity as _workspace_identity  # noqa: E402
from bd_bridge_graph import canonical_graph_path as _canonical_graph_path  # noqa: E402,F401
from bd_bridge_graph import graph_node_ids as _graph_node_ids  # noqa: E402
from bd_bridge_graph import load_manifest as _load_manifest  # noqa: E402
from bd_bridge_graph import manifest_graph_node_ids as _manifest_graph_node_ids  # noqa: E402
from bd_bridge_graph import manifest_provenance as _manifest_provenance  # noqa: E402
from bd_bridge_graph import registration_status as _registration_status  # noqa: E402
from bd_bridge_graph import require_registered_nodes as _require_registered_nodes  # noqa: E402
from bd_bridge_graph import spec_index as _spec_index  # noqa: E402,F401
from bd_bridge_graph import graph_ids_from_document as _graph_ids_from_document  # noqa: E402,F401
from bd_bridge_audit import orphan_disposition as _orphan_disposition  # noqa: E402
from bd_bridge_audit import removal_disposition_rows as _removal_disposition_rows  # noqa: E402,F401
from bd_bridge_projection import validate_projection as _validate_projection  # noqa: E402
from bd_bridge_projection import verify_feature_rollup as _verify_feature_rollup  # noqa: E402


def bd(args: list[str], *, cwd: Path, check: bool = True) -> Any:
    cp = run([os.environ.get("DEV_GRAPH_BD", "bd"), *args], cwd=cwd, check=check)
    raw = cp.stdout.strip()
    if not raw: return {"ok": cp.returncode == 0}
    try:
        value = json.loads(raw)
        if isinstance(value, dict) and "data" in value and "schema_version" in value:
            return value["data"]
        return value
    except json.JSONDecodeError: return {"text": raw, "returncode": cp.returncode}


def preflight(root: Path, expected_workspace_id: str | None = None) -> dict[str, Any]:
    version_raw = run([os.environ.get("DEV_GRAPH_BD", "bd"), "version"], cwd=root).stdout
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", version_raw)
    if not match or not ((1, 1, 0) <= tuple(map(int, match.groups())) < (2, 0, 0)):
        raise ContractError(f"unsupported bd version: {version_raw.strip()}")
    where = bd(["where", "--json"], cwd=root, check=False)
    if isinstance(where, dict) and where.get("returncode", 0) not in (0, None): raise ContractError("bd workspace unavailable")
    identity = _workspace_identity(where)
    if expected_workspace_id and identity["workspace_id"] != expected_workspace_id:
        raise ContractError("linked worktree resolves a different Beads workspace")
    return {"version": match.group(0), "workspace_identity": identity}


# --- lib への実行関数注入 --------------------------------------------------
# module 変数 `bd` / `git` を **呼び出し時に** 解決して渡す。lib 側へ import 時束縛すると
# monkeypatch が届かず、テストが本物の bd/git を叩きにいく (hermetic でなくなる)。


def _find_external(root: Path, graph_node_id: str) -> dict[str, Any] | None:
    return _projection.find_external(root, graph_node_id, bd=bd)


def _create_one(root: Path, **fields: Any) -> dict[str, Any]:
    return _projection.create_one(root, bd=bd, **fields)


def _package_projection(root: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    return _projection.package_projection(root, manifest, bd=bd)


def _refs_with_node(root: Path, node_ids: set[str]) -> dict[str, list[str]]:
    return _graph.refs_with_node(root, node_ids, git=git)


def _graph_ids_from_source(
    root: Path,
    *,
    path: str | None,
    ref: str | None,
    label: str,
    default_current: bool = False,
) -> set[str]:
    return _graph.graph_ids_from_source(
        root, git=git, path=path, ref=ref, label=label, default_current=default_current
    )


def _orphan_audit(root: Path, *, scan_refs: bool = False) -> dict[str, Any]:
    return _audit.orphan_audit(root, bd=bd, git=git, scan_refs=scan_refs)


def _removal_preflight(
    root: Path,
    *,
    before_graph: str | None,
    before_ref: str | None,
    after_graph: str | None,
    after_ref: str | None,
    disposition_manifest: dict[str, Any] | None,
) -> dict[str, Any]:
    return _audit.removal_preflight(
        root,
        bd=bd,
        git=git,
        before_graph=before_graph,
        before_ref=before_ref,
        after_graph=after_graph,
        after_ref=after_ref,
        disposition_manifest=disposition_manifest,
    )


def _ready_with_parity(root: Path, raw: Any, manifest: dict[str, Any] | None) -> dict[str, Any]:
    candidates = _rows(raw)
    provenance = _manifest_provenance(manifest) if manifest is not None else None
    graph_node_ids = _manifest_graph_node_ids(manifest) if manifest is not None else None
    entries = manifest.get("nodes", []) if manifest else []
    if not isinstance(entries, list) or not all(isinstance(row, dict) for row in entries):
        raise ContractError("parity manifest nodes must be an array of objects")
    by_issue = {str(row.get("bd_issue_id")): row for row in entries if row.get("bd_issue_id")}
    if len(by_issue) != len([row for row in entries if row.get("bd_issue_id")]):
        raise ContractError("parity manifest contains duplicate bd_issue_id")
    by_graph = {str(row.get("graph_node_id")): str(row.get("bd_issue_id")) for row in entries if row.get("graph_node_id") and row.get("bd_issue_id")}
    if len(by_graph) != len(entries):
        raise ContractError("parity manifest requires unique graph_node_id and bd_issue_id for every node")
    # graph status → Beads 側の期待 status。graph-node.schema.json の status enum を漏れなく覆う。
    # draft を欠くと、起票済みだが未確定の node が全て conflicts へ落ち、「parity が壊れている」
    # という誤った信号になる。draft が schedule 対象外なのは C16 の is_schedulable が判定する
    # graph 側の事実であって、tracker との突合結果ではない。draft→open は C03 sync
    # (_status_to_remote) の投影と同一で、build-parity-manifest.py の BRIDGE_STATUS_MAP と一致必須。
    status_map = {
        "draft": "open", "active": "open", "blocked": "blocked",
        "done": "closed", "closed": "closed", "tombstoned": "closed",
    }
    ready_set: list[dict[str, Any]] = []
    unmapped: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    for candidate in candidates:
        issue_id = str(candidate.get("id") or "")
        expected = by_issue.get(issue_id)
        if not expected:
            external_ref = _external_ref(candidate)
            unmapped.append({
                "bd_issue_id": issue_id or None, "external_ref": external_ref,
                "reason": _unmapped_reason(external_ref, graph_node_ids),
            })
            continue
        shown = _issue(bd(["show", issue_id, "--json"], cwd=root), issue_id)
        try:
            graph_status = expected.get("graph_status")
            if graph_status not in status_map:
                raise ContractError(f"unsupported graph status in parity manifest: {graph_status}")
            graph_dependencies = expected.get("depends_on", [])
            if not isinstance(graph_dependencies, list) or any(dep not in by_graph for dep in graph_dependencies):
                raise ContractError("parity manifest dependency lacks a Beads linkage")
            # qa-069: キー欠落 / null は未設定 rank へ tolerant fallback、enum 外の非 null は
            # rank 2 へ丸めず per-candidate fail-closed (silent fallback は AC-3 の裏面を破る)。
            mvp_fit = expected.get("mvp_fit")
            if mvp_fit is not None and mvp_fit not in MVP_FIT_RANK:
                raise ContractError(f"unsupported mvp_fit in parity manifest: {mvp_fit!r}")
            parity = verify_parity(shown, status_map[graph_status], [by_graph[dep] for dep in graph_dependencies])
        except ContractError as exc:
            conflicts.append({"bd_issue_id": issue_id, "graph_node_id": expected.get("graph_node_id"), "reason": str(exc)})
            continue
        ready_set.append({
            "bd_issue_id": issue_id,
            "external_ref": expected.get("graph_node_id") or _external_ref(candidate),
            "edge_parity": parity,
            "graph_status": graph_status,
            "graph_depends_on": graph_dependencies,
            "mvp_fit": mvp_fit,
        })
    # qa-069: schedule-graph.py の選定順 (rank → node_id) と表示順を揃える (SI-3)。
    ready_set.sort(key=lambda row: (MVP_FIT_RANK[row.get("mvp_fit")], str(row.get("external_ref") or "")))
    # 理由別件数を receipt へ載せ、unmapped を数えるだけで「graph 管理外が何件・
    # 管理下の取りこぼしが何件」を下流と人間の双方が見分けられるようにする。
    summary = {reason: sum(1 for row in unmapped if row["reason"] == reason) for reason in UNMAPPED_REASONS}
    return {
        "ready_set": ready_set, "unmapped": unmapped, "unmapped_summary": summary,
        "conflicts": conflicts, "candidate_count": len(candidates),
        "parity_provenance": provenance,
    }


def main() -> int:
    p = argparse.ArgumentParser(); p.add_argument("--op", required=True, choices=("create", "update", "dep-add", "dep-remove", "close", "ready", "show", "claim", "github-push", "gate-add", "gate-check", "orphan-audit", "removal-preflight"))
    p.add_argument("--repo-root", default="."); p.add_argument("--graph-node-id"); p.add_argument("--bd-issue-id"); p.add_argument("--depends-on"); p.add_argument("--expected-depends-on", action="append", default=[]); p.add_argument("--expected-status"); p.add_argument("--expected-workspace-id"); p.add_argument("--verify-parity", action="store_true"); p.add_argument("--title"); p.add_argument("--description"); p.add_argument("--notes"); p.add_argument("--append-notes"); p.add_argument("--design"); p.add_argument("--priority"); p.add_argument("--assignee"); p.add_argument("--labels", help="update: カンマ区切りの label 集合。bd --set-labels へ置換転送する"); p.add_argument("--status"); p.add_argument("--reason"); p.add_argument("--pr", type=int); p.add_argument("--dry-run", action="store_true")
    p.add_argument("--parity-manifest"); p.add_argument("--projection-manifest"); p.add_argument("--feature-rollup-manifest"); p.add_argument("--artifact-kind", choices=("feature", "task"))
    # 既定 off。全 ref の graph を読むため作業ツリー限定より重く、CI の常時実行には向かない。
    # 一方 merge_pending の判定はこれ無しでは不可能なので、処分を決める棚卸しでは必ず付ける。
    p.add_argument("--scan-refs", action="store_true", help="orphan-audit: 他 ref の graph も走査し merge_pending を切り分ける")
    p.add_argument("--before-graph"); p.add_argument("--before-ref")
    p.add_argument("--after-graph"); p.add_argument("--after-ref")
    p.add_argument("--disposition-manifest")
    a = p.parse_args(); root = Path(a.repo_root).resolve(strict=True)
    pf = preflight(root, a.expected_workspace_id) if a.expected_workspace_id else preflight(root)
    stray = [flag for flag, value in (("--assignee", a.assignee), ("--labels", a.labels)) if value is not None]
    if a.op != "update" and stray:
        raise ContractError(f"{', '.join(stray)} is accepted only by --op update")
    if a.op not in {"create", "update"} and a.priority is not None:
        raise ContractError("--priority is accepted only by --op create or --op update")
    create_priority: str | None = None
    if a.op == "create" and a.priority is not None:
        if a.projection_manifest:
            raise ContractError("create --priority cannot be combined with --projection-manifest")
        create_priority = _normalize_priority(a.priority)
    if a.dry_run and a.op in MUTATIONS:
        preview: dict[str, Any] = {k: v for k, v in vars(a).items() if v is not None and k != "dry_run"}
        if create_priority is not None:
            preview["priority"] = create_priority
        if a.op == "create" and a.projection_manifest:
            feature, children, source_digest = _validate_projection(_load_manifest(a.projection_manifest, root, label="projection") or {})
            preview["projection"] = {
                "feature": feature["graph_node_id"],
                "issue_type": "epic",
                "children": [{"graph_node_id": row["graph_node_id"], "phase_ref": row["phase_ref"], "issue_type": "task"} for row in children],
                "dependency_type": "blocks",
                "source_digest": source_digest,
                "write_count": 0,
                "registration": _registration_status(root, [feature["graph_node_id"], *(str(row["graph_node_id"]) for row in children)]),
            }
        elif a.op == "create" and a.graph_node_id:
            # preview でも同じ判定を通すが、raise ではなく payload へ載せる。dry-run は
            # 「今 apply したらどうなるか」を返す観測であって書込ではないので、未登録を
            # 理由に落とすと、C02 登録を同一 run の前段に持つ skill (C14 decompose) の
            # 全体 dry-run が原理的に通らなくなる。判定は registered / unregistered
            # として receipt に残るので、素通しにはならない。
            preview["registration"] = _registration_status(root, [a.graph_node_id])
        if a.op == "update":
            # preview でも同じ受理判定を通し、不正な update 要求を書込前に落とす。
            _, preview["applied_fields"], normalized_preview = _update_argv(a)
            preview.update(normalized_preview)
        if a.op == "close" and a.artifact_kind == "feature":
            manifest = _load_manifest(a.feature_rollup_manifest, root, label="feature rollup")
            if not a.bd_issue_id or manifest is None: raise ContractError("feature close dry-run requires issue and rollup manifest")
            preview["feature_rollup"] = _verify_feature_rollup(manifest, a.bd_issue_id)
        dump({"op": a.op, "dry_run_preview": preview, **pf}); return 0
    issue = a.bd_issue_id
    applied_fields: list[str] = []
    if a.op == "create":
        projection = _load_manifest(a.projection_manifest, root, label="projection")
        if projection:
            result = _package_projection(root, projection)
        else:
            if not a.graph_node_id or not a.title: raise ContractError("create requires --graph-node-id and --title")
            registration = _require_registered_nodes(root, [a.graph_node_id])
            result = _create_one(root, graph_node_id=a.graph_node_id, title=a.title, description=a.description or "", issue_type="epic" if a.artifact_kind == "feature" else "task", priority=create_priority)
            result = {**result, "registration": registration}
    elif a.op in {"update", "close", "claim", "show"}:
        if not issue: raise ContractError(f"{a.op} requires --bd-issue-id")
        shown = bd(["show", issue, "--json"], cwd=root)
        current = _issue(shown, issue)
        edge_parity = verify_parity(current, a.expected_status, a.expected_depends_on) if a.verify_parity else None
        if a.op == "update":
            flags, applied_fields, _ = _update_argv(a)
            result = bd(["update", issue, *flags, "--json"], cwd=root)
        elif a.op == "close":
            rollup = None
            current_type = current.get("issue_type") or current.get("type")
            if a.artifact_kind == "feature" or current_type == "epic":
                manifest = _load_manifest(a.feature_rollup_manifest, root, label="feature rollup")
                if manifest is None: raise ContractError("feature close requires --feature-rollup-manifest")
                rollup = _verify_feature_rollup(manifest, issue)
            result = {"id": issue, "idempotent": True, "status": "closed"} if current.get("status") == "closed" else bd(["close", issue, "--reason", a.reason or "dev-graph completion", "--json"], cwd=root)
            if rollup is not None: result = {"epic": result, "feature_rollup": rollup}
        elif a.op == "claim":
            result = {"id": issue, "idempotent": True, "status": "in_progress"} if current.get("status") == "in_progress" else bd(["update", issue, "--claim", "--json"], cwd=root)
        else: result = current
        if edge_parity is not None: result = {"issue": result, "edge_parity": edge_parity}
    elif a.op in {"dep-add", "dep-remove"}:
        if not issue or not a.depends_on: raise ContractError(f"{a.op} requires issue and depends-on")
        existing = _issue(bd(["show", issue, "--json"], cwd=root), issue)
        deps = existing.get("dependencies", [])
        present = any((x.get("id") if isinstance(x, dict) else x) == a.depends_on for x in deps)
        if a.op == "dep-add":
            result = {"idempotent": True} if present else bd(["dep", "add", issue, a.depends_on, "--json"], cwd=root)
        else:
            result = bd(["dep", "remove", issue, a.depends_on, "--json"], cwd=root) if present else {"idempotent": True}
    elif a.op == "ready":
        manifest = _load_manifest(a.parity_manifest, root, label="parity")
        result = _ready_with_parity(root, bd(["ready", "--json"], cwd=root), manifest)
    elif a.op == "orphan-audit":
        result = _orphan_audit(root, scan_refs=a.scan_refs)
    elif a.op == "removal-preflight":
        result = _removal_preflight(
            root,
            before_graph=a.before_graph,
            before_ref=a.before_ref,
            after_graph=a.after_graph,
            after_ref=a.after_ref,
            disposition_manifest=_load_manifest(
                a.disposition_manifest, root, label="removal disposition"
            ),
        )
    elif a.op == "github-push": result = bd(["github", "sync", "--push-only", "--json"], cwd=root)
    elif a.op in {"gate-add", "gate-check"}:
        if not issue or not a.pr: raise ContractError("gate operation requires issue and --pr")
        gates = _rows(bd(["gate", "list", "--all", "--json"], cwd=root, check=False))
        blocked = _issue(bd(["show", issue, "--json"], cwd=root), issue)
        dependency_gate_ids = {
            str(dependency.get("id"))
            for dependency in blocked.get("dependencies", [])
            if isinstance(dependency, dict) and dependency.get("dependency_type") == "blocks"
        }
        matching = [
            gate
            for gate in gates
            if str(gate.get("await_id") or gate.get("awaitId")) == str(a.pr)
            and (
                gate.get("blocks") == issue
                or gate.get("blocked_issue_id") == issue
                or str(gate.get("id")) in dependency_gate_ids
            )
            and (gate.get("gate_type") or gate.get("type") or gate.get("await_type")) == "gh:pr"
        ]
        if len(matching) > 1: raise ContractError("duplicate gh:pr gates for issue and PR")
        if a.op == "gate-add":
            result = {"gate": matching[0], "idempotent": True} if matching else bd(["gate", "create", "--type", "gh:pr", "--blocks", issue, "--await-id", str(a.pr), "--reason", a.reason or f"PR #{a.pr} merge", "--json"], cwd=root)
        else:
            if not matching: raise ContractError("gh:pr gate does not exist")
            checked = bd(["gate", "check", "--type", "gh:pr", "--json"], cwd=root)
            result = {"gate": matching[0], "checked": checked}
    payload = {"op": a.op, "result": result, "workspace_identity": pf["workspace_identity"], "bd_version": pf["version"]}
    # 転送した field を receipt に載せ、「呼んだが反映されていない」を呼び出し側から検証可能にする。
    if a.op == "update":
        payload["applied_fields"] = applied_fields
    if a.op == "ready" and isinstance(result, dict):
        payload.update({key: result[key] for key in ("ready_set", "unmapped", "unmapped_summary", "conflicts", "candidate_count", "parity_provenance")})
    # ready と同じく、集計を receipt の top-level にも出す。orphans[] を数え直さないと
    # 件数が分からない形にすると、下流と人間が「全部見た」を確認できない。
    if a.op == "orphan-audit" and isinstance(result, dict):
        payload.update({key: result[key] for key in ("orphans", "orphan_summary", "graph_node_count", "dev_graph_reference_count", "scanned_refs")})
    if a.op == "removal-preflight" and isinstance(result, dict):
        payload.update(
            {
                key: result[key]
                for key in (
                    "allowed",
                    "write_count",
                    "before_node_count",
                    "after_node_count",
                    "removed_node_count",
                    "removed_nodes",
                    "disposition_exact_set",
                    "decisions",
                    "blockers",
                    "orphan_audit",
                )
            }
        )
    dump(payload)
    return 2 if a.op == "removal-preflight" and not result["allowed"] else 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except ContractError as exc: print(str(exc), file=sys.stderr); raise SystemExit(1)
