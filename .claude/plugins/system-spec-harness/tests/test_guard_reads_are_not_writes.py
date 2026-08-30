"""読むだけの操作を、書込と誤認させない。

**塞ぐ側の誤爆は、調べる側を黙らせる。**実測 2026-08-25: 証跡ファイルを一覧するだけの
`find ... | xargs grep -ln 'retrieval-evidence'` が遮断された。原因は `grep` の
**オプション文字列 `-ln`** が mutation ツール `ln` の `\\bln\\b` に食われたことである。
`\\b` は `-` の直後で成立するので、`-ln` の `l` は語頭と見なされる。

一度 mutation と誤認されると、コマンドが保護領域 (`system-spec/`) を参照している以上
find/xargs 経路の「書込先確定不能」規則に落ち、読み取りが恒久的に不可能になる。
doc_freshness の裏取り (どの証跡が在るかを数える) がまさにこれで塞がれていた。

ここで留めるのは 2 つ。**読むだけは通ること**と、**書込は今までどおり止まること**。
片方だけの試験は、誤爆を直したつもりで防御を外す事故を見逃す。
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = "system" + "-spec"
PROJECT = ROOT.parents[2]  # <repo>/.claude/plugins/system-spec-harness → <repo>


_spec = importlib.util.spec_from_file_location(
    "guard_mod", ROOT / "hooks" / "guard-confirmed-chapter-overwrite.py"
)
guard = importlib.util.module_from_spec(_spec)
sys.modules["guard_mod"] = guard
_spec.loader.exec_module(guard)


def _decide(cmd: str) -> int:
    code, _ = guard.bash_decision(cmd, PROJECT)
    return code


# ── 読むだけは通ること ──────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "cmd",
    [
        # 実際に遮断された現物。オプション -ln が ln に食われていた。
        f"find . -name '*.py' | xargs grep -ln 'retrieval-evidence' 2>/dev/null",
        # 保護領域を参照しつつ読むだけ。ここが通らないと監査自体が成立しない。
        f"find {SPEC} -name '*.json' | xargs grep -ln version",
        f"ls {SPEC}/retrieval-evidence/",
        f"cat {SPEC}/fetched-references.json",
        f"grep -c version {SPEC}/fetched-references.json",
        # -rm / --rm / -cp なども同じ形の偶然一致。
        f"grep -rm 3 version {SPEC}/fetched-references.json",
        f"docker run --rm -v {SPEC}:/w busybox ls /w",
    ],
)
def test_a_read_only_command_is_allowed(cmd):
    """**オプション文字列の中身をコマンド名と読み違えない。**"""
    assert _decide(cmd) == 0, cmd


# ── 書込は止まり続けること ──────────────────────────────────────────────────
@pytest.mark.parametrize(
    "cmd",
    [
        f"sed -i '' 's/a/b/' {SPEC}/auth.md",
        f"rm {SPEC}/spec-state.json",
        f"cp /tmp/x.json {SPEC}/spec-state.json",
        f"mv /tmp/x.json {SPEC}/spec-state.json",
        f"echo x > {SPEC}/spec-state.json",
        f"find {SPEC} -name '*.md' | xargs sed -i '' 's/a/b/'",
        f"ln -sf /tmp/x {SPEC}/spec-state.json",
    ],
)
def test_a_write_is_still_blocked(cmd):
    """誤爆を直した勢いで防御を外していないこと。

    **緩めた検査は、緩めた分だけ独立に確かめる。**
    """
    assert _decide(cmd) == 2, cmd


def test_a_path_prefixed_tool_still_counts_as_a_write():
    """`/usr/bin/rm` のようなパス前置は依然としてコマンド語である。

    直前が `/` の場合まで除外すると、絶対パス起動で防御を抜けられる。
    """
    assert _decide(f"/bin/rm {SPEC}/spec-state.json") == 2


def test_the_command_position_guard_is_what_makes_the_difference():
    """直したのが「語頭 `\\b`」ではなく「コマンド語の位置」であること。

    実装が `\\b` へ戻ったらここが落ちる。
    """
    assert guard._CMD_POS == r"(?<![-\w])"
    for pattern, _name in guard._MUTATION_TOOLS:
        assert pattern.pattern.startswith(guard._CMD_POS), pattern.pattern
