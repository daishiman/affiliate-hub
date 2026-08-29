#!/usr/bin/env python3
# /// script
# name: test-compile-heading-demotion
# version: 0.1.0
# purpose: qa_log[].answer が持つ見出しが章の階層を乗っ取らないこと、押し下げが逐語性を壊さないこと、押し下げたことが章に残ることを固定する pytest。
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
"""**回答の中の見出しが、章の節に化けない。**

**何が起きていたか (2026-08-25 実測)**

`qa-frontend-web-seo-ai-search-v2` の `answer` は、利用者回答のあとに
`## 調査結果 (2026-08-24、…)` と `## frontend 章への反映方針` を含む。
compile はこの `answer` を逐語で章へ流し込むため、**1 質疑の回答の一部が
章直下 (h2) の節として立ち上がった**。frontend 章と ui-ux 章では、質疑録と
設計知識の 2 経路から同じ `answer` が描画されるので、同名の h2 が各 2 回ずつ
現れた。読む側には章の節に見え、どの質疑に属する主張なのかが消える。

**なぜ「消す」でも「拒む」でもないか**

`answer` は正本であり、compile は逐語で描く。見出し記法を消せば逐語性が崩れ、
見出しを含む回答を拒めば、正当な回答が章へ載らなくなる。壊れているのは
文字ではなく**置かれた深さ**だけなので、`#` の本数だけを一律に足して
埋め込み先より深くする。見出し同士の相対関係は保たれ、文字は 1 つも変わらない。

`seal_code_fences` と同じ立場である。閉じていないフェンスが章の残りを飲み込む
のと同様、浅すぎる見出しは章の階層を乗っ取る。どちらも正本側の修正までの
防波堤であり、手を入れたことは章に注記として残す。

**向き**: 達成済みの下限の見張り。押し下げが外れた日、逐語性が崩れた日、
または注記が消えた日に赤くなる。
"""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = SKILL_DIR.parents[1]
LIB_DIR = PLUGIN_ROOT / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

FIXTURES = SKILL_DIR / "fixtures"


