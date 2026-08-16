#!/usr/bin/env python3
"""C04-OUT1-positive-ready-handoff (run-dev-graph-requirements) の fixture 形状。

scenario 契約 (live-trial-positive-scenarios.json):
  task_args_template:
    handoff --repo-root REPO --feature-id F-LIVE-001
            --package REPO/system-plan/F-LIVE-001/package.json
  fixture_contract:
    feature が confirmed / evaluation-pass / readiness-complete で、package が
    P01..P13 exact-13 の DAG・source digest 一致・parent feature 一致であること。

この 3 条件がどの実装で機械検査されるかを追うと、fixture が満たすべき形は次の
3 gate の積になる (SKILL.md criteria:IN1 が同じ 3 gate を要求している)。

  1. C11  plugins/dev-graph/scripts/validate-graph-schema.py
     graph node 群の schema / DAG / artifact 実体を検査する。
     - domain_findings: status=active は confirmed/pass/complete を要求 (:279-282)
     - domain_findings: feature の子は exact-13 かつ P01..P13 (:323-329)
     - domain_findings: architecture_refs/parent_feature は実在 node id (:288-298)
     - artifact_findings: file_path の実体と frontmatter parity (:214-252)
  2. C02  plugins/dev-graph/scripts/register-package.py
     「C02 が保存した状態」の正本。_validate_registration (:206-262) が
     exact-13 node の parent/package 一致・lineage digest 一致・phase 前方依存を、
     _resolved_nodes (:274-290) が tracker binding 解決後の形を定義する。
  3. C12  plugins/system-dev-planner/scripts/validate-system-plan.py
     package 本体の正本。validate (:232-451) が feature-package/inventory/
     task-graph/13 task specs/handoff/manifest の exact-set と digest を検査する。
     C04 は promotion 後の consumer なので、fixture は feature 別 current pointer も持ち、
     ``--feature-package feature-package/F-LIVE-001`` から published package を解決できる。

したがって本 shape は「published package 一式」と「その package を C02 が登録し終えた
graph」を同時に作る。scenario が --package で指す ``package.json`` は、C12 が読む
``feature-package.json`` の byte 同一 copy として置く (scenario 契約の入口名と
validator が要求する canonical 名を両立させるため)。

3 層のうち最下流 (C12/C14 の契約にだけ従う package 生成) は
``requirements_exact13_package`` へ、baseline 入力閉包の宣言と門番は
``requirements_baseline`` へ分離してある。本 module は graph 層
(C02/C11 の契約に従う node 形状と登録 receipt) と entry point を持つ。共有する定数と
決定論 helper は下位層である ``requirements_exact13_package`` を正本とし、import は
上位から下位への一方向 (shape_requirements -> requirements_baseline ->
requirements_exact13_package) だけとする。

なお本 fixture が置く成果物は**すべて C04 の入力**であり、C04 自身の出力
(要件定義書・readiness matrix・capability-build handoff・graph snapshot) は 1 件も
含まない。判定根拠と、名前が紛らわしい ``system-build-handoff.json`` /
``task-graph.json`` を入力と確定した実装上の証拠は ``requirements_baseline`` の
module docstring を正本とする。生成の最後にその宣言と実 tree の exact 一致を検査し、
出力の先取りが無言で混入しないようにしている。

source digest の一致 (契約の核心) は次の一本の値で貫く。
  PKG_DIGEST = staging-manifest.json の canonical_digest
             = C12 report の validated_digest
             = promotion receipt の published/staging/evaluated digest
             = dev-graph-registration.json の source_digest
             = 13 task node の source_lineage.source_digest (sha256: 接頭辞を外した hex)
             = 13 task node と feature node の confirmation_evidence.evaluated_digest
digest は package 実ファイルの bytes から決定論計算するので、埋め込みではなく導出である。

決定論性: 時刻は base_shape の FIXED_TS のみ、乱数なし。path 依存値は骨格層が導出済みの
repository_id だけを config から読んで使う。
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

from .base_shape import FIXED_TS, finalize, markdown_for, scaffold, task_node
from .requirements_baseline import (
    assert_input_closure,
    declared_inputs,
    write_baseline_receipt,
)
from .requirements_exact13_package import (
    ARCHITECTURE_ID,
    ARCHITECTURE_REL,
    FEATURE_ID,
    FEATURE_PACKAGE_ID,
    MANIFEST_REL,
    PACKAGE_DIR_REL,
    PHASE_META,
    PHASES,
    SYSTEM_SPEC_INDEX_REL,
    SYSTEM_SPEC_REQUIREMENTS_REL,
    dump_json,
    run_build_system_handoff,
    sha256_file,
    task_file_path,
    task_id,
    write_package_sources,
)

SHAPE = "requirements"


def _write_current_pointer(out: Path, package_digest: str) -> None:
    """promotion 後 consumer が世代非依存 CLI で package を解決するための C11 入力。"""
    dump_json(
        out / ".dev-graph" / "plan-state" / "current" / "feature-package-F-LIVE-001.json",
        {
            "schema_version": "1.0.0",
            "feature_package_id": FEATURE_PACKAGE_ID,
            "generation_id": package_digest.removeprefix("sha256:"),
            "published_path": PACKAGE_DIR_REL,
            "published_digest": package_digest,
            "receipt": f"{PACKAGE_DIR_REL}/atomic-promotion-receipt.json",
        },
    )


def _graph_document_digest(graph: dict) -> str:
    """C02 _canonical_digest (register-package.py:150-152) と同一手順。"""
    raw = json.dumps(graph, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


# --------------------------------------------------------------------------- #
# repo 骨格への追記
# --------------------------------------------------------------------------- #
def _add_plan_roots(out: Path) -> str:
    """config へ plan_roots を非破壊追記し、repository_id を返す。

    system-dev-planner の C09 (resolve-project-context.py:356-365) は
    content_roots / local_state / plan_roots の 3 section が object であることを
    要求するため、plan_roots が無い base config のままでは validate-system-plan.py が
    起動できない。plan_roots は dev-graph の repo-config.schema.json にも正式な
    optional property として定義済み (同一 config を両 plugin が共有する前提) なので、
    key 追記は C11/C24 の契約を壊さない。
    """
    config_path = out / ".dev-graph" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["plan_roots"] = {
        "staging": ".dev-graph/staging",
        "published": "system-plan",
        "state": ".dev-graph/plan-state",
    }
    dump_json(config_path, config)
    return str(config["repository_id"])


def _write_system_spec(out: Path) -> None:
    """package の source lineage が指す system-spec-harness 確定成果物 (引用元)。"""
    (out / SYSTEM_SPEC_INDEX_REL).write_text(
        "# live-trial fixture system spec index\n\n"
        f"- 確定章: {SYSTEM_SPEC_REQUIREMENTS_REL}\n"
        f"- 対象 feature: {FEATURE_ID}\n"
        "- confirmation_status: confirmed / evaluation_status: pass\n",
        encoding="utf-8",
    )
    (out / SYSTEM_SPEC_REQUIREMENTS_REL).write_text(
        "# 要件定義 (live-trial fixture)\n\n"
        "## 目的\n\n"
        "live-trial の被験 skill が参照する確定要件を、実 repository から隔離して固定する。\n\n"
        "## 受入条件\n\n"
        "- exact-13 package の全 task が implementation_readiness=complete である\n"
        "- 要件の引用元がこのファイルに閉じている\n",
        encoding="utf-8",
    )


def _architecture_node(spec_digest_hex: str) -> dict:
    """feature.architecture_refs の参照先となる architecture node。

    C11 domain_findings は architecture_refs を graph node id として解決するため
    (validate-graph-schema.py:288-295)、参照先 node が graph に実在する必要がある。
    """
    node = task_node(ARCHITECTURE_ID, "live-trial fixture のアーキテクチャ基準", "unused", [])
    node.update({
        "artifact_kind": "architecture",
        # architecture は artifact_subtypes minItems=1 (graph-node.schema.json allOf)。
        "artifact_subtypes": ["backend"],
        "file_path": ARCHITECTURE_REL,
        "template_id": "architecture",
        "domain": "architecture",
        "purpose": "exact-13 package が参照する構成方針を固定する",
        "goal": "package の全 task が同一の deploy unit 前提で書かれている状態",
        "confirmation_evidence": {
            "evaluated_digest": hashlib.sha256(ARCHITECTURE_ID.encode("utf-8")).hexdigest(),
            "evaluator": "build_live_trial_fixture",
            "evidence_ref": ARCHITECTURE_REL,
        },
        # C04 の scope closure は feature.architecture_refs も source-digest gate
        # へ渡す。manual/null lineage のままだと runner が architecture を除外して
        # handoff を出せてしまうため、feature と同じ確定 system-spec へ束縛する。
        "source_lineage": {
            "imported_at": FIXED_TS,
            "origin_kind": "system-spec-harness",
            "source_digest": spec_digest_hex,
            "source_path": SYSTEM_SPEC_REQUIREMENTS_REL,
            "source_plugin": "system-spec-harness",
            "source_version": "0.1.0",
        },
        "classification_candidates": [
            {"artifact_kind": "architecture", "candidate_path": ARCHITECTURE_REL, "confidence": 1.0}
        ],
    })
    return node


def _write_feature_context(out: Path) -> str:
    """C09 validate_feature_context の field exact-set に従う plan 入力を書き、digest を返す。

    package の source_feature_digest はこのファイルの sha256 とする。graph 側の値に
    依存しないので、feature node が package digest を持っても循環参照にならない。
    architecture_refs は C09 側では「実在する repository 相対 path」を要求する
    (resolve-project-context.py:302-307) 点が graph node 側 (node id 配列) と異なる。
    """
    path = out / PACKAGE_DIR_REL / "feature-context.json"
    dump_json(path, {
        "graph_node_id": FEATURE_ID,
        "artifact_kind": "feature",
        "purpose": "live-trial で requirements handoff を実走させるための確定 feature",
        "goal": "exact-13 package が readiness 完了状態で handoff できる状態",
        "scope_in": ["確定 system-spec からの要件導出", "exact-13 package の readiness 判定"],
        "scope_out": ["実装コードの生成", "実 repository への書き込み"],
        "acceptance": ["13 task 全件が implementation_readiness=complete である"],
        "architecture_refs": [ARCHITECTURE_REL],
        "updated_at": FIXED_TS,
    })
    return sha256_file(path)


# --------------------------------------------------------------------------- #
# graph 側 (C02 が登録し終えた状態)
# --------------------------------------------------------------------------- #
def _package_task_node(phase: str, responsibility: str, depends_on: list[str],
                       package_digest_hex: str) -> dict:
    """C02 が exact-13 package から登録した後の task node 形状。

    register-package.py の _validate_registration / _resolved_nodes が要求する条件:
      - artifact_kind=task, artifact_subtypes=[], status=active, confirmed/pass
      - parent_feature / feature_package_id が package と一致
      - source_lineage.origin_kind = source_plugin = system-dev-planner
      - source_lineage.source_digest が registration の source_digest (hex) と一致
      - file_path が tasks/<parent_feature>/ 配下
      - depends_on は同 package 内かつ前方 phase のみ
      - tracker_binding は解決済み (repo-config-default が残っていない)
    """
    node_id = task_id(phase)
    file_path = task_file_path(phase)
    node = task_node(node_id, f"{responsibility} ({phase})", "unused", depends_on)
    node.update({
        "file_path": file_path,
        "domain": "development",
        "parent_feature": FEATURE_ID,
        "feature_package_id": FEATURE_PACKAGE_ID,
        "phase_ref": phase,
        "purpose": f"{responsibility}を実行する exact-13 package の 1 phase",
        "goal": f"{responsibility}が完了し後続 phase が着手できる状態",
        "scope_in": [f"{responsibility}の実行"],
        "scope_out": ["他 feature の task への直接介入"],
        "acceptance": [f"{responsibility}の成果物が存在する"],
        "classification_reason": "system-dev-planner が生成した exact-13 package の task",
        "classification_candidates": [
            {"artifact_kind": "task", "candidate_path": file_path, "confidence": 1.0}
        ],
        # confirmation と evaluation を package digest へ pin する。
        # これが「handoff が feature と source digest に束縛され続ける」ことの実値。
        "confirmation_evidence": {
            "evaluated_digest": package_digest_hex,
            "evaluator": "system-dev-planner/validate-system-plan",
            "evidence_ref": f"{PACKAGE_DIR_REL}/{MANIFEST_REL}",
        },
        "source_lineage": {
            "imported_at": FIXED_TS,
            "origin_kind": "system-dev-planner",
            "source_digest": package_digest_hex,
            "source_path": f"{PACKAGE_DIR_REL}/feature-package.json",
            "source_plugin": "system-dev-planner",
            "source_version": "0.1.0",
        },
    })
    return node


def _feature_node(package_digest_hex: str, spec_digest_hex: str) -> dict:
    """package と同一 revision へ収束させた macro feature node。

    register-package.py の _project_parent_feature (:311-330) は登録時に
    親 feature の confirmation_evidence と implementation_readiness を
    package 先頭 node から複写する。fixture もその写像に従う (evidence_ref が
    package を指すのはこの複写の結果であり、feature 独自の証跡ではない)。
    source_lineage だけは複写対象外なので、feature 本来の引用元
    (system-spec-harness 確定成果物) を保持する。origin_kind=system-spec-harness は
    lineage 4 field を非 null 文字列に固定する (graph-node.schema.json allOf[12]) ため、
    source_digest には引用元ファイル自身の sha256 を入れる。
    """
    node = task_node(FEATURE_ID, "live-trial fixture の確定 feature", "unused", [])
    node.update({
        "artifact_kind": "feature",
        "file_path": f"features/{FEATURE_ID.lower()}.md",
        "template_id": "feature",
        "domain": "development",
        "purpose": "確定 system-spec から exact-13 package を導出した macro feature",
        "goal": "readiness 完了時に capability-build へ handoff できる状態",
        "scope_in": ["確定 system-spec からの要件導出", "exact-13 package の readiness 判定"],
        "scope_out": ["実装コードの生成", "実 repository への書き込み"],
        "acceptance": ["13 task 全件が implementation_readiness=complete である"],
        "architecture_refs": [ARCHITECTURE_ID],
        "classification_reason": "live-trial fixture の macro feature node",
        "classification_candidates": [
            {"artifact_kind": "feature", "candidate_path": f"features/{FEATURE_ID.lower()}.md",
             "confidence": 1.0}
        ],
        "confirmation_evidence": {
            "evaluated_digest": package_digest_hex,
            "evaluator": "system-dev-planner/validate-system-plan",
            "evidence_ref": f"{PACKAGE_DIR_REL}/{MANIFEST_REL}",
        },
        "source_lineage": {
            "imported_at": FIXED_TS,
            "origin_kind": "system-spec-harness",
            "source_digest": spec_digest_hex,
            "source_path": SYSTEM_SPEC_REQUIREMENTS_REL,
            "source_plugin": "system-spec-harness",
            "source_version": "0.1.0",
        },
    })
    return node


def _write_node_markdown(out: Path, node: dict) -> None:
    path = out / node["file_path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown_for(node), encoding="utf-8")


def _write_registration_artifacts(out: Path, repository_id: str, package_digest: str,
                                  task_nodes: list[dict], graph_digest_after: str) -> None:
    """C11 (promotion) / C02 (registration) の receipt 一式。

    graph に 13 node が既に載っている以上、その登録を証明する receipt が無いと
    register-package.py は「receipt 無しで登録済み」として fail-closed する
    (:415)。fixture を C02 の冪等 (べきとう = 何度実行しても同じ結果) 再登録で
    検証可能にするため、registration payload と 2 種 receipt も同時に置く。
    """
    package_dir = out / PACKAGE_DIR_REL
    node_ids = [node["graph_node_id"] for node in task_nodes]

    dump_json(package_dir / "atomic-promotion-receipt.json", {
        "schema_version": "1.0.0",
        "status": "promoted",
        "promoted_at": FIXED_TS,
        "generation_id": package_digest.removeprefix("sha256:"),
        "supersedes": None,
        "repo_identity": repository_id,
        "staging_digest": package_digest,
        "evaluated_digest": package_digest,
        "published_digest": package_digest,
        "implementation_readiness": "complete",
        "quality_conditions": {
            "no_contradiction": "PASS",
            "no_missing": "PASS",
            "consistent": "PASS",
            "dependency_integrity": "PASS",
        },
        "promotion_method": "same-filesystem-atomic-rename",
        "registration_manifest": f"{PACKAGE_DIR_REL}/dev-graph-registration.json",
    })

    # 搬送 payload は binding 未解決の sentinel を持つ。C02 が config の
    # execution_tracker から解決し、永続 graph には sentinel を残さない。
    carried = []
    for node in task_nodes:
        payload = copy.deepcopy(node)
        payload["tracker_binding"] = "repo-config-default"
        carried.append(payload)
    dump_json(package_dir / "dev-graph-registration.json", {
        "schema_version": "1.0.0",
        "source_digest": package_digest,
        "promotion_receipt": f"{PACKAGE_DIR_REL}/atomic-promotion-receipt.json",
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "expected_count": 13,
        "phase_refs": PHASES,
        "binding_intents": {node_id: "none" for node_id in node_ids},
        "nodes": carried,
    })

    # graph_revision の物語: 1=repo 骨格、2=architecture/feature 追加、3=exact-13 登録。
    dump_json(package_dir / "dev-graph-registration-receipt.json", {
        "schema_version": "1.0.0",
        "status": "registered",
        "registered_at": FIXED_TS,
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "source_digest": package_digest,
        "expected_count": 13,
        "applied_count": 13,
        "phase_refs": PHASES,
        "node_ids": node_ids,
        "graph_revision_before": 2,
        "graph_revision_after": 3,
        "graph_digest_after": graph_digest_after,
        "output_path": ".dev-graph/state/graph.json",
        "operation": "registered",
        "supersedes_source_digest": None,
    })


# --------------------------------------------------------------------------- #
# entry point
# --------------------------------------------------------------------------- #
def build(out: Path) -> None:
    """C04 scenario 用の隔離 fixture repository を生成する。"""
    # 骨格 graph は revision 1 / node 0 件。以降 _add_plan_roots が config を、
    # build 末尾が graph を revision 3 (exact-13 登録済み) まで進める。
    common, _ = scaffold(out, kind=SHAPE, graph={"graph_revision": 1, "nodes": []})
    repository_id = _add_plan_roots(out)
    _write_system_spec(out)

    spec_digest_hex = sha256_file(out / SYSTEM_SPEC_REQUIREMENTS_REL)
    architecture = _architecture_node(spec_digest_hex)
    _write_node_markdown(out, architecture)

    source_feature_digest = _write_feature_context(out)
    write_package_sources(out, repository_id, source_feature_digest)
    run_build_system_handoff(out)

    package_dir = out / PACKAGE_DIR_REL
    manifest = json.loads((package_dir / MANIFEST_REL).read_text(encoding="utf-8"))
    package_digest = str(manifest["canonical_digest"])
    package_digest_hex = package_digest.removeprefix("sha256:")

    # scenario が --package で指す入口。C12 が読む canonical 名 feature-package.json と
    # byte 同一にして、入口名と validator 契約を二重管理しないようにする。
    (package_dir / "package.json").write_bytes((package_dir / "feature-package.json").read_bytes())

    depends = {phase: ([] if index == 0 else [task_id(PHASES[index - 1])])
               for index, phase in enumerate(PHASES)}
    feature = _feature_node(package_digest_hex, spec_digest_hex)
    task_nodes = [
        _package_task_node(phase, responsibility, depends[phase], package_digest_hex)
        for phase, responsibility, _kind in PHASE_META
    ]

    graph_path = out / ".dev-graph" / "state" / "graph.json"
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    # node 並びは C02 の登録手順と同じ (既存 node を保ったまま 13 node を末尾へ append)。
    graph["nodes"] = [*graph["nodes"], architecture, feature, *task_nodes]
    graph["graph_revision"] = 3
    dump_json(graph_path, graph)

    _write_node_markdown(out, feature)
    for node in task_nodes:
        _write_node_markdown(out, node)

    _write_registration_artifacts(
        out, repository_id, package_digest, task_nodes, _graph_document_digest(graph)
    )
    _write_current_pointer(out, package_digest)
    finalize(out)

    # commit 後に「baseline = C04 の入力だけ」を検査する。ここで宣言外の path を弾くので、
    # 被験 skill の出力に相当する artifact を fixture へ足すには宣言の更新が必須になる。
    declared = declared_inputs()
    assert_input_closure(out, declared)
    write_baseline_receipt(out, common, declared)
