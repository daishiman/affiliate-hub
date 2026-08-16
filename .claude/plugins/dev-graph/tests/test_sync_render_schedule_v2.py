from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from test_operational_loop_v2 import args as upsert_args
from test_operational_loop_v2 import load, node_fixture, workspace


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    code = module.main()
    output = capsys.readouterr().out.strip()
    return code, json.loads(output) if output else None


def github_workspace(tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    root, graph, input_path = workspace(tmp_path)
    node = node_fixture("github-sync")
    node.update({
        "title": "Local title",
        "status": "active",
        "updated_at": "2026-07-20T00:00:00Z",
        "file_path": "issues/github-sync.md",
        "resource_scope": ["issues/github-sync.md"],
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "confirmation_evidence": {
            "evaluator": "test", "evidence_ref": "eval-log/test.json", "evaluated_digest": "b" * 64,
        },
        "implementation_readiness": {
            "status": "complete", "missing_sections": [], "checked_at": "2026-07-20T00:00:00Z",
        },
        "tracker_binding": "github",
        "issue_linkage": {"repo": "o/r", "issue_number": 7, "linked_at": "2026-07-20T00:00:00Z"},
        "github_publication": {"mode": "issue", "project_aliases": [], "labels": [], "milestone": None},
    })
    input_path.write_text(json.dumps({"node": node, "body": "# Sync fixture"}), encoding="utf-8")
    remote = root / ".dev-graph" / "remote.json"
    remote.write_text(json.dumps({
        "schema_version": "1.0",
        "beads": {},
        "github": {
            "github-sync": {
                "id": "I_7",
                "number": 7,
                "repo": "o/r",
                "title": "Remote title",
                "state": "open",
                "updated_at": "2026-07-20T01:00:00Z",
                "projects": {},
            }
        },
    }), encoding="utf-8")
    return root, graph, input_path, remote


def test_sync_normalizes_null_beads_dependencies_and_rejects_invalid_shape():
    sync = load("sync-graph.py", "sync_null_beads_dependencies")

    assert sync._dependency_ids({"dependencies": None}) == []
    assert sync._dependency_ids({}) == []
    with pytest.raises(sync.ContractError, match="array or null"):
        sync._dependency_ids({"dependencies": "not-an-array"})


def test_sync_three_way_apply_second_pass_zero_and_tombstone(tmp_path, monkeypatch, capsys):
    upsert = load("upsert-node.py", "sync_v2_upsert")
    sync = load("sync-graph.py", "sync_graph_v2")
    root, graph, input_path, remote = github_workspace(tmp_path)
    upsert._perform(upsert_args(root, input_path))

    base_args = ("--repo-root", root, "--remote-state", remote, "--no-eval-log")
    code, preview = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert code == 0
    assert preview["write_count"] == 0
    assert preview["imports"] == [{
        "node": "github-sync", "field": "title", "from": "Local title", "to": "Remote title",
    }]

    code, applied = call_main(sync, monkeypatch, capsys, *base_args, "--apply")
    assert code == 0 and applied["write_count"] == 1
    saved = json.loads(graph.read_text())
    assert saved["nodes"][0]["title"] == "Remote title"
    code, converged = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert code == 0 and converged["changes"] == 0 and converged["converged"] is True

    remote_data = json.loads(remote.read_text())
    remote_data["github"]["github-sync"].update({
        "state": "closed", "updated_at": "2026-07-20T02:00:00Z",
    })
    remote.write_text(json.dumps(remote_data), encoding="utf-8")
    _, closed_preview = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert closed_preview["tombstones"] == []
    assert any(item["field"] == "status" and item["to"] == "closed" for item in closed_preview["imports"])
    call_main(sync, monkeypatch, capsys, *base_args, "--apply")
    assert json.loads(graph.read_text())["nodes"][0]["status"] == "closed"
    _, converged = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert converged["changes"] == 0

    remote_data = json.loads(remote.read_text())
    remote_data["github"]["github-sync"].update({
        "deleted": True, "updated_at": "2026-07-20T03:00:00Z",
    })
    remote.write_text(json.dumps(remote_data), encoding="utf-8")
    _, deleted = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert deleted["tombstones"][0]["physical_delete"] is False
    call_main(sync, monkeypatch, capsys, *base_args, "--apply")
    assert json.loads(graph.read_text())["nodes"][0]["status"] == "tombstoned"
    assert (root / "issues" / "github-sync.md").is_file()


def test_sync_manual_conflict_confirmation_and_dry_run_write_zero(tmp_path, monkeypatch, capsys):
    upsert = load("upsert-node.py", "sync_conflict_upsert")
    sync = load("sync-graph.py", "sync_graph_conflict")
    root, graph, input_path, remote = github_workspace(tmp_path)
    upsert._perform(upsert_args(root, input_path))
    base_args = ("--repo-root", root, "--remote-state", remote, "--no-eval-log")
    call_main(sync, monkeypatch, capsys, *base_args, "--apply")

    patch = root / ".dev-graph" / "local-patch.json"
    patch.write_text(json.dumps({
        "graph_node_id": "github-sync",
        "patch": {"title": "Local conflict", "updated_at": "2026-07-20T04:00:00Z"},
    }), encoding="utf-8")
    upsert._perform(upsert_args(root, patch))
    remote_data = json.loads(remote.read_text())
    remote_data["github"]["github-sync"].update({
        "title": "Remote conflict", "updated_at": "2026-07-20T04:00:00Z",
    })
    remote.write_text(json.dumps(remote_data), encoding="utf-8")
    graph_before, remote_before = graph.read_bytes(), remote.read_bytes()
    _, conflict = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert conflict["conflicts"][0]["resolution"] == "manual"
    assert conflict["write_count"] == 0
    assert graph.read_bytes() == graph_before and remote.read_bytes() == remote_before

    _, resolved = call_main(
        sync, monkeypatch, capsys, *base_args, "--apply", "--confirm", "github-sync:title=local",
    )
    assert resolved["conflicts"] == []
    assert json.loads(remote.read_text())["github"]["github-sync"]["title"] == "Local conflict"
    _, converged = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert converged["converged"] is True


def test_sync_project_item_is_stable_and_alias_failure_is_pending_retry(tmp_path, monkeypatch, capsys):
    upsert = load("upsert-node.py", "sync_project_upsert")
    sync = load("sync-graph.py", "sync_graph_project")
    root, graph, input_path, remote = github_workspace(tmp_path)
    payload = json.loads(input_path.read_text())
    node = payload["node"]
    node["priority"] = "high"
    node["github_publication"] = {
        "mode": "issue_and_projects", "project_aliases": ["delivery"], "labels": [], "milestone": None,
    }
    node["github_project_linkages"] = [{
        "project_alias": "delivery", "owner_type": "user", "owner_login": "o",
        "project_number": 1, "project_id": "P1", "item_id": None, "sync_state": "unlinked",
        "field_snapshot": {}, "linked_at": None, "last_synced_at": None, "last_error_code": None,
    }]
    input_path.write_text(json.dumps(payload), encoding="utf-8")
    config = json.loads((root / ".dev-graph" / "config.json").read_text())
    config["github"] = {"projects": [{
        "alias": "delivery",
        "field_mappings": [{
            "local_field": "priority", "project_field_name": "Priority",
            "direction": "bidirectional", "option_map": {"high": "High", "low": "Low"},
        }],
    }]}
    (root / ".dev-graph" / "config.json").write_text(json.dumps(config), encoding="utf-8")
    remote_data = json.loads(remote.read_text())
    remote_data["github"]["github-sync"]["projects"] = {
        "delivery": {
            "item_id": None,
            "fields": {"Priority": {"value": "Low", "updated_at": "2026-07-20T02:00:00Z"}},
            "definitions": {"Priority": {"id": "F1", "options": [{"id": "O1", "name": "High"}, {"id": "O2", "name": "Low"}]}},
        }
    }
    remote.write_text(json.dumps(remote_data), encoding="utf-8")
    upsert._perform(upsert_args(root, input_path))
    base_args = ("--repo-root", root, "--remote-state", remote, "--no-eval-log")
    _, preview = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert sum(item["kind"] == "project-item-add" for item in preview["exports"]) == 1
    assert any(item.get("field") == "priority" and item["to"] == "low" for item in preview["imports"])
    call_main(sync, monkeypatch, capsys, *base_args, "--apply")
    saved_node = json.loads(graph.read_text())["nodes"][0]
    linkage = saved_node["github_project_linkages"][0]
    assert linkage["item_id"].startswith("PVTI_")
    assert saved_node["priority"] == "low"
    stable_item = linkage["item_id"]
    _, converged = call_main(sync, monkeypatch, capsys, *base_args, "--dry-run")
    assert converged["changes"] == 0
    assert json.loads(graph.read_text())["nodes"][0]["github_project_linkages"][0]["item_id"] == stable_item

    remote_data = json.loads(remote.read_text())
    remote_data["github"]["github-sync"]["projects"]["delivery"]["error"] = "rate_limit"
    remote.write_text(json.dumps(remote_data), encoding="utf-8")
    _, pending = call_main(sync, monkeypatch, capsys, *base_args, "--apply")
    assert pending["pending_retry"][0]["alias"] == "delivery"
    pending_node = json.loads(graph.read_text())["nodes"][0]
    assert pending_node["priority"] == "low", "local promotion must not roll back"
    assert pending_node["github_project_linkages"][0]["sync_state"] == "pending_retry"


def test_schedule_mixed_binding_parity_expiry_scope_and_max_parallel(tmp_path, monkeypatch, capsys):
    schedule = load("schedule-graph.py", "schedule_v2_contract")
    graph = tmp_path / "graph.json"
    base = {
        "artifact_kind": "task", "status": "active", "confirmation_status": "confirmed",
        "evaluation_status": "pass", "implementation_readiness": {"status": "complete"},
        "depends_on": [],
    }
    graph.write_text(json.dumps({"nodes": [
        {**base, "graph_node_id": "beads", "tracker_binding": "beads", "resource_scope": ["a"]},
        {**base, "graph_node_id": "github", "tracker_binding": "github", "resource_scope": ["b"]},
        {**base, "graph_node_id": "none", "tracker_binding": "none", "resource_scope": ["c"]},
    ]}), encoding="utf-8")
    provenance = {
        "generated_at": "2026-07-21T00:00:00Z",
        "source_graph_digest": schedule._canonical_digest(json.loads(graph.read_text())),
    }
    ready = tmp_path / "ready.json"
    ready.write_text(json.dumps({"parity_provenance": provenance, "ready_set": [{
        "external_ref": "beads", "edge_parity": {"confirmed": True},
        "graph_status": "active", "graph_depends_on": [],
    }]}), encoding="utf-8")
    leases = tmp_path / "leases.json"
    leases.write_text(json.dumps({"leases": [{
        "graph_node_id": "github", "state": "claimed", "resource_scope": ["b"],
        "expires_at": "2020-01-01T00:00:00Z",
    }]}), encoding="utf-8")
    code, plan = call_main(
        schedule, monkeypatch, capsys,
        "--graph", graph, "--ready-json", ready, "--leases", leases, "--max-parallel", "1",
    )
    assert code == 0
    assert plan["ready_set"]["tasks"] == ["beads", "github", "none"]
    assert plan["batches"]["tasks"] == [["beads"], ["github"], ["none"]]
    assert plan["tracker_sha256_before"] == plan["tracker_sha256_after"]
    assert plan["lease_sha256_before"] == plan["lease_sha256_after"]

    ready.write_text(json.dumps({"parity_provenance": provenance, "ready_set": [{
        "external_ref": "beads", "edge_parity": {"confirmed": True},
        "graph_status": "active", "graph_depends_on": ["stale-dependency"],
    }]}), encoding="utf-8")
    _, stale = call_main(
        schedule, monkeypatch, capsys,
        "--graph", graph, "--ready-json", ready, "--leases", leases,
    )
    assert "beads" not in stale["ready_set"]["tasks"]
    assert any(item.get("reason") == "beads_parity_stale_or_unconfirmed" for item in stale["unmapped"])


def test_lifecycle_all_policy_and_beads_gate_fallback(tmp_path, monkeypatch):
    lifecycle = load("reconcile-github-lifecycle.py", "lifecycle_v2_helpers")
    node = {"graph_node_id": "G", "tracker_binding": "beads"}
    pr = {
        "number": 1, "body": "no marker", "closingIssuesReferences": [],
    }
    decision = lifecycle._linkage_decision(node, "o/r", pr, gate_verified=True)
    assert decision["eligible"] is True
    assert decision["marker_verified"] is False and decision["gh_pr_gate_verified"] is True


def test_lifecycle_all_policy_waits_for_every_linked_pr(tmp_path, monkeypatch, capsys):
    lifecycle = load("reconcile-github-lifecycle.py", "lifecycle_v2_all")
    common = tmp_path / ".git"
    common.mkdir()
    monkeypatch.setattr(lifecycle, "c24_context", lambda root, resolver: {
        "repo_root": str(root), "repository_id": "github:o/r", "git_common_dir": str(common),
        "branch": "main", "head_sha": "1" * 40,
        "coordination_paths": {"root": str(common / "dev-graph")},
    })
    monkeypatch.setattr(
        lifecycle,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""),
    )
    merged = {1: True, 2: False}

    def remote(_root, _bridge, repo, number):
        is_merged = merged[number]
        return {
            "repository": repo,
            "default_branch": {"name": "main", "oid": "1" * 40},
            "pull_request": {
                "number": number,
                "state": "MERGED" if is_merged else "OPEN",
                "merged": is_merged,
                "mergedAt": f"2026-07-20T0{number}:00:00Z" if is_merged else None,
                "mergeCommit": {"oid": str(number + 1) * 40} if is_merged else None,
                "baseRefName": "main", "headRefName": f"devgraph/G-{number}",
                "url": f"https://example.test/o/r/pull/{number}",
                "body": "dev-graph: G\n", "closingIssuesReferences": [],
            },
        }

    monkeypatch.setattr(lifecycle, "c12_lifecycle_facts", remote)
    tasks = tmp_path / "tasks"
    tasks.mkdir()
    (tasks / "G.md").write_text(
        "---\ngraph_node_id: \"G\"\nstatus: \"active\"\n---\n# Task\n\n## Verification and evidence\n\n- `pytest`\n",
        encoding="utf-8",
    )
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({
        "graph_revision": 1,
        "nodes": [{
            "graph_node_id": "G", "artifact_kind": "task", "status": "active",
            "tracker_binding": "none", "file_path": "tasks/G.md",
            "completion_evidence": {"policy": "linked_pr_merged_all", "status": "in_progress", "evidence_refs": []},
            "pull_request_linkages": [
                {"repo": "o/r", "pr_number": 1}, {"repo": "o/r", "pr_number": 2},
            ],
        }],
    }), encoding="utf-8")
    argv = (
        "--repo-root", tmp_path, "--graph", graph, "--graph-node-id", "G",
        "--repo", "o/r", "--pr", "1", "--mode", "check",
    )
    code, waiting = call_main(lifecycle, monkeypatch, capsys, *argv)
    assert code == 1 and waiting["policy_decision"] == "pending"
    assert any("#2 is not merged" in message for message in waiting["conflicts"])
    assert waiting["writer_request"] is None

    merged[2] = True
    code, ready = call_main(lifecycle, monkeypatch, capsys, *argv)
    assert code == 0 and ready["policy_decision"] == "complete"
    assert ready["writer_request"]["task_patch"]["set"]["status"] == "done"


