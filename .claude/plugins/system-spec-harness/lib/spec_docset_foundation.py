"""Foundation, index, and document-set assembly for deterministic spec compilation."""
from __future__ import annotations

from pathlib import Path

from spec_docset_catalog import *
from spec_docset_catalog import _category_ids
from spec_docset_chapters import *

def _text_or_placeholder(s) -> str:
    if isinstance(s, dict) and s.get("status") == "not_applicable":
        return f"N/A — {s.get('reason') or '(理由未記入)'}"
    s = str(s or "").strip()
    return s if s else "(未記入)"


def _bullet_list(items) -> list[str]:
    if isinstance(items, dict) and items.get("status") == "not_applicable":
        return [f"- N/A — {items.get('reason') or '(理由未記入)'}"]
    items = items or []
    if not items:
        return ["- (未記入)"]
    return [f"- {x}" for x in items]


def _join_or_dash(items) -> str:
    items = items or []
    return ", ".join(str(x) for x in items) if items else "-"


def _list_value(value) -> list:
    """foundation の配列値を返す。明示N/A markerは空配列として扱う。"""
    return value if isinstance(value, list) else []


def render_decisions(spec: dict) -> str:
    """AI推奨とユーザー確認を分離した意思決定支援表を描画する。"""
    decisions = spec.get("decisions")
    lines = ["## 意思決定支援 (decisions)", ""]
    if not isinstance(decisions, list) or not decisions:
        lines.append("- (意思決定支援の記録なし)")
        return "\n".join(lines)
    lines += [
        "| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |",
        "|---|---|---|---|---|---|---|",
    ]
    for decision in decisions:
        options: list[str] = []
        for option in decision.get("options") or []:
            evidence = ", ".join(option.get("evidence_refs") or [])
            options.append(
                "{id}:{label} / cost={cost} / free={free} / fit={fit} / pros={pros} / "
                "cons={cons} / risks={risks} / lock-in={lock} / ops={ops} / evidence={evidence}".format(
                    id=option.get("id", "-"), label=option.get("label", "-"),
                    cost=option.get("cost_model", "-"), free=option.get("free_tier_limits", "-"),
                    fit=option.get("goal_fit", "-"), pros=", ".join(option.get("pros") or []),
                    cons=", ".join(option.get("cons") or []), risks=", ".join(option.get("risks") or []),
                    lock=option.get("lock_in", "-"), ops=option.get("ops_burden", "-"), evidence=evidence,
                )
            )
        rec = decision.get("recommendation") or {}
        rec_text = "-"
        if rec:
            rec_text = (
                f"{rec.get('option_id', '-')} — {rec.get('rationale', '-')} "
                f"(注意: {', '.join(rec.get('caveats') or [])}; confidence={rec.get('confidence', '-')}; "
                f"checked={rec.get('latest_checked_at', '-')})"
            )
        user = decision.get("user_decision") or {}
        user_text = (
            f"{user.get('option_id')} @ {user.get('confirmed_at')}"
            if isinstance(user, dict) and user.get("option_id") else "確認待ち"
        )
        lines.append(
            f"| {decision.get('id', '-')} | {decision.get('question', '-')} | "
            f"{decision.get('status', '-')} | {'<br>'.join(options)} | {rec_text} | {user_text} | "
            f"{', '.join(decision.get('serves_goals') or []) or '-'} |"
        )
    return "\n".join(lines)


def render_requirements_definition(spec: dict) -> str:
    """要件定義書 (上位概念 U1-U9) を先頭章として組み立てる (要件 C9・憲法)。

    requirements_foundation を正本とし、不在/空でも空落ちさせず (未記入) を明示した draft を出す。
    以降の各技術章はこの章の goals へ frontmatter serves_goals でトレース (anchor) する。
    """
    rf = requirements_foundation(spec)
    status = foundation_status(spec)
    parts = [
        "---",
        f"status: {status}",
        "category: requirements-definition",
        "---",
        "",
        "# 要件定義書 (上位概念)",
        "",
        "> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。",
        "> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。",
        "> 上位概念がブレなければ、仕様が整った後もブレない。",
        "",
        f"- 確定マーカー: `status: {status}`",
        "",
        "## U1 本質的目的 (essential_purpose)",
        "",
        _text_or_placeholder(rf.get("essential_purpose")),
        "",
        "## U2 背景 (background)",
        "",
        _text_or_placeholder(rf.get("background")),
        "",
        "## U3 ゴール (goals)",
        "",
    ]
    goals = _list_value(rf.get("goals"))
    if goals:
        parts += ["| ID | ゴール |", "|---|---|"]
        for g in goals:
            parts.append(f"| {g.get('id', '-')} | {g.get('text', '')} |")
    else:
        parts.append("- (未記入)")
    parts += ["", "## U4 目標 (objectives)", ""]
    objectives = _list_value(rf.get("objectives"))
    if objectives:
        parts += ["| ID | 目標 | 測定基準 |", "|---|---|---|"]
        for o in objectives:
            parts.append(f"| {o.get('id', '-')} | {o.get('text', '')} | {o.get('measure') or '-'} |")
    else:
        parts.append("- (未記入)")
    parts += ["", "## U5 成功基準 (success_criteria)", ""]
    parts += _bullet_list(rf.get("success_criteria"))
    parts += ["", "## U6 ステークホルダー (stakeholders)", ""]
    parts += _bullet_list(rf.get("stakeholders"))
    scope = rf.get("scope") or {}
    parts += ["", "## U7 スコープ (scope)", ""]
    if isinstance(scope, dict) and scope.get("status") == "not_applicable":
        parts.append(f"- N/A — {scope.get('reason') or '(理由未記入)'}")
    else:
        parts += [
            f"- **対象 (in)**: {_join_or_dash(scope.get('in'))}",
            f"- **対象外 (out)**: {_join_or_dash(scope.get('out'))}",
        ]
    parts += ["", "## U8 制約 (constraints)", ""]
    parts += _bullet_list(rf.get("constraints"))
    parts += ["", "## U9 具体的にやりたいこと (concrete_intents)", ""]
    intents = _list_value(rf.get("concrete_intents"))
    if intents:
        parts += ["| ID | やりたいこと | 資するゴール |", "|---|---|---|"]
        for it in intents:
            serves = ", ".join(it.get("serves") or []) or "-"
            parts.append(f"| {it.get('id', '-')} | {it.get('text', '')} | {serves} |")
    else:
        parts.append("- (未記入)")
    parts += ["", render_decisions(spec), ""]
    return "\n".join(parts)


