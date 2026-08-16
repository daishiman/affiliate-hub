#!/usr/bin/env python3
"""C04 fixture の exact-13 package 層 (C12 validate-system-plan.py が読む staging 形状)。

``shape_requirements`` は「published package 一式」と「その package を C02 が登録し終えた
graph」の 2 層を同時に作る。本 module は前者、つまり system-dev-planner 側の契約
(C12 validate-system-plan.py / C14 build-system-handoff.py) にだけ従う層を持つ。
graph node 形状 (C02 register-package.py / C11 validate-graph-schema.py の契約) は
``shape_requirements`` 側に残る。

依存の向きは ``shape_requirements`` -> ``requirements_exact13_package`` の一方向へ固定する。
両層が共有する定数 (feature id・phase 写像・package 相対 path) と決定論 helper
(直列化・digest・id 生成) も、下位層である本 module を正本とする。逆向きの import を
足すと循環参照になるため、本 module から ``shape_requirements`` を参照してはならない。

決定論性: 時刻は base_shape の FIXED_TS のみ、乱数なし。path 依存値は骨格層が導出済みの
repository_id を引数で受け取るだけで、本 module では導出しない。
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

from .base_shape import FIXED_TS

# plugins/dev-graph/tests/fixtures/live_trial_shapes/ から見た位置関係。
_HERE = Path(__file__).resolve()
PLUGINS_DIR = _HERE.parents[4]
SYSTEM_PLANNER_ROOT = PLUGINS_DIR / "system-dev-planner"

FEATURE_ID = "F-LIVE-001"
FEATURE_PACKAGE_ID = "feature-package/F-LIVE-001"
ARCHITECTURE_ID = "LT-ARCH-001"
PACKAGE_DIR_REL = f"system-plan/{FEATURE_ID}"
PHASES = [f"P{i:02d}" for i in range(1, 14)]

# C12 (validate-system-plan.py TASK_PATHS) と exact 一致必須。順序も契約の一部。
TASK_SPEC_PATHS = [
    "task-specs/phase-01-requirements.md",
    "task-specs/phase-02-architecture.md",
    "task-specs/phase-03-design-review.md",
    "task-specs/phase-04-test-design.md",
    "task-specs/phase-05-implementation.md",
    "task-specs/phase-06-test-run.md",
    "task-specs/phase-07-acceptance.md",
    "task-specs/phase-08-refactoring-migration.md",
    "task-specs/phase-09-quality-assurance.md",
    "task-specs/phase-10-final-review.md",
    "task-specs/phase-11-evidence.md",
    "task-specs/phase-12-documentation-operations.md",
    "task-specs/phase-13-release-deploy.md",
]
# C14 (build-system-handoff.py SOURCE_PATHS) と同順。manifest の exact-set 判定に使う。
SOURCE_PATHS = [
    "feature-package.json",
    "workstream-inventory.json",
    "task-graph.json",
    *TASK_SPEC_PATHS,
]
HANDOFF_REL = "system-build-handoff.json"
MANIFEST_REL = "staging-manifest.json"

# P01 spec 本文へ literal で埋める必要がある gate marker (validate-system-plan.py:41)。
P01_ENTRY_GATE_MARKER = "parent_feature.depends_on all done|closed"
P01_ENTRY_GATE = {
    "selector": "parent_feature.depends_on",
    "operator": "all",
    "required_statuses": ["done", "closed"],
}

# 13 phase の固定写像 (references/feature-execution-package-contract.md §3)。
# workstream_kind は workstream-inventory.schema.json の 9 値 enum から選ぶ。
PHASE_META = [
    ("P01", "要件ベースライン確定", "documentation"),
    ("P02", "アーキテクチャとワークストリーム設計", "backend"),
    ("P03", "独立設計レビュー", "quality"),
    ("P04", "テストファースト設計", "quality"),
    ("P05", "実装", "backend"),
    ("P06", "テスト実行", "quality"),
    ("P07", "feature 受入判定", "quality"),
    ("P08", "リファクタリングと移行", "backend"),
    ("P09", "品質・セキュリティ・運用保証", "security"),
    ("P10", "独立最終レビュー", "quality"),
    ("P11", "再現可能な証跡整備", "documentation"),
    ("P12", "ドキュメントと運用手順", "documentation"),
    ("P13", "リリースとクローズアウト", "operations"),
]
DEPLOY_UNIT = "live-trial-fixture-service"

SYSTEM_SPEC_INDEX_REL = "system-spec/index.md"
SYSTEM_SPEC_REQUIREMENTS_REL = "system-spec/00-requirements-definition.md"
ARCHITECTURE_REL = "architecture/lt-arch-001.md"


# --------------------------------------------------------------------------- #
# 共通ユーティリティ (両層が共有する決定論 helper)
# --------------------------------------------------------------------------- #
def dump_json(path: Path, value: dict) -> None:
    """C14 (_encoded) と同一の直列化。manifest の digest 検査が bytes 一致を要求する。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(payload, encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _canonical_digest(root: Path, relative_paths: list[str]) -> str:
    """C12 canonical_digest (validate-system-plan.py:70-75) と同一手順。"""
    digest = hashlib.sha256()
    for rel in sorted(relative_paths):
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / rel).read_bytes())
        digest.update(b"\0")
    return "sha256:" + digest.hexdigest()


