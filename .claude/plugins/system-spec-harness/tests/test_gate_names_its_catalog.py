"""判定に使ったカタログの身元を、ゲート自身に名乗らせる。

**同じ名前のハーネスが 2 箇所にあり、どちらを開いたかが出力のどこにも現れなかった。**
実測 2026-08-25: 独立監査 C07 が marketplace 側の古いコピー
(`.../marketplaces/local/plugins/system-spec-harness`, catalog mtime 08-12) を読み、
worktree に install されている側 (mtime 08-24) と内容が違うことに気付けなかった。
旧コピーには `context-of-use` / `information-priority` が実在し、新しい側では
`screen-information-priority` に統合されている。

**C07 の観察は、古い正本に対しては全て正しかった。**誤っていたのは読解ではなく、
入力の同一性である。にもかかわらず食い違いは「監査の読み違い」に見えた —
読み手にも、その報告を受けた側にも、同じものを見ているか確かめる手段が無かったからである。
一度は「捏造」とまで判断された。**入力を名乗らない判定は、他人の判定と突き合わせられない。**

だから機械の側が名乗る。禁じる (別コピーを開くな) だけでは、開いたことに誰も気付けない。
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
CATALOG_LINE = re.compile(r"^catalog: (\S.*) \(sha256:([0-9a-f]{12})\)$", re.M)


def _run(*flags) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(GATE), "--matrix", str(CANONICAL), *flags],
        capture_output=True, text=True,
    )


@pytest.mark.parametrize(
    "flag", ["--require-counted-required-info", "--require-catalog-domain-coverage"]
)
def test_a_catalog_reading_check_names_its_catalog(flag):
    """カタログを読む検査が走ったなら、必ず身元が出ること。

    成否は問わない。**通ったときこそ名乗りが要る** — 落ちたときは中身を読むが、
    通ったときは exit code しか見られず、別コピーで通った緑が見分けられない。
    """
    result = _run("--require-complete", flag)
    match = CATALOG_LINE.search(result.stdout + result.stderr)
    assert match, (result.stdout, result.stderr)


def test_the_named_path_is_the_one_actually_used():
    """名乗ったパスが実在し、install 済みの側であること。

    名乗りが実物とずれていたら、突き合わせは意味を失う。
    """
    result = _run("--require-complete", "--require-counted-required-info")
    match = CATALOG_LINE.search(result.stdout + result.stderr)
    named = Path(match.group(1))
    assert named.is_file(), named
    assert named == (
        ROOT / "skills" / "run-system-spec-elicit" / "references" / "required-info-catalog.json"
    ).resolve()


def test_the_digest_changes_with_the_content(tmp_path):
    """sha256 が本当に中身を指していること。

    パスだけでは足りない。**同じパスに別の中身が置かれるのが、まさに今回の事故である。**
    """
    import importlib.util

    spec = importlib.util.spec_from_file_location("vcm_id", GATE)
    vcm = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vcm)

    a = tmp_path / "a.json"
    a.write_text('{"items": []}', encoding="utf-8")
    first = vcm._catalog_identity(a)
    a.write_text('{"items": [1]}', encoding="utf-8")
    assert vcm._catalog_identity(a) != first


def test_an_unreadable_catalog_still_names_itself(tmp_path):
    """読めなくても黙らない。**沈黙は「読めた」と区別がつかない。**"""
    identity = None
    import importlib.util

    spec = importlib.util.spec_from_file_location("vcm_id2", GATE)
    vcm = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vcm)
    identity = vcm._catalog_identity(tmp_path / "nope.json")
    assert "読めない" in identity
    assert "nope.json" in identity


def test_checks_that_do_not_read_the_catalog_stay_quiet():
    """関係ない検査に身元を吐かせない。**名乗りが常時出ると、誰も読まなくなる。**"""
    result = _run("--require-complete")
    assert not CATALOG_LINE.search(result.stdout + result.stderr)


def test_the_contract_requires_reconciling_the_named_catalog():
    """契約書が突合を求めていること。名乗っても、突き合わせなければ届かない。"""
    text = CONTRACT.read_text(encoding="utf-8")
    assert "判定ではなく入力" in text
    checklist = [ln for ln in text.splitlines() if ln.startswith("- [ ]")]
    assert any("catalog:" in ln for ln in checklist), checklist


def test_the_contract_pins_the_plugin_root():
    """絶対パスで別コピーを開かないことを明文化していること。"""
    assert "CLAUDE_PLUGIN_ROOT" in CONTRACT.read_text(encoding="utf-8")
