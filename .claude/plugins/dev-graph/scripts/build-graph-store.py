#!/usr/bin/env python3
# /// script
# name: build-graph-store
# purpose: Create the canonical empty graph store through one validated, atomic, non-destructive writer.
# inputs: ["argv: --repo-root PATH [--dry-run]"]
# outputs: ["stdout: JSON initialization receipt"]
# requires-python = ">=3.10"
# dependencies: ["validate-graph-schema.py", "node_transaction.py", "_common.py", "../lib/graph_envelope.py"]
# contexts: [A, C, E]
# network: false
# write-scope: the caller repository .dev-graph/state/graph.json only
# ///
"""Bootstrap ``.dev-graph/state/graph.json`` without bypassing the C10 guard.

The node writer intentionally requires an existing graph.  Initialization therefore
needs a smaller writer whose only legal transition is "missing -> canonical empty
store".  Existing valid stores are preserved byte-for-byte; malformed or foreign
stores fail closed instead of being repaired implicitly.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "lib"))

from _common import ContractError, atomic_json, contained, dump, load_json  # noqa: E402
from graph_envelope import (  # noqa: E402
    CANONICAL_GRAPH_KEYS,
    SCHEMA_VERSION,
    envelope_violations,
)
from node_transaction import graph_operation_lock  # noqa: E402

CONFIG_RELATIVE = Path(".dev-graph") / "config.json"
GRAPH_RELATIVE = Path(".dev-graph") / "state" / "graph.json"

_spec = importlib.util.spec_from_file_location(
    "_dev_graph_store_validator",
    HERE / "validate-graph-schema.py",
)
assert _spec and _spec.loader
_validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_validator)


def _digest(document: dict[str, Any]) -> str:
    encoded = json.dumps(
        document,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _repository_id(root: Path) -> str:
    config_path = contained(root / CONFIG_RELATIVE, root, must_exist=True)
    config = load_json(config_path)
    if not isinstance(config, dict):
        raise ContractError(f"repo config must be an object: {config_path}")
    repository_id = config.get("repository_id")
    if not isinstance(repository_id, str) or not repository_id:
        raise ContractError("repo config omits repository_id")
    configured_graph = (config.get("local_state") or {}).get("graph")
    if configured_graph != GRAPH_RELATIVE.as_posix():
        raise ContractError(
            "repo config local_state.graph must name the canonical "
            f"{GRAPH_RELATIVE.as_posix()}"
        )
    return repository_id


def _canonical_empty(repository_id: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "repository_id": repository_id,
        "graph_revision": 0,
        "nodes": [],
    }


def _validate_existing(
    document: Any,
    *,
    root: Path,
    repository_id: str,
) -> list[str]:
    """既存 store の envelope と nodes[] を順に検査する。

    envelope 判定は `graph_envelope` の単一定義へ委譲する。同じ 4 key 契約を init・C11・
    PostToolUse 監査が各自で書き写すと、片方だけ緩んだときに store 側の検査層が静かに
    穴を開ける (HarnessHub-kzth の遮断できない範囲を埋める層がこれに当たる)。
    """
    violations = envelope_violations(document, repository_id=repository_id)
    if violations:
        return violations
    return [
        json.dumps(item, ensure_ascii=False, sort_keys=True)
        for item in _validator.validate(document["nodes"], repo_root=root)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(args.repo_root).expanduser().resolve(strict=True)
    repository_id = _repository_id(root)
    graph_path = contained(root / GRAPH_RELATIVE, root, must_exist=False)
    graph_path.parent.mkdir(parents=True, exist_ok=True)

    with graph_operation_lock(graph_path, exclusive=True):
        if graph_path.exists():
            existing = load_json(graph_path)
            violations = _validate_existing(
                existing,
                root=root,
                repository_id=repository_id,
            )
            if violations:
                dump(
                    {
                        "graph": str(graph_path),
                        "action": "rejected_existing",
                        "changed": False,
                        "valid": False,
                        "violations": violations,
                    }
                )
                return 1
            document = existing
            action = "preserved_existing"
            changed = False
        else:
            document = _canonical_empty(repository_id)
            action = "would_create" if args.dry_run else "created"
            changed = not args.dry_run
            if not args.dry_run:
                atomic_json(graph_path, document)

    dump(
        {
            "graph": str(graph_path),
            "repository_id": repository_id,
            "action": action,
            "changed": changed,
            "dry_run": args.dry_run,
            "valid": True,
            "violations": [],
            "graph_revision": document["graph_revision"],
            "digest": _digest(document),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ContractError, OSError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