def task_id(phase: str) -> str:
    """workstream-inventory.schema.json の task id pattern ^SYS-[A-Z0-9][A-Z0-9-]*$ に従う。"""
    return f"SYS-LIVE-001-{phase}"


def task_file_path(phase: str) -> str:
    """feature 単位 namespace tasks/<parent_feature>/<task-id 小文字>.md (契約 §2.1)。"""
    return f"tasks/{FEATURE_ID}/{task_id(phase).lower()}.md"


# --------------------------------------------------------------------------- #
# package 本体 (C12 が検証する staging 形状)
# --------------------------------------------------------------------------- #
def _task_spec_text(phase: str, responsibility: str, spec_task_id: str,
                    depends_on: list[str]) -> str:
    """C12 の task spec 検査を満たす 1 phase 分の spec 本文を組む。

    制約 (validate-system-plan.py:39-59, 342-365):
      - REQUIRED_TASK_SPEC_SECTIONS とテスト戦略の 16 見出しがちょうど 1 回ずつ、本文が非空
        (`Inner goal-seek execution loop` は system-task-goal-seek/v1 と rubric verdict=PASS を含み、
         P13 は `P13 spec/architecture writeback: required` を宣言する)
      - PLACEHOLDER 正規表現に当たらない。``<`` は ``<[^>]+>`` が改行も跨いで一致する
        ため本文へ 1 文字も置かない
      - staging runtime path を本文へ残さない (promotion 後に解決不能になるため)
      - P01 だけは entry gate marker を literal で含む
    """
    dependency_line = "なし (feature の entry point)" if not depends_on else ", ".join(depends_on)
    gate = (
        f"- 実行前 gate: {P01_ENTRY_GATE_MARKER}"
        if phase == "P01"
        else f"- 先行 phase {dependency_line} の完了を前提とする"
    )
    na_note = (
        "- 本 fixture では適用対象が無いため N/A: 隔離 fixture に移行対象資産が無い\n"
        if phase in {"P08", "P13"}
        else ""
    )
    goal_seek_writeback = (
        "- P13 spec/architecture writeback: required: 実行結果・判断・改善点を system spec と architecture へ反映する"
        if phase == "P13"
        else "- P13 spec/architecture writeback: N/A (P13 owns writeback)"
    )
    sections = [
        ("Machine-readable registration fields", "\n".join([
            f"- task_id: {spec_task_id}",
            f"- phase_ref: {phase}",
            f"- parent_feature: {FEATURE_ID}",
            f"- feature_package_id: {FEATURE_PACKAGE_ID}",
            f"- graph_node_file_path: {task_file_path(phase)}",
            f"- depends_on: {dependency_line}",
        ])),
        ("目的", f"{responsibility}を完了し、後続 phase が着手できる状態にする。"),
        ("背景", (
            "live-trial fixture の feature "
            f"{FEATURE_ID} を exact-13 package へ分解した 1 phase である。"
            "実装内容ではなく、requirements handoff の readiness 判定に足る形を固定する。"
        )),
        ("前提条件", "\n".join([
            gate,
            f"- 引用元の確定仕様: {SYSTEM_SPEC_REQUIREMENTS_REL}",
        ])),
        ("Workstream applicability", f"{responsibility}に対応する単一 workstream として実行する。"),
        ("Architecture and deploy unit", "\n".join([
            f"- architecture 参照: {ARCHITECTURE_REL}",
            f"- deploy unit: {DEPLOY_UNIT}",
        ])),
        ("成果物", na_note + f"- {responsibility}の結果を記録した phase 成果物"),
        ("Tracker publication and completion", "\n".join([
            "- tracker_binding_intent: none (fixture は外部 tracker へ投影しない)",
            "- 完了条件: linked_pr_merged_all",
        ])),
        ("Branch and worktree execution", "\n".join([
            "- 1 task 1 branch とし、worktree lease を必須にする",
            "- branch 割当は dev-graph scheduler が所有する",
        ])),
        ("スコープ外", "\n".join([
            "- 他 feature の task への直接参照",
            "- 実 repository への書き込み",
        ])),
        ("テスト戦略", "\n".join([
            "- テストレベル選定: 単体・結合・境界値・回帰の4レベルを適用する",
            "- カバレッジ目標: 既定 80% を維持する",
            "- 層別方針: N/A: fixture の検証用仕様であり実装層を変更しない",
            "- 保守性制約: pixel 位置依存と DOM 構造依存のテストを禁止する",
        ])),
        ("Verification and evidence", "\n".join([
            f"- 検証: {responsibility}の完了を phase 成果物で確認する",
            "- 証跡: 本 package 相対 path に閉じた成果物のみを参照する",
        ])),
        ("Inner goal-seek execution loop", "\n".join([
            "- Methodology contract: system-task-goal-seek/v1",
            "- Goal: 本 phase の Phase acceptance と Verification and evidence をすべて満たす",
            "- Generic execution prompt: 目的・背景・前提条件・write scope・成果物・受入条件を入力に最小の安全な変更を行う",
            "- Rubric: acceptance 全件・必須証跡・write scope・依存整合がすべて PASS",
            "- Feedback loop: 実装→独立評価→finding 反映→再実行 を rubric verdict=PASS まで反復し、上限到達時は fail-closed",
            goal_seek_writeback,
        ])),
        ("Rollout and rollback", "\n".join([
            "- rollout: 前方 phase 順に段階適用する",
            "- rollback: 当該 phase の成果物を直前世代へ戻す",
        ])),
        ("Handoff", (
            "本 spec は capability-build / task-graph build が消費する実行単位であり、"
            "dev-graph 側は登録と進捗投影だけを担う。"
        )),
        ("参照情報", "\n".join([
            f"- {SYSTEM_SPEC_INDEX_REL}",
            f"- {SYSTEM_SPEC_REQUIREMENTS_REL}",
            f"- feature-package.json ({FEATURE_PACKAGE_ID})",
        ])),
    ]
    lines = [f"# {spec_task_id} {responsibility}", ""]
    for name, body in sections:
        lines.extend([f"## {name}", "", body, ""])
    lines.append(f"生成元: live-trial fixture shape ({FIXED_TS} 固定)。")
    lines.append("")
    return "\n".join(lines)


