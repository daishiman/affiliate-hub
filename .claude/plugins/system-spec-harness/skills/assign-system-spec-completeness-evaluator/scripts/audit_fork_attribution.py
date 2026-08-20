#!/usr/bin/env python3
# /// script
# name: audit_fork_attribution
# version: 0.1.0
# purpose: 完成度評価の独立監査 fork receipt を PostToolUse 台帳へ fail-closed で照合する内部モジュール
# inputs:
#   - Python API: report, ledger, expected_session
# outputs:
#   - Python API: 違反リストまたは台帳集計
# contexts: [E, C]
# network: false
# write-scope: none
# dependencies: []
# requires-python: ">=3.9"
# ///
"""`aggregate-completeness.py` の独立監査帰属を扱う内部モジュール。

台帳の読取り、receipt と実 fork の照合、run/session 束縛をここへ集約する。
CLI と集約判定は呼び出し元の `aggregate-completeness.py` が所有する。
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

EVALUATOR_NAME = "assign-system-spec-completeness-evaluator"
ASPECTS: dict[str, dict[str, str]] = {
    "foundation_trace": {
        "label": "上位概念トレーサビリティ",
        "auditor": EVALUATOR_NAME,
        "component": "C05",
    },
    "decision_guidance": {
        "label": "意思決定支援",
        "auditor": EVALUATOR_NAME,
        "component": "C05",
    },
    "matrix_coverage": {
        "label": "マトリクス網羅性",
        "auditor": "system-spec-matrix-auditor",
        "component": "C07",
    },
    "design_knowledge_reflection": {
        "label": "設計知識反映",
        "auditor": EVALUATOR_NAME,
        "component": "C05",
    },
    "doc_freshness": {
        "label": "最新ドキュメント出典",
        "auditor": "system-spec-doc-freshness-auditor",
        "component": "C08",
    },
    "prompt_quality": {
        "label": "prompt-creator準拠",
        "auditor": EVALUATOR_NAME,
        "component": "C05",
    },
}
ASPECT_VERDICTS = {"PASS", "FAIL", "INDETERMINATE"}
OVERALL_VERDICTS = {"PASS", "FAIL"}

# 観点 verdict の**厳しさ**の順序。大きいほど厳しい。
#
# 以前は primary receipt verdict と観点 verdict の**完全一致**を強制していた。その形だと、
# sub_input が FAIL でも、来歴が汚れていて primary の判定を額面どおり採れなくても、
# 観点側は receipt の PASS をそのまま書くしかない。**機械層が「より厳しく見た」を
# 表現できない**ので、C05 は緩い側へ寄せるか、receipt を書き換える (それは緑化と
# 同じ操作) しかなかった。
#
# そこで**厳しくなる向きだけ**を、宣言つきで許す。緩くなる向き (FAIL の receipt に
# PASS の観点) は理由の有無にかかわらず許さない。緩める向きを理由つきで許すと、
# 理由欄が緑化の通り道になる。
VERDICT_SEVERITY = {"PASS": 0, "INDETERMINATE": 1, "FAIL": 2}

# 降格を正当化できる**事由の語彙**。自由文字列ではなく、ここに在るコードだけを受ける。
#
# 以前は `reason` が非空の自由文字列で足りていた。それだと「厳しくする向き」に限って
# あっても、**何を根拠に厳しくしたのかが機械層から一切引けない**。本文は人しか読めず、
# 無関係な文 (「今日は雨だから」) でも通った。向きが縛ってあるので緑化には使えないが、
# 降格そのものが説明不能な操作として残る。
#
# そこで語彙を**閉じた列挙**にし、さらに各コードへ**機械で引ける根拠**を結び付ける。
# コードは `DOWNGRADE_REASON_GROUNDS` の鍵そのものなので、**根拠の引き方を持たない
# コードは存在できない。**語彙だけ足して素通りさせる形を作れない。
#
# 本文は捨てない。`detail` に非空で書かせる (語彙へ寄せた結果、本当の理由が文書から
# 消えるのを防ぐ)。ただし `detail` は**受理の条件ではない**。受理を決めるのは
# 向き・`from`・そして語彙コードに対応する根拠の 3 つである。
#
# 上限 MAX_DOWNGRADE_REASONS と下限 MIN_GROUNDED_DOWNGRADE_REASONS が
# tests/test_audit_fork_attribution.py で噛み合っている。語彙を足すと上限が割れ、
# 語彙を消すと下限が割れる。どちらか片方の都合では動かせない。
MAX_DOWNGRADE_REASONS = 2


def _ground_sub_input_fail(aspect: str, sub_input: dict | None, ledger: dict) -> str:
    """`sub_input_fail`: 当該観点の sub_input receipt が実在し PASS でないこと。"""
    if not isinstance(sub_input, dict):
        return (
            f"aspects[{aspect}].verdict_downgrade.reason='sub_input_fail' だが"
            f" {aspect} に sub_input receipt が無い (根拠として引ける sub_input が存在しない)"
        )
    verdict = sub_input.get("verdict")
    if verdict == "PASS":
        return (
            f"aspects[{aspect}].verdict_downgrade.reason='sub_input_fail' だが"
            f" {aspect} の sub_input receipt は verdict=PASS (FAIL でないものを FAIL 扱いにできない)"
        )
    return ""


def _ground_provenance_contamination(aspect: str, sub_input: dict | None, ledger: dict) -> str:
    """`provenance_contamination`: 台帳に破損行が実在すること。

    来歴が汚れているという主張は、台帳の破損行という**観測できる跡**を持つ。
    跡が無いなら、receipt を額面どおり採れない理由も無い。
    """
    malformed = ledger.get("malformed", 0) if isinstance(ledger, dict) else 0
    if not isinstance(malformed, int) or malformed < 1:
        return (
            f"aspects[{aspect}].verdict_downgrade.reason='provenance_contamination' だが"
            " fork 台帳に破損行が 1 件も無い (来歴汚染を裏取りできる跡が存在しない)"
        )
    return ""


# 語彙 = この対応表の鍵。根拠の引き方を持たないコードは作れない。
DOWNGRADE_REASON_GROUNDS = {
    "sub_input_fail": _ground_sub_input_fail,
    "provenance_contamination": _ground_provenance_contamination,
}
DOWNGRADE_REASONS = frozenset(DOWNGRADE_REASON_GROUNDS)
SEVERITIES = {"high", "medium", "low", "info"}
SUB_INPUT_AUDITORS: dict[str, dict[str, str]] = {
    "matrix_coverage": {"auditor": "system-spec-hearing-auditor", "component": "C06"},
}
DELEGATION_ROLES = {"primary", "sub_input"}
LEDGER_ENV = "SYSTEM_SPEC_AUDIT_FORK_LEDGER"
LEDGER_RELPATH = Path("eval-log") / "system-spec-harness" / "audit-fork-ledger.jsonl"
LEDGER_TOOL_NAMES = ("Task", "Agent")
LEDGER_SCHEMA_LEGACY = "1.1"
LEDGER_SCHEMA_TOOL_USE = "1.2"
# schema 1.3 = 非同期完了の解決行 (record_kind="resolution")。起動行 (1.2) とは別の行で
# 追記され、読み手が (session_id, tool_use_id) で畳み込む。
#
# ## 読み手契約 (2026-08-20)
#
# - 起動行と解決行は**別の行**である。台帳は append-only なので、解決は追記でしか起きない。
# - 畳み込みの単位は (session_id, tool_use_id)。**解決行の tool_use_id は起動行から
#   写したものであり、SubagentStop payload には存在しない** (payload が運ぶのは agent_id)。
# - 起動行がちょうど 1 件、解決行がちょうど 1 件のときだけ畳み込む。
#   **解決行が 2 件以上あるときは fail-closed で捨てる。**先に書かれた解決行を後から
#   来た行で上書きする形は作らない。上書きを許すと、後から任意の verdict を差し込める。
# - 解決行の agent_id / subagent_type / tool_name が起動行と一致しないときは畳み込まない。
#   非同期化で順序の保証が失われた以上、ID の一致だけが唯一の帰属根拠である。
# - 畳み込み後の receipt は verdict / verdict_state / response_sha256 を**解決行から**採る。
#   verdict を載せているのは最終応答のほうであり、起動受理ではないため。起動時の digest は
#   launch_response_sha256 として残す (捨てると起動と完了の対応を後から追えない)。
# - **配線を直しても過去の pending 行は遡って resolved にならない。**台帳を書けるのは
#   hook だけで、読み手も R2 も過去行を補正しない。解決行は新しい実行でしか生まれない。
LEDGER_SCHEMA_RESOLUTION = "1.3"
LEDGER_RECORD_KIND_LAUNCH = "launch"
LEDGER_RECORD_KIND_RESOLUTION = "resolution"
PROMPT_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
RESPONSE_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _plugin_root() -> Path:
    """.../skills/<skill>/scripts/<module>.py から plugin root を返す。"""
    return Path(__file__).resolve().parents[3]


def required_delegations() -> list[dict]:
    """実 fork receipt が必須の (aspect, role, auditor, component) を返す。"""
    required = [
        {"aspect": aid, "role": "primary", "auditor": spec["auditor"], "component": spec["component"]}
        for aid, spec in ASPECTS.items()
        if spec["auditor"] != EVALUATOR_NAME
    ]
    required += [
        {"aspect": aid, "role": "sub_input", "auditor": spec["auditor"], "component": spec["component"]}
        for aid, spec in SUB_INPUT_AUDITORS.items()
    ]
    return required


def default_ledger_path() -> Path:
    """env 上書き > CLAUDE_PROJECT_DIR 相対 > cwd 相対で台帳を解決する。"""
    env = os.environ.get(LEDGER_ENV)
    if env:
        return Path(env)
    return Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path.cwd()) / LEDGER_RELPATH


def empty_ledger() -> dict:
    """台帳不在時の fail-closed な空集計を返す。"""
    return {
        "path": None,
        "exists": False,
        "dispatched": {},
        "sessions": {},
        "receipts": {},
        "receipts_v12": {},
        "resolutions": {},
        "malformed": 0,
    }


def load_fork_ledger(path) -> dict:
    """JSONL 台帳を subagent と session 単位で集計する。

    部分破損した追記専用台帳では、壊れた行を数えつつ健全な fork 証跡を保持する。
    """
    if path is None:
        return empty_ledger()
    ledger_path = Path(path)
    if not ledger_path.is_file():
        return {
            "path": str(ledger_path),
            "exists": False,
            "dispatched": {},
            "sessions": {},
            "receipts": {},
            "receipts_v12": {},
            "resolutions": {},
            "malformed": 0,
        }
    dispatched: dict[str, int] = {}
    sessions: dict[str, dict[str, int]] = {}
    receipts: dict[str, dict[str, dict[str, dict[str, str]]]] = {}
    receipts_v12: dict[str, dict[str, list[dict[str, str]]]] = {}
    resolutions: dict[str, dict[str, list[dict[str, str]]]] = {}
    pending_penalty: dict[tuple, int] = {}
    malformed = 0
    try:
        lines = ledger_path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return {
            "path": str(ledger_path),
            "exists": False,
            "dispatched": {},
            "sessions": {},
            "receipts": {},
            "receipts_v12": {},
            "resolutions": {},
            "malformed": 0,
        }
    for line in lines:
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            malformed += 1
            continue
        if not isinstance(record, dict) or record.get("tool_name") not in LEDGER_TOOL_NAMES:
            malformed += 1
            continue
        schema_version = record.get("schema_version")
        if schema_version not in {
            LEDGER_SCHEMA_LEGACY,
            LEDGER_SCHEMA_TOOL_USE,
            LEDGER_SCHEMA_RESOLUTION,
        }:
            malformed += 1
            continue
        subagent_type = record.get("subagent_type")
        session_id = record.get("session_id")
        prompt_sha256 = record.get("prompt_sha256")
        response_sha256 = record.get("response_sha256")
        audit_verdict = record.get("audit_verdict")
        if (
            not isinstance(subagent_type, str)
            or not subagent_type
            or not isinstance(session_id, str)
            or not session_id
            or not isinstance(prompt_sha256, str)
            or not PROMPT_SHA256_RE.fullmatch(prompt_sha256)
            or not isinstance(response_sha256, str)
            or not RESPONSE_SHA256_RE.fullmatch(response_sha256)
        ):
            malformed += 1
            continue
        receipt = {
            "subagent_type": subagent_type,
            "tool_name": record["tool_name"],
            "response_sha256": response_sha256,
            "verdict": audit_verdict,
        }
        if schema_version in (LEDGER_SCHEMA_TOOL_USE, LEDGER_SCHEMA_RESOLUTION):
            tool_use_id = record.get("tool_use_id")
            if not isinstance(tool_use_id, str) or not tool_use_id:
                malformed += 1
                continue
            receipt["verdict_state"] = record.get("verdict_state")
            receipt["agent_id"] = record.get("agent_id")
            if record.get("record_kind") == LEDGER_RECORD_KIND_RESOLUTION:
                resolutions.setdefault(session_id, {}).setdefault(tool_use_id, []).append(receipt)
                continue
            receipts_v12.setdefault(session_id, {}).setdefault(tool_use_id, []).append(receipt)
            if record.get("verdict_state") != "resolved" or audit_verdict not in ASPECT_VERDICTS:
                malformed += 1
                # 未確定の起動行に付けた malformed は、解決行が来て畳み込めたら取り消す。
                # 取り消さないと「非同期で起動した」だけで台帳が壊れているように見え、
                # 本物の破損と区別が付かなくなる。
                pending_penalty[(session_id, tool_use_id)] = (
                    pending_penalty.get((session_id, tool_use_id), 0) + 1
                )
            continue
        if audit_verdict not in ASPECT_VERDICTS:
            malformed += 1
            continue
        dispatched[subagent_type] = dispatched.get(subagent_type, 0) + 1
        by_session = sessions.setdefault(subagent_type, {})
        by_session[session_id] = by_session.get(session_id, 0) + 1
        receipts.setdefault(subagent_type, {}).setdefault(session_id, {})[response_sha256] = receipt

    # 非同期完了の畳み込み (schema 1.3)。契約は LEDGER_SCHEMA_RESOLUTION の comment 参照。
    # **上書きではなく畳み込みである。**起動行を書き換えるのではなく、起動行と解決行が
    # 1 対 1 に対応したときだけ、読み手が 1 件の receipt として解釈する。
    for session_id, by_tool_use in resolutions.items():
        for tool_use_id, candidates in by_tool_use.items():
            launches = receipts_v12.get(session_id, {}).get(tool_use_id, [])
            if len(candidates) != 1 or len(launches) != 1:
                # 解決行が複数 = どれが本物か決められない。先に書かれた行を後の行で
                # 上書きしない以上、決められないものは使わない (fail-closed)。
                malformed += len(candidates)
                continue
            resolution = candidates[0]
            launch = launches[0]
            mismatched = [
                name
                for name in ("agent_id", "subagent_type", "tool_name")
                if resolution.get(name) != launch.get(name)
            ]
            if mismatched or not resolution.get("agent_id"):
                # agent_id が欠落・不一致なら帰属根拠が無い。順序という第二の手がかりは
                # 非同期化で失われているので、ここで妥協すると帰属が推測になる。
                malformed += len(candidates)
                continue
            if (
                resolution.get("verdict_state") != "resolved"
                or resolution.get("verdict") not in ASPECT_VERDICTS
            ):
                malformed += len(candidates)
                continue
            launch["launch_response_sha256"] = launch.get("response_sha256")
            launch["response_sha256"] = resolution.get("response_sha256")
            launch["verdict"] = resolution.get("verdict")
            launch["verdict_state"] = resolution.get("verdict_state")
            malformed -= pending_penalty.pop((session_id, tool_use_id), 0)

    # schema 1.2 の識別子は session 内で一意でなければならない。候補を list のまま保持し、
    # 重複・競合を last-write-wins に潰さず照合時にも fail-closed で拒否する。
    for session_id, by_tool_use in receipts_v12.items():
        for candidates in by_tool_use.values():
            if len(candidates) != 1:
                malformed += len(candidates)
                continue
            receipt = candidates[0]
            if receipt.get("verdict_state") != "resolved" or receipt.get("verdict") not in ASPECT_VERDICTS:
                continue
            subagent_type = receipt["subagent_type"]
            dispatched[subagent_type] = dispatched.get(subagent_type, 0) + 1
            by_session = sessions.setdefault(subagent_type, {})
            by_session[session_id] = by_session.get(session_id, 0) + 1
    return {
        "path": str(ledger_path),
        "exists": True,
        "dispatched": dispatched,
        "sessions": sessions,
        "receipts": receipts,
        "receipts_v12": receipts_v12,
        "resolutions": resolutions,
        "malformed": malformed,
    }


def agent_definition_exists(auditor: str) -> bool:
    """監査名が plugin 同梱 agent 定義へ安全に解決できるかを検証する。"""
    if not isinstance(auditor, str) or not auditor or "/" in auditor or auditor.startswith("."):
        return False
    return (_plugin_root() / "agents" / f"{auditor}.md").is_file()


def ledger_corroborates(delegation: dict, ledger: dict) -> tuple[bool, str]:
    """receipt が実 fork の session・tool・response verdict へ束縛されるか検証する。"""
    dispatch = delegation.get("dispatch")
    subagent_type = dispatch.get("subagent_type") if isinstance(dispatch, dict) else None
    if not ledger.get("exists"):
        return False, (
            f"fork 台帳が存在しない ({ledger.get('path')}) ため独立監査の帰属を裏取りできない "
            f"(PostToolUse hook record-audit-fork.py の配線を確認するか、監査を実 fork して再評価する)"
        )
    if not isinstance(subagent_type, str) or not subagent_type:
        return False, "dispatch.subagent_type が無く fork 台帳と突合できない"
    declared_session = dispatch.get("session_id")
    if not isinstance(declared_session, str) or not declared_session:
        return False, (
            "dispatch.session_id が無く fork 台帳の run/session と突合できない "
            "(宣言の無い帰属は自己申告のまま。R2 が fork 起動時の session_id を receipt へ記録する)"
        )
    if declared_session == "unknown":
        return False, (
            "dispatch.session_id='unknown' は run/session 束縛の裏取りに使えない "
            "(session 不明の fork は過去 run の 'unknown' 行と区別できない。"
            "session_id を観測できるハーネスで再評価する)"
        )
    response_sha256 = dispatch.get("response_sha256")
    if not isinstance(response_sha256, str) or not RESPONSE_SHA256_RE.fullmatch(response_sha256):
        return False, (
            "dispatch.response_sha256 が無いか不正で、実監査 response の verdict と突合できない "
            "(PostToolUse hook が記録した response digest を receipt へ転記する)"
        )

    tool_use_id = dispatch.get("tool_use_id")
    if tool_use_id is not None:
        if not isinstance(tool_use_id, str) or not tool_use_id:
            return False, "dispatch.tool_use_id が空または不正で schema 1.2 台帳と突合できない"
        candidates = ledger.get("receipts_v12", {}).get(declared_session, {}).get(tool_use_id, [])
        if len(candidates) > 1:
            signatures = {
                (
                    item.get("subagent_type"),
                    item.get("tool_name"),
                    item.get("response_sha256"),
                    item.get("verdict"),
                )
                for item in candidates
                if isinstance(item, dict)
            }
            kind = "重複" if len(signatures) == 1 else "競合"
            return False, (
                f"schema 1.2 台帳の (session_id={declared_session!r}, tool_use_id={tool_use_id!r}) が{kind}している "
                "(append-only 台帳を last-write-wins で解釈できない)"
            )
        if not candidates:
            return False, (
                f"schema 1.2 台帳に (session_id={declared_session!r}, tool_use_id={tool_use_id!r}) の"
                "監査完了記録が無い (別 dispatch の ID を転記した疑い)"
            )
        recorded = candidates[0]
        if recorded.get("verdict_state") != "resolved" or recorded.get("verdict") not in ASPECT_VERDICTS:
            return False, (
                f"schema 1.2 台帳の tool_use_id={tool_use_id!r} は verdict_state=resolved かつ"
                "有効な audit_verdict でない (未確定・曖昧な PASS を監査完了として扱えない)"
            )
        expected = {
            "subagent_type": subagent_type,
            "tool_name": dispatch.get("tool"),
            "response_sha256": response_sha256,
            "verdict": delegation.get("verdict"),
        }
        mismatches = [
            name for name, value in expected.items() if recorded.get(name) != value
        ]
        if mismatches:
            return False, (
                f"schema 1.2 receipt が hook 観測値と一致しない ({', '.join(mismatches)}) "
                "(session/subagent/tool/response/verdict を同一 dispatch へ束縛する)"
            )
        return True, ""

    # schema 1.2 行へ digest だけで接地すると、同一 message 内の別 dispatch を取り違えられる。
    # 一致候補がある receipt は tool_use_id 欠落として拒否し、1.1 へ downgrade しない。
    v12_matches = [
        item
        for candidates in ledger.get("receipts_v12", {}).get(declared_session, {}).values()
        for item in candidates
        if isinstance(item, dict)
        and item.get("subagent_type") == subagent_type
        and item.get("response_sha256") == response_sha256
    ]
    if v12_matches:
        return False, (
            "dispatch.tool_use_id が無く schema 1.2 台帳の dispatch と突合できない "
            "(response digest のみで 1.1 互換経路へ downgrade しない)"
        )

    if ledger.get("dispatched", {}).get(subagent_type, 0) < 1:
        malformed = ledger.get("malformed", 0)
        suffix = f" / 台帳の破損行 {malformed} 件" if malformed else ""
        return False, (
            f"fork 台帳に subagent_type={subagent_type!r} の完了記録が無い "
            f"(独立監査を起動せずに帰属だけ宣言している疑い。台帳={ledger.get('path')}{suffix})"
        )
    recorded_sessions = ledger.get("sessions", {}).get(subagent_type, {})
    if declared_session not in recorded_sessions:
        return False, (
            f"fork 台帳に (session_id={declared_session!r}, subagent_type={subagent_type!r}) の完了記録が無い "
            f"(宣言 session が台帳へ接地しない = 過去 run の名指し違い / fork 省略 / 偽装の疑い。"
            f"当該 subagent_type の観測済み session {len(recorded_sessions)} 種)"
        )
    recorded = ledger.get("receipts", {}).get(subagent_type, {}).get(declared_session, {}).get(response_sha256)
    if not isinstance(recorded, dict):
        return False, (
            f"fork 台帳に response_sha256={response_sha256!r} の監査完了記録が無い "
            "(別 fork の verdict を流用したか、hook が最終 AUDIT_VERDICT marker を観測できていない)"
        )
    if dispatch.get("tool") != recorded.get("tool_name"):
        return False, (
            f"dispatch.tool={dispatch.get('tool')!r} が hook 観測値 {recorded.get('tool_name')!r} と不一致"
        )
    if delegation.get("verdict") != recorded.get("verdict"):
        return False, (
            f"receipt verdict={delegation.get('verdict')!r} が hook 観測の auditor verdict={recorded.get('verdict')!r} と不一致 "
            "(監査結果を緑化のために書き換えている)"
        )
    return True, ""


def _verdict_shift_violations(
    aspect: str,
    label: str,
    receipt_verdict: str,
    aspect_verdict: str,
    aspect_value: object,
    sub_input: dict | None = None,
    ledger: dict | None = None,
) -> list[str]:
    """primary receipt verdict と観点 verdict がずれているときの可否を返す。

    **厳しくなる向きだけを、根拠つきで許す。**宣言は `aspects[<観点>].verdict_downgrade`
    で、次の 4 つを要る。

    1. `from` = 元の primary receipt verdict。取り違え防止 (別のずれ向けの宣言の流用を弾く)。
    2. `reason` = `DOWNGRADE_REASONS` の**列挙されたコード**。自由文字列は受けない。
    3. `reason` に対応する**機械で引ける根拠**が実在すること
       (`sub_input_fail` なら当該観点の sub_input receipt が PASS でない、
        `provenance_contamination` なら台帳に破損行がある)。
    4. `detail` = 非空の本文。人が読む本当の理由をここへ残す (語彙へ寄せた結果、
       実際の事情が文書から消えるのを防ぐ)。

    **緩くなる向き** (FAIL の receipt に PASS の観点) は、宣言の有無にかかわらず
    弾く。理由つきで緩められると理由欄が緑化の通り道になる。この判定は宣言を読む
    前に返しており、`verdict_downgrade` を足しても昇格側は開かない。

    **塞げていないところ**: `detail` の本文が本当かどうかは機械層では判定できない。
    ただし `detail` は**受理の条件ではない**。受理を決めるのは向き・`from`・根拠の 3 つ
    で、いずれも機械で引ける。
    """
    if VERDICT_SEVERITY[aspect_verdict] < VERDICT_SEVERITY[receipt_verdict]:
        return [
            f"{label}.verdict={receipt_verdict!r} より aspects[{aspect}].verdict={aspect_verdict!r} が"
            " 緩い (独立監査の判定を緩める向きの書き換えは理由の有無にかかわらず不可)"
        ]
    declared = aspect_value.get("verdict_downgrade") if isinstance(aspect_value, dict) else None
    if not isinstance(declared, dict):
        return [
            f"{label}.verdict={receipt_verdict!r} と aspects[{aspect}].verdict={aspect_verdict!r} の差に"
            " aspects[].verdict_downgrade の宣言が無い (厳しくした理由が記録されていない)"
        ]
    problems: list[str] = []
    if declared.get("from") != receipt_verdict:
        problems.append(
            f"aspects[{aspect}].verdict_downgrade.from={declared.get('from')!r} が"
            f" primary receipt verdict={receipt_verdict!r} と一致しない (別のずれの宣言を流用している疑い)"
        )
    reason = declared.get("reason")
    if reason not in DOWNGRADE_REASONS:
        problems.append(
            f"aspects[{aspect}].verdict_downgrade.reason={reason!r} が"
            f" {sorted(DOWNGRADE_REASONS)} 外 (降格事由は列挙された語彙のみ。自由文の理由では降格できない)"
        )
    else:
        ungrounded = DOWNGRADE_REASON_GROUNDS[reason](
            aspect, sub_input, ledger if isinstance(ledger, dict) else {}
        )
        if ungrounded:
            problems.append(ungrounded)
    detail = declared.get("detail")
    if not isinstance(detail, str) or not detail.strip():
        problems.append(
            f"aspects[{aspect}].verdict_downgrade.detail が非空文字列でない"
            " (語彙コードだけでは、その観点で何が起きたかが後から読めない)"
        )
    return problems


def validate_attribution(
    report: dict, ledger: dict | None = None, expected_session: str | None = None
) -> list[str]:
    """独立監査 receipt を実 fork 証跡へ fail-closed で接地する。"""
    violations: list[str] = []
    ledger = ledger if isinstance(ledger, dict) else empty_ledger()
    aspects = report.get("aspects") if isinstance(report.get("aspects"), dict) else {}
    delegations = report.get("audit_delegations")
    if not isinstance(delegations, list):
        violations.append("audit_delegations: 配列でない (独立監査の fork receipt 一覧が無い = 帰属が自己申告のまま)")
        delegations = []

    seen: dict[tuple, dict] = {}
    for index, delegation in enumerate(delegations):
        if not isinstance(delegation, dict):
            violations.append(f"audit_delegations[{index}]: オブジェクトでない")
            continue
        aspect, role = delegation.get("aspect"), delegation.get("role")
        if aspect not in ASPECTS:
            violations.append(f"audit_delegations[{index}].aspect={aspect!r} が未知の観点")
            continue
        if role not in DELEGATION_ROLES:
            violations.append(f"audit_delegations[{index}].role={role!r} が {sorted(DELEGATION_ROLES)} 外")
            continue
        if (aspect, role) in seen:
            violations.append(f"audit_delegations: (aspect={aspect}, role={role}) の receipt が重複")
            continue
        seen[(aspect, role)] = delegation

    required = required_delegations()
    required_keys = {(item["aspect"], item["role"]) for item in required}
    declared_sessions: set[str] = set()
    for requirement in required:
        aspect, role = requirement["aspect"], requirement["role"]
        delegation = seen.get((aspect, role))
        if delegation is None:
            violations.append(
                f"audit_delegations: {aspect} の {role} 監査 ({requirement['auditor']}/{requirement['component']}) の "
                "fork receipt が無い (独立監査の帰属が自己申告のまま)"
            )
            continue
        label = f"audit_delegations[{aspect}/{role}]"
        if delegation.get("auditor") != requirement["auditor"]:
            violations.append(f"{label}.auditor != {requirement['auditor']!r} (観点↔監査 agent 対応)")
        if delegation.get("component") != requirement["component"]:
            violations.append(f"{label}.component != {requirement['component']!r}")
        if not agent_definition_exists(delegation.get("auditor")):
            violations.append(f"{label}.auditor={delegation.get('auditor')!r} に対応する agent 定義が plugin に実在しない")
        dispatch = delegation.get("dispatch")
        if not isinstance(dispatch, dict):
            violations.append(f"{label}.dispatch: オブジェクトでない (fork の起動方法が記録されていない)")
        else:
            if dispatch.get("tool") not in LEDGER_TOOL_NAMES:
                violations.append(
                    f"{label}.dispatch.tool={dispatch.get('tool')!r} が {list(LEDGER_TOOL_NAMES)} 外"
                    " (独立 context の fork は subagent 起動ツール経由必須)"
                )
            if dispatch.get("subagent_type") != requirement["auditor"]:
                violations.append(f"{label}.dispatch.subagent_type != {requirement['auditor']!r}")
            session_id = dispatch.get("session_id")
            if isinstance(session_id, str) and session_id:
                declared_sessions.add(session_id)
        delegation_verdict = delegation.get("verdict")
        if delegation_verdict not in ASPECT_VERDICTS:
            violations.append(f"{label}.verdict={delegation_verdict!r} が {sorted(ASPECT_VERDICTS)} 外")
        elif role == "primary":
            aspect_value = aspects.get(aspect)
            aspect_verdict = aspect_value.get("verdict") if isinstance(aspect_value, dict) else None
            if aspect_verdict in ASPECT_VERDICTS and delegation_verdict != aspect_verdict:
                violations.extend(
                    _verdict_shift_violations(
                        aspect,
                        label,
                        delegation_verdict,
                        aspect_verdict,
                        aspect_value,
                        sub_input=seen.get((aspect, "sub_input")),
                        ledger=ledger,
                    )
                )
        evidence = delegation.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            violations.append(f"{label}.evidence: 非空配列でない (監査の根拠が空)")
        corroborated, reason = ledger_corroborates(delegation, ledger)
        if not corroborated:
            violations.append(f"{label}: {reason}")

    if len(declared_sessions) > 1:
        violations.append(
            "audit_delegations: 必須 receipt の dispatch.session_id が単一の評価 run に収束していない "
            f"(宣言された session {len(declared_sessions)} 種: {sorted(declared_sessions)}。"
            "複数 run の fork 記録を組み合わせた帰属は 1 回の独立監査の裏取りにならない)"
        )
    if expected_session and declared_sessions and declared_sessions != {expected_session}:
        violations.append(
            f"audit_delegations: 宣言 session {sorted(declared_sessions)} が評価 run の session "
            f"{expected_session!r} と一致しない (過去 run の fork 記録を今回の評価の裏取りへ流用している疑い)"
        )
    for aspect, role in seen:
        if (aspect, role) in required_keys:
            continue
        if role == "primary" and ASPECTS[aspect]["auditor"] == EVALUATOR_NAME:
            violations.append(
                f"audit_delegations: {aspect} は C05 自前評価の観点であり primary の独立監査 receipt を "
                "持てない (虚偽の独立性主張)"
            )
        else:
            violations.append(f"audit_delegations: (aspect={aspect}, role={role}) は必須 receipt 一覧に無い未知の委譲")
    return violations
