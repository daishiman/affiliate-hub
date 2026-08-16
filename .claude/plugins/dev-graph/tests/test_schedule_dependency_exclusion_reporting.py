"""schedule-graph.py の依存未充足除外報告 (HarnessHub-fcth) の回帰テスト。

守る不変条件: ready 判定ループが除外する 3 つの理由 (選択外・非 schedulable・
依存未充足) は条件式上で分離され、依存未充足だけが無言の continue で握り潰されない。
除外された node は unmapped[] へ reason="dependency_unsatisfied" と
blocking_depends_on を伴って機械可読に報告される (execution-tracker-contract.md §10)。
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

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


def test_schedule_reports_unsatisfied_dependencies_without_misclassifying_other_exclusions(
    tmp_path, monkeypatch, capsys,
):
    schedule = load("schedule-graph.py", "schedule_dependency_exclusion_report")
    graph = tmp_path / "graph.json"
    base = {
        "artifact_kind": "task",
        "status": "active",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "implementation_readiness": {"status": "complete"},
        "tracker_binding": "none",
        "parent_feature": "selected-feature",
    }
    graph.write_text(json.dumps({"nodes": [
        {
            "artifact_kind": "feature",
            "graph_node_id": "selected-feature",
            "status": "draft",
            "depends_on": [],
        },
        {
            "artifact_kind": "feature",
            "graph_node_id": "outside-feature",
            "status": "draft",
            "depends_on": [],
        },
        {
            **base,
            "graph_node_id": "upstream-open",
            "depends_on": [],
            "resource_scope": ["src/upstream.py"],
        },
        {
            **base,
            "graph_node_id": "blocked",
            "depends_on": ["upstream-open"],
            "resource_scope": ["src/blocked.py"],
        },
        {
            **base,
            "graph_node_id": "not-schedulable",
            "evaluation_status": "pending",
            "depends_on": ["upstream-open"],
            "resource_scope": ["src/not-schedulable.py"],
        },
        {
            **base,
            "graph_node_id": "outside-selection",
            "parent_feature": "outside-feature",
            "depends_on": ["upstream-open"],
            "resource_scope": ["src/outside-selection.py"],
        },
        {
            **base,
            "graph_node_id": "ready",
            "depends_on": [],
            "resource_scope": ["src/ready.py"],
        },
    ]}), encoding="utf-8")
    leases = tmp_path / "leases.json"
    leases.write_text(json.dumps({"leases": []}), encoding="utf-8")

    code, plan = call_main(
        schedule, monkeypatch, capsys,
        "--graph", graph, "--leases", leases, "--scope", "selected-feature",
    )

    assert code == 0
    assert plan["ready_set"]["tasks"] == ["ready", "upstream-open"]
    assert plan["unmapped"] == [{
        "external_ref": "blocked",
        "reason": "dependency_unsatisfied",
        "blocking_depends_on": ["upstream-open"],
        "source": "schedule-graph",
    }]
