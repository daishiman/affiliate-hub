#!/usr/bin/env python3
"""scenario ``C15-OUT1-positive-ready-set-r16`` (skill: dev-graph:run-dev-graph-schedule) の形状。

fixture 契約:
  C15 の受入は「推薦タスクが全依存充足済み (ready)」(OUT1) に加え、並列バッチ内の
  ``resource_scope`` 重複が 0 件 (OUT2)、ready task ごとに一意な suggested_branch と
  worktree claim command が返る (OUT3) までを観測する。これらが **空振りしない**
  (vacuous に真にならない) 状態を作るのが本 shape の役割である。

  従来は C03 sync の fixture を流用していたが、そこには task が 1 件しか無く lease も
  空だった。ready 集合が ``--max-parallel`` を超えないためバッチ分割が起きず、
  scope 重複も lease 失効も 1 度も評価されないまま「重複 0 件」が真になる —
  典型的な Goodhart (指標は緑だが観測していない)。

置くもの (すべて ``status=active``/``confirmed``/``pass``/``readiness complete`` =
``is_schedulable`` を満たす。ready かどうかは依存と lease だけで決まるようにする):

  LT-SCHED-001  scope=src/alpha.py   ready
  LT-SCHED-002  scope=src/alpha.py   ready・001 と scope 重複 → 同一バッチ禁止
  LT-SCHED-003  scope=src/beta.py    ready・重複なし
  LT-SCHED-004  scope=src/gamma.py   **active lease** で抑止される
  LT-SCHED-005  scope=src/epsilon.py depends_on=[LT-SCHED-001] が未 done → blocked
  LT-SCHED-006  scope=src/delta.py   **stale lease** が失効し回収される

  ready 集合 = 001/002/003/006 の 4 件で ``--max-parallel 2`` を超える (バッチ分割が要る)。
  001↔002 が唯一の scope 重複ペアなので、両者が同じバッチに入れば即座に OUT2 違反として
  観測できる。005 は依存先 001 が ``done`` でないため ready から外れ、理由が報告される。

lease の期限を固定値にする理由:
  ``_active()`` は ``state ∈ ACTIVE_LEASE_STATES`` かつ ``expires_at > now`` を active と
  判定する。決定論性のため生成時刻を使わず、active 側は十分先の固定日、stale 側は
  十分過去の固定日を置く。base_shape.FIXED_TS を active に使うと、その日付を過ぎた時点で
  fixture の意味が黙って反転する (active lease が stale になる) ため使わない。

決定論性: 全値が literal か node_id からの導出で、時刻・乱数・生成先 path に依存しない。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .base_shape import finalize, scaffold, task_node, write_json, write_node_markdown

SHAPE = "schedule"

# active 側は「まだ十分先」、stale 側は「確実に過去」の固定 UTC 時刻。
# 生成時刻から相対計算しない (再生成のたびに fixture digest が動くと再現性が失われる)。
LEASE_ACTIVE_UNTIL = "2099-01-01T00:00:00+00:00"
LEASE_EXPIRED_AT = "2020-01-01T00:00:00+00:00"

# (node_id, title, slug, depends_on, resource_scope)
TASK_SPECS: list[tuple[str, str, str, list[str], list[str]]] = [
    ("LT-SCHED-001", "ready なタスク (scope 重複ペアの一方)", "lt-sched-001", [], ["src/alpha.py"]),
    ("LT-SCHED-002", "ready なタスク (scope 重複ペアの他方)", "lt-sched-002", [], ["src/alpha.py"]),
    ("LT-SCHED-003", "ready で scope 重複を持たないタスク", "lt-sched-003", [], ["src/beta.py"]),
    ("LT-SCHED-004", "active lease に抑止されるタスク", "lt-sched-004", [], ["src/gamma.py"]),
    ("LT-SCHED-005", "未充足依存で blocked なタスク", "lt-sched-005", ["LT-SCHED-001"], ["src/epsilon.py"]),
    ("LT-SCHED-006", "stale lease が失効して回収されるタスク", "lt-sched-006", [], ["src/delta.py"]),
]

LEASES: list[dict[str, Any]] = [
    {
        "graph_node_id": "LT-SCHED-004",
        "state": "in_progress",
        "expires_at": LEASE_ACTIVE_UNTIL,
        "resource_scope": ["src/gamma.py"],
        "worktree": ".worktrees/lt-sched-004",
    },
    {
        "graph_node_id": "LT-SCHED-006",
        "state": "claimed",
        "expires_at": LEASE_EXPIRED_AT,
        "resource_scope": ["src/delta.py"],
        "worktree": ".worktrees/lt-sched-006",
    },
]


def build(out: Path) -> None:
    """C15 scenario 用の隔離 fixture repository を生成する。"""
    nodes = []
    for node_id, title, slug, depends_on, scope in TASK_SPECS:
        node = task_node(node_id, title, slug, depends_on)
        # task_node の既定は空 scope だが、schedule の touches() は非空 string[] を要求する
        # (空だと scope 重複判定そのものが成立しない)。
        node["resource_scope"] = scope
        nodes.append(node)
    # graph_revision=1 は「骨格 + 初期 node 登録が 1 回だけ起きた」状態を表す。
    # node を先に組んで scaffold へ渡すのは、graph store の書き込み点を 1 箇所に保つため
    # (直に write_json すると canonical envelope の付与が抜ける)。
    common, _ = scaffold(out, kind=SHAPE, graph={"graph_revision": 1, "nodes": nodes})
    for node in nodes:
        write_node_markdown(out, node)
    # lease 台帳の正本は worktree ではなく git common dir 側 (C15 の authority 判定)。
    write_json(common / "dev-graph" / "leases.json", {"leases": LEASES})
    finalize(out)
