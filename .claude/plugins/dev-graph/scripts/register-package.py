#!/usr/bin/env python3
# /// script
# name: register-package
# purpose: Validate and atomically register one promoted exact-13 system-dev-planner package in the dev graph.
# inputs: ["argv: register --package/--graph/--output/--receipt", "argv: execution-context --graph/--graph-node-id/--context-json", "argv: preflight"]
# outputs: ["stdout: JSON preview/receipt/preflight report"]
# requires-python = ">=3.10"
# dependencies: [_common.py, ../lib/registration_projection.py]
# contexts: [A, B, C, E]
# network: false
# write-scope: explicitly selected dev-graph output and immutable receipt
# ///
"""C02 exact-13 package registration consumer and cross-plugin preflight."""
from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import json
import os
import re
import runpy
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from _common import ContractError, atomic_json, contained, dump, load_json, utc_now
_LIB_DIR = str(Path(__file__).resolve().parents[1] / "lib")
if _LIB_DIR not in sys.path:
    sys.path.insert(0, _LIB_DIR)
from registration_projection import carry_projection_fields, matches_registered_state

HERE = Path(__file__).resolve().parent
_PREFLIGHT_HELPER = runpy.run_path(str(HERE / "validate-registration-preflight.py"))
_SCHEMA_HELPER = runpy.run_path(str(HERE / "validate-registration-schema.py"))
preflight_contract = _PREFLIGHT_HELPER["preflight_contract"]
_validate_schema = _SCHEMA_HELPER["validate_schema"]
PLUGIN_ROOT = HERE.parent
DEFAULT_SYSTEM_ROOT = PLUGIN_ROOT.parent / "system-dev-planner"
PHASES = [f"P{i:02d}" for i in range(1, 14)]
SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
REGISTRATION_KEYS = {
    "schema_version", "source_digest", "promotion_receipt", "feature_package_id",
    "parent_feature", "expected_count", "phase_refs", "binding_intents", "nodes",
}
RECEIPT_STABLE_KEYS = {
    "schema_version", "status", "feature_package_id", "parent_feature", "source_digest",
    "expected_count", "applied_count", "phase_refs", "node_ids", "graph_revision_before",
    "graph_revision_after", "graph_digest_after", "output_path", "operation",
    "supersedes_source_digest",
}
CANONICAL_REGISTRATION_RECEIPT = "dev-graph-registration-receipt.json"
# PR の merge を完了条件にする policy。local_only の node は PR を 1 件も持たないため
# これらのままでは `status=done` へ到達できない (_normalize_local_only_completion を参照)。
PR_LINKED_COMPLETION_POLICIES = frozenset({"linked_pr_merged_all", "linked_pr_merged_any"})
LOCAL_ONLY_COMPLETION_POLICY = "manual"


def _path(root: Path, raw: str, *, must_exist: bool) -> Path:
    candidate = Path(raw)
    if not candidate.is_absolute(): candidate = root / candidate
    if must_exist: return contained(candidate, root, must_exist=True)
    parent = contained(candidate.parent, root, must_exist=True)
    return parent / candidate.name


def _json_object(path: Path) -> dict[str, Any]:
    value = load_json(path)
    if not isinstance(value, dict): raise ContractError(f"JSON object required: {path}")
    return value


def _canonical_digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _schema_version(schema: dict[str, Any], name: str) -> str:
    value = (((schema.get("properties") or {}).get("schema_version") or {}).get("const"))
    if not isinstance(value, str): raise ContractError(f"{name} does not pin properties.schema_version.const")
    return value


def _validate_package(package: dict[str, Any], schema: dict[str, Any]) -> None:
    _validate_schema(package, schema, schema, "feature-package")
    if package["phase_refs"] != PHASES or package["task_count"] != 13:
        raise ContractError("feature package is not exact P01..P13")