def _inventory_task(phase: str, responsibility: str, workstream: str, depends_on: list[str]) -> dict:
    inventory_task_id = task_id(phase)
    file_path = task_file_path(phase)
    return {
        "id": inventory_task_id,
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "title": f"{responsibility} ({phase})",
        "owners": ["live-trial"],
        "tags": ["live-trial", "fixture"],
        "related_nodes": [],
        "workstream_kind": workstream,
        "build_target_kind": "application-code",
        "phase_ref": phase,
        "depends_on": depends_on,
        "write_scope": [f"{PACKAGE_DIR_REL}/{TASK_SPEC_PATHS[PHASES.index(phase)]}"],
        "deploy_unit": DEPLOY_UNIT,
        "source_lineage": [SYSTEM_SPEC_INDEX_REL, SYSTEM_SPEC_REQUIREMENTS_REL],
        "classification": {
            "confidence": 1.0,
            "reason": "live-trial fixture として決定論生成された exact-13 package の task",
            "candidates": [
                {"artifact_kind": "task", "confidence": 1.0, "candidate_path": file_path}
            ],
        },
        # fixture は外部 tracker へ投影しない。intent=none は github_publication を
        # local_only に固定する (workstream-inventory.schema.json allOf)。
        "tracker_binding_intent": "none",
        "github_publication": {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": None},
        "pr_completion_policy": "linked_pr_merged_all",
        "branch_policy": {
            "strategy": "one-task-one-branch",
            "worktree_lease_required": True,
            "completion_projection": "default-branch-reconciliation",
            "assignment_owner": "dev-graph-scheduler",
        },
        "acceptance": [f"{responsibility}の成果物が phase 成果物として存在する"],
        "verification": ["package 相対 path の成果物で検証する"],
        "rollback": "当該 phase の成果物を直前世代へ戻す",
        "implementation_readiness": {
            "status": "complete",
            "missing_sections": [],
            "checked_at": FIXED_TS,
        },
        "graph_node_registration": {
            "graph_node_id": inventory_task_id,
            "file_path": file_path,
            "parent_feature": FEATURE_ID,
            "feature_package_id": FEATURE_PACKAGE_ID,
            "phase_ref": phase,
        },
    }


def write_package_sources(out: Path, repository_id: str, source_feature_digest: str) -> None:
    """feature-package / inventory / task-graph / 13 task specs / 事前 manifest を書く。"""
    package_dir = out / PACKAGE_DIR_REL
    # baseline は P01 から P13 への前方 1 本鎖。後方 edge・別 feature 参照は禁止 (契約 §4)。
    depends = {phase: ([] if index == 0 else [task_id(PHASES[index - 1])])
               for index, phase in enumerate(PHASES)}

    for index, (phase, responsibility, _kind) in enumerate(PHASE_META):
        (package_dir / TASK_SPEC_PATHS[index]).parent.mkdir(parents=True, exist_ok=True)
        (package_dir / TASK_SPEC_PATHS[index]).write_text(
            _task_spec_text(phase, responsibility, task_id(phase), depends[phase]),
            encoding="utf-8",
        )

    dump_json(package_dir / "feature-package.json", {
        "schema_version": "1.0.0",
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "source_feature_digest": f"sha256:{source_feature_digest}",
        "task_count": 13,
        "phase_refs": PHASES,
        "task_spec_paths": TASK_SPEC_PATHS,
        "task_node_ids": [task_id(phase) for phase in PHASES],
    })

    dump_json(package_dir / "workstream-inventory.json", {
        "schema_version": "1.0.0",
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "p01_entry_gate": P01_ENTRY_GATE,
        "repo_context": {
            "config_path": ".dev-graph/config.json",
            "repo_identity": repository_id,
            "root_resolution_source": "explicit-cli",
        },
        "source_lineage": {
            "source_plugin": "system-spec-harness",
            "source_version": "0.1.0",
            "compile_entrypoint": "run-system-spec-compile",
            "completeness_entrypoint": "assign-system-spec-completeness-evaluator",
            "source_paths": [SYSTEM_SPEC_INDEX_REL, SYSTEM_SPEC_REQUIREMENTS_REL],
            "confirmed": True,
        },
        "tasks": [
            _inventory_task(phase, responsibility, kind, depends[phase])
            for phase, responsibility, kind in PHASE_META
        ],
    })

    dump_json(package_dir / "task-graph.json", {
        "schema_version": "1.0.0",
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "nodes": [
            {
                "id": task_id(phase),
                "phase_ref": phase,
                "feature_package_id": FEATURE_PACKAGE_ID,
                "parent_feature": FEATURE_ID,
                "depends_on": depends[phase],
            }
            for phase in PHASES
        ],
    })

    # handoff 生成前の manifest。canonical_digest は source 16 file だけを覆う。
    dump_json(package_dir / MANIFEST_REL, {
        "schema_version": "1.0.0",
        "files": {rel: sha256_file(package_dir / rel) for rel in SOURCE_PATHS},
        "canonical_digest": _canonical_digest(package_dir, SOURCE_PATHS),
    })


def run_build_system_handoff(out: Path) -> None:
    """C14 build-system-handoff.py に handoff と最終 manifest を生成させる。

    handoff/manifest の digest 契約 (自己参照の回避と commit point の順序) を
    fixture 側で書き写すと、上流 script が変わった瞬間に fixture が黙って
    stale になる。所有者 script をそのまま実行して commit point を作らせる。
    """
    env = dict(os.environ)
    # C09 は候補 root と $CLAUDE_PROJECT_DIR の realpath 一致を要求する。
    # 隔離 fixture を生成する呼び出し元 (harness repo) の宣言が残っていると
    # fixture root が host 境界外と判定されるため、明示的に外す。
    env.pop("CLAUDE_PROJECT_DIR", None)
    env.pop("SYSTEM_DEV_PROJECT_ROOT", None)
    proc = subprocess.run(
        [
            sys.executable,
            str(SYSTEM_PLANNER_ROOT / "scripts" / "build-system-handoff.py"),
            "--repo-root", str(out),
            "--staging", PACKAGE_DIR_REL,
        ],
        cwd=str(out), env=env, capture_output=True, text=True, check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            "build-system-handoff.py failed while building the C04 fixture package:\n"
            f"{proc.stdout}{proc.stderr}"
        )
