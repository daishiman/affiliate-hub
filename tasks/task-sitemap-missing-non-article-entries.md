---
graph_node_id: "task-sitemap-missing-non-article-entries"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["seo","sitemap","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "sitemap.xml に記事以外の入口が 1 つも載っていない"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/site","src/application/seo","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"seo-routes.ts の loadSeoSite は listRecent の記事だけを items にする。sitemapEntries はその写しなので、トップ・記事一覧・固定ページ 8 種・記事タイプの索引 5 本は 1 行も載らない","mvp_fit":"deferred","purpose":"検索と AI 検索に、記事だけでなくブログの骨格（どの入口がどの記事を束ねているか）を渡す","rationale":"ah-milz は押せないパンくずを直す範囲であって、sitemap の載せ方を決めるのは別の判断。どの入口を載せるかはブログごとの設定（出さないと決めた種類）に依存し、その線引きを決めないと存在しない URL を検索側へ渡す"}
scope_in: ["静的な入口をルート表（SITE_ROUTES / routesFor）から出して sitemap へ足す","そのブログで出さない入口を除く判定（routesFor が既に設定で絞っている）","入口の行数を SITEMAP_URL_LIMIT の数え方へ含める"]
scope_out: ["分割 sitemap（50,000 件超え）。いまは 503 で明示している","記事そのものの載せ方。こちらは既に公開 projection から出ている"]
acceptance: ["sitemap.xml に、公開されている静的な入口（トップ・記事一覧・記事タイプの索引・固定ページ）が載っている","そのブログで出さないと決めた入口は sitemap にも載らない（存在しない URL を検索側へ渡さない）","入口の行数も SITEMAP_URL_LIMIT の数え方に入っている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-sitemap-missing-non-article-entries.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing ah-milz"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-sitemap-missing-non-article-entries.md","confidence":0.9}]
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

検索と AI 検索に、記事だけでなく**ブログの骨格**を渡す。
どの入口がどの記事を束ねているかが、いま sitemap からは 1 行も分からない。

## 背景

**赤い検査は無い。**ah-milz（記事タイプの索引を作る作業）の途中で見つけた穴である。

`src/presentation/site/seo-routes.ts` の `loadSeoSite` は `listRecent` の
記事だけを `items` にする。`sitemapEntries` はその写しなので、
`sitemap.xml` に載るのは**記事だけ**になる:

- トップ `/s/<site>` — 載らない
- 記事一覧 `/s/<site>/blog` — 載らない
- 固定ページ 8 種（`/privacy`・`/terms` など） — 載らない
- 記事タイプの索引 5 本（`/best`・`/reviews`・`/compare`・`/guides`・`/tools`）
  — 2026-09-05 に作ったが、載らない

索引は記事へ渡すハブである。載せないと、検索側は記事のパンくずの階層を
各記事の `BreadcrumbList` からしか知れず、索引そのものは
「どこからも sitemap で示されていない URL」のままになる。

## 入力と前提条件

- 入力: `routesFor(blueprint)` が返す、そのブログで実際に出す route の一覧
- 前提: **全 route を機械的に流し込まない。** `routesFor` は設定で絞られた
  結果を返すが、記事が 1 本も無い索引を載せると空のページを検索側へ渡す

## 出力と成果物

- 更新対象: `src/presentation/site/seo-routes.ts`（`loadSeoSite` と `sitemapEntries`）、
  必要なら `src/application/seo/feeds.ts`
- 期待: 公開されている静的な入口が sitemap に並び、出さないと決めた入口は並ばない

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: sitemap の行の作り方
- Backend/API: N/A（読み口は `routesFor` が既にある）
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「なぜこの入口を載せる／載せないのか」を実装のそばに残す

## Write scope と競合制約

- `touches`: src/presentation/site src/application/seo
- 排他資源: なし
- 並列実行条件: `seo-routes.ts` を触る task と同時に走らせない
- branch: devgraph/task-sitemap-missing-non-article-entries
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-sitemap-missing-non-article-entries` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `sitemap.xml` を実際に開き、いま何行あるかを数える
2. `routesFor(blueprint)` の結果と突き合わせ、載っていない入口を数え上げる
3. 記事が 0 本の索引をどう扱うか決める（載せない／載せる）
4. `SITEMAP_URL_LIMIT` の数え方に入口ぶんを含める
5. 「入口が全部載っている」ことを見張る検査を足す（人の目視で終わらせない）

## 受入条件

- [ ] 公開されている静的な入口が `sitemap.xml` に載っている
- [ ] そのブログで出さないと決めた入口は載っていない
- [ ] 入口の行数も `SITEMAP_URL_LIMIT` の数え方に入っている
- [ ] 決めた理由が実装のそばに書かれている

## 検証方法

- 自動検証: `npx vitest run tests/presentation` と sitemap の検査
- 手動検証: `/s/<site>/sitemap.xml` を開いて入口の行を目で確かめる
- 証跡: sitemap の実出力

## リスクとロールバック

- リスク: 全 route を機械的に流し込むと、そのブログが出さない入口や
  記事 0 本の索引まで載り、検索側へ空の URL を渡す
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
