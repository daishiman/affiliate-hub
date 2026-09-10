#!/usr/bin/env python3
# /// script
# name: test-spec-state-merge
# version: 0.1.0
# purpose: 枝どうしの spec-state を追記専用ログだけ要素単位で合流させる経路の受入テスト。
#          落ちないこと (片側固有分の保存) と、勝手に決めないこと (衝突で止まる) の両方を固定する。
# inputs:
#   - argv: pytest 収集 (引数なし)
# outputs:
#   - pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""枝で積んだ判断の記録が、合流のときに黙って消えないことを確かめる。

この検査が守っているのは 2 つの性質で、どちらか一方だけでは足りない。

  落ちない — 片側にしか無い要素が合流後に在る。git のテキストマージは JSON 配列を
             要素単位で合流できないので、衝突すれば片方が丸ごと残る。しかも
             **落ちても validator は通る** (各ログは独立して整合するため)。

  勝手に決めない — 追記専用ログ以外の節が食い違うときは自動で解決せず止まる。
             `matrix` のセルを機械が選ぶと、根拠の無い確定が生まれる。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
WRITER_DIR = PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts"
WRITER_CLI = WRITER_DIR / "apply-spec-transition.py"
sys.path.insert(0, str(WRITER_DIR))
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import state_transition_merge as merge_mod  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402
from state_transition_matrix import (  # noqa: E402
    CURRENT_STATE_SCHEMA_VERSION,
    DESIGN_APPLICATION_CONTRACT_VERSION,
)


def _state(**sections) -> dict:
    base = {
        "schema_version": CURRENT_STATE_SCHEMA_VERSION,
        "design_application_contract_version": DESIGN_APPLICATION_CONTRACT_VERSION,
        "matrix": {},
        "qa_log": [],
        "approval_log": [],
        "reopen_log": [],
    }
    base.update(sections)
    return base


def _reopen(cell: str, reason: str) -> dict:
    return {"category": cell, "platform": "web", "from": "確定", "reason": reason}


# --- 落ちない ---------------------------------------------------------------


def test_entries_only_on_one_side_survive_the_merge():
    base = _state(qa_log=[{"id": "qa-a", "answer": "a"}])
    other = _state(qa_log=[{"id": "qa-b", "answer": "b"}])
    merged, report = merge_mod.merge_states(base, other)
    assert [row["id"] for row in merged["qa_log"]] == ["qa-a", "qa-b"]
    assert report["conflicts"] == []


def test_a_log_absent_on_the_base_side_is_taken_in_whole():
    """本ブランチに `retracted_qa_log` が無く、dev に 28 件あった形。"""
    base = _state()
    other = _state(retracted_qa_log=[{"id": f"qa-{i}", "reason": "r"} for i in range(28)])
    merged, report = merge_mod.merge_states(base, other)
    assert len(merged["retracted_qa_log"]) == 28
    assert report["conflicts"] == []


def test_the_same_id_retracted_twice_is_not_collapsed():
    """取り下げは**出来事**なので、同じ問答が 2 回取り下げられうる。

    id を鍵に束ねると 2 回目が消え、取り下げの経緯そのものが読めなくなる。
    2026-09-08 の dev 実測では 28 件中 7 つの id が 2 回ずつ現れていた。
    """
    twice = [
        {"id": "qa-x", "reason": "書面の出典が無い"},
        {"id": "qa-x", "reason": "書き直したが利用者の逐語ではなかった"},
    ]
    base = _state()
    other = _state(retracted_qa_log=twice)
    merged, _ = merge_mod.merge_states(base, other)
    assert merged["retracted_qa_log"] == twice


def test_positional_log_keeps_both_sides_after_the_common_prefix():
    shared = [_reopen("ui", f"共通 {i}") for i in range(3)]
    base = _state(reopen_log=shared + [_reopen("ui", "本ブランチのみ")])
    other = _state(reopen_log=shared + [_reopen("db", "dev のみ 1"), _reopen("db", "dev のみ 2")])
    merged, report = merge_mod.merge_states(base, other)
    assert len(merged["reopen_log"]) == 6
    assert merged["reopen_log"][:3] == shared
    assert report["logs"]["reopen_log"]["shared"] == 3
    assert report["conflicts"] == []


def test_identical_states_merge_to_themselves():
    rows = [{"id": "qa-a", "answer": "a"}]
    base = _state(qa_log=rows, reopen_log=[_reopen("ui", "r")])
    merged, report = merge_mod.merge_states(base, json.loads(json.dumps(base)))
    assert merged == base
    assert report["conflicts"] == []


# --- 勝手に決めない ---------------------------------------------------------


def test_the_same_id_with_different_content_is_a_conflict():
    base = _state(qa_log=[{"id": "qa-a", "answer": "本ブランチ"}])
    other = _state(qa_log=[{"id": "qa-a", "answer": "dev"}])
    _, report = merge_mod.merge_states(base, other)
    assert [c["kind"] for c in report["conflicts"]] == ["diverged_entry"]
    assert report["conflicts"][0]["id"] == "qa-a"


