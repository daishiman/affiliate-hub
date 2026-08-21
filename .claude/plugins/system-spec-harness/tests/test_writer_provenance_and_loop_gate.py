# /// script
# name: test-writer-provenance-and-loop-gate
# version: 0.1.0
# purpose: 正本 state の書込経路のうち「出所を呼び出し側が名乗れる」穴 (set-decision / set-knowledge-candidate) と「上限超えを未記名のまま書き進められる」穴 (CLI 入口) を塞いだことを固定する pytest。
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
"""completeness-report gap 5 (正本 state の書込経路) を writer 側で塞いだことを固定する。

gap の文面は「hearing_progress の loop 7>5 と decisions の recorded_with 自己申告は
**同一原因**」と述べていた。実測ではこれは 2 つの別の原因である。本 test はその区別ごと
固定する——区別を失うと、片方だけ塞いで両方塞いだことになるからである。

原因 A (loop 7>5): run_chunk は処理件数が max_loops に達した時点で break するため、
  **この writer は上限超えを生み出せない** (test_run_chunk_cannot_manufacture_an_overrun)。
  よって 7 は writer の外から入った。塞ぐ場所は writer の中ではなく入口で、
  「未記名の超過を抱えた state に更なる transition を許さない」ことになる。
  上限 (5) は動かさない。超過値 (7) も丸めない。要求するのは由来の記載だけである。

原因 B (recorded_with 自己申告): set_decision は受け取った dict をそのまま state へ
  写していたため、呼び出し側が `recorded_with` を書けた。こちらは writer の**外**では
  なく writer を**通って**入る。門を通したことは、この欄については何の保証でもなかった。
  set-qa-scope-notes / set-qa-written-up は既に writer が定数を打刻する流儀なので、
  set-decision をその先例へ揃える。

塞げていないところ: 欄名の一致でしか見ていない。別名の欄を新設して出所を名乗る道も、
answer 本文へ「正規の writer で書いた」と書く道も、ここでは止まらない。
"""
from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
ELICIT_SCRIPTS = PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts"
WRITER = ELICIT_SCRIPTS / "apply-spec-transition.py"
sys.path.insert(0, str(ELICIT_SCRIPTS))
# state_transition_foundation は plugin 直下の scripts/ (foundation_provenance) にも依存する。
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import state_transition_matrix as stm  # noqa: E402
from state_transition_common import (  # noqa: E402
    SELF_DECLARED_PROVENANCE_FIELDS,
    TransitionError,
)
from state_transition_foundation import DECISION_WRITER, set_decision  # noqa: E402
from state_transition_knowledge import set_knowledge_candidate  # noqa: E402


def _writer_module():
    spec = importlib.util.spec_from_file_location("apply_spec_transition_gate", WRITER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(WRITER), *args], capture_output=True, text=True)


def _state_with_goal() -> dict:
    state = stm.bootstrap_state()
    state["requirements_foundation"] = {"goals": [{"id": "goal-1", "text": "手離れさせる"}]}
    return state


def _decision(**over) -> dict:
    """set_decision の既存検査を全部通る最小 decision。status は needs_guidance。

    needs_guidance を選ぶのは recommendation を持たない最小形だからで、
    出所欄の検査に recommendation は関与しない。
    """
    option = {
        "id": "opt-a",
        "label": "案 A",
        "cost_model": {
            "category": "free",
            "amount": 0,
            "currency": "JPY",
            "billing_period": "month",
            "tco": "0",
        },
        "free_tier_limits": "上限あり",
        "goal_fit": "適合",
        "security_fit": "可",
        "pros": ["安い"],
        "cons": ["制限"],
        "risks": ["変更"],
        "lock_in": "低",
        "ops_burden": "低",
        "evidence_refs": ["https://example.com/a"],
    }
    other = dict(option, id="opt-b", label="案 B")
    other["cost_model"] = dict(option["cost_model"], category="paid", amount=10, tco="10")
    other["evidence_refs"] = ["https://example.com/b"]
    decision = {
        "id": "decision-x",
        "question": "どちらにするか",
        "status": "needs_guidance",
        "serves_goals": ["goal-1"],
        "options": [option, other],
    }
    decision.update(over)
    return decision


def _candidate(**over) -> dict:
    candidate = {
        "id": "cand-x",
        "topic": "話題",
        "status": "discovered",
        "problem": "問題",
        "serves_goals": ["goal-1"],
        "source_refs": [],
    }
    candidate.update(over)
    return candidate


# ── 原因 B: 出所を呼び出し側が名乗れない ────────────────────────────────


def test_set_decision_refuses_caller_supplied_provenance() -> None:
    """『正規の writer を通した』と record 自身に書かせない。

    黙って捨てるのではなく拒否する。捨てると、名乗ろうとした事実まで state から
    消え、呼び出し側は自分の主張が採用されなかったことに気づけない。
    """
    for field in SELF_DECLARED_PROVENANCE_FIELDS:
        state = _state_with_goal()
        with pytest.raises(TransitionError) as excinfo:
            set_decision(state, _decision(**{field: "門のある writer で書いた"}))
        assert field in str(excinfo.value)
        assert state.get("decisions") in (None, []), f"拒否したのに書かれている: {field}"


def test_set_decision_stamps_the_writer_name_itself() -> None:
    state = _state_with_goal()
    set_decision(state, _decision())
    assert state["decisions"][0]["recorded_with"] == DECISION_WRITER


