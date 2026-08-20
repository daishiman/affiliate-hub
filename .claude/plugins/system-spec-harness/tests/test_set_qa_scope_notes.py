# /// script
# name: test-set-qa-scope-notes
# version: 0.1.0
# purpose: 束ねた qa_log entry の論点範囲を問答本文を変えずに注記する set-qa-scope-notes op を、正例・不正入力 4 通り・束ね偽装の抜け道・冪等で固定する pytest。
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
"""set-qa-scope-notes op を固定する。

背景: `qa_ref` は 1 件しか持てない (決定論ゲートが文字列で照合する)。そのため複数回の
質疑の回答本文を 1 entry へ統合して裏付けの範囲を保つ運用になっており、C05 は
「どの論点がどのセルの裏付けか機械で読めない」を gap として挙げた。

**この op は束ねを解消しない。**解消したことにする改変 (entry 分割・問答本文の書き換え)
は、当時 1 問で聞いた事実を後から複数問だったことにする記録の偽造にあたる。よって
本文には触れず、別欄 `scope_notes` として対応だけを機械可読にする。

固定するのは 5 点:
(a) 注記は `question` / `answer` を 1 文字も変えない
(b) `answer_span` は逐語であること — 長さの床・実在・一意の 3 つで縛る
(c) `bundled` は飾りではなく writer が計算値と突き合わせる。手で false にして
    「束ねが消えた」ことにする道を塞ぐ
(d) `covers_cell` を全部 null にして注記だけ生やす道を塞ぐ
(e) 冪等は `set-qa-design-applications` の先例に合わせる (同一は通す・異なるは拒否)

**(b) の床が要る理由**: 床が無いと `。` 1 文字でも部分文字列として成立し、
「逐語引用した」という主張だけが門を通る。床の値 20 は実測から決めた——
注記対象 8 entry の節見出し 19 件のうち最短が 23 字 (`### qa-infra-web（出典未記載）`)。
遊びは 3。以後この値は**上げる方向にしか動かさない**(下げるのは検査を緩める向き)。
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

ELICIT_SCRIPTS = (
    Path(__file__).resolve().parent.parent / "skills/run-system-spec-elicit/scripts"
)
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402

PLATFORMS = list(stm.CANONICAL_PLATFORMS)

ANSWER = (
    "統合した回答である。出典は節ごとに記す。\n\n"
    "### qa-database-web（出典未記載）\n"
    "初期の対話ヒアリングでの方式回答。\n\n"
    "### qa-database-web-spec-intake（docs/spec/06 §2）\n"
    "書面入力で再確定したときの回答。\n"
)
SPAN_OLD = "### qa-database-web（出典未記載）"
SPAN_OWN = "### qa-database-web-spec-intake（docs/spec/06 §2）"


def _state() -> dict:
    """database/web だけ確定し、その qa_ref が束ねた entry を指す最小 state。"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "データ"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-db"}
    state["qa_log"] = [{"id": "qa-db", "question": "DB 方式は?", "answer": ANSWER}]
    stm.recompute_aggregates(state)
    return state


def _notes(**over) -> dict:
    notes = {
        "bundled": True,
        "bundling_reason": "2 回の質疑の回答を統合して 1 件にしてある。注記を付けても束ねは残る。",
        "topics": [
            {
                "topic_id": "qa-database-web",
                "covers_cell": None,
                "answer_span": SPAN_OLD,
                "note": "統合前の質疑由来。確定の裏付けではないため covers_cell は null。",
                "origin_qa_id": "qa-database-web",
            },
            {
                "topic_id": "qa-database-web-spec-intake",
                "covers_cell": {"category": "database", "platform": "web"},
                "answer_span": SPAN_OWN,
                "note": "この節が確定セルの直接の裏付けである。",
                "origin_qa_id": "qa-database-web-spec-intake",
            },
        ],
    }
    notes.update(over)
    return notes


def _topics(*items) -> list:
    """既定 topics のうち index 指定のものだけを取り出す。"""
    base = _notes()["topics"]
    return [copy.deepcopy(base[i]) for i in items]


