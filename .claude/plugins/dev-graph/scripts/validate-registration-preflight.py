#!/usr/bin/env python3
"""Validate the cross-plugin preflight for the planner handoff contract."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from _common import ContractError, load_json


def _json_object(path: Path) -> dict[str, Any]:
    value = load_json(path)
    if not isinstance(value, dict):
        raise ContractError(f"JSON object required: {path}")
    return value


def _schema_version(schema: dict[str, Any], name: str) -> str:
    value = (((schema.get("properties") or {}).get("schema_version") or {}).get("const"))
    if not isinstance(value, str):
        raise ContractError(f"{name} does not pin properties.schema_version.const")
    return value


def preflight_contract(
    system_root: Path,
    required_version: str,
    required_schema_version: str,
) -> dict[str, Any]:
    root = system_root.resolve(strict=True)
    manifest = _json_object(root / ".claude-plugin" / "plugin.json")
    if manifest.get("name") != "system-dev-planner":
        raise ContractError("unexpected upstream plugin name")
    if manifest.get("version") != required_version:
        raise ContractError(
            "system-dev-planner version mismatch: "
            f"expected {required_version}, got {manifest.get('version')}"
        )
    package_contract = _json_object(root / "references" / "package-contract.json")
    if package_contract.get("plugin_name") != "system-dev-planner":
        raise ContractError("system-dev-planner package contract identity mismatch")
    entry_points = package_contract.get("entry_points")
    if not isinstance(entry_points, dict):
        raise ContractError("system-dev-planner package contract entry_points missing")
    required = {
        "skills": ["run-system-dev-plan", "assign-system-dev-plan-evaluator"],
        "agents": [
            "system-dev-plan-elicitor",
            "system-dev-plan-architect",
            "system-dev-plan-evaluator",
        ],
        "commands": ["system-dev-plan"],
    }
    suffixes = {"skills": "SKILL.md", "agents": ".md", "commands": ".md"}
    for kind, names in required.items():
        declared = entry_points.get(kind)
        if not isinstance(declared, list) or not set(names).issubset(set(declared)):
            missing = sorted(set(names) - set(declared or []))
            raise ContractError(f"missing required {kind} entrypoints: {missing}")
        for name in names:
            physical = (
                root / kind / name / suffixes[kind]
                if kind == "skills"
                else root / kind / f"{name}{suffixes[kind]}"
            )
            if not physical.is_file():
                raise ContractError(f"declared entrypoint is missing: {physical}")
    schemas = {}
    for filename in (
        "feature-execution-package.schema.json",
        "dev-graph-registration.schema.json",
    ):
        schema = _json_object(root / "schemas" / filename)
        version = _schema_version(schema, filename)
        if version != required_schema_version:
            raise ContractError(
                f"{filename} version mismatch: "
                f"expected {required_schema_version}, got {version}"
            )
        schemas[filename] = version
    for filename in ("validate-system-plan.py", "promote-system-plan.py"):
        if not (root / "scripts" / filename).is_file():
            raise ContractError(f"required upstream script missing: {filename}")
    return {
        "valid": True,
        "plugin": "system-dev-planner",
        "version": required_version,
        "entrypoint_source": "references/package-contract.json",
        "schema_versions": schemas,
        "required_entrypoints": required,
    }
