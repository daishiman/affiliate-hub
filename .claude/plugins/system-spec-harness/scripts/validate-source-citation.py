#!/usr/bin/env python3
# /// script
# name: validate-source-citation
# version: 0.1.0
# purpose: 取得対象一覧 (targets) と fetched-references.json を突合し、対象 ID ごとの参照が欠落 0 で、各エントリが retrieved_at/source_url/official_publisher/official_host/(version または last_updated)/latest_checked_at/evidence_ref/evidence_sha256 を保持し、source_url の host が宣言済み official_host と一致し、時刻と取得証跡が実在・対応することを検証する決定論ゲート (goal-spec C5 の形式・全件・host 一致・時刻/証跡実在性検査)。
# inputs:
#   - argv: --targets FILE --references FILE --repo-root DIR
# outputs:
#   - stdout: OK summary
#   - stderr: violation 一覧
#   - exit: 0=OK / 1=violation / 2=usage error
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""取得対象一覧と fetched-references.json の出典記録を機械検証する。

内容が現行最新版かの意味判定は C08 (doc-freshness-auditor) が公式サイトを再確認して担う。
本 script は形式・全件対応・host 一致・時刻実在性のみを決定論検証する。任意の --state
(spec-state.json) を渡すと、user_decision で採択済みの decision があるのに targets が空という
drift (「targets 空∧references 空 → OK」の vacuous-green) を warning surface する (exit は不変)。

時刻実在性検査 (HarnessHub-p1ql): retrieved_at/latest_checked_at が検証実行時刻より未来なら
violation とする (捏造の疑い)。また全 record の retrieved_at が完全一致する場合も violation
とする (実取得なら秒単位でばらけるはず)。全 record は `evidence_ref` (repo 相対パス) と
`evidence_sha256` を持つ。references が非空なら `--repo-root` を必須とし、repo 内の証跡ファイルの
実在と SHA-256 を突合する。

targets ファイルの期待形状:
{"targets": [{"target_id": "react", ...}, {"target_id": "postgres", ...}]}
  または {"targets": ["react", "postgres"]}   # 文字列 id の配列でも可

references ファイル (fetched-references.json) の期待形状:
{"references": [
  {"target_id": "react",
   "retrieved_at": "2026-07-11T00:00:00Z",
   "source_url": "https://react.dev/reference/react",
   "official_publisher": "Meta",
   "official_host": "react.dev",
   "version": "19.0",                # version または last_updated のいずれか必須
   "last_updated": "2026-06-01",
   "latest_checked_at": "2026-07-11T00:00:00Z",
   "evidence_ref": "system-spec/retrieval-evidence/react.json",
   "evidence_sha256": "<小文字16進数64桁のSHA-256>",
   "summary": "..."}
]}
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

REQUIRED_FIELDS = (
    "target_id",
    "retrieved_at",
    "source_url",
    "official_publisher",
    "official_host",
    "latest_checked_at",
    "evidence_ref",
    "evidence_sha256",
)
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")


def _target_ids(data: dict) -> list[str]:
    raw = data.get("targets", [])
    ids: list[str] = []
    for t in raw:
        if isinstance(t, str):
            ids.append(t)
        elif isinstance(t, dict) and t.get("target_id"):
            ids.append(t["target_id"])
    return ids


def _parse_iso(value: object) -> datetime | None:
    """RFC3339 時刻文字列を aware datetime へ。parse 不能・日付のみ・timezone 無しは None。"""
    if not isinstance(value, str) or not value:
        return None
    if "T" not in value:
        return None
    text = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    return dt if dt.tzinfo else None


def _resolve_evidence_path(repo_root: Path, evidence_ref: object) -> Path | None:
    """repo 相対の証跡パスだけを受理する。絶対/親方向参照と symlink escape は拒否する。"""
    if not isinstance(evidence_ref, str) or not evidence_ref:
        return None
    raw = Path(evidence_ref)
    if raw.is_absolute() or ".." in raw.parts:
        return None
    root = repo_root.resolve()
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate


def _norm_host(host: str) -> str:
    # 先頭が "www." のときだけ除去する。lstrip("www.") は文字集合 {w,.} の先頭除去で
    # `web.dev` -> `eb.dev` のように別 host を潰すため removeprefix を使う (F6)。
    return host.lower().removeprefix("www.") if host else ""


