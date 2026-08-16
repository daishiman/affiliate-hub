"""HarnessHub-dqca: document layer の C02 graph/frontmatter parity を固定する。"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from test_operational_loop_v2 import args, load, node_fixture, workspace


LAYER = "feature-design"
BODY = """# 目的

既存 document の layer を失わず再登録する。

## 対象読者

Dev Graph の保守担当者。

## 要約

C02 が legacy frontmatter から layer を graph へ一度だけ移行する。

## 本文

本文は frontmatter の再生成後も変えない。

## 決定事項

- layer の形式は graph-node schema を正本とする。

## 運用・更新方法

- document の役割が変わるときだけ明示更新する。

## 関連資料

- HarnessHub-dqca

## 変更履歴

- 2026-07-30: 回帰検証を追加。
"""


def document_node(*, layer: object = ...) -> dict:
    node = node_fixture("doc-layer-regression")
    node.update(
        {
            "artifact_kind": "document",
            "title": "Layer regression document",
            "domain": "documentation",
            "tags": ["documentation", "regression"],
            "resource_scope": ["docs/layer-regression.md"],
            "file_path": "docs/layer-regression.md",
            "template_id": "document",
            "classification_reason": "explicit document fixture",
        }
    )
    if layer is not ...:
        node["layer"] = layer
    return node


def seed_legacy_document(root: Path, graph: Path, node: dict) -> Path:
    """Write the pre-fix state: artifact has layer, graph node does not."""
    graph.write_text(
        json.dumps({"graph_revision": 1, "nodes": [node]}),
        encoding="utf-8",
    )
    artifact = root / node["file_path"]
    artifact.parent.mkdir(parents=True)
    lines = ["---"]
    for key, value in node.items():
        lines.append(
            f"{key}: "
            f"{json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}"
        )
        if key == "artifact_subtypes":
            lines.append(f"layer: {LAYER}")
    lines.extend(["---", "", BODY.rstrip(), ""])
    artifact.write_text("\n".join(lines), encoding="utf-8")
    return artifact


def body_of(artifact: Path) -> str:
    return artifact.read_text(encoding="utf-8").split("---\n", 2)[2].lstrip("\n")


def test_legacy_document_reupsert_migrates_and_preserves_layer(tmp_path):
    module = load("upsert-node.py", "upsert_node_document_layer_migration")
    root, graph, input_path = workspace(tmp_path)
    legacy = document_node()
    artifact = seed_legacy_document(root, graph, legacy)
    input_path.write_text(json.dumps({"node": legacy}), encoding="utf-8")

    receipt = module._perform(args(root, input_path))

    saved = json.loads(graph.read_text(encoding="utf-8"))["nodes"][0]
    text = artifact.read_text(encoding="utf-8")
    assert receipt["operation"] == "updated"
    assert receipt["body_source"] == "preserved"
    assert receipt["replaced_body_lines"] is None
    assert saved["layer"] == LAYER
    assert f'layer: "{LAYER}"' in text
    assert body_of(artifact).rstrip() == BODY.rstrip()

    repeated = module._perform(args(root, input_path))
    assert repeated["operation"] == "noop"
    assert repeated["idempotent"] is True
    assert body_of(artifact).rstrip() == BODY.rstrip()


def test_new_document_without_layer_fails_before_writing(tmp_path):
    module = load("upsert-node.py", "upsert_node_document_layer_missing")
    root, graph, input_path = workspace(tmp_path)
    input_path.write_text(
        json.dumps({"node": document_node(), "body": BODY}),
        encoding="utf-8",
    )

    # Full plugin suite reloads `_common` under several module identities, so assert
    # the public contract message instead of relying on exception class identity.
    with pytest.raises(Exception, match="new document requires layer"):
        module._perform(args(root, input_path))

    assert json.loads(graph.read_text(encoding="utf-8"))["nodes"] == []
    assert not (root / "docs" / "layer-regression.md").exists()


@pytest.mark.parametrize("invalid", ["Feature Design", "", None, "feature_design"])
def test_document_layer_must_match_canonical_schema(tmp_path, invalid):
    module = load("upsert-node.py", f"upsert_node_document_layer_invalid_{invalid!r}")
    root, graph, input_path = workspace(tmp_path)
    input_path.write_text(
        json.dumps({"node": document_node(layer=invalid), "body": BODY}),
        encoding="utf-8",
    )

    with pytest.raises(module.ContractError, match="proposed graph is invalid"):
        module._perform(args(root, input_path))

    assert json.loads(graph.read_text(encoding="utf-8"))["nodes"] == []
    assert not (root / "docs" / "layer-regression.md").exists()


def test_non_document_frontmatter_remains_layer_free(tmp_path):
    module = load("upsert-node.py", "upsert_node_non_document_layer_absent")
    root, graph, input_path = workspace(tmp_path)

    module._perform(args(root, input_path))

    saved = json.loads(graph.read_text(encoding="utf-8"))["nodes"][0]
    artifact = root / saved["file_path"]
    assert "layer" not in saved
    assert "\nlayer:" not in artifact.read_text(encoding="utf-8")


def test_non_document_cannot_declare_document_layer(tmp_path):
    module = load("upsert-node.py", "upsert_node_non_document_layer_rejected")
    root, graph, input_path = workspace(tmp_path)
    node = node_fixture("issue-with-document-layer")
    node["layer"] = LAYER
    input_path.write_text(
        json.dumps({"node": node, "body": BODY}),
        encoding="utf-8",
    )

    with pytest.raises(module.ContractError, match="proposed graph is invalid"):
        module._perform(args(root, input_path))

    assert json.loads(graph.read_text(encoding="utf-8"))["nodes"] == []
    assert not (root / node["file_path"]).exists()
