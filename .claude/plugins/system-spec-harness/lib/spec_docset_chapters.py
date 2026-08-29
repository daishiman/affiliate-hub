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
from spec_docset_citation import render_clause_citation

# レンダリング (章 / index) — 純関数                                            #
# --------------------------------------------------------------------------- #
_FENCE_RE = re.compile(r"^```", re.M)


def seal_code_fences(text: str) -> tuple[str, bool]:
    """本文中のコードフェンスが閉じていなければ閉じる (章の構造を守る)。

    なぜ要るか: qa_log の answer は正本からそのまま章へ実体描画される。
    answer の中でコードフェンスが閉じていないと、**開いたフェンスが章の残り
    全部を飲み込む**。実測 (2026-08-19): backend 章で見出し 28 個・192 行が
    1 つのコード塊に飲まれた。フェンスの本数が偶数かどうかでは判定できない
    (行き場の無い閉じフェンス 2 本が互いに対になり得る) ため、
    **開いたまま終わっているかどうか**で判定する。

    捏造はしない: 内容は変えず、末尾に閉じフェンスを足すだけで、
    足したことは呼び出し側が注記として可視化する (fail-visible)。
    正本 (qa_log[].answer) 側の修正が本筋であり、これはその修正までの防波堤である。
    """
    if len(_FENCE_RE.findall(text)) % 2 == 0:
        return text, False
    return text + "\n```", True


_HEADING_RE = re.compile(r"^(#{1,6})(\s|$)")


def demote_headings(text: str, floor: int) -> tuple[str, bool, bool]:
    """本文中の見出しを、埋め込み先より深い階層へ押し下げる (章の構造を守る)。

    なぜ要るか: qa_log の answer は正本からそのまま章へ実体描画される。
    answer が `## 調査結果` のような見出しを含むと、**1 質疑の回答の一部が
    章直下の節として立ち上がる**。読む側にはそれが「章の節」に見え、
    どの質疑に属する主張なのかが消える。実測 (2026-08-25): frontend 章と
    ui-ux 章で `## 調査結果` と `## <章> 章への反映方針` が各 2 回ずつ
    章直下に現れ、目次上は同名の節が重複した。

    `seal_code_fences` と同じ立場である。閉じていないフェンスが章の残りを
    飲み込むのと同様、浅すぎる見出しは章の階層を乗っ取る。

    捏造はしない: **文字は 1 つも変えず、`#` の本数だけを一律に足す。**
    本文内の見出し同士の深さの差 (相対関係) は保つ。逐語性が損なわれないのは、
    見出しの深さが「文書のどこに置かれたか」の表現であって、主張そのものでは
    ないからである。押し下げたことは呼び出し側が注記として可視化する。

    Markdown の上限 (h6) に達して深さの差が潰れた場合は、それも隠さず
    第 3 返値で知らせる。正本側で見出しを使わない記述へ直すのが本筋であり、
    これはその修正までの防波堤である。

    戻り値: (押し下げ後の本文, 押し下げたか, 上限で潰れたか)
    """
    lines = text.split("\n")
    in_fence = False
    levels: list[int] = []
    for line in lines:
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _HEADING_RE.match(line)
        if m:
            levels.append(len(m.group(1)))
    if not levels:
        return text, False, False
    shift = floor - min(levels)
    if shift <= 0:
        # すでに埋め込み先より深い。触らないのが正しい。
        return text, False, False
    out: list[str] = []
    in_fence = False
    flattened = False
    for line in lines:
        if line.startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        m = None if in_fence else _HEADING_RE.match(line)
        if m:
            wanted = len(m.group(1)) + shift
            level = min(6, wanted)
            if wanted > 6:
                flattened = True
            out.append("#" * level + line[len(m.group(1)):])
        else:
            out.append(line)
    return "\n".join(out), True, flattened


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
            # 裏付けの範囲を表に出す。**出さないと、章の側で人が手で書き足す。**
            # 実測 (2026-08-25): 8 章のうち 7 章の同じ行に「先行質疑 X は qa_refs に
            # 残り、本章にも併記する」という手書きが在った。正本 `qa_refs` から
            # 引ける事実なので、人が書き足す理由は compile が黙っていたことだけである。
            backing = [
                ref
                for ref in (cell.get("qa_refs") or [])
                if isinstance(ref, str) and ref and ref != cell.get("qa_ref")
            ]
            if backing:
                joined = ", ".join(f"`{ref}`" for ref in backing)
                basis += f"。裏付け質疑 (`qa_refs`): {joined} — 本章の「確定内容 (質疑録)」へ接地根拠として併記"
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


