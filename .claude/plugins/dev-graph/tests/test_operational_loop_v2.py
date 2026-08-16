from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
import yaml


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def load(script: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def node_fixture(node_id: str = "issue-operational") -> dict:
    now = "2026-07-20T00:00:00Z"
    return {
        "graph_node_id": node_id,
        "artifact_kind": "issue",
        "artifact_subtypes": [],
        "title": "Operational issue",
        "project_id": "project",
        "domain": "runtime",
        "status": "draft",
        "owners": ["team"],
        "tags": ["dev-graph"],
        "priority": None,
        "start_date": None,
        "target_date": None,
        "iteration": None,
        "created_at": now,
        "updated_at": now,
        "depends_on": [],
        "related_nodes": [],
        "resource_scope": ["issues/issue-operational.md"],
        "purpose": None,
        "goal": None,
        "scope_in": [],
        "scope_out": [],
        "acceptance": [],
        "architecture_refs": [],
        "parent_feature": None,
        "feature_package_id": None,
        "phase_ref": None,
        "file_path": "issues/issue-operational.md",
        "template_id": "issue",
        "template_version": "1.0.0",
        "confirmation_status": "draft",
        "evaluation_status": "pending",
        "confirmation_evidence": {
            "evaluator": None,
            "evidence_ref": None,
            "evaluated_digest": None,
        },
        "source_lineage": {
            "origin_kind": "manual",
            "source_plugin": None,
            "source_path": None,
            "source_version": None,
            "source_digest": None,
            "imported_at": None,
        },
        "classification_confidence": 1.0,
        "classification_reason": "explicit operational fixture",
        "classification_candidates": [],
        "github_publication": {
            "mode": "local_only",
            "project_aliases": [],
            "labels": [],
            "milestone": None,
        },
        "issue_linkage": None,
        "tracker_binding": "none",
        "beads_linkage": None,
        "github_project_linkages": [],
        "pull_request_linkages": [],
        "execution_contexts": [],
        "completion_evidence": {
            "policy": "manual",
            "status": "not_applicable",
            "source": None,
            "completed_at": None,
            "reconciled_at": None,
            "evidence_refs": [],
        },
        "implementation_readiness": {
            "status": "incomplete",
            "missing_sections": [],
            "checked_at": None,
        },
    }


def workspace(tmp_path: Path) -> tuple[Path, Path, Path]:
    graph = tmp_path / ".dev-graph" / "state" / "graph.json"
    graph.parent.mkdir(parents=True)
    graph.write_text(json.dumps({"graph_revision": 0, "nodes": []}), encoding="utf-8")
    config = tmp_path / ".dev-graph" / "config.json"
    config.write_text(
        json.dumps({"local_state": {"graph": ".dev-graph/state/graph.json"}}),
        encoding="utf-8",
    )
    input_path = tmp_path / ".dev-graph" / "node-input.json"
    input_path.write_text(
        json.dumps({"node": node_fixture(), "body": "# 概要\n\nAtomic operational fixture."}),
        encoding="utf-8",
    )
    return tmp_path, graph, input_path


def args(root: Path, input_path: Path, *, dry_run: bool = False) -> argparse.Namespace:
    return argparse.Namespace(
        repo_root=str(root), graph=None, input=str(input_path), body_file=None, dry_run=dry_run
    )


def test_node_upsert_is_atomic_idempotent_and_patchable(tmp_path, monkeypatch):
    module = load("upsert-node.py", "upsert_node_operational")
    root, graph, input_path = workspace(tmp_path)

    preview = module._perform(args(root, input_path, dry_run=True))
    assert preview["status"] == "preview" and preview["write_count"] == 0
    assert not (root / "issues" / "issue-operational.md").exists()
    assert json.loads(graph.read_text())["nodes"] == []

    applied = module._perform(args(root, input_path))
    assert applied["operation"] == "added" and applied["write_count"] == 2
    artifact = root / "issues" / "issue-operational.md"
    assert artifact.is_file()
    assert json.loads(graph.read_text())["graph_revision"] == 1

    repeated = module._perform(args(root, input_path))
    assert repeated["operation"] == "noop" and repeated["write_count"] == 0
    assert json.loads(graph.read_text())["graph_revision"] == 1

    input_path.write_text(
        json.dumps(
            {
                "graph_node_id": "issue-operational",
                "patch": {"title": "Updated operational issue"},
            }
        ),
        encoding="utf-8",
    )
    updated = module._perform(args(root, input_path))
    assert updated["operation"] == "updated"
    saved = json.loads(graph.read_text())
    assert saved["graph_revision"] == 2
    assert saved["nodes"][0]["title"] == "Updated operational issue"
    assert "Atomic operational fixture." in artifact.read_text()

    graph_before = graph.read_bytes()
    artifact_before = artifact.read_bytes()
    input_path.write_text(
        json.dumps(
            {
                "graph_node_id": "issue-operational",
                "patch": {"depends_on": ["missing-node"]},
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(module.ContractError, match="proposed graph is invalid"):
        module._perform(args(root, input_path))
    assert graph.read_bytes() == graph_before
    assert artifact.read_bytes() == artifact_before


def architecture_fixture(node_id: str = "ARCH-user-management") -> dict:
    node = node_fixture(node_id)
    node.update(
        {
            "artifact_kind": "architecture",
            "artifact_subtypes": ["backend"],
            "title": "User management architecture",
            "resource_scope": [f"architecture/{node_id}.md"],
            "file_path": f"architecture/{node_id}.md",
            "template_id": "architecture",
        }
    )
    return node


def feature_fixture(node_id: str = "FEAT-user-management") -> dict:
    node = node_fixture(node_id)
    node.update(
        {
            "artifact_kind": "feature",
            "title": "User management feature",
            "resource_scope": [f"features/{node_id}.md"],
            "file_path": f"features/{node_id}.md",
            "template_id": "feature",
            "purpose": "利用者アカウントの一元管理",
            "goal": "登録・認証・権限の3経路を単一 feature で扱う",
            "scope_in": ["登録", "認証"],
            "scope_out": ["課金"],
            "acceptance": ["登録した利用者で認証できる"],
            "architecture_refs": ["ARCH-user-management"],
        }
    )
    return node


def seed_architecture(graph: Path) -> None:
    """feature の architecture_refs が解決できるよう architecture node を先に置く。"""
    saved = json.loads(graph.read_text(encoding="utf-8"))
    saved["nodes"].append(architecture_fixture())
    graph.write_text(json.dumps(saved), encoding="utf-8")


def test_feature_direct_add_is_fail_closed_without_c14_macro_contract(tmp_path):
    """通常 artifact routing での feature 直接 add は拒否される (C14 macro contract 由来のみ受理)。

    2026-07-21 の live-trial (r13) で、lineage が manual/全 null の feature が
    status=applied で登録され features/ に実ファイルが作られる欠陥を検出した回帰テスト。
    """
    module = load("upsert-node.py", "upsert_node_feature_gate")
    root, graph, input_path = workspace(tmp_path)
    seed_architecture(graph)
    graph_before = graph.read_bytes()

    node = feature_fixture()
    assert node["source_lineage"]["origin_kind"] == "manual"
    input_path.write_text(
        json.dumps({"node": node, "body": "# 概要\n\n直接 add された feature。"}),
        encoding="utf-8",
    )

    with pytest.raises(module.ContractError, match="C14"):
        module._perform(args(root, input_path))

    # fail-closed: graph も features/ も一切変化しない
    assert graph.read_bytes() == graph_before
    assert not (root / "features").exists()

    # dry-run でも同じ経路で拒否される (preview だけ通る抜け道を作らない)
    with pytest.raises(module.ContractError, match="C14"):
        module._perform(args(root, input_path, dry_run=True))
    assert graph.read_bytes() == graph_before


def test_feature_from_c14_macro_contract_is_accepted(tmp_path):
    """C14 由来の provenance を持つ feature は従来どおり登録できる (gate が正経路を塞がない)。"""
    module = load("upsert-node.py", "upsert_node_feature_gate_positive")
    root, graph, input_path = workspace(tmp_path)
    seed_architecture(graph)

    spec = root / "specs" / "macro-source.md"
    spec.parent.mkdir(parents=True, exist_ok=True)
    spec.write_text("# マクロ分解の入力仕様\n", encoding="utf-8")
    digest = module._sha256(spec.read_bytes())

    node = feature_fixture()
    node["source_lineage"] = {
        "origin_kind": "generated",
        "source_plugin": "dev-graph",
        "source_path": "specs/macro-source.md",
        "source_version": None,
        "source_digest": digest,
        "imported_at": "2026-07-21T00:00:00Z",
    }
    input_path.write_text(
        json.dumps({"node": node, "body": "# 概要\n\nC14 macro contract 由来の feature。"}),
        encoding="utf-8",
    )

    applied = module._perform(args(root, input_path))
    assert applied["operation"] == "added" and applied["write_count"] == 2
    assert (root / "features" / "FEAT-user-management.md").is_file()
    assert json.loads(graph.read_text())["graph_revision"] == 1


def test_node_rolls_artifact_back_when_graph_commit_fails(tmp_path, monkeypatch):
    module = load("upsert-node.py", "upsert_node_rollback")
    root, graph, input_path = workspace(tmp_path)
    before = graph.read_bytes()

    def fail_graph_write(_path, _value):
        raise OSError("injected graph commit failure")

    monkeypatch.setattr(module, "atomic_json", fail_graph_write)
    with pytest.raises(OSError, match="injected"):
        module._perform(args(root, input_path))
    assert graph.read_bytes() == before
    assert not (root / "issues" / "issue-operational.md").exists()


def test_node_recovers_crash_before_exposing_graph_to_readers(tmp_path):
    root, graph, input_path = workspace(tmp_path)
    environment = os.environ.copy()
    environment["DEV_GRAPH_TEST_INTERRUPT_AFTER_ARTIFACT"] = "1"
    crashed = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "upsert-node.py"),
            "--repo-root",
            str(root),
            "--input",
            str(input_path),
        ],
        text=True,
        capture_output=True,
        env=environment,
        check=False,
    )
    assert crashed.returncode == 99
    journal = graph.with_name(f".{graph.name}.node-transaction.json")
    assert journal.is_file()

    blocked = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "status-graph.py"),
            "--repo-root",
            str(root),
            "--no-eval-log",
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    assert blocked.returncode == 2
    assert "requires recovery" in blocked.stdout

    recovered = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "upsert-node.py"),
            "--repo-root",
            str(root),
            "--input",
            str(input_path),
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    assert recovered.returncode == 0, recovered.stderr
    receipt = json.loads(recovered.stdout)
    assert receipt["recovered_interrupted_transaction"] is True
    assert json.loads(graph.read_text())["nodes"][0]["graph_node_id"] == "issue-operational"
    assert (root / "issues" / "issue-operational.md").is_file()
    assert not journal.exists()


