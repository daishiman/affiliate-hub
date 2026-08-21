# /// script
# name: test-aggregate-completeness
# purpose: 完成度レポートの集約・CLI・決定論ゲートを検証する
# inputs:
#   - pytest 実行 (argv なし)
# outputs:
#   - pytest 結果
# contexts: [C]
# network: false
# write-scope: none
# dependencies: []
# ///
"""`aggregate-completeness.py` の集約・CLI 回帰テスト。"""
from __future__ import annotations

import json

import pytest

from completeness_test_support import AGGREGATE as MOD
from completeness_test_support import (
    SKILL_DIR, golden_ledger, golden_report, response_digest, write_ledger, write_matrix,
)


def test_all_pass_no_high_is_pass():
    assert MOD.aggregate_verdict({aspect: "PASS" for aspect in MOD.ASPECTS}, 0) == "PASS"


def test_single_fail_is_fail():
    verdicts = {aspect: "PASS" for aspect in MOD.ASPECTS}
    verdicts["doc_freshness"] = "FAIL"
    assert MOD.aggregate_verdict(verdicts, 0) == "FAIL"


def test_indeterminate_is_fail_closed():
    verdicts = {aspect: "PASS" for aspect in MOD.ASPECTS}
    verdicts["matrix_coverage"] = "INDETERMINATE"
    assert MOD.aggregate_verdict(verdicts, 0) == "FAIL"


def test_missing_or_extra_aspect_is_fail():
    assert MOD.aggregate_verdict({"matrix_coverage": "PASS"}, 0) == "FAIL"
    verdicts = {aspect: "PASS" for aspect in MOD.ASPECTS}
    verdicts["bogus"] = "PASS"
    assert MOD.aggregate_verdict(verdicts, 0) == "FAIL"


def test_high_or_unknown_verdict_is_fail():
    assert MOD.aggregate_verdict({aspect: "PASS" for aspect in MOD.ASPECTS}, 1) == "FAIL"
    verdicts = {aspect: "PASS" for aspect in MOD.ASPECTS}
    verdicts["doc_freshness"] = "MAYBE"
    assert MOD.aggregate_verdict(verdicts, 0) == "FAIL"


def test_golden_pass_and_fail_report_validation():
    assert MOD.validate_report(golden_report(), golden_ledger()) == []
    assert MOD.validate_report(
        golden_report(verdict="FAIL", verdicts={"doc_freshness": "FAIL"}, gaps=["rerun C08"]),
        golden_ledger(verdicts={"doc_freshness": "FAIL"}),
    ) == []


def test_inconsistent_verdict_and_empty_fail_gaps_are_detected():
    report = golden_report(verdict="PASS", verdicts={"doc_freshness": "FAIL"})
    assert any("不一致" in item for item in MOD.validate_report(report, golden_ledger()))
    assert any("gaps" in item for item in MOD.validate_report(golden_report(verdict="FAIL"), golden_ledger()))


def test_report_shape_and_mapping_violations_are_detected():
    report = golden_report()
    del report["aspects"]["prompt_quality"]
    assert any("観点欠落" in item for item in MOD.validate_report(report, golden_ledger()))
    report = golden_report()
    report["aspects"]["doc_freshness"]["auditor"] = "wrong"
    assert any("auditor" in item for item in MOD.validate_report(report, golden_ledger()))
    report = golden_report(findings=[])
    assert any("findings" in item for item in MOD.validate_report(report, golden_ledger()))
    report = golden_report()
    report["evaluator"]["context"] = "same"
    assert any("context" in item for item in MOD.validate_report(report, golden_ledger()))
    assert MOD.validate_report(["not", "a", "dict"]) == ["report: オブジェクトでない"]


def test_coverage_gate_passes_and_fails_on_fixture_matrix(tmp_path):
    matrix = tmp_path / "spec-state.json"
    write_matrix(matrix, complete=True)
    assert MOD.run_coverage_gate(matrix, require_complete=True)["exit_code"] == 0
    write_matrix(matrix, complete=False)
    assert MOD.run_coverage_gate(matrix, require_complete=True)["exit_code"] == 1


def test_knowledge_graph_gate_passes_on_shipped_assets_and_cli_outputs_json(capsys):
    result = MOD.run_knowledge_graph_gate()
    assert result["id"] == "G-knowledge-graph"
    assert result["exit_code"] == 0, result["subgates"]
    assert {item["profile"] for item in result["subgates"]} == {"knowledge", "doctrine", "required-info", "cross"}
    assert MOD.main(["--knowledge-graph"]) == 0
    assert json.loads(capsys.readouterr().out)["id"] == "G-knowledge-graph"


