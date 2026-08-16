from __future__ import annotations

import builtins
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
    name = "validate_graph_schema_c11_focused"
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / "validate-graph-schema.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def codes(findings: list[dict[str, str]]) -> set[str]:
    return {item["code"] for item in findings}


def test_fallback_validator_exercises_supported_draft_boundaries(monkeypatch):
    mod = load()
    assert mod._is_type(object(), "future-type") is True
    assert mod._format_ok("2026-07-13", "date") is True
    assert mod._format_ok("2026-07-13T12:30:00Z", "date-time") is True
    assert mod._format_ok("https://example.test/x", "uri") is True
    assert mod._format_ok("not-a-date", "date") is False
    assert mod._format_ok("not-a-datetime", "date-time") is False
    assert mod._format_ok("relative", "uri") is False

    assert mod._schema_fallback("x", True, {}) == []
    assert "forbidden" in mod._schema_fallback("x", False, {})[0][1]
    assert "invalid schema" in mod._schema_fallback("x", [], {})[0][1]
    assert "external schema" in mod._schema_fallback("x", {"$ref": "other.json"}, {})[0][1]
    assert "unresolved schema" in mod._schema_fallback("x", {"$ref": "#/missing"}, {})[0][1]

    schema = {
        "$defs": {"identifier": {"type": "string", "minLength": 2, "pattern": "^ID"}},
        "allOf": [{"type": "object"}],
        "type": "object",
        "required": ["identifier", "required_when_enabled"],
        "properties": {
            "identifier": {"$ref": "#/$defs/identifier"},
            "enabled": {"type": "boolean"},
            "required_when_enabled": {"type": ["string", "null"]},
            "choice": {"enum": ["a", "b"]},
            "fixed": {"const": "fixed"},
            "day": {"type": "string", "format": "date"},
            "instant": {"type": "string", "format": "date-time"},
            "url": {"type": "string", "format": "uri"},
            "number": {"type": "number", "minimum": 1, "maximum": 3},
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 3,
                "uniqueItems": True,
                "items": {"type": "integer"},
                "contains": {"const": 7},
            },
        },
        "additionalProperties": False,
        "if": {"properties": {"enabled": {"const": True}}},
        "then": {"required": ["required_when_enabled"]},
    }
    invalid = {
        "identifier": "x",
        "enabled": True,
        "choice": "c",
        "fixed": "wrong",
        "day": "bad",
        "instant": "bad",
        "url": "relative",
        "number": 0,
        "items": [1, 1, "bad", 9],
        "extra": "forbidden",
    }
    messages = [detail for _, detail in mod._schema_fallback(invalid, schema, schema)]
    for fragment in (
        "missing required property",
        "string is shorter",
        "does not match",
        "not in enum",
        "expected const",
        "invalid date",
        "invalid date-time",
        "invalid uri",
        "below minimum",
        "too many items",
        "items are not unique",
        "expected type",
        "contains constraint",
        "unknown properties",
    ):
        assert any(fragment in message for message in messages), fragment

    assert any("above maximum" in detail for _, detail in mod._schema_fallback(4, {"maximum": 3}, {}))
    assert any("too few items" in detail for _, detail in mod._schema_fallback([], {"minItems": 1}, {}))
    assert mod._schema_fallback([7], {"contains": {"const": 7}}, {}) == []
    assert mod._schema_fallback({"x": 1}, {"additionalProperties": {"type": "integer"}}, {}) == []

    real_import = builtins.__import__

    def without_jsonschema(name, *args, **kwargs):
        if name == "jsonschema":
            raise ImportError("focused fallback exercise")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_jsonschema)
    fallback = mod.schema_findings({"id": "x"}, {"type": "object", "required": ["status"]}, 0)
    assert fallback == [{"node": "x", "code": "schema_violation", "detail": "$: missing required property status"}]


