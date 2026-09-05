---
graph_node_id: "feat-seo-aeo-machine-readable"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["seo","aeo","structured-data","schema-org","canonical","ogp","a11y"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "記事データからの機械可読要素生成"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T00:00:00Z"
status: "tombstoned"
closed_at: "2026-09-04T00:00:00Z"
depends_on: []
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["src","drizzle","system-spec","features/feat-seo-aeo-machine-readable.context.json"]
purpose: "構造化データ・canonical・OGP・robots・見出し階層・画像属性・広告 rel を、書き手が本文へ書き足す前提から外し、記事の実データから決定論的に導出する。人手に依存する限り、欠落は書き手ごとに揺れ、公開後まで残る。"
goal: "確定 decision dec-structured-data-emission (opt-render-time-derive) のとおり、記事の描画時に Article/BlogPosting・FAQPage・HowTo・Speakable・BreadcrumbList と canonical・OGP・robots max-image-preview が記事の実データから生成され、見出し階層・画像 alt/width/height・アフィリエイトリンクの rel が本文データそのものから機械的に決まる状態になっている"
scope_in: ["記事の実データ (見出し・本文ブロック・人物・商品・カテゴリ・公開日時) から Article/BlogPosting・BreadcrumbList・Person・Organization の JSON-LD を描画時に導出する","会話ブロック・手順ブロック・Q&A ブロックから FAQPage / HowTo / Speakable を導出し、該当ブロックが無い記事では当該種別を出さない (空の型を出して充足したと見せない)","canonical URL・OGP・robots max-image-preview をブログのドメイン戦略 (dec-blog-domain-strategy = opt-wildcard-subdomain) と整合する形で生成する","見出し階層の正規化 (本文外見出しを本文の H2/H3 系列へ混入させない)","画像の alt と width/height を画像登録時に必須化し、欠落画像を描画前に検出可能にする","アフィリエイトリンクへの rel (sponsored/nofollow) 付与を original_url 無改変のまま行う","schema.org 30.0 / Google 検索セントラル / WAI-ARIA 1.2 を出典とする判定根拠の参照レジストリ"]
scope_out: ["充足度の解析と管理画面への差し戻し (feat-seo-aeo-analysis-feedback)","読者面の目次・サイドバー・タグアイコンの配置 (feat-reference-blog-admin-ux)","管理画面の画面分割と共通部品化 (feat-uiux-overhaul)","外部順位データ・検索コンソール実測値の取り込み","記事本文そのものの生成 (feat-ai-content-studio)"]
acceptance: ["公開記事の HTML に Article/BlogPosting と BreadcrumbList の JSON-LD が記事実データ由来で含まれ、Rich Results 相当の必須プロパティ欠落が 0 件である","会話・手順・Q&A ブロックを持つ記事だけに FAQPage/HowTo/Speakable が出力され、持たない記事では当該型が出力されない","canonical が 1 記事 1 本で、サブドメイン戦略と一致し、重複 canonical が 0 件である","画像 alt と width/height を欠く画像は登録時に弾かれ、既存記事の欠落数が公開ページから機械的に数えられる","本文外見出しが本文の見出し階層へ混入せず、目次が同じ見出しを二重に読み上げない","アフィリエイトリンクに rel が付与され、original_url は 1 文字も改変されない","参考サイト実測 (hitodeblog.com/blog-money-sikumi: 画像 83 枚中 alt 有効 8 枚・FAQPage/HowTo/Speakable 不在) を、alt 被覆率と構造化データ種別数の 2 点で上回ることを機械が検証できる"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-seo-aeo-machine-readable.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"2e3b834654f7407de7a5408d25a79eda49a7e8a216f3abfb92748e0a039bb741","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"6c9b17fe84e10e0d2d01603fdd1c45c47bdcd75ecf4f1d34ed8ee00e6075f74a","source_path":"system-spec/frontend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.96
classification_reason: "撤回。実装コードと突き合わせた結果、本 feature の scope_in の大半が feat-blog-ui-builder で既に実装済みだった (src/application/seo/structured-data.ts の JSON-LD 導出、src/application/usecases/seo/manage-guideline-references.ts の出典レジストリ、src/application/seo/ai-search-audit.ts と publish-article.ts の公開時点検)。feature の scope 記述だけを見て未被覆と判断したのが誤り。真に未実装だった 3 項目 (HowTo/Speakable の JSON-LD・解析履歴の保持・定期再解析) は feat-seo-aeo-gap-closure へ移した。"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-seo-aeo-machine-readable.md","confidence":0.96}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

構造化データ・canonical・OGP・robots・見出し階層・画像属性・広告 rel を、書き手が本文へ書き足す前提から外し、記事の実データから決定論的に導出する。人手に依存する限り、欠落は書き手ごとに揺れ、公開後まで残る。

## 到達状態

確定 decision dec-structured-data-emission (opt-render-time-derive) のとおり、記事の描画時に Article/BlogPosting・FAQPage・HowTo・Speakable・BreadcrumbList と canonical・OGP・robots max-image-preview が記事の実データから生成され、見出し階層・画像 alt/width/height・アフィリエイトリンクの rel が本文データそのものから機械的に決まる状態になっている

## スコープ

### スコープ内

- 記事の実データ (見出し・本文ブロック・人物・商品・カテゴリ・公開日時) から Article/BlogPosting・BreadcrumbList・Person・Organization の JSON-LD を描画時に導出する
- 会話ブロック・手順ブロック・Q&A ブロックから FAQPage / HowTo / Speakable を導出し、該当ブロックが無い記事では当該種別を出さない (空の型を出して充足したと見せない)
- canonical URL・OGP・robots max-image-preview をブログのドメイン戦略 (dec-blog-domain-strategy = opt-wildcard-subdomain) と整合する形で生成する
- 見出し階層の正規化 (本文外見出しを本文の H2/H3 系列へ混入させない)
- 画像の alt と width/height を画像登録時に必須化し、欠落画像を描画前に検出可能にする
- アフィリエイトリンクへの rel (sponsored/nofollow) 付与を original_url 無改変のまま行う
- schema.org 30.0 / Google 検索セントラル / WAI-ARIA 1.2 を出典とする判定根拠の参照レジストリ

### スコープ外

- 充足度の解析と管理画面への差し戻し (feat-seo-aeo-analysis-feedback)
- 読者面の目次・サイドバー・タグアイコンの配置 (feat-reference-blog-admin-ux)
- 管理画面の画面分割と共通部品化 (feat-uiux-overhaul)
- 外部順位データ・検索コンソール実測値の取り込み
- 記事本文そのものの生成 (feat-ai-content-studio)

## 受入

- [ ] 公開記事の HTML に Article/BlogPosting と BreadcrumbList の JSON-LD が記事実データ由来で含まれ、Rich Results 相当の必須プロパティ欠落が 0 件である
- [ ] 会話・手順・Q&A ブロックを持つ記事だけに FAQPage/HowTo/Speakable が出力され、持たない記事では当該型が出力されない
- [ ] canonical が 1 記事 1 本で、サブドメイン戦略と一致し、重複 canonical が 0 件である
- [ ] 画像 alt と width/height を欠く画像は登録時に弾かれ、既存記事の欠落数が公開ページから機械的に数えられる
- [ ] 本文外見出しが本文の見出し階層へ混入せず、目次が同じ見出しを二重に読み上げない
- [ ] アフィリエイトリンクに rel が付与され、original_url は 1 文字も改変されない
- [ ] 参考サイト実測 (hitodeblog.com/blog-money-sikumi: 画像 83 枚中 alt 有効 8 枚・FAQPage/HowTo/Speakable 不在) を、alt 被覆率と構造化データ種別数の 2 点で上回ることを機械が検証できる

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 参照のみで内容は複製しない。仕様本文の正本は `system-spec/frontend.md` (digest `6c9b17fe84e10e0d`)。

## 機能間依存

- `depends_on`: `feat-blog-ops-crud`, `feat-blog-ui-builder`
- 依存理由: 記事データから機械可読要素を出す口 (feat-blog-ops-crud の記事 CRUD と feat-blog-ui-builder の描画) が先に無いと、導出先が存在しない。生成の対象になるデータと描画経路が確定してから被せる。

## Handoff

- per-feature planning: 機能間 depends_on が満たされた時点で `run-system-dev-plan` を起動する。人間の `/system-dev-plan` 実行結果も同じ登録経路 (graph_node_id + source_digest を冪等キー) で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-seo-aeo-machine-readable` と同一 `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 が全て done で、P07/P10/P11 の evidence が上の受入条件を満たしたときだけ feature を done にする。
