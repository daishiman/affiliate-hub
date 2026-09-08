"""Embedded source Markdown cannot capture sibling notes or chapter sections."""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

import spec_docset_chapters as chapters


@pytest.mark.parametrize("marker", ["```", "````", "~~~", "~~~~"])
def test_unclosed_fence_is_closed_with_its_original_marker(marker):
    body = marker + "text\n本文"
    sealed, changed = chapters.seal_code_fences(body)
    assert sealed == body + "\n" + marker
    assert changed is True


@pytest.mark.parametrize("marker,inner", [("````", "```"), ("~~~~", "~~~")])
def test_shorter_fence_inside_code_does_not_close_the_outer_block(marker, inner):
    body = f"{marker}text\n{inner}\n## コード内の見出し\n{marker}"
    assert chapters.seal_code_fences(body) == (body, False)
    assert chapters.demote_headings(body + "\n## 本文見出し", 4)[0] == (
        body + "\n#### 本文見出し"
    )


@pytest.mark.parametrize("marker", ["```", "~~~"])
def test_fence_at_the_start_of_an_answer_remains_a_block_in_both_renderers(marker):
    answer = f"{marker}text\nコード\n{marker}\n## 回答の節"
    qa = {"qa-test": {"question": "問い", "answer": answer}}
    for rendered in (
        chapters.render_confirmed_qa(
            {"matrix": {"backend": {"web": {"state": "確定", "qa_ref": "qa-test"}}},
             "qa_log": [{"id": "qa-test", **qa["qa-test"]}]},
            "backend",
        ),
        "\n".join(chapters._render_application_entry(qa, "qa-test", ["web"], label="確定内容")),
    ):
        assert marker + "text" in rendered.splitlines()
        assert chapters.seal_code_fences(rendered)[1] is False
        assert "## 回答の節" not in rendered.splitlines()
    assert qa["qa-test"]["answer"] == answer


def test_historical_note_headings_and_fences_cannot_escape_the_snapshot():
    body = "## To-Be\n旧署名URL契約\n### Delta\n未実施\n~~~~text\n## コード内\n~~~"
    spec = {"chapter_notes": {"backend": [
        {"heading": "歴史的スナップショット（現行規範ではない）", "body": body,
         "reason": "旧章の本文を保全"},
        {"heading": "現在のWorker経由契約", "body": "Worker経由で検査する。", "reason": "本人の選択"},
    ]}}
    before = copy.deepcopy(spec)
    rendered = chapters.render_chapter_notes(spec, "backend")
    assert "#### To-Be\n旧署名URL契約\n##### Delta\n未実施" in rendered
    assert "~~~~text\n## コード内\n~~~\n~~~~" in rendered
    assert "### 現在のWorker経由契約" in rendered.splitlines()
    assert rendered.count("\n## ") == 1  # The sole embedded h2 is literal code.
    assert "注記" in rendered and "フェンス" in rendered and "押し下げ" in rendered
    assert chapters.seal_code_fences(rendered)[1] is False
    assert spec == before


def test_unchanged_plain_note_does_not_gain_a_formatting_warning():
    rendered = chapters.render_chapter_notes(
        {"chapter_notes": {"backend": [{"heading": "現在契約", "body": "通常の本文。"}]}},
        "backend",
    )
    assert "通常の本文。" in rendered
    assert "押し下げ" not in rendered and "フェンス" not in rendered


def test_initial_answer_heading_stays_a_heading_in_both_renderers():
    qa = {"qa-test": {"question": "問い", "answer": "## 集計層\n本文"}}
    rendered = chapters.render_confirmed_qa(
        {"matrix": {"backend": {"web": {"state": "確定", "qa_ref": "qa-test"}}},
         "qa_log": [{"id": "qa-test", **qa["qa-test"]}]}, "backend",
    )
    applied = "\n".join(chapters._render_application_entry(qa, "qa-test", ["web"], label="確定内容"))
    assert "#### 集計層" in rendered.splitlines()
    assert "###### 集計層" in applied.splitlines()
