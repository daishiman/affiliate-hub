"""Deterministic provenance checks for the U1--U9 foundation source indexes.

The state writer and the coverage validator both use this module so a prose
instruction cannot claim a foundation is traceable while the gate accepts an
unattributed confirmation.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import PurePosixPath

FOUNDATION_SOURCE_INDEXES = (
    ("essential_purpose", "U1", "qa-foundation-u1"),
    ("background", "U2", "qa-foundation-u2"),
    ("goals", "U3", "qa-foundation-u3"),
    ("objectives", "U4", "qa-foundation-u4"),
    ("success_criteria", "U5", "qa-foundation-u5"),
    ("stakeholders", "U6", "qa-foundation-u6"),
    ("scope", "U7", "qa-foundation-u7"),
    ("constraints", "U8", "qa-foundation-u8"),
    ("concrete_intents", "U9", "qa-foundation-u9"),
)
SOURCE_KINDS = {"user-dialogue", "written-requirements"}
U_MARKER_RE = re.compile(r"(?<![A-Za-z0-9])U([1-9])(?![A-Za-z0-9])")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _entry_by_id(qa_log) -> dict[str, dict]:
    if not isinstance(qa_log, list):
        return {}
    return {
        entry["id"]: entry
        for entry in qa_log
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    }


def _is_relative_path(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and ".." not in path.parts and str(path) not in {"", "."}


def validate_foundation_source_indexes(data: dict) -> list[str]:
    """Return findings unless every U1--U9 has one trustworthy QA source index.

    A dialogue source keeps the exact user answer. A written source additionally
    binds its relative path, section, and SHA-256 of the recorded original text.
    These checks are deliberately content-addressed but do not read arbitrary
    user paths during validation; the state stays portable and self-contained.
    """
    entries = _entry_by_id(data.get("qa_log"))
    findings: list[str] = []
    for _field, label, entry_id in FOUNDATION_SOURCE_INDEXES:
        entry = entries.get(entry_id)
        prefix = f"requirements_foundation: {label} source-index ({entry_id})"
        if not entry:
            findings.append(f"{prefix} が qa_log に不在")
            continue
        question = entry.get("question")
        answer = entry.get("answer")
        if not isinstance(question, str) or not question.strip():
            findings.append(f"{prefix} の question が空")
        if not isinstance(answer, str) or not answer.strip():
            findings.append(f"{prefix} の answer (利用者原文) が空")
        marker_numbers = set(U_MARKER_RE.findall(question or ""))
        expected = label.removeprefix("U")
        if marker_numbers != {expected}:
            findings.append(f"{prefix} は 1論点の {label} を示す question が必要")
        source = entry.get("source")
        if not isinstance(source, dict) or source.get("kind") not in SOURCE_KINDS:
            findings.append(f"{prefix} の source.kind は {sorted(SOURCE_KINDS)} のいずれか必須")
            continue
        if source["kind"] != "written-requirements":
            continue
        path, section, digest = source.get("path"), source.get("section"), source.get("sha256")
        if not _is_relative_path(path):
            findings.append(f"{prefix} の written source.path は安全な相対パス必須")
        if not isinstance(section, str) or not section.strip():
            findings.append(f"{prefix} の written source.section が空")
        if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
            findings.append(f"{prefix} の written source.sha256 が不正")
        elif isinstance(answer, str) and hashlib.sha256(answer.encode("utf-8")).hexdigest() != digest:
            findings.append(f"{prefix} の written source.sha256 が answer 原文と不一致")
        if isinstance(question, str) and (
            (isinstance(path, str) and path not in question)
            or (isinstance(section, str) and section not in question)
        ):
            findings.append(f"{prefix} の question に written source.path と section が必要")
    return findings
