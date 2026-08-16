#!/usr/bin/env python3
# /// script
# name: audit-live-trial-state
# purpose: Snapshot managed repository state around a live trial and prove mutation suppression by diff.
# inputs: imported Python API (repo_root, audit implementation identity)
# outputs: state snapshot / state comparison dicts
# requires-python = ">=3.10"
# dependencies: []
# contexts: [A, B, C, E]
# network: false
# write-scope: none
# ///
"""live-trial の「管理対象状態が動いていないこと」だけを測る層。

シナリオ固有の受け入れ測定 (audit_decompose_live_trial.py) から、状態 snapshot と
before/after 比較を切り出した module。snapshot は skill 実行の前後で完全に同じ手順を
踏まないと差分判定が成立しないため、測定側と混ぜず単独で再利用できる形に保つ。

命名は §4.4 例外節 (audit_*.py) に従う。sibling から importlib で読み込まれるため
ハイフン命名 (§4.3) は適用できない。
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any


class AuditError(RuntimeError):
    """監査入力または安全条件の違反。"""


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AuditError(f"JSON object required: {path}")
    return value


def write_object(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


def identity_of(source: Path) -> dict[str, Any]:
    """監査 module 1 本の同一性を git index に束縛して返す。

    sha256 だけでは「試験中に書いた監査コード」を排除できないため、index blob と
    worktree blob の一致まで測る。index に無い / worktree と違う監査コードは
    「試験前に commit 済み」を主張できない。
    """
    module = source.resolve(strict=True)
    completed = subprocess.run(
        ["git", "-C", str(module.parent), "rev-parse", "--show-toplevel"],
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != os.EX_OK:
        raise AuditError(f"cannot resolve helper source repository: {completed.stderr.strip()}")
    source_root = Path(completed.stdout.strip()).resolve(strict=True)
    relative = module.relative_to(source_root).as_posix()
    staged = subprocess.run(
        ["git", "-C", str(source_root), "ls-files", "--stage", "--", relative],
        text=True,
        capture_output=True,
        check=False,
    )
    fields = staged.stdout.strip().split()
    index_blob = fields[1] if staged.returncode == os.EX_OK and len(fields) >= 4 else None
    current_blob = subprocess.run(
        ["git", "-C", str(source_root), "hash-object", "--", relative],
        text=True,
        capture_output=True,
        check=False,
    )
    worktree_blob = current_blob.stdout.strip() if current_blob.returncode == os.EX_OK else None
    return {
        "path": relative,
        "sha256": sha256_of(module),
        "tracked_in_index": index_blob is not None,
        "index_blob": index_blob,
        "worktree_blob": worktree_blob,
        "index_matches_worktree": index_blob is not None and index_blob == worktree_blob,
    }


def composite_identity(sources: list[Path]) -> dict[str, Any]:
    """監査実装を構成する全 module の同一性を 1 つの合成 identity に束ねる。

    監査ヘルパーを責務分割した結果、どれか 1 本でも試験中に書き換えられたら provenance が
    崩れる。代表 path は再現コマンドの入口 (sources[0]) を残しつつ、sha256 は path 昇順の
    module digest 列に対する合成 digest とし、tracked/matches は全 module の論理積にする。
    """
    if not sources:
        raise AuditError("composite identity requires at least one module")
    modules = [identity_of(source) for source in sources]
    ordered = sorted(modules, key=lambda module: module["path"])
    composite = hashlib.sha256()
    for module in ordered:
        composite.update(f"{module['path']}\0{module['sha256']}\0".encode("utf-8"))
    return {
        "path": modules[0]["path"],
        "sha256": composite.hexdigest(),
        "modules": ordered,
        "tracked_in_index": all(module["tracked_in_index"] for module in modules),
        "index_matches_worktree": all(module["index_matches_worktree"] for module in modules),
    }


def run_json(argv: list[str], *, stdin: str | None = None) -> dict[str, Any]:
    completed = subprocess.run(
        argv,
        input=stdin,
        text=True,
        capture_output=True,
        check=False,
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        detail = (completed.stderr or completed.stdout).strip()
        raise AuditError(f"command returned invalid JSON ({completed.returncode}): {detail}") from exc
    if not isinstance(payload, dict):
        raise AuditError(f"command JSON must be an object: {' '.join(argv)}")
    return {
        "argv": argv,
        "returncode": completed.returncode,
        "payload": payload,
        "stderr": completed.stderr.strip(),
    }


def git_status(repo_root: Path) -> dict[str, list[dict[str, str]]]:
    """porcelain=v1 -z を厳密に読み、証跡ディレクトリ (eval-log/) を管理対象から除く。

    live-trial は eval-log/ 配下に証跡を書きながら走るため、そこを含めると常に差分が
    出て mutation 抑止の判定が成立しない。除外は eval-log/ のみに限定する。
    """
    completed = subprocess.run(
        ["git", "-C", str(repo_root), "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != os.EX_OK:
        raise AuditError(f"git status failed: {completed.stderr.strip()}")
    entries: list[dict[str, str]] = []
    chunks = completed.stdout.split("\0")
    index = 0
    while index < len(chunks):
        chunk = chunks[index]
        index += 1
        if not chunk:
            continue
        status = chunk[:2]
        path = chunk[3:]
        entry = {"status": status, "path": path}
        # rename/copy は「新 path\0旧 path」の 2 レコードで来るため次要素も消費する。
        if status[0] in {"R", "C"} and index < len(chunks):
            entry["source_path"] = chunks[index]
            index += 1
        entries.append(entry)
    managed = [entry for entry in entries if not entry["path"].startswith("eval-log/")]
    return {"all": entries, "managed": managed}


def content_inventory(repo_root: Path, config: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    roots = config.get("content_roots")
    if not isinstance(roots, dict) or not all(isinstance(value, str) for value in roots.values()):
        raise AuditError("config.content_roots must be a string map")
    result: dict[str, list[dict[str, Any]]] = {}
    for logical_name, relative in sorted(roots.items()):
        root = repo_root / relative
        files = []
        if root.is_dir():
            files = [
                {
                    "path": path.relative_to(repo_root).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": sha256_of(path),
                }
                for path in sorted(root.rglob("*"))
                if path.is_file()
            ]
        result[logical_name] = files
    return result


BEADS_EXPORT_PATH = ".beads/issues.jsonl"


def publication_inventory(
    repo_root: Path, config: dict[str, Any], nodes: list[dict[str, Any]]
) -> dict[str, Any]:
    """起票 (tracker publication) の実数を run 前後で同じ手順から数える。

    「draft の Issue 起票 0 件」は bridge が返す ``dry_run`` エコーで測ってはいけない。
    エコーは「adapter に dry-run を渡した」ことしか言わず、ゲートが止めたのか flag が
    止めたのかを区別できないからである。ここでは実際に増えた成果物だけを数える:

    - ``issues/`` 配下のファイル (binding=none でローカルに現れる起票物)
    - ``.beads/issues.jsonl`` の record (binding=beads の投影先)
    - graph node の ``issue_linkage`` / ``beads_linkage`` / ``github_project_linkages``
      (binding=github は外部 API を叩かずに投影の有無をローカル観測できる唯一の面)
    """
    roots = config.get("content_roots")
    if not isinstance(roots, dict):
        raise AuditError("config.content_roots must be a map")
    issues_relative = roots.get("issues")
    if not isinstance(issues_relative, str):
        raise AuditError("config.content_roots.issues must be a string")
    issues_root = repo_root / issues_relative
    issue_paths = (
        sorted(
            path.relative_to(repo_root).as_posix()
            for path in issues_root.rglob("*")
            if path.is_file()
        )
        if issues_root.is_dir()
        else []
    )
    beads_path = repo_root / BEADS_EXPORT_PATH
    beads_ids: list[str] = []
    if beads_path.is_file():
        for line in beads_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            try:
                record = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise AuditError(f"beads export holds a non-JSON line: {BEADS_EXPORT_PATH}") from exc
            identifier = record.get("id") if isinstance(record, dict) else None
            beads_ids.append(identifier if isinstance(identifier, str) else stripped[:64])
    linkages = {
        node["graph_node_id"]: {
            "issue_linkage": node.get("issue_linkage") is not None,
            "beads_linkage": node.get("beads_linkage") is not None,
            "github_project_linkages": len(node.get("github_project_linkages") or []),
        }
        for node in nodes
        if isinstance(node, dict) and isinstance(node.get("graph_node_id"), str)
    }
    return {
        "issues": {"root": issues_relative, "paths": issue_paths, "count": len(issue_paths)},
        "beads_export": {
            "path": BEADS_EXPORT_PATH,
            "exists": beads_path.is_file(),
            "ids": sorted(beads_ids),
            "count": len(beads_ids),
        },
        "node_linkages": linkages,
    }


def capture_state(repo_root: Path, *, audit_implementation: dict[str, Any]) -> dict[str, Any]:
    config_path = repo_root / ".dev-graph/config.json"
    config = load_object(config_path)
    graph_relative = ((config.get("local_state") or {}).get("graph"))
    if not isinstance(graph_relative, str):
        raise AuditError("config.local_state.graph must be a string")
    graph_path = repo_root / graph_relative
    graph = load_object(graph_path)
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        raise AuditError("graph.nodes must be an array")
    return {
        "repo_root": str(repo_root),
        "audit_implementation": audit_implementation,
        "config": {
            "path": config_path.relative_to(repo_root).as_posix(),
            "sha256": sha256_of(config_path),
        },
        "graph": {
            "path": graph_path.relative_to(repo_root).as_posix(),
            "sha256": sha256_of(graph_path),
            "revision": graph.get("graph_revision"),
            "node_count": len(nodes),
        },
        "content_inventory": content_inventory(repo_root, config),
        "publication_inventory": publication_inventory(repo_root, config, nodes),
        "git_status": git_status(repo_root),
    }


def _multiset_added(before: list[str], after: list[str]) -> list[str]:
    """after にだけ現れた要素を重複込みで返す (同一 id の複数追加を潰さない)。"""
    remaining = Counter(before)
    added: list[str] = []
    for value in after:
        if remaining.get(value):
            remaining[value] -= 1
            continue
        added.append(value)
    return sorted(added)


def publication_delta(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """run 前後の起票実数の差分。write count の唯一の導出元。"""
    for snapshot, label in ((before, "pre-state"), (after, "post-state")):
        if not isinstance(snapshot.get("publication_inventory"), dict):
            raise AuditError(
                f"{label} lacks publication_inventory; re-capture the snapshot with the current audit modules"
            )
    pre = before["publication_inventory"]
    post = after["publication_inventory"]
    added_issues = _multiset_added(pre["issues"]["paths"], post["issues"]["paths"])
    added_beads = _multiset_added(pre["beads_export"]["ids"], post["beads_export"]["ids"])
    pre_links = pre["node_linkages"]
    linked_nodes = {"beads": [], "github": []}
    for node_id, link in sorted(post["node_linkages"].items()):
        baseline = pre_links.get(node_id) or {
            "issue_linkage": False,
            "beads_linkage": False,
            "github_project_linkages": 0,
        }
        if link["beads_linkage"] and not baseline["beads_linkage"]:
            linked_nodes["beads"].append(node_id)
        gained_issue = link["issue_linkage"] and not baseline["issue_linkage"]
        gained_project = link["github_project_linkages"] > baseline["github_project_linkages"]
        if gained_issue or gained_project:
            linked_nodes["github"].append(node_id)
    return {
        "issues": {"added": added_issues, "added_count": len(added_issues)},
        "beads_export": {"added": added_beads, "added_count": len(added_beads)},
        "linked_nodes": linked_nodes,
    }


def state_comparison(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    delta = publication_delta(before, after)
    checks = {
        "config_sha_unchanged": before["config"]["sha256"] == after["config"]["sha256"],
        "graph_sha_unchanged": before["graph"]["sha256"] == after["graph"]["sha256"],
        "graph_revision_unchanged": before["graph"]["revision"] == after["graph"]["revision"],
        "graph_node_count_unchanged": before["graph"]["node_count"] == after["graph"]["node_count"],
        "content_inventory_unchanged": before["content_inventory"] == after["content_inventory"],
        "publication_inventory_unchanged": (
            before["publication_inventory"] == after["publication_inventory"]
        ),
        "managed_git_status_unchanged": (
            before["git_status"]["managed"] == after["git_status"]["managed"]
        ),
    }
    return {
        "checks": checks,
        "mutation_suppressed": all(checks.values()),
        "publication_delta": delta,
        "before": before,
        "after": after,
    }
