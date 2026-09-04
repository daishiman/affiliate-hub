"""「宣言せよ」と言う検査に、宣言する道具を伴わせる。

**塞ぐことと、塞がれた側に出口を与えることは別の仕事である。**
`--require-catalog-domain-coverage` はカタログの `in_scope_domains` に「それを数える
カテゴリ行」を要求し、無い場合の逃げ道として `excluded_categories` を案内する。
しかし正本を書ける writer は `apply-spec-transition.py` だけで、そこにこの操作が
無かった。検査だけが在って道具が無いと、**正しい直し方が塞がれたまま
「直せ」と言われ続ける** (`set_qa_source` を足したときと同じ形の欠落)。

**「対象外」は「作らない」ではない。**宣言するのは「このカテゴリ*行*を立てない」で
あって、その領域を実装しないという意味ではない。実測 2026-08-25: `api` は
`in_scope_domains` に在るが matrix に行が無い。API を作らないからではなく、API 契約を
backend カテゴリの質疑で扱っているからである。誤読すると「API 不要」と読める。
だから `reason` を必須にして、どこで数えているのかを書かせる。

この試験群はもう一つ、**私自身の思い込みも留めている**。`excluded_categories` は
schema 上 object (`{category_id: reason}`) だが、検査を書いたとき配列だと思い込んで
いた。正本を確かめずに書いた検査は、確かめずに書いた報告と同じだけ危うい。
"""
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "run-system-spec-elicit" / "scripts"))

from state_transition_common import TransitionError  # noqa: E402
from state_transition_matrix import declare_excluded_category  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "vcm_excl", ROOT / "scripts" / "validate-coverage-matrix.py"
)
vcm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vcm)

SCHEMA = ROOT / "schemas" / "spec-state.schema.json"


def _state(**over):
    state = {"categories": [{"id": "backend", "label": "バックエンド"}]}
    state.update(over)
    return state


def test_the_declaration_lands_as_an_object_keyed_by_category():
    """schema が object と定めている形で書くこと。

    **形を確かめずに書いた欄は、読む側の検査とすれ違う。**
    """
    state = _state()
    declare_excluded_category(state, "api", "API 契約は backend の質疑で扱うため")
    assert state["excluded_categories"] == {"api": "API 契約は backend の質疑で扱うため"}


def test_the_schema_really_says_object():
    """writer が object を書けるのは、schema がそう定めているからである。

    schema が変わったらこの試験が先に落ちて、writer の前提が崩れたと報せる。
    """
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["excluded_categories"]["type"] == "object"


def test_the_gate_accepts_what_the_writer_writes():
    """**書いた形が、検査に読まれること。**ここが噛み合わないと道具は無意味である。

    正本と同じ 8 カテゴリを渡し、唯一未被覆の `api` だけを宣言で塞ぐ。
    writer の出力がそのまま検査を通ることを、実カタログで確かめる。
    """
    catalog = ROOT / "skills" / "run-system-spec-elicit" / "references" / "required-info-catalog.json"
    cat_ids = [
        "ui-ux", "frontend", "backend", "database",
        "auth", "security", "infrastructure", "maintenance-ops",
    ]
    state = {"categories": [{"id": c} for c in cat_ids]}
    assert vcm._validate_catalog_domain_coverage(state, cat_ids, catalog), "api が未被覆のはず"

    declare_excluded_category(state, "api", "API 契約は backend の質疑で扱うため")
    assert vcm._validate_catalog_domain_coverage(state, cat_ids, catalog) == []


def test_a_category_that_has_a_row_cannot_be_declared_excluded():
    """行が在るものを対象外と宣言すると、行と宣言のどちらが正かが決まらない。"""
    with pytest.raises(TransitionError, match="カテゴリ行が在る"):
        declare_excluded_category(_state(), "backend", "理由")


@pytest.mark.parametrize("field,value", [("category", ""), ("reason", "   ")])
def test_both_fields_are_required(field, value):
    """**理由なしの対象外を作らせない。**理由の無い除外は、後から誰にも検算できない。"""
    args = {"category": "api", "reason": "理由"}
    args[field] = value
    with pytest.raises(TransitionError, match="非空文字列必須"):
        declare_excluded_category(_state(), args["category"], args["reason"])


def test_redeclaring_the_same_reason_is_idempotent():
    state = _state(excluded_categories={"api": "同じ理由"})
    declare_excluded_category(state, "api", "同じ理由")
    assert state["excluded_categories"] == {"api": "同じ理由"}


def test_a_different_reason_never_silently_overwrites():
    """黙って書き換えると経緯が消え、「最初からそう宣言していた」ように見える。"""
    state = _state(excluded_categories={"api": "元の理由"})
    with pytest.raises(TransitionError, match="上書きしない"):
        declare_excluded_category(state, "api", "別の理由")


def test_a_malformed_excluded_field_is_refused():
    state = _state(excluded_categories=["api"])
    with pytest.raises(TransitionError, match="object でない"):
        declare_excluded_category(state, "api", "理由")


def test_the_cli_exposes_the_writer():
    """関数が在っても CLI に出ていなければ、正本へは届かない。"""
    cli = (
        ROOT / "skills" / "run-system-spec-elicit" / "scripts" / "apply-spec-transition.py"
    ).read_text(encoding="utf-8")
    assert '"declare-excluded-category"' in cli
    assert "declare_excluded_category(state, args.category, args.reason)" in cli
