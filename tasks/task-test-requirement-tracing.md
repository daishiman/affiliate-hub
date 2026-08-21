---
graph_node_id: "task-test-requirement-tracing"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "由来不明のテスト 39 件を、要件から辿れる形にする"
owners: ["daishiman"]
created_at: "2026-08-17T12:00:00Z"
updated_at: "2026-08-17T12:00:00Z"
status: "draft"
depends_on: ["task-mutation-property-testing"]
related_nodes: []
resource_scope: ["tests","docs/product/traceability.md"]
purpose: null
goal: null
mvp_alignment: {"background":"2026-08-17 の実測で、テスト 115 ファイル中 39 ファイルが、要件表の行にも @req 印にも出てこない。上限として固定したので増えはしないが、減ってもいない","mvp_fit":"enabling","purpose":"実装をなぞって書いたテストを減らす","rationale":"由来の無いテストは「実装がそうなっているから、そう書いた」という循環で、実装が間違っていても緑になる。機械的に @req を付けて回ると検査そのものが無意味になるため、1 件ずつ由来を確かめて減らす"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-requirement-tracing.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T12:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/spec/10-テスト戦略仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "テストと要件の対応の実測から出た残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-requirement-tracing.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

由来不明のテストを、**どの要件のために書いたのか辿れる形**にする。

## 背景

2026-08-17 の実測で、テスト 115 ファイルのうち 39 ファイルが、
`docs/product/traceability.md` の要件行にも `@req` 印にも出てこない。

由来の無いテストは「実装がそうなっているから、そう書いた」という循環で、
**実装が間違っていても緑になる**。上限（`TRACEABILITY_MAX_UNLINKED`）を
実測に置いたので増えはしないが、減ってもいない。

## 入力と前提条件

- `docs/product/test-traceability.md`（自動生成。由来不明の一覧が載る）
- 要件 ID の正本は `docs/product/traceability.md`
- 印の書き方は `/** @tier 1 @req REQ-P04, REQ-B03 */`

## 出力と成果物

- 39 件それぞれに `@req` 印、または要件表の行への追記
- 減った実測に合わせて `TRACEABILITY_MAX_UNLINKED` を下げる
- 要件表に無いテストは、要件側の欠落として起票する

## 依存関係

`task-mutation-property-testing`（検査の仕組みそのもの）に依存する。

## 実装対象

`docs/product/test-traceability.md` の「由来不明のテスト」節に列挙された 39 ファイル。
`tests/architecture/` や `tests/support/` のように、要件ではなく**規律**を守っている
テストも含まれる。その場合は要件表側に規律の行（REQ-TS 系）を足すのが正しい。

## Write scope と競合制約

`tests/` のヘッダ行、`docs/product/traceability.md`、`quality-gates.config.mjs` の上限。
テストの中身は変えない。

## GitHub publication

`local_only`。

## 実行手順

1. 1 ファイル選び、**中身を読んで**何を確かめているかを 1 文にする
2. その 1 文に当たる要件を要件表から探す
3. あれば `@req` を書く。無ければ要件表側の欠落なので、要件行を足すか起票する
4. 数件ごとに `node scripts/traceability.mjs` を走らせ、上限を実測まで下げる

## 受入条件

- 由来不明が 0 件、または残った件数の理由が書かれている
- `TRACEABILITY_MAX_UNLINKED` が実測まで下がっている
- **上限を上げていない**

## 検証方法

`node scripts/traceability.mjs` の出力。上限を 1 下げて赤くなることも確かめる。

## リスクとロールバック

最大のリスクは、**由来を確かめずに `@req` を機械的に書いて回る**こと。
そうすると件数だけ 0 になり、検査は無意味になる。
だから 1 件ずつ中身を読む手順（実行手順 1）を外さない。
テストの中身を変えないので、本番の動きへの影響は無い。

## Handoff

済んだら `docs/spec/10-テスト戦略仕様.md` §12-2 の実測値を更新する。
