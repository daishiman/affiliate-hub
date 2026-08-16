"""Lifecycle transition for system-design knowledge candidates."""
from __future__ import annotations

import re

from state_transition_common import TransitionError, foundation_goal_ids, normalize_serves

KNOWLEDGE_CANDIDATE_STATUSES = ("discovered", "qualified", "deepened", "promoted")
KNOWLEDGE_CARD_REQUIRED_FIELDS = (
    "purpose", "background", "problems", "core_concepts", "applies_when", "does_not_apply_when",
    "tradeoffs", "failure_modes", "goal_contribution", "primary_sources", "freshness",
)
KNOWLEDGE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _require_candidate_value(value, label: str) -> None:
    if isinstance(value, str):
        valid = bool(value.strip())
    elif isinstance(value, (list, dict)):
        valid = bool(value)
    else:
        valid = value is not None
    if not valid:
        raise TransitionError(f"knowledge candidate: {label} が空")


def _validate_candidate_sources(source_refs: object) -> None:
    if not isinstance(source_refs, list) or not source_refs:
        raise TransitionError("knowledge candidate: qualified 以降は source_refs が非空必須")
    for index, source in enumerate(source_refs):
        if not isinstance(source, dict):
            raise TransitionError(f"knowledge candidate: source_refs[{index}] は object 必須")
        if not isinstance(source.get("url"), str) or not source["url"].startswith("https://"):
            raise TransitionError(f"knowledge candidate: source_refs[{index}].url は HTTPS 必須")
        if source.get("official_or_primary") is not True:
            raise TransitionError(f"knowledge candidate: source_refs[{index}] は official_or_primary=true 必須")
        _require_candidate_value(source.get("checked_at"), f"source_refs[{index}].checked_at")


def _validate_deep_knowledge_card(card: object) -> None:
    if not isinstance(card, dict):
        raise TransitionError("knowledge candidate: deepened 以降は card object 必須")
    for field in KNOWLEDGE_CARD_REQUIRED_FIELDS:
        _require_candidate_value(card.get(field), f"card.{field}")
    primary_sources = card.get("primary_sources")
    if not isinstance(primary_sources, list):
        raise TransitionError("knowledge candidate: card.primary_sources は配列必須")
    for index, source in enumerate(primary_sources):
        if not isinstance(source, dict):
            raise TransitionError(f"knowledge candidate: card.primary_sources[{index}] は object 必須")
        if not isinstance(source.get("locator"), str) or not source["locator"].startswith("https://"):
            raise TransitionError(f"knowledge candidate: card.primary_sources[{index}].locator は HTTPS 必須")


def set_knowledge_candidate(state: dict, candidate: dict) -> None:
    if not isinstance(candidate, dict):
        raise TransitionError("knowledge candidate は object 必須")
    candidate_id = candidate.get("id")
    if not isinstance(candidate_id, str) or not KNOWLEDGE_ID_RE.fullmatch(candidate_id):
        raise TransitionError("knowledge candidate: id は kebab-case の stable id 必須")
    for field in ("topic", "status", "problem", "serves_goals"):
        _require_candidate_value(candidate.get(field), field)
    status = candidate.get("status")
    if status not in KNOWLEDGE_CANDIDATE_STATUSES:
        raise TransitionError(f"knowledge candidate: status={status!r} が許容値外")
    if not isinstance(candidate.get("source_refs"), list):
        raise TransitionError("knowledge candidate: source_refs は配列必須")
    serves = normalize_serves(candidate.get("serves_goals"))
    goal_ids = set(foundation_goal_ids((state.get("requirements_foundation") or {}).get("goals", [])))
    dangling = [goal_id for goal_id in serves if goal_id not in goal_ids]
    if dangling:
        raise TransitionError(f"knowledge candidate: serves_goals {dangling} が実在 goal を指さない")
    status_index = KNOWLEDGE_CANDIDATE_STATUSES.index(status)
    if status_index >= KNOWLEDGE_CANDIDATE_STATUSES.index("qualified"):
        _validate_candidate_sources(candidate["source_refs"])
    if status_index >= KNOWLEDGE_CANDIDATE_STATUSES.index("deepened"):
        _validate_deep_knowledge_card(candidate.get("card"))
    if status == "promoted":
        _require_candidate_value(candidate.get("curation_ref"), "curation_ref")
    records = list(state.get("knowledge_candidates") or [])
    existing_index = None
    for index, current in enumerate(records):
        if isinstance(current, dict) and current.get("id") == candidate_id:
            existing_index = index
            if current.get("topic") != candidate.get("topic"):
                raise TransitionError("knowledge candidate: stable topic は変更できない")
            current_status = current.get("status")
            if current_status not in KNOWLEDGE_CANDIDATE_STATUSES:
                raise TransitionError("knowledge candidate: 既存 status が不正")
            current_index = KNOWLEDGE_CANDIDATE_STATUSES.index(current_status)
            if status_index not in (current_index, current_index + 1):
                raise TransitionError("knowledge candidate: lifecycle は同一status更新または1段階前進のみ")
            break
    if existing_index is None and status != "discovered":
        raise TransitionError("knowledge candidate: 新規 candidate は discovered から開始する")
    normalized = dict(candidate)
    normalized["serves_goals"] = serves
    if existing_index is None:
        records.append(normalized)
    else:
        records[existing_index] = normalized
    state["knowledge_candidates"] = records
