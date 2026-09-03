#!/usr/bin/env python3
# /// script
# name: test-compile-canonical-derivation
# version: 0.1.0
# purpose: 正本が持っているのに compile が黙っていた事実 (lifecycle.confirmed_semantics /
#          implementation_snapshot / U4-U5 の注記 / decisions の内訳 / cost_model /
#          セルの裏付け qa_refs / 設計知識の非規範断り) が、章へ機械的に出ることを固定する。
#          黙っている限り人が章へ手で書き足し、書き足したものは次の compile で消える。
# inputs:
#   - argv: pytest 収集 (引数なし)
# outputs:
#   - pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""章 = 正本の純関数。**正本が知っている事実は、章に必ず現れる。**

現れないと何が起きるかは実測済みである (2026-08-25): 現れない事実は 8 章のうち
7 章で人の手書きに置き換わっていた。手書きは正本が動いても動かず、compile を
回した日に黙って消える。ここで固定するのは「出ること」であって書式ではない。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

import spec_docset_foundation as fnd  # noqa: E402


def test_confirmed_semantics_is_taken_from_lifecycle_not_hand_written():
    spec = {"lifecycle": {"confirmed_semantics": "収集済みのみを表す"}}
    assert fnd._confirmed_semantics_suffix(spec) == " (収集済みのみを表す)"


def test_confirmed_semantics_absent_yields_nothing_rather_than_a_guess():
    """正本が黙っているときに機械が代わりに意味を決めない。"""
    assert fnd._confirmed_semantics_suffix({}) == ""
    assert fnd._confirmed_semantics_suffix({"lifecycle": {}}) == ""


def test_implementation_snapshot_renders_counts_and_capture_time():
    lines = fnd.render_implementation_snapshot(
        {
            "implementation_snapshot": {
                "captured_at": "2026-08-16T00:00:00+09:00",
                "current": ["単一D1", "案件一覧"],
                "planned_not_implemented": ["Workspace"],
                "basis": ["src/db/schema.ts"],
            }
        }
    )
    body = "\n".join(lines)
    assert "## 実装の現在地 (implementation_snapshot)" in body
    # 取得時刻が無いと、古い現在地が「いま」と読まれる。
    assert "2026-08-16T00:00:00+09:00" in body
    assert "### 実装済み (2 件)" in body and "### 未実装 (1 件)" in body
    assert "src/db/schema.ts" in body


def test_implementation_snapshot_absent_renders_nothing():
    assert fnd.render_implementation_snapshot({}) == []


@pytest.mark.parametrize("key", ["objectives_note", "success_criteria_note"])
def test_foundation_note_is_rendered_when_canonical_has_it(key):
    assert fnd._foundation_note({key: "根拠のない数値を確定しない"}, key) == [
        "",
        "根拠のない数値を確定しない",
    ]
    assert fnd._foundation_note({}, key) == []


def test_decision_tally_counts_instead_of_asking_the_reader_to_count():
    lines = fnd._decision_tally(
        [
            {"status": "confirmed", "user_decision": {"confirmed_at": "2026-08-19T00:00:00Z"}},
            {"status": "confirmed", "user_decision": {"confirmed_at": "2026-08-22T00:00:00Z"}},
            {"status": "needs_guidance"},
        ]
    )
    body = "\n".join(lines)
    assert "全 3 件" in body
    assert "`confirmed` 2 件" in body and "`needs_guidance` 1 件" in body
    assert "2026-08-19T00:00:00Z 〜 2026-08-22T00:00:00Z" in body


def test_cost_model_never_leaks_a_python_dict_repr():
    """dict をそのまま差し込むと表のセルに Python の repr が出る。"""
    text = fnd.render_cost_model(
        {"category": "free", "amount": 0, "currency": "JPY", "tco": "自前ホスティングのみ"}
    )
    assert "{" not in text and "'category'" not in text
    assert "無料" in text and "自前ホスティングのみ" in text


def test_cost_model_keeps_unknown_values_verbatim():
    """知らない値を勝手に日本語へ名付けない。"""
    assert "weird-category" in fnd.render_cost_model({"category": "weird-category"})


import spec_docset_chapters as chs  # noqa: E402


def _spec_with_cell(cell: dict) -> dict:
    return {
        "categories": [{"id": "backend", "label": "バックエンド"}],
        "matrix": {"backend": {"web": cell}},
    }


def test_state_table_derives_backing_qa_refs_instead_of_leaving_them_to_a_human():
    """裏付け質疑は正本 `qa_refs` に在る。表が黙ると章の側で人が書き足す。"""
    table = chs.render_state_table(
        _spec_with_cell(
            {
                "state": "確定",
                "qa_ref": "qa-backend-web-spec-intake",
                "qa_refs": ["qa-backend-web", "qa-backend-web-spec-intake", "qa-backend-web-v2"],
            }
        ),
        "backend",
    )
    assert "qa-backend-web-spec-intake" in table
    assert "`qa-backend-web`" in table and "`qa-backend-web-v2`" in table
    # 確定質疑そのものは裏付け側へ重複させない。
    assert table.count("qa-backend-web-spec-intake") == 1


def test_state_table_omits_the_backing_clause_when_there_is_nothing_to_back():
    table = chs.render_state_table(
        _spec_with_cell({"state": "確定", "qa_ref": "qa-x", "qa_refs": ["qa-x"]}), "backend"
    )
    assert "裏付け質疑" not in table


def test_design_knowledge_caveat_is_emitted_for_every_category():
    """`採否: applied` は設計採用であって実装済みではない。誤読は 2 章に限らない。"""
    for cat_id in ("backend", "database", "security", "ui-ux"):
        body = chs.render_design_refs(cat_id, {"matrix": {cat_id: {}}, "qa_log": []})
        assert "非規範" in body, cat_id
        assert "実装状態は意味しない" in body, cat_id
