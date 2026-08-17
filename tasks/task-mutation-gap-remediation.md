---
graph_node_id: "task-mutation-gap-remediation"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "ミューテーションで見えた穴を埋める（テストが無い 10 モジュール・確かめが浅い 7 モジュール）"
owners: ["daishiman"]
created_at: "2026-08-17T12:00:00Z"
updated_at: "2026-08-17T12:00:00Z"
status: "draft"
depends_on: ["task-mutation-property-testing"]
related_nodes: []
resource_scope: ["tests","src/application/usecases","src/domain"]
purpose: null
goal: null
mvp_alignment: {"background":"2026-08-17 の実測は 67.20%。生き残り 2,383 のうち 906 は「テストファイルが 1 つも無い」モジュールで、上位 10 件だけで 515 変異を占める。別枠で draft-instructions.ts は 5.6%（テストはあるのに、ほとんど何も確かめていない）","mvp_fit":"enabling","purpose":"生き残った変異を、下限を下げずにテストで潰す","rationale":"1 ファイルに 1 本足すだけで数十の変異が動くため、この時点で最も費用対効果が高い。内訳は docs/product/mutation.md §4"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-mutation-gap-remediation.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T12:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/mutation.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "ミューテーションの実測から出た残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-mutation-gap-remediation.md","confidence":0.95}]
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

ミューテーションの実測で生き残った変異を、**下限を下げずに**テストで潰す。

## 背景

2026-08-17 の実測は 67.20%（domain + application、static 除外、10,028 変異）。
生き残りには性質の違う 2 種類がある（`docs/product/mutation.md` §4）。

- **テストファイルが 1 つも無い: 906 変異。** 上位 10 モジュールだけで 515 変異
- **テストはあるが確かめが浅い。** `draft-instructions.ts` は 5.6%

前者は弱いのではなく存在しない。1 ファイルに 1 本足すだけで数十の変異が動くため、
この時点で最も費用対効果が高い。

## 入力と前提条件

- `docs/product/mutation.md` §4-1 / §4-2 の一覧（変異数つき）
- `node scripts/mutation.mjs --report-only` で手元の報告書を読み直せる
- 下限は `quality-gates.config.mjs` の `MUTATION_SCORE.break`（65%）

## 出力と成果物

- テストが無い 10 モジュールに、それぞれ 1 本以上のテスト
- `draft-instructions.ts` / `output-contract.ts` / `site-draft.ts` の確かめを深くする
- 上がった実測を `docs/product/mutation.md` §1 と §9 の表へ反映し、下限を追随させる

## 依存関係

`task-mutation-property-testing`（測る仕組みそのもの）に依存する。

## 実装対象

| 変異 | モジュール |
| --- | --- |
| 96 | `src/application/usecases/analytics/read-metrics.ts` |
| 83 | `src/application/usecases/site/manage-sites.ts` |
| 72 | `src/application/usecases/improvement/list-improvement-dimensions.ts` |
| 67 | `src/application/usecases/generation/read-generation-plan.ts` |
| 44 | `src/application/usecases/analytics/ai-usage-report.ts` |
| 44 | `src/application/usecases/ranking/rank-products.ts` |
| 35 | `src/application/usecases/analytics/explain-telemetry.ts` |
| 32 | `src/application/usecases/analytics/record-telemetry.ts` |
| 21 | `src/domain/monetization/affiliate-program.ts` |
| 21 | `src/domain/product/product.ts` |

確かめが浅い側は `quality-check.ts` / `build-site.ts` / `publish-article.ts` /
`site-draft.ts` / `draft-instructions.ts` / `output-contract.ts` / `filter-metrics.ts`。

## Write scope と競合制約

`tests/` と、テストを書くために必要な範囲の `src/`。実装の意味は変えない。

## GitHub publication

`local_only`。PR は既存の作業ブランチに載せる。

## 実行手順

1. 対象モジュールの要件 ID を `docs/product/traceability.md` から引く
2. 要件から期待値を書く（実装を読んでから期待値を決めない）
3. `node scripts/mutation.mjs --changed` で、そのファイルの変異が倒れたか確かめる
4. 倒れない変異が残ったら、何が見られていないのかを 1 行で書いてから足す

## 受入条件

- テストが無い 10 モジュールが 0 件になる
- 実測スコアが 67.20% を下回らない
- **下限を下げていない**（下げた場合は `docs/product/mutation.md` §9 に理由と日付）

## 検証方法

`node scripts/mutation.mjs`（全体・16 分前後）の実測。数字は報告書から読む。

## リスクとロールバック

テストを足すだけなので本番の動きは変わらない。
リスクは「変異を倒すためだけのテスト」を書いてしまうことで、
その場合カバレッジもスコアも上がるが仕様は何も守られない。
要件 ID を先に引く手順（実行手順 1）はそのための予防である。

## Handoff

済んだら `docs/product/mutation.md` の実測表と `docs/product/backlog.md` を更新する。