# ── (a) 本文に触れない ─────────────────────────────────────────────────────
def test_scope_notes_do_not_touch_question_or_answer():
    state = _state()
    before = copy.deepcopy(state["qa_log"][0])
    stm.set_qa_scope_notes(state, "qa-db", _notes())
    entry = state["qa_log"][0]
    assert entry["question"] == before["question"]
    assert entry["answer"] == before["answer"]
    # 増えた欄は scope_notes 1 つだけ (問答の周辺を巻き込んで書き換えていない)
    assert set(entry) - set(before) == {"scope_notes"}
    assert set(before) - set(entry) == set()


def test_scope_notes_record_writer_and_cell_mapping():
    state = _state()
    stm.set_qa_scope_notes(state, "qa-db", _notes())
    notes = state["qa_log"][0]["scope_notes"]
    assert notes["recorded_with"] == stm.SCOPE_NOTE_WRITER
    assert notes["bundled"] is True
    assert notes["bundling_reason"]
    covered = [t["covers_cell"] for t in notes["topics"] if t["covers_cell"]]
    assert covered == [{"category": "database", "platform": "web"}]


# ── (b) 不正入力 4 通り ────────────────────────────────────────────────────
def test_rejects_span_absent_from_answer():
    """本文に無い文字列を span にできると、注記が問答を作文できてしまう。"""
    state = _state()
    notes = _notes()
    notes["topics"][1]["answer_span"] = "### qa-database-web-never-written（存在しない節）"
    with pytest.raises(TransitionError, match="存在しない"):
        stm.set_qa_scope_notes(state, "qa-db", notes)
    assert "scope_notes" not in state["qa_log"][0]


