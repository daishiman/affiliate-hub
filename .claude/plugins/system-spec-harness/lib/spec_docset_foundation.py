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


_COST_CATEGORY_JA = {"free": "無料", "low-cost": "低コスト", "paid": "有料"}
_BILLING_PERIOD_JA = {"monthly": "月額", "yearly": "年額", "one-time": "一括"}


def _foundation_note(rf: dict, key: str) -> list[str]:
    """U4/U5 の読み方の規則を、正本 requirements_foundation から節の直後に置く。

    値の表・箇条書きだけでは「その数値をどう立てるか」「何をもって満たしたと
    するか」が分からない。分からないままにすると、章の側に人が書き足す。
    """
    note = str(rf.get(key) or "").strip()
    return ["", note] if note else []


def _confirmed_semantics_suffix(spec: dict) -> str:
    r"""`status: confirmed` が何を意味しないのかを、正本 lifecycle から添える。

    実測 (2026-08-25): 章には `- 確定マーカー: \`status: confirmed\` (要求判断の
    収集済みを表す。実装完了・試験合格ではない)` と手で書かれていた。**括弧の中身は
    正本 `lifecycle.confirmed_semantics` にほぼ同じ文で在る。**機械が黙っていたので
    人が書き写していたのであり、写しである以上、正本が変わっても追随しない。
    """
    lifecycle = spec.get("lifecycle")
    if not isinstance(lifecycle, dict):
        return ""
    semantics = str(lifecycle.get("confirmed_semantics") or "").strip()
    return f" ({semantics})" if semantics else ""


def render_implementation_snapshot(spec: dict) -> list[str]:
    """正本 implementation_snapshot を章へ描く。

    実測 (2026-08-25): 正本は `captured_at` / `basis` / `current` /
    `planned_not_implemented` を持っているのに、compile はこれを 1 行も描かなかった。
    そのため章には `- 実装の現在地: 単一D1、...は未実装` という**手で要約した 1 行**が
    置かれていた。要約は正本が動いても動かない。**黙っている機械の隣には、必ず手写しが育つ。**

    取得時刻を必ず添える。実装状態は古くなる種類の事実で、いつ数えたかが分からない
    現在地は「いま」と読まれてしまう。
    """
    snapshot = spec.get("implementation_snapshot")
    if not isinstance(snapshot, dict):
        return []
    captured = str(snapshot.get("captured_at") or "(取得時刻不明)")
    current = [x for x in (snapshot.get("current") or []) if isinstance(x, str)]
    planned = [x for x in (snapshot.get("planned_not_implemented") or []) if isinstance(x, str)]
    basis = [x for x in (snapshot.get("basis") or []) if isinstance(x, str)]
    lines = [
        "",
        "## 実装の現在地 (implementation_snapshot)",
        "",
        f"> 正本 `spec-state.json` の `implementation_snapshot` をそのまま描く。取得時点: **{captured}**。",
        "> **収集状態 (`status: confirmed`) とは別の軸である。**確定は要求判断の収集済みを表し、"
        "ここは実装の有無を表す。",
        "",
        f"### 実装済み ({len(current)} 件)",
        "",
    ]
    lines += [f"- {item}" for item in current] or ["- (記録なし)"]
    lines += ["", f"### 未実装 ({len(planned)} 件)", ""]
    lines += [f"- {item}" for item in planned] or ["- (記録なし)"]
    if basis:
        lines += ["", "### 数えた基準ファイル", ""]
        lines += [f"- `{item}`" for item in basis]
    return lines


