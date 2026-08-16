#!/usr/bin/env python3
"""C03/C15 live-trial fixture が共有する tracker 契約データ。

repo 骨格・CLI orchestration と、GitHub/Projects の同期用 contract data を分離する。
本 module は時刻・ID・remote state を固定し、fixture の再生成を決定論的に保つ。
"""
from __future__ import annotations

from typing import Any


CREATED_AT = "2026-07-13T07:50:00Z"
REMOTE_UPDATED_AT = "2026-07-21T02:22:22Z"
SNAPSHOT_AT = "2026-07-13T07:55:00Z"

ISSUE_NODE_ID = "I_kwDOFixture001"
PROJECT_ID = "PVT_kwDOFixture001"
PROJECT_ITEM_ID = "PVTI_lADOFixture001"
STATUS_FIELD_ID = "PVTF_Status001"
PRIORITY_FIELD_ID = "PVTF_Priority001"

CONTENT_ROOTS = {
    "issues": "issues",
    "tasks": "tasks",
    "specifications": "specs",
    "architecture": "architecture",
    "features": "features",
    "documents": "docs",
    "system_spec": "system-spec",
}


def repo_config(
    repository_id: str, *, tracker_mode: str, projects: list[dict[str, Any]]
) -> dict[str, Any]:
    """repo-config.schema.json の必須 9 key だけを持つ最小 config。

    ``github.enabled`` は tracker mode からだけ導出し、GitHub tracker と default Project
    の条件連鎖を生成時点で検証する。mode と enabled を別入力にして矛盾した config を
    表現できないようにする (HarnessHub-n88 の再発防止)。
    """
    github_tracked = tracker_mode in {"github", "both"}
    if github_tracked and sum(1 for item in projects if item.get("default")) != 1:
        raise ValueError(
            f"tracker_mode={tracker_mode} は github.enabled=true を要求し、"
            "schema は default=true の Projects 定義をちょうど 1 件求める "
            f"(渡された projects={len(projects)} 件)"
        )
    if not github_tracked and projects:
        raise ValueError(
            f"tracker_mode={tracker_mode} は github.enabled=false になるため、"
            "有効化されていない GitHub の Projects 定義を持てない"
        )
    execution_tracker: dict[str, Any] = {"mode": tracker_mode}
    if tracker_mode in {"beads", "both"}:
        execution_tracker["beads"] = {
            "issue_prefix": "lt",
            "server_mode": False,
            "github_mirror": "none",
            "board": "none",
        }
    return {
        "schema_version": "1.0.0",
        "repository_id": repository_id,
        "content_roots": dict(CONTENT_ROOTS),
        "local_state": {
            "graph": ".dev-graph/state/graph.json",
            "cache": ".dev-graph/cache",
            "locks": ".dev-graph/locks",
        },
        "github": {
            "enabled": github_tracked,
            "issue_repository": "example/dev-graph-live-trial",
            "projects": projects,
            "completion_policy": {
                "trigger": "linked_pr_merged",
                "required_pull_requests": "all",
                "target_branch": "default",
                "closed_unmerged": "keep_active",
                "issue_reopened": "reopen_task",
                "revert": "create_follow_up_unless_issue_reopened",
                "local_reconciliation": ["manual_sync"],
                "scheduled_reconciliation": {
                    "enabled": False,
                    "interval_minutes": 5,
                    "owner": "claude_session_start",
                    "entry_point": "dev-graph sync --reconcile-lifecycle",
                },
            },
        },
        "execution_tracker": execution_tracker,
        "worktrees": {
            "enabled": True,
            "lease_ttl_seconds": 1800,
            "heartbeat_seconds": 60,
            "coordination_store": "git_common_dir",
            "completion_write_branch": "default",
            "dirty_worktree_policy": "fail_closed",
        },
        "claude_hooks": {
            "source": "plugin",
            "project_plugin_link": ".claude/dev-graph-plugin",
            "session_start": False,
            "post_tool_reconcile": False,
            "task_completed_gate": False,
        },
        "path_policy": {
            "authority": "caller-repository",
            "stored_paths": "repository-relative",
            "allow_outside_repository": False,
            "follow_content_symlinks_outside_repository": False,
        },
    }


def planning_project() -> dict[str, Any]:
    """alias=planning の Projects v2 定義。"""
    return {
        "alias": "planning",
        "owner_type": "user",
        "owner_login": "example",
        "project_number": 1,
        "default": True,
        "auto_add": {
            "artifact_kinds": ["task"],
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "implementation_readiness": "complete",
        },
        "field_mappings": [
            {
                "local_field": "status",
                "project_field_name": "Status",
                "value_type": "single_select",
                "direction": "local_to_project",
                "option_map": {"active": "In Progress", "blocked": "Blocked", "done": "Done"},
            },
            {
                "local_field": "priority",
                "project_field_name": "Priority",
                "value_type": "single_select",
                "direction": "bidirectional",
                "option_map": {"high": "High", "medium": "Medium", "low": "Low"},
            },
        ],
    }


