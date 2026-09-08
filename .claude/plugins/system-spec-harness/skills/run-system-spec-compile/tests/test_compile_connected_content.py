"""Only a source-backed copy may be removed during canonical regeneration."""
from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

import spec_docset_foundation as foundation
from spec_docset_legacy import legacy_summary_is_connected


def test_relocated_note_is_not_retained_again_as_handwriting(tmp_path):
    original = "## To-Be\n\n| REQ-1 | 本文を保持する |\n"
    generated = "## 章の注記 (chapter_notes)\n\n### 歴史記録\n\n#### To-Be\n\n| REQ-1 | 本文を保持する |\n"
    path = tmp_path / "backend.md"
    path.write_text(original, encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve")
    assert path.read_text(encoding="utf8") == generated


def test_matching_heading_is_not_enough_to_discard_unique_content(tmp_path):
    original = "## To-Be\n\n| REQ-1 | 章にしかない規範 |\n"
    generated = "## 章の注記 (chapter_notes)\n\n### 歴史記録\n\n#### To-Be\n\n別の内容\n"
    path = tmp_path / "backend.md"
    path.write_text(original, encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve")
    assert "| REQ-1 | 章にしかない規範 |" in path.read_text(encoding="utf8")


def test_duplicate_headings_keep_both_distinct_sections(tmp_path):
    original = "## 記録\n\n最初の記録\n\n## 記録\n\n次の記録\n"
    path = tmp_path / "backend.md"
    path.write_text(original, encoding="utf8")
    foundation.write_docset({path.name: "## 生成\n\n生成本文\n"}, tmp_path, on_handwritten="preserve")
    result = path.read_text(encoding="utf8")
    assert "最初の記録" in result
    assert "次の記録" in result
    assert foundation.RESIDUE_HEADING not in result
    before = result
    foundation.write_docset({path.name: "## 生成\n\n生成本文\n"}, tmp_path, on_handwritten="preserve")
    assert path.read_text(encoding="utf8") == before


def test_code_example_heading_is_not_moved_into_a_handwritten_section(tmp_path):
    generated = "## 生成\n\n````md\n## コード例の見出し\n```\n````\n"
    path = tmp_path / "backend.md"
    path.write_text(generated, encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve")
    assert path.read_text(encoding="utf8") == generated


def test_connected_proof_in_one_chapter_cannot_suppress_another_chapters_loss(tmp_path):
    (tmp_path / "a.md").write_text("## 歴史\n\n共有語句\n", encoding="utf8")
    (tmp_path / "b.md").write_text("## 生成\n\n共有語句\n", encoding="utf8")
    losses = []
    foundation.write_docset(
        {"a.md": "## 注記\n\n### 歴史\n\n共有語句\n", "b.md": "## 生成\n\n別の内容\n"},
        tmp_path, on_handwritten="preserve", loss_report=losses,
    )
    assert losses == [("b.md", ["共有語句"])]


def test_legacy_summary_requires_every_payload_line_to_have_a_source():
    spec = {"requirements_foundation": {"goals": [{"id": "G1", "text": "安全な公開"}]}}
    known = "## To-Be / Delta\n\n### 到達すべき状態 (To-Be)\n\n- **G1**: 安全な公開\n"
    assert legacy_summary_is_connected("## To-Be / Delta", known, spec, "backend")
    assert not legacy_summary_is_connected("## To-Be / Delta", known + "未接続の要求\n", spec, "backend")
    assert not legacy_summary_is_connected("## To-Be / Delta", known.replace("安全な公開", "無認証で公開"), spec, "backend")


def test_legacy_doctrine_does_not_discard_a_changed_authority():
    head = "## 上流指針 (doctrine anchors)"
    row = "| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | **未記入** |"
    assert legacy_summary_is_connected(head, head + "\n" + row, {}, "security")
    assert not legacy_summary_is_connected(head, head + "\n" + row.replace("OWASP", "独自指針"), {}, "security")


def test_writer_removes_only_source_backed_legacy_summary(tmp_path):
    spec = {"requirements_foundation": {"goals": [{"id": "G1", "text": "安全な公開"}]}}
    old = "## To-Be / Delta\n\n### 到達すべき状態 (To-Be)\n\n- **G1**: 安全な公開\n"
    path = tmp_path / "backend.md"
    path.write_text(old, encoding="utf8")
    generated = "## 生成\n\n現行の章本文\n"
    losses = []
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve", source_spec=spec, loss_report=losses)
    assert path.read_text(encoding="utf8") == generated
    assert losses == []


def test_legacy_qa_copy_is_removed_only_if_the_same_chapter_renders_its_body(tmp_path):
    spec = {"matrix": {"backend": {"web": {"state": "確定", "qa_ref": "qa-legacy"}}},
            "qa_log": [{"id": "qa-legacy", "question": "問い", "answer": "残す本文"}]}
    original = "## 章にしか無い記述 (正本へ未接続)\n\n### Web (web)\n\n#### 主たる接地根拠: `qa-legacy`\n\n**問**\n\n問い\n\n**答**\n\n残す本文\n"
    generated = "## 確定内容 (質疑録)\n\n### qa-legacy (対応セル: web)\n\n**質問**: 問い\n\n**回答**: 残す本文\n"
    path = tmp_path / "backend.md"
    path.write_text(original, encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve", source_spec=spec)
    assert path.read_text(encoding="utf8") == generated

    path.write_text(original.replace("残す本文", "章にしかない変更"), encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve", source_spec=spec)
    assert "章にしかない変更" in path.read_text(encoding="utf8")


def test_declared_empty_card_stub_does_not_keep_a_connected_qa_copy(tmp_path):
    original = "## 章にしか無い記述 (正本へ未接続)\n\n### 記録\n\n正本の本文\n\n### 旧カード\n\n- 出典カード: `card.md`\n"
    generated = "## 章の注記 (chapter_notes)\n\n### 注記\n\n#### 記録\n\n正本の本文\n"
    path = tmp_path / "backend.md"
    path.write_text(original, encoding="utf8")
    foundation.write_docset({path.name: generated}, tmp_path, on_handwritten="preserve",
                           source_spec={}, connected_subsections=frozenset({"旧カード"}))
    assert path.read_text(encoding="utf8") == generated