def test_worktree_reclaims_expired_repair_state(tmp_path, monkeypatch, capsys):
    manager = load("manage-worktree-lease.py", "worktree_reclaim_v2")
    common = tmp_path / ".git"
    coordination = common / "dev-graph"
    coordination.mkdir(parents=True)
    context = {
        "repo_root": str(tmp_path), "git_common_dir": str(common), "repository_id": "local:sha256:" + "a" * 64,
        "worktree_id": "wt", "branch": "main", "base_branch": "main", "head_sha": "b" * 40,
    }
    monkeypatch.setattr(manager, "context", lambda *args, **kwargs: context)
    (coordination / "leases.json").write_text(json.dumps({
        "schema_version": "1.1", "workspace_identity": None,
        "leases": [{
            "graph_node_id": "G", "state": "claim_pending_local_repair", "session_id": "old",
            "worktree_id": "wt", "resource_scope": [], "expires_at": "2020-01-01T00:00:00Z",
        }],
    }), encoding="utf-8")
    (coordination / "events.json").write_text(json.dumps({"schema_version": "1.0", "events": []}), encoding="utf-8")
    code, receipt = call_main(
        manager, monkeypatch, capsys,
        "--repo-root", tmp_path, "--op", "reclaim", "--graph-node-id", "G",
    )
    assert code == 0 and receipt["lease"]["state"] == "released"
    persisted = json.loads((coordination / "leases.json").read_text())
    assert persisted["leases"][0]["state"] == "released"


