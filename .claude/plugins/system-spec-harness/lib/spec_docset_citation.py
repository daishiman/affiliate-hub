#!/usr/bin/env python3
"""条項引用の可否 (clause citation) を章へ描画する (C05 gap 3)。

spec_docset_chapters.py の 500 行上限を守るため、doctrine anchor 本体から分離した。

**この節が答える問い**: authority を上流指針として掲げているのは分かったとして、
その authority の「条項」を要件文の根拠として引けるのか。

掲げることと引けることは別である。前者は doctrine-anchor-registry の帰属だけで
成立するが、後者は条項が **取得物の中に実在すること** を要する。取得していない
内容を出典に帰属させると、C05 が実在しない日付 2026-07-03 を「公式表明値」として
書いたのと同じ形になる。

引けない場合に「条項引用不可」の一語で済ませないことが眼目。理由は 3 種あり、
性質がまったく違う:

    not-in-fetch-targets   取得対象一覧に無い     → 取れば可になる
    fetched-but-no-body    取得したが本文が無い   → 取得経路を変えれば可になる
    no-retrieval-path      取得経路が原理的に無い → この作業場所では永久に不可

3 種を潰すと、塞げる穴と塞げない穴が同じ顔になる。次に読む人は、書籍を取りに
いこうとするか、取れる workbook を諦めるか、どちらかを必ず間違える。

正本は doctrine-anchor-registry.json の concerns[].clause_citation ただ 1 箇所。
ここで理由文を作らない (定義を 2 箇所に置くと、registry を直しても章が変わらなくなる)。
"""
from __future__ import annotations

_REASON_CLASS_LABEL = {
    "not-in-fetch-targets": "取得対象に無い (取れば可になる)",
    "fetched-but-no-body": "取得したが本文が無い (取得経路を変えれば可になる)",
    "no-retrieval-path": "取得経路が原理的に無い (この作業場所では永久に不可)",
}


def render_clause_citation(concern_ids: list, concerns: dict) -> list:
    """concern ごとの引用可否を markdown 行のリストとして返す。

    available には cited_clauses (章番号・章題・URL) と citation_scope
    (取得物のどこまでを根拠にできるか) を出す。unavailable には reason_class の
    ラベルと registry の理由文、および反転先 (塞げる 2 種は reversal、
    塞げない 1 種は reversal_note) を出す。
    """
    out = ["", "### 条項引用の可否 (clause citation)", ""]
    out += ["| concern | 可否 | 引ける条項 / 引けない理由 |", "|---|---|---|"]
    scopes: list = []
    reversals: list = []
    for cid in concern_ids:
        cc = (concerns.get(cid) or {}).get("clause_citation") or {}
        state = cc.get("state")
        if state == "available":
            clauses = cc.get("cited_clauses") or []
            rendered = " / ".join(
                f"第 {q.get('chapter')} 章 {q.get('title')} ({q.get('url')})" for q in clauses
            )
            out.append(f"| {cid} | 引用可 | {rendered or '-'} |")
            if cc.get("citation_scope"):
                scopes.append(f"- **{cid} の引用範囲**: {cc['citation_scope']}")
        elif state == "unavailable":
            rc = cc.get("reason_class", "-")
            label = _REASON_CLASS_LABEL.get(rc, rc)
            out.append(f"| {cid} | **条項引用不可** — {label} | {cc.get('reason', '-')} |")
            if cc.get("reversal"):
                reversals.append(f"- **{cid} が引用可になる条件**: {cc['reversal']}")
            elif cc.get("reversal_note"):
                reversals.append(f"- **{cid} の反転先**: {cc['reversal_note']}")
        else:
            out.append(
                f"| {cid} | (未判定) | registry の clause_citation が未設定。"
                "判定せずに引用してはならない |"
            )
    if scopes:
        out += [""] + scopes
    if reversals:
        out += [""] + reversals
    return out
