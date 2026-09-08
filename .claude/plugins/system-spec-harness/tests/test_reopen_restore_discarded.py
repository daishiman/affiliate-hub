# /// script
# name: test-reopen-restore-discarded
# version: 0.1.0
# purpose: reopen が欄を数え上げずに退避すること、退避された欄を欄名を知らないまま戻す単一窓口が在ることを固定する pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""reopen で退避した欄が再確定で戻らない穴を、構造の側で塞ぐ (`ah-nuu`)。

**同じ形が 4 度起きている。** (1) `required_info` / `required_info_checks`、
(2) `qa_refs`、(3) 再び `required_info_checks` (確定 8 セル全てが 1 件から 0 件へ)、
(4) 2026-09-02 の infrastructure / maintenance-ops。毎回、直したのは症状 (消えた欄を
埋め戻す) であって原因ではなかった。原因は 2 つある:

  (A) **退避する欄がリテラルの一覧で書かれていた。**確定セルに新しい欄が生えたとき
      一覧へ載せ忘れると、その欄は reopen で黙って消える。
  (B) **戻す窓口が欄ごとに個別だった。**`restore-qa-refs` は `qa_refs` 専用、
      `set-serves` は `serves_goals` 専用。だから欄が増えるたびに同じ穴がもう 1 つ空き、
      「退避はされるが戻す道が無い欄」が作れてしまう (実際 `serves_intents` がそうだった)。

塞ぎ方はどちらも**欄を数え上げないこと**である。退避する側は除外する欄
(`CELL_MACHINE_FIELDS`) だけを挙げ、戻す側は `discarded` の鍵をそのまま辿る。
両側とも欄の名前を知らないので、**新しい欄が生えても穴が空かない**。

固定するのは 5 点:
(a) 一覧に無い欄も退避される (A の再発が構造的に起こり得ない)
(b) `restore-discarded` が退避欄をまとめて戻す (B の単一窓口)
(c) 再確定が自分で書いた値を退避値で上書きしない。食い違えば**何も書かずに止まる**
(d) `qa_refs` の付け替え防止 (`qa_refs[0]` は そのセルが引いている entry 自身) を
    単一窓口でも門にする
(e) 退避値と生きたセルが同じ list を共有しない (共有すると、退避された当時の姿を
    名乗る記録が現在の姿へ黙って追随する)
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
ELICIT_SCRIPTS = PLUGIN_ROOT / "skills/run-system-spec-elicit/scripts"
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402

PLATFORMS = list(stm.CANONICAL_PLATFORMS)
CELL = {"category": "database", "platform": "web"}
QA_ID = "qa-db-web"
OTHER_ID = "qa-db-other"


