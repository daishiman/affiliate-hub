#!/usr/bin/env python3
# /// script
# name: test-compile-heading-demotion-real-data
# version: 0.1.0
# purpose: 合成入力ではなく system-spec/spec-state.json の実 qa_log を押し下げ関数へ通し、実データ由来の浅い見出しが章の階層を乗っ取らないこと・逐語性が 1 バイトも崩れないことを固定する pytest。
# inputs:
#   - system-spec/spec-state.json (読み取りのみ)
# outputs:
#   - pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""**実データの見出しを、実データのまま通す。**

── なぜ合成入力だけでは足りないか ──────────────────────────────

隣の `test_compile_heading_demotion.py` は 10 件緑だが、**入力は全て
テスト内で書いた定数**である。合成入力は「押し下げ関数が仕様どおり動く」を
示すが、「**この repo の正本に実際に入っている文字列**が通る」は示さない。
両者は別の主張である。関数が正しくても、実データにだけ在る形
(見出しの深さの組み合わせ・フェンス内の `#`・全角混じり) で崩れれば章は壊れる。

── 拒否も正規化もしない、という判断 (2026-08-30 / ah-b2m) ─────────

ah-b2m の起票文は「writer が拒否するか、記録時に正規化するかの判断が要る」
だった。**実測が判断を決めた。**`qa_log` 48 件のうち `## ` 以浅の見出しを含む
行が **16 行**在り、その多くは書面要件からの**逐語引用**である——

    ## 2.3 発信者に対する価値      (qa-foundation-u6)
    ## 6.1 含むもの / ## 6.2 含まないもの  (qa-foundation-u7)
    ## 5. 集計層(MetricRollup)     (qa-database-web-analytics)

`answer` には `source.sha256` が付く。**本文の指紋である。**writer で
`## ` を拒めば、この逐語引用は正本へ入れられなくなる。黙って正規化すれば
指紋と本文が食い違い、出典との照合が二度と成立しない。

つまり **`## ` は正本に在ってよい。**壊れているのは文字ではなく
**置かれた深さ**だけである。正しい防御は入口ではなく描画側——`#` の本数だけを
足して埋め込み先より深くする `demote_headings` であり、それは実装済みである。
この検査は、その防御が**実データに対して**効いていることを固定する。

── 向き ─────────────────────────────────────────────────

達成済みの下限の見張り。押し下げが外れた日、逐語性が崩れた日、
そして**守る対象が消えた日**(16 行が 0 になったのに検査だけ残る形)に赤くなる。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
LIB_DIR = PLUGIN_ROOT / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

from spec_docset_chapters import _demotion_notes, demote_headings  # noqa: E402

# plugin は repo 直下に置かれる。正本はそこから 4 つ上。
REPO_ROOT = PLUGIN_ROOT.parents[2]
SPEC_STATE = REPO_ROOT / "system-spec" / "spec-state.json"

_HEADING = re.compile(r"^(#{1,6})(\s|$)")

# 章へ実体描画する 2 経路の埋め込み先。**両方を見る。**
# 片方だけ塞いでも、もう片方から同じ壊れが章へ漏れる
# (`spec_docset_chapters.py` の 2 つの呼び出し: 質疑録 = h4 / 設計知識 = h6)。
FLOORS = (4, 6)


def _qa_log() -> list[dict]:
    return json.loads(SPEC_STATE.read_text(encoding="utf-8"))["qa_log"]


def _heading_levels(text: str) -> list[int]:
    """フェンスの外に在る見出しの深さ。**関数と同じ数え方をする。**

    フェンス内の `#` を数えてしまうと、コード例が見出しに化けて
    「押し下げ漏れ」を捏造する。
    """
    levels: list[int] = []
    in_fence = False
    for line in text.split("\n"):
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _HEADING.match(line)
        if m:
            levels.append(len(m.group(1)))
    return levels


ANSWERS = [(e["id"], str(e.get("answer", ""))) for e in _qa_log()]
WITH_HEADINGS = [(i, a) for i, a in ANSWERS if _heading_levels(a)]


