#!/usr/bin/env python3
# /// script
# name: validate-system-spec-resume
# purpose: Validate a digest-bound system-spec-harness PASS bundle before cached C19 import.
# inputs: [argv --repo-root PATH]
# outputs: [stdout JSON receipt, exit 0 valid / 2 invalid]
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python = ">=3.11"
# ///
"""Fail closed unless a pre-confirmed system-spec bundle is current and complete."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
HARNESS_ROOT = PLUGIN_ROOT.parent / "system-spec-harness"
IMPORT_CONTRACT_PATH = PLUGIN_ROOT / "references" / "system-spec-import-contract.json"
RECEIPT_SCHEMA = (
    HARNESS_ROOT
    / "skills"
    / "assign-system-spec-completeness-evaluator"
    / "schemas"
    / "resume-receipt.schema.json"
)
REQUIRED_ENTRY_POINTS = {
    "run-system-spec-elicit",
    "run-system-spec-doc-fetch",
    "run-system-spec-compile",
    "assign-system-spec-completeness-evaluator",
}
REQUIRED_ARTIFACT_ROLES = {"index", "requirements", "completeness"}
REQUIRED_GATES = {"coverage", "source_citation", "evaluator"}
RECEIPT_FIELDS = {
    "schema_version", "producer", "verdict", "gates", "artifacts", "evaluator", "created_at"
}
PRODUCER_FIELDS = {"plugin", "version", "entry_point"}
EVALUATOR_FIELDS = {"report_path", "report_sha256", "fork_ledger_path", "session_id"}
GATE_RESULT_IDS = {"coverage": "G-matrix", "source_citation": "G-source-citation"}
SUPPORTED_VERSION_MIN = (0, 1, 0)
SUPPORTED_VERSION_MAX = (1, 0, 0)
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$")
AGGREGATE = (
    HARNESS_ROOT
    / "skills"
    / "assign-system-spec-completeness-evaluator"
    / "scripts"
    / "aggregate-completeness.py"
)
COVERAGE = HARNESS_ROOT / "scripts" / "validate-coverage-matrix.py"
SOURCE_CITATION = HARNESS_ROOT / "scripts" / "validate-source-citation.py"


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained_file(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"artifact escapes repo root: {relative}") from exc
    if not path.is_file():
        raise ValueError(f"artifact is missing: {relative}")
    return path


def supported_version(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    match = SEMVER.fullmatch(value)
    if not match:
        return False
    parsed = tuple(int(part) for part in match.groups())
    return SUPPORTED_VERSION_MIN <= parsed < SUPPORTED_VERSION_MAX


def valid_datetime(value: Any) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def receipt_artifact_contract() -> tuple[set[str], str, str]:
    """Load gate input paths from the evaluator-owned public schema."""
    schema = load_json(RECEIPT_SCHEMA)
    properties = schema.get("properties")
    artifacts_schema = properties.get("artifacts") if isinstance(properties, dict) else None
    required = artifacts_schema.get("required") if isinstance(artifacts_schema, dict) else None
    if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
        raise ValueError("resume receipt schema lacks artifacts.required")
    by_name = {Path(item).name: item for item in required}
    try:
        return set(required), by_name["spec-state.json"], by_name["fetched-references.json"]
    except KeyError as exc:
        raise ValueError(f"resume receipt schema lacks gate artifact: {exc}") from exc


def validate(root: Path) -> dict[str, Any]:
    root = root.resolve(strict=True)
    import_contract = load_json(IMPORT_CONTRACT_PATH)
    receipt_artifacts, state_relative, references_relative = receipt_artifact_contract()
    artifact_paths = import_contract.get("artifacts")
    if (
        not isinstance(artifact_paths, dict)
        or set(artifact_paths) != REQUIRED_ARTIFACT_ROLES
        or any(not isinstance(value, str) or not value for value in artifact_paths.values())
    ):
        raise ValueError("system-spec import contract artifact roles are invalid")
    required_artifacts = receipt_artifacts
    if not set(artifact_paths.values()).issubset(required_artifacts):
        raise ValueError("resume receipt schema omits import contract artifacts")
    receipt_relative = str(Path(artifact_paths["index"]).parent / "resume-receipt.json")
    receipt_path = contained_file(root, receipt_relative)
    receipt = load_json(receipt_path)
    manifest = load_json(HARNESS_ROOT / ".claude-plugin" / "plugin.json")
    package = load_json(HARNESS_ROOT / "references" / "package-contract.json")
    declared = set(package.get("entry_points", {}).get("skills", []))

    failures: list[str] = []
    if set(receipt) != RECEIPT_FIELDS:
        failures.append("receipt-field-set-invalid")
    if not valid_datetime(receipt.get("created_at")):
        failures.append("receipt-created-at-invalid")
    if manifest.get("name") != "system-spec-harness":
        failures.append("plugin-name-mismatch")
    if not supported_version(manifest.get("version")):
        failures.append("plugin-version-unsupported")
    missing_entry_points = sorted(REQUIRED_ENTRY_POINTS - declared)
    if missing_entry_points:
        failures.append("entry-points-missing:" + ",".join(missing_entry_points))
    producer = receipt.get("producer")
    if not isinstance(producer, dict):
        failures.append("producer-missing")
    else:
        if set(producer) != PRODUCER_FIELDS:
            failures.append("producer-field-set-invalid")
        if producer.get("plugin") != manifest.get("name"):
            failures.append("producer-plugin-mismatch")
        if producer.get("version") != manifest.get("version"):
            failures.append("producer-version-stale")
        if producer.get("entry_point") != "assign-system-spec-completeness-evaluator":
            failures.append("producer-entry-point-invalid")
    if receipt.get("schema_version") != "1.1":
        failures.append("receipt-schema-version-invalid")
    if receipt.get("verdict") != "PASS":
        failures.append("receipt-verdict-not-pass")

    gates = receipt.get("gates")
    if not isinstance(gates, dict) or set(gates) != REQUIRED_GATES:
        failures.append("gate-set-invalid")
    elif any(gates[name] != "PASS" for name in REQUIRED_GATES):
        failures.append("gate-not-pass")

    artifacts = receipt.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != required_artifacts:
        failures.append("artifact-set-invalid")
    else:
        for relative in sorted(required_artifacts):
            try:
                actual = sha256(contained_file(root, relative))
            except ValueError as exc:
                failures.append(str(exc))
                continue
            if artifacts.get(relative) != actual:
                failures.append(f"artifact-digest-stale:{relative}")

    try:
        report_path = contained_file(root, artifact_paths["completeness"])
        report = load_json(report_path)
        if report.get("verdict") != "PASS":
            failures.append("completeness-verdict-not-pass")
        gate_results = report.get("gate_results")
        by_id = {
            item.get("id"): item
            for item in gate_results
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        } if isinstance(gate_results, list) else {}
        for gate_name, gate_id in GATE_RESULT_IDS.items():
            result = by_id.get(gate_id)
            if not isinstance(result, dict) or result.get("exit_code") != 0:
                failures.append(f"report-gate-not-pass:{gate_name}")

        evaluator = receipt.get("evaluator")
        if not isinstance(evaluator, dict):
            failures.append("evaluator-binding-missing")
        else:
            if set(evaluator) != EVALUATOR_FIELDS:
                failures.append("evaluator-field-set-invalid")
            expected_report = artifact_paths["completeness"]
            if evaluator.get("report_path") != expected_report:
                failures.append("evaluator-report-path-mismatch")
            if evaluator.get("report_sha256") != sha256(report_path):
                failures.append("evaluator-report-digest-stale")
            ledger_relative = evaluator.get("fork_ledger_path")
            session_id = evaluator.get("session_id")
            if not isinstance(ledger_relative, str) or not ledger_relative:
                failures.append("evaluator-ledger-path-missing")
            elif not isinstance(session_id, str) or not session_id or session_id == "unknown":
                failures.append("evaluator-session-invalid")
            else:
                ledger_path = contained_file(root, ledger_relative)
                process = subprocess.run(
                    [
                        sys.executable,
                        str(AGGREGATE),
                        "--report",
                        str(report_path),
                        "--fork-ledger",
                        str(ledger_path),
                        "--session",
                        session_id,
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if process.returncode != 0:
                    failures.append("evaluator-report-or-ledger-invalid")

        state_path = contained_file(root, state_relative)
        references_path = contained_file(root, references_relative)
        coverage = subprocess.run(
            [
                sys.executable,
                str(COVERAGE),
                "--matrix",
                str(state_path),
                "--require-complete",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if coverage.returncode != 0:
            failures.append("coverage-gate-invalid")
        source_citation = subprocess.run(
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
            capture_output=True,
            text=True,
            check=False,
        )
        if source_citation.returncode != 0:
            failures.append("source-citation-gate-invalid")
        requirements = contained_file(
            root, artifact_paths["requirements"]
        ).read_text(encoding="utf-8")
        if not requirements.startswith("---\n") or "\nstatus: confirmed\n" not in requirements:
            failures.append("requirements-not-confirmed")
    except ValueError as exc:
        failures.append(str(exc))

    return {
        "validator": "validate-system-spec-resume",
        "valid": not failures,
        "mode": "reuse-confirmed",
        "plugin_version": manifest.get("version"),
        "required_entry_points": sorted(REQUIRED_ENTRY_POINTS),
        "artifacts": sorted(required_artifacts),
        "failures": failures,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--repo-root", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        report = validate(args.repo_root)
    except (OSError, ValueError) as exc:
        report = {
            "validator": "validate-system-spec-resume",
            "valid": False,
            "mode": "reuse-confirmed",
            "failures": [str(exc)],
        }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["valid"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