def render_cost_model(cost) -> str:
    """費用モデルを、仕様書に載せられる形へ整える。

    なぜ要るか: `cost_model` は dict である。書式へそのまま差し込むと
    `{'category': 'free', 'amount': 0, 'currency': 'JPY', ...}` という
    **Python の repr** が意思決定表のセルに出る。

    実測 (2026-08-25): 章の側に「**この 1 行だけ書式が違うのは生成器の出力
    そのままだからで、真似すべき書式ではない。残り 6 行は手で書いた**」という
    注記が書かれていた。人が生成器の後始末を手でしていたのである。
    後始末が手である限り、再コンパイルのたびに消えて repr へ戻る。
    直すべきは章ではなく、repr を出している側だった。

    `tco` には既に人向けの説明が入っている。金額の要約に続けてそれを添える。
    未知の category / billing_period は日本語へ潰さずそのまま出す
    (知らない値を勝手に名付けない)。
    """
    if not isinstance(cost, dict):
        return str(cost) if cost else "-"
    category = cost.get("category")
    head = _COST_CATEGORY_JA.get(category, category or "-")
    amount = cost.get("amount")
    if isinstance(amount, (int, float)) and amount:
        period = cost.get("billing_period")
        period_ja = _BILLING_PERIOD_JA.get(period, period or "")
        currency = cost.get("currency") or ""
        head = f"{head} {period_ja}{amount} {currency}".strip()
    tco = cost.get("tco")
    return f"{head} ({tco})" if tco else head


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
                    cost=render_cost_model(option.get("cost_model")),
                    free=option.get("free_tier_limits", "-"),
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
    lines += _decision_tally(decisions)
    return "\n".join(lines)


def _decision_tally(decisions: list) -> list[str]:
    """状態の内訳と確定日の幅を、表から数えて添える。

    **表は 1 行ずつしか読ませない。**「全部確定しているのか」「いつ確定したのか」は
    表を目で数えないと分からず、数えた結果が章に手で書き込まれていた
    (実測 2026-08-25:「**7 件すべて `status: confirmed`**（分母 = ...全件）。
    うち 6 件は ... 2026-08-19〜22 に確定した」)。数えるのは機械の仕事である。
    手で数えた行は、8 件目が増えた日に黙って嘘になる。
    """
    total = len(decisions)
    counts: dict[str, int] = {}
    for decision in decisions:
        counts[str(decision.get("status", "-"))] = counts.get(str(decision.get("status", "-")), 0) + 1
    breakdown = ", ".join(f"`{k}` {v} 件" for k, v in sorted(counts.items()))
    dates = sorted(
        str((decision.get("user_decision") or {}).get("confirmed_at"))
        for decision in decisions
        if isinstance(decision.get("user_decision"), dict)
        and (decision.get("user_decision") or {}).get("confirmed_at")
    )
    span = f"利用者確定日: {dates[0]} 〜 {dates[-1]}" if dates else "利用者確定日: (なし)"
    return [
        "",
        f"- 内訳 (分母 = 正本 `spec-state.json` の `decisions[]` 全 {total} 件): {breakdown}。{span}。",
    ]


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
        f"- 確定マーカー: `status: {status}`{_confirmed_semantics_suffix(spec)}",
        "- 状態の正本: `spec-state.json` の `lifecycle` と `review_runs`",
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
    parts += _foundation_note(rf, "objectives_note")
    parts += ["", "## U5 成功基準 (success_criteria)", ""]
    parts += _bullet_list(rf.get("success_criteria"))
    parts += _foundation_note(rf, "success_criteria_note")
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
    parts += render_implementation_snapshot(spec)
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
    ]
    # **index はいちばん最初に読まれる。**`確定` の一語をここで取り違えると、
    # 以降の章をすべてその誤解で読むことになる。正本 `lifecycle.confirmed_semantics`
    # が意味を持っているのに index が黙っていたので、章に手書きの `> **重要:**` が
    # 育っていた (実測 2026-08-25: index.md:10)。
    semantics = _confirmed_semantics_suffix(spec).strip()
    if semantics:
        lines += [
            "> **重要:** この index の `確定` / `confirmed` の意味は正本 "
            f"`lifecycle.confirmed_semantics` が定める — {semantics[1:-1]}。"
            "実装や検証の判断には、下記の状態軸と各章の As-Is / To-Be / Delta / Acceptance を使う。",
            "",
        ]
    lines += [
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


def _section_map(text: str) -> "dict[str, str]":
    """Markdown 本文を `## 見出し` 単位へ割る。{見出し行: 節本文 (見出し含む)}。

    frontmatter と最初の `## ` より前の導入部は節に属さないので含めない。
    見出しが重複する場合は最後の 1 つを採る (同名節を 2 つ持つ章は無い前提)。
    """
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []
    for line in text.splitlines():
        if line.startswith("## "):
            if current is not None:
                sections[current] = "\n".join(buf).rstrip() + "\n"
            current = line.strip()
            buf = [line]
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).rstrip() + "\n"
    return sections