def test_status_and_next_only_write_eval_logs(tmp_path):
    upsert = load("upsert-node.py", "upsert_node_readonly_setup")
    status = load("status-graph.py", "status_graph_operational")
    schedule = load("schedule-graph.py", "schedule_graph_operational")
    root, graph, input_path = workspace(tmp_path)
    upsert._perform(args(root, input_path))
    graph_before = graph.read_bytes()

    status_args = argparse.Namespace(
        repo_root=str(root),
        graph=str(graph),
        id="issue-operational",
        kind=None,
        project=None,
        domain=None,
        status=None,
        tag=[],
        tag_match="all",
        keyword=None,
        eval_log="eval-log/run-dev-graph-status-execution.json",
    )
    report = status._report(status_args)
    assert report["read_only"] is True and report["count"] == 1
    assert report["results"][0]["graph_node_id"] == "issue-operational"
    assert (root / report["eval_log"]).is_file()
    assert graph.read_bytes() == graph_before

    status_args.eval_log = ".dev-graph/state/graph.json"
    with pytest.raises(status.ContractError, match="escapes authority"):
        status._report(status_args)
    assert graph.read_bytes() == graph_before

    leases = root / ".dev-graph" / "leases.json"
    leases.write_text(json.dumps({"leases": []}), encoding="utf-8")
    old_argv = sys.argv
    try:
        sys.argv = [
            str(SCRIPTS / "schedule-graph.py"),
            "--repo-root", str(root), "--graph", str(graph), "--leases", str(leases),
            "--eval-log", ".dev-graph/state/graph.json",
        ]
        with pytest.raises(schedule.ContractError, match="escapes authority"):
            schedule.main()
    finally:
        sys.argv = old_argv
    assert graph.read_bytes() == graph_before

    old_argv = sys.argv
    try:
        sys.argv = [
            str(SCRIPTS / "schedule-graph.py"),
            "--repo-root", str(root), "--graph", str(graph), "--leases", str(leases),
            "--eval-log", "eval-log/run-dev-graph-schedule-execution.json",
        ]
        assert schedule.main() == 0
    finally:
        sys.argv = old_argv
    assert (root / "eval-log" / "run-dev-graph-schedule-execution.json").is_file()
    assert graph.read_bytes() == graph_before


