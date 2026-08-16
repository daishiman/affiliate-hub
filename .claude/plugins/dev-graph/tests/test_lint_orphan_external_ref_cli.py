"""scripts/lint-orphan-external-ref.py (HarnessHub-ii90) の CLI 契約検証。

検査ロジックそのもの (OE-001 / OE-002 の判定・分類・ratchet 適用) は
``test_lint_orphan_external_ref.py`` が lib に対して固定する。本ファイルは CLI 境界、
すなわち **argv の解釈・入力欠損時の落ち方・出力先・repo 側データ契約・Makefile 配線**
だけを見る。

分けている理由は、ここで守る不変条件がロジックではなく「運用時の壊れ方」だから。
baseline を指定し損ねたときに黙って免除ゼロへ落ちる、bd を引けないのに緑を返す、
live bd の要る検査を CI 束へ混ぜて恒久赤にする — いずれもロジックが正しくても起きる。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


# --- repo 側データ契約 (shrink-only ratchet の正本) -------------------------


def test_repo_baseline_data_is_shrink_only_and_documented(orphan_lint) -> None:
    """baseline の増加は本 lint の目的 (orphan を生む経路を塞ぐ) を無効化する。"""
    module = orphan_lint.module
    path = orphan_lint.repo_root / module._BASELINE_RELPATH
    if not path.exists():
        pytest.skip("baseline は repo 側データ。plugin 単体を持ち出した環境では存在しない")
    payload = json.loads(path.read_text(encoding="utf-8"))
    entries = payload[module._BASELINE_KEY]
    assert entries == sorted(entries), "差分レビューを容易に保つため整列を維持する"
    assert len(entries) == len(set(entries))
    assert "増やしてはならない" in "".join(payload["_comment"])


# --- baseline の入力解決: 欠損を免除と取り違えない -------------------------


def test_absent_default_baseline_grants_no_exemption(tmp_path: Path, orphan_lint) -> None:
    """baseline 欠損は免除ゼロ (最も厳しい側)。ただし由来を残し暗黙に落ちない。"""
    baselined = orphan_lint.baselined
    root, export = orphan_lint.repo(
        tmp_path, node_ids=[], beads=[orphan_lint.issue("HarnessHub-old", baselined)],
        baseline=None,
    )
    code, result = orphan_lint.run(root, export)
    assert code == 2
    assert result["baseline_source"] == "absent"
    assert [row["external_ref"] for row in result["violations"]] == [baselined]


def test_explicit_baseline_that_cannot_be_read_fails_instead_of_silently_empty(
    tmp_path: Path, orphan_lint,
) -> None:
    """指定ミスを免除ゼロと区別できないまま続行すると、意図した免除が黙って消える。"""
    root, export = orphan_lint.repo(
        tmp_path, node_ids=[],
        beads=[orphan_lint.issue("HarnessHub-old", orphan_lint.baselined)],
    )
    missing = tmp_path / "nowhere.json"
    proc = subprocess.run(
        [sys.executable, str(orphan_lint.script), "--repo-root", str(root),
         "--beads-export", str(export), "--baseline", str(missing)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 1 and "baseline" in proc.stderr

    broken = tmp_path / "broken.json"
    broken.write_text('{"baselined_external_refs": "not-a-list"}', encoding="utf-8")
    proc2 = subprocess.run(
        [sys.executable, str(orphan_lint.script), "--repo-root", str(root),
         "--beads-export", str(export), "--baseline", str(broken)],
        capture_output=True, text=True, check=False,
    )
    assert proc2.returncode == 1 and "baseline" in proc2.stderr


# --- argv と出力先 ---------------------------------------------------------


def test_issue_id_filter_narrows_the_scan(tmp_path: Path, orphan_lint) -> None:
    root, export = orphan_lint.repo(
        tmp_path, node_ids=[],
        beads=[orphan_lint.issue("HarnessHub-a", "issue-x"),
               orphan_lint.issue("HarnessHub-b", "issue-y")],
    )
    code, result = orphan_lint.run(root, export, "--issue-id", "HarnessHub-b")
    assert code == 2 and result["scanned"] == 1
    assert [row["bd_issue_id"] for row in result["violations"]] == ["HarnessHub-b"]


def test_json_out_writes_the_same_payload(tmp_path: Path, orphan_lint) -> None:
    root, export = orphan_lint.repo(
        tmp_path, node_ids=[], beads=[orphan_lint.issue("HarnessHub-a", "issue-x")],
    )
    out = tmp_path / "receipt" / "orphan.json"
    code, result = orphan_lint.run(root, export, "--json-out", str(out))
    assert code == 2
    assert json.loads(out.read_text(encoding="utf-8")) == result


# --- 配線 -------------------------------------------------------------------


def test_makefile_wires_the_lint_outside_of_ci_targets(orphan_lint) -> None:
    """live bd が要る検査を CI 束 (lint/test) に混ぜると CI 恒久赤、CI に置くと恒久 no-op。

    `.beads/issues.jsonl` は gitignore 対象で CI には存在しないため、ローカル専用の
    独立ターゲットとして持つのが唯一整合する配置。
    """
    makefile = (orphan_lint.repo_root / "Makefile").read_text(encoding="utf-8")
    assert "orphan-external-ref:" in makefile
    command = next(
        line for line in makefile.splitlines()
        if "plugins/dev-graph/scripts/lint-orphan-external-ref.py" in line
    )
    assert "--scan-refs" in command
    test_target = next(line for line in makefile.splitlines() if line.startswith("test:"))
    lint_target = next(line for line in makefile.splitlines() if line.startswith("lint:"))
    assert "orphan-external-ref" not in test_target
    assert "orphan-external-ref" not in lint_target