def _adopted_decision_ids(state_data: dict) -> list[str]:
    """spec-state の decisions[] から user_decision で採択済みの decision id を返す。

    採択済み技術は出典取得対象 (targets) の源泉であり、これが空でないのに targets が空なら
    「targets 空∧references 空 → OK」の vacuous-green を疑える (F3 の決定論可能な部分)。
    """
    decisions = state_data.get("decisions")
    if not isinstance(decisions, list):
        return []
    return [
        d.get("id")
        for d in decisions
        if isinstance(d, dict) and isinstance(d.get("user_decision"), dict)
    ]


def state_target_warnings(targets_data: dict, state_data: dict) -> list[str]:
    """採択技術があるのに targets が空という drift を surface する (F3・warning surface)。

    exit は変えない (既定の緑を壊さないため surface のみ)。決定論可能な範囲=user_decision で
    採択済みの decision が存在するのに取得対象が未登録、に限定する。
    """
    adopted = _adopted_decision_ids(state_data)
    if adopted and not _target_ids(targets_data):
        return [
            f"採択済み decision {adopted} が存在するが targets が空 "
            "(採択技術の出典取得対象が未登録・vacuous-green の疑い)"
        ]
    return []


def validate(
    targets_data: dict,
    refs_data: dict,
    *,
    now: datetime | None = None,
    repo_root: Path | None = None,
) -> list[str]:
    """`now` は検証実行時刻の注入 (省略時は実時刻)。テストは固定値を渡し決定論にする。

    `repo_root` を渡すと、必須の `evidence_ref` (repo 相対パス) と
    `evidence_sha256` を実ファイルへ突合する。`repo_root` を省略した直接関数呼出しは
    形状だけを検証する。CLI は non-empty references に --repo-root を必須化する。
    """
    findings: list[str] = []
    now = now or datetime.now(timezone.utc)

    target_ids = _target_ids(targets_data)

    refs = refs_data.get("references")
    if not isinstance(refs, list):
        findings.append("references: 配列でない")
        refs = []

    # 出典対象なし = targets 空 かつ references 空 → OK (exit0)。取得対象が 1 件も無い
    # 正当な状態 (外部技術を使わない / 未取得段階) でコンパイル動線を詰まらせない (F2)。
    # ※ targets 空だが references 非空 (orphan) / targets 非空だが references 欠落 は
    #   下の分岐で従来どおり違反として検出する。
    if not target_ids and not refs and not findings:
        return []

    if not target_ids:
        findings.append("targets: 対象 target_id が空 (取得対象一覧が無い)")

    by_id: dict[str, dict] = {}
    for i, ref in enumerate(refs):
        if not isinstance(ref, dict):
            findings.append(f"references[{i}]: オブジェクトでない")
            continue
        tid = ref.get("target_id")
        if not tid:
            findings.append(f"references[{i}]: target_id 欠落")
            continue
        if tid in by_id:
            findings.append(f"references: target_id={tid!r} が重複")
        by_id[tid] = ref

        # 必須フィールド
        for field in REQUIRED_FIELDS:
            if not ref.get(field):
                findings.append(f"references[{tid}]: 必須フィールド {field} が空/欠落")
        # version または last_updated のいずれか
        if not (ref.get("version") or ref.get("last_updated")):
            findings.append(
                f"references[{tid}]: version と last_updated の両方が空 (いずれか必須)"
            )
        # source_url host が official_host と一致
        src = ref.get("source_url")
        host = ref.get("official_host")
        if src and host:
            parsed_host = _norm_host(urlparse(src).netloc)
            if not parsed_host:
                findings.append(f"references[{tid}]: source_url={src!r} から host を解決できない")
            elif _norm_host(host) != parsed_host:
                findings.append(
                    f"references[{tid}]: source_url host={parsed_host!r} が official_host={host!r} と不一致"
                )

        # 時刻の形式と未来日時の拒否 (F1: 未来 = 捏造の疑い)。
        for field in ("retrieved_at", "latest_checked_at"):
            parsed_dt = _parse_iso(ref.get(field))
            if ref.get(field) and parsed_dt is None:
                findings.append(
                    f"references[{tid}]: {field}={ref[field]!r} が timezone 付き RFC3339 でない"
                )
            elif parsed_dt is not None and parsed_dt > now:
                findings.append(
                    f"references[{tid}]: {field}={ref[field]!r} が検証実行時刻 "
                    f"({now.isoformat()}) より未来 (捏造の疑い)"
                )

        # retrieval 痕跡の突合。絶対/親方向参照を許すと repo 外の任意ファイルを
        # 証跡として通せるため、repo 内相対パス + content digest の一致を必須にする。
        evidence_ref = ref.get("evidence_ref")
        if repo_root is not None and evidence_ref:
            evidence_path = _resolve_evidence_path(repo_root, evidence_ref)
            if evidence_path is None:
                findings.append(
                    f"references[{tid}]: evidence_ref={evidence_ref!r} は repo 内相対パスでなければならない"
                )
            elif not evidence_path.is_file():
                findings.append(
                    f"references[{tid}]: evidence_ref={evidence_ref!r} が repo 内に実在しない "
                    "(retrieval 痕跡の突合失敗)"
                )
            else:
                actual_digest = hashlib.sha256(evidence_path.read_bytes()).hexdigest()
                expected_digest = ref.get("evidence_sha256")
                if not isinstance(expected_digest, str) or not SHA256_HEX.fullmatch(expected_digest):
                    findings.append(
                        f"references[{tid}]: evidence_sha256 は小文字16進数64桁の SHA-256 でなければならない"
                    )
                elif actual_digest != expected_digest:
                    findings.append(
                        f"references[{tid}]: evidence_sha256 が evidence_ref の内容と不一致 "
                        "(retrieval 痕跡の改変または record 取り違え)"
                    )

    # 全件対応 (欠落 0)
    missing = [t for t in target_ids if t not in by_id]
    if missing:
        findings.append(f"対象 target_id の参照欠落: {missing}")

    # 同一定数の検出 (F2: 全 record の retrieved_at が完全一致 = 実取得なら秒単位でばらけるはず)
    retrieved_ats = [by_id[t].get("retrieved_at") for t in by_id if by_id[t].get("retrieved_at")]
    if len(retrieved_ats) >= 2 and len(set(retrieved_ats)) == 1:
        findings.append(
            f"references: 全 {len(retrieved_ats)} 件の retrieved_at が {retrieved_ats[0]!r} で完全一致 "
            "(同時刻の一括捏造の疑い)"
        )

    return findings


