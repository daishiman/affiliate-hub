#!/usr/bin/env python3
# /// script
# name: build-fetched-references
# version: 0.1.0
# purpose: run-system-spec-doc-fetch R3 の記録形状を決定論的に組み立てる assembler。取得済みドキュメントの record を必須フィールド検証・source_url host と official_host の一致検証・retrieval evidence digest 形式検証付きで正規化し、fetched-references.json (共有データ契約) を出力する。恒久キャッシュ/ミラーリング/ネットワークは行わず WebSearch/WebFetch の取得結果を渡し込む純関数群として動く。内容が現行最新版かの意味判定は C08 が、対象一覧との全件対応と証跡実在の最終突合は plugin-root の validate-source-citation.py が担う。
# inputs:
#   - argv: assemble サブコマンドと --records FILE / --targets FILE / --out FILE
# outputs:
#   - fetched-references.json (stdout or --out)
#   - exit: 0=OK / 1=RecordError or IO / 2=usage error
# contexts: [E, C]
# network: false
# write-scope: fetched-references.json
# dependencies: []
# requires-python: ">=3.9"
# ///
"""fetched-references.json の記録形状を決定論的に組み立てる R3 assembler。

本モジュールは R3-record の唯一の組み立て経路であり、WebSearch/WebFetch で得た
取得結果 (record 素材) を受け取り、共有データ契約 (validate-source-citation.py と
一致) の形状へ正規化する。時刻はネットワーク/壁時計に依存せず入力 record が持つ
retrieved_at / latest_checked_at をそのまま採用する (再現性)。

record 素材 (入力) の期待形状:
  {"target_id": "react",
   "retrieved_at": "2026-07-11T00:00:00Z",
   "source_url": "https://react.dev/reference/react",
   "official_publisher": "Meta",
   "official_host": "react.dev",          # 省略時は source_url から導出
   "version": "19.0",                      # version または last_updated のいずれか必須
   "last_updated": "2026-06-01",
   "latest_checked_at": "2026-07-11T00:00:00Z",
   "evidence_ref": "system-spec/retrieval-evidence/react.json",
   "evidence_sha256": "<小文字16進数64桁のSHA-256>",
   "summary": "..."}

出力 (fetched-references.json):
  {"references": [<正規化 record>, ...]}
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

# 全 record が必ず持つべき素材フィールド (official_host は導出可なので別扱い)。
REQUIRED_INPUT_FIELDS = (
    "target_id",
    "source_url",
    "official_publisher",
    "retrieved_at",
    "latest_checked_at",
    "evidence_ref",
    "evidence_sha256",
    "summary",
)
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
# 正規化後の出力キー順 (契約の可読順)。存在するものだけ載せる。
OUTPUT_FIELD_ORDER = (
    "target_id",
    "retrieved_at",
    "source_url",
    "official_publisher",
    "official_host",
    "version",
    "last_updated",
    # 出力キーの allowlist なので、載せ忘れた欄は黙って落ちる (下の dict 内包表記)。
    # freshness_source を落とすと、出典自身の表明 (page-declared) が writer を通った
    # 瞬間に消え、C13 の取得日代入検査で正当な当日更新まで違反になる。
    "freshness_source",
    "latest_checked_at",
    "evidence_ref",
    "evidence_sha256",
    "summary",
)


class RecordError(Exception):
    """record 素材が形状契約に反するときに送出する。"""


_C13_CACHE = {}


def _c13():
    """C13 (validate-source-citation.py) を読み込む。ハイフン名なので importlib で解く。"""
    if "mod" not in _C13_CACHE:
        path = Path(__file__).resolve().parents[3] / "scripts" / "validate-source-citation.py"
        spec = importlib.util.spec_from_file_location("_c13_for_builder", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _C13_CACHE["mod"] = module
    return _C13_CACHE["mod"]


def norm_host(host: str) -> str:
    """host を小文字化し先頭 www. を落として比較用に正規化する。"""
    if not host:
        return ""
    # lstrip("www.") は文字集合 {w,.} の先頭剥がしで `web.dev`->`eb.dev` / `wix.com`->`ix.com`
    # のように別 host を破壊するため removeprefix を使う (C13 validate-source-citation.py の F6 と同一)。
    return host.lower().removeprefix("www.")


def host_of(url: str) -> str:
    """URL から正規化済み host を導出する (解決不能なら空文字)。"""
    return norm_host(urlparse(url or "").netloc)


def build_record(rec: dict) -> dict:
    """1 件の record 素材を契約形状へ正規化・検証する。

    - 必須素材フィールド欠落は RecordError。
    - version と last_updated のいずれも無ければ RecordError。
    - official_host は未指定なら source_url から導出し、指定時は host 一致を検証する。
    """
    if not isinstance(rec, dict):
        raise RecordError("record はオブジェクトでない")

    tid = rec.get("target_id")
    if not tid:
        raise RecordError("target_id が空/欠落")

    for field in REQUIRED_INPUT_FIELDS:
        if not rec.get(field):
            raise RecordError(f"{tid}: 必須フィールド {field} が空/欠落")

    if not (rec.get("version") or rec.get("last_updated")):
        raise RecordError(f"{tid}: version と last_updated の両方が空 (いずれか必須)")
    if not SHA256_HEX.fullmatch(str(rec.get("evidence_sha256", ""))):
        raise RecordError(f"{tid}: evidence_sha256 は小文字16進数64桁の SHA-256 必須")

    src = rec["source_url"]
    derived = host_of(src)
    if not derived:
        raise RecordError(f"{tid}: source_url={src!r} から host を解決できない")

    host = rec.get("official_host") or derived
    if norm_host(host) != derived:
        raise RecordError(
            f"{tid}: source_url host={derived!r} が official_host={host!r} と不一致"
        )

    normalized = dict(rec)
    normalized["official_host"] = host

    # 取得日代入と freshness_source の妥当性は C13 の関数をそのまま呼ぶ。ここで同じ規則を
    # 書き直すと、片方だけ直された日に writer が黙って緩む (block 判定を C14 の証書へ
    # 一本化したのと同じ理由)。判定の定義は 1 箇所にしか置かない。
    freshness = _c13().freshness_findings(str(tid), normalized)
    if freshness:
        raise RecordError("; ".join(freshness))

    return {k: normalized[k] for k in OUTPUT_FIELD_ORDER if normalized.get(k)}


def assemble(records: list) -> dict:
    """record 素材列を fetched-references.json 形状へ組み立てる。

    target_id 重複は RecordError。順序は入力順を保つ (決定論)。
    """
    if not isinstance(records, list):
        raise RecordError("records は配列でない")

    # 素材 0 件は断る。**警告して通す道は選ばない。**
    #
    # 理由は 2 つ。(1) この assembler は「取得できた結果を記録する」ためのもので、
    # 取得結果が 1 件も無いなら記録する対象が無く、呼ぶ必要そのものが無い。
    # (2) 0 件を通すと `OK: 0 件を … へ書き出した` が exit 0 で出る——
    # **取得に全滅した回が、成功として記録される。**
    #
    # 「対象が本当に 0 件」の運用が通らなくなるが、それは損にならない。
    # 対象の有無は `--targets` の側で表現されるものであり、targets が空なら
    # そもそも assemble を呼ばずに済む。断って失うものが無い。
    #
    # 中間案 (0 件のまま返し main で警告して非 0) を採らないのは、書き出しだけは
    # 行う形になり、**空の fetched-references.json が実体として残る**ため。
    # 残ったファイルは次に読む人にとって「取得済みで 0 件だった」と読める。
    if not records:
        raise RecordError(
            "record 素材が 0 件。取得結果が 1 件も無いなら記録する対象が無い"
            "(取得に失敗した回を『0 件で成功』として残さないため断る)"
        )

    seen: set[str] = set()
    refs: list[dict] = []
    for rec in records:
        built = build_record(rec)
        tid = built["target_id"]
        if tid in seen:
            raise RecordError(f"target_id={tid!r} が重複")
        seen.add(tid)
        refs.append(built)
    return {"references": refs}


def _target_ids(targets_data: dict) -> list[str]:
    """targets ファイルから target_id 一覧を抽出する (dict/str 配列の両対応)。"""
    ids: list[str] = []
    for t in targets_data.get("targets", []):
        if isinstance(t, str):
            ids.append(t)
        elif isinstance(t, dict) and t.get("target_id"):
            ids.append(t["target_id"])
    return ids


def missing_targets(targets_data: dict, references: dict) -> list[str]:
    """targets のうち references に record が無い target_id を返す。"""
    covered = {r.get("target_id") for r in references.get("references", [])}
    return [t for t in _target_ids(targets_data) if t not in covered]


def _load(path_str: str, label: str) -> dict:
    path = Path(path_str)
    if not path.is_file():
        raise FileNotFoundError(f"{label} ファイルが存在しない: {path_str}")
    return json.loads(path.read_text(encoding="utf-8"))


def _records_from(data) -> list:
    """--records の入力が list そのものか {"records": [...]} かを吸収する。

    **dict なのに `records` キーが無いとき、黙って [] を返さない。**
    以前はここが `data.get("records", [])` で、キー名が違う JSON を渡すと 0 件が組み上がり、
    `OK: 0 件を … へ書き出した` と言って exit 0 で終わっていた。
    **入力を読めなかったことが、成功として記録される。**
    この assembler が塞ごうとしている「正規生成器が契約を黙って落とす」と同じ形である。

    とくに紛らわしいのが自分の出力 (`fetched-references.json`) を渡す場合で、
    こちらは `references` キーを持つため、素材として 1 件も見えないまま通っていた。
    """
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        raise RecordError(f"records が配列でも {{records:[...]}} でもない (型: {type(data).__name__})")
    if "records" in data:
        return data["records"]
    if "references" in data:
        # 通したくなる形だが通さない。出力を入力へ差し戻すと、正規化済みの値を
        # もう一度正規化した結果が「取得結果」として記録される。
        # 往復の確認がしたいなら、確認する側で `references` を `records` へ写して渡すこと。
        raise RecordError(
            "records に fetched-references.json (この assembler の出力形式) が渡された。"
            "入力は取得結果の素材 {records:[...]} である"
        )
    raise RecordError(f"records に `records` キーが無い (見えたキー: {sorted(data)})")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="fetched-references.json の R3 決定論 assembler"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_asm = sub.add_parser("assemble", help="record 素材から fetched-references.json を組む")
    p_asm.add_argument("--records", required=True, help="record 素材 JSON (list か {records:[...]})")
    p_asm.add_argument("--targets", help="全件対応を突合する targets JSON (任意)")
    p_asm.add_argument("--out", help="出力先 (省略時 stdout)")

    args = ap.parse_args(argv)

    try:
        records = _records_from(_load(args.records, "records"))
        result = assemble(records)
        if args.targets:
            missing = missing_targets(_load(args.targets, "targets"), result)
            if missing:
                raise RecordError(f"対象 target_id の参照欠落: {missing}")
    except RecordError as exc:
        print(f"RecordError: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        print(f"JSON parse 失敗: {exc}", file=sys.stderr)
        return 2

    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"OK: {len(result['references'])} 件を {args.out} へ書き出した")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
