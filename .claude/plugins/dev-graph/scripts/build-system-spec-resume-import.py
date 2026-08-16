#!/usr/bin/env python3
# /// script
# name: build-system-spec-resume-import
# purpose: Execute C19's deterministic cached PASS validation and C02 import path.
# inputs: [argv --repo-root PATH]
# outputs: [graph nodes, eval-log goal/progress/intermediate/import receipts, stdout JSON]
# contexts: [E]
# network: false
# write-scope: caller-repo graph/specs/architecture/eval-log/.dev-graph/tmp
# dependencies: [resolve-repo-context.py, validate-system-spec-resume.py, validate-system-spec-boundary.py, build-system-spec-import.py, upsert-node.py, validate-graph-schema.py, validate-source-digest.py, validate-evidence-refs.py]
# requires-python = ">=3.11"
# ///
"""Run the no-network, no-LLM C19 resume path as one reproducible command."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
SKILL = "run-dev-graph-system-spec"
ORIGINAL_GOAL = (
    "仕様書・アーキテクチャをplugins/system-spec-harness/の正規フローで構築し、"
    "出典・確定状態・上位目的traceを保ったままdev-graphのspecification/architecture"
    "ノードへ取り込んだ状態になっている"
)
COMPLETION_CONTRACT = {
    "version": "system-spec-resume-closure/v1",
    "path": "resume-reuse",
    "authority": "digest-bound-resume-receipt",
    "evaluator_execution": "reused-current-pass",
    "import_writer": "C02",
}


class RunFailure(Exception):
    pass


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(
    command: list[str], *, label: str, input_text: str | None = None
) -> dict[str, Any]:
    proc = subprocess.run(
        command, input=input_text, capture_output=True, text=True, check=False
    )
    record = {
        "label": label,
        "command": command,
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }
    if proc.returncode != 0:
        raise RunFailure(f"{label} failed ({proc.returncode}): {proc.stderr or proc.stdout}")
    return record


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained_file(root: Path, value: Any, *, label: str) -> Path:
    if not isinstance(value, str) or not value:
        raise RunFailure(f"{label} must be a non-empty repository-relative path")
    path = (root / value).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise RunFailure(f"{label} escapes the repository: {value}") from exc
    if not path.is_file():
        raise RunFailure(f"{label} is missing: {value}")
    return path


def validate_import_bindings(root: Path, nodes: list[dict[str, Any]]) -> dict[str, Any]:
    """Validate generated source/evidence bindings before the first graph write."""
    checked: list[str] = []
    for node in nodes:
        node_id = str(node.get("graph_node_id") or "?")
        lineage = node.get("source_lineage")
        evidence = node.get("confirmation_evidence")
        if not isinstance(lineage, dict) or not isinstance(evidence, dict):
            raise RunFailure(f"{node_id} lacks source_lineage or confirmation_evidence")
        source = contained_file(root, lineage.get("source_path"), label=f"{node_id}.source_path")
        if lineage.get("source_digest") != sha256(source):
            raise RunFailure(f"{node_id} source digest does not match source bytes")
        receipt = contained_file(root, evidence.get("evidence_ref"), label=f"{node_id}.evidence_ref")
        if evidence.get("evaluated_digest") != sha256(receipt):
            raise RunFailure(f"{node_id} evidence digest does not match evidence bytes")
        checked.append(node_id)
    return {"valid": True, "checked": checked}


def proposed_graph(graph_path: Path, generated: list[dict[str, Any]]) -> dict[str, Any]:
    document = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = document.get("nodes")
    if not isinstance(nodes, list):
        raise RunFailure("canonical graph lacks nodes[]")
    replacements = {str(node["graph_node_id"]): node for node in generated}
    merged = [
        replacements.pop(str(node.get("graph_node_id")), node)
        if isinstance(node, dict) else node
        for node in nodes
    ]
    merged.extend(replacements.values())
    return {**document, "nodes": merged}


def append_intermediate(path: Path, value: dict[str, Any]) -> None:
    """Preserve the append-only goal-seek history and reject cross-goal reuse."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                previous = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RunFailure(f"intermediate JSONL line {number} is invalid: {exc}") from exc
            if previous.get("original_goal") not in (None, ORIGINAL_GOAL):
                raise RunFailure("intermediate history belongs to a different original goal")
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")


