"""migrate-pipeline-improvement.py (P08 冪等 migration / design §3.5 §4 §8) の検証。

test-plan.md の MG-I* (冪等) / MG-A* (全件性) / MG-N* (非破壊) を実リポジトリ状態に対して確認する。
migration は既に適用済みのため、再実行が差分 0 に収束することを主に検証する。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "migrate-pipeline-improvement.py"
REPO = Path(__file__).resolve().parents[3]


def _dry_run(repo: Path) -> dict:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(repo), "--dry-run"],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_mg_i01_idempotent_on_real_repo() -> None:
    # 適用済みの実リポジトリでは dry-run が moved 0 / dispositions 0 に収束する
    receipt = _dry_run(REPO)
    assert receipt["moved_count"] == 0
    assert receipt["dispositions_added"] == 0


def test_mg_a03_core_audit_has_31_rows() -> None:
    receipt = _dry_run(REPO)
    assert receipt["core_handoff_audit_count"] == 31
    assert receipt["historical_apply_totals"]["initial_moved_count"] == 49
    assert receipt["historical_apply_totals"]["initial_dispositions_added"] == 123


def test_mg_a04_core_audit_row_shape() -> None:
    receipt = _dry_run(REPO)
    expected_ids = {
        *(f"MM-{index:02d}" for index in range(1, 13)),
        *(f"EV-B{index:02d}" for index in range(1, 11)),
        *(f"EV-{index:03d}" for index in range(1, 10)),
    }
    assert {row["finding_id"] for row in receipt["core_handoff_audit"]} == expected_ids
    for row in receipt["core_handoff_audit"]:
        assert set(row) >= {"handoff", "finding_id", "target_ref", "verified_path", "disposition", "rationale"}
        assert row["disposition"] == "applied"
        assert isinstance(row["verified_path"], str) and (REPO / row["verified_path"]).exists()
        assert row["rationale"].strip()


def test_mg_a02_all_handoffs_have_disposition() -> None:
    # migration 後、fixture 以外の全 handoff item が disposition を持つ
    missing = []
    for path in sorted(REPO.glob("plugin-plans/**/improvement-handoff*.json")):
        rel = str(path.relative_to(REPO))
        if "/fixtures/" in f"/{rel}" or "/finish/" in f"/{rel}":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data.get("schema_version") == "1.1.0", rel
        for key in ("findings", "improvements", "clusters"):
            for item in data.get(key, []) or []:
                if not isinstance(item, dict):
                    continue
                if "disposition" not in item:
                    missing.append(f"{rel}:{item.get('id')}")
    assert not missing, missing


def test_mg_a01_real_repo_has_20_governed_handoffs_and_123_items() -> None:
    governed = []
    item_count = 0
    for path in sorted(REPO.glob("plugin-plans/**/improvement-handoff*.json")):
        rel = str(path.relative_to(REPO))
        if "/fixtures/" in f"/{rel}" or "/finish/" in f"/{rel}":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        governed.append(rel)
        item_count += sum(len(data.get(key, []) or []) for key in ("findings", "improvements", "clusters"))
        assert data.get("schema_version") == "1.1.0"
    assert len(governed) == 20
    assert item_count == 123


def test_mg_a05_core_findings_have_real_applied_refs() -> None:
    receipt = _dry_run(REPO)
    assert all(row["disposition"] == "applied" for row in receipt["core_handoff_audit"])
    assert all((REPO / row["verified_path"]).exists() for row in receipt["core_handoff_audit"])


def test_mg_i02_i03_n01_two_apply_runs_converge_without_content_loss(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "-C", str(repo), "init", "-q"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.com"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "test"], check=True)
    source = repo / "eval-log/example.json"
    source.parent.mkdir(parents=True)
    source.write_text('{"result":"stable"}\n', encoding="utf-8")
    handoff = repo / "plugin-plans/sample/improvement-handoff.json"
    handoff.parent.mkdir(parents=True)
    original = {"id": "F-1", "severity": "high", "summary": "preserve me", "recommendation": "fix"}
    handoff.write_text(json.dumps({"schema_version": "1.0.0", "findings": [original]}), encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "eval-log/example.json", "plugin-plans"], check=True)

    command = [sys.executable, str(SCRIPT), "--repo-root", str(repo), "--apply"]
    first = subprocess.run(command, capture_output=True, text=True, check=False)
    assert first.returncode == 0, first.stderr
    first_receipt = json.loads(first.stdout)
    assert first_receipt["moved_count"] == 1 and first_receipt["dispositions_added"] == 1
    after_first = {
        path.relative_to(repo).as_posix(): path.read_bytes()
        for path in repo.rglob("*") if path.is_file() and ".git" not in path.parts
    }

    second = subprocess.run(command, capture_output=True, text=True, check=False)
    assert second.returncode == 0, second.stderr
    second_receipt = json.loads(second.stdout)
    assert second_receipt["moved_count"] == 0 and second_receipt["dispositions_added"] == 0
    after_second = {
        path.relative_to(repo).as_posix(): path.read_bytes()
        for path in repo.rglob("*") if path.is_file() and ".git" not in path.parts
    }
    assert after_second == after_first
    migrated = json.loads(handoff.read_text(encoding="utf-8"))["findings"][0]
    assert {key: migrated[key] for key in original} == original


def test_mg_n02_n03_evidence_refs_pass_and_generation_paths_are_not_moved() -> None:
    validator = REPO / "plugins/dev-graph/scripts/validate-evidence-refs.py"
    proc = subprocess.run(
        [sys.executable, str(validator), "--repo-root", str(REPO)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stdout
    receipt = _dry_run(REPO)
    assert all(not item["from"].startswith(".dev-graph/plans/generations/") for item in receipt["moved"])