def _grounding_cells_by_qa_ref(spec: dict, cat_id: str) -> list[tuple[str, list[str]]]:
    """確定セルが**裏付けとして名指す**質疑の (id, 対応セル) を初出順で返す。

    なぜ要るか: セルは 2 種類の参照を持つ。`qa_ref` は「何を確定したか」、
    `qa_refs` と `required_info[].grounded_by` は「その確定が何に支えられているか」
    である。前者だけを章へ描くと、**支えている質疑が章から消える**。

    実測 (2026-08-25): 章には `### <id> (対応セル: web) — 接地根拠 …` という節が
    在るのに、compile はそれを出さなかった。プラグインのコードを全文検索しても
    「接地根拠」の語は 1 件も無く、**章の側に手で書かれていた**。手書きなので
    再コンパイルのたびに消え、`--on-handwritten preserve` でも守れない
    (`## 確定内容 (質疑録)` という生成節の**中**にあるため、節の引き継ぎの
    対象にならない)。backend / frontend / ui-ux の 3 章で計 34 見出し・
    質疑本文ごと失われていた。

    直し方は「手書きを守る」ではなく「正本から導出する」である。裏付けの範囲は
    セルが `qa_refs` として名乗っており、機械が読める。章 = 正本の純関数という
    本モジュールの前提に戻せば、手書きに頼る理由がそもそも無くなる。

    `qa_ref` 自身は確定内容として別に描かれるので、ここでは除く。
    """
    row = _row(spec, cat_id)
    primary = {
        cell.get("qa_ref")
        for cell in row.values()
        if isinstance(cell, dict) and cell.get("state") == "確定" and cell.get("qa_ref")
    }
    ordered: list[str] = []
    cells_by_ref: dict[str, list[str]] = {}
    for pf in CANONICAL_PLATFORMS:
        cell = row.get(pf)
        if not isinstance(cell, dict) or cell.get("state") != "確定":
            continue
        refs = [ref for ref in (cell.get("qa_refs") or []) if isinstance(ref, str)]
        for item in cell.get("required_info") or []:
            if isinstance(item, dict) and isinstance(item.get("grounded_by"), str):
                refs.append(item["grounded_by"])
        for ref in refs:
            if not ref or ref in primary:
                continue
            if ref not in ordered:
                ordered.append(ref)
            if pf not in cells_by_ref.setdefault(ref, []):
                cells_by_ref[ref].append(pf)
    return [(ref, cells_by_ref[ref]) for ref in ordered]


def _demotion_notes(ref: str, demoted: bool, flattened: bool) -> list[str]:
    """見出しを押し下げたことを章に残す (足したことを隠さない)。"""
    notes: list[str] = []
    if demoted:
        notes.append(
            f"- (注記: 正本 qa_log[{ref}].answer が見出しを含むため、章の階層を守って"
            "コンパイラが深い階層へ押し下げた。文字は変えていない)"
        )
    if flattened:
        notes.append(
            f"- (注記: qa_log[{ref}].answer の見出しの一部が Markdown の上限 (h6) に達し、"
            "本文内の見出し同士の深さの差が潰れた。正本側で見出しを使わない記述へ直すのが本筋)"
        )
    return notes


