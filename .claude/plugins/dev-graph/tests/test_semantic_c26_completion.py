from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from test_operational_loop_v2 import args as upsert_args
from test_operational_loop_v2 import node_fixture, workspace

PLUGIN = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN / "scripts"
sys.path.insert(0, str(SCRIPTS))


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    code = module.main()
    output = capsys.readouterr().out.strip()
    return code, json.loads(output) if output else None


def markdown(node_id: str, *, status: str = "active", phase: str | None = None, evidence: str = "evidence/run.json") -> str:
    phase_line = f'phase_ref: "{phase}"\n' if phase else ""
    # node_fixture() の source_lineage.origin_kind は "manual" のため、C11 は base
    # required_sections (13 見出し) をそのまま要求する (HarnessHub-yzv0)。
    # "## Verification and evidence" 以降は既存テストが split で切り出す境界なので、
    # 他見出しはその手前にまとめて置く。_validate_task_artifact の _section() は
    # ("Verification and evidence", "検証方法") を同義語として扱い先に一致した方を採用する
    # ため、"## 検証方法" にも同一の検証手順文言を複製する (中身が空だと placeholder_only_section
    # で C11 に落ち、内容が食い違うと lifecycle 系テストの evidence 参照突合が壊れる)。
    verification_body = f"- Automated commands: `python3 -m pytest`\n- Required evidence: {evidence}\n"
    return (
        "---\n"
        f'graph_node_id: "{node_id}"\n'
        f'status: "{status}"\n'
        f"{phase_line}"
        "---\n"
        "# Task\n\n"
        "## 目的\n\n検証用の実文。\n\n"
        "## 背景\n\n検証用の実文。\n\n"
        "## 入力と前提条件\n\n検証用の実文。\n\n"
        "## 出力と成果物\n\n検証用の実文。\n\n"
        "## 依存関係\n\n検証用の実文。\n\n"
        "## 実装対象\n\n検証用の実文。\n\n"
        "## Write scope と競合制約\n\n検証用の実文。\n\n"
        "## GitHub publication\n\n検証用の実文。\n\n"
        "## 実行手順\n\n検証用の実文。\n\n"
        "## 受入条件\n\n検証用の実文。\n\n"
        f"## 検証方法\n\n{verification_body}\n"
        "## リスクとロールバック\n\n検証用の実文。\n\n"
        "## Handoff\n\n検証用の実文。\n\n"
        "## Verification and evidence\n\n"
        f"{verification_body}"
    )


def facts(node_id: str = "G", *, closing: list[dict] | None = None) -> dict:
    return {
        "repository": "o/r",
        "default_branch": {"name": "main", "oid": "1" * 40},
        "pull_request": {
            "number": 1,
            "state": "MERGED",
            "merged": True,
            "mergedAt": "2026-01-01T00:00:00Z",
            "mergeCommit": {"oid": "2" * 40},
            "baseRefName": "main",
            "headRefName": "devgraph/G",
            "url": "https://example.test/o/r/pull/1",
            "body": f"Implements task\n\ndev-graph: {node_id}\n",
            "closingIssuesReferences": closing or [],
        },
    }


def git_context(monkeypatch, module, common: Path) -> None:
    monkeypatch.setattr(module, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""))
    monkeypatch.setattr(module, "c24_context", lambda root, resolver: {
        "repo_root": str(root),
        "repository_id": "github:o/r",
        "git_common_dir": str(common),
        "branch": "main",
        "head_sha": "1" * 40,
        "coordination_paths": {"root": str(common / "dev-graph")},
    })


def lifecycle_workspace(tmp_path: Path) -> tuple[Path, Path, Path]:
    root, graph, input_path = workspace(tmp_path)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    node = node_fixture("G")
    node.update(
        {
            "artifact_kind": "task",
            "title": "Lifecycle task",
            "status": "active",
            "file_path": "tasks/G.md",
            "resource_scope": ["tasks/G.md"],
            "template_id": "task",
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "confirmation_evidence": {
                "evaluator": "test",
                "evidence_ref": "eval-log/test.json",
                "evaluated_digest": "a" * 64,
            },
            "implementation_readiness": {
                "status": "complete",
                "missing_sections": [],
                "checked_at": "2026-01-01T00:00:00Z",
            },
            "completion_evidence": {
                "policy": "linked_pr_merged_all",
                "status": "in_progress",
                "source": None,
                "completed_at": None,
                "reconciled_at": None,
                "evidence_refs": [],
            },
        }
    )
    input_path.write_text(
        json.dumps(
            {
                "node": node,
                "body": markdown("G", evidence="evidence/run.json").split("---\n", 2)[-1],
            }
        ),
        encoding="utf-8",
    )
    upsert = load(SCRIPTS / "upsert-node.py", f"seed_lifecycle_{id(tmp_path)}")
    upsert._perform(upsert_args(root, input_path))
    return root, graph, root / "tasks" / "G.md"


