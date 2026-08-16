#!/usr/bin/env python3
# /// script
# name: sync-graph
# purpose: Plan and apply idempotent three-way convergence between dev-graph and Beads/GitHub projections.
# inputs: ["argv: --repo-root PATH [--graph FILE] [--remote-state FILE] [--snapshot FILE] [--parity-manifest FILE] --dry-run|--apply"]
# outputs: ["stdout and optional eval-log: imports, exports, conflicts, tombstones, pending_retry and snapshot receipt"]
# requires-python = ">=3.10"
# dependencies: ["upsert-node.py", "bd-bridge.py", "gh-bridge.py", "reconcile-github-lifecycle.py", "build-parity-manifest.py"]
# contexts: [A, B, C, E]
# network: true
# write-scope: C02 node patches, approved external bridges, sync snapshot, parity manifest and eval-log
# ///
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from _common import ContractError, atomic_json, contained, dump, load_json, repository_eval_root, run, utc_now
from node_transaction import ensure_no_pending_transaction


def _sha(data: bytes | None) -> str | None:
    return hashlib.sha256(data).hexdigest() if data is not None else None


def _node_id(node: dict[str, Any]) -> str:
    value = node.get("graph_node_id") or node.get("id")
    if not isinstance(value, str) or not value:
        raise ContractError("graph node is missing graph_node_id")
    return value


def _time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError(f"invalid synchronization timestamp: {value}") from exc
    if parsed.tzinfo is None:
        raise ContractError("synchronization timestamp must be timezone-aware")
    return parsed.astimezone(timezone.utc)


def _graph_path(root: Path, explicit: str | None, config: dict[str, Any]) -> Path:
    raw = explicit or ((config.get("local_state") or {}).get("graph"))
    if not isinstance(raw, str) or not raw:
        raise ContractError("sync requires --graph or config local_state.graph")
    candidate = Path(raw)
    candidate = candidate if candidate.is_absolute() else root / candidate
    return contained(candidate, root, must_exist=True)


def _state_path(root: Path, raw: str | None, default: str, *, must_exist: bool) -> Path:
    candidate = Path(raw or default)
    candidate = candidate if candidate.is_absolute() else root / candidate
    return contained(candidate, root, must_exist=must_exist)


def _invoke(argv: list[str], root: Path, label: str) -> dict[str, Any]:
    cp = run(argv, cwd=root, check=False)
    if cp.returncode:
        raise ContractError(f"{label} failed ({cp.returncode}): {(cp.stderr or cp.stdout).strip()}")
    try:
        result = json.loads(cp.stdout)
    except json.JSONDecodeError as exc:
        raise ContractError(f"{label} returned invalid JSON") from exc
    if not isinstance(result, dict):
        raise ContractError(f"{label} receipt must be an object")
    return result


def _dependency_ids(issue: dict[str, Any]) -> list[str]:
    result: list[str] = []
    raw = issue.get("dependencies")
    if raw is None:
        return result
    if not isinstance(raw, list):
        raise ContractError("Beads dependencies must be an array or null")
    for item in raw:
        if isinstance(item, dict):
            dependency = item.get("id")
            relation = item.get("dependency_type") or item.get("type")
            if relation not in (None, "blocks"):
                continue
        else:
            dependency = item
        if isinstance(dependency, str) and dependency:
            result.append(dependency)
    return sorted(set(result))


def _field_values(item: dict[str, Any]) -> dict[str, dict[str, Any]]:
    values: dict[str, dict[str, Any]] = {}
    raw_values = ((item.get("fieldValues") or {}).get("nodes", []))
    if not isinstance(raw_values, list):
        return values
    for raw in raw_values:
        if not isinstance(raw, dict):
            continue
        field = raw.get("field") or {}
        name = field.get("name") if isinstance(field, dict) else None
        if not isinstance(name, str) or not name:
            continue
        value = next((raw[key] for key in ("name", "text", "number", "date", "title") if key in raw), None)
        values[name] = {
            "value": value,
            "updated_at": raw.get("updatedAt"),
            "field_id": field.get("id"),
            "option_id": raw.get("optionId") or raw.get("iterationId"),
        }
    return values


