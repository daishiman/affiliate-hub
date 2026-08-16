"""Matrix, log, and resumable-chunk transitions owned by the spec-state writer."""
from __future__ import annotations

import re

from state_transition_common import (
    CANONICAL_PLATFORMS,
    CELL_STATES,
    PLATFORM_LABELS,
    TransitionError,
    empty_foundation,
    has_entry,
    normalize_serves,
)
CATEGORY_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
APPLICATION_STATES = {"applied", "not_applicable"}
DESIGN_APPLICATION_CONTRACT_VERSION = "1.0"
CURRENT_STATE_SCHEMA_VERSION = "1.1"


def normalize_design_applications(raw: object) -> list[dict]:
    """Validate chapter-specific design interpretation separately from Q&A text."""
    if not isinstance(raw, list) or not raw:
        raise TransitionError("design_applications は非空配列必須")
    normalized: list[dict] = []
    for index, item in enumerate(raw):
        label = f"design_applications[{index}]"
        if not isinstance(item, dict):
            raise TransitionError(f"{label} は object 必須")
        for key in ("knowledge_ref", "principle", "rationale"):
            value = item.get(key)
            if not isinstance(value, str) or not value.strip():
                raise TransitionError(f"{label}.{key} は非空文字列必須")
        applicability = item.get("applicability")
        if applicability not in APPLICATION_STATES:
            raise TransitionError(
                f"{label}.applicability={applicability!r} は applied|not_applicable 必須"
            )
        tradeoffs = item.get("tradeoffs")
        if (
            not isinstance(tradeoffs, list)
            or not tradeoffs
            or any(not isinstance(value, str) or not value.strip() for value in tradeoffs)
        ):
            raise TransitionError(f"{label}.tradeoffs は非空文字列の配列必須")
        normalized.append(
            {
                "knowledge_ref": item["knowledge_ref"].strip(),
                "principle": item["principle"].strip(),
                "applicability": applicability,
                "rationale": item["rationale"].strip(),
                "tradeoffs": [value.strip() for value in tradeoffs],
            }
        )
    return normalized


def set_qa_design_applications(state: dict, qa_id: str, raw: object) -> None:
    """Backfill design interpretation without rewriting the original Q&A text."""
    if not isinstance(qa_id, str) or not qa_id.strip():
        raise TransitionError("set-qa-design-applications: qa_id は非空文字列必須")
    qa_id = qa_id.strip()
    entry = next(
        (candidate for candidate in state.get("qa_log", []) if candidate.get("id") == qa_id),
        None,
    )
    if entry is None:
        raise TransitionError(
            f"set-qa-design-applications: qa_log に存在しない qa_id: {qa_id}"
        )

    normalized = normalize_design_applications(raw)
    provenance = {
        "mode": "legacy_backfill",
        "writer": "set-qa-design-applications",
    }
    existing = entry.get("design_applications")
    existing_provenance = entry.get("design_application_provenance")
    if existing_provenance is not None:
        # The shared schema permits only this exact provenance. Keep the explicit
        # guard because this function and CLI also receive hand-authored JSON
        # before the standalone schema/coverage gates run.
        if existing_provenance != provenance:
            raise TransitionError(
                f"set-qa-design-applications: 既存 provenance の上書きは拒否: {qa_id}"
            )
        if existing is None:
            raise TransitionError(
                "set-qa-design-applications: 完了済み provenance に対する "
                f"design_applications 欠落を検出: {qa_id}"
            )
        if normalize_design_applications(existing) != normalized:
            raise TransitionError(
                "set-qa-design-applications: 完了済み backfill と異なる "
                f"design_applications の再適用は拒否: {qa_id}"
            )
        # A previously completed backfill is the only idempotent replay allowed.
        entry.pop("legacy_exempt", None)
        entry.pop("legacy_exempt_reason", None)
        return

    if existing is not None:
        raise TransitionError(
            "set-qa-design-applications: provenance の無い既存 design_applications は"
            f"対話経路として保護し、legacy_backfill への変更を拒否: {qa_id}"
        )
    reason = entry.get("legacy_exempt_reason")
    if entry.get("legacy_exempt") is not True or not isinstance(reason, str) or not reason.strip():
        raise TransitionError(
            "set-qa-design-applications: legacy_exempt=true と非空の "
            f"legacy_exempt_reason を持つ旧 qa のみ補完可能: {qa_id}"
        )

    entry["design_applications"] = normalized
    entry["design_application_provenance"] = provenance
    # A successful validated backfill supersedes the temporary legacy escape.
    entry.pop("legacy_exempt", None)
    entry.pop("legacy_exempt_reason", None)


def derive_aggregate(cells: list[str]) -> str:
    if not cells or all(state == "未収集" for state in cells):
        return "未着手"
    if all(state == "対象外" for state in cells):
        return "対象外"
    if any(state == "未収集" for state in cells):
        return "収集中"
    return "確定"


