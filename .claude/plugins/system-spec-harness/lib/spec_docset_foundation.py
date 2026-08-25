"""Foundation, index, and document-set assembly for deterministic spec compilation."""
from __future__ import annotations

import re
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


_SUBSECTION = re.compile(r"^(#{3,6}) (.+)$")
_CELL_BOUND = re.compile(r"^(?:確定内容|接地根拠) (\S+) \(対応セル|^(\S+) \(対応セル")


def _subsection_key(level: str, title: str) -> tuple:
    """小節見出しの同一性キー。

    `(対応セル: …)` を名乗る見出しは**階層と ref だけ**で照合する。同じ問答でも役割が
    主から裏付けへ移ると見出しの文言は変わる (`### x` → `### x — 接地根拠 (…)`)。
    文言で照合すると、役割が変わっただけの節を「消えた」と誤判定し、compile のたびに
    同じ本文が末尾へ複製されて増え続ける。それ以外の見出しは文言そのもので照合する。
    """
    m = _CELL_BOUND.match(title)
    if m:
        return (level, m.group(1) or m.group(2))
    return (level, title.strip())


def handwritten_subsections(existing: str, generated: str) -> "list[tuple[str, str]]":
    """既存章にあって生成物に無い**`###` 以下の小節**を (見出し, 本文) で並び順に返す。

    **なぜ `##` 単位では足りないか (2026-08-25 実測)**: 質疑録は `## 確定内容 (質疑録)`
    という**生成される**節の内側に `### <ref> (対応セル: …)` として並ぶ。節そのものは
    生成物にも在るので `handwritten_sections` は何も検出せず、`preserve` は緑のまま
    小節ごと本文を落とす。8 章で 369 行が消えたときの主因がこれである。

    質疑録だけではない。`#### 既存記録との食い違い` のような**人が書いた考察**も、
    `##### 確定内容 <ref>` の設計適用も、生成される `##` 節の内側に住んでいる。実測では
    ui-ux 章の食い違い記録 (「この食い違いは 2026-08-23 に解消した」以下の全文) が
    ここから消えていた。

    **照合は `_subsection_key` に任せる。**`(対応セル)` を名乗る見出しは階層と ref だけで
    突き合わせる。役割が主から裏付けへ移ると見出しの文言は変わるので、文言で照合すると
    「消えた」と誤判定し、compile のたびに同じ本文が末尾へ増え続ける。

    qa の回答本文そのものが見出しを含むことがある (ui-ux の
    `qa-uiux-web-screen-priority` など)。それらは生成物にも同じ見出しで現れるので、
    「生成物に無い」条件で自然に除かれる。

    引き継ぐ先に残るのは**正本から導出できない小節**である。`qa-uiux-web-overhaul-v2`
    などは `qa_log` にすら無く、章にしか本文が存在しない。**引き継がなければ、この世から
    消える。**

    切り出しの境界は「次の小節見出し」または「次の `## ` 見出し」とする。回答本文に
    見出しが埋まっている ref では本文が途中で切れうるが、そのぶんは `vanishing_lines`
    の報告に出る。**黙って消えるのではなく、報告に出る側へ倒している。**

    **生成物に無い `## 節` の内側は見ない。**そこは `handwritten_sections` が節ごと
    引き継ぐ。両方が拾うと、前回引き継いだ本文が compile のたびに 2 通の形で積まれ、
    章が回を重ねるごとに太る。冪等でない引き継ぎは、引き継がないのと同じくらい悪い。
    """
    gen_keys = {
        _subsection_key(m.group(1), m.group(2))
        for l in generated.splitlines()
        if (m := _SUBSECTION.match(l))
    }
    gen_sections = set(_section_map(generated))
    lines = existing.splitlines()
    out: list[tuple[str, str]] = []
    section: str | None = None
    for i, line in enumerate(lines):
        if line.startswith("## "):
            section = line.strip()  # `_section_map` の鍵は見出し行そのもの
            continue
        if section is not None and section not in gen_sections:
            continue
        m = _SUBSECTION.match(line)
        if not m or _subsection_key(m.group(1), m.group(2)) in gen_keys:
            continue
        end = len(lines)
        for j in range(i + 1, len(lines)):
            if _SUBSECTION.match(lines[j]) or lines[j].startswith("## "):
                end = j
                break
        out.append((line.strip(), "\n".join(lines[i:end]).rstrip() + "\n"))
    return out


CARRIED_HEADING = "## 章にしか無い記述 (正本へ未接続)"
RESIDUE_HEADING = "## compile が保てなかった行 (要判断)"


_RESIDUE_ITEM = re.compile(r"^- `(.*)`$")


