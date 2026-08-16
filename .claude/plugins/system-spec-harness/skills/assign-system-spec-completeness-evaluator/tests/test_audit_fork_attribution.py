# /// script
# name: test-audit-fork-attribution
# purpose: 独立監査 receipt と PostToolUse fork 台帳の fail-closed 照合を検証する
# inputs:
#   - pytest 実行 (argv なし)
# outputs:
#   - pytest 結果
# contexts: [C]
# network: false
# write-scope: none
# dependencies: []
# ///
"""`audit_fork_attribution.py` の receipt・台帳・session 束縛回帰テスト。"""
from __future__ import annotations

import importlib.util
import json

from completeness_test_support import AGGREGATE, AUDIT as MOD
from completeness_test_support import (
    PLUGIN_ROOT, golden_delegations, golden_ledger, golden_report, response_digest, write_ledger,
)


def _schema12_fixture():
    report = golden_report()
    records = []
    for index, delegation in enumerate(report["audit_delegations"], start=1):
        tool_use_id = f"toolu_schema12_{index}"
        delegation["dispatch"]["tool_use_id"] = tool_use_id
        records.append({
            "schema_version": "1.2",
            "ts": "2026-08-11T00:00:00Z",
            "session_id": delegation["dispatch"]["session_id"],
            "tool_name": delegation["dispatch"]["tool"],
            "tool_use_id": tool_use_id,
            "subagent_type": delegation["dispatch"]["subagent_type"],
            "prompt_sha256": "3" * 64,
            "response_sha256": delegation["dispatch"]["response_sha256"],
            "audit_verdict": delegation["verdict"],
            "verdict_state": "resolved",
            "cwd": "/tmp/project",
        })
    return report, records


def _load_schema12_ledger(path, records):
    write_ledger(path, auditors=[], extra_lines=[json.dumps(record) for record in records])
    return MOD.load_fork_ledger(path)


def test_aggregate_cli_reexports_the_attribution_contract():
    assert AGGREGATE.validate_attribution is MOD.validate_attribution
    assert AGGREGATE.load_fork_ledger is MOD.load_fork_ledger


def test_required_delegations_cover_only_independent_auditors():
    required = {(item["aspect"], item["role"]): item for item in MOD.required_delegations()}
    assert set(required) == {("matrix_coverage", "primary"), ("matrix_coverage", "sub_input"), ("doc_freshness", "primary")}
    assert {item["auditor"] for item in required.values()} == {
        "system-spec-matrix-auditor", "system-spec-hearing-auditor", "system-spec-doc-freshness-auditor",
    }


def test_missing_or_malformed_receipts_are_fail_closed():
    report = golden_report(delegations=[])
    assert any("fork receipt が無い" in item for item in MOD.validate_attribution(report, golden_ledger()))
    report = golden_report()
    del report["audit_delegations"]
    assert any("audit_delegations" in item for item in MOD.validate_attribution(report, golden_ledger()))
    assert MOD.validate_attribution(golden_report(), MOD.empty_ledger())


def test_receipt_must_be_corroborated_by_its_auditor_and_evidence():
    ledger = golden_ledger(auditors=["system-spec-matrix-auditor", "system-spec-hearing-auditor"])
    assert any("doc_freshness" in item for item in MOD.validate_attribution(golden_report(), ledger))
    report = golden_report()
    report["audit_delegations"][0]["evidence"] = []
    assert any("evidence" in item for item in MOD.validate_attribution(report, golden_ledger()))
    report = golden_report()
    report["audit_delegations"][0]["dispatch"]["tool"] = "Bash"
    assert any("dispatch.tool" in item for item in MOD.validate_attribution(report, golden_ledger()))


def test_false_independence_unknown_agent_duplicate_and_verdict_mismatch_are_rejected():
    delegations = golden_delegations() + [{
        "aspect": "design_knowledge_reflection", "role": "primary", "auditor": "system-spec-hearing-auditor",
        "component": "C06", "dispatch": {"tool": "Task", "subagent_type": "system-spec-hearing-auditor", "session_id": "sess-1"},
        "verdict": "PASS", "evidence": ["fabricated"],
    }]
    assert any("虚偽の独立性主張" in item for item in MOD.validate_attribution(golden_report(delegations=delegations), golden_ledger()))
    delegations = golden_delegations()
    delegations[0]["auditor"] = "system-spec-imaginary-auditor"
    delegations[0]["dispatch"]["subagent_type"] = "system-spec-imaginary-auditor"
    ledger = golden_ledger(auditors=["system-spec-imaginary-auditor", "system-spec-hearing-auditor", "system-spec-doc-freshness-auditor"])
    assert any("agent 定義" in item for item in MOD.validate_attribution(golden_report(delegations=delegations), ledger))
    delegations = golden_delegations()
    assert any("重複" in item for item in MOD.validate_attribution(golden_report(delegations=delegations + [delegations[0]]), golden_ledger()))
    report = golden_report()
    report["audit_delegations"][0]["verdict"] = "FAIL"
    assert any("忠実に転記" in item for item in MOD.validate_attribution(report, golden_ledger()))


