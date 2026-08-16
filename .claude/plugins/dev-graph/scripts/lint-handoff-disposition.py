#!/usr/bin/env python3
# /// script
# name: lint-handoff-disposition
# purpose: improvement-handoff*.json の per-finding disposition (applied|deferred|rejected) と根拠 ref の必須化を fail-closed で検査する。
# inputs: [argv --repo-root --glob --json-out]
# outputs: [stdout JSON {lint, scanned, violations, violation_count, exit_code}, exit 0 ok / 2 violation / 1 error]
# contexts: [E]
# network: false
# write-scope: --json-out 指定時のみ
# dependencies: []
# requires-python: ">=3.11"
# ///
"""improvement-handoff の findings 消化状態を機械検査する fail-closed lint。

正本契約: docs/features/feat-dev-pipeline-improvement/design.md §4。

schema_version による新旧判別:
  1.0.0  既存形式。findings に消化状態が無い。**新規作成も据置も禁止** (HD-001)
  1.1.0  本 feature で新設。findings 全件に disposition / disposition_ref /
         disposition_recorded_at を要求する

1.0.0 を通さないのは「schema_version を据え置けば検査を回避できる」抜け道を原理的に
塞ぐため。逆向きの偽装 (1.1.0 を名乗るが disposition が無い) は HD-002 が捕捉する。
すなわち schema_version をどちらへ倒しても検査を逃れられない。legacy な `schema` キー
(値 "improvement-handoff/v1" 等) は schema_version 未設定として HD-001 が捕捉する。

消化対象の配列 (design §4 の R4 反映):
  findings[] だけでなく improvements[] / clusters[] も消化状態の対象とする。
  extract-system-blueprint 系 4 ファイルは improvements[]、mf-kessai round2 は
  clusters[] を使い、これらを「0-findings」と誤認すると 29 項目が検査を素通りする。
  3 配列のいずれかに要素があれば全要素へ disposition を要求する。

fixture の除外:
  path に /fixtures/ または /finish/ を含む handoff は golden fixture (別形状) であり
  検査対象から除外する。無記載の素通しを避けるため除外は明示ログに残す。

検出 rule:
  HD-001  schema_version が 1.1.0 でない (未設定・1.0.0・legacy schema キーを含む)
  HD-002  item に disposition が無い / enum 外
  HD-003  disposition_ref が無い・空文字・空白のみ
  HD-004  disposition_ref が path 形式なのに repo 内に実在しない
  HD-005  disposition_recorded_at が無い / ISO-8601 date-time として解釈できない

disposition_ref の形式:
  <repo 相対 path>              実在検査あり
  <repo 相対 path>#<anchor>     path 部分のみ実在検査
  bd:<issue-id>                 実在検査なし (beads 可用性へ依存させないため)

Exit codes:
  0  違反 0 件
  1  一般エラー
  2  違反検出 (fail-closed)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

LINT_NAME = "lint-handoff-disposition"
REQUIRED_SCHEMA_VERSION = "1.1.0"
DISPOSITIONS = ("applied", "deferred", "rejected")
DEFAULT_GLOB = "plugin-plans/**/improvement-handoff*.json"
# 消化状態を持つべき配列キー。いずれか存在する側を検査する。
FINDING_ARRAYS = ("findings", "improvements", "clusters")
# golden fixture 等、別形状で検査対象外にする path マーカー。
_FIXTURE_MARKERS = ("/fixtures/", "/finish/")


class LintError(Exception):
    """検査を続行できない一般エラー (exit 1)。"""


def _is_iso8601(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    text = value.strip()
    # datetime.fromisoformat は Python 3.11 以降 'Z' を受け付ける。
    try:
        dt.datetime.fromisoformat(text)
    except ValueError:
        return False
    return True


def _ref_path(ref: str) -> str | None:
    """disposition_ref から実在検査すべき path 部分を取り出す。検査不要なら None。"""
    text = ref.strip()
    if text.startswith("bd:"):
        return None
    return text.split("#", 1)[0]


def _check_finding(root: Path, rel: str, locator: str, finding: object) -> list[dict]:
    label = f"{rel}#{locator}"
    if not isinstance(finding, dict):
        return [{
            "rule": "HD-002",
            "path": rel,
            "finding_id": None,
            "detail": f"{label} が object ではありません",
        }]

    finding_id = finding.get("id") if isinstance(finding.get("id"), str) else None
    label = f"{rel}#{finding_id or locator}"
    violations: list[dict] = []

    disposition = finding.get("disposition")
    if disposition not in DISPOSITIONS:
        violations.append({
            "rule": "HD-002",
            "path": rel,
            "finding_id": finding_id,
            "detail": (
                f"{label} の disposition が未設定または enum 外です "
                f"(値={disposition!r} / 許容={'|'.join(DISPOSITIONS)})"
            ),
        })

    ref = finding.get("disposition_ref")
    if not isinstance(ref, str) or not ref.strip():
        violations.append({
            "rule": "HD-003",
            "path": rel,
            "finding_id": finding_id,
            "detail": f"{label} の disposition_ref が未設定または空です",
        })
    else:
        target = _ref_path(ref)
        if target is not None and not (root / target).exists():
            violations.append({
                "rule": "HD-004",
                "path": rel,
                "finding_id": finding_id,
                "detail": f"{label} の disposition_ref が指す path が実在しません: {target}",
            })

    if not _is_iso8601(finding.get("disposition_recorded_at")):
        violations.append({
            "rule": "HD-005",
            "path": rel,
            "finding_id": finding_id,
            "detail": (
                f"{label} の disposition_recorded_at が未設定または ISO-8601 date-time "
                f"として解釈できません (値={finding.get('disposition_recorded_at')!r})"
            ),
        })
    return violations


def _is_fixture(rel: str) -> bool:
    return any(marker in f"/{rel}" for marker in _FIXTURE_MARKERS)


def lint(root: Path, pattern: str) -> dict:
    matched = sorted(str(p.relative_to(root)) for p in root.glob(pattern) if p.is_file())
    excluded = [rel for rel in matched if _is_fixture(rel)]
    targets = [rel for rel in matched if not _is_fixture(rel)]
    violations: list[dict] = []
    findings_total = 0

    for rel in targets:
        try:
            data = json.loads((root / rel).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise LintError(f"handoff を読めません: {rel}: {exc}") from exc
        if not isinstance(data, dict):
            raise LintError(f"handoff が object ではありません: {rel}")

        version = data.get("schema_version")
        if version != REQUIRED_SCHEMA_VERSION:
            violations.append({
                "rule": "HD-001",
                "path": rel,
                "finding_id": None,
                "detail": (
                    f"schema_version が {REQUIRED_SCHEMA_VERSION} ではありません (値={version!r})。"
                    "disposition 必須形式へ移行してください。"
                ),
            })
            # 旧形式の item を個別検査しても同じ違反を大量に複製するだけなので打ち切る。
            continue

        # findings / improvements / clusters のいずれか存在する側を全部検査する。
        items: list[tuple[str, int, object]] = []
        for key in FINDING_ARRAYS:
            array = data.get(key)
            if array is None:
                continue
            if not isinstance(array, list):
                raise LintError(f"{key} が配列ではありません: {rel}")
            for index, item in enumerate(array):
                items.append((key, index, item))
        findings_total += len(items)
        for key, index, item in items:
            violations.extend(_check_finding(root, rel, f"{key}[{index}]", item))

    violations.sort(key=lambda v: (v["path"], v["rule"], v["finding_id"] or ""))
    return {
        "lint": LINT_NAME,
        "repo_root": ".",
        "glob": pattern,
        "scanned": len(targets),
        "excluded_fixtures": excluded,
        "findings_scanned": findings_total,
        "violations": violations,
        "violation_count": len(violations),
        "exit_code": 2 if violations else 0,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--glob", default=DEFAULT_GLOB)
    parser.add_argument("--json-out", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        root = args.repo_root.resolve(strict=True)
        result = lint(root, args.glob)
    except (LintError, OSError) as exc:
        print(f"[{LINT_NAME}] ERROR: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")

    if result["violation_count"]:
        print(
            f"[{LINT_NAME}] FAIL: disposition 規約違反 {result['violation_count']} 件 "
            f"({result['scanned']} ファイル / {result['findings_scanned']} findings 走査)",
            file=sys.stderr,
        )
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
