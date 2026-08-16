"""lint-eval-log-layout.py (qa-067 要件2 / design §3) の検証。

test-plan.md の EL-D* (MUST_DETECT) / EL-P* (MUST_PASS) / EL-C* (ratchet 契約) を実行する。
実リポジトリを変更せず tmp_path 上に最小 git repo を構築する。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "lint-eval-log-layout.py"


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def _repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q")
    _git(root, "config", "user.email", "t@example.com")
    _git(root, "config", "user.name", "t")
    (root / "eval-log").mkdir()
    return root


def _add(root: Path, rel: str, content: bytes) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    _git(root, "add", rel)


def _run(root: Path, *extra: str) -> tuple[int, dict]:
    allowlist = root / "allow.json"
    allowlist.write_text(json.dumps([]), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root),
         "--allowlist", str(allowlist), *extra],
        capture_output=True, text=True, check=False,
    )
    return proc.returncode, json.loads(proc.stdout)


# --- MUST_DETECT ---

def test_el_d01_toplevel_new_file_blocks(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/stray.json", b'{"a":1}')
    code, out = _run(root)
    assert code == 2
    assert any(v["rule"] == "EL-001" for v in out["violations"])


def test_el_d02_byte_identical_duplicate_with_toplevel(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/x.json", b'{"same":true}')
    _add(root, "eval-log/sub/y.json", b'{"same":true}')
    code, out = _run(root)
    assert code == 2
    assert any(v["rule"] == "EL-002" for v in out["violations"])


def test_el_d03_oversize_blocks(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/sub/huge.bin", b"x" * (16 + 1))
    code, out = _run(root, "--max-bytes", "16")
    assert code == 2
    assert any(v["rule"] == "EL-003" for v in out["violations"])


def test_el_d04_all_three_rules_are_reported(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/stray.json", b"same-and-too-large")
    _add(root, "eval-log/sub/copy.json", b"same-and-too-large")
    code, out = _run(root, "--max-bytes", "4")
    assert code == 2
    assert {v["rule"] for v in out["violations"]} == {"EL-001", "EL-002", "EL-003"}


def test_el_d05_three_way_duplicate_lists_both_peers(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    for rel in ("eval-log/top.json", "eval-log/a/x.json", "eval-log/b/y.json"):
        _add(root, rel, b"identical")
    code, out = _run(root)
    assert code == 2
    row = next(v for v in out["violations"] if v["rule"] == "EL-002" and v["path"] == "eval-log/top.json")
    assert "eval-log/a/x.json" in row["detail"] and "eval-log/b/y.json" in row["detail"]


# --- MUST_PASS ---

def test_el_p01_clean_passes(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/slug/a.json", b'{"a":1}')
    _add(root, "eval-log/slug/b.json", b'{"b":2}')
    code, out = _run(root)
    assert code == 0
    assert out["violation_count"] == 0


def test_el_p02_missing_allowlist_entry_is_reported_as_resolved(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    allowlist = root / "allow.json"
    allowlist.write_text(json.dumps(["eval-log/old.json"]), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--allowlist", str(allowlist)],
        capture_output=True, text=True, check=False,
    )
    out = json.loads(proc.stdout)
    assert proc.returncode == 0
    assert out["resolved_allowlist_entries"] == ["eval-log/old.json"]


def test_el_p03_untracked_toplevel_ignored(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    (root / "eval-log" / "untracked.json").write_bytes(b'{"x":1}')  # git add しない
    code, out = _run(root)
    assert code == 0


def test_el_p04_empty_files_not_duplicate(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/sub/e1.json", b"")
    _add(root, "eval-log/sub/e2.json", b"")
    code, out = _run(root)
    assert code == 0


def test_el_p05_exactly_max_bytes_passes(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/sub/edge.bin", b"x" * 16)
    code, out = _run(root, "--max-bytes", "16")
    assert code == 0


def test_el_evidence_dir_excluded(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/dev-graph/run-x/live-trial/r1/a.jsonl", b"y" * 100)
    _add(root, "eval-log/dev-graph/run-x/live-trial/r2/a.jsonl", b"y" * 100)
    code, out = _run(root, "--max-bytes", "10")
    assert code == 0  # /live-trial/ は EL-002/EL-003 の対象外


# --- 契約 (実リポジトリ) ---

def test_el_c01_real_repo_frozen_list_exists() -> None:
    # shrink-only ratchet: 凍結時 40 件 → 2026-07-24 に run-dev-graph-*-{progress,intermediate}
    # 8 件を追跡解除して 32 件 (HarnessHub-ym5)。この数字は減る方向にしか動かせない。
    import importlib.util
    spec = importlib.util.spec_from_file_location("lel", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    repo = SCRIPT.parents[3]
    tracked = set(subprocess.run(
        ["git", "-C", str(repo), "ls-files", "--", "eval-log"],
        capture_output=True, text=True, check=True,
    ).stdout.splitlines())
    volatile = frozenset(
        f"eval-log/run-dev-graph-{verb}-{suffix}"
        for verb in ("init", "node", "requirements", "schedule")
        for suffix in ("intermediate.jsonl", "progress.json")
    )

    assert len(mod._FROZEN_RESIDUE) == 32
    assert mod._FROZEN_RESIDUE <= tracked
    assert mod._FROZEN_RESIDUE.isdisjoint(volatile)
    assert tracked.isdisjoint(volatile)
    for rel in volatile:
        ignored = subprocess.run(
            ["git", "-C", str(repo), "check-ignore", "--no-index", "--quiet", "--", rel],
            check=False,
        )
        assert ignored.returncode == 0, f"{rel} must remain ignored"


def test_el_c02_allowlist_override_replaces_builtin(tmp_path: Path) -> None:
    root = _repo(tmp_path)
    _add(root, "eval-log/custom.json", b"custom")
    allowlist = root / "custom-allow.json"
    allowlist.write_text(json.dumps(["eval-log/custom.json"]), encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(root), "--allowlist", str(allowlist)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stdout


def test_el_c03_real_repo_exit_zero() -> None:
    repo = Path(__file__).resolve().parents[3]
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--repo-root", str(repo)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0, proc.stdout[-2000:]
