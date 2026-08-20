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
SCOPE_SOURCE_QA_ID = "qa-foundation-u7"
SCOPE_SIDES = ("in", "out")
BULLET_RE = re.compile(r"^\s*(?:[*+-]|\d+[.)])\s+(\S.*?)\s*$")
HEADING_RE = re.compile(r"^\s*#{1,6}\s+\S")


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


# --------------------------------------------------------------------------- #
# scope 被覆検査 (U7)                                                           #
# --------------------------------------------------------------------------- #
# なぜ逐語一致ではなく被覆なのか。
#
# 2026-08-20 実測: 書面 docs/spec/01-要求仕様書-v1.0.md §6 の箇条書き 37 件と
# state の scope 20 件を前方一致 10 文字で機械的に突き合わせると「不一致 14 件」と
# 出たが、目視で確かめた本物の消失は 4 件だった (誤検出率 71%)。逆に件数一致を
# 要求すると、24 件を 12 件へまとめる正当な圧縮が全部違反になる。
#
# 被覆で見ると、まとめは許され、消失だけが残る。理由は非対称性にある——
# **消えた項目は、消えているがゆえに自分から名乗り出ない。**申告制の門は
# 名乗り出たものしか見ないので、消失は永久に捕まらない (08-16 / 08-18 / 08-19 の
# ヒアリング監査が 3 回とも通した)。被覆では名乗るのは「残った側」なので、
# 消えた側は名乗らなくても差集合として現れる。
#
# 分母の出どころ: 書面ではなく qa-foundation-u7.answer を数える。この answer は
# source.sha256 で内容に束縛されているので、分母を小さくして被覆を満たす細工は
# ハッシュ不一致として既存の検査に当たる。ファイルを読まないので
# validate_foundation_source_indexes の "state stays portable" も守られる。
def _split_sections(answer: str) -> list[tuple[str, list[str]]]:
    """見出し行で区切り、(見出し行, その区間の箇条書き本文) を順に返す。"""
    sections: list[tuple[str, list[str]]] = []
    current: str | None = None
    items: list[str] = []
    for line in answer.splitlines():
        if HEADING_RE.match(line):
            if current is not None:
                sections.append((current.strip(), items))
            current, items = line, []
            continue
        matched = BULLET_RE.match(line)
        if matched and current is not None:
            items.append(matched.group(1))
    if current is not None:
        sections.append((current.strip(), items))
    return sections


def scope_source_items(data: dict) -> dict[str, list[str]] | None:
    """U7 の原文から列挙可能な項目を取り出す。列挙が無ければ None。

    None は「被覆すべき対象が無い」であって「被覆できている」ではない。
    呼び出し側はこの 2 つを混ぜてはならない。
    """
    entry = _entry_by_id(data.get("qa_log")).get(SCOPE_SOURCE_QA_ID)
    if not isinstance(entry, dict):
        return None
    answer = entry.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        return None
    sections = _split_sections(answer)
    enumerated = {heading: items for heading, items in sections if items}
    return enumerated or None


