"""Shared constants and pure helpers for the spec-state transition writer."""
from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import urlsplit

CANONICAL_PLATFORMS = (
    "web", "mobile", "tablet", "desktop-windows", "desktop-linux", "desktop-macos",
)
PLATFORM_LABELS = {
    "web": "Web", "mobile": "モバイル", "tablet": "タブレット",
    "desktop-windows": "デスクトップ (Windows)", "desktop-linux": "デスクトップ (Linux)",
    "desktop-macos": "デスクトップ (macOS)",
}
CELL_STATES = {"未収集", "対象外", "確定"}
MAX_LOOPS_DEFAULT = 5
FOUNDATION_U_KEYS = (
    "essential_purpose", "background", "goals", "objectives", "success_criteria",
    "stakeholders", "scope", "constraints", "concrete_intents",
)
FOUNDATION_NA_FORBIDDEN = ("essential_purpose", "background", "goals")
FOUNDATION_KEYS = FOUNDATION_U_KEYS + ("confirmed", "approval_ref")
DECISION_STATUSES = {"needs_guidance", "recommended_pending_confirmation", "confirmed"}
DECISION_COST_CATEGORIES = {"free", "low-cost", "paid", "unknown"}
DECISION_COMPARISON_AXES = ("goal_fit", "tco", "security", "operations", "lock_in")
DECISION_OPTION_FIELDS = (
    "id", "label", "cost_model", "free_tier_limits", "goal_fit", "security_fit", "pros",
    "cons", "risks", "lock_in", "ops_burden", "evidence_refs",
)
RFC3339_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")


class TransitionError(Exception):
    """A state transition violates the single-writer contract."""


def empty_foundation() -> dict:
    return {
        "essential_purpose": "", "background": "", "goals": [], "objectives": [],
        "success_criteria": [], "stakeholders": [], "scope": {"in": [], "out": []},
        "constraints": [], "concrete_intents": [], "confirmed": False,
    }


def normalize_serves(raw) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise TransitionError(f"serves_goals は配列でない: {raw!r}")
    values: list[str] = []
    for goal_id in raw:
        if not isinstance(goal_id, str) or not goal_id.strip():
            raise TransitionError(f"serves_goals 要素は非空文字列でない: {goal_id!r}")
        if goal_id not in values:
            values.append(goal_id)
    return values


def foundation_goal_ids(goals) -> list[str]:
    if not isinstance(goals, list):
        raise TransitionError("requirements_foundation.goals は配列でない")
    ids: list[str] = []
    for goal in goals:
        if not isinstance(goal, dict) or not goal.get("id"):
            raise TransitionError(f"goal に id が必須: {goal!r}")
        if goal["id"] in ids:
            raise TransitionError(f"goal id が重複: {goal['id']!r}")
        ids.append(goal["id"])
    return ids


def is_explicit_na(value) -> bool:
    return isinstance(value, dict) and value.get("status") == "not_applicable" and bool(str(value.get("reason") or "").strip())


def foundation_missing_fields(foundation: dict) -> list[str]:
    missing: list[str] = []
    for key in FOUNDATION_U_KEYS:
        value = foundation.get(key)
        if key not in FOUNDATION_NA_FORBIDDEN and is_explicit_na(value):
            continue
        if key in ("essential_purpose", "background"):
            present = isinstance(value, str) and bool(value.strip())
        elif key == "scope":
            present = isinstance(value, dict) and isinstance(value.get("in"), list) and isinstance(value.get("out"), list) and bool(value.get("in") or value.get("out"))
        else:
            present = isinstance(value, list) and bool(value)
        if not present:
            missing.append(key)
    return missing


def has_entry(log: list[dict], entry_id: str) -> bool:
    return any(entry.get("id") == entry_id for entry in log)


def require_nonempty(value, label: str) -> None:
    if isinstance(value, str):
        valid = bool(value.strip())
    elif isinstance(value, (list, dict)):
        valid = bool(value)
    else:
        valid = value is not None
    if not valid:
        raise TransitionError(f"decision: {label} が空")


def require_nonempty_string_list(value, label: str) -> None:
    if not isinstance(value, list) or not value or any(not isinstance(item, str) or not item.strip() for item in value):
        raise TransitionError(f"decision: {label} は非空文字列の配列必須")


def is_https_url(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return parsed.scheme == "https" and bool(parsed.hostname) and parsed.username is None


def is_rfc3339(value) -> bool:
    if not isinstance(value, str) or not RFC3339_RE.fullmatch(value):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True
