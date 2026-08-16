"""scenario ``C05-OUT1-positive-feature-progress`` (skill: dev-graph:run-dev-graph-render) の形状。

復元した scenario 契約:
  render は「feature ノードが配下 task (parent_feature 参照) の完了進捗 X/Y を集約表示する」
  ことを OUT1 の受入条件にしている (SKILL.md ## Purpose & Output Contract 4 と
  feedback_contract OUT1)。さらに registration receipt を渡した場合は
  ``applied_count/expected_count`` と ``source_digest`` が描画対象の実体と一致することまで
  照合する。したがって positive fixture は次を同時に満たす必要がある。

  1. feature 1 件と、その配下に status の異なる task が複数ある (X/Y の X<Y が観測できる)。
  2. その feature が C11 の exact-13 契約 (validate-graph-schema.py の
     ``feature_package_not_exact_13``) を満たす。単に「task 数件」では C11 が落ち、
     fixture 自体が起動ゲートを通らない。
  3. immutable registration receipt が実 graph と整合する。render-graph-html.py の
     ``_registration`` は receipt の node_ids / applied_count / source_digest /
     graph_digest_after を実 graph へ突き合わせ、1 つでもずれたら HTML を書かない。

  つまり本 shape は「exact-13 package が登録済みで、そのうち 4 件が done」という
  registration 直後の状態を決定論的に再現する (旧 r5 trial が register-package.py を
  実走して作っていた状態と同じ形)。

生成物 (repo 骨格に加えて本 shape が置くもの):
  architecture/lt-arch-001.md               feature.architecture_refs の参照先 (minItems 1)
  features/lt-feature-001.md                LT-FEATURE-001 (macro feature)
  tasks/lt-feature-001-p01..p13.md          exact-13 の子 task (P01..P13)
  system-plan/LT-FEATURE-001/feature-package.json
                                            子 task の source_lineage.source_digest の実体
  system-plan/LT-FEATURE-001/dev-graph-registration-receipt.json
                                            register-package.py が書くのと同形の immutable receipt
  .dev-graph/state/graph.json               上記ノードを追記し graph_revision を 2 へ更新

決定論性: 時刻・乱数・生成先 path に依存する値を持たない。source_digest は同梱
feature-package.json の実バイト列から、graph_digest_after は書き出した graph.json の
正準表現から導出するため、何度生成しても同じ値になる。
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .base_shape import FIXED_TS, finalize, markdown_for, scaffold, task_node

SHAPE = "render"

FEATURE_ID = "LT-FEATURE-001"
FEATURE_SLUG = "lt-feature-001"
FEATURE_PACKAGE_ID = "feature-package/LT-FEATURE-001"
ARCHITECTURE_ID = "LT-ARCH-001"
ARCHITECTURE_SLUG = "lt-arch-001"
PACKAGE_DIR = "system-plan/LT-FEATURE-001"
PACKAGE_SOURCE_PATH = f"{PACKAGE_DIR}/feature-package.json"
# 受領 path は register-package.py の CANONICAL_REGISTRATION_RECEIPT と同じ名前に揃える。
RECEIPT_PATH = f"{PACKAGE_DIR}/dev-graph-registration-receipt.json"
GRAPH_PATH = ".dev-graph/state/graph.json"

PHASES = tuple(f"P{index:02d}" for index in range(1, 14))
PHASE_TITLES = {
    "P01": "入力契約の確定",
    "P02": "データモデル定義",
    "P03": "永続化層の実装",
    "P04": "ドメインロジックの実装",
    "P05": "API ハンドラの実装",
    "P06": "認可と入力検証",
    "P07": "単体テスト",
    "P08": "結合テスト",
    "P09": "エラー処理と回復",
    "P10": "可観測性の配線",
    "P11": "受入テスト",
    "P12": "移行とロールバック手順",
    "P13": "リリースと引き継ぎ",
}
# feature progress を X<Y かつ複数 status で観測させるための固定配分 (done 4 件 = 4/13)。
# 全件同一 status だと「集約が効いているのか、単に総数を出しているのか」を trial で区別できない。
PHASE_STATUS = {
    **{phase: "done" for phase in ("P01", "P02", "P03", "P04")},
    "P05": "active",
    "P06": "blocked",
    **{phase: "draft" for phase in ("P07", "P08", "P09", "P10", "P11", "P12", "P13")},
}


def _write_json(path: Path, document: dict) -> bytes:
    """骨格の graph/config と同じ整形規則 (sort_keys + indent 2 + 末尾改行) で書く。"""
    payload = (json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return payload


def _canonical_digest(document: dict) -> str:
    """register-package.py / render-graph-html.py と同じ正準 JSON digest を求める。"""
    raw = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def _retarget(node: dict, kind: str, file_path: str) -> dict:
    """base_shape.task_node を別 artifact_kind へ振り替える (file_path 由来の値も揃える)。

    file_path は kind ごとの正規 root 配下でなければ C11 が path_parity_error を出し、
    frontmatter との parity も検査されるため、派生フィールドを取り残さない。
    """
    node["artifact_kind"] = kind
    node["template_id"] = kind
    node["file_path"] = file_path
    node["confirmation_evidence"]["evidence_ref"] = file_path
    node["classification_candidates"] = [
        {"artifact_kind": kind, "candidate_path": file_path, "confidence": 1.0}
    ]
    return node


def _architecture_node() -> dict:
    """feature.architecture_refs の参照先。dangling_reference を避けるため実ノードで置く。"""
    node = task_node(ARCHITECTURE_ID, "live-trial fixture の参照アーキテクチャ", ARCHITECTURE_SLUG, [])
    _retarget(node, "architecture", f"architecture/{ARCHITECTURE_SLUG}.md")
    # architecture は artifact_subtypes を1種以上要求する (schema allOf: architecture)。
    node["artifact_subtypes"] = ["backend"]
    node["classification_reason"] = "live-trial fixture の feature が参照する固定 architecture ノード"
    return node


def _feature_node() -> dict:
    """macro feature ノード。progress 集約の親になる。"""
    node = task_node(FEATURE_ID, "live-trial fixture の可視化対象 feature", FEATURE_SLUG, [])
    _retarget(node, "feature", f"features/{FEATURE_SLUG}.md")
    # feature は purpose/goal/scope_in/scope_out/acceptance/architecture_refs を
    # 非空で要求する (schema allOf: feature)。
    node["purpose"] = "render の feature progress 集約を実 graph 値で観測できるようにするための固定 feature"
    node["goal"] = "配下 exact-13 task の完了数が X/Y として描画された状態"
    node["scope_in"] = ["配下 13 task の進捗集約表示"]
    node["scope_out"] = ["実 repository の feature 定義"]
    node["acceptance"] = ["描画された feature progress が graph 上の done 件数と一致する"]
    node["architecture_refs"] = [ARCHITECTURE_ID]
    node["tags"] = ["live-trial", "fixture", "render"]
    node["classification_reason"] = "live-trial fixture の progress 集約対象として決定論生成された feature ノード"
    return node


def _package_task_node(phase: str, source_digest: str) -> dict:
    """exact-13 package の子 task を 1 件組む。

    depends_on は直前 phase のみを指す。C11 は同一 feature 内で「自分以降の phase へ
    依存する」辺を non_forward_phase_dependency として弾くため、後方参照だけにする。
    """
    index = int(phase[1:])
    slug = f"{FEATURE_SLUG}-{phase.lower()}"
    node_id = f"{FEATURE_ID}-{phase}"
    depends_on = [f"{FEATURE_ID}-P{index - 1:02d}"] if index > 1 else []
    node = task_node(node_id, f"{phase}: {PHASE_TITLES[phase]}", slug, depends_on)
    node["parent_feature"] = FEATURE_ID
    node["feature_package_id"] = FEATURE_PACKAGE_ID
    node["phase_ref"] = phase
    node["status"] = PHASE_STATUS[phase]
    node["tags"] = ["live-trial", "fixture", "render"]
    # render の _registration は子 task 全件の source_lineage.source_digest が receipt の
    # source_digest と一致することを要求する。digest は同梱 package の実バイト列由来なので、
    # validate-source-digest.py (source_path の実 file と突き合わせる C02 のゲート) も通る。
    node["source_lineage"] = {
        "imported_at": FIXED_TS,
        "origin_kind": "system-dev-planner",
        "source_digest": source_digest,
        "source_path": PACKAGE_SOURCE_PATH,
        "source_plugin": "system-dev-planner",
        "source_version": "1.0.0",
    }
    if node["status"] == "done":
        # policy=manual にしておく。linked_pr_merged_* を選ぶと schema が merged PR linkage を
        # 要求し、tracker_binding=none の fixture と矛盾する。
        node["completion_evidence"] = {
            "completed_at": FIXED_TS,
            "evidence_refs": [node["file_path"]],
            "policy": "manual",
            "reconciled_at": FIXED_TS,
            "source": "manual",
            "status": "done",
        }
    return node


def _feature_package_document(node_ids: dict[str, str]) -> dict:
    """子 task の source_lineage が指す exact-13 package の正本 (digest の実体)。"""
    return {
        "schema_version": "1.0.0",
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "generated_by": "build_live_trial_fixture.py --kind render",
        "phases": [
            {"phase_ref": phase, "graph_node_id": node_ids[phase], "title": PHASE_TITLES[phase]}
            for phase in PHASES
        ],
    }


def build(out: Path) -> None:
    """C05 scenario 用の隔離 fixture repository を生成する。"""
    # 骨格 graph は revision 1 / node 0 件。本 shape はそこへ register-package 相当の
    # 1 回分の登録を重ね、revision を 2 へ進める (receipt の before/after と対応する)。
    scaffold(out, kind=SHAPE, graph={"graph_revision": 1, "nodes": []})
    node_ids = {phase: f"{FEATURE_ID}-{phase}" for phase in PHASES}

    # 1) package の正本を先に確定する。source_digest は「その file の実バイト列の sha256」なので、
    #    後段のノード生成より前に書いて digest を固定する必要がある。
    package_bytes = _write_json(out / PACKAGE_SOURCE_PATH, _feature_package_document(node_ids))
    source_digest = hashlib.sha256(package_bytes).hexdigest()

    # 2) architecture → feature → exact-13 task の順にノードを組む。
    new_nodes = [_architecture_node(), _feature_node()]
    new_nodes.extend(_package_task_node(phase, source_digest) for phase in PHASES)
    for node in new_nodes:
        (out / node["file_path"]).parent.mkdir(parents=True, exist_ok=True)
        (out / node["file_path"]).write_text(markdown_for(node), encoding="utf-8")

    # 3) 骨格 graph へ追記する。register-package.py が 1 回の登録で revision を +1 するのに倣い、
    #    graph_revision も進めて receipt の before/after と辻褄を合わせる。
    graph_path = out / GRAPH_PATH
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    revision_before = graph["graph_revision"]
    graph["graph_revision"] = revision_before + 1
    graph["nodes"] = [*graph["nodes"], *new_nodes]
    _write_json(graph_path, graph)

    # 4) receipt の graph_digest_after は「書き出した graph.json を読み直した値」の正準 digest。
    #    render 側も file を読んで同じ計算をするため、ここで読み直して parity を保証する。
    written_graph = json.loads(graph_path.read_text(encoding="utf-8"))
    receipt = {
        "schema_version": "1.0.0",
        "status": "registered",
        "registered_at": FIXED_TS,
        "feature_package_id": FEATURE_PACKAGE_ID,
        "parent_feature": FEATURE_ID,
        "source_digest": f"sha256:{source_digest}",
        "expected_count": 13,
        "applied_count": 13,
        "phase_refs": list(PHASES),
        "node_ids": [node_ids[phase] for phase in PHASES],
        "graph_revision_before": revision_before,
        "graph_revision_after": revision_before + 1,
        "graph_digest_after": _canonical_digest(written_graph),
        "output_path": GRAPH_PATH,
        "operation": "registered",
        "supersedes_source_digest": None,
    }
    _write_json(out / RECEIPT_PATH, receipt)
    finalize(out)