def test_frontmatter_repo_root_and_artifact_failure_classification(tmp_path):
    mod = load()
    assert mod._scalar(" true ") is True
    assert mod._scalar("'quoted'") == "quoted"
    assert mod._scalar('"double quoted"') == "double quoted"
    assert mod._scalar("bare") == "bare"

    with pytest.raises(mod.ContractError, match="cannot read artifact"):
        mod.frontmatter_of(tmp_path / "absent.md")
    no_frontmatter = tmp_path / "plain.md"
    no_frontmatter.write_text("plain\n", encoding="utf-8")
    with pytest.raises(mod.ContractError, match="no YAML frontmatter"):
        mod.frontmatter_of(no_frontmatter)
    unterminated = tmp_path / "unterminated.md"
    unterminated.write_text("---\nid: one\nignored line\n", encoding="utf-8")
    with pytest.raises(mod.ContractError, match="not terminated"):
        mod.frontmatter_of(unterminated)

    graph = tmp_path / ".dev-graph" / "state" / "graph.json"
    graph.parent.mkdir(parents=True)
    graph.write_text('{"nodes": []}\n', encoding="utf-8")
    assert mod._repo_root_for(graph, None) == tmp_path
    assert mod._repo_root_for(graph, str(tmp_path)) == tmp_path
    outside = tmp_path.parent / f"{tmp_path.name}-outside.json"
    outside.write_text("[]\n", encoding="utf-8")
    try:
        with pytest.raises(mod.ContractError, match="outside the canonical"):
            mod._repo_root_for(outside, None)
        with pytest.raises(mod.ContractError, match="escapes authority root"):
            mod._repo_root_for(outside, str(tmp_path))
    finally:
        outside.unlink()

    contract = {"common_frontmatter": {"required": ["graph_node_id", "title"]}}
    missing = {"graph_node_id": "missing", "artifact_kind": "issue", "file_path": "issues/missing.md"}
    result = mod.artifact_findings([missing], tmp_path, contract)
    assert result == [{"node": "missing", "code": "artifact_missing", "detail": "issues/missing.md"}]
    assert mod.artifact_findings([missing], tmp_path, contract, allow_missing_artifacts=True) == []

    invalid_frontmatter = tmp_path / "issues" / "invalid.md"
    invalid_frontmatter.parent.mkdir()
    invalid_frontmatter.write_text("not frontmatter\n", encoding="utf-8")
    invalid = {"graph_node_id": "invalid", "artifact_kind": "issue", "file_path": "issues/invalid.md"}
    assert "frontmatter_invalid" in codes(mod.artifact_findings([invalid], tmp_path, contract))

    mismatched = tmp_path / "issues" / "mismatch.md"
    mismatched.write_text("---\ngraph_node_id: wrong\n---\n", encoding="utf-8")
    mismatch = {
        "graph_node_id": "right", "artifact_kind": "issue", "file_path": "issues/mismatch.md",
        "template_id": "issue", "template_version": "1.0.0",
    }
    mismatch_findings = mod.artifact_findings([mismatch], tmp_path, contract)
    assert {item["code"] for item in mismatch_findings} == {"frontmatter_missing", "frontmatter_parity_error"}

    escaped = {"id": "escaped", "artifact_kind": "unknown", "file_path": "../escape.md"}
    assert "artifact_path_invalid" in codes(mod.artifact_findings([escaped], tmp_path, contract))
    assert mod.artifact_findings([{"id": "none", "file_path": None}], tmp_path, contract) == []


# heading_missing / placeholder_only_section の C11 readiness テストは
# test_validate_graph_schema_c11_heading_readiness.py へ分離 (500 行超過の解消)。


def task(node_id: str, **overrides):
    node = {
        "id": node_id,
        "artifact_kind": "task",
        "status": "draft",
        "depends_on": [],
        "related_nodes": [],
        "architecture_refs": [],
        "tracker_binding": "none",
    }
    node.update(overrides)
    return node


def test_domain_dag_exact13_evidence_and_readiness_boundaries():
    mod = load()
    bad_refs = task(
        "bad-refs",
        tracker_binding="repo-config-default",
        related_nodes=["missing-related"],
        architecture_refs=["missing-architecture"],
        parent_feature="missing-feature",
    )
    assert {"unresolved_tracker_binding", "dangling_reference"} <= codes(mod.domain_findings([bad_refs]))

    feature = task("feature", artifact_kind="feature", status="done")
    short_package = [feature, task("p01", parent_feature="feature", feature_package_id=None, phase_ref="P01")]
    assert "feature_package_not_exact_13" in codes(mod.domain_findings(short_package))

    members = []
    for number in range(1, 14):
        evidence = [f"evidence-P{number:02d}"] if number in {7, 10, 11} else []
        members.append(task(
            f"p{number:02d}",
            status="done",
            parent_feature="feature",
            feature_package_id="package-1",
            phase_ref=f"P{number:02d}",
            depends_on=[f"p{number - 1:02d}"] if number > 1 else [],
            completion_evidence={"evidence_refs": evidence},
        ))
    exact = mod.domain_findings([feature, *members])
    assert not ({"feature_package_not_exact_13", "non_forward_phase_dependency", "premature_feature_done", "feature_evidence_missing"} & codes(exact))

    missing_evidence = [dict(member) for member in members]
    missing_evidence[6]["completion_evidence"] = {"evidence_refs": []}
    not_done = dict(missing_evidence[0], status="active")
    not_done["confirmation_status"] = "draft"
    not_done["evaluation_status"] = "pending"
    not_done["implementation_readiness"] = {"status": "incomplete"}
    missing_evidence[0] = not_done
    negative_codes = codes(mod.domain_findings([feature, *missing_evidence]))
    assert {"active_not_ready", "premature_feature_done", "feature_evidence_missing"} <= negative_codes


