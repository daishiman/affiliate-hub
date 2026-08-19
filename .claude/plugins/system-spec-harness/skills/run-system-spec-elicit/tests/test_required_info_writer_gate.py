#!/usr/bin/env python3
# /// script
# name: test-required-info-writer-gate
# version: 0.1.0
# purpose: C16 block ゲートが決定論 writer (apply-spec-transition) で施行され、確定セルへ missing_effect が物質化されることを検証する pytest。
# inputs:
#   - argv: pytest 経由
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""確定の瞬間に block item を止める writer ゲートと、確定セルへの充足状態の物質化。

これまで C16 の block ゲートは R5 の prose と C05 の事後監査だけが担っていた。
prose は読み飛ばせ、事後監査は確定した後にしか鳴らない。ここで検証するのは
「**確定を拒否できる場所は writer だけである**」という一点である。

0 件を主張する検査 (`unhostable_blocking_domains` が空) には、必ず見つかるはずの
合成例を対にして置く。対象が空でも、探し方が壊れていても、同じ空リストが出る。
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
TAXONOMY = (
    PLUGIN_ROOT
    / "skills"
    / "ref-system-design-knowledge"
    / "references"
    / "system-category-taxonomy.json"
)
CATALOG = SKILL_DIR / "references" / "required-info-catalog.json"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mod = _load("apply_spec_transition_required_info", SKILL_DIR / "scripts" / "apply-spec-transition.py")
req = _load(
    "state_transition_required_info_under_test",
    SKILL_DIR / "scripts" / "state_transition_required_info.py",
)


def _state() -> dict:
    state = mod.init_state(json.loads(TAXONOMY.read_text(encoding="utf-8")))
    state["qa_log"].append({"id": "qa-goal", "question": "目的は?", "answer": "社内申請の一元化"})
    state["qa_log"].append({"id": "qa-auth", "question": "認証は?", "answer": "OIDC + RBAC"})
    return state


def _confirm(category: str, required_info=None, platform: str = "web") -> dict:
    op = {"action": "confirm", "category": category, "platform": platform, "qa_ref": "qa-auth"}
    if required_info is not None:
        op["required_info"] = required_info
    return op


def _auth_grounded() -> list[dict]:
    return [{"item_id": "auth-model", "status": "grounded", "grounded_by": "qa-auth"}]


def _uiux_grounded() -> list[dict]:
    return [
        {"item_id": "product-goal", "status": "grounded", "grounded_by": "qa-goal"},
        {"item_id": "target-platforms", "status": "grounded", "grounded_by": "qa-goal"},
        {"item_id": "screen-information-priority", "status": "grounded", "grounded_by": "qa-goal"},
    ]


# --- 確定の瞬間に止める -------------------------------------------------------


def test_confirm_without_a_block_item_record_is_refused() -> None:
    with pytest.raises(mod.TransitionError) as excinfo:
        mod.apply_cell_op(_state(), _confirm("auth"))
    assert "auth-model" in str(excinfo.value)


def test_confirm_with_a_grounded_block_item_succeeds() -> None:
    state = _state()
    mod.apply_cell_op(state, _confirm("auth", _auth_grounded()))
    cell = state["matrix"]["auth"]["web"]
    assert cell["state"] == "確定"
    assert cell["required_info"] == [
        {
            "item_id": "auth-model",
            "missing_effect": "block",
            "status": "grounded",
            "grounded_by": "qa-auth",
        }
    ]


def test_a_category_with_no_block_item_records_nothing() -> None:
    """database の item は degrade なので、記録欄を作らない (空欄の飾りを残さない)。"""
    state = _state()
    mod.apply_cell_op(state, _confirm("database"))
    assert "required_info" not in state["matrix"]["database"]["web"]


def test_missing_effect_comes_from_the_catalog_not_from_the_caller() -> None:
    """呼び出し側が warn と名乗ってもゲートは外れない。"""
    state = _state()
    entries = [dict(_auth_grounded()[0], missing_effect="warn")]
    mod.apply_cell_op(state, _confirm("auth", entries))
    assert state["matrix"]["auth"]["web"]["required_info"][0]["missing_effect"] == "block"