def render_index(spec: dict, refs_by_cat: dict[str, list[dict]], unassigned: list[dict]) -> str:
    """全章 + カテゴリ集約状態を相互参照する index.md を組み立てる (R3-crosslink)。"""
    cat_ids = _category_ids(spec)
    rf = requirements_foundation(spec)
    lines = [
        "---",
        "kind: index",
        "---",
        "",
        "# システム構築仕様書 index",
        "",
        "収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。",
        "集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。",
        "",
        "## 要件定義書 (上位概念・憲法)",
        "",
        f"- [要件定義書](./{REQUIREMENTS_CHAPTER}) — 上位概念 U1-U9 の正本 "
        f"(確定マーカー: `{foundation_status(spec)}`)。各技術章は serves_goals でここのゴールへ"
        "トレース (anchor) する。",
    ]
    ep = str(rf.get("essential_purpose") or "").strip()
    if ep:
        lines.append(f"- **本質的目的 (U1)**: {ep}")
    goals = rf.get("goals") or []
    if goals:
        gl = ", ".join(
            f"{g.get('id')}={g.get('text')}" for g in goals if isinstance(g, dict)
        )
        lines.append(f"- **ゴール (U3)**: {gl}")
    lines += [
        "",
        "## 章一覧と集約状態",
        "",
        "| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |",
        "|---|---|---|---|---|---|",
    ]
    for cat_id in cat_ids:
        agg = category_aggregate(spec, cat_id)
        status = chapter_status(agg)
        label = category_label(spec, cat_id)
        cells = " ".join(spec_cell_ids(spec, cat_id))
        serves = " ".join(chapter_serves_goals(spec, cat_id)) or "—"
        lines.append(
            f"| {label} ({cat_id}) | [{cat_id}.md](./{cat_id}.md) | {agg} | `{status}` | {serves} | {cells} |"
        )
    lines.extend(["", "## 集約状態サマリ", ""])
    summary: dict[str, list[str]] = {"未着手": [], "収集中": [], "確定": [], "対象外": []}
    for cat_id in cat_ids:
        summary.setdefault(category_aggregate(spec, cat_id), []).append(cat_id)
    for label in ("未着手", "収集中", "確定", "対象外"):
        members = ", ".join(summary.get(label, [])) or "—"
        lines.append(f"- **{label}**: {members}")

    lines.extend(["", "## 全体ドキュメント出典 (未割当参照)", ""])
    if unassigned:
        lines.append(render_citations(unassigned, empty_note="").split("\n", 2)[2])
    else:
        lines.append("- (全ての取得済みドキュメントは各章へ割り当て済み)")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- #
# コンパイル (組み立て) 本体                                                    #
# --------------------------------------------------------------------------- #
def compile_docset(spec: dict, refs_data: dict) -> dict[str, str]:
    """spec-state + fetched-references から {ファイル名: Markdown 本文} を組み立てる (純関数)。"""
    cat_ids = _category_ids(spec)
    refs_by_cat, unassigned = references_by_category(spec, refs_data)
    docset: dict[str, str] = {}
    # 要件定義書 (上位概念・憲法) を最初の章として生成 (要件 C9)
    docset[REQUIREMENTS_CHAPTER] = render_requirements_definition(spec)
    for cat_id in cat_ids:
        docset[f"{cat_id}.md"] = render_chapter(spec, cat_id, refs_by_cat)
    docset["index.md"] = render_index(spec, refs_by_cat, unassigned)
    return docset


def write_docset(docset: dict[str, str], out_dir: Path) -> list[Path]:
    """組み立てた docset を out_dir へ書き出す。書き出したパス一覧を返す。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, content in docset.items():
        p = out_dir / name
        text = content if content.endswith("\n") else content + "\n"
        p.write_text(text, encoding="utf-8")
        written.append(p)
    return written