def validate_foundation_scope_coverage(data: dict, foundation: dict) -> list[str]:
    """U7 原文の全項目が scope から被覆されているかを返す。

    まとめ (24 項目 -> 12 項目) は合法のまま、消失だけが差集合として出る。
    """
    enumerated = scope_source_items(data)
    if enumerated is None:
        # 原文に列挙が無い。被覆すべき対象が無いので検査は空振りする。
        return []
    scope = foundation.get("scope")
    if not isinstance(scope, dict) or scope.get("status") == "not_applicable":
        return []
    findings: list[str] = []
    provenance = foundation.get("provenance")
    if not isinstance(provenance, dict):
        return [
            "requirements_foundation: scope の出典 (qa-foundation-u7) は "
            f"{sum(len(v) for v in enumerated.values())} 項目を列挙しているが "
            "provenance が無い。被覆申告なしに書面由来の scope を確定できない"
        ]
    declared_scope = provenance.get("scope")
    if not isinstance(declared_scope, dict):
        return ["requirements_foundation: provenance.scope は object 必須"]
    if declared_scope.get("source_qa_id") != SCOPE_SOURCE_QA_ID:
        findings.append(
            f"requirements_foundation: provenance.scope.source_qa_id は {SCOPE_SOURCE_QA_ID!r} 必須 "
            f"(申告={declared_scope.get('source_qa_id')!r})"
        )
    sections = declared_scope.get("sections")
    if not isinstance(sections, dict):
        return findings + ["requirements_foundation: provenance.scope.sections は object 必須"]
    seen_headings: list[str] = []
    for side in SCOPE_SIDES:
        prefix = f"requirements_foundation: scope.{side}"
        declared = sections.get(side)
        if not isinstance(declared, dict):
            findings.append(f"{prefix} の被覆申告 (provenance.scope.sections.{side}) が無い")
            continue
        heading = declared.get("heading")
        if not isinstance(heading, str) or not heading.strip():
            findings.append(f"{prefix} の heading が空")
            continue
        if heading in seen_headings:
            findings.append(f"{prefix} の heading={heading!r} が in/out で重複。同じ区間を二重に被覆できない")
            continue
        seen_headings.append(heading)
        doc_items = enumerated.get(heading)
        if doc_items is None:
            findings.append(
                f"{prefix} の heading={heading!r} が U7 原文の見出しに一致しない "
                f"(原文の見出し: {sorted(enumerated)})"
            )
            continue
        # 分母の床。ここが 0 だと被覆は自動的に成立し、検査は緑のまま何も見ない。
        if not doc_items:
            findings.append(f"{prefix} の heading={heading!r} 区間に箇条書きが 0 件")
            continue
        total = len(doc_items)
        entries = declared.get("items")
        if not isinstance(entries, list) or not entries:
            findings.append(f"{prefix} の items が空 (原文 {total} 項目に対し被覆申告 0 件)")
            continue
        claimed: dict[int, str] = {}
        declared_texts: list[str] = []
        for record in entries:
            if not isinstance(record, dict):
                findings.append(f"{prefix}: 被覆申告の要素が object でない: {record!r}")
                continue
            item = record.get("item")
            if not isinstance(item, str) or not item.strip():
                findings.append(f"{prefix}: 被覆申告の item が空")
                continue
            declared_texts.append(item)
            covers = record.get("covers")
            if not isinstance(covers, list) or not covers:
                findings.append(f"{prefix}: {item!r} の covers が空。何も束ねていない項目は scope に置けない")
                continue
            for number in covers:
                if isinstance(number, bool) or not isinstance(number, int) or not 1 <= number <= total:
                    findings.append(f"{prefix}: {item!r} の covers={number!r} が 1..{total} の範囲外")
                    continue
                if number in claimed:
                    findings.append(
                        f"{prefix}: 原文 {number} 番 ({doc_items[number - 1]!r}) を "
                        f"{claimed[number]!r} と {item!r} が二重に申告している"
                    )
                    continue
                claimed[number] = item
        # 申告と実物の突き合わせ。片方向だけだと、申告を消して実物も消せば通る。
        missing_in_scope = [text for text in declared_texts if text not in (scope.get(side) or [])]
        undeclared = [text for text in (scope.get(side) or []) if text not in declared_texts]
        if missing_in_scope:
            findings.append(f"{prefix}: 被覆申告にあるが scope.{side} に無い項目: {missing_in_scope}")
        if undeclared:
            findings.append(f"{prefix}: scope.{side} にあるが被覆申告が無い項目: {undeclared}")
        uncovered = [n for n in range(1, total + 1) if n not in claimed]
        if uncovered:
            findings.append(
                f"{prefix}: U7 原文 {total} 項目のうち "
                + ", ".join(f"{n} 番 ({doc_items[n - 1]!r})" for n in uncovered)
                + " が scope から被覆されていない"
            )
    return findings


# --------------------------------------------------------------------------- #
# 出典が付いていない欄の計数 (門ではなく物差し)                                  #
# --------------------------------------------------------------------------- #
# 数える単位: foundation の「値を持つ葉」1 件を 1 欄とする。内訳は
#   essential_purpose / background = 各 1 欄
#   goals[i].text / objectives[i].text / objectives[i].measure /
#   success_criteria[i] / stakeholders[i] / constraints[i] /
#   concrete_intents[i].text = 各要素 1 欄
#   scope.in[i] / scope.out[i] = 各要素 1 欄 (被覆申告があれば出典ありと数える)
# 明示 N/A の欄は数えない (値が無いので出典の付けようがない)。
SOURCE_GAP_SCALARS = ("essential_purpose", "background")
SOURCE_GAP_LISTS = (
    ("goals", "text"), ("objectives", "text"), ("objectives", "measure"),
    ("success_criteria", None), ("stakeholders", None), ("constraints", None),
    ("concrete_intents", "text"),
)


def foundation_source_gaps(foundation: dict) -> list[str]:
    """出典 (provenance.field_sources または scope 被覆申告) の無い欄のパス一覧。"""
    provenance = foundation.get("provenance") if isinstance(foundation, dict) else None
    provenance = provenance if isinstance(provenance, dict) else {}
    attributed = {
        record.get("field")
        for record in (provenance.get("field_sources") or [])
        if isinstance(record, dict) and isinstance(record.get("field"), str)
    }
    gaps: list[str] = []

    def check(path: str) -> None:
        if path not in attributed:
            gaps.append(path)

    for key in SOURCE_GAP_SCALARS:
        value = foundation.get(key)
        if isinstance(value, str) and value.strip():
            check(key)
    for key, child in SOURCE_GAP_LISTS:
        value = foundation.get(key)
        if not isinstance(value, list):
            continue
        for index, element in enumerate(value):
            if child is None:
                if isinstance(element, str) and element.strip():
                    check(f"{key}[{index}]")
                continue
            if not isinstance(element, dict):
                continue
            leaf = element.get(child)
            if isinstance(leaf, str) and leaf.strip():
                check(f"{key}[{index}].{child}" if child != "text" else f"{key}[{index}]")
    scope = foundation.get("scope")
    if isinstance(scope, dict) and scope.get("status") != "not_applicable":
        sections = ((provenance.get("scope") or {}).get("sections") or {})
        for side in SCOPE_SIDES:
            covered = {
                record.get("item")
                for record in ((sections.get(side) or {}).get("items") or [])
                if isinstance(record, dict)
            }
            for index, item in enumerate(scope.get(side) or []):
                if isinstance(item, str) and item.strip() and item not in covered:
                    gaps.append(f"scope.{side}[{index}]")
    return gaps