def test_reupsert_preserves_provenance_written_before_the_stamp_existed() -> None:
    """打刻導入前に書かれた出所は、上書きせず別欄へ退避する。

    正本 state の decision-test-ci-tooling が持つ長い自己申告文は、
    『門の無い経路で書かれた』ことを示す唯一の痕跡でもある。文言を
    `set-decision` へ揃えると数は合うが、痕跡は消える。loop_count の
    超過値を丸めないのと同じ理由で、値は残し欄名で意味を変える。
    """
    state = _state_with_goal()
    narrative = "以前この record を書いた際は門が無い writer で書いた状態だった"
    state["decisions"] = [{"id": "decision-x", "recorded_with": narrative}]
    set_decision(state, _decision())
    record = state["decisions"][0]
    assert record["recorded_with"] == DECISION_WRITER
    assert record["prior_unverified_provenance"] == narrative


def test_set_knowledge_candidate_refuses_caller_supplied_provenance() -> None:
    """decisions だけ塞ぐと、隣の節が同じ穴のまま残る。

    こちらは打刻までは行わない。この節には出所欄の先例が無く、writer 側から
    無い欄を増やすと契約が先に動いてしまう。名乗れる道だけを閉じる。
    """
    state = _state_with_goal()
    with pytest.raises(TransitionError) as excinfo:
        set_knowledge_candidate(state, _candidate(recorded_with="正規経路"))
    assert "recorded_with" in str(excinfo.value)
    assert state.get("knowledge_candidates") in (None, [])

    set_knowledge_candidate(state, _candidate())
    assert state["knowledge_candidates"][0]["id"] == "cand-x"


# ── 原因 A: 上限超えは writer の外から来る ───────────────────────────────


def test_run_chunk_cannot_manufacture_an_overrun() -> None:
    """『7 は writer の外から来た』という推論の前提を測って固定する。

    この前提が崩れると、下の入口ゲートは無関係な state を止めるだけの飾りになる。
    """
    state = stm.bootstrap_state()
    state["hearing_progress"] = {"loop_count": 0, "next_question": None, "complete": False}
    processed = stm.run_chunk(state, [{"ops": []} for _ in range(20)], max_loops=5)
    assert processed == 5
    assert state["hearing_progress"]["loop_count"] == 5
    assert not stm.loop_limit_is_violated(state["hearing_progress"])


def _overrun_state(with_reason: bool) -> dict:
    state = stm.bootstrap_state()
    state["hearing_progress"] = {
        "loop_count": 7,
        "max_loops": 5,
        "max_loops_policy": "strict",
        "next_question": None,
        "complete": True,
    }
    if with_reason:
        state["hearing_progress"]["limit_overrun"] = {
            "loop_count": 7,
            "max_loops": 5,
            "reason": "writer を通らずに書かれた痕跡として保存する",
        }
    return state


def test_undocumented_overrun_blocks_further_transitions(tmp_path: Path) -> None:
    source = tmp_path / "state.json"
    source.write_text(json.dumps(_overrun_state(with_reason=False), ensure_ascii=False), encoding="utf-8")
    result = _run(["aggregate", "--state", str(source)])
    assert result.returncode == 1
    assert "limit_overrun" in result.stderr
    # 止めたのだから、元の state は 1 バイトも書き換わっていない。
    assert json.loads(source.read_text(encoding="utf-8"))["hearing_progress"]["loop_count"] == 7


def test_documented_overrun_passes_and_the_numbers_are_not_rounded(tmp_path: Path) -> None:
    """由来さえ書けば通る。**通るときに 7 が 5 へ丸められていない**ことまで見る。

    丸めて通す実装でもこのテストの前半 (returncode == 0) は緑になる。
    痕跡が残ることを別に測らないと、緩めた実装と区別できない。
    """
    source = tmp_path / "state.json"
    out = tmp_path / "out.json"
    source.write_text(json.dumps(_overrun_state(with_reason=True), ensure_ascii=False), encoding="utf-8")
    result = _run(["aggregate", "--state", str(source), "--out", str(out)])
    assert result.returncode == 0, result.stderr
    progress = json.loads(out.read_text(encoding="utf-8"))["hearing_progress"]
    assert progress["loop_count"] == 7
    assert progress["max_loops"] == 5


def test_set_hearing_policy_is_exempt_so_the_reason_can_be_written(tmp_path: Path) -> None:
    """由来を書く唯一の op を、由来が無いことを理由に塞がない。

    塞ぐと state は未記名の超過を抱えたまま、記名する手段を失って詰む。
    """
    source = tmp_path / "state.json"
    out = tmp_path / "out.json"
    source.write_text(json.dumps(_overrun_state(with_reason=False), ensure_ascii=False), encoding="utf-8")
    overrun = json.dumps({"reason": "この writer の外から書かれた痕跡", "recorded_at": "2026-08-21T00:00:00Z"}, ensure_ascii=False)
    result = _run(
        ["set-hearing-policy", "--state", str(source), "--policy", "strict", "--overrun", overrun, "--out", str(out)]
    )
    assert result.returncode == 0, result.stderr
    progress = json.loads(out.read_text(encoding="utf-8"))["hearing_progress"]
    assert progress["limit_overrun"]["reason"] == "この writer の外から書かれた痕跡"
    assert progress["loop_count"] == 7


def test_the_canonical_state_passes_both_gates() -> None:
    """正本 state を、変更後の門に読ませて落ちないことを確かめる (書き戻さない)。

    正本は既に limit_overrun.reason を持ち、decisions には打刻導入前の
    自己申告文が 1 件残っている。前者は通り、後者は state を読むだけでは
    落ちない (拒否するのは書込時の payload であって既存 record ではない)。
    """
    canonical = PLUGIN_ROOT.parents[2] / "system-spec" / "spec-state.json"
    if not canonical.is_file():
        pytest.skip(f"正本 state が無い環境: {canonical}")
    module = _writer_module()
    state = json.loads(canonical.read_text(encoding="utf-8"))
    module._require_writable_state(state)
    module._require_documented_loop_overrun(copy.deepcopy(state), "aggregate")