def test_validate_rejects_invalid_authority_documents(monkeypatch):
    mod = load()

    def non_object_schema(path):
        return [] if path == mod.SCHEMA_PATH else {}

    monkeypatch.setattr(mod, "load_json", non_object_schema)
    with pytest.raises(mod.ContractError, match="schema must be an object"):
        mod.validate([])

    def non_object_template(path):
        return {} if path == mod.SCHEMA_PATH else []

    monkeypatch.setattr(mod, "load_json", non_object_template)
    with pytest.raises(mod.ContractError, match="template contract must be an object"):
        mod.validate([])

    with pytest.raises(mod.ContractError, match="invalid canonical graph schema"):
        mod.schema_findings({}, {"type": 42}, 0)


def test_pipeline_improvement_exact13_projection_has_canonical_frontmatter():
    """Regression for HarnessHub-t1i: status must read the promoted exact-13 package."""
    mod = load()
    repo_root = PLUGIN.parents[1]
    graph = json.loads((repo_root / ".dev-graph/state/graph.json").read_text(encoding="utf-8"))
    nodes = [
        node for node in graph["nodes"]
        if node.get("feature_package_id") == "feature-package/feat-dev-pipeline-improvement"
    ]
    nodes.sort(key=lambda node: node["phase_ref"])
    assert [node["phase_ref"] for node in nodes] == [f"P{number:02d}" for number in range(1, 14)]
    assert {node["template_version"] for node in nodes} == {"1.1.0"}

    contract = json.loads((PLUGIN / "templates/template-contract.json").read_text(encoding="utf-8"))
    assert mod.artifact_findings(nodes, repo_root, contract) == []


def test_preview_graph_validates_from_stdin_without_writing_into_the_repo(tmp_path):
    """dry-run preview を管理対象 repo へ書かずに検証できる (C14 OUT3: dry-run write 0)。

    2026-07-21 live-trial r13 で、preview 検証のため `.dev-graph/cache/preview-validate.json`
    を repo 内へ書いてから unlink する経路を検出した。--graph FILE は contained() を要求し
    repo 外パスを拒否するため、preview 検証には stdin 経路が必要。
    """
    import subprocess

    root = tmp_path / "repo"
    (root / ".dev-graph" / "state").mkdir(parents=True)
    before = sorted(p.relative_to(root).as_posix() for p in root.rglob("*"))

    preview = json.dumps({"graph_revision": 0, "nodes": []})
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / "validate-graph-schema.py"),
         "--graph", "-", "--repo-root", str(root)],
        input=preview, capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout)["valid"] is True

    after = sorted(p.relative_to(root).as_posix() for p in root.rglob("*"))
    assert after == before, "preview 検証が管理対象 repo へファイルを残してはならない"


def _schema_valid_issue_node(graph_node_id: str, file_path: str) -> dict:
    """canonical store から schema 適合済みの issue node を1件借用し、id/file_path だけ差し替える。

    graph-node.schema.json は required フィールドが多く、その場でリテラルを組むと
    schema drift のたびにテストが追従漏れするため、正本 store の実データを流用する。
    """
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
    """--graph FILE 経路 (canonical store) は artifact_missing を fail 扱いにする (既存挙動の固定)。"""
    import subprocess

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
    """stdin preview (`--graph -`) は未作成 node の artifact_missing を自動で skip する。

    decompose の dry-run は「まだ書いていない node」を送るのが正当な用途であり、file 経路と
    同じ artifact_missing 判定を適用すると preview 検証そのものが常に fail する (HarnessHub-3tw)。
    """
    import subprocess

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


def test_preview_stdin_requires_explicit_repo_root() -> None:
    """repo_root 未指定の stdin preview は fail-closed (artifact 解決先が曖昧なまま通さない)。"""
    import subprocess

    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / "validate-graph-schema.py"), "--graph", "-"],
        input=json.dumps({"nodes": []}), capture_output=True, text=True, check=False,
    )
    assert proc.returncode != 0
    assert "--repo-root is required" in proc.stderr


def test_c14_decompose_documents_the_stdin_preview_path() -> None:
    """C14 の dry-run 手順が stdin 経路へ係留されている (文書側の退行も CI で検出する)。

    requirements 側は test_validate_source_digest.py が同格の保護を持つ。decompose 側だけ
    文書変更が無保護だと、stdin 経路の記載が消えても赤くならない非対称が残る。
    """
    skill = PLUGIN / "skills" / "run-dev-graph-decompose" / "SKILL.md"
    body = skill.read_text(encoding="utf-8").split("---", 2)[2]

    assert "--graph -" in body, "dry-run preview 検証の stdin 経路が本文に必要"
    checklist = [line for line in body.splitlines() if line.startswith("- [ ]")]
    assert any("--graph -" in line for line in checklist), (
        "完了チェックリストに stdin 経路の項目が必要"
    )
    gotchas = body.split("## Gotchas", 1)
    assert len(gotchas) == 2, "Gotchas 節が必要"
    assert "--graph -" in gotchas[1], "Gotchas に dry-run 一時ファイルの落とし穴が必要"
