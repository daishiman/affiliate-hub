---
graph_node_id: "task-admin-blog-articles-console-error"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "admin/blog/articles で 404 の console.error が出る (E2E 2 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation","src/app"]
purpose: null
goal: null
mvp_alignment: {"background":"`Failed to load resource: the server responded with a status of 404` が console.error に出る。画面自体は描けている","mvp_fit":"deferred","purpose":"記事一覧画面が読み込みに失敗している資源を突き止め、404 を消す","rationale":"console.error は握り潰されやすい。画面が出ているうちは気づかず、資源が要る場面で初めて壊れる"}
scope_in: ["404 になっている資源の特定と修正"]
scope_out: ["console.error の検査を除外表へ逃がすこと"]
acceptance: ["admin/blog/articles で console.error が 0 件","検査の側を緩めていない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-admin-blog-articles-console-error.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while triaging the E2E red set"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-admin-blog-articles-console-error.md","confidence":0.9}]
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

記事一覧画面（`/admin/blog/articles`）が読み込みに失敗している資源を突き止め、
404 を消す。

## 背景

`app-routes.spec.ts` が desktop/mobile の 2 件で赤い。実文言:

```
Error: console.error が出ています
+   "Failed to load resource: the server responded with a status of 404 (Not Found)",
```

**画面自体は描けている。**壊れているのは画面が引きに行った資源の側で、
どの URL が 404 なのかはこのログには出ていない。

console.error は握り潰されやすい。画面が出ているうちは誰も気づかず、
その資源が要る場面（画像・アイコン・追加読み込み）で初めて壊れる。

## 入力と前提条件

- 入力: 上記 2 件と、実際に開いたときの network の 404
- 前提: **console.error の検査を除外表へ逃がさない。**
  この検査は「画面は出ているが中で失敗している」を捕まえる唯一の網である

## 出力と成果物

- 更新対象: 404 になっている資源を参照している箇所（`src/presentation` または `src/app`）
- 期待: `/admin/blog/articles` の console.error が 0 件

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: 404 になっている参照の特定と修正
- Backend/API: 資源を返す経路が無いなら足す（調査後に決まる）
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: N/A

## Write scope と競合制約

- `touches`: src/presentation src/app
- 排他資源: なし
- 並列実行条件: なし
- branch: devgraph/task-admin-blog-articles-console-error
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-admin-blog-articles-console-error` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `pnpm dev` で `/admin/blog/articles` を開き、network で 404 の URL を確かめる
2. その URL を参照している箇所を特定する
3. 参照が誤りなら直し、資源が無いなら用意する
4. `pnpm run test:e2e -- app-routes` で 2 件が消えることを確かめる

## 受入条件

- [ ] `/admin/blog/articles` で console.error が 0 件
- [ ] 404 だった URL と、その原因が書かれている
- [ ] 検査の側を緩めていない

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 画面を開いて network に 404 が出ないことを見る
- 証跡: E2E の実行ログ（修正前 2 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 「画面は出ているから良い」として放置すると、資源が要る場面で壊れる
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
