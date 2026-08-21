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
    # receipt が FAIL で観点が PASS = **緩める向き**。ここは完全一致を撤回した後も塞がっている。
    assert any("緩い" in item for item in MOD.validate_attribution(report, golden_ledger()))


SUB_INPUT_AUDITOR = "system-spec-hearing-auditor"

# **下限。**語彙 (MOD.DOWNGRADE_REASONS) のうち「根拠があれば受理され、根拠が無ければ
# 弾かれる」ことを実際に走らせて確かめられたコードの数の床。
# 上限 MOD.MAX_DOWNGRADE_REASONS と噛み合っており、**上限を満たすために語彙を消すと
# ここが割れる。**片方だけを都合で動かせないようにするための対である。
MIN_GROUNDED_DOWNGRADE_REASONS = 2


def _downgraded(aspect="matrix_coverage", verdict="FAIL", **downgrade):
    """primary receipt は PASS のまま、観点だけを厳しくした report を作る。"""
    report = golden_report()
    report["aspects"][aspect]["verdict"] = verdict
    if downgrade:
        report["aspects"][aspect]["verdict_downgrade"] = downgrade
    return report


def _with_failing_sub_input(report):
    """matrix_coverage の sub_input receipt だけを FAIL にし、台帳もそこへ合わせる。

    `sub_input_fail` の根拠は**実在する sub_input receipt の verdict** なので、
    宣言だけでなく台帳側も FAIL でなければ receipt 照合で落ちる。
    """
    for delegation in report["audit_delegations"]:
        if delegation["role"] == "sub_input":
            delegation["verdict"] = "FAIL"
            delegation["dispatch"]["response_sha256"] = response_digest(SUB_INPUT_AUDITOR, "FAIL")
    ledger = golden_ledger()
    ledger["receipts"][SUB_INPUT_AUDITOR]["sess-1"] = {
        response_digest(SUB_INPUT_AUDITOR, "FAIL"): {"tool_name": "Task", "verdict": "FAIL"},
    }
    return report, ledger


def _grounded_case(reason):
    """`reason` の根拠が**実在する** (report, ledger) を返す。"""
    declaration = {"from": "PASS", "reason": reason, "detail": f"{reason} の実況"}
    if reason == "sub_input_fail":
        return _with_failing_sub_input(_downgraded(**declaration))
    if reason == "provenance_contamination":
        ledger = golden_ledger()
        ledger["malformed"] = 3
        return _downgraded(**declaration), ledger
    raise AssertionError(f"語彙 {reason!r} に根拠ありの事例が用意されていない")


def _ungrounded_case(reason):
    """`reason` の根拠が**存在しない** (report, ledger) を返す。

    golden は sub_input=PASS / 台帳の破損行 0 なので、どちらのコードも裏が取れない。
    """
    declaration = {"from": "PASS", "reason": reason, "detail": f"{reason} と名乗るだけ"}
    return _downgraded(**declaration), golden_ledger()


def test_aspect_may_be_stricter_than_its_primary_receipt_when_declared():
    """**完全一致の撤回で開いた向き。**sub_input FAIL を根拠に、観点だけを厳しく
    見たことを機械層が表現できる。以前はこれが表現できず、C05 は緩い側へ寄せるか
    receipt を書き換える (緑化と同じ操作) しかなかった。"""
    report, ledger = _grounded_case("sub_input_fail")
    assert MOD.validate_attribution(report, ledger) == []


def test_aspect_stricter_without_a_declaration_is_rejected():
    """厳しくする向きも**無条件では通さない**。理由が残らないと、後から
    「なぜ FAIL なのか」が名乗りの外に出ない。"""
    violations = MOD.validate_attribution(_downgraded(), golden_ledger())
    assert any("verdict_downgrade の宣言が無い" in item for item in violations)


