"""見出し 1 行だけの引用を、封の側と検査の側の両方で止める。

**なぜこの検査が要るか。**封 (`seal-foundation-sources`) は「引用が本文に literal で
在ること」を確かめる。見出しは必ず逐語で本文に在るので、見出しを貼れば無条件で通る。
通るのに、見出しは何も主張していない — `## 30.8 追跡可能性` は追跡可能性という語を
置くだけで、何が追跡できるとも言っていない。**支えになり得ないものが、支えとして
封をされる。**

止める場所を 2 つ置く理由: writer だけに置くと、穴が開いていたあいだに入った封は
誰にも見つからないまま残る。検査だけに置くと、次の封がまた同じ穴から入る。
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "skills" / "run-system-spec-elicit" / "scripts"))

from coverage_foundation import _heading_only_quotes  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402
from state_transition_foundation import (  # noqa: E402
    _quote_asserts_nothing,
    seal_foundation_sources,
)


@pytest.mark.parametrize("quote", ["# 30. 受け入れ条件", "## 2.2 読者に対する価値", "###### 深い見出し", "  ## 前後に空白  "])
def test_a_bare_heading_asserts_nothing(quote):
    assert _quote_asserts_nothing(quote) is True


@pytest.mark.parametrize(
    "quote",
    [
        "次の経路を双方向に追跡できる。",
        "## 30.1 URL登録\n\n* アフィリエイトURLを元の状態で保存できる",
        "* 自分に合う商品か判断できる",
        "#タグのような見出しでない行",
    ],
)
def test_a_quote_with_content_is_allowed(quote):
    """見出し + その節の中身は、節がその形で書かれていることを実際に示す。"""
    assert _quote_asserts_nothing(quote) is False


def _state_with_quote(tmp_path: Path, quote: str) -> dict:
    doc = tmp_path / "spec.md"
    doc.write_text("# 30. 受け入れ条件\n\n* 条件がある\n", encoding="utf-8")
    return {
        "requirements_foundation": {
            "provenance": {
                "field_sources": [
                    {
                        "field": "success_criteria[0]",
                        "kind": "written-requirements",
                        "path": str(doc),
                        "section": "§30",
                        "quote": quote,
                    }
                ]
            }
        },
        "qa_log": [],
    }


def test_sealing_a_heading_only_quote_is_refused(tmp_path):
    state = _state_with_quote(tmp_path, "# 30. 受け入れ条件")
    with pytest.raises(TransitionError, match="見出し 1 行だけ"):
        seal_foundation_sources(state)


def test_sealing_a_substantive_quote_succeeds(tmp_path):
    state = _state_with_quote(tmp_path, "* 条件がある")
    assert seal_foundation_sources(state)["sealed"] == 1


def test_the_refusal_survives_the_literal_presence_check(tmp_path):
    """見出しは本文に literal で在る。**在ることは支えることではない。**"""
    state = _state_with_quote(tmp_path, "# 30. 受け入れ条件")
    doc_text = Path(state["requirements_foundation"]["provenance"]["field_sources"][0]["path"]).read_text(
        encoding="utf-8"
    )
    assert "# 30. 受け入れ条件" in doc_text  # literal 検査は通る
    with pytest.raises(TransitionError):
        seal_foundation_sources(state)


def test_the_gate_finds_already_sealed_heading_only_quotes():
    """穴が開いていたあいだに入った封を、検査の側が見つける。"""
    rf = {
        "provenance": {
            "field_sources": [
                {"field": "stakeholders[0]", "kind": "written-requirements", "quote": "## 2.2 読者に対する価値"},
                {"field": "goals[0]", "kind": "written-requirements", "quote": "一つのURLを起点に統合する。"},
            ]
        }
    }
    found = _heading_only_quotes(rf)
    assert len(found) == 1
    assert "stakeholders[0]" in found[0]


def test_the_gate_ignores_dialogue_sources():
    """対話由来には quote が無い。文書向けの検査を持ち込まない。"""
    rf = {"provenance": {"field_sources": [{"field": "scope", "kind": "user-dialogue", "qa_id": "qa-1"}]}}
    assert _heading_only_quotes(rf) == []


def test_the_gate_is_quiet_when_there_is_no_provenance():
    assert _heading_only_quotes({}) == []


def test_the_canonical_has_no_heading_only_quotes_left():
    """正本そのものを検査対象にする。**直したことを、直したと言うだけにしない。**"""
    import json

    spec = json.loads(
        (ROOT.parents[2] / "system-spec" / "spec-state.json").read_text(encoding="utf-8")
    )
    assert _heading_only_quotes(spec["requirements_foundation"]) == []