def test_agent_tool_rows_and_reforks_are_accepted():
    report = golden_report()
    for delegation in report["audit_delegations"]:
        delegation["dispatch"]["tool"] = "Agent"
    ledger = golden_ledger()
    for by_session in ledger["receipts"].values():
        for by_digest in by_session.values():
            for receipt in by_digest.values():
                receipt["tool_name"] = "Agent"
    assert AGGREGATE.validate_report(report, ledger) == []
    delegation = golden_delegations()[0]
    ledger = golden_ledger()
    ledger["dispatched"][delegation["auditor"]] = 3
    ledger["sessions"][delegation["auditor"]] = {"sess-1": 3}
    assert MOD.ledger_corroborates(delegation, ledger)[0]


def test_receipt_must_match_hook_observed_response_verdict_and_tool():
    delegation = golden_delegations()[0]
    ledger = golden_ledger()
    delegation["verdict"] = "FAIL"
    assert any("hook 観測の auditor verdict" in item for item in MOD.validate_attribution(
        golden_report(delegations=[delegation] + golden_delegations()[1:]), ledger
    ))
    delegation = golden_delegations()[0]
    delegation["dispatch"]["response_sha256"] = "f" * 64
    assert not MOD.ledger_corroborates(delegation, ledger)[0]
    delegation = golden_delegations()[0]
    delegation["dispatch"]["tool"] = "Agent"
    assert not MOD.ledger_corroborates(delegation, ledger)[0]


def test_session_binding_rejects_missing_unknown_unrecorded_mixed_and_stale_sessions():
    delegation = golden_delegations()[0]
    del delegation["dispatch"]["session_id"]
    assert not MOD.ledger_corroborates(delegation, golden_ledger())[0]
    delegation = golden_delegations()[0]
    delegation["dispatch"]["session_id"] = "unknown"
    assert not MOD.ledger_corroborates(delegation, golden_ledger())[0]
    delegation = golden_delegations()[0]
    delegation["dispatch"]["session_id"] = "sess-fabricated"
    assert not MOD.ledger_corroborates(delegation, golden_ledger())[0]
    delegations = golden_delegations()
    delegations[0]["dispatch"]["session_id"] = "sess-other"
    ledger = golden_ledger()
    ledger["sessions"][delegations[0]["auditor"]] = {"sess-other": 1}
    assert any("収束していない" in item for item in MOD.validate_attribution(golden_report(delegations=delegations), ledger))
    assert any("一致しない" in item for item in MOD.validate_attribution(golden_report(), golden_ledger(), expected_session="sess-current"))
    assert MOD.validate_attribution(golden_report(), golden_ledger(), expected_session="sess-1") == []