def test_grounded_by_must_exist_in_the_qa_log() -> None:
    state = _state()
    entries = [{"item_id": "auth-model", "status": "grounded", "grounded_by": "qa-nowhere"}]
    with pytest.raises(mod.TransitionError, match="qa-nowhere"):
        mod.apply_cell_op(state, _confirm("auth", entries))


def test_an_item_from_another_domain_is_refused() -> None:
    state = _state()
    entries = [{"item_id": "security-posture", "status": "grounded", "grounded_by": "qa-auth"}]
    with pytest.raises(mod.TransitionError, match="security-posture"):
        mod.apply_cell_op(state, _confirm("auth", entries))


def test_an_ungrounded_block_item_cannot_pass_confirm() -> None:
    state = _state()
    entries = [{"item_id": "auth-model", "status": "ungrounded", "reason": "まだ聞けていない"}]
    with pytest.raises(mod.TransitionError, match="未接地のまま確定できない"):
        mod.apply_cell_op(state, _confirm("auth", entries))


def test_an_always_required_item_cannot_be_marked_not_applicable() -> None:
    state = _state()
    entries = list(_uiux_grounded())
    entries[0] = {"item_id": "product-goal", "status": "not_applicable", "reason": "不要と判断"}
    with pytest.raises(mod.TransitionError, match="required_when=always"):
        mod.apply_cell_op(state, _confirm("ui-ux", entries))


def test_a_conditional_item_can_be_marked_not_applicable_with_a_reason() -> None:
    """UI が無いシステムでは screen-information-priority は理由付き N/A で確定できる。"""
    state = _state()
    entries = list(_uiux_grounded())
    entries[2] = {
        "item_id": "screen-information-priority",
        "status": "not_applicable",
        "reason": "人が読む UI は無い (バッチのみ)",
    }
    mod.apply_cell_op(state, _confirm("ui-ux", entries))
    recorded = {e["item_id"]: e for e in state["matrix"]["ui-ux"]["web"]["required_info"]}
    assert recorded["screen-information-priority"]["status"] == "not_applicable"
    assert "grounded_by" not in recorded["screen-information-priority"]


def test_not_applicable_without_a_reason_is_refused() -> None:
    state = _state()
    entries = list(_uiux_grounded())
    entries[2] = {"item_id": "screen-information-priority", "status": "not_applicable"}
    with pytest.raises(mod.TransitionError, match="reason"):
        mod.apply_cell_op(state, _confirm("ui-ux", entries))


def test_a_duplicated_item_id_is_refused() -> None:
    state = _state()
    entries = _auth_grounded() + _auth_grounded()
    with pytest.raises(mod.TransitionError, match="重複"):
        mod.apply_cell_op(state, _confirm("auth", entries))


# --- ゲート以前に確定したセルへの物質化 ---------------------------------------


def _pre_gate_state() -> dict:
    """ゲートが無かった時代に確定した形の state を作る (writer を通さず確定セルを置く)。"""
    state = _state()
    state["matrix"]["auth"]["web"] = {"state": "確定", "qa_ref": "qa-auth"}
    return state


def _backfill(entries: list[dict], category: str = "auth") -> dict:
    return {
        "action": "set-required-info",
        "category": category,
        "platform": "web",
        "required_info": entries,
    }


def test_backfill_records_an_ungrounded_block_item_as_a_debt() -> None:
    state = _pre_gate_state()
    entries = [{"item_id": "auth-model", "status": "ungrounded", "reason": "確定当時に収集していない"}]
    mod.apply_cell_op(state, _backfill(entries))
    assert state["matrix"]["auth"]["web"]["required_info"] == [
        {
            "item_id": "auth-model",
            "missing_effect": "block",
            "status": "ungrounded",
            "reason": "確定当時に収集していない",
        }
    ]


