#!/usr/bin/env python3
"""Crash-recovery support for the two-file dev-graph node transaction."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import uuid
import fcntl
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from _common import ContractError


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _atomic_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


@contextmanager
def graph_operation_lock(graph_path: Path, *, exclusive: bool) -> Iterator[None]:
    """Serialize graph writers against whole-operation readers without creating state."""
    descriptor = os.open(graph_path.parent, os.O_RDONLY)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)
        yield
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def journal_path(graph_path: Path) -> Path:
    return graph_path.with_name(f".{graph_path.name}.node-transaction.json")


def ensure_no_pending_transaction(graph_path: Path) -> None:
    journal = journal_path(graph_path)
    if journal.exists():
        raise ContractError(
            "an interrupted node transaction requires recovery; rerun /dev-graph node before reading the graph"
        )


def _contained(path: Path, root: Path, *, exists: bool) -> Path:
    try:
        resolved = path.resolve(strict=exists)
        resolved.relative_to(root)
    except (OSError, ValueError) as exc:
        raise ContractError(f"node transaction path escapes repository: {path}") from exc
    return resolved


def _write_json(path: Path, value: dict[str, Any]) -> None:
    _atomic_bytes(
        path,
        (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"),
    )


def prepare_transaction(
    *,
    root: Path,
    graph_path: Path,
    graph_before: bytes,
    graph_after: bytes,
    artifact_path: Path,
    artifact_before: bytes | None,
    artifact_after: bytes,
    graph_changed: bool,
    artifact_changed: bool,
) -> dict[str, Any]:
    """Durably stage rollback/commit bytes, then publish a fixed recovery journal."""
    root = root.resolve(strict=True)
    graph_path = _contained(graph_path, root, exists=True)
    artifact_path = _contained(artifact_path, root, exists=artifact_path.exists())
    journal = journal_path(graph_path)
    if journal.exists():
        raise ContractError("pending node transaction must be recovered before a new transaction")

    transactions = graph_path.parent / ".node-transactions"
    transactions.mkdir(parents=True, exist_ok=True)
    _fsync_directory(transactions.parent)
    transaction_dir = transactions / uuid.uuid4().hex
    transaction_dir.mkdir(mode=0o700)
    _fsync_directory(transactions)
    staged: dict[str, bytes] = {
        "graph.before": graph_before,
        "graph.after": graph_after,
        "artifact.after": artifact_after,
    }
    if artifact_before is not None:
        staged["artifact.before"] = artifact_before
    for name, value in staged.items():
        _atomic_bytes(transaction_dir / name, value)

    manifest: dict[str, Any] = {
        "schema_version": "1.0",
        "transaction_id": transaction_dir.name,
        "transaction_dir": transaction_dir.relative_to(root).as_posix(),
        "graph_path": graph_path.relative_to(root).as_posix(),
        "artifact_path": artifact_path.relative_to(root).as_posix(),
        "artifact_existed": artifact_before is not None,
        "graph_changed": graph_changed,
        "artifact_changed": artifact_changed,
        "graph_sha256_before": _sha256(graph_before),
        "graph_sha256_after": _sha256(graph_after),
        "artifact_sha256_before": _sha256(artifact_before) if artifact_before is not None else None,
        "artifact_sha256_after": _sha256(artifact_after),
    }
    _write_json(transaction_dir / "manifest.json", manifest)
    _write_json(journal, manifest)
    return manifest


def _load_journal(root: Path, graph_path: Path) -> tuple[Path, dict[str, Any]] | None:
    journal = journal_path(graph_path)
    if not journal.exists():
        return None
    try:
        manifest = json.loads(journal.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"node transaction journal is unreadable: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != "1.0":
        raise ContractError("node transaction journal has an unsupported schema")
    transaction_dir = _contained(root / str(manifest.get("transaction_dir", "")), root, exists=True)
    staged_manifest = transaction_dir / "manifest.json"
    if not staged_manifest.is_file() or staged_manifest.read_bytes() != journal.read_bytes():
        raise ContractError("node transaction journal and staged manifest disagree")
    if _contained(root / str(manifest.get("graph_path", "")), root, exists=True) != graph_path:
        raise ContractError("node transaction graph identity mismatch")
    _contained(root / str(manifest.get("artifact_path", "")), root, exists=False)
    return transaction_dir, manifest


def _remove_transaction(journal: Path, transaction_dir: Path) -> None:
    try:
        journal.unlink()
    except FileNotFoundError:
        pass
    directory = os.open(journal.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    for child in transaction_dir.iterdir():
        if child.is_file():
            child.unlink()
    transaction_dir.rmdir()
    try:
        transaction_dir.parent.rmdir()
    except OSError:
        pass


def recover_pending_transaction(root: Path, graph_path: Path) -> bool:
    """Roll an unacknowledged transaction back to its durable before-image."""
    root = root.resolve(strict=True)
    graph_path = _contained(graph_path, root, exists=True)
    loaded = _load_journal(root, graph_path)
    if loaded is None:
        return False
    transaction_dir, manifest = loaded
    artifact_path = _contained(root / str(manifest["artifact_path"]), root, exists=False)
    if manifest.get("graph_changed"):
        graph_before = (transaction_dir / "graph.before").read_bytes()
        if _sha256(graph_before) != manifest.get("graph_sha256_before"):
            raise ContractError("staged graph rollback image digest mismatch")
        _atomic_bytes(graph_path, graph_before)
    if manifest.get("artifact_changed"):
        if manifest.get("artifact_existed"):
            artifact_before = (transaction_dir / "artifact.before").read_bytes()
            if _sha256(artifact_before) != manifest.get("artifact_sha256_before"):
                raise ContractError("staged artifact rollback image digest mismatch")
            _atomic_bytes(artifact_path, artifact_before)
        else:
            try:
                artifact_path.unlink()
            except FileNotFoundError:
                pass
            _fsync_directory(artifact_path.parent)
    if _sha256(graph_path.read_bytes()) != manifest.get("graph_sha256_before"):
        raise ContractError("node transaction graph rollback did not converge")
    if manifest.get("artifact_existed"):
        if not artifact_path.is_file() or _sha256(artifact_path.read_bytes()) != manifest.get("artifact_sha256_before"):
            raise ContractError("node transaction artifact rollback did not converge")
    elif artifact_path.exists():
        raise ContractError("node transaction artifact rollback did not remove the new artifact")
    _remove_transaction(journal_path(graph_path), transaction_dir)
    return True


def finalize_transaction(root: Path, graph_path: Path) -> None:
    """Acknowledge a commit only after both durable after-images are visible."""
    root = root.resolve(strict=True)
    graph_path = _contained(graph_path, root, exists=True)
    loaded = _load_journal(root, graph_path)
    if loaded is None:
        raise ContractError("node transaction journal disappeared before commit acknowledgement")
    transaction_dir, manifest = loaded
    artifact_path = _contained(root / str(manifest["artifact_path"]), root, exists=True)
    if _sha256(graph_path.read_bytes()) != manifest.get("graph_sha256_after"):
        raise ContractError("node transaction graph commit digest mismatch")
    if _sha256(artifact_path.read_bytes()) != manifest.get("artifact_sha256_after"):
        raise ContractError("node transaction artifact commit digest mismatch")
    _remove_transaction(journal_path(graph_path), transaction_dir)
