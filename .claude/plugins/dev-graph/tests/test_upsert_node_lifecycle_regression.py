from __future__ import annotations

import copy
import json

import pytest

from test_operational_loop_v2 import (
    args,
    feature_fixture,
    load,
    node_fixture,
    seed_architecture,
    workspace,
)


def _c14_feature(module, root):
    source = root / "specs" / "macro-source.md"
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_text("# マクロ分解の入力仕様\n", encoding="utf-8")

    node = feature_fixture()
    node["source_lineage"] = {
        "origin_kind": "generated",
        "source_plugin": "dev-graph",
        "source_path": "specs/macro-source.md",
        "source_version": None,
        "source_digest": module._sha256(source.read_bytes()),
        "imported_at": "2026-07-29T00:00:00Z",
    }
    return node


def _promoted_feature(module, tmp_path):
    root, graph, input_path = workspace(tmp_path)
    seed_architecture(graph)

    draft = _c14_feature(module, root)
    draft_payload = {
        "node": draft,
        "body": "# 概要\n\nC14 macro contract 由来の feature。",
    }
    input_path.write_text(json.dumps(draft_payload), encoding="utf-8")
    assert module._perform(args(root, input_path))["operation"] == "added"

    promoted = {
        "status": "active",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "confirmation_evidence": {
            "evaluator": "system-dev-plan-evaluator",
            "evidence_ref": "specs/macro-source.md",
            "evaluated_digest": "a" * 64,
        },
        "implementation_readiness": {
            "status": "complete",
            "missing_sections": [],
            "checked_at": "2026-07-29T00:01:00Z",
        },
    }
    input_path.write_text(
        json.dumps(
            {
                "graph_node_id": draft["graph_node_id"],
                "patch": promoted,
            }
        ),
        encoding="utf-8",
    )
    assert module._perform(args(root, input_path))["operation"] == "updated"
    artifact = root / draft["file_path"]
    saved = json.loads(graph.read_text(encoding="utf-8"))["nodes"][-1]
    return root, graph, input_path, draft_payload, artifact, saved


def _set_path(node, path, value):
    target = node
    parts = path.split(".")
    for part in parts[:-1]:
        target = target[part]
    target[parts[-1]] = value


@pytest.mark.parametrize(
    ("field", "regressed_value"),
    [
        ("status", "draft"),
        ("confirmation_status", "draft"),
        ("evaluation_status", "pending"),
        ("implementation_readiness.status", "incomplete"),
    ],
)
@pytest.mark.parametrize("input_shape", ["node-envelope", "bare-canonical"])
def test_each_stale_feature_lifecycle_field_is_rejected_without_writes(
    tmp_path,
    field,
    regressed_value,
    input_shape,
):
    module = load(
        "upsert-node.py",
        f"upsert_node_lifecycle_{field.replace('.', '_')}_{input_shape.replace('-', '_')}",
    )
    root, graph, input_path, _, artifact, promoted = _promoted_feature(module, tmp_path)
    graph_before = graph.read_bytes()
    artifact_before = artifact.read_bytes()
    stale = copy.deepcopy(promoted)
    _set_path(stale, field, regressed_value)
    payload = {"node": stale} if input_shape == "node-envelope" else stale
    input_path.write_text(json.dumps(payload), encoding="utf-8")

    message = "stale feature lifecycle before-image"
    with pytest.raises(module.ContractError, match=message):
        module._perform(args(root, input_path, dry_run=True))
    with pytest.raises(module.ContractError, match=message):
        module._perform(args(root, input_path))
    assert graph.read_bytes() == graph_before
    assert artifact.read_bytes() == artifact_before


def test_non_regressing_full_feature_snapshot_remains_idempotent(tmp_path):
    module = load("upsert-node.py", "upsert_node_lifecycle_positive_control")
    root, graph, input_path, _, artifact, promoted = _promoted_feature(module, tmp_path)
    graph_before = graph.read_bytes()
    artifact_before = artifact.read_bytes()
    input_path.write_text(json.dumps({"node": promoted}), encoding="utf-8")

    repeated = module._perform(args(root, input_path))

    assert repeated["operation"] == "noop"
    assert repeated["idempotent"] is True
    assert graph.read_bytes() == graph_before
    assert artifact.read_bytes() == artifact_before


def test_non_feature_full_snapshot_keeps_existing_lifecycle_behavior(tmp_path):
    module = load("upsert-node.py", "upsert_node_lifecycle_non_feature")
    root, graph, input_path = workspace(tmp_path)
    draft = node_fixture()
    input_path.write_text(
        json.dumps({"node": draft, "body": "# 概要\n\n通常 issue。"}),
        encoding="utf-8",
    )
    assert module._perform(args(root, input_path))["operation"] == "added"
    input_path.write_text(
        json.dumps(
            {
                "graph_node_id": draft["graph_node_id"],
                "patch": {
                    "status": "active",
                    "confirmation_status": "confirmed",
                    "evaluation_status": "pass",
                    "confirmation_evidence": {
                        "evaluator": "test-evaluator",
                        "evidence_ref": "issues/issue-operational.md",
                        "evaluated_digest": "b" * 64,
                    },
                    "implementation_readiness": {
                        "status": "complete",
                        "missing_sections": [],
                        "checked_at": "2026-07-29T00:01:00Z",
                    },
                },
            }
        ),
        encoding="utf-8",
    )
    assert module._perform(args(root, input_path))["operation"] == "updated"

    input_path.write_text(json.dumps({"node": draft}), encoding="utf-8")
    reset = module._perform(args(root, input_path))

    assert reset["operation"] == "updated"
    saved = json.loads(graph.read_text(encoding="utf-8"))["nodes"][-1]
    assert saved["artifact_kind"] == "issue"
    assert saved["status"] == "draft"


def test_explicit_patch_can_intentionally_reset_feature_lifecycle(tmp_path):
    module = load("upsert-node.py", "upsert_node_lifecycle_explicit_reset")
    root, graph, input_path, draft_payload, _, _ = _promoted_feature(module, tmp_path)
    draft = draft_payload["node"]
    input_path.write_text(
        json.dumps(
            {
                "graph_node_id": draft["graph_node_id"],
                "patch": {
                    "status": "draft",
                    "confirmation_status": "draft",
                    "evaluation_status": "pending",
                    "confirmation_evidence": {
                        "evaluator": None,
                        "evidence_ref": None,
                        "evaluated_digest": None,
                    },
                    "implementation_readiness": {
                        "status": "incomplete",
                        "missing_sections": [],
                        "checked_at": None,
                    },
                },
            }
        ),
        encoding="utf-8",
    )
    reset = module._perform(args(root, input_path))
    assert reset["operation"] == "updated"
    saved = json.loads(graph.read_text(encoding="utf-8"))["nodes"][-1]
    assert saved["confirmation_status"] == "draft"
    assert saved["evaluation_status"] == "pending"
    assert saved["implementation_readiness"]["status"] == "incomplete"