def test_ledger_loader_handles_missing_broken_session_and_agent_rows(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    write_ledger(path, extra_lines=["{broken", json.dumps({"tool_name": "Bash"})])
    ledger = MOD.load_fork_ledger(path)
    assert ledger["malformed"] == 2 and len(ledger["dispatched"]) == 3
    assert MOD.load_fork_ledger(tmp_path / "missing.jsonl")["exists"] is False
    assert MOD.load_fork_ledger(None) == MOD.empty_ledger()
    write_ledger(path, auditors=[], extra_lines=[json.dumps({
        "schema_version": "1.1", "tool_name": "Agent", "session_id": "sess-1",
        "subagent_type": "system-spec-hearing-auditor",
        "prompt_sha256": "1" * 64, "response_sha256": response_digest("system-spec-hearing-auditor"),
        "audit_verdict": "PASS",
    })])
    assert MOD.load_fork_ledger(path)["dispatched"]["system-spec-hearing-auditor"] == 1


def test_ledger_rejects_handwritten_or_invalid_prompt_digest(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    write_ledger(
        path,
        auditors=[],
        extra_lines=[json.dumps({
            "schema_version": "1.0", "ts": "2026-08-03T00:00:00Z", "session_id": "sess-1",
            "tool_name": "Task", "subagent_type": "system-spec-matrix-auditor",
            "prompt_sha256": "manual", "cwd": "/tmp/project",
        })],
    )
    ledger = MOD.load_fork_ledger(path)
    assert ledger["malformed"] == 1
    assert ledger["dispatched"] == {}
    assert not MOD.ledger_corroborates(golden_delegations()[0], ledger)[0]


def test_ledger_loader_keeps_session_counts_and_agent_names_safe(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    write_ledger(path, extra_lines=[json.dumps({
        "schema_version": "1.1", "tool_name": "Task", "session_id": "sess-2",
        "subagent_type": "system-spec-matrix-auditor",
        "prompt_sha256": "2" * 64, "response_sha256": response_digest("system-spec-matrix-auditor"),
        "audit_verdict": "PASS",
    })])
    ledger = MOD.load_fork_ledger(path)
    assert ledger["sessions"]["system-spec-matrix-auditor"] == {"sess-1": 1, "sess-2": 1}
    assert MOD.agent_definition_exists("system-spec-matrix-auditor") is True
    assert MOD.agent_definition_exists("../agents/system-spec-matrix-auditor") is False


def test_schema12_receipts_match_the_same_tool_use_dispatch(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records = _schema12_fixture()
    ledger = _load_schema12_ledger(path, records)
    assert ledger["malformed"] == 0
    assert MOD.validate_attribution(report, ledger) == []


def test_schema12_swapped_tool_use_ids_are_rejected(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records = _schema12_fixture()
    first = report["audit_delegations"][0]["dispatch"]
    second = report["audit_delegations"][1]["dispatch"]
    first["tool_use_id"], second["tool_use_id"] = second["tool_use_id"], first["tool_use_id"]
    violations = MOD.validate_attribution(report, _load_schema12_ledger(path, records))
    assert any("schema 1.2 receipt" in item and "一致しない" in item for item in violations)


def test_schema12_receipt_missing_tool_use_id_is_fail_closed(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records = _schema12_fixture()
    del report["audit_delegations"][0]["dispatch"]["tool_use_id"]
    violations = MOD.validate_attribution(report, _load_schema12_ledger(path, records))
    assert any("tool_use_id が無く schema 1.2" in item for item in violations)


def test_schema12_ambiguous_row_cannot_corroborate_pass(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records = _schema12_fixture()
    records[0]["verdict_state"] = "ambiguous"
    ledger = _load_schema12_ledger(path, records)
    assert ledger["malformed"] == 1
    assert MOD.validate_attribution(report, ledger)


def test_schema12_duplicate_and_conflicting_tool_use_ids_never_last_write_win(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records = _schema12_fixture()
    duplicate = dict(records[0])
    ledger = _load_schema12_ledger(path, records + [duplicate])
    violations = MOD.validate_attribution(report, ledger)
    assert len(ledger["receipts_v12"]["sess-1"][duplicate["tool_use_id"]]) == 2
    assert any("が重複している" in item for item in violations)

    conflict = dict(records[0])
    conflict["response_sha256"] = "f" * 64
    ledger = _load_schema12_ledger(path, records + [conflict])
    violations = MOD.validate_attribution(report, ledger)
    assert any("が競合している" in item for item in violations)


def test_unknown_or_missing_ledger_schema_is_malformed(tmp_path):
    path = tmp_path / "audit-fork-ledger.jsonl"
    base = {
        "tool_name": "Task", "session_id": "sess-1", "subagent_type": "system-spec-matrix-auditor",
        "prompt_sha256": "2" * 64, "response_sha256": response_digest("system-spec-matrix-auditor"),
        "audit_verdict": "PASS",
    }
    write_ledger(path, auditors=[], extra_lines=[
        json.dumps(base), json.dumps({**base, "schema_version": "9.9"}),
    ])
    assert MOD.load_fork_ledger(path)["malformed"] == 2


def _load_hook():
    path = PLUGIN_ROOT / "hooks" / "record-audit-fork.py"
    spec = importlib.util.spec_from_file_location("record_audit_fork", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_hook_writer_and_reader_contracts_match():
    hook = _load_hook()
    assert (hook.LEDGER_RELPATH, hook.LEDGER_ENV, tuple(hook.AUDIT_FORK_TOOL_NAMES)) == (
        MOD.LEDGER_RELPATH, MOD.LEDGER_ENV, tuple(MOD.LEDGER_TOOL_NAMES),
    )
    recorded = hook.audit_agents(PLUGIN_ROOT)
    for requirement in MOD.required_delegations():
        assert requirement["auditor"] in recorded