def _load(path_str: str, label: str) -> tuple[dict | None, int]:
    path = Path(path_str)
    if not path.is_file():
        print(f"{label} ファイルが存在しない: {path_str}", file=sys.stderr)
        return None, 2
    try:
        return json.loads(path.read_text(encoding="utf-8")), 0
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"{label} ファイルの JSON parse 失敗: {exc}", file=sys.stderr)
        return None, 2


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="出典記録の決定論検証 (goal-spec C5)")
    ap.add_argument("--targets", required=True, help="取得対象一覧 JSON のパス")
    ap.add_argument("--references", required=True, help="fetched-references.json のパス")
    ap.add_argument(
        "--state",
        help="spec-state.json (任意)。採択済み decision があるのに targets 空の drift を warning surface (F3)",
    )
    ap.add_argument(
        "--repo-root",
        help="reference の evidence_ref/evidence_sha256 の実在突合に使う repo root (references 非空時は必須)",
    )
    args = ap.parse_args(argv)

    targets_data, rc = _load(args.targets, "targets")
    if rc:
        return rc
    refs_data, rc = _load(args.references, "references")
    if rc:
        return rc

    if args.state:
        state_data, rc = _load(args.state, "state")
        if rc:
            return rc
        for warning in state_target_warnings(targets_data, state_data):
            print(f"WARNING: {warning}", file=sys.stderr)

    refs = refs_data.get("references")
    if isinstance(refs, list) and refs and not args.repo_root:
        print("--repo-root は references が非空のとき必須 (retrieval 証跡を突合するため)", file=sys.stderr)
        return 2
    repo_root = Path(args.repo_root) if args.repo_root else None
    if repo_root is not None and not repo_root.is_dir():
        print(f"repo root が存在しないかディレクトリでない: {repo_root}", file=sys.stderr)
        return 2
    findings = validate(targets_data, refs_data, repo_root=repo_root)
    if findings:
        for f in findings:
            print(f"VIOLATION: {f}", file=sys.stderr)
        print(f"FAIL: {len(findings)} 件の出典記録違反", file=sys.stderr)
        return 1
    print("OK: 出典記録が全件対応・必須フィールド・公式 host・時刻・取得証跡の一致を満たす")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
