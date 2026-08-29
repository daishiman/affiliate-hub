#!/usr/bin/env python3
# /// script
# name: validate-evidence-transcription
# version: 0.1.0
# purpose: 取得記録 (fetched-references.json) が、その根拠である証跡 (retrieval-evidence/*.json)
#          に忠実であることを決定論で判定する。「転記が違う」「証跡が古い」「上流が変わった」の
#          3 つを分離し、機械で決着できる 2 つを外部取得なしで確定させる。
# inputs:
#   - --references <path>  取得記録 JSON ({references:[...]})
#   - --root <path>        evidence_ref の相対解決起点 (既定: --references の 2 つ上)
#   - --max-age-days <n>   証跡の齢の上限 (超過は age 違反として報告)
#   - --now <ISO8601>      齢の基準時刻 (既定: 実行時刻。再現可能な判定のため明示できる)
# outputs:
#   - stdout: 判定結果 (verdict 行 + 違反一覧)
#   - exit: 0=転記に違反なし / 1=違反あり / 2=入力が読めない
# contexts: [C02, C08]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""取得記録と証跡の**逐語一致**を判定する。

**「合っていない」には三種類ある。**doc_freshness がずっと赤のまま動かなかったのは、
それらが 1 つの FAIL に潰れていたからである。実測 2026-08-25:

  1. **転記が証跡と違う** — 機械で決着できる。証跡は手元にある。
  2. **証跡が古い** — 機械で決着できる。`retrieved_at` と現在時刻の引き算である。
  3. **上流が変わった** — 機械で決着**できない**。再取得が要る。

独立監査 C08 は google-gemini の `version` を `gemini-3.1-pro` ではなく
`gemini-3.1-pro-preview` だと報告し、これを FAIL とした。しかし証跡
(`retrieval-evidence/google-gemini.json`, http 200, content_sha256 付き) には本文逐語として
`gemini-3.1-pro` が記録されており、取得記録はそれに**完全に一致**していた (実測 15/15 一致)。
つまり 1. ではない。2. でもない (取得は 3 日前)。残るのは 3. だが、それは
**このセッションでは判定できない**。にもかかわらず verdict は FAIL だった。

**判定できないことを FAIL と呼ぶと、直せない赤が居座る。**是正の宛先が仕様書へ向くが、
仕様書は正しいので直すところが無い。赤は消えず、やがて誰も見なくなる。だからこの検査は
1. と 2. だけを判定し、3. については**判定しないと明示する**。

設計の姿勢は他の検査と同じである。禁じるのではなく、**何を確かめたかを名乗らせる**。
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import sys
from pathlib import Path

# 取得記録が版を表明しうる 2 つの欄。R3 の規則ではどちらか一方が必須。
_VERSION_FIELDS = ("version", "last_updated")


def _fail(msg: str) -> int:
    print(f"NG: {msg}")
    return 2


def _parse_iso(value: str):
    """ISO8601 (末尾 Z 可) を aware datetime へ。解釈できなければ None。"""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return _dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None


def _evidence_identity(path: Path, digest: str) -> str:
    """判定に使った証跡の**身元**を 1 行で返す。

    (カタログの `catalog:` 行と同じ理由。同じ名前の証跡が別の場所に在りうる以上、
     どれを開いたかを言わない判定は、他人の判定と突き合わせられない。)
    """
    return f"evidence: {path} (sha256:{digest[:12]})"


def check_reference(ref: dict, root: Path) -> "tuple[list[str], str | None]":
    """取得記録 1 件を証跡と突き合わせ、(違反一覧, 証跡の身元行) を返す。

    違反は「転記が証跡と違う」ものだけを挙げる。齢は別の軸として `check_age` が見る。
    """
    tid = ref.get("target_id") or "<target_id 欠落>"
    findings: list[str] = []

    ev_ref = ref.get("evidence_ref")
    if not ev_ref:
        return [f"{tid}: evidence_ref が無く、転記の根拠を辿れない"], None

    path = (root / ev_ref) if not Path(ev_ref).is_absolute() else Path(ev_ref)
    try:
        raw = path.read_bytes()
    except OSError as exc:
        return [f"{tid}: 証跡 {ev_ref} を読めない ({exc})"], None

    digest = hashlib.sha256(raw).hexdigest()
    identity = _evidence_identity(path, digest)

    # (a) 証跡そのものが差し替わっていないこと。書式検査 (SHA256_HEX) は writer 側に在るが、
    #     **実物と突き合わせる検査はどこにも無かった。**書式だけ正しい嘘は書式検査を通る。
    recorded = ref.get("evidence_sha256")
    if recorded != digest:
        findings.append(
            f"{tid}: evidence_sha256 が証跡の実体と不一致 "
            f"(記録 {recorded!r} / 実体 {digest!r})。証跡が差し替わったか、記録が古い"
        )

    try:
        evidence = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        findings.append(f"{tid}: 証跡 {ev_ref} が JSON として読めない ({exc})")
        return findings, identity

    fx = evidence.get("freshness_extraction")
    if not isinstance(fx, dict):
        findings.append(f"{tid}: 証跡に freshness_extraction が無く、転記元を特定できない")
        return findings, identity

    # (b) 版の逐語一致。**要約や言い換えを許さない。**一字でも変えると、後から
    #     「証跡にそう書いてあった」と言えなくなる。
    declared = [(f, ref.get(f)) for f in _VERSION_FIELDS if ref.get(f)]
    if not declared:
        findings.append(f"{tid}: version / last_updated がどちらも無い")
    else:
        value = fx.get("value")
        if not any(v == value for _f, v in declared):
            shown = ", ".join(f"{f}={v!r}" for f, v in declared)
            findings.append(
                f"{tid}: 取得記録の版が証跡の freshness_extraction.value と逐語一致しない "
                f"(記録 {shown} / 証跡 {value!r})"
            )

    # (c) 取得記録と証跡が同じ取得を指していること。別の取得の値を混ぜると、
    #     sha256 が合っていても中身の出所が食い違う。
    for field in ("source_url", "retrieved_at"):
        a, b = ref.get(field), evidence.get(field)
        if a and b and a != b:
            findings.append(f"{tid}: {field} が証跡と不一致 (記録 {a!r} / 証跡 {b!r})")

    a, b = ref.get("freshness_source"), fx.get("freshness_source")
    if a and b and a != b:
        findings.append(f"{tid}: freshness_source が証跡と不一致 (記録 {a!r} / 証跡 {b!r})")

    return findings, identity