def _collect_remote(
    root: Path,
    nodes: list[dict[str, Any]],
    config: dict[str, Any],
    bd_bridge: Path,
    gh_bridge: Path,
) -> dict[str, Any]:
    remote: dict[str, Any] = {"schema_version": "1.0", "beads": {}, "github": {}}
    beads_to_graph = {
        str((node.get("beads_linkage") or {}).get("bd_issue_id")): _node_id(node)
        for node in nodes if (node.get("beads_linkage") or {}).get("bd_issue_id")
    }
    for node in nodes:
        node_id = _node_id(node)
        binding = node.get("tracker_binding")
        if binding == "beads":
            issue_id = (node.get("beads_linkage") or {}).get("bd_issue_id")
            if not issue_id:
                continue
            receipt = _invoke(
                [sys.executable, str(bd_bridge), "--repo-root", str(root), "--op", "show", "--bd-issue-id", str(issue_id)],
                root,
                f"Beads read {node_id}",
            )
            issue = receipt.get("result") or {}
            remote["beads"][node_id] = {
                "bd_issue_id": issue_id,
                "title": issue.get("title"),
                "status": issue.get("status"),
                "updated_at": issue.get("updated_at") or issue.get("updatedAt"),
                "depends_on": [beads_to_graph[value] for value in _dependency_ids(issue) if value in beads_to_graph],
            }
        elif binding == "github":
            linkage = node.get("issue_linkage") or {}
            repo, number = linkage.get("repo"), linkage.get("issue_number")
            if not repo or not number:
                continue
            receipt = _invoke(
                [sys.executable, str(gh_bridge), "--op", "issue-fetch", "--repo", str(repo), "--number", str(number)],
                root,
                f"GitHub Issue read {node_id}",
            )
            issue = receipt.get("result") or {}
            projects: dict[str, Any] = {}
            for project in node.get("github_project_linkages") or []:
                alias, project_id, item_id = project.get("project_alias"), project.get("project_id"), project.get("item_id")
                if not alias or not project_id or not issue.get("id"):
                    continue
                definitions: dict[str, Any] = {}
                owner = project.get("owner_login")
                number_value = project.get("project_number")
                if owner and number_value:
                    resolved = _invoke(
                        [
                            sys.executable, str(gh_bridge), "--op", "project-resolve",
                            "--owner", str(owner), "--project-number", str(number_value),
                        ],
                        root,
                        f"GitHub Project definition {node_id}/{alias}",
                    )
                    for field in (resolved.get("result") or {}).get("fields", {}).get("nodes", []):
                        if isinstance(field, dict) and field.get("name"):
                            definitions[str(field["name"])] = field
                found = _invoke(
                    [
                        sys.executable, str(gh_bridge), "--op", "project-item-find",
                        "--project-id", str(project_id), "--content-id", str(issue["id"]),
                    ],
                    root,
                    f"GitHub Project read {node_id}/{alias}",
                )
                items = (found.get("result") or {}).get("items", [])
                if len(items) > 1:
                    raise ContractError(f"duplicate Project items for {node_id}/{alias}")
                matching = items
                projects[str(alias)] = {
                    "item_id": matching[0].get("id") if matching else None,
                    "updated_at": matching[0].get("updatedAt") if matching else None,
                    "fields": _field_values(matching[0]) if matching else {},
                    "definitions": definitions,
                }
            remote["github"][node_id] = {**issue, "repo": repo, "projects": projects}
    return remote


def _remote_map(remote: dict[str, Any], binding: str) -> dict[str, Any]:
    raw = remote.get(binding, {})
    if isinstance(raw, list):
        return {
            str(item.get("graph_node_id") or item.get("external_ref")): item
            for item in raw if isinstance(item, dict) and (item.get("graph_node_id") or item.get("external_ref"))
        }
    if not isinstance(raw, dict):
        raise ContractError(f"remote state {binding} must be an object or array")
    return raw


def _status_from_remote(binding: str, remote: dict[str, Any]) -> str:
    if remote.get("deleted") is True:
        return "tombstoned"
    raw = str(remote.get("state") if binding == "github" else remote.get("status") or "").casefold()
    if raw in {"closed", "done"}:
        return "closed"
    if raw in {"blocked"}:
        return "blocked"
    return "active"


def _status_to_remote(binding: str, status: str) -> str:
    if binding == "github":
        return "closed" if status in {"done", "closed", "tombstoned"} else "open"
    return {"done": "closed", "closed": "closed", "tombstoned": "closed", "blocked": "blocked"}.get(status, "open")


def _choose(
    *,
    node_id: str,
    field: str,
    local: Any,
    remote: Any,
    base: dict[str, Any] | None,
    local_updated: Any,
    remote_updated: Any,
    confirmation: str | None,
) -> str:
    if local == remote:
        return "equal"
    if base is None:
        local_changed = remote_changed = True
    else:
        local_changed = local != base.get("local")
        remote_changed = remote != base.get("remote")
        if not local_changed and not remote_changed:
            return "equal"
        if local_changed and not remote_changed:
            return "local"
        if remote_changed and not local_changed:
            return "remote"
        if not local_changed and not remote_changed:
            return "equal"
    if confirmation in {"local", "remote"}:
        return confirmation
    local_time, remote_time = _time(local_updated), _time(remote_updated)
    if local_time and remote_time and local_time != remote_time:
        return "local" if local_time > remote_time else "remote"
    if base is None and local_time and not remote_time:
        return "local"
    if base is None and remote_time and not local_time:
        return "remote"
    return "conflict"


