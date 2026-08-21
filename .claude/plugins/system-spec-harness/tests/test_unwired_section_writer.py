# /// script
# name: test-unwired-section-writer
# version: 0.1.0
# purpose: ガードが未実装の requote-written-section が CLI から到達できないことを固定し、配線された日に赤くする pytest。
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
"""**ガードが空の writer が、実行経路を持っていないこと。**

`requote_written_section` は節ごと回答を差し替える writer で、行単位の
`requote-written-source` より危ない——回答に引用でない文 (書いた人の補足) が
混ざっていれば、それも一緒に消える。差し替えを拒否する条件は `TODO(human)` の
ままで、**まだ書かれていない。**

いま安全なのは、この関数が `apply-spec-transition.py` の subcommand に
配線されていないからである。**その安全は、コードの性質ではなく「配線し忘れ」に
乗っている。**誰かが subcommand を足した日、ガードが空のまま動く。

**向きは②である。**「塞げていないこと」ではなく「まだ届かないこと」を固定し、
届くようになった日に赤くする。赤くなったときにすべきことは、この検査を消す
ことではなく、**先にガードを埋めること**である。

**⑤ 反転先**: `TODO(human)` が埋まった日、この検査は役目を終える。そのとき
消さず、「`requote-written-section` は、節の外から引いている行が在る entry を
拒否する」という**writer の振る舞いそのもの**へ反転させて残す。
配線と拒否が揃った状態から、片方だけ外れた日に赤くなるようにするため。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
ELICIT_SCRIPTS = PLUGIN_ROOT / "skills/run-system-spec-elicit/scripts"
CLI = ELICIT_SCRIPTS / "apply-spec-transition.py"
MATRIX = ELICIT_SCRIPTS / "state_transition_matrix.py"
sys.path.insert(0, str(ELICIT_SCRIPTS))
import state_transition_matrix as stm  # noqa: E402

WRITER = "requote-written-section"


def test_the_guard_is_still_unwritten() -> None:
    """前提の確認。ガードが埋まっているなら、この検査の理由が変わる。"""
    body = MATRIX.read_text(encoding="utf-8")
    start = body.index("def requote_written_section(")
    end = body.index("\ndef ", start + 1)
    assert "TODO(human)" in body[start:end], (
        "ガードが埋まりました。この検査を消さず、doc comment の⑤に書いた"
        "「節の外から引いている行が在る entry を拒否する」へ反転させてください"
    )


def test_the_writer_has_no_cli_subcommand() -> None:
    """**この検査の本体。**CLI から到達できないこと。"""
    cli = CLI.read_text(encoding="utf-8")
    assert f'"{WRITER}"' not in cli, (
        f"{WRITER} が CLI へ配線されました。ガードが空のまま動きます。"
        "先に TODO(human) を埋めてください"
    )


def test_the_writer_is_not_a_cell_op_action() -> None:
    """cell op の action としても到達できないこと。
    subcommand を足さなくても、`apply --op` の action 名で届いてしまう道が在る。"""
    body = MATRIX.read_text(encoding="utf-8")
    actions = set(re.findall(r'action == "([a-z-]+)"', body))
    assert WRITER not in actions, f"{WRITER} が cell op の action として届きます"


def test_the_detector_finds_a_wired_writer() -> None:
    """**見つける側が動いていることを示す。**実在する subcommand なら CLI に在る。
    これが無いと、上の 2 つは綴りを間違えていても同じ緑を出す。"""
    cli = CLI.read_text(encoding="utf-8")
    assert f'"{stm.RESEAL_WRITER}"' in cli, "配線済みの writer を見つけられていない"
    assert f'"{stm.REQUOTE_WRITER}"' in cli
    body = MATRIX.read_text(encoding="utf-8")
    actions = set(re.findall(r'action == "([a-z-]+)"', body))
    assert {"confirm", "exclude", "reopen", "restore-qa-refs"} <= actions, (
        f"action の拾い方が壊れています: {sorted(actions)}"
    )
