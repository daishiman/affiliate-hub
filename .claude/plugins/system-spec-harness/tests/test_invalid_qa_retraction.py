"""REQ-TS20: malformed provenance can be retired without erasing reused-ID history."""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
import jsonschema

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
WRITER_DIR = PLUGIN_ROOT / "skills" / "run-system-spec-elicit" / "scripts"
sys.path.insert(0, str(WRITER_DIR))
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import state_transition_matrix as stm  # noqa: E402
from state_transition_common import TransitionError  # noqa: E402


def digest(entry):
    return hashlib.sha256(json.dumps(entry, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode("utf-8")).hexdigest()


def fixture():
    state = stm.bootstrap_state()
    state["matrix"] = {"security": {"web": {"state": "確定", "qa_ref": "qa-worker"}}}
    state["qa_log"] = [
        {"id": "qa-previous", "question": "old question", "answer": "原文は変えない",
         "source": {"kind": "user-dialogue"}, "superseded_by": "qa-bad"},
        {"id": "qa-bad", "question": "design interpretation", "answer": "AI の設計解釈",
         "source": {"kind": "written-requirements", "ref": "evidence.json"}},
        {"id": "qa-worker", "question": "choose upload", "answer": "Worker に通す",
         "source": {"kind": "user-dialogue"}},
        {"id": "qa-unrelated", "question": "unrelated", "answer": "untouched",
         "source": {"kind": "user-dialogue"}, "superseded_by": "qa-worker"},
    ]
    state["retracted_qa_log"] = [{
        "id": "qa-bad", "reason": "earlier malformed version", "retracted_on": "2026-09-05",
        "retracted_with": "retract-qa", "entry": {"id": "qa-bad", "question": "old", "answer": "old"},
    }]
    state["reopen_log"] = [{"discarded": {"qa_ref": "qa-bad", "qa_refs": ["qa-bad"]}}]
    request = {
        "retraction_id": "retract-invalid-upload-20260906",
        "qa_id": "qa-bad",
        "expected_entry_sha256": digest(state["qa_log"][1]),
        "replacement_qa_id": "qa-worker",
        "expected_replacement_sha256": digest(state["qa_log"][2]),
        "predecessors": [{"qa_id": "qa-previous", "expected_entry_sha256": digest(state["qa_log"][0])}],
        "reason": "書面の path / section / sha256 を持たない設計解釈を取り下げる",
    }
    return state, request


def retire(state, request):
    stm.retract_invalid_qa(state, request)


def test_reused_id_and_predecessor_originals_are_archived_without_source_rewriting():
    state, request = fixture()
    before = copy.deepcopy(state)
    retire(state, request)
    assert [q["id"] for q in state["qa_log"]] == ["qa-previous", "qa-worker", "qa-unrelated"]
    assert state["qa_log"][0] == {**before["qa_log"][0], "superseded_by": "qa-worker"}
    assert state["qa_log"][1:] == before["qa_log"][2:]
    assert state["retracted_qa_log"][0] == before["retracted_qa_log"][0]
    archive = state["retracted_qa_log"][1]
    assert archive["entry"] == before["qa_log"][1]
    assert archive["supersession_history"] == [before["qa_log"][0]]
    assert archive["request"] == request
    assert archive["retraction_id"] == request["retraction_id"]
    assert archive["retracted_with"] == "retract-invalid-qa"
    for key in set(state) - {"qa_log", "retracted_qa_log"}:
        assert state[key] == before[key]


def test_no_predecessor_is_also_supported():
    state, request = fixture()
    state["qa_log"].pop(0)
    request["predecessors"] = []
    retire(state, request)
    assert state["retracted_qa_log"][-1]["supersession_history"] == []


def test_exact_retry_is_idempotent_even_with_an_older_same_id_archive():
    state, request = fixture()
    retire(state, request)
    before = copy.deepcopy(state)
    retire(state, copy.deepcopy(request))
    assert state == before


@pytest.mark.parametrize("field,value", [
    ("reason", "different reason"), ("replacement_qa_id", "qa-unrelated"),
    ("expected_entry_sha256", "0" * 64), ("predecessors", []),
])
def test_retry_with_different_payload_is_rejected_without_changes(field, value):
    state, request = fixture()
    retire(state, request)
    before = copy.deepcopy(state)
    request[field] = value
    with pytest.raises(TransitionError):
        retire(state, request)
    assert state == before


@pytest.mark.parametrize("mutation", [
    "target_changed", "replacement_changed", "predecessor_changed", "new_predecessor",
    "missing_predecessor", "missing_target", "missing_replacement", "duplicate_id",
    "replacement_superseded", "replacement_self", "replacement_invalid_source",
    "valid_target_source", "written_up", "matrix_primary", "matrix_backing",
    "matrix_required_info", "foundation", "decision", "qa_scope", "blank_reason",
    "blank_retraction_id", "unknown_request_field", "malformed_predecessors",
])
def test_invalid_requests_leave_the_entire_state_unchanged(mutation):
    state, request = fixture()
    if mutation == "target_changed":
        state["qa_log"][1]["answer"] += " changed"
    elif mutation == "replacement_changed":
        state["qa_log"][2]["answer"] += " changed"
    elif mutation == "predecessor_changed":
        state["qa_log"][0]["answer"] += " changed"
    elif mutation == "new_predecessor":
        state["qa_log"][3]["superseded_by"] = "qa-bad"
    elif mutation == "missing_predecessor":
        request["predecessors"] = []
    elif mutation == "missing_target":
        state["qa_log"].pop(1)
    elif mutation == "missing_replacement":
        state["qa_log"].pop(2)
    elif mutation == "duplicate_id":
        state["qa_log"].append(copy.deepcopy(state["qa_log"][1]))
    elif mutation == "replacement_superseded":
        state["qa_log"][2]["superseded_by"] = "qa-previous"
        request["expected_replacement_sha256"] = digest(state["qa_log"][2])
    elif mutation == "replacement_self":
        request["replacement_qa_id"] = "qa-bad"
        request["expected_replacement_sha256"] = request["expected_entry_sha256"]
    elif mutation == "replacement_invalid_source":
        state["qa_log"][2]["source"] = {"kind": "written-requirements"}
        request["expected_replacement_sha256"] = digest(state["qa_log"][2])
    elif mutation == "valid_target_source":
        state["qa_log"][1]["source"] = {"kind": "user-dialogue"}
        request["expected_entry_sha256"] = digest(state["qa_log"][1])
    elif mutation == "written_up":
        state["qa_log"][1]["written_up"] = [{"path": "chapter.md"}]
        request["expected_entry_sha256"] = digest(state["qa_log"][1])
    elif mutation == "matrix_primary":
        state["matrix"]["security"]["web"]["qa_ref"] = "qa-bad"
    elif mutation == "matrix_backing":
        state["matrix"]["security"]["web"]["qa_refs"] = ["qa-bad"]
    elif mutation == "matrix_required_info":
        state["matrix"]["security"]["web"]["required_info"] = [{"grounded_by": "qa-bad"}]
    elif mutation == "foundation":
        state["requirements_foundation"]["provenance"] = {"field_sources": [{"qa_id": "qa-bad"}]}
    elif mutation == "decision":
        state["decisions"] = [{"qa_ref": "qa-bad"}]
    elif mutation == "qa_scope":
        state["qa_log"][3]["scope_notes"] = {"origin_qa_id": "qa-bad"}
    elif mutation == "blank_reason":
        request["reason"] = " "
    elif mutation == "blank_retraction_id":
        request["retraction_id"] = ""
    elif mutation == "unknown_request_field":
        request["ignore_live_refs"] = True
    elif mutation == "malformed_predecessors":
        request["predecessors"] = [{"qa_id": "qa-previous"}]
    before = copy.deepcopy(state)
    with pytest.raises(TransitionError):
        retire(state, request)
    assert state == before


def test_a_retired_id_cannot_be_reintroduced_by_chunk():
    state, _ = fixture()
    state["qa_log"].pop(1)
    before = copy.deepcopy(state)
    with pytest.raises(TransitionError, match="取り下げ済み"):
        stm.apply_turn(state, {"qa_id": "qa-bad", "question": "replacement", "answer": "new",
                               "source": {"kind": "user-dialogue"}, "ops": []})
    assert state == before


@pytest.mark.parametrize("mutation", ["entry", "predecessor", "active_id", "duplicate_receipt"])
def test_retry_refuses_corrupted_receipts_or_reintroduced_active_ids(mutation):
    state, request = fixture()
    retire(state, request)
    receipt = state["retracted_qa_log"][-1]
    if mutation == "entry":
        receipt["entry"]["source"] = {"kind": "user-dialogue"}
    elif mutation == "predecessor":
        receipt["supersession_history"][0]["answer"] = "tampered"
    elif mutation == "active_id":
        state["qa_log"].append(copy.deepcopy(receipt["entry"]))
    else:
        state["retracted_qa_log"].append(copy.deepcopy(receipt))
    before = copy.deepcopy(state)
    with pytest.raises(TransitionError):
        retire(state, request)
    assert state == before


def test_archive_schema_accepts_the_receipt_and_requires_its_versioned_history():
    state, request = fixture()
    retire(state, request)
    schema = json.loads((PLUGIN_ROOT / "schemas" / "spec-state.schema.json").read_text())
    archive_schema = {**schema["properties"]["retracted_qa_log"]["items"], "$defs": schema["$defs"]}
    receipt = state["retracted_qa_log"][-1]
    jsonschema.validate(receipt, archive_schema)
    for key in ("retraction_id", "request", "supersession_history"):
        invalid = {k: v for k, v in receipt.items() if k != key}
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(invalid, archive_schema)
    invalid = copy.deepcopy(receipt)
    invalid["request"]["ignore_live_refs"] = True
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid, archive_schema)


def test_cli_preserves_input_and_can_retry_to_an_explicit_output(tmp_path):
    state, request = fixture()
    source, out, payload = (tmp_path / name for name in ("input.json", "output.json", "request.json"))
    source.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    payload.write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
    command = [sys.executable, str(WRITER_DIR / "apply-spec-transition.py"), "retract-invalid-qa",
               "--state", str(source), "--request", str(payload), "--out", str(out)]
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(source.read_text()) == state
    after = out.read_bytes()
    command[command.index(str(source))] = str(out)
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert out.read_bytes() == after
    request["reason"] = "different reason"
    payload.write_text(json.dumps(request), encoding="utf-8")
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 1
    assert out.read_bytes() == after
