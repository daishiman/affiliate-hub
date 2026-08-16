"""C14 live-trial 監査ヘルパーの契約テスト。

本 test の主眼は「監査が検査として成立しているか」であり、監査が緑を返すことではない。
過去に次の 5 欠陥で `pass:true` が OUT1 充足を意味しなくなっていた (HarnessHub-9ndl):

1. 反転     — 昇格適格 node を draft と呼んで数え、昇格させると落ちた
2. トートロジー — 監査スクリプト内の述語を監査自身が検査していた
3. 偽の次元 — binding 3 系列が同一値の 3 回計算だった
4. 帰属誤り — write count が bridge の dry_run エコーで、実作成数ではなかった
5. 実書込み不能 — pass 条件が「ローカル状態が動いていないこと」を含み、実書込み run では
   構造的に必ず赤くなった

したがって以下は「緑になること」と「壊した変異版で赤くなること」を対で固定する。
"""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = Path(__file__).parent / "fixtures" / "audit_decompose_live_trial.py"
SCENARIO_PATH = Path(__file__).parent / "fixtures" / "live-trial-positive-scenarios.json"
SPEC = importlib.util.spec_from_file_location("audit_decompose_live_trial", SCRIPT)
assert SPEC and SPEC.loader
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

FIXED_TS = "2026-07-13T07:50:00Z"
ARCHITECTURE_ID = "arch-webapp-base"
DRAFT_ID = "feat-user-auth-001"
PROMOTED_ID = "feat-dashboard-001"
CONTENT_ROOTS = {
    "issues": "issues",
    "tasks": "tasks",
    "specifications": "specs",
    "architecture": "architecture",
    "features": "features",
    "documents": "docs",
    "system_spec": "system-spec",
}
GATE_REMOVED_VALIDATOR = """#!/usr/bin/env python3
import json, sys
sys.stdin.read()
json.dump(
    {"valid": True, "implementation_readiness": "complete", "missing_sections": [], "violations": []},
    sys.stdout,
)
"""


# --------------------------------------------------------------------------- #
# fixture 構築
# --------------------------------------------------------------------------- #
def _node(node_id: str, kind: str, root: str, depends_on: list[str]) -> dict:
    """graph-node.schema.json の required key と kind 条件分岐を満たす決定論 node 雛形。"""
    file_path = f"{root}/{node_id}.md"
    # schema の allOf: architecture は artifact_subtypes 1件以上、feature は 0 件かつ
    # architecture_refs 1件以上。graph 内に実在する node id を参照する。
    return {
        "graph_node_id": node_id,
        "artifact_kind": kind,
        "artifact_subtypes": ["backend"] if kind == "architecture" else [],
        "title": f"{node_id} title",
        "project_id": "live-trial-fixture",
        "domain": "development",
        "status": "draft",
        "closed_at": None,
        "owners": ["live-trial"],
        "tags": ["live-trial", "fixture"],
        "priority": None,
        "start_date": None,
        "target_date": None,
        "iteration": None,
        "created_at": FIXED_TS,
        "updated_at": FIXED_TS,
        "depends_on": depends_on,
        "related_nodes": [],
        "resource_scope": [],
        "purpose": "C14 マクロ分解 live-trial の監査契約を固定するための決定論 node",
        "goal": "publication gate の判定が実装側から導出できる状態",
        "scope_in": ["preview graph の観測"],
        "scope_out": ["実 repository の変更"],
        "acceptance": ["publication gate の判定が実装 script の violation から導かれる"],
        "architecture_refs": [ARCHITECTURE_ID] if kind == "feature" else [],
        "parent_feature": None,
        "feature_package_id": None,
        "phase_ref": None,
        "file_path": file_path,
        "template_id": kind,
        "template_version": "1.0.0",
        "confirmation_status": "draft",
        "evaluation_status": "pending",
        "confirmation_evidence": {
            "evaluated_digest": None,
            "evaluator": None,
            "evidence_ref": None,
        },
        "source_lineage": {
            "imported_at": FIXED_TS,
            "origin_kind": "manual",
            "source_digest": None,
            "source_path": None,
            "source_plugin": None,
            "source_version": None,
        },
        "classification_confidence": 1.0,
        "classification_reason": "live-trial fixture として決定論生成された node",
        "classification_candidates": [
            {"artifact_kind": kind, "candidate_path": file_path, "confidence": 1.0}
        ],
        "issue_linkage": None,
        "tracker_binding": "none",
        "beads_linkage": None,
        "github_publication": {
            "labels": [],
            "milestone": None,
            "mode": "local_only",
            "project_aliases": [],
        },
        "github_project_linkages": [],
        "pull_request_linkages": [],
        "execution_contexts": [],
        "completion_evidence": {
            "completed_at": None,
            "evidence_refs": [],
            "policy": "linked_pr_merged_all",
            "reconciled_at": None,
            "source": None,
            "status": "open",
        },
        "implementation_readiness": {
            "checked_at": FIXED_TS,
            "missing_sections": [],
            "status": "incomplete",
        },
    }


