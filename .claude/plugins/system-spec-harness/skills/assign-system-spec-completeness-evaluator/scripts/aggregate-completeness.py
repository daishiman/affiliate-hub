#!/usr/bin/env python3
# /// script
# name: aggregate-completeness
# version: 0.2.0
# purpose: C05 完成度評価レポートを fail-closed で集約し、matrix/知識グラフの決定論ゲートを実行する
# inputs:
#   - argv: --report FILE [--fork-ledger FILE] / --matrix FILE [--require-complete] / --knowledge-graph
# outputs:
#   - stdout: OK/violation 一覧または gate 結果 JSON
#   - exit: 0=OK / 1=violation or gate fail / 2=usage error
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""C05 完成度レポートを検証・集約する CLI。

report 形状、全 6 観点の fail-closed verdict、high finding、独立監査の実 fork
証跡を一つの入口で検証する。台帳読取りと receipt 照合は
`audit_fork_attribution.py` に分離し、ここでは集約と CLI を所有する。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from audit_fork_attribution import (  # noqa: E402
    ASPECTS,
    ASPECT_VERDICTS,
    DELEGATION_ROLES,
    EVALUATOR_NAME,
    LEDGER_ENV,
    LEDGER_RELPATH,
    LEDGER_TOOL_NAMES,
    OVERALL_VERDICTS,
    SEVERITIES,
    SUB_INPUT_AUDITORS,
    agent_definition_exists,
    default_ledger_path,
    empty_ledger,
    ledger_corroborates,
    load_fork_ledger,
    required_delegations,
    validate_attribution,
)


def aggregate_verdict(aspect_verdicts: dict, high_count: int) -> str:
    """全観点と high finding から総合 verdict を fail-closed で再導出する。"""
    if set(aspect_verdicts) != set(ASPECTS):
        return "FAIL"
    if any(value not in ASPECT_VERDICTS for value in aspect_verdicts.values()):
        return "FAIL"
    if high_count > 0:
        return "FAIL"
    return "PASS" if all(value == "PASS" for value in aspect_verdicts.values()) else "FAIL"


def _high_count(findings: list) -> int:
    return sum(1 for finding in findings if isinstance(finding, dict) and finding.get("severity") == "high")


def validate_report(
    report: dict, ledger: dict | None = None, expected_session: str | None = None
) -> list[str]:
    """レポート形状、総合判定、実 fork 帰属を検証し違反リストを返す。"""
    violations: list[str] = []
    if not isinstance(report, dict):
        return ["report: オブジェクトでない"]

    evaluator = report.get("evaluator")
    if not isinstance(evaluator, dict):
        violations.append("evaluator: オブジェクトでない")
    else:
        if evaluator.get("name") != EVALUATOR_NAME:
            violations.append(f"evaluator.name != {EVALUATOR_NAME!r}")
        if evaluator.get("context") != "fork":
            violations.append("evaluator.context != 'fork' (独立 context 必須)")
        if not evaluator.get("version"):
            violations.append("evaluator.version が空")

    verdict = report.get("verdict")
    if verdict not in OVERALL_VERDICTS:
        violations.append(f"verdict={verdict!r} が {sorted(OVERALL_VERDICTS)} 外")

    aspects = report.get("aspects")
    aspect_verdicts: dict[str, str] = {}
    if not isinstance(aspects, dict):
        violations.append("aspects: オブジェクトでない")
    else:
        extra = set(aspects) - set(ASPECTS)
        missing = set(ASPECTS) - set(aspects)
        if extra:
            violations.append(f"aspects: 未知の観点 {sorted(extra)}")
        if missing:
            violations.append(f"aspects: 観点欠落 {sorted(missing)} (全観点を過不足なく)")
        for aspect_id, specification in ASPECTS.items():
            aspect = aspects.get(aspect_id)
            if not isinstance(aspect, dict):
                continue
            aspect_verdict = aspect.get("verdict")
            if aspect_verdict not in ASPECT_VERDICTS:
                violations.append(f"aspects[{aspect_id}].verdict={aspect_verdict!r} が {sorted(ASPECT_VERDICTS)} 外")
            else:
                aspect_verdicts[aspect_id] = aspect_verdict
            if aspect.get("auditor") != specification["auditor"]:
                violations.append(f"aspects[{aspect_id}].auditor != {specification['auditor']!r} (観点↔監査 agent 対応)")
            if aspect.get("component") != specification["component"]:
                violations.append(f"aspects[{aspect_id}].component != {specification['component']!r}")
            if not aspect.get("summary"):
                violations.append(f"aspects[{aspect_id}].summary が空")

    gaps = report.get("gaps")
    if not isinstance(gaps, list):
        violations.append("gaps: 配列でない (不足事項一覧)")
        gaps = []

    findings = report.get("findings")
    if not isinstance(findings, list) or not findings:
        violations.append("findings: 非空配列でない (PASS 時も info を 1 件以上残す)")
        findings = []
    else:
        for index, finding in enumerate(findings):
            if not isinstance(finding, dict):
                violations.append(f"findings[{index}]: オブジェクトでない")
                continue
            if finding.get("severity") not in SEVERITIES:
                violations.append(f"findings[{index}].severity={finding.get('severity')!r} が {sorted(SEVERITIES)} 外")
            if not finding.get("bucket"):
                violations.append(f"findings[{index}].bucket が空")
            if not finding.get("observation"):
                violations.append(f"findings[{index}].observation が空")

    if isinstance(aspects, dict) and verdict in OVERALL_VERDICTS:
        derived = aggregate_verdict(aspect_verdicts, _high_count(findings))
        if derived != verdict:
            violations.append(
                f"verdict={verdict!r} が 全観点 + high finding 数からの fail-closed 再導出 "
                f"{derived!r} と不一致 (総合判定が観点スコアに接地していない)"
            )
    if verdict == "FAIL" and not gaps:
        violations.append("verdict=FAIL だが gaps (不足事項一覧) が空 (差し戻し材料が無い)")
    violations.extend(validate_attribution(report, ledger, expected_session))
    return violations


