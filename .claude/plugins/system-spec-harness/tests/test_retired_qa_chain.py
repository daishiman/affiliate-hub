# /// script
# name: test-retired-qa-chain
# version: 0.1.0
# purpose: 引退した質疑の設計適用について、後継の鎖の先が確定セルへ届くときだけ免除され、宣言の無い孤立や循環や鎖の全員が孤立した形は落ち続けることを固定する pytest。
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
"""**世代を重ねた質疑が、記録を直せないまま門に落ち続けない。**

**何が起きていたか (2026-09-03 実測)**

独立監査 C06 の誘導質問の指摘を受けて質疑を作り直したところ、v4 -> v5 -> v6 の
鎖ができた。v4 は v5 を後継と宣言済みで、その時点では v5 が確定セルから引かれて
いたので門を通っていた。ところが v6 世代への差し替えで v5 が引かれなくなり、
v4 は「後継が孤立している」として落ちた。

**なぜ記録の側で直せないか**

`supersede-qa` は既存の `superseded_by` と異なる値での再適用を拒否する。宣言は
「その時点で何を後継としたか」の履歴であり、張り替えると経過が消えるからである。
つまり v4 の宣言先を v6 へ書き換える手は無い。**直すべきは記録ではなく読み方**で、
門が鎖を辿る。

**それでも落ち続けなければならない形**

- `superseded_by` の宣言が無い孤立 (2026-08-24 の事故そのもの)
- 宣言先が qa_log に実在しない
- 鎖の全員がどのセルからも引かれていない
- 鎖が循環している
"""

import importlib.util
import pathlib

import pytest

_GATE = (
    pathlib.Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate-coverage-matrix.py"
)


def _load_gate():
    spec = importlib.util.spec_from_file_location("_coverage_gate", _GATE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gate = _load_gate()


def _qa(qa_id, successor=None):
    entry = {"id": qa_id, "design_applications": [{"knowledge_ref": "x"}]}
    if successor is not None:
        entry["superseded_by"] = successor
    return entry


def _judge(entries, cited):
    by_id = {e["id"]: e for e in entries}
    return {
        e["id"]: gate._retired_into_a_cited_successor(e, set(cited), by_id)
        for e in entries
    }


def test_chain_reaching_a_cited_successor_is_exempt():
    """v4 -> v5 -> v6 で v6 だけが引かれていても、鎖の全員が免除される。"""
    entries = [_qa("v4", "v5"), _qa("v5", "v6"), _qa("v6")]
    assert _judge(entries, {"v6"}) == {"v4": True, "v5": True, "v6": False}


def test_declared_successor_still_required():
    """宣言の無い孤立は落ち続ける (2026-08-24 の事故を緑にしない)。"""
    assert _judge([_qa("orphan")], {"live"}) == {"orphan": False}


def test_successor_absent_from_qa_log_is_not_an_escape():
    """実在しない id への逃がしを塞ぐ。"""
    assert _judge([_qa("v4", "ghost")], {"live"}) == {"v4": False}


def test_chain_where_nobody_is_cited_falls():
    """鎖の全員が孤立していれば、設計適用の適用先はどこにも無い。"""
    entries = [_qa("v4", "v5"), _qa("v5", "v6"), _qa("v6")]
    assert _judge(entries, {"unrelated"}) == {"v4": False, "v5": False, "v6": False}


def test_cycle_terminates_and_falls():
    """A -> B -> A を辿り続けず、免除もしない。"""
    entries = [_qa("a", "b"), _qa("b", "a")]
    assert _judge(entries, {"unrelated"}) == {"a": False, "b": False}


@pytest.mark.parametrize("broken", [None, "", "   ", 42, ["v5"], {"id": "v5"}])
def test_broken_successor_values_fall_instead_of_raising(broken):
    """壊れた値は例外にせず False へ倒す。"""
    entry = {"id": "v4", "design_applications": [{"knowledge_ref": "x"}]}
    if broken is not None:
        entry["superseded_by"] = broken
    assert gate._retired_into_a_cited_successor(entry, {"live"}, {"v4": entry}) is False
