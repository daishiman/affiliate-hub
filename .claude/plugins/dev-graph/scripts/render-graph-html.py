#!/usr/bin/env python3
# /// script
# name: render-graph-html
# purpose: Deterministically render a validated dev-graph scope as dependency-free static HTML/SVG.
# inputs: ["argv: --repo-root PATH --graph FILE [--scope ID] [--registration-receipt FILE] [--out FILE]"]
# outputs: ["file: repository-contained static HTML", "stdout: JSON renderer receipt"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: one repository-contained HTML output
# ///
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from _common import ContractError, contained, dump, run
from node_transaction import ensure_no_pending_transaction, graph_operation_lock


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _repo_root(source: Path, explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve(strict=True)
    cp = run(["git", "-C", str(source.parent), "rev-parse", "--show-toplevel"], check=False)
    if cp.returncode == 0 and cp.stdout.strip():
        return Path(cp.stdout.strip()).resolve(strict=True)
    # Backward-compatible direct use for a self-contained non-Git fixture.
    return source.parent.resolve(strict=True)


def _scope_nodes(nodes: list[dict[str, Any]], scope: str | None) -> list[dict[str, Any]]:
    by_id = {str(node.get("graph_node_id") or node.get("id")): node for node in nodes}
    if len(by_id) != len(nodes) or "None" in by_id:
        raise ContractError("graph nodes require unique IDs")
    if scope is None:
        return list(nodes)
    if scope not in by_id:
        raise ContractError(f"unknown --scope graph node: {scope}")
    descendants = {scope}
    changed = True
    while changed:
        changed = False
        for node_id, node in by_id.items():
            if node.get("parent_feature") in descendants and node_id not in descendants:
                descendants.add(node_id)
                changed = True
    selected = set(descendants)
    changed = True
    while changed:
        changed = False
        for node_id, node in by_id.items():
            deps = node.get("depends_on", [])
            if not isinstance(deps, list) or any(not isinstance(dep, str) for dep in deps):
                raise ContractError(f"{node_id}: depends_on must be a string array")
            if node_id in selected:
                parent = node.get("parent_feature")
                if parent is not None:
                    if parent not in by_id:
                        raise ContractError(f"dangling parent_feature references: {[parent]}")
                    if parent not in selected:
                        selected.add(parent)
                        changed = True
                for dependency in deps:
                    if dependency not in by_id:
                        raise ContractError(f"dangling dependencies: {[dependency]}")
                    if dependency not in selected:
                        selected.add(dependency)
                        changed = True
    return [node for node in nodes if str(node.get("graph_node_id") or node.get("id")) in selected]


def _registration(
    root: Path,
    receipt_arg: str | None,
    scope: str | None,
    nodes: list[dict[str, Any]],
    graph_sha: str,
) -> dict[str, Any] | None:
    if not receipt_arg:
        return None
    candidate = Path(receipt_arg)
    candidate = candidate if candidate.is_absolute() else root / candidate
    receipt_path = contained(candidate, root, must_exist=True)
    try:
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ContractError(f"invalid registration receipt: {exc}") from exc
    if not isinstance(receipt, dict):
        raise ContractError("registration receipt must be an object")
    required = {"parent_feature", "source_digest", "expected_count", "applied_count", "node_ids", "graph_digest_after"}
    missing = sorted(required - receipt.keys())
    if missing:
        raise ContractError(f"registration receipt missing fields: {missing}")
    if receipt["expected_count"] != receipt["applied_count"]:
        raise ContractError("registration receipt expected_count/applied_count disagree")
    parent = receipt["parent_feature"]
    if scope is not None and scope != parent:
        raise ContractError("--scope and registration receipt parent_feature disagree")
    digest = str(receipt["source_digest"])
    if not digest.startswith("sha256:") or len(digest) != 71:
        raise ContractError("registration receipt source_digest is invalid")
    child_nodes = [node for node in nodes if node.get("parent_feature") == parent]
    child_ids = sorted(str(node.get("graph_node_id") or node.get("id")) for node in child_nodes)
    if child_ids != sorted(str(value) for value in receipt["node_ids"]):
        raise ContractError("rendered feature children do not match registration receipt node_ids")
    if len(child_nodes) != receipt["applied_count"]:
        raise ContractError("rendered feature progress count does not match registration receipt")
    lineage_digest = digest.removeprefix("sha256:")
    if any((node.get("source_lineage") or {}).get("source_digest") != lineage_digest for node in child_nodes):
        raise ContractError("rendered nodes do not match registration receipt source_digest")
    # node_ids/applied_count/source_digest/source_lineage above are the authoritative
    # registration checks; graph_digest_after is bound to the graph revision at
    # registration time and is routinely advanced by a later sync, so a mismatch here
    # is reported as a stale partial match rather than fail-closed (HarnessHub-0ui0).
    graph_digest_match = receipt["graph_digest_after"] == f"sha256:{graph_sha}"
    return {
        "path": receipt_path.relative_to(root).as_posix(),
        "parent_feature": parent,
        "source_digest": digest,
        "expected_count": receipt["expected_count"],
        "applied_count": receipt["applied_count"],
        "graph_digest_match": graph_digest_match,
    }


def _render_model(nodes: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for raw in nodes:
        if not isinstance(raw, dict):
            raise ContractError("each node must be an object")
        node_id = raw.get("graph_node_id") or raw.get("id")
        if not isinstance(node_id, str) or not node_id:
            raise ContractError("node id is required")
        parent_feature = raw.get("parent_feature")
        if parent_feature is not None and not isinstance(parent_feature, str):
            raise ContractError("parent_feature must be a string when present")
        dependencies = raw.get("depends_on", [])
        if not isinstance(dependencies, list) or any(not isinstance(dep, str) for dep in dependencies):
            raise ContractError("depends_on must be a string array")
        normalized.append({
            "id": node_id,
            "title": str(raw.get("title", node_id)),
            "status": str(raw.get("status", "draft")),
            "kind": str(raw.get("artifact_kind", raw.get("kind", "task"))),
            "depends_on": sorted(dependencies),
            "parent_feature": parent_feature,
        })
    normalized.sort(key=lambda item: item["id"])
    ids = {item["id"] for item in normalized}
    dangling = sorted({dep for item in normalized for dep in item["depends_on"] if dep not in ids})
    if dangling:
        raise ContractError(f"dangling dependencies: {dangling}")
    dangling_parents = sorted({
        item["parent_feature"] for item in normalized
        if item["parent_feature"] and item["parent_feature"] not in ids
    })
    if dangling_parents:
        raise ContractError(f"dangling parent_feature references: {dangling_parents}")
    children: dict[str, list[dict[str, Any]]] = {}
    for item in normalized:
        if item["parent_feature"]:
            children.setdefault(str(item["parent_feature"]), []).append(item)
    for item in normalized:
        feature_children = children.get(item["id"], []) if item["kind"] == "feature" else []
        item["progress"] = (
            {"done": sum(child["status"] in {"done", "closed"} for child in feature_children), "total": len(feature_children)}
            if feature_children else None
        )
    by_feature = {
        str(item["id"]): item["progress"] or {"done": 0, "total": 0}
        for item in normalized if item["kind"] == "feature"
    }
    progress = {
        "aggregate": {
            "done": sum(item["done"] for item in by_feature.values()),
            "total": sum(item["total"] for item in by_feature.values()),
        },
        "by_feature": by_feature,
    }
    return normalized, progress


def _render(args: argparse.Namespace, source: Path, root: Path) -> int:
    ensure_no_pending_transaction(source)
    raw_out = Path(args.out) if args.out else Path(".dev-graph/render/index.html")
    raw_out = raw_out if raw_out.is_absolute() else root / raw_out
    out = contained(raw_out, root, must_exist=False)
    if source == out:
        raise ContractError("output must not overwrite graph input")

    input_bytes = source.read_bytes()
    try:
        data = json.loads(input_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"invalid JSON {source}: {exc}") from exc
    input_sha256 = _sha(input_bytes)
    all_nodes = data.get("nodes", []) if isinstance(data, dict) else data
    if not isinstance(all_nodes, list):
        raise ContractError("graph nodes must be an array")
    selected_nodes = _scope_nodes(all_nodes, args.scope)
    canonical_graph_digest = _sha(
        json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    registration = _registration(root, args.registration_receipt, args.scope, selected_nodes, canonical_graph_digest)
    if registration is None:
        registration_verification = {
            "status": "not_performed",
            "reason": "registration_receipt_not_provided",
            "graph_digest_match": None,
        }
    elif registration["graph_digest_match"]:
        registration_verification = {"status": "verified", "reason": None, "graph_digest_match": True}
    else:
        registration_verification = {
            "status": "partial",
            "reason": "graph_digest_stale",
            "graph_digest_match": "stale",
        }
    normalized, feature_progress = _render_model(selected_nodes)

    width, row_height = 1000, 72
    height = max(160, 80 + len(normalized) * row_height)
    y = {node["id"]: 60 + index * row_height for index, node in enumerate(normalized)}
    lines = [
        f'<path d="M 360 {y[dependency]} C 500 {y[dependency]}, 500 {y[node["id"]]}, 640 {y[node["id"]]}"/>'
        for node in normalized for dependency in node["depends_on"]
    ]
    cards = []
    for node in normalized:
        safe_id = html.escape(str(node["id"]))
        safe_title = html.escape(str(node["title"]))
        progress = node["progress"]
        progress_label = f' · {progress["done"]}/{progress["total"]}' if progress else ""
        cards.append(
            f'<g class="node status-{html.escape(str(node["status"]))}" data-id="{safe_id}" data-text="{safe_title.lower()}">'
            f'<rect x="40" y="{y[node["id"]]-24}" width="320" height="48" rx="8"/>'
            f'<text x="54" y="{y[node["id"]]-3}">{safe_id}</text>'
            f'<text class="title" x="54" y="{y[node["id"]]+15}">{safe_title}</text>'
            f'<rect x="640" y="{y[node["id"]]-18}" width="220" height="36" rx="18"/>'
            f'<text x="660" y="{y[node["id"]]+5}">{html.escape(str(node["status"]))} · '
            f'{html.escape(str(node["kind"]))}{progress_label}</text></g>'
        )
    payload = json.dumps(normalized, ensure_ascii=False, sort_keys=True).replace("<", "\\u003c")
    metadata = json.dumps({
        "scope": args.scope,
        "registration": registration,
        "registration_verification": registration_verification,
    }, ensure_ascii=False, sort_keys=True).replace("<", "\\u003c")
    if registration is None:
        verification_detail = "No registration receipt was provided; counts and source digest were not verified."
    elif registration_verification["status"] == "verified":
        verification_detail = (
            f'{registration["applied_count"]}/{registration["expected_count"]} nodes; '
            f'source {registration["source_digest"]}'
        )
    else:
        verification_detail = (
            f'{registration["applied_count"]}/{registration["expected_count"]} nodes; '
            f'source {registration["source_digest"]}; '
            'graph digest is stale (a later sync advanced the graph past registration)'
        )
    verification_banner = (
        f'<aside id="registration-verification" '
        f'class="registration-{html.escape(registration_verification["status"])}" '
        f'data-status="{html.escape(registration_verification["status"])}">'
        f'<strong>Registration verification: '
        f'{html.escape(registration_verification["status"].replace("_", " ").upper())}</strong>'
        f'<span>{html.escape(verification_detail)}</span></aside>'
    )
    document = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>dev-graph</title><style>body{{font:14px system-ui;margin:0;background:#0b1020;color:#e5e7eb}}header{{position:sticky;top:0;padding:16px;background:#111827;z-index:2}}aside{{display:flex;gap:12px;padding:10px 16px;border-bottom:1px solid #475569}}aside span{{color:#cbd5e1}}.registration-verified{{background:#052e16}}.registration-not_performed{{background:#422006}}.registration-partial{{background:#1e1b4b}}input{{padding:8px;width:min(420px,70vw)}}svg{{min-width:{width}px;height:{height}px}}path{{stroke:#64748b;fill:none;stroke-width:2}}.node rect{{fill:#1f2937;stroke:#64748b}}.node text{{fill:#f8fafc}}.node .title{{fill:#cbd5e1;font-size:12px}}.status-done rect,.status-closed rect{{stroke:#22c55e}}.hidden{{display:none}}</style>
<header><strong>dev-graph</strong> <input id="q" aria-label="Filter nodes" placeholder="Filter id/title/status"></header>
{verification_banner}
<svg viewBox="0 0 {width} {height}" role="img" aria-label="Task dependency graph"><g class="edges">{''.join(lines)}</g>{''.join(cards)}</svg>
<script type="application/json" id="graph-data">{payload}</script><script type="application/json" id="render-metadata">{metadata}</script><script>const q=document.querySelector('#q');q.addEventListener('input',()=>{{const s=q.value.toLowerCase();document.querySelectorAll('.node').forEach(n=>n.classList.toggle('hidden',!((n.dataset.id+' '+n.dataset.text+' '+n.className.baseVal).toLowerCase().includes(s))))}});</script></html>'''
    if any(marker in document.casefold() for marker in ('<script src=', '<link ', 'http://', 'https://')):
        raise ContractError("rendered HTML contains an external runtime reference")

    graph_after = source.read_bytes()
    if graph_after != input_bytes:
        raise ContractError("render changed the source graph")
    out.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{out.name}.", dir=out.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(document)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, out)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
    output_sha256 = _sha(out.read_bytes())
    dump({
        "ok": True,
        "out": str(out),
        "out_relative": out.relative_to(root).as_posix(),
        "scope": args.scope,
        "nodes": len(normalized),
        "edges": sum(len(node["depends_on"]) for node in normalized),
        "input_sha256": input_sha256,
        "output_sha256": output_sha256,
        "graph_sha256_before": input_sha256,
        "graph_sha256_after": _sha(graph_after),
        "feature_progress": feature_progress,
        "registration": registration,
        "registration_verification": registration_verification,
        "self_contained": True,
    })
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root")
    parser.add_argument("--graph", required=True)
    parser.add_argument("--scope")
    parser.add_argument("--registration-receipt")
    parser.add_argument("--out")
    args = parser.parse_args()

    raw_source = Path(args.graph).expanduser()
    source = raw_source.resolve(strict=True)
    root = _repo_root(source, args.repo_root)
    contained(source, root, must_exist=True)
    with graph_operation_lock(source, exclusive=False):
        return _render(args, source, root)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ContractError, OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
