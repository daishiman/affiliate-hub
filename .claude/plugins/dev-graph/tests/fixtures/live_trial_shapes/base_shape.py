#!/usr/bin/env python3
"""shape module 群が共有する repo 骨格層。

役割:
  ``build_live_trial_fixture.py`` (生成器の正本) が持つ repo 骨格 helper と、
  shape 側でしか使わない node 形状 helper (``task_node`` / ``markdown_for``) を
  1 箇所に集約する。各 shape module は本 module だけを見れば完結した
  ``build(out: Path) -> None`` を書ける。

なぜ base の private 名を参照するか:
  ``_init_repository`` / ``_repo_config`` などは build_live_trial_fixture.py の
  module private 命名だが、fixture 生成器という単一目的 package の内部層分割であり、
  外部 API ではない。参照を本 module 1 箇所へ閉じることで、base 側の helper 名が
  変わったときの追従点を 1 file に限定する (8 個の shape へ散らさない)。

なぜ import が遅延なのか:
  build_live_trial_fixture.py は ``BUILDERS`` の解決のために live_trial_shapes を
  import する。本 module が import 時に base を読むと循環参照になるため、
  ``load_base()`` は呼び出し時 (= build 実行時) に解決する。base が ``__main__`` として
  実行されている場合は sys.modules に別名で載っているため、file path から
  ``build_live_trial_fixture`` という正準名で 1 度だけ読み込んで cache する。
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).resolve().parents[1]
BASE_MODULE_NAME = "build_live_trial_fixture"

# 固定 timestamp。再生成のたびに fixture の digest が動くと trial の再現性が失われる。
# base の CREATED_AT (C03 sync の remote fixture 用) とは別系列の値で、
# shape 層が生成する node/成果物はすべてこの 1 値に揃える。
FIXED_TS = "2026-07-21T00:00:00Z"

# --force で削除してよい素性の証拠。``.dev-graph/config.json`` を持てない C01 init
# fixture のために、git 内部 (被験 skill からは content として見えない場所) へ置く。
FIXTURE_MARKER_REL = Path("dev-graph") / "fixture-marker.json"


def load_base():
    """base 生成器 (build_live_trial_fixture.py) を module として解決する。"""
    cached = sys.modules.get(BASE_MODULE_NAME)
    if cached is not None:
        return cached
    spec = importlib.util.spec_from_file_location(
        BASE_MODULE_NAME, FIXTURES_DIR / f"{BASE_MODULE_NAME}.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[BASE_MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, value: Any) -> None:
    """base の atomic_json と同じ整形 (sort_keys + indent 2 + 末尾改行)。"""
    load_base()._write_json(path, value)


def write_graph(out: Path, repository_id: str, graph: dict[str, Any] | None = None) -> None:
    """canonical envelope を保証したうえで graph store を書く単一の入口。

    ``{graph_revision, nodes}`` だけの graph を、C02 の正規 writer が store へ書くのと
    同じ exact-4-key ``{schema_version, repository_id, graph_revision, nodes}`` へ
    引き上げてから書く。shape が ``write_json(... "graph.json", {...})`` を直に呼ぶと
    envelope の付与が抜け、被験 skill が「本番なら C11 起動ゲートで落ちる入力」で
    実走してしまうため、graph store への書き込みは本 helper に集約する。
    """
    load_base()._write_graph(out, repository_id, graph)


def mark_fixture(common: Path, kind: str) -> None:
    """本生成器が作った fixture であることを git 内部へ記録する。

    ``_prepare_output`` の --force 判定はこの marker か ``.dev-graph/config.json`` の
    どちらかを素性の証拠として要求する。取り違えた path を消さないための門番なので、
    生成した全 kind が必ず置く。
    """
    write_json(common / FIXTURE_MARKER_REL, {"generated_by": f"{BASE_MODULE_NAME}.py", "kind": kind})


def init_repository(out: Path, *, kind: str) -> Path:
    """git repo だけを作り、git common dir を返す。

    C24 resolve-repo-context.py が git common dir の realpath から repository_id を
    導出するため、fixture は必ず本物の git toplevel でなければならない。
    """
    common = load_base()._init_repository(out)
    mark_fixture(common, kind)
    return common


def scaffold(
    out: Path,
    *,
    kind: str,
    graph: dict[str, Any] | None = None,
    tracker_mode: str = "beads",
    projects: list[dict[str, Any]] | None = None,
) -> tuple[Path, str]:
    """dev-graph 初期化済みの repo 骨格を作り ``(git common dir, repository_id)`` を返す。

    ``graph`` を省略すると空 graph (revision 0) になる。node を先に置く shape は
    自分で revision と nodes を渡すか、生成後に graph.json を読み直して追記する。
    commit はまだ打たない (shape 固有の成果物を置いてから ``finalize`` で打つ)。

    ``tracker_mode`` の既定が beads なのは、本 helper が Projects 定義を持たない骨格を
    作るため。GitHub トラッカーを宣言すると schema が default Projects を 1 件要求し、
    fixture が使いもしない Projects v2 定義を抱えることになる (HarnessHub-n88)。
    GitHub 同期そのものが被験対象の shape だけが ``projects`` を伴って github を選ぶ。
    """
    base = load_base()
    common = init_repository(out, kind=kind)
    repository_id = base._repository_id(common)
    # content root は commit 前に実体化しておく。shape が artifact を書き込む先であり、
    # 上流 script (system-dev-planner の C09 など) も config 宣言との実在一致を要求する。
    for relative in sorted(set(base.CONTENT_ROOTS.values())):
        (out / relative).mkdir(parents=True, exist_ok=True)
    write_json(
        out / ".dev-graph" / "config.json",
        base._repo_config(repository_id, tracker_mode=tracker_mode, projects=list(projects or [])),
    )
    write_graph(out, repository_id, graph)
    # lease 台帳の正本は worktree ではなく git common dir 側 (C15 の authority 判定)。
    write_json(common / "dev-graph" / "leases.json", {"leases": []})
    return common, repository_id


def finalize(out: Path) -> None:
    """content root を実体化して初期 commit を打つ。HEAD が無いと C24 が起動できない。"""
    load_base()._finalize(out)


def task_node(node_id: str, title: str, slug: str, depends_on: list[str]) -> dict[str, Any]:
    """graph-node.schema.json の required 40 key を満たす task node の雛形。

    tracker_binding=none / github_publication=local_only に固定し、fixture が外部
    tracker へ投影されうる形を持たないようにする。status=active は schema の allOf で
    confirmation/evaluation の確定と confirmation_evidence の実体 (64 hex digest) を
    要求するため、digest は node_id から決定論導出して再生成で動かないようにする。
    """
    file_path = f"tasks/{slug}.md"
    return {
        "graph_node_id": node_id,
        "artifact_kind": "task",
        "artifact_subtypes": [],
        "title": title,
        "project_id": "live-trial-fixture",
        "domain": "documentation",
        "status": "active",
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
        "purpose": "live-trial の被験 skill を実 repo から隔離して実走させるための固定 fixture node",
        "goal": "graph 実値と skill 出力の一致を観測できる状態",
        "scope_in": ["fixture 内の読み取り検証"],
        "scope_out": ["実 repository の変更"],
        "acceptance": ["skill 出力の status/depends_on が本 node の値と一致する"],
        "architecture_refs": [],
        "parent_feature": None,
        "feature_package_id": None,
        "phase_ref": None,
        "file_path": file_path,
        "template_id": "task",
        "template_version": "1.0.0",
        "confirmation_status": "confirmed",
        "evaluation_status": "pass",
        "confirmation_evidence": {
            "evaluated_digest": hashlib.sha256(node_id.encode("utf-8")).hexdigest(),
            "evaluator": "build_live_trial_fixture",
            "evidence_ref": file_path,
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
        "classification_reason": "live-trial fixture として決定論生成された task node",
        "classification_candidates": [
            {"artifact_kind": "task", "candidate_path": file_path, "confidence": 1.0}
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
            "status": "complete",
        },
    }


# task の必須見出しは source_lineage.origin_kind で分岐する (HarnessHub-yzv0 で task を
# HEADING_MISSING_KINDS へ追加)。origin_kind=manual (task_node() の既定) は base
# required_sections (13 見出し) を、origin_kind=system-dev-planner (shape_requirements の
# _package_task_node() など) は conditional_required_sections の system_development_baseline
# variant (軽量3見出し) を満たす必要がある。
_TASK_REQUIRED_SECTIONS = [
    "目的", "背景", "入力と前提条件", "出力と成果物", "依存関係", "実装対象",
    "Write scope と競合制約", "GitHub publication", "実行手順", "受入条件",
    "検証方法", "リスクとロールバック", "Handoff",
]
_SYSTEM_DEV_PLANNER_BASELINE_SECTIONS = ["正本仕様書", "依存", "実行契約"]

# task 以外で HEADING_MISSING_KINDS に入っている kind (architecture / specification)。
# 見出し文言を fixture 側へ写経すると contract 改訂で静かにずれるため、正本 (template-contract.json)
# から読む。task を写経のまま残しているのは、上記の origin_kind 分岐が contract の
# conditional 側と 1 対 1 でない (baseline variant を fixture が明示選択する) ため (HarnessHub-o4zi)。
_TEMPLATE_CONTRACT_PATH = FIXTURES_DIR.parents[1] / "templates" / "template-contract.json"


def _contract_required_sections(kind: str) -> list[str]:
    contract = json.loads(_TEMPLATE_CONTRACT_PATH.read_text(encoding="utf-8"))
    artifacts = contract.get("artifacts", contract)
    sections = (artifacts.get(kind) or {}).get("required_sections") or []
    return [str(section) for section in sections]


def markdown_for(node: dict[str, Any]) -> str:
    """frontmatter_of (行指向スカラパーサ) が読める 1 行 1 key の frontmatter を組む。

    C11 artifact_findings は graph node と frontmatter の parity を
    graph_node_id/artifact_kind/file_path/template_id/template_version で照合するため、
    node の値をそのまま JSON スカラとして書き出す。artifact_kind が HEADING_MISSING_KINDS
    (task / architecture / specification) の場合は required_sections も満たす必要があるため、
    見出しを併せて書く。task だけは origin_kind で必要見出しが変わる。
    """
    lines = ["---"]
    for key, value in node.items():
        if key == "closed_at" and value is None:
            continue
        lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
    lines.extend(
        [
            "---",
            "",
            f"# {node['title']}",
            "",
            "live-trial fixture の固定 artifact。実 repository の成果物ではない。",
            "",
        ]
    )
    kind = node.get("artifact_kind")
    if kind == "task":
        origin_kind = (node.get("source_lineage") or {}).get("origin_kind")
        sections = (
            _SYSTEM_DEV_PLANNER_BASELINE_SECTIONS
            if origin_kind == "system-dev-planner"
            else _TASK_REQUIRED_SECTIONS
        )
    elif kind in ("architecture", "specification"):
        sections = _contract_required_sections(kind)
    else:
        sections = []
    for section in sections:
        lines.extend([f"## {section}", "", "live-trial fixture の固定 artifact の検証用の実文。", ""])
    return "\n".join(lines)


def write_node_markdown(out: Path, node: dict[str, Any]) -> None:
    """node の file_path へ artifact 実体を書く (C11 の artifact_missing を避ける)。"""
    path = out / node["file_path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown_for(node), encoding="utf-8")