def _promote(node: dict) -> dict:
    """run 中に confirmed / evaluation-pass / readiness-complete へ昇格した形。"""
    promoted = copy.deepcopy(node)
    promoted.update(
        {
            "status": "active",
            "confirmation_status": "confirmed",
            "evaluation_status": "pass",
            "confirmation_evidence": {
                "evaluated_digest": None,
                "evaluator": "run-dev-graph-decompose",
                "evidence_ref": "eval-log/macro-preview.json",
            },
            "implementation_readiness": {
                "checked_at": FIXED_TS,
                "missing_sections": [],
                "status": "complete",
            },
        }
    )
    promoted["confirmation_evidence"]["evaluated_digest"] = (
        AUDIT.INTEGRITY.evaluation_digest(promoted)
    )
    return promoted


def _preview() -> dict:
    architecture = _node(ARCHITECTURE_ID, "architecture", "architecture", [])
    draft = _node(DRAFT_ID, "feature", "features", [])
    promoted = _promote(_node(PROMOTED_ID, "feature", "features", [DRAFT_ID]))
    return {"graph_revision": 1, "nodes": [architecture, draft, promoted]}


def _rebind(nodes: list[dict], binding: str) -> list[dict]:
    """run の graph に別の tracker_binding が永続した状態を作る。

    binding 次元の観測は「graph に何が残ったか」から導かれるので、別系列の run を
    再現する唯一の方法は node 宣言を差し替えることであって、監査へ渡す flag ではない。
    """
    rebound = copy.deepcopy(nodes)
    for node in rebound:
        node["tracker_binding"] = binding
    return rebound


def _write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", "utf-8")