def lifecycle_request(graph: Path, artifact: Path) -> dict:
    saved = json.loads(graph.read_text(encoding="utf-8"))
    completion = {
        "policy": "linked_pr_merged_all",
        "status": "done",
        "source": "github_pr_merge",
        "completed_at": "2026-01-01T00:00:00Z",
        "reconciled_at": "2026-01-01T00:00:01Z",
        "evidence_refs": ["https://example.test/o/r/pull/1"],
    }
    linkages = [
        {
            "repo": "o/r",
            "pr_number": 1,
            "url": "https://example.test/o/r/pull/1",
            "base_branch": "main",
            "head_branch": "devgraph/G",
            "state": "merged",
            "merged_at": "2026-01-01T00:00:00Z",
            "merge_commit_sha": "2" * 40,
            "linked_at": "2026-01-01T00:00:01Z",
            "closing_reference_verified": True,
        }
    ]
    request = {
        "schema_version": "1.1",
        "owner": "C02/run-dev-graph-node",
        "operation": "apply-lifecycle-request",
        "event_key": "o/r#task:G#policy:test",
        "status": "pending",
        "graph_path": ".dev-graph/state/graph.json",
        "graph_revision_before": saved["graph_revision"],
        "graph_sha256_before": hashlib.sha256(graph.read_bytes()).hexdigest(),
        "task_patch": {
            "graph_node_id": "G",
            "file_path": "tasks/G.md",
            "artifact_sha256_before": hashlib.sha256(artifact.read_bytes()).hexdigest(),
            "set": {
                "status": "done",
                "updated_at": "2026-01-01T00:00:01Z",
                "completion_evidence": completion,
                "pull_request_linkages": linkages,
            },
        },
        "feature_patch": None,
    }
    request["request_digest"] = hashlib.sha256(
        json.dumps(
            request,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    return request


def test_c12_lifecycle_facts_returns_default_oid_and_exact_pr_snapshot(monkeypatch):
    module = load(SCRIPTS / "gh-bridge.py", "c12_lifecycle_facts")
    monkeypatch.setattr(module, "graphql", lambda query, variables: {"data": {"repository": {
        "nameWithOwner": "o/r",
        "defaultBranchRef": {"name": "main", "target": {"oid": "1" * 40}},
        "pullRequest": {
            "number": 7, "state": "MERGED", "merged": True, "mergedAt": "2026-01-01T00:00:00Z",
            "mergeCommit": {"oid": "2" * 40}, "baseRefName": "main", "headRefName": "devgraph/G",
            "url": "https://example.test/o/r/pull/7", "body": "dev-graph: G",
            "closingIssuesReferences": {"nodes": [{"number": 9, "repository": {"nameWithOwner": "o/r"}}]},
        },
    }}})
    result = module.lifecycle_facts("o/r", 7)
    assert result["default_branch"] == {"name": "main", "oid": "1" * 40}
    assert result["pull_request"]["closingIssuesReferences"] == [{"number": 9, "repository": "o/r"}]
    assert module.retry_classification("lifecycle-facts") == "safe_read"


def test_c26_consumes_c24_canonical_repository_context(tmp_path, monkeypatch):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_c24_context")
    common = tmp_path / ".git"
    receipt = {
        "repo_root": str(tmp_path),
        "repository_id": "github:o/r",
        "git_common_dir": str(common),
        "branch": "main",
        "head_sha": "1" * 40,
        "coordination_paths": {"root": str(common / "dev-graph")},
    }
    monkeypatch.setattr(module, "_invoke_json", lambda *args: dict(receipt))
    assert module.c24_context(tmp_path, SCRIPTS / "resolve-repo-context.py")["repository_id"] == "github:o/r"
    monkeypatch.setattr(module, "_invoke_json", lambda *args: {**receipt, "repository_id": "repo_legacy"})
    with pytest.raises(module.ContractError, match="non-canonical"):
        module.c24_context(tmp_path, SCRIPTS / "resolve-repo-context.py")

    monkeypatch.setattr(module, "_invoke_json", lambda *args: {**receipt, "branch": None})
    assert module.c24_context(tmp_path, SCRIPTS / "resolve-repo-context.py")["branch"] is None

    without_branch = {key: value for key, value in receipt.items() if key != "branch"}
    monkeypatch.setattr(module, "_invoke_json", lambda *args: without_branch)
    with pytest.raises(module.ContractError, match="omits required identity"):
        module.c24_context(tmp_path, SCRIPTS / "resolve-repo-context.py")

    monkeypatch.setattr(module, "_invoke_json", lambda *args: {**receipt, "branch": ""})
    with pytest.raises(module.ContractError, match="invalid branch state"):
        module.c24_context(tmp_path, SCRIPTS / "resolve-repo-context.py")


def test_c26_detached_check_reports_pending_without_identity_failure(tmp_path, monkeypatch, capsys):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_detached_check")
    common = tmp_path / "common"
    common.mkdir()
    monkeypatch.setattr(
        module,
        "c24_context",
        lambda root, resolver: {
            "repo_root": str(root),
            "repository_id": "github:o/r",
            "git_common_dir": str(common),
            "branch": None,
            "head_sha": "1" * 40,
            "coordination_paths": {"root": str(common / "dev-graph")},
        },
    )
    monkeypatch.setattr(
        module,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""),
    )
    monkeypatch.setattr(module, "c12_lifecycle_facts", lambda *args: facts())
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    (tasks / "G.md").write_text(markdown("G"), encoding="utf-8")
    graph = tmp_path / "graph.json"
    graph.write_text(
        json.dumps(
            {
                "graph_revision": 1,
                "nodes": [
                    {
                        "graph_node_id": "G",
                        "artifact_kind": "task",
                        "status": "active",
                        "tracker_binding": "none",
                        "file_path": "tasks/G.md",
                        "pull_request_linkages": [],
                        "completion_evidence": {
                            "policy": "linked_pr_merged_all",
                            "status": "in_progress",
                            "evidence_refs": [],
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    code, result = call_main(
        module,
        monkeypatch,
        capsys,
        "--repo-root",
        tmp_path,
        "--graph",
        graph,
        "--graph-node-id",
        "G",
        "--repo",
        "o/r",
        "--pr",
        "1",
        "--mode",
        "check",
    )

    assert code == 1
    assert result["policy_decision"] == "pending"
    assert result["worktree_decision"]["branch"] is None
    assert result["required_pr_decisions"][0]["linkage"]["marker_verified"] is True
    assert result["conflicts"] == [
        "worktree is not clean and synchronized on the remote default branch"
    ]


def test_c26_requires_unique_marker_and_exact_bound_issue_closing_reference(tmp_path, monkeypatch):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_linkage")
    node = {"graph_node_id": "G", "tracker_binding": "github", "issue_linkage": {"repo": "o/r", "issue_number": 9}}
    pr = facts(closing=[{"number": 9, "repository": "o/r"}])["pull_request"]
    assert module._linkage_decision(node, "o/r", pr)["eligible"] is True
    assert module._linkage_decision(node, "o/r", {**pr, "body": "dev-graph: G\ndev-graph: G\n"})["marker_verified"] is False
    wrong = {**pr, "closingIssuesReferences": [{"number": 9, "repository": "someone/else"}]}
    assert module._linkage_decision(node, "o/r", wrong)["closing_reference_verified"] is False

    beads_node = {"graph_node_id": "G", "tracker_binding": "beads", "beads_linkage": {"bd_issue_id": "B1"}}
    monkeypatch.setattr(
        module,
        "_invoke_json",
        lambda *args: (_ for _ in ()).throw(module.ContractError("C28 gh:pr gate check failed (1): gh:pr gate does not exist")),
    )
    assert module._beads_gate_verified(tmp_path, tmp_path / "bridge.py", beads_node, 1) is False


def test_c26_writer_consumer_cli_route_creates_receipt(tmp_path):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_consumer")
    request = tmp_path / "request.json"
    receipt = tmp_path / "receipt.json"
    request.write_text('{"request_digest":"abc"}', encoding="utf-8")
    consumer = tmp_path / "consumer.py"
    consumer.write_text(
        "import argparse,json\n"
        "p=argparse.ArgumentParser();p.add_argument('--operation');p.add_argument('--request');p.add_argument('--receipt');a=p.parse_args()\n"
        "open(a.receipt,'w').write(json.dumps({'owner':'C02/run-dev-graph-node','operation':a.operation,'status':'applied'}))\n"
        "print(json.dumps({'ok':True,'operation':a.operation}))\n",
        encoding="utf-8",
    )
    module._consume_writer(tmp_path, consumer, request, receipt)
    value = json.loads(receipt.read_text(encoding="utf-8"))
    assert value["owner"] == "C02/run-dev-graph-node"
    assert value["operation"] == "apply-lifecycle-request"


def test_c02_apply_lifecycle_request_is_typed_and_crash_retry_idempotent(
    tmp_path, monkeypatch, capsys
):
    root, graph, artifact = lifecycle_workspace(tmp_path)
    module = load(SCRIPTS / "upsert-node.py", "c02_lifecycle_consumer")
    coordination = root / ".git" / "dev-graph" / "completion-receipts"
    coordination.mkdir(parents=True)
    request_path = coordination / "request.json"
    receipt_path = coordination / "receipt.json"
    request_path.write_text(
        json.dumps(lifecycle_request(graph, artifact)),
        encoding="utf-8",
    )

    code, receipt = call_main(
        module,
        monkeypatch,
        capsys,
        "--repo-root",
        root,
        "--operation",
        "apply-lifecycle-request",
        "--request",
        request_path,
        "--receipt",
        receipt_path,
    )
    assert code == 0
    assert receipt["owner"] == "C02/run-dev-graph-node"
    assert receipt["operation"] == "apply-lifecycle-request"
    assert receipt["status"] == "applied"
    assert receipt["graph_revision_after"] == 2
    saved = json.loads(graph.read_text(encoding="utf-8"))
    assert saved["nodes"][0]["status"] == "done"
    assert saved["nodes"][0]["completion_evidence"]["status"] == "done"
    assert '"done"' in artifact.read_text(encoding="utf-8")

    receipt_path.unlink()
    code, repeated = call_main(
        module,
        monkeypatch,
        capsys,
        "--repo-root",
        root,
        "--operation",
        "apply-lifecycle-request",
        "--request",
        request_path,
        "--receipt",
        receipt_path,
    )
    assert code == 0
    assert repeated["idempotent"] is True
    assert json.loads(graph.read_text(encoding="utf-8"))["graph_revision"] == 2


def test_c26_uses_default_c02_consumer_without_cli_injection(
    tmp_path, monkeypatch, capsys
):
    root, graph, _ = lifecycle_workspace(tmp_path)
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_default_consumer")
    common = root / ".git"
    actual_run = module.run
    git_context(monkeypatch, module, common)
    monkeypatch.setattr(
        module,
        "run",
        lambda argv, *args, **kwargs: (
            actual_run(argv, *args, **kwargs)
            if len(argv) > 1 and str(argv[1]).endswith("upsert-node.py")
            else SimpleNamespace(returncode=0, stdout="", stderr="")
        ),
    )
    monkeypatch.setattr(module, "c12_lifecycle_facts", lambda *args: facts())
    args = (
        "--repo-root",
        root,
        "--graph",
        graph,
        "--graph-node-id",
        "G",
        "--repo",
        "o/r",
        "--pr",
        "1",
    )

    code, completed = call_main(module, monkeypatch, capsys, *args)
    assert code == 0
    assert completed["policy_decision"] == "complete"
    assert completed["completion_step_ledger"]["c02_writer"] == "applied"
    assert completed["completion_step_ledger"]["completion_event"] == "applied"
    assert completed["local_patch"]["operation"] == "apply-lifecycle-request"
    assert completed["completion_event"]["graph_node_id"] == "G"

    revision = json.loads(graph.read_text(encoding="utf-8"))["graph_revision"]
    code, repeated = call_main(module, monkeypatch, capsys, *args)
    assert code == 0
    assert repeated["policy_decision"] == "complete"
    assert json.loads(graph.read_text(encoding="utf-8"))["graph_revision"] == revision


def test_c26_backfill_done_uses_stored_verified_merge_and_is_idempotent(
    tmp_path, monkeypatch, capsys
):
    root, graph, artifact = lifecycle_workspace(tmp_path)
    upsert = load(SCRIPTS / "upsert-node.py", "c02_lifecycle_backfill_seed")
    coordination = root / ".git" / "dev-graph" / "completion-receipts"
    coordination.mkdir(parents=True)
    request_path = coordination / "request.json"
    receipt_path = coordination / "receipt.json"
    request_path.write_text(
        json.dumps(lifecycle_request(graph, artifact)),
        encoding="utf-8",
    )
    assert (
        upsert.main(
            [
                "--repo-root",
                str(root),
                "--operation",
                "apply-lifecycle-request",
                "--request",
                str(request_path),
                "--receipt",
                str(receipt_path),
            ]
        )
        == 0
    )
    capsys.readouterr()

    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_backfill_done")
    common = root / ".git"
    monkeypatch.setattr(
        module,
        "c24_context",
        lambda root_path, resolver: {
            "repo_root": str(root_path),
            "repository_id": "github:o/r",
            "git_common_dir": str(common),
            "branch": None,
            "head_sha": "3" * 40,
            "coordination_paths": {"root": str(common / "dev-graph")},
        },
    )
    args = (
        "--repo-root",
        root,
        "--graph",
        graph,
        "--graph-node-id",
        "G",
        "--mode",
        "backfill-done",
        "--repo",
        "o/r",
        "--pr",
        "1",
    )
    code, result = call_main(module, monkeypatch, capsys, *args)
    assert code == 0
    assert result["backfill_mode"] == "verified_existing_done"
    assert result["completion_step_ledger"]["c02_writer"] == "verified_existing"
    assert result["completion_event"]["backfilled_from_durable_completion"] is True
    event_ledger = json.loads(
        (common / "dev-graph" / "events.json").read_text(encoding="utf-8")
    )
    assert len(
        [
            event
            for event in event_ledger["events"]
            if event.get("graph_node_id") == "G"
        ]
    ) == 1
    code, repeated = call_main(module, monkeypatch, capsys, *args)
    assert code == 0
    assert repeated["completion_event"]["event_key"] == result["completion_event"]["event_key"]
    event_ledger = json.loads(
        (common / "dev-graph" / "events.json").read_text(encoding="utf-8")
    )
    assert len(
        [
            event
            for event in event_ledger["events"]
            if event.get("graph_node_id") == "G"
        ]
    ) == 1
    (common / "dev-graph" / "leases.json").write_text(
        json.dumps(
            {
                "schema_version": "1.1",
                "leases": [{"graph_node_id": "G", "state": "pending_merge"}],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, args)])
    with pytest.raises(module.ContractError, match="active common-dir lease"):
        module.main()


def test_c26_local_first_transaction_calls_c27_before_beads_and_is_idempotent(tmp_path, monkeypatch, capsys):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_transaction")
    common = tmp_path / "common"
    common.mkdir()
    git_context(monkeypatch, module, common)
    monkeypatch.setattr(module, "c12_lifecycle_facts", lambda *args: facts())
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    artifact = tasks / "G.md"
    artifact.write_text(markdown("G"), encoding="utf-8")
    node = {
        "graph_node_id": "G", "artifact_kind": "task", "status": "active", "tracker_binding": "beads",
        "file_path": "tasks/G.md", "completion_evidence": {"policy": "linked_pr_merged_all", "status": "in_progress", "evidence_refs": []},
        "beads_linkage": {"bd_issue_id": "B1"}, "execution_contexts": [{"state": "pending_review"}],
    }
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({"graph_revision": 4, "nodes": [node]}), encoding="utf-8")
    original = graph.read_bytes()
    args = ("--repo-root", tmp_path, "--graph", graph, "--graph-node-id", "G", "--repo", "o/r", "--pr", "1")
    code, pending = call_main(
        module,
        monkeypatch,
        capsys,
        *args,
        "--writer-request-only",
    )
    assert code == 0 and pending["policy_decision"] == "writer_pending"
    assert graph.read_bytes() == original
    request = pending["writer_request"]
    assert Path(pending["writer_request_path"]).is_file(), "C02 request must have a concrete consumable path"

    updated = json.loads(graph.read_text(encoding="utf-8"))
    updated["graph_revision"] = 5
    updated["nodes"][0].update(request["task_patch"]["set"])
    graph.write_text(json.dumps(updated), encoding="utf-8")
    artifact.write_text(markdown("G", status="done"), encoding="utf-8")
    writer = tmp_path / "writer.json"
    writer.write_text(json.dumps({
        "owner": "C02/run-dev-graph-node", "operation": "apply-lifecycle-request", "status": "applied",
        "event_key": request["event_key"], "graph_node_id": "G", "request_digest": request["request_digest"],
        "graph_sha256_after": hashlib.sha256(graph.read_bytes()).hexdigest(), "graph_revision_after": 5,
        "task_artifact_sha256_after": hashlib.sha256(artifact.read_bytes()).hexdigest(),
    }), encoding="utf-8")
    order: list[str] = []
    def release_failure(*args):
        order.append("C27-fail")
        raise module.ContractError("lease unavailable")
    monkeypatch.setattr(module, "_invoke_system_release", release_failure)
    monkeypatch.setattr(module, "_invoke_bd_close", lambda *args: pytest.fail("Beads close must not run before C27 succeeds"))
    code, completed = call_main(module, monkeypatch, capsys, *args, "--writer-receipt", writer)
    assert code == 1 and completed["policy_decision"] == "pending_retry"
    assert completed["completion_step_ledger"]["system_release"] == "pending_retry"
    event_ledger = json.loads((common / "dev-graph" / "events.json").read_text(encoding="utf-8"))
    assert event_ledger["events"][0]["repository_id"] == "github:o/r"

    monkeypatch.setattr(module, "_invoke_system_release", lambda *args: order.append("C27") or {"lease": {"state": "released", "completion_event_key": request["event_key"]}})
    def beads_failure(*args):
        order.append("C28-fail")
        raise module.ContractError("beads unavailable")
    monkeypatch.setattr(module, "_invoke_bd_close", beads_failure)
    code, completed = call_main(module, monkeypatch, capsys, *args)
    assert code == 1 and completed["completion_step_ledger"]["system_release"] == "applied"
    assert completed["completion_step_ledger"]["beads_close"] == "pending_retry"

    monkeypatch.setattr(module, "_invoke_bd_close", lambda *args: order.append("C28") or {"op": "close", "result": {"status": "closed"}})
    code, completed = call_main(module, monkeypatch, capsys, *args)
    assert code == 0 and completed["policy_decision"] == "complete"
    assert completed["completion_step_ledger"] == {
        "event_key": request["event_key"], "c02_writer": "applied", "completion_event": "applied",
        "system_release": "applied", "beads_close": "applied",
    }
    assert order == ["C27-fail", "C27", "C28-fail", "C28"], "C27 local release must precede the final external Beads projection"
    code, repeated = call_main(module, monkeypatch, capsys, *args)
    assert code == 0 and repeated["policy_decision"] == "complete" and order == ["C27-fail", "C27", "C28-fail", "C28"]


def test_c26_feature_rollup_requires_deep_p07_p10_p11_markdown_and_receipts(tmp_path):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_rollup")
    acceptance = ["criterion-A", "criterion-B"]
    feature = {"graph_node_id": "F", "artifact_kind": "feature", "status": "active", "acceptance": acceptance}
    (tmp_path / "tasks").mkdir()
    (tmp_path / "evidence").mkdir()
    children = []
    for index, phase in enumerate(module.PHASES, 1):
        reference = f"evidence/{phase}.json"
        child = {
            "graph_node_id": f"T{index}", "artifact_kind": "task", "status": "done", "parent_feature": "F",
            "feature_package_id": "feature-package/F", "phase_ref": phase, "file_path": f"tasks/{phase}.md",
            "completion_evidence": {"status": "done", "evidence_refs": [reference]},
        }
        children.append(child)
        if phase in module.EVIDENCE_PHASES:
            (tmp_path / reference).write_text(json.dumps({
                "result": "PASS", "covered_task_ids": [child["graph_node_id"]], "phase_ref": phase,
                "feature_acceptance": acceptance,
            }), encoding="utf-8")
            (tmp_path / child["file_path"]).write_text(markdown(child["graph_node_id"], status="done", phase=phase, evidence=reference), encoding="utf-8")
    registration = tmp_path / "registration.json"
    registration.write_text(json.dumps({
        "status": "registered", "expected_count": 13, "applied_count": 13, "phase_refs": module.PHASES,
        "node_ids": [child["graph_node_id"] for child in children], "feature_package_id": "feature-package/F", "parent_feature": "F",
    }), encoding="utf-8")
    rollup = module.feature_rollup(tmp_path, [feature, *children], children[0], str(registration))
    assert rollup and rollup["eligible"] is True
    bad = tmp_path / "evidence" / "P10.json"
    value = json.loads(bad.read_text(encoding="utf-8"))
    value["feature_acceptance"] = ["criterion-A"]
    bad.write_text(json.dumps(value), encoding="utf-8")
    rollup = module.feature_rollup(tmp_path, [feature, *children], children[0], str(registration))
    assert rollup and rollup["eligible"] is False
    assert any("P10" in blocker and "exactly" in blocker for blocker in rollup["blockers"])


def test_c26_fails_closed_on_malformed_c12_fixture(tmp_path, monkeypatch):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_errors")
    monkeypatch.setenv("DEV_GRAPH_GH_FIXTURE", "{")
    with pytest.raises(module.ContractError, match="invalid JSON"):
        module.c12_lifecycle_facts(tmp_path, tmp_path / "gh-bridge.py", "o/r", 1)
    with pytest.raises(module.ContractError, match="graph nodes"):
        module._nodes({"nodes": "not-an-array"})


def test_c26_boundary_helpers_fail_closed_with_typed_receipts(tmp_path, monkeypatch):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_helper_errors")
    monkeypatch.setattr(module, "run", lambda *args, **kwargs: SimpleNamespace(returncode=2, stdout="", stderr="denied"))
    with pytest.raises(module.ContractError, match="failed"):
        module._invoke_json(["tool"], tmp_path, "boundary")
    monkeypatch.setattr(module, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="{", stderr=""))
    with pytest.raises(module.ContractError, match="invalid JSON"):
        module._invoke_json(["tool"], tmp_path, "boundary")
    monkeypatch.setattr(module, "run", lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="[]", stderr=""))
    with pytest.raises(module.ContractError, match="must be an object"):
        module._invoke_json(["tool"], tmp_path, "boundary")

    monkeypatch.delenv("DEV_GRAPH_GH_FIXTURE", raising=False)
    monkeypatch.setattr(module, "_invoke_json", lambda *args: {"op": "wrong", "result": {}})
    with pytest.raises(module.ContractError, match="identity mismatch"):
        module.c12_lifecycle_facts(tmp_path, tmp_path / "bridge.py", "o/r", 1)
    expected = facts()
    monkeypatch.setattr(module, "_invoke_json", lambda *args: {"op": "lifecycle-facts", "result": expected})
    assert module.c12_lifecycle_facts(tmp_path, tmp_path / "bridge.py", "o/r", 1) == expected

    with pytest.raises(module.ContractError, match="no frontmatter"):
        module._frontmatter("plain")
    with pytest.raises(module.ContractError, match="not terminated"):
        module._frontmatter("---\nstatus: active")
    with pytest.raises(module.ContractError, match="invalid task Markdown"):
        module._artifact_path(tmp_path, {"graph_node_id": "G", "file_path": "../G.md"})
    assert module._local_evidence(tmp_path, "https://example.test/evidence") is None
    with pytest.raises(module.ContractError, match="escapes"):
        module._local_evidence(tmp_path, "/outside.json")

    # _validate_task_artifact を直接呼ぶ以下は upsert-node.py の artifact_findings
    # (C11) を経由しないため、markdown() のフル 13 見出し本文は不要。ここだけ
    # "## Verification and evidence" 単体の最小本文を使い、_section() の同義語
    # ("検証方法") と衝突させない。
    def minimal_body(node_id: str, *, verification: str) -> str:
        return (
            "---\n"
            f'graph_node_id: "{node_id}"\n'
            'status: "active"\n'
            "---\n"
            "# Task\n\n"
            "## Verification and evidence\n\n"
            f"{verification}\n"
        )

    tasks = tmp_path / "tasks"
    tasks.mkdir()
    task = tasks / "G.md"
    task.write_text(minimal_body("wrong", verification="- Automated commands: `python3 -m pytest`"), encoding="utf-8")
    node = {"graph_node_id": "G", "file_path": "tasks/G.md"}
    with pytest.raises(module.ContractError, match="does not match graph"):
        module._validate_task_artifact(tmp_path, node)
    task.write_text(minimal_body("G", verification="- Automated commands: TODO"), encoding="utf-8")
    with pytest.raises(module.ContractError, match="incomplete verification"):
        module._validate_task_artifact(tmp_path, node)

    published = tmp_path / "published-task.md"
    published.write_text(
        "# Published task\n\n## Verification and evidence\n\n"
        "- Automated commands: `python3 -m pytest`\n"
        "- Required evidence: evidence/run.json\n",
        encoding="utf-8",
    )
    projection = "---\ngraph_node_id: \"G\"\nstatus: \"active\"\n---\n\n# Task\n\n"
    task.write_text(projection, encoding="utf-8")
    projected_node = {**node, "source_lineage": {"source_path": "published-task.md"}}
    result = module._validate_task_artifact(tmp_path, projected_node)
    assert result["verification_source"]["file_path"] == "published-task.md"

    published.write_text("# Published task\n\n## Verification and evidence\n\n- TODO\n", encoding="utf-8")
    with pytest.raises(module.ContractError, match="incomplete verification"):
        module._validate_task_artifact(tmp_path, projected_node)
    with pytest.raises(module.ContractError, match="escapes repository authority"):
        module._validate_task_artifact(
            tmp_path,
            {**node, "source_lineage": {"source_path": "../published-task.md"}},
        )

    monkeypatch.setattr(module, "_invoke_json", lambda *args: {"lease": {"state": "pending_review"}})
    with pytest.raises(module.ContractError, match="does not match"):
        module._invoke_system_release(tmp_path, tmp_path / "lease.py", "G", "E")
    assert module._needs_system_release({"execution_contexts": [{"state": "pending_merge"}]}) is True
    assert module._needs_system_release({"execution_contexts": [{"state": "released"}]}) is False


def test_c26_writer_receipt_rejects_digest_revision_and_durable_state_drift(tmp_path):
    module = load(SCRIPTS / "reconcile-github-lifecycle.py", "c26_writer_errors")
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    artifact = tasks / "G.md"
    artifact.write_text(markdown("G", status="done"), encoding="utf-8")
    completion = {"policy": "linked_pr_merged_all", "status": "done", "source": "github_pr_merge", "completed_at": "2026-01-01T00:00:00Z", "reconciled_at": "2026-01-01T00:00:01Z", "evidence_refs": ["https://example.test/pr/1"]}
    linkages: list[dict] = []
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({"graph_revision": 2, "nodes": [{"graph_node_id": "G", "status": "done", "file_path": "tasks/G.md", "completion_evidence": completion, "pull_request_linkages": linkages}]}), encoding="utf-8")
    request = {"event_key": "E", "request_digest": "D", "graph_revision_before": 1, "task_patch": {"graph_node_id": "G", "set": {"completion_evidence": completion, "pull_request_linkages": linkages}}}
    base = {"owner": "C02/run-dev-graph-node", "operation": "apply-lifecycle-request", "status": "applied", "event_key": "E", "graph_node_id": "G", "request_digest": "D", "graph_sha256_after": hashlib.sha256(graph.read_bytes()).hexdigest(), "graph_revision_after": 2, "task_artifact_sha256_after": hashlib.sha256(artifact.read_bytes()).hexdigest()}
    receipt = tmp_path / "receipt.json"
    receipt.write_text(json.dumps({**base, "request_digest": "wrong"}), encoding="utf-8")
    with pytest.raises(module.ContractError, match="request digest"):
        module._writer_applied(receipt, request, graph, tmp_path)
    receipt.write_text(json.dumps({**base, "graph_sha256_after": "stale"}), encoding="utf-8")
    with pytest.raises(module.ContractError, match="graph digest"):
        module._writer_applied(receipt, request, graph, tmp_path)
    receipt.write_text(json.dumps({**base, "graph_revision_after": 3}), encoding="utf-8")
    with pytest.raises(module.ContractError, match="graph revision"):
        module._writer_applied(receipt, request, graph, tmp_path)
    receipt.write_text(json.dumps(base), encoding="utf-8")
    assert module._writer_applied(receipt, request, graph, tmp_path)["status"] == "applied"
