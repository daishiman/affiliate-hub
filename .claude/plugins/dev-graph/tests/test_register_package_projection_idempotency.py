"""Regression tests for projection-owned fields in package re-registration."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from register_package_test_support import (
    DIGEST,
    HEX_DIGEST,
    NEW_DIGEST,
    NOW,
    PLUGIN,
    PROJECTED_FRONTMATTER,
    RP,
    UPSERT,
    RegisterPackageFixtureMixin,
)


class RegisterPackageProjectionIdempotencyTest(RegisterPackageFixtureMixin, unittest.TestCase):
    """Keep registration and task Markdown projection compatible (HarnessHub-cvli)."""

    def test_same_generation_is_idempotent_after_task_projection(self) -> None:
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        receipt_before = self.receipt.read_bytes()
        self.project_task_frontmatter()
        graph_before = self.output.read_bytes()

        preview = self.invoke("--dry-run")
        self.assertEqual(preview.returncode, 0, preview.stdout + preview.stderr)
        self.assertTrue(json.loads(preview.stdout)["idempotent"])

        applied = self.invoke()
        self.assertEqual(applied.returncode, 0, applied.stdout + applied.stderr)
        report = json.loads(applied.stdout)
        self.assertTrue(report["idempotent"])
        self.assertEqual(report["phase_refs"], [f"P{i:02d}" for i in range(1, 14)])
        self.assertEqual(report["applied_count"], 13)
        self.assertEqual(report["source_digest"], DIGEST)
        self.assertEqual(self.output.read_bytes(), graph_before)
        self.assertEqual(self.receipt.read_bytes(), receipt_before)
        tasks = self.registered_tasks()
        self.assertEqual({node["source_lineage"]["source_digest"] for node in tasks}, {HEX_DIGEST})

    def test_real_upsert_node_keeps_generation_idempotent(self) -> None:
        self.assertEqual(self.invoke().returncode, 0)
        receipt_before = self.receipt.read_bytes()
        body = self.satisfy_upsert_preconditions()
        patch = self.root / "patch.json"
        self.write(patch, {"patch": {"graph_node_id": "task-P01", **PROJECTED_FRONTMATTER}})
        projected = subprocess.run(
            [sys.executable, str(UPSERT), "--repo-root", str(self.root),
             "--graph", self.output.name, "--input", patch.name, "--body-file", body.name],
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(projected.returncode, 0, projected.stdout + projected.stderr)

        node = next(node for node in self.registered_tasks() if node["graph_node_id"] == "task-P01")
        frontmatter = (self.root / node["file_path"]).read_text(encoding="utf-8").split("---")[1]
        for field, value in PROJECTED_FRONTMATTER.items():
            self.assertEqual(node[field], value, field)
            self.assertIn(f"\n{field}:", frontmatter, field)
        self.assertNotEqual(node["updated_at"], NOW)

        graph_before = self.output.read_bytes()
        for extra in (("--dry-run",), ()):
            result = self.invoke(*extra)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue(json.loads(result.stdout)["idempotent"])
        self.assertEqual(self.output.read_bytes(), graph_before)
        self.assertEqual(self.receipt.read_bytes(), receipt_before)

    def test_supersede_preserves_projected_frontmatter_and_graph_schema(self) -> None:
        self.assertEqual(self.invoke().returncode, 0)
        self.project_task_frontmatter()
        command = self.second_generation()
        superseded = subprocess.run(command, text=True, capture_output=True, check=False)
        self.assertEqual(superseded.returncode, 0, superseded.stdout + superseded.stderr)
        self.assertEqual(json.loads(superseded.stdout)["operation"], "superseded")

        node_schema = json.loads((PLUGIN / "schemas" / "graph-node.schema.json").read_text())
        contract = json.loads((PLUGIN / "templates" / "template-contract.json").read_text())
        required = set(contract["common_frontmatter"]["required"])
        tasks = self.registered_tasks()
        self.assertEqual(len(tasks), 13)
        for node in tasks:
            for field, value in PROJECTED_FRONTMATTER.items():
                self.assertEqual(node[field], value, f"{node['graph_node_id']}.{field}")
            self.assertEqual(required - set(node), set(), node["graph_node_id"])
            self.assertEqual(node["source_lineage"]["source_digest"], NEW_DIGEST.removeprefix("sha256:"))
            RP._validate_schema(node, node_schema, node_schema, node["graph_node_id"])
        self.assertEqual({node["updated_at"] for node in tasks}, {NOW})
        repeated = subprocess.run(command, text=True, capture_output=True, check=False)
        self.assertEqual(repeated.returncode, 0, repeated.stdout + repeated.stderr)
        self.assertTrue(json.loads(repeated.stdout)["idempotent"])

    def test_registration_owned_frontmatter_still_detects_content_drift(self) -> None:
        registration = json.loads(self.registration.read_text())
        for node in registration["nodes"]:
            node.update(copy.deepcopy(PROJECTED_FRONTMATTER))
        self.write(self.registration, registration)
        self.assertEqual(self.invoke().returncode, 0)
        graph = json.loads(self.output.read_text())
        for node in graph["nodes"]:
            if node.get("artifact_kind") == "task":
                node["purpose"] = "graph 側だけが持つ別の目的"
        self.write(self.output, graph)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("different content", result.stdout)

    def test_projection_timestamp_regression_is_rejected(self) -> None:
        self.assertEqual(self.invoke().returncode, 0)
        graph = json.loads(self.output.read_text())
        for node in graph["nodes"]:
            if node.get("artifact_kind") == "task":
                node["updated_at"] = "2026-07-12T23:59:59Z"
        self.write(self.output, graph)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("different content", result.stdout)

    def test_unparsable_projection_timestamp_is_fail_closed(self) -> None:
        self.assertEqual(self.invoke().returncode, 0)
        graph = json.loads(self.output.read_text())
        for node in graph["nodes"]:
            if node.get("artifact_kind") == "task":
                node["updated_at"] = "not-a-timestamp"
        self.write(self.output, graph)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("different content", result.stdout)
