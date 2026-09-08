#!/usr/bin/env python3
# /// script
# name: test-connected-subsection-reaches-carried
# version: 0.1.0
# purpose: 退避済み (`## 章にしか無い記述`) の写しにも --connected-subsection が届くことの受入テスト。
#          退避した瞬間に「章から落とす出口」が閉じる形を塞ぐ。
# inputs:
#   - argv: pytest 収集 (引数なし)
# outputs:
#   - pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: tmp_path のみ
# dependencies: []
# requires-python: ">=3.9"
# ///
"""退避は保全であって固定ではない。出口が閉じるなら、それは保全ではない。"""
from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

from spec_docset_foundation import (  # noqa: E402
    CARRIED_HEADING,
    drop_connected_subblocks,
    write_docset,
)


GENERATED = """---
status: confirmed
---

## 生成される節

本文。
"""


def _existing(carried_body: str) -> str:
    return GENERATED.rstrip("\n") + "\n\n" + CARRIED_HEADING + "\n\n" + carried_body


CARRIED_BODY = """> 以下の 2 件は正本から導けない。正本へ接続するか、不要と確かめて消すこと。

### 外したい小節

外す本文。

#### 外したい小節の子

子の本文。

### 残す小節

残す本文。
"""


def test_a_declared_subblock_is_dropped_from_a_carried_section(tmp_path):
    """退避された写しの中の小節でも、宣言すれば落ちる。"""
    p = tmp_path / "x.md"
    p.write_text(_existing(CARRIED_BODY), encoding="utf-8")

    write_docset(
        {"x.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        connected_subsections=frozenset({"外したい小節", "外したい小節の子"}),
    )
    out = p.read_text(encoding="utf-8")

    assert "外したい小節" not in out
    assert "子の本文" not in out
    assert "### 残す小節" in out
    assert "残す本文。" in out


def test_the_empty_carrier_is_dropped_with_its_preamble(tmp_path):
    """中身が全部正本へ移ったなら、「章にしか無い記述」を名乗る器も残さない。"""
    only_one = "> 以下の 1 件は正本から導けない。\n\n### 外したい小節\n\n外す本文。\n"
    p = tmp_path / "x.md"
    p.write_text(_existing(only_one), encoding="utf-8")

    write_docset(
        {"x.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        connected_subsections=frozenset({"外したい小節"}),
    )
    out = p.read_text(encoding="utf-8")

    assert CARRIED_HEADING not in out
    assert "以下の 1 件" not in out


def test_dropped_lines_are_not_reported_as_residue(tmp_path):
    """正本に同じ内容が在るので、報告は二重化にしかならない。

    **本当に接続の要る行を埋もれさせない**ために、宣言済みの行は
    「compile が保てなかった行」へも出さない。
    """
    only_one = "> 以下の 1 件は正本から導けない。\n\n### 外したい小節\n\n外す本文。\n"
    p = tmp_path / "x.md"
    p.write_text(_existing(only_one), encoding="utf-8")

    losses: list = []
    write_docset(
        {"x.md": GENERATED},
        tmp_path,
        on_handwritten="preserve",
        loss_report=losses,
        connected_subsections=frozenset({"外したい小節"}),
    )
    out = p.read_text(encoding="utf-8")

    assert losses == []
    assert "compile が保てなかった行" not in out


def test_nested_children_are_not_swallowed_without_being_declared():
    """**「親を消したから子も消えたはず」を機械が推測しない。**

    推測すると、宣言していない本文が宣言したことになる。落ちる範囲は
    呼び出し側が名指しした分だけに留める。
    """
    body, dropped = drop_connected_subblocks(CARRIED_BODY, frozenset({"外したい小節"}))
    assert "#### 外したい小節の子" in body
    assert "子の本文。" in body
    assert any("外す本文。" == l for l in dropped)


def test_nothing_is_dropped_when_nothing_is_declared(tmp_path):
    """宣言が無い回は、これまでどおり写しがそのまま残る。"""
    p = tmp_path / "x.md"
    p.write_text(_existing(CARRIED_BODY), encoding="utf-8")

    write_docset({"x.md": GENERATED}, tmp_path, on_handwritten="preserve")
    out = p.read_text(encoding="utf-8")

    assert "### 外したい小節" in out
    assert "### 残す小節" in out