def test_readers_reject_eval_log_symlink_escape_before_writing(tmp_path):
    upsert = load("upsert-node.py", "upsert_node_symlink_setup")
    status = load("status-graph.py", "status_graph_symlink")
    schedule = load("schedule-graph.py", "schedule_graph_symlink")
    root, graph, input_path = workspace(tmp_path / "repo")
    upsert._perform(args(root, input_path))
    outside = tmp_path / "outside"
    outside.mkdir()
    (root / "eval-log").symlink_to(outside, target_is_directory=True)

    status_args = argparse.Namespace(
        repo_root=str(root), graph=str(graph), id=None, kind=None, project=None,
        domain=None, status=None, tag=[], tag_match="all", keyword=None,
        eval_log="eval-log/status.json",
    )
    with pytest.raises(status.ContractError, match="symbolic link"):
        status._report(status_args)

    leases = root / ".dev-graph" / "leases.json"
    leases.write_text(json.dumps({"leases": []}), encoding="utf-8")
    old_argv = sys.argv
    try:
        sys.argv = [
            str(SCRIPTS / "schedule-graph.py"), "--repo-root", str(root),
            "--graph", str(graph), "--leases", str(leases),
            "--eval-log", "eval-log/schedule.json",
        ]
        with pytest.raises(schedule.ContractError, match="symbolic link"):
            schedule.main()
    finally:
        sys.argv = old_argv
    assert list(outside.iterdir()) == []


