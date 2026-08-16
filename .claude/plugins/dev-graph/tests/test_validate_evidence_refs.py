"""validate-evidence-refs.py (R3-import の dangling 決定論ゲート) の検証。"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "validate-evidence-refs.py"


def run(root: Path, registered: str = "") -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--registered", registered],
        capture_output=True, text=True, check=False,
    )


def build_repo(tmp_path: Path, nodes: list[dict]) -> Path:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8"
    )
    return root


def node(node_id: str, ref: str | None) -> dict:
    base: dict = {"graph_node_id": node_id}
    if ref is not None:
        base["confirmation_evidence"] = {"evidence_ref": ref}
    return base


def test_registered_dangling_fails_closed(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("N1", "evidence/missing.json")])
    proc = run(root, registered="N1")
    assert proc.returncode == 2
    assert json.loads(proc.stdout)["registered_dangling"][0]["graph_node_id"] == "N1"


def test_existing_dangling_is_reported_but_not_fatal(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("OLD", "evidence/missing.json"), node("N1", "ok.json")])
    (root / "ok.json").write_text("{}", encoding="utf-8")
    proc = run(root, registered="N1")
    assert proc.returncode == 0
    payload = json.loads(proc.stdout)
    assert payload["registered_dangling"] == []
    assert payload["existing_dangling"] == [
        {"graph_node_id": "OLD", "evidence_ref": "evidence/missing.json"}
    ]


def test_all_resolvable_is_clean(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("N1", "ok.json"), node("N2", None)])
    (root / "ok.json").write_text("{}", encoding="utf-8")
    proc = run(root, registered="N1")
    assert proc.returncode == 0
    payload = json.loads(proc.stdout)
    assert payload["existing_dangling"] == [] and payload["scanned_nodes_with_evidence"] == 1


def run_with_progress(root: Path, progress: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--progress", str(progress)],
        capture_output=True, text=True, check=False,
    )


def test_progress_supplies_registered_and_fails_closed(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("N1", "evidence/missing.json")])
    progress = root / "progress.json"
    progress.write_text(json.dumps({"registered_this_run": ["N1"]}), encoding="utf-8")
    proc = run_with_progress(root, progress)
    assert proc.returncode == 2  # progress 由来の registered が fail-closed を発火


def test_progress_autotranscribes_existing_dangling(tmp_path: Path) -> None:
    root = build_repo(tmp_path, [node("OLD", "evidence/missing.json"), node("N1", "ok.json")])
    (root / "ok.json").write_text("{}", encoding="utf-8")
    progress = root / "progress.json"
    progress.write_text(json.dumps({"registered_this_run": ["N1"]}), encoding="utf-8")
    proc = run_with_progress(root, progress)
    assert proc.returncode == 0  # 既存 dangling は fatal でない
    written = json.loads(progress.read_text(encoding="utf-8"))
    # LLM でなく script が progress へ自動転記していることを検証
    assert written["evidence_ref_audit"]["existing_dangling"] == [
        {"graph_node_id": "OLD", "evidence_ref": "evidence/missing.json"}
    ]
