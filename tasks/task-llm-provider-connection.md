---
graph_node_id: "task-llm-provider-connection"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["generation","security"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "生成 AI の提供元を選び、鍵を登録して下書きを 1 本作らせる"
owners: ["daishiman"]
created_at: "2026-08-17T23:30:00Z"
updated_at: "2026-08-17T23:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["infrastructure","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"プロンプト・スキル・サブエージェント・評価セット・出力契約はすべて実装済だが、実際に問い合わせる先が無い","mvp_fit":"direct","purpose":"素材を渡すと下書きが 1 本できる状態にする","rationale":"ここが繋がるまで、生成基盤は一度も本物の応答を受け取っていない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-provider-connection.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/traceability.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "仕組みは揃っており、残っているのは提供元の選定と鍵の登録という利用者側の判断と操作"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-provider-connection.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

素材を渡すと**下書きが 1 本できる**状態にする（REQ-G11）。

## 背景

生成の仕組みはすべて揃っている。プロンプトの版管理と注入対策、
スキル 8 種、サブエージェント 6 種（執筆系と検証系を分離）、
出力契約の JSON Schema、評価用の題材一覧。

**繋がっていないのは「問い合わせる先」だけ**である。
提供元を選び、鍵を登録すれば動く。

## 入力と前提条件

- 提供元の選定（費用と、扱う文章の預け先としての可否）
- 鍵の登録。**AI が読めるファイルやコマンドラインには置かない**

## 出力と成果物

- 素材から下書きが 1 本できる
- 1 回あたりの費用が記録に残る

## 依存関係

なし（仕組みは揃っている）。

## 実装対象

- `src/infrastructure/` の生成ポートの実装
- 費用の記録（既存の計測に合わせる）

## Write scope と競合制約

`src/infrastructure/` と `docs/`。

## GitHub publication

`local_only`。

## 実行手順

1. 提供元を決める（費用・預け先・応答の速さ）
2. 利用者本人が `wrangler secret put` で鍵を登録する（**代行しない**）
3. ポートの実装をつなぐ
4. 上限を先に入れる。**問い合わせる仕組みより先に上限を作る**
5. 下書きを 1 本作らせて、出力契約どおりの形で返ることを見る

## 受入条件

- 素材から下書きが 1 本できる
- 鍵がリポジトリの中のファイル・コミット・実行ログのどこにも出ていない
- 1 回あたりの費用が記録に残る
- 上限に達したら止まる

## 検証方法

`pnpm run preview` で実際に 1 本作らせ、出力契約に沿った形で返ることと、
費用が記録に出ることを見る。

## リスクとロールバック

従量課金なので、上限を後から足す設計にしない（4 の順序）。
止めるときはポートの実装を見本へ戻せばよい。

## Handoff

**鍵をこちらへ渡さないこと。** 渡した時点でファイルや実行履歴に残り、
消したつもりでも残り続ける。

## 規範

- `docs/product/traceability.md` REQ-G11
- `quality-gates.config.mjs` の `AI_EVAL_BUDGET`（上限の置き方の先例）
