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


def load():
    name = "validate_graph_schema_c11_heading_readiness"
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / "validate-graph-schema.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_template_contract_copies_are_byte_identical():
    """HarnessHub-o4zi: 実行場所で heading 判定が分岐しない。"""
    root = PLUGIN.parents[1]
    canonical = (PLUGIN / "templates/template-contract.json").read_bytes()

    assert (root / ".dev-graph/templates/template-contract.json").read_bytes() == canonical
    assert (root / "plugin-plans/dev-graph/templates/template-contract.json").read_bytes() == canonical


@pytest.mark.parametrize(
    ("kind", "content_root"),
    [
        ("issue", "issues"),
        ("task", "tasks"),
        ("document", "docs"),
        ("specification", "specs"),
        ("architecture", "architecture"),
        ("feature", "features"),
    ],
)
def test_required_section_placeholders_make_readiness_incomplete(
    tmp_path, kind, content_root
):
    """HarnessHub-4t9g: template bodies and a body-crushing mutation must fail C11."""
    mod = load()
    canonical = json.loads((PLUGIN / "templates/template-contract.json").read_text(encoding="utf-8"))
    artifact_contract = {
        "placeholder_tokens": canonical["placeholder_tokens"],
        "common_frontmatter": {"required": []},
        "artifacts": {kind: canonical["artifacts"][kind]},
    }
    artifact = tmp_path / content_root / "placeholder.md"
    artifact.parent.mkdir()
    frontmatter = "\n".join([
        "---",
        f"graph_node_id: placeholder-{kind}",
        f"artifact_kind: {kind}",
        f"file_path: {content_root}/placeholder.md",
        f"template_id: {kind}",
        "template_version: 1.0.0",
        "---",
        "",
    ])
    template = (
        PLUGIN / "templates" / canonical["artifacts"][kind]["template"]
    ).read_text(encoding="utf-8")
    artifact.write_text(frontmatter + template, encoding="utf-8")
    node = {
        "graph_node_id": f"placeholder-{kind}",
        "artifact_kind": kind,
        "file_path": f"{content_root}/placeholder.md",
        "template_id": kind,
        "template_version": "1.0.0",
    }

    findings = mod.artifact_findings([node], tmp_path, artifact_contract)
    missing = canonical["artifacts"][kind]["required_sections"]
    expected_missing = set(missing)
    assert {item["code"] for item in findings} == {"placeholder_only_section"}
    assert {item["detail"] for item in findings} == expected_missing
    assert mod.readiness_missing_sections(findings) == sorted(expected_missing)

    filled = "\n".join(
        f"## {section}\n\n実装・検証済みの具体的内容。"
        + (" コマンド引数 `<feature-id>` は説明用の変数。" if section == "Handoff" else "")
        for section in missing
    )
    artifact.write_text(frontmatter + filled + "\n", encoding="utf-8")
    assert mod.artifact_findings([node], tmp_path, artifact_contract) == []

    crushed = "\n".join(f"## {section}\n" for section in missing)
    artifact.write_text(frontmatter + crushed + "\n", encoding="utf-8")
    mutated = mod.artifact_findings([node], tmp_path, artifact_contract)
    assert {item["detail"] for item in mutated} == set(missing)

    sentinel_target = missing[-1]
    sentinel_body = "\n".join(
        f"## {section}\n\n" + ("- TODO" if section == sentinel_target else "実装・検証済みの具体的内容。")
        for section in missing
    )
    artifact.write_text(frontmatter + sentinel_body + "\n", encoding="utf-8")
    sentinel_findings = mod.artifact_findings([node], tmp_path, artifact_contract)
    assert sentinel_findings == [{
        "node": f"placeholder-{kind}",
        "code": "placeholder_only_section",
        "detail": sentinel_target,
    }]

    fenced_target = missing[-1]
    fenced_body = "\n".join(
        f"## {section}\n\n"
        + (
            "```text\ncanonical template example only\n```"
            if section == fenced_target
            else "実装・検証済みの具体的内容。"
        )
        for section in missing
    )
    artifact.write_text(frontmatter + fenced_body + "\n", encoding="utf-8")
    fenced_findings = mod.artifact_findings([node], tmp_path, artifact_contract)
    assert fenced_findings == [{
        "node": f"placeholder-{kind}",
        "code": "placeholder_only_section",
        "detail": fenced_target,
    }]