def _plugin_root() -> Path:
    """.../skills/<skill>/scripts/aggregate-completeness.py から plugin root を返す。"""
    return Path(__file__).resolve().parents[3]


def run_coverage_gate(matrix_path, require_complete: bool = False) -> dict:
    """C05 の matrix deterministic gate を実行する。"""
    gate = _plugin_root() / "scripts" / "validate-coverage-matrix.py"
    command = [sys.executable or "python3", str(gate), "--matrix", str(matrix_path)]
    if require_complete:
        command.append("--require-complete")
    process = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    return {
        "id": "G-matrix",
        "name": "validate-coverage-matrix",
        "conditions": ["matrix_coverage"],
        "command": [str(item) for item in command],
        "exit_code": int(process.returncode),
        "stdout": process.stdout.strip(),
        "stderr": process.stderr.strip(),
    }


def run_knowledge_graph_gate() -> dict:
    """C13-C16 の knowledge/doctrine/required-info/cross gate を独立再実行する。"""
    root = _plugin_root()
    gate = root / "scripts" / "validate-knowledge-graph.py"
    design_references = root / "skills" / "ref-system-design-knowledge" / "references"
    elicit_references = root / "skills" / "run-system-spec-elicit" / "references"
    doctrine = design_references / "doctrine-anchor-registry.json"
    required_info = elicit_references / "required-info-catalog.json"
    python = sys.executable or "python3"
    runs = (
        ("knowledge", [python, str(gate), "--profile", "knowledge", "--input", str(design_references / "knowledge-catalog.json")]),
        ("doctrine", [python, str(gate), "--profile", "doctrine", "--input", str(doctrine)]),
        ("required-info", [python, str(gate), "--profile", "required-info", "--input", str(required_info)]),
        ("cross", [python, str(gate), "--profile", "cross", "--taxonomy", str(design_references / "system-category-taxonomy.json"), "--doctrine", str(doctrine), "--required-info", str(required_info)]),
    )
    subgates = []
    worst = 0
    for name, command in runs:
        process = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        subgates.append({
            "profile": name,
            "command": [str(item) for item in command],
            "exit_code": int(process.returncode),
            "stderr": process.stderr.strip(),
        })
        worst = max(worst, int(process.returncode))
    return {
        "id": "G-knowledge-graph",
        "name": "validate-knowledge-graph",
        "conditions": ["design_knowledge_reflection", "matrix_coverage"],
        "exit_code": worst,
        "subgates": subgates,
    }


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description="C05 完成度評価レポートの形状検証 / 決定論ゲート実行")
    parser.add_argument("--report", help="評価レポート JSON のパス")
    parser.add_argument("--fork-ledger", help="監査 fork 台帳 JSONL のパス")
    parser.add_argument("--session", help="現在の評価 run の session_id (receipt と照合)")
    parser.add_argument("--matrix", help="spec-state.json のパス (matrix gate を実行)")
    parser.add_argument("--require-complete", action="store_true", help="matrix gate を未収集 0 必須で実行")
    parser.add_argument("--knowledge-graph", action="store_true", help="C13-C16 の 4 profile gate を実行")
    args = parser.parse_args(argv)
    if not args.report and not args.matrix and not args.knowledge_graph:
        parser.error("--report / --matrix / --knowledge-graph のいずれかが必要")

    return_code = 0
    if args.matrix:
        result = run_coverage_gate(args.matrix, require_complete=args.require_complete)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result["exit_code"] != 0:
            return_code = 1
    if args.knowledge_graph:
        result = run_knowledge_graph_gate()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result["exit_code"] != 0:
            return_code = 1
    if args.report:
        report_path = Path(args.report)
        if not report_path.is_file():
            print(f"report ファイルが存在しない: {args.report}", file=sys.stderr)
            return 2
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            print(f"report の JSON parse 失敗: {exc}", file=sys.stderr)
            return 2
        ledger = load_fork_ledger(args.fork_ledger or default_ledger_path())
        violations = validate_report(report, ledger, expected_session=args.session)
        if violations:
            for message in violations:
                print(f"VIOLATION: {message}", file=sys.stderr)
            print(
                f"FAIL: {len(violations)} 件のレポート整合違反 (fork 台帳: {ledger['path']} / "
                f"exists={ledger['exists']} / 裏取り fork {sum(ledger['dispatched'].values())} 件)",
                file=sys.stderr,
            )
            return_code = 1
        else:
            print(f"OK: レポート形状・総合判定整合・独立 auditor 帰属の fork 証跡接地を満たす (verdict={report.get('verdict')})")
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
