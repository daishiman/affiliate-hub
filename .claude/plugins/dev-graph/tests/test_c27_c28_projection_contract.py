from __future__ import annotations

import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

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
    monkeypatch.setattr(sys, "stdin", io.StringIO("{}"))
    code = module.main()
    output = capsys.readouterr().out
    return code, json.loads(output) if output else None


def package_manifest() -> dict:
    return {
        "source_digest": "sha256:" + "a" * 64,
        "feature": {"graph_node_id": "F", "title": "Feature F"},
        "children": [
            {
                "graph_node_id": f"T{i:02d}",
                "parent_feature": "F",
                "phase_ref": f"P{i:02d}",
                "title": f"Phase {i:02d}",
                "depends_on": [] if i == 1 else [f"T{i - 1:02d}"],
            }
            for i in range(1, 14)
        ],
    }


def register_graph(root: Path, *node_ids: str) -> None:
    """create の実在検証 (HarnessHub-mfh7) が読む canonical graph を fixture root に置く。"""
    state = root / ".dev-graph"
    state.mkdir(exist_ok=True)
    (state / "config.json").write_text(json.dumps({"local_state": {"graph": ".dev-graph/graph.json"}}))
    (state / "graph.json").write_text(json.dumps({"nodes": [{"graph_node_id": node_id} for node_id in node_ids]}))


def test_c28_projects_epic_exact13_and_returns_only_parity_confirmed_ready(tmp_path, monkeypatch, capsys):
    module = load(SCRIPTS / "bd-bridge.py", "c28_projection")
    register_graph(tmp_path, "F", *(f"T{i:02d}" for i in range(1, 14)))
    identity = {"workspace_id": "bdw_fixture"}
    monkeypatch.setattr(module, "preflight", lambda root: {"version": "1.1.0", "workspace_identity": identity})
    issues: dict[str, dict] = {}
    calls: list[list[str]] = []
    next_id = 0

    def fake_bd(args, cwd, check=True):
        nonlocal next_id
        calls.append(args)
        if args[0] == "search":
            marker = args[1].removeprefix("dev-graph:")
            return [row for row in issues.values() if row.get("external_ref") == f"dev-graph:{marker}"]
        if args[0] == "list":
            return list(issues.values())
        if args[0] == "create":
            next_id += 1
            issue_id = f"B{next_id:02d}"
            row = {
                "id": issue_id,
                "title": args[args.index("--title") + 1],
                "status": "open",
                "issue_type": args[args.index("--type") + 1],
                "external_ref": args[args.index("--external-ref") + 1],
                "dependencies": [],
                "description": args[args.index("--description") + 1],
                "metadata": json.loads(args[args.index("--metadata") + 1]) if "--metadata" in args else {},
            }
            if "--parent" in args:
                row["parent"] = args[args.index("--parent") + 1]
            issues[issue_id] = row
            return row
        if args[0] == "show":
            return issues[args[1]]
        if args[0] == "update":
            row = issues[args[1]]
            if "--title" in args:
                row["title"] = args[args.index("--title") + 1]
            if "--description" in args:
                row["description"] = args[args.index("--description") + 1]
            if "--parent" in args:
                row["parent"] = args[args.index("--parent") + 1]
            if "--status" in args:
                row["status"] = args[args.index("--status") + 1]
            if "--set-metadata" in args:
                key, value = args[args.index("--set-metadata") + 1].split("=", 1)
                row.setdefault("metadata", {})[key] = value
            return row
        if args[:2] == ["dep", "add"]:
            issues[args[2]]["dependencies"].append({"id": args[3]})
            return {"ok": True}
        if args[:2] == ["dep", "remove"]:
            issues[args[2]]["dependencies"] = [
                dependency for dependency in issues[args[2]]["dependencies"]
                if dependency.get("id") != args[3]
            ]
            return {"ok": True}
        if args[0] == "ready":
            return [row for row in issues.values() if row["issue_type"] == "task"]
        if args[0] == "close":
            issues[args[1]]["status"] = "closed"
            return issues[args[1]]
        raise AssertionError(args)

    monkeypatch.setattr(module, "bd", fake_bd)
    projection = tmp_path / "projection.json"
    projection.write_text(json.dumps(package_manifest()))
    code, preview = call_main(module, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path, "--projection-manifest", projection, "--dry-run")
    assert code == 0 and preview["dry_run_preview"]["projection"]["write_count"] == 0
    assert not calls
    code, receipt = call_main(module, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path, "--projection-manifest", projection)
    assert code == 0
    assert receipt["result"]["expected_count"] == receipt["result"]["applied_count"] == 13
    assert issues["B01"]["issue_type"] == "epic"
    assert all(issues[f"B{i:02d}"]["parent"] == "B01" for i in range(2, 15))
    create_count = sum(args[0] == "create" for args in calls)
    call_main(module, monkeypatch, capsys, "--op", "create", "--repo-root", tmp_path, "--projection-manifest", projection)
    assert sum(args[0] == "create" for args in calls) == create_count
    assert any(args[:2] == ["dep", "add"] and args[-3:] == ["--type", "blocks", "--json"] for args in calls)

    superseding = package_manifest()
    superseding["source_digest"] = "sha256:" + "b" * 64
    superseding["children"][1]["depends_on"] = []
    projection.write_text(json.dumps(superseding))
    before_supersede_creates = sum(args[0] == "create" for args in calls)
    _, superseded = call_main(
        module, monkeypatch, capsys,
        "--op", "create", "--repo-root", tmp_path, "--projection-manifest", projection,
    )
    assert sum(args[0] == "create" for args in calls) == before_supersede_creates
    assert superseded["result"]["source_digest"] == superseding["source_digest"]
    assert all(
        issue["metadata"]["dev_graph_source_digest"] == superseding["source_digest"]
        for issue in issues.values()
    )
    assert issues["B03"]["dependencies"] == []
    assert any(args[:2] == ["dep", "remove"] for args in calls)

    children = superseding["children"]
    by_graph = {issues[f"B{i + 1:02d}"]["external_ref"].removeprefix("dev-graph:"): f"B{i + 1:02d}" for i in range(1, 14)}
    parity = {
        "generated_at": "2026-07-21T00:00:00Z",
        "source_graph_digest": "sha256:" + "c" * 64,
        "nodes": [
            {
                "graph_node_id": row["graph_node_id"],
                "bd_issue_id": by_graph[row["graph_node_id"]],
                "graph_status": "active",
                "depends_on": row["depends_on"],
            }
            for row in children
        ],
        "graph_node_ids": sorted({row["graph_node_id"] for row in children}),
    }
    parity_path = tmp_path / "parity.json"; parity_path.write_text(json.dumps(parity))
    _, ready = call_main(module, monkeypatch, capsys, "--op", "ready", "--repo-root", tmp_path, "--parity-manifest", parity_path)
    assert len(ready["result"]["ready_set"]) == 13
    assert not ready["result"]["conflicts"] and not ready["result"]["unmapped"]
    assert ready["parity_provenance"] == {
        "generated_at": "2026-07-21T00:00:00Z", "source_graph_digest": "sha256:" + "c" * 64,
    }
    issues["B02"]["dependencies"].append({"id": "unexpected"})
    _, ready = call_main(module, monkeypatch, capsys, "--op", "ready", "--repo-root", tmp_path, "--parity-manifest", parity_path)
    assert len(ready["result"]["ready_set"]) == 12 and ready["result"]["conflicts"]

    rollup = tmp_path / "rollup.json"
    rollup.write_text(json.dumps({"epic_bd_issue_id": "B01", "children": [{"phase_ref": f"P{i:02d}", "status": "closed"} for i in range(1, 14)]}))
    _, closed = call_main(module, monkeypatch, capsys, "--op", "close", "--repo-root", tmp_path, "--bd-issue-id", "B01", "--artifact-kind", "feature", "--feature-rollup-manifest", rollup)
    assert closed["result"]["feature_rollup"]["closed_count"] == 13

    issues["DUPLICATE"] = {
        **issues["B02"], "id": "DUPLICATE", "status": "closed",
    }
    with pytest.raises(module.ContractError, match="duplicate beads external_ref"):
        module._find_external(tmp_path, "T01")


