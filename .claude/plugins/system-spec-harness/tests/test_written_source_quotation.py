# /// script
# name: test-written-source-quotation
# version: 0.1.0
# purpose: written-requirements entry の引用が文書と逐語で一致することを確かめてから封をする 2 writer を固定する pytest。
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
"""「文書にこう書いてある」という封が、本当に文書を見ているかを固定する。

**実際に起きた壊れ方 (2026-08-21)**: `source.sha256` は `sha256(answer)`、つまり
**answer 自身の指紋**だった。answer から作る値なので、answer を何に書き換えても
取り直せば一致する。文書を 1 度も読んでいない。実測でも、束ね解除の前から回答は
`source.path` の文書に逐語で在らず、それでも封は全件一致していた。

この構造だと 2 つのことが同時に起きても誰も気づかない:

- 表の行から**末尾の列が落ちる** (`| 3 深い門 | **手動のみ** | … |` は文書側の
  `| 3 深い門 | **手動のみ**（定例なし。打つ場面は下） | … | 全体ミューテーション / … |`
  から 1 列まるごと欠けていた)
- 文書に無い文が**足される**

固定するのは 6 点:
(a) 封をする前に、回答の非空行が 1 行残らず文書に在ることを確かめる
(b) **部分一致では通さない**。表の行は列を末尾から削っても元の行の前方一致部分なので、
    `line in document` だと欠けた引用が通る。これが実際の抜け道だった
(c) 文書側の折り返し (字下げの続き行) を畳んでから突き合わせる。畳まないと、
    正しい引用が「文書に無い」と誤判定され、**要件の文を削る方向へ直してしまう**
(d) 引用する側も同じ関数で畳む。片側だけ畳むと、中身が同じでも一致しない
(e) 直す向きは **state → 文書** の一方向。文書が正で、state は引用に過ぎない
(f) 錨は行の形から writer が決める。呼び出し側から受け取らない
"""
from __future__ import annotations

import hashlib
import inspect
import sys
from pathlib import Path

import pytest

ELICIT_SCRIPTS = (
    Path(__file__).resolve().parent.parent / "skills/run-system-spec-elicit/scripts"
)
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402

DOC = """# 見出し

| 段 | 誰が打つか | 時間 | 落ちたら | 中身 |
| 1 速い門 | push / PR | 5 分 | **止める** | 型検査 / 書き方 |
| 3 深い門 | **手動のみ**（定例なし） | 40 分 | 止めない | 負荷 / 脆弱性 |

- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、
  「絵として写しにくい部品があります。」を常に表示し、
  プレビューを見てから送る。
- **FB-AC-10**: 「撮り直す」を常に選べる。
"""

FOLDED_09 = (
    "- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、"
    "「絵として写しにくい部品があります。」を常に表示し、プレビューを見てから送る。"
)


@pytest.fixture()
def doc(tmp_path: Path) -> Path:
    target = tmp_path / "spec.md"
    target.write_text(DOC, encoding="utf-8")
    return target


def _state(doc_path: Path, answer: str, kind: str = "written-requirements") -> dict:
    return {
        "qa_log": [
            {
                "id": "qa-x",
                "question": "?",
                "answer": answer,
                "source": {
                    "kind": kind,
                    "path": str(doc_path),
                    "section": "§1",
                    "sha256": "0" * 64,
                },
            }
        ]
    }


def _entry(state: dict) -> dict:
    return state["qa_log"][0]


# ── (c)(d) 折り返しを畳む ───────────────────────────────────────────────────
def test_folding_joins_indented_continuation_lines():
    folded = stm.logical_document_lines(DOC)
    assert FOLDED_09 in folded
    # 畳まないと 1 行目しか残らない。**その 1 行目で置き換えると要件の文が消える。**
    assert "- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、" not in folded


def test_folding_is_applied_to_the_quoting_side_too():
    """文書と同じ折り返しのまま引用している回答が、そのまま通ること。"""
    answer = (
        "- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、\n"
        "  「絵として写しにくい部品があります。」を常に表示し、\n"
        "  プレビューを見てから送る。\n"
    )
    assert stm.unquoted_answer_lines(answer, DOC) == []


