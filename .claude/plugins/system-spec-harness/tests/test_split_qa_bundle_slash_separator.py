# /// script
# name: test-split-qa-bundle-slash-separator
# version: 0.1.0
# purpose: `／` で連ねた束ねを split-qa-bundle が解けること、および文中の `／` を区切りと取り違えないことを固定する pytest。
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
"""`／` で連ねた束ねを解けるようにする。

**実際に起きた形**: 2026-09-03 の対等提示による再確認は、論点ごとの回答を別々の
対話ターンで取り、それを `／` で連ねて 1 件の answer として記録した (確定セルが
持てる `qa_ref` が 1 件だけだったため)。`split-qa-bundle` は `### 見出し` の節しか
読めなかったので、この形の束ねは `answer_span が本文に見つからない` で止まり、
**解く道具が無いまま残った**。

束ねが残ると何が起きるか: 片方の論点だけ答えが揃った状態でも entry としては 1 件
なので、確定にできてしまう。もう片方は聞かれないまま「確定」の中に埋もれる。

固定するのは 5 点:
(a) `／` 束ねが論点ごとに解け、取り込んだ節が本文から外れる
(b) 束ねるときに付いた前置き (「（対等提示での再確認）」) は取り込み元に無いので
    捨てず entry 自身の文として残す
(c) **節の数が topics の数と合わないときは割らない**。文中の `／`
    (「並べて比べる／絞り込む」) を区切りと取り違えるより、解けない方が良い
(d) 節と論点の対応は順番だけで決めない。`answer_span` が当該節に逐語で 1 箇所
    在ることを要求する
(e) 節が取り込み元の回答と byte 単位で対応しないなら削らない (取り込みではなく
    編集された本文なので、削ると内容が失われる)
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

MODE_ANSWER = "機械が自動で反映し事後通知"
SCOPE_ANSWER = "次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て"
OWN_ANSWER = "現行のトップ構成を保ったまま、一覧へサムネイルを出す"
FRAMING = "（対等提示での再確認）"


def _bundle_answer() -> str:
    """前置き付きの取り込み節 2 件と、自分の節 1 件を `／` で連ねた本文。"""
    return f"{FRAMING}{MODE_ANSWER}／{SCOPE_ANSWER}／{OWN_ANSWER}"


def _state(answer: str | None = None, topics: list | None = None) -> dict:
    """ui-ux/web だけ確定し、その qa_ref が `／` 束ねを指す最小 state。"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "ui-ux", "label": "UI/UX"}]
    state["matrix"] = {"ui-ux": {pf: {"state": "未収集"} for pf in PLATFORMS}}
    state["matrix"]["ui-ux"]["web"] = {"state": "確定", "qa_ref": "qa-uiux"}
    state["qa_log"] = [
        {
            "id": "qa-uiux",
            "question": "トップの構成は?",
            "answer": _bundle_answer() if answer is None else answer,
            "design_applications": [
                {"knowledge_ref": "K-own", "principle": "自分の設計適用", "applicability": "applied"}
            ],
            "scope_notes": {
                "bundled": True,
                "bundling_reason": "qa_ref が 1 件しか持てないため、回答を `／` で連ねた",
                "topics": copy.deepcopy(topics) if topics is not None else [
                    {"origin_qa_id": "qa-mode", "answer_span": MODE_ANSWER},
                    {"origin_qa_id": "qa-scope", "answer_span": SCOPE_ANSWER},
                    {"origin_qa_id": "qa-uiux", "answer_span": OWN_ANSWER},
                ],
            },
        },
        {"id": "qa-mode", "question": "反映方法は?", "answer": MODE_ANSWER},
        {"id": "qa-scope", "question": "対象範囲は?", "answer": SCOPE_ANSWER},
    ]
    return state


def _entry(state: dict, qa_id: str) -> dict:
    return next(row for row in state["qa_log"] if row["id"] == qa_id)


# 契約 1: `／` 束ねが解ける。


def test_slash_bundle_releases_absorbed_sections() -> None:
    state = _state()
    stm.split_qa_bundle(state, "qa-uiux")
    entry = _entry(state, "qa-uiux")
    assert MODE_ANSWER not in entry["answer"]
    assert SCOPE_ANSWER not in entry["answer"]
    assert OWN_ANSWER in entry["answer"]
    assert entry["scope_notes"]["bundled"] is False
    assert entry["scope_notes"]["absorbed_origins_released"] == ["qa-mode", "qa-scope"]
    assert entry["scope_notes"]["split_form"] == "slash"


def test_framing_prefix_survives_the_split() -> None:
    """前置きは取り込み元に無い。外すと、このターンが何だったか分からなくなる。"""
    state = _state()
    stm.split_qa_bundle(state, "qa-uiux")
    assert FRAMING in _entry(state, "qa-uiux")["answer"]


def test_absorbed_origins_keep_their_own_answer() -> None:
    """外した節の本文は取り込み元へ byte 単位で残る (内容が失われていない)。"""
    state = _state()
    stm.split_qa_bundle(state, "qa-uiux")
    assert _entry(state, "qa-mode")["answer"] == MODE_ANSWER
    assert _entry(state, "qa-scope")["answer"] == SCOPE_ANSWER


def test_cell_cites_every_origin_after_the_split() -> None:
    """裏付けの範囲がセル側の qa_refs[] へ移り、参照先が壊れない (受入条件 2)。"""
    state = _state()
    stm.split_qa_bundle(state, "qa-uiux")
    cell = state["matrix"]["ui-ux"]["web"]
    assert cell["qa_refs"] == ["qa-uiux", "qa-mode", "qa-scope"]
    assert cell["state"] == "確定"