def test_c27_creates_only_canonical_claim_branch_and_fails_dirty(tmp_path):
    module = load(SCRIPTS / "manage-worktree-lease.py", "c27_branch")
    subprocess.run(["git", "init", "-b", "main", str(tmp_path)], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(tmp_path), "config", "user.email", "test@example.com"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "config", "user.name", "Test"], check=True)
    (tmp_path / "tracked.txt").write_text("initial")
    subprocess.run(["git", "-C", str(tmp_path), "add", "tracked.txt"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "commit", "-m", "initial"], check=True, capture_output=True)
    current = module.context(tmp_path)
    assert current["repository_id"].startswith("local:sha256:")
    claimed = module._ensure_claim_branch(tmp_path, "G1", "devgraph/G1", current)
    assert claimed["branch"] == "devgraph/G1"
    with pytest.raises(module.ContractError, match="canonical"):
        module._ensure_claim_branch(tmp_path, "G2", "feature/arbitrary", claimed)
    subprocess.run(["git", "-C", str(tmp_path), "switch", "main"], check=True, capture_output=True)
    (tmp_path / "tracked.txt").write_text("dirty")
    with pytest.raises(module.ContractError, match="clean worktree"):
        module._ensure_claim_branch(tmp_path, "G2", "devgraph/G2", module.context(tmp_path))