def test_sync_project_unset_field_and_stale_item_identity_fail_safe():
    sync = load("sync-graph.py", "sync_project_edge_contract")
    node = {
        "graph_node_id": "n", "tracker_binding": "github", "title": "Title",
        "status": "active", "updated_at": "2026-07-20T00:00:00Z", "priority": "high",
        "github_project_linkages": [{
            "project_alias": "delivery", "project_id": "P1", "item_id": "ITEM-OLD",
            "sync_state": "synced", "last_error_code": None,
        }],
    }
    config = {"github": {"projects": [{
        "alias": "delivery", "field_mappings": [{
            "local_field": "priority", "project_field_name": "Priority",
            "direction": "local_to_project", "value_type": "single_select",
            "option_map": {"high": "High"},
        }],
    }]}}
    remote_node = {
        "id": "I1", "title": "Title", "state": "open", "updated_at": "2026-07-20T00:00:00Z",
        "projects": {"delivery": {
            "item_id": "ITEM-OLD", "fields": {},
            "definitions": {"Priority": {"id": "F1", "options": [{"id": "O1", "name": "High"}]}},
        }},
    }
    plan = sync._plan([node], {"github": {"n": remote_node}}, {"nodes": {}}, config, {})
    update = next(item for item in plan["exports"] if item["kind"] == "project-field-update")
    assert update["option_id"] == "O1" and not plan["pending_retry"]

    remote_node["projects"]["delivery"]["item_id"] = "ITEM-NEW"
    mismatch = sync._plan([node], {"github": {"n": remote_node}}, {"nodes": {}}, config, {})
    assert any(item.get("field") == "item_id" for item in mismatch["conflicts"])
    assert not any(item["kind"] == "project-item-add" for item in mismatch["exports"])

    node["github_project_linkages"][0]["item_id"] = None
    adopted = sync._plan([node], {"github": {"n": remote_node}}, {"nodes": {}}, config, {})
    assert adopted["patches"]["n"]["github_project_linkages"][0]["item_id"] == "ITEM-NEW"
    field_update = next(item for item in adopted["exports"] if item["kind"] == "project-field-update")
    assert field_update["item_id"] == "ITEM-NEW"
    assert not any(item["kind"] == "project-item-add" for item in adopted["exports"])

    remote_node["deleted"] = True
    remote_node["state"] = "deleted"
    deleted = sync._plan([node], {"github": {"n": remote_node}}, {"nodes": {}}, config, {})
    assert deleted["tombstones"][0]["physical_delete"] is False
    assert not any(item["kind"].startswith("project-") for item in deleted["exports"])


