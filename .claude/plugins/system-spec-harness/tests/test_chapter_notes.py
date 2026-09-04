"""章にしか居場所の無い散文へ、正本の居場所を与える writer と renderer の検査。

**何を守っているか。**章は正本の純関数である。正本に無い散文は compile のたび
消える。節の引き継ぎ (`--on-handwritten preserve`) は `##` 単位でしか効かないので、
生成節の内側に書かれた散文は原理上守れない。だからこの欄が在る。

ここで落ちるべきは 2 種類ある:
  - 正本に無い散文が章から消えること (renderer 側)
  - 利用者の逐語と突き合わせの記録が混ざること (writer 側の分離)
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "lib"))
sys.path.insert(0, str(ROOT / "skills" / "run-system-spec-elicit" / "scripts"))

import spec_docset_chapters as chs  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402
from state_transition_matrix import set_chapter_note  # noqa: E402


def _state() -> dict:
    return {
        "categories": [{"id": "ui-ux", "label": "UI-UX"}, {"id": "database", "label": "データ"}],
        "matrix": {"ui-ux": {}, "database": {}},
        "qa_log": [],
    }


def test_writer_records_the_note_under_its_category():
    state = _state()
    set_chapter_note(state, "ui-ux", "既存記録との食い違い", "本文\n2 行目", "章にしか無かったため")
    assert state["chapter_notes"]["ui-ux"] == [
        {
            "heading": "既存記録との食い違い",
            "body": "本文\n2 行目",
            "reason": "章にしか無かったため",
            "recorded_with": "set-chapter-note",
        }
    ]


def test_writer_stamps_the_writer_name_itself():
    """由来欄は呼び出し側から渡せない。渡せると「正規経路を通った」と自分で書ける。"""
    state = _state()
    set_chapter_note(state, "ui-ux", "見出し", "本文", "理由")
    assert state["chapter_notes"]["ui-ux"][0]["recorded_with"] == "set-chapter-note"


def test_reapplying_the_same_note_is_a_no_op():
    state = _state()
    set_chapter_note(state, "ui-ux", "見出し", "本文", "理由")
    set_chapter_note(state, "ui-ux", "見出し", "本文", "理由")
    assert len(state["chapter_notes"]["ui-ux"]) == 1


def test_reapplying_a_different_body_under_the_same_heading_is_refused():
    """黙って上書きすると、前に何が書いてあったかが引けなくなる。"""
    state = _state()
    set_chapter_note(state, "ui-ux", "見出し", "本文", "理由")
    with pytest.raises(TransitionError, match="異なる内容の再適用は拒否"):
        set_chapter_note(state, "ui-ux", "見出し", "別の本文", "理由")


def test_unknown_category_is_refused():
    state = _state()
    with pytest.raises(TransitionError, match="categories に存在しない"):
        set_chapter_note(state, "存在しない", "見出し", "本文", "理由")


@pytest.mark.parametrize("field", ["category", "heading", "body", "reason"])
def test_empty_fields_are_refused(field):
    """理由の無い注記を許すと、「なぜ正本に在るのか」が分からない行が増える。"""
    args = {"category": "ui-ux", "heading": "見出し", "body": "本文", "reason": "理由"}
    args[field] = "   "
    with pytest.raises(TransitionError, match="非空文字列必須"):
        set_chapter_note(_state(), args["category"], args["heading"], args["body"], args["reason"])


def test_two_notes_under_one_category_keep_their_order():
    state = _state()
    set_chapter_note(state, "ui-ux", "A", "1", "理由")
    set_chapter_note(state, "ui-ux", "B", "2", "理由")
    assert [n["heading"] for n in state["chapter_notes"]["ui-ux"]] == ["A", "B"]


def test_renderer_emits_a_top_level_section_so_preserve_can_carry_it():
    """`##` でなければ節の引き継ぎが効かない。`###` に落とすと守れなくなる。"""
    state = _state()
    set_chapter_note(state, "ui-ux", "食い違い", "本文", "理由")
    out = chs.render_chapter_notes(state, "ui-ux")
    assert out.startswith("## 章の注記 (chapter_notes)")
    assert "### 食い違い" in out
    assert "本文" in out
    assert "- 正本へ入れた理由: 理由" in out


def test_renderer_says_it_is_not_the_users_own_words():
    """利用者の回答と混ぜて読まれると、言っていないことが利用者の声になる。"""
    state = _state()
    set_chapter_note(state, "ui-ux", "食い違い", "本文", "理由")
    assert "利用者の回答ではない" in chs.render_chapter_notes(state, "ui-ux")


def test_renderer_is_empty_for_a_category_without_notes():
    assert chs.render_chapter_notes(_state(), "database") == ""
    assert chs.render_chapter_notes({}, "database") == ""


def test_chapter_without_notes_gains_no_blank_section():
    """注記が無い章に空節を作らない (空行だけが増えて golden が動く)。"""
    state = _state()
    set_chapter_note(state, "ui-ux", "食い違い", "本文", "理由")
    assert "章の注記" not in chs.render_chapter_notes(state, "database")