def parse_stdout(record: dict[str, Any]) -> dict[str, Any]:
    try:
        value = json.loads(record["stdout"])
    except json.JSONDecodeError as exc:
        raise RunFailure(f"{record['label']} did not emit JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise RunFailure(f"{record['label']} JSON object required")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo-root", required=True, type=Path)
    args = parser.parse_args(argv)
    root = args.repo_root.resolve()
    eval_root = root / "eval-log"
    import_dir = root / ".dev-graph" / "tmp" / "system-spec-import"
    graph = root / ".dev-graph" / "state" / "graph.json"
    progress_path = eval_root / f"{SKILL}-progress.json"
    steps: list[dict[str, Any]] = []
    try:
        context_step = run(
            [sys.executable, str(HERE / "resolve-repo-context.py"),
             "--repo-root", str(root), "--mode", "write"],
            label="resolve-context",
        )
        steps.append(context_step)
        context = parse_stdout(context_step)
        if Path(context.get("repo_root", "")).resolve() != root:
            raise RunFailure("resolved repo_root does not match requested root")
        write_json(eval_root / f"{SKILL}-receipt.json", context)

        resume_step = run(
            [sys.executable, str(HERE / "validate-system-spec-resume.py"),
             "--repo-root", str(root)],
            label="validate-resume",
        )
        steps.append(resume_step)
        resume = parse_stdout(resume_step)

        build_step = run(
            [sys.executable, str(HERE / "build-system-spec-import.py"),
             "--repo-root", str(root), "--out-dir", str(import_dir)],
            label="build-import",
        )
        steps.append(build_step)
        build = parse_stdout(build_step)

        generated = [
            json.loads((import_dir / f"{name}.node.json").read_text(encoding="utf-8"))
            for name in ("architecture", "specification")
        ]
        registered = [str(node["graph_node_id"]) for node in generated]
        goal_hash = hashlib.sha256(ORIGINAL_GOAL.encode("utf-8")).hexdigest()
        write_json(eval_root / f"{SKILL}-goal-spec.json", {
            "original_goal": ORIGINAL_GOAL,
            "mode": "reuse-confirmed",
        })
        write_json(progress_path, {
            "mode": "reuse-confirmed",
            "status": "preflight",
            "registered_this_run": registered,
            "resume_receipt_valid": resume["valid"],
        })

        # All gates that can reject the generated import run before C02 mutates
        # the canonical graph.  A rejected preview therefore leaves revision and
        # artifacts untouched instead of producing a partial import.
        boundary_step = run(
            [sys.executable, str(HERE / "validate-system-spec-boundary.py")],
            label="gate-boundary",
        )
        steps.append(boundary_step)
        binding_result = validate_import_bindings(root, generated)
        steps.append({
            "label": "gate-source-and-evidence-bindings",
            "command": ["internal:validate-import-bindings"],
            "exit_code": 0,
            "stdout": json.dumps(binding_result),
            "stderr": "",
        })
        preview = proposed_graph(graph, generated)
        preview_path = import_dir / "preflight.graph.json"
        write_json(preview_path, preview)
        preview_step = run(
            [sys.executable, str(HERE / "validate-graph-schema.py"),
             "--repo-root", str(root), "--graph", "-", "--require-canonical-envelope"],
            label="gate-graph-preview",
            input_text=json.dumps(preview, ensure_ascii=False),
        )
        steps.append(preview_step)
        for name in ("architecture", "specification"):
            dry_run_step = run(
                [sys.executable, str(HERE / "upsert-node.py"),
                 "--repo-root", str(root),
                 "--graph", str(preview_path),
                 "--input", str(import_dir / f"{name}.node.json"),
                 "--body-file", str(import_dir / f"{name}.body.md"),
                 "--dry-run"],
                label=f"c02-dry-run-{name}",
            )
            steps.append(dry_run_step)

        for name, expected_id in zip(
            ("architecture", "specification"), registered, strict=True
        ):
            upsert_step = run(
                [sys.executable, str(HERE / "upsert-node.py"),
                 "--repo-root", str(root),
                 "--input", str(import_dir / f"{name}.node.json"),
                 "--body-file", str(import_dir / f"{name}.body.md")],
                label=f"c02-upsert-{name}",
            )
            steps.append(upsert_step)
            if str(parse_stdout(upsert_step)["graph_node_id"]) != expected_id:
                raise RunFailure(f"c02-upsert-{name} returned an unexpected graph node id")

        evidence_step = run(
            [sys.executable, str(HERE / "validate-evidence-refs.py"),
             "--repo-root", str(root), "--progress", str(progress_path)],
            label="gate-evidence-refs",
        )
        steps.append(evidence_step)
        digest_step = run(
            [sys.executable, str(HERE / "validate-source-digest.py"),
             "--repo-root", str(root), "--progress", str(progress_path)],
            label="gate-source-digest",
        )
        steps.append(digest_step)

        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        progress["status"] = "complete"
        progress["gate_exit_codes"] = {step["label"]: step["exit_code"] for step in steps}
        progress["checklist"] = [
            {"id": "content-root", "status": "pass", "evidence": "resolve-context exit 0"},
            {"id": "harness-contract", "status": "pass", "evidence": "validate-resume exit 0"},
            {"id": "upstream-selection", "status": "pass", "evidence": "current receipt reused; upstream Skill count 0"},
            {"id": "upstream-gates", "status": "pass", "evidence": "digest-bound evaluator/coverage/source gates current"},
            {"id": "live-trial-outer-closure", "status": "pending-external", "evidence": "post-run transcript gate validates this runner report"},
            {"id": "c02-node-integrity", "status": "pass", "evidence": "C02 dry-run and upsert steps exit 0"},
            {"id": "source-digest", "status": "pass", "evidence": "gate-source-digest exit 0"},
            {"id": "evidence-refs", "status": "pass", "evidence": "gate-evidence-refs exit 0"},
            {"id": "logic-boundary", "status": "pass", "evidence": "gate-boundary exit 0"},
        ]
        write_json(progress_path, progress)
        intermediate = {
            "original_goal": ORIGINAL_GOAL,
            "original_goal_hash": goal_hash,
            "current_goal_snapshot": "digest-bound PASS bundle imported through C02",
            "delta_from_original": "none",
            "merged_directive_for_next": "stop: all gates passed",
            "drift_signal": False,
        }
        inter_path = eval_root / f"{SKILL}-intermediate.jsonl"
        append_intermediate(inter_path, intermediate)

        checklist = [
            {"id": "context", "status": "pass", "evidence": "resolve-context exit 0"},
            {"id": "resume-authority", "status": "pass", "evidence": "validate-resume valid=true"},
            {"id": "no-upstream-regeneration", "status": "pass", "evidence": "network and upstream Skill counts are 0"},
            {"id": "logic-boundary", "status": "pass", "evidence": "gate-boundary exit 0"},
            {"id": "c02-import", "status": "pass", "evidence": "two dry-runs and two upserts exit 0"},
            {"id": "lineage-evidence", "status": "pass", "evidence": "source digest and evidence refs gates exit 0"},
        ]
        report = {
            "runner": "build-system-spec-resume-import",
            "mode": "reuse-confirmed",
            "status": "PASS",
            "completion_contract": COMPLETION_CONTRACT,
            "network_calls": 0,
            "upstream_skill_invocations": 0,
            "registered_this_run": registered,
            "checklist": checklist,
            "resume": resume,
            "build": build,
            "steps": [{"label": step["label"], "exit_code": step["exit_code"]} for step in steps],
        }
        write_json(eval_root / f"{SKILL}-resume-report.json", report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (OSError, KeyError, RunFailure, json.JSONDecodeError) as exc:
        print(json.dumps({
            "runner": "build-system-spec-resume-import",
            "mode": "reuse-confirmed",
            "status": "FAIL",
            "error": str(exc),
            "steps": [{"label": step["label"], "exit_code": step["exit_code"]} for step in steps],
        }, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