def test_heading_bundles_are_unaffected() -> None:
    """見出し形式の束ねは従来どおり読む (形式の追加であって差し替えではない)。"""
    span_mode = "### qa-mode（docs/spec/03 §1）"
    span_own = "### qa-uiux（docs/spec/03 §2）"
    answer = f"{span_mode}\n{MODE_ANSWER}\n\n{span_own}\n{OWN_ANSWER}\n"
    state = _state(
        answer=answer,
        topics=[
            {"origin_qa_id": "qa-mode", "answer_span": span_mode},
            {"origin_qa_id": "qa-uiux", "answer_span": span_own},
        ],
    )
    stm.split_qa_bundle(state, "qa-uiux")
    entry = _entry(state, "qa-uiux")
    assert entry["answer"] == OWN_ANSWER
    assert entry["scope_notes"]["split_form"] == "heading"


# 契約 2: 文中の `／` を区切りと取り違えない (受入条件 3)。


def test_inline_slash_does_not_get_split() -> None:
    """節の数が論点の数と合わないので割らない。誤って割るより解けない方が良い。"""
    inline = "並べて比べる／絞り込む／書き出す"
    state = _state(
        answer=f"{FRAMING}{inline}／{OWN_ANSWER}",
        topics=[
            {"origin_qa_id": "qa-mode", "answer_span": inline},
            {"origin_qa_id": "qa-uiux", "answer_span": OWN_ANSWER},
        ],
    )
    _entry(state, "qa-mode")["answer"] = inline
    with pytest.raises(TransitionError, match="数が合わない"):
        stm.split_qa_bundle(state, "qa-uiux")


def test_a_refused_split_leaves_the_entry_untouched() -> None:
    """止まったときに本文が半分だけ削れていない (割らないなら何も書かない)。"""
    inline = "並べて比べる／絞り込む／書き出す"
    answer = f"{FRAMING}{inline}／{OWN_ANSWER}"
    state = _state(
        answer=answer,
        topics=[
            {"origin_qa_id": "qa-mode", "answer_span": inline},
            {"origin_qa_id": "qa-uiux", "answer_span": OWN_ANSWER},
        ],
    )
    _entry(state, "qa-mode")["answer"] = inline
    with pytest.raises(TransitionError):
        stm.split_qa_bundle(state, "qa-uiux")
    entry = _entry(state, "qa-uiux")
    assert entry["answer"] == answer
    assert entry["scope_notes"]["bundled"] is True


def test_span_must_sit_in_its_own_segment() -> None:
    """順番だけで対応を決めない。span が当該節に無ければ止まる。"""
    state = _state(
        topics=[
            {"origin_qa_id": "qa-scope", "answer_span": SCOPE_ANSWER},
            {"origin_qa_id": "qa-mode", "answer_span": MODE_ANSWER},
            {"origin_qa_id": "qa-uiux", "answer_span": OWN_ANSWER},
        ]
    )
    with pytest.raises(TransitionError, match="対応が決まらない"):
        stm.split_qa_bundle(state, "qa-uiux")


def test_answer_without_any_separator_is_refused() -> None:
    """見出しも `／` も無い本文は、節を特定できないので解かない。"""
    state = _state(
        answer=OWN_ANSWER,
        topics=[
            {"origin_qa_id": "qa-mode", "answer_span": MODE_ANSWER},
            {"origin_qa_id": "qa-uiux", "answer_span": OWN_ANSWER},
        ],
    )
    with pytest.raises(TransitionError, match="節を特定できない"):
        stm.split_qa_bundle(state, "qa-uiux")


# 契約 3: 取り込み元と byte 単位で対応しない節は削らない。


def test_section_absent_from_its_origin_is_not_deleted() -> None:
    """節の本文が取り込み元の何処にも無いなら、削ると内容が失われるので止める。

    削って良い条件は「取り込み元に byte 単位で在る」だけである。取り込み元が後から
    文を足した (下の `test_partial_quote_of_an_origin_is_released`) のは削って良い側で、
    束ねの側が別の内容を持っているのは削ってはいけない側。境目は**在るか無いか**。
    """
    state = _state()
    _entry(state, "qa-mode")["answer"] = "人が確認してから反映する"
    with pytest.raises(TransitionError, match="一致しない"):
        stm.split_qa_bundle(state, "qa-uiux")


def test_partial_quote_of_an_origin_is_released() -> None:
    """束ねが取り込み元の一部だけを引いていた場合、全文は取り込み元に在るので外せる。"""
    full = f"前段の説明。{MODE_ANSWER}"
    state = _state()
    _entry(state, "qa-mode")["answer"] = full
    stm.split_qa_bundle(state, "qa-uiux")
    entry = _entry(state, "qa-uiux")
    assert MODE_ANSWER not in entry["answer"]
    assert _entry(state, "qa-mode")["answer"] == full


def test_pure_aggregate_without_an_own_section_is_refused() -> None:
    """自分の節が無い束ねは解かない。全部外すと本文が空になり、記録が消える。"""
    state = _state(
        answer=f"{FRAMING}{MODE_ANSWER}／{SCOPE_ANSWER}",
        topics=[
            {"origin_qa_id": "qa-mode", "answer_span": MODE_ANSWER},
            {"origin_qa_id": "qa-scope", "answer_span": SCOPE_ANSWER},
        ],
    )
    with pytest.raises(TransitionError, match="自身を origin とする topic が無い"):
        stm.split_qa_bundle(state, "qa-uiux")


def test_split_is_not_repeatable() -> None:
    """2 度目は `bundled=true` でないので拒否される (二重に削らない)。"""
    state = _state()
    stm.split_qa_bundle(state, "qa-uiux")
    with pytest.raises(TransitionError, match="bundled=true でない"):
        stm.split_qa_bundle(state, "qa-uiux")