# ── (g) 体裁の記号は中身ではない ───────────────────────────────────────────
BQ_DOC = "> 目指す状態は次のとおりである。\n> | 段 | 誰が | 中身 |\n"


def test_block_quote_marker_is_decoration_not_content():
    """**2026-08-21 に誤判定した形。**文書側が `> ` で始まり、引く側が落としている。

    この 3 件 (`qa-foundation-u1` / `u3` / `u4`) を「別の文へ言い換えた要約」と
    読み、直す側へ回れば**文書の原文を要約で上書きしていた。**部分一致・折り返しに
    続いて同じ形で 3 度目である。
    """
    assert stm.unquoted_answer_lines("目指す状態は次のとおりである。\n", BQ_DOC) == []
    # 引く側が `> ` を保ったままでも通る (両側を同じ関数で正規化する)
    assert stm.unquoted_answer_lines("> 目指す状態は次のとおりである。\n", BQ_DOC) == []


def test_normalizing_the_marker_does_not_reopen_truncation():
    """**正規化は切り詰めを通す穴にならない。**`> ` を落とした残り全体の完全一致を要求する。"""
    truncated = "| 段 | 誰が |"
    assert stm.unquoted_answer_lines(truncated + "\n", BQ_DOC) == [truncated]
    added = "目指す状態は次のとおりである。ただし例外がある。"
    assert stm.unquoted_answer_lines(added + "\n", BQ_DOC) == [added]


def test_only_the_block_quote_marker_is_stripped():
    """表の区切りや箇条の印は落とさない。落とすと列や項目を削った行が一致してしまう。"""
    assert stm.undecorate_line("> 本文") == "本文"
    assert stm.undecorate_line("| 段 | 誰が |") == "| 段 | 誰が |"
    assert stm.undecorate_line("- **X-01**: 本文") == "- **X-01**: 本文"


def test_requote_leaves_a_block_quoted_line_alone(tmp_path: Path):
    """照合が通る行を requote が書き換えないこと。

    片方だけ緩いと「照合は通るのに requote が書き換える」形になる。
    """
    target = tmp_path / "bq.md"
    target.write_text(BQ_DOC, encoding="utf-8")
    answer = "目指す状態は次のとおりである。\n"
    state = _state(target, answer)
    assert stm.requote_written_source(state, "qa-x") == []
    assert _entry(state)["answer"] == answer  # 触らない


# ── (b) 部分一致では通さない ────────────────────────────────────────────────
def test_truncated_table_row_is_not_a_quotation():
    """**これが実際の抜け道だった。**末尾の列を削った行は元の行の前方一致部分なので、
    `line in document` で見ていると通ってしまう。"""
    truncated = "| 1 速い門 | push / PR | 5 分 | **止める** |"
    assert truncated in DOC  # 部分一致では在る
    assert stm.unquoted_answer_lines(truncated + "\n", DOC) == [truncated]  # 引用としては無い


# ── (a) 確かめてから封をする ────────────────────────────────────────────────
def test_reseal_refuses_when_a_line_is_not_in_the_document(doc: Path):
    state = _state(doc, "- 文書に無い行\n")
    with pytest.raises(TransitionError, match="逐語で無い行"):
        stm.reseal_written_source(state, "qa-x")
    assert _entry(state)["source"]["sha256"] == "0" * 64  # 書かずに止まる


def test_reseal_recomputes_only_after_the_text_checks_out(doc: Path):
    answer = "| 3 深い門 | **手動のみ**（定例なし） | 40 分 | 止めない | 負荷 / 脆弱性 |\n"
    state = _state(doc, answer)
    stm.reseal_written_source(state, "qa-x")
    source = _entry(state)["source"]
    assert source["sha256"] == hashlib.sha256(answer.encode("utf-8")).hexdigest()
    assert source["resealed_with"] == stm.RESEAL_WRITER


def test_reseal_is_idempotent(doc: Path):
    answer = "- **FB-AC-10**: 「撮り直す」を常に選べる。\n"
    state = _state(doc, answer)
    stm.reseal_written_source(state, "qa-x")
    first = dict(_entry(state)["source"])
    stm.reseal_written_source(state, "qa-x")
    assert _entry(state)["source"] == first


