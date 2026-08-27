#!/usr/bin/env python3
# /// script
# name: test-qa-supersession
# version: 0.1.0
# purpose: 孤立した質疑に後継 (superseded_by) を名乗らせる writer と決定論ゲートの受入テスト。
#          孤立を禁じるのではなく名乗らせる設計を固定し、緩め方向の抜け道 (実在しない後継への
#          逃がし・まだ引かれている質疑の封印) を塞ぐ。
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
"""置き換えなのか接地忘れなのかを、正本の側に名乗らせる。"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
WRITER_DIR = PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts"
sys.path.insert(0, str(WRITER_DIR))
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402


def _load_validator():
    path = PLUGIN_ROOT / "scripts" / "validate-coverage-matrix.py"
    spec = importlib.util.spec_from_file_location("vcm", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VCM = _load_validator()


def _state(**matrix) -> dict:
    return {
        "matrix": matrix,
        "qa_log": [
            {"id": "qa-old", "question": "q", "answer": "a"},
            {"id": "qa-new", "question": "q", "answer": "a"},
        ],
    }


def test_supersession_is_recorded_on_the_old_entry():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new", "qa_refs": ["qa-new"]}})
    stm.supersede_qa(state, "qa-old", "qa-new")
    assert state["qa_log"][0]["superseded_by"] == "qa-new"


def test_reapplying_the_same_successor_is_idempotent():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    stm.supersede_qa(state, "qa-old", "qa-new")
    stm.supersede_qa(state, "qa-old", "qa-new")
    assert state["qa_log"][0]["superseded_by"] == "qa-new"


def test_changing_the_successor_is_refused():
    """後継の付け替えを黙って通すと、置き換えの経路が後から書き換わる。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    state["qa_log"].append({"id": "qa-third", "question": "q", "answer": "a"})
    stm.supersede_qa(state, "qa-old", "qa-new")
    with pytest.raises(TransitionError, match="異なる再適用は拒否"):
        stm.supersede_qa(state, "qa-old", "qa-third")


def test_a_qa_that_is_still_cited_cannot_be_sealed():
    """引かれているものを封じると、確定セルの根拠が黙って死ぬ。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-old"}})
    with pytest.raises(TransitionError, match="まだセルから引かれている"):
        stm.supersede_qa(state, "qa-old", "qa-new")


def test_backing_refs_also_count_as_being_cited():
    """裏付け (`qa_refs`) を見落とすと、生きている質疑を孤立と誤判定する。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new", "qa_refs": ["qa-old"]}})
    with pytest.raises(TransitionError, match="まだセルから引かれている"):
        stm.supersede_qa(state, "qa-old", "qa-new")


def test_a_successor_that_does_not_exist_is_refused():
    """実在しない id への逃がしを許すと、申告は書式だけの儀式になる。"""
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    with pytest.raises(TransitionError, match="qa_log に不在"):
        stm.supersede_qa(state, "qa-old", "qa-nonexistent")


def test_self_supersession_is_refused():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    with pytest.raises(TransitionError, match="自分自身"):
        stm.supersede_qa(state, "qa-old", "qa-old")


def test_gate_flags_an_orphan_with_no_declaration():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    findings = VCM._validate_declared_qa_supersession(state)
    assert any("qa-old" in f and "superseded_by" in f for f in findings)


def test_gate_accepts_an_orphan_once_the_successor_is_declared():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    stm.supersede_qa(state, "qa-old", "qa-new")
    assert VCM._validate_declared_qa_supersession(state) == []


def test_gate_refuses_an_escape_to_a_nonexistent_successor():
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    state["qa_log"][0]["superseded_by"] = "qa-ghost"
    findings = VCM._validate_declared_qa_supersession(state)
    assert any("qa_log に不在" in f for f in findings)


def test_reopen_log_discard_counts_as_a_declaration():
    """置き換えの記録は reopen_log の discarded にも在る。

    セルだけを見る検査はこれを見落とし、正本が既に記録している置き換えを
    「未接地」として報告していた (実測 2026-08-16 の C05 gaps[0])。
    """
    state = _state(ui={"web": {"state": "確定", "qa_ref": "qa-new"}})
    state["reopen_log"] = [{"category": "ui", "platform": "web", "discarded": {"qa_ref": "qa-old"}}]
    assert VCM._validate_declared_qa_supersession(state) == []


def test_foundation_grounding_counts_as_being_referenced():
    """foundation を裏付ける質疑はセルからは引かれない。経路を数えず全域を見る。"""
    state = {
        "matrix": {},
        "qa_log": [{"id": "qa-foundation-u1", "question": "q", "answer": "a"}],
        "requirements_foundation": {
            "provenance": {"field_sources": [{"field": "goals[0]", "grounded_by": "qa-foundation-u1"}]}
        },
    }
    assert VCM._validate_declared_qa_supersession(state) == []
