"""Chapter-level Markdown rendering for deterministic spec compilation."""
from __future__ import annotations

import re

from spec_docset_catalog import *
from spec_docset_catalog import (
    _DESIGN_KNOWLEDGE_DIR,
    _doctrine_registry,
    _ref_host,
    _ref_version,
    _row,
)

# レンダリング (章 / index) — 純関数                                            #
# --------------------------------------------------------------------------- #
def render_frontmatter(spec: dict, cat_id: str) -> str:
    """章 frontmatter (確定マーカー) を組み立てる (C11 hook 判定ソース)。"""
    agg = category_aggregate(spec, cat_id)
    status = chapter_status(agg)
    cells = spec_cell_ids(spec, cat_id)
    serves = chapter_serves_goals(spec, cat_id)
    lines = [
        "---",
        f"status: {status}",
        f"category: {cat_id}",
        f"aggregate: {agg}",
        f"spec_cells: [{', '.join(cells)}]",
        f"serves_goals: [{', '.join(serves)}]",
        "---",
    ]
    return "\n".join(lines)


def render_state_table(spec: dict, cat_id: str) -> str:
    """カテゴリ別収集状態表 (未収集/対象外+理由/確定+qa_ref) を組み立てる。"""
    row = _row(spec, cat_id)
    lines = [
        "## カテゴリ別収集状態",
        "",
        "| プラットフォーム | 状態 | 根拠 |",
        "|---|---|---|",
    ]
    for pf in CANONICAL_PLATFORMS:
        cell = row.get(pf)
        plabel = PLATFORM_LABELS.get(pf, pf)
        if not isinstance(cell, dict):
            lines.append(f"| {plabel} ({pf}) | 未収集 | — |")
            continue
        state = cell.get("state", "未収集")
        if state == "確定":
            basis = f"確定質疑: {cell.get('qa_ref', '-')}"
        elif state == "対象外":
            reason = cell.get("reason") or f"承認: {cell.get('approval_ref', '-')}"
            basis = f"理由: {reason}"
        else:
            basis = "収集中 (未確定)"
        lines.append(f"| {plabel} ({pf}) | {state} | {basis} |")
    return "\n".join(lines)


def _qa_by_id(spec: dict) -> dict[str, dict]:
    return {
        q["id"]: q
        for q in spec.get("qa_log", []) or []
        if isinstance(q, dict) and q.get("id")
    }


def _confirmed_cells_by_qa_ref(spec: dict, cat_id: str) -> list[tuple[str, list[str]]]:
    """確定セルの (qa_ref, 対応セル) を canonical platform 順・初出順で返す。

    render_confirmed_qa と render_design_refs の「本章での適用」節が同一の確定セル
    グルーピングを共有するための単一導出元 (SSOT)。
    """
    row = _row(spec, cat_id)
    ordered_refs: list[str] = []
    cells_by_ref: dict[str, list[str]] = {}
    for pf in CANONICAL_PLATFORMS:
        cell = row.get(pf)
        if not isinstance(cell, dict) or cell.get("state") != "確定":
            continue
        ref = cell.get("qa_ref")
        if not ref:
            continue
        if ref not in ordered_refs:
            ordered_refs.append(ref)
        cells_by_ref.setdefault(ref, []).append(pf)
    return [(ref, cells_by_ref[ref]) for ref in ordered_refs]