def _validate_registration(registration: dict[str, Any], package: dict[str, Any], node_schema: dict[str, Any]) -> list[dict[str, Any]]:
    if set(registration) != REGISTRATION_KEYS:
        raise ContractError(f"registration keys mismatch: {sorted(set(registration) ^ REGISTRATION_KEYS)}")
    if registration.get("schema_version") != "1.0.0": raise ContractError("registration schema_version must be 1.0.0")
    if not SHA256.fullmatch(str(registration.get("source_digest", ""))): raise ContractError("invalid source_digest")
    if registration.get("expected_count") != 13 or registration.get("phase_refs") != PHASES:
        raise ContractError("registration is not exact P01..P13")
    if registration.get("feature_package_id") != package.get("feature_package_id"):
        raise ContractError("feature_package_id mismatch")
    if registration.get("parent_feature") != package.get("parent_feature"):
        raise ContractError("parent_feature mismatch")
    nodes = registration.get("nodes")
    if not isinstance(nodes, list) or len(nodes) != 13: raise ContractError("registration nodes must contain exactly 13 objects")
    phases = [node.get("phase_ref") if isinstance(node, dict) else None for node in nodes]
    if phases != PHASES: raise ContractError(f"node phase exact-set mismatch: {phases}")
    node_ids = [node.get("graph_node_id") if isinstance(node, dict) else None for node in nodes]
    if node_ids != package.get("task_node_ids") or len(set(node_ids)) != 13:
        raise ContractError("node ids must equal package.task_node_ids in phase order")
    intents = registration.get("binding_intents")
    if not isinstance(intents, dict) or set(intents) != set(node_ids):
        raise ContractError("binding_intents keys must equal exact node id set")
    if any(value not in {"auto", "beads", "github", "none"} for value in intents.values()):
        raise ContractError("invalid binding intent")
    phase_number = {node_ids[i]: i + 1 for i in range(13)}
    source_digest = registration["source_digest"].removeprefix("sha256:")
    for index, node in enumerate(nodes):
        if not isinstance(node, dict): raise ContractError(f"nodes[{index}] must be an object")
        _validate_schema(node, node_schema, node_schema, f"nodes[{index}]")
        if node.get("artifact_kind") != "task" or node.get("artifact_subtypes") != []:
            raise ContractError(f"nodes[{index}] must be a canonical task")
        if node.get("parent_feature") != package["parent_feature"] or node.get("feature_package_id") != package["feature_package_id"]:
            raise ContractError(f"nodes[{index}] has mixed parent/package")
        if node.get("tracker_binding") != "repo-config-default":
            raise ContractError(f"nodes[{index}] must carry unresolved repo-config-default binding")
        if node.get("status") != "active" or node.get("confirmation_status") != "confirmed" or node.get("evaluation_status") != "pass":
            raise ContractError(f"nodes[{index}] is not confirmed active/pass")
        if (node.get("implementation_readiness") or {}).get("status") != "complete":
            raise ContractError(f"nodes[{index}] implementation readiness is incomplete")
        lineage = node.get("source_lineage") or {}
        if lineage.get("origin_kind") != "system-dev-planner" or lineage.get("source_plugin") != "system-dev-planner":
            raise ContractError(f"nodes[{index}] has invalid system-dev-planner lineage")
        if lineage.get("source_digest") != source_digest:
            raise ContractError(f"nodes[{index}] source lineage digest mismatch")
        if not str(node.get("file_path", "")).startswith("tasks/"):
            raise ContractError(f"nodes[{index}] file_path is not under tasks/")
        parent_feature = node.get("parent_feature")
        if isinstance(parent_feature, str) and parent_feature:
            # feature 単位 namespace: 並列 package 登録・worktree 並列実行時の
            # tasks/ 直下衝突を防ぐ (parent_feature 無しの fast-path task は対象外)
            if not str(node.get("file_path", "")).startswith(f"tasks/{parent_feature}/"):
                raise ContractError(
                    f"nodes[{index}] file_path must be under tasks/{parent_feature}/ (per-feature namespace)"
                )
        for dependency in node.get("depends_on", []):
            if dependency not in phase_number: raise ContractError(f"cross-package dependency rejected: {dependency}")
            if phase_number[dependency] >= index + 1: raise ContractError(f"non-forward phase dependency rejected: {dependency}")
    return copy.deepcopy(nodes)


def _resolve_binding(intent: str, mode: str) -> str:
    if intent == "auto":
        if mode == "both": raise ContractError("tracker mode both requires an explicit binding intent for every node")
        return mode
    if intent == "none": return "none"
    if mode not in {intent, "both"}: raise ContractError(f"binding intent {intent} is not allowed by tracker mode {mode}")
    return intent


