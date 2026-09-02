"""リダイレクト先の判定を、演算子と同じ行に限る。

**実測 2026-08-25**: ヒアドキュメントで本文を書くだけの Bash が遮断された。
本文の末尾に区画の閉じ山括弧があり、その**次の行**に `system-spec/spec-state.json`
という文字列（読み取り対象としての言及）が並んでいた。

```
python3 x.py --body-file - <<'EOF'
... 本文 ...
</details>
system-spec/spec-state.json を参照のこと
EOF
```

`_REDIRECT` は `\\d*>>?\\s*(...)` で、**`\\s` は改行にマッチする**。
そのため `>` （`</details>` の閉じ山括弧）と、改行を挟んだ次行の
`system-spec/spec-state.json` が「リダイレクト演算子とその宛先」として読まれた。
実際には正本への書込は 1 バイトも無い。

**シェルでは、素の改行を挟んだ `>` はコマンドとして成立しない**
（`>` の直後に改行が来ればそこで構文が切れる）。
つまり「演算子と宛先が同じ行にある」ことは、緩和ではなく実態に合わせた制約である。

ここで留めるのは 2 つ。**行を跨いだ誤検出が起きないこと**と、
**同じ行にある本物のリダイレクトは今までどおり止まること**。
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
    "guard_mod_redirect", ROOT / "hooks" / "guard-confirmed-chapter-overwrite.py"
)
guard = importlib.util.module_from_spec(_spec)
sys.modules["guard_mod_redirect"] = guard
_spec.loader.exec_module(guard)


def _decide(cmd: str) -> int:
    code, _ = guard.bash_decision(cmd, PROJECT)
    return code


# ── 行を跨いだ誤検出が起きないこと ──────────────────────────────────────────
def test_a_heredoc_body_is_not_a_redirect_target():
    """遮断された現物の形。閉じ山括弧の次の行に正本の path が並ぶ。"""
    cmd = (
        "python3 apply-spec-transition.py set-chapter-note --body-file - <<'EOF'\n"
        "本文の途中に区画がある。\n"
        "</details>\n"
        f"{SPEC}/spec-state.json を参照のこと\n"
        "EOF"
    )
    assert _decide(cmd) == 0, cmd


def test_a_bare_newline_after_the_operator_is_not_a_redirect():
    """`>` の直後が改行なら、次行の語は宛先ではない。

    シェルでもこの形はコマンドとして成立しない。
    """
    assert guard._redirect_targets(f"echo x >\n{SPEC}/spec-state.json") == []


def test_a_mention_on_the_next_line_is_readable():
    """本文中で正本を「言及」するだけなら通ること。

    **塞ぐ側の誤爆は、書き戻す側を黙らせる。**正本の話をする文書が書けなくなる。
    """
    cmd = f"cat <<'EOF' > /tmp/note.md\n見出し >\n{SPEC}/spec-state.json\nEOF"
    assert _decide(cmd) == 0, cmd


# ── 同じ行にある本物のリダイレクトは今までどおり止まること ──────────────────
@pytest.mark.parametrize(
    "cmd",
    [
        f"echo x > {SPEC}/spec-state.json",
        f"echo x >{SPEC}/spec-state.json",
        f"echo x >> {SPEC}/spec-state.json",
        f"cat /tmp/y > {SPEC}/frontend.md",
        # heredoc の**開始行**にあるリダイレクトは同一行なので拾う。
        f"cat <<'EOF' > {SPEC}/spec-state.json\nx\nEOF",
    ],
)
def test_a_same_line_redirect_is_still_blocked(cmd):
    """誤爆を直した勢いで防御を外していないこと。

    **緩めた検査は、緩めた分だけ独立に確かめる。**
    """
    assert _decide(cmd) == 2, cmd


def test_a_tab_between_the_operator_and_the_target_still_counts():
    """同一行の空白はタブでも空白でも宛先として拾うこと。

    改行だけを外したのであって、水平の空白まで外したのではない。
    """
    assert guard._redirect_targets("echo x >\t/tmp/a") == ["/tmp/a"]
    assert guard._redirect_targets("echo x >   /tmp/a") == ["/tmp/a"]


def test_the_fix_is_the_horizontal_whitespace_class():
    """直したのが「`\\s` を水平の空白へ狭めた」ことであると固定する。

    実装が `\\s*` へ戻ったらここが落ちる。
    """
    assert "\\s*" not in guard._REDIRECT.pattern, guard._REDIRECT.pattern
    assert "[ \\t]*" in guard._REDIRECT.pattern, guard._REDIRECT.pattern