def _row_states(state: dict, category_id: str) -> list[str]:
    return [state["matrix"][category_id][platform]["state"] for platform in CANONICAL_PLATFORMS]


def recompute_aggregates(state: dict) -> None:
    state["category_aggregate"] = {
        category["id"]: derive_aggregate(_row_states(state, category["id"]))
        for category in state["categories"]
    }


def count_unresolved(state: dict) -> int:
    return sum(
        cell.get("state") == "未収集"
        for row in state.get("matrix", {}).values()
        for cell in row.values()
        if isinstance(cell, dict)
    )


def _refresh_hearing_progress(state: dict) -> None:
    """Keep the resumable progress fields consistent with the matrix."""
    progress = state.setdefault("hearing_progress", {})
    unresolved = count_unresolved(state)
    progress["complete"] = unresolved == 0
    progress["next_question"] = None if unresolved == 0 else next_unresolved_question(state)


def bootstrap_state() -> dict:
    return {
        "schema_version": CURRENT_STATE_SCHEMA_VERSION,
        "design_application_contract_version": DESIGN_APPLICATION_CONTRACT_VERSION,
        "categories": [], "platforms": list(CANONICAL_PLATFORMS),
        "matrix": {}, "qa_log": [], "approval_log": [], "reopen_log": [],
        "category_aggregate": {}, "targets": [], "requirements_foundation": empty_foundation(),
        "decisions": [], "knowledge_candidates": [],
        "hearing_progress": {"loop_count": 0, "next_question": None, "complete": False},
    }


def init_state(taxonomy: dict, existing_state: dict | None = None) -> dict:
    if not isinstance(taxonomy, dict):
        raise TransitionError("taxonomy は object 必須")
    platforms = taxonomy.get("platforms")
    if not isinstance(platforms, list):
        raise TransitionError("taxonomy.platforms は配列必須")
    taxonomy_platforms = [item.get("id") for item in platforms if isinstance(item, dict)]
    if taxonomy_platforms != list(CANONICAL_PLATFORMS):
        raise TransitionError("taxonomy.platforms は canonical 6 platform と順序を一致させる必要がある")
    categories = taxonomy.get("categories")
    if not isinstance(categories, list) or not categories:
        raise TransitionError("taxonomy.categories は非空配列必須")
    ids = [item.get("id") for item in categories if isinstance(item, dict)]
    if len(ids) != len(categories) or len(set(ids)) != len(ids):
        raise TransitionError("taxonomy.categories の id が不正または重複")
    if existing_state and any(
        isinstance(cell, dict) and cell.get("state") == "確定"
        for row in existing_state.get("matrix", {}).values()
        if isinstance(row, dict)
        for cell in row.values()
    ):
        raise TransitionError(
            "init --state は matrix 未着手の bootstrap state 専用。"
            "確定セルを含む state の再初期化は R4-reopen を迂回するため拒否"
        )
    if existing_state is None:
        state = bootstrap_state()
    else:
        if not isinstance(existing_state, dict):
            raise TransitionError("既存 state は object 必須")
        schema_version = existing_state.get("schema_version")
        contract_version = existing_state.get("design_application_contract_version")
        if schema_version == "1.0":
            if contract_version is not None:
                raise TransitionError(
                    "legacy schema 1.0 は design_application_contract_version 欠落時だけ"
                    "明示 migration 可能"
                )
        elif schema_version == CURRENT_STATE_SCHEMA_VERSION:
            if contract_version != DESIGN_APPLICATION_CONTRACT_VERSION:
                raise TransitionError(
                    "schema 1.1 は design_application_contract_version=1.0 必須。"
                    "marker 欠落/不一致を init で修復してはならない"
                )
        else:
            raise TransitionError(
                "既存 state の schema_version は exact 1.0 legacy または exact 1.1 current 必須"
            )
        state = dict(existing_state)
    # init は legacy 1.0 state の明示 migration boundary でもある。matrix は未収集へ
    # 再初期化されるため、旧 qa entry を design-app contract 適合と偽装せず 1.1 へ進められる。
    state["schema_version"] = CURRENT_STATE_SCHEMA_VERSION
    state["design_application_contract_version"] = DESIGN_APPLICATION_CONTRACT_VERSION
    state["categories"] = [{"id": item["id"], "label": item["label"]} for item in categories]
    state["platforms"] = list(CANONICAL_PLATFORMS)
    state["matrix"] = {
        category["id"]: {platform: {"state": "未収集"} for platform in CANONICAL_PLATFORMS}
        for category in state["categories"]
    }
    state.setdefault("qa_log", [])
    state.setdefault("approval_log", [])
    state.setdefault("reopen_log", [])
    state.setdefault("targets", [])
    state.setdefault("requirements_foundation", empty_foundation())
    state.setdefault("decisions", [])
    state.setdefault("knowledge_candidates", [])
    state["hearing_progress"] = {"loop_count": 0, "next_question": None, "complete": False}
    recompute_aggregates(state)
    _refresh_hearing_progress(state)
    return state


