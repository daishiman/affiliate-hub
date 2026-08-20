# /// script
# name: test-supply-neutrality
# purpose: proposer ≠ approver の停止条件 (供給の中立形式) と、その条文側の下限を固定する
# inputs:
#   - pytest 実行 (argv なし)
# outputs:
#   - pytest 結果
# contexts: [C]
# network: false
# write-scope: none
# dependencies: []
# ///
"""`supply_neutrality.py` の文法門と、条文側が門を指し続けることの回帰テスト。"""
from __future__ import annotations

import importlib

from completeness_test_support import SKILL_DIR  # noqa: F401  (sys.path へ scripts を載せる副作用)

MOD = importlib.import_module("supply_neutrality")

DELEGATE = (SKILL_DIR / "prompts" / "R2-delegate.md").read_text(encoding="utf-8")


def codes(prompt: str) -> list[str]:
    return [item["code"] for item in MOD.check_prompt(prompt)]


NEUTRAL_SUPPLY = """doc_freshness を担当してほしい。担当軸は形式層と内容鮮度層。
判断に使う所在は下に置く。読み方はこちらからは渡さない。

<SUPPLIED_LOCATORS>
skills/run-system-spec-doc-fetch/prompts/R4-audit-doc-freshness.md#reachability
skills/assign-system-spec-completeness-evaluator/references/aspect-criteria.md
</SUPPLIED_LOCATORS>

<SUPPLIED_INPUTS>
system-spec/fetched-references.json
</SUPPLIED_INPUTS>

応答の最終行を AUDIT_VERDICT にすること。
"""

# **2026-08-20 の実違反の再構成。**来歴段落が述べている供給の形をそのまま prompt に
# 起こしたもの。中立の宣言があり、両論が併記され、分量も対等で、片方にだけ適用の
# 指示が付いている。語の一覧では「緑へ押す」を含まないので素通りするが、文法門は
# 「散文に隣接した参照」として止める。
INCIDENT_2026_08_20_SUPPLY = """緑へ押すことは避けます。両論の条文を併記します。

R4-audit-doc-freshness.md の到達不能条項: 到達不能を名指しで扱っているのはこちらだけです。
aspect-criteria.md の鮮度条項: 一般則としての鮮度要件を述べています。

どちらを governing clause と見るかは auditor の判断に委ねます。
"""

# 塞げていない種類。**足りない例を足す形で運用しない** (実例であって一覧ではない)。
BLIND_SPOT_KIND = "序数・語による間接参照 (path token を含まない適用の指示)"
BLIND_SPOT_EXAMPLES = (
    "1 件目に置いた条文のほうが governing です。",
    "到達不能を名指ししているほうを優先して読んでください。",
)


def test_neutral_supply_passes() -> None:
    assert MOD.check_prompt(NEUTRAL_SUPPLY) == []


def test_incident_2026_08_20_supply_is_stopped() -> None:
    """実際に verdict を動かした供給が、この門では fork へ渡せないことを固定する。"""
    result = codes(INCIDENT_2026_08_20_SUPPLY)
    assert "locator_outside" in result, result
    # 交絡の排除: 止まった理由は「緑」「押す」などの語ではなく、参照の置き場所である。
    neutral_words_only = "緑へ押すことは避けます。どちらが優先かは auditor に委ねます。\n"
    assert MOD.check_prompt(neutral_words_only) == []


def test_prose_cannot_ride_along_inside_the_block() -> None:
    """区画の中に読みを添える形。適用の指示が最後に残れる場所を塞ぐ。"""
    prompt = (
        "<SUPPLIED_LOCATORS>\n"
        "prompts/R4-audit-doc-freshness.md  <- これが governing clause です\n"
        "</SUPPLIED_LOCATORS>\n"
    )
    assert codes(prompt) == ["prose_in_block"]


def test_locator_must_exist_when_repo_root_is_given(tmp_path) -> None:
    (tmp_path / "real.md").write_text("x", encoding="utf-8")
    prompt = "<SUPPLIED_LOCATORS>\nreal.md\nghost.md\n</SUPPLIED_LOCATORS>\n"
    result = MOD.check_prompt(prompt, repo_root=tmp_path)
    assert [item["code"] for item in result] == ["missing_locator"]
    assert "ghost.md" in result[0]["text"]


def test_unbalanced_and_nested_blocks_are_stopped() -> None:
    assert codes("<SUPPLIED_LOCATORS>\na.md\n") == ["unbalanced_block"]
    assert "nested_block" in codes(
        "<SUPPLIED_LOCATORS>\n<SUPPLIED_INPUTS>\na.md\n</SUPPLIED_INPUTS>\n"
    )


def test_blind_spot_is_recorded_as_a_kind() -> None:
    """塞げていない種類を、文章ではなく実行できる事実として残す。

    反転先: locator へ安定 ID を与え、prompt 側で ID を書けない形にできた日に、
    この例を通過側の検査へ移す。**除外語を足す方向では反転させない。**
    """
    assert BLIND_SPOT_KIND
    for example in BLIND_SPOT_EXAMPLES:
        assert MOD.check_prompt(example) == [], example


def test_exit_code_is_the_stop(tmp_path) -> None:
    """止まるのは exit code である (出力の文言ではない)。"""
    neutral = tmp_path / "neutral.md"
    neutral.write_text(NEUTRAL_SUPPLY, encoding="utf-8")
    biased = tmp_path / "biased.md"
    biased.write_text(INCIDENT_2026_08_20_SUPPLY, encoding="utf-8")

    assert MOD.main(["--prompt-file", str(neutral)]) == 0
    assert MOD.main(["--prompt-file", str(biased)]) == 2


# --- 条文側の下限。**上げる方向にしか動かさない。** ---


def test_doctrine_points_at_the_check() -> None:
    """条文が門を指していること。指す先が消えたら門は誰にも走らせられなくなる。"""
    assert "supply_neutrality.py" in DELEGATE
    assert "exit 0" in DELEGATE
    # 止まる対象が明示されていること (fork してはならない / receipt にできない)。
    assert "receipt にできない" in DELEGATE


def test_history_paragraph_is_append_only() -> None:
    """日付つきの観測は書き換えず追記する。消せば赤くなる。"""
    assert "**来歴 (2026-08-20)**" in DELEGATE
    assert "auditor の verdict が反転した" in DELEGATE
    # 追記側 (門を置いた日) も来歴として残す。
    assert "**来歴 (2026-08-21)**" in DELEGATE
