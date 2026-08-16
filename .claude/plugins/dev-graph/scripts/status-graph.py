#!/usr/bin/env python3
# /// script
# name: status-graph
# purpose: Query canonical dev-graph nodes and dependencies without mutating graph/content/external trackers.
# inputs: ["argv: --repo-root PATH [filters] [--eval-log FILE]"]
# outputs: ["stdout: JSON status report", "file: optional eval-log JSON receipt"]
# requires-python = ">=3.10"
# dependencies: ["validate-graph-schema.py"]
# contexts: [A, B, C, E]
# network: false
# write-scope: optional eval-log receipt only
# ///
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from _common import ContractError, atomic_json, contained, dump, load_json, repository_eval_root, utc_now
from node_transaction import ensure_no_pending_transaction, graph_operation_lock


def _validator() -> Any:
    path = Path(__file__).with_name("validate-graph-schema.py")
    spec = importlib.util.spec_from_file_location("dev_graph_status_validator", path)
    if not spec or not spec.loader:
        raise ContractError(f"cannot load canonical validator: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _graph(root: Path, explicit: str | None) -> Path:
    if explicit:
        candidate = Path(explicit)
        candidate = candidate if candidate.is_absolute() else root / candidate
    else:
        config = load_json(root / ".dev-graph" / "config.json")
        raw = (config.get("local_state") or {}).get("graph") if isinstance(config, dict) else None
        if not isinstance(raw, str) or not raw:
            raise ContractError(".dev-graph/config.json omits local_state.graph")
        candidate = root / raw
    return contained(candidate, root, must_exist=True)


def _node_id(node: dict[str, Any]) -> str:
    value = node.get("graph_node_id")
    if not isinstance(value, str) or not value:
        raise ContractError("graph node has no graph_node_id")
    return value


def _authority_digest(root: Path, graph_path: Path, nodes: list[dict[str, Any]]) -> str:
    paths = [root / ".dev-graph" / "config.json", graph_path]
    for node in nodes:
        raw = node.get("file_path")
        if isinstance(raw, str):
            paths.append(contained(root / raw, root, must_exist=True))
    digest = hashlib.sha256()
    for path in sorted({item.resolve(strict=True) for item in paths}, key=str):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _matches(node: dict[str, Any], args: argparse.Namespace) -> bool:
    exact = {
        "graph_node_id": args.id,
        "artifact_kind": args.kind,
        "project_id": args.project,
        "domain": args.domain,
        "status": args.status,
    }
    if any(expected is not None and node.get(key) != expected for key, expected in exact.items()):
        return False
    node_tags = set(node.get("tags", [])) if isinstance(node.get("tags"), list) else set()
    requested_tags = set(args.tag)
    if requested_tags:
        if args.tag_match == "all" and not requested_tags <= node_tags:
            return False
        if args.tag_match == "any" and not requested_tags & node_tags:
            return False
    if args.keyword:
        haystack = " ".join(
            [
                str(node.get("graph_node_id", "")),
                str(node.get("title", "")),
                str(node.get("domain", "")),
                " ".join(str(value) for value in node.get("tags", [])),
            ]
        ).casefold()
        if args.keyword.casefold() not in haystack:
            return False
    return True


def _report_locked(args: argparse.Namespace, root: Path, graph_path: Path) -> dict[str, Any]:
    ensure_no_pending_transaction(graph_path)
    before = graph_path.read_bytes()
    data = load_json(graph_path)
    nodes = data.get("nodes") if isinstance(data, dict) else None
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise ContractError("canonical graph must contain nodes[] objects")
    authority_before = _authority_digest(root, graph_path, nodes)
    validator = _validator()
    violations = validator.validate(nodes, repo_root=root)
    if violations:
        raise ContractError(f"canonical graph validation failed: {json.dumps(violations, ensure_ascii=False)}")

    dependents: dict[str, list[str]] = defaultdict(list)
    for node in nodes:
        node_id = _node_id(node)
        for dependency in node.get("depends_on", []):
            dependents[str(dependency)].append(node_id)
    results = []
    for node in sorted((item for item in nodes if _matches(item, args)), key=_node_id):
        node_id = _node_id(node)
        results.append(
            {
                "graph_node_id": node_id,
                "artifact_kind": node.get("artifact_kind"),
                "project_id": node.get("project_id"),
                "domain": node.get("domain"),
                "tags": node.get("tags", []),
                "title": node.get("title"),
                "file_path": node.get("file_path"),
                "status": node.get("status"),
                "closed_at": (node.get("completion_evidence") or {}).get("completed_at"),
                "depends_on": node.get("depends_on", []),
                "dependents": sorted(dependents.get(node_id, [])),
                "parent_feature": node.get("parent_feature"),
                "feature_package_id": node.get("feature_package_id"),
                "tracker_binding": node.get("tracker_binding"),
                "beads_linkage": node.get("beads_linkage"),
                "issue_linkage": node.get("issue_linkage"),
                "execution_contexts": node.get("execution_contexts", []),
            }
        )
    after = graph_path.read_bytes()
    before_digest = hashlib.sha256(before).hexdigest()
    after_digest = hashlib.sha256(after).hexdigest()
    if before_digest != after_digest:
        raise ContractError("status query changed the canonical graph")
    authority_after = _authority_digest(root, graph_path, nodes)
    if authority_before != authority_after:
        raise ContractError("status query changed graph/config/content authority")
    report = {
        "ok": True,
        "read_only": True,
        "graph": graph_path.relative_to(root).as_posix(),
        "graph_sha256_before": before_digest,
        "graph_sha256_after": after_digest,
        "authority_sha256_before": authority_before,
        "authority_sha256_after": authority_after,
        "filters": {
            "id": args.id,
            "kind": args.kind,
            "project": args.project,
            "domain": args.domain,
            "status": args.status,
            "tags": args.tag,
            "tag_match": args.tag_match,
            "keyword": args.keyword,
        },
        "count": len(results),
        "results": results,
        "executed_at": utc_now(),
    }
    if args.eval_log:
        eval_root = repository_eval_root(root)
        target = Path(args.eval_log)
        target = target if target.is_absolute() else root / target
        target = contained(target, eval_root, must_exist=False)
        atomic_json(target, report)
        report["eval_log"] = target.relative_to(root).as_posix()
    return report


def _report(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.repo_root).expanduser().resolve(strict=True)
    graph_path = _graph(root, args.graph)
    with graph_operation_lock(graph_path, exclusive=False):
        return _report_locked(args, root, graph_path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only dev-graph status query")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--graph")
    parser.add_argument("--id")
    parser.add_argument("--kind", choices=("issue", "task", "specification", "architecture", "document", "feature"))
    parser.add_argument("--project")
    parser.add_argument("--domain")
    parser.add_argument("--status")
    parser.add_argument("--tag", action="append", default=[])
    parser.add_argument("--tag-match", choices=("all", "any"), default="all")
    parser.add_argument("--keyword")
    parser.add_argument("--eval-log", default="eval-log/run-dev-graph-status-execution.json")
    parser.add_argument("--no-eval-log", action="store_true")
    args = parser.parse_args(argv)
    if args.no_eval_log:
        args.eval_log = None
    try:
        dump(_report(args))
        return 0
    except (ContractError, OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        dump({"ok": False, "read_only": True, "error": str(exc)})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