def test_backfill_refuses_a_cell_that_is_not_confirmed() -> None:
    with pytest.raises(mod.TransitionError, match="確定セルのみ"):
        mod.apply_cell_op(_state(), _backfill(_auth_grounded()))


def test_backfill_refuses_overwriting_an_existing_record() -> None:
    """これを許すと、ゲートを通した記録を後から ungrounded へ書き換えられる。"""
    state = _state()
    mod.apply_cell_op(state, _confirm("auth", _auth_grounded()))
    entries = [{"item_id": "auth-model", "status": "ungrounded", "reason": "やっぱり無かったことにする"}]
    with pytest.raises(mod.TransitionError, match="上書きは拒否"):
        mod.apply_cell_op(state, _backfill(entries))


def test_backfill_replay_with_the_same_record_is_idempotent() -> None:
    state = _state()
    mod.apply_cell_op(state, _confirm("auth", _auth_grounded()))
    before = json.dumps(state, sort_keys=True, ensure_ascii=False)
    mod.apply_cell_op(state, _backfill(_auth_grounded()))
    assert json.dumps(state, sort_keys=True, ensure_ascii=False) == before


def test_backfill_refuses_a_category_with_nothing_to_record() -> None:
    state = _state()
    mod.apply_cell_op(state, _confirm("database"))
    with pytest.raises(mod.TransitionError, match="記録すべき"):
        mod.apply_cell_op(state, _backfill([], category="database"))


def test_reopen_carries_the_record_into_the_discard_log() -> None:
    """reopen で充足記録だけが黙って消えると、再確定時に元の接地を誰も引けない。"""
    state = _state()
    mod.apply_cell_op(state, _confirm("auth", _auth_grounded()))
    mod.apply_cell_op(
        state, {"action": "reopen", "category": "auth", "platform": "web", "reason": "方式変更"}
    )
    discarded = state["reopen_log"][-1]["discarded"]
    assert discarded["required_info"][0]["item_id"] == "auth-model"


# --- 掛ける場所が無い block item を数える (拒否ではなく可視化) ----------------


def test_no_blocking_domain_is_unhostable_in_the_canonical_taxonomy() -> None:
    assert req.unhostable_blocking_domains(_state()) == []


def test_a_blocking_domain_without_a_category_is_found(tmp_path: Path) -> None:
    """0 件の主張には、見つかるはずの合成例を対で置く。"""
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    for item in catalog["items"]:
        if item["item_id"] == "api-contract":
            item["missing_effect"] = "block"
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    assert req.unhostable_blocking_domains(_state(), catalog_path=path) == ["api"]


def test_an_approved_na_domain_is_not_counted_as_unhostable(tmp_path: Path) -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    for item in catalog["items"]:
        if item["item_id"] == "api-contract":
            item["missing_effect"] = "block"
    catalog["na_domains"] = [
        {"domain": "api", "reason": "単一プロセスで外部 API を持たない", "approval_state": "approved"}
    ]
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    assert req.unhostable_blocking_domains(_state(), catalog_path=path) == []


def test_a_broken_catalog_stops_the_writer(tmp_path: Path) -> None:
    """カタログ検証を実際に読んでいることの陽性対照 (読んでいなければここが緑にならない)。"""
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    catalog["items"][0].pop("missing_effect")
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(mod.TransitionError, match="カタログが不正"):
        req.blocking_items_for_category(_state(), "auth", catalog_path=path)


def test_the_blocking_ids_come_from_the_shared_certificate() -> None:
    """writer が数える block item は C14 の coverage certificate と同じ集合である。"""
    validator = _load("_vkg_check", PLUGIN_ROOT / "scripts" / "validate-knowledge-graph.py")
    findings, result = validator.validate_required_info(
        json.loads(CATALOG.read_text(encoding="utf-8"))
    )
    assert findings == []
    assert sorted(req.load_blocking_catalog()["blocking"]) == result["coverage_certificate"][
        "blocking_items"
    ]