def test_c27_context_fails_closed_on_invalid_c24_receipts(tmp_path, monkeypatch):
    module = load(SCRIPTS / "manage-worktree-lease.py", "c27_context_boundaries")
    resolver = tmp_path / "resolve.py"

    with pytest.raises(module.ContractError, match="missing C24"):
        module.context(tmp_path, resolver)

    resolver.write_text("# fixture")
    monkeypatch.setattr(
        module,
        "run",
        lambda *a, **k: SimpleNamespace(returncode=1, stdout="", stderr="failed"),
    )
    with pytest.raises(module.ContractError, match="resolver failed"):
        module.context(tmp_path, resolver)

    monkeypatch.setattr(
        module,
        "run",
        lambda *a, **k: SimpleNamespace(returncode=0, stdout="not-json", stderr=""),
    )
    with pytest.raises(module.ContractError, match="invalid JSON"):
        module.context(tmp_path, resolver)

    valid = {
        "repo_root": str(tmp_path),
        "git_common_dir": str(tmp_path / ".git"),
        "repository_id": "github:owner/repo",
        "worktree_id": "wt_" + "1" * 16,
        "branch": "main",
        "default_branch": "main",
        "head_sha": "1" * 40,
    }

    def receipt(value):
        monkeypatch.setattr(
            module,
            "run",
            lambda *a, **k: SimpleNamespace(returncode=0, stdout=json.dumps(value), stderr=""),
        )

    receipt({})
    with pytest.raises(module.ContractError, match="omitted required"):
        module.context(tmp_path, resolver)
    receipt({**valid, "branch": None})
    detached = module.context(tmp_path, resolver)
    assert detached["branch"] is None
    receipt({key: value for key, value in valid.items() if key != "branch"})
    with pytest.raises(module.ContractError, match="invalid branch state"):
        module.context(tmp_path, resolver)
    receipt({**valid, "branch": ""})
    with pytest.raises(module.ContractError, match="invalid branch state"):
        module.context(tmp_path, resolver)
    receipt({**valid, "repo_root": str(tmp_path.parent)})
    with pytest.raises(module.ContractError, match="root mismatch"):
        module.context(tmp_path, resolver)
    receipt({**valid, "repository_id": "repo_legacy"})
    with pytest.raises(module.ContractError, match="non-canonical"):
        module.context(tmp_path, resolver)


def test_c27_list_accepts_detached_head_without_mutating_lease_ledgers(tmp_path, monkeypatch, capsys):
    module = load(SCRIPTS / "manage-worktree-lease.py", "c27_detached_list")
    common = tmp_path / "common"
    coordination = common / "dev-graph"
    coordination.mkdir(parents=True)
    ledger = coordination / "leases.json"
    events = coordination / "events.json"
    ledger.write_text(json.dumps({
        "schema_version": "1.1",
        "workspace_identity": "bdw_fixture",
        "leases": [{
            "graph_node_id": "G",
            "state": "released",
            "session_id": "S",
            "worktree_id": "wt_fixture",
            "resource_scope": [],
        }],
    }))
    events.write_text(json.dumps({
        "schema_version": "1.0",
        "events": [{"type": "lease.released", "graph_node_id": "G"}],
    }))
    ledger_before, events_before = ledger.read_bytes(), events.read_bytes()
    receipt = {
        "repo_root": str(tmp_path),
        "git_common_dir": str(common),
        "repository_id": "local:sha256:" + "a" * 64,
        "worktree_id": "wt_" + "1" * 16,
        "branch": None,
        "default_branch": "main",
        "head_sha": "1" * 40,
    }
    resolver = tmp_path / "resolve.py"
    resolver.write_text(
        "import json\n"
        f"print(json.dumps({receipt!r}))\n",
    )

    code, listed = call_main(
        module,
        monkeypatch,
        capsys,
        "--repo-root", tmp_path,
        "--op", "list",
        "--context-resolver", resolver,
    )

    assert code == 0
    assert listed["branch"] is None
    assert [item["graph_node_id"] for item in listed["leases"]] == ["G"]
    assert [item["type"] for item in listed["events"]] == ["lease.released"]
    assert ledger.read_bytes() == ledger_before
    assert events.read_bytes() == events_before