def test_downgrade_declaration_must_name_the_receipt_it_came_from():
    """`from` を要るのは取り違え防止。別のずれ向けの宣言を流用させない。"""
    report, ledger = _grounded_case("sub_input_fail")
    report["aspects"]["matrix_coverage"]["verdict_downgrade"]["from"] = "INDETERMINATE"
    assert any("一致しない" in item for item in MOD.validate_attribution(report, ledger))


def test_free_text_reason_can_no_longer_buy_a_downgrade():
    """**自由文の理由は受けない。**「理由さえ書けば通る」形だと、この門は消えたのと
    同じになる。語彙の外の文字列はコードとして解釈されず弾かれる。"""
    report = _downgraded(**{"from": "PASS", "reason": "今日は雨だから", "detail": "本文はある"})
    violations = MOD.validate_attribution(report, golden_ledger())
    assert any("降格事由は列挙された語彙のみ" in item for item in violations)


def test_downgrade_needs_a_detail_body_alongside_the_code():
    """コードだけでは、その観点で何が起きたかが後から読めない。"""
    report, ledger = _grounded_case("sub_input_fail")
    report["aspects"]["matrix_coverage"]["verdict_downgrade"]["detail"] = "   "
    assert any("detail が非空文字列でない" in item for item in MOD.validate_attribution(report, ledger))


def test_every_downgrade_reason_must_be_grounded_in_an_observable_fact():
    """**語彙コードを名乗るだけでは通らない。**各コードには機械で引ける裏が要る。

    `sub_input_fail` は当該観点の sub_input receipt が PASS でないこと、
    `provenance_contamination` は台帳に破損行があること。裏が無いまま名乗った場合、
    どちらも fail-closed で弾かれる。
    """
    for reason in sorted(MOD.DOWNGRADE_REASONS):
        report, ledger = _ungrounded_case(reason)
        violations = MOD.validate_attribution(report, ledger)
        assert any(reason in item for item in violations), reason


def test_downgrade_vocabulary_is_pinned_between_a_cap_and_a_floor():
    """**逆向きの対。**上限だけ置くと、数えている対象を消して満たせてしまう。

    - **上限** `MOD.MAX_DOWNGRADE_REASONS`: 語彙の件数。事由を足して「何でも通る」
      形へ戻す道を塞ぐ。
    - **下限** `MIN_GROUNDED_DOWNGRADE_REASONS`: 語彙のうち、根拠ありで受理され・
      根拠なしで弾かれることを**実際に走らせて**確かめられた件数。語彙を消して
      上限を満たす道を塞ぐ。

    語彙を足すと上限が割れ、語彙を消すと下限が割れる。上下が噛み合っているので、
    語彙を動かすときは両方を同時に、意図をもって動かすしかない。
    """
    assert len(MOD.DOWNGRADE_REASONS) <= MOD.MAX_DOWNGRADE_REASONS

    grounded = set()
    for reason in MOD.DOWNGRADE_REASONS:
        accept_report, accept_ledger = _grounded_case(reason)
        reject_report, reject_ledger = _ungrounded_case(reason)
        accepted = MOD.validate_attribution(accept_report, accept_ledger) == []
        rejected = any(
            reason in item for item in MOD.validate_attribution(reject_report, reject_ledger)
        )
        if accepted and rejected:
            grounded.add(reason)

    assert len(grounded) >= MIN_GROUNDED_DOWNGRADE_REASONS
    # 語彙に「根拠の引き方はあるが実際には効いていない」コードを残させない。
    assert grounded == set(MOD.DOWNGRADE_REASONS)


def test_the_vocabulary_is_exactly_the_grounding_table():
    """**根拠の引き方を持たないコードは存在できない。**語彙は対応表の鍵そのもの。
    ここが割れると、コードを足すだけで素通りする欄が作れる。"""
    assert MOD.DOWNGRADE_REASONS == frozenset(MOD.DOWNGRADE_REASON_GROUNDS)


