"""監査が「走らせていない検査」について結論を出せないようにする。

**答えを持てない問いに、答えよと命じていた。**契約書は決定論ゲートを二モード
(`loop` / `--require-complete`) しか回収させていなかったが、実装には opt-in の
検査が 5 つある。opt-in は既定 off なので、**付け忘れたゲートは「走って通った」
ではなく「走っていない」**である。にもかかわらず契約書は「決定論ゲート第一」と
命じていた。

実測 2026-08-25: C07 が `--require-counted-required-info` を付けずに走らせ、
「ゲートは required_info の item_id を見ていない」と結論し、そこから目視で
`screen-information-priority` を「カタログに無い旧名」と報告した。カタログに実在し、
フラグを付ければ `extra`/`missing` で決着する事柄だった。**正本に在るものを
「無い」と報せる監査は、見落としより高くつく** — 是正の宛先が仕様書へ向き、
直すところが無いまま赤が残る。

さらにその下に、**目録そのものが引けない**という穴があった。`--help` は help 文字列の
未エスケープ `%` (`100% 確定`) で例外死しており、監査がフラグ一覧を道具に聞く手段が
壊れていた。契約書に書かれていない検査を発見する道が塞がっていたことになる。
"""
import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
GATE = ROOT / "scripts" / "validate-coverage-matrix.py"
CONTRACT = ROOT / "agents" / "system-spec-matrix-auditor.md"
CANONICAL = ROOT.parents[2] / ("system" + "-spec") / "spec-state.json"


def _help() -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GATE), "--help"], capture_output=True, text=True
    )


def _implemented_flags() -> set[str]:
    """実装側の opt-in 検査を、道具自身の目録から取る。

    ソースの正規表現ではなく `--help` から取るのは、**目録が引けることも同時に
    検査したい**からである。help が壊れれば、この試験群が丸ごと落ちる。
    """
    return set(re.findall(r"--require-[a-z-]+", _help().stdout))


def test_the_tool_can_list_its_own_checks():
    """`--help` が生きていること。**目録が引けない道具は、目録に無い検査を隠す。**"""
    result = _help()
    assert result.returncode == 0, result.stderr


def test_there_is_more_than_one_optin_check():
    """この試験群が守っている状況が実在することを示す。

    opt-in が 1 つしか無くなったら、「全部付ける」は自明になり守る対象が消える。
    """
    assert len(_implemented_flags()) > 1


@pytest.mark.parametrize("flag", sorted(_implemented_flags()))
def test_the_contract_names_every_implemented_check(flag):
    """実装された検査が、契約書の手順に**全部**載っていること。

    フラグが増えたときに落ちる。落ちることで契約書の更新を強制する。
    ここが同期していないと、監査は自分が何を走らせ損ねたかを知れない。
    """
    assert flag in CONTRACT.read_text(encoding="utf-8"), flag


def test_the_checklist_forbids_concluding_on_unrun_checks():
    """完了確認の側にも置く。本文だけに書くと、監査は確認項目の側に従う。"""
    text = CONTRACT.read_text(encoding="utf-8")
    checklist = [ln for ln in text.splitlines() if ln.startswith("- [ ]")]
    assert any("走っていない" in ln for ln in checklist), checklist


def test_the_contract_assigns_catalog_matching_to_the_gate():
    """カタログ突合が意味層ではなく機械の担当だと明言していること。

    「目で確かめよ」と読める限り、目視の読み違いが finding として出てくる。
    """
    text = CONTRACT.read_text(encoding="utf-8")
    assert "意味層ではなく決定論ゲートの担当" in text


def test_the_gate_actually_decides_catalog_membership():
    """ゲートが本当に item_id の過剰/不足を見ていること。

    契約書が「ゲートが決着させる」と言えるのは、実装がそうしているからである。
    実装が消えたら、契約書の言い分は根拠を失う。
    """
    src = GATE.read_text(encoding="utf-8")
    assert "カタログに無い required_info item_id" in src
    assert re.search(r"extra\s*=\s*sorted\(actual\s*-\s*expected\)", src)


def test_the_canonical_passes_the_catalog_check():
    """正本そのものを検査対象にする。**反証は、口ではなく exit code で言う。**

    この試験が通るあいだ、「正本の item_id がカタログに無い」という主張は偽である。
    """
    result = subprocess.run(
        [
            sys.executable, str(GATE), "--matrix", str(CANONICAL),
            "--require-complete", "--require-counted-required-info",
        ],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
