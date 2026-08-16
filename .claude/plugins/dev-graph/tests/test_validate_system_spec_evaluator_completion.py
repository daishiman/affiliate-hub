"""C19 evaluator の native completion / import 順序 gate を固定する。"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPT = PLUGIN / "scripts" / "validate-system-spec-evaluator-completion.py"


def _skill_launch() -> dict:
    return {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_eval",
            "name": "Skill",
            "input": {
                "skill": "system-spec-harness:assign-system-spec-completeness-evaluator",
                "args": "--spec-dir system-spec --output system-spec/completeness-report.json",
            },
        }]},
    }


def _skill_result() -> dict:
    return {
        "type": "user",
        "message": {"content": [{
            "type": "tool_result",
            "tool_use_id": "toolu_eval",
            "content": "launched",
        }]},
        "toolUseResult": {
            "success": True,
            "background": True,
            "agentId": "agent-full-id-123",
        },
    }


def _completion() -> dict:
    return {
        "type": "attachment",
        "attachment": {
            "type": "queued_command",
            "commandMode": "task-notification",
            "prompt": (
                "<task-notification>\n"
                "<task-id>agent-full-id-123</task-id>\n"
                "<tool-use-id>toolu_eval</tool-use-id>\n"
                "<status>completed</status>\n"
                "<summary>Agent evaluator finished</summary>\n"
                "<result>PASS report written by evaluator</result>\n"
                "</task-notification>"
            ),
        },
    }


def _import() -> dict:
    return {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_import",
            "name": "Bash",
            "input": {"command": "python3 plugins/dev-graph/scripts/upsert-node.py --input node.json"},
        }]},
    }


def _resume_report() -> dict:
    labels = [
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
    ]
    return {
        "runner": "build-system-spec-resume-import",
        "mode": "reuse-confirmed",
        "status": "PASS",
        "completion_contract": {"version": "system-spec-resume-closure/v1"},
        "network_calls": 0,
        "upstream_skill_invocations": 0,
        "registered_this_run": ["arch-system-spec-overview", "spec-system-spec-index"],
        "resume": {"valid": True},
        "checklist": [{"id": "closure", "status": "pass", "evidence": "all gates exit 0"}],
        "steps": [{"label": label, "exit_code": 0} for label in labels],
    }


def _target_skill() -> dict:
    return {
        "type": "assistant",
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_target",
            "name": "Skill",
            "input": {"skill": "dev-graph:run-dev-graph-system-spec", "args": "--resume"},
        }]},
    }


def _resume_runner(report: dict) -> list[dict]:
    return [
        {
            "type": "assistant",
            "message": {"content": [{
                "type": "tool_use",
                "id": "toolu_runner",
                "name": "Bash",
                "input": {"command": "python3 plugins/dev-graph/scripts/build-system-spec-resume-import.py --repo-root fixture"},
            }]},
        },
        {
            "type": "user",
            "message": {"content": [{
                "type": "tool_result",
                "tool_use_id": "toolu_runner",
                "content": json.dumps(report),
            }]},
            "toolUseResult": {"stdout": json.dumps(report)},
        },
    ]


def _run(
    tmp_path: Path, records: list[dict], *, resume_report: dict | None = None
) -> tuple[int, dict]:
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )
    command = [sys.executable, str(SCRIPT), "--transcript", str(transcript)]
    if resume_report is not None:
        report_path = tmp_path / "run-dev-graph-system-spec-resume-report.json"
        report_path.write_text(json.dumps(resume_report), encoding="utf-8")
        command.extend(["--resume-report", str(report_path)])
    proc = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode, json.loads(proc.stdout)


def test_matching_native_completion_before_import_passes(tmp_path: Path) -> None:
    code, report = _run(tmp_path, [_skill_launch(), _skill_result(), _completion(), _import()])
    assert code == 0
    assert report["status"] == "PASS"
    assert report["evaluator_launches"][0]["agent_id"] == "agent-full-id-123"
    assert report["evaluator_launches"][0]["completion_line"] == 3
    assert report["first_import_line"] == 4


def test_import_before_completion_fails_closed(tmp_path: Path) -> None:
    code, report = _run(tmp_path, [_skill_launch(), _skill_result(), _import(), _completion()])
    assert code == 2
    assert "EV-009" in {item["rule"] for item in report["violations"]}


def test_short_or_unrelated_notification_does_not_prove_completion(tmp_path: Path) -> None:
    completion = _completion()
    completion["attachment"]["prompt"] = completion["attachment"]["prompt"].replace(
        "agent-full-id-123", "agent-short"
    )
    code, report = _run(tmp_path, [_skill_launch(), _skill_result(), completion, _import()])
    assert code == 2
    assert "EV-008" in {item["rule"] for item in report["violations"]}


def test_task_stop_and_outer_report_write_are_rejected(tmp_path: Path) -> None:
    stop = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_stop",
            "name": "TaskStop",
            "input": {"task_id": "agent-full-id-123"},
        }]},
    }
    write = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_write",
            "name": "Write",
            "input": {"file_path": "system-spec/completeness-report.json", "content": "{}"},
        }]},
    }
    code, report = _run(
        tmp_path,
        [_skill_launch(), _skill_result(), stop, write, _completion(), _import()],
    )
    assert code == 2
    rules = {item["rule"] for item in report["violations"]}
    assert {"EV-010", "EV-011"} <= rules


def test_foreground_looping_wait_is_rejected(tmp_path: Path) -> None:
    wait = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_wait",
            "name": "Bash",
            "input": {
                "command": "until [ -f /tmp/never ]; do sleep 30; done",
                "timeout": 600000,
            },
        }]},
    }
    code, report = _run(
        tmp_path,
        [_skill_launch(), _skill_result(), wait, _completion(), _import()],
    )
    assert code == 2
    assert "EV-012" in {item["rule"] for item in report["violations"]}


def test_short_finite_or_background_wait_does_not_block_notification(tmp_path: Path) -> None:
    short_wait = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_short_wait",
            "name": "Bash",
            "input": {"command": "sleep 30"},
        }]},
    }
    background_wait = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_bg_wait",
            "name": "Bash",
            "input": {
                "command": "until [ -f /tmp/report ]; do sleep 30; done",
                "run_in_background": True,
            },
        }]},
    }
    code, report = _run(
        tmp_path,
        [_skill_launch(), _skill_result(), short_wait, background_wait, _completion(), _import()],
    )
    assert code == 0
    assert report["foreground_blocking_waits"] == 0


def test_upsert_help_before_completion_is_not_a_mutation(tmp_path: Path) -> None:
    help_call = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_help",
            "name": "Bash",
            "input": {"command": "python3 plugins/dev-graph/scripts/upsert-node.py --help"},
        }]},
    }
    code, report = _run(
        tmp_path,
        [_skill_launch(), _skill_result(), help_call, _completion(), _import()],
    )
    assert code == 0
    assert report["first_import_line"] == 5


def test_resume_report_closes_without_evaluator_or_direct_upsert(tmp_path: Path) -> None:
    resume = _resume_report()
    records = [_target_skill(), *_resume_runner(resume)]
    code, report = _run(tmp_path, records, resume_report=resume)
    assert code == 0, report
    assert report["status"] == "PASS"
    assert report["mode"] == "resume-reuse"
    assert report["evaluator_launches"] == []
    assert report["first_import_line"] is None
    assert report["resume_runner_invocations"] == 1


def test_resume_report_rejects_missing_step_and_stdout_mismatch(tmp_path: Path) -> None:
    report_file = _resume_report()
    report_file["steps"] = report_file["steps"][:-1]
    runner_stdout = _resume_report()
    records = [_target_skill(), *_resume_runner(runner_stdout)]
    code, result = _run(tmp_path, records, resume_report=report_file)
    assert code == 2
    rules = {item["rule"] for item in result["violations"]}
    assert {"EV-017", "EV-023"} <= rules


def test_status_content_may_cite_completeness_report_without_being_a_write(tmp_path: Path) -> None:
    resume = _resume_report()
    status_write = {
        "type": "assistant",
        "isSidechain": False,
        "message": {"content": [{
            "type": "tool_use",
            "id": "toolu_status",
            "name": "Write",
            "input": {
                "file_path": "out/status.json",
                "content": '{"evidence_ref":"system-spec/completeness-report.json"}',
            },
        }]},
    }
    records = [_target_skill(), *_resume_runner(resume), status_write]
    code, result = _run(tmp_path, records, resume_report=resume)
    assert code == 0, result
    assert result["outer_report_writes"] == 0


def test_resume_path_rejects_upstream_skill_agent_and_direct_upsert(tmp_path: Path) -> None:
    resume = _resume_report()
    agent = {
        "type": "assistant",
        "message": {"content": [{
            "type": "tool_use", "id": "toolu_agent", "name": "Agent", "input": {}
        }]},
    }
    records = [
        _target_skill(),
        _skill_launch(),
        agent,
        *_resume_runner(resume),
        _import(),
    ]
    code, result = _run(tmp_path, records, resume_report=resume)
    assert code == 2
    rules = {item["rule"] for item in result["violations"]}
    assert {"EV-020", "EV-021"} <= rules
