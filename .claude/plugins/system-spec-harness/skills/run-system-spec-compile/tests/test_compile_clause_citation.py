#!/usr/bin/env python3
# /// script
# name: test-compile-clause-citation
# version: 0.1.0
# purpose: 章の「条項引用の可否」節 (C05 gap 3) を検証する。authority を掲げることと条項を引けることの区別、引けない理由 3 種が一語へ潰されないこと、引用範囲と反転先が章まで届くことを固定する。500行上限を守るため test_compile_spec_doc.py 本体から分離する。
# inputs:
#   - argv: pytest 収集 (引数なし)
# outputs:
#   - pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""条項引用の可否 (clause citation) の受入テスト。

authority を上流指針として掲げることと、その条項を要件文の根拠として引けることは
別である。後者は条項が取得物の中に実在することを要する。引けない理由は 3 種あり、
「条項引用不可」の一語へ潰すと塞げる穴と塞げない穴が同じ顔になる。
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
FIXTURES = SKILL_DIR / "fixtures"
REGISTRY = (
    PLUGIN_ROOT
    / "skills"
    / "ref-system-design-knowledge"
    / "references"
    / "doctrine-anchor-registry.json"
)


def _load_mod():
    path = SKILL_DIR / "scripts" / "compile-spec-doc.py"
    spec = importlib.util.spec_from_file_location("compile_spec_doc_clause", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mod = _load_mod()


def _spec() -> dict:
    return json.loads((FIXTURES / "spec-state.json").read_text(encoding="utf-8"))


def _refs() -> dict:
    return json.loads((FIXTURES / "fetched-references.json").read_text(encoding="utf-8"))


def _registry() -> dict:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def test_every_chapter_states_whether_clauses_can_be_cited():
    """可否を書かない章を許さない。未判定のまま引用されるのを防ぐ。"""
    docset = mod.compile_docset(_spec(), _refs())
    for name, text in docset.items():
        if name in ("index.md", "00-requirements-definition.md"):
            continue
        assert "### 条項引用の可否 (clause citation)" in text, name
        assert "(未判定)" not in text, f"{name} に未判定の concern がある"


def test_the_three_reasons_reach_the_chapters_as_three_different_labels():
    """3 種が章の上で見分けられること。

    ここが緑のまま「条項引用不可」の一語へ潰されると、塞げる穴と塞げない穴が
    同じ顔になる。ラベルの文言ではなく **3 つが互いに異なること** を固定する。
    """
    docset = mod.compile_docset(_spec(), _refs())
    sys.path.insert(0, str(PLUGIN_ROOT / "lib"))
    import spec_docset_citation

    labels = spec_docset_citation._REASON_CLASS_LABEL
    assert len(set(labels.values())) == 3, "3 種のラベルが重複している"
    assert set(labels) == {
        "not-in-fetch-targets",
        "fetched-but-no-body",
        "no-retrieval-path",
    }
    # 書籍 (取得経路なし) と landing page (本文なし) は別の章に出る。
    assert labels["no-retrieval-path"] in docset["backend.md"]
    assert labels["fetched-but-no-body"] in docset["security.md"]


def test_a_citable_concern_shows_chapter_number_title_and_url():
    docset = mod.compile_docset(_spec(), _refs())
    reliability = next(
        c for c in _registry()["concerns"] if c["concern_id"] == "reliability"
    )
    cc = reliability["clause_citation"]
    assert cc["state"] == "available"
    text = docset["database.md"]
    for clause in cc["cited_clauses"]:
        assert f"第 {clause['chapter']} 章" in text
        assert clause["title"] in text
        assert clause["url"] in text


def test_a_citable_concern_declares_how_far_the_citation_reaches():
    """目次しか取得していないのに章の主張を要約するのを防ぐ宣言。

    これが章から消えると、次に書く人は「引用可」だけを見て中身を要約しうる。
    それは C05 が実在しない日付を公式表明値として書いたのと同じ形。
    """
    docset = mod.compile_docset(_spec(), _refs())
    scope = next(
        c["clause_citation"]["citation_scope"]
        for c in _registry()["concerns"]
        if c["concern_id"] == "reliability"
    )
    assert scope in docset["database.md"]


def test_the_reversal_condition_is_written_in_the_chapter_not_only_the_registry():
    """記憶則⑤ (反転先を先に書く) が章まで届いていること。"""
    docset = mod.compile_docset(_spec(), _refs())
    by_id = {c["concern_id"]: c["clause_citation"] for c in _registry()["concerns"]}
    # 塞げる: 取得できた日に何をするか
    assert by_id["operations"]["reversal"] in docset["maintenance-ops.md"]
    # 塞げない: 反転先が無い理由
    assert by_id["data-access"]["reversal_note"] in docset["database.md"]


def test_the_chapter_text_comes_from_the_registry_not_from_the_renderer():
    """定義を 2 箇所に置かない。

    renderer が独自に理由文を作り始めたら、registry を直しても章が変わらなくなる。
    章に出ている理由文が registry の文字列そのものであることを固定する。
    """
    docset = mod.compile_docset(_spec(), _refs())
    registry = _registry()
    for concern in registry["concerns"]:
        cc = concern.get("clause_citation") or {}
        if cc.get("state") != "unavailable":
            continue
        for cat, ids in registry["category_concern_map"].items():
            if concern["concern_id"] in ids:
                assert cc["reason"] in docset[f"{cat}.md"], (
                    f"{cat}.md の {concern['concern_id']} の理由文が registry と不一致"
                )
