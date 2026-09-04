"""質疑に「どこから来たか」を必ず名乗らせる。

**黙って落とせる欄は、いつか落ちる。**`source` は長らく `if "source" in turn` の
任意欄だった。名乗らなくても writer は通り、通ったものは正本に残る。
実測 2026-08-25: `qa_log` 40 件のうち 5 件が `source` を持たず、うち 3 件は
確定セルが引いていた。独立監査 C06 が「由来を機械で辿れない確定」として FAIL を
出し、C05 の総合判定まで降格した。

止める場所を 2 つ置く。作成側 (`_require_qa_source`) は**これから入るもの**を止め、
`set-qa-source` は**穴が開いていたあいだに入ったもの**を直す。作成側だけを塞ぐと、
既に入った 5 件は誰にも直せないまま残る。

`{"kind": "user-dialogue"}` は裏取りではない。**裏取りが存在しないことの宣言**である。
名乗りが無いと、書面か対話かを問うことすらできない。
"""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "run-system-spec-elicit" / "scripts"))

from state_transition_common import TransitionError  # noqa: E402
from state_transition_matrix import set_qa_source  # noqa: E402
import state_transition_matrix as mod  # noqa: E402


def _turn(**over):
    turn = {
        "qa_id": "qa-x",
        "question": "q",
        "answer": "a",
        "source": {"kind": "user-dialogue"},
        "ops": [],
    }
    turn.update(over)
    return turn


def _state():
    return {
        "qa_log": [],
        "approval_log": [],
        "matrix": {},
        "categories": [],
        "platforms": [],
        "category_aggregate": {},
        "hearing_progress": {"loop_count": 0, "complete": False, "next_question": None},
    }


def test_a_turn_without_a_source_is_refused():
    with pytest.raises(TransitionError, match="source が無い"):
        mod.apply_turn(_state(), _turn(source=None))


def test_a_turn_declaring_dialogue_passes():
    state = _state()
    mod.apply_turn(state, _turn())
    assert state["qa_log"][0]["source"] == {"kind": "user-dialogue"}


@pytest.mark.parametrize("bad", ["user-dialogue ", "dialogue", "", None, "ai-summary"])
def test_an_unknown_kind_is_refused(bad):
    """**知らない名乗りは名乗りではない。**自由記述を許すと語彙が割れて照合できない。"""
    with pytest.raises(TransitionError, match="source"):
        mod.apply_turn(_state(), _turn(source={"kind": bad}))


def test_a_non_object_source_is_refused():
    with pytest.raises(TransitionError, match="オブジェクトでない"):
        mod.apply_turn(_state(), _turn(source="user-dialogue"))


def _logged(**over):
    entry = {"id": "qa-1", "question": "q", "answer": "a"}
    entry.update(over)
    return {"qa_log": [entry]}


def test_the_backfill_writer_declares_dialogue():
    state = _logged()
    set_qa_source(state, "qa-1", "2026-08-21 の利用者ヒアリング逐語であるため")
    assert state["qa_log"][0]["source"] == {"kind": "user-dialogue"}


def test_the_backfill_writer_is_idempotent():
    state = _logged(source={"kind": "user-dialogue"})
    set_qa_source(state, "qa-1", "同じ名乗りの再適用")
    assert state["qa_log"][0]["source"] == {"kind": "user-dialogue"}


def test_the_backfill_writer_never_overwrites_a_written_source():
    """**名乗りだけで書面の裏取りを消させない。**

    書面由来の entry は path/section/sha256 を持つ。ここで対話由来に塗り替えられると、
    原文へ突き合わせられた事実が、突き合わせ不能の宣言に化ける。
    """
    state = _logged(source={"kind": "written-requirements", "path": "docs/x.md", "section": "§1"})
    with pytest.raises(TransitionError, match="上書きしない"):
        set_qa_source(state, "qa-1", "対話ということにしたい")


def test_the_backfill_writer_cannot_invent_a_written_source():
    """この writer には書面を名乗る引数が無い。**口が無いことが防御である。**"""
    import inspect

    assert "written-requirements" not in inspect.signature(set_qa_source).parameters


def test_the_backfill_writer_refuses_an_unknown_id():
    with pytest.raises(TransitionError, match="存在しない id"):
        set_qa_source(_logged(), "qa-nope", "理由")


@pytest.mark.parametrize("field,value", [("qa_id", ""), ("reason", "  ")])
def test_the_backfill_writer_requires_both_fields(field, value):
    args = {"qa_id": "qa-1", "reason": "理由"}
    args[field] = value
    with pytest.raises(TransitionError, match="非空文字列必須"):
        set_qa_source(_logged(), args["qa_id"], args["reason"])


def test_every_canonical_qa_entry_names_its_origin():
    """正本そのものを検査対象にする。**直したことを、直したと言うだけにしない。**"""
    spec = json.loads((ROOT.parents[2] / "system-spec" / "spec-state.json").read_text(encoding="utf-8"))
    missing = [e["id"] for e in spec["qa_log"] if not e.get("source")]
    assert missing == []
