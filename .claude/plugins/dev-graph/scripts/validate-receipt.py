#!/usr/bin/env python3
"""validate-receipt: 任意の registration receipt の真正性を単独検証する。

register-package.py の register 経路には immutable receipt 再登録時の同等検査があるが、
**任意の receipt を外から検証する入口** が無かったため、手書き receipt が検出されずに
下流 (render の --registration-receipt など) へ流れ込む余地が残っていた。

このスクリプトは register-package.py とは別ファイルに独立させている。理由は 2 つ:
(1) receipt の事後検証は「登録」とは別責務であり、register 本体に混ぜる必然が無い。
(2) run-dev-graph-node (C02) は register-package.py を script_ref で宣言しており、
    その behavior closure に含まれる。register-package.py に無関係な関数を足すと node の
    live-trial 証跡が byte 単位で失効する (closure は file 単位の digest)。検証入口を
    別ファイルにすれば node の挙動面 digest を動かさずに機能を追加できる。

検査ロジックの SSOT (schema 検証・digest 計算) は register-package.py 側にあるため、
共有ヘルパは importlib で借用する (lint-live-trial-verdict.py と同じ流儀)。
"""
from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
PLUGIN_ROOT = HERE.parent

# register-package.py はハイフン名で通常 import できないため importlib で動的ロードする。
# main() は __main__ ガード内にあり import 時副作用は無い。_common 解決のため scripts/ を
# sys.path へ入れてからロードする。
sys.path.insert(0, str(HERE))
_spec = importlib.util.spec_from_file_location(
    "_dev_graph_register_package", HERE / "register-package.py"
)
assert _spec and _spec.loader
_rp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rp)

# 借用シンボル (SSOT は register-package.py)。_canonical_digest は本モジュールからも
# 参照できるよう再公開する (テストが RP._canonical_digest を突合に使う)。
ContractError = _rp.ContractError
dump = _rp.dump
PHASES = _rp.PHASES
_json_object = _rp._json_object
_validate_schema = _rp._validate_schema
_canonical_digest = _rp._canonical_digest


def validate_receipt(receipt_path: Path, graph_path: Path | None = None) -> dict[str, Any]:
    """任意の registration receipt が register-package.py の発行物として整合するか検証する。

    schema だけでは表現できない構造不変条件を検査する。

    実際に `eval-log/dev-graph/run-dev-graph-render/live-trial/20260721T180000-r7/` の
    live-trial で、`graph_revision_before=1 / after=15` という手書き receipt が使われ、
    schema・stale-sha・transcript 束縛のいずれにも掛からずに通過した。fixture は
    gitignore のため commit 差分ベースの provenance 検査も届かない。
    """
    receipt = _json_object(receipt_path)
    schema = _json_object(PLUGIN_ROOT / "schemas" / "package-registration-receipt.schema.json")
    violations: list[str] = []

    try:
        _validate_schema(receipt, schema, schema, "$")
    except ContractError as exc:
        violations.append(f"schema: {exc}")

    before, after = receipt.get("graph_revision_before"), receipt.get("graph_revision_after")
    if not isinstance(before, int) or not isinstance(after, int):
        violations.append("graph_revision: before/after が整数でない")
    elif after != before + 1:
        # 登録は 1 回の atomic write なので revision は必ず +1 になる。
        # 差が 1 でない receipt は登録時点の発行物ではない。
        violations.append(
            f"graph_revision: after({after}) != before({before}) + 1 "
            "— 登録は単一 atomic write のため必ず +1。手書き/事後改変の疑い"
        )

    counts = {
        "expected_count": receipt.get("expected_count"),
        "applied_count": receipt.get("applied_count"),
        "node_ids": len(receipt.get("node_ids") or []),
        "phase_refs": len(receipt.get("phase_refs") or []),
    }
    if set(counts.values()) != {13}:
        violations.append(f"exact-13: 件数が 13 で揃っていない {counts}")
    if receipt.get("phase_refs") != PHASES:
        violations.append("phase_refs: P01..P13 の完全集合でない")
    node_ids = receipt.get("node_ids") or []
    if len(node_ids) != len(set(node_ids)):
        violations.append("node_ids: 重複がある")

    registered_at = receipt.get("registered_at")
    if isinstance(registered_at, str) and not re.search(r"\.\d+", registered_at):
        # utc_now() は datetime.now(timezone.utc).isoformat() で必ず小数秒を含む
        # (microsecond がちょうど 0 になる確率は約 1e-6)。秒丸めは手書きの強い兆候。
        violations.append(
            f"registered_at: 小数秒が無い ({registered_at}) "
            "— utc_now() は必ず小数秒を含むため手書きの疑い"
        )

    if graph_path is not None:
        graph = _json_object(graph_path)
        digest = _canonical_digest(graph)
        if receipt.get("graph_digest_after") != digest:
            violations.append(
                f"graph_digest_after: receipt({receipt.get('graph_digest_after')}) != "
                f"実測({digest}) — 登録後に graph が変わったか receipt が改変された"
            )

    return {
        "valid": not violations,
        "receipt": receipt_path.as_posix(),
        "violations": violations,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="任意の registration receipt の真正性を単独検証する"
    )
    parser.add_argument("--receipt", required=True, help="検証する registration receipt JSON")
    parser.add_argument("--graph", help="指定時は graph_digest_after を実測突合する")
    try:
        args = parser.parse_args(argv)
        report = validate_receipt(Path(args.receipt), Path(args.graph) if args.graph else None)
        dump(report)
        return 0 if report["valid"] else 1
    except (ContractError, OSError, ValueError, KeyError, TypeError) as exc:
        dump({"valid": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