def _state() -> dict:
    """database/web だけ確定した最小 state。"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "database"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["qa_log"] = [
        {"id": QA_ID, "question": "q1", "answer": "答え 1"},
        {"id": OTHER_ID, "question": "q2", "answer": "答え 2"},
    ]
    stm.recompute_aggregates(state)
    stm.apply_cell_op(state, {"action": "confirm", **CELL, "qa_ref": QA_ID})
    return state


def _cell(state: dict) -> dict:
    return state["matrix"]["database"]["web"]


def _reopen(state: dict) -> None:
    stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "測定のため", "qa_ref": QA_ID})


def _reconfirm(state: dict, qa_ref: str = QA_ID, **over) -> None:
    op = {"action": "confirm", **CELL, "qa_ref": qa_ref, "reaffirm": True}
    op.update(over)
    stm.apply_cell_op(state, op)


def _restore(state: dict) -> None:
    stm.apply_cell_op(state, {"action": "restore-discarded", **CELL})


# ── (a) 退避する側が欄を数え上げない ──────────────────────────────────


def test_a_field_nobody_listed_is_still_preserved() -> None:
    """**これが原因 A の当てどころ。**実装のどこにも名前が無い欄が退避されること。

    ここが赤くなるのは、退避する側がまた欄を数え上げ始めたときである。
    """
    state = _state()
    _cell(state)["__将来生える欄__"] = ["値"]
    _reopen(state)
    assert state["reopen_log"][-1]["discarded"]["__将来生える欄__"] == ["値"]


def test_machine_fields_are_not_preserved() -> None:
    """状態機械の欄は内容ではないので退避しない。退避すると、戻すときに
    `state` まで書き戻る道ができる (`確定`→`未収集` の直接書換と同じ形)。"""
    state = _state()
    _reopen(state)
    discarded = state["reopen_log"][-1]["discarded"]
    assert not set(discarded) & set(stm.CELL_MACHINE_FIELDS)


def test_preserved_snapshot_does_not_share_lists_with_the_cell() -> None:
    """(e) 退避値は写しであること。共有していると、再確定後にセルへ足した要素が
    「退避された当時の姿」まで書き換える。"""
    state = _state()
    _cell(state)["required_info_checks"] = [{"checked_on": "2026-08-20"}]
    _reopen(state)
    preserved = state["reopen_log"][-1]["discarded"]["required_info_checks"]
    _reconfirm(state)
    _restore(state)
    _cell(state)["required_info_checks"].append({"checked_on": "2026-09-08"})
    assert len(preserved) == 1, "退避値が現在の姿へ追随している"


# ── (b) 戻す側も欄を数え上げない ──────────────────────────────────────


def test_restore_brings_back_every_preserved_field() -> None:
    """**これが原因 B の当てどころ。**専用窓口を持たない欄も戻ること。

    `serves_intents` は退避されながら値を書ける op が 1 つも無く、
    「一度 reopen したら二度と戻せない欄」だった。
    """
    state = _state()
    cell = _cell(state)
    cell["serves_goals"] = ["G1"]
    cell["serves_intents"] = ["I1"]
    cell["required_info"] = [{"item_id": "x", "status": "grounded", "grounded_by": QA_ID}]
    cell["required_info_checks"] = [{"checked_on": "2026-08-20", "blocking_item_count": 0}]
    _reopen(state)
    _reconfirm(state)
    assert "serves_intents" not in _cell(state), "前提: 再確定は退避を戻さない"
    _restore(state)
    restored = _cell(state)
    assert restored["serves_goals"] == ["G1"]
    assert restored["serves_intents"] == ["I1"]
    assert restored["required_info"][0]["item_id"] == "x"
    assert restored["required_info_checks"][0]["checked_on"] == "2026-08-20"


def test_same_day_second_reopen_can_be_undone() -> None:
    """4 度目の実測 (2026-09-02) が塞がること。

    同じ日に同じセルを 2 度直せなかった——2 度目の reopen で
    `required_info_checks` が退避され、`record-required-info-check` は
    同日同数の重複を拒むので戻せなかった。**数え直す道しか無いと、
    数え直せない日には戻せない。**退避値をそのまま戻す道が要る。
    """
    state = _state()
    _cell(state)["required_info_checks"] = [
        {"checked_on": "2026-09-08", "checked_with": "record-required-info-check",
         "blocking_item_count": 0, "unmet_blocking_items": 0}
    ]
    for _ in range(2):
        _reopen(state)
        _reconfirm(state)
        _restore(state)
    assert _cell(state)["required_info_checks"][0]["checked_on"] == "2026-09-08"


def test_qa_ref_is_not_restored() -> None:
    """`qa_ref` は confirm が必ず書く。退避値で上書きするのは付け替えにあたる。"""
    state = _state()
    _cell(state)["serves_goals"] = ["G1"]
    _reopen(state)
    _reconfirm(state, qa_ref=OTHER_ID)
    _restore(state)
    assert _cell(state)["qa_ref"] == OTHER_ID


# ── (c) 現在の主張を黙って上書きしない ────────────────────────────────


def test_a_differing_value_stops_everything() -> None:
    """食い違う欄が 1 つでもあれば、**何も書かずに**止まること。

    部分的に戻すと、戻らなかった欄は元どおり黙って消えたままになる——
    それは塞ごうとしている穴そのものである。
    """
    state = _state()
    cell = _cell(state)
    cell["serves_goals"] = ["G1"]
    cell["serves_intents"] = ["I1"]
    _reopen(state)
    _reconfirm(state)
    stm.apply_cell_op(state, {"action": "set-serves", **CELL, "serves_goals": ["G2"]})
    with pytest.raises(TransitionError, match="退避値と違う"):
        _restore(state)
    assert "serves_intents" not in _cell(state), "止まったのに一部だけ書かれている"


def test_equal_values_are_left_alone() -> None:
    """既に同じ値が在る欄は素通りする。通し直しで同じ op を 2 度流しても止まらない。"""
    state = _state()
    _cell(state)["serves_goals"] = ["G1"]
    _reopen(state)
    _reconfirm(state)
    _restore(state)
    with pytest.raises(TransitionError, match="戻す欄が 1 つも無い"):
        _restore(state)
    assert _cell(state)["serves_goals"] == ["G1"]


# ── (d) 裏付けの付け替えを、単一窓口でも止める ────────────────────────


def test_qa_refs_head_must_match_the_reconfirmed_ref() -> None:
    """別の entry で再確定したセルへ古い範囲を貼らない。
    通ると「この主張はこれらに裏付けられている」が黙って別の主張へ移る。"""
    state = _state()
    _cell(state)["qa_refs"] = [QA_ID, OTHER_ID]
    _reopen(state)
    _reconfirm(state, qa_ref=OTHER_ID)
    with pytest.raises(TransitionError, match="裏付けを付け替える"):
        _restore(state)


def test_qa_refs_must_point_at_live_entries() -> None:
    """指し先の無い裏付けは、在るように見えて何も指していない。"""
    state = _state()
    _cell(state)["qa_refs"] = [QA_ID, OTHER_ID]
    _reopen(state)
    _reconfirm(state)
    state["qa_log"] = [e for e in state["qa_log"] if e["id"] != OTHER_ID]
    with pytest.raises(TransitionError, match="qa_log へ存在しない id"):
        _restore(state)


# ── 出所と適用条件 ────────────────────────────────────────────────────


def test_the_argument_is_ignored() -> None:
    """**引数で戻す内容を名乗れないこと。**出所は退避一覧だけである。"""
    state = _state()
    _cell(state)["serves_goals"] = ["G1"]
    _reopen(state)
    _reconfirm(state)
    stm.apply_cell_op(
        state,
        {"action": "restore-discarded", **CELL, "serves_goals": ["捏造"], "新欄": 1},
    )
    assert _cell(state)["serves_goals"] == ["G1"]
    assert "新欄" not in _cell(state)


def test_restore_refuses_on_unconfirmed_cell() -> None:
    state = _state()
    _cell(state)["serves_goals"] = ["G1"]
    _reopen(state)
    with pytest.raises(TransitionError, match="restore-discarded 不可"):
        _restore(state)


def test_restore_refuses_when_nothing_was_preserved() -> None:
    """退避されていない値を作らない。"""
    state = _state()
    with pytest.raises(TransitionError, match="退避された欄が無い"):
        _restore(state)


def test_restore_takes_the_latest_preserved_value() -> None:
    """同じセルを 2 度 reopen したら、**最後に**退避された値を採ること。
    古いほうを採ると、間に起きた変更が黙って巻き戻る。"""
    state = _state()
    _cell(state)["serves_goals"] = ["G1"]
    _reopen(state)
    _reconfirm(state)
    stm.apply_cell_op(state, {"action": "set-serves", **CELL, "serves_goals": ["G2"]})
    _reopen(state)
    _reconfirm(state)
    _restore(state)
    assert _cell(state)["serves_goals"] == ["G2"]
