# /// script
# name: test-contract-prose-version-drift
# version: 0.1.0
# purpose: 契約 md の散文が宣言する schema 版と、コードの定数を機械で突き合わせる pytest。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""**散文の版と定数を突き合わせる書き手。**居なかったので作った。

`CURRENT_STATE_SCHEMA_VERSION` は今日 `1.2` で、正本 `system-spec/spec-state.json`
の `schema_version` も `1.2` である。一致しているのは**一致を要求する門が在るから**
(`test_state_schema_version_gate.py`)。

ところが同じ版を**散文でも宣言している**場所がある——`spec-state-contract.md` は
`"schema_version": "1.1"` と書く。**散文だけが 1.1 に取り残されている。**

これは値の誤りではなく**書き手の欠落**だった。散文の版を定数へ追随させる経路も、
ずれを検出する経路も、**1 本も無かった**。`tests/architecture/schema-version-prose-drift.test.ts`
がその「0 本」を②の形で固定していた。**このファイルがその 1 本目である。**

── なぜ散文を `1.2` へ書き換えて済ませないか ──────────────────────

散文は数字だけでなく「1.1 が何を要求するか」という**段落ごと**版に結び付いている。
数字だけ `1.2` へ置き換えると、1.1→1.2 で境界が変わっていないという**確かめていない
主張**を書き込むことになる。**いま在る誤りを、より見えにくい誤りへ置き換えるだけ**に
なる。だから直さず、**ずれを機械で見張る側**を作る。

── 向き ───────────────────────────────────────────────

②である。「散文が 1.1 のまま取り残されている」ことを固定し、**誰かが散文を版へ
追随させた日に赤くなる**。赤くなったときにすべきことはこの検査を消すことではなく、
下の⑤へ進むことである。