def _normalize_local_only_completion(node: dict[str, Any]) -> None:
    """local_only 運用の node から到達不能な完了 policy を取り除く。

    `linked_pr_merged_all|any` は「紐づいた PR が全て/いずれか merge されたら done」を
    意味し、graph-node.schema.json も `status=done` への遷移時に merged な
    `pull_request_linkages` を 1 件以上要求する。local_only の node は PR を 1 件も
    持たないため、この policy のままでは `completion_evidence` が永久に `done` へ
    到達せず、beads だけが closed になって OR-003 (解決済みの open 残置) が積み上がる。

    正本: HarnessHub-n7gw / `.dev-graph/templates/task.md` (beads 運用では
    `policy=manual` を用いる)。
    """
    completion = node.get("completion_evidence")
    if not isinstance(completion, dict):
        return
    if completion.get("policy") in PR_LINKED_COMPLETION_POLICIES:
        completion["policy"] = LOCAL_ONLY_COMPLETION_POLICY


def _resolved_nodes(nodes: list[dict[str, Any]], intents: dict[str, str], mode: str,
                    node_schema: dict[str, Any]) -> list[dict[str, Any]]:
    result = copy.deepcopy(nodes)
    for index, node in enumerate(result):
        node_id = node["graph_node_id"]
        binding = _resolve_binding(intents[node_id], mode)
        node["tracker_binding"] = binding
        publication = node["github_publication"]
        if binding == "github":
            if publication.get("mode") not in {"issue", "issue_and_projects"}: publication["mode"] = "issue"
        else:
            publication["mode"] = "local_only"
            publication["project_aliases"] = []
            _normalize_local_only_completion(node)
        if binding in {"github", "none"}: node["beads_linkage"] = None
        _validate_schema(node, node_schema, node_schema, f"resolved_nodes[{index}]")
        if node["tracker_binding"] == "repo-config-default": raise ContractError("unresolved binding sentinel")
    return result


def _promotion_matches(root: Path, registration_path: Path, registration: dict[str, Any]) -> None:
    raw = registration.get("promotion_receipt")
    if not isinstance(raw, str): raise ContractError("promotion_receipt path missing")
    receipt_path = _path(root, raw, must_exist=True)
    receipt = _json_object(receipt_path)
    if receipt.get("status") != "promoted": raise ContractError("promotion receipt status is not promoted")
    if receipt.get("published_digest") != registration["source_digest"]:
        raise ContractError("promotion/registration digest mismatch")
    manifest = receipt.get("registration_manifest")
    if isinstance(manifest, str):
        manifest_path = _path(root, manifest, must_exist=True)
        if manifest_path != registration_path: raise ContractError("promotion receipt points to a different registration manifest")


def _find_node(nodes: list[dict[str, Any]], node_id: str) -> dict[str, Any] | None:
    return next((node for node in nodes if (node.get("graph_node_id") or node.get("id")) == node_id), None)


def _project_parent_feature(parent: dict[str, Any], package: dict[str, Any],
                            resolved: list[dict[str, Any]]) -> dict[str, Any]:
    """Converge the macro feature in the same revision as its exact-13 package.

    The parent feature is not a package member, but package readiness is part of
    its saved state.  Keeping this update inside C02's single graph write avoids
    a window where 13 executable children are current while the feature still
    advertises "package missing".
    """
    if not resolved:
        raise ContractError("resolved exact-13 package is empty")
    projected = copy.deepcopy(parent)
    first = resolved[0]
    projected["status"] = "active"
    projected["confirmation_status"] = "confirmed"
    projected["evaluation_status"] = "pass"
    projected["confirmation_evidence"] = copy.deepcopy(first["confirmation_evidence"])
    projected["implementation_readiness"] = copy.deepcopy(first["implementation_readiness"])
    projected["updated_at"] = first["updated_at"]
    return projected


def _stable_receipt(value: dict[str, Any]) -> dict[str, Any]:
    return {key: value.get(key) for key in RECEIPT_STABLE_KEYS}


