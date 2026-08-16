from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))

from register_package_test_support import (
    DIGEST,
    NEW_DIGEST,
    NOW,
    PLUGIN,
    RP,
    SCRIPT,
    RegisterPackageFixtureMixin,
    feature_node,
    task_node,
)


class RegisterPackageTest(RegisterPackageFixtureMixin, unittest.TestCase):

    def test_registers_exact_13_atomically_and_is_idempotent(self) -> None:
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        graph = json.loads(self.output.read_text())
        self.assertEqual(len(graph["nodes"]), 14)
        self.assertEqual(graph["graph_revision"], 5)
        self.assertEqual({n["tracker_binding"] for n in graph["nodes"][1:]}, {"none"})
        parent = graph["nodes"][0]
        self.assertEqual(parent["status"], "active")
        self.assertIsNone(parent["feature_package_id"])
        self.assertEqual((parent["confirmation_status"], parent["evaluation_status"]), ("confirmed", "pass"))
        self.assertEqual(parent["implementation_readiness"], {
            "status": "complete", "missing_sections": [], "checked_at": NOW,
        })
        receipt_before = self.receipt.read_bytes()
        second = self.invoke()
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertTrue(json.loads(second.stdout)["idempotent"])
        self.assertEqual(self.receipt.read_bytes(), receipt_before)

    def test_projects_execution_context_through_c02_consumer(self) -> None:
        context = {
            "worktree_id": "wt_" + "1" * 16,
            "branch": "devgraph/feature-1",
            "base_branch": "main",
            "head_sha": "1" * 40,
            "state": "claimed",
            "lease_acquired_at": NOW,
            "last_seen_at": NOW,
            "released_at": None,
        }
        completed = subprocess.run([
            sys.executable, str(SCRIPT), "execution-context", "--repo-root", str(self.root),
            "--graph", self.output.name, "--graph-node-id", "feature-1",
            "--context-json", json.dumps(context),
        ], text=True, capture_output=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        receipt = json.loads(completed.stdout)
        self.assertEqual(receipt["owner"], "C02/run-dev-graph-node")
        self.assertEqual(receipt["status"], "applied")
        graph = json.loads(self.output.read_text())
        self.assertEqual(graph["graph_revision"], 5)
        self.assertEqual(graph["nodes"][0]["execution_contexts"], [context])
        self.assertEqual(receipt["graph_sha256_after"], hashlib.sha256(self.output.read_bytes()).hexdigest())

        before = self.output.read_bytes()
        repeated = subprocess.run([
            sys.executable, str(SCRIPT), "execution-context", "--repo-root", str(self.root),
            "--graph", self.output.name, "--graph-node-id", "feature-1",
            "--context-json", json.dumps(context),
        ], text=True, capture_output=True, check=False)
        self.assertEqual(repeated.returncode, 0, repeated.stdout + repeated.stderr)
        repeated_receipt = json.loads(repeated.stdout)
        self.assertTrue(repeated_receipt["idempotent"])
        self.assertEqual(repeated_receipt["write_count"], 0)
        self.assertEqual(self.output.read_bytes(), before)

    def test_dry_run_writes_nothing(self) -> None:
        before = json.loads(self.output.read_text())
        result = self.invoke("--dry-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(self.output.read_text()), before)
        self.assertFalse(self.receipt.exists())
        self.assertEqual(json.loads(result.stdout)["write_count"], 0)

    def test_rejects_partial_registration(self) -> None:
        graph = json.loads(self.output.read_text())
        graph["nodes"].append(task_node(0))
        self.write(self.output, graph)
        before = self.output.read_bytes()
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("partial registration", result.stdout)
        self.assertEqual(self.output.read_bytes(), before)

    def test_rejects_conflicting_duplicate_registration(self) -> None:
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        graph = json.loads(self.output.read_text())
        graph["nodes"][1]["title"] = "conflicting duplicate"
        self.write(self.output, graph)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("different content", result.stdout)

    def test_rejects_digest_mismatch(self) -> None:
        promotion = json.loads(self.promotion.read_text())
        promotion["published_digest"] = "sha256:" + "c" * 64
        self.write(self.promotion, promotion)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("digest mismatch", result.stdout)
        self.assertFalse(self.receipt.exists())

    def test_rejects_noncanonical_receipt_path(self) -> None:
        wrong_receipt = self.root / "registration-receipt.json"
        result = subprocess.run([
            sys.executable, str(SCRIPT), "register", "--repo-root", str(self.root),
            "--package", self.package.name, "--graph", self.registration.name,
            "--output", self.output.name, "--receipt", wrong_receipt.name,
        ], text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("must match the system-build handoff contract", result.stdout)
        self.assertFalse(wrong_receipt.exists())

    def test_supersedes_exact_13_in_one_revision_and_preserves_old_receipt(self) -> None:
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        old_receipt = self.receipt.read_bytes()
        new_digest = NEW_DIGEST
        command = self.second_generation()
        superseded = subprocess.run(command, text=True, capture_output=True, check=False)
        self.assertEqual(superseded.returncode, 0, superseded.stdout + superseded.stderr)
        receipt = json.loads(superseded.stdout)
        self.assertEqual(receipt["operation"], "superseded")
        self.assertEqual(receipt["supersedes_source_digest"], DIGEST)
        self.assertEqual(receipt["graph_revision_before"], 5)
        self.assertEqual(receipt["graph_revision_after"], 6)
        graph = json.loads(self.output.read_text())
        task_nodes = [node for node in graph["nodes"] if node.get("parent_feature") == "feature-1"]
        self.assertEqual(len(task_nodes), 13)
        self.assertEqual(
            {node["source_lineage"]["source_digest"] for node in task_nodes},
            {new_digest.removeprefix("sha256:")},
        )
        self.assertEqual(self.receipt.read_bytes(), old_receipt)
        repeated = subprocess.run(command, text=True, capture_output=True, check=False)
        self.assertEqual(repeated.returncode, 0, repeated.stdout + repeated.stderr)
        self.assertTrue(json.loads(repeated.stdout)["idempotent"])

    def test_rejects_non_forward_dependency(self) -> None:
        registration = json.loads(self.registration.read_text())
        registration["nodes"][0]["depends_on"] = ["task-P02"]
        self.write(self.registration, registration)
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertIn("non-forward", result.stdout)

    def test_preflight_rejects_upstream_version_drift(self) -> None:
        result = subprocess.run([
            sys.executable, str(SCRIPT), "preflight", "--required-version", "9.9.9",
        ], text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("version mismatch", result.stdout)

    def test_preflight_accepts_current_upstream_contract(self) -> None:
        result = subprocess.run([
            sys.executable, str(SCRIPT), "preflight",
        ], text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)["valid"])


class RegisterPackageInProcessCoverageTest(RegisterPackageTest):
    """Exercise internal fail-closed branches under coverage.py in this process."""

    def test_in_process_register_dry_run_commit_and_idempotency(self) -> None:
        preview = RP._register(self.args("--dry-run"))
        self.assertTrue(preview["dry_run"])
        first = RP._register(self.args())
        self.assertEqual(first["applied_count"], 13)
        self.assertEqual(first["graph_digest_after"], RP._canonical_digest(json.loads(self.output.read_text())))
        second = RP._register(self.args())
        self.assertTrue(second["idempotent"])

    @staticmethod
    def execution_context(*, worktree: str = "1", state: str = "claimed", seen: str = NOW) -> dict:
        return {
            "worktree_id": "wt_" + worktree * 16,
            "branch": "devgraph/feature-1", "base_branch": "main", "head_sha": "1" * 40,
            "state": state, "lease_acquired_at": NOW, "last_seen_at": seen, "released_at": None,
        }

    def execution_args(self, context, *extra: str):
        raw = context if isinstance(context, str) else json.dumps(context)
        return RP._parser().parse_args([
            "execution-context", "--repo-root", str(self.root), "--graph", self.output.name,
            "--graph-node-id", "feature-1", "--context-json", raw, *extra,
        ])

    def test_execution_context_preview_apply_replace_and_idempotent_noop(self) -> None:
        context = self.execution_context()
        before = self.output.read_bytes()
        preview = RP._project_execution_context(self.execution_args(context, "--dry-run"))
        self.assertEqual((preview["status"], preview["write_count"], preview["graph_revision_after"]), ("preview", 0, 5))
        self.assertEqual(self.output.read_bytes(), before)

        applied = RP._project_execution_context(self.execution_args(context))
        self.assertEqual((applied["status"], applied["write_count"], applied["graph_revision_after"]), ("applied", 1, 5))
        self.assertEqual(applied["graph_sha256_after"], hashlib.sha256(self.output.read_bytes()).hexdigest())
        after = self.output.read_bytes()
        repeated = RP._project_execution_context(self.execution_args(context))
        self.assertTrue(repeated["idempotent"])
        self.assertEqual(repeated["write_count"], 0)
        self.assertEqual(self.output.read_bytes(), after)

        changed = self.execution_context(state="in_progress", seen="2026-07-13T00:01:00Z")
        replaced = RP._project_execution_context(self.execution_args(changed))
        self.assertFalse(replaced["idempotent"])
        graph = json.loads(self.output.read_text())
        self.assertEqual(graph["graph_revision"], 6)
        self.assertEqual(graph["nodes"][0]["execution_contexts"], [changed])

    def test_execution_context_rejects_invalid_context_graph_and_target(self) -> None:
        context = self.execution_context()
        with self.assertRaisesRegex(RP.ContractError, "invalid JSON"):
            RP._project_execution_context(self.execution_args("{"))
        with self.assertRaisesRegex(RP.ContractError, "must be an object"):
            RP._project_execution_context(self.execution_args("[]"))
        invalid = dict(context); invalid.pop("last_seen_at")
        with self.assertRaisesRegex(RP.ContractError, "missing required property"):
            RP._project_execution_context(self.execution_args(invalid))

        self.write(self.output, {"schema_version": "1.0.0", "graph_revision": 4, "nodes": "invalid"})
        with self.assertRaisesRegex(RP.ContractError, "must contain nodes array"):
            RP._project_execution_context(self.execution_args(context, "--dry-run"))
        self.write(self.output, {"schema_version": "1.0.0", "graph_revision": 4, "nodes": [feature_node()]})
        missing = self.execution_args(context, "--dry-run"); missing.graph_node_id = "missing"
        with self.assertRaisesRegex(RP.ContractError, "exactly one"):
            RP._project_execution_context(missing)
        node = feature_node(); node["execution_contexts"] = {}
        self.write(self.output, {"schema_version": "1.0.0", "graph_revision": 4, "nodes": [node]})
        with self.assertRaisesRegex(RP.ContractError, "must be an array"):
            RP._project_execution_context(self.execution_args(context, "--dry-run"))

    def test_execution_context_single_writer_rejects_contention(self) -> None:
        args = self.execution_args(self.execution_context())
        with RP._single_writer(self.output):
            with self.assertRaisesRegex(RP.ContractError, "already active"):
                RP._project_execution_context(args)

    def test_idempotent_registration_rejects_conflicting_immutable_receipt(self) -> None:
        RP._register(self.args())
        receipt = json.loads(self.receipt.read_text())
        receipt["node_ids"] = list(reversed(receipt["node_ids"]))
        self.write(self.receipt, receipt)
        with self.assertRaisesRegex(RP.ContractError, "immutable receipt conflicts"):
            RP._register(self.args())

    def test_in_process_atomic_receipt_failure_rolls_graph_back(self) -> None:
        before = json.loads(self.output.read_text())
        with mock.patch.object(RP, "_atomic_create_json", side_effect=OSError("receipt disk failure")):
            with self.assertRaisesRegex(OSError, "receipt disk failure"):
                RP._register(self.args())
        self.assertEqual(json.loads(self.output.read_text()), before)
        self.assertFalse(self.receipt.exists())

    def test_in_process_lock_contention_is_fail_closed(self) -> None:
        lock_path = self.output.with_name(f".{self.output.name}.register.lock")
        with lock_path.open("a+") as stream:
            RP.fcntl.flock(stream.fileno(), RP.fcntl.LOCK_EX | RP.fcntl.LOCK_NB)
            with self.assertRaisesRegex(RP.ContractError, "already active"):
                RP._register(self.args())

    def test_in_process_contract_and_binding_failures(self) -> None:
        package = json.loads(self.package.read_text())
        registration = json.loads(self.registration.read_text())
        node_schema = json.loads((PLUGIN / "schemas" / "graph-node.schema.json").read_text())
        registration["nodes"][0]["source_lineage"]["source_digest"] = "b" * 64
        with self.assertRaisesRegex(RP.ContractError, "lineage digest mismatch"):
            RP._validate_registration(registration, package, node_schema)
        nodes = [task_node(i) for i in range(13)]
        intents = {node["graph_node_id"]: "auto" for node in nodes}
        with self.assertRaisesRegex(RP.ContractError, "both requires"):
            RP._resolved_nodes(nodes, intents, "both", node_schema)
        intents[nodes[0]["graph_node_id"]] = "github"
        with self.assertRaisesRegex(RP.ContractError, "not allowed"):
            RP._resolved_nodes(nodes, intents, "beads", node_schema)

    def test_schema_engine_covers_ref_condition_arrays_and_objects(self) -> None:
        schema = {
            "$defs": {"word": {"type": "string", "minLength": 2, "pattern": "^[a-z]+$"}},
            "type": "object", "required": ["kind", "items"], "additionalProperties": False,
            "properties": {
                "kind": {"enum": ["x"]},
                "items": {"type": "array", "minItems": 1, "maxItems": 2, "uniqueItems": True,
                          "items": {"$ref": "#/$defs/word"}, "contains": {"const": "ok"}},
                "count": {"type": "integer", "minimum": 1, "maximum": 2},
            },
            "if": {"properties": {"kind": {"const": "x"}}},
            "then": {"required": ["count"]},
        }
        RP._validate_schema({"kind": "x", "items": ["ok"], "count": 1}, schema, schema, "$fixture")
        bad_values = [
            ({"kind": "x", "items": [], "count": 1}, "too few"),
            ({"kind": "x", "items": ["ok", "ok"], "count": 1}, "not unique"),
            ({"kind": "x", "items": ["NO"], "count": 1}, "does not match"),
            ({"kind": "x", "items": ["ok"], "count": 3}, "above maximum"),
            ({"kind": "x", "items": ["ok"], "count": 1, "extra": True}, "unknown properties"),
        ]
        for value, message in bad_values:
            with self.subTest(message=message), self.assertRaisesRegex(RP.ContractError, message):
                RP._validate_schema(value, schema, schema, "$fixture")

    def test_atomic_create_is_immutable_and_paths_are_contained(self) -> None:
        target = self.root / "immutable.json"
        RP._atomic_create_json(target, {"ok": True})
        with self.assertRaisesRegex(RP.ContractError, "already exists"):
            RP._atomic_create_json(target, {"ok": False})
        self.assertEqual(json.loads(target.read_text()), {"ok": True})
        with self.assertRaisesRegex(RP.ContractError, "escapes authority"):
            RP._path(self.root, str(self.root.parent / "escape.json"), must_exist=False)

    def test_main_reports_contract_error_as_json(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            code = RP.main(["preflight", "--required-version", "9.9.9"])
        self.assertEqual(code, 2)
        self.assertFalse(json.loads(output.getvalue())["valid"])


if __name__ == "__main__":
    unittest.main()