def test_promotion_is_never_allowed_even_with_a_declaration():
    """**昇格方向は理由があっても通さない。**理由つきで緩める道を開くと、
    理由欄そのものが緑化の通り道になる。receipt=FAIL / 観点=PASS で確かめる。"""
    report = golden_report()
    report["audit_delegations"][0]["verdict"] = "FAIL"
    report["aspects"]["matrix_coverage"]["verdict_downgrade"] = {
        "from": "FAIL", "reason": "sub_input_fail", "detail": "統括の判断で問題なしとした",
    }
    violations = MOD.validate_attribution(report, golden_ledger())
    assert any("緩い" in item for item in violations)
    assert not any("verdict_downgrade の宣言が無い" in item for item in violations)


def test_promotion_stays_blocked_even_when_the_reason_is_fully_grounded():
    """**根拠を本物にしても昇格は開かない。**語彙化で「根拠さえ揃えば通る」形に
    なっていないことを確かめる。sub_input を実際に FAIL にし、台帳も破損行つきにして、
    それでも receipt=FAIL / 観点=PASS が弾かれ続けることを固定する。

    向きの判定は宣言を読む**前**に返しているので、根拠の充実は昇格側へ効かない。
    """
    report, ledger = _with_failing_sub_input(golden_report())
    ledger["malformed"] = 5
    report["audit_delegations"][0]["verdict"] = "FAIL"
    report["audit_delegations"][0]["dispatch"]["response_sha256"] = response_digest(
        "system-spec-matrix-auditor", "FAIL"
    )
    ledger["receipts"]["system-spec-matrix-auditor"]["sess-1"] = {
        response_digest("system-spec-matrix-auditor", "FAIL"): {"tool_name": "Task", "verdict": "FAIL"},
    }
    report["aspects"]["matrix_coverage"]["verdict"] = "PASS"
    report["aspects"]["matrix_coverage"]["verdict_downgrade"] = {
        "from": "FAIL", "reason": "sub_input_fail", "detail": "根拠は本物だが向きが逆",
    }
    violations = MOD.validate_attribution(report, ledger)
    assert any("緩い" in item for item in violations)


def test_known_hole_the_downgrade_detail_body_is_not_verifiable():
    """**塞げていない穴を種類として書く。**

    種類:「宣言の `detail` **本文**が本当かどうかは機械層で判定できない」。下では
    根拠 (sub_input=FAIL) は本物だが、本文は事実と無関係でも通る。

    **以前との違い**: 穴は `reason` から `detail` へ縮んだ。受理を決める 3 つ
    (向き・`from`・語彙コードに対応する根拠) はいずれも機械で引ける。本文は
    受理の条件ではなく、人が後から読むための記録である。

    **塞がない理由**: 本文と根拠の対応を機械で確かめるには自然文の含意判定が要る。
    **受け止めているもの**: 本文が嘘でも、向きが縛ってあるので作れるのは自分の観点を
    より厳しくすることだけで、緑化には使えない。

    反転先: `detail` から sub_input receipt や台帳の破損行へ**構造化された参照**
    (行 id 等) を要求できるようになった日。本文の自然文検査では反転させない。
    """
    report, ledger = _grounded_case("sub_input_fail")
    report["aspects"]["matrix_coverage"]["verdict_downgrade"]["detail"] = "今日は雨だから"
    assert MOD.validate_attribution(report, ledger) == []


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