def add_category(state: dict, category: dict) -> None:
    if not isinstance(category, dict):
        raise TransitionError("add-category: category は object 必須")
    category_id, label = category.get("id"), category.get("label")
    if not isinstance(category_id, str) or not category_id.strip():
        raise TransitionError("add-category: id が空")
    if not isinstance(label, str) or not label.strip():
        raise TransitionError("add-category: label が空")
    category_id, label = category_id.strip(), label.strip()
    if not CATEGORY_ID_RE.fullmatch(category_id):
        raise TransitionError(f"add-category: id は kebab-case 必須 ({category_id})")
    if category_id in state["matrix"] or any(item.get("id") == category_id for item in state["categories"]):
        raise TransitionError(f"add-category: 既存カテゴリ ({category_id}) の変更は R4-reopen 経由")
    state["categories"].append({"id": category_id, "label": label})
    state["matrix"][category_id] = {platform: {"state": "未収集"} for platform in CANONICAL_PLATFORMS}
    recompute_aggregates(state)
    _refresh_hearing_progress(state)


def _cell(state: dict, category: str, platform: str) -> dict:
    if category not in state["matrix"]:
        raise TransitionError(f"未知カテゴリ: {category}")
    if platform not in state["matrix"][category]:
        raise TransitionError(f"未知 platform: {platform} (カテゴリ {category})")
    return state["matrix"][category][platform]


def apply_cell_op(state: dict, op: dict) -> None:
    action, category, platform = op.get("action"), op.get("category"), op.get("platform")
    cell = _cell(state, category, platform)
    current = cell.get("state")
    if action == "reopen":
        if current != "確定":
            raise TransitionError(f"reopen 不可: {category}/{platform} は '{current}' (確定セルのみ reopen できる)")
        if not op.get("reason"):
            raise TransitionError(f"reopen には reason が必須: {category}/{platform}")
        discarded = {
            key: list(cell[key]) if isinstance(cell[key], list) else cell[key]
            for key in ("qa_ref", "serves_goals", "serves_intents")
            if key in cell
        }
        log_entry = {
            "category": category,
            "platform": platform,
            "reason": op["reason"],
            "from": "確定",
        }
        if discarded:
            log_entry["discarded"] = discarded
        state.setdefault("reopen_log", []).append(log_entry)
        state["matrix"][category][platform] = {"state": "未収集", "reopened_from": "確定", "reopen_reason": op["reason"]}
        return
    if action == "set-serves":
        if current != "確定":
            raise TransitionError(f"set-serves 不可: {category}/{platform} は '{current}' (確定セルのみ serves_goals を付与できる)")
        serves = normalize_serves(op.get("serves_goals"))
        if not serves:
            raise TransitionError(f"set-serves には非空 serves_goals が必須: {category}/{platform}")
        cell["serves_goals"] = serves
        return
    if action == "set-approval":
        # exclude は approval_ref を cell へ持てるのに confirm は持てない、という非対称が
        # 「回答本文は承認を主張しているが、確定セルから承認記録へ機械追跡できない」
        # (F-0025) の直接原因だった。confirm の action 定義を変えると確定条件そのものへ
        # 触れることになるため、確定セル限定の後付け annotation である set-serves と
        # 同型の action を新設して対称化する (単一 writer 契約・確定巻き戻し拒否は不変)。
        if current != "確定":
            raise TransitionError(
                f"set-approval 不可: {category}/{platform} は '{current}' (確定セルのみ approval_ref を付与できる)"
            )
        approval_ref = op.get("approval_ref")
        if not isinstance(approval_ref, str) or not approval_ref.strip():
            raise TransitionError(f"set-approval には非空 approval_ref が必須: {category}/{platform}")
        approval_ref = approval_ref.strip()
        if not has_entry(state.get("approval_log", []), approval_ref):
            raise TransitionError(
                f"set-approval: approval_log に存在しない approval_ref: {approval_ref} ({category}/{platform})"
            )
        cell["approval_ref"] = approval_ref
        return
    if current == "確定":
        raise TransitionError(f"確定セルの直接変更は拒否: {category}/{platform}。変更は R4-reopen を経由すること")
    if action == "confirm":
        if not op.get("qa_ref"):
            raise TransitionError(f"confirm には qa_ref が必須: {category}/{platform}")
        next_cell = {"state": "確定", "qa_ref": op["qa_ref"]}
        serves = normalize_serves(op.get("serves_goals"))
        if serves:
            next_cell["serves_goals"] = serves
        state["matrix"][category][platform] = next_cell
    elif action == "exclude":
        if not (op.get("reason") or op.get("approval_ref")):
            raise TransitionError(f"exclude には reason か approval_ref が必須: {category}/{platform}")
        next_cell = {"state": "対象外"}
        if op.get("reason"):
            next_cell["reason"] = op["reason"]
        if op.get("approval_ref"):
            next_cell["approval_ref"] = op["approval_ref"]
        state["matrix"][category][platform] = next_cell
    else:
        raise TransitionError(f"未知 action: {action!r}")


