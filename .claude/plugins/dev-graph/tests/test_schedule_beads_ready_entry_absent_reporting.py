"""schedule-graph.py の beads ready entry 欠落除外報告 (HarnessHub-xz0u) の回帰テスト。

守る不変条件: tracker_binding=beads の node に対応する entry が bd ready payload
(--ready-json) に無い場合、その node は ready_ids にも unmapped にも入らず消えて
はならない。unmapped へ reason="ready_payload_entry_absent" で機械可読に報告され、
ready_ids・unmapped・conflicts の和が候補 node 集合を被覆する
(schedule-graph-contract.md)。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

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


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    code = module.main()
    output = capsys.readouterr().out.strip()
    return code, json.loads(output) if output else None


def test_schedule_reports_beads_node_missing_from_ready_payload(tmp_path, monkeypatch, capsys):
    schedule = load("schedule-graph.py", "schedule_beads_ready_entry_absent_report")
    graph = tmp_path / "graph.json"
    nodes = [
        {
            "graph_node_id": "beads-with-entry",
            "artifact_kind": "task",
            "status": "active",
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "implementation_readiness": {"status": "complete"},
            "depends_on": [],
            "tracker_binding": "beads",
            "resource_scope": ["src/with-entry.py"],
        },
        {
            "graph_node_id": "beads-missing-entry",
            "artifact_kind": "task",
            "status": "active",
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "implementation_readiness": {"status": "complete"},
            "depends_on": [],
            "tracker_binding": "beads",
            "resource_scope": ["src/missing-entry.py"],
        },
    ]
    graph.write_text(json.dumps({"nodes": nodes}), encoding="utf-8")

    ready = tmp_path / "ready.json"
    provenance = {
        "generated_at": "2026-07-21T00:00:00Z",
        "source_graph_digest": schedule._canonical_digest(json.loads(graph.read_text())),
    }
    ready.write_text(json.dumps({
        "parity_provenance": provenance,
        "ready_set": [{
            "external_ref": "beads-with-entry",
            "edge_parity": {"confirmed": True},
            "graph_status": "active",
            "graph_depends_on": [],
        }],
    }), encoding="utf-8")

    leases = tmp_path / "leases.json"
    leases.write_text(json.dumps({"leases": []}), encoding="utf-8")

    code, plan = call_main(
        schedule, monkeypatch, capsys,
        "--graph", graph, "--ready-json", ready, "--leases", leases,
    )

    assert code == 0
    assert plan["ready_set"]["tasks"] == ["beads-with-entry"]
    assert {
        "external_ref": "beads-missing-entry",
        "reason": "ready_payload_entry_absent",
        "source": "schedule-graph",
    } in plan["unmapped"]

    candidate_ids = {node["graph_node_id"] for node in nodes}
    reported_ids = set(plan["ready_set"]["tasks"]) | {
        row["external_ref"] for row in plan["unmapped"] if "external_ref" in row
    }
    assert candidate_ids <= reported_ids


def test_schedule_treats_parity_dependency_order_as_a_set(tmp_path, monkeypatch, capsys):
    schedule = load("schedule-graph.py", "schedule_beads_dependency_order")
    graph = tmp_path / "graph.json"
    nodes = [
        {"graph_node_id": "upstream-a", "status": "done", "depends_on": []},
        {"graph_node_id": "upstream-b", "status": "closed", "depends_on": []},
        {
            "graph_node_id": "beads-order-independent",
            "artifact_kind": "task",
            "status": "active",
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "implementation_readiness": {"status": "complete"},
            "depends_on": ["upstream-b", "upstream-a"],
            "tracker_binding": "beads",
            "resource_scope": ["src/order.py"],
        },
    ]
    graph.write_text(json.dumps({"nodes": nodes}), encoding="utf-8")
    ready = tmp_path / "ready.json"
    ready.write_text(json.dumps({
        "parity_provenance": {
            "generated_at": "2026-07-21T00:00:00Z",
            "source_graph_digest": schedule._canonical_digest(json.loads(graph.read_text())),
        },
        "ready_set": [{
            "external_ref": "beads-order-independent",
            "edge_parity": {"confirmed": True},
            "graph_status": "active",
            "graph_depends_on": ["upstream-a", "upstream-b"],
        }],
    }), encoding="utf-8")
    leases = tmp_path / "leases.json"
    leases.write_text('{"leases": []}', encoding="utf-8")

    code, plan = call_main(schedule, monkeypatch, capsys, "--graph", graph, "--ready-json", ready, "--leases", leases)

    assert code == 0
    assert plan["ready_set"]["tasks"] == ["beads-order-independent"]
    assert not plan["unmapped"]


def test_schedule_fails_closed_when_p01_parent_is_missing(tmp_path, monkeypatch, capsys):
    schedule = load("schedule-graph.py", "schedule_missing_p01_parent")
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({"nodes": [{
        "graph_node_id": "orphan-p01",
        "artifact_kind": "task",
        "phase_ref": "P01",
        "parent_feature": "missing-feature",
        "status": "active",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "implementation_readiness": {"status": "complete"},
        "depends_on": [],
        "tracker_binding": "none",
        "resource_scope": ["src/orphan.py"],
    }]}), encoding="utf-8")
    leases = tmp_path / "leases.json"
    leases.write_text('{"leases": []}', encoding="utf-8")

    with pytest.raises(schedule.ContractError, match="P01 task requires a graph parent_feature"):
        call_main(schedule, monkeypatch, capsys, "--graph", graph, "--leases", leases)


def test_schedule_candidate_coverage_accounts_for_active_lease_conflicts(tmp_path, monkeypatch, capsys):
    schedule = load("schedule-graph.py", "schedule_candidate_coverage_with_lease")
    graph = tmp_path / "graph.json"
    node = {
        "graph_node_id": "leased-ready-node",
        "artifact_kind": "task",
        "status": "active",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "implementation_readiness": {"status": "complete"},
        "depends_on": [],
        "tracker_binding": "none",
        "resource_scope": ["src/leased.py"],
    }
    graph.write_text(json.dumps({"nodes": [node]}), encoding="utf-8")
    leases = tmp_path / "leases.json"
    leases.write_text(json.dumps({"leases": [{
        "graph_node_id": "leased-ready-node",
        "resource_scope": ["src/leased.py"],
        "state": "claimed",
        "expires_at": "2099-01-01T00:00:00+00:00",
    }]}), encoding="utf-8")

    code, plan = call_main(schedule, monkeypatch, capsys, "--graph", graph, "--leases", leases)

    assert code == 0
    covered = set(plan["ready_set"]["tasks"]) | {
        row["external_ref"] for row in plan["unmapped"] if "external_ref" in row
    } | set(plan["conflicts"])
    assert covered == {"leased-ready-node"}
