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


def _matrix_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "state_transition_matrix_under_test", SCRIPTS_DIR / "state_transition_matrix.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_the_loop_limit_is_strict_by_construction() -> None:
    """上限が『目安』か『絶対』かは、書いてある値ではなく writer の作りが決めている。

    run_chunk は上限で break し loop_count を処理済み件数で置き直すので、
    この writer を通る限り loop_count > max_loops は作れない。state に
    max_loops_policy=strict と書くのは、その作りを読み手に開示するためである。
    """
    module = _matrix_module()
    state = _current_state()
    state["categories"] = []
    state["matrix"] = {}
    processed = module.run_chunk(state, [{"ops": []} for _ in range(9)], max_loops=5)
    progress = state["hearing_progress"]
    assert processed == 5
    assert progress["loop_count"] <= progress["max_loops"]
    assert progress["max_loops_policy"] == module.LOOP_LIMIT_POLICY_STRICT
    assert not module.loop_limit_is_violated(progress)


def test_an_overrun_cannot_be_recorded_without_saying_why() -> None:
    """超過を無記名で通すと、迂回の痕跡が『ただの数字』になる。"""
    module = _matrix_module()
    state = _current_state()
    state["hearing_progress"] = {"loop_count": 7, "max_loops": 5}

    with pytest.raises(module.TransitionError):
        module.set_hearing_limit_policy(state, module.LOOP_LIMIT_POLICY_STRICT)
    with pytest.raises(module.TransitionError):
        module.set_hearing_limit_policy(
            state, module.LOOP_LIMIT_POLICY_STRICT, {"reason": "   "}
        )

    module.set_hearing_limit_policy(
        state, module.LOOP_LIMIT_POLICY_STRICT, {"reason": "writer を通らずに書かれた"}
    )
    progress = state["hearing_progress"]
    # 値そのものは丸めない。丸めると迂回の唯一の痕跡が消える。
    assert progress["loop_count"] == 7
    assert progress["max_loops"] == 5
    assert progress["limit_overrun"]["reason"]


def test_an_unknown_policy_is_refused() -> None:
    module = _matrix_module()
    state = _current_state()
    state["hearing_progress"] = {"loop_count": 1, "max_loops": 5}
    with pytest.raises(module.TransitionError):
        module.set_hearing_limit_policy(state, "loose")


def test_a_state_within_the_limit_carries_no_overrun_record() -> None:
    """0 件を主張する側の対照。超過が無ければ痕跡欄は残らない。"""
    module = _matrix_module()
    state = _current_state()
    state["hearing_progress"] = {
        "loop_count": 2,
        "max_loops": 5,
        "limit_overrun": {"reason": "古い記録"},
    }
    module.set_hearing_limit_policy(state, module.LOOP_LIMIT_POLICY_SOFT)
    assert "limit_overrun" not in state["hearing_progress"]
    assert state["hearing_progress"]["max_loops_policy"] == "soft"


def test_a_state_naming_an_older_version_stays_read_only(tmp_path: Path) -> None:
    source = tmp_path / "legacy.json"
    legacy = _current_state()
    legacy["schema_version"] = "1.1"
    source.write_text(json.dumps(legacy, ensure_ascii=False), encoding="utf-8")

    result = _run(["aggregate", "--state", str(source), "--out", str(tmp_path / "o.json")])
    assert result.returncode == 1
    assert "読み取り専用" in result.stderr