def _atomic_create_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n"); stream.flush(); os.fsync(stream.fileno())
        try: os.link(temp, path)
        except FileExistsError as exc: raise ContractError(f"immutable receipt already exists: {path}") from exc
    finally:
        try: os.unlink(temp)
        except FileNotFoundError: pass


@contextmanager
def _single_writer(output: Path) -> Iterator[None]:
    lock_path = output.with_name(f".{output.name}.register.lock")
    with lock_path.open("a+", encoding="utf-8") as stream:
        try: fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc: raise ContractError(f"registration writer is already active: {output}") from exc
        yield


def _register(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(args.repo_root or os.getcwd()).resolve(strict=True)
    package_path = _path(root, args.package, must_exist=True)
    registration_path = _path(root, args.graph, must_exist=True)
    output_path = _path(root, args.output, must_exist=True)
    receipt_path = _path(root, args.receipt, must_exist=False)
    expected_receipt_path = package_path.parent / CANONICAL_REGISTRATION_RECEIPT
    if receipt_path != expected_receipt_path:
        raise ContractError(
            "registration receipt must match the system-build handoff contract: "
            f"{expected_receipt_path.relative_to(root).as_posix()}"
        )
    system_root = Path(args.system_planner_root).resolve(strict=True)
    preflight_contract(system_root, args.required_version, args.required_schema_version)
    package_schema = _json_object(system_root / "schemas" / "feature-execution-package.schema.json")
    registration_schema = _json_object(system_root / "schemas" / "dev-graph-registration.schema.json")
    if _schema_version(registration_schema, "dev-graph-registration.schema.json") != args.required_schema_version:
        raise ContractError("registration schema version changed after preflight")
    node_schema = _json_object(PLUGIN_ROOT / "schemas" / "graph-node.schema.json")
    receipt_schema = _json_object(PLUGIN_ROOT / "schemas" / "package-registration-receipt.schema.json")
    package = _json_object(package_path); _validate_package(package, package_schema)
    registration = _json_object(registration_path)
    incoming = _validate_registration(registration, package, node_schema)
    _promotion_matches(root, registration_path, registration)
    resolved = _resolved_nodes(incoming, registration["binding_intents"], args.tracker_mode, node_schema)

    def perform() -> dict[str, Any]:
        current = _json_object(output_path)
        existing = current.get("nodes")
        if not isinstance(existing, list) or not all(isinstance(node, dict) for node in existing):
            raise ContractError("output graph must contain nodes[] objects")
        existing_ids = [node.get("graph_node_id") or node.get("id") for node in existing]
        if len(set(existing_ids)) != len(existing_ids): raise ContractError("output graph contains duplicate node ids")
        for index, node in enumerate(existing):
            _validate_schema(node, node_schema, node_schema, f"output.nodes[{index}]")
        parent = _find_node(existing, package["parent_feature"])
        if not parent or parent.get("artifact_kind", parent.get("kind")) != "feature":
            raise ContractError(f"parent feature does not exist: {package['parent_feature']}")
        incoming_ids = [node["graph_node_id"] for node in resolved]
        present = {node_id for node_id in incoming_ids if _find_node(existing, node_id)}
        package_members = [
            node for node in existing
            if node.get("artifact_kind") == "task"
            and node.get("feature_package_id") == package["feature_package_id"]
        ]
        if present and len(present) != 13: raise ContractError(f"partial registration detected: {len(present)}/13 nodes")
        if package_members and {node.get("graph_node_id") for node in package_members} != set(incoming_ids):
            raise ContractError("conflicting or partial feature_package_id already exists")
        revision_before = current.get("graph_revision", 0)
        if not isinstance(revision_before, int) or revision_before < 0: raise ContractError("invalid graph_revision")
        supersedes_source_digest: str | None = None
        operation = "registered"
        persisted = copy.deepcopy(resolved)
        if len(present) == 13:
            actual = [_find_node(existing, node_id) for node_id in incoming_ids]
            for index, (node, saved) in enumerate(zip(persisted, actual)):
                carry_projection_fields(node, saved)
                _validate_schema(node, node_schema, node_schema, f"persisted_nodes[{index}]")
            if all(matches_registered_state(saved, node) for saved, node in zip(actual, persisted)):
                if not receipt_path.is_file(): raise ContractError("registered nodes exist without immutable receipt")
                receipt = _json_object(receipt_path)
                _validate_schema(receipt, receipt_schema, receipt_schema, "registration-receipt")
                expected_receipt_identity = {
                    "schema_version": "1.0.0", "status": "registered",
                    "feature_package_id": package["feature_package_id"],
                    "parent_feature": package["parent_feature"],
                    "source_digest": registration["source_digest"],
                    "expected_count": 13, "applied_count": 13,
                    "phase_refs": PHASES, "node_ids": incoming_ids,
                    "output_path": output_path.relative_to(root).as_posix(),
                }
                if any(receipt.get(key) != value for key, value in expected_receipt_identity.items()):
                    raise ContractError("immutable receipt conflicts with registered package")
                before = receipt.get("graph_revision_before")
                after = receipt.get("graph_revision_after")
                if not isinstance(before, int) or not isinstance(after, int) or after != before + 1 or after > revision_before:
                    raise ContractError("immutable receipt graph revision conflicts with registered package")
                return {**receipt, "idempotent": True, "dry_run": bool(args.dry_run)}
            old_digests = {
                str((node or {}).get("source_lineage", {}).get("source_digest", ""))
                for node in actual
            }
            if len(old_digests) != 1 or not HEX_SHA256.fullmatch(next(iter(old_digests))):
                raise ContractError("existing exact-13 package has mixed or invalid source digests")
            old_digest = "sha256:" + next(iter(old_digests))
            if old_digest == registration["source_digest"]:
                raise ContractError("duplicate node ids have different content for the same source digest")
            if receipt_path.exists():
                raise ContractError("new generation receipt exists before package supersede")
            supersedes_source_digest = old_digest
            operation = "superseded"
        if receipt_path.exists(): raise ContractError("immutable receipt exists before graph registration")
        proposed = copy.deepcopy(current)
        replacements = {node["graph_node_id"]: node for node in persisted}
        projected_parent = _project_parent_feature(parent, package, persisted)
        _validate_schema(projected_parent, node_schema, node_schema, "projected_parent_feature")
        replacements[package["parent_feature"]] = projected_parent
        proposed["nodes"] = [
            replacements.get(str(node.get("graph_node_id") or node.get("id")), node)
            for node in existing
        ]
        if not present:
            proposed["nodes"] = [*proposed["nodes"], *persisted]
        proposed["graph_revision"] = revision_before + 1
        graph_digest = _canonical_digest(proposed)
        receipt = {
            "schema_version": "1.0.0", "status": "registered", "registered_at": utc_now(),
            "feature_package_id": package["feature_package_id"], "parent_feature": package["parent_feature"],
            "source_digest": registration["source_digest"], "expected_count": 13, "applied_count": 13,
            "phase_refs": PHASES, "node_ids": incoming_ids, "graph_revision_before": revision_before,
            "graph_revision_after": revision_before + 1, "graph_digest_after": graph_digest,
            "output_path": output_path.relative_to(root).as_posix(),
            "operation": operation, "supersedes_source_digest": supersedes_source_digest,
        }
        _validate_schema(receipt, receipt_schema, receipt_schema, "registration-receipt")
        if args.dry_run:
            return {**receipt, "dry_run": True, "idempotent": False, "write_count": 0}
        original = copy.deepcopy(current)
        atomic_json(output_path, proposed)
        try: _atomic_create_json(receipt_path, receipt)
        except Exception:
            atomic_json(output_path, original)
            raise
        return {**receipt, "dry_run": False, "idempotent": False}

    if args.dry_run: return perform()
    with _single_writer(output_path): return perform()


def _project_execution_context(args: argparse.Namespace) -> dict[str, Any]:
    """C02-owned durable projection consumed by C27 after each lease transition."""
    root = Path(args.repo_root or ".").resolve(strict=True)
    graph_path = contained(root / args.graph if not Path(args.graph).is_absolute() else Path(args.graph), root)
    try:
        context = json.loads(args.context_json)
    except json.JSONDecodeError as exc:
        raise ContractError("execution context is invalid JSON") from exc
    if not isinstance(context, dict):
        raise ContractError("execution context must be an object")
    node_schema = load_json(PLUGIN_ROOT / "schemas" / "graph-node.schema.json")
    context_schema = node_schema.get("properties", {}).get("execution_contexts", {}).get("items")
    if not isinstance(context_schema, dict):
        raise ContractError("graph-node schema omits execution_contexts item contract")
    _validate_schema(context, context_schema, node_schema, "$.execution_contexts[0]")

    def perform() -> dict[str, Any]:
        graph = load_json(graph_path)
        if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list):
            raise ContractError("execution-context graph must contain nodes array")
        matches = [node for node in graph["nodes"] if isinstance(node, dict) and (node.get("graph_node_id") or node.get("id")) == args.graph_node_id]
        if len(matches) != 1:
            raise ContractError("execution-context target must resolve exactly one graph node")
        proposed = copy.deepcopy(graph)
        node = next(node for node in proposed["nodes"] if isinstance(node, dict) and (node.get("graph_node_id") or node.get("id")) == args.graph_node_id)
        existing = node.get("execution_contexts", [])
        if not isinstance(existing, list):
            raise ContractError("node execution_contexts must be an array")
        retained = [row for row in existing if not isinstance(row, dict) or row.get("worktree_id") != context["worktree_id"]]
        node["execution_contexts"] = [*retained, context]
        node["updated_at"] = context["last_seen_at"]
        _validate_schema(node, node_schema, node_schema, "$.nodes[target]")
        idempotent = proposed == graph
        revision_before = graph.get("graph_revision")
        if isinstance(revision_before, int) and not idempotent:
            proposed["graph_revision"] = revision_before + 1
        packed = json.dumps(proposed, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        receipt = {
            "owner": "C02/run-dev-graph-node",
            "operation": "project_execution_context",
            "status": "preview" if args.dry_run else "applied",
            "graph_node_id": args.graph_node_id,
            "worktree_id": context["worktree_id"],
            "state": context["state"],
            "graph_sha256_after": hashlib.sha256(packed).hexdigest(),
            "graph_revision_before": revision_before,
            "graph_revision_after": proposed.get("graph_revision"),
            "write_count": 0 if args.dry_run or idempotent else 1,
            "idempotent": idempotent,
        }
        if not args.dry_run:
            if not idempotent:
                atomic_json(graph_path, proposed)
            receipt["graph_sha256_after"] = hashlib.sha256(graph_path.read_bytes()).hexdigest()
        return receipt

    if args.dry_run:
        return perform()
    with _single_writer(graph_path):
        return perform()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Register exact-13 packages or preflight system-dev-planner")
    sub = parser.add_subparsers(dest="command", required=True)
    register = sub.add_parser("register")
    register.add_argument("--repo-root")
    register.add_argument("--package", required=True, help="feature-execution-package JSON")
    register.add_argument("--graph", required=True, help="dev-graph-registration JSON")
    register.add_argument("--output", required=True, help="existing dev graph JSON containing parent feature")
    register.add_argument("--receipt", required=True, help="immutable registration receipt output")
    register.add_argument("--tracker-mode", choices=("beads", "github", "both", "none"), default="none")
    register.add_argument("--dry-run", action="store_true")
    register.add_argument("--system-planner-root", default=str(DEFAULT_SYSTEM_ROOT))
    register.add_argument("--required-version", default="0.1.0")
    register.add_argument("--required-schema-version", default="1.0.0")
    preflight = sub.add_parser("preflight")
    preflight.add_argument("--system-planner-root", default=str(DEFAULT_SYSTEM_ROOT))
    preflight.add_argument("--required-version", default="0.1.0")
    preflight.add_argument("--required-schema-version", default="1.0.0")
    execution = sub.add_parser("execution-context")
    execution.add_argument("--repo-root")
    execution.add_argument("--graph", required=True)
    execution.add_argument("--graph-node-id", required=True)
    execution.add_argument("--context-json", required=True)
    execution.add_argument("--dry-run", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "preflight":
            report = preflight_contract(Path(args.system_planner_root), args.required_version, args.required_schema_version)
        elif args.command == "execution-context":
            report = _project_execution_context(args)
        else: report = _register(args)
        dump(report); return 0
    except (ContractError, OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        dump({"valid": False, "error": str(exc)}); return 2


if __name__ == "__main__": raise SystemExit(main())
