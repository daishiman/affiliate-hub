#!/usr/bin/env python3
# /// script
# name: test-qa-retraction
# version: 0.1.0
# purpose: 「書くべきでなかった記録」を正本から外す writer (retract-qa) の受入テスト。
#          取り下げを「都合の悪い記録を消す道具」にしないための 4 つの門と、
#          消さずに retracted_qa_log へ丸ごと移す性質を固定する。
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
"""誤りは、経過ではない。後継として残すと契約を守れない entry が永久に残る。"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
WRITER_DIR = PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts"
sys.path.insert(0, str(WRITER_DIR))
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402


def _state(**matrix) -> dict:
    """`qa-bad` は誰からも引かれていない前提の骨格。門ごとに呼び出し側で足す。"""
    return {
        "matrix": matrix,
        "qa_log": [
            {"id": "qa-bad", "question": "q", "answer": "a", "source": {"kind": "written-requirements"}},
            {"id": "qa-good", "question": "q", "answer": "a"},
        ],
    }


REASON = "source に written-requirements を名乗りながら引用先の path も指紋も持たず、REQ-TS20 を満たせない"


def test_the_entry_moves_out_of_the_log_and_is_kept_whole():
    """**消さない。**消すと「無かったこと」と「取り下げたこと」が同じ姿になる。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    stm.retract_qa(state, "qa-bad", REASON)

    assert [c["id"] for c in state["qa_log"]] == ["qa-good"]
    moved = state["retracted_qa_log"]
    assert len(moved) == 1
    assert moved[0]["id"] == "qa-bad"
    assert moved[0]["reason"] == REASON
    assert moved[0]["retracted_with"] == stm.RETRACT_QA_WRITER
    # 原文がそのまま在ること。要約や抜粋にすると、外した判断を後から検算できない。
    assert moved[0]["entry"]["source"] == {"kind": "written-requirements"}
    assert moved[0]["entry"]["answer"] == "a"


def test_reapplying_the_same_reason_is_idempotent():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    stm.retract_qa(state, "qa-bad", REASON)
    stm.retract_qa(state, "qa-bad", REASON)
    assert len(state["retracted_qa_log"]) == 1


def test_changing_the_reason_afterwards_is_refused():
    """理由を上書きできると、取り下げの欄が後から書き換えられる場所になる。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    stm.retract_qa(state, "qa-bad", REASON)
    with pytest.raises(TransitionError, match="異なる再適用は拒否"):
        stm.retract_qa(state, "qa-bad", "気が変わったので")


def test_a_reason_is_required():
    """理由の無い取り下げは、記録を消したのと区別が付かない。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    for empty in ("", "   ", None):
        with pytest.raises(TransitionError, match="reason は非空文字列必須"):
            stm.retract_qa(state, "qa-bad", empty)


def test_an_entry_still_cited_by_a_cell_cannot_be_retracted():
    """引かれているものを外すと、確定セルの根拠が黙って死ぬ。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-bad"}})
    with pytest.raises(TransitionError, match="まだセルから引かれている"):
        stm.retract_qa(state, "qa-bad", REASON)


def test_backing_refs_also_count_as_being_cited():
    """裏付け (`qa_refs`) を見落とすと、生きている質疑を孤立と誤判定する。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good", "qa_refs": ["qa-bad"]}})
    with pytest.raises(TransitionError, match="まだセルから引かれている"):
        stm.retract_qa(state, "qa-bad", REASON)


def test_an_entry_named_as_a_successor_cannot_be_retracted():
    """名指しの先が消えると、後継の申告そのものが宙に浮く。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    state["qa_log"][1]["superseded_by"] = "qa-bad"
    with pytest.raises(TransitionError, match="後継として名指し"):
        stm.retract_qa(state, "qa-bad", REASON)


def test_an_entry_already_written_up_cannot_be_retracted():
    """書き起こした先だけが裏付けを失って残る形を作らない。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    state["qa_log"][0]["written_up"] = [{"path": "system-spec/backend.md"}]
    with pytest.raises(TransitionError, match="written_up"):
        stm.retract_qa(state, "qa-bad", REASON)


def test_an_unknown_id_is_refused():
    """存在しない id を通すと、取り下げの記録が実体の無い id で埋まる。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    with pytest.raises(TransitionError, match="qa_log に存在しない"):
        stm.retract_qa(state, "qa-ghost", REASON)


def test_retraction_is_not_supersession():
    """**取り下げは後継の申告ではない。**superseded_by を勝手に生やさない。

    誤りを後継として残すと、正本には守れていない契約を名乗る entry が残り、
    それを見張っている検査は二度と緑にならない。だから外した entry には
    「置き換えた」ではなく「外した」だけが書かれる。
    """
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-good"}})
    stm.retract_qa(state, "qa-bad", REASON)
    assert "superseded_by" not in state["retracted_qa_log"][0]["entry"]
    assert all("superseded_by" not in c for c in state["qa_log"])
