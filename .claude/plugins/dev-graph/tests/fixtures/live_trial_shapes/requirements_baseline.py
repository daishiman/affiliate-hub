#!/usr/bin/env python3
"""C04 fixture の baseline 入力閉包層 (被験 skill の出力先取りを遮断する門番)。

## この層が存在する理由

live-trial は「被験 skill が成果物を生成できたか」を観測する。fixture が被験 skill の
*出力* を最初から同梱していると、runner は既存ファイルを読むだけで PASS を自己申告でき、
skill の能力が一切観測されない (Goodhart 穴)。実際に C04-OUT1 の trial では
``system-plan/F-LIVE-001/system-build-handoff.json`` と ``task-graph.json`` が
「handoff を生成した証拠」として引用され、独立 evaluator に反証された。

本 module は「baseline に存在してよい content path」を生成主体つきで宣言し、実 tree が
その宣言と exact 一致しない限り fixture 生成を fail-closed にする。以後、出力に相当する
ファイルを fixture へ足すには宣言の追加が必須になり、無言の先取りが起きない。

## 入力 / 出力の判定 (実装から確定した結論)

**C04 (run-dev-graph-requirements) の出力**は次の 4 点で、fixture には 1 件も無い。
  - plugin-plans/dev-graph/component-inventory.json:196 (output_contract)
    「要件定義書 + 参照ノードごとの implementation_readiness/missing_sections 一覧
      + capability-build/task-graph build 向け handoff 参照 + グラフスナップショット」
  - skills/run-dev-graph-requirements/SKILL.md:69 も同じ 3 点を出力と宣言する。
  - 保存先は固定 path を持たない (argument-hint の ``--handoff-target PATH`` と
    SKILL.md:99-103 の ``$DEV_GRAPH_ROOT/eval-log/...``)。よって baseline を閉じた集合に
    しておけば、実走後に増えた path がそのまま C04 の出力になる。

**紛らわしい 2 ファイルはいずれも入力**である。名前が C04 の出力語彙と衝突するだけで、
所有者も検証経路も別 plugin にある。
  - ``system-build-handoff.json``: system-dev-planner の C14
    ``build-system-handoff.py`` が生成する package 成果物。C04 が step 3 で走らせる
    ``validate-system-plan.py`` の必須入力であり、:267 で load、:405 で manifest の
    exact-set、:439-448 で commit point contract を検査する。実測でも本ファイルを
    退避すると ``missing-file`` violation の exit 2 になる。
  - ``task-graph.json``: 同 package の DAG。``validate-system-plan.py:37``
    (BASE_DIGEST_FILES)、:266 (load)、:285-289 (13 件と P01..P13 exact-set) が要求する。
    退避すると同じく ``missing-file`` で exit 2。scenario 文言の「task-graph build」は
    handoff 先 skill 名であって、この package ファイルのことではない。
  両者を消すと C04 の gate 3 が起動できず、positive scenario が negative 化するため
  残す (SKILL.md:76,140「13 task の生成ロジックを複製しない」「exact-13 検証を独自
  ロジックで代替しない」という責務境界とも整合する)。

``dev-graph-registration-receipt.json`` も C04 ではなく C02
(``run-dev-graph-node`` / ``register-package.py``) の receipt で、:414 が「13 node 登録済み
なのに receipt が無い」状態を fail-closed にするため baseline の前提条件として要る。

依存の向きは shape_requirements -> requirements_baseline -> requirements_exact13_package の
一方向に固定する。上位層を本 module から参照してはならない。

決定論性: 時刻は base_shape の FIXED_TS 系のみ、乱数なし。path 依存値は扱わない
(digest は実ファイルの bytes から導出する)。
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .requirements_exact13_package import (
    ARCHITECTURE_REL,
    FEATURE_ID,
    HANDOFF_REL,
    MANIFEST_REL,
    PACKAGE_DIR_REL,
    PHASES,
    SYSTEM_SPEC_INDEX_REL,
    SYSTEM_SPEC_REQUIREMENTS_REL,
    TASK_SPEC_PATHS,
    dump_json,
    sha256_file,
    task_file_path,
)

SCENARIO_ID = "C04-OUT1-positive-ready-handoff"
SUBJECT_SKILL = "dev-graph:run-dev-graph-requirements"

# git common dir 側の置き場。base_shape の fixture-marker.json と同じ扱いで、被験 skill
# からは repository content として見えない (C11 の検査対象にも git status にも出ない)。
BASELINE_RECEIPT_REL = Path("dev-graph") / "live-trial-baseline.json"

# C04 の出力契約 (component-inventory.json:196 / SKILL.md:69)。baseline には 1 件も無い。
SUBJECT_OUTPUTS = [
    "要件定義書 (requirements document)",
    "参照ノードごとの implementation_readiness / missing_sections 一覧 (readiness matrix)",
    "capability-build/task-graph build 向け handoff 参照",
    "グラフスナップショット digest",
]


def declared_inputs() -> dict[str, str]:
    """baseline に存在してよい content path -> その生成主体 (= 入力である根拠)。

    ここに無い path が生成後の tree に現れたら、それは C04 の出力を fixture が
    先取りした疑いがあるので ``assert_input_closure`` が fail-closed にする。
    """
    package = f"{PACKAGE_DIR_REL}/"
    inputs: dict[str, str] = {
        ".dev-graph/config.json": "C01/C24 の repo 骨格 (被験 skill の起動前提)",
        ".dev-graph/state/graph.json": "C02 register-package.py が exact-13 を登録し終えた graph",
        ".dev-graph/plan-state/current/feature-package-F-LIVE-001.json": (
            "system-dev-planner C11 の promotion 後 current pointer。C04 が "
            "validate-system-plan.py --feature-package で published package を解決する入力"
        ),
        ARCHITECTURE_REL: "feature.architecture_refs の参照先 artifact (C11:288-295 が実在を要求)",
        f"features/{FEATURE_ID.lower()}.md": "C02 が保存した macro feature node の artifact 実体",
        SYSTEM_SPEC_INDEX_REL: "C19 が取り込んだ system-spec-harness 確定成果物 (要件の引用元)",
        SYSTEM_SPEC_REQUIREMENTS_REL: "同上。feature の source_lineage が指す確定章",
        package + "feature-context.json": "system-dev-planner C09 の plan 入力 (package 生成の材料)",
        package + "feature-package.json": "system-dev-planner の exact-13 package 本体 "
                                          "(validate-system-plan.py:37,264 の必須入力)",
        package + "package.json": "scenario 契約 --package の入口。feature-package.json の byte 同一 copy",
        package + "workstream-inventory.json": "同 package (validate-system-plan.py:37,265)",
        package + "task-graph.json": "同 package の DAG。validate-system-plan.py:37,266,285-289 が "
                                     "必須入力として load し、欠落は missing-file violation になる",
        package + HANDOFF_REL: "system-dev-planner C14 build-system-handoff.py の成果物。"
                               "validate-system-plan.py:267,405,439-448 の必須入力であり、"
                               "C04 が生成する capability-build handoff とは別物",
        package + MANIFEST_REL: "同 package の commit point (validate-system-plan.py:400-448)",
        package + "atomic-promotion-receipt.json": "system-dev-planner の promotion receipt (published 証跡)",
        package + "dev-graph-registration.json": "C02 への搬送 payload (register-package.py が読む入力)",
        package + "dev-graph-registration-receipt.json": "C02 register-package.py:414 が既登録 graph に "
                                                         "要求する receipt。C04 ではなく C02 の出力",
    }
    for rel in TASK_SPEC_PATHS:
        inputs[package + rel] = "exact-13 task spec (validate-system-plan.py:37 BASE_DIGEST_FILES)"
    for phase in PHASES:
        inputs[task_file_path(phase)] = "C02 が保存した exact-13 task node の artifact 実体"
    return inputs


def _tracked_content(out: Path) -> set[str]:
    """commit 済み content path 集合。

    ``.gitkeep`` は骨格層が content root を実体化するための空 marker で、成果物ではない
    ため閉包判定から外す (base_shape.scaffold / base の _finalize が置く)。
    """
    proc = subprocess.run(
        ["git", "-C", str(out), "ls-files"], capture_output=True, text=True, check=True
    )
    return {
        line for line in proc.stdout.splitlines()
        if line and Path(line).name != ".gitkeep"
    }


def assert_input_closure(out: Path, declared: dict[str, str]) -> None:
    """実 tree が宣言した入力閉包と exact 一致することを fail-closed で確かめる。"""
    actual = _tracked_content(out)
    unexpected = sorted(actual - declared.keys())
    missing = sorted(declared.keys() - actual)
    if unexpected or missing:
        raise RuntimeError(
            "C04 fixture の baseline が宣言と一致しない。宣言外の path は被験 skill の出力を "
            "先取りした疑いがあるため生成を停止する (requirements_baseline.declared_inputs を "
            "更新する前に、その artifact が C04 の入力か出力かを実装から確定すること)。\n"
            f"  宣言に無い: {unexpected}\n  宣言のみ存在: {missing}"
        )


def write_baseline_receipt(out: Path, common: Path, declared: dict[str, str]) -> None:
    """評価側が「実走前から在ったか」を 1 read で判定できる oracle を git 内部へ置く。

    独立 evaluator が mtime と baseline commit を辿り直さないと反証できなかった経緯を
    受けて、入力の provenance と「C04 の出力は baseline に 0 件」という事実を機械可読に
    固定する。content root の外なので被験 skill の観測対象と git status を汚さない。
    """
    dump_json(common / BASELINE_RECEIPT_REL, {
        "schema_version": "1.0.0",
        "scenario_id": SCENARIO_ID,
        "subject_skill": SUBJECT_SKILL,
        "inputs": {
            path: {"sha256": sha256_file(out / path), "provenance": provenance}
            for path, provenance in sorted(declared.items())
        },
        "subject_outputs_absent_at_baseline": SUBJECT_OUTPUTS,
        "observation_rule": (
            "実走後に git status / git ls-files --others --exclude-standard が返す差分だけが "
            "C04 の出力である。baseline の inputs に載っている path は実走成果物として "
            "引用してはならない"
        ),
        "name_collision_warning": {
            f"{PACKAGE_DIR_REL}/{HANDOFF_REL}": (
                "system-dev-planner C14 の build handoff であり、C04 の "
                "capability-build/task-graph handoff ではない"
            ),
            f"{PACKAGE_DIR_REL}/task-graph.json": (
                "exact-13 package の DAG であり、handoff 先 skill 名 'task-graph build' の "
                "成果物ではない"
            ),
        },
    })
