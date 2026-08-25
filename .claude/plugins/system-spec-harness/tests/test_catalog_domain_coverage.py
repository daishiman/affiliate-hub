"""カタログの必須情報に「それを数える場所」が在ることを要求する。

**照合が片側からしか行われていなかった。**`_validate_confirmed_required_info` は
`blocking.get(cat_id, set())` と matrix の側からカタログを引く。したがって
**カタログに在って matrix に行が無い domain の item は、一度も参照されずに消える。**
未収集 0・全セル確定でゲートが緑になっても、その domain の必須情報は誰にも
数えられていない。

`--require-grounded-design-applications` が塞いだのは「セル側だけを見ていると集めた
設計適用が宙に浮く」穴だった。これはその**逆側**である。集めたものが浮くのではなく、
集めるべきものが最初から視野に入らない。

実測 2026-08-25: `api` が `in_scope_domains` に在り `api-contract` (degrade) を持つが、
matrix に `api` 行は無く `excluded_categories` にも無い。今回の item が degrade
だったのは運であって設計ではない。**block の item が同じ位置に置かれたら黙って消える。**

禁じるのではなく名乗らせる。行を作る / 対象外と宣言する / 非該当と宣言する — どれでも
よく、**選ばなかったことだけを違反とする。**
"""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "vcm", ROOT / "scripts" / "validate-coverage-matrix.py"
)
vcm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vcm)


def _catalog(tmp_path: Path, in_scope, na=None, items=None) -> Path:
    path = tmp_path / "catalog.json"
    path.write_text(
        json.dumps(
            {
                "in_scope_domains": in_scope,
                "na_domains": na or [],
                "items": items
                or [{"item_id": "api-contract", "domain": "api", "missing_effect": "degrade"}],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path


def test_a_domain_with_a_row_is_accounted_for(tmp_path):
    cat = _catalog(tmp_path, ["api"])
    assert vcm._validate_catalog_domain_coverage({}, ["api"], cat) == []


def test_a_domain_with_no_row_anywhere_is_a_violation(tmp_path):
    """**行も宣言も無い domain は、必須情報の落とし穴である。**"""
    cat = _catalog(tmp_path, ["api"])
    found = vcm._validate_catalog_domain_coverage({}, ["backend"], cat)
    assert len(found) == 1
    assert "'api'" in found[0]
    assert "api-contract" in found[0], "どの必須情報が消えるのかを名指しすること"


def test_declaring_the_domain_out_of_scope_settles_it(tmp_path):
    cat = _catalog(tmp_path, ["api"])
    state = {"excluded_categories": [{"id": "api", "reason": "backend に含めて扱う"}]}
    assert vcm._validate_catalog_domain_coverage(state, ["backend"], cat) == []


def test_a_bare_string_exclusion_also_settles_it(tmp_path):
    """`excluded_categories` は dict の配列とも文字列の配列とも書かれうる。

    表記の違いで違反が復活すると、宣言したのに叱られる。
    """
    cat = _catalog(tmp_path, ["api"])
    assert vcm._validate_catalog_domain_coverage({"excluded_categories": ["api"]}, ["backend"], cat) == []


def test_declaring_the_domain_not_applicable_settles_it(tmp_path):
    cat = _catalog(tmp_path, ["api"], na=["api"])
    assert vcm._validate_catalog_domain_coverage({}, ["backend"], cat) == []


def test_an_unreadable_catalog_fails_closed(tmp_path):
    """**読めないカタログで黙って通さない。**空を返すと違反 0 件に見える。"""
    found = vcm._validate_catalog_domain_coverage({}, ["backend"], tmp_path / "nope.json")
    assert len(found) == 1
    assert "参照できない" in found[0]


def test_a_malformed_in_scope_list_fails_closed(tmp_path):
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps({"in_scope_domains": "api", "items": []}), encoding="utf-8")
    found = vcm._validate_catalog_domain_coverage({}, ["backend"], path)
    assert len(found) == 1
    assert "配列でない" in found[0]


def test_every_unaccounted_domain_is_reported(tmp_path):
    """1 件見つけて止めない。**一度に全部見せないと、直しは往復になる。**"""
    cat = _catalog(
        tmp_path,
        ["api", "search"],
        items=[
            {"item_id": "api-contract", "domain": "api", "missing_effect": "degrade"},
            {"item_id": "index-strategy", "domain": "search", "missing_effect": "block"},
        ],
    )
    found = vcm._validate_catalog_domain_coverage({}, ["backend"], cat)
    assert len(found) == 2


def test_the_flag_requires_the_final_mode():
    """カテゴリ軸が固まる前は、行が無いことを未初期化と区別できない。"""
    src = (ROOT / "scripts" / "validate-coverage-matrix.py").read_text(encoding="utf-8")
    assert "--require-catalog-domain-coverage は --require-complete と併用する" in src
