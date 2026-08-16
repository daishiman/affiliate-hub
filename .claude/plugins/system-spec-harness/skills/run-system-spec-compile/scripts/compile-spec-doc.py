#!/usr/bin/env python3
# /// script
# name: compile-spec-doc
# version: 0.2.0
# purpose: run-system-spec-compile の決定論コンパイラ。収集済み spec-state.json と取得済み fetched-references.json・設計知識参照から、章別 Markdown 複数ファイル + index.md を組み立てる。各章 frontmatter に確定マーカー (status: confirmed/draft + spec_cells + category) を付与し (C11 hook の判定ソース)、カテゴリ別収集状態 (未着手/収集中/確定/対象外+理由) と最新ドキュメント出典を反映する。ヒアリング継続やドキュメント再取得はしない (入力を組み立てるのみ)。
# inputs:
#   - argv: compile --spec spec-state.json --references fetched-references.json [--out-dir system-spec]
# outputs:
#   - system-spec/<category>.md 章別 Markdown + system-spec/index.md
#   - exit: 0=OK / 1=入力/IO エラー / 2=usage error
# contexts: [C, E]
# network: false
# write-scope: system-spec/ (章別 Markdown + index.md のみ)
# dependencies: []
# requires-python: ">=3.9"
# ///
"""spec-state.json + fetched-references.json → 章立て仕様書ドキュメントセット (決定論)。

本モジュールは run-system-spec-compile の**単一 writer / 確定状態保全**の中核である。
確定章 (aggregate=確定/対象外 の終端カテゴリ) の frontmatter に `status: confirmed` を付与し、
C11 hook (guard-confirmed-chapter-overwrite) はこのマーカー + spec-state.json のセル状態を
判定ソースとして誤上書きを fail-closed で遮断する。本 writer は spec-state.json を書換えず
(ヒアリング継続やドキュメント再取得はしない)、入力を章へ組み立てる純関数群として実装する。

入力形状 (plugin 共有契約・apply-spec-transition.py / validate-coverage-matrix.py と一致):
  spec-state.json: categories / platforms / matrix / qa_log / approval_log /
                   category_aggregate / targets(target_id[, category])
  fetched-references.json: references[{target_id, source_url, official_host,
                   official_publisher, version|last_updated, retrieved_at, latest_checked_at, summary}]

出力形状 (C11 hook の判定ソース):
  各章 <category>.md の frontmatter に status(confirmed|draft) / category / aggregate /
  spec_cells([<cat>.<pf>, ...]) / serves_goals([G1, ...]) を付与し、本文にカテゴリ別収集状態表
  (未収集/対象外+理由/確定+qa_ref)・確定内容 (質疑録: 確定セルが参照する qa_log 本文の実体描画)・
  上流指針 (doctrine anchor: category→concern→authority, goal-spec C15)・設計知識参照ポインタ・
  最新ドキュメント出典表を含める。index.md が全章と集約状態を相互参照する。
  章の意味層は全て正本 (spec-state.json / registry / C04 card) からの純関数導出であり、
  再コンパイルで意味層が消えない (回帰しない) ことを受入テストが保証する。

要件 C9 (上位概念 anchor): spec-state.json の requirements_foundation (U1-U9) を
`00-requirements-definition.md` (要件定義書=憲法) として**最初の章**に生成し、各技術章 frontmatter
の serves_goals (セル serves_goals の集約) で全章を上位概念へトレース (anchor) する。index.md は
要件定義書を先頭に相互参照する。requirements_foundation 不在の spec-state でも空落ちせず draft 章を出す。
"""
from __future__ import annotations

import argparse
import heapq
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


LIB_DIR = Path(__file__).resolve().parents[3] / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

from spec_docset_catalog import *
from spec_docset_catalog import _category_ids, _knowledge_catalog, _knowledge_topo_order, _ref_host, _ref_version
from spec_docset_chapters import *
from spec_docset_foundation import *

# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #
def load_json(path_str: str) -> dict:
    return json.loads(Path(path_str).read_text(encoding="utf-8"))


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="spec-state.json + fetched-references.json → 章立て仕様書ドキュメントセット"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_compile = sub.add_parser("compile", help="章別 Markdown + index.md を組み立てる")
    p_compile.add_argument("--spec", required=True, help="spec-state.json のパス")
    p_compile.add_argument("--references", required=True, help="fetched-references.json のパス")
    p_compile.add_argument("--out-dir", default="system-spec", help="出力ディレクトリ (既定 system-spec)")
    args = ap.parse_args(argv)

    try:
        spec = load_json(args.spec)
        refs_data = load_json(args.references)
        docset = compile_docset(spec, refs_data)
        written = write_docset(docset, Path(args.out_dir))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"IO/JSON error: {exc}", file=sys.stderr)
        return 1
    except CompileError as exc:
        print(f"CompileError: {exc}", file=sys.stderr)
        return 1
    print(f"OK: {len(written)} ファイルを {args.out_dir}/ へ生成 " f"({', '.join(p.name for p in written)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
