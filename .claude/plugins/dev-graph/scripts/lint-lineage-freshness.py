#!/usr/bin/env python3
# /// script
# name: lint-lineage-freshness
# purpose: 登録後に崩れた確定の裏付け (仕様章 digest の腐食・未確定のまま閉じた node) を graph 全体に対し fail-closed 検出する。
# inputs: [argv --repo-root --graph --baseline --json-out --emit-baseline]
# outputs: [stdout JSON {lint, node_count, lineage_checked, violations, violation_count, baselined, exit_code}, exit 0 ok / 2 violation / 1 error]
# contexts: [E]
# network: false
# write-scope: --json-out / --emit-baseline 指定時のみ
# dependencies: [../lib/lineage_freshness.py]
# requires-python: ">=3.11"
# ///
"""登録時にしか見ていない lineage 契約を、graph 全体に対して毎回検査する CLI。

``validate-source-digest.py`` は登録時にしか digest を見ない。よって仕様章が
再生成されると既存 node の lineage が黙って腐る。本 lint はその腐食と、
確定手続きを通らずに閉じた node を検出する。検査 rule (LF-001/002/003)、
task kind を除く理由、baseline の鍵の取り方の根拠は
``../lib/lineage_freshness.py`` の docstring が正本。

``--emit-baseline`` は現在の違反をそのまま凍結ファイルへ書き出す。導入時に
一度だけ使う。既存の腐食を violation にしたまま放置すると lint が常時赤になり、
赤が普通になった時点で検査は死ぬ。凍結は「今あるものを見えるまま止める」ため
であって、消すためではない。**凍結は縮小のみが正。**

Exit codes:
  0  違反 0 件 (baselined は exit に寄与しない)
  1  一般エラー
  2  違反検出 (fail-closed)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

LIB_DIR = str(Path(__file__).resolve().parents[1] / "lib")
if LIB_DIR not in sys.path:
    sys.path.insert(0, LIB_DIR)

from lineage_freshness import (  # noqa: E402
    LINT_NAME,
    LintError,
    lineage_key,
    lint,
    load_baseline,
)


def _build_baseline(result: dict) -> dict:
    """現在の未解消分を凍結形へ畳む。凍結の規律は _comment としてデータ側に置く。

    violations だけでなく **既に凍結済みの分 (baselined) も併せて**書き出す。
    violations だけを見ると、既存 baseline を効かせた状態で再 emit したときに
    凍結済みの行が黙って消え、次の run で一斉に赤くなる。emit は冪等であること。
    """
    findings = [*result["violations"], *result["baselined"]]
    unconfirmed = sorted(
        {v["baseline_key"] for v in findings if v["rule"] == "LF-001"}
    )
    lineage = sorted(
        {
            v.get("baseline_key")
            or lineage_key(v["graph_node_id"], v.get("recorded_digest", ""), "<missing>")
            for v in findings
            if v["rule"] in ("LF-002", "LF-003")
        }
    )
    return {
        "_comment": (
            "lint-lineage-freshness の既知違反。導入時点で既に溜まっていた分だけを凍結し、"
            "新規発生を fail-closed にするためのデータ。**縮小のみが正**で、"
            "増やす変更は本検査の目的を無効化するためレビューで拒否すること。"
            "鍵にはその時に見た状態値を含める。lineage は "
            "<node_id>:<記録digest>:<実際digest> で、章がもう一度書き換われば再び鳴る。"
            "未確定 close は <node_id>:<confirmation_status>:<evaluation_status> で、"
            "evaluation_status が pending (未評価) から fail (評価して落ちた) へ"
            "変われば再び鳴る。node id 単独で凍結してはならない (永久凍結になる)。"
        ),
        "baselined_unconfirmed_closures": unconfirmed,
        "baselined_stale_lineage": lineage,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--graph", type=Path, default=None)
    parser.add_argument("--baseline", type=Path, default=None,
                        help="既知違反の baseline JSON (既定は repo-root 相対の規約 path)")
    parser.add_argument("--json-out", type=Path, default=None)
    parser.add_argument("--emit-baseline", type=Path, default=None,
                        help="現在の違反を凍結ファイルとして書き出す (導入時に一度だけ)")
    args = parser.parse_args(argv)

    try:
        root = args.repo_root.resolve(strict=True)
        graph_path = args.graph or root / ".dev-graph" / "state" / "graph.json"
        unconfirmed, stale, source = load_baseline(root, args.baseline)
        result = lint(graph_path, root, unconfirmed, stale, source)
    except (LintError, OSError) as exc:
        print(f"[{LINT_NAME}] ERROR: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")

    if args.emit_baseline:
        payload = _build_baseline(result)
        args.emit_baseline.parent.mkdir(parents=True, exist_ok=True)
        args.emit_baseline.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(
            f"[{LINT_NAME}] baseline を書き出しました: {args.emit_baseline} "
            f"(未確定 close {len(payload['baselined_unconfirmed_closures'])} 件 / "
            f"lineage 腐食 {len(payload['baselined_stale_lineage'])} 件)",
            file=sys.stderr,
        )

    if result["violation_count"]:
        by_rule: dict[str, int] = {}
        for v in result["violations"]:
            by_rule[v["rule"]] = by_rule.get(v["rule"], 0) + 1
        detail = " / ".join(f"{r} {c} 件" for r, c in sorted(by_rule.items()))
        print(
            f"[{LINT_NAME}] FAIL: 新規違反 {result['violation_count']} 件 ({detail}) "
            f"— {result['node_count']} node 走査 / lineage 検査 {result['lineage_checked']} 件 "
            f"/ 既知凍結 {result['baselined_count']} 件",
            file=sys.stderr,
        )
    else:
        print(
            f"[{LINT_NAME}] OK: 新規違反 0 件 "
            f"({result['node_count']} node 走査 / lineage 一致 {result['lineage_matched']}"
            f"/{result['lineage_checked']} / 既知凍結 {result['baselined_count']} 件)",
            file=sys.stderr,
        )
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