def test_a_diverged_matrix_cell_is_never_resolved_automatically():
    base = _state(matrix={"ui": {"web": {"state": "確定", "qa_ref": "qa-a"}}})
    other = _state(matrix={"ui": {"web": {"state": "確定", "qa_ref": "qa-b"}}})
    _, report = merge_mod.merge_states(base, other)
    conflict = next(c for c in report["conflicts"] if c["kind"] == "diverged_section")
    assert conflict["section"] == "matrix"
    # どのセルの何が食い違うかを名指しする。丸ごとの JSON を投げると人が読めない。
    assert any("matrix.ui.web.qa_ref" in diff for diff in conflict["diffs"])


def test_a_section_only_on_the_other_side_is_not_taken_in_silently():
    base = _state()
    other = _state(decisions=[{"id": "dec-a"}])
    merged, report = merge_mod.merge_states(base, other)
    assert "decisions" not in merged
    assert [c["kind"] for c in report["conflicts"]] == ["section_only_on_other"]


def test_a_section_only_on_the_base_side_is_kept():
    base = _state(decisions=[{"id": "dec-a"}])
    other = _state()
    merged, report = merge_mod.merge_states(base, other)
    assert merged["decisions"] == [{"id": "dec-a"}]
    assert report["conflicts"] == []


def test_the_same_entry_appearing_after_divergence_is_a_conflict():
    """連結すると二重になるが、2 回起きたのか取り込んだ結果かは区別できない。

    分岐後の**順序が違う**形にしてある。同じ順に並んでいるなら共通接頭辞が
    そこまで伸びるので、そもそも重複は起きない。
    """
    shared = [_reopen("ui", "共通")]
    both = _reopen("db", "両側に在る")
    base = _state(reopen_log=shared + [_reopen("ui", "本のみ"), both])
    other = _state(reopen_log=shared + [both, _reopen("db", "dev のみ")])
    _, report = merge_mod.merge_states(base, other)
    assert any(c["kind"] == "duplicated_after_divergence" for c in report["conflicts"])


def test_an_entry_without_a_string_id_in_a_keyed_log_is_a_conflict():
    base = _state(qa_log=[{"answer": "id が無い"}])
    other = _state(qa_log=[{"id": "qa-a", "answer": "a"}])
    _, report = merge_mod.merge_states(base, other)
    assert any(c["kind"] == "unkeyed_entry" for c in report["conflicts"])


def test_states_of_different_schema_versions_are_refused():
    base = _state()
    other = _state(schema_version="1.1")
    with pytest.raises(TransitionError, match="schema_version"):
        merge_mod.merge_states(base, other)


# --- CLI -------------------------------------------------------------------


def _write(path: Path, state: dict) -> Path:
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(WRITER_CLI), "merge", *args],
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_writes_the_merged_state(tmp_path: Path):
    base = _write(tmp_path / "base.json", _state(qa_log=[{"id": "qa-a", "answer": "a"}]))
    other = _write(tmp_path / "other.json", _state(qa_log=[{"id": "qa-b", "answer": "b"}]))
    result = _run("--state", str(base), "--other", str(other))
    assert result.returncode == 0, result.stderr
    written = json.loads(base.read_text(encoding="utf-8"))
    assert [row["id"] for row in written["qa_log"]] == ["qa-a", "qa-b"]


def test_cli_dry_run_writes_nothing(tmp_path: Path):
    base_state = _state(qa_log=[{"id": "qa-a", "answer": "a"}])
    base = _write(tmp_path / "base.json", base_state)
    before = base.read_bytes()
    other = _write(tmp_path / "other.json", _state(qa_log=[{"id": "qa-b", "answer": "b"}]))
    result = _run("--state", str(base), "--other", str(other), "--dry-run")
    assert result.returncode == 0, result.stderr
    assert base.read_bytes() == before
    # 何が合流するかは、書かない回でも見えていること。
    assert "qa_log" in result.stderr


def test_cli_stops_and_writes_nothing_on_conflict(tmp_path: Path):
    base = _write(tmp_path / "base.json", _state(qa_log=[{"id": "qa-a", "answer": "本"}]))
    before = base.read_bytes()
    other = _write(tmp_path / "other.json", _state(qa_log=[{"id": "qa-a", "answer": "dev"}]))
    result = _run("--state", str(base), "--other", str(other))
    assert result.returncode == 1
    assert base.read_bytes() == before
    assert "衝突" in result.stderr


def test_cli_refuses_a_legacy_state(tmp_path: Path):
    """版が古い state は読み取り専用。合流はその門を迂回する裏口にならない。"""
    legacy = _state()
    legacy["schema_version"] = "1.0"
    base = _write(tmp_path / "base.json", legacy)
    other = _write(tmp_path / "other.json", _state())
    result = _run("--state", str(base), "--other", str(other))
    assert result.returncode == 1
    assert "legacy spec-state" in result.stderr
