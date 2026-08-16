from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPT = PLUGIN / "scripts" / "build-graph-store.py"
GRAPH_RELATIVE = Path(".dev-graph/state/graph.json")


def repo(tmp_path: Path) -> Path:
    root = tmp_path / "caller"
    (root / ".dev-graph").mkdir(parents=True)
    (root / ".dev-graph/config.json").write_text(
        json.dumps(
            {
                "repository_id": "local:sha256:" + "a" * 64,
                "local_state": {"graph": GRAPH_RELATIVE.as_posix()},
            }
        ),
        encoding="utf-8",
    )
    return root


def run(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def test_create_then_preserve_is_atomic_and_idempotent(tmp_path: Path) -> None:
    root = repo(tmp_path)
    graph = root / GRAPH_RELATIVE

    created = run(root)
    assert created.returncode == 0, created.stderr
    first = json.loads(created.stdout)
    document = json.loads(graph.read_text(encoding="utf-8"))
    assert first["action"] == "created"
    assert first["changed"] is True
    assert document == {
        "schema_version": "1.0.0",
        "repository_id": "local:sha256:" + "a" * 64,
        "graph_revision": 0,
        "nodes": [],
    }
    before = graph.read_bytes()

    preserved = run(root)
    assert preserved.returncode == 0, preserved.stderr
    assert json.loads(preserved.stdout)["action"] == "preserved_existing"
    assert graph.read_bytes() == before


def test_dry_run_reports_creation_without_writing(tmp_path: Path) -> None:
    root = repo(tmp_path)
    graph = root / GRAPH_RELATIVE

    result = run(root, "--dry-run")

    assert result.returncode == 0, result.stderr
    receipt = json.loads(result.stdout)
    assert (receipt["action"], receipt["changed"]) == ("would_create", False)
    assert not graph.exists()


def test_noncanonical_existing_store_is_rejected_without_repair(tmp_path: Path) -> None:
    root = repo(tmp_path)
    graph = root / GRAPH_RELATIVE
    graph.parent.mkdir(parents=True)
    original = {
        "schema_version": "1.0.0",
        "repository_id": "local:sha256:" + "a" * 64,
        "graph_revision": 0,
        "nodes": [],
        "metadata": {"bypass": True},
    }
    graph.write_text(json.dumps(original), encoding="utf-8")

    result = run(root)

    assert result.returncode == 1
    receipt = json.loads(result.stdout)
    assert receipt["action"] == "rejected_existing"
    assert receipt["changed"] is False
    assert json.loads(graph.read_text(encoding="utf-8")) == original


def test_repository_identity_mismatch_is_rejected(tmp_path: Path) -> None:
    root = repo(tmp_path)
    graph = root / GRAPH_RELATIVE
    graph.parent.mkdir(parents=True)
    graph.write_text(
        json.dumps(
            {
                "schema_version": "1.0.0",
                "repository_id": "github:other/repo",
                "graph_revision": 0,
                "nodes": [],
            }
        ),
        encoding="utf-8",
    )

    result = run(root)

    assert result.returncode == 1
    assert "repository_id must match repo config" in result.stdout


def test_config_must_route_to_the_canonical_graph_path(tmp_path: Path) -> None:
    root = repo(tmp_path)
    config = json.loads((root / ".dev-graph/config.json").read_text())
    config["local_state"]["graph"] = ".dev-graph/state/other.json"
    (root / ".dev-graph/config.json").write_text(json.dumps(config))

    result = run(root)

    assert result.returncode == 2
    assert "must name the canonical" in result.stderr
    assert not (root / GRAPH_RELATIVE).exists()
