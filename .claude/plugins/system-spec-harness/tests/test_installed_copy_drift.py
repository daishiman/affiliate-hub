"""「走っている複製が repo と同じか」を見る側が、実際に動いていること。

**この検出器そのものが黙っていたら、黙っていることに誰も気づかない。**
実測 2026-08-25: repo 側で hook の読み取り誤爆を直し、その試験も緑だったのに、
走っていた hook は install 済みの 0.1.11 (2026-08-21) で、repo とは 83 箇所ちがった。
**それ以降の harness の修正は runtime では 1 つも効いていなかった。**

留めるのは 3 つ。**一致で 0**、**乖離で 1**、**特定できないとき 2**。
3 つ目が要るのは、install 記録の無い場所 (CI) で「一致した」と名乗らせないためである。
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check-installed-copy-drift.py"

_spec = importlib.util.spec_from_file_location("copy_drift", SCRIPT)
drift = importlib.util.module_from_spec(_spec)
sys.modules["copy_drift"] = drift
_spec.loader.exec_module(drift)


def _plugin(root: Path, files: dict[str, str]) -> Path:
    for rel, body in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
    return root


SAME = {"hooks/guard.py": "print(1)\n", "scripts/validate.py": "x = 1\n"}


def test_an_identical_copy_is_green(tmp_path, capsys):
    a = _plugin(tmp_path / "repo", SAME)
    b = _plugin(tmp_path / "installed", SAME)
    assert drift.main(["--repo", str(a), "--installed", str(b)]) == 0
    assert "OK:" in capsys.readouterr().out


@pytest.mark.parametrize(
    "changed,axis",
    [
        ({**SAME, "hooks/guard.py": "print(2)\n"}, "differing"),
        ({"hooks/guard.py": SAME["hooks/guard.py"]}, "missing"),
        ({**SAME, "scripts/extra.py": "y = 1\n"}, "extra"),
    ],
)
def test_each_kind_of_divergence_is_reported(tmp_path, capsys, changed, axis):
    """**3 軸を別々に数える。**1 つの数へ潰すと、何を入れ直せばよいか読めない。"""
    a = _plugin(tmp_path / "repo", SAME)
    b = _plugin(tmp_path / "installed", changed)
    assert drift.main(["--repo", str(a), "--installed", str(b)]) == 1
    assert axis in capsys.readouterr().out


def test_generated_and_test_material_is_not_counted(tmp_path):
    """`__pycache__` や fixture の差で赤を埋めない。

    **意味の無い差分が並ぶと、本物の差分がその中に隠れる。**
    """
    a = _plugin(tmp_path / "repo", {**SAME, "scripts/__pycache__/x.py": "a\n",
                                    "skills/s/tests/test_x.py": "a\n",
                                    "skills/s/fixtures/expected.md": "a\n"})
    b = _plugin(tmp_path / "installed", {**SAME, "scripts/__pycache__/x.py": "b\n",
                                         "skills/s/tests/test_x.py": "b\n",
                                         "skills/s/fixtures/expected.md": "b\n"})
    assert drift.main(["--repo", str(a), "--installed", str(b)]) == 0


def test_a_missing_install_record_is_not_a_pass(tmp_path, capsys):
    """**確かめられなかったことは、良い報せではない。**"""
    assert drift.installed_paths(tmp_path / "nope.json") == []
    a = _plugin(tmp_path / "repo", SAME)
    assert drift.main(["--repo", str(a)]) in (1, 2)


def test_the_indeterminate_exit_says_it_is_not_green(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(drift, "installed_paths", lambda *a, **k: [])
    a = _plugin(tmp_path / "repo", SAME)
    assert drift.main(["--repo", str(a)]) == 2
    out = capsys.readouterr().out
    assert "INDETERMINATE" in out
    assert "緑ではない" in out


def test_a_vanished_install_path_is_not_silently_skipped(tmp_path, capsys):
    """installPath が消えていたら、それも黙って通さない。"""
    a = _plugin(tmp_path / "repo", SAME)
    assert drift.main(["--repo", str(a), "--installed", str(tmp_path / "gone")]) == 1
    assert "実在しない" in capsys.readouterr().out