def test_node_writer_waits_for_whole_reader_operation_lock(tmp_path):
    root, graph, input_path = workspace(tmp_path)
    holder_code = (
        "import sys; from pathlib import Path; "
        f"sys.path.insert(0, {str(SCRIPTS)!r}); "
        "from node_transaction import graph_operation_lock; "
        f"p=Path({str(graph)!r}); "
        "cm=graph_operation_lock(p, exclusive=False); cm.__enter__(); "
        "print('locked', flush=True); input(); cm.__exit__(None,None,None)"
    )
    holder = subprocess.Popen(
        [sys.executable, "-c", holder_code], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    assert holder.stdout is not None and holder.stdout.readline().strip() == "locked"
    writer = subprocess.Popen(
        [sys.executable, str(SCRIPTS / "upsert-node.py"), "--repo-root", str(root), "--input", str(input_path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    time.sleep(0.2)
    assert writer.poll() is None
    assert holder.stdin is not None
    holder.stdin.write("release\n")
    holder.stdin.flush()
    assert holder.wait(timeout=5) == 0
    stdout, stderr = writer.communicate(timeout=10)
    assert writer.returncode == 0, stderr
    assert json.loads(stdout)["operation"] == "added"


def test_next_rejects_missing_explicit_lease_snapshot(tmp_path, monkeypatch):
    schedule = load("schedule-graph.py", "schedule_graph_missing_lease")
    _, graph, _ = workspace(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            str(SCRIPTS / "schedule-graph.py"),
            "--graph",
            str(graph),
            "--leases",
            str(tmp_path / "missing-leases.json"),
        ],
    )
    with pytest.raises(schedule.ContractError, match="does not exist"):
        schedule.main()


def test_next_rejects_noncanonical_lease_in_git_repository(tmp_path, monkeypatch):
    schedule = load("schedule-graph.py", "schedule_graph_lease_authority")
    root, graph, _ = workspace(tmp_path)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    canonical = root / ".git" / "dev-graph" / "leases.json"
    canonical.parent.mkdir(parents=True)
    canonical.write_text(json.dumps({"leases": []}), encoding="utf-8")
    rogue = root / "rogue-leases.json"
    rogue.write_text(json.dumps({"leases": []}), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", [
        str(SCRIPTS / "schedule-graph.py"), "--repo-root", str(root),
        "--graph", str(graph), "--leases", str(rogue),
    ])
    with pytest.raises(schedule.ContractError, match="git-common authority"):
        schedule.main()


def test_public_dispatcher_exposes_full_lifecycle_eleven():
    path = PLUGIN / "commands" / "dev-graph.md"
    text = path.read_text(encoding="utf-8")
    frontmatter = yaml.safe_load(text.split("\n---\n", 1)[0][4:])
    assert frontmatter["argument-hint"] == (
        "<init|spec|decompose|plan|requirements|node|next|worktree|status|sync|render> [args]"
    )
    rows = {
        line.split("|")[2].strip().strip("`")
        for line in text.splitlines()
        if line.startswith("| ")
        and line.count("|") == 6
        and line.split("|")[1].strip().isdigit()
    }
    assert rows == {
        "init", "spec", "decompose", "plan", "requirements",
        "node", "next", "worktree", "status", "sync", "render",
    }
    assert "運用ループ" in text
    assert "`.dev-graph/locks/`は使わない" in text
