#!/usr/bin/env python3
# /// script
# name: build-decompose-promotion-patch
# purpose: Build and verify the C14 live-trial feature-promotion patch against the final node shape.
# inputs: ["argv: build|verify --repo-root DIR --node-id ID ..."]
# outputs: ["build: one contained JSON patch", "verify: JSON receipt on stdout"]
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: build --output path inside --repo-root only
# ///
"""C14 live-trial の feature 昇格 patch を決定論的に作る。

`confirmation_evidence.evaluated_digest` は、昇格後の最終 node から
`confirmation_evidence` だけを除いた正準 JSON へ束縛する。graph 自体は一切書かず、
適用は C02 `upsert-node.py` が担う。
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import audit_decompose_integrity as integrity


class PatchError(RuntimeError):
    pass


def _load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise PatchError(f"object required: {path}")
    return value


def _contained(path: Path, root: Path) -> Path:
    resolved = path.resolve(strict=False)
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise PatchError(f"path escapes repo root: {path}") from exc
    return resolved


def _graph(root: Path) -> dict[str, Any]:
    config = _load_object(root / ".dev-graph" / "config.json")
    relative = (config.get("local_state") or {}).get("graph")
    if not isinstance(relative, str) or not relative:
        raise PatchError("config.local_state.graph must be a non-empty string")
    return _load_object(_contained(root / relative, root))


def _node(document: dict[str, Any], node_id: str) -> dict[str, Any]:
    matches = [
        node for node in document.get("nodes", [])
        if isinstance(node, dict) and node.get("graph_node_id") == node_id
    ]
    if len(matches) != 1:
        raise PatchError(f"feature node must exist exactly once: {node_id}")
    if matches[0].get("artifact_kind") != "feature":
        raise PatchError(f"promotion target must be feature: {node_id}")
    return matches[0]


def build_patch(
    node: dict[str, Any], *, checked_at: str, evaluator: str, evidence_ref: str
) -> dict[str, Any]:
    patch: dict[str, Any] = {
        "status": "active",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "updated_at": checked_at,
        "implementation_readiness": {
            "status": "complete",
            "missing_sections": [],
            "checked_at": checked_at,
        },
    }
    candidate = {**node, **patch}
    patch["confirmation_evidence"] = {
        "evaluator": evaluator,
        "evidence_ref": evidence_ref,
        "evaluated_digest": integrity.evaluation_digest(candidate),
    }
    return {"graph_node_id": node["graph_node_id"], "patch": patch}


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temp.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="operation", required=True)
    build = sub.add_parser("build")
    verify = sub.add_parser("verify")
    for command in (build, verify):
        command.add_argument("--repo-root", required=True)
        command.add_argument("--node-id", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--checked-at", required=True)
    build.add_argument("--evaluator", required=True)
    build.add_argument("--evidence-ref", required=True)
    args = parser.parse_args(argv)

    try:
        root = Path(args.repo_root).resolve(strict=True)
        node = _node(_graph(root), args.node_id)
        if args.operation == "build":
            raw_output = Path(args.output)
            output = _contained(raw_output if raw_output.is_absolute() else root / raw_output, root)
            payload = build_patch(
                node,
                checked_at=args.checked_at,
                evaluator=args.evaluator,
                evidence_ref=args.evidence_ref,
            )
            _atomic_json(output, payload)
            print(json.dumps({"status": "built", "output": str(output), **payload}, ensure_ascii=False))
            return 0

        evidence = node.get("confirmation_evidence") or {}
        declared = evidence.get("evaluated_digest") if isinstance(evidence, dict) else None
        expected = integrity.evaluation_digest(node)
        receipt = {
            "status": "pass" if declared == expected else "fail",
            "graph_node_id": args.node_id,
            "declared_digest": declared,
            "expected_digest": expected,
            "matches": declared == expected,
        }
        print(json.dumps(receipt, ensure_ascii=False, sort_keys=True, indent=2))
        return 0 if receipt["matches"] else 2
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError, PatchError) as exc:
        print(json.dumps({"status": "fail", "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