def test_the_canonical_source_still_contains_the_shallow_headings_we_guard() -> None:
    """母数。**これが 0 になったら、この検査は何も守っていない。**

    `## ` を含む行が正本から消えれば、以下の「乗っ取りは 0 件」は
    入力が空でも通る。守る対象の実在をここで併記しておく。
    """
    shallow = [
        (qa_id, line)
        for qa_id, answer in ANSWERS
        for line in answer.split("\n")
        if _HEADING.match(line) and len(_HEADING.match(line).group(1)) <= 2
    ]
    assert len(ANSWERS) == 48, "qa_log の件数が動いた。下の実測値を取り直すこと"
    assert len(shallow) == 16, f"`## ` 以浅の見出し行が 16 行から動いた: {len(shallow)}"
    assert len(WITH_HEADINGS) == 12

    # 逐語引用であることの証拠を 1 件だけ名指しで残す。
    # 「拒否しない」判断の根拠が、検査を読むだけで辿れるようにする。
    ids = {qa_id for qa_id, _ in shallow}
    assert "qa-foundation-u6" in ids


@pytest.mark.parametrize("floor", FLOORS)
def test_no_real_answer_can_take_over_the_chapter_hierarchy(floor: int) -> None:
    """実データを両方の埋め込み先へ通し、埋め込み先より浅い見出しが残らないこと。"""
    escaped = [
        (qa_id, line)
        for qa_id, answer in WITH_HEADINGS
        for line in demote_headings(answer, floor)[0].split("\n")
        if _HEADING.match(line) and len(_HEADING.match(line).group(1)) < floor
    ]
    assert escaped == [], f"h{floor} より浅いまま章へ出る見出しが在る: {escaped}"


def test_the_guard_is_actually_doing_the_work() -> None:
    """陽性対照。**押し下げを通さなければ 21 行が漏れる。**

    これが無いと、上の検査は「実データがもともと安全だった」場合でも通る——
    つまり押し下げが外れた日に気づけない。

    母数の 16 行 (`## ` 以浅) より多いのは、**`### ` も h4 経路では乗っ取る**
    からである。質疑 1 件の節そのものが `### {ref} (対応セル: …)` なので、
    回答本文の `### ` は章の上で**節の見出しと同じ深さに並ぶ**。
    「どの質疑に属する主張か」が消えるのは `## ` と同じである。
    """
    raw = [
        (qa_id, line)
        for qa_id, answer in WITH_HEADINGS
        for line in answer.split("\n")
        if _HEADING.match(line) and len(_HEADING.match(line).group(1)) < 4
    ]
    shallowest = [l for _, l in raw if l.startswith("## ")]
    assert len(raw) == 21
    assert len(shallowest) == 16, "母数の 16 行がこちらからも同じ数で見えること"


@pytest.mark.parametrize("floor", FLOORS)
def test_demotion_changes_nothing_but_the_hash_count(floor: int) -> None:
    """逐語性。**先頭の `#` を剥がせば元の本文と 1 バイトも違わない。**

    `source.sha256` が本文の指紋である以上、ここが崩れれば出典との照合が
    成立しなくなる。押し下げが「深さの表現」しか触っていないことを固定する。
    """
    for qa_id, answer in WITH_HEADINGS:
        out, _, _ = demote_headings(answer, floor)
        strip = lambda t: "\n".join(_HEADING.sub(r"\2", l) for l in t.split("\n"))  # noqa: E731
        assert strip(out) == strip(answer), f"{qa_id} で本文が変わった"
        assert len(out.split("\n")) == len(answer.split("\n")), f"{qa_id} で行数が変わった"


def test_relative_depth_is_preserved_except_where_it_hits_h6() -> None:
    """見出し同士の深さの差が保たれること。潰れる 1 件は隠さず注記が出ること。

    h4 経路では 12 件とも差が保たれる。h6 経路では
    `qa-uiux-web-screen-priority` (h2 と h3 を持つ) だけが上限に当たって潰れる。
    **潰れること自体は不具合ではない**——隠されることが不具合なので、
    そのときに注記が出るところまで見る。
    """
    flattened_at_six: list[str] = []
    for qa_id, answer in WITH_HEADINGS:
        before = _heading_levels(answer)
        span = max(before) - min(before)

        out4, demoted4, flat4 = demote_headings(answer, 4)
        after4 = _heading_levels(out4)
        assert demoted4 is True, f"{qa_id} が h4 経路で押し下げられていない"
        assert flat4 is False
        assert min(after4) == 4
        assert max(after4) - min(after4) == span, f"{qa_id} で深さの差が変わった"

        _, _, flat6 = demote_headings(answer, 6)
        if flat6:
            flattened_at_six.append(qa_id)

    assert flattened_at_six == ["qa-uiux-web-screen-priority"]
    notes = _demotion_notes("qa-uiux-web-screen-priority", True, True)
    assert len(notes) == 2, "押し下げと潰れの両方が章に残ること"
    assert "上限" in notes[1]
