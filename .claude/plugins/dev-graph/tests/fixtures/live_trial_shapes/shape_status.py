#!/usr/bin/env python3
"""scenario ``C18-OUT1-positive-read-only-status`` (skill: dev-graph:run-dev-graph-status) の形状。

fixture 契約:
  「初期化済みの隔離 repository に、依存関係を持つ task が複数ある」状態。C18 は
  read-only skill なので、fixture は「skill が読み取って報告すべき実値」を持つだけでよい。

置くもの:
  .dev-graph/config.json              repo-config.schema.json 準拠 (骨格層の最小 config)
  .dev-graph/state/graph.json         task 2 件 (LT-TASK-002 が LT-TASK-001 に依存)
  tasks/lt-task-001.md                LT-TASK-001 (depends_on なし = ready)
  tasks/lt-task-002.md                LT-TASK-002 (LT-TASK-001 に依存 = blocked-by)

node の形は削除前の base 生成器 (git 25e6fa9 の ``build``) と同一であり、
``base_shape.task_node`` がその正本を引き継いでいる。

なぜ「依存 1 本」なのか (anti-Goodhart):
  task が 1 件だけだと「依存関係を解けているのか、単に全件を並べているのか」を
  trial で区別できない。逆に status や完了状態まで作り込むと、C18 の集計結果を
  fixture 側が先に決めてしまう。ready/blocked の区別が付く最小構成として
  「同一 status の 2 件 + 前方依存 1 本」に留める。

決定論性: 全値が literal か node_id からの導出で、時刻・乱数・生成先 path に依存しない。
"""
from __future__ import annotations

from pathlib import Path

from .base_shape import finalize, scaffold, task_node, write_json, write_node_markdown

SHAPE = "status"

TASK_SPECS = [
    ("LT-TASK-001", "live-trial fixture の基点タスク", "lt-task-001", []),
    ("LT-TASK-002", "LT-TASK-001 に依存する後続タスク", "lt-task-002", ["LT-TASK-001"]),
]


def build(out: Path) -> None:
    """C18 scenario 用の隔離 fixture repository を生成する。"""
    nodes = [task_node(node_id, title, slug, depends_on) for node_id, title, slug, depends_on in TASK_SPECS]
    # graph_revision=1 は「骨格 + 初期 node 登録が 1 回だけ起きた」状態を表す。
    # node を先に組んで scaffold へ渡すのは、graph store の書き込み点を 1 箇所に保つため
    # (直に write_json すると canonical envelope の付与が抜ける)。
    scaffold(out, kind=SHAPE, graph={"graph_revision": 1, "nodes": nodes})
    for node in nodes:
        write_node_markdown(out, node)
    finalize(out)
