# /// script
# name: test-qa-refs-extend
# version: 0.1.0
# purpose: 確定セルへ新しい裏付けを足す窓口 (extend-qa-refs) が、退避された範囲と cell.qa_ref だけを出所にし、asks_for がそのセルを名指ししていない問答を拒むことを固定する pytest。
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
"""確定セルへ**新しい問答**で裏付けを足せること。

**何が起きていたか (2026-08-25 実測)**

確定セルに後から根拠を足す道が 1 本も無かった。

| 窓口 | 拒む理由 |
| --- | --- |
| `set-qa-design-applications` | `legacy_exempt` の entry しか受けない |
| `split-qa-bundle` | `bundled=true` を要求する (解除済み entry は拒否) |
| `restore-qa-refs` | `preserved[0] != cell.qa_ref` で拒否する |

3 つ目は**付け替え防止として正しい**。正しい門が塞いでいるのは「戻す」道であって、
「足す」道ではない。足す道が無いことが抜けである。

実測: `infrastructure/web` を新しい entry (`qa-infra-web-migration-guard`) で再確定
した時点で、`qa-infra-web` と `qa-infra-web-redirect` は**どのセルからも引かれない**
孤立 entry になった (`qa-scope-notes-coverage.test.ts` の
「戻した論点は確定セルの qa_refs[] から引けている」が赤くなる姿)。

これは `qa_refs` を退避一覧へ足した回と同じ種類の 4 件目である
(1: `required_info` / 2: `required_info_checks` / 3: `qa_refs` の退避 / 4: 足す窓口)。

**向き**: ①ではなく **達成済みの下限の見張り (③)**。窓口が消えた日、
出所が引数へ移った日、`asks_for` の門が外れた日に赤くなる。
原因は残っている — 退避一覧は writer の外から書き換えられる。
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

BUNDLE_ID = "qa-bundle"
ORIGIN_ID = "qa-origin"
NEW_ID = "qa-new"
CELL = {"category": "database", "platform": "web"}


def _state() -> dict:
    """束ね解除で `qa_refs` を持った確定セル。**範囲は実物の writer に書かせる。**"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "database"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["qa_log"] = [
        {"id": ORIGIN_ID, "question": "q1", "answer": "取り込まれた側の一文。",
         "design_applications": [{"knowledge_ref": "k-origin", "principle": "p2"}]},
        {
            "id": BUNDLE_ID,
            "question": "q2",
            "answer": "### 節A\n束ねた側の一文。\n\n### 節B\n取り込まれた側の一文。",
            "design_applications": [{"knowledge_ref": "k-bundle", "principle": "p1"}],
            "scope_notes": {
                "bundled": True,
                "topics": [
                    {"topic_id": "t1", "origin_qa_id": BUNDLE_ID, "answer_span": "### 節A"},
                    {"topic_id": "t2", "origin_qa_id": ORIGIN_ID, "answer_span": "### 節B"},
                ],
            },
        },
    ]
    stm.recompute_aggregates(state)
    stm.apply_cell_op(state, {"action": "confirm", **CELL, "qa_ref": BUNDLE_ID})
    stm.split_qa_bundle(state, BUNDLE_ID)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [BUNDLE_ID, ORIGIN_ID], (
        "前提: split-qa-bundle がセルへ裏付けの範囲を書いている"
    )
    return state


def _add_new_entry(state: dict, asks_for: object) -> None:
    entry = {"id": NEW_ID, "question": "q3", "answer": "新しく聞いた一文。"}
    if asks_for is not None:
        entry["asks_for"] = asks_for
    state["qa_log"].append(entry)


def _cycle(state: dict, qa_ref: str = NEW_ID) -> None:
    stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "測定のため"})
    stm.apply_cell_op(state, {"action": "confirm", **CELL, "qa_ref": qa_ref})


def _extend(state: dict, **extra: object) -> None:
    stm.apply_cell_op(state, {"action": "extend-qa-refs", **CELL, **extra})


# ── 1. 足せる ──────────────────────────────────────────────────────────
def test_new_entry_is_prepended_to_the_preserved_range() -> None:
    """**この検査の本体。**新しい entry が先頭に付き、元の範囲が後ろに残ること。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [NEW_ID, BUNDLE_ID, ORIGIN_ID]


def test_the_invariant_still_holds() -> None:
    """`qa_refs[0]` はそのセルが引いている entry 自身、が足したあとも成立すること。
    ここが崩れると `restore-qa-refs` の門が次の周回で意味を失う。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state)
    cell = state["matrix"]["database"]["web"]
    assert cell["qa_refs"][0] == cell["qa_ref"]


