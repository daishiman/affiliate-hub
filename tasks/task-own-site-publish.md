---
graph_node_id: "task-own-site-publish"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "distribution"
tags: ["backlog","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "自社サイトへの公開を本物にする（published_articles と own_site コネクタ）"
owners: ["daishiman"]
created_at: "2026-08-17T09:30:00Z"
updated_at: "2026-08-17T09:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/db","src/infrastructure/persistence","src/infrastructure/channels","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"own_site コネクタが「記事の保存先を D1 につなぐことが必要」で止まっており、PublishedContentPort も見本のまま。記事を承認して配信を予約しても、読者ページには何も出ない","mvp_fit":"direct","purpose":"書いた記事が、公開の操作のあとに実際の読者ページへ出るようにする","rationale":"項目 37・38・39 と同じ「入口と保存先の片方しか無い」形の最後の 1 つ。ここがつながると 書く→承認→予約→公開→読者が読む が初めて 1 周する。自社サイトなので外部サービスの資格が要らない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-own-site-publish.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T09:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/stub-ledger.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "docs/product/stub-ledger.md のスタブ解除を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-own-site-publish.md","confidence":0.95}]
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

書いた記事が、公開の操作のあとに実際の読者ページへ出るようにする。

## 背景

記事を承認して配信を予約しても、読者向けのページには何も出ない。
`own_site` のコネクタが「記事の保存先 (content:*) を D1 につなぐことが必要」で
止まっており、読者ページが読む `PublishedContentPort` も見本データのままだから。

項目 37（配信の予約）・38（記事の進行）・39（成果の金額）と同じ
「入口と保存先の片方しか無い」形で、残っている最後の 1 つ。
ここがつながると **書く → 承認 → 予約 → 公開 → 読者が読む** が初めて 1 周する。

外部サービスの資格が要らない（自社サイトなので ASP や SNS の申請が無い）ため、
いま着手できる。

## 入力と前提条件

- `publications` は D1 に保存済み（項目 37）
- 記事の段階（進行）は D1 に保存済み（項目 38）
- 読者向けページ `src/app/s/[site]/` は既にある

## 出力と成果物

- `published_articles` 表とマイグレーション
- `own_site` コネクタの本実装（公開・取りやめ）
- `PublishedContentPort` の D1 実装（見本と重ねる）
- 本物の D1 を使う結合テスト

## 依存関係

無し（この作業単体で完結する）。

## 実装対象

- `src/db/schema.ts`
- `drizzle/`
- `src/infrastructure/channels/channel-registry.ts`
- `src/infrastructure/persistence/d1/`
- `src/infrastructure/composition.ts`

## Write scope と競合制約

`src/db` / `src/infrastructure/persistence` / `src/infrastructure/channels` / `drizzle`。
他の作業単位と同時に触らない。

## GitHub publication

`local_only`。PR は `feat/clean-architecture-skeleton` にまとめる。

## 実行手順

1. 読者ページが実際に読んでいる形を確かめる
2. 先にテストを書く（本物の D1 と本物のマイグレーション）
3. 表とマイグレーションを足す
4. 読み口をつなぐ
5. コネクタの公開・取りやめを実装する
6. `pnpm run verify` と `pnpm run preview` で実測する

## 受入条件

- 公開したら読者ページに出る（読み直しで確認する）
- 取りやめたら読者ページから消える
- 見本は消えず、同じ id なら保存されたほうが勝つ
- `pnpm run verify` 6 検査すべて通過。**閾値は下げない**

## 検証方法

本物の D1 と本物のマイグレーションを使う結合テストで、返り値ではなく
読み直しにより確かめる。Workers ランタイム（`pnpm run preview`）で実測する。

## リスクとロールバック

表の追加のみで、既存の列を消さない。戻すときはマイグレーションを当てずに
1 つ前のコミットへ戻せばよい。

## Handoff

完了後は `docs/product/backlog.md` に項目を足し、台帳を再生成する。
