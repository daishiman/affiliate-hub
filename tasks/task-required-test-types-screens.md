---
graph_node_id: "task-required-test-types-screens"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "medium"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "必須テスト種別を宣言する（画面（ブログ層IA・主要画面・見た目） 32 件）"
owners: ["daishiman"]
created_at: "2026-08-17T22:00:00Z"
updated_at: "2026-08-17T22:00:00Z"
status: "draft"
depends_on: ["task-test-type-coverage"]
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"240 要件のうち必須テスト種別を宣言できているのは 12 件だけで、画面（ブログ層IA・主要画面・見た目）の 32 件は未宣言のまま","mvp_fit":"enabling","purpose":"画面（ブログ層IA・主要画面・見た目）の 32 件について、必要なテスト種別を 1 件ずつ決める","rationale":"種別を決めないとテストは書きやすいところから書かれ、権限のできてはいけない側・禁止された状態遷移・障害注入が永久に残る"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-required-test-types-screens.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T22:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/required-test-types-report.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "残課題 45（未宣言 228 件）を、着手できる文脈ごとの単位へ分割したもの"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-required-test-types-screens.md","confidence":0.95}]
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

**画面（ブログ層IA・主要画面・見た目）**の要件 32 件について、
`docs/product/required-test-types.md` に**必要なテスト種別を宣言する**。

## 背景

宣言の仕組み（書き方・機械での確認・CI で落とす門）は 2026-08-17 に完成している
（`task-test-type-coverage`）。**できていないのは適用のほうで、240 件のうち宣言済は 12 件だけ**である。

未宣言 228 件を 1 つの課題に置くと、大きすぎて永久に着手されない。
そこで**文脈ごと**に分けた。この課題はそのうちの 1 つで、32 件だけを見ればよい。

種別を決めないと何が起きるかを書いておく。テストは**書きやすいところから書かれる**。
結果として、権限の「できてはいけない側」・禁止された状態遷移・外部接続の障害注入は
最後まで書かれないまま、カバレッジだけが上がる。
先に「この要件にはこの種別が要る」と決めておくことでのみ、この偏りは止まる。

## 入力と前提条件

- `task-test-type-coverage`（仕組み側）が済んでいること
- `docs/product/required-test-types-report.md` の「未宣言の要件」一覧

## 出力と成果物

対象の要件 32 件（**画面（ブログ層IA・主要画面・見た目）**）:

`REQ-B01` `REQ-B02` `REQ-B03` `REQ-B04` `REQ-B05` `REQ-B06` `REQ-B07` `REQ-B08` `REQ-B09` `REQ-B10` `REQ-B11` `REQ-B12` `REQ-B13` `REQ-B14` `REQ-B15` `REQ-B16` `REQ-B17` `REQ-B18` `REQ-S01` `REQ-S02` `REQ-S03` `REQ-S04` `REQ-S05` `REQ-S06` `REQ-S07` `REQ-S08` `REQ-S09` `REQ-S10` `REQ-TH02` `REQ-TH03` `REQ-TH04` `REQ-TH05`

各要件について、次のどちらかが `docs/product/required-test-types.md` にある状態にする。

1. 性質の宣言（`has-input` / `has-state` / `has-permission` / `has-tenant` /
   `has-external` / `has-screen` / `has-calculation` / `has-ai-text`）
2. 満たせない種別の**理由つき除外**。理由は 2 つだけ許される
   （対象が存在しない / 対象がまだスタブ）。`docs/spec/10-テスト戦略仕様.md` §14-2

## 依存関係

`task-test-type-coverage`（仕組み）の後。ほかの `task-required-test-types-*` とは
**独立**で、どれから着手してもよい（触る宣言行が要件ごとに分かれているため衝突しない）。

## 実装対象

- `docs/product/required-test-types.md`（宣言の正本）
- `quality-gates.config.mjs` の `TEST_TYPES_MAX_UNDECLARED`（**減らす方向にのみ**動かす）
- 足りない種別を埋める `tests/` 各所

## Write scope と競合制約

`docs/` / `tests/` と `quality-gates.config.mjs` の上限 1 行。
上限の行は全ての `task-required-test-types-*` が触るため、**同時に 2 つ着手しない**。

## GitHub publication

`local_only`。

## 実行手順

1. 対象 32 件を 1 件ずつ**中身を読んで**、性質を決める
2. 宣言を `docs/product/required-test-types.md` に書く
3. `node scripts/required-test-types.mjs` を走らせる
4. `TEST_TYPES_MAX_UNDECLARED` を**減った実測値まで下げる**
5. 満たせない種別は理由を書いて除外する

## 受入条件

- 対象 32 件すべてに、宣言か理由つき除外がある
- `node scripts/required-test-types.mjs` が緑
- `TEST_TYPES_MAX_UNDECLARED` が 32 件ぶん下がっている

## 検証方法

宣言した要件から必須種別の印を 1 つ外し、`node scripts/required-test-types.mjs` が
**終了コード 1 で落ちる**ことを実測する。戻して緑になることも確認する。

## リスクとロールバック

文書と宣言の追加が中心で、既存のテストは消さない。
戻すときは宣言を消し、`TEST_TYPES_MAX_UNDECLARED` を元の値に戻す。

## リスク: 数だけ減らすこと（この課題で最も起きやすい失敗）

- **`TEST_TYPES_MAX_UNDECLARED` を上げて緑にすることを禁じる。** 上限は減る方向にしか動かさない。
- **中身を読まずに機械的に性質を付けて回ることを禁じる。** 印だけ付けば数字は減るが、
  そのとき検査は「印が付いているか」しか見ていない。減った数がそのまま嘘になる。
- 除外を増やして満たしたことにしない（除外にも上限 `TEST_TYPES_MAX_EXCLUSIONS` がある）。

## Handoff

埋まらなかった種別は理由つき除外として残し、**状態を偽らない**。
除外に回した件数を、次に着手する人へ数で伝える。

## 規範

- `docs/spec/10-テスト戦略仕様.md` §14
- `docs/product/required-test-types.md`（宣言の正本）
- `docs/product/required-test-types-report.md`（自動生成。手で編集しない）
- 残課題リスト 項目 45