def set_targets(state: dict, targets: list) -> None:
    if not isinstance(targets, list):
        raise TransitionError(f"targets は配列でない: {targets!r}")
    normalized, seen = [], set()
    for target in targets:
        if isinstance(target, str):
            target_id, category = target, None
        elif isinstance(target, dict):
            target_id, category = target.get("target_id"), target.get("category")
        else:
            raise TransitionError(f"target は str か object でない: {target!r}")
        if not target_id:
            raise TransitionError(f"target に target_id が必須: {target!r}")
        if target_id in seen:
            raise TransitionError(f"target_id が重複: {target_id!r}")
        seen.add(target_id)
        entry = {"target_id": target_id}
        if category:
            entry["category"] = category
        normalized.append(entry)
    state["targets"] = normalized


def apply_turn(state: dict, turn: dict) -> None:
    qa_id = turn.get("qa_id")
    ops = turn.get("ops", [])
    normalized_design_applications: list[dict] | None = None
    if state.get("design_application_contract_version") == DESIGN_APPLICATION_CONTRACT_VERSION:
        confirmed_refs = {
            op.get("qa_ref") or qa_id
            for op in ops
            if isinstance(op, dict) and op.get("action") == "confirm"
        }
        for qa_ref in confirmed_refs:
            if not qa_ref:
                continue
            if qa_ref == qa_id and not has_entry(state["qa_log"], qa_ref):
                normalized_design_applications = normalize_design_applications(
                    turn.get("design_applications")
                )
                continue
            existing = next(
                (entry for entry in state["qa_log"] if entry.get("id") == qa_ref),
                None,
            )
            if existing is None:
                raise TransitionError(
                    f"schema 1.1 の confirm は qa_log entry を参照する必要がある: {qa_ref}"
                )
            normalize_design_applications(existing.get("design_applications"))
    if qa_id and not has_entry(state["qa_log"], qa_id):
        entry = {"id": qa_id, "question": turn.get("question", ""), "answer": turn.get("answer", "")}
        if "source" in turn:
            entry["source"] = turn["source"]
        if normalized_design_applications is not None:
            entry["design_applications"] = normalized_design_applications
        elif "design_applications" in turn:
            entry["design_applications"] = normalize_design_applications(turn["design_applications"])
        state["qa_log"].append(entry)
    approval_id = turn.get("approval_id")
    if approval_id and not has_entry(state["approval_log"], approval_id):
        state["approval_log"].append({"id": approval_id, "note": turn.get("approval_note", "")})
    for raw_op in ops:
        op = dict(raw_op)
        if op.get("action") == "confirm" and not op.get("qa_ref") and qa_id:
            op["qa_ref"] = qa_id
        if op.get("action") == "exclude" and not op.get("reason") and not op.get("approval_ref") and approval_id:
            op["approval_ref"] = approval_id
        # confirm と同 turn で承認を得た場合、その turn の approval_id を確定セルへ紐づける。
        # turn 境界は state に永続化されないため (LS-04)、この場でしか対応を残せない。
        if op.get("action") == "set-approval" and not op.get("approval_ref") and approval_id:
            op["approval_ref"] = approval_id
        apply_cell_op(state, op)
    recompute_aggregates(state)
    _refresh_hearing_progress(state)


def next_unresolved_question(state: dict) -> str | None:
    labels = {category["id"]: category["label"] for category in state["categories"]}
    for category in state["categories"]:
        for platform in CANONICAL_PLATFORMS:
            cell = state["matrix"][category["id"]].get(platform)
            if cell and cell.get("state") == "未収集":
                return f"{labels.get(category['id'], category['id'])}（{category['id']}）× {PLATFORM_LABELS.get(platform, platform)}（{platform}）は対象ですか? 対象なら要件を、非対象なら理由を教えてください。"
    return None


def run_chunk(state: dict, turns: list[dict], max_loops: int = 5) -> int:
    processed = 0
    state["hearing_progress"]["loop_count"] = 0
    for turn in turns:
        if processed >= max_loops:
            break
        apply_turn(state, turn)
        processed += 1
        state["hearing_progress"]["loop_count"] = processed
    recompute_aggregates(state)
    _refresh_hearing_progress(state)
    state["hearing_progress"]["max_loops"] = max_loops
    return processed
