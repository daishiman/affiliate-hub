#!/usr/bin/env python3
# /// script
# name: spec-input-inventory
# version: 0.1.0
# purpose: C05 が評価した入力ファイル群の件数・sha256・mtime を数え、指紋を求める
# inputs:
#   - repo root (既定は cwd)
# outputs:
#   - dict: {file_count, sha256, files: [{path, sha256, mtime}]}
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""評価の入力インベントリ。

レポートが「どの版の仕様書に対する判定か」を自分で名乗れるようにする。
これが無いあいだ、評価したあとに仕様書を書き換えても PASS はそのまま残り、
**古い PASS は古く見えない**。

--- なぜ mtime を指紋に入れないか ---

gap 6 は件数・sha256・**mtime** の記録を求めている。記録はする。
しかし **mtime を指紋の材料には使わない**。

mtime は中身が 1 バイトも変わらなくても動く (clone、checkout、touch、
CI の作業コピー作成)。指紋へ混ぜると、誰も何も書き換えていないのに
毎回 STALE になる。毎回赤い門は「またこれか」と扱われて読まれなくなり、
**本物の書き換えを報せる力を失う**。赤の意味を保つために、
mtime は人が読むための情報として per-file に残すだけにする。

--- なぜ node 側と同じ定義でなければならないか ---

`scripts/spec-freshness.mjs` が同じ指紋を独立に計算して突き合わせる。
定義が少しでもずれると、**中身が同じなのに STALE** になる。
その赤は「仕様書が変わった」と読めてしまい、実際には何も変わっていない。
つまり **ずれは、嘘の警報として現れる**。言語が違って実装は共有できないので、
同じツリーで両方に計算させて一致を主張する検査を置く
(`tests/test_spec_input_inventory.py`)。
"""
from __future__ import annotations

import hashlib
from pathlib import Path

#: 入力として数える場所。増やせば指紋は必ず変わる (それでよい)。
#: `scripts/spec-freshness.mjs` の INPUT_DIRS と同じでなければならない。
INPUT_DIRS = ("docs/spec", "system-spec")
#: 上記の下で拾う拡張子。node 側 INPUT_EXTENSIONS と同じ。
INPUT_EXTENSIONS = (".md",)
#: 拡張子では拾えないが入力である単票。node 側 INPUT_FILES と同じ。
INPUT_FILES = ("system-spec/spec-state.json",)


def is_input(relative: str) -> bool:
    """その相対 path が入力として数えられるか。

    ツリーを歩く側 (`_iter_files`) と、ツリーを**作る**側 (受入 fixture) が
    同じ判定を使うための口。判定を写すと、fixture だけが古い規則で数える形で
    ずれ、しかも fixture は自分の指紋と一致するので緑のまま気づけない。
    """
    posix = Path(relative).as_posix()
    if posix in INPUT_FILES:
        return True
    if not any(posix.endswith(ext) for ext in INPUT_EXTENSIONS):
        return False
    return any(posix == d or posix.startswith(f"{d}/") for d in INPUT_DIRS)


def fold(entries) -> str:
    """`[{path, sha256}, ...]` を指紋 1 個へ畳む。**mtime は入らない。**

    畳み方の定義はここ 1 箇所だけに置く。写した先が 1 つでもあると、
    その写しが古びたときに「中身は同じなのに STALE」が出る。
    """
    ordered = sorted(entries, key=lambda entry: entry["path"])
    return hashlib.sha256(
        "\n".join(f"{entry['path']}:{entry['sha256']}" for entry in ordered).encode("utf-8")
    ).hexdigest()


def _iter_files(root: Path) -> list[str]:
    found: list[str] = []
    for directory in INPUT_DIRS:
        base = root / directory
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            # node 側は `name.endsWith(ext)` で判定する。`Path.suffix` だと
            # `.md` という名前のファイルで結果が割れる (suffix は空文字になる)。
            # 珍しい名前だが、割れた瞬間に「中身は同じなのに STALE」が出る。
            if path.is_file() and any(path.name.endswith(ext) for ext in INPUT_EXTENSIONS):
                found.append(path.relative_to(root).as_posix())
    for relative in INPUT_FILES:
        if (root / relative).is_file():
            found.append(relative)
    # 並べ替えてから畳む。読む順で指紋が変わると、中身が同じでも STALE になる。
    return sorted(set(found))


def build_inventory(root: Path | str | None = None) -> dict:
    """入力インベントリと指紋を返す。

    `sha256` は path と各ファイルの sha256 だけから求める。**mtime は入らない。**
    """
    base = Path(root) if root is not None else Path.cwd()
    base = base.resolve()
    entries = []
    for relative in _iter_files(base):
        raw = (base / relative).read_bytes()
        entries.append(
            {
                "path": relative,
                "sha256": hashlib.sha256(raw).hexdigest(),
                # 情報として残すだけ。上の docstring の理由で指紋には混ぜない。
                "mtime": int((base / relative).stat().st_mtime),
            }
        )
    return {"file_count": len(entries), "sha256": fold(entries), "files": entries}


def combined_digest(root: Path | str | None = None) -> str:
    """指紋だけを返す短縮口。"""
    return build_inventory(root)["sha256"]
