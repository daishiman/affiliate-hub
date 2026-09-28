"""The published spec-state schema mirrors the writer's version boundary."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema


# 基点は 2 つある。schema は plugin の中、正本 state はリポジトリ側にあり、
# 同じ ROOT から両方を組み立てると片方が必ず外れる (以前は state 側が
# .claude/system-spec/... を指し、存在しないファイルで 3 件が常時赤だった)。
PLUGIN_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[4]
SCHEMA = PLUGIN_ROOT / "schemas" / "spec-state.schema.json"
LIVE_STATE = REPO_ROOT / "system-spec" / "spec-state.json"


def validator() -> jsonschema.Draft202012Validator:
    return jsonschema.Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8")))


def test_live_exact_legacy_state_remains_readable() -> None:
    validator().validate(json.loads(LIVE_STATE.read_text(encoding="utf-8")))


def test_current_state_requires_design_application_contract_marker() -> None:
    # LIVE_STATE がすでに 1.1 + marker を持つ場合でも、marker 欠落を fail にする契約を検査する。
    state = json.loads(LIVE_STATE.read_text(encoding="utf-8"))
    state["schema_version"] = "1.1"
    state.pop("design_application_contract_version", None)
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(state)
    state["design_application_contract_version"] = "1.0"
    validator().validate(state)


def test_unknown_versions_and_malformed_design_applications_are_rejected() -> None:
    state = json.loads(LIVE_STATE.read_text(encoding="utf-8"))
    state["schema_version"] = "2.0"
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(state)

    current = copy.deepcopy(state)
    current["schema_version"] = "1.1"
    current["design_application_contract_version"] = "1.0"
    current["qa_log"][0]["design_applications"] = [{"principle": "incomplete"}]
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(current)


def test_only_archive_may_preserve_a_source_less_legacy_qa() -> None:
    state = json.loads(LIVE_STATE.read_text(encoding="utf-8"))
    source_less = {
        "id": "qa-legacy-without-source",
        "question": "由来契約より前の問い",
        "answer": "当時の原文",
    }

    active = copy.deepcopy(state)
    active["qa_log"].append(copy.deepcopy(source_less))
    with __import__("pytest").raises(jsonschema.ValidationError):
        validator().validate(active)

    # 正本にまだ退避棚が無いこともある (2026-09-08 の本ブランチがそう)。
    # **この検査の主題は「source を持たない問答は archive にだけ置ける」というスキーマの
    # 分岐**であって、正本が既に退避棚を持っているかどうかではない。棚の有無で
    # 主題が測れなくなるのを避けるため、無ければ空の棚から始める。
    archived = copy.deepcopy(state)
    archived.setdefault("retracted_qa_log", []).append({
        "id": source_less["id"],
        "reason": "現行契約を満たさないため原文のまま退避",
        "retracted_on": "2026-09-06",
        "retracted_with": "retract-qa",
        "entry": source_less,
    })
    validator().validate(archived)
