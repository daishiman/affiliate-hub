#!/usr/bin/env python3
# /// script
# name: test-compile-spec-doc-cli
# version: 0.1.0
# purpose: compile-spec-doc CLI の成功・異常系を検証する。500行上限を守るため本体の文書内容テストから分離する。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=PASS / 非0=FAIL
# contexts: [C, E]
# network: false
# write-scope: none (tmp_path のみ)
# dependencies: []
# requires-python: ">=3.9"
# ///
"""run-system-spec-compile の CLI 契約を独立して検証する。"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
FIXTURES = SKILL_DIR / "fixtures"
SPEC = FIXTURES / "spec-state.json"
REFS = FIXTURES / "fetched-references.json"
spec = importlib.util.spec_from_file_location("compile_spec_doc_cli", SKILL_DIR / "scripts" / "compile-spec-doc.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def _parse_frontmatter(text: str) -> dict:
    fm: dict = {}
    for line in text.split("---", 2)[1].splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fm[key.strip()] = value.strip()
    return fm


def test_cli_compile_writes_docset(tmp_path):
    out_dir = tmp_path / "system-spec"
    rc = mod.main(["compile", "--spec", str(SPEC), "--references", str(REFS), "--out-dir", str(out_dir)])
    assert rc == 0
    assert (out_dir / "index.md").is_file()
    assert _parse_frontmatter((out_dir / "database.md").read_text(encoding="utf-8"))["status"] == "confirmed"


def test_cli_compile_matches_golden(tmp_path):
    out_dir = tmp_path / "system-spec"
    assert mod.main(["compile", "--spec", str(SPEC), "--references", str(REFS), "--out-dir", str(out_dir)]) == 0
    assert (out_dir / "index.md").read_text(encoding="utf-8") == (FIXTURES / "expected-index.md").read_text(encoding="utf-8")


def test_cli_bad_spec_returns_1(tmp_path):
    rc = mod.main(["compile", "--spec", str(tmp_path / "nope.json"), "--references", str(REFS), "--out-dir", str(tmp_path / "o")])
    assert rc == 1


def test_cli_compile_error_returns_1(tmp_path):
    bad_spec = tmp_path / "bad.json"
    bad_spec.write_text(json.dumps({"platforms": [], "matrix": {}}), encoding="utf-8")
    assert mod.main(["compile", "--spec", str(bad_spec), "--references", str(REFS), "--out-dir", str(tmp_path / "o")]) == 1


def test_write_docset_creates_files(tmp_path):
    written = mod.write_docset({"a.md": "hello", "index.md": "idx\n"}, tmp_path / "out")
    assert len(written) == 2
    assert (tmp_path / "out" / "a.md").read_text(encoding="utf-8") == "hello\n"


def test_load_json_roundtrip(tmp_path):
    path = tmp_path / "x.json"
    path.write_text(json.dumps({"k": 1}), encoding="utf-8")
    assert mod.load_json(str(path)) == {"k": 1}
