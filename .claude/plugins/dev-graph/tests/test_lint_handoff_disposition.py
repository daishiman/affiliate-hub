"""lint-handoff-disposition.py (qa-067 要件3 / design §4) の検証。

test-plan.md の HD-D* (MUST_DETECT) / HD-P* (MUST_PASS) を実行する。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "lint-handoff-disposition.py"
GLOB = "plugin-plans/**/improvement-handoff*.json"


def _write(root: Path, rel: str, data: dict) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _run(root: Path) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--glob", GLOB],
        capture_output=True, text=True, check=False,
    )
    return proc.returncode, json.loads(proc.stdout)


def _finding(**over) -> dict:
    base = {
        "id": "F-1", "severity": "high", "summary": "s",
        "disposition": "applied",
        "disposition_ref": "plugins/dev-graph/scripts/lint-handoff-disposition.py",
        "disposition_recorded_at": "2026-07-22T00:00:00Z",
    }
    base.update(over)
    return base


def _handoff(findings, **over) -> dict:
    base = {"schema_version": "1.1.0", "findings": findings}
    base.update(over)
    return base


# --- MUST_DETECT ---

def test_hd_d01_schema_1_0_0(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           {"schema_version": "1.0.0", "findings": [{"id": "x", "severity": "low", "summary": "s"}]})
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-001" for v in out["violations"])


def test_hd_d02_missing_schema_version(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json", {"findings": [_finding()]})
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-001" for v in out["violations"])


def test_hd_d03_schema_version_spoof_missing_disposition(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           {"schema_version": "1.1.0", "findings": [{"id": "x", "severity": "low", "summary": "s"}]})
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-002" for v in out["violations"])


def test_hd_d04_disposition_enum(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition="wontfix")]))
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-002" for v in out["violations"])


def test_hd_d05_empty_ref(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition_ref="  ")]))
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-003" for v in out["violations"])


def test_hd_d06_nonexistent_path_ref(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition_ref="does/not/exist.py")]))
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-004" for v in out["violations"])


def test_hd_d07_bad_timestamp(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition_recorded_at="yesterday")]))
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-005" for v in out["violations"])


def test_hd_improvements_array_checked(tmp_path: Path) -> None:
    # improvements[] も検査対象 (design §4 R4)
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           {"schema_version": "1.1.0", "improvements": [{"id": "i", "severity": "low", "summary": "s"}]})
    code, out = _run(tmp_path)
    assert code == 2 and any(v["rule"] == "HD-002" for v in out["violations"])


# --- MUST_PASS ---

def test_hd_p01_complete_disposition(tmp_path: Path) -> None:
    (tmp_path / "real.py").write_text("x", encoding="utf-8")
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition_ref="real.py")]))
    code, out = _run(tmp_path)
    assert code == 0 and out["violation_count"] == 0


def test_hd_p02_bd_ref_not_checked(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition="deferred", disposition_ref="bd:HarnessHub-k2u")]))
    code, out = _run(tmp_path)
    assert code == 0


def test_hd_p03_empty_findings_ok(tmp_path: Path) -> None:
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           {"schema_version": "1.1.0", "findings": []})
    code, out = _run(tmp_path)
    assert code == 0


def test_hd_p04_path_anchor_checks_path_part(tmp_path: Path) -> None:
    (tmp_path / "real.md").write_text("# Anchor\n", encoding="utf-8")
    _write(tmp_path, "plugin-plans/a/improvement-handoff.json",
           _handoff([_finding(disposition_ref="real.md#anchor")]))
    code, out = _run(tmp_path)
    assert code == 0, out


def test_hd_fixture_excluded(tmp_path: Path) -> None:
    # /fixtures/ 配下は検査対象外
    _write(tmp_path, "plugin-plans/finish/x/fixtures/improvement-handoff.json",
           {"schema_version": "1.0.0", "source_kind": "x"})
    code, out = _run(tmp_path)
    assert code == 0
    assert out["excluded_fixtures"]


def test_hd_p05_real_repo_exit_zero() -> None:
    repo = Path(__file__).resolve().parents[3]
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(repo)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stdout[-2000:]


def test_hd_c01_c02_c03_canonical_schema_contract() -> None:
    repo = Path(__file__).resolve().parents[3]
    path = repo / "plugins/plugin-dev-planner/skills/run-plugin-dev-plan/schemas/improvement-handoff.schema.json"
    schema = json.loads(path.read_text(encoding="utf-8"))
    branch = next(item for item in schema["allOf"] if item.get("if", {}).get("properties", {}).get("schema_version", {}).get("const") == "1.1.0")
    required = set(branch["then"]["properties"]["findings"]["items"]["required"])
    assert {"disposition", "disposition_ref", "disposition_recorded_at"} <= required
    properties = set(schema["properties"]["findings"]["items"]["properties"])
    assert {"id", "severity", "summary", "recommendation", "target_ref"} <= properties
    try:
        import jsonschema
    except ImportError:
        pytest.skip("jsonschema is not installed")
    jsonschema.Draft7Validator.check_schema(schema)