def render_confirmed_qa(spec: dict, cat_id: str) -> str:
    """確定セルが参照する質疑 (qa_log) の本文を章へ実体描画する。

    章の意味層 (確定要件の中身) を正本 spec-state.json から完全導出することで、
    再コンパイルしても確定内容が消えない (章 = 正本の純関数) を保証する。
    canonical platform 順に qa_ref を初出順で重複除去し、各 qa の質問・回答と
    対応セルを描画する。qa 本文が正本に無い参照は捏造せず欠落を明示する (fail-visible)。
    """
    qa_map = _qa_by_id(spec)
    confirmed = _confirmed_cells_by_qa_ref(spec, cat_id)
    grounding = _grounding_cells_by_qa_ref(spec, cat_id)
    lines = ["## 確定内容 (質疑録)", ""]
    if not confirmed:
        lines.append("- (確定セルなし。本章は対象外または収集中)")
        return "\n".join(lines)
    for ref, cells in confirmed:
        lines.extend(_render_qa_body(qa_map, ref, cells))
    # 確定を支えている質疑も同じ章に置く。**支えが章の外にあると、
    # 読む側は確定の根拠を追えない。**確定内容とは見出しで区別する。
    for ref, cells in grounding:
        lines.extend(
            _render_qa_body(
                qa_map, ref, cells, suffix=" — 接地根拠 (required_info/qa_refs が名指す裏付け)"
            )
        )
    return "\n".join(lines).rstrip()


def _render_qa_body(
    qa_map: dict[str, dict], ref: str, cells: list, *, suffix: str = ""
) -> list[str]:
    """1 件の質疑 (質問・回答) を章の節として描く。

    確定内容と接地根拠で本文の描き方は変わらない。変わるのは見出しの但し書きだけ
    なので、描画は 1 箇所に置く。片方だけ直して片方が古びる、を避ける。
    """
    lines = [f"### {ref} (対応セル: {', '.join(cells)}){suffix}", ""]
    qa = qa_map.get(ref)
    if not qa:
        lines.append(f"- (qa_log に {ref} の本文が見つからない — 正本の欠落を要確認)")
        lines.append("")
        return lines
    lines.append(f"**質問**: {qa.get('question', '(未記入)')}")
    lines.append("")
    answer, sealed = seal_code_fences(str(qa.get("answer", "(未記入)")))
    answer, demoted, flattened = demote_headings(answer, 4)
    lines.append(f"**回答**: {answer}")
    lines.append("")
    for note in _demotion_notes(ref, demoted, flattened):
        lines.append(note)
        lines.append("")
    if sealed:
        # 足したことを隠さない。正本を直すまでの防波堤であることを章に残す。
        lines.append(
            f"- (注記: 正本 qa_log[{ref}].answer のコードフェンスが閉じていないため、"
            "章の構造を守るためコンパイラが閉じた。正本側の修正が要る)"
        )
        lines.append("")
    return lines


def render_chapter_notes(spec: dict, cat_id: str) -> str:
    """正本 `chapter_notes` の散文を、章の独立した `##` 節として描く。

    **黙っている機械の隣には、必ず手写しが育つ。**この節が無かったあいだ、章に
    しか居場所の無い突き合わせの記録は生成節の内側へ手で書かれ、compile のたび
    消失一覧に載っていた (実測 2026-08-25: `ui-ux.md` の
    `#### 既存記録との食い違い`)。守るのではなく、消えようのない場所を用意する。

    利用者の逐語 (`qa_log[].answer`) と混ぜない。混ぜると、後から気づいた
    突き合わせが利用者の声の顔で残る。だから節を分け、記録の理由を併記する。
    """
    notes = (spec.get("chapter_notes") or {}).get(cat_id)
    if not isinstance(notes, list) or not notes:
        return ""
    lines = [
        "## 章の注記 (chapter_notes)",
        "",
        "> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**"
        "確定内容 (質疑録) と混ぜて読まないために節を分けてある。",
    ]
    for note in notes:
        if not isinstance(note, dict):
            continue
        lines += ["", f"### {note.get('heading', '(見出しなし)')}", ""]
        lines += [str(note.get("body", "")).rstrip("\n")]
        reason = str(note.get("reason") or "").strip()
        if reason:
            lines += ["", f"- 正本へ入れた理由: {reason}"]
    return "\n".join(lines)


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
    lines += render_clause_citation(concern_ids, concerns)
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
        lines.extend(_render_application_entry(qa_map, ref, cells, label="確定内容"))
    # 接地根拠の質疑にも design_applications は記録され得る。確定内容だけを描くと、
    # **裏付け側に書かれた原則採否が章から落ちる。**
    for ref, cells in _grounding_cells_by_qa_ref(spec, cat_id):
        lines.extend(_render_application_entry(qa_map, ref, cells, label="接地根拠"))
    if goals:
        lines.append(f"- 資するゴール: {', '.join(goals)}")
    return lines


