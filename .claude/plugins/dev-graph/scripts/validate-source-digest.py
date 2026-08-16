#!/usr/bin/env python3
# /// script
# name: validate-source-digest
# purpose: 本 run 登録 node の source_lineage.source_digest が自 source_path の実 file sha256 と一致するか検査する決定論ゲート (R3-import の完了条件)。
# inputs: [argv --repo-root --graph --registered --progress]
# outputs: [stdout JSON {registered_mismatch}, exit 0 ok, exit 2 fail-closed]
# contexts: [E]
# network: false
# write-scope: none
# dependencies: [resolve-repo-context.py]
# requires-python: ">=3.11"
# ///
"""source_digest の他 file 流用を機械検査する R3-import の完了ゲート。

r8 で「index.md の digest を全 node に流用」する failure mode を検出したため、
散文 checklist ではなく本 script の exit code へ完了条件を係留する。
各 registered node の `source_lineage.source_digest` が、その node 固有の
`source_path` の実 file の sha256 と一致することを検証する。1 件でも不一致
(または source_path 不在) なら exit 2 (fail-closed)。

registered は `--registered` (カンマ区切り) と `--progress` の
`registered_this_run` の和集合。既存 node の digest は本 run の責務外のため検査しない。
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _context_resolver():
    """dev-graph C24 の repository boundary 実装を再利用する。"""
    spec = importlib.util.spec_from_file_location("dev_graph_source_digest_context", HERE / "resolve-repo-context.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def _package_root(root: Path, source: Path) -> Path | None:
    """source_path を含む published package (staging-manifest.json を持つ dir) を探す。

    system-dev-planner 由来 node の source_lineage.source_digest は個々の task spec
    ではなく package (content-addressed generation) の canonical digest を指す。
    package 単位の lineage と per-file の不変性を 1 つの manifest で両方照合するため、
    まず所属 package を決める。
    """
    current = source.parent
    while current != root and root in current.parents:
        if (current / "staging-manifest.json").is_file():
            return current
        current = current.parent
    return None


def _package_mismatch(package: Path, source: Path, recorded: str) -> dict | None:
    """package canonical digest と、その package 内 file の実バイトを 2 段で照合する。"""
    try:
        manifest = json.loads((package / "staging-manifest.json").read_text(encoding="utf-8"))
        files = manifest["files"]
        canonical = str(manifest["canonical_digest"])
    except Exception as exc:  # noqa: BLE001 - 診断へ理由を載せる
        return {"reason": f"package staging-manifest.json を読めない: {exc}"}
    if canonical.removeprefix("sha256:") != recorded:
        return {"recorded_digest": recorded, "actual_digest": canonical.removeprefix("sha256:"),
                "reason": "package canonical digest 不一致 (別 package の digest 流用の疑い)"}
    rel = source.relative_to(package).as_posix()
    expected = files.get(rel) if isinstance(files, dict) else next(
        (x.get("sha256") for x in files if isinstance(x, dict) and x.get("path") == rel), None)
    if not isinstance(expected, str):
        return {"reason": f"source_path が package manifest に載っていない: {rel}"}
    actual = hashlib.sha256(source.read_bytes()).hexdigest()
    if actual != expected.removeprefix("sha256:"):
        return {"recorded_digest": expected.removeprefix("sha256:"), "actual_digest": actual,
                "reason": "package 内 file の実バイトが manifest と不一致 (immutable generation の改変)"}
    return None


def _registered_from_progress(progress_path: Path) -> set[str]:
    try:
        data = json.loads(progress_path.read_text(encoding="utf-8"))
    except Exception:
        return set()
    ids = data.get("registered_this_run")
    return {str(x).strip() for x in ids if str(x).strip()} if isinstance(ids, list) else set()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--graph", type=Path, default=None)
    parser.add_argument("--registered", default="")
    parser.add_argument("--progress", type=Path, default=None)
    args = parser.parse_args()
    root = args.repo_root.resolve()
    context = _context_resolver()
    graph_path = args.graph if args.graph else root / ".dev-graph" / "state" / "graph.json"

    try:
        graph = json.loads(graph_path.read_text(encoding="utf-8"))
        nodes = graph["nodes"]
    except Exception as exc:
        print(f"[validate-source-digest] FAIL: graph を読めない: {exc}", file=sys.stderr)
        return 2

    registered = {s.strip() for s in args.registered.split(",") if s.strip()}
    if args.progress:
        registered |= _registered_from_progress(args.progress)

    mismatch: list[dict] = []
    checked = 0
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("graph_node_id", "?"))
        if node_id not in registered:
            continue
        sl = node.get("source_lineage")
        if not isinstance(sl, dict):
            continue
        source_path = sl.get("source_path")
        recorded = sl.get("source_digest")
        if not source_path or not recorded:
            mismatch.append({"graph_node_id": node_id, "reason": "source_path/source_digest 欠落"})
            continue
        checked += 1
        try:
            target = context.resolve_declared_path(
                root,
                str(source_path),
                f"{node_id}.source_lineage.source_path",
                reject_leaf_symlink=False,
            )
        except (context.ContractError, OSError, ValueError) as exc:
            mismatch.append({"graph_node_id": node_id, "source_path": str(source_path),
                             "reason": f"source_path がrepository boundary 外: {exc}"})
            continue
        if not target.is_file():
            mismatch.append({"graph_node_id": node_id, "source_path": str(source_path),
                             "reason": "source_path 実 file 不在"})
            continue
        planner_origin = sl.get("origin_kind") == "system-dev-planner"
        package = _package_root(root, target) if planner_origin else None
        if planner_origin and package is None:
            mismatch.append({"graph_node_id": node_id, "source_path": str(source_path),
                             "reason": "system-dev-planner 由来 source のpackage staging-manifest.json が無い"})
            continue
        if package is not None:
            found = _package_mismatch(package, target, str(recorded))
            if found:
                mismatch.append({"graph_node_id": node_id, "source_path": str(source_path),
                                 "package": package.relative_to(root).as_posix(), **found})
            continue
        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        if actual != str(recorded):
            mismatch.append({"graph_node_id": node_id, "source_path": str(source_path),
                             "recorded_digest": str(recorded), "actual_digest": actual,
                             "reason": "digest 不一致 (他 file 流用の疑い)"})

    print(json.dumps({"checked": checked, "registered_mismatch": mismatch},
                     ensure_ascii=False, indent=2))
    if mismatch:
        print(f"[validate-source-digest] FAIL: 本 run 登録分に digest 不一致 {len(mismatch)} 件",
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
