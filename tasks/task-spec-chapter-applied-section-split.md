---
graph_node_id: "task-spec-chapter-applied-section-split"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "仕様章の「本章での適用」を別ファイルへ切り出す"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec",".claude/plugins/system-spec-harness"]
purpose: null
goal: null
mvp_alignment: {"background":"仕様章の行数の天井を置き直したとき、`#### 本章での適用` が章本文と同じファイルに居ることが天井を押し上げていた","mvp_fit":"deferred","purpose":"章の分量の見積もりから、適用メモの分を外す","rationale":"適用メモは章ごとに増え続ける性質のもので、章本文の分量とは別に数えたい"}
scope_in: ["`#### 本章での適用` の置き場所の決定と移設","compile 側の参照経路の追従"]
scope_out: ["章本文そのものの書き換え"]
acceptance: ["`#### 本章での適用` が章本文とは別のファイルに置かれ、章の行数の天井に算入されない","切り出し後も確定済み章の保護 (guard-confirmed-chapter-overwrite) が効く"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-chapter-applied-section-split.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-chapter-applied-section-split.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

仕様章の分量を数えるとき、章ごとに増え続ける適用メモを勘定から外す。

## 背景

仕様章の行数の天井を置き直したとき、`#### 本章での適用` が章本文と同じファイルに居ることが天井を押し上げていた。適用メモは章が増えるほど積み上がる性質のもので、章本文がどれだけ簡潔でも天井に当たる。天井を上げて逃がすのは禁じ手なので、数える対象を分ける。

## 入力と前提条件

- 入力: `system-spec/*.md` の各章と、その中の `#### 本章での適用` 節
- 前提: 確定済み章への直接 Edit は `guard-confirmed-chapter-overwrite.py` が遮断する。再オープン経由でのみ変更できる

## 出力と成果物

- 生成物: 適用メモの置き場 (章ごとの別ファイル) と、そこへの参照
- 更新対象: `compile-spec-doc.py` の参照経路、行数を数えるゲート

## 依存関係

- `depends_on`: なし
- ブロッカー: 確定済み章を触るので、対象章の再オープンが先に要る

## 実装対象

- Frontend: N/A: 画面に出るものではない
- Backend/API: N/A: 実行時のコードを触らない
- Database/Data: N/A: データを持たない
- Infrastructure: N/A: 配置は変わらない
- Security/Privacy: N/A: 秘密を含まない文書
- Documentation: 仕様章の構成そのものが対象

## Write scope と競合制約

- `touches`: system-spec/ .claude/plugins/system-spec-harness/
- 排他資源: system-spec の章ファイル
- 並列実行条件: 同じ章を触る task と同時に走らせない
- branch: devgraph/task-spec-chapter-applied-section-split
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理する
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: pending_retry。local の task は巻き戻さない
- Completion policy: manual (github.enabled=false のため source=manual)
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-spec-chapter-applied-section-split` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `#### 本章での適用` の置き場所を決める (章ごとの別ファイルか、1 つの適用集か)
2. 対象章を再オープンし、適用メモを移す
3. `compile-spec-doc.py` が移設先を引けるようにする
4. 行数を数えるゲートが移設分を勘定しないことを確かめる

## 受入条件

- [ ] `#### 本章での適用` が章本文とは別のファイルに置かれ、章の行数の天井に算入されない
- [ ] 切り出し後も確定済み章の保護 (`guard-confirmed-chapter-overwrite.py`) が効く
- [ ] compile 後の文書から適用メモが消えていない

## 検証方法

- 自動検証: `python3 .claude/plugins/system-spec-harness/scripts/validate-coverage-matrix.py --require-complete --require-foundation`
- 手動検証: compile 後の章を読み、適用メモへの導線が切れていないことを確かめる
- 証跡: compile の出力差分

## リスクとロールバック

- リスク: 参照経路を直し忘れると、適用メモが誰にも読まれないまま残る
- ロールバック: 移設は文書の移動なので、戻せば元に戻る

## Handoff

- 実装 route: human。次に利用するノード: なし (仕様章の保守作業)
