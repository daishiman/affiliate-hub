"""Small, deterministic system-spec-harness PASS bundle for C19 resume trials."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from .base_shape import FIXED_TS

# 入力インベントリの数え方と受領書の版は評価器 (C05) が持つ。fixture が写すと、
# 写した規則で数えた指紋と写した版を自分で名乗ることになり、
# **本体が規則を変えても fixture だけ緑のまま**になる。
_EVALUATOR = (
    Path(__file__).resolve().parents[4]
    / "system-spec-harness"
    / "skills"
    / "assign-system-spec-completeness-evaluator"
)
if str(_EVALUATOR / "scripts") not in sys.path:
    sys.path.insert(0, str(_EVALUATOR / "scripts"))

from spec_input_inventory import fold, is_input  # noqa: E402

RECEIPT_SCHEMA = _EVALUATOR / "schemas" / "resume-receipt.schema.json"


REQUIREMENTS = """---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

## U1 本質的目的 (essential_purpose)
ローカルの TODO を外部へ送らず管理する。

## U2 背景 (background)
外部 SaaS と通信せず再現可能な受入 fixture が必要である。

## U3 ゴール (goals)
認証済み利用者が永続化された TODO を操作できる。

## U4 目標 (objectives)
単一プロセスと単一 SQLite ファイルで動作する。

## U5 成功基準 (success_criteria)
未認証は 401、再起動後も作成済み TODO が取得できる。

## U6 ステークホルダー (stakeholders)
利用者兼運用者 1 名。

## U7 スコープ (scope)
TODO CRUD、token 認証、SQLite 永続化を対象とする。

## U8 制約 (constraints)
localhost のみで外向き通信を行わない。

## U9 具体的にやりたいこと (concrete_intents)
curl から TODO の作成・取得・更新・削除を行う。
"""

INDEX = """---
kind: index
---

# システム構築仕様書 index

## 要件定義書 (上位概念・憲法)
[要件定義書](./00-requirements-definition.md) は confirmed である。

## 章一覧と集約状態
| カテゴリ | 集約状態 |
|---|---|
| requirements | 確定 |

## 集約状態サマリ
未収集 0、確定 1。