def _render_application_entry(
    qa_map: dict, ref: str, cells: list, *, label: str
) -> list[str]:
    """1 件の質疑について、確定要件と設計原則の採否を描く。

    **本文の描き方だけが確定内容と接地根拠で違う。**確定内容は本文を実体描画し、
    接地根拠は「確定内容 (質疑録)」への参照だけを置く。裏付けの本文は同じ章の
    質疑録に既に全文が在るので、ここで二度描くと同じ長文が 1 章に 2 回並ぶ。
    この使い分けは章の側で人が手で守っていた書式であり、機械へ移しただけである。
    """
    lines: list[str] = []
    qa = qa_map.get(ref) or {}
    lines.extend([f"##### {label} {ref} (対応セル: {', '.join(cells)})", ""])
    if label != "確定内容":
        lines.append(f"- 本文: 「確定内容 (質疑録)」の `{ref}` を参照")
    else:
        # ここも answer を実体描画する 2 つ目の経路である。
        # 片方だけ塞ぐと、同じ壊れがこちらから章へ漏れる。
        answer, sealed = seal_code_fences(str(qa.get("answer", "(qa_log 本文欠落)")))
        answer, demoted, flattened = demote_headings(answer, 6)
        lines.append(f"- 確定要件: {answer}")
        if sealed:
            lines.append(
                f"- (注記: 正本 qa_log[{ref}].answer のコードフェンスが閉じていないため、"
                "章の構造を守るためコンパイラが閉じた。正本側の修正が要る)"
            )
        lines.extend(_demotion_notes(ref, demoted, flattened))
    applications = qa.get("design_applications")
    if not isinstance(applications, list) or not applications:
        # **章は読み物であって作業指示書ではない。**ここに writer 宛の TODO を置くと、
        # 成果物が「未完成の指示」を配ることになる。しかも指していた補完手順
        # (`set-qa-design-applications`) は `legacy_exempt=true` の旧 entry しか
        # 受けないので、一般の entry では**実行できない手順を仕様書が配っていた**。
        # 記録が無いことは事実として残し、指示は書かない。
        lines.append("- 設計解釈の記録経路: `unrecorded`")
        lines.append(
            "- 設計原則の採否根拠: 未記録。この質疑に `design_applications` が無いため、"
            "章はこの質疑を根拠に設計原則の採否を主張しない"
        )
        return lines
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
    return lines


def render_design_refs(cat_id: str, spec: dict | None = None) -> str:
    """設計知識をpathだけでなく、目的達成に使える意味項目まで章へ描画する。

    card 本文 (目的/解決する問題/適用条件/非適用条件/トレードオフ/goal寄与) は
    ref-system-design-knowledge の汎用原則の逐語転記であり、それだけでは章固有ではない。
    spec 指定時は末尾に `_render_chapter_application` で「本章での適用」節を添え、
    qa_log[].design_applications の具体的な原則採否を qa_ref・対応セル・serves_goals へ束縛する。
    """
    refs = category_design_refs(cat_id)
    lines = [
        "## 適用された設計知識",
        "",
        # **`採否: applied` は「設計として採った」であって「作った・通った」ではない。**
        # この断り書きは 2 章 (database / infrastructure) にだけ手で書かれていた。
        # 誤読は 2 章に限って起きるものではないので、全章へ機械が置く。
        "> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、"
        "実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、"
        "実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。",
        "",
    ]
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
    notes = render_chapter_notes(spec, cat_id)
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
        # 注記の無い章に空節を作らない。空文字を差し込むと空行だけが増える。
        *([notes, ""] if notes else []),
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
