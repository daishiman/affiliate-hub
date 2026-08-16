#!/usr/bin/env python3
# /// script
# name: validate-system-spec-evaluator-completion
# purpose: C19 live trial の build/resume 別完了境界と C02 import の正当性を検証する。
# inputs: [argv --transcript, optional argv --resume-report]
# outputs: [stdout JSON, exit 0 pass, exit 2 fail-closed]
# contexts: [E]
# network: false
# write-scope: none
# requires-python: ">=3.11"
# ///
"""C19 の completeness evaluator 完了境界を transcript で検証する。

``context: fork`` の Skill 起動結果には完全な ``agentId`` が含まれる一方、UI の
subagent 一覧には ``TaskOutput`` と互換でない短縮 ID が表示されることがある。そのため
特定ツールの自己申告ではなく、次の因果関係を JSONL transcript のイベント順で閉じる。

1. assign-system-spec-completeness-evaluator の Skill 起動結果から完全な agentId を得る。
2. 同じ agentId/tool-use-id の native task-notification が completed かつ結果本文を持つ。
3. その完了通知より後に初めて upsert-node.py (C02 import) が実行される。
4. 待機中に TaskStop を使わず、outer session が completeness-report.json を代筆しない。

``--resume-report`` が無い build 経路は上記の因果関係を要求する。指定された resume 経路は
evaluator を再実行せず、digest-bound PASS receipt を検証した決定論 runner が全 C02 step を
完走したこと、runner stdout と report が同一であること、upstream Skill/Agent/direct upsert が
0 件であることを要求する。一つでも証明できなければ exit 2 とする。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable


EVALUATOR_SKILL = "system-spec-harness:assign-system-spec-completeness-evaluator"
TARGET_SKILL = "dev-graph:run-dev-graph-system-spec"
REPORT_NAME = "completeness-report.json"
RESUME_REPORT_NAME = "run-dev-graph-system-spec-resume-report.json"
REQUIRED_RESUME_STEPS = {
    "resolve-context",
    "validate-resume",
    "build-import",
    "gate-boundary",
    "gate-source-and-evidence-bindings",
    "gate-graph-preview",
    "c02-dry-run-architecture",
    "c02-dry-run-specification",
    "c02-upsert-architecture",
    "c02-upsert-specification",
    "gate-evidence-refs",
    "gate-source-digest",
}
# The bounded C19 live-trial fixture declares these two node IDs. This is not a
# universal caller-repository contract; a different fixture needs its own
# report contract instead of reusing this validator unchanged.
LIVE_TRIAL_FIXTURE_RESUME_NODES = [
    "arch-system-spec-overview",
    "spec-system-spec-index",
]
UPSERT_EXECUTION = re.compile(
    r"^\s*(?:python(?:3(?:\.\d+)?)?|uv\s+run\s+python(?:3(?:\.\d+)?)?)\s+"
    r"(?:\"[^\"\n]*upsert-node\.py\"|'[^'\n]*upsert-node\.py'|[^\s;\n]*upsert-node\.py)"
    r"(?:\s|;|$)",
    re.MULTILINE,
)
LOOPING_SLEEP = re.compile(r"\b(?:until|while|for)\b[\s\S]*\bsleep\b")
LONG_SLEEP = re.compile(r"\bsleep\s+(?P<seconds>\d+(?:\.\d+)?)\b")
RESUME_RUNNER = re.compile(r"(?:^|[\s/])build-system-spec-resume-import\.py(?:\s|$)")


def _blocks(record: dict[str, Any]) -> Iterable[dict[str, Any]]:
    message = record.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, list):
        return ()
    return (block for block in content if isinstance(block, dict))


def _tool_uses(record: dict[str, Any]) -> Iterable[dict[str, Any]]:
    return (block for block in _blocks(record) if block.get("type") == "tool_use")


def _tool_results(record: dict[str, Any]) -> Iterable[dict[str, Any]]:
    return (block for block in _blocks(record) if block.get("type") == "tool_result")


def _load(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        return [], [{"rule": "EV-001", "detail": f"transcript を読めない: {exc}"}]
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            violations.append({
                "rule": "EV-002",
                "line": line_number,
                "detail": f"JSONL record が壊れている: {exc}",
            })
            continue
        if not isinstance(value, dict):
            violations.append({
                "rule": "EV-002",
                "line": line_number,
                "detail": "JSONL record が object でない",
            })
            continue
        value["_line"] = line_number
        records.append(value)
    return records, violations


def _tag(prompt: str, name: str) -> str | None:
    found = re.search(rf"<{re.escape(name)}>(.*?)</{re.escape(name)}>", prompt, re.DOTALL)
    return found.group(1).strip() if found else None


def _is_upsert_mutation(command: str) -> bool:
    """``upsert-node.py --help/-h`` の read-only CLI 参照を mutation から除外する。"""
    for found in UPSERT_EXECUTION.finditer(command):
        line_end = command.find("\n", found.start())
        line = command[found.start():line_end if line_end >= 0 else len(command)]
        if re.search(r"(?:^|\s)(?:--help|-h)(?:\s|$)", line):
            continue
        return True
    return False


def _write_target(inputs: dict[str, Any]) -> str | None:
    """Write/Edit の実 target だけを返し、content 内の path 言及を除外する。"""
    for key in ("file_path", "path"):
        value = inputs.get(key)
        if isinstance(value, str):
            return value
    return None


def _result_json(
    result_entry: tuple[int, dict[str, Any], dict[str, Any]] | None,
) -> dict[str, Any] | None:
    if result_entry is None:
        return None
    _, record, result = result_entry
    candidates = [result.get("content")]
    tool_result = record.get("toolUseResult")
    if isinstance(tool_result, dict):
        candidates.append(tool_result.get("stdout"))
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        try:
            value = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return None


def _validate_resume_report(report: Any) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    if not isinstance(report, dict):
        return [{"rule": "EV-013", "detail": "resume report が JSON object でない"}]
    required_values = {
        "runner": "build-system-spec-resume-import",
        "mode": "reuse-confirmed",
        "status": "PASS",
        "network_calls": 0,
        "upstream_skill_invocations": 0,
    }
    for key, expected in required_values.items():
        if report.get(key) != expected:
            violations.append({
                "rule": "EV-014",
                "detail": f"resume report {key}={report.get(key)!r}; expected {expected!r}",
            })
    if report.get("registered_this_run") != LIVE_TRIAL_FIXTURE_RESUME_NODES:
        violations.append({
            "rule": "EV-015",
            "detail": (
                "resume report の registered_this_run が C19 live-trial fixture の"
                " 2 node と一致しない"
            ),
        })
    resume = report.get("resume")
    if not isinstance(resume, dict) or resume.get("valid") is not True:
        violations.append({"rule": "EV-016", "detail": "digest-bound resume 検証が valid=true でない"})
    steps = report.get("steps")
    step_codes = {
        step.get("label"): step.get("exit_code")
        for step in steps if isinstance(step, dict)
    } if isinstance(steps, list) else {}
    missing = sorted(REQUIRED_RESUME_STEPS - step_codes.keys())
    failed = sorted(label for label, code in step_codes.items() if code != 0)
    if missing or failed:
        violations.append({
            "rule": "EV-017",
            "detail": f"resume closure step 不備: missing={missing}, nonzero={failed}",
        })
    contract = report.get("completion_contract")
    if not isinstance(contract, dict) or contract.get("version") != "system-spec-resume-closure/v1":
        violations.append({"rule": "EV-018", "detail": "resume completion contract v1 が無い"})
    checklist = report.get("checklist")
    if not isinstance(checklist, list) or not checklist:
        violations.append({"rule": "EV-019", "detail": "resume checklist evidence が無い"})
    elif any(
        not isinstance(item, dict)
        or item.get("status") != "pass"
        or not isinstance(item.get("evidence"), str)
        or not item["evidence"].strip()
        for item in checklist
    ):
        violations.append({"rule": "EV-019", "detail": "resume checklist に PASS/evidence 欠落がある"})
    return violations


def validate(
    records: list[dict[str, Any]], *, resume_report: dict[str, Any] | None = None
) -> dict[str, Any]:
    violations: list[dict[str, Any]] = []
    launches: list[dict[str, Any]] = []
    result_by_use_id: dict[str, tuple[int, dict[str, Any], dict[str, Any]]] = {}

    for index, record in enumerate(records):
        for result in _tool_results(record):
            use_id = result.get("tool_use_id")
            if isinstance(use_id, str):
                result_by_use_id[use_id] = (index, record, result)

    for index, record in enumerate(records):
        for tool in _tool_uses(record):
            inputs = tool.get("input")
            if tool.get("name") != "Skill" or not isinstance(inputs, dict):
                continue
            if inputs.get("skill") != EVALUATOR_SKILL:
                continue
            use_id = tool.get("id")
            launch: dict[str, Any] = {
                "tool_use_id": use_id,
                "launch_line": record.get("_line"),
                "agent_id": None,
                "completion_line": None,
            }
            result_entry = result_by_use_id.get(str(use_id))
            if result_entry is None:
                violations.append({
                    "rule": "EV-003",
                    "line": record.get("_line"),
                    "detail": "evaluator Skill 起動の tool_result が無い",
                })
            else:
                _, result_record, result_block = result_entry
                tool_result = result_record.get("toolUseResult")
                agent_id = tool_result.get("agentId") if isinstance(tool_result, dict) else None
                success = tool_result.get("success") if isinstance(tool_result, dict) else None
                background = tool_result.get("background") if isinstance(tool_result, dict) else None
                if not isinstance(agent_id, str) or not agent_id:
                    violations.append({
                        "rule": "EV-004",
                        "line": result_record.get("_line"),
                        "detail": "Skill 起動結果に完全な agentId が無い",
                    })
                elif success is not True or background is not True or result_block.get("is_error") is True:
                    violations.append({
                        "rule": "EV-005",
                        "line": result_record.get("_line"),
                        "detail": "evaluator Skill が background fork として正常起動していない",
                    })
                else:
                    launch["agent_id"] = agent_id
            launch["_index"] = index
            launches.append(launch)

    import_events: list[dict[str, Any]] = []
    stop_events: list[dict[str, Any]] = []
    outer_report_writes: list[dict[str, Any]] = []
    foreground_blocking_waits: list[dict[str, Any]] = []
    notifications: list[dict[str, Any]] = []
    task_output_attempts: list[dict[str, Any]] = []
    resume_runner_events: list[dict[str, Any]] = []
    target_skill_events: list[dict[str, Any]] = []
    upstream_skill_events: list[dict[str, Any]] = []
    agent_events: list[dict[str, Any]] = []

    for index, record in enumerate(records):
        for tool in _tool_uses(record):
            name = tool.get("name")
            inputs = tool.get("input") if isinstance(tool.get("input"), dict) else {}
            event = {
                "line": record.get("_line"),
                "index": index,
                "input": inputs,
                "tool_use_id": tool.get("id"),
            }
            command = inputs.get("command")
            if name == "Bash" and isinstance(command, str) and _is_upsert_mutation(command):
                import_events.append(event)
            if name == "Bash" and isinstance(command, str) and RESUME_RUNNER.search(command):
                resume_runner_events.append(event)
            if name == "Skill" and inputs.get("skill") == TARGET_SKILL:
                target_skill_events.append(event)
            if name == "Skill" and str(inputs.get("skill", "")).startswith("system-spec-harness:"):
                upstream_skill_events.append(event)
            if name == "Agent":
                agent_events.append(event)
            if name == "TaskStop":
                stop_events.append(event)
            if name == "TaskOutput":
                task_output_attempts.append(event)
            target = _write_target(inputs)
            if (
                name in {"Write", "Edit"}
                and isinstance(target, str)
                and Path(target).name in {REPORT_NAME, RESUME_REPORT_NAME}
                and not record.get("isSidechain", False)
            ):
                outer_report_writes.append(event)
            if name == "Bash" and isinstance(command, str) and not inputs.get("run_in_background", False):
                long_sleeps = [
                    float(found.group("seconds"))
                    for found in LONG_SLEEP.finditer(command)
                ]
                if LOOPING_SLEEP.search(command) or any(seconds > 30 for seconds in long_sleeps):
                    foreground_blocking_waits.append(event)

        attachment = record.get("attachment")
        if not isinstance(attachment, dict) or attachment.get("commandMode") != "task-notification":
            continue
        prompt = attachment.get("prompt")
        if not isinstance(prompt, str):
            continue
        notifications.append({
            "line": record.get("_line"),
            "index": index,
            "task_id": _tag(prompt, "task-id"),
            "tool_use_id": _tag(prompt, "tool-use-id"),
            "status": _tag(prompt, "status"),
            "summary": _tag(prompt, "summary"),
            "result": _tag(prompt, "result"),
        })

    resume_mode = resume_report is not None
    if resume_mode:
        violations.extend(_validate_resume_report(resume_report))
        if launches or upstream_skill_events or agent_events:
            violations.append({
                "rule": "EV-020",
                "detail": "resume 経路で evaluator/upstream Skill/Agent が起動された",
            })
        if import_events:
            violations.append({
                "rule": "EV-021",
                "detail": "resume 経路で runner 外の direct upsert-node.py が実行された",
            })
        if len(target_skill_events) != 1 or len(resume_runner_events) != 1:
            violations.append({
                "rule": "EV-022",
                "detail": (
                    "resume 経路は target Skill と deterministic runner を各1回要求する: "
                    f"skill={len(target_skill_events)}, runner={len(resume_runner_events)}"
                ),
            })
        elif _result_json(result_by_use_id.get(str(resume_runner_events[0]["tool_use_id"]))) != resume_report:
            violations.append({
                "rule": "EV-023",
                "line": resume_runner_events[0]["line"],
                "detail": "runner tool_result JSON と resume report が一致しない",
            })
    else:
        if not launches:
            violations.append({"rule": "EV-006", "detail": "evaluator Skill 起動が 0 件"})
        if not import_events:
            violations.append({"rule": "EV-007", "detail": "upsert-node.py による C02 import が 0 件"})

    first_import = min(import_events, key=lambda item: item["index"]) if import_events else None
    for launch in launches:
        agent_id = launch.get("agent_id")
        if not isinstance(agent_id, str):
            continue
        matching = [
            item for item in notifications
            if item["task_id"] == agent_id
            and item["tool_use_id"] == launch["tool_use_id"]
            and item["status"] == "completed"
            and isinstance(item["summary"], str)
            and "Agent" in item["summary"]
            and "finished" in item["summary"]
            and isinstance(item["result"], str)
            and item["result"].strip()
        ]
        if not matching:
            violations.append({
                "rule": "EV-008",
                "line": launch["launch_line"],
                "detail": f"agentId={agent_id} の完了結果つき native task-notification が無い",
            })
            continue
        completion = min(matching, key=lambda item: item["index"])
        launch["completion_line"] = completion["line"]
        launch["_completion_index"] = completion["index"]
        if first_import and completion["index"] >= first_import["index"]:
            violations.append({
                "rule": "EV-009",
                "line": first_import["line"],
                "detail": "evaluator 完了通知より前に C02 import が始まった",
            })

    for event in stop_events:
        if any(launch["_index"] <= event["index"] for launch in launches):
            violations.append({
                "rule": "EV-010",
                "line": event["line"],
                "detail": "evaluator 起動後に TaskStop が使われた",
            })
    for event in outer_report_writes:
        violations.append({
            "rule": "EV-011",
            "line": event["line"],
            "detail": "outer session が completeness-report.json を Write/Edit した",
        })
    for event in foreground_blocking_waits:
        if not any(
            launch["_index"] <= event["index"]
            and event["index"] <= launch.get("_completion_index", len(records))
            for launch in launches
        ):
            continue
        violations.append({
            "rule": "EV-012",
            "line": event["line"],
            "detail": "evaluator 待機中に loop または30秒超の foreground sleep で native notification を塞いだ",
        })

    public_launches = [
        {key: value for key, value in launch.items() if not key.startswith("_")}
        for launch in launches
    ]
    return {
        "status": "PASS" if not violations else "FAIL",
        "mode": "resume-reuse" if resume_mode else "build",
        "evaluator_launches": public_launches,
        "first_import_line": first_import["line"] if first_import else None,
        "task_output_attempts": len(task_output_attempts),
        "task_stop_events": len(stop_events),
        "outer_report_writes": len(outer_report_writes),
        "foreground_blocking_waits": len(foreground_blocking_waits),
        "resume_runner_invocations": len(resume_runner_events),
        "violations": violations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--resume-report", type=Path)
    args = parser.parse_args()
    records, load_violations = _load(args.transcript)
    resume_report: dict[str, Any] | None = None
    if args.resume_report:
        try:
            loaded = json.loads(args.resume_report.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                resume_report = loaded
            else:
                load_violations.append({"rule": "EV-013", "detail": "resume report が object でない"})
                resume_report = {}
        except (OSError, json.JSONDecodeError) as exc:
            load_violations.append({"rule": "EV-013", "detail": f"resume report を読めない: {exc}"})
            resume_report = {}
    report = validate(records, resume_report=resume_report)
    if load_violations:
        report["status"] = "FAIL"
        report["violations"] = load_violations + report["violations"]
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    sys.exit(main())
