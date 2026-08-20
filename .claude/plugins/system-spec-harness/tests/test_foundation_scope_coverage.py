"""scope 被覆検査の単体テスト。

この検査が存在する理由は「逐語一致では塞げなかったから」である。
2026-08-20 実測: 書面 §6 の 37 項目と state の scope 20 項目を前方一致 10 文字で
突き合わせると不一致 14 件、うち本物の消失は 4 件 (誤検出率 71%)。件数一致を
要求すると 24->12 の正当な圧縮が全部違反になる。被覆だけが両方を満たす。

**0 件の findings は「無い」と「探し方が壊れている」の両方から出る。**
そのため緑を主張するテストには必ず対になる陽性対照を置いてある。
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "skills/run-system-spec-elicit/scripts"))

import foundation_provenance as fp  # noqa: E402

ANSWER = "\n".join(
    [
        "## 6.1 含むもの",
        "",
        "* あ",
        "* い",
        "* う",
        "",
        "## 6.2 含まないもの",
        "",
        "* か",
        "* き",
    ]
)


def make_state() -> dict:
    return {"qa_log": [{"id": "qa-foundation-u7", "question": "U7", "answer": ANSWER}]}


def make_foundation() -> dict:
    return {
        "scope": {"in": ["あ・い", "う"], "out": ["か", "き"]},
        "provenance": {
            "scope": {
                "source_qa_id": "qa-foundation-u7",
                "sections": {
                    "in": {
                        "heading": "## 6.1 含むもの",
                        "items": [
                            {"item": "あ・い", "covers": [1, 2]},
                            {"item": "う", "covers": [3]},
                        ],
                    },
                    "out": {
                        "heading": "## 6.2 含まないもの",
                        "items": [
                            {"item": "か", "covers": [1]},
                            {"item": "き", "covers": [2]},
                        ],
                    },
                },
            }
        },
    }


def check(state=None, foundation=None) -> list[str]:
    return fp.validate_foundation_scope_coverage(state or make_state(), foundation or make_foundation())


# --------------------------------------------------------------------------- #
# 通す側: まとめは合法である                                                    #
# --------------------------------------------------------------------------- #
def test_bundling_is_legal():
    """3 項目を 2 項目へまとめた申告は通る。これが逐語一致では通らなかった形。"""
    assert check() == []


def test_denominator_is_not_empty():
    """分母の床。原文が 0 項目なら被覆は自動的に成立し、検査は何も見ない。"""
    enumerated = fp.scope_source_items(make_state())
    assert enumerated is not None
    assert sum(len(items) for items in enumerated.values()) == 5


# --------------------------------------------------------------------------- #
# 落とす側: 消失は名乗らなくても差として出る                                    #
# --------------------------------------------------------------------------- #
def test_lost_item_is_reported_even_though_nothing_declares_it():
    """**消えた項目は自分から名乗り出ない。**残った側が名乗るので差として現れる。"""
    foundation = make_foundation()
    foundation["scope"]["in"] = ["あ・い"]
    foundation["provenance"]["scope"]["sections"]["in"]["items"] = [
        {"item": "あ・い", "covers": [1, 2]}
    ]
    findings = check(foundation=foundation)
    assert len(findings) == 1
    assert "3 番 ('う')" in findings[0]


def test_missing_provenance_is_rejected():
    """陽性対照。修復前の state (provenance なし) がこの形で落ちた。"""
    foundation = make_foundation()
    del foundation["provenance"]
    findings = check(foundation=foundation)
    assert len(findings) == 1
    assert "provenance が無い" in findings[0]


def test_declared_item_absent_from_scope():
    """申告だけ残して実物を消す道を塞ぐ。片方向の突き合わせだと通ってしまう。"""
    foundation = make_foundation()
    foundation["scope"]["in"] = ["あ・い"]
    findings = check(foundation=foundation)
    assert any("被覆申告にあるが scope.in に無い項目" in f for f in findings)


def test_scope_item_without_declaration():
    """実物だけ足して申告しない道を塞ぐ。無申告の項目は出所が分からない。"""
    foundation = make_foundation()
    foundation["scope"]["in"].append("え")
    findings = check(foundation=foundation)
    assert any("scope.in にあるが被覆申告が無い項目: ['え']" in f for f in findings)


def test_double_claim_is_rejected():
    """同じ原文番号を 2 項目が申告すると、被覆件数は足りても実体は 1 件足りない。"""
    foundation = make_foundation()
    foundation["provenance"]["scope"]["sections"]["in"]["items"][1]["covers"] = [1]
    findings = check(foundation=foundation)
    assert any("二重に申告している" in f for f in findings)
    assert any("3 番 ('う')" in f for f in findings)


def test_empty_covers_is_rejected():
    foundation = make_foundation()
    foundation["provenance"]["scope"]["sections"]["in"]["items"][1]["covers"] = []
    findings = check(foundation=foundation)
    assert any("covers が空" in f for f in findings)


def test_covers_out_of_range_is_rejected():
    foundation = make_foundation()
    foundation["provenance"]["scope"]["sections"]["in"]["items"][1]["covers"] = [99]
    findings = check(foundation=foundation)
    assert any("1..3 の範囲外" in f for f in findings)


def test_heading_must_exist_in_the_hash_bound_answer():
    """見出しは sha256 に束縛された原文の見出しでなければならない。

    ここが自由文字列だと、存在しない見出しを申告して分母 0 を作れてしまう。
    """
    foundation = make_foundation()
    foundation["provenance"]["scope"]["sections"]["in"]["heading"] = "## 存在しない見出し"
    findings = check(foundation=foundation)
    assert any("U7 原文の見出しに一致しない" in f for f in findings)


def test_same_heading_for_both_sides_is_rejected():
    """in と out に同じ見出しを申告すれば、片方の区間を丸ごと無検査にできる。"""
    foundation = make_foundation()
    foundation["provenance"]["scope"]["sections"]["out"]["heading"] = "## 6.1 含むもの"
    findings = check(foundation=foundation)
    assert any("in/out で重複" in f for f in findings)


def test_wrong_source_qa_id_is_rejected():
    foundation = make_foundation()
    foundation["provenance"]["scope"]["source_qa_id"] = "qa-foundation-u1"
    findings = check(foundation=foundation)
    assert any("source_qa_id" in f for f in findings)


# --------------------------------------------------------------------------- #
# 空振りの条件を明示する                                                        #
# --------------------------------------------------------------------------- #
def test_no_enumeration_means_no_coverage_requirement():
    """原文が散文なら被覆すべき対象が無い。既存 fixture がこの経路を通る。"""
    state = {"qa_log": [{"id": "qa-foundation-u7", "answer": "請求管理を対象とし給与計算を対象外とする"}]}
    assert fp.scope_source_items(state) is None
    assert fp.validate_foundation_scope_coverage(state, {"scope": {"in": ["請求管理"], "out": []}}) == []


def test_na_scope_is_skipped():
    foundation = {"scope": {"status": "not_applicable", "reason": "単一画面のため"}}
    assert check(foundation=foundation) == []


# --------------------------------------------------------------------------- #
# 出典が付いていない欄の計数 (門ではなく物差し)                                  #
# --------------------------------------------------------------------------- #
def test_source_gaps_counts_uncovered_scope_items():
    foundation = make_foundation()
    foundation["scope"]["in"].append("え")
    assert "scope.in[2]" in fp.foundation_source_gaps(foundation)


def test_source_gaps_respects_field_sources():
    foundation = make_foundation()
    foundation["essential_purpose"] = "目的"
    assert "essential_purpose" in fp.foundation_source_gaps(foundation)
    foundation["provenance"]["field_sources"] = [
        {"field": "essential_purpose", "path": "docs/x.md", "section": "§1", "quote": "目的"}
    ]
    assert "essential_purpose" not in fp.foundation_source_gaps(foundation)


def test_source_gaps_ignores_explicit_na():
    """値が無い欄に出典は付けられない。N/A を gap に数えると上限が意味を失う。"""
    foundation = make_foundation()
    foundation["constraints"] = {"status": "not_applicable", "reason": "制約なし"}
    assert not [g for g in fp.foundation_source_gaps(foundation) if g.startswith("constraints")]


# --------------------------------------------------------------------------- #
# 書き手経路 (set_foundation) から実際に呼ばれていること                         #
# --------------------------------------------------------------------------- #
def test_writer_rejects_confirm_without_coverage():
    """検査を書いても書き手が呼んでいなければ、門は存在しない。"""
    import state_transition_common as stc
    import state_transition_foundation as stf

    # 出典検査 (U1-U9) が先に走るので、そこを通る state を用意しないと
    # 「別の理由で raise した」を被覆検査の成果と読み違える。
    state = {
        "approval_log": [{"id": "appr-1", "note": "合意"}],
        "requirements_foundation": {},
        "qa_log": [
            {
                "id": f"qa-foundation-u{n}",
                "question": f"利用者との対話で U{n} は何か",
                "answer": ANSWER if n == 7 else f"U{n} の答え",
                "source": {"kind": "user-dialogue"},
            }
            for n in range(1, 10)
        ],
    }
    assert fp.validate_foundation_source_indexes(state) == []
    foundation = {
        "essential_purpose": "目的",
        "background": "背景",
        "goals": [{"id": "G1", "text": "ゴール"}],
        "objectives": [{"id": "O1", "text": "目標", "measure": "指標"}],
        "success_criteria": ["基準"],
        "stakeholders": ["利用者"],
        "scope": {"in": ["あ・い", "う"], "out": ["か", "き"]},
        "constraints": ["制約"],
        "concrete_intents": [{"id": "I1", "text": "やること", "serves": ["G1"]}],
        "confirmed": True,
        "approval_ref": "appr-1",
    }
    with pytest.raises(stc.TransitionError) as excinfo:
        stf.set_foundation(copy.deepcopy(state), copy.deepcopy(foundation))
    assert "provenance が無い" in str(excinfo.value)

    # 対になる緑: 被覆申告を足せば同じ foundation が通る。
    # これが無いと「何をしても落ちる state」を作っただけかもしれない。
    with_coverage = copy.deepcopy(foundation)
    with_coverage["provenance"] = make_foundation()["provenance"]
    passing = copy.deepcopy(state)
    stf.set_foundation(passing, with_coverage)
    assert passing["requirements_foundation"]["confirmed"] is True


def test_provenance_is_an_accepted_foundation_key():
    """FOUNDATION_KEYS に無いキーは set_foundation が未知キーとして弾く。"""
    import state_transition_common as stc

    assert "provenance" in stc.FOUNDATION_KEYS
    assert "provenance" not in stc.FOUNDATION_U_KEYS
