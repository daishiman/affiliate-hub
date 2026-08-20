#!/usr/bin/env python3
"""record-audit-fork hook の回帰テスト。

## テスト戦略

本 hook は「保護」ではなく「証跡」の層なので、固定すべき契約は 3 つ:

1. **記録の担保**: 本 plugin 同梱 agent への subagent 起動 (`Task`/`Agent`) は台帳へ 1 行追記される。この行が
   `aggregate-completeness.py` の帰属検証の唯一の裏取り材料なので、落とすと fail-closed で
   評価ゲートが通らなくなる (= 緑にはならないが、正当な実行まで止まる)。
2. **記録対象の限定**: 無関係な Task / 非 Task / 未知の subagent_type は記録しない。
   台帳の肥大化と、他 plugin の agent 名で帰属を偽装する経路を断つ。
3. **非 blocking**: 観測専用なので、payload が壊れていても台帳が書けなくても exit 0 を返し
   session を止めない (証跡の欠落は下流が fail-closed で拾う)。

実行: python3 -m unittest discover plugins/system-spec-harness/hooks/tests
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

_HOOK_PATH = Path(__file__).resolve().parents[1] / "record-audit-fork.py"
_spec = importlib.util.spec_from_file_location("record_audit_fork", _HOOK_PATH)
hook = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hook)

_PLUGIN_ROOT = Path(__file__).resolve().parents[2]
_MATRIX_AUDITOR = "system-spec-matrix-auditor"
_HEARING_AUDITOR = "system-spec-hearing-auditor"
_DOC_AUDITOR = "system-spec-doc-freshness-auditor"


def _payload(subagent_type: str, tool_name: str = "Task", prompt: str = "監査してください") -> dict:
    return {
        "session_id": "sess-1",
        "cwd": "/tmp/project",
        "tool_name": tool_name,
        "tool_input": {"subagent_type": subagent_type, "prompt": prompt},
        "tool_response": {"content": [{"type": "text", "text": "監査完了\nAUDIT_VERDICT: PASS"}]},
    }


_MATRIX_ID = "toolu_matrix"
_HEARING_ID = "toolu_hearing"
_DOC_ID = "toolu_doc"


def _official_payload(subagent_type: str, tool_use_id: str, verdict: str) -> dict:
    """現行 Claude Code の call ごとの PostToolUse payload を組み立てる。"""
    payload = _payload(subagent_type, tool_name="Agent")
    payload["tool_use_id"] = tool_use_id
    payload["tool_response"] = {
        "status": "completed",
        "content": [{"type": "text", "text": f"{subagent_type} の監査所見\nAUDIT_VERDICT: {verdict}"}],
        "agentId": f"agent-{tool_use_id}",
    }
    return payload


class AuditAgentRegistryTest(unittest.TestCase):
    """記録対象は plugin 同梱 agent のレジストリに自動追従する。"""

    def test_shipped_auditors_are_registered(self):
        agents = hook.audit_agents(_PLUGIN_ROOT)
        for name in (_MATRIX_AUDITOR, _HEARING_AUDITOR, _DOC_AUDITOR):
            self.assertIn(name, agents, f"{name} が agents/ レジストリに無い")

    def test_missing_agents_dir_is_empty_not_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(hook.audit_agents(Path(tmp)), set())


class BuildRecordTest(unittest.TestCase):
    KNOWN = {_MATRIX_AUDITOR, _HEARING_AUDITOR, _DOC_AUDITOR}

    def test_records_known_auditor_fork(self):
        rec = hook.build_record(_payload(_MATRIX_AUDITOR), self.KNOWN)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["tool_name"], "Task")
        self.assertEqual(rec["subagent_type"], _MATRIX_AUDITOR)
        self.assertEqual(rec["session_id"], "sess-1")
        self.assertEqual(rec["schema_version"], hook.LEGACY_SCHEMA_VERSION)
        self.assertTrue(rec["ts"].endswith("Z"))
        self.assertEqual(len(rec["prompt_sha256"]), 64)
        self.assertEqual(len(rec["response_sha256"]), 64)
        self.assertEqual(rec["audit_verdict"], "PASS")

    def test_official_per_call_payloads_bind_distinct_id_digest_and_verdict(self):
        """3 dispatch は top-level ID と call 固有 response でそれぞれ 1.2 行になる。"""
        dispatches = (
            (_MATRIX_ID, _MATRIX_AUDITOR, "PASS"),
            (_HEARING_ID, _HEARING_AUDITOR, "FAIL"),
            (_DOC_ID, _DOC_AUDITOR, "INDETERMINATE"),
        )
        records = []
        expected_digests = []
        for tool_use_id, agent, verdict in dispatches:
            payload = _official_payload(agent, tool_use_id, verdict)
            records.append(hook.build_record(payload, self.KNOWN))
            canonical = json.dumps(
                payload["tool_response"], ensure_ascii=False, sort_keys=True, separators=(",", ":")
            )
            expected_digests.append(hashlib.sha256(canonical.encode("utf-8")).hexdigest())

        self.assertEqual([r["schema_version"] for r in records], [hook.SCHEMA_VERSION] * 3)
        self.assertEqual([r["tool_use_id"] for r in records], [_MATRIX_ID, _HEARING_ID, _DOC_ID])
        self.assertEqual([r["response_sha256"] for r in records], expected_digests)
        self.assertEqual(len(set(expected_digests)), 3)
        self.assertEqual([r["audit_verdict"] for r in records], ["PASS", "FAIL", "INDETERMINATE"])
        self.assertTrue(all(r["verdict_state"] == hook.VERDICT_STATE_RESOLVED for r in records))

    def test_multiple_marker_blocks_are_ambiguous(self):
        payload = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
        payload["tool_response"]["content"] = [
            {"type": "text", "text": "観点A\nAUDIT_VERDICT: PASS"},
            {"type": "text", "text": "観点B\nAUDIT_VERDICT: PASS"},
        ]

        rec = hook.build_record(payload, self.KNOWN)
        self.assertIsNone(rec["audit_verdict"])
        self.assertEqual(rec["verdict_state"], hook.VERDICT_STATE_AMBIGUOUS)

    def test_legacy_single_payload_preserves_schema_1_1_shape(self):
        """top-level tool_use_id を持たない従来 payload は 1.1 の既存フィールドを維持する。"""
        rec = hook.build_record(_payload(_MATRIX_AUDITOR), self.KNOWN)
        self.assertEqual(rec["schema_version"], hook.LEGACY_SCHEMA_VERSION)
        self.assertEqual(rec["audit_verdict"], "PASS")
        self.assertEqual(
            set(rec),
            {
                "schema_version",
                "ts",
                "session_id",
                "tool_name",
                "subagent_type",
                "prompt_sha256",
                "response_sha256",
                "audit_verdict",
                "cwd",
            },
        )
        self.assertNotIn("verdict_state", rec)
        self.assertNotIn("tool_use_id", rec)

    def test_absent_and_pending_are_distinct_zero_attributions(self):
        """null を 1 種類に潰さない。応答が無い/marker が無いを区別する。"""
        pending = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
        pending["tool_response"] = {}
        self.assertEqual(hook.build_record(pending, self.KNOWN)["verdict_state"], hook.VERDICT_STATE_PENDING)

        absent = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
        absent["tool_response"] = {"content": [{"type": "text", "text": "監査は途中で打ち切りました"}]}
        absent["tool_response"]["status"] = "completed"
        self.assertEqual(hook.build_record(absent, self.KNOWN)["verdict_state"], hook.VERDICT_STATE_ABSENT)

    def test_async_launched_marker_never_becomes_completion_receipt(self):
        """起動受理 response の adversarial marker を完成済み verdict と誤認しない。"""
        payload = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
        payload["tool_response"]["status"] = hook.RESPONSE_STATUS_ASYNC_LAUNCHED

        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["schema_version"], hook.SCHEMA_VERSION)
        self.assertEqual(rec["tool_use_id"], _MATRIX_ID)
        self.assertIsNone(rec["audit_verdict"])
        self.assertEqual(rec["verdict_state"], hook.VERDICT_STATE_PENDING)

    def test_agent_unknown_or_missing_status_never_resolves_marker(self):
        for status in ("failed", None):
            with self.subTest(status=status):
                payload = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
                if status is None:
                    del payload["tool_response"]["status"]
                else:
                    payload["tool_response"]["status"] = status
                rec = hook.build_record(payload, self.KNOWN)
                self.assertIsNone(rec["audit_verdict"])
                self.assertEqual(rec["verdict_state"], hook.VERDICT_STATE_PENDING)

    def test_task_with_id_and_explicit_async_status_never_resolves_marker(self):
        """ID付きTaskも明示的な未完了statusをschema 1.2 PASSへ昇格させない。"""
        payload = _payload(_MATRIX_AUDITOR, tool_name="Task")
        payload["tool_use_id"] = _MATRIX_ID
        payload["tool_response"]["status"] = hook.RESPONSE_STATUS_ASYNC_LAUNCHED

        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["schema_version"], hook.SCHEMA_VERSION)
        self.assertEqual(rec["tool_use_id"], _MATRIX_ID)
        self.assertIsNone(rec["audit_verdict"])
        self.assertEqual(rec["verdict_state"], hook.VERDICT_STATE_PENDING)

    def test_legacy_task_with_explicit_failed_status_keeps_shape_but_not_verdict(self):
        """IDなしTaskは1.1形を保つが、明示的な未完了statusのmarkerは受理しない。"""
        payload = _payload(_MATRIX_AUDITOR, tool_name="Task")
        payload["tool_response"]["status"] = "failed"

        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["schema_version"], hook.LEGACY_SCHEMA_VERSION)
        self.assertIsNone(rec["audit_verdict"])
        self.assertNotIn("verdict_state", rec)

    def test_requires_canonical_audit_verdict_marker_on_final_nonempty_line(self):
        payload = _payload(_MATRIX_AUDITOR)
        payload["tool_response"] = {"text": "verdict: PASS"}
        rec = hook.build_record(payload, self.KNOWN)
        self.assertIsNone(rec["audit_verdict"])
        payload["tool_response"] = {"text": "AUDIT_VERDICT: PASS\nAUDIT_VERDICT: FAIL"}
        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["audit_verdict"], "FAIL")

    def test_ignores_prompt_markers_embedded_before_final_response_marker(self):
        payload = _payload(_MATRIX_AUDITOR)
        payload["tool_response"] = {
            "status": "completed",
            "prompt": {
                "text": "許容値:\nAUDIT_VERDICT: PASS\nAUDIT_VERDICT: FAIL\nAUDIT_VERDICT: INDETERMINATE"
            },
            "agentId": "agent-123",
            "content": [{"type": "text", "text": "監査完了\nAUDIT_VERDICT: PASS\n"}],
            "usage": {"service_tier": "standard"},
        }
        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["audit_verdict"], "PASS")

    def test_ignores_metadata_strings_after_response_content(self):
        """実 Agent payload の応答後 metadata を最終行として誤認しない。"""
        payload = _payload(_MATRIX_AUDITOR)
        payload["tool_response"] = {
            "content": [{"type": "text", "text": "監査完了\nAUDIT_VERDICT: FAIL"}],
            "totalDurationMs": 1234,
            "agentId": "a9c9192ad9ad21e63",
            "status": "completed",
        }
        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["audit_verdict"], "FAIL")

    def test_ignores_non_text_content_blocks_and_prompt_markers(self):
        payload = _official_payload(_MATRIX_AUDITOR, _MATRIX_ID, "PASS")
        payload["tool_response"] = {
            "prompt": {"text": "AUDIT_VERDICT: FAIL"},
            "content": [
                {"type": "metadata", "text": "AUDIT_VERDICT: FAIL"},
                {"type": "text", "text": "監査完了\nAUDIT_VERDICT: PASS"},
            ],
            "status": "completed",
            "status_detail": "AUDIT_VERDICT: FAIL",
        }
        rec = hook.build_record(payload, self.KNOWN)
        self.assertEqual(rec["audit_verdict"], "PASS")
        self.assertEqual(rec["verdict_state"], hook.VERDICT_STATE_RESOLVED)

    def test_rejects_marker_when_final_nonempty_line_is_not_marker(self):
        payload = _payload(_MATRIX_AUDITOR)
        payload["tool_response"] = {"text": "AUDIT_VERDICT: PASS\n追加説明"}
        rec = hook.build_record(payload, self.KNOWN)
        self.assertIsNone(rec["audit_verdict"])

    def test_agent_without_top_level_tool_use_id_is_rejected_not_downgraded(self):
        """現行 Agent の ID 欠落/空文字を schema 1.1 の旧 Task として受理しない。"""
        for missing_id in (None, "", "   "):
            with self.subTest(tool_use_id=missing_id):
                payload = _payload(_MATRIX_AUDITOR, tool_name="Agent")
                payload["tool_response"]["status"] = "completed"
                if missing_id is not None:
                    payload["tool_use_id"] = missing_id
                self.assertIsNone(hook.build_record(payload, self.KNOWN))

    def test_records_plugin_qualified_auditor_fork_as_local_stem(self):
        """live-trial の実 payload は ``plugin:agent``。ledger は consumer 契約の stem へ揃える。"""
        rec = hook.build_record(
            _payload(f"{hook.PLUGIN_NAME}:{_MATRIX_AUDITOR}"), self.KNOWN
        )
        self.assertIsNotNone(rec)
        self.assertEqual(rec["subagent_type"], _MATRIX_AUDITOR)

    def test_other_plugin_qualified_auditor_is_not_recorded(self):
        self.assertIsNone(
            hook.build_record(_payload(f"other-plugin:{_MATRIX_AUDITOR}"), self.KNOWN)
        )

    def test_prompt_body_is_not_recorded(self):
        rec = hook.build_record(_payload(_MATRIX_AUDITOR, prompt="機微な本文"), self.KNOWN)
        self.assertNotIn("機微な本文", json.dumps(rec, ensure_ascii=False))

    def test_unknown_subagent_type_is_not_recorded(self):
        # 他 plugin の agent 名で帰属を偽装する経路を断つ。
        self.assertIsNone(hook.build_record(_payload("general-purpose"), self.KNOWN))

    def test_non_subagent_tool_is_not_recorded(self):
        for tool_name in ("Bash", "Skill", "TaskCreate", ""):
            self.assertIsNone(
                hook.build_record(_payload(_MATRIX_AUDITOR, tool_name=tool_name), self.KNOWN),
                f"tool_name={tool_name!r} が記録された",
            )

    def test_missing_subagent_type_is_not_recorded(self):
        payload = {"tool_name": "Task", "tool_input": {"prompt": "x"}}
        self.assertIsNone(hook.build_record(payload, self.KNOWN))

    def test_malformed_tool_input_is_not_recorded(self):
        self.assertIsNone(hook.build_record({"tool_name": "Task", "tool_input": "oops"}, self.KNOWN))

    def test_empty_payload_is_not_recorded(self):
        self.assertIsNone(hook.build_record({}, self.KNOWN))


class LedgerPathTest(unittest.TestCase):
    def test_env_override_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "custom.jsonl"
            os.environ[hook.LEDGER_ENV] = str(target)
            try:
                self.assertEqual(hook.ledger_path(), target)
            finally:
                del os.environ[hook.LEDGER_ENV]

    def test_project_dir_relative_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ.pop(hook.LEDGER_ENV, None)
            os.environ["CLAUDE_PROJECT_DIR"] = tmp
            try:
                self.assertEqual(hook.ledger_path(), Path(tmp) / hook.LEDGER_RELPATH)
            finally:
                del os.environ["CLAUDE_PROJECT_DIR"]


class EndToEndTest(unittest.TestCase):
    """実 hook プロセスを stdin 経由で起動し、台帳追記と exit 0 を固定する。"""

    def _run(self, payload: dict, ledger: Path) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env[hook.LEDGER_ENV] = str(ledger)
        env["CLAUDE_PLUGIN_ROOT"] = str(_PLUGIN_ROOT)
        return subprocess.run(
            [sys.executable, str(_HOOK_PATH)],
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )

    def test_append_only_accumulates_forks(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "nested" / "audit-fork-ledger.jsonl"
            for name in (_MATRIX_AUDITOR, _HEARING_AUDITOR, _DOC_AUDITOR):
                # pinned plugin を使う live-trial と同じ qualified payload を固定する。
                proc = self._run(_payload(f"{hook.PLUGIN_NAME}:{name}"), ledger)
                self.assertEqual(proc.returncode, 0, proc.stderr)
            lines = [json.loads(x) for x in ledger.read_text(encoding="utf-8").splitlines() if x.strip()]
            self.assertEqual([r["subagent_type"] for r in lines], [_MATRIX_AUDITOR, _HEARING_AUDITOR, _DOC_AUDITOR])

    def test_agent_tool_fork_lands_in_ledger(self):
        """現行ハーネス ('Agent') 経由の実 fork が end-to-end で台帳に残ること (issue: HarnessHub-scl の再発防止)。"""
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            payload = _official_payload(
                f"{hook.PLUGIN_NAME}:{_HEARING_AUDITOR}", _HEARING_ID, "PASS"
            )
            proc = self._run(payload, ledger)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            lines = [json.loads(x) for x in ledger.read_text(encoding="utf-8").splitlines() if x.strip()]
            self.assertEqual(len(lines), 1)
            self.assertEqual(lines[0]["tool_name"], "Agent")
            self.assertEqual(lines[0]["subagent_type"], _HEARING_AUDITOR)
            self.assertEqual(lines[0]["tool_use_id"], _HEARING_ID)

    def test_agent_without_tool_use_id_leaves_no_legacy_ledger_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            payload = _payload(f"{hook.PLUGIN_NAME}:{_HEARING_AUDITOR}", tool_name="Agent")
            payload["tool_response"]["status"] = "completed"
            proc = self._run(payload, ledger)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertFalse(ledger.exists(), "ID 欠落 Agent が schema 1.1 台帳行へ downgrade された")

    def test_task_with_id_async_marker_lands_as_pending_not_completion(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            payload = _payload(f"{hook.PLUGIN_NAME}:{_HEARING_AUDITOR}", tool_name="Task")
            payload["tool_use_id"] = _HEARING_ID
            payload["tool_response"]["status"] = hook.RESPONSE_STATUS_ASYNC_LAUNCHED
            proc = self._run(payload, ledger)
            self.assertEqual(proc.returncode, 0, proc.stderr)

            records = [json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines() if line]
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["schema_version"], hook.SCHEMA_VERSION)
            self.assertEqual(records[0]["tool_use_id"], _HEARING_ID)
            self.assertIsNone(records[0]["audit_verdict"])
            self.assertEqual(records[0]["verdict_state"], hook.VERDICT_STATE_PENDING)

    def test_unrelated_task_leaves_no_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            proc = self._run(_payload("general-purpose"), ledger)
            self.assertEqual(proc.returncode, 0)
            self.assertFalse(ledger.exists(), "記録対象外の Task で台帳が生成された")

    def test_three_official_per_call_dispatches_record_every_verdict(self):
        """公式どおり 1 call = 1 payload の3 dispatchが、別々の1.2行として残る。"""
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            dispatches = (
                (_MATRIX_ID, _MATRIX_AUDITOR, "PASS"),
                (_HEARING_ID, _HEARING_AUDITOR, "FAIL"),
                (_DOC_ID, _DOC_AUDITOR, "INDETERMINATE"),
            )
            for tool_use_id, agent, verdict in dispatches:
                payload = _official_payload(f"{hook.PLUGIN_NAME}:{agent}", tool_use_id, verdict)
                proc = self._run(payload, ledger)
                self.assertEqual(proc.returncode, 0, proc.stderr)

            lines = [json.loads(x) for x in ledger.read_text(encoding="utf-8").splitlines() if x.strip()]
            self.assertEqual(len(lines), 3)
            self.assertEqual([r["schema_version"] for r in lines], [hook.SCHEMA_VERSION] * 3)
            self.assertEqual([r["audit_verdict"] for r in lines], ["PASS", "FAIL", "INDETERMINATE"])
            self.assertTrue(all(r["verdict_state"] == hook.VERDICT_STATE_RESOLVED for r in lines))
            self.assertEqual([r["tool_use_id"] for r in lines], [_MATRIX_ID, _HEARING_ID, _DOC_ID])
            self.assertEqual(len({r["response_sha256"] for r in lines}), 3)

    def test_parallel_subprocess_appends_keep_every_jsonl_line_intact(self):
        """並列 PostToolUse process が同じ台帳へ追記しても JSON 行が混線しない。"""
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "nested" / "audit-fork-ledger.jsonl"
            count = 32

            def run_one(index: int) -> subprocess.CompletedProcess:
                payload = _official_payload(
                    f"{hook.PLUGIN_NAME}:{_MATRIX_AUDITOR}", f"toolu_parallel_{index}", "PASS"
                )
                return self._run(payload, ledger)

            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
                processes = list(executor.map(run_one, range(count)))
            self.assertTrue(all(proc.returncode == 0 for proc in processes))

            raw_lines = [line for line in ledger.read_text(encoding="utf-8").splitlines() if line]
            records = [json.loads(line) for line in raw_lines]
            self.assertEqual(len(records), count)
            self.assertEqual({r["tool_use_id"] for r in records}, {f"toolu_parallel_{i}" for i in range(count)})

    def test_broken_payload_is_non_blocking(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            env = dict(os.environ)
            env[hook.LEDGER_ENV] = str(ledger)
            proc = subprocess.run(
                [sys.executable, str(_HOOK_PATH)],
                input="{not json",
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, "観測専用 hook が session を blocking した")


def _async_launch_payload(subagent_type: str, tool_use_id: str, agent_id: str) -> dict:
    """非同期起動の PostToolUse payload (status=async_launched)。

    2026-08-20 の実測形。応答本文はまだ無く、metadata に agentId だけが載る。
    **これは起動受理であって最終応答ではない。**
    """
    payload = _payload(subagent_type, tool_name="Agent")
    payload["tool_use_id"] = tool_use_id
    payload["tool_response"] = {
        "status": "async_launched",
        "agentId": agent_id,
        "content": [{"type": "text", "text": f"Agent started with ID: {agent_id}"}],
    }
    return payload


def _stop_payload(agent_id: str, message: str, session_id: str = "sess-1") -> dict:
    """SubagentStop payload。

    **起点の tool_use_id を運んでいない。**実行中バイナリ (2.1.237) の payload 構築は
    {hook_event_name, agent_id, agent_type, agent_transcript_path, last_assistant_message}
    で、hook 起動時の toolUseID は randomUUID() である。ここを模して、意図的に
    tool_use_id を入れない。**入れて書いたテストは、実物には無い手がかりを前提にする。**
    """
    return {
        "hook_event_name": "SubagentStop",
        "session_id": session_id,
        "cwd": "/tmp/project",
        "agent_id": agent_id,
        "agent_type": "system-spec-matrix-auditor",
        "agent_transcript_path": "/tmp/transcript.jsonl",
        "last_assistant_message": message,
    }


class AsyncResolutionTest(unittest.TestCase):
    """非同期完了を agent_id で起動行へ束ねる (schema 1.3)。

    ## この配線は 2026-08-20 のセッションでは発火を実証できていない

    plugin の `hooks/hooks.json` は**セッション開始時に読まれ、セッション中の変更は
    反映されない**。陽性対照として、既に発火が確認できている PreToolUse の `Bash`
    matcher へ同じ probe を登録して Bash を実行したが、probe の出力ファイルは作られ
    なかった。したがって「書いたものが動かない」ではなく「登録が読まれていない」で
    あることまでは切り分けたが、SubagentStop → hook → 台帳の実配線は未実証である。

    **塞げていない穴は文章ではなく検査として書く**、というのが当プロジェクトの規律なので、
    ここに検査として残す。以下は組み立て層 (build_resolution) の契約だけを固定しており、
    **イベントが実際に届くかは検査していない**。

    ### 塞がった日の反転先

    新しいセッション (hooks.json 登録が読まれた状態) で監査 fork を 1 件実行し、台帳に
    `record_kind=resolution` / `verdict_state=resolved` の行が生まれることを確認できた日に、
    このクラスへ end-to-end の検査を 1 本足し、この doc comment を削る。
    それまでは「未実証」が正しい記述である。
    """

    KNOWN = {_MATRIX_AUDITOR, _HEARING_AUDITOR, _DOC_AUDITOR}
    AGENT_ID = "ae3fdebd381359d47"
    TID = "toolu_async_1"

    def _launch_row(self, **overrides) -> dict:
        row = hook.build_record(
            _async_launch_payload(_MATRIX_AUDITOR, self.TID, self.AGENT_ID), self.KNOWN
        )
        row.update(overrides)
        return row

    def test_async_launch_records_agent_id_and_stays_pending(self):
        row = self._launch_row()
        self.assertEqual(row["verdict_state"], hook.VERDICT_STATE_PENDING)
        self.assertIsNone(row["audit_verdict"])
        self.assertEqual(row["agent_id"], self.AGENT_ID)
        self.assertEqual(row["record_kind"], hook.RECORD_KIND_LAUNCH)

    def test_resolution_binds_verdict_to_the_launch_row(self):
        launch = self._launch_row()
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        res = hook.build_resolution(payload, self.KNOWN, [launch])
        self.assertIsNotNone(res)
        self.assertEqual(res["schema_version"], hook.RESOLUTION_SCHEMA_VERSION)
        self.assertEqual(res["record_kind"], hook.RECORD_KIND_RESOLUTION)
        self.assertEqual(res["audit_verdict"], "PASS")
        self.assertEqual(res["verdict_state"], hook.VERDICT_STATE_RESOLVED)
        # 帰属先は起動行。SubagentStop payload 側の文脈ではない。
        self.assertEqual(res["tool_use_id"], self.TID)
        self.assertEqual(res["session_id"], launch["session_id"])
        self.assertEqual(res["subagent_type"], launch["subagent_type"])
        self.assertEqual(res["agent_id"], self.AGENT_ID)

    def test_launch_without_agent_id_can_never_be_resolved(self):
        """条件 1。**記録が無い起動行は、後から resolved にできない。**"""
        launch = self._launch_row(agent_id=None)
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, [launch]))

    def test_zero_or_multiple_matches_are_not_resolved(self):
        """条件 2。**一意でない照合は帰属ではない。**

        直列実行が保証していた「時間順で対応が一意に決まる」が失われた以上、
        agent_id の照合だけが唯一の帰属根拠になる。0 件も 2 件も根拠にならない。
        """
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, []))
        other = self._launch_row(tool_use_id="toolu_async_2")
        self.assertIsNone(
            hook.build_resolution(payload, self.KNOWN, [self._launch_row(), other])
        )
        # 別 agent_id の起動行しかない場合も引き当てない。
        self.assertIsNone(
            hook.build_resolution(payload, self.KNOWN, [self._launch_row(agent_id="別のID")])
        )

    def test_marker_must_be_the_final_line(self):
        """条件 3。本文中に marker があっても最終行でなければ採らない。"""
        launch = self._launch_row()
        buried = _stop_payload(
            self.AGENT_ID, "AUDIT_VERDICT: PASS\nこのあとに考察を書き足してしまった"
        )
        self.assertIsNone(hook.build_resolution(buried, self.KNOWN, [launch]))
        # 対になる緑: 最終行なら採る。
        ok = _stop_payload(self.AGENT_ID, "考察\nAUDIT_VERDICT: PASS")
        self.assertIsNotNone(hook.build_resolution(ok, self.KNOWN, [launch]))

    def test_invalid_marker_value_is_not_resolved(self):
        launch = self._launch_row()
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: MOSTLY_FINE")
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, [launch]))

    def test_second_resolution_for_the_same_agent_is_refused(self):
        """条件 4。**先に書かれた解決行を後から上書きする形は作らない。**"""
        launch = self._launch_row()
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        first = hook.build_resolution(payload, self.KNOWN, [launch])
        self.assertIsNotNone(first)
        second = hook.build_resolution(
            _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: FAIL"),
            self.KNOWN,
            [launch, first],
        )
        self.assertIsNone(second, "同一 agent_id へ 2 通目の解決行を作った")

    def test_already_resolved_launch_is_not_reresolved(self):
        launch = self._launch_row(verdict_state=hook.VERDICT_STATE_RESOLVED)
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: FAIL")
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, [launch]))

    def test_non_subagent_stop_event_is_ignored(self):
        launch = self._launch_row()
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        payload["hook_event_name"] = "Stop"
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, [launch]))

    def test_unknown_subagent_type_is_not_resolved(self):
        launch = self._launch_row(subagent_type="他 plugin の agent")
        payload = _stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")
        self.assertIsNone(hook.build_resolution(payload, self.KNOWN, [launch]))

    def test_agent_id_is_not_taken_from_the_prompt(self):
        """prompt 内の説明文から ID を拾うと、起動していない fork へ帰属させられる。"""
        response = {
            "status": "async_launched",
            "prompt": "agentId: 偽物ID を騙る説明文",
            "content": [{"type": "text", "text": "起動しました"}],
        }
        self.assertIsNone(hook.extract_agent_id(response))

    def test_stop_event_appends_a_resolution_row_end_to_end(self):
        """hook を process として起動し、台帳へ解決行が 1 行追記されることを固定する。

        **これは hook の中身の検査であって、イベントが届くかの検査ではない。**
        SubagentStop が実際に発火するかは、上の doc comment のとおり未実証である。
        """
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            launch = self._launch_row()
            ledger.write_text(json.dumps(launch, ensure_ascii=False) + "\n", encoding="utf-8")
            env = dict(os.environ)
            env[hook.LEDGER_ENV] = str(ledger)
            proc = subprocess.run(
                [sys.executable, str(_HOOK_PATH)],
                input=json.dumps(_stop_payload(self.AGENT_ID, "所見\nAUDIT_VERDICT: PASS")),
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )
            self.assertEqual(proc.returncode, 0)
            rows = [json.loads(l) for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip()]
            self.assertEqual(len(rows), 2, "起動行を書き換えず追記したか")
            self.assertEqual(rows[0], launch, "**append-only。起動行は書き換えない。**")
            self.assertEqual(rows[1]["record_kind"], hook.RECORD_KIND_RESOLUTION)
            self.assertEqual(rows[1]["audit_verdict"], "PASS")
            self.assertEqual(rows[1]["tool_use_id"], self.TID)

    def test_unattributable_stop_writes_nothing(self):
        """引き当てられないときは行を作らない。pending のまま残すのが安全側。"""
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / "audit-fork-ledger.jsonl"
            ledger.write_text("", encoding="utf-8")
            env = dict(os.environ)
            env[hook.LEDGER_ENV] = str(ledger)
            proc = subprocess.run(
                [sys.executable, str(_HOOK_PATH)],
                input=json.dumps(_stop_payload("見知らぬID", "所見\nAUDIT_VERDICT: PASS")),
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )
            self.assertEqual(proc.returncode, 0)
            self.assertEqual(ledger.read_text(encoding="utf-8"), "")
            self.assertIn("一意に帰属できません", proc.stderr)


if __name__ == "__main__":
    unittest.main()
