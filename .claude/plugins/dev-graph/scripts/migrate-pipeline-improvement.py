#!/usr/bin/env python3
# /// script
# name: migrate-pipeline-improvement
# purpose: feat-dev-pipeline-improvement の冪等 migration。eval-log 直下の未参照ファイル再配置と improvement-handoff への disposition 遡及付与を行い、再実行しても差分 0 に収束する。
# inputs: [argv --repo-root --receipt --apply/--dry-run]
# outputs: [receipt JSON {moved, dispositions_added, core_handoff_audit}, exit 0 ok / 1 error]
# contexts: [E]
# network: false
# write-scope: eval-log/, plugin-plans/**/improvement-handoff*.json, --receipt
# requires-python: ">=3.11"
# ///
"""feat-dev-pipeline-improvement P08 冪等 migration。

正本契約: docs/features/feat-dev-pipeline-improvement/design.md §3.5 / §4 / §8。

3 つの遡及作業を冪等に行う:
  A. eval-log 直下の未参照ファイル (design §3.2 の movable 50 件) を skill 名 prefix の
     サブディレクトリへ移動する。移動先が既に正しい場合は no-op。
  C. improvement-handoff*.json (fixture 除外の 20 ファイル) の findings/improvements/clusters
     全 item へ disposition (applied|deferred|rejected) と根拠 ref を遡及付与し、
     schema_version を 1.1.0 へ引き上げる。既に完備なら no-op。
  E. migration-receipt.json を書き出す。dev-graph 中核 3 ファイル 31 findings の
     差分監査行 (core_handoff_audit) を含む。

再実行は必ず moved=0 / dispositions_added=0 に収束する (idempotent-migration 制約)。

Exit codes:
  0  成功 (適用 or dry-run)
  1  一般エラー
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

# --- A: eval-log 再配置 ------------------------------------------------------

# 直下 basename の prefix → 移動先サブディレクトリ。長い prefix を先に照合する。
_PREFIX_ROUTES: tuple[tuple[str, str], ...] = (
    ("run-dev-graph-system-spec-", "eval-log/dev-graph/run-dev-graph-system-spec"),
    ("run-dev-graph-requirements-", "eval-log/dev-graph/run-dev-graph-requirements"),
    ("run-dev-graph-decompose-", "eval-log/dev-graph/run-dev-graph-decompose"),
    ("run-dev-graph-node-confirm-", "eval-log/dev-graph/run-dev-graph-node"),
    ("run-dev-graph-node-", "eval-log/dev-graph/run-dev-graph-node"),
    ("run-dev-graph-sync-", "eval-log/dev-graph/run-dev-graph-sync"),
    ("run-system-spec-compile-", "eval-log/system-spec-harness/run-system-spec-compile"),
    ("run-system-spec-completeness-", "eval-log/system-spec-harness/completeness"),
    ("dry-notion-", "eval-log/notion-gmail-send/dry"),
    ("prompt-creator-", "eval-log/prompt-creator"),
    ("handoff-", "eval-log/legacy/handoff"),
    ("gate2-", "eval-log/legacy"),
    ("db-id-resolution", "eval-log/legacy"),
    ("skill-build-trace-", "eval-log/skill-creator"),
    ("skill-creation-report", "eval-log/skill-creator"),
    ("verification-", "eval-log/legacy/verification"),
)

# 恒久例外 (移動しない)。lint-eval-log-layout.py の _PERMANENT_EXEMPT と一致させる。
_KEEP_TOPLEVEL = frozenset({"README.md", ".gitignore", ".gitkeep"})


def _run_git(root: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True, check=True,
    )
    return proc.stdout


def _tracked_toplevel(root: Path) -> list[str]:
    out = _run_git(root, "ls-files", "-z", "--", "eval-log")
    return sorted(
        p for p in out.split("\0")
        if p and p.count("/") == 1 and Path(p).name not in _KEEP_TOPLEVEL
    )


def _is_referenced(root: Path, rel: str) -> bool:
    """rel が eval-log/ 以外の git 追跡ファイルから参照されているか。"""
    try:
        _run_git(root, "grep", "-q", "-F", rel, "--", ".", ":!eval-log")
        return True
    except subprocess.CalledProcessError:
        return False


def _route(basename: str) -> str:
    for prefix, dest in _PREFIX_ROUTES:
        if basename.startswith(prefix):
            return dest
    return "eval-log/legacy"


def reallocate(root: Path, apply: bool) -> list[dict]:
    moved: list[dict] = []
    for rel in _tracked_toplevel(root):
        if _is_referenced(root, rel):
            continue  # 凍結対象 (design §3.2)。移動すると参照が壊れる
        basename = Path(rel).name
        dest_dir = _route(basename)
        new_rel = f"{dest_dir}/{basename}"
        if new_rel == rel:
            continue  # 既に正しい配置 (idempotent)
        moved.append({"from": rel, "to": new_rel})
        if apply:
            (root / dest_dir).mkdir(parents=True, exist_ok=True)
            _run_git(root, "mv", rel, new_rel)
    return sorted(moved, key=lambda m: m["from"])


# --- C: disposition 遡及付与 -------------------------------------------------

_FINDING_ARRAYS = ("findings", "improvements", "clusters")
_FIXTURE_MARKERS = ("/fixtures/", "/finish/")
_RECORDED_AT = "2026-07-22T00:00:00Z"  # 決定論のため固定 (再実行で差分を生まない)
_HISTORICAL_TOTALS = {
    "initial_moved_count": 49,
    "initial_dispositions_added": 123,
    "evidence_commit": "b3bbbd41cc43b64a7b53db0bc3dd5e19b2d2774a",
}

# dev-graph 中核 3 ファイル 31 findings の差分監査 (design §8)。
# 各 finding id → (disposition, 根拠 ref)。applied は現行実装の実ファイルを指す。
_CORE_HANDOFFS = (
    "plugin-plans/dev-graph/improvement-handoff-macro.json",
    "plugin-plans/dev-graph/improvement-handoff-beads.json",
    "plugin-plans/dev-graph/improvement-handoff.json",
)

# P08 で現行実装と差分監査した中核 31 finding。値は、実装済みであることを
# 直接確認できる repository 相対 path と、判定理由。曖昧な umbrella issue を
# 根拠に applied とせず、finding ごとに実体へ結び付ける。
_CORE_APPLIED: dict[str, tuple[str, str]] = {
    "MM-01": ("plugins/dev-graph/schemas/graph-node.schema.json", "feature の第一級語彙と purpose/goal/scope/acceptance を schema が保持する。"),
    "MM-02": ("plugins/dev-graph/templates/template-contract.json", "feature を features/ へ配置する canonical template 契約がある。"),
    "MM-03": ("plugins/dev-graph/schemas/graph-node.schema.json", "task の parent_feature と feature 二層制約を schema 化した。"),
    "MM-04": ("plugins/dev-graph/skills/run-dev-graph-decompose/SKILL.md", "decompose を feature/architecture/機能間依存のマクロ分解へ限定した。"),
    "MM-05": ("plugins/dev-graph/skills/run-dev-graph-decompose/SKILL.md", "ready feature ごとの system-dev-planner 自動・手動共通経路を配線した。"),
    "MM-06": ("plugin-plans/dev-graph/goal-spec.json", "purpose/background をマクロ層の責務へ更新した。"),
    "MM-07": ("plugin-plans/dev-graph/goal-spec.json", "feature と per-feature planning の受入条件を checklist 化した。"),
    "MM-08": ("plugins/dev-graph/README.md", "マクロ/ミクロ二層モデルと verb 境界を利用者向けに記載した。"),
    "MM-09": ("plugins/dev-graph/scripts/validate-graph-schema.py", "feature、parent_feature、機能間依存を決定論検査する。"),
    "MM-10": ("plugins/dev-graph/scripts/schedule-graph.py", "feature ready と task ready を分離して算出する。"),
    "MM-11": ("plugins/dev-graph/templates/template-contract.json", "feature artifact の canonical template を追加した。"),
    "MM-12": ("plugins/dev-graph/references/execution-tracker-contract.md", "architecture_refs を lineage-pinned content として planner へ渡す境界を定義した。"),
    "EV-B01": ("plugins/dev-graph/schemas/repo-config.schema.json", "execution_tracker.mode を repository 設定として schema 化した。"),
    "EV-B02": ("plugins/dev-graph/schemas/graph-node.schema.json", "beads_linkage と tracker_binding を node schema に追加した。"),
    "EV-B03": ("plugins/dev-graph/scripts/bd-bridge.py", "bd CLI の決定論的な単一チョークポイントを実装した。"),
    "EV-B04": ("plugins/dev-graph/scripts/schedule-graph.py", "Beads binding は bridge の ready/parity 結果を利用する。"),
    "EV-B05": ("plugins/dev-graph/references/execution-tracker-contract.md", "binding ごとの単一 publication authority と二重起票禁止を定義した。"),
    "EV-B06": ("plugins/dev-graph/references/execution-tracker-contract.md", "tracker 選択、状態写像、完了カスケードを正本化した。"),
    "EV-B07": ("plugins/dev-graph/hooks/reconcile-task-lifecycle.py", "PR/Beads/ローカル task の完了収束を hook から共通処理する。"),
    "EV-B08": ("plugins/dev-graph/hooks/reconcile-task-lifecycle.py", "hook と worktree lease と Beads parity を統合した。"),
    "EV-B09": ("plugin-plans/dev-graph/goal-spec.json", "execution tracker 抽象化を受入 checklist へ追加した。"),
    "EV-B10": ("plugins/dev-graph/scripts/bd-bridge.py", "bd version window と JSON envelope 差異を bridge 内へ隔離した。"),
    "EV-001": ("plugins/dev-graph/templates/template-contract.json", "artifact kind ごとの directory policy と routing を定義した。"),
    "EV-002": ("plugins/dev-graph/schemas/graph-node.schema.json", "artifact 語彙と frontmatter authority を単一 schema に統一した。"),
    "EV-003": ("plugin-plans/dev-graph/phase-05-implementation.md", "P05-P12 の build/QA/evidence/documentation 到達条件を phase 仕様で分離した。"),
    "EV-004": ("plugins/dev-graph/commands/dev-graph.md", "command verb、引数、dispatch 先を単一表で整合させた。"),
    "EV-005": ("plugin-plans/dev-graph/phase-02-design.md", "件数増加時の split trigger と migration 境界を設計した。"),
    "EV-006": ("plugin-plans/dev-graph/plan-findings.json", "現行入力 digest に基づく findings を再生成した。"),
    "EV-007": ("plugins/dev-graph/templates/README.md", "artifact kind 別 template 正本と readiness 契約を文書化した。"),
    "EV-008": ("plugins/dev-graph/references/execution-tracker-contract.md", "system-spec-harness と system-dev-planner の引用・委譲境界を定義した。"),
    "EV-009": ("plugins/dev-graph/scripts/resolve-repo-context.py", "symlink 配布時も caller repository の root/state を安全に解決する。"),
}


def _default_disposition(rel: str, item: dict) -> tuple[str, str]:
    """1 item の disposition と根拠 ref を決める。

    差分監査の個別判定を持たない item は deferred + beads 追跡へ倒す
    (fail-closed の思想: 実装との突合で applied を確証できないものを applied にしない)。
    未消化 findings は beads 課題 HarnessHub-k2u (本 feature epic) で追跡する。
    """
    finding_id = item.get("id")
    if rel in _CORE_HANDOFFS and isinstance(finding_id, str) and finding_id in _CORE_APPLIED:
        return "applied", _CORE_APPLIED[finding_id][0]
    return "deferred", "bd:HarnessHub-k2u"


def _apply_dispositions(root: Path, apply: bool) -> tuple[int, list[str]]:
    added = 0
    touched: list[str] = []
    matched = sorted(root.glob("plugin-plans/**/improvement-handoff*.json"))
    for path in matched:
        rel = str(path.relative_to(root))
        if any(m in f"/{rel}" for m in _FIXTURE_MARKERS):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            continue
        changed = False
        if data.get("schema_version") != "1.1.0":
            data["schema_version"] = "1.1.0"
            data.pop("schema", None)  # legacy キーを除去
            changed = True
        for key in _FINDING_ARRAYS:
            array = data.get(key)
            if not isinstance(array, list):
                continue
            for item in array:
                if not isinstance(item, dict):
                    continue
                finding_id = item.get("id")
                if rel in _CORE_HANDOFFS and isinstance(finding_id, str) and finding_id in _CORE_APPLIED:
                    disposition, ref = _default_disposition(rel, item)
                    desired = {
                        "disposition": disposition,
                        "disposition_ref": ref,
                        "disposition_recorded_at": _RECORDED_AT,
                    }
                    if any(item.get(key) != value for key, value in desired.items()):
                        item.update(desired)
                        added += 1
                        changed = True
                    continue
                if item.get("disposition") in ("applied", "deferred", "rejected") \
                        and str(item.get("disposition_ref", "")).strip() \
                        and str(item.get("disposition_recorded_at", "")).strip():
                    continue
                disposition, ref = _default_disposition(rel, item)
                item.setdefault("disposition", disposition)
                item.setdefault("disposition_ref", ref)
                item.setdefault("disposition_recorded_at", _RECORDED_AT)
                added += 1
                changed = True
        if changed:
            touched.append(rel)
            if apply:
                path.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
    return added, sorted(touched)


def _core_audit(root: Path) -> list[dict]:
    """dev-graph 中核 3 ファイル 31 findings の差分監査行を生成する (design §8)。"""
    rows: list[dict] = []
    for rel in _CORE_HANDOFFS:
        path = root / rel
        if not path.is_file():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("findings", []):
            if not isinstance(item, dict):
                continue
            disposition, ref = _default_disposition(rel, item)
            finding_id = item.get("id")
            verified_path, rationale = _CORE_APPLIED.get(
                finding_id,
                (None, "現行実装との突合を要する未確定項目。beads epic で追跡 (deferred)。"),
            )
            rows.append({
                "handoff": rel,
                "finding_id": finding_id,
                "target_ref": item.get("target_ref"),
                "verified_path": verified_path,
                "disposition": disposition,
                "rationale": rationale,
            })
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--receipt", type=Path, default=None)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", dest="apply", action="store_true")
    mode.add_argument("--dry-run", dest="apply", action="store_false")
    parser.set_defaults(apply=False)
    args = parser.parse_args(argv)

    try:
        root = args.repo_root.resolve(strict=True)
        moved = reallocate(root, args.apply)
        added, touched = _apply_dispositions(root, args.apply)
        audit = _core_audit(root)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"[migrate-pipeline-improvement] ERROR: {exc}", file=sys.stderr)
        return 1

    receipt = {
        "migration": Path(__file__).stem,
        "mode": "apply" if args.apply else "dry-run",
        "moved": moved,
        "moved_count": len(moved),
        "dispositions_added": added,
        "handoffs_touched": touched,
        "core_handoff_audit": audit,
        "core_handoff_audit_count": len(audit),
        "historical_apply_totals": _HISTORICAL_TOTALS,
    }
    rendered = json.dumps(receipt, ensure_ascii=False, indent=2)
    print(rendered)
    if args.receipt and args.apply:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(rendered + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