def test_reseal_takes_no_digest_and_no_path_argument():
    """呼ぶ側が「どの文書を根拠と名乗るか」「どんな指紋を名乗るか」を選べないこと。"""
    assert list(inspect.signature(stm.reseal_written_source).parameters) == ["state", "qa_id"]
    assert list(inspect.signature(stm.requote_written_source).parameters) == ["state", "qa_id"]


def test_reseal_refuses_dialogue_entries(doc: Path):
    state = _state(doc, "- **FB-AC-10**: 「撮り直す」を常に選べる。\n", kind="user-dialogue")
    with pytest.raises(TransitionError, match="written-requirements でない"):
        stm.reseal_written_source(state, "qa-x")


# ── (e) 直す向きは state → 文書 の一方向 ────────────────────────────────────
def test_requote_restores_the_dropped_columns_from_the_document(doc: Path):
    state = _state(doc, "| 1 速い門 | push / PR | 5 分 | **止める** |\n")
    assert stm.requote_written_source(state, "qa-x") == ["| 1 速い門 |"]
    assert _entry(state)["answer"] == "| 1 速い門 | push / PR | 5 分 | **止める** | 型検査 / 書き方 |"
    # 直した後は封をできる。**順番が逆にはならない** (確かめる前に封はしない)。
    stm.reseal_written_source(state, "qa-x")


def test_requote_never_shortens_a_line(doc: Path):
    """折り返しを畳まずに直すと、要件の文を削る方向へ「直して」しまう。

    2026-08-21 の試走で実際にここを踏み、FB-AC-09 が 1 行目だけの形へ
    置き換わりかけた。**短くなる置き換えは直しではない。**
    """
    state = _state(doc, "- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、要約。\n")
    stm.requote_written_source(state, "qa-x")
    assert _entry(state)["answer"] == FOLDED_09


def test_requote_leaves_a_correct_quotation_alone(doc: Path):
    answer = "- **FB-AC-10**: 「撮り直す」を常に選べる。\n"
    state = _state(doc, answer)
    assert stm.requote_written_source(state, "qa-x") == []
    assert _entry(state)["answer"] == answer  # 触らない
    assert "requoted_with" not in _entry(state)["source"]


# ── (f) 錨は行の形から決まる ────────────────────────────────────────────────
def test_anchor_is_derived_from_the_shape_of_the_line():
    assert stm.quotation_anchor("| 3 深い門 | ほか |") == "| 3 深い門 |"
    assert stm.quotation_anchor("- **FB-AC-09**: 本文") == "- **FB-AC-09**:"
    # 自由文は錨を持たない。**「だいたい似ている行」へ寄せない**ので閾値も持たない。
    assert stm.quotation_anchor("ふつうの文です。") is None


def test_requote_refuses_a_free_form_line(doc: Path):
    state = _state(doc, "文書に無いふつうの文。\n")
    with pytest.raises(TransitionError, match="決められない"):
        stm.requote_written_source(state, "qa-x")


def test_requote_refuses_when_the_anchor_is_not_unique(tmp_path: Path):
    target = tmp_path / "dup.md"
    target.write_text("| 同じ頭 | A |\n| 同じ頭 | B |\n", encoding="utf-8")
    state = _state(target, "| 同じ頭 | 何か違うもの |\n")
    with pytest.raises(TransitionError, match="2 行ある"):
        stm.requote_written_source(state, "qa-x")


def test_requote_refuses_when_the_anchor_is_absent(doc: Path):
    state = _state(doc, "| 存在しない段 | ほか |\n")
    with pytest.raises(TransitionError, match="0 行ある"):
        stm.requote_written_source(state, "qa-x")


def test_writers_refuse_unknown_qa_id(doc: Path):
    for writer in (stm.reseal_written_source, stm.requote_written_source):
        with pytest.raises(TransitionError, match="qa_log に存在しない"):
            writer(_state(doc, "x\n"), "qa-missing")
