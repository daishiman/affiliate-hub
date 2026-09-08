#!/usr/bin/env python3
"""枝どうしの spec-state を、追記専用ログだけ要素単位で合流させる。

--- なぜこれが要るのか ---

`spec-state.json` は 1 つの JSON に複数の**追記専用ログ**を持つ。git のテキスト
マージは JSON 配列の要素単位で合流できないので、衝突すればどちらか片方が丸ごと
残る。そして**落ちても validator は通る**——各ログは独立して整合するため、
`validate-coverage-matrix.py` も `validate-knowledge-graph.py` も緑のままである。
失われたことに気づく手がかりが無い。

2026-09-08 の dev 合流で実測した:

  qa_log          dev 76  / 本 113  → id 鍵で共通 76・本のみ 37 (取りこぼしなし)
  retracted_qa_log dev 28 / 本 0    → **dev の 28 件が丸ごと無い**
  reopen_log      dev 144 / 本 132  → 共通接頭辞 89・dev のみ 55・本のみ 43
  approval_log    dev 6   / 本 7

落ちたのは「なぜその問答を取り下げたのか」という監査記録である。

--- 合流してよいもの・いけないもの ---

合流してよいのは「追記しかされない・要素が互いに独立」なログだけである。
`matrix` のセルを機械が勝手に選ぶと、**根拠の無い確定が生まれる**。だから
ログ以外の節は自動で解決せず、差分を人へ差し出して止まる。

--- 2 種類のログ ---

**id が一意な**ログ (`qa_log` / `approval_log`) は id を鍵に和集合を取る。同じ
id で中身が違えば、どちらが正しいかは機械には決められないので衝突として止める。

**出来事の記録**であるログ (`reopen_log` / `retracted_qa_log`) は、同じ対象に
ついて 2 回起きうるので鍵で束ねられない。`reopen_log` はそもそも `id` を持たず、
`retracted_qa_log` は `id` を持つが一意でない (上の 28 件のうち 7 つの id が
2 回ずつ現れ、中身も別だった。鍵で束ねると 21 件へ潰れ、取り下げの経緯が消える)。

この 2 つは共通接頭辞まで遡り、そこから先の両側の残りを順に連ねる——追記専用
ログは共通の祖先まで同じ順に並んでいるという性質をそのまま使う。上の実測でも
89 + 55 + 43 = 187 と辻褄が合う。
"""
from __future__ import annotations

import json
from typing import Any

from state_transition_common import TransitionError

#: `id` を鍵に和集合を取れる追記専用ログ。id は 1 つの状態を指す名前で、同じ id が
#: 2 回現れることはない。
KEYED_APPEND_ONLY_LOGS = ("qa_log", "approval_log")

#: `id` が一意でない、あるいは `id` を持たない追記専用ログ。**出来事**の記録なので、
#: 同じ対象について 2 回起きうる。
#:
#: `retracted_qa_log` をここに置いている理由: 2026-09-08 の dev 実測で 28 件中
#: 7 つの id が 2 回ずつ現れ、しかも中身が別だった (同じ問答が一度取り下げられ、
#: 書き直されて、また取り下げられている)。id を鍵にすると 28 件が 21 件へ潰れ、
#: **取り下げの経緯そのものが消える**。id が一意でないログに鍵合流を当ててはならない。
#:
#: `reopen_log` は `id` を持たず、要素は `{category, platform, from, reason,
#: discarded}` で、同じセルを同じ理由で 2 回 reopen することが起こりうる。
POSITIONAL_APPEND_ONLY_LOGS = ("reopen_log", "retracted_qa_log")

APPEND_ONLY_LOGS = KEYED_APPEND_ONLY_LOGS + POSITIONAL_APPEND_ONLY_LOGS


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _merge_keyed(
    name: str,
    base: list,
    other: list,
    conflicts: list[dict],
) -> tuple[list, dict]:
    """id を鍵に和集合を取る。並びは base 側を先に、other 側の新規を後ろへ。"""
    by_id: dict[str, Any] = {}
    order: list[str] = []
    side_of: dict[str, str] = {}
    for side, rows in (("base", base), ("other", other)):
        for index, row in enumerate(rows):
            if not isinstance(row, dict) or not isinstance(row.get("id"), str):
                conflicts.append(
                    {
                        "kind": "unkeyed_entry",
                        "log": name,
                        "side": side,
                        "index": index,
                        "detail": f"{name}[{index}] ({side}) に文字列の id が無く、要素単位で合流できない",
                    }
                )
                continue
            entry_id = row["id"]
            if entry_id not in by_id:
                by_id[entry_id] = row
                order.append(entry_id)
                side_of[entry_id] = side
            elif _canonical(by_id[entry_id]) != _canonical(row):
                conflicts.append(
                    {
                        "kind": "diverged_entry",
                        "log": name,
                        "id": entry_id,
                        "detail": f"{name}: id={entry_id} が両側で別の中身を持つ。どちらが正しいかは機械には決められない",
                    }
                )
    base_ids = {row["id"] for row in base if isinstance(row, dict) and isinstance(row.get("id"), str)}
    other_ids = {row["id"] for row in other if isinstance(row, dict) and isinstance(row.get("id"), str)}
    stats = {
        "strategy": "keyed",
        "base": len(base),
        "other": len(other),
        "shared": len(base_ids & other_ids),
        "base_only": len(base_ids - other_ids),
        "other_only": len(other_ids - base_ids),
        "total": len(order),
    }
    return [by_id[entry_id] for entry_id in order], stats


