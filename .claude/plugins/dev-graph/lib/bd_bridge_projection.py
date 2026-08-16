"""graph node → Beads issue の投影 (単体起票・exact-13 package・feature rollup)。

bridge の「書く側」のうち、**graph の形を Beads の形へ写す**責務をここへ集める。
冪等性 (同じ node を二度起票しない) と exact-13 の構造検証がこの module の中心で、
棚卸し・削除 gate といった read-only の検査は ``bd_bridge_audit`` が持つ。

bd の実行関数は ``bd=`` で受け取る。module 内へ直接束縛しないのは、呼び出し側
(scripts/bd-bridge.py) の module 変数 ``bd`` を呼び出し時に解決させるため
(test の monkeypatch がそこを差し替える)。

正本契約: references/execution-tracker-contract.md
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Callable

_SCRIPTS_DIR = str(Path(__file__).resolve().parents[1] / "scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from _common import ContractError  # noqa: E402

from bd_bridge_contracts import (  # noqa: E402
    PHASES,
    SHA256,
    dependency_ids,
    external_ref,
    issue_row,
    normalize_priority,
    rows,
    verify_parity,
)
from bd_bridge_graph import require_registered_nodes  # noqa: E402


def find_external(root: Path, graph_node_id: str, *, bd: Callable[..., Any]) -> dict[str, Any] | None:
    # bd 1.1.0 の search は --external-contains を解さずヘルプ文を返すため、
    # 素の text query (external_ref にもマッチ) → list --status all の順で引き完全一致で絞る。
    found = rows(bd(["search", graph_node_id, "--status", "all", "--json"], cwd=root, check=False))
    exact = [row for row in found if external_ref(row) == graph_node_id]
    if not exact:
        found = rows(bd(["list", "--status", "all", "--limit", "10000", "--json"], cwd=root, check=False))
        exact = [row for row in found if external_ref(row) == graph_node_id]
    if len(exact) > 1:
        raise ContractError(f"duplicate beads external_ref for {graph_node_id}")
    return exact[0] if exact else None


def create_one(
    root: Path,
    *,
    bd: Callable[..., Any],
    graph_node_id: str,
    title: str,
    description: str,
    issue_type: str,
    priority: str | None = None,
    parent: str | None = None,
    source_digest: str | None = None,
) -> dict[str, Any]:
    if source_digest is not None and SHA256.fullmatch(source_digest) is None:
        raise ContractError("projection source_digest must be sha256:<64 lowercase hex>")
    projected_description = description
    if source_digest is not None:
        projected_description = f"{description.rstrip()}\n\ndev_graph_source_digest: {source_digest}"
    existing = find_external(root, graph_node_id, bd=bd)
    if existing:
        # search/list の row は parent と issue_type を持たないため show で詳細を取り直す。
        existing_id = str(existing.get("id"))
        detail = issue_row(bd(["show", existing_id, "--json"], cwd=root), existing_id)
        actual_type = detail.get("issue_type") or detail.get("type")
        if actual_type and actual_type != issue_type:
            raise ContractError(f"existing {graph_node_id} has type {actual_type}, expected {issue_type}")
        actual_parent = detail.get("parent") or detail.get("parent_id")
        if parent and str(actual_parent) != parent:
            raise ContractError(f"existing {graph_node_id} belongs to a different epic")
        metadata = detail.get("metadata") if isinstance(detail.get("metadata"), dict) else {}
        current_digest = metadata.get("dev_graph_source_digest")
        if not current_digest:
            match = re.search(r"dev_graph_source_digest:\s*(sha256:[0-9a-f]{64})", str(detail.get("description", "")))
            current_digest = match.group(1) if match else None
        if source_digest is not None and current_digest != source_digest:
            argv = [
                "update", existing_id, "--title", title,
                "--description", projected_description,
                "--set-metadata", f"dev_graph_source_digest={source_digest}",
            ]
            if parent:
                argv += ["--parent", parent]
            if str(detail.get("status")) == "closed":
                argv += ["--status", "open"]
            argv += ["--json"]
            updated = bd(argv, cwd=root)
            return {
                "id": existing_id, "external_ref": graph_node_id,
                "superseded": True, "source_digest": source_digest, "updated": updated,
            }
        return {"id": existing_id, "external_ref": graph_node_id, "idempotent": True}
    argv = [
        "create", "--title", title, "--description", projected_description,
        "--external-ref", f"dev-graph:{graph_node_id}", "--type", issue_type,
    ]
    if priority is not None:
        argv += ["--priority", normalize_priority(priority)]
    if parent:
        argv += ["--parent", parent]
    if source_digest is not None:
        argv += ["--metadata", json.dumps({"dev_graph_source_digest": source_digest}, sort_keys=True)]
    argv += ["--json"]
    created = bd(argv, cwd=root)
    created_rows = rows(created)
    issue_id = (created.get("id") if isinstance(created, dict) else None) or (created_rows[0].get("id") if created_rows else None)
    if not issue_id:
        raise ContractError(f"bd create did not return an id for {graph_node_id}")
    return {"id": issue_id, "external_ref": graph_node_id, "created": created}


def validate_projection(manifest: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    feature = manifest.get("feature")
    children = manifest.get("children")
    if not isinstance(feature, dict) or not isinstance(children, list) or not all(isinstance(row, dict) for row in children):
        raise ContractError("projection manifest requires feature object and children array")
    source_digest = manifest.get("source_digest")
    if not isinstance(source_digest, str) or SHA256.fullmatch(source_digest) is None:
        raise ContractError("projection manifest requires source_digest=sha256:<64 lowercase hex>")
    feature_id = feature.get("graph_node_id")
    if not isinstance(feature_id, str) or not feature_id:
        raise ContractError("projection feature requires graph_node_id")
    phases = [row.get("phase_ref") for row in children]
    child_ids = [row.get("graph_node_id") for row in children]
    if len(children) != 13 or phases != PHASES or len(set(child_ids)) != 13 or any(not isinstance(value, str) or not value for value in child_ids):
        raise ContractError("projection children must be the ordered P01..P13 exact-set with unique graph_node_id")
    if any(row.get("parent_feature") != feature_id for row in children):
        raise ContractError("projection children must share the feature parent")
    id_set = set(child_ids)
    for row in children:
        dependencies = row.get("depends_on", [])
        if not isinstance(dependencies, list) or any(dep not in id_set for dep in dependencies):
            raise ContractError("projection child dependency escapes the exact-13 package")
    return feature, children, source_digest


def package_projection(root: Path, manifest: dict[str, Any], *, bd: Callable[..., Any]) -> dict[str, Any]:
    feature, children, source_digest = validate_projection(manifest)
    feature_id = feature["graph_node_id"]
    # 14 件を 1 件でも書き始める前に全数の実在を確かめる。途中で落とすと epic だけ
    # dangling reference で残り、再実行の冪等経路 (find_external) がそれを拾って
    # 「登録済み」に見せてしまう。
    registration = require_registered_nodes(root, [feature_id, *(str(row["graph_node_id"]) for row in children)])

    epic = create_one(
        root,
        bd=bd,
        graph_node_id=feature_id,
        title=str(feature.get("title") or feature_id),
        description=str(feature.get("description") or "dev-graph feature projection"),
        issue_type="epic",
        source_digest=source_digest,
    )
    projected: list[dict[str, Any]] = []
    issue_ids: dict[str, str] = {}
    for row in children:
        projected_row = create_one(
            root,
            bd=bd,
            graph_node_id=row["graph_node_id"],
            title=str(row.get("title") or f"{row['phase_ref']} {row['graph_node_id']}"),
            description=str(row.get("description") or f"dev-graph {row['phase_ref']} projection"),
            issue_type="task",
            parent=str(epic["id"]),
            source_digest=source_digest,
        )
        projected_row["phase_ref"] = row["phase_ref"]
        projected.append(projected_row)
        issue_ids[row["graph_node_id"]] = str(projected_row["id"])
    edges: list[dict[str, Any]] = []
    for row in children:
        issue_id = issue_ids[row["graph_node_id"]]
        expected_dependencies = {issue_ids[dependency] for dependency in row.get("depends_on", [])}
        current = issue_row(bd(["show", issue_id, "--json"], cwd=root), issue_id)
        actual_dependencies = dependency_ids(current)
        package_issue_ids = set(issue_ids.values())
        for dependency_id in sorted((actual_dependencies & package_issue_ids) - expected_dependencies):
            result = bd(["dep", "remove", issue_id, dependency_id, "--json"], cwd=root)
            edges.append({"issue_id": issue_id, "depends_on": dependency_id, "operation": "removed", "result": result})
        for dependency_id in sorted(expected_dependencies - actual_dependencies):
            result = bd(["dep", "add", issue_id, dependency_id, "--type", "blocks", "--json"], cwd=root)
            edges.append({"issue_id": issue_id, "depends_on": dependency_id, "operation": "added", "result": result})
        for dependency_id in sorted(expected_dependencies & actual_dependencies):
            edges.append({"issue_id": issue_id, "depends_on": dependency_id, "idempotent": True})
    parity: list[dict[str, Any]] = []
    for row in children:
        issue_id = issue_ids[row["graph_node_id"]]
        current = issue_row(bd(["show", issue_id, "--json"], cwd=root), issue_id)
        expected_edges = [issue_ids[dependency] for dependency in row.get("depends_on", [])]
        parity.append({
            "graph_node_id": row["graph_node_id"],
            "bd_issue_id": issue_id,
            "edge_parity": verify_parity(current, current.get("status"), expected_edges),
        })
    return {
        "feature_epic": epic,
        "children": projected,
        "edges": edges,
        "parity": parity,
        "phase_refs": PHASES,
        "expected_count": 13,
        "applied_count": len(projected),
        "source_digest": source_digest,
        "registration": registration,
    }


def verify_feature_rollup(manifest: dict[str, Any], issue_id: str) -> dict[str, Any]:
    if str(manifest.get("epic_bd_issue_id")) != issue_id:
        raise ContractError("feature rollup epic identity mismatch")
    children = manifest.get("children")
    if not isinstance(children, list) or len(children) != 13 or not all(isinstance(row, dict) for row in children):
        raise ContractError("feature rollup requires exact 13 children")
    phases = [row.get("phase_ref") for row in children]
    if phases != PHASES or any(row.get("status") != "closed" for row in children):
        raise ContractError("feature rollup requires closed P01..P13 exact-set")
    return {"eligible": True, "phase_refs": phases, "closed_count": 13}
