from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN / "scripts"


def _schema_valid_issue_node(graph_node_id: str, file_path: str) -> dict:
    """Borrow a schema-valid issue node, changing only the identifier and artifact path."""
    canonical = PLUGIN.parents[1] / ".dev-graph" / "state" / "graph.json"
    document = json.loads(canonical.read_text(encoding="utf-8"))
    template = next(node for node in document["nodes"] if node.get("artifact_kind") == "issue")
    node = dict(template)
    node["graph_node_id"] = graph_node_id
    node["file_path"] = file_path
    node["depends_on"] = []
    node["related_nodes"] = []
    return node


def test_file_path_graph_rejects_not_yet_written_artifact(tmp_path) -> None:
    """Canonical file validation keeps artifact_missing fail-closed."""
    root = tmp_path / "repo"
    state = root / ".dev-graph" / "state"
    state.mkdir(parents=True)
    node = _schema_valid_issue_node("not-yet-written", "issues/not-yet-written.md")
    graph_path = state / "graph.json"
    graph_path.write_text(json.dumps({"nodes": [node]}), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / "validate-graph-schema.py"),
         "--graph", str(graph_path), "--repo-root", str(root)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 1, proc.stderr
    result = json.loads(proc.stdout)
    assert result["valid"] is False
    assert {"node": "not-yet-written", "code": "artifact_missing", "detail": "issues/not-yet-written.md"} in result["violations"]


def test_preview_stdin_skips_artifact_missing_for_not_yet_written_node(tmp_path) -> None:
    """Dry-run stdin previews skip only absent, not-yet-written artifacts (HarnessHub-3tw)."""
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    node = _schema_valid_issue_node("not-yet-written", "issues/not-yet-written.md")
    preview = json.dumps({"nodes": [node]})
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / "validate-graph-schema.py"),
         "--graph", "-", "--repo-root", str(root)],
        input=preview, capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout)["valid"] is True