# --------------------------------------------------------------------------- #
# schema 1.3: 非同期完了の畳み込み                                                #
# --------------------------------------------------------------------------- #
def _async_pair(index: int = 0):
    """pending の起動行と、それに対応する解決行を返す。"""
    report, records = _schema12_fixture()
    launch = records[index]
    final_digest = launch["response_sha256"]
    launch = {
        **launch,
        "record_kind": "launch",
        "agent_id": "agent-abc123",
        "response_sha256": "a" * 64,  # 起動受理の digest (最終応答ではない)
        "audit_verdict": None,
        "verdict_state": "pending",
    }
    resolution = {
        "schema_version": "1.3",
        "record_kind": "resolution",
        "ts": "2026-08-20T00:00:00Z",
        "session_id": launch["session_id"],
        "tool_use_id": launch["tool_use_id"],
        "subagent_type": launch["subagent_type"],
        "tool_name": launch["tool_name"],
        "agent_id": launch["agent_id"],
        "prompt_sha256": launch["prompt_sha256"],
        "response_sha256": final_digest,
        "audit_verdict": records[index]["audit_verdict"],
        "verdict_state": "resolved",
        "cwd": "/tmp/project",
    }
    return report, records, launch, resolution


def test_launch_and_resolution_rows_fold_into_one_receipt(tmp_path):
    """起動行 (pending) + 解決行 = 1 件の resolved receipt。**上書きではなく畳み込み。**"""
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records, launch, resolution = _async_pair()
    rows = [launch] + records[1:] + [resolution]
    ledger = _load_schema12_ledger(path, rows)
    folded = ledger["receipts_v12"]["sess-1"][launch["tool_use_id"]]
    assert len(folded) == 1
    assert folded[0]["verdict_state"] == "resolved"
    assert folded[0]["verdict"] == resolution["audit_verdict"]
    # verdict を載せているのは最終応答のほう。起動時の digest は捨てずに残す。
    assert folded[0]["response_sha256"] == resolution["response_sha256"]
    assert folded[0]["launch_response_sha256"] == "a" * 64
    # 畳み込めた pending 行に付けた malformed は取り消す (本物の破損と混ぜない)。
    assert ledger["malformed"] == 0
    assert MOD.validate_attribution(report, ledger) == []


def test_pending_launch_without_resolution_stays_unusable(tmp_path):
    """対になる赤。解決行が来なければ receipt には使えない。"""
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records, launch, _ = _async_pair()
    ledger = _load_schema12_ledger(path, [launch] + records[1:])
    assert ledger["malformed"] == 1
    assert MOD.validate_attribution(report, ledger)


def test_two_resolutions_for_one_launch_are_refused(tmp_path):
    """**先に書かれた解決行を後から来た行で上書きしない。**

    上書きを許すと、後から任意の verdict を差し込める。決められないものは使わない。
    """
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records, launch, resolution = _async_pair()
    second = {**resolution, "audit_verdict": "FAIL", "ts": "2026-08-20T01:00:00Z"}
    ledger = _load_schema12_ledger(path, [launch] + records[1:] + [resolution, second])
    folded = ledger["receipts_v12"]["sess-1"][launch["tool_use_id"]]
    assert folded[0]["verdict_state"] == "pending", "2 通目が来たのに畳み込んだ"
    assert MOD.validate_attribution(report, ledger)


def test_resolution_with_mismatched_agent_id_is_refused(tmp_path):
    """ID の一致だけが唯一の帰属根拠。順序という第二の手がかりは非同期化で失われた。"""
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records, launch, resolution = _async_pair()
    for broken in ({**resolution, "agent_id": "別のID"}, {**resolution, "agent_id": None}):
        ledger = _load_schema12_ledger(path, [launch] + records[1:] + [broken])
        folded = ledger["receipts_v12"]["sess-1"][launch["tool_use_id"]]
        assert folded[0]["verdict_state"] == "pending"
        assert MOD.validate_attribution(report, ledger)


def test_resolution_without_a_launch_row_promotes_nothing(tmp_path):
    """解決行だけが台帳にあっても、起動していない fork へ帰属させない。"""
    path = tmp_path / "audit-fork-ledger.jsonl"
    report, records, _, resolution = _async_pair()
    ledger = _load_schema12_ledger(path, records[1:] + [resolution])
    assert resolution["tool_use_id"] not in ledger["receipts_v12"].get("sess-1", {})
    assert MOD.validate_attribution(report, ledger)


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