**⑤ 反転先**: 散文が定数へ追随した日、`_PINNED_PROSE` と `_PINNED_CONSTANT` の
対比を消さず、「散文が宣言する版は定数と**一致する**」へ反転させる。追随したものが
後で再びずれる道は、追随する前から在る (版を上げる人が md を直し忘れる)。
あわせて `schema-version-prose-drift.test.ts` の `expect(prose).not.toContain(constant)`
も `toContain` へ反転させる。**片方だけ反転させると、もう片方が古い前提の門として残る。**
"""
from __future__ import annotations

import json
import re
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_MD = (
    PLUGIN_ROOT
    / "skills"
    / "run-system-spec-elicit"
    / "references"
    / "spec-state-contract.md"
)
# 版の正本は 2 箇所在る。**一致を要求する門は無い** (版を上げる人が片方だけ直せる)
# ので、ここで併せて見る。
CONSTANT_SOURCES = (
    PLUGIN_ROOT / "scripts" / "validate-coverage-matrix.py",
    PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts" / "state_transition_matrix.py",
)
CONSTANT_NAME = "CURRENT_STATE_SCHEMA_VERSION"

_DEFINITION = re.compile(rf'^{CONSTANT_NAME}\s*=\s*"([0-9]+\.[0-9]+)"', re.M)
_PROSE = re.compile(r'schema_version[`"]*\s*:\s*[`"]*([0-9]+\.[0-9]+)')

# 2026-08-21 実測 (`grep -n 'schema_version[`"]*\s*:\s*[`"]*[0-9]' spec-state-contract.md`)。
# **この集合に定数が入っていないことが、このファイルが固定している穴である。**
#
# 2 件在るのは取り残しが 2 つ在るからではない:
#   - `1.1` = この契約が**宣言している**版 (L17 の例示 JSON、L270 の「新規 state は」)
#   - `1.0` = L270 の「旧 `schema_version: "1.0"` state は読み取りだけ可能」——
#     **意図的な legacy 参照**であって、取り残しではない
#
# 絞り込んで `1.0` を落とさない。落とすと「legacy 参照の顔をした新しいずれ」が
# 増えた日に気づけなくなる。**生の集合ごと固定して、増減した日に赤くする。**
_PINNED_PROSE = frozenset({"1.0", "1.1"})
_PINNED_CONSTANT = "1.2"


def _constant_versions() -> dict[str, str]:
    found = {}
    for path in CONSTANT_SOURCES:
        hit = _DEFINITION.search(path.read_text(encoding="utf-8"))
        if hit:
            found[path.name] = hit.group(1)
    return found


def _prose_versions() -> list[str]:
    return _PROSE.findall(CONTRACT_MD.read_text(encoding="utf-8"))


def test_the_reader_actually_finds_things() -> None:
    """**餌。**見つける側が動いていることを示す。

    下の 3 つは、正規表現が何にも当たらない日にも「ずれている」と同じ緑を出せる。
    実在する語が拾えること、実在しない語が拾えないことを先に見る。
    """
    contract = CONTRACT_MD.read_text(encoding="utf-8")
    assert "## hearing_progress の意味論 (SSOT)" in contract
    assert "schema_version は潮汐で決まる" not in contract
    assert _PROSE.findall('"schema_version": "9.9"') == ["9.9"]
    assert _PROSE.findall("版のことは書いていない") == []
    assert _DEFINITION.findall(f'{CONSTANT_NAME} = "9.9"') == ["9.9"]


def test_the_two_constant_definitions_agree() -> None:
    """版の正本は複数在ってよいが、値は 1 種類でなければならない。

    片方だけ上げられると、どちらが正本か言えなくなる。散文ずれと同じ形が
    コードの中にも在るので、散文を見る前にここを閉める。
    """
    versions = _constant_versions()
    assert len(versions) >= 1, f"定数の定義が 1 つも見つからない: {CONSTANT_SOURCES}"
    assert len(set(versions.values())) == 1, f"版の正本が食い違っている: {versions}"


def test_the_prose_still_lags_the_constant() -> None:
    """**この検査の本体。**散文が定数から取り残されていること。

    散文を版へ追随させた日に赤くなる。そのとき消さず、docstring の⑤へ進む。
    """
    prose = _prose_versions()
    versions = _constant_versions()
    assert prose, "散文が版を 1 件も宣言していない — 以下の比較は測れていない"
    assert versions, "定数が読めない — 以下の比較は測れていない"

    constant = next(iter(set(versions.values())))
    assert constant == _PINNED_CONSTANT, (
        f"定数が {_PINNED_CONSTANT} から {constant} へ動きました。散文 ({sorted(set(prose))}) を"
        " どうするかを決めてから、この検査の pin を更新してください"
    )
    assert set(prose) == set(_PINNED_PROSE), (
        f"散文の版が {sorted(set(prose))} へ変わりました (実測時 {sorted(_PINNED_PROSE)}、"
        f"定数は {constant})。増えたなら新しいずれが入っていないか、減ったなら legacy 参照を"
        " 消していないかを見てから、この検査の pin を更新してください"
    )
    assert constant not in prose, (
        "散文が定数へ追随しました。⑤に従って反転させてください"
        " (あわせて schema-version-prose-drift.test.ts の not.toContain も)"
    )


def test_the_drift_is_confined_to_the_contract_prose() -> None:
    """対照: 門の在る経路では、ずれていないこと。

    「散文がずれている」は、**全部がずれている**ときにも同じ姿になる。門の在る側が
    そろっていることを同じ便で見て、これが散文固有の問題だと言えるようにする。
    """
    state = PLUGIN_ROOT.parents[2] / "system-spec" / "spec-state.json"
    # skip しない。**条件付き skip は、正本が消えた日に緑を出す穴になる。**
    # 正本の位置は契約書「正本位置」節で 1 経路に決まっているので、無いこと自体が異常である。
    assert state.exists(), f"正本が無い: {state} (spec-state-contract.md「正本位置」節)"

    declared = json.loads(state.read_text(encoding="utf-8"))["schema_version"]
    assert declared == next(iter(set(_constant_versions().values())))