def _config_projects(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    projects = ((config.get("github") or {}).get("projects", [])) if isinstance(config, dict) else []
    return {
        str(project.get("alias")): project
        for project in projects if isinstance(project, dict) and project.get("alias")
    }


def _confirmations(values: list[str]) -> dict[tuple[str, str], str]:
    result: dict[tuple[str, str], str] = {}
    for value in values:
        try:
            identity, choice = value.rsplit("=", 1)
            node_id, field = identity.split(":", 1)
        except ValueError as exc:
            raise ContractError("--confirm must be NODE:FIELD=local|remote") from exc
        if choice not in {"local", "remote"} or not node_id or not field:
            raise ContractError("--confirm must be NODE:FIELD=local|remote")
        result[(node_id, field)] = choice
    return result


def _plan(
    nodes: list[dict[str, Any]],
    remote: dict[str, Any],
    snapshot: dict[str, Any],
    config: dict[str, Any],
    confirmations: dict[tuple[str, str], str],
) -> dict[str, Any]:
    imports: list[dict[str, Any]] = []
    exports: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    tombstones: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    patches: dict[str, dict[str, Any]] = {}
    next_snapshot: dict[str, Any] = {
        "schema_version": "1.0",
        "nodes": {},
        "updated_at": snapshot.get("updated_at") or utc_now(),
    }
    base_nodes = snapshot.get("nodes", {}) if isinstance(snapshot, dict) else {}
    projects = _config_projects(config)
    beads_issue_by_graph = {
        _node_id(item): (item.get("beads_linkage") or {}).get("bd_issue_id")
        for item in nodes
    }

    for node in nodes:
        node_id = _node_id(node)
        binding = node.get("tracker_binding")
        if binding == "none":
            continue
        if binding not in {"beads", "github"}:
            raise ContractError(f"{node_id}: unresolved tracker_binding {binding!r}")
        remote_node = _remote_map(remote, binding).get(node_id)
        if remote_node is None:
            linkage = node.get("beads_linkage") if binding == "beads" else node.get("issue_linkage")
            if linkage:
                target = "tombstoned" if binding == "github" else "closed"
                if node.get("status") != target:
                    patches.setdefault(node_id, {})["status"] = target
                    imports.append({"node": node_id, "field": "status", "from": "missing", "to": target})
                    tombstones.append({"node": node_id, "binding": binding, "status": target, "physical_delete": False})
            else:
                pending.append({"node": node_id, "binding": binding, "reason": "external_linkage_missing"})
            continue
        if not isinstance(remote_node, dict):
            raise ContractError(f"{binding} remote node {node_id} must be an object")
        base_node = base_nodes.get(node_id, {}) if isinstance(base_nodes, dict) else {}
        issue_base = base_node.get("issue", {}) if isinstance(base_node, dict) else {}
        local_updated, remote_updated = node.get("updated_at"), remote_node.get("updated_at")
        local_values = {
            "title": node.get("title"),
            "status": _status_to_remote(binding, str(node.get("status"))),
        }
        remote_values = {
            "title": remote_node.get("title"),
            "status": _status_to_remote(binding, _status_from_remote(binding, remote_node)),
        }
        if binding == "github" and remote_node.get("deleted") is True:
            local_values = {"status": local_values["status"]}
            remote_values = {"status": remote_values["status"]}
        if binding == "beads":
            local_values["depends_on"] = sorted(node.get("depends_on", []))
            remote_values["depends_on"] = sorted(remote_node.get("depends_on", []))
        next_issue: dict[str, Any] = {}
        for field in local_values:
            local_value, remote_value = local_values[field], remote_values[field]
            if field == "status" and remote_node.get("deleted") is True:
                choice = "remote"
            else:
                choice = _choose(
                    node_id=node_id,
                    field=field,
                    local=local_value,
                    remote=remote_value,
                    base=issue_base.get(field) if isinstance(issue_base, dict) else None,
                    local_updated=local_updated,
                    remote_updated=remote_updated,
                    confirmation=confirmations.get((node_id, field)),
                )
            if choice == "conflict":
                conflicts.append({
                    "node": node_id, "field": field, "local": local_value, "remote": remote_value,
                    "resolution": "manual", "display_value": remote_value,
                    "confirmation_required": True,
                })
                next_issue[field] = issue_base.get(field, {"local": local_value, "remote": remote_value})
            elif choice == "remote":
                target = _status_from_remote(binding, remote_node) if field == "status" else remote_value
                if node.get(field) != target:
                    patches.setdefault(node_id, {})[field] = target
                    patches[node_id]["updated_at"] = remote_updated or utc_now()
                    record = {"node": node_id, "field": field, "from": node.get(field), "to": target}
                    imports.append(record)
                    if target == "tombstoned":
                        tombstones.append({"node": node_id, "binding": binding, "status": target, "physical_delete": False})
                next_issue[field] = {"local": remote_value, "remote": remote_value}
            elif choice == "local":
                if binding == "beads" and field == "depends_on":
                    for dependency in sorted(set(local_value) - set(remote_value)):
                        if not beads_issue_by_graph.get(dependency):
                            pending.append({"node": node_id, "field": field, "reason": f"dependency linkage missing: {dependency}"})
                            continue
                        exports.append({
                            "node": node_id, "binding": binding, "kind": "dep-add",
                            "dependency": dependency,
                            "dependency_issue_id": beads_issue_by_graph[dependency],
                        })
                    for dependency in sorted(set(remote_value) - set(local_value)):
                        if not beads_issue_by_graph.get(dependency):
                            pending.append({"node": node_id, "field": field, "reason": f"dependency linkage missing: {dependency}"})
                            continue
                        exports.append({
                            "node": node_id, "binding": binding, "kind": "dep-remove",
                            "dependency": dependency,
                            "dependency_issue_id": beads_issue_by_graph[dependency],
                        })
                else:
                    exports.append({
                        "node": node_id, "binding": binding, "kind": f"{field}-update",
                        "field": field, "value": local_value,
                    })
                next_issue[field] = {"local": local_value, "remote": local_value}
            else:
                next_issue[field] = {"local": local_value, "remote": remote_value}

        next_projects: dict[str, Any] = {}
        if binding == "github" and remote_node.get("deleted") is not True:
            remote_projects = remote_node.get("projects", {})
            if not isinstance(remote_projects, dict):
                raise ContractError(f"{node_id}: remote projects must be an object")
            for linkage in node.get("github_project_linkages") or []:
                alias = linkage.get("project_alias")
                if alias not in projects:
                    pending.append({"node": node_id, "alias": alias, "reason": "project_alias_missing_from_config"})
                    continue
                remote_project = remote_projects.get(alias, {})
                if remote_project.get("error"):
                    pending.append({"node": node_id, "alias": alias, "reason": remote_project["error"]})
                    continue
                if linkage.get("item_id") and remote_project.get("item_id") not in {None, linkage.get("item_id")}:
                    conflicts.append({"node": node_id, "alias": alias, "field": "item_id", "resolution": "manual"})
                    continue
                effective_item_id = remote_project.get("item_id") or linkage.get("item_id")
                if not linkage.get("item_id") and remote_project.get("item_id"):
                    linkages = copy.deepcopy(
                        patches.get(node_id, {}).get(
                            "github_project_linkages", node.get("github_project_linkages") or []
                        )
                    )
                    adopted = next(
                        (item for item in linkages if item.get("project_alias") == alias), None
                    )
                    if adopted is None:
                        raise ContractError(f"Project item alias has no durable linkage: {alias}")
                    adopted["item_id"] = remote_project["item_id"]
                    adopted["linked_at"] = adopted.get("linked_at") or utc_now()
                    adopted["sync_state"] = "linked"
                    adopted["last_error_code"] = None
                    patches.setdefault(node_id, {})["github_project_linkages"] = linkages
                    imports.append({
                        "node": node_id, "alias": alias, "field": "item_id",
                        "from": None, "to": remote_project["item_id"],
                    })
                if not remote_project.get("item_id"):
                    exports.append({
                        "node": node_id, "binding": "github", "kind": "project-item-add", "alias": alias,
                        "project_id": linkage.get("project_id"), "content_id": remote_node.get("id"),
                    })
                base_project = ((base_node.get("projects") or {}).get(alias, {})) if isinstance(base_node, dict) else {}
                next_fields: dict[str, Any] = {}
                mappings = projects[alias].get("field_mappings", [])
                remote_fields = remote_project.get("fields", {})
                for mapping in mappings:
                    if not isinstance(mapping, dict):
                        continue
                    local_field = mapping.get("local_field")
                    project_field = mapping.get("project_field_name")
                    direction = mapping.get("direction")
                    if not local_field or not project_field:
                        continue
                    definition = (remote_project.get("definitions") or {}).get(project_field)
                    if project_field not in remote_fields and not isinstance(definition, dict):
                        pending.append({"node": node_id, "alias": alias, "field": local_field, "reason": "project_field_missing_or_renamed"})
                        continue
                    option_map = mapping.get("option_map") or {}
                    local_value = node.get(local_field)
                    projected_local = option_map.get(str(local_value), local_value) if local_value is not None else None
                    remote_field = remote_fields.get(project_field, {"value": None, "updated_at": None})
                    remote_value = remote_field.get("value") if isinstance(remote_field, dict) else remote_field
                    field_key = f"project:{alias}:{local_field}"
                    if direction == "local_to_project":
                        choice = "equal" if projected_local == remote_value else "local"
                    else:
                        choice = _choose(
                            node_id=node_id,
                            field=field_key,
                            local=projected_local,
                            remote=remote_value,
                            base=base_project.get(local_field) if isinstance(base_project, dict) else None,
                            local_updated=local_updated,
                            remote_updated=remote_field.get("updated_at") if isinstance(remote_field, dict) else None,
                            confirmation=confirmations.get((node_id, field_key)),
                        )
                    if choice == "conflict":
                        conflicts.append({
                            "node": node_id, "alias": alias, "field": local_field,
                            "local": projected_local, "remote": remote_value, "resolution": "manual",
                            "confirmation_required": True,
                        })
                        next_fields[local_field] = base_project.get(local_field, {"local": projected_local, "remote": remote_value})
                    elif choice == "remote":
                        inverse = {value: key for key, value in option_map.items()}
                        if option_map and remote_value not in inverse:
                            pending.append({"node": node_id, "alias": alias, "field": local_field, "reason": "project_option_missing_or_renamed"})
                            continue
                        imported = inverse.get(remote_value, remote_value)
                        if node.get(local_field) != imported:
                            patches.setdefault(node_id, {})[local_field] = imported
                            imports.append({"node": node_id, "alias": alias, "field": local_field, "from": node.get(local_field), "to": imported})
                        next_fields[local_field] = {"local": remote_value, "remote": remote_value}
                    elif choice == "local":
                        definition = (remote_project.get("definitions") or {}).get(project_field, {})
                        value_type = str(mapping.get("value_type") or "single_select")
                        option_id = next((
                            option.get("id") for option in definition.get("options", [])
                            if isinstance(option, dict) and option.get("name") == projected_local
                        ), None)
                        if value_type == "iteration":
                            option_id = next((
                                iteration.get("id")
                                for iteration in (definition.get("configuration") or {}).get("iterations", [])
                                if isinstance(iteration, dict) and iteration.get("title") == projected_local
                            ), None)
                        exports.append({
                            "node": node_id, "binding": "github", "kind": "project-field-update",
                            "alias": alias, "field": local_field, "project_field": project_field,
                            "value": projected_local, "value_type": value_type,
                            "project_id": linkage.get("project_id"), "item_id": effective_item_id,
                            "field_id": definition.get("id") or (remote_field.get("field_id") if isinstance(remote_field, dict) else None),
                            "option_id": option_id,
                        })
                        next_fields[local_field] = {"local": projected_local, "remote": projected_local}
                    else:
                        next_fields[local_field] = {"local": projected_local, "remote": remote_value}
                next_projects[str(alias)] = next_fields
                if linkage.get("sync_state") == "pending_retry":
                    linkages = copy.deepcopy(
                        patches.get(node_id, {}).get(
                            "github_project_linkages", node.get("github_project_linkages") or []
                        )
                    )
                    healed = next(
                        (item for item in linkages if item.get("project_alias") == alias), None
                    )
                    if healed is None:
                        raise ContractError(f"Project retry alias has no durable linkage: {alias}")
                    healed["sync_state"] = "synced" if healed.get("item_id") else "unlinked"
                    healed["last_error_code"] = None
                    healed["last_synced_at"] = utc_now()
                    patches.setdefault(node_id, {})["github_project_linkages"] = linkages
                    imports.append({
                        "node": node_id,
                        "alias": alias,
                        "field": "sync_state",
                        "from": "pending_retry",
                        "to": healed["sync_state"],
                    })
        next_snapshot["nodes"][node_id] = {"binding": binding, "issue": next_issue, "projects": next_projects}
    return {
        "imports": imports,
        "exports": exports,
        "conflicts": conflicts,
        "tombstones": tombstones,
        "pending_retry": pending,
        "patches": patches,
        "next_snapshot": next_snapshot,
    }


def _apply_patch(root: Path, node_id: str, patch: dict[str, Any], upsert: Path) -> dict[str, Any]:
    request_dir = repository_eval_root(root) / "dev-graph-sync-requests"
    request_dir.mkdir(parents=True, exist_ok=True)
    request = request_dir / f"{hashlib.sha256(node_id.encode()).hexdigest()}.json"
    atomic_json(request, {"graph_node_id": node_id, "patch": patch})
    try:
        return _invoke(
            [sys.executable, str(upsert), "--repo-root", str(root), "--input", str(request)],
            root,
            f"C02 node patch {node_id}",
        )
    finally:
        try:
            request.unlink()
        except FileNotFoundError:
            pass


def _fixture_apply(remote: dict[str, Any], operation: dict[str, Any], now: str) -> dict[str, Any]:
    binding, node_id = operation["binding"], operation["node"]
    target = _remote_map(remote, binding).get(node_id)
    if not isinstance(target, dict):
        raise ContractError(f"fixture remote node missing for export: {node_id}")
    kind = operation["kind"]
    if kind == "title-update":
        target["title"] = operation["value"]
    elif kind == "status-update":
        if binding == "github":
            target["state"] = operation["value"]
        else:
            target["status"] = operation["value"]
    elif kind == "dep-add":
        target["depends_on"] = sorted(set(target.get("depends_on", [])) | {operation["dependency"]})
    elif kind == "dep-remove":
        target["depends_on"] = sorted(set(target.get("depends_on", [])) - {operation["dependency"]})
    elif kind == "project-item-add":
        project = target.setdefault("projects", {}).setdefault(operation["alias"], {})
        if not project.get("item_id"):
            project["item_id"] = f"PVTI_{hashlib.sha256((node_id + ':' + operation['alias']).encode()).hexdigest()[:16]}"
        project.setdefault("fields", {})
        result = {"item_id": project["item_id"]}
    elif kind == "project-field-update":
        project = target.setdefault("projects", {}).setdefault(operation["alias"], {"fields": {}})
        project.setdefault("fields", {})[operation["project_field"]] = {
            "value": operation["value"], "updated_at": now,
            "field_id": operation.get("field_id"), "option_id": operation.get("option_id"),
        }
    else:
        raise ContractError(f"unsupported fixture export operation: {kind}")
    target["updated_at"] = now
    return result if kind == "project-item-add" else {"ok": True}


def _live_apply(
    root: Path,
    operation: dict[str, Any],
    node: dict[str, Any],
    bd_bridge: Path,
    gh_bridge: Path,
) -> dict[str, Any]:
    binding, kind = operation["binding"], operation["kind"]
    if binding == "beads":
        issue = (node.get("beads_linkage") or {}).get("bd_issue_id")
        if not issue:
            raise ContractError("Beads export requires beads_linkage.bd_issue_id")
        if kind in {"dep-add", "dep-remove"}:
            argv = [
                sys.executable, str(bd_bridge), "--repo-root", str(root), "--op", kind,
                "--bd-issue-id", str(issue), "--depends-on", str(operation["dependency_issue_id"]),
            ]
        else:
            argv = [sys.executable, str(bd_bridge), "--repo-root", str(root), "--op", "update", "--bd-issue-id", str(issue)]
        if kind == "title-update":
            argv += ["--title", str(operation["value"])]
        elif kind == "status-update":
            argv += ["--status", str(operation["value"])]
        return _invoke(argv, root, f"Beads export {operation['node']}/{kind}")
    linkage = node.get("issue_linkage") or {}
    repo, number = linkage.get("repo"), linkage.get("issue_number")
    if not repo or not number:
        raise ContractError("GitHub export requires issue_linkage")
    if kind == "title-update":
        argv = [sys.executable, str(gh_bridge), "--op", "issue-update", "--repo", str(repo), "--number", str(number), "--title", str(operation["value"])]
    elif kind == "status-update":
        if operation["value"] == "closed":
            argv = [sys.executable, str(gh_bridge), "--op", "issue-close", "--repo", str(repo), "--number", str(number)]
        else:
            raise ContractError("gh-bridge does not support Issue reopen yet")
    elif kind == "project-field-update":
        required = (operation.get("project_id"), operation.get("item_id"), operation.get("field_id"))
        if not all(required):
            raise ContractError("Project field export lacks resolved project/item/field IDs")
        value_type = str(operation.get("value_type") or "single_select")
        argv = [
            sys.executable, str(gh_bridge), "--op", "project-item-edit",
            "--project-id", str(required[0]), "--item-id", str(required[1]),
            "--field-id", str(required[2]), "--value-type", value_type,
        ]
        if value_type in {"single_select", "iteration"}:
            if not operation.get("option_id"):
                raise ContractError(f"Project {value_type} export lacks a resolved option/iteration ID")
            argv += ["--option-id", str(operation["option_id"])]
        else:
            argv += ["--value", str(operation.get("value") if operation.get("value") is not None else "")]
    elif kind == "project-item-add":
        if not operation.get("project_id") or not operation.get("content_id"):
            raise ContractError("Project item add lacks project_id/content_id")
        argv = [
            sys.executable, str(gh_bridge), "--op", "project-item-add",
            "--project-id", str(operation["project_id"]), "--content-id", str(operation["content_id"]),
        ]
    else:
        raise ContractError(f"unsupported live GitHub export operation: {kind}")
    return _invoke(argv, root, f"GitHub export {operation['node']}/{kind}")


def _project_linkage_patch(
    node: dict[str, Any], operation: dict[str, Any], receipt: dict[str, Any] | None,
    *, error: str | None = None,
) -> dict[str, Any] | None:
    alias = operation.get("alias")
    if not alias:
        return None
    linkages = copy.deepcopy(node.get("github_project_linkages") or [])
    linkage = next((item for item in linkages if item.get("project_alias") == alias), None)
    if linkage is None:
        raise ContractError(f"Project operation alias has no durable linkage: {alias}")
    now = utc_now()
    if error:
        linkage["sync_state"] = "pending_retry"
        linkage["last_error_code"] = error
        return {"github_project_linkages": linkages}
    if operation.get("kind") == "project-item-add":
        item_id = (receipt or {}).get("item_id")
        if not item_id:
            result = (receipt or {}).get("result") or {}
            item_id = (((result.get("data") or {}).get("addProjectV2ItemById") or {}).get("item") or {}).get("id")
        if not item_id:
            raise ContractError("Project item add receipt omitted item_id")
        linkage["item_id"] = item_id
        linkage["linked_at"] = linkage.get("linked_at") or now
        linkage["sync_state"] = "linked"
    elif operation.get("kind") == "project-field-update":
        snapshot = linkage.setdefault("field_snapshot", {})
        snapshot[str(operation["field"])] = operation.get("value")
        linkage["sync_state"] = "synced"
    linkage["last_synced_at"] = now
    linkage["last_error_code"] = None
    return {"github_project_linkages": linkages}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--graph")
    parser.add_argument("--remote-state")
    parser.add_argument("--snapshot", default=".dev-graph/state/sync-snapshot.json")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", action="append", default=[])
    parser.add_argument("--eval-log")
    parser.add_argument("--no-eval-log", action="store_true")
    parser.add_argument("--bd-bridge")
    parser.add_argument("--gh-bridge")
    parser.add_argument("--upsert-node")
    parser.add_argument("--parity-manifest")
    parser.add_argument("--build-parity-manifest")
    args = parser.parse_args(argv)

    root = Path(args.repo_root).expanduser().resolve(strict=True)
    config = load_json(root / ".dev-graph" / "config.json")
    if not isinstance(config, dict):
        raise ContractError(".dev-graph/config.json must be an object")
    graph_path = _graph_path(root, args.graph, config)
    ensure_no_pending_transaction(graph_path)
    graph_before = graph_path.read_bytes()
    graph = json.loads(graph_before.decode("utf-8"))
    nodes = graph.get("nodes") if isinstance(graph, dict) else None
    if not isinstance(nodes, list) or not all(isinstance(node, dict) for node in nodes):
        raise ContractError("canonical graph must contain nodes[] objects")
    snapshot_path = _state_path(root, args.snapshot, ".dev-graph/state/sync-snapshot.json", must_exist=False)
    snapshot_before = snapshot_path.read_bytes() if snapshot_path.exists() else None
    snapshot = json.loads(snapshot_before.decode("utf-8")) if snapshot_before is not None else {"schema_version": "1.0", "nodes": {}}
    bd_bridge = Path(args.bd_bridge).resolve() if args.bd_bridge else Path(__file__).with_name("bd-bridge.py")
    gh_bridge = Path(args.gh_bridge).resolve() if args.gh_bridge else Path(__file__).with_name("gh-bridge.py")
    upsert = Path(args.upsert_node).resolve() if args.upsert_node else Path(__file__).with_name("upsert-node.py")
    builder = (
        Path(args.build_parity_manifest).resolve() if args.build_parity_manifest
        else Path(__file__).with_name("build-parity-manifest.py")
    )

    remote_path: Path | None = None
    if args.remote_state:
        remote_path = _state_path(root, args.remote_state, "", must_exist=True)
        remote_before = remote_path.read_bytes()
        remote = json.loads(remote_before.decode("utf-8"))
    else:
        remote_before = None
        remote = _collect_remote(root, nodes, config, bd_bridge, gh_bridge)
    if not isinstance(remote, dict):
        raise ContractError("remote state must be an object")
    plan = _plan(nodes, remote, snapshot, config, _confirmations(args.confirm))
    applied: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    parity_manifest: dict[str, Any] | None = (
        None if not args.parity_manifest
        else {"regenerated": False, "reason": "dry-run"} if args.dry_run else None
    )
    if args.apply:
        for node_id, patch in sorted(plan["patches"].items()):
            try:
                applied.append({"type": "local", "node": node_id, "receipt": _apply_patch(root, node_id, patch, upsert)})
            except ContractError as exc:
                failed.append({"type": "local", "node": node_id, "reason": str(exc)})
        by_id = {_node_id(node): node for node in nodes}
        fixture_now = utc_now()
        for operation in plan["exports"]:
            try:
                if remote_path is not None:
                    fixture_receipt = _fixture_apply(remote, operation, fixture_now)
                    receipt: dict[str, Any] = {"fixture": True, "operation": operation, **fixture_receipt}
                else:
                    receipt = _live_apply(root, operation, by_id[operation["node"]], bd_bridge, gh_bridge)
                applied.append({"type": "external", "node": operation["node"], "receipt": receipt})
                if operation.get("alias"):
                    current_graph = load_json(graph_path)
                    current_node = next(
                        (item for item in current_graph.get("nodes", []) if _node_id(item) == operation["node"]),
                        None,
                    )
                    if current_node is None:
                        raise ContractError("Project linkage projection node disappeared")
                    linkage_patch = _project_linkage_patch(current_node, operation, receipt)
                    if linkage_patch:
                        projection_receipt = _apply_patch(root, operation["node"], linkage_patch, upsert)
                        applied.append({
                            "type": "local_project_linkage", "node": operation["node"],
                            "alias": operation["alias"], "receipt": projection_receipt,
                        })
            except ContractError as exc:
                reason = str(exc)
                failed.append({"type": "external", "node": operation["node"], "operation": operation, "reason": reason})
                if operation.get("alias"):
                    try:
                        current_graph = load_json(graph_path)
                        current_node = next(
                            (item for item in current_graph.get("nodes", []) if _node_id(item) == operation["node"]),
                            None,
                        )
                        if current_node is not None:
                            pending_patch = _project_linkage_patch(current_node, operation, None, error=reason)
                            if pending_patch:
                                projection_receipt = _apply_patch(root, operation["node"], pending_patch, upsert)
                                applied.append({
                                    "type": "local_pending_retry", "node": operation["node"],
                                    "alias": operation["alias"], "receipt": projection_receipt,
                                })
                    except ContractError as projection_error:
                        failed.append({
                            "type": "local_pending_retry", "node": operation["node"],
                            "reason": str(projection_error),
                        })
        for pending_item in plan["pending_retry"]:
            if not pending_item.get("alias"):
                continue
            current_graph = load_json(graph_path)
            current_node = next(
                (item for item in current_graph.get("nodes", []) if _node_id(item) == pending_item["node"]),
                None,
            )
            if current_node is None:
                continue
            pending_patch = _project_linkage_patch(
                current_node,
                {"alias": pending_item["alias"], "kind": "pending-retry"},
                None,
                error=str(pending_item.get("reason") or "pending_retry"),
            )
            if pending_patch:
                projection_receipt = _apply_patch(root, pending_item["node"], pending_patch, upsert)
                applied.append({
                    "type": "local_pending_retry", "node": pending_item["node"],
                    "alias": pending_item["alias"], "receipt": projection_receipt,
                })
        if args.parity_manifest:
            # 収束後の graph から C28 parity manifest を作り直す (契約 §10 の回復手順)。
            # apply でだけ回すのは、生成が graph の *結果* の投影であり、dry-run は
            # 「何も書かない」ことそのものが契約だから。dry-run で manifest だけ欲しい場合は
            # build-parity-manifest.py を直接呼ぶ (read-only な単独 generator)。
            try:
                parity_manifest = _invoke(
                    [
                        sys.executable, str(builder), "--repo-root", str(root),
                        "--graph", str(graph_path), "--out", str(args.parity_manifest),
                    ],
                    root,
                    "parity manifest regeneration",
                )
            except ContractError as exc:
                # 失敗を握り潰すと「同期は成功したが下流の ready-set は空のまま」という
                # 本 issue そのものの状態へ戻る。snapshot も進めない。
                failed.append({"type": "parity_manifest", "reason": str(exc)})
            else:
                applied.append({"type": "parity_manifest", "receipt": parity_manifest})
        if remote_path is not None and any(item["type"] == "external" for item in applied):
            atomic_json(remote_path, remote)
        if not plan["conflicts"] and not plan["pending_retry"] and not failed:
            atomic_json(snapshot_path, plan["next_snapshot"])

    graph_after = graph_path.read_bytes()
    remote_after = remote_path.read_bytes() if remote_path is not None else None
    snapshot_after = snapshot_path.read_bytes() if snapshot_path.exists() else None
    if args.dry_run and graph_after != graph_before:
        raise ContractError("dry-run changed the canonical graph")
    if args.dry_run and remote_after != remote_before:
        raise ContractError("dry-run changed the remote fixture")
    if args.dry_run and snapshot_after != snapshot_before:
        raise ContractError("dry-run changed the sync snapshot")
    report = {
        "ok": not failed,
        "mode": "apply" if args.apply else "dry-run",
        "imports": plan["imports"],
        "exports": plan["exports"],
        "conflicts": plan["conflicts"],
        "tombstones": plan["tombstones"],
        "pending_retry": [*plan["pending_retry"], *failed],
        "changes": len(plan["imports"]) + len(plan["exports"]) + len(plan["tombstones"]),
        "write_count": len(applied),
        "applied": applied,
        "graph_sha256_before": _sha(graph_before),
        "graph_sha256_after": _sha(graph_after),
        "remote_sha256_before": _sha(remote_before),
        "remote_sha256_after": _sha(remote_after),
        "snapshot_sha256_before": _sha(snapshot_before),
        "snapshot_sha256_after": _sha(snapshot_after),
        "converged": not plan["imports"] and not plan["exports"] and not plan["conflicts"] and not plan["pending_retry"] and not failed,
        "parity_manifest": parity_manifest,
        "executed_at": utc_now(),
    }
    if not args.no_eval_log and args.eval_log:
        eval_root = repository_eval_root(root)
        target = Path(args.eval_log)
        target = target if target.is_absolute() else root / target
        target = contained(target, eval_root, must_exist=False)
        atomic_json(target, report)
        report["eval_log"] = target.relative_to(root).as_posix()
    dump(report)
    return 0 if not failed else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ContractError, OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        dump({"ok": False, "error": str(exc), "write_count": 0})
        raise SystemExit(2)
