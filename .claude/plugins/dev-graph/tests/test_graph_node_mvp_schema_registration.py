"""qa-069 AC-3: MVP 判断軸 metadata 付き node の schema 登録検証 (C5)。

goal-spec acceptance 3 件目「MVP 判断軸 metadata (目的・背景・MVP 適合度) を持つ task node を
検証用グラフへ登録すると validate-graph-schema.py が PASS する」を直接カバーする。
裏面として、enum 外の mvp_fit / 未知キー / required サブフィールド欠落は FAIL し、
省略・null は既存 node を invalid 化しない (後方互換) ことを固定する。
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def load(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def call_main(module, monkeypatch, capsys, *argv):
    monkeypatch.setattr(sys, "argv", [str(module.__file__), *map(str, argv)])
    monkeypatch.setattr(sys, "stdin", io.StringIO("{}"))
    code = module.main()
    output = capsys.readouterr().out.strip()
    return code, json.loads(output) if output else None


MVP_ALIGNMENT = {
    "mvp_fit": "direct",
    "purpose": "動くMVPを最短で出すための中核機能",
    "background": "qa-069: 品質系タスクが先に選定されMVPが後回しになった",
    "rationale": "ユーザー価値に直結する経路のためdirect",
}


def task_node(node_id: str, mvp=...) -> dict:
    """graph-node.schema.json を満たす完全な standalone task node (parent_feature=null)。

    parent_feature を null にすると allOf(task) が feature_package_id/phase_ref の null を
    要求するだけで、feature 側の exact-13 検査や dangling 参照検査に依存せず単体登録できる。
    """
    now = "2026-07-20T00:00:00Z"
    file_path = f"tasks/{node_id}.md"
    data = {
        "graph_node_id": node_id,
        "artifact_kind": "task",
        "artifact_subtypes": [],
        "title": "MVP metadata task",
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
        "resource_scope": [file_path],
        "purpose": None,
        "goal": None,
        "scope_in": [],
        "scope_out": [],
        "acceptance": [],
        "architecture_refs": [],
        "parent_feature": None,
        "feature_package_id": None,
        "phase_ref": None,
        "file_path": file_path,
        "template_id": "task",
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
        "classification_reason": "mvp schema registration fixture",
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
    if mvp is not ...:
        data["mvp_alignment"] = mvp
    return data


# task_node() の source_lineage.origin_kind は "manual" 固定のため、C11 は
# conditional_required_sections ではなく base required_sections (13 見出し) を
# そのまま要求する (HarnessHub-yzv0 で task を HEADING_MISSING_KINDS へ追加)。
_TASK_REQUIRED_SECTIONS = [
    "目的", "背景", "入力と前提条件", "出力と成果物", "依存関係", "実装対象",
    "Write scope と競合制約", "GitHub publication", "実行手順", "受入条件",
    "検証方法", "リスクとロールバック", "Handoff",
]


def write_artifact(root: Path, node: dict) -> None:
    """artifact 実在 + frontmatter 46 required key + 5 key parity を満たす md を書く。"""
    lines = ["---"]
    lines.extend(
        f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in node.items()
    )
    lines.extend(["---", "", "# task", "", "MVP schema registration fixture."])
    for section in _TASK_REQUIRED_SECTIONS:
        lines.extend(["", f"## {section}", "", "MVP schema registration fixture の検証用の実文。"])
    target = root / node["file_path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_validate(monkeypatch, capsys, tmp_path: Path, nodes: list[dict], name: str):
    module = load("validate-graph-schema.py", name)
    for node in nodes:
        write_artifact(tmp_path, node)
    graph = tmp_path / "graph.json"
    graph.write_text(json.dumps({"nodes": nodes}), encoding="utf-8")
    return call_main(module, monkeypatch, capsys, "--graph", graph, "--repo-root", tmp_path)


def test_schema_reg_mvp_metadata_task_passes(tmp_path, monkeypatch, capsys):
    """TC-MVP-SCHEMA-REG-01: 目的・背景・MVP 適合度を持つ task の登録が PASS (goal-spec AC 3)。"""
    code, report = run_validate(
        monkeypatch, capsys, tmp_path,
        [task_node("task-mvp-full", mvp=dict(MVP_ALIGNMENT))], "mvp_schema_pass")
    assert code == 0
    assert report["valid"] is True and report["violations"] == []


def test_schema_reg_unknown_enum_value_fails(tmp_path, monkeypatch, capsys):
    """TC-MVP-SCHEMA-REG-02: mvp_fit="urgent" (enum 外) は subschema enum で FAIL (design F-4)。"""
    code, report = run_validate(
        monkeypatch, capsys, tmp_path,
        [task_node("task-mvp-enum", mvp={**MVP_ALIGNMENT, "mvp_fit": "urgent"})], "mvp_schema_enum")
    assert code == 1
    assert any(
        item["code"] == "schema_violation" and "mvp_fit" in item["detail"]
        for item in report["violations"]
    )


def test_schema_reg_unknown_property_fails(tmp_path, monkeypatch, capsys):
    """TC-MVP-SCHEMA-REG-03: mvp_alignment 内の未知キーは additionalProperties: false で FAIL。"""
    code, report = run_validate(
        monkeypatch, capsys, tmp_path,
        [task_node("task-mvp-extra", mvp={**MVP_ALIGNMENT, "priority": "high"})], "mvp_schema_extra")
    assert code == 1
    assert any(
        item["code"] == "schema_violation" and "priority" in item["detail"]
        for item in report["violations"]
    )


def test_schema_reg_omitted_and_null_pass(tmp_path, monkeypatch, capsys):
    """TC-MVP-SCHEMA-REG-04: 省略 / null は PASS — 既存 node を invalid 化しない (後方互換)。"""
    code, report = run_validate(
        monkeypatch, capsys, tmp_path,
        [task_node("task-mvp-omitted"), task_node("task-mvp-null", mvp=None)], "mvp_schema_compat")
    assert code == 0
    assert report["valid"] is True and report["violations"] == []


def test_schema_reg_missing_required_subfield_fails(tmp_path, monkeypatch, capsys):
    """TC-MVP-SCHEMA-REG-05: purpose 欠落は required で FAIL — 判断根拠を欠いた登録を許さない。"""
    partial = {key: value for key, value in MVP_ALIGNMENT.items() if key != "purpose"}
    code, report = run_validate(
        monkeypatch, capsys, tmp_path,
        [task_node("task-mvp-partial", mvp=partial)], "mvp_schema_required")
    assert code == 1
    assert any(
        item["code"] == "schema_violation" and "purpose" in item["detail"]
        for item in report["violations"]
    )
