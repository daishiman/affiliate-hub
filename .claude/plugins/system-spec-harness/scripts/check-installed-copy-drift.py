#!/usr/bin/env python3
"""走っている複製が、repo の複製と同じかを見る。

**直したものが走っていないと、直した本人にも分からない。**

2026-08-25 の実測でこれが起きていた。`guard-confirmed-chapter-overwrite.py` の
読み取り誤爆を repo 側で直し、その試験 (`test_guard_reads_are_not_writes.py`) も
緑だったのに、**実行中の hook は同じコマンドを遮断し続けた**。
repo の複製 (allow) と install 済み複製 8 つ (全て block) を同じ入力で突き合わせて、
走っているのが repo ではないことが分かった。install 済みは 0.1.11 (2026-08-21 更新)
で、repo とは 262 箇所ちがう。**それ以降の harness の修正は、すべて runtime では
効いていなかった。**

似た事故は既に 2 度起きている (catalog f1caabbd… と e8e9e1308… の名前衝突、
`record-audit-fork.py` を持たない複製が勝って audit-fork-ledger.jsonl が
1 行も生まれなかった件)。**同じ事故が 3 度起きるなら、それは事故ではなく設計である。**

判定は 3 つに分ける。ここでも「確かめられなかった」を PASS とも FAIL とも呼ばない:

  exit 0  一致       — 走っている複製は repo と同じ
  exit 1  乖離       — 直しても効かない状態。宛先は plugin の入れ直しである
  exit 2  判定不能   — install 記録が無い (CI など)。**緑ではない**

比較するのは**振る舞いを決めるファイルだけ**である。`__pycache__` や試験の
fixture まで数えると、意味の無い差分で赤が埋まって本物が見えなくなる。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_NAME = "system-spec-harness"
INSTALL_MANIFEST = Path.home() / ".claude" / "plugins" / "installed_plugins.json"

#: 振る舞いを決める場所。ここに無いものの差分は runtime の判断を変えない。
BEHAVIOUR_DIRS = ("hooks", "scripts", "lib", "agents", "commands", "schemas", "skills")
BEHAVIOUR_SUFFIXES = (".py", ".json", ".md", ".yaml", ".yml")
#: 生成物・試験資材。差分が出ても runtime の判断は変わらない。
IGNORED_PARTS = ("__pycache__", ".pytest_cache", "tests", "fixtures", "eval")


def _behaviour_files(root: Path) -> dict[str, str]:
    """相対パス → 内容の sha256。"""
    out: dict[str, str] = {}
    for base in BEHAVIOUR_DIRS:
        for path in sorted((root / base).rglob("*")):
            if not path.is_file() or path.suffix not in BEHAVIOUR_SUFFIXES:
                continue
            rel = path.relative_to(root)
            if any(part in IGNORED_PARTS for part in rel.parts):
                continue
            out[str(rel)] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


def installed_paths(manifest: Path = INSTALL_MANIFEST) -> list[tuple[str, Path]]:
    """install 記録から、この plugin の複製を全部拾う。**1 つとは限らない。**"""
    if not manifest.is_file():
        return []
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    found: list[tuple[str, Path]] = []
    for key, entries in (data.get("plugins") or {}).items():
        if not key.split("@")[0] == PLUGIN_NAME:
            continue
        for entry in entries if isinstance(entries, list) else [entries]:
            path = (entry or {}).get("installPath")
            if path:
                found.append((key, Path(path)))
    return found


def compare(repo: Path, installed: Path) -> dict[str, list[str]]:
    """repo 側を正として、欠け・違い・余りを分けて返す。"""
    a, b = _behaviour_files(repo), _behaviour_files(installed)
    return {
        "missing": sorted(k for k in a if k not in b),
        "differing": sorted(k for k in a if k in b and a[k] != b[k]),
        "extra": sorted(k for k in b if k not in a),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", type=Path, default=PLUGIN_ROOT)
    ap.add_argument("--installed", type=Path, default=None, help="比較先を明示する (試験用)")
    ap.add_argument("--show", type=int, default=8, help="列挙する最大件数")
    args = ap.parse_args(argv)

    targets = [("--installed", args.installed)] if args.installed else installed_paths()
    if not targets:
        print("INDETERMINATE: install 記録が見つからず、走っている複製を特定できない。")
        print("  これは緑ではない。手元で走らせたときにだけ意味のある検査である。")
        return 2

    diverged = False
    for key, path in targets:
        if not path.is_dir():
            print(f"INDETERMINATE: {key} の installPath が実在しない: {path}")
            diverged = True
            continue
        result = compare(args.repo, path)
        total = sum(len(v) for v in result.values())
        if total == 0:
            print(f"OK: {key} は repo と一致する ({path})")
            continue
        diverged = True
        print(f"NG: {key} が repo と {total} 箇所ちがう ({path})")
        for label, items in result.items():
            if not items:
                continue
            head = ", ".join(items[: args.show])
            more = f" ほか {len(items) - args.show} 件" if len(items) > args.show else ""
            print(f"  {label} {len(items)}: {head}{more}")

    if diverged:
        print()
        print("**repo を直しても runtime には効いていない。**宛先は plugin の入れ直しで、")
        print("章や仕様書の書き換えではない。`/plugin` から当該 plugin を更新すること。")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
