#!/usr/bin/env python3
# /// script
# name: lint-live-trial-task-contract
# purpose: live-trial の task 指示 (task.md) の入力前提を fixture 形状と scenario 正本から fail-closed で検証し、前提節を決定論生成する。
# inputs: [argv --repo-root --task --shape --all --emit-premise --fixture-path --json-out]
# outputs: [stdout JSON {lint, checked, violations, violation_count, exit_code} または premise text, exit 0 ok / 2 violation / 1 error]
# contexts: [E]
# network: false
# write-scope: --json-out 指定時のみ
# dependencies: [../lib/live_trial_task_contract.py]
# requires-python: ">=3.11"
# ///
"""live-trial の task 指示が fixture 契約からずれることを機械的に防ぐ CLI。

決定論的な契約読込・task 解析は ``../lib/live_trial_task_contract.py`` に分離し、本ファイルは
前提節の生成、対象列挙、JSON report、CLI のみに責務を限定する。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

LIB_DIR = str(Path(__file__).resolve().parents[1] / "lib")
if LIB_DIR not in sys.path:
    sys.path.insert(0, LIB_DIR)

from live_trial_task_contract import (  # noqa: E402
    LINT_NAME,
    PREMISE_BEGIN,
    PREMISE_END,
    LintError,
    args_drift,
    check_task,
    contract_digest,
    find_contract,
    latest_task_path,
    load_scenarios,
    load_shape_contracts,
    premise_block,
    resolve_scenario,
)

__all__ = ["PREMISE_BEGIN", "args_drift"]


def render_premise(
    contract: dict[str, Any], scenario: dict[str, Any], *, fixture_path: str
) -> str:
    """fixture 契約と scenario 正本から task.md の「入力前提」節を決定論生成する。"""
    scenario_id = str(scenario.get("scenario_id", ""))
    digest = contract_digest(contract, scenario)
    harness = str(contract.get("harness_plugin", ""))
    placed = [str(item) for item in contract.get("placed_inputs", ())]
    absent = [str(item) for item in contract.get("absent_artifacts", ())]
    entry_points = [str(item) for item in contract.get("required_entry_points", ())]
    negative_control_roots = [
        str(item) for item in contract.get("negative_control_roots", ())
    ]
    workflow_mode = str(contract.get("workflow_mode", "build"))
    observations = scenario.get("required_observations")
    task_contract = scenario.get("task_contract", {})
    required_fragments = (
        [str(item) for item in task_contract.get("required_fragments", ())]
        if isinstance(task_contract, dict)
        else []
    )

    lines: list[str] = [
        f"<!-- live-trial-premise:begin scenario={scenario_id} contract-digest={digest} -->",
        "",
        "## この scenario の入力前提 (fixture 正本から生成。手で書き換えないこと)",
        "",
        f"被験 fixture は `{fixture_path}` にある dev-graph 初期化済みの独立 Git repository です。",
        "",
        f"fixture が最初から置く業務入力は次の {len(placed)} ファイルだけです:",
        "",
    ]
    lines.extend(f"- `{relative}`" for relative in placed)
    if absent:
        lines.extend([
            "",
            "次の成果物は fixture が先回りして作っていません。これらを生成するところからが"
            "本 scenario の測定対象です:",
            "",
        ])
        lines.extend(f"- `{relative}`" for relative in absent)
    if entry_points:
        if workflow_mode == "reuse-confirmed":
            lines.extend([
                "",
                f"R0-context / R1-preflight で宣言済みの {harness} と次の entry point の"
                "実在を確認してください。fixture の digest-bound PASS receipt は current な"
                "ため、これら upstream entry point は呼び出さず、"
                "`validate-system-spec-resume.py` の `reuse-confirmed` 検証だけを実行します。",
                "",
            ])
        else:
            lines.extend([
                "",
                f"R0-context / R1-preflight を省略せず、その後に宣言済みの {harness} を"
                "次の正規 entry point で委譲実行し、正規フローを最後まで完走させてください。"
                "各 entry point は必ず `Skill` ツールで呼び出してください "
                "(script を Bash から直接叩いて代替してはいけません)。",
                "",
            ])
        lines.extend(
            f"{index}. `{harness}:{name}`" for index, name in enumerate(entry_points, start=1)
        )
    if negative_control_roots:
        lines.extend([
            "",
            "duplicate-logic の negative control は、次の実行可能な実装 root だけを検索対象に"
            "してください。tests/fixtures・コメント・受領書は実装複製の有無を示さないため"
            "対象外です:",
            "",
        ])
        lines.extend(f"- `{relative}`" for relative in negative_control_roots)
    if isinstance(observations, list) and observations:
        lines.extend([
            "",
            "本 scenario の必須観測 (scenario 正本 required_observations):",
            "",
        ])
        lines.extend(f"- {str(item)}" for item in observations)
    if required_fragments:
        lines.extend([
            "",
            "本 scenario の必須 task contract (次の文言を省略しないこと):",
            "",
        ])
        lines.extend(f"- {fragment}" for fragment in required_fragments)
    lines.extend(["", PREMISE_END, ""])
    return "\n".join(lines)


def _report(
    checked: list[dict[str, Any]], violations: list[dict[str, str]]
) -> dict[str, Any]:
    ordered = sorted(violations, key=lambda item: (item["rule"], item.get("task", ""), item["detail"]))
    return {
        "lint": LINT_NAME,
        "repo_root": ".",
        "checked": checked,
        "checked_count": len(checked),
        "violations": ordered,
        "violation_count": len(ordered),
        "exit_code": 2 if ordered else 0,
    }


def run_lint(
    root: Path, *, task: Path | None, shape: str | None, scan_all: bool
) -> dict[str, Any]:
    contracts = load_shape_contracts(root)
    scenarios = load_scenarios(root)
    if not contracts:
        raise LintError("TASK_CONTRACT を宣言した shape が無い (検査対象 0 — 契約の宣言漏れ)")

    targets: list[tuple[str, dict[str, Any], Path | None]] = []
    if scan_all:
        for name, contract in sorted(contracts.items()):
            scenario = resolve_scenario(contract, scenarios)
            skill = str(scenario.get("skill", ""))
            path = latest_task_path(root, skill) if skill else None
            targets.append((name, contract, path))
    else:
        if task is None:
            raise LintError("--task / --all のいずれかが必要")
        if not task.is_absolute():
            task = root / task
        text = task.read_text(encoding="utf-8")
        name, contract = find_contract(contracts, shape=shape, text=text)
        targets.append((name, contract, task))

    checked: list[dict[str, Any]] = []
    violations: list[dict[str, str]] = []
    for name, contract, path in targets:
        scenario = resolve_scenario(contract, scenarios)
        scenario_id = str(scenario.get("scenario_id", ""))
        if path is None:
            violations.append({
                "rule": "LT-014",
                "task": "",
                "detail": (
                    f"shape {name} (scenario {scenario_id}) の最新 verdict 保有 run に "
                    "task.md が無い — live-trial 証跡から task 指示が失われている"
                ),
            })
            continue
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
        found = check_task(text, contract=contract, scenario=scenario, scenarios=scenarios)
        for item in found:
            violations.append({"rule": item["rule"], "task": relative, "detail": item["detail"]})
        checked.append({
            "shape": name,
            "scenario_id": scenario_id,
            "task": relative,
            "contract_digest": contract_digest(contract, scenario),
            "has_premise_block": premise_block(text) is not None,
            "violation_count": len(found),
        })
    return _report(checked, violations)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo-root", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--task", type=Path, help="検査する task.md")
    mode.add_argument("--all", action="store_true",
                      help="TASK_CONTRACT 宣言済み shape の最新 verdict 保有 run を検査")
    mode.add_argument("--emit-premise", action="store_true",
                      help="契約から入力前提節を決定論生成して stdout へ出す (--shape 必須)")
    parser.add_argument("--shape", help="shape 名 (--task では省略時に scenario_id から解決)")
    parser.add_argument("--fixture-path", default="<contained-fixture-repo>",
                        help="--emit-premise が前提節へ埋める fixture の絶対 path")
    parser.add_argument("--json-out", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        root = args.repo_root.resolve(strict=True)
        if args.emit_premise:
            if args.shape is None:
                raise LintError("--emit-premise は --shape が必須")
            contracts = load_shape_contracts(root)
            scenarios = load_scenarios(root)
            _, contract = find_contract(contracts, shape=args.shape, text=None)
            scenario = resolve_scenario(contract, scenarios)
            print(render_premise(contract, scenario, fixture_path=args.fixture_path), end="")
            return 0
        result = run_lint(root, task=args.task, shape=args.shape, scan_all=args.all)
    except (LintError, OSError) as exc:
        print(f"[{LINT_NAME}] ERROR: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")

    if result["violation_count"]:
        print(
            f"[{LINT_NAME}] FAIL: task 前提の契約違反 {result['violation_count']} 件 "
            "(--emit-premise で fixture 正本から前提節を再生成して task.md を作り直すこと)",
            file=sys.stderr,
        )
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
