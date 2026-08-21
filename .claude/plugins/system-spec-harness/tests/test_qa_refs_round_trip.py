# /// script
# name: test-qa-refs-round-trip
# version: 0.1.0
# purpose: reopen が qa_refs を退避すること、退避された値からだけ書き戻せること、そして書き戻しが別の主張へ裏付けを付け替えないことを固定する pytest。
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
"""確定セルの裏付けの範囲 (`qa_refs`) が、reopen を跨いで戻せること。

**何が起きていたか (2026-08-21 実測)**

`qa_refs` を書ける writer は `split-qa-bundle` だけで、それは
`scope_notes.bundled=true` を要求する。束ねを解いた entry では `bundled=false` に
なるので、同じ writer をもう一度通すことはできない。一方 `reopen` は退避一覧
(`reopen_log[].discarded`) に `qa_ref` / `serves_goals` / `serves_intents` /
`required_info` / `required_info_checks` を入れるが、**`qa_refs` は入れていなかった**。

結果、`reopen` → 再確定 を通ると裏付けの範囲が**二度と戻せない**。実測では確定
8 セルのうち 6 セルが該当し、`split-qa-bundle` の再実行は 6 件とも拒否された。

これは門の緩みではなく writer の抜けである。同じ抜けが `required_info` /
`required_info_checks` で先に見つかっており、その 2 つを退避一覧へ足した理由が
`apply_cell_op` の comment にそのまま書いてある。`qa_refs` は 3 件目である。

**向き**: ここは①でも②でもなく、**達成済みの下限の見張り (③)** である。
退避一覧から `qa_refs` が落ちた日、または書き戻し窓口が消えた日に赤くなる。
原因は残っている — 退避一覧は key を並べた tuple で、次に欄が増えたときも
同じ落とし方ができる。
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
OWN_TEXT = "束ねた側の一文。"
ABSORBED_TEXT = "取り込まれた側の一文。"


def _state() -> dict:
    """束ね entry を 1 件確定セルへ引かせた state。**qa_refs は実物の writer に書かせる。**

    テストが `cell["qa_refs"] = [...]` と直に置くと、書き戻し窓口が守るべき不変条件
    (`qa_refs[0]` はそのセルが引いている entry 自身) をテスト側が勝手に決めることになる。
    `split-qa-bundle` を通せば、その不変条件は writer が作る。
    """
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "database"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["qa_log"] = [
        {"id": ORIGIN_ID, "question": "q1", "answer": ABSORBED_TEXT,
         "design_applications": [{"knowledge_ref": "k-origin", "principle": "p2"}]},
        {
            "id": BUNDLE_ID,
            "question": "q2",
            "answer": f"### 節A\n{OWN_TEXT}\n\n### 節B\n{ABSORBED_TEXT}",
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
    stm.apply_cell_op(
        state,
        {"action": "confirm", "category": "database", "platform": "web", "qa_ref": BUNDLE_ID},
    )
    stm.split_qa_bundle(state, BUNDLE_ID)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [BUNDLE_ID, ORIGIN_ID], (
        "前提: split-qa-bundle がセルへ裏付けの範囲を書いている"
    )
    return state


def _reopen(state: dict) -> None:
    stm.apply_cell_op(
        state,
        {"action": "reopen", "category": "database", "platform": "web", "reason": "測定のため"},
    )


def _reconfirm(state: dict, qa_ref: str = BUNDLE_ID) -> None:
    stm.apply_cell_op(
        state,
        {"action": "confirm", "category": "database", "platform": "web", "qa_ref": qa_ref},
    )


def _restore(state: dict) -> None:
    stm.apply_cell_op(
        state, {"action": "restore-qa-refs", "category": "database", "platform": "web"}
    )


# ── 1. 退避される ──────────────────────────────────────────────────────
def test_reopen_preserves_qa_refs() -> None:
    """**この検査の本体。**落ちていた欄が退避一覧に載ること。"""
    state = _state()
    _reopen(state)
    discarded = state["reopen_log"][-1]["discarded"]
    assert discarded["qa_refs"] == [BUNDLE_ID, ORIGIN_ID]


def test_reopen_still_preserves_the_other_five() -> None:
    """欄を 1 つ足すときに、隣を落としていないこと。"""
    state = _state()
    cell = state["matrix"]["database"]["web"]
    cell["serves_goals"] = ["g1"]
    cell["serves_intents"] = ["i1"]
    cell["required_info"] = [{"item_id": "x", "status": "grounded", "grounded_by": BUNDLE_ID}]
    cell["required_info_checks"] = [{"checked_on": "2026-08-20", "blocking_item_count": 0}]
    _reopen(state)
    assert set(state["reopen_log"][-1]["discarded"]) == {
        "qa_ref", "qa_refs", "serves_goals", "serves_intents",
        "required_info", "required_info_checks",
    }


def test_reopen_does_not_invent_the_field() -> None:
    """**0 の作り方が 2 通りある。**qa_refs を持たないセルを reopen しても
    退避一覧に空の欄が生えないこと。生えると「範囲が空だった」と読める姿になる。"""
    state = _state()
    del state["matrix"]["database"]["web"]["qa_refs"]
    _reopen(state)
    assert "qa_refs" not in state["reopen_log"][-1]["discarded"]


# ── 2. 書き戻せる ──────────────────────────────────────────────────────
def test_round_trip_restores_the_same_value() -> None:
    """reopen → 再確定 → 書き戻し で、元と同じ範囲へ戻ること。"""
    state = _state()
    before = list(state["matrix"]["database"]["web"]["qa_refs"])
    _reopen(state)
    _reconfirm(state)
    assert "qa_refs" not in state["matrix"]["database"]["web"], "再確定は範囲を書かない"
    _restore(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == before


def test_restore_is_idempotent() -> None:
    """同じ内容の再適用は、拒否でも二重書きでもなく何もしないこと。
    通し直しは同じ op を 2 度流すことがあるので、ここで止まると経路が塞がる。"""
    state = _state()
    _reopen(state)
    _reconfirm(state)
    _restore(state)
    _restore(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [BUNDLE_ID, ORIGIN_ID]


def test_split_writer_cannot_do_this_job() -> None:
    """**窓口が要る理由そのもの。**束ねを解いた entry は再実行できない。
    ここが通るようになったら、この窓口は不要になったのではなく、
    `split-qa-bundle` が二度書きを許すようになったということである。"""
    state = _state()
    _reopen(state)
    _reconfirm(state)
    with pytest.raises(TransitionError, match="bundled=true でない"):
        stm.split_qa_bundle(state, BUNDLE_ID)


# ── 3. 付け替えを止める ────────────────────────────────────────────────
def test_restore_refuses_when_reconfirmed_with_another_qa_ref() -> None:
    """**検出側が動いている証拠。**別の entry で再確定したセルへ古い範囲を貼らない。
    通ると「この主張はこれらに裏付けられている」が黙って別の主張へ移る。"""
    state = _state()
    state["qa_log"].append({"id": "qa-other", "question": "q3", "answer": "別の一文。"})
    _reopen(state)
    _reconfirm(state, qa_ref="qa-other")
    with pytest.raises(TransitionError, match="裏付けを付け替える"):
        _restore(state)
    assert "qa_refs" not in state["matrix"]["database"]["web"]


def test_restore_refuses_when_nothing_was_preserved() -> None:
    """退避されていない範囲を作らない。"""
    state = _state()
    del state["matrix"]["database"]["web"]["qa_refs"]
    _reopen(state)
    _reconfirm(state)
    with pytest.raises(TransitionError, match="退避された qa_refs が無い"):
        _restore(state)


def test_restore_refuses_dangling_refs() -> None:
    """退避された id が qa_log から消えていたら書かない。
    指し先の無い裏付けは、裏付けが在るように見えて何も指していない。"""
    state = _state()
    _reopen(state)
    _reconfirm(state)
    state["qa_log"] = [e for e in state["qa_log"] if e["id"] != ORIGIN_ID]
    with pytest.raises(TransitionError, match="qa_log へ存在しない id"):
        _restore(state)


def test_restore_refuses_on_unconfirmed_cell() -> None:
    """確定していないセルへは書かない。"""
    state = _state()
    _reopen(state)
    with pytest.raises(TransitionError, match="restore-qa-refs 不可"):
        _restore(state)


def test_restore_takes_the_latest_preserved_value() -> None:
    """同じセルを 2 度 reopen したら、**最後に**退避された値を採ること。
    古いほうを採ると、間に起きた範囲の変更が黙って巻き戻る。"""
    state = _state()
    _reopen(state)
    _reconfirm(state)
    _restore(state)
    state["matrix"]["database"]["web"]["qa_refs"] = [BUNDLE_ID]
    _reopen(state)
    _reconfirm(state)
    _restore(state)
    assert state["matrix"]["database"]["web"]["qa_refs"] == [BUNDLE_ID]


def test_the_argument_is_ignored() -> None:
    """**引数で範囲を名乗れないこと。**op に qa_refs を書いても、出所は退避一覧のまま。
    ここが通ると、呼ぶ側が裏付けの内容を選べるようになる。"""
    state = _state()
    _reopen(state)
    _reconfirm(state)
    stm.apply_cell_op(
        state,
        {
            "action": "restore-qa-refs",
            "category": "database",
            "platform": "web",
            "qa_refs": [BUNDLE_ID, "qa-fabricated"],
        },
    )
    assert state["matrix"]["database"]["web"]["qa_refs"] == [BUNDLE_ID, ORIGIN_ID]
