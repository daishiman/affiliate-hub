# /// script
# name: test-reanchor-split-scope-notes
# version: 0.1.0
# purpose: 束ね解除で指し先を失う answer_span を、origin entry の本文へ張り直す writer を固定する pytest。
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
"""束ねを解いた後の「指し先」を固定する。

**実際に起きた壊れ方**: `split-qa-bundle` は束ね本文から他論点の節を外すが、
`scope_notes.topics[].answer_span` は**束ね本文の `### 見出し` 行**を持っていた。
節を外すと見出しごと消えるので、span の指し先が何処にも無くなる。
2026-08-21 の実測で 18 論点中 16 件が 0 箇所になっていた
(`node`、単位は topic、対象は `system-spec/spec-state.json` の
`qa_log[].scope_notes.topics[]`)。**セル → 論点 → 実在する本文**の鎖が切れた。

節の中身は取り込み元 entry へ byte 一致のまま在る (writer が一致を確かめてから外す)。
だから鎖は繋ぎ直せる——**指す先を「束ね本文」から「origin の本文」へ移す**。
規則は 1 本になる: *`answer_span` は `origin_qa_id` の entry の本文に逐語で 1 箇所在る*。
束ねていない entry (origin が自分自身) も同じ規則で通るので、読む側に分岐は要らない。

固定するのは 5 点:
(a) 束ねを解いた**その場で**張り直す (別便へ回すと、その間は鎖が切れたまま出荷される)
(b) 消える見出し行は出典を持っていたので捨てず `released_section_heading` に残す
(c) 錨は writer が本文から切り出す。呼び出し側から受け取らない
    (受け取れると、本文に無い文字列を「ここが裏付けだ」と名乗れる)
(d) **解決している span には触らない**。触れると、この writer は「動いている指し先を
    別の場所へ移す道具」になる。よって 2 度目の実行は何も変えない
(e) 錨が一意に取れないときは書かずに止める (指し先の曖昧な注記を作らない)
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

ORIGIN_ANSWER = "初期の対話ヒアリングでの方式回答。\nD1 + Drizzle を使う。"
OWN_ANSWER = "書面入力で再確定したときの回答。\n構成は現行のままとする。"
SPAN_OLD = "### qa-db-origin（docs/spec/06 §2）"
SPAN_OWN = "### qa-db（docs/spec/06 §3）"
BUNDLE_ANSWER = (
    f"{SPAN_OLD}\n{ORIGIN_ANSWER}\n\n{SPAN_OWN}\n{OWN_ANSWER}\n"
)


def _state() -> dict:
    """database/web だけ確定し、その qa_ref が束ねた entry を指す最小 state。"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "データ"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": "qa-db"}
    state["qa_log"] = [
        {
            "id": "qa-db",
            "question": "DB 方式は?",
            "answer": BUNDLE_ANSWER,
            "design_applications": [
                {"knowledge_ref": "K-own", "principle": "自分の設計適用", "applicability": "applied"}
            ],
            "scope_notes": {
                "bundled": True,
                "bundling_reason": "qa_ref が 1 件しか持てないので、2 回の質疑の回答を束ねてある。",
                "recorded_with": "set-qa-scope-notes",
                "topics": [
                    {
                        "topic_id": "qa-db-origin",
                        "covers_cell": None,
                        "answer_span": SPAN_OLD,
                        "note": "統合前の質疑由来。",
                        "origin_qa_id": "qa-db-origin",
                    },
                    {
                        "topic_id": "qa-db",
                        "covers_cell": {"category": "database", "platform": "web"},
                        "answer_span": SPAN_OWN,
                        "note": "この節が確定セルの直接の裏付けである。",
                        "origin_qa_id": "qa-db",
                    },
                ],
            },
        },
        {"id": "qa-db-origin", "question": "初回の DB 方式は?", "answer": ORIGIN_ANSWER},
    ]
    stm.recompute_aggregates(state)
    return state


def _entries(state: dict) -> dict:
    return {entry["id"]: entry for entry in state["qa_log"]}


def _topics(state: dict) -> list:
    return _entries(state)["qa-db"]["scope_notes"]["topics"]


def _resolves(state: dict) -> list:
    """各 topic の span が origin 本文に何箇所在るか。"""
    entries = _entries(state)
    return [
        (entries[topic["origin_qa_id"]].get("answer") or "").count(topic["answer_span"])
        for topic in _topics(state)
    ]


