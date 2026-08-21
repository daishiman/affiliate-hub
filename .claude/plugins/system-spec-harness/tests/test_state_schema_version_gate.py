"""The matrix validator's schema-version constant is actually read and judged.

`CURRENT_STATE_SCHEMA_VERSION` sat in validate-coverage-matrix.py as a definition that
no code path ever read. A state naming a version the validator had no rules for still
came out green, so raising the version was enough to walk past the checks.

これらのテストは 2 方向から押さえる:
  - 未知の版は緑にしない (版を上げるだけで素通りできない)
  - 最新版を名乗るなら schema が要求する節を持つ (定数を上げるだけの変更を落とす)
片方だけだと抜けられる。定数を最新へ上げれば 1 つ目は満たせるが、2 つ目は
schema 側の required を引いているので中身が伴わない state で赤くなる。
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "validate-coverage-matrix.py"
PLATFORMS = [
    "web",
    "mobile",
    "tablet",
    "desktop-windows",
    "desktop-linux",
    "desktop-macos",
]
CATEGORIES = [
    "database",
    "auth",
    "ui-ux",
    "security",
    "infrastructure",
    "backend",
    "frontend",
    "maintenance-ops",
]


def _load_validator():
    spec = importlib.util.spec_from_file_location("validate_version_gate", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


validator = _load_validator()


def _state(version: str) -> dict:
    return {
        "schema_version": version,
        "design_application_contract_version": "1.0",
        "categories": [{"id": category, "label": category} for category in CATEGORIES],
        "platforms": PLATFORMS,
        "matrix": {
            category: {
                platform: {"state": "確定", "qa_ref": "qa-001"}
                for platform in PLATFORMS
            }
            for category in CATEGORIES
        },
        "qa_log": [{
            "id": "qa-001",
            "question": "q",
            "answer": "a",
            "design_applications": [{
                "knowledge_ref": "ddd.md#Bounded Context",
                "principle": "Bounded Context",
                "applicability": "applied",
                "rationale": "単一境界として管理する",
                "tradeoffs": ["境界分割が必要になれば再評価する"],
            }],
        }],
        "approval_log": [],
    }


def _current_state() -> dict:
    state = _state(validator.CURRENT_STATE_SCHEMA_VERSION)
    for key in validator._current_version_required_sections():
        state[key] = {} if key in ("lifecycle", "implementation_snapshot") else []
    return state


def test_current_version_state_with_its_sections_is_accepted() -> None:
    assert validator.validate(_current_state(), require_complete=True) == []


def test_version_bump_without_the_sections_is_rejected() -> None:
    """定数を上げるだけの変更はここで落ちる。"""
    required = validator._current_version_required_sections()
    assert required, "最新版が要求する節が schema から 1 つも読めていない"
    for key in required:
        state = _current_state()
        state.pop(key)
        findings = validator.validate(state, require_complete=True)
        assert any(key in finding for finding in findings), key


def test_unknown_version_is_not_silently_green() -> None:
    findings = validator.validate(_state("9.9"), require_complete=True)
    assert any("schema_version" in finding for finding in findings)


def test_supported_versions_do_not_trigger_the_version_finding() -> None:
    """0 件を主張する側が動いていることを、当たる例と当たらない例の対で示す。"""
    supported = validator.validate(
        _state(validator.INTERMEDIATE_STATE_SCHEMA_VERSION), require_complete=True
    )
    assert supported == []
    assert validator.CURRENT_STATE_SCHEMA_VERSION in validator.SUPPORTED_STATE_SCHEMA_VERSIONS


def test_required_sections_come_from_the_schema_not_a_copy() -> None:
    """一覧を検証器側へ書き写すと片方だけ古くなるので、schema を正本にしている。"""
    schema = json.loads(validator.STATE_SCHEMA_PATH.read_text(encoding="utf-8"))
    branch = next(
        b
        for b in schema["oneOf"]
        if b.get("properties", {}).get("schema_version", {}).get("const")
        == validator.CURRENT_STATE_SCHEMA_VERSION
    )
    assert set(validator._current_version_required_sections()) <= set(branch["required"])


def test_missing_schema_file_is_a_finding_not_a_pass() -> None:
    # state を先に組んでから schema を隠す。組み立て側も schema を読むので、
    # 隠したあとに組むと fixture が落ちて、検証本体の fail-closed 経路を通らない。
    state = _current_state()
    original = validator.STATE_SCHEMA_PATH
    validator.STATE_SCHEMA_PATH = original.parent / "does-not-exist.json"
    try:
        findings = validator.validate(state, require_complete=True)
        assert any("schema を参照できない" in finding for finding in findings)
    finally:
        validator.STATE_SCHEMA_PATH = original