def check_age(ref: dict, now: _dt.datetime, max_age_days: int) -> list[str]:
    """証跡の齢だけを見る。**転記の正しさとは別の軸である。**

    古いことは「間違い」ではない。再取得が要るという事実である。両者を同じ違反として
    並べると、直せるものと直せないものの区別が消える。
    """
    tid = ref.get("target_id") or "<target_id 欠落>"
    stamp = _parse_iso(ref.get("retrieved_at") or "")
    if stamp is None:
        return [f"{tid}: retrieved_at を解釈できず、証跡の齢を判定できない"]
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=_dt.timezone.utc)
    age = (now - stamp).days
    if age > max_age_days:
        return [
            f"{tid}: 証跡が {age} 日前の取得で上限 {max_age_days} 日を超える "
            "(転記の誤りではない。再取得が要るという事実)"
        ]
    return []


def validate(
    data: dict, root: Path, *, now: _dt.datetime, max_age_days: int, check_ages: bool
) -> "tuple[list[str], list[str], list[str]]":
    """(転記違反, 齢違反, 証跡の身元行) を返す。"""
    refs = data.get("references")
    if not isinstance(refs, list):
        return ["取得記録の references が配列でない"], [], []
    transcription: list[str] = []
    ages: list[str] = []
    identities: list[str] = []
    for ref in refs:
        if not isinstance(ref, dict):
            transcription.append(f"reference がオブジェクトでない: {ref!r}")
            continue
        found, identity = check_reference(ref, root)
        transcription.extend(found)
        if identity:
            identities.append(identity)
        if check_ages:
            ages.extend(check_age(ref, now, max_age_days))
    return transcription, ages, identities


def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(
        description=(
            "取得記録が証跡に忠実かを決定論で判定する。"
            "**上流が変わったかは判定しない** (再取得が要る。ここで扱うと"
            "判定できないものが FAIL になる)"
        )
    )
    ap.add_argument("--references", required=True, help="fetched-references.json のパス")
    ap.add_argument("--root", help="evidence_ref の相対解決起点 (既定: references の 2 つ上)")
    ap.add_argument(
        "--max-age-days",
        type=int,
        help="証跡の齢の上限。指定時のみ齢を判定する (転記違反とは別枠で報告)",
    )
    ap.add_argument("--now", help="齢の基準時刻 (ISO8601)。再現可能な判定のため明示できる")
    ap.add_argument(
        "--show-evidence-identity",
        action="store_true",
        help="判定に使った証跡のパスと sha256 を列挙する (独立監査との突合用)",
    )
    args = ap.parse_args(argv)

    ref_path = Path(args.references)
    try:
        data = json.loads(ref_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return _fail(f"取得記録を読めない: {exc}")
    if not isinstance(data, dict):
        return _fail("取得記録がオブジェクトでない")

    root = Path(args.root) if args.root else ref_path.resolve().parents[1]

    now = _parse_iso(args.now) if args.now else _dt.datetime.now(_dt.timezone.utc)
    if now is None:
        return _fail(f"--now を ISO8601 として解釈できない: {args.now!r}")
    if now.tzinfo is None:
        now = now.replace(tzinfo=_dt.timezone.utc)

    check_ages = args.max_age_days is not None
    transcription, ages, identities = validate(
        data, root, now=now, max_age_days=args.max_age_days or 0, check_ages=check_ages
    )

    if args.show_evidence_identity:
        for line in identities:
            print(line)

    if transcription:
        print("NG: 取得記録が証跡に忠実でない")
        for f in transcription:
            print(f"  - {f}")
    else:
        print(f"OK: 取得記録 {len(data.get('references') or [])} 件は証跡と逐語一致する")

    if check_ages:
        if ages:
            print(f"注意: 証跡の齢 (上限 {args.max_age_days} 日) を超えるものがある")
            for f in ages:
                print(f"  - {f}")
        else:
            print(f"OK: 証跡は全て {args.max_age_days} 日以内の取得")

    # **上流が変わったかは、ここでは判定しない。**黙って通すのではなく、
    # 判定していないことを毎回述べる。述べない検査は「見た」と区別がつかない。
    print(
        "未判定: 上流ページが取得後に変わったかは本検査の対象外 "
        "(再取得が要る。転記の忠実さと混ぜると、直せない事柄が FAIL になる)"
    )
    return 1 if transcription else 0


if __name__ == "__main__":
    sys.exit(main())
