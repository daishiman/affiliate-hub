# /// script
# name: test-reopen-requires-qa-ref
# version: 0.1.0
# purpose: reopen が確定を外す根拠 (qa_log の id) を必須で名乗らせること、既存ログを遡って埋めないことを固定する pytest。
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
"""reopen が根拠となる `qa_ref` を必須で要求することの受入テスト (ah-cgg)。

**なぜ必要か。**`confirm` は長らく `qa_ref` を必須にしていて、確定がどの問答に
接地したかは機械で辿れた。ところが**確定を外す `reopen` は `reason` (writer が
中身を見ない自由文) だけで通っていた**。「見直しが要る」と書けば確定は巻き戻る。
確定する操作より、確定を外す操作の方が軽い門で通る非対称がここに在った。

**遡って埋めることはしない。**正本の `reopen_log` 124 件は `qa_ref` を 1 件も
持たない。当時名乗られなかったという事実の方が記録として正しく、後から埋めれば
「その時に根拠が在った」という嘘を作る。門は今日以降の書込にだけ効く。
"""

from __future__ import annotations

import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills/run-system-spec-elicit/scripts"))
import state_transition_matrix as stm  # noqa: E402

CELL = {"category": "database", "platform": "web"}
QA_ID = "qa-db-web"


def _confirmed_state() -> dict:
    """database/web だけを確定させた最小の state。"""
    state = stm.bootstrap_state()
    state["categories"] = [{"id": "database", "label": "database"}]
    state["matrix"] = {"database": {pf: {"state": "未収集"} for pf in stm.CANONICAL_PLATFORMS}}
    state["qa_log"] = [{"id": QA_ID, "question": "q", "answer": "a"}]
    state["matrix"]["database"]["web"] = {"state": "確定", "qa_ref": QA_ID}
    stm.recompute_aggregates(state)
    return state


@pytest.mark.parametrize("op_extra", [{}, {"qa_ref": ""}, {"qa_ref": None}, {"qa_ref": ["x"]}])
def test_reopen_without_a_named_qa_ref_is_refused(op_extra: dict) -> None:
    """名乗らない・空・型違いはすべて止まる。`reason` だけでは通れない。"""
    state = _confirmed_state()
    with pytest.raises(stm.TransitionError, match="qa_ref が必須"):
        stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "見直したい", **op_extra})
    # 止まったなら確定は動いていない。
    assert state["matrix"]["database"]["web"]["state"] == "確定"


def test_reopen_with_an_unknown_id_is_refused() -> None:
    """`qa_log` に無い id は根拠にならない。**在る形だけ整えて通す道を塞ぐ。**"""
    state = _confirmed_state()
    with pytest.raises(stm.TransitionError, match="qa_log に存在しない"):
        stm.apply_cell_op(
            state, {"action": "reopen", **CELL, "reason": "見直したい", "qa_ref": "qa-nowhere"}
        )
    assert state["matrix"]["database"]["web"]["state"] == "確定"


def test_the_named_qa_ref_lands_in_the_reopen_log() -> None:
    """要求するだけでなく**残す**。残さなければ後から辿れず、要求した意味が無い。"""
    state = _confirmed_state()
    stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "追加要件", "qa_ref": QA_ID})
    entry = state["reopen_log"][-1]
    assert entry["qa_ref"] == QA_ID
    assert entry["reason"] == "追加要件"
    assert state["matrix"]["database"]["web"]["state"] == "未収集"


def test_the_current_qa_ref_is_a_valid_ground() -> None:
    """**現行の `qa_ref` で reopen できることを、わざと守る。**

    章本文だけを現行 `qa_ref` へ揃えるための R4-reopen が現に在り、そこでは根拠が
    現行の問答であるのが正しい。「新しい id でなければならない」を足すと、
    正しい使い方の方が通れなくなる。
    """
    state = _confirmed_state()
    stm.apply_cell_op(state, {"action": "reopen", **CELL, "reason": "本文を揃える", "qa_ref": QA_ID})
    assert state["reopen_log"][-1]["qa_ref"] == QA_ID


def test_the_existing_log_is_not_back_filled() -> None:
    """門より前の 124 件は `qa_ref` を持たないまま。**埋めたら記録が嘘になる。**

    ── 当てどころを「全件が持たない」から床へ移した（2026-09-08）────

    旧版は `not any("qa_ref" in entry ...)` だった。だが門は**今日以降の書込に qa_ref を
    要求する**ので、正しい reopen が 1 件でも増えた日にこの検査は必ず赤くなる。
    実際そうなった——dev 合流で 5 セルを開け直した 8 件が qa_ref を持つ。
    **見張りたいのは増えた側ではなく、減った側である。**

    だから床にする。持たない件数が 124 を**下回った**ときだけ赤くなる——それが
    「その時に根拠が在った」という嘘を後から書き足した合figure である。新しい reopen が
    いくら増えても、この 124 は動かない。

    塞げていないところ: 124 件のうち 1 件を埋めて別の 1 件を捏造で足す、という
    差引ゼロの改竄はここを通る。件数ではなく id で押さえるのが本筋だが、
    そこまでの列挙はこの検査の主題 (遡及埋めの検出) を超える。
    """
    state_path = ROOT.parents[2] / "system-spec/spec-state.json"
    if not state_path.exists():  # plugin 単体で取り出したとき (正本が隣に無い)
        pytest.skip(f"正本が無い: {state_path}")
    log = json.loads(state_path.read_text(encoding="utf-8"))["reopen_log"]
    assert log, "reopen_log が空になっている (この見張りが何も見ていない)"
    without = [entry for entry in log if "qa_ref" not in entry]
    assert len(without) >= 124, (
        f"qa_ref を持たない reopen 記録が {len(without)} 件へ減っている。"
        "門は今日以降の書込にだけ効くはずで、遡って埋めるのは"
        "「その時に根拠が在った」という嘘を作る"
    )