def test_gh_bridge_not_found_tombstone_and_project_field_value_types(monkeypatch, capsys):
    gh = load("gh-bridge.py", "gh_bridge_edge_contract")

    def not_found(_argv):
        raise gh.ContractError("Could not resolve to an Issue with the number of 7")

    monkeypatch.setattr(gh, "gh_json", not_found)
    code, deleted = call_main(gh, monkeypatch, capsys, "--op", "issue-fetch", "--repo", "o/r", "--number", "7")
    assert code == 0 and deleted["result"]["deleted"] is True

    calls = []
    monkeypatch.setattr(gh, "graphql", lambda query, variables: calls.append((query, variables)) or {"ok": True})
    variants = [
        ("single_select", ("--option-id", "O1"), "singleSelectOptionId"),
        ("iteration", ("--option-id", "IT1"), "iterationId"),
        ("text", ("--value", "hello"), "text:"),
        ("number", ("--value", "3.5"), "number:"),
        ("date", ("--value", "2026-07-20"), "date:"),
    ]
    for value_type, extra, marker in variants:
        code, _ = call_main(
            gh, monkeypatch, capsys, "--op", "project-item-edit",
            "--project-id", "P", "--item-id", "I", "--field-id", "F",
            "--value-type", value_type, *extra,
        )
        assert code == 0 and marker in calls[-1][0]