def _init_repo(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init", "-q", str(root)], check=True, capture_output=True)
    _write_json(
        root / ".dev-graph/config.json",
        {
            "content_roots": CONTENT_ROOTS,
            "local_state": {
                "graph": ".dev-graph/state/graph.json",
                "cache": ".dev-graph/cache",
                "locks": ".dev-graph/locks",
            },
        },
    )
    _write_json(root / ".dev-graph/state/graph.json", {"graph_revision": 0, "nodes": []})


def _trial(tmp_path: Path, *, graph_nodes: list[dict] | None = None) -> dict:
    """pre-state → 実書込み run → audit 引数一式、という live-trial の骨格を再現する。"""
    repo = tmp_path / "fixture-repo"
    _init_repo(repo)
    pre_state_path = repo / "eval-log/pre-state.json"
    _write_json(pre_state_path, AUDIT.capture_state(repo))

    preview = _preview()
    # 被験 skill が実書込みで登録した後の状態 (graph が実際に動く)。
    _write_json(
        repo / ".dev-graph/state/graph.json",
        {"graph_revision": 1, "nodes": graph_nodes if graph_nodes is not None else preview["nodes"]},
    )
    preview_path = repo / "eval-log/macro-preview.json"
    _write_json(preview_path, preview)
    return {
        "repo_root": repo,
        "preview_path": preview_path,
        "scenario_path": SCENARIO_PATH,
        "pre_state_path": pre_state_path,
        "plugin_root": PLUGIN_ROOT,
        "run_mode": "apply",
        "run_binding": "none",
    }


def _plugin_with_gate_removed(tmp_path: Path) -> Path:
    """validate-graph-schema.py だけを「何も違反を返さない」版へ差し替えた plugin 木。

    ゲートの正本は実装側にあるので、実装を壊せば監査も落ちなければならない。
    """
    fake = tmp_path / "mutated-plugin"
    (fake / "scripts").mkdir(parents=True)
    for entry in PLUGIN_ROOT.iterdir():
        if entry.name != "scripts":
            (fake / entry.name).symlink_to(entry)
    for entry in (PLUGIN_ROOT / "scripts").iterdir():
        (fake / "scripts" / entry.name).symlink_to(entry)
    mutated = fake / "scripts/validate-graph-schema.py"
    mutated.unlink()
    mutated.write_text(GATE_REMOVED_VALIDATOR, "utf-8")
    mutated.chmod(0o755)
    return fake


# --------------------------------------------------------------------------- #
# graph 測定 (従来どおり preview から導出)
# --------------------------------------------------------------------------- #
def test_graph_measurements_are_derived_from_preview() -> None:
    graph = AUDIT._graph_measurements(
        _preview()["nodes"],
        {"metric": "max_inter_feature_depends_on_per_feature", "max_value": 3},
    )

    assert graph["acyclic"] is True
    assert graph["measured_max"] == 1
    assert graph["threshold_pass"] is True
    assert graph["task_count"] == 0
    assert graph["architecture_count"] == 1


# --------------------------------------------------------------------------- #
# 欠陥 2: publication 判定の正本が実装側にあること
# --------------------------------------------------------------------------- #
def test_publication_gate_is_decided_by_the_implementation_script(tmp_path: Path) -> None:
    repo = tmp_path / "gate-repo"
    _init_repo(repo)
    preview = _preview()
    features = [node for node in preview["nodes"] if node["artifact_kind"] == "feature"]

    decisions = AUDIT._publication_decisions(repo, PLUGIN_ROOT, preview, features)

    assert decisions[DRAFT_ID]["publishable"] is False
    assert decisions[PROMOTED_ID]["publishable"] is True
    # 判定は監査内の述語ではなく、実装 script の呼出し結果から来ている。
    for decision in decisions.values():
        assert decision["decided_by"][1].endswith("scripts/validate-graph-schema.py")
    assert [item["code"] for item in decisions[DRAFT_ID]["blocking_violations"]] == [
        "active_not_ready"
    ]
    assert decisions[PROMOTED_ID]["blocking_violations"] == []


def test_publication_gate_follows_the_implementation_when_it_is_mutated(tmp_path: Path) -> None:
    repo = tmp_path / "gate-repo"
    _init_repo(repo)
    preview = _preview()
    features = [node for node in preview["nodes"] if node["artifact_kind"] == "feature"]

    decisions = AUDIT._publication_decisions(
        repo, _plugin_with_gate_removed(tmp_path), preview, features
    )

    # 実装がゲートを失えば、監査の判定も追随して draft を通してしまう。
    # (= 監査が実装から独立した自前述語を見ていないことの証拠)
    assert decisions[DRAFT_ID]["publishable"] is True


# --------------------------------------------------------------------------- #
# 欠陥 1 と 5: 昇格済み feature を含む実書込み run で緑になること
# --------------------------------------------------------------------------- #
def test_audit_passes_on_a_real_write_run_that_contains_a_promoted_feature(tmp_path: Path) -> None:
    result = AUDIT.audit(**_trial(tmp_path))

    assert result["pass"] is True
    assert result["run_mode"] == "apply"
    assert result["publication_gate"]["candidate_node_ids"] == [PROMOTED_ID]
    assert result["publication_gate"]["draft_node_ids"] == [DRAFT_ID]
    assert result["publication_gate"]["discriminates"] is True
    assert result["publication_gate"]["promotion_attributable_to_run"] is True
    # 実書込みなので「ローカル状態が動いていないこと」は要求されない (欠陥 5)。
    assert result["local_state"]["mutation_suppressed"] is False
    assert result["run_mode_checks"] == {
        "local_state_advanced": True,
        "graph_store_written": True,
    }


def test_a_promotion_made_after_the_preview_was_saved_is_still_observed(tmp_path: Path) -> None:
    """preview 保存後に昇格した feature も candidate として観測される。

    preview は skill が「登録したい」と提案した時点の姿であり、lifecycle 昇格はその後に起きる。
    publication を preview で判定すると昇格は永久に観測されず、candidate gate は空集合しか見ない
    — つまり scenario が要求する「draft 除外」と「candidate 昇格」の分離が成立しなくなる。
    """
    trial = _trial(tmp_path)
    # preview だけを「昇格前 = 全 feature が draft」の姿へ差し戻す。実 graph は昇格後のまま。
    _write_json(
        trial["preview_path"],
        {
            "graph_revision": 1,
            "nodes": [
                _node(ARCHITECTURE_ID, "architecture", "architecture", []),
                _node(DRAFT_ID, "feature", "features", []),
                _node(PROMOTED_ID, "feature", "features", [DRAFT_ID]),
            ],
        },
    )

    result = AUDIT.audit(**trial)

    assert result["publication_gate"]["candidate_node_ids"] == [PROMOTED_ID]
    assert result["publication_gate"]["draft_node_ids"] == [DRAFT_ID]
    assert result["publication_gate"]["promotion_attributable_to_run"] is True
    assert result["pass"] is True


def test_a_candidate_the_fixture_already_held_is_not_attributed_to_the_run(tmp_path: Path) -> None:
    """fixture が最初から昇格済み feature を持っていたら帰属は成立しない。

    帰属の証拠は pre-state 差分だけである。この負例が落ちなければ
    「run が昇格させた」という主張は測定されておらず、fixture へ完成品を播いた run と
    実際に昇格させた run が同じ緑を返す。
    """
    trial = _trial(tmp_path)
    # pre-state を「promoted feature を既に持っていた fixture」として取り直す。
    _write_json(trial["pre_state_path"], AUDIT.capture_state(trial["repo_root"]))

    result = AUDIT.audit(**trial)

    assert result["publication_gate"]["candidate_node_ids"] == [PROMOTED_ID]
    assert result["publication_gate"]["lifecycle_candidate_ids"] == []
    assert result["publication_gate"]["promotion_attributable_to_run"] is False
    assert result["pass"] is False


def test_dry_run_mode_still_requires_full_suppression(tmp_path: Path) -> None:
    trial = _trial(tmp_path)
    trial["run_mode"] = "dry-run"

    result = AUDIT.audit(**trial)

    # 同じ実書込み証跡を dry-run として提出すると落ちる (mode を取り違えられない)。
    assert result["pass"] is False
    assert result["run_mode_checks"]["local_state_unchanged"] is False


# --------------------------------------------------------------------------- #
# 欠陥 4: write count が前後差分から出ること
# --------------------------------------------------------------------------- #
def test_write_counts_come_from_the_state_diff(tmp_path: Path) -> None:
    result = AUDIT.audit(**_trial(tmp_path))

    assert result["derived_write_counts"] == {
        "local_issue_files": 0,
        "beads_export_records": 0,
        "beads_linked_nodes": 0,
        "github_linked_nodes": 0,
    }
    assert "publication_inventory diff" in result["write_count_source"]


def test_draft_publication_is_detected_from_the_state_diff(tmp_path: Path) -> None:
    published_draft = _rebind(_preview()["nodes"], "beads")
    for node in published_draft:
        if node["graph_node_id"] == DRAFT_ID:
            # draft のまま tracker へ投影されてしまった状態 (ゲートの退行)。
            node["beads_linkage"] = {
                "bd_issue_id": "Fixture-0001",
                "linked_at": FIXED_TS,
                "sync_state": "linked",
            }
    trial = _trial(tmp_path, graph_nodes=published_draft)
    trial["run_binding"] = "beads"

    result = AUDIT.audit(**trial)

    assert result["derived_write_counts"]["beads_linked_nodes"] == 1
    observed = result["binding_projections"]["beads"]["observed"]
    assert observed["draft_published_node_ids"] == [DRAFT_ID]
    assert result["draft_publication_zero"] is False
    assert result["pass"] is False


def test_state_comparison_refuses_a_pre_state_without_publication_inventory() -> None:
    with pytest.raises(AUDIT.AuditError, match="publication_inventory"):
        AUDIT.STATE.publication_delta({"publication_inventory": None}, {})


# --------------------------------------------------------------------------- #
# mutation test: draft ゲートを壊すと監査が落ちる
# --------------------------------------------------------------------------- #
def test_audit_fails_when_the_draft_publication_gate_is_removed(tmp_path: Path) -> None:
    trial = _trial(tmp_path)
    trial["plugin_root"] = _plugin_with_gate_removed(tmp_path)

    result = AUDIT.audit(**trial)

    assert result["pass"] is False
    assert result["publication_gate"]["discriminates"] is False
    assert result["publication_gate"]["draft_node_ids"] == []
    # ゲートを失った実装は draft も昇格済みも同じ「投影可」に潰す。
    assert sorted(result["publication_gate"]["candidate_node_ids"]) == sorted(
        [PROMOTED_ID, DRAFT_ID]
    )


# --------------------------------------------------------------------------- #
# CLI と provenance
# --------------------------------------------------------------------------- #
def test_audit_cli_requires_explicit_run_mode_and_binding(tmp_path: Path) -> None:
    trial = _trial(tmp_path)
    argv = [
        "python3", str(SCRIPT), "audit",
        "--repo-root", str(trial["repo_root"]),
        "--preview", str(trial["preview_path"]),
        "--scenario", str(SCENARIO_PATH),
        "--pre-state", str(trial["pre_state_path"]),
        "--plugin-dir", str(PLUGIN_ROOT),
        "--output", str(tmp_path / "audit.json"),
    ]

    without_mode = subprocess.run(argv, capture_output=True, text=True)
    with_mode = subprocess.run(
        [*argv, "--run-mode", "apply", "--run-binding", "none"], capture_output=True, text=True
    )

    assert without_mode.returncode != os.EX_OK
    assert "--run-mode" in without_mode.stderr
    assert with_mode.returncode == os.EX_OK
    assert json.loads((tmp_path / "audit.json").read_text("utf-8"))["pass"] is True