def test_schema_and_rubric_match_the_aggregate_contract():
    schema = json.loads((SKILL_DIR / "schemas" / "completeness-findings.schema.json").read_text(encoding="utf-8"))
    assert set(schema["properties"]["aspects"]["required"]) == set(MOD.ASPECTS)
    assert schema["properties"]["verdict"]["enum"] == ["PASS", "FAIL"]
    delegation = schema["definitions"]["audit_delegation"]
    assert "audit_delegations" in schema["required"]
    assert set(delegation["properties"]["dispatch"]["required"]) == {
        "tool", "subagent_type", "session_id", "response_sha256",
    }
    assert "tool_use_id" in delegation["properties"]["dispatch"]["properties"]
    rubric = json.loads((SKILL_DIR / "references" / "scoring-rubric.json").read_text(encoding="utf-8"))
    assert rubric["aspect_to_auditor"] == {key: value["auditor"] for key, value in MOD.ASPECTS.items()}


def test_hearing_auditor_scope_excludes_decision_guidance():
    """C06 dispatch が C05 の decisions 責務を横取りして false FAIL にしない。"""
    r2 = (SKILL_DIR / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")
    r6 = (
        SKILL_DIR.parent / "run-system-spec-elicit" / "prompts" / "R6-audit-hearing.md"
    ).read_text(encoding="utf-8")
    agent = (SKILL_DIR.parents[1] / "agents" / "system-spec-hearing-auditor.md").read_text(
        encoding="utf-8"
    )
    for contract in (r2, r6, agent):
        assert "decisions[]" in contract
        assert "decision_guidance" in contract
        assert "担当外" in contract
    assert "起動 prompt に decisions の遡及監査を追加してはならない" in r2


def test_main_report_and_matrix_paths(tmp_path):
    with pytest.raises(SystemExit):
        MOD.main([])
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(golden_report(), ensure_ascii=False), encoding="utf-8")
    ledger_path = tmp_path / "audit-fork-ledger.jsonl"
    write_ledger(ledger_path)
    assert MOD.main(["--report", str(report_path), "--fork-ledger", str(ledger_path), "--session", "sess-1"]) == 0
    assert MOD.main(["--report", str(report_path), "--fork-ledger", str(ledger_path), "--session", "sess-2"]) == 1
    assert MOD.main(["--report", str(tmp_path / "nope.json")]) == 2
    matrix = tmp_path / "spec-state.json"
    write_matrix(matrix)
    assert MOD.main(["--matrix", str(matrix), "--require-complete"]) == 0


# ─── 出力契約の執行 (gap 6 で足した) ─────────────────────────────
#
# 2026-08-20 まで `completeness-findings.schema.json` は、リポジトリ全体で
# `test_schema_and_rubric_match_the_aggregate_contract` 1 か所からしか
# 参照されていなかった。そこは schema の形を定数と突き合わせるだけで、
# **レポートの実体を 1 件も検証していなかった。**
# schema は宣言されていて、執行されていなかった。
#
# 執行されない schema は、書いた人には「守られている」ように見える。
# **欄を足すことと、欄が守られることは別である。**


def test_report_instances_satisfy_the_declared_schema():
    """レポート実体を schema 全文で検証する (jsonschema が使えるテスト側の層)。"""
    jsonschema = pytest.importorskip("jsonschema")
    schema = MOD.load_report_schema()
    jsonschema.validate(golden_report(), schema)


def test_a_declared_downgrade_passes_both_the_schema_and_the_cli_path():
    """**欄を足しただけで終わらせない。**

    `verdict_downgrade` を検査側 (audit_fork_attribution) だけに足すと、schema の
    `additionalProperties: false` が同じ欄を落とすので、機械層はその欄を**一度も
    受け取れない**。表現できるようにしたつもりで、実際には通り道が無い状態になる。
    schema 側と CLI 側の両方で通ることをここで縛る。

    `reason` は列挙コード、`detail` は本文で、schema の enum / required と検査側の
    語彙がずれていればここが落ちる。
    """
    jsonschema = pytest.importorskip("jsonschema")
    # 観点が FAIL になれば総合も FAIL へ落ちる (既存の再導出)。緩める向きではないので
    # そこは変えない。primary receipt は PASS のまま = これが降格である。
    report = golden_report(
        verdict="FAIL",
        gaps=["[matrix_coverage / high] sub_input が FAIL のため matrix_coverage は未確定"],
    )
    report["aspects"]["matrix_coverage"]["verdict"] = "FAIL"
    report["aspects"]["matrix_coverage"]["verdict_downgrade"] = {
        "from": "PASS",
        "reason": "sub_input_fail",
        "detail": "sub_input が FAIL のため primary の PASS を額面どおり採れない",
    }
    # 語彙コードには機械で引ける裏が要る。sub_input receipt と台帳を実際に FAIL へ寄せる。
    sub_input_auditor = "system-spec-hearing-auditor"
    for delegation in report["audit_delegations"]:
        if delegation["role"] == "sub_input":
            delegation["verdict"] = "FAIL"
            delegation["dispatch"]["response_sha256"] = response_digest(sub_input_auditor, "FAIL")
    ledger = golden_ledger()
    ledger["receipts"][sub_input_auditor]["sess-1"] = {
        response_digest(sub_input_auditor, "FAIL"): {"tool_name": "Task", "verdict": "FAIL"},
    }
    jsonschema.validate(report, MOD.load_report_schema())
    assert MOD.validate_report(report, ledger) == []


