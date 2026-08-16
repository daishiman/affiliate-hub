"""Durable completion-lifecycle request application for C02 node upserts."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable

from _common import ContractError, atomic_json, contained, load_json, utc_now


UpsertOperation = Callable[[argparse.Namespace], dict[str, Any]]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()


def _input(path: Path) -> dict[str, Any]:
    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ContractError("node input must be a JSON object")
    return payload


def _git_common_dir(root: Path) -> Path:
    completed = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "--git-common-dir"],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode:
        raise ContractError(
            "apply-lifecycle-request requires a git repository: "
            f"{(completed.stderr or completed.stdout).strip()}"
        )
    raw = Path(completed.stdout.strip())
    return (raw if raw.is_absolute() else root / raw).resolve(strict=True)


def _lifecycle_coordination_path(
    root: Path,
    raw: str,
    *,
    must_exist: bool,
) -> Path:
    common = _git_common_dir(root)
    authority = (common / "dev-graph" / "completion-receipts").resolve()
    candidate = Path(raw).expanduser().resolve(strict=must_exist)
    try:
        candidate.relative_to(authority)
    except ValueError as exc:
        raise ContractError(
            "lifecycle request/receipt path escapes git-common-dir "
            "completion authority"
        ) from exc
    if candidate.parent != authority:
        raise ContractError(
            "lifecycle request/receipt must be a direct completion-receipts child"
        )
    return candidate


def _lifecycle_task_matches(
    graph: dict[str, Any],
    *,
    node_id: str,
    expected_set: dict[str, Any],
) -> dict[str, Any] | None:
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        raise ContractError("canonical graph must be an object with nodes[]")
    matches = [
        node
        for node in nodes
        if isinstance(node, dict) and node.get("graph_node_id") == node_id
    ]
    if len(matches) != 1:
        raise ContractError(
            "apply-lifecycle-request target must resolve exactly one graph node"
        )
    node = matches[0]
    if all(node.get(key) == value for key, value in expected_set.items()):
        return node
    return None


def _validate_lifecycle_request(
    root: Path,
    request: dict[str, Any],
) -> tuple[Path, dict[str, Any], dict[str, Any], Path]:
    if (
        request.get("schema_version") != "1.1"
        or request.get("owner") != "C02/run-dev-graph-node"
        or request.get("operation") != "apply-lifecycle-request"
        or request.get("status") != "pending"
    ):
        raise ContractError("lifecycle request identity/status mismatch")
    expected_digest = _json_digest(
        {key: value for key, value in request.items() if key != "request_digest"}
    )
    if request.get("request_digest") != expected_digest:
        raise ContractError("lifecycle request digest mismatch")
    event_key = request.get("event_key")
    if not isinstance(event_key, str) or not event_key:
        raise ContractError("lifecycle request event_key is required")
    raw_graph = request.get("graph_path")
    if (
        not isinstance(raw_graph, str)
        or not raw_graph
        or Path(raw_graph).is_absolute()
        or ".." in Path(raw_graph).parts
    ):
        raise ContractError(
            "lifecycle request graph_path must be repository-relative"
        )
    graph_path = contained(root / raw_graph, root, must_exist=True)
    graph = load_json(graph_path)
    if not isinstance(graph, dict):
        raise ContractError("canonical graph must be an object")
    revision_before = request.get("graph_revision_before")
    if not isinstance(revision_before, int) or revision_before < 0:
        raise ContractError("lifecycle request graph_revision_before is invalid")
    graph_sha_before = request.get("graph_sha256_before")
    if not isinstance(graph_sha_before, str) or not re.fullmatch(
        r"[0-9a-f]{64}",
        graph_sha_before,
    ):
        raise ContractError("lifecycle request graph_sha256_before is invalid")
    task_patch = request.get("task_patch")
    if not isinstance(task_patch, dict):
        raise ContractError("lifecycle request task_patch must be an object")
    node_id = task_patch.get("graph_node_id")
    expected_set = task_patch.get("set")
    if not isinstance(node_id, str) or not node_id:
        raise ContractError("lifecycle request task graph_node_id is required")
    if not isinstance(expected_set, dict):
        raise ContractError("lifecycle request task_patch.set must be an object")
    allowed = {
        "status",
        "updated_at",
        "completion_evidence",
        "pull_request_linkages",
    }
    if set(expected_set) - allowed:
        raise ContractError(
            "lifecycle request task_patch.set contains unsupported fields"
        )
    completion = expected_set.get("completion_evidence")
    if (
        expected_set.get("status") != "done"
        or not isinstance(completion, dict)
        or completion.get("status") != "done"
    ):
        raise ContractError("lifecycle request must project durable done state")
    if request.get("feature_patch") is not None:
        raise ContractError(
            "built-in apply-lifecycle-request does not accept a feature rollup; "
            "complete the task without --registration-receipt, then run the "
            "feature rollup"
        )
    nodes = graph.get("nodes")
    current = (
        next(
            (
                node
                for node in nodes
                if isinstance(node, dict) and node.get("graph_node_id") == node_id
            ),
            None,
        )
        if isinstance(nodes, list)
        else None
    )
    if not isinstance(current, dict):
        raise ContractError(
            "lifecycle request task graph_node_id is not in the graph"
        )
    file_path = task_patch.get("file_path")
    if file_path != current.get("file_path"):
        raise ContractError(
            "lifecycle request task file_path does not match the graph"
        )
    artifact = contained(root / str(file_path), root, must_exist=True)
    artifact_before = task_patch.get("artifact_sha256_before")
    if not isinstance(artifact_before, str) or not re.fullmatch(
        r"[0-9a-f]{64}",
        artifact_before,
    ):
        raise ContractError(
            "lifecycle request artifact_sha256_before is invalid"
        )
    return graph_path, graph, task_patch, artifact


def _frontmatter_status(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return None
    marker = text.find("\n---\n", 4)
    if marker < 0:
        return None
    for line in text[4:marker].splitlines():
        match = re.match(r"^status:\s*(.*?)\s*$", line)
        if match:
            return match.group(1).strip("\"'")
    return None


def apply_lifecycle_request(
    args: argparse.Namespace,
    perform_upsert: UpsertOperation,
) -> dict[str, Any]:
    root = Path(args.repo_root).expanduser().resolve(strict=True)
    if not args.request or not args.receipt:
        raise ContractError(
            "apply-lifecycle-request requires --request and --receipt"
        )
    request_path = _lifecycle_coordination_path(
        root,
        args.request,
        must_exist=True,
    )
    receipt_path = _lifecycle_coordination_path(
        root,
        args.receipt,
        must_exist=False,
    )
    if request_path == receipt_path:
        raise ContractError("lifecycle request and receipt paths must differ")
    request = _input(request_path)
    graph_path, graph, task_patch, artifact = _validate_lifecycle_request(
        root,
        request,
    )
    node_id = str(task_patch["graph_node_id"])
    expected_set = task_patch["set"]
    revision_before = int(request["graph_revision_before"])
    graph_sha_before = str(request["graph_sha256_before"])
    artifact_sha_before = str(task_patch["artifact_sha256_before"])
    current_revision = graph.get("graph_revision")
    current_graph_sha = _sha256(graph_path.read_bytes())
    current_artifact_sha = _sha256(artifact.read_bytes())

    already_applied = (
        current_revision == revision_before + 1
        and _lifecycle_task_matches(
            graph,
            node_id=node_id,
            expected_set=expected_set,
        )
        is not None
    )
    if already_applied:
        if _frontmatter_status(artifact) != "done":
            raise ContractError(
                "lifecycle task graph is done but Markdown frontmatter is not done"
            )
        upsert_receipt = {
            "graph_revision_after": current_revision,
            "graph_sha256_after": current_graph_sha,
            "artifact_sha256_after": current_artifact_sha,
            "idempotent": True,
        }
    else:
        if (
            current_revision != revision_before
            or current_graph_sha != graph_sha_before
            or current_artifact_sha != artifact_sha_before
        ):
            raise ContractError(
                "lifecycle request before-image does not match durable "
                "graph/artifact"
            )
        state_dir = root / ".dev-graph" / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(
            prefix=".lifecycle-task-patch.",
            suffix=".json",
            dir=str(state_dir),
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(
                    {
                        "graph_node_id": node_id,
                        "patch": expected_set,
                    },
                    stream,
                    ensure_ascii=False,
                    sort_keys=True,
                )
                stream.flush()
                os.fsync(stream.fileno())
            upsert_receipt = perform_upsert(
                argparse.Namespace(
                    repo_root=str(root),
                    graph=str(graph_path),
                    input=temporary,
                    body_file=None,
                    regenerate_body=False,
                    dry_run=False,
                )
            )
        finally:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass
        if (
            upsert_receipt.get("owner") != "C02/run-dev-graph-node"
            or upsert_receipt.get("status") != "applied"
            or upsert_receipt.get("operation") != "updated"
            or upsert_receipt.get("graph_revision_after") != revision_before + 1
        ):
            raise ContractError(
                "C02 lifecycle task upsert did not apply exactly one revision"
            )

    receipt = {
        "schema_version": "1.0",
        "owner": "C02/run-dev-graph-node",
        "operation": "apply-lifecycle-request",
        "status": "applied",
        "event_key": request["event_key"],
        "graph_node_id": node_id,
        "request_digest": request["request_digest"],
        "graph_sha256_after": upsert_receipt["graph_sha256_after"],
        "graph_revision_after": upsert_receipt["graph_revision_after"],
        "task_artifact_sha256_after": upsert_receipt["artifact_sha256_after"],
        "idempotent": bool(upsert_receipt.get("idempotent")),
        "applied_at": utc_now(),
    }
    atomic_json(receipt_path, receipt)
    return receipt