def test_heading_missing_blocks_specification_readiness_when_heading_absent(tmp_path):
    """HarnessHub-85z0: a required heading that was never written must fail C11.

    placeholder_only_section only inspects headings that already exist; a
    heading absent from the body entirely was invisible to readiness checks
    before this test's subject (heading_missing) existed.
    """
    mod = load()
    canonical = json.loads((PLUGIN / "templates/template-contract.json").read_text(encoding="utf-8"))
    artifact_contract = {
        "placeholder_tokens": canonical["placeholder_tokens"],
        "common_frontmatter": {"required": []},
        "artifacts": {"specification": canonical["artifacts"]["specification"]},
    }
    artifact = tmp_path / "specs" / "spec.md"
    artifact.parent.mkdir()
    frontmatter = "\n".join([
        "---",
        "graph_node_id: placeholder-specification",
        "artifact_kind: specification",
        "file_path: specs/spec.md",
        "template_id: specification",
        "template_version: 1.0.0",
        "---",
        "",
    ])
    node = {
        "graph_node_id": "placeholder-specification",
        "artifact_kind": "specification",
        "file_path": "specs/spec.md",
        "template_id": "specification",
        "template_version": "1.0.0",
    }
    required = canonical["artifacts"]["specification"]["required_sections"]

    # Only the first required heading is ever written; the rest are absent.
    artifact.write_text(frontmatter + f"# {required[0]}\n\n本文。\n", encoding="utf-8")
    findings = mod.artifact_findings([node], tmp_path, artifact_contract)
    assert {item["code"] for item in findings} == {"heading_missing"}
    assert {item["detail"] for item in findings} == set(required[1:])
    assert mod.readiness_missing_sections(findings) == sorted(set(required[1:]))

    # Writing every required heading with substantive content clears the gate.
    filled = "\n".join(f"## {section}\n\n実装・検証済みの具体的内容。" for section in required)
    artifact.write_text(frontmatter + filled + "\n", encoding="utf-8")
    assert mod.artifact_findings([node], tmp_path, artifact_contract) == []


def test_heading_missing_resolves_system_dev_planner_task_variants(tmp_path):
    """system-dev-planner 由来 task は conditional_required_sections の複数 variant
    (HarnessHub-yzv0 実測: 20 feature 中 17 が軽量3見出し `system_development_baseline`、
    3 がフル19見出し `system_development`) のいずれかに一致すれば heading_missing なし。
    manual origin の task は base required_sections で従来通り検査される。"""
    mod = load()
    assert "task" in mod.HEADING_MISSING_KINDS

    canonical = json.loads((PLUGIN / "templates/template-contract.json").read_text(encoding="utf-8"))
    artifact_contract = {
        "placeholder_tokens": canonical["placeholder_tokens"],
        "common_frontmatter": {"required": []},
        "artifacts": {"task": canonical["artifacts"]["task"]},
    }

    def frontmatter_for(node_id: str, path: str) -> str:
        return "\n".join([
            "---",
            f"graph_node_id: {node_id}",
            "artifact_kind: task",
            f"file_path: {path}",
            "template_id: task",
            "template_version: 1.0.0",
            "---",
            "",
        ])

    baseline = tmp_path / "tasks" / "baseline.md"
    baseline.parent.mkdir()
    baseline.write_text(
        frontmatter_for("baseline-task", "tasks/baseline.md")
        + "## 正本仕様書\n\n参照。\n\n## 依存\n\nfeature内依存なし。\n\n## 実行契約\n\n契約本文。\n",
        encoding="utf-8",
    )
    baseline_node = {
        "graph_node_id": "baseline-task",
        "artifact_kind": "task",
        "file_path": "tasks/baseline.md",
        "template_id": "task",
        "template_version": "1.0.0",
        "source_lineage": {"origin_kind": "system-dev-planner"},
    }

    incomplete = tmp_path / "tasks" / "incomplete.md"
    incomplete.write_text(
        frontmatter_for("incomplete-task", "tasks/incomplete.md") + "## 依存\n\nfeature内依存なし。\n",
        encoding="utf-8",
    )
    incomplete_node = {
        "graph_node_id": "incomplete-task",
        "artifact_kind": "task",
        "file_path": "tasks/incomplete.md",
        "template_id": "task",
        "template_version": "1.0.0",
        "source_lineage": {"origin_kind": "system-dev-planner"},
    }

    findings = mod.artifact_findings([baseline_node, incomplete_node], tmp_path, artifact_contract)
    by_node = {}
    for item in findings:
        if item["code"] == "heading_missing":
            by_node.setdefault(item["node"], []).append(item["detail"])
    assert "baseline-task" not in by_node
    assert set(by_node["incomplete-task"]) == {"正本仕様書", "実行契約"}