def split_residue(text: str) -> "tuple[str, list[str]]":
    """前回の compile が置いた「保てなかった行」節を、本文と写しの行へ分ける。

    節を本文に残したまま次回の既存本文として数えると、写し自身が「章に在って生成物に
    無い行」に該当し、写しの写しが積まれる。1 回ごとに倍になるので数回で章が読めなくなる。
    かといって**落とすだけでは、その行の唯一の残りが消える** — 元の行はもう本文にも
    生成物にも無いから、写しがこの世で最後の一部なのである。

    よって落としたうえで**今回の報告へ持ち越す**。節は毎回作り直され、中身は減らない。

    `CARRIED_HEADING` のほうは触らない。あちらの中身は写しではなく本文であり、生成物に
    無い `##` 節として `handwritten_sections` の引き継ぎ経路に乗る。
    """
    body: list[str] = []
    carried: list[str] = []
    skipping = False
    for line in text.splitlines():
        if line.startswith("## "):
            skipping = line.strip() == RESIDUE_HEADING
        if skipping:
            m = _RESIDUE_ITEM.match(line)
            if m:
                carried.append(m.group(1))
        else:
            body.append(line)
    return ("\n".join(body).rstrip("\n") + "\n" if body else "", carried)


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

    loss_report を渡すと、節・小節を引き継いでもなお消える行を [(ファイル名, [行, ...])]
    で受け取れる。preserve のときは同じ内容を章末の `RESIDUE_HEADING` 節へも写す。
    **節でも小節でもない 1 行は、引き継ぐ場所が無い**からである — 表の行を表から切り離せば
    意味が壊れ、生成節へ差し戻せば正本の投影と手書きの区別が消える。本文としてではなく
    報告として残せば、消えはせず、表も壊れず、正本へ戻す動機が章の上に残る。
    **preserve は「正本と一致した」という意味ではない。**呼び手はこの節を読んで、
    正本へ接続するか不要と確かめて消すこと。
    """
    if on_handwritten not in ("refuse", "preserve"):
        raise CompileError(f"on_handwritten は refuse|preserve のいずれか (受領: {on_handwritten!r})")

    # 1 ファイルでも危ないものがあれば 1 文字も書かない。部分適用は差分を読みにくくする。
    carried: dict[str, list[str]] = {}
    # 生成される `##` 節の内側に住む手書きの小節 (質疑録の `###`、人の考察の `####`、
    # 設計適用の `#####`) は `##` 単位の検出をすり抜ける。**refuse も preserve も、
    # ここを同じ根拠で扱う。**片方だけ見張ると「refuse なら安全」が嘘になる。
    carried_sub: dict[str, list[tuple[str, str]]] = {}
    for name, content in docset.items():
        p = out_dir / name
        if not p.is_file():
            continue
        existing_text, _ = split_residue(p.read_text(encoding="utf-8"))
        lost = handwritten_sections(existing_text, content)
        if lost:
            carried[name] = lost
        lost_sub = handwritten_subsections(existing_text, content)
        if lost_sub:
            carried_sub[name] = lost_sub

    if (carried or carried_sub) and on_handwritten == "refuse":
        detail = "; ".join(f"{name}: {' / '.join(heads)}" for name, heads in sorted(carried.items()))
        if carried_sub:
            sub_detail = "; ".join(
                f"{name}: {' / '.join(head for head, _ in subs)}"
                for name, subs in sorted(carried_sub.items())
            )
            detail = f"{detail} / 小節: {sub_detail}" if detail else f"小節: {sub_detail}"
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
        # 前回の写しは既存本文として数えず、今回の報告へ持ち越す (`split_residue` 参照)。
        before, prior_residue = (
            split_residue(p.read_text(encoding="utf-8")) if p.is_file() else (None, [])
        )
        text = content if content.endswith("\n") else content + "\n"
        if name in carried:
            existing = _section_map(before or "")
            text = text.rstrip("\n") + "\n\n" + "\n".join(existing[h] for h in carried[name])
        if name in carried_sub:
            # 元の生成節の内側へ差し戻さない。**正本から導けない記述であることを、章の上で
            # 読めるようにする。**生成節へ混ぜると、正本の投影と手書きの区別が消え、次に
            # 誰かが正本を直す動機も消える。
            heads = ", ".join(f"`{h}`" for h, _ in carried_sub[name])
            text = (
                text.rstrip("\n")
                + f"\n\n{CARRIED_HEADING}\n\n"
                + f"> 以下の {len(carried_sub[name])} 件は正本 `spec-state.json` の `qa_ref` /"
                + " `qa_refs` / `required_info[].grounded_by` のいずれからも導けない"
                + f" ({heads})。compile が消さずに引き継いでいるだけで、**章が正本の投影で"
                + "ある性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。\n\n"
                + "\n".join(body for _, body in carried_sub[name])
            )
        residue = vanishing_lines(before, text) if before is not None else []
        # 持ち越し分を先に置く。順序を回ごとに入れ替えると、差分が中身の変化に見える。
        residue = [l for l in prior_residue if l not in residue] + residue
        if loss_report is not None and residue:
            loss_report.append((name, residue))
        if residue:
            # refuse でも書く。行の消失は refuse の停止条件ではない (節が無事なら通る) が、
            # **通す回に黙って消すのはこのモジュールが一貫して避けてきたこと**である。
            # 止めた回は既にここへ来ていないので、部分適用にはならない。
            # **節でも小節でもない 1 行は、引き継ぐ場所が無い。**表の行を表から切り離せば
            # 意味が壊れ、生成節へ差し戻せば正本の投影と手書きの区別が消える。そこで
            # 本文としてではなく**報告として**章の末尾へ写す。消えはせず、表も壊れず、
            # 正本へ戻す動機が章の上に残る。写しなので次回は `strip_residue` が落とす。
            text = (
                text.rstrip("\n")
                + f"\n\n{RESIDUE_HEADING}\n\n"
                + f"> 正本から導出できず、節・小節の引き継ぎでも守れなかった {len(residue)} 行。"
                + "版の更新のように**正しく消える行**も混ざる。正本へ接続するか、"
                + "不要と確かめて消すこと。この節は compile のたびに作り直す。\n\n"
                + "\n".join(f"- `{line}`" for line in residue)
                + "\n"
            )
        p.write_text(text, encoding="utf-8")
        written.append(p)
    return written