def handwritten_sections(existing: str, generated: str) -> "list[str]":
    """既存ファイルにあって生成物に無い `## 節` の見出しを、既存の並び順で返す。

    compile は正本 (spec-state / registry / C04 card) からの純関数導出しか書かない。
    よって**生成物に無い節は、人が後から書いた節**である。上書きすれば黙って消える。
    """
    gen = _section_map(generated)
    return [h for h in _section_map(existing) if h not in gen]


def vanishing_lines(existing: str, final: str) -> "list[str]":
    """既存本文にあって最終本文のどこにも無くなる非空行を、多重度込みで返す。

    節ごと消えたのか末尾へ移っただけなのかは、行の多重集合で引けば区別できる。
    版の更新のように**正しく消える行**もあるので、これは拒否の根拠ではなく報告の材料である。
    `## 節` 単位の検出では、生成節の中に人が書き足した `###` 小節や表の 1 行が拾えない。
    """
    import collections

    old = collections.Counter(l.rstrip() for l in existing.splitlines() if l.strip())
    new = collections.Counter(l.rstrip() for l in final.splitlines() if l.strip())
    lost = old - new
    return [line for line, count in lost.items() for _ in range(count)]


def write_docset(
    docset: dict[str, str],
    out_dir: Path,
    *,
    on_handwritten: str = "refuse",
    loss_report: "list[tuple[str, list[str]]] | None" = None,
) -> list[Path]:
    """組み立てた docset を out_dir へ書き出す。書き出したパス一覧を返す。

    既存ファイルが**生成物に無い節**を持つとき、既定では書かずに CompileError を上げる
    (fail-closed)。compile は正本からの導出しか生成しないので、そういう節は人が書いた
    ものであり、黙って消すと差分を見るまで誰も気づかない。

    on_handwritten:
      - "refuse"   : 手書き節を見つけたら 1 文字も書かずに中止する (既定)
      - "preserve" : 生成本文の末尾へ手書き節を既存の並び順で引き継いでから書く

    loss_report を渡すと、preserve でもなお消える行を [(ファイル名, [行, ...])] で受け取れる。
    節を引き継いでも、生成節の中に人が書き足した小節や表の行までは守れない。
    **preserve は安全という意味ではない。**呼び手はこの報告を読んでから正本へ適用すること。
    """
    if on_handwritten not in ("refuse", "preserve"):
        raise CompileError(f"on_handwritten は refuse|preserve のいずれか (受領: {on_handwritten!r})")

    # 1 ファイルでも危ないものがあれば 1 文字も書かない。部分適用は差分を読みにくくする。
    carried: dict[str, list[str]] = {}
    for name, content in docset.items():
        p = out_dir / name
        if not p.is_file():
            continue
        lost = handwritten_sections(p.read_text(encoding="utf-8"), content)
        if lost:
            carried[name] = lost

    if carried and on_handwritten == "refuse":
        detail = "; ".join(f"{name}: {' / '.join(heads)}" for name, heads in sorted(carried.items()))
        raise CompileError(
            "生成物に無い節を持つ既存章があるため中止した (何も書いていない)。"
            f"消えるはずだった節: {detail}。"
            "引き継ぐなら --on-handwritten preserve、"
            "消してよいと確かめたなら該当節を先に削ってから compile すること。"
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, content in docset.items():
        p = out_dir / name
        before = p.read_text(encoding="utf-8") if p.is_file() else None
        text = content if content.endswith("\n") else content + "\n"
        if name in carried:
            existing = _section_map(before or "")
            text = text.rstrip("\n") + "\n\n" + "\n".join(existing[h] for h in carried[name])
        if loss_report is not None and before is not None:
            lost = vanishing_lines(before, text)
            if lost:
                loss_report.append((name, lost))
        p.write_text(text, encoding="utf-8")
        written.append(p)
    return written
