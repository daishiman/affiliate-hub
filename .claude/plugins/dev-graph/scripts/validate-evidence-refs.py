#!/usr/bin/env python3
# /// script
# name: validate-evidence-refs
# purpose: graph 全 node の confirmation_evidence.evidence_ref 実在を走査し、既存 dangling を progress へ自動転記する決定論ゲート (R3-import の完了条件)。
# inputs: [argv --repo-root --graph --registered --progress]
# outputs: [stdout JSON {registered_dangling, existing_dangling}, --progress 指定時は evidence_ref_audit を書戻し, exit 0 ok, exit 2 fail-closed]
# contexts: [E]
# network: false
# write-scope: caller-repo/eval-log (--progress 指定時のみ)
# requires-python: ">=3.11"
# ///
"""evidence_ref の dangling を機械検査する R3-import の完了ゲート。

散文の checklist は「読んだが実行しない」抜け道を許すため、検査そのものを
skill のゴールシーク検証ブロック (毎周回実行) から本 script 1 行の実行に係留する。

- `--progress <progress.json>`: 本 run の登録 node id を progress.json の
  `registered_this_run` から自動取得し、監査結果を同 file の `evidence_ref_audit`
  へ自動転記する。これにより「既存 dangling の報告を握り潰す」経路も塞ぐ
  (転記は LLM でなく本 script が決定論で行う)。
- `--registered` (カンマ区切り) は progress より優先の明示指定。両方あれば和集合。
- 本 run が登録・更新した node に dangling があれば exit 2 (fail-closed)。
- それ以外の既存 node の dangling は `existing_dangling` として報告 (exit 0)。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


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
    parser.add_argument("--registered", default="", help="本 run が登録・更新した node id (カンマ区切り)")
    parser.add_argument("--progress", type=Path, default=None,
                        help="progress.json。registered_this_run を読み evidence_ref_audit を書戻す")
    args = parser.parse_args()
    root = args.repo_root.resolve()
    graph_path = args.graph if args.graph else root / ".dev-graph" / "state" / "graph.json"

    try:
        graph = json.loads(graph_path.read_text(encoding="utf-8"))
        nodes = graph["nodes"]
    except Exception as exc:
        print(f"[validate-evidence-refs] FAIL: graph を読めない: {exc}", file=sys.stderr)
        return 2

    registered = {s.strip() for s in args.registered.split(",") if s.strip()}
    if args.progress:
        registered |= _registered_from_progress(args.progress)

    registered_dangling: list[dict] = []
    existing_dangling: list[dict] = []
    scanned = 0
    for node in nodes:
        if not isinstance(node, dict):
            continue
        ce = node.get("confirmation_evidence")
        ref = ce.get("evidence_ref") if isinstance(ce, dict) else None
        if not ref:
            continue
        scanned += 1
        node_id = str(node.get("graph_node_id", "?"))
        if (root / str(ref)).is_file():
            continue
        entry = {"graph_node_id": node_id, "evidence_ref": str(ref)}
        (registered_dangling if node_id in registered else existing_dangling).append(entry)

    audit = {
        "scanned_nodes_with_evidence": scanned,
        "registered_dangling": registered_dangling,
        "existing_dangling": existing_dangling,
    }
    print(json.dumps(audit, ensure_ascii=False, indent=2))

    # 既存 dangling の報告を LLM の転記に委ねず、本 script が progress.json へ書戻す。
    if args.progress and args.progress.is_file():
        try:
            data = json.loads(args.progress.read_text(encoding="utf-8"))
            data["evidence_ref_audit"] = audit
            args.progress.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        except Exception as exc:
            print(f"[validate-evidence-refs] WARN: progress 書戻し失敗: {exc}", file=sys.stderr)

    if registered_dangling:
        print(
            f"[validate-evidence-refs] FAIL: 本 run 登録分に dangling {len(registered_dangling)} 件",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
