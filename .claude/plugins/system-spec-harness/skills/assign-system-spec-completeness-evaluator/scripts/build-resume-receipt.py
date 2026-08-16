#!/usr/bin/env python3
# /// script
# name: build-resume-receipt
# version: 0.1.0
# purpose: Build a digest-bound C19 resume receipt only after the canonical evaluator report and fork ledger pass validation.
# inputs: [argv --repo-root --report --fork-ledger --session --output]
# outputs: [system-spec/resume-receipt.json, stdout JSON]
# contexts: [E]
# network: false
# write-scope: caller-repo/system-spec/resume-receipt.json
# dependencies: [aggregate-completeness.py]
# requires-python = ">=3.11"
# ///
"""Materialize the production resume receipt owned by the completeness evaluator."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
PLUGIN_ROOT = SCRIPT_DIR.parents[2]
MANIFEST = PLUGIN_ROOT / ".claude-plugin" / "plugin.json"
AGGREGATE = SCRIPT_DIR / "aggregate-completeness.py"
RECEIPT_SCHEMA = SCRIPT_DIR.parent / "schemas" / "resume-receipt.schema.json"
GATE_IDS = {"coverage": "G-matrix", "source_citation": "G-source-citation"}
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$")
COVERAGE = PLUGIN_ROOT / "scripts" / "validate-coverage-matrix.py"
SOURCE_CITATION = PLUGIN_ROOT / "scripts" / "validate-source-citation.py"


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def contained(root: Path, value: Path, *, must_exist: bool) -> Path:
    candidate = value if value.is_absolute() else root / value
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"path escapes repo root: {value}") from exc
    if must_exist and not candidate.is_file():
        raise ValueError(f"file is missing: {candidate}")
    return candidate


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def supported_version(value: Any) -> bool:
    match = SEMVER.fullmatch(value) if isinstance(value, str) else None
    if not match:
        return False
    version = tuple(int(part) for part in match.groups())
    return (0, 1, 0) <= version < (1, 0, 0)


def receipt_contract() -> tuple[set[str], Path, Path, Path]:
    """Read canonical artifact paths from the public receipt schema SSOT."""
    schema = load_json(RECEIPT_SCHEMA)
    properties = schema.get("properties")
    artifacts_schema = properties.get("artifacts") if isinstance(properties, dict) else None
    evaluator_schema = properties.get("evaluator") if isinstance(properties, dict) else None
    required = artifacts_schema.get("required") if isinstance(artifacts_schema, dict) else None
    evaluator_properties = (
        evaluator_schema.get("properties") if isinstance(evaluator_schema, dict) else None
    )
    report_value = (
        evaluator_properties.get("report_path", {}).get("const")
        if isinstance(evaluator_properties, dict) else None
    )
    if (
        not isinstance(required, list)
        or not all(isinstance(item, str) and item for item in required)
        or not isinstance(report_value, str)
    ):
        raise ValueError("resume receipt schema lacks canonical artifact paths")
    by_name = {Path(item).name: Path(item) for item in required}
    try:
        return set(required), Path(report_value), by_name["spec-state.json"], by_name["fetched-references.json"]
    except KeyError as exc:
        raise ValueError(f"resume receipt schema lacks gate artifact: {exc}") from exc


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def checked_gate(command: list[str], *, label: str) -> None:
    process = subprocess.run(command, capture_output=True, text=True, check=False)
    if process.returncode != 0:
        raise ValueError(f"{label} failed: {process.stderr or process.stdout}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--report", type=Path, help="canonical completeness report (schema default)")
    parser.add_argument("--fork-ledger", default="eval-log/system-spec-harness/audit-fork-ledger.jsonl", type=Path)
    parser.add_argument("--session", required=True)
    parser.add_argument("--output", type=Path, help="canonical sibling resume receipt (schema default)")
    args = parser.parse_args(argv)
    try:
        root = args.repo_root.resolve(strict=True)
        artifacts_required, canonical_report, state_relative, references_relative = receipt_contract()
        canonical_output = canonical_report.with_name("resume-receipt.json")
        report_arg = args.report or canonical_report
        output_arg = args.output or canonical_output
        report_path = contained(root, report_arg, must_exist=True)
        ledger_path = contained(root, args.fork_ledger, must_exist=True)
        output_path = contained(root, output_arg, must_exist=False)
        if report_path != (root / canonical_report).resolve():
            raise ValueError(f"--report must be the canonical path: {canonical_report}")
        if output_path != (root / canonical_output).resolve():
            raise ValueError(f"--output must be the canonical path: {canonical_output}")
        if args.session == "unknown" or not args.session.strip():
            raise ValueError("a concrete evaluator session is required")

        manifest = load_json(MANIFEST)
        version = manifest.get("version")
        if manifest.get("name") != "system-spec-harness" or not supported_version(version):
            raise ValueError("system-spec-harness manifest name/version is unsupported")

        process = subprocess.run(
            [
                sys.executable,
                str(AGGREGATE),
                "--report",
                str(report_path),
                "--fork-ledger",
                str(ledger_path),
                "--session",
                args.session,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if process.returncode != 0:
            raise ValueError(f"canonical evaluator validation failed: {process.stderr or process.stdout}")

        state_path = contained(root, state_relative, must_exist=True)
        references_path = contained(root, references_relative, must_exist=True)
        checked_gate(
            [
                sys.executable,
                str(COVERAGE),
                "--matrix",
                str(state_path),
                "--require-complete",
            ],
            label="G-matrix",
        )
        checked_gate(
            [
                sys.executable,
                str(SOURCE_CITATION),
                "--targets",
                str(state_path),
                "--references",
                str(references_path),
                "--state",
                str(state_path),
                "--repo-root",
                str(root),
            ],
            label="G-source-citation",
        )

        report = load_json(report_path)
        if report.get("verdict") != "PASS":
            raise ValueError("only a canonical PASS evaluator report can produce a resume receipt")
        gate_results = report.get("gate_results")
        by_id = {
            item.get("id"): item
            for item in gate_results
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        } if isinstance(gate_results, list) else {}
        for gate_id in GATE_IDS.values():
            if not isinstance(by_id.get(gate_id), dict) or by_id[gate_id].get("exit_code") != 0:
                raise ValueError(f"canonical evaluator report lacks passing gate: {gate_id}")

        artifacts = {}
        for relative in sorted(artifacts_required):
            artifacts[relative] = digest(contained(root, Path(relative), must_exist=True))
        receipt = {
            "schema_version": "1.1",
            "producer": {
                "plugin": "system-spec-harness",
                "version": version,
                "entry_point": "assign-system-spec-completeness-evaluator",
            },
            "verdict": "PASS",
            "gates": {"coverage": "PASS", "source_citation": "PASS", "evaluator": "PASS"},
            "artifacts": artifacts,
            "evaluator": {
                "report_path": report_path.relative_to(root).as_posix(),
                "report_sha256": digest(report_path),
                "fork_ledger_path": ledger_path.relative_to(root).as_posix(),
                "session_id": args.session,
            },
            "created_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        }
        atomic_json(output_path, receipt)
        print(json.dumps({"status": "PASS", "output": output_path.relative_to(root).as_posix(), "receipt_sha256": digest(output_path)}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
