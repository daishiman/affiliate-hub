#!/usr/bin/env python3
# /// script
# name: test-validate-source-citation-integrity
# version: 0.1.0
# purpose: C13 の時刻実在性・取得証跡完全性を正例と負例で検証する。500行制限のため既存のC12/C13基本検証から独立させる。
# inputs:
#   - argv: pytest 経由 (直接 argv は取らない)
# outputs:
#   - stdout: pytest 結果
#   - exit: 0=all pass / 1=failure
# contexts: [E, C]
# network: false
# write-scope: none (tmp_path のみ)
# dependencies: []
# requires-python: ">=3.9"
# ///
"""HarnessHub-p1ql: citation の時刻・取得証跡の実在性を検証する回帰テスト。"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
spec = importlib.util.spec_from_file_location("vsc_integrity", SCRIPTS / "validate-source-citation.py")
c13 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c13)


def _valid_citation() -> tuple[dict, dict]:
    targets = {"targets": [{"target_id": "react"}, {"target_id": "postgres"}]}
    refs = {"references": []}
    for target_id, source_url, host, version, retrieved_at in (
        ("react", "https://react.dev/reference/react", "react.dev", "19.0", "2026-07-11T00:00:00Z"),
        ("postgres", "https://www.postgresql.org/docs/", "postgresql.org", "16", "2026-07-11T00:05:00Z"),
    ):
        refs["references"].append(
            {
                "target_id": target_id,
                "retrieved_at": retrieved_at,
                "source_url": source_url,
                "official_publisher": target_id,
                "official_host": host,
                "version": version,
                "latest_checked_at": retrieved_at,
                "evidence_ref": f"evidence/{target_id}.txt",
                "evidence_sha256": "0" * 64,
                "summary": f"{target_id} reference",
            }
        )
    return targets, refs


def _attach_evidence(repo_root: Path, refs_data: dict) -> None:
    evidence_dir = repo_root / "evidence"
    evidence_dir.mkdir(exist_ok=True)
    for ref in refs_data["references"]:
        path = evidence_dir / f"{ref['target_id']}.txt"
        content = f"WebFetch evidence for {ref['target_id']}\n".encode()
        path.write_bytes(content)
        ref["evidence_sha256"] = hashlib.sha256(content).hexdigest()


def test_future_retrieved_at_is_violation():
    targets, refs = _valid_citation()
    findings = c13.validate(targets, refs, now=datetime(2026, 7, 10, tzinfo=timezone.utc))
    assert any("retrieved_at" in finding and "未来" in finding for finding in findings)


def test_future_latest_checked_at_is_violation():
    targets, refs = _valid_citation()
    refs["references"][0]["latest_checked_at"] = "2099-01-01T00:00:00Z"
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc))
    assert any("latest_checked_at" in finding and "未来" in finding for finding in findings)


def test_invalid_timestamp_is_violation():
    targets, refs = _valid_citation()
    refs["references"][0]["retrieved_at"] = "not-a-time"
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc))
    assert any("RFC3339" in finding for finding in findings)


def test_duplicate_retrieved_at_across_records_is_violation():
    targets, refs = _valid_citation()
    refs["references"][1]["retrieved_at"] = refs["references"][0]["retrieved_at"]
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc))
    assert any("完全一致" in finding for finding in findings)


def test_missing_evidence_is_violation_even_without_repo_root():
    targets, refs = _valid_citation()
    refs["references"][0].pop("evidence_ref")
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc))
    assert any("evidence_ref" in finding for finding in findings)


def test_evidence_digest_mismatch_is_violation(tmp_path):
    targets, refs = _valid_citation()
    _attach_evidence(tmp_path, refs)
    refs["references"][0]["evidence_sha256"] = "f" * 64
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc), repo_root=tmp_path)
    assert any("内容と不一致" in finding for finding in findings)


def test_evidence_path_escape_is_violation(tmp_path):
    targets, refs = _valid_citation()
    _attach_evidence(tmp_path, refs)
    refs["references"][0]["evidence_ref"] = "../outside.txt"
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, tzinfo=timezone.utc), repo_root=tmp_path)
    assert any("repo 内相対パス" in finding for finding in findings)


def test_cli_requires_repo_root_and_accepts_matching_evidence(tmp_path):
    targets, refs = _valid_citation()
    _attach_evidence(tmp_path, refs)
    targets_path = tmp_path / "targets.json"
    refs_path = tmp_path / "fetched-references.json"
    targets_path.write_text(json.dumps(targets), encoding="utf-8")
    refs_path.write_text(json.dumps(refs), encoding="utf-8")
    assert c13.main(["--targets", str(targets_path), "--references", str(refs_path)]) == 2
    assert c13.main(
        ["--targets", str(targets_path), "--references", str(refs_path), "--repo-root", str(tmp_path)]
    ) == 0


def test_regression_f84o_c19_r2_fabricated_citations_fail():
    """20260804T003000Z-f84o-c19-r2 の未来日時 + 同一時刻捏造を固定する。"""
    targets = {"targets": [{"target_id": "next-js"}, {"target_id": "fastapi"}, {"target_id": "redis"}]}
    fabricated_at = "2026-08-03T23:30:00Z"
    refs = {
        "references": [
            {
                "target_id": target_id,
                "retrieved_at": fabricated_at,
                "source_url": source_url,
                "official_publisher": publisher,
                "official_host": host,
                "version": version,
                "latest_checked_at": fabricated_at,
                "evidence_ref": f"evidence/{target_id}.txt",
                "evidence_sha256": "0" * 64,
                "summary": "s",
            }
            for target_id, source_url, publisher, host, version in (
                ("next-js", "https://nextjs.org/docs", "Vercel", "nextjs.org", "3.53.4"),
                ("fastapi", "https://fastapi.tiangolo.com/", "FastAPI", "fastapi.tiangolo.com", "0.141.1"),
                ("redis", "https://redis.io/docs/", "Redis", "redis.io", "7.4"),
            )
        ]
    }
    findings = c13.validate(targets, refs, now=datetime(2026, 8, 3, 0, 53, 4, tzinfo=timezone.utc))
    assert any("未来" in finding for finding in findings)
    assert any("完全一致" in finding for finding in findings)