def test_the_schema_validation_can_fail():
    """陽性対照: 宣言外の欄を足せば、全文検証は落ちる。

    これが無いと `validate` が何も見ない壊れ方をしたとき上が無条件に緑になる。
    """
    jsonschema = pytest.importorskip("jsonschema")
    schema = MOD.load_report_schema()
    report = golden_report()
    report["undeclared_field"] = "宣言されていない欄"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(report, schema)


def test_an_undeclared_top_level_field_is_refused_by_the_cli_path():
    """CLI 側 (jsonschema 非依存) でも宣言外の欄を咎める。

    C05 が実際に通す門はこちら。テスト側だけが見ている状態は、
    「誰も見ていない」に限りなく近い。
    """
    report = golden_report()
    report["inputs_"] = {"file_count": 1}
    violations = MOD.validate_report(report, golden_ledger())
    assert any("schema が宣言していない最上位の欄" in message for message in violations)


def test_a_report_without_inputs_is_refused():
    """入力インベントリの無いレポートを通さない。

    これが通ると、レポートは『どの版の仕様書に対する判定か』を名乗れないまま
    緑になり、評価後に仕様書を書き換えても PASS が古いまま有効に見え続ける。
    """
    report = golden_report()
    del report["inputs"]
    violations = MOD.validate_report(report, golden_ledger())
    assert any("'inputs' が無い" in message for message in violations)


def test_the_counted_and_the_listed_inputs_must_agree():
    """数えた件数と並べた対象が食い違うレポートを通さない。"""
    report = golden_report()
    report["inputs"]["file_count"] = 99
    violations = MOD.validate_report(report, golden_ledger())
    assert any("実件数" in message for message in violations)


def test_a_file_entry_without_mtime_is_refused():
    """per-file の欄は schema から導く。mtime は指紋に入らないが、記録は要る。"""
    report = golden_report()
    del report["inputs"]["files"][0]["mtime"]
    violations = MOD.validate_report(report, golden_ledger())
    assert any("'mtime' が無い" in message for message in violations)


def test_inputs_are_checked_against_the_actual_tree(tmp_path):
    """宣言された指紋を、実際のツリーから数え直して突き合わせる。"""
    (tmp_path / "system-spec").mkdir(parents=True)
    (tmp_path / "system-spec" / "index.md").write_text("中身", encoding="utf-8")

    import sys

    sys.path.insert(0, str(SKILL_DIR / "scripts"))
    from spec_input_inventory import build_inventory

    report = golden_report(inputs=build_inventory(tmp_path))
    assert MOD.validate_inputs_against_tree(report, tmp_path) == []

    # 陽性対照: 評価後に入力が変われば、同じ突き合わせが落ちる。
    (tmp_path / "system-spec" / "index.md").write_text("書き換えた", encoding="utf-8")
    stale = MOD.validate_inputs_against_tree(report, tmp_path)
    assert len(stale) == 1
    assert "評価後に入力が変わっている" in stale[0]


def test_the_declared_draft_actually_resolves_to_a_validator():
    """宣言した `$schema` が、実在する draft に解決されることを縛る。

    2026-08-20 まで、この schema は `https://json-schema.org/draft-07/schema#` を
    名乗っていた。draft-07 の正しい URI は **`http://`** であり、`https://` は
    どの validator も知らない。結果、jsonschema は黙って別の draft
    (2020-12) へ落ちて検証していた。**宣言した draft と、実際に適用される
    規則が違う**状態である。

    これは「執行されていない schema」の一段深い形だった。仮に誰かが執行を
    足しても、**足した本人が思っている規則とは別の規則で緑が出る。**
    しかも既定では警告 (DeprecationWarning) しか出ないので、気づく手がかりが
    ログの片隅にしか残らない。
    """
    jsonschema = pytest.importorskip("jsonschema")
    from jsonschema.validators import validator_for

    schema = MOD.load_report_schema()
    chosen = validator_for(schema)
    assert chosen is jsonschema.Draft7Validator, (
        f"宣言 {schema['$schema']!r} が {chosen.__name__} に解決された。"
        "宣言した draft と適用される規則が食い違っている"
    )
    chosen.check_schema(schema)


def test_the_draft_resolution_check_can_fail():
    """陽性対照: 知られていない URI を名乗れば、上の主張は落ちる。"""
    jsonschema = pytest.importorskip("jsonschema")
    from jsonschema.validators import validator_for

    schema = dict(MOD.load_report_schema())
    schema["$schema"] = "https://json-schema.org/draft-07/schema#"
    assert validator_for(schema) is not jsonschema.Draft7Validator