def render_confirmed_qa(spec: dict, cat_id: str) -> str:
    """確定セルが参照する質疑 (qa_log) の本文を章へ実体描画する。

    章の意味層 (確定要件の中身) を正本 spec-state.json から完全導出することで、
    再コンパイルしても確定内容が消えない (章 = 正本の純関数) を保証する。
    canonical platform 順に qa_ref を初出順で重複除去し、各 qa の質問・回答と
    対応セルを描画する。qa 本文が正本に無い参照は捏造せず欠落を明示する (fail-visible)。
    """
    qa_map = _qa_by_id(spec)
    confirmed = _confirmed_cells_by_qa_ref(spec, cat_id)
    ordered_refs = [ref for ref, _ in confirmed]
    cells_by_ref = dict(confirmed)
    lines = ["## 確定内容 (質疑録)", ""]
    if not ordered_refs:
        lines.append("- (確定セルなし。本章は対象外または収集中)")
        return "\n".join(lines)
    for ref in ordered_refs:
        qa = qa_map.get(ref)
        lines.append(f"### {ref} (対応セル: {', '.join(cells_by_ref[ref])})")
        lines.append("")
        if not qa:
            lines.append(f"- (qa_log に {ref} の本文が見つからない — 正本の欠落を要確認)")
            lines.append("")
            continue
        lines.append(f"**質問**: {qa.get('question', '(未記入)')}")
        lines.append("")
        lines.append(f"**回答**: {qa.get('answer', '(未記入)')}")
        lines.append("")
    return "\n".join(lines).rstrip()


def render_doctrine_anchor(cat_id: str) -> str:
    """doctrine anchor (concern authority) を上流指針として章へ描画する (goal-spec C15)。

    正本 = doctrine-anchor-registry.json の category_concern_map / concerns。
    具体技術は直書きせず、concern ごとの authority と導く上流原則のみを示す。
    category_concern_map に未帰属でも、approved な pending 例外が concerns を解決していれば
    その concern の authority を上流指針として描画する (プロジェクト固有の確定を全プロジェクト
    共通シードへ昇格させずに反映する経路)。未解決の未帰属は pending 注記に留める (写像全射の
    機械検証は validate-knowledge-graph.py --profile doctrine の責務)。
    """
    registry = _doctrine_registry()
    concern_ids = (registry.get("category_concern_map") or {}).get(cat_id) or []
    concerns = {
        c.get("concern_id"): c
        for c in registry.get("concerns", []) or []
        if isinstance(c, dict)
    }
    lines = ["## 上流指針 (doctrine anchor)", ""]
    exception_note = None
    if not concern_ids:
        pending = next(
            (
                p
                for p in registry.get("pending_exceptions", []) or []
                if isinstance(p, dict) and p.get("category") == cat_id
            ),
            None,
        )
        if pending and pending.get("approval_state") == "approved" and pending.get("concerns"):
            concern_ids = pending["concerns"]
            exception_note = (
                "- 本カテゴリは共通シード (categories) 外のプロジェクト固有カテゴリで、"
                f"approved な pending 例外 (owner: {pending.get('owner', '-')}) として上流指針を確定している。"
            )
    if not concern_ids:
        lines.append(
            "- (doctrine-anchor-registry の category_concern_map に未帰属。"
            "pending 例外の owner/reason/approval_state を registry 側で解決すること)"
        )
        return "\n".join(lines)
    if exception_note:
        lines += [exception_note, ""]
    lines += ["| concern | authority (正本) | 導く上流原則 | 出典 |", "|---|---|---|---|"]
    for cid in concern_ids:
        c = concerns.get(cid) or {}
        lines.append(
            f"| {cid} | {c.get('authority', '-')} | {c.get('guides', '-')} | "
            f"{c.get('source_ref', '-')} |"
        )
    lines += [
        "",
        "- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。"
        "具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。",
    ]
    return "\n".join(lines)


_DEEP_CARD_SECTIONS = (
    ("目的", "目的"),
    ("解決する問題", "解決する問題"),
    ("適用条件", "適用条件"),
    ("非適用条件", "非適用条件"),
    ("トレードオフ・失敗モード", "トレードオフ・失敗モード"),
    ("目的達成への寄与", "goalへの寄与"),
)


def _markdown_sections(text: str) -> dict[str, str]:
    matches = list(re.finditer(r"^##\s+(.+?)\s*$", text, re.M))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group(1).strip()] = text[match.end() : end].strip()
    return sections


