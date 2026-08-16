"""Shared fixtures for focused register-package test modules."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPT = PLUGIN / "scripts" / "register-package.py"
UPSERT = PLUGIN / "scripts" / "upsert-node.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("dev_graph_register_package", SCRIPT)
assert SPEC and SPEC.loader
RP = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RP
SPEC.loader.exec_module(RP)

PHASES = [f"P{i:02d}" for i in range(1, 14)]
DIGEST = "sha256:" + "a" * 64
HEX_DIGEST = "a" * 64
NEW_DIGEST = "sha256:" + "b" * 64
NOW = "2026-07-13T00:00:00Z"
PROJECTED_FRONTMATTER = {
    "purpose": "task-spec 本文から確定した目的",
    "goal": "task-spec 本文から確定した到達状態",
    "scope_in": ["docs/features/demo/requirements-baseline.md"],
    "scope_out": ["他 phase の write scope への書込"],
    "acceptance": ["観測可能な二値条件が 1 件以上ある"],
    "architecture_refs": ["architecture/system.md"],
}
PROJECTED_AT = "2026-07-13T00:05:00Z"


def feature_node() -> dict:
    return {
        "graph_node_id": "feature-1", "artifact_kind": "feature", "artifact_subtypes": [],
        "title": "Feature", "project_id": "project", "domain": "system", "status": "draft",
        "owners": ["team"], "tags": [], "priority": None, "start_date": None, "target_date": None,
        "iteration": None, "created_at": NOW, "updated_at": NOW, "depends_on": [], "related_nodes": [],
        "resource_scope": [], "parent_feature": None, "feature_package_id": None, "phase_ref": None,
        "file_path": "features/feature-1.md", "template_id": "feature", "template_version": "1.0.0",
        "confirmation_status": "draft", "evaluation_status": "pending",
        "confirmation_evidence": {
            "evaluator": "reviewer", "evidence_ref": "evidence/feature.json", "evaluated_digest": HEX_DIGEST,
        },
        "source_lineage": {
            "origin_kind": "manual", "source_plugin": None, "source_path": None,
            "source_version": None, "source_digest": None, "imported_at": None,
        },
        "classification_confidence": 1.0, "classification_reason": "explicit fixture", "classification_candidates": [],
        "github_publication": {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": None},
        "issue_linkage": None, "tracker_binding": "none", "beads_linkage": None,
        "github_project_linkages": [], "pull_request_linkages": [], "execution_contexts": [],
        "completion_evidence": {
            "policy": "linked_pr_merged_all", "status": "in_progress", "source": None,
            "completed_at": None, "reconciled_at": None, "evidence_refs": [],
        },
        "implementation_readiness": {
            "status": "incomplete", "missing_sections": ["13-task package missing"], "checked_at": NOW,
        },
        "purpose": "Deliver the feature", "goal": "Complete it", "scope_in": ["system"],
        "scope_out": ["unrelated"], "acceptance": ["accepted"], "architecture_refs": ["architecture/system.md"],
    }


def task_node(index: int) -> dict:
    phase = PHASES[index]
    node_id = f"task-{phase}"
    return {
        "graph_node_id": node_id, "artifact_kind": "task", "artifact_subtypes": [], "title": phase,
        "project_id": "project", "domain": "system", "status": "active", "owners": ["team"], "tags": [],
        "priority": None, "start_date": None, "target_date": None, "iteration": None,
        "created_at": NOW, "updated_at": NOW, "depends_on": [] if index == 0 else [f"task-{PHASES[index - 1]}"],
        "related_nodes": [], "resource_scope": [], "parent_feature": "feature-1",
        "feature_package_id": "feature-package/demo", "phase_ref": phase,
        "file_path": f"tasks/feature-1/{phase.lower()}.md", "template_id": "task", "template_version": "1.0.0",
        "confirmation_status": "confirmed", "evaluation_status": "pass",
        "confirmation_evidence": {
            "evaluator": "system-dev-plan-evaluator", "evidence_ref": "plan-findings.json",
            "evaluated_digest": HEX_DIGEST,
        },
        "source_lineage": {
            "origin_kind": "system-dev-planner", "source_plugin": "system-dev-planner",
            "source_path": f"published/demo/task-specs/{phase}.md", "source_version": "0.1.0",
            "source_digest": HEX_DIGEST, "imported_at": NOW,
        },
        "classification_confidence": 1.0, "classification_reason": "exact phase", "classification_candidates": [],
        "github_publication": {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": None},
        "issue_linkage": None, "tracker_binding": "repo-config-default", "beads_linkage": None,
        "github_project_linkages": [], "pull_request_linkages": [], "execution_contexts": [],
        "completion_evidence": {
            "policy": "linked_pr_merged_all", "status": "in_progress", "source": None,
            "completed_at": None, "reconciled_at": None, "evidence_refs": [],
        },
        "implementation_readiness": {"status": "complete", "missing_sections": [], "checked_at": NOW},
    }


class RegisterPackageFixtureMixin:
    """Set up one exact-13 generation for registration tests."""

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.package = self.root / "feature-package.json"
        self.registration = self.root / "dev-graph-registration.json"
        self.promotion = self.root / "atomic-promotion-receipt.json"
        self.output = self.root / "graph.json"
        self.receipt = self.root / "dev-graph-registration-receipt.json"
        nodes = [task_node(i) for i in range(13)]
        self.write(self.package, {
            "schema_version": "1.0.0", "feature_package_id": "feature-package/demo",
            "parent_feature": "feature-1", "source_feature_digest": "sha256:" + "b" * 64,
            "task_count": 13, "phase_refs": PHASES,
            "task_spec_paths": [
                "task-specs/phase-01-requirements.md", "task-specs/phase-02-architecture.md",
                "task-specs/phase-03-design-review.md", "task-specs/phase-04-test-design.md",
                "task-specs/phase-05-implementation.md", "task-specs/phase-06-test-run.md",
                "task-specs/phase-07-acceptance.md", "task-specs/phase-08-refactoring-migration.md",
                "task-specs/phase-09-quality-assurance.md", "task-specs/phase-10-final-review.md",
                "task-specs/phase-11-evidence.md", "task-specs/phase-12-documentation-operations.md",
                "task-specs/phase-13-release-deploy.md",
            ],
            "task_node_ids": [node["graph_node_id"] for node in nodes],
        })
        self.write(self.registration, {
            "schema_version": "1.0.0", "source_digest": DIGEST,
            "promotion_receipt": self.promotion.name, "feature_package_id": "feature-package/demo",
            "parent_feature": "feature-1", "expected_count": 13, "phase_refs": PHASES,
            "binding_intents": {node["graph_node_id"]: "auto" for node in nodes}, "nodes": nodes,
        })
        self.write(self.promotion, {
            "schema_version": "1.0.0", "status": "promoted", "published_digest": DIGEST,
            "registration_manifest": self.registration.name,
        })
        self.write(self.output, {"schema_version": "1.0.0", "graph_revision": 4, "nodes": [feature_node()]})

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def write(path: Path, value: dict) -> None:
        path.write_text(json.dumps(value), encoding="utf-8")

    def invoke(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run([
            sys.executable, str(SCRIPT), "register", "--repo-root", str(self.root),
            "--package", self.package.name, "--graph", self.registration.name,
            "--output", self.output.name, "--receipt", self.receipt.name, *extra,
        ], text=True, capture_output=True, check=False)

    def args(self, *extra: str):
        return RP._parser().parse_args([
            "register", "--repo-root", str(self.root), "--package", self.package.name,
            "--graph", self.registration.name, "--output", self.output.name,
            "--receipt", self.receipt.name, *extra,
        ])

    def project_task_frontmatter(self) -> None:
        graph = json.loads(self.output.read_text())
        for node in graph["nodes"]:
            if node.get("artifact_kind") == "task":
                node.update(copy.deepcopy(PROJECTED_FRONTMATTER))
                node["updated_at"] = PROJECTED_AT
        self.write(self.output, graph)

    def second_generation(self) -> list[str]:
        generation = self.root / "generation-2"
        generation.mkdir()
        package = json.loads(self.package.read_text())
        registration = json.loads(self.registration.read_text())
        registration["source_digest"] = NEW_DIGEST
        registration["promotion_receipt"] = "generation-2/atomic-promotion-receipt.json"
        for node in registration["nodes"]:
            node["source_lineage"]["source_digest"] = NEW_DIGEST.removeprefix("sha256:")
            node["source_lineage"]["source_path"] = f"generation-2/{node['phase_ref']}.md"
            node["confirmation_evidence"]["evaluated_digest"] = NEW_DIGEST.removeprefix("sha256:")
        self.write(generation / "feature-package.json", package)
        self.write(generation / "dev-graph-registration.json", registration)
        self.write(generation / "atomic-promotion-receipt.json", {
            "schema_version": "1.0.0", "status": "promoted", "published_digest": NEW_DIGEST,
            "registration_manifest": "generation-2/dev-graph-registration.json",
        })
        return [
            sys.executable, str(SCRIPT), "register", "--repo-root", str(self.root),
            "--package", "generation-2/feature-package.json",
            "--graph", "generation-2/dev-graph-registration.json", "--output", self.output.name,
            "--receipt", "generation-2/dev-graph-registration-receipt.json",
        ]

    def registered_tasks(self) -> list[dict]:
        graph = json.loads(self.output.read_text())
        return [node for node in graph["nodes"] if node.get("artifact_kind") == "task"]

    def satisfy_upsert_preconditions(self) -> Path:
        arch = task_node(0)
        arch.update({
            "graph_node_id": "architecture/system.md", "artifact_kind": "architecture",
            "artifact_subtypes": ["backend"], "title": "System Architecture",
            "status": "draft", "depends_on": [], "parent_feature": None,
            "feature_package_id": None, "phase_ref": None, "file_path": "architecture/system.md",
            "template_id": "architecture", "confirmation_status": "draft", "evaluation_status": "pending",
            "tracker_binding": "none",
        })
        graph = json.loads(self.output.read_text())
        graph["nodes"].append(arch)
        self.write(self.output, graph)
        body = self.root / "body.md"
        # task_node() は origin_kind="system-dev-planner" を既定にするため (register-package
        # が生成する task は常に system-dev-planner 由来)、本文は base task.md (manual 用の
        # 13 見出し) ではなく conditional_required_sections の system_development_baseline
        # variant (軽量3見出し) に揃える。HarnessHub-yzv0 で HEADING_MISSING_KINDS へ task を
        # 追加した際、base テンプレートのままでは variant 不一致で heading_missing が発生した。
        body.write_text(
            "# task-P01\n\n"
            "## 正本仕様書\n\n検証用の実文。\n\n"
            "## 依存\n\n検証用の実文。\n\n"
            "## 実行契約\n\n検証用の実文。\n",
            encoding="utf-8",
        )
        return body
