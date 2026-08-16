from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

from test_operational_loop_v2 import load


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    code = module.main()
    output = capsys.readouterr().out.strip()
    return code, json.loads(output) if output else None


def render_metadata(document: str) -> dict:
    marker = '<script type="application/json" id="render-metadata">'
    _, found, remainder = document.partition(marker)
    assert found, "render-metadata script is missing"
    payload, found, _ = remainder.partition("</script>")
    assert found, "render-metadata script is not closed"
    return json.loads(payload)


def test_render_scope_containment_and_registration_receipt(tmp_path, monkeypatch, capsys):
    render = load("render-graph-html.py", "render_registration_verification")
    root = tmp_path
    graph = root / ".dev-graph" / "state" / "graph.json"
    graph.parent.mkdir(parents=True)
    nodes = [{
        "graph_node_id": "feature", "artifact_kind": "feature", "status": "active", "depends_on": [],
    }]
    digest = "a" * 64
    for index in range(1, 14):
        nodes.append({
            "graph_node_id": f"task-{index:02d}", "artifact_kind": "task",
            "status": "done" if index <= 4 else "active", "parent_feature": "feature", "depends_on": [],
            "source_lineage": {"source_digest": digest},
        })
    nodes.append({"graph_node_id": "outside", "artifact_kind": "issue", "status": "active", "depends_on": []})
    graph.write_bytes((json.dumps({"graph_revision": 1, "nodes": nodes}, sort_keys=True) + "\n").encode())
    receipt = root / ".dev-graph" / "registration.json"
    receipt.write_text(json.dumps({
        "parent_feature": "feature", "source_digest": f"sha256:{digest}",
        "expected_count": 13, "applied_count": 13,
        "node_ids": [f"task-{index:02d}" for index in range(1, 14)],
        "graph_digest_after": "sha256:" + hashlib.sha256(
            json.dumps(
                json.loads(graph.read_text()),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).hexdigest(),
    }), encoding="utf-8")
    code, rendered = call_main(
        render,
        monkeypatch,
        capsys,
        "--repo-root",
        root,
        "--graph",
        graph,
        "--scope",
        "feature",
        "--registration-receipt",
        receipt,
    )
    assert code == 0 and rendered["nodes"] == 14
    assert rendered["feature_progress"]["by_feature"]["feature"] == {"done": 4, "total": 13}
    assert rendered["registration"]["source_digest"] == f"sha256:{digest}"
    assert rendered["registration"]["applied_count"] == rendered["registration"]["expected_count"] == 13
    assert rendered["registration_verification"] == {
        "status": "verified", "reason": None, "graph_digest_match": True,
    }
    html = root / rendered["out_relative"]
    document = html.read_text()
    assert html.is_file() and "outside" not in document
    assert document.count(f"sha256:{digest}") >= 1
    assert "Registration verification: VERIFIED" in document
    assert render_metadata(document)["registration_verification"] == {
        "status": "verified", "reason": None, "graph_digest_match": True,
    }

    unverified_out = root / ".dev-graph" / "render" / "without-receipt.html"
    code, unverified = call_main(
        render,
        monkeypatch,
        capsys,
        "--repo-root",
        root,
        "--graph",
        graph,
        "--scope",
        "feature",
        "--out",
        unverified_out,
    )
    assert code == 0
    assert unverified["feature_progress"]["by_feature"]["feature"]["total"] == 13
    assert unverified["registration"] is None
    assert unverified["registration_verification"] == {
        "status": "not_performed",
        "reason": "registration_receipt_not_provided",
        "graph_digest_match": None,
    }
    unverified_document = unverified_out.read_text()
    assert "Registration verification: NOT PERFORMED" in unverified_document
    assert f"sha256:{digest}" not in unverified_document
    assert render_metadata(unverified_document)["registration_verification"] == {
        "status": "not_performed",
        "reason": "registration_receipt_not_provided",
        "graph_digest_match": None,
    }

    monkeypatch.setattr(
        sys,
        "argv",
        [
            str(SCRIPTS / "render-graph-html.py"),
            "--repo-root",
            str(root),
            "--graph",
            str(graph),
            "--out",
            str(root.parent / "outside.html"),
        ],
    )
    with pytest.raises(render.ContractError, match="escapes authority"):
        render.main()


def test_render_registration_receipt_stale_graph_digest_is_partial_not_fail_closed(tmp_path, monkeypatch, capsys):
    # HarnessHub-0ui0: receipt.graph_digest_after is bound to the graph revision at
    # registration time; a later sync always advances the graph before render runs in
    # the 11-verb dispatcher order, so this must degrade to an explicit partial match
    # instead of raising ContractError.
    render = load("render-graph-html.py", "render_registration_stale_digest")
    root = tmp_path
    graph = root / ".dev-graph" / "state" / "graph.json"
    graph.parent.mkdir(parents=True)
    nodes = [{
        "graph_node_id": "feature", "artifact_kind": "feature", "status": "active", "depends_on": [],
    }]
    digest = "a" * 64
    for index in range(1, 3):
        nodes.append({
            "graph_node_id": f"task-{index:02d}", "artifact_kind": "task",
            "status": "active", "parent_feature": "feature", "depends_on": [],
            "source_lineage": {"source_digest": digest},
        })
    graph.write_bytes((json.dumps({"graph_revision": 1101, "nodes": nodes}, sort_keys=True) + "\n").encode())
    receipt = root / ".dev-graph" / "registration.json"
    receipt.write_text(json.dumps({
        "parent_feature": "feature", "source_digest": f"sha256:{digest}",
        "expected_count": 2, "applied_count": 2,
        "node_ids": ["task-01", "task-02"],
        # Bound to a graph digest from before a later sync advanced the revision.
        "graph_digest_after": "sha256:" + "0" * 64,
    }), encoding="utf-8")
    code, rendered = call_main(
        render, monkeypatch, capsys,
        "--repo-root", root, "--graph", graph, "--scope", "feature",
        "--registration-receipt", receipt,
    )
    assert code == 0
    assert rendered["registration"]["applied_count"] == rendered["registration"]["expected_count"] == 2
    assert rendered["registration"]["graph_digest_match"] is False
    assert rendered["registration_verification"] == {
        "status": "partial", "reason": "graph_digest_stale", "graph_digest_match": "stale",
    }
    html = (root / rendered["out_relative"]).read_text()
    assert "Registration verification: PARTIAL" in html
    assert render_metadata(html)["registration_verification"] == {
        "status": "partial", "reason": "graph_digest_stale", "graph_digest_match": "stale",
    }


def test_render_task_scope_adds_parent_without_siblings():
    render = load("render-graph-html.py", "render_task_scope_contract")
    nodes = [
        {"graph_node_id": "feature", "artifact_kind": "feature", "depends_on": []},
        {"graph_node_id": "task-1", "artifact_kind": "task", "parent_feature": "feature", "depends_on": []},
        {"graph_node_id": "task-2", "artifact_kind": "task", "parent_feature": "feature", "depends_on": []},
    ]
    selected = render._scope_nodes(nodes, "task-1")
    assert {item["graph_node_id"] for item in selected} == {"feature", "task-1"}
