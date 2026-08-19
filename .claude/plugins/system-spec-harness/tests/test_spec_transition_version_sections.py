"""The single writer can read a current-version state and write it back intact.

版の門が 1.1 のままだった間、1.2 の正本は writer から読めず、更新は writer を通らない
経路でしか行えなかった。門を 1.2 へ上げるとその詰まりは取れるが、**通るようになった分だけ
黙って壊れる余地**が生まれる——拒否されている間は気づけたが、通る writer が 1.2 固有節を
落としても誰も気づかない。そこで往復の保全そのものを検査に固定する。

向きの対:
  - 上げた門が実際に通ること (詰まりが取れたことの下限)
  - 通った先で節が落ちないこと (通ったことで新しく開いた穴の上限)
片方だけでは意味がない。門だけ上げれば 1 つ目は満たせるが 2 つ目で赤くなる。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
WRITER = (
    PLUGIN_ROOT
    / "skills"
    / "run-system-spec-elicit"
    / "scripts"
    / "apply-spec-transition.py"
)
SCRIPTS_DIR = WRITER.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from state_transition_matrix import (  # noqa: E402
    CURRENT_STATE_SCHEMA_VERSION,
    SCHEMA_1_2_SECTIONS,
    bootstrap_state,
)


def _run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(WRITER), *args],
        capture_output=True,
        text=True,
    )


def _current_state() -> dict:
    """最新版を名乗り、固有節に『中身が入っている』state。

    空の節では「落ちた」と「もともと空だった」が同じ姿になり、保全を測れない。
    """
    state = bootstrap_state()
    state["lifecycle"] = {"phase": "build"}
    state["implementation_snapshot"] = {"commit": "deadbeef"}
    state["delivery_dependencies"] = ["d1"]
    state["review_runs"] = [{"id": "review-001"}]
    return state


def test_bootstrap_emits_every_section_the_current_version_claims() -> None:
    state = bootstrap_state()
    assert state["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    missing = [name for name in SCHEMA_1_2_SECTIONS if name not in state]
    assert missing == [], f"版だけ名乗って節の無い state を writer が作っている: {missing}"


def test_writer_accepts_the_current_version_and_preserves_its_sections(tmp_path: Path) -> None:
    source = tmp_path / "state.json"
    out = tmp_path / "out.json"
    before = _current_state()
    source.write_text(json.dumps(before, ensure_ascii=False), encoding="utf-8")

    result = _run(["aggregate", "--state", str(source), "--out", str(out)])
    assert result.returncode == 0, result.stderr

    after = json.loads(out.read_text(encoding="utf-8"))
    for name in SCHEMA_1_2_SECTIONS:
        assert after[name] == before[name], name


def test_a_transition_that_drops_a_section_is_refused(tmp_path: Path) -> None:
    """0 件を主張する側が動いていることを、当たる例で示す。

    保全チェックが素通りしているだけでも上のテストは緑になる。落とす transition を
    合成して、落ちたときに実際に止まることを確かめる。
    """
    sys.path.insert(0, str(SCRIPTS_DIR))
    import importlib.util

    spec = importlib.util.spec_from_file_location("apply_spec_transition", WRITER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    before = _current_state()
    snapshot = module._snapshot_versioned_sections(before)
    assert set(snapshot) == set(SCHEMA_1_2_SECTIONS)

    for name in SCHEMA_1_2_SECTIONS:
        damaged = {k: v for k, v in before.items() if k != name}
        with pytest.raises(module.TransitionError) as excinfo:
            module._require_sections_preserved(snapshot, damaged)
        assert name in str(excinfo.value)

    retyped = dict(before)
    retyped["delivery_dependencies"] = {}
    with pytest.raises(module.TransitionError):
        module._require_sections_preserved(snapshot, retyped)


def test_a_state_naming_an_older_version_stays_read_only(tmp_path: Path) -> None:
    source = tmp_path / "legacy.json"
    legacy = _current_state()
    legacy["schema_version"] = "1.1"
    source.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")

    result = _run(["aggregate", "--state", str(source), "--out", str(tmp_path / "o.json")])
    assert result.returncode == 1
    assert "読み取り専用" in result.stderr