def test_rejects_span_shorter_than_floor():
    """床が無いと『。』1 文字でも部分文字列は成立し、逐語引用の主張だけが通る。

    **短い例は定数から作らない。**最初この span を
    `"### qa-database-web（出典未記載）"[: SCOPE_NOTE_SPAN_MIN_LEN - 1]` で作っていたが、
    それだと床を 20 から 1 へ下げても例のほうが一緒に縮み、検査は緑のままだった
    (2026-08-20 に実際に壊して確認し、21 件すべて緑のままになった)。
    **測る側が測られる側を参照していると、緩めたことを検出できない。**
    よって長さは実物の文字列で固定する。床の値そのものは下の別検査で縛る。
    """
    state = _state()
    notes = _notes()
    short = "出典未記載"  # 5 字。本文に実在するので、弾く理由は長さだけである
    assert short in ANSWER
    assert len(short) < 20
    notes["topics"][0]["answer_span"] = short
    with pytest.raises(TransitionError, match="短すぎる"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_span_floor_is_not_lowered():
    """床は上げる方向にしか動かさない。下げるのは検査を緩める向きである。

    値 20 の根拠は実測: 注記対象 8 entry の節見出し 19 件のうち最短が 23 字
    (`### qa-infra-web（出典未記載）`)。遊び 3。本文がもっと短い見出しを必要とする
    ようになったら、床を下げるのではなく span の取り方を変えること。
    """
    assert stm.SCOPE_NOTE_SPAN_MIN_LEN >= 20


def test_rejects_span_occurring_more_than_once():
    """位置を特定できない引用は、範囲注記としては機能しない。"""
    state = _state()
    state["qa_log"][0]["answer"] = ANSWER + "\n" + SPAN_OWN + "\n再掲。\n"
    notes = _notes()
    with pytest.raises(TransitionError, match="2 箇所ある"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_bundled_false_with_two_topics():
    """`bundled` を手で false にすれば束ねが消えたことになる、という抜け道を塞ぐ。"""
    state = _state()
    with pytest.raises(TransitionError, match="bundled=false"):
        stm.set_qa_scope_notes(state, "qa-db", _notes(bundled=False))


# ── (c) 束ね偽装の両方向 ───────────────────────────────────────────────────
def test_rejects_bundled_true_with_single_topic():
    """逆向きも塞ぐ。論点 1 件で bundled=true を名乗れると、束ねの有無が自己申告になる。"""
    state = _state()
    with pytest.raises(TransitionError, match="bundled=true"):
        stm.set_qa_scope_notes(state, "qa-db", _notes(topics=_topics(1)))


def test_rejects_bundled_true_without_reason():
    """束ねが残っている事実を欄に持たせる。散文任せにすると門が無い記述になる。"""
    state = _state()
    with pytest.raises(TransitionError, match="bundling_reason"):
        stm.set_qa_scope_notes(state, "qa-db", _notes(bundling_reason="  "))


def test_bundled_false_passes_only_when_writer_verifies_both_conditions():
    """論点 1 件かつ確定セル 1 件のときだけ false を通す (自己申告ではなく計算)。"""
    state = _state()
    stm.set_qa_scope_notes(
        state, "qa-db", {"bundled": False, "topics": _topics(1)}
    )
    assert state["qa_log"][0]["scope_notes"]["bundled"] is False


def test_rejects_bundled_false_when_two_confirmed_cells_cite_the_entry():
    state = _state()
    state["matrix"]["database"]["mobile"] = {"state": "確定", "qa_ref": "qa-db"}
    notes = {"bundled": False, "topics": _topics(1)}
    with pytest.raises(TransitionError, match="確定セル=2"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


# ── (d) covers_cell の縛り ────────────────────────────────────────────────
def test_rejects_when_a_citing_confirmed_cell_is_uncovered():
    state = _state()
    notes = _notes()
    notes["topics"][1]["covers_cell"] = None
    with pytest.raises(TransitionError, match="名乗る topic が無い"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_notes_whose_topics_are_all_null_cells():
    """確定セルから指されていない entry には注記を付けられない。

    `missing` 検査だけでは素通りする——refs が空なら未被覆も空になるからである。
    **どのセルの裏付けでもない注記は、範囲注記ではなく感想である。**
    """
    state = _state()
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-other"}
    notes = _notes()
    notes["topics"][1]["covers_cell"] = None
    with pytest.raises(TransitionError, match="1 件も無い"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_covers_cell_that_does_not_cite_this_entry():
    state = _state()
    state["matrix"]["database"]["mobile"] = {"state": "確定", "qa_ref": "qa-other"}
    notes = _notes()
    notes["topics"][1]["covers_cell"] = {"category": "database", "platform": "mobile"}
    with pytest.raises(TransitionError, match="確定セルではない"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_two_topics_claiming_the_same_cell():
    state = _state()
    notes = _notes()
    notes["topics"][0]["covers_cell"] = {"category": "database", "platform": "web"}
    with pytest.raises(TransitionError, match="複数の topic が名乗っている"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_duplicate_topic_ids():
    state = _state()
    notes = _notes()
    notes["topics"][1]["topic_id"] = notes["topics"][0]["topic_id"]
    with pytest.raises(TransitionError, match="重複"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


@pytest.mark.parametrize("bad", [None, "", "   "])
def test_rejects_empty_note_text(bad):
    state = _state()
    notes = _notes()
    notes["topics"][0]["note"] = bad
    with pytest.raises(TransitionError, match="note は非空"):
        stm.set_qa_scope_notes(state, "qa-db", notes)


def test_rejects_unknown_qa_id():
    state = _state()
    with pytest.raises(TransitionError, match="qa_log に存在しない"):
        stm.set_qa_scope_notes(state, "qa-missing", _notes())


# ── (e) 冪等 (set-qa-design-applications の先例に合わせる) ────────────────
def test_identical_reapply_is_accepted():
    state = _state()
    stm.set_qa_scope_notes(state, "qa-db", _notes())
    first = copy.deepcopy(state["qa_log"][0]["scope_notes"])
    stm.set_qa_scope_notes(state, "qa-db", _notes())
    assert state["qa_log"][0]["scope_notes"] == first


def test_different_reapply_is_rejected():
    state = _state()
    stm.set_qa_scope_notes(state, "qa-db", _notes())
    changed = _notes()
    changed["topics"][0]["note"] = "別の説明に差し替える"
    with pytest.raises(TransitionError, match="異なる内容の再適用は拒否"):
        stm.set_qa_scope_notes(state, "qa-db", changed)
