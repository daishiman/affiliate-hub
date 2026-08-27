"""独立監査の契約書が「裏付けの全体」を読むよう書かれていることを固定する。

**同じ事実に住所が二つある。**セルの裏付けは `qa_refs[]` に全部在り、`qa_ref` (単数)
はその先頭の別名でしかない。書く側では決定論ゲート
(`validate-coverage-matrix.py`) が `qa_refs[0] == qa_ref` を強制するので、
**データが食い違うことはない。**食い違うのは読む側である。

実測 2026-08-25: C06 (`system-spec-hearing-auditor`) の契約書が単数しか教えて
いなかったため、`ui-ux.web` / `backend.web` / `frontend.web` が `*-overhaul-v2`
を引いていないと報告された。3 セルとも `qa_refs[]` に保持していた。**正本に在る
ものを「無い」と報せる監査は、見落としより高くつく** — 是正の宛先が仕様書へ向き、
直すところが無いまま赤が残り、C05 の総合判定まで降格した。

契約書を直しただけでは、次の書き直しでまた単数へ戻る。だから試験で留める。
これは文言の見張りではなく、**読む側の視野の下限**である。
"""
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / "agents"

# 裏付けを読む責務を持つ独立監査。C08 (鮮度) は matrix を読まないので対象外。
READERS = ["system-spec-hearing-auditor.md", "system-spec-matrix-auditor.md"]


@pytest.mark.parametrize("name", READERS)
def test_the_contract_names_the_plural_field(name):
    """`qa_refs` という欄の名前が契約書に在ること。無ければ読む側は探しに行けない。"""
    assert "qa_refs" in (AGENTS / name).read_text(encoding="utf-8")


@pytest.mark.parametrize("name", READERS)
def test_the_contract_says_the_singular_is_only_the_head(name):
    """**単数が全体ではない**と明言していること。

    「`qa_refs` も在る」とだけ書くと、単数を全体と読む余地が残る。
    偽陰性はその余地から入った。
    """
    text = (AGENTS / name).read_text(encoding="utf-8")
    assert "先頭の別名" in text


@pytest.mark.parametrize("name", READERS)
def test_the_checklist_requires_reading_every_backing(name):
    """完了確認の項目そのものが全件走査を求めていること。

    本文だけに書いて確認項目が単数のままだと、監査は確認項目の側に従う。
    """
    text = (AGENTS / name).read_text(encoding="utf-8")
    checklist = [ln for ln in text.splitlines() if ln.startswith("- [ ]") and "qa_ref" in ln]
    assert checklist, f"{name}: 裏付けを見る確認項目が無い"
    assert any("全件" in ln and "qa_refs" in ln for ln in checklist), checklist


def test_the_canonical_actually_holds_backings_only_the_plural_carries():
    """**この試験が守っている状況が、実在することを示す。**

    単数だけを読むと落ちる id が正本に在るあいだ、上の 3 試験は現実の防御である。
    もし将来 `qa_refs` が単数と同じ範囲しか持たなくなったら、この試験が先に落ちて
    「もう守るものが無い」ことを報せる。
    """
    spec = json.loads((ROOT.parents[2] / "system-spec" / "spec-state.json").read_text(encoding="utf-8"))
    only_plural = set()
    for row in (spec.get("matrix") or {}).values():
        for cell in row.values():
            if not isinstance(cell, dict) or cell.get("state") != "確定":
                continue
            refs = cell.get("qa_refs") or []
            only_plural |= set(refs) - {cell.get("qa_ref")}
    assert only_plural, "単数だけで全裏付けが読める状態になっている"


def test_the_gate_pins_the_head_alias():
    """単数が複数の先頭であることを、決定論ゲートが本当に強制していること。

    契約書に「先頭の別名」と書けるのは、機械がそれを保証しているからである。
    保証が消えたら、契約書の言い分は根拠を失う。
    """
    gate = (ROOT / "scripts" / "validate-coverage-matrix.py").read_text(encoding="utf-8")
    assert re.search(r"extra_refs\[0\]\s*!=\s*qa_ref", gate)
