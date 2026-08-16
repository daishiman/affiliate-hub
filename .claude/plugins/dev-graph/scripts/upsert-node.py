#!/usr/bin/env python3
# /// script
# name: upsert-node
# purpose: Atomically add or patch one canonical Markdown artifact and its dev-graph node.
# inputs: ["argv: --repo-root PATH --input JSON [--graph FILE] [--body-file FILE] [--regenerate-body] [--dry-run]"]
# outputs: ["stdout: JSON transaction receipt"]
# requires-python = ">=3.10"
# dependencies: ["validate-graph-schema.py"]
# contexts: [A, B, C, E]
# network: false
# write-scope: one canonical content artifact plus .dev-graph/state/graph.json
# ///
from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import importlib.util
import json
import os
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

from _common import ContractError, atomic_json, contained, dump, load_json, utc_now
from node_body import artifact_bytes as _artifact_bytes
from node_body import resolve_body as _resolve_body
from node_body import restore_document_layer as _restore_document_layer
from node_lifecycle import apply_lifecycle_request
from node_transaction import (
    finalize_transaction,
    graph_operation_lock,
    prepare_transaction,
    recover_pending_transaction,
)


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PLUGIN_ROOT / "schemas" / "graph-node.schema.json"
TEMPLATE_CONTRACT_PATH = PLUGIN_ROOT / "templates" / "template-contract.json"
ROOT_BY_KIND = {
    "issue": "issues",
    "task": "tasks",
    "specification": "specs",
    "architecture": "architecture",
    "document": "docs",
    "feature": "features",
}
# feature を生む正経路の出自。manual/github/system-dev-planner は macro 層の入口ではない
# (system-dev-planner は 1 feature → exact-13 task を返す側で、feature 自体は作らない)。
MACRO_FEATURE_ORIGIN_KINDS = frozenset({"generated", "system-spec-harness"})
def _validator() -> Any:
    path = Path(__file__).with_name("validate-graph-schema.py")
    spec = importlib.util.spec_from_file_location("dev_graph_node_validator", path)
    if not spec or not spec.loader:
        raise ContractError(f"cannot load canonical validator: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _atomic_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        try:
            os.unlink(temp)
        except FileNotFoundError:
            pass


def _graph_path(root: Path, explicit: str | None) -> Path:
    if explicit:
        candidate = Path(explicit)
        candidate = candidate if candidate.is_absolute() else root / candidate
    else:
        config_path = root / ".dev-graph" / "config.json"
        config = load_json(config_path)
        raw = (config.get("local_state") or {}).get("graph") if isinstance(config, dict) else None
        if not isinstance(raw, str) or not raw:
            raise ContractError(".dev-graph/config.json omits local_state.graph")
        candidate = root / raw
    return contained(candidate, root, must_exist=True)


def _input(path: Path) -> dict[str, Any]:
    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ContractError("node input must be a JSON object")
    return payload


def _node_id(node: dict[str, Any]) -> str:
    value = node.get("graph_node_id")
    if not isinstance(value, str) or not value.strip():
        raise ContractError("graph_node_id is required")
    return value


def _canonical_path(node: dict[str, Any], existing: dict[str, Any] | None) -> str:
    kind = node.get("artifact_kind")
    if kind not in ROOT_BY_KIND:
        raise ContractError(f"unsupported artifact_kind: {kind!r}")
    raw = node.get("file_path")
    if raw is None and existing is not None:
        raw = existing.get("file_path")
    if raw is None:
        slug = re.sub(r"[^A-Za-z0-9._-]+", "-", _node_id(node)).strip("-.")
        if not slug:
            raise ContractError("graph_node_id cannot form a canonical file name")
        raw = f"{ROOT_BY_KIND[kind]}/{slug}.md"
        node["file_path"] = raw
    if not isinstance(raw, str):
        raise ContractError("file_path must be a repository-relative Markdown path")
    logical = PurePosixPath(raw)
    if logical.is_absolute() or ".." in logical.parts or logical.suffix != ".md":
        raise ContractError("file_path must be a contained repository-relative .md path")
    if not logical.parts or logical.parts[0] != ROOT_BY_KIND[kind]:
        raise ContractError(f"{kind} must be stored under {ROOT_BY_KIND[kind]}/")
    node["file_path"] = logical.as_posix()
    if existing is not None and existing.get("file_path") != node["file_path"]:
        raise ContractError("upsert does not move an existing node; create an explicit migration")
    return node["file_path"]


def _assert_c14_macro_contract(node: dict[str, Any], root: Path) -> None:
    """feature は C14 macro contract 由来だけを受理する (通常 artifact routing では作らせない)。

    SKILL.md OUT1 / MM 契約: 「feature は C14 の macro contract から受け取り、通常 artifact
    routing で新規生成しない」。この gate が無い間、lineage が manual/全 null の feature が
    通常 add で登録され features/ に実ファイルが作られていた (2026-07-21 live-trial r13)。

    fail-closed: 判定に必要な情報が欠けている場合は必ず ContractError を送出する。
    """
    lineage = node.get("source_lineage")
    if not isinstance(lineage, dict):
        raise ContractError(
            "feature requires source_lineage proving C14 macro contract provenance"
        )

    def source_digest_matches() -> bool:
        """source_path の実ファイル内容が source_digest と一致するかを実測する。"""
        raw = lineage.get("source_path")
        expected = lineage.get("source_digest")
        if not isinstance(raw, str) or not raw or not isinstance(expected, str) or not expected:
            return False
        try:
            source = contained(root / raw, root, must_exist=True)
        except (ContractError, OSError):
            return False
        return _sha256(source.read_bytes()) == expected

    origin_kind = lineage.get("origin_kind")
    if origin_kind not in MACRO_FEATURE_ORIGIN_KINDS:
        raise ContractError(
            "feature must come from the C14 macro contract: "
            f"source_lineage.origin_kind {origin_kind!r} is not one of "
            f"{sorted(MACRO_FEATURE_ORIGIN_KINDS)}"
        )
    source_plugin = lineage.get("source_plugin")
    if not isinstance(source_plugin, str) or not source_plugin.strip():
        raise ContractError(
            "feature from the C14 macro contract requires source_lineage.source_plugin"
        )
    if not source_digest_matches():
        raise ContractError(
            "feature from the C14 macro contract requires source_lineage.source_path to be a "
            "contained repository file whose sha256 equals source_lineage.source_digest"
        )


def _request_node(
    payload: dict[str, Any], existing: dict[str, Any] | None,
) -> tuple[dict[str, Any], bool]:
    if "node" in payload and "patch" in payload:
        raise ContractError("input must contain either node or patch, not both")
    if "node" in payload:
        raw = payload["node"]
        if not isinstance(raw, dict):
            raise ContractError("input node must be an object")
        node = copy.deepcopy(raw)
        explicit_updated_at = "updated_at" in raw
    elif "patch" in payload:
        if existing is None:
            raise ContractError("patch requires an existing graph node")
        patch = payload["patch"]
        if not isinstance(patch, dict):
            raise ContractError("input patch must be an object")
        node = copy.deepcopy(existing)
        node.update(copy.deepcopy(patch))
        explicit_updated_at = "updated_at" in patch
    else:
        # A bare canonical node object is accepted for simple callers.
        node = copy.deepcopy(payload)
        node.pop("body", None)
        explicit_updated_at = "updated_at" in node
    now = utc_now()
    if existing is None:
        node.setdefault("created_at", now)
        node.setdefault("updated_at", node["created_at"])
    else:
        node.setdefault("created_at", existing.get("created_at"))
        node.setdefault("updated_at", existing.get("updated_at"))
    return node, explicit_updated_at


def _stale_feature_lifecycle_fields(
    existing: dict[str, Any],
    requested: dict[str, Any],
) -> list[str]:
    """Return lifecycle fields that a stale full feature snapshot would regress.

    A full ``node`` input is a before-image produced by C14 and may be retried.
    Once a feature has advanced, replaying that old image must not silently
    erase the advancement.  Callers that intentionally reset lifecycle state
    can still do so with an explicit ``patch`` request.
    """
    if (
        existing.get("artifact_kind") != "feature"
        or requested.get("artifact_kind") != "feature"
    ):
        return []

    regressions: list[str] = []
    if (
        existing.get("status") in {"active", "blocked", "done", "closed", "tombstoned"}
        and requested.get("status") == "draft"
    ):
        regressions.append("status")
    if (
        existing.get("confirmation_status") in {"confirmed", "superseded"}
        and requested.get("confirmation_status") == "draft"
    ):
        regressions.append("confirmation_status")
    if (
        existing.get("evaluation_status") in {"pass", "fail", "stale"}
        and requested.get("evaluation_status") == "pending"
    ):
        regressions.append("evaluation_status")

    existing_readiness = existing.get("implementation_readiness")
    requested_readiness = requested.get("implementation_readiness")
    if (
        isinstance(existing_readiness, dict)
        and existing_readiness.get("status") == "complete"
        and isinstance(requested_readiness, dict)
        and requested_readiness.get("status") == "incomplete"
    ):
        regressions.append("implementation_readiness.status")
    return regressions


def _perform(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.repo_root).expanduser().resolve(strict=True)
    graph_path = _graph_path(root, args.graph)
    input_path = Path(args.input)
    input_path = input_path if input_path.is_absolute() else root / input_path
    payload = _input(contained(input_path, root, must_exist=True))
    validator = _validator()
    schema = load_json(SCHEMA_PATH)
    contract = load_json(TEMPLATE_CONTRACT_PATH)
    if not isinstance(schema, dict) or not isinstance(contract, dict):
        raise ContractError("canonical schema/template contract must be JSON objects")

    lock_path = graph_path.with_name(f".{graph_path.name}.register.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with graph_operation_lock(graph_path, exclusive=True), lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        recovered = recover_pending_transaction(root, graph_path)
        graph_bytes_before = graph_path.read_bytes()
        graph = load_json(graph_path)
        if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
            raise ContractError("canonical graph must be an object with nodes[]")
        nodes = graph["nodes"]
        if not all(isinstance(item, dict) for item in nodes):
            raise ContractError("canonical graph nodes must be objects")

        requested_id = payload.get("graph_node_id")
        if requested_id is None and isinstance(payload.get("node"), dict):
            requested_id = payload["node"].get("graph_node_id")
        if requested_id is None and isinstance(payload.get("patch"), dict):
            requested_id = payload["patch"].get("graph_node_id")
        if not isinstance(requested_id, str) or not requested_id:
            raise ContractError("input requires graph_node_id")
        matches = [(index, item) for index, item in enumerate(nodes) if item.get("graph_node_id") == requested_id]
        if len(matches) > 1:
            raise ContractError(f"duplicate graph_node_id in canonical graph: {requested_id}")
        index = matches[0][0] if matches else None
        existing = copy.deepcopy(matches[0][1]) if matches else None
        node, explicit_updated_at = _request_node(payload, existing)
        if _node_id(node) != requested_id:
            raise ContractError("graph_node_id is immutable and must match the request identity")
        if existing is not None and "patch" not in payload:
            lifecycle_regressions = _stale_feature_lifecycle_fields(existing, node)
            if lifecycle_regressions:
                raise ContractError(
                    "stale feature lifecycle before-image would regress "
                    f"{', '.join(lifecycle_regressions)}; refresh the full node "
                    "snapshot or use an explicit patch for an intentional reset"
                )
        relative_path = _canonical_path(node, existing)
        # 新規 feature と kind 差替えによる feature 化の双方を gate する (dry-run も同じ経路)。
        if node.get("artifact_kind") == "feature" and (
            existing is None or existing.get("artifact_kind") != "feature"
        ):
            _assert_c14_macro_contract(node, root)
        artifact = contained(root / relative_path, root, must_exist=False)
        _restore_document_layer(node, artifact)
        body, body_source, replaced_body_lines = _resolve_body(
            payload,
            args.body_file,
            root,
            artifact,
            str(node["artifact_kind"]),
            regenerate=bool(getattr(args, "regenerate_body", False)),
            plugin_root=PLUGIN_ROOT,
        )

        # Decide idempotency before generating an automatic update timestamp.
        preliminary_bytes = _artifact_bytes(node, body, schema)
        current_artifact_bytes = artifact.read_bytes() if artifact.is_file() else None
        changed = existing != node or current_artifact_bytes != preliminary_bytes
        if changed and existing is not None and not explicit_updated_at:
            node["updated_at"] = utc_now()
        artifact_bytes_after = _artifact_bytes(node, body, schema)

        proposed = copy.deepcopy(graph)
        if index is None:
            proposed["nodes"].append(node)
            operation = "added"
        else:
            proposed["nodes"][index] = node
            operation = "updated"
        violations = validator.validate(proposed["nodes"], repo_root=None, template_contract=contract)
        if violations:
            raise ContractError(f"proposed graph is invalid: {json.dumps(violations, ensure_ascii=False)}")

        graph_changed = graph != proposed
        artifact_changed = current_artifact_bytes != artifact_bytes_after
        if not graph_changed and not artifact_changed:
            return {
                "owner": "C02/run-dev-graph-node",
                "status": "preview" if args.dry_run else "applied",
                "operation": "noop",
                "idempotent": True,
                "graph_node_id": requested_id,
                "file_path": relative_path,
                "graph_revision_before": graph.get("graph_revision", 0),
                "graph_revision_after": graph.get("graph_revision", 0),
                "graph_sha256_before": _sha256(graph_bytes_before),
                "graph_sha256_after": _sha256(graph_bytes_before),
                "artifact_sha256_after": _sha256(artifact_bytes_after),
                "body_source": body_source,
                "replaced_body_lines": replaced_body_lines,
                "write_count": 0,
            }

        revision_before = graph.get("graph_revision", 0)
        if not isinstance(revision_before, int) or revision_before < 0:
            raise ContractError("graph_revision must be a non-negative integer")
        proposed["graph_revision"] = revision_before + 1
        receipt = {
            "owner": "C02/run-dev-graph-node",
            "status": "preview" if args.dry_run else "applied",
            "operation": operation,
            "idempotent": False,
            "graph_node_id": requested_id,
            "file_path": relative_path,
            "graph_revision_before": revision_before,
            "graph_revision_after": revision_before + 1,
            "graph_sha256_before": _sha256(graph_bytes_before),
            "graph_sha256_after": _sha256(
                (json.dumps(proposed, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
            ),
            "artifact_sha256_after": _sha256(artifact_bytes_after),
            "body_source": body_source,
            "replaced_body_lines": replaced_body_lines,
            "write_count": 0 if args.dry_run else int(graph_changed) + int(artifact_changed),
        }
        if args.dry_run:
            return receipt

        artifact_existed = artifact.is_file()
        artifact_bytes_before = artifact.read_bytes() if artifact_existed else None
        graph_bytes_after = (
            json.dumps(proposed, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
        ).encode("utf-8")
        prepare_transaction(
            root=root,
            graph_path=graph_path,
            graph_before=graph_bytes_before,
            graph_after=graph_bytes_after,
            artifact_path=artifact,
            artifact_before=artifact_bytes_before,
            artifact_after=artifact_bytes_after,
            graph_changed=graph_changed,
            artifact_changed=artifact_changed,
        )
        try:
            if artifact_changed:
                _atomic_bytes(artifact, artifact_bytes_after)
            if os.environ.get("DEV_GRAPH_TEST_INTERRUPT_AFTER_ARTIFACT") == "1":
                os._exit(99)
            artifact_violations = validator.artifact_findings([node], root, contract)
            if artifact_violations:
                raise ContractError(
                    f"generated artifact is invalid: {json.dumps(artifact_violations, ensure_ascii=False)}"
                )
            atomic_json(graph_path, proposed)
            finalize_transaction(root, graph_path)
        except BaseException:
            recover_pending_transaction(root, graph_path)
            raise
        receipt["graph_sha256_after"] = _sha256(graph_path.read_bytes())
        receipt["recovered_interrupted_transaction"] = recovered
        return receipt


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Atomically add or patch one dev-graph node")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--graph")
    parser.add_argument("--input", help="JSON node/envelope/patch within the repository")
    parser.add_argument("--body-file", help="Markdown body without frontmatter, within the repository")
    parser.add_argument(
        "--regenerate-body",
        action="store_true",
        help="既存 artifact の本文を破棄して template から再生成する (既定は保持)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--operation", choices=("apply-lifecycle-request",))
    parser.add_argument("--request")
    parser.add_argument("--receipt")
    args = parser.parse_args(argv)
    try:
        if args.operation == "apply-lifecycle-request":
            if args.input or args.body_file or args.dry_run or args.regenerate_body:
                raise ContractError(
                    "apply-lifecycle-request cannot be combined with node upsert arguments"
                )
            dump(apply_lifecycle_request(args, _perform))
        else:
            if not args.input:
                raise ContractError("node upsert requires --input")
            if args.request or args.receipt:
                raise ContractError(
                    "--request/--receipt require --operation apply-lifecycle-request"
                )
            dump(_perform(args))
        return 0
    except (ContractError, OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        dump({"valid": False, "error": str(exc), "write_count": 0})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