def _card_title(text: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", text, re.M)
    return match.group(1).strip() if match else fallback


def _render_markdown_card(filename: str) -> list[str]:
    """C04 deep cardの目的適合情報を参照先から章本文へ実体化する。"""
    path = _DESIGN_KNOWLEDGE_DIR / filename
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise CompileError(f"設計知識cardを読めない: {filename}: {exc}") from exc
    sections = _markdown_sections(text)
    missing = [heading for heading, _ in _DEEP_CARD_SECTIONS if not sections.get(heading)]
    if missing:
        raise CompileError(f"設計知識card {filename} の深度項目欠落: {missing}")
    lines = [f"### {_card_title(text, filename)}", "", f"- 出典カード: `{DESIGN_REF_BASE}/{filename}`"]
    for heading, label in _DEEP_CARD_SECTIONS:
        lines.extend(["", f"#### {label}", "", sections[heading]])
    return lines


def _candidate_applies_to_chapter(spec: dict, candidate: dict, cat_id: str) -> bool:
    categories = candidate.get("categories")
    if isinstance(categories, list) and categories:
        return cat_id in categories
    candidate_goals = set(candidate.get("serves_goals") or [])
    return bool(candidate_goals.intersection(chapter_serves_goals(spec, cat_id)))


def _render_candidate_card(candidate: dict) -> list[str]:
    card = candidate.get("card") or {}
    title = candidate.get("topic") or candidate.get("id") or "knowledge candidate"
    lines = [
        f"### {title}",
        "",
        f"- project candidate: `{candidate.get('id', '-')}` (`{candidate.get('status', '-')}`)",
        f"- 解決対象: {candidate.get('problem', '-')}",
    ]
    fields = (
        ("purpose", "目的"),
        ("problems", "解決する問題"),
        ("applies_when", "適用条件"),
        ("does_not_apply_when", "非適用条件"),
        ("tradeoffs", "トレードオフ"),
        ("failure_modes", "失敗モード"),
        ("goal_contribution", "goalへの寄与"),
    )
    for key, label in fields:
        value = card.get(key)
        lines.extend(["", f"#### {label}", ""])
        if isinstance(value, list):
            lines.extend(f"- {item}" for item in value)
        else:
            lines.append(str(value or "(未記入)"))
    return lines


def _render_chapter_application(spec: dict, cat_id: str) -> list[str]:
    """caller が記録した章固有の原則採否を確定判断へ紐付けて描画する。

    card 自体は ref-system-design-knowledge の汎用原則の逐語転記であり章固有ではない
    (aspect-criteria.md の「具体原則の適用が無く汎用ポインタだけの章」FAIL 要因)。
    compiler が解釈を捏造せず、qa_log[].design_applications に明記された具体原則、
    applied/not_applicable、理由、trade-off をそのまま描画する。欠落は定型文で緑化せず
    fail-visible にし、C05 意味層評価へ差し戻す。
    """
    confirmed = _confirmed_cells_by_qa_ref(spec, cat_id)
    goals = chapter_serves_goals(spec, cat_id)
    qa_map = _qa_by_id(spec)
    lines = ["#### 本章での適用", ""]
    if not confirmed:
        lines.append("- (確定セルなし。本章は対象外または収集中のため上記原則の適用先は未確定)")
        return lines
    for ref, cells in confirmed:
        qa = qa_map.get(ref) or {}
        lines.extend(
            [
                f"##### 確定内容 {ref} (対応セル: {', '.join(cells)})",
                "",
                f"- 確定要件: {qa.get('answer', '(qa_log 本文欠落)')}",
            ]
        )
        applications = qa.get("design_applications")
        if not isinstance(applications, list) or not applications:
            lines.append("- 設計解釈の記録経路: `unrecorded`")
            lines.append(
                "- 設計原則の採否根拠: (未記録 — qa_log[].design_applications を writer 経由で補完すること)"
            )
            continue
        provenance = qa.get("design_application_provenance")
        if isinstance(provenance, dict):
            lines.append(
                "- 設計解釈の記録経路: "
                f"`{provenance.get('mode', '-')}` "
                f"(`{provenance.get('writer', '-')}`)"
            )
        else:
            lines.append("- 設計解釈の記録経路: `dialogue`")
        for application in applications:
            if not isinstance(application, dict):
                continue
            lines.extend(
                [
                    f"- 原則: {application.get('principle', '(未記入)')} "
                    f"(`{application.get('knowledge_ref', '-')}`)",
                    f"  - 採否: `{application.get('applicability', '-')}`",
                    f"  - 章固有の根拠: {application.get('rationale', '(未記入)')}",
                    "  - トレードオフ:",
                ]
            )
            tradeoffs = application.get("tradeoffs")
            if isinstance(tradeoffs, list) and tradeoffs:
                lines.extend(f"    - {value}" for value in tradeoffs)
            else:
                lines.append("    - (未記入)")
    if goals:
        lines.append(f"- 資するゴール: {', '.join(goals)}")
    return lines


def render_design_refs(cat_id: str, spec: dict | None = None) -> str:
    """設計知識をpathだけでなく、目的達成に使える意味項目まで章へ描画する。

    card 本文 (目的/解決する問題/適用条件/非適用条件/トレードオフ/goal寄与) は
    ref-system-design-knowledge の汎用原則の逐語転記であり、それだけでは章固有ではない。
    spec 指定時は末尾に `_render_chapter_application` で「本章での適用」節を添え、
    qa_log[].design_applications の具体的な原則採否を qa_ref・対応セル・serves_goals へ束縛する。
    """
    refs = category_design_refs(cat_id)
    lines = ["## 適用された設計知識", ""]
    if not refs:
        lines.append(
            f"- `{DESIGN_REF_BASE}/resource-map.yaml` "
            "(このカテゴリ専用の deep card は resource-map に未定義。"
            "本章の設計判断は「上流指針 (doctrine anchor)」節の authority と"
            "「確定内容 (質疑録)」を正本とする)"
        )
    else:
        for index, filename in enumerate(refs):
            if index:
                lines.extend(["", "---", ""])
            lines.extend(_render_markdown_card(filename))

    if spec is not None:
        candidates = [
            candidate
            for candidate in spec.get("knowledge_candidates", []) or []
            if isinstance(candidate, dict)
            and candidate.get("status") in {"deepened", "promoted"}
            and _candidate_applies_to_chapter(spec, candidate, cat_id)
        ]
        for candidate in candidates:
            lines.extend(["", "---", ""])
            lines.extend(_render_candidate_card(candidate))
        lines.extend(["", "---", ""])
        lines.extend(_render_chapter_application(spec, cat_id))
    return "\n".join(lines)


def render_citations(refs: list[dict], *, empty_note: str) -> str:
    """最新ドキュメント出典表を組み立てる (R2-render の最新ドキュメント出典反映)。"""
    lines = ["## 最新ドキュメント出典", ""]
    if not refs:
        lines.append(empty_note)
        return "\n".join(lines)
    lines.append("| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |")
    lines.append("|---|---|---|---|---|---|")
    for ref in refs:
        lines.append(
            "| {tid} | {ver} | {pub} ({host}) | {url} | {ret} | {chk} |".format(
                tid=ref.get("target_id", "-"),
                ver=_ref_version(ref),
                pub=ref.get("official_publisher", "-"),
                host=_ref_host(ref),
                url=ref.get("source_url", "-"),
                ret=ref.get("retrieved_at", "-"),
                chk=ref.get("latest_checked_at", "-"),
            )
        )
    return "\n".join(lines)


def render_chapter(spec: dict, cat_id: str, refs_by_cat: dict[str, list[dict]]) -> str:
    """1 カテゴリ章の完全な Markdown を組み立てる (frontmatter + 状態表 + 設計知識 + 出典)。"""
    label = category_label(spec, cat_id)
    agg = category_aggregate(spec, cat_id)
    refs = refs_by_cat.get(cat_id, [])
    parts = [
        render_frontmatter(spec, cat_id),
        "",
        f"# {label} ({cat_id})",
        "",
        f"- カテゴリ集約状態: **{agg}**",
        f"- 章確定マーカー: `status: {chapter_status(agg)}`",
        "",
        render_state_table(spec, cat_id),
        "",
        render_confirmed_qa(spec, cat_id),
        "",
        render_doctrine_anchor(cat_id),
        "",
        render_design_refs(cat_id, spec),
        "",
        render_citations(
            refs,
            empty_note="- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)",
        ),
        "",
    ]
    return "\n".join(parts)