def _merge_positional(
    name: str,
    base: list,
    other: list,
    conflicts: list[dict],
) -> tuple[list, dict]:
    """共通接頭辞を見つけ、そこから先の両側の残りを順に連ねる。"""
    shared = 0
    while shared < min(len(base), len(other)) and _canonical(base[shared]) == _canonical(other[shared]):
        shared += 1
    base_rest = base[shared:]
    other_rest = other[shared:]
    # 分岐後の両側に同じ要素が現れると、連結でそれが二重になる。両方の枝で
    # 「同じセルを同じ理由で reopen した」のか、片方が相手を取り込んだ結果なのかは
    # ログからは区別できないので、数えずに止める。
    base_rest_canonical = {_canonical(row) for row in base_rest}
    duplicated = sorted({_canonical(row) for row in other_rest} & base_rest_canonical)
    for row in duplicated:
        conflicts.append(
            {
                "kind": "duplicated_after_divergence",
                "log": name,
                "entry": row,
                "detail": f"{name}: 分岐後の両側に同じ要素がある。連結すると二重になるが、"
                "本当に 2 回起きたのか片方が相手を取り込んだのかは区別できない",
            }
        )
    stats = {
        "strategy": "positional",
        "base": len(base),
        "other": len(other),
        "shared": shared,
        "base_only": len(base_rest),
        "other_only": len(other_rest),
        "total": shared + len(base_rest) + len(other_rest),
    }
    return base[:shared] + base_rest + other_rest, stats


def _leaf_diffs(path: str, left: Any, right: Any, out: list[str], limit: int = 40) -> None:
    """食い違う葉の位置だけを並べる。丸ごとの JSON を投げると読めない。"""
    if len(out) >= limit:
        return
    if isinstance(left, dict) and isinstance(right, dict):
        for key in sorted(set(left) | set(right)):
            child = f"{path}.{key}"
            if key not in left:
                out.append(f"{child}: other にのみ在る")
            elif key not in right:
                out.append(f"{child}: base にのみ在る")
            else:
                _leaf_diffs(child, left[key], right[key], out, limit)
            if len(out) >= limit:
                return
        return
    if _canonical(left) != _canonical(right):
        out.append(f"{path}: base={_canonical(left)[:80]} / other={_canonical(right)[:80]}")


def merge_states(base: dict, other: dict) -> tuple[dict, dict]:
    """2 つの state を合流させ、(合流結果, 報告) を返す。

    衝突があっても合流結果は組み立てて返す。**呼び手が止める**——報告だけ返して
    結果を返さない形にすると、「何が合流できて何が衝突したか」を並べて見せられない。
    """
    if not isinstance(base, dict) or not isinstance(other, dict):
        raise TransitionError("merge の入力は 2 つの spec-state (object) であること")
    for name, side in ((base, "base"), (other, "other")):
        version = name.get("schema_version")
        if version != base.get("schema_version"):
            raise TransitionError(
                f"schema_version が両側で違う (base={base.get('schema_version')} "
                f"/ other={other.get('schema_version')})。先に init --state で版を揃えること"
            )
        _ = side

    conflicts: list[dict] = []
    merged: dict = json.loads(json.dumps(base, ensure_ascii=False))
    logs: dict[str, dict] = {}

    for name in APPEND_ONLY_LOGS:
        if name not in base and name not in other:
            # どちらも持っていないログを空配列で生やさない。合流は在るものを
            # 合わせる操作であって、器を増やす操作ではない。
            continue
        base_rows = base.get(name, [])
        other_rows = other.get(name, [])
        if not isinstance(base_rows, list) or not isinstance(other_rows, list):
            conflicts.append(
                {
                    "kind": "not_a_log",
                    "log": name,
                    "detail": f"{name} が配列ではない。追記専用ログとして合流できない",
                }
            )
            continue
        if name in KEYED_APPEND_ONLY_LOGS:
            rows, stats = _merge_keyed(name, base_rows, other_rows, conflicts)
        else:
            rows, stats = _merge_positional(name, base_rows, other_rows, conflicts)
        # 片側にしか無いログ (retracted_qa_log が本ブランチに無い等) も、
        # 合流後は必ず節として在る状態にする。
        merged[name] = rows
        logs[name] = stats

    for key in sorted(set(base) | set(other)):
        if key in APPEND_ONLY_LOGS:
            continue
        if key not in base:
            conflicts.append(
                {
                    "kind": "section_only_on_other",
                    "section": key,
                    "detail": f"節 {key} が other にのみ在る。追記専用ログではないので自動で取り込まない",
                }
            )
            continue
        if key not in other:
            # base にしか無い節は base のまま残す。落とさない。
            continue
        if _canonical(base[key]) == _canonical(other[key]):
            continue
        diffs: list[str] = []
        _leaf_diffs(key, base[key], other[key], diffs)
        conflicts.append(
            {
                "kind": "diverged_section",
                "section": key,
                "diffs": diffs,
                "detail": f"節 {key} が両側で違う。機械が選ぶと根拠の無い確定が生まれるため自動で解決しない",
            }
        )

    report = {"logs": logs, "conflicts": conflicts, "merged": not conflicts}
    return merged, report


def format_report(report: dict) -> str:
    lines: list[str] = []
    for name, stats in report["logs"].items():
        lines.append(
            f"{name}: base={stats['base']} other={stats['other']} "
            f"共通={stats['shared']} base のみ={stats['base_only']} "
            f"other のみ={stats['other_only']} → {stats['total']} ({stats['strategy']})"
        )
    conflicts = report["conflicts"]
    if not conflicts:
        lines.append("衝突なし")
        return "\n".join(lines)
    lines.append(f"衝突 {len(conflicts)} 件 — 自動では解決しない:")
    for conflict in conflicts:
        lines.append(f"  - [{conflict['kind']}] {conflict['detail']}")
        for diff in conflict.get("diffs", []):
            lines.append(f"      {diff}")
    return "\n".join(lines)