# ── (a) 束ねを解いたその場で張り直る ────────────────────────────────────────
def test_split_leaves_every_span_resolvable_in_its_origin():
    state = _state()
    # 束ねたままの指し先は**片側しか合っていない**。自分の節 (origin が自分自身) は
    # 束ね本文の中に見出しが在るので 1 箇所で解決するが、取り込んだ節は origin の本文に
    # 見出しが無いので 0 箇所である。**この非対称が、壊れが見えにくかった理由**——
    # 「注記を持つ entry 自身の本文」で測っている限り、どちらも 1 箇所に見えていた。
    assert _resolves(state) == [0, 1]
    stm.split_qa_bundle(state, "qa-db")
    assert _resolves(state) == [1, 1]


def test_split_without_reanchor_would_break_the_chain():
    """張り直しを外すと壊れることを、同じ検査の中で見せる（0 件の作り方 2 通り）。

    上の検査は「張り直っている」を主張する。**張り直す側が動いていない場合にも
    同じ緑が出ないこと**を、ここで示す。span を見出し行のまま固定した合成例では、
    束ねを解いた本文の何処にも指し先が無い。
    """
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    entry = _entries(state)["qa-db"]
    assert entry["answer"] == OWN_ANSWER
    assert SPAN_OWN not in entry["answer"]
    assert SPAN_OLD not in (_entries(state)["qa-db-origin"].get("answer") or "")


# ── (b) 出典を持っていた見出しを捨てない ────────────────────────────────────
def test_split_keeps_the_released_heading_as_provenance():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    headings = [topic.get("released_section_heading") for topic in _topics(state)]
    assert headings == [SPAN_OLD, SPAN_OWN]


# ── (c) 錨は本文から取る ────────────────────────────────────────────────────
def test_anchor_is_the_first_nonempty_line_of_the_origin_answer():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    spans = [topic["answer_span"] for topic in _topics(state)]
    assert spans == ["初期の対話ヒアリングでの方式回答。", "書面入力で再確定したときの回答。"]


def test_reanchor_writer_takes_no_span_argument():
    """呼び出し側が指し先を選べないこと（引数は state と qa_id だけ）。"""
    import inspect

    names = list(inspect.signature(stm.reanchor_split_scope_notes).parameters)
    assert names == ["state", "qa_id"]


# ── (d) 解決している span には触らない ──────────────────────────────────────
def test_reanchor_repairs_only_broken_spans():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    good = _topics(state)[1]["answer_span"]
    _topics(state)[0]["answer_span"] = "### 何処にも無い見出し"
    stm.reanchor_split_scope_notes(state, "qa-db")
    assert _topics(state)[0]["answer_span"] == "初期の対話ヒアリングでの方式回答。"
    assert _topics(state)[1]["answer_span"] == good  # 動いていた側は不動
    assert _resolves(state) == [1, 1]


def test_reanchor_is_idempotent_and_leaves_no_stamp_when_nothing_broke():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    before = copy.deepcopy(state)
    stm.reanchor_split_scope_notes(state, "qa-db")
    assert state == before
    assert "reanchored_with" not in _entries(state)["qa-db"]["scope_notes"]


def test_reanchor_stamps_writer_and_date_when_it_changed_something():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    _topics(state)[0]["answer_span"] = "### 何処にも無い見出し"
    stm.reanchor_split_scope_notes(state, "qa-db")
    notes = _entries(state)["qa-db"]["scope_notes"]
    assert notes["reanchored_with"] == stm.REANCHOR_WRITER
    assert len(notes["reanchored_on"]) == len("2026-08-21")


# ── (e) 錨が一意に取れないときは書かずに止める ──────────────────────────────
def test_refuses_when_the_first_line_is_not_unique_in_the_origin():
    state = _state()
    _entries(state)["qa-db-origin"]["answer"] = "同じ行\n途中\n同じ行"
    _entries(state)["qa-db"]["answer"] = BUNDLE_ANSWER.replace(
        ORIGIN_ANSWER, "同じ行\n途中\n同じ行"
    )
    with pytest.raises(TransitionError, match="錨にならない"):
        stm.split_qa_bundle(state, "qa-db")


def test_refuses_unknown_qa_id():
    with pytest.raises(TransitionError, match="qa_log に存在しない"):
        stm.reanchor_split_scope_notes(_state(), "qa-missing")


def test_refuses_entry_without_scope_notes():
    with pytest.raises(TransitionError, match="scope_notes が無い"):
        stm.reanchor_split_scope_notes(_state(), "qa-db-origin")


def test_refuses_topic_whose_origin_is_not_in_the_qa_log():
    state = _state()
    stm.split_qa_bundle(state, "qa-db")
    _topics(state)[0]["origin_qa_id"] = "qa-does-not-exist"
    with pytest.raises(TransitionError, match="qa_log に無い"):
        stm.reanchor_split_scope_notes(state, "qa-db")
