#!/usr/bin/env python3
# /// script
# name: validate-paradigm-coverage
# purpose: Validate that elegant-review outputs cover all 30 paradigms with structured findings, and that run dirs follow Phase1->2->3 order.
# inputs:
#   - argv: review.md or findings.json, or --phase-order <run-dir-or-tree>
# outputs:
#   - stdout: OK message
#   - stderr: missing paradigm / schema / phase-order errors
#   - exit: 0=OK / 1=coverage or phase-order failure / 2=usage error
# contexts: [A, B, C, E]
# network: false
# write-scope: none
# dependencies: []
# ///
"""Check whether a review output covers all 30 paradigms.

Usage:
  validate-paradigm-coverage.py <review.md | findings.json>
  validate-paradigm-coverage.py --phase-order <run-dir | tree-root>

--phase-order は elegant-review run ディレクトリ
(eval-log/**/elegant-review/<run-id>/) の Phase1→2→3 成果物の存在+順序を検査し、
あわせて各 run の findings が condition と condition_signal の対応を守っているかを
検査する (enforcement 名: run-elegant-review/scripts/validate-paradigm-coverage.py
(phase order check))。
tolerant 契約: 3 phase の成果物 (shared_state.md / findings-phase2-*.json /
findings.json 等) が全て揃う run のみ順序検査し、どれかを欠く旧 run は skip する
(遡及 fail させない)。順序は mtime 比較で同時刻を許容する (fresh checkout 耐性)。

condition/condition_signal 対応検査の遡及免除には**終了条件がある**。run ディレクトリ名
`run-YYYYMMDD-*` から run 作成日を読み、STRICT_SIGNAL_FROM 以降の run は error、
それより前 (および日付を読めない run) は WARN 止まりとする。免除に終了条件を持たせない
と「旧 run を守るための WARN 既定」が恒久化し、検査が永久に自己申告のまま骨抜きになる
(この欠陥自体が本 script のレビューで SS-02 として検出された)。`--strict-signal` を
明示した場合は日付に関わらず全 run を error 扱いにする。

Exit codes:
  0 -> all 30 covered with structured findings or markdown mentions / phase order OK
  1 -> missing paradigms or phase-order violation detected
  2 -> usage error
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# `spec_from_file_location()` で本ファイルだけを直接ロードする既存テストでも、
# 分離した sibling module を解決できるよう script directory を明示する。
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from validate_phase_order import check_phase_order_tree

# Each paradigm: id -> list of acceptance tokens (ja + en, lowercased substring match)
# condition_signal (機械観測 signal) と condition (4 条件) の唯一の対応表。
# smell はどの condition にも対応しない警告枠なので、この表に持たない。
SIGNAL_TO_CONDITION: dict[str, str] = {
    "contradiction": "C1",
    "omission": "C2",
    "inconsistency": "C3",
    "dependency_break": "C4",
}

PARADIGMS: dict[int, list[str]] = {
    1: ["批判的思考", "critical"],
    2: ["演繹思考", "演繹", "deductive"],
    3: ["帰納的思考", "帰納", "inductive"],
    4: ["アブダクション", "abductive", "abduction"],
    5: ["垂直思考", "vertical"],
    6: ["要素分解", "decomposition"],
    7: ["mece"],
    8: ["2軸思考", "二軸思考", "two-axis", "two axis"],
    9: ["プロセス思考", "process thinking"],
    10: ["メタ思考", "meta thinking"],
    11: ["抽象化思考", "抽象化", "abstraction"],
    12: ["ダブル・ループ", "ダブルループ", "double-loop", "double loop"],
    13: ["ブレインストーミング", "ブレスト", "brainstorm"],
    14: ["水平思考", "lateral"],
    15: ["逆説思考", "paradox"],
    16: ["類推思考", "類推", "analogy"],
    17: ["if思考", "what-if", "what if"],
    18: ["素人思考", "beginner"],
    19: ["システム思考", "systems thinking", "system thinking"],
    20: ["因果関係分析", "causal analysis"],
    21: ["因果ループ", "causal loop"],
    22: ["トレードオン", "trade-on", "trade on"],
    23: ["プラスサム", "positive-sum", "positive sum"],
    24: ["価値提案思考", "価値提案", "value proposition"],
    25: ["戦略的思考", "strategic"],
    26: ["why思考", "why thinking"],
    27: ["改善思考", "improvement"],
    28: ["仮説思考", "hypothesis"],
    29: ["論点思考", "issue thinking"],
    30: ["kj法", "kj method"],
}

EXPECTED_META: dict[int, tuple[str, str, str]] = {
    1: ("critical", "A-logical", "elegant-logical-structural-analyst"),
    2: ("deduction", "A-logical", "elegant-logical-structural-analyst"),
    3: ("induction", "A-logical", "elegant-logical-structural-analyst"),
    4: ("abduction", "A-logical", "elegant-logical-structural-analyst"),
    5: ("vertical", "A-logical", "elegant-logical-structural-analyst"),
    6: ("decomposition", "B-structural", "elegant-logical-structural-analyst"),
    7: ("mece", "B-structural", "elegant-logical-structural-analyst"),
    8: ("two-axis", "B-structural", "elegant-logical-structural-analyst"),
    9: ("process", "B-structural", "elegant-logical-structural-analyst"),
    10: ("meta", "C-meta", "elegant-meta-divergent-analyst"),
    11: ("abstraction", "C-meta", "elegant-meta-divergent-analyst"),
    12: ("double-loop", "C-meta", "elegant-meta-divergent-analyst"),
    13: ("brainstorming", "D-divergent", "elegant-meta-divergent-analyst"),
    14: ("lateral", "D-divergent", "elegant-meta-divergent-analyst"),
    15: ("paradox", "D-divergent", "elegant-meta-divergent-analyst"),
    16: ("analogy", "D-divergent", "elegant-meta-divergent-analyst"),
    17: ("if", "D-divergent", "elegant-meta-divergent-analyst"),
    18: ("naive", "D-divergent", "elegant-meta-divergent-analyst"),
    19: ("systems", "E-system", "elegant-system-strategic-analyst"),
    20: ("causal", "E-system", "elegant-system-strategic-analyst"),
    21: ("causal-loop", "E-system", "elegant-system-strategic-analyst"),
    22: ("trade-on", "F-strategic", "elegant-system-strategic-analyst"),
    23: ("plus-sum", "F-strategic", "elegant-system-strategic-analyst"),
    24: ("value-proposition", "F-strategic", "elegant-system-strategic-analyst"),
    25: ("strategic", "F-strategic", "elegant-system-strategic-analyst"),
    26: ("why", "G-problem", "elegant-system-strategic-analyst"),
    27: ("kaizen", "G-problem", "elegant-system-strategic-analyst"),
    28: ("hypothesis", "G-problem", "elegant-system-strategic-analyst"),
    29: ("issue", "G-problem", "elegant-system-strategic-analyst"),
    30: ("kj", "G-problem", "elegant-system-strategic-analyst"),
}


def validate_structured_json(path: Path, strict_signal: bool = False) -> tuple[bool, list[str]]:
    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return False, ["invalid json"]
    warnings: list[str] = []
    findings = data.get("paradigm_findings")
    if not isinstance(findings, list):
        return False, ["missing paradigm_findings"]

    by_id: dict[int, dict] = {}
    errors: list[str] = []
    for idx, item in enumerate(findings):
        if not isinstance(item, dict):
            errors.append(f"paradigm_findings[{idx}] is not an object")
            continue
        pid = item.get("paradigm_id")
        if not isinstance(pid, int):
            errors.append(f"paradigm_findings[{idx}].paradigm_id is not int")
            continue
        if pid in by_id:
            errors.append(f"duplicate paradigm_id: {pid}")
            continue
        by_id[pid] = item

    coverage = data.get("thought_method_coverage")
    used_methods: set[str] = set()
    canonical_methods = {meta[0] for meta in EXPECTED_META.values()}
    if coverage is None:
        errors.append("missing thought_method_coverage")
    elif not isinstance(coverage, dict):
        errors.append("thought_method_coverage must be an object")
    else:
        if coverage.get("total") != 30:
            errors.append("thought_method_coverage.total must be 30")
        used = coverage.get("used", [])
        if not isinstance(used, list):
            errors.append("thought_method_coverage.used must be a list")
        else:
            used_methods = {str(item).strip() for item in used if str(item).strip()}
        skipped = coverage.get("skipped_with_reason", [])
        if not isinstance(skipped, list):
            errors.append("thought_method_coverage.skipped_with_reason must be a list")
        elif skipped:
            errors.append("thought_method_coverage.skipped_with_reason must be empty; all 30 methods are required")
        if (
            not isinstance(used, list)
            or len(used) != 30
            or len(used_methods) != 30
            or used_methods != canonical_methods
        ):
            errors.append(
                "thought_method_coverage.used must contain exactly 30 unique canonical methods"
            )

    missing = []
    for pid in PARADIGMS:
        expected_name = EXPECTED_META[pid][0]
        if pid not in by_id:
            missing.append(pid)
        if pid in by_id and coverage is not None and expected_name not in used_methods:
            errors.append(f"paradigm {pid}: finding exists but method missing from coverage.used")
    if missing:
        errors.append(f"missing paradigm_findings ids: {missing}")

    valid_conditions = set(SIGNAL_TO_CONDITION.values())
    valid_severities = {"critical", "high", "medium", "low"}
    for pid in sorted(set(PARADIGMS) & set(by_id)):
        item = by_id[pid]
        expected_name, expected_category, expected_agent = EXPECTED_META[pid]
        if item.get("paradigm_name") != expected_name:
            errors.append(f"paradigm {pid}: expected paradigm_name={expected_name}")
        if item.get("category") != expected_category:
            errors.append(f"paradigm {pid}: expected category={expected_category}")
        if item.get("agent") != expected_agent:
            errors.append(f"paradigm {pid}: expected agent={expected_agent}")
        observations = item.get("observations")
        issues = item.get("issues")
        if not isinstance(observations, list) or not any(str(x).strip() for x in observations):
            errors.append(f"paradigm {pid}: observations must contain non-empty text")
        matrix = item.get("condition_matrix")
        if not isinstance(matrix, dict):
            errors.append(f"paradigm {pid}: condition_matrix must cover C1-C4")
        else:
            issue_conditions: set[str] = set()
            for issue in issues:
                if isinstance(issue, dict) and issue.get("condition") in valid_conditions:
                    issue_conditions.add(issue["condition"])
            for cond in ("C1", "C2", "C3", "C4"):
                verdict = matrix.get(cond)
                if not isinstance(verdict, dict):
                    errors.append(f"paradigm {pid}: condition_matrix.{cond} must be object")
                    continue
                status = verdict.get("verdict")
                if status not in {"PASS", "FAIL", "PARTIAL"}:
                    errors.append(f"paradigm {pid}: condition_matrix.{cond}.verdict invalid")
                evidence = verdict.get("evidence")
                if not isinstance(evidence, list) or not any(str(x).strip() for x in evidence):
                    errors.append(f"paradigm {pid}: condition_matrix.{cond}.evidence must contain non-empty text")
                if status == "PASS" and cond in issue_conditions:
                    errors.append(
                        f"paradigm {pid}: condition_matrix.{cond}=PASS conflicts with issues-derived FAIL"
                    )
                if status in {"FAIL", "PARTIAL"} and cond not in issue_conditions:
                    errors.append(
                        f"paradigm {pid}: condition_matrix.{cond}={status} requires a matching issue"
                    )
        if not isinstance(issues, list):
            errors.append(f"paradigm {pid}: issues must be a list")
            continue
        for i, issue in enumerate(issues):
            if not isinstance(issue, dict):
                errors.append(f"paradigm {pid} issue {i}: not an object")
                continue
            signal = issue.get("condition_signal")
            valid_signals = set(SIGNAL_TO_CONDITION) | {"smell"}
            if signal is not None and signal not in valid_signals:
                errors.append(f"paradigm {pid} issue {i}: invalid condition_signal")
            condition = issue.get("condition")
            # condition (4 値) と condition_signal (5 値) は濃度が一致しない。
            # smell の issue に C1 等の便宜値を持たせる二重帳簿を避けるため、
            # smell のときだけ condition の省略を許す (findings.schema.json と同契約)。
            if signal == "smell":
                if condition is not None:
                    # schema が condition を required にしていた時代の findings は
                    # smell にも便宜値を持つ。過去 run を遡って赤にしないため warning に留める。
                    warnings.append(
                        f"paradigm {pid} issue {i}: condition_signal=smell に便宜値 condition={condition} が残っている "
                        f"(新規 run では省略すること。verdict には算入されない)"
                    )
            elif condition not in valid_conditions:
                errors.append(f"paradigm {pid} issue {i}: invalid condition")
            elif signal is not None and SIGNAL_TO_CONDITION[signal] != condition:
                msg = (
                    f"paradigm {pid} issue {i}: condition={condition} と condition_signal={signal} が対応しない "
                    f"(期待 condition={SIGNAL_TO_CONDITION[signal]})"
                )
                # --phase-order と同じ tolerant 契約: 旧 run を遡及 fail させない。
                # 新規 run は Phase 3 完了判定で --strict-signal を付けて error に昇格させる。
                (errors if strict_signal else warnings).append(msg)
            if issue.get("severity") not in valid_severities:
                errors.append(f"paradigm {pid} issue {i}: invalid severity")
            if not str(issue.get("description", "")).strip():
                errors.append(f"paradigm {pid} issue {i}: missing description")
            if not str(issue.get("recommended_intervention", "")).strip():
                errors.append(f"paradigm {pid} issue {i}: missing recommended_intervention")

    variable_abstraction = data.get("variable_abstraction")
    if not isinstance(variable_abstraction, list):
        errors.append("variable_abstraction must be a list")
    for idx, var in enumerate(variable_abstraction or []):
        if not isinstance(var, dict):
            errors.append(f"variable_abstraction[{idx}] must be object")
            continue
        for key in (
            "concrete_value",
            "name",
            "meaning",
            "default",
            "required",
            "not_applicable_when",
            "source_trace",
        ):
            if key not in var:
                errors.append(f"variable_abstraction[{idx}] missing {key}")
        name = str(var.get("name", ""))
        if not (name.startswith("{{") and name.endswith("}}")):
            errors.append(f"variable_abstraction[{idx}].name must be template variable")
        if "required" in var and not isinstance(var["required"], bool):
            errors.append(f"variable_abstraction[{idx}].required must be boolean")

    for warn in warnings:
        print(f"WARN: {warn}", file=sys.stderr)
    return not errors, errors


def extract_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").lower()


def main(argv: list[str]) -> int:
    argv = list(argv)
    strict_signal = "--strict-signal" in argv
    argv = [a for a in argv if a != "--strict-signal"]
    if len(argv) < 2:
        print(
            "usage: validate-paradigm-coverage.py [--strict-signal] <file> | --phase-order <dir>",
            file=sys.stderr,
        )
        return 2
    if argv[1] == "--phase-order":
        if len(argv) < 3:
            print("usage: validate-paradigm-coverage.py --phase-order <dir>", file=sys.stderr)
            return 2
        base = Path(argv[2])
        if not base.is_dir():
            print(f"not a directory: {base}", file=sys.stderr)
            return 2
        return check_phase_order_tree(
            base,
            SIGNAL_TO_CONDITION,
            strict_signal=strict_signal,
        )
    path = Path(argv[1])
    if path.suffix == ".json":
        ok, errors = validate_structured_json(path, strict_signal=strict_signal)
        if not ok:
            for err in errors:
                print(err, file=sys.stderr)
            return 1
        print("OK: exactly 30 unique paradigms used with structured findings; skips=0")
        return 0

    text = extract_text(path)
    missing = []
    for pid, tokens in PARADIGMS.items():
        if not any(tok.lower() in text for tok in tokens):
            missing.append(pid)
    if missing:
        print(f"MISSING paradigms ({len(missing)}/30): {missing}", file=sys.stderr)
        return 1
    print("OK: all 30 paradigms covered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