def test_architecture_is_subject_to_heading_missing_like_specification(tmp_path):
    """architecture も heading gate 対象にし、要件定義 import だけを条件付きで受理する。"""
    mod = load()
    assert mod.HEADING_MISSING_KINDS == {"architecture", "specification", "task"}

    canonical = json.loads((PLUGIN / "templates/template-contract.json").read_text(encoding="utf-8"))
    artifact_contract = {
        "placeholder_tokens": canonical["placeholder_tokens"],
        "common_frontmatter": {"required": []},
        "artifacts": {"architecture": canonical["artifacts"]["architecture"]},
    }
    required = canonical["artifacts"]["architecture"]["required_sections"]

    def frontmatter_for(node_id: str, path: str) -> str:
        return "\n".join([
            "---",
            f"graph_node_id: {node_id}",
            "artifact_kind: architecture",
            f"file_path: {path}",
            "template_id: architecture",
            "template_version: 1.0.0",
            "---",
            "",
        ])

    bare = tmp_path / "architecture" / "bare.md"
    bare.parent.mkdir()
    bare.write_text(
        frontmatter_for("bare-arch", "architecture/bare.md")
        + "# 章 wrapper\n\n## 正本 (source of truth)\n\n参照。\n",
        encoding="utf-8",
    )
    bare_node = {
        "graph_node_id": "bare-arch",
        "artifact_kind": "architecture",
        "file_path": "architecture/bare.md",
        "template_id": "architecture",
        "template_version": "1.0.0",
        "source_lineage": {
            "origin_kind": "system-spec-harness",
            "source_path": "system-spec/testing-qa.md",
        },
    }
    findings = mod.artifact_findings([bare_node], tmp_path, artifact_contract)
    assert {item["code"] for item in findings} == {"heading_missing"}
    assert {item["detail"] for item in findings} == set(required)

    requirements = tmp_path / "architecture" / "requirements.md"
    requirements.write_text(
        frontmatter_for("req-arch", "architecture/requirements.md")
        + "".join(
            f"## {section}\n\n実装・検証済みの具体的内容。\n\n"
            for section in canonical["artifacts"]["architecture"]["conditional_required_sections"][
                "system_spec_requirements"
            ]
        ),
        encoding="utf-8",
    )
    requirements_node = {
        "graph_node_id": "req-arch",
        "artifact_kind": "architecture",
        "file_path": "architecture/requirements.md",
        "template_id": "architecture",
        "template_version": "1.0.0",
        "source_lineage": {
            "origin_kind": "system-spec-harness",
            "source_path": "system-spec/00-requirements-definition.md",
        },
    }
    assert mod.artifact_findings([requirements_node], tmp_path, artifact_contract) == []