def test_lifecycle_any_policy_does_not_fabricate_requested_pr_linkage(tmp_path):
    lifecycle = load("reconcile-github-lifecycle.py", "lifecycle_any_writer_contract")
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({"graph_revision": 1, "nodes": []}), encoding="utf-8")
    merged_linkage = {"repo": "o/r", "pr_number": 1, "state": "merged", "merge_commit_sha": "a" * 40}
    node = {
        "graph_node_id": "task", "file_path": "tasks/task.md",
        "pull_request_linkages": [merged_linkage],
    }
    requested_unmerged = {
        "number": 2, "url": "https://example.test/pr/2", "baseRefName": "main",
        "headRefName": "feature", "state": "OPEN", "mergedAt": None, "mergeCommit": None,
    }
    completion = lifecycle._completion(node, [{
        "url": "https://example.test/pr/1", "mergedAt": "2026-07-20T00:00:00Z",
    }], "any")
    request = lifecycle._writer_request(
        "event", graph, 1, node, "o/r", requested_unmerged,
        {"closing_reference_verified": False}, {"sha256": "b" * 64}, None, completion,
    )
    links = request["task_patch"]["set"]["pull_request_linkages"]
    assert links == [merged_linkage]
    assert completion["policy"] == "linked_pr_merged_any"