def sync_task_node() -> dict[str, Any]:
    """C15 schedule が ready と判定できる唯一の task node。"""
    return {
        "acceptance": [],
        "architecture_refs": [],
        "artifact_kind": "task",
        "artifact_subtypes": [],
        "beads_linkage": None,
        "classification_candidates": [
            {"artifact_kind": "task", "candidate_path": "tasks/LT-TASK-001.md", "confidence": 1.0}
        ],
        "classification_confidence": 1.0,
        "classification_reason": "Deterministic acceptance fixture",
        "completion_evidence": {
            "completed_at": None,
            "evidence_refs": [],
            "policy": "manual",
            "reconciled_at": None,
            "source": None,
            "status": "in_progress",
        },
        "confirmation_evidence": {
            "evaluated_digest": "a" * 64,
            "evaluator": "fixture-evaluator",
            "evidence_ref": "evidence/LT-TASK-001.json",
        },
        "confirmation_status": "confirmed",
        "created_at": CREATED_AT,
        "depends_on": [],
        "domain": "verification",
        "evaluation_status": "pass",
        "execution_contexts": [],
        "feature_package_id": None,
        "file_path": "tasks/LT-TASK-001.md",
        "github_project_linkages": [
            {
                "field_snapshot": {"priority": "Medium", "status": "Backlog"},
                "item_id": PROJECT_ITEM_ID,
                "last_error_code": None,
                "last_synced_at": SNAPSHOT_AT,
                "linked_at": CREATED_AT,
                "owner_login": "example",
                "owner_type": "user",
                "project_alias": "planning",
                "project_id": PROJECT_ID,
                "project_number": 1,
                "sync_state": "synced",
            }
        ],
        "github_publication": {
            "labels": ["live-trial", "safe"],
            "milestone": None,
            "mode": "issue_and_projects",
            "project_aliases": ["planning"],
        },
        "goal": None,
        "graph_node_id": "LT-TASK-001",
        "implementation_readiness": {
            "checked_at": CREATED_AT,
            "missing_sections": [],
            "status": "complete",
        },
        "issue_linkage": {
            "issue_number": 1,
            "linked_at": CREATED_AT,
            "repo": "example/dev-graph-live-trial",
        },
        "iteration": "R3",
        "owners": ["harness-maintainers"],
        "parent_feature": None,
        "phase_ref": None,
        "priority": "medium",
        "project_id": "dev-graph-live-trial",
        "pull_request_linkages": [],
        "purpose": None,
        "related_nodes": [],
        "resource_scope": ["docs/live-trial-output.md"],
        "scope_in": [],
        "scope_out": [],
        "source_lineage": {
            "imported_at": CREATED_AT,
            "origin_kind": "manual",
            "source_digest": "b" * 64,
            "source_path": "tasks/LT-TASK-001.md",
            "source_plugin": None,
            "source_version": "1.0.0",
        },
        "start_date": None,
        "status": "active",
        "tags": ["live-trial", "safe"],
        "target_date": None,
        "template_id": "task",
        "template_version": "1.0.0",
        "title": "Validate isolated live trial",
        "tracker_binding": "github",
        "updated_at": CREATED_AT,
    }


def sync_remote_state() -> dict[str, Any]:
    """外部 GitHub を使わず 3-way 収束を再現する決定論 adapter fixture。"""
    return {
        "beads": {},
        "github": {
            "LT-TASK-001": {
                "id": ISSUE_NODE_ID,
                "number": 1,
                "projects": {
                    "planning": {
                        "definitions": {
                            "Status": {
                                "id": STATUS_FIELD_ID,
                                "options": [
                                    {"id": "OPT_InProgress001", "name": "In Progress"},
                                    {"id": "OPT_Done001", "name": "Done"},
                                    {"id": "OPT_Blocked001", "name": "Blocked"},
                                    {"id": "OPT_Backlog001", "name": "Backlog"},
                                ],
                            },
                            "Priority": {
                                "id": PRIORITY_FIELD_ID,
                                "options": [
                                    {"id": "OPT_High001", "name": "High"},
                                    {"id": "OPT_Medium001", "name": "Medium"},
                                    {"id": "OPT_Low001", "name": "Low"},
                                ],
                            },
                        },
                        "fields": {
                            "Status": {
                                "field_id": STATUS_FIELD_ID,
                                "option_id": "OPT_Backlog001",
                                "updated_at": SNAPSHOT_AT,
                                "value": "Backlog",
                            },
                            "Priority": {
                                "field_id": PRIORITY_FIELD_ID,
                                "option_id": "OPT_Medium001",
                                "updated_at": SNAPSHOT_AT,
                                "value": "Medium",
                            },
                        },
                        "item_id": PROJECT_ITEM_ID,
                    }
                },
                "repo": "example/dev-graph-live-trial",
                "state": "open",
                "title": "Validate isolated live trial (updated remotely r7)",
                "updated_at": REMOTE_UPDATED_AT,
            }
        },
        "schema_version": "1.0",
    }


def sync_snapshot() -> dict[str, Any]:
    """3-way merge の base。"""
    return {
        "nodes": {
            "LT-TASK-001": {
                "binding": "github",
                "issue": {
                    "status": {"local": "open", "remote": "open"},
                    "title": {
                        "local": "Validate isolated live trial",
                        "remote": "Validate isolated live trial",
                    },
                },
                "projects": {
                    "planning": {
                        "priority": {"local": "Medium", "remote": "Medium"},
                        "status": {"local": "Backlog", "remote": "Backlog"},
                    }
                },
            }
        },
        "schema_version": "1.0",
        "updated_at": SNAPSHOT_AT,
    }
