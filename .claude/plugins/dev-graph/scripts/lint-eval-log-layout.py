#!/usr/bin/env python3
# /// script
# name: lint-eval-log-layout
# purpose: eval-log/ 配置規約 (直下残置禁止・バイト同一重複禁止・1MiB 超の git 追跡禁止) を fail-closed で検査する。
# inputs: [argv --repo-root --eval-log-dir --max-bytes --allowlist --json-out]
# outputs: [stdout JSON {lint, scanned, violations, violation_count, exit_code}, exit 0 ok / 2 violation / 1 error]
# contexts: [E]
# network: false
# write-scope: --json-out 指定時のみ
# dependencies: []
# requires-python: ">=3.11"
# ///
"""eval-log/ の配置規約を機械検査する fail-closed lint。

正本契約: docs/features/feat-dev-pipeline-improvement/design.md §3。

規約:
  1. eval-log/ 直下に新規ファイルを置かない。skill 名 prefix のサブディレクトリ配下へ置く
  2. 同一バイト列のファイルを複数 path で git 追跡しない
  3. 1 MiB を超えるファイルを git 追跡しない

既存 91 件への適用は ratchet 方式を採る。他所から path 文字列で参照されている 40 件を
_FROZEN_RESIDUE として凍結し、2026-07-24 に揮発投影 8 件を追跡解除して現行 32 件とした。
それ以外の直下ファイルは即違反とする。凍結リストを外部ファイルではなく本 script 内の
定数に置くのは、「検査を通すための追記」を必ず diff 上で可視にするため
(緑化の誘因を構造的に潰す)。リストは shrink-only であり、エントリが実在しなくなった
場合は違反ではなく resolved_allowlist_entries として報告する。

検出 rule:
  EL-001  直下の git 追跡ファイルが凍結 allowlist にも恒久例外にも無い
  EL-002  同一 sha256 の git 追跡ファイル群のうち 1 つ以上が直下にある (0 byte は除外)
  EL-003  eval-log/ 配下の git 追跡ファイルが --max-bytes を超える

証跡ディレクトリの除外 (EL-002 / EL-003):
  path に /live-trial/ を含むものは digest 束縛済みの実行証跡であり、バイト同一性と
  サイズはその証跡の本質そのものである (別 run が同一出力を出したという事実、および
  transcript 実体の完全性)。これらへ重複排除・サイズ削減を課すと lint-live-trial-verdict.py
  --check-provenance の transcript 実体束縛を壊すため、両 rule の対象外とする。
  EL-002 を「直下を含む重複群」に限定するのも同じ理由で、run ごとの証跡サブディレクトリが
  同一内容を持つことは欠陥ではない。qa-067 が問題としたのは直下の反復変種である。

Exit codes:
  0  違反 0 件
  1  一般エラー (repo-root 不正・git 実行不能)
  2  違反検出 (fail-closed)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

LINT_NAME = "lint-eval-log-layout"
DEFAULT_MAX_BYTES = 1048576  # 1 MiB

# eval-log/ 直下に置くことが恒久的に認められるファイル名。
# ratchet の対象ではない (減らすべき残置ではない) ため _FROZEN_RESIDUE と分離する。
_PERMANENT_EXEMPT = frozenset({"README.md", ".gitignore", ".gitkeep"})

# 2026-07-21 実測の凍結 allowlist (凍結時 40 件)。
# いずれも eval-log/ 以外の git 追跡ファイルから path 文字列で参照されており、
# 移動すると SKILL.md / script / CI / digest 固定済み package 成果物の参照が壊れる。
# 追加は禁止 (追加したい場合は規約側の再設計が必要)。解消したら行ごと削除する。
# 2026-07-24: run-dev-graph-*-{progress,intermediate} 8 件を追跡解除して削除 (残 32 件)。
# .gitignore が同 8 件を除外宣言しており、SKILL.md の言及は実行時出力先の指定のみで
# 追跡内容への依存が無いため (HarnessHub-ym5)。再追跡は EL-001 で即検出される。
_FROZEN_RESIDUE = frozenset({
    "eval-log/code-coverage.json",
    "eval-log/dogfooding-fail-counter.json",
    "eval-log/fixture-results.json",
    "eval-log/handoff-prompt_done.json",
    "eval-log/harness-coverage-floor.json",
    "eval-log/harness-coverage.json",
    "eval-log/llm-coverage.json",
    "eval-log/mfk-gap-candidates.json",
    "eval-log/phase0-reference-inventory.json",
    "eval-log/prompt-creator-intermediate.jsonl",
    "eval-log/prompt-creator-trace.json",
    "eval-log/proposal-rubric-sync-2026-05-18.json",
    "eval-log/review-queue.jsonl",
    "eval-log/run-company-master-build-intermediate.jsonl",
    "eval-log/run-dev-graph-decompose-docs-coverage-audit-20260719.json",
    "eval-log/run-dev-graph-decompose-goal-spec.json",
    "eval-log/run-dev-graph-init-goal-spec.json",
    "eval-log/run-dev-graph-node-confirm-feat-stage0-distribution-gate.json",
    "eval-log/run-dev-graph-node-goal-spec.json",
    "eval-log/run-dev-graph-render-goal-spec.json",
    "eval-log/run-dev-graph-requirements-goal-spec.json",
    "eval-log/run-dev-graph-schedule-beads-ready.json",
    "eval-log/run-dev-graph-schedule-execution.json",
    "eval-log/run-dev-graph-schedule-goal-spec.json",
    "eval-log/run-dev-graph-status-execution.json",
    "eval-log/run-dev-graph-status-goal-spec.json",
    "eval-log/run-dev-graph-sync-goal-spec.json",
    "eval-log/run-dev-graph-system-spec-goal-spec.json",
    "eval-log/run-system-spec-completeness-report.json",
    "eval-log/skill-brief-prompt-creator.json",
    "eval-log/skill-build-trace.json",
    "eval-log/spec-drift.json",
})


# EL-003 の ratchet。qa-067 が「1MB 超は gitignore + 要約 JSON 化」と定めた対象のうち、
# 追跡を外すと既存 script (validate-harness-coverage.py 等) が壊れる 2 件を暫定凍結する。
# shrink-only。gitignore + 要約 JSON 化は依存 script の改修を伴うため follow-up 課題で解消する。
_FROZEN_OVERSIZE = frozenset({
    "eval-log/code-coverage.json",
    "eval-log/dev-graph/run-dev-graph-requirements/run-dev-graph-requirements-handoff.json",
})

# digest 束縛済み実行証跡の判定。ここに該当する path は EL-002 / EL-003 の対象外。
_EVIDENCE_MARKERS = ("/live-trial/",)


def _is_evidence(rel: str) -> bool:
    return any(marker in rel for marker in _EVIDENCE_MARKERS)


class LintError(Exception):
    """検査を続行できない一般エラー (exit 1)。"""


def _git_tracked(root: Path, rel_dir: str) -> list[str]:
    """rel_dir 配下の git 追跡ファイルを repo 相対 path で返す。

    規約は「git 追跡」に対して課される。実行時生成物 (git 管理外) は検査対象外。
    """
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z", "--", rel_dir],
            capture_output=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise LintError(f"git ls-files を実行できません: {exc}") from exc
    return sorted(p for p in proc.stdout.decode("utf-8").split("\0") if p)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_allowlist(path: Path | None) -> frozenset[str]:
    """--allowlist 指定時はそのファイルの内容で凍結リストを差し替える (テスト用)。"""
    if path is None:
        return _FROZEN_RESIDUE
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LintError(f"allowlist を読めません: {path}: {exc}") from exc
    if not isinstance(data, list) or not all(isinstance(x, str) for x in data):
        raise LintError(f"allowlist は string の配列である必要があります: {path}")
    return frozenset(data)


def lint(root: Path, rel_dir: str, max_bytes: int, allowlist: frozenset[str]) -> dict:
    tracked = _git_tracked(root, rel_dir)
    violations: list[dict] = []

    # EL-001: 直下残置。rel_dir 直下 = separator が 1 個だけの path。
    depth_of_dir = rel_dir.rstrip("/").count("/")
    for rel in tracked:
        if rel.count("/") != depth_of_dir + 1:
            continue
        if Path(rel).name in _PERMANENT_EXEMPT or rel in allowlist:
            continue
        violations.append({
            "rule": "EL-001",
            "path": rel,
            "detail": (
                f"{rel_dir}/ 直下への git 追跡は禁止されています。"
                f"skill 名 prefix のサブディレクトリ ({rel_dir}/<slug>/) 配下へ配置してください。"
            ),
        })

    # EL-002 / EL-003: 全 tracked ファイルを 1 回だけ走査する。
    by_digest: dict[str, list[str]] = {}
    for rel in tracked:
        absolute = root / rel
        if not absolute.is_file():
            continue  # index にあるが working tree に無い (削除途中) — 検査対象外
        if _is_evidence(rel):
            continue  # digest 束縛済みの実行証跡は重複・サイズの対象外
        size = absolute.stat().st_size
        if size > max_bytes and rel not in _FROZEN_OVERSIZE:
            violations.append({
                "rule": "EL-003",
                "path": rel,
                "detail": (
                    f"git 追跡ファイルが上限 {max_bytes} bytes を超えています ({size} bytes)。"
                    ".gitignore へ回し、要約 JSON を代わりに追跡してください。"
                ),
            })
        if size == 0:
            continue  # 0 byte の一致は意味を持たないため重複判定から除外
        by_digest.setdefault(_sha256(absolute), []).append(rel)

    for digest, paths in sorted(by_digest.items()):
        if len(paths) < 2:
            continue
        # 直下を 1 つも含まない重複群は run ごとの正当な同一出力なので違反にしない。
        if not any(p.count("/") == depth_of_dir + 1 for p in paths):
            continue
        ordered = sorted(paths)
        for rel in ordered:
            others = [p for p in ordered if p != rel]
            violations.append({
                "rule": "EL-002",
                "path": rel,
                "detail": (
                    f"バイト同一 (sha256:{digest[:12]}…) のファイルが複数 path で git 追跡されています: "
                    + ", ".join(others)
                ),
            })

    resolved = sorted(rel for rel in allowlist if not (root / rel).is_file())
    violations.sort(key=lambda v: (v["rule"], v["path"]))
    return {
        "lint": LINT_NAME,
        "repo_root": ".",
        "eval_log_dir": rel_dir,
        "max_bytes": max_bytes,
        "allowlist_size": len(allowlist),
        "resolved_allowlist_entries": resolved,
        "scanned": len(tracked),
        "violations": violations,
        "violation_count": len(violations),
        "exit_code": 2 if violations else 0,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--eval-log-dir", default="eval-log")
    parser.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES)
    parser.add_argument("--allowlist", type=Path, default=None,
                        help="凍結リストを差し替える JSON 配列 (テスト用)")
    parser.add_argument("--json-out", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        root = args.repo_root.resolve(strict=True)
        allowlist = _load_allowlist(args.allowlist)
        result = lint(root, args.eval_log_dir.rstrip("/"), args.max_bytes, allowlist)
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
            f"[{LINT_NAME}] FAIL: 配置規約違反 {result['violation_count']} 件",
            file=sys.stderr,
        )
    if result["resolved_allowlist_entries"]:
        print(
            f"[{LINT_NAME}] NOTE: 実在しない凍結エントリ "
            f"{len(result['resolved_allowlist_entries'])} 件。_FROZEN_RESIDUE から削除してください。",
            file=sys.stderr,
        )
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