def _load_mod():
    path = SKILL_DIR / "scripts" / "compile-spec-doc.py"
    spec = importlib.util.spec_from_file_location("compile_spec_doc_hd", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_mod()
demote_headings = mod.demote_headings

ANSWER_WITH_HEADINGS = "\n".join(
    [
        "利用者本人の回答を逐語主旨で記録する。",
        "## 調査結果",
        "- 一次情報: 追加の技術要件は無い。",
        "### 内訳",
        "- 業者知見は推定値扱い。",
        "## 章への反映方針",
        "- SSR/ISR で本文を HTML に含める。",
    ]
)


def _headings(text: str) -> list[str]:
    return [line for line in text.split("\n") if line.startswith("#")]


# ── 押し下げの本体 ────────────────────────────────────────────────────
def test_headings_are_pushed_below_the_embedding_point() -> None:
    """**この検査の本体。**埋め込み先が h3 なら、回答の見出しは h4 より浅くならない。"""
    out, demoted, flattened = demote_headings(ANSWER_WITH_HEADINGS, 4)

    assert demoted is True
    assert flattened is False
    levels = [len(h) - len(h.lstrip("#")) for h in _headings(out)]
    assert min(levels) >= 4


def test_the_relative_depth_between_headings_is_kept() -> None:
    """一律に足すので、`## → ###` の親子関係は `#### → #####` として残る。"""
    before = [len(h) - len(h.lstrip("#")) for h in _headings(ANSWER_WITH_HEADINGS)]
    out, _, _ = demote_headings(ANSWER_WITH_HEADINGS, 4)
    after = [len(h) - len(h.lstrip("#")) for h in _headings(out)]

    assert [x - before[0] for x in before] == [x - after[0] for x in after]


def test_no_character_of_the_text_is_changed() -> None:
    """**逐語性の担保。**変わってよいのは `#` の本数だけである。"""
    out, _, _ = demote_headings(ANSWER_WITH_HEADINGS, 4)

    assert [h.lstrip("#") for h in _headings(out)] == [
        h.lstrip("#") for h in _headings(ANSWER_WITH_HEADINGS)
    ]
    assert [l for l in out.split("\n") if not l.startswith("#")] == [
        l for l in ANSWER_WITH_HEADINGS.split("\n") if not l.startswith("#")
    ]


def test_text_without_headings_is_untouched() -> None:
    """見出しが無ければ何もしない。"""
    plain = "利用者回答。\n- 箇条書き\n通常の本文。"
    out, demoted, flattened = demote_headings(plain, 4)

    assert (out, demoted, flattened) == (plain, False, False)


def test_already_deep_enough_headings_are_untouched() -> None:
    """**空振りで章を書き換えない。**すでに深いものを更に押し下げる理由は無い。"""
    deep = "本文。\n##### すでに深い節\n- 中身"
    out, demoted, flattened = demote_headings(deep, 4)

    assert (out, demoted, flattened) == (deep, False, False)


def test_hashes_inside_a_code_fence_are_not_headings() -> None:
    """フェンスの中の `#` はコメントであって見出しではない。触れば内容が壊れる。"""
    fenced = "\n".join(["## 節", "```sh", "# これはコメント", "echo hi", "```", "## 節2"])
    out, demoted, _ = demote_headings(fenced, 4)

    assert demoted is True
    assert "# これはコメント" in out.split("\n")
    assert out.split("\n")[0].startswith("#### ")


def test_hitting_the_markdown_ceiling_is_reported_not_hidden() -> None:
    """**潰れたことを黙らない。**h6 が上限なので、深い階層は差が潰れる。

    潰すこと自体は Markdown の制約で避けられない。避けられるのは、
    潰れたのに何事も無かったように章を出すことだけである。
    """
    out, demoted, flattened = demote_headings("## 浅い\n###### 深い", 6)

    assert demoted is True
    assert flattened is True
    assert all(len(h) - len(h.lstrip("#")) <= 6 for h in _headings(out))


# ── 章として出したときに乗っ取らないこと ──────────────────────────────
def _compiled_chapter_with(answer: str) -> str:
    """fixture の確定質疑の answer を差し替えて 1 章を組み立てる。"""
    spec = json.loads((FIXTURES / "spec-state.json").read_text(encoding="utf-8"))
    refs = json.loads((FIXTURES / "fetched-references.json").read_text(encoding="utf-8"))
    cat = spec["categories"][0]["id"]
    ref = spec["matrix"][cat]["web"]["qa_ref"]
    for entry in spec["qa_log"]:
        if entry.get("id") == ref:
            entry["answer"] = answer
            break
    else:  # pragma: no cover - fixture が壊れたときだけ通る
        raise AssertionError(f"fixture の qa_log に {ref} が無い")
    docset = mod.compile_docset(spec, copy.deepcopy(refs))
    return docset[f"{cat}.md"]


def test_the_answer_does_not_create_a_chapter_level_section() -> None:
    """**実測の再現。**回答の `## 調査結果` が章直下の節として立ち上がらない。"""
    chapter = _compiled_chapter_with(ANSWER_WITH_HEADINGS)

    assert "## 調査結果" not in chapter.split("\n")
    assert "## 章への反映方針" not in chapter.split("\n")
    assert "#### 調査結果" in chapter.split("\n")


def test_the_demotion_is_recorded_in_the_chapter() -> None:
    """**足したことを隠さない。**押し下げたなら、そう書いてある。"""
    chapter = _compiled_chapter_with(ANSWER_WITH_HEADINGS)

    assert "押し下げた" in chapter
    assert "文字は変えていない" in chapter


def test_a_plain_answer_leaves_no_note_behind() -> None:
    """**注記が儀式にならない。**何もしていないなら、何も書かない。"""
    chapter = _compiled_chapter_with("見出しを含まない普通の回答。")

    assert "押し下げた" not in chapter