def test_extend_is_idempotent() -> None:
    """同じ内容の再適用は、拒否でも二重書きでもなく何もしないこと。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state)
    _extend(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [NEW_ID, BUNDLE_ID, ORIGIN_ID]


def test_no_other_writer_can_do_this_job() -> None:
    """**窓口が要る理由そのもの。**既存の 2 つは、この場面では両方とも拒む。
    ここが通るようになったら、窓口が不要になったのではなく、
    どちらかが二度書きを許すようになったということである。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    with pytest.raises(TransitionError, match="裏付けを付け替える"):
        stm.apply_cell_op(state, {"action": "restore-qa-refs", **CELL})
    with pytest.raises(TransitionError, match="bundled=true でない"):
        stm.split_qa_bundle(state, BUNDLE_ID)


# ── 2. 紛れ込みを止める ────────────────────────────────────────────────
def test_extend_refuses_when_asks_for_does_not_name_the_cell() -> None:
    """**検出側が動いている証拠。**別のセルへ向けられた問答は足せない。
    通ると、どの entry でも確定セルの裏付けに紛れ込ませられる。"""
    state = _state()
    _add_new_entry(state, [{"category": "database", "platform": "mobile"}])
    _cycle(state)
    with pytest.raises(TransitionError, match="asks_for が database/web を名指ししていない"):
        _extend(state)
    assert "qa_refs" not in state["matrix"]["database"]["web"]


def test_extend_refuses_when_asks_for_is_absent() -> None:
    """**0 の作り方が 2 通りある。**名指ししていないことと、名乗り自体が無いことを
    同じに扱う。無い側を通すと、`asks_for` を書かないだけで門を抜けられる。"""
    state = _state()
    _add_new_entry(state, None)
    _cycle(state)
    with pytest.raises(TransitionError, match="asks_for が database/web を名指ししていない"):
        _extend(state)


def test_the_argument_is_ignored() -> None:
    """**引数で範囲を名乗れないこと。**op に qa_refs を書いても、出所は変わらない。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state, qa_refs=[NEW_ID, "qa-fabricated"])
    assert state["matrix"]["database"]["web"]["qa_refs"] == [NEW_ID, BUNDLE_ID, ORIGIN_ID]


def test_extend_refuses_when_the_ref_is_already_in_range() -> None:
    """元の範囲に在る entry で再確定したなら、足すのではなく戻す場面である。
    ここを通すと、同じ id が範囲に 2 度並ぶ。"""
    state = _state()
    _cycle(state, qa_ref=BUNDLE_ID)
    with pytest.raises(TransitionError, match="既に退避された範囲に在る"):
        _extend(state)


def test_extend_refuses_when_nothing_was_preserved() -> None:
    """退避されていない範囲を作らない。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    del state["matrix"]["database"]["web"]["qa_refs"]
    _cycle(state)
    with pytest.raises(TransitionError, match="退避された qa_refs が無い"):
        _extend(state)


def test_extend_refuses_dangling_refs() -> None:
    """退避された id が qa_log から消えていたら書かない。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    state["qa_log"] = [e for e in state["qa_log"] if e["id"] != ORIGIN_ID]
    with pytest.raises(TransitionError, match="qa_log へ存在しない id"):
        _extend(state)


def test_extend_refuses_on_unconfirmed_cell() -> None:
    """確定していないセルへは書かない。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "測定のため"})
    with pytest.raises(TransitionError, match="extend-qa-refs 不可"):
        _extend(state)


def test_extend_takes_the_latest_preserved_value() -> None:
    """同じセルを 2 度 reopen したら、**最後に**退避された値 (=1 度目で伸びた範囲) の前へ足すこと。

    1 度目の値を見ていたら `[NEW2, BUNDLE, ORIGIN]` になり、`NEW_ID` が範囲から落ちる。
    裏付けは足すたびに積み上がるのであって、前の周回を置き換えない。
    """
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state)
    state["qa_log"].append(
        {"id": "qa-new2", "question": "q4", "answer": "さらに聞いた一文。", "asks_for": [dict(CELL)]}
    )
    _cycle(state, qa_ref="qa-new2")
    _extend(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == ["qa-new2", NEW_ID, BUNDLE_ID, ORIGIN_ID]


def test_extend_refuses_re_adding_the_same_entry_after_a_second_reopen() -> None:
    """**積み上げた範囲は、次の周回では「退避された範囲」そのものになる。**
    同じ entry で再確定したら足す場面ではなく戻す場面で、writer は拒む。
    ここが通ると同じ id が範囲に 2 度並ぶ。"""
    state = _state()
    _add_new_entry(state, [dict(CELL)])
    _cycle(state)
    _extend(state)
    _cycle(state)
    with pytest.raises(TransitionError, match="既に退避された範囲に在る"):
        _extend(state)
