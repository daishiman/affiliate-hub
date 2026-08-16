"""lint-open-residue.py (qa-067 要件1 / design §2) の検証。

test-plan.md の OR-D* (MUST_DETECT) / OR-P* (MUST_PASS) / OR-C* (契約) を実行する。
beads は --beads-export の JSONL で注入する。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "lint-open-residue.py"


def _fm(node: dict) -> str:
    keys = sorted(node.keys())
    lines = ["---"]
    for k in keys:
        lines.append(f"{k}: {json.dumps(node[k], ensure_ascii=False, sort_keys=True, separators=(',', ':'))}")
    lines += ["---", "", "# body", ""]
    return "\n".join(lines)


def _node(node_id: str, *, status="closed", ce_status="done", bd_id="HarnessHub-x",
          kind="issue", file_rel=None, policy="manual") -> dict:
    n = {
        "graph_node_id": node_id,
        "artifact_kind": kind,
        "status": status,
        "tracker_binding": "beads",
        "beads_linkage": {"bd_issue_id": bd_id, "linked_at": "2026-07-22T00:00:00Z", "sync_state": "linked"},
        "completion_evidence": {
            "policy": policy, "status": ce_status, "source": None,
            "completed_at": None, "reconciled_at": None, "evidence_refs": [],
        },
        "file_path": file_rel or f"issues/{node_id}.md",
    }
    return n


def _repo(tmp_path: Path, nodes: list[dict], beads: dict[str, str]) -> tuple[Path, Path]:
    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    (root / ".dev-graph" / "state" / "graph.json").write_text(
        json.dumps({"schema_version": "1", "nodes": nodes}), encoding="utf-8")
    for n in nodes:
        fp = root / n["file_path"]
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(_fm(n), encoding="utf-8")
    export = root / "beads.jsonl"
    export.write_text("\n".join(json.dumps({"id": k, "status": v}) for k, v in beads.items()), encoding="utf-8")
    return root, export


def _run(root: Path, export: Path | None, *extra: str) -> tuple[int, dict]:
    args = [sys.executable, str(SCRIPT), "--repo-root", str(root)]
    if export is not None:
        args += ["--beads-export", str(export)]
    args += list(extra)
    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    return proc.returncode, json.loads(proc.stdout)


# --- MUST_DETECT ---

def test_or_d01_status_mismatch(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="active", ce_status="done")]
    # md status を graph と食い違わせる
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    front = nodes[0].copy(); front["status"] = "closed"
    (root / nodes[0]["file_path"]).write_text(_fm(front), encoding="utf-8")
    code, out = _run(root, export)
    assert code == 2 and any(v["rule"] == "OR-001" for v in out["violations"])


def test_or_d02_completion_evidence_mismatch(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="open")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "open"})
    front = json.loads(json.dumps(nodes[0]))
    front["completion_evidence"]["status"] = "done"
    (root / nodes[0]["file_path"]).write_text(_fm(front), encoding="utf-8")
    code, out = _run(root, export)
    assert code == 2 and any(v["rule"] == "OR-002" for v in out["violations"])


def test_or_d03_resolved_open_residue(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="open")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    code, out = _run(root, export)
    assert code == 2 and any(v["rule"] == "OR-003" for v in out["violations"])


def test_or_d04_reverse_residue(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="done", ce_status="done")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "open"})
    code, out = _run(root, export)
    assert code == 2 and any(v["rule"] == "OR-004" for v in out["violations"])


def test_or_d05_beads_unavailable_fail_closed(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="done")]
    root, _ = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    # export を渡さず、.beads も bd も無い → require_beads (既定) で exit 2。
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 2
    out = json.loads(proc.stdout)
    assert out["beads_axis"] == "unavailable" and out["exit_code"] == 2
    assert "FAIL" in proc.stderr


def test_or_d06_combined_status_and_residue_detection(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="active", ce_status="open")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    front = json.loads(json.dumps(nodes[0])); front["status"] = "closed"
    (root / nodes[0]["file_path"]).write_text(_fm(front), encoding="utf-8")
    code, out = _run(root, export)
    assert code == 2
    assert {v["rule"] for v in out["violations"]} == {"OR-001", "OR-003"}


# --- MUST_PASS ---

def test_or_p01_all_consistent(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="done")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    code, out = _run(root, export)
    assert code == 0 and out["violation_count"] == 0


def test_or_p02_closed_doc_inprogress_execution_not_violation(tmp_path: Path) -> None:
    # status=closed かつ ce=in_progress かつ beads も未 close → 矛盾ではない
    nodes = [_node("issue-a", status="closed", ce_status="in_progress")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "open"})
    code, out = _run(root, export)
    assert code == 0, out["violations"]


def test_or_p03_non_beads_node_is_not_scanned(tmp_path: Path) -> None:
    node = _node("issue-a", status="closed", ce_status="open")
    node["tracker_binding"] = "github"
    root, export = _repo(tmp_path, [node], {"HarnessHub-x": "closed"})
    code, out = _run(root, export)
    assert code == 0 and out["scanned"] == 0


def test_or_p04_no_require_beads(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="open")]
    root, _ = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    code, out = _run(root, None, "--no-require-beads")
    assert code == 0  # OR-003 は未評価
    assert out["beads_axis"] == "unavailable"


def test_or_p05_not_applicable_settled(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="not_applicable")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    code, out = _run(root, export)
    assert code == 0


def test_or_p06_local_only_manual_policy_settles_after_close_loop(tmp_path: Path) -> None:
    """local_only 運用 (PR 0件) の node が close-loop を完走した終状態を残置にしない。

    PR を持たない node に `linked_pr_merged_all|any` を残すと graph-node.schema.json が
    `status=done` に merged な pull_request_linkages を 1 件以上要求するため、
    completion_evidence が永久に done へ到達できず beads だけ closed になって OR-003 が
    構造的に再発する (HarnessHub-n7gw)。`policy=manual` なら到達でき、その終状態は残置ではない。
    """
    node = _node("issue-local-only", status="closed", ce_status="done", policy="manual")
    node["github_publication"] = {
        "mode": "local_only",
        "project_aliases": [],
        "labels": [],
        "milestone": None,
    }
    node["pull_request_linkages"] = []
    node["completion_evidence"]["source"] = "manual"
    node["completion_evidence"]["completed_at"] = "2026-07-26T00:00:00Z"
    node["completion_evidence"]["reconciled_at"] = "2026-07-26T00:00:00Z"
    root, export = _repo(tmp_path, [node], {"HarnessHub-x": "closed"})
    code, out = _run(root, export)
    assert code == 0 and out["violation_count"] == 0
    # 走査から外して緑にする逃げ (偽の解決) を塞ぐ: 検査されたうえで違反 0 であること。
    assert out["scanned"] == 1


# --- 契約 ---

def test_or_c02_deterministic_across_node_order(tmp_path: Path) -> None:
    a = _node("issue-a", status="closed", ce_status="open", bd_id="HarnessHub-a")
    b = _node("issue-b", status="closed", ce_status="open", bd_id="HarnessHub-b")
    root1, e1 = _repo(tmp_path / "1", [a, b], {"HarnessHub-a": "closed", "HarnessHub-b": "closed"})
    root2, e2 = _repo(tmp_path / "2", [b, a], {"HarnessHub-a": "closed", "HarnessHub-b": "closed"})
    _, o1 = _run(root1, e1)
    _, o2 = _run(root2, e2)
    assert o1["violations"] == o2["violations"]


def test_or_c04_repeated_stdout_is_byte_identical(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="open")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    args = [sys.executable, str(SCRIPT), "--repo-root", str(root), "--beads-export", str(export)]
    first = subprocess.run(args, capture_output=True, check=False).stdout
    second = subprocess.run(args, capture_output=True, check=False).stdout
    assert first == second


def test_or_c01_c03_common_shape_and_relative_paths(tmp_path: Path) -> None:
    nodes = [_node("issue-a", status="closed", ce_status="open")]
    root, export = _repo(tmp_path, nodes, {"HarnessHub-x": "closed"})
    _, out = _run(root, export)
    assert {"lint", "repo_root", "scanned", "violations", "violation_count", "exit_code"} <= set(out)
    assert out["repo_root"] == "."
    assert all(not Path(v["path"]).is_absolute() for v in out["violations"])