## 全体ドキュメント出典 (未割当参照)
未割当参照なし。
"""

SESSION_ID = "fixture-c19-resume-session"
PLATFORMS = (
    "web",
    "mobile",
    "tablet",
    "desktop-windows",
    "desktop-linux",
    "desktop-macos",
)
ASPECTS = {
    "foundation_trace": ("assign-system-spec-completeness-evaluator", "C05"),
    "decision_guidance": ("assign-system-spec-completeness-evaluator", "C05"),
    "matrix_coverage": ("system-spec-matrix-auditor", "C07"),
    "design_knowledge_reflection": ("assign-system-spec-completeness-evaluator", "C05"),
    "doc_freshness": ("system-spec-doc-freshness-auditor", "C08"),
    "prompt_quality": ("assign-system-spec-completeness-evaluator", "C05"),
}
DELEGATIONS = (
    ("matrix_coverage", "primary", "system-spec-matrix-auditor", "C07"),
    ("matrix_coverage", "sub_input", "system-spec-hearing-auditor", "C06"),
    ("doc_freshness", "primary", "system-spec-doc-freshness-auditor", "C08"),
)


def _json(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def _response_digest(auditor: str) -> str:
    return hashlib.sha256(f"{auditor}:PASS".encode("utf-8")).hexdigest()


def _inputs(files: dict[str, str]) -> dict:
    """この束が実際に持っている入力を数える。

    `files` は「これから materialize する path -> 本文」。数える規則も畳み方も
    評価器の物を借りるので、規則が変われば fixture の指紋も一緒に動く。
    mtime は materialize 時刻に依るが指紋の材料ではないので、固定値を置く。
    """
    entries = [
        {
            "path": path,
            "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
            "mtime": 0,
        }
        for path, body in sorted(files.items())
        if is_input(path)
    ]
    return {"file_count": len(entries), "sha256": fold(entries), "files": entries}


def _receipt_schema_version() -> str:
    schema = json.loads(RECEIPT_SCHEMA.read_text(encoding="utf-8"))
    return schema["properties"]["schema_version"]["const"]


def _completeness(inputs: dict) -> dict:
    return {
        "inputs": inputs,
        "evaluator": {
            "name": "assign-system-spec-completeness-evaluator",
            "version": "0.1.0",
            "context": "fork",
        },
        "verdict": "PASS",
        "aspects": {
            aspect: {
                "verdict": "PASS",
                "auditor": owner,
                "component": component,
                "summary": f"{aspect} fixture PASS",
                "evidence": ["deterministic fixture"],
            }
            for aspect, (owner, component) in ASPECTS.items()
        },
        "audit_delegations": [
            {
                "aspect": aspect,
                "role": role,
                "auditor": auditor,
                "component": component,
                "dispatch": {
                    "tool": "Task",
                    "subagent_type": auditor,
                    "session_id": SESSION_ID,
                    "response_sha256": _response_digest(auditor),
                },
                "verdict": "PASS",
                "evidence": [f"{auditor} deterministic fixture response"],
            }
            for aspect, role, auditor, component in DELEGATIONS
        ],
        "gate_results": [
            {"id": "G-matrix", "name": "validate-coverage-matrix", "exit_code": 0},
            {"id": "G-source-citation", "name": "validate-source-citation", "exit_code": 0},
        ],
        "findings": [{"severity": "info", "bucket": "fixture", "observation": "all canonical gates passed"}],
        "gaps": [],
    }


def _ledger() -> str:
    rows = [
        {
            "schema_version": "1.1",
            "ts": FIXED_TS,
            "session_id": SESSION_ID,
            "tool_name": "Task",
            "subagent_type": auditor,
            "prompt_sha256": "0" * 64,
            "response_sha256": _response_digest(auditor),
            "audit_verdict": "PASS",
            "cwd": "/fixture",
        }
        for _, _, auditor, _ in DELEGATIONS
    ]
    return "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n"


def _spec_state() -> dict:
    return {
        "schema_version": "1.1",
        "design_application_contract_version": "1.0",
        "categories": [{"id": "database", "label": "データベース"}],
        "platforms": list(PLATFORMS),
        "matrix": {
            "database": {
                platform: {"state": "対象外", "reason": "fixture has no runtime database"}
                for platform in PLATFORMS
            }
        },
        "category_aggregate": {"database": "対象外"},
        "requirements_foundation": {},
        "qa_log": [],
        "approval_log": [],
        "reopen_log": [],
        "targets": [],
        "decisions": [],
        "knowledge_candidates": [],
        "hearing_progress": {"loop_count": 0, "next_question": None, "complete": True},
        "excluded_categories": {
            category: "not used by the isolated resume fixture"
            for category in (
                "auth",
                "ui-ux",
                "security",
                "infrastructure",
                "backend",
                "frontend",
                "maintenance-ops",
            )
        },
    }


def content(plugin_version: str) -> dict[str, str]:
    # 入力を先に数えてからレポートへ入れる。レポート自身は入力ではない
    # (`system-spec/*.md` と `spec-state.json` だけが入力) ので循環しない。
    inputs = _inputs(
        {
            "system-spec/index.md": INDEX,
            "system-spec/00-requirements-definition.md": REQUIREMENTS,
            "system-spec/spec-state.json": _json(_spec_state()),
        }
    )
    completeness = _completeness(inputs)
    artifacts = {
        "system-spec/index.md": INDEX,
        "system-spec/00-requirements-definition.md": REQUIREMENTS,
        "system-spec/completeness-report.json": _json(completeness),
        "system-spec/spec-state.json": _json(_spec_state()),
        "system-spec/fetched-references.json": _json({"references": []}),
    }
    receipt = {
        "schema_version": _receipt_schema_version(),
        "inputs": {"file_count": inputs["file_count"], "sha256": inputs["sha256"]},
        "producer": {
            "plugin": "system-spec-harness",
            "version": plugin_version,
            "entry_point": "assign-system-spec-completeness-evaluator",
        },
        "verdict": "PASS",
        "gates": {"coverage": "PASS", "source_citation": "PASS", "evaluator": "PASS"},
        "artifacts": {
            path: hashlib.sha256(body.encode("utf-8")).hexdigest()
            for path, body in sorted(artifacts.items())
        },
        "evaluator": {
            "report_path": "system-spec/completeness-report.json",
            "report_sha256": hashlib.sha256(
                artifacts["system-spec/completeness-report.json"].encode("utf-8")
            ).hexdigest(),
            "fork_ledger_path": "eval-log/system-spec-harness/audit-fork-ledger.jsonl",
            "session_id": SESSION_ID,
        },
        "created_at": FIXED_TS,
    }
    return {
        **artifacts,
        "eval-log/system-spec-harness/audit-fork-ledger.jsonl": _ledger(),
        "system-spec/resume-receipt.json": _json(receipt),
    }
