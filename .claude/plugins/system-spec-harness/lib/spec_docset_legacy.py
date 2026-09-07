"""Recognize source-backed legacy projections without deleting handwritten claims."""
from __future__ import annotations

import re

from spec_docset_chapters import render_doctrine_anchor


def legacy_qa_copy_is_connected(body: str, spec: dict, category: str, generated: str) -> bool:
    """Recognize old QA wrappers only when every payload line survives in this chapter.

    A matching QA id alone is not evidence: an edited answer, a different chapter,
    or one unrecognized handwritten line must keep the old block fail-closed.
    """
    def payload(line: str) -> str:
        line = re.sub(r"^#{1,6}\s+", "", line.strip())
        return re.sub(r"^(?:\*\*質問\*\*:|\*\*回答\*\*:|- 確定要件:)\s*", "", line)

    rendered = {payload(line) for line in generated.splitlines() if line.strip()}
    qa = {entry["id"]: entry for entry in spec.get("qa_log", [])}
    matrix = spec.get("matrix", {}).get(category, {})
    known_goals = {goal["id"] for goal in (spec.get("requirements_foundation") or {}).get("goals", [])}
    known_goals.update(goal for cell in matrix.values() for goal in cell.get("serves_goals", []))
    fixed = {
        "## 章にしか無い記述 (正本へ未接続)", "**問**", "**答**", "### 本章での適用",
        "> **未記入** — 本章固有の適用記述が spec-state に無い。以下の card 本文は共有資産の逐語であり、同じ card を引く他章と一致する。この節は現時点で「参照した」ことしか示しておらず、「適用した」証拠ではない。",
    }
    basis = {
        "user-decision": "利用者が代替案を見たうえで明示選択した決定",
        "user-statement": "利用者本人による明示的な要求・事実の回答",
        "observed-fact": "コード・設定・公式文書で検証できる観測事実",
    }
    metadata = set()
    for entry in qa.values():
        if entry["id"] not in generated:
            continue
        label = basis.get(entry.get("basis"))
        if label:
            parts = [f"根拠の性質: {label}"]
            if entry.get("provenance"):
                parts.append(f"出所: {entry['provenance']}")
            if entry.get("answered_at"):
                parts.append(f"回答時刻: {entry['answered_at']}")
            metadata.add("- (" + " / ".join(parts) + ")")
            # Earlier renderer omitted provenance/timestamp, but the basis itself is unchanged.
            metadata.add(f"- (根拠の性質: {label})")
    matched = 0
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line in fixed or line in metadata:
            continue
        if payload(line) in rendered:
            matched += 1
            continue
        if re.fullmatch(r"> 以下の \d+ 件は正本 `spec-state.json` の .+compile が消さずに引き継いでいるだけで、\*\*章が正本の投影である性質はここだけ破れている\*\*。正本へ接続するか、不要と確かめて消すこと。", line):
            continue
        platform = re.fullmatch(r"### .+ \(([^)]+)\)", line)
        if platform and platform[1] in matrix:
            continue
        reference = re.fullmatch(r"#### (?:主たる接地根拠|裏付け質疑): `([^`]+)`", line)
        if reference and reference[1] in qa and reference[1] in generated:
            continue
        goals = re.fullmatch(r"- 資するゴール: (.+)", line)
        if goals and set(goals[1].split(", ")) <= known_goals:
            continue
        return False
    return matched > 0


def legacy_summary_is_connected(heading: str, body: str, spec: dict, category: str) -> bool:
    """Only known renderer syntax whose payload is still in the source is eligible."""
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if heading == "## 上流指針 (doctrine anchors)":
        current_rows = {
            tuple(cell.strip() for cell in line.split("|")[1:-1])
            for line in render_doctrine_anchor(category).splitlines()
            if line.startswith("|")
        }
        fixed = {
            heading,
            "> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`",
            "| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |",
            "|---|---|---|---|---|---|",
            "> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。",
        }
        rows = 0
        for line in lines:
            if line in fixed:
                continue
            cells = tuple(cell.strip() for cell in line.split("|")[1:-1])
            if len(cells) != 6 or cells[:4] not in current_rows:
                return False
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", cells[4]) or cells[5] != "**未記入**":
                return False
            rows += 1
        return rows > 0
    if heading != "## To-Be / Delta":
        return False
    foundation = spec.get("requirements_foundation") or {}
    records = {
        item["id"]: item.get("text")
        for field in ("goals", "concrete_intents")
        for item in foundation.get(field, [])
        if isinstance(item, dict) and item.get("id")
    }
    decisions = spec.get("decisions") or []
    records.update({item["id"]: item.get("question") for item in decisions})
    options = {
        option["id"]: option
        for decision in decisions for option in decision.get("options", [])
    }
    fixed = {
        heading,
        "> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。",
        "### 到達すべき状態 (To-Be)", "### 受入条件 (Delta の判定点)",
        "### 本章がかなえる具体的やりたいこと (U9)", "### 本章に効く確定意思決定",
        "- (本章ゴールに紐づく目標 U4 が無い。受入条件が未定義である)",
    }
    matched = 0
    for line in lines:
        if line in fixed:
            continue
        record = re.fullmatch(r"- \*\*([^*]+)\*\*: (.+)", line)
        if record and records.get(record[1]) == record[2]:
            matched += 1
            continue
        choice = re.fullmatch(r"- 採択: (.+) \(`([^`]+)`\)", line)
        if choice and options.get(choice[2], {}).get("label") == choice[1]:
            matched += 1
            continue
        if line.startswith("- 目的適合: ") and any(
            option.get("goal_fit") == line.removeprefix("- 目的適合: ")
            for option in options.values()
        ):
            continue
        return False
    return matched > 0