def test_c27_bridge_graph_and_c02_consumer_boundaries(tmp_path, monkeypatch):
    module = load(SCRIPTS / "manage-worktree-lease.py", "c27_boundaries")
    with pytest.raises(module.ContractError, match="missing C28"):
        module.invoke_bd_bridge(tmp_path, tmp_path / "missing.py", [])
    bridge = tmp_path / "bridge.py"; bridge.write_text('print("{\\"ok\\": true}")')
    assert module.invoke_bd_bridge(tmp_path, bridge, ["--op", "show"])["ok"] is True
    monkeypatch.setattr(module, "run", lambda *a, **k: SimpleNamespace(returncode=1, stdout="", stderr="failed"))
    with pytest.raises(module.ContractError, match="C28 bridge failed"):
        module.invoke_bd_bridge(tmp_path, bridge, [])
    monkeypatch.undo()

    graph = tmp_path / "graph.json"; graph.write_text('{"nodes": []}')
    assert module._resolve_graph(tmp_path, "graph.json") == graph
    config_dir = tmp_path / ".dev-graph"; config_dir.mkdir()
    (config_dir / "config.json").write_text('{"local_state":{"graph":"graph.json"}}')
    assert module._resolve_graph(tmp_path, None) == graph
    (config_dir / "config.json").write_text("{}")
    with pytest.raises(module.ContractError, match="omits"):
        module._resolve_graph(tmp_path, None)
    outside = tmp_path.parent / "outside-c27.json"; outside.write_text("{}")
    try:
        with pytest.raises(module.ContractError, match="escapes"):
            module._resolve_graph(tmp_path, outside.as_posix())
    finally:
        outside.unlink()

    consumer = tmp_path / "consumer.py"
    consumer.write_text('print("{\\"owner\\":\\"C02/run-dev-graph-node\\",\\"status\\":\\"applied\\",\\"graph_node_id\\":\\"G\\",\\"worktree_id\\":\\"wt_1111111111111111\\"}")')
    lease = {
        "graph_node_id": "G", "worktree_id": "wt_" + "1" * 16, "branch": "devgraph/G",
        "head_sha": "1" * 40, "created_at": "2026-07-13T00:00:00Z", "updated_at": "2026-07-13T00:00:01Z",
    }
    ctx = {"base_branch": "main"}
    assert module.invoke_execution_context_consumer(tmp_path, consumer, graph, lease, ctx)["status"] == "applied"
    consumer.write_text('print("not-json")')
    with pytest.raises(module.ContractError, match="invalid JSON"):
        module.invoke_execution_context_consumer(tmp_path, consumer, graph, lease, ctx)


def test_c27_fail_closed_owner_pending_release_and_projection_repair(tmp_path, monkeypatch, capsys):
    module = load(SCRIPTS / "manage-worktree-lease.py", "c27_fail_closed")
    common = tmp_path / "common"; common.mkdir()
    ctx = {
        "repo_root": str(tmp_path), "git_common_dir": str(common), "repository_id": "R",
        "worktree_id": "wt_" + "1" * 16, "branch": "devgraph/G", "base_branch": "main", "head_sha": "1" * 40,
    }
    monkeypatch.setattr(module, "context", lambda root, resolver=None: dict(ctx))
    monkeypatch.setattr(module, "_ensure_claim_branch", lambda root, node_id, requested, current: {**current, "branch": f"devgraph/{node_id}"})
    graph = tmp_path / "graph.json"; graph.write_text('{"nodes": []}')
    applied = lambda root, consumer, graph_path, lease, current: {"owner": "C02/run-dev-graph-node", "status": "applied", "graph_node_id": lease["graph_node_id"], "worktree_id": lease["worktree_id"]}
    monkeypatch.setattr(module, "invoke_execution_context_consumer", applied)

    claim = ("--repo-root", tmp_path, "--op", "claim", "--graph", graph, "--graph-node-id", "G", "--session-id", "S", "--branch", "devgraph/G")
    call_main(module, monkeypatch, capsys, *claim)
    with pytest.raises(module.ContractError, match="already has"):
        call_main(module, monkeypatch, capsys, "--repo-root", tmp_path, "--op", "claim", "--graph", graph, "--graph-node-id", "G", "--session-id", "OTHER")
    call_main(module, monkeypatch, capsys, "--repo-root", tmp_path, "--op", "park", "--graph-node-id", "G", "--session-id", "S")
    with pytest.raises(module.ContractError, match="system-release"):
        call_main(module, monkeypatch, capsys, "--repo-root", tmp_path, "--op", "release", "--graph-node-id", "G", "--session-id", "S")
    with pytest.raises(module.ContractError, match="completion-event-key"):
        call_main(module, monkeypatch, capsys, "--repo-root", tmp_path, "--op", "system-release", "--graph-node-id", "G")

    monkeypatch.setattr(module, "invoke_execution_context_consumer", lambda *a, **k: (_ for _ in ()).throw(module.ContractError("projection failed")))
    with pytest.raises(module.ContractError, match="projection failed"):
        call_main(module, monkeypatch, capsys, "--repo-root", tmp_path, "--op", "claim", "--graph", graph, "--graph-node-id", "G2", "--session-id", "S2")
    ledger = json.loads((common / "dev-graph" / "leases.json").read_text())
    repaired = next(row for row in ledger["leases"] if row["graph_node_id"] == "G2")
    assert repaired["state"] == "claim_pending_local_repair"
