#!/usr/bin/env python3
"""Foundation, traceability, and decision transition acceptance tests."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest

from spec_transition_support import (
    foundation_source_turns,
    record_foundation_sources,
    valid_foundation as _valid_foundation,
)

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
TAXONOMY = (
    PLUGIN_ROOT
    / "skills"
    / "ref-system-design-knowledge"
    / "references"
    / "system-category-taxonomy.json"
)


def _load_mod():
    path = SKILL_DIR / "scripts" / "apply-spec-transition.py"
    spec = importlib.util.spec_from_file_location("apply_spec_transition", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_mod()


def _taxonomy() -> dict:
    return json.loads(TAXONOMY.read_text(encoding="utf-8"))


def _design_applications() -> list[dict]:
    return [{
        "knowledge_ref": "ddd.md#Bounded Context",
        "principle": "Bounded Context",
        "applicability": "applied",
        "rationale": "テスト対象を単一境界として扱う",
        "tradeoffs": ["境界分割時は再評価する"],
    }]


def _confirmed_state():
    state = mod.init_state(_taxonomy())
    mod.apply_turn(
        state,
        {"qa_id": "qa-001", "question": "q", "answer": "a",
         "design_applications": _design_applications(),
         "ops": [{"action": "confirm", "category": "database", "platform": "web"}]},
    )
    assert state["matrix"]["database"]["web"]["state"] == "確定"
    return state


def _set_confirmed_foundation(state, foundation: dict | None = None) -> None:
    """Record primary sources through chunk before the writer confirms U1--U9."""
    record_foundation_sources(mod, state)
    mod.set_foundation(state, foundation or _valid_foundation())


# --------------------------------------------------------------------------- #
# requirements_foundation (上位概念・要件 C9) の set-foundation op              #
# --------------------------------------------------------------------------- #
def test_init_state_has_empty_foundation():
    state = mod.init_state(_taxonomy())
    rf = state["requirements_foundation"]
    assert rf == mod.empty_foundation()
    assert rf["confirmed"] is False
    assert rf["goals"] == [] and rf["essential_purpose"] == ""
    assert rf["scope"] == {"in": [], "out": []}


def test_set_foundation_confirmed_ok():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    rf = state["requirements_foundation"]
    assert rf["confirmed"] is True
    assert [g["id"] for g in rf["goals"]] == ["G1", "G2"]


def test_written_foundation_source_indexes_are_append_only_and_preserve_matrix():
    """書面要件を1論点の qa_log 索引として残しても matrix を変更しない。"""
    state = mod.init_state(_taxonomy())
    matrix_before = copy.deepcopy(state["matrix"])
    source_indexes = foundation_source_turns(written=True)

    # chunk は上限5なので、書面索引も通常の resume 契約で 2 回に分けて記録する。
    assert mod.run_chunk(state, source_indexes, max_loops=5) == 5
    assert mod.run_chunk(state, source_indexes[5:], max_loops=5) == 4
    assert state["matrix"] == matrix_before
    assert [entry["id"] for entry in state["qa_log"]] == [
        f"qa-foundation-u{number}" for number in range(1, 10)
    ]

    # 同じ入力を再適用しても既存entryを上書き・重複しない (append-only/idempotent)。
    mod.run_chunk(state, source_indexes, max_loops=9)
    assert len(state["qa_log"]) == 9
    mod.set_foundation(state, _valid_foundation())
    assert state["requirements_foundation"]["confirmed"] is True


def test_set_foundation_confirm_rejects_missing_source_index():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError, match="source-index"):
        mod.set_foundation(state, _valid_foundation())


def test_set_foundation_confirm_rejects_written_source_hash_mismatch():
    state = mod.init_state(_taxonomy())
    written_turns = foundation_source_turns(written=True)
    written_turns[0]["source"]["sha256"] = "0" * 64
    assert mod.run_chunk(state, written_turns[:5], max_loops=5) == 5
    assert mod.run_chunk(state, written_turns[5:], max_loops=5) == 4
    with pytest.raises(mod.TransitionError, match="sha256 が answer 原文と不一致"):
        mod.set_foundation(state, _valid_foundation())


def test_set_foundation_confirm_requires_essential_purpose():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f["essential_purpose"] = "   "
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, f)


def test_set_foundation_confirm_requires_background():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f["background"] = ""
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, f)


def test_set_foundation_confirm_requires_goals():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f["goals"] = []
    f["concrete_intents"] = []  # G1 参照が dangling にならないよう除去
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, f)


@pytest.mark.parametrize(
    "field,empty",
    [
        ("objectives", []),
        ("success_criteria", []),
        ("stakeholders", []),
        ("scope", {"in": [], "out": []}),
        ("constraints", []),
        ("concrete_intents", []),
    ],
)
def test_set_foundation_confirm_requires_all_u1_u9(field, empty):
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f[field] = empty
    with pytest.raises(mod.TransitionError, match=field):
        mod.set_foundation(state, f)


def test_set_foundation_accepts_explicit_na_with_reason():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f["constraints"] = {"status": "not_applicable", "reason": "制約なしをユーザー確認済み"}
    _set_confirmed_foundation(state, f)
    assert state["requirements_foundation"]["confirmed"] is True


# F1: confirmed はユーザー合意の approval_ref (approval_log 実在) を機械証跡として要求する
def test_set_foundation_confirm_requires_approval_ref():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    del f["approval_ref"]
    del f["approval_note"]
    with pytest.raises(mod.TransitionError, match="approval_ref"):
        mod.set_foundation(state, f)


def test_set_foundation_confirm_rejects_dangling_approval_ref():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    del f["approval_note"]  # 自動登録させない → approval_log に実在しない参照
    f["approval_ref"] = "appr-nonexistent"
    with pytest.raises(mod.TransitionError, match="approval_log に不在"):
        mod.set_foundation(state, f)


def test_set_foundation_registers_approval_from_note():
    state = mod.init_state(_taxonomy())
    assert state["approval_log"] == []
    _set_confirmed_foundation(state)
    assert mod._has_entry(state["approval_log"], "appr-foundation")
    rf = state["requirements_foundation"]
    assert rf["approval_ref"] == "appr-foundation"
    assert "approval_note" not in rf  # 承認本文は approval_log が持つ (foundation へは保存しない)


# F2: U1-U3 (essential_purpose/background/goals) は N/A 不可 (値必須)。"目的が N/A" を弾く
@pytest.mark.parametrize("field", ["essential_purpose", "background", "goals"])
def test_set_foundation_confirm_rejects_na_for_u1_u3(field):
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f[field] = {"status": "not_applicable", "reason": "N/A にはできないはず"}
    if field == "goals":
        f["concrete_intents"] = []  # goals 消滅で intent.serves が dangling にならないよう除去
    with pytest.raises(mod.TransitionError, match=field):
        mod.set_foundation(state, f)


def test_bootstrap_then_foundation_then_init_preserves_foundation_and_decisions():
    state = mod.bootstrap_state()
    _set_confirmed_foundation(state)
    state["decisions"] = [{"id": "D-bootstrap"}]
    initialized = mod.init_state(_taxonomy(), state)
    assert initialized["requirements_foundation"] == state["requirements_foundation"]
    assert initialized["decisions"] == [{"id": "D-bootstrap"}]
    assert initialized["matrix"]["database"]["web"]["state"] == "未収集"


def test_set_foundation_unconfirmed_allows_empty():
    # confirmed=False なら未完成 (空) の上位概念でも保存できる (途中保存)
    state = mod.init_state(_taxonomy())
    mod.set_foundation(state, {"essential_purpose": "検討中"})
    rf = state["requirements_foundation"]
    assert rf["confirmed"] is False
    assert rf["essential_purpose"] == "検討中"


def test_set_foundation_rejects_unknown_key():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, {"nonsense": 1})


def test_set_foundation_rejects_goal_without_id_and_dupe():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, {"goals": [{"text": "id 無し"}]})
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, {"goals": [{"id": "G1", "text": "a"}, {"id": "G1", "text": "b"}]})


def test_set_foundation_rejects_dangling_intent_serves():
    state = mod.init_state(_taxonomy())
    f = _valid_foundation()
    f["concrete_intents"] = [{"id": "I1", "text": "x", "serves": ["G9"]}]  # G9 不在
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, f)


def test_set_foundation_partial_merge_preserves_prior():
    state = mod.init_state(_taxonomy())
    mod.set_foundation(state, {"essential_purpose": "目的A"})
    mod.set_foundation(state, {"background": "背景B"})
    rf = state["requirements_foundation"]
    assert rf["essential_purpose"] == "目的A"  # 先の設定が保持される
    assert rf["background"] == "背景B"


def test_set_foundation_rejects_non_object():
    state = mod.init_state(_taxonomy())
    with pytest.raises(mod.TransitionError):
        mod.set_foundation(state, [1, 2])


# --------------------------------------------------------------------------- #
# serves_goals トレース (confirm 付随 / set-serves op)                          #
# --------------------------------------------------------------------------- #
def test_confirm_with_serves_goals():
    state = mod.init_state(_taxonomy())
    mod.apply_cell_op(
        state,
        {"action": "confirm", "category": "database", "platform": "web",
         "qa_ref": "qa-001", "serves_goals": ["G1", "G1", "G2"]},
    )
    assert state["matrix"]["database"]["web"] == {
        "state": "確定", "qa_ref": "qa-001", "serves_goals": ["G1", "G2"],
    }


def test_set_serves_on_confirmed_cell():
    state = _confirmed_state()  # database.web = 確定 (serves_goals 無し)
    mod.apply_cell_op(
        state, {"action": "set-serves", "category": "database", "platform": "web", "serves_goals": ["G1"]}
    )
    cell = state["matrix"]["database"]["web"]
    assert cell["state"] == "確定"  # state は 確定 のまま (rollback でない)
    assert cell["serves_goals"] == ["G1"]


def test_set_serves_requires_confirmed_cell():
    state = mod.init_state(_taxonomy())  # 未収集
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(
            state, {"action": "set-serves", "category": "database", "platform": "web", "serves_goals": ["G1"]}
        )


def test_set_serves_requires_nonempty_and_valid():
    state = _confirmed_state()
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "set-serves", "category": "database", "platform": "web", "serves_goals": []})
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "set-serves", "category": "database", "platform": "web", "serves_goals": [""]})
    with pytest.raises(mod.TransitionError):
        mod.apply_cell_op(state, {"action": "confirm", "category": "auth", "platform": "web", "qa_ref": "q", "serves_goals": "G1"})


def test_cli_set_foundation_string_and_file(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    state = json.loads(state_path.read_text(encoding="utf-8"))
    record_foundation_sources(mod, state)
    state_path.write_text(mod.dump_state(state), encoding="utf-8")
    inline = json.dumps(_valid_foundation())
    assert mod.main(["set-foundation", "--state", str(state_path), "--foundation", inline]) == 0
    st = json.loads(state_path.read_text(encoding="utf-8"))
    assert st["requirements_foundation"]["confirmed"] is True
    # ファイル入力経路
    ffile = tmp_path / "foundation.json"
    ffile.write_text(json.dumps({"stakeholders": ["A"]}), encoding="utf-8")
    assert mod.main(["set-foundation", "--state", str(state_path), "--foundation", str(ffile)]) == 0
    st = json.loads(state_path.read_text(encoding="utf-8"))
    assert st["requirements_foundation"]["stakeholders"] == ["A"]


def _valid_decision(status="recommended_pending_confirmation") -> dict:
    options = [
        {
            "id": "free-managed", "label": "managed無料枠",
            "cost_model": {
                "category": "free", "amount": 0, "currency": "JPY",
                "billing_period": "month", "tco": "無料枠内は月額0円、超過後は従量課金",
            },
            "free_tier_limits": "1万MAU", "goal_fit": "短期導入に適合", "pros": ["運用容易"],
            "security_fit": "managed更新とMFAで要件を満たす",
            "cons": ["上限後課金"], "risks": ["価格改定"], "lock_in": "中",
            "ops_burden": "低", "evidence_refs": ["https://vendor.example/pricing"],
        },
        {
            "id": "oss", "label": "OSS",
            "cost_model": {
                "category": "low-cost", "amount": 1000, "currency": "JPY",
                "billing_period": "month", "tco": "月額基盤費に保守工数を加算",
            },
            "free_tier_limits": "制限なし", "goal_fit": "内製運用時に適合", "pros": ["自由度"],
            "security_fit": "内製で脆弱性更新を期限内に適用する場合に適合",
            "cons": ["保守必要"], "risks": ["更新遅延"], "lock_in": "低",
            "ops_burden": "高", "evidence_refs": ["https://project.example/docs"],
        },
    ]
    return {
        "id": "D1", "question": "認証基盤をどれにするか", "status": status,
        "options": options,
        "recommendation": {
            "option_id": "free-managed", "rationale": "無料枠内で運用負荷が低い",
            "caveats": ["上限監視"], "confidence": "medium",
            "latest_checked_at": "2026-07-11T00:00:00Z",
            "comparison_basis": {
                "goal_fit": "短期導入目標に最も適合", "tco": "無料枠内の総費用が最小",
                "security": "managed更新とMFAを利用可能", "operations": "保守負荷が低い",
                "lock_in": "中程度の移行費を許容できる",
            },
        },
        "serves_goals": ["G1"], "user_decision": None,
    }


def test_set_decision_recommendation_stays_pending_until_user_confirmation():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision()
    mod.set_decision(state, decision)
    assert state["decisions"][0]["status"] == "recommended_pending_confirmation"
    assert state["decisions"][0]["user_decision"] is None


def test_set_decision_confirmed_requires_user_decision():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision("confirmed")
    with pytest.raises(mod.TransitionError, match="user_decision"):
        mod.set_decision(state, decision)
    decision["user_decision"] = {
        "option_id": "free-managed", "confirmed_at": "2026-07-11T01:00:00Z"
    }
    mod.set_decision(state, decision)
    assert state["decisions"][0]["status"] == "confirmed"


def test_set_decision_rejects_too_few_options_and_dangling_goal():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision()
    decision["options"] = decision["options"][:1]
    with pytest.raises(mod.TransitionError, match="2-3"):
        mod.set_decision(state, decision)
    decision = _valid_decision()
    decision["serves_goals"] = ["G9"]
    with pytest.raises(mod.TransitionError, match="実在 goal"):
        mod.set_decision(state, decision)


def test_set_decision_rejects_all_paid_options():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision()
    for option in decision["options"]:
        option["cost_model"]["category"] = "paid"
        option["cost_model"]["amount"] = 5000
    with pytest.raises(mod.TransitionError, match="free または low-cost"):
        mod.set_decision(state, decision)


@pytest.mark.parametrize(
    "mutate,match",
    [
        (lambda d: d["options"][0].update(evidence_refs=["http://vendor.example/pricing"]), "https URL"),
        (lambda d: d["recommendation"].update(latest_checked_at="not-a-date"), "RFC3339"),
        (lambda d: d["recommendation"]["comparison_basis"].pop("security"), "comparison_basis.security"),
    ],
)
def test_set_decision_rejects_invalid_evidence_date_and_comparison_axis(mutate, match):
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision()
    mutate(decision)
    with pytest.raises(mod.TransitionError, match=match):
        mod.set_decision(state, decision)


def test_set_decision_confirmed_rejects_non_rfc3339_confirmation_time():
    state = mod.init_state(_taxonomy())
    _set_confirmed_foundation(state)
    decision = _valid_decision("confirmed")
    decision["user_decision"] = {"option_id": "free-managed", "confirmed_at": "2026-07-11"}
    with pytest.raises(mod.TransitionError, match="confirmed_at は RFC3339"):
        mod.set_decision(state, decision)


def test_cli_bootstrap_init_preserves_foundation(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["bootstrap", "--out", str(state_path)]) == 0
    state = json.loads(state_path.read_text(encoding="utf-8"))
    record_foundation_sources(mod, state)
    state_path.write_text(mod.dump_state(state), encoding="utf-8")
    assert mod.main([
        "set-foundation", "--state", str(state_path),
        "--foundation", json.dumps(_valid_foundation()),
    ]) == 0
    assert mod.main([
        "init", "--taxonomy", str(TAXONOMY), "--state", str(state_path), "--out", str(state_path)
    ]) == 0
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert state["requirements_foundation"]["confirmed"] is True


def test_cli_set_foundation_confirm_gate_returns_1(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    bad = json.dumps({"confirmed": True})  # essential_purpose 等が空
    assert mod.main(["set-foundation", "--state", str(state_path), "--foundation", bad]) == 1


def test_cli_apply_set_serves(tmp_path):
    state_path = tmp_path / "spec-state.json"
    assert mod.main(["init", "--taxonomy", str(TAXONOMY), "--out", str(state_path)]) == 0
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["qa_log"].append({
        "id": "qa-001",
        "question": "q",
        "answer": "a",
        "design_applications": _design_applications(),
    })
    state_path.write_text(mod.dump_state(state), encoding="utf-8")
    confirm = json.dumps({"action": "confirm", "category": "database", "platform": "web", "qa_ref": "qa-001"})
    assert mod.main(["apply", "--state", str(state_path), "--op", confirm]) == 0
    serves = json.dumps({"action": "set-serves", "category": "database", "platform": "web", "serves_goals": ["G1"]})
    assert mod.main(["apply", "--state", str(state_path), "--op", serves]) == 0
    st = json.loads(state_path.read_text(encoding="utf-8"))
    assert st["matrix"]["database"]["web"]["serves_goals"] == ["G1"]
