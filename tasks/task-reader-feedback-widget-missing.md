---
graph_node_id: "task-reader-feedback-widget-missing"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "読者の記事ページに評価 UI が出ない (E2E 10 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/site","src/presentation/ui"]
purpose: null
goal: null
mvp_alignment: {"background":"種データを直して記事は描けるようになった (h1 は可視) が、blog-ops-crud の読者側 2 件が評価 UI を待って時間切れになる。public-site-lifecycle も同じ画面で not found が出ている。ah-0d2q (改善要望の写し) が触っている当の UI","mvp_fit":"deferred","purpose":"公開記事ページで「この記事は役に立ちましたか」を出し、点を送れるようにする","rationale":"P08 は評価 UI の浮遊要素の扱いを整えたが、そもそも読者の記事ページに出ていない可能性がある。ここが出ないと feature の受入自体が確かめられない"}
scope_in: ["公開記事ページで評価 UI が描かれる条件の特定","描かれない場合の実装","public-site-lifecycle の not found 4 件との関係の切り分け"]
scope_out: ["E2E の待ち時間を伸ばして通すこと"]
acceptance: ["blog-ops-crud の読者側 2 件が通る","public-site-lifecycle の 2 件が通る","待ち時間の延長や skip で通していない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-reader-feedback-widget-missing.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while triaging the E2E red set"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-reader-feedback-widget-missing.md","confidence":0.9}]
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

公開記事ページで「この記事は役に立ちましたか」を出し、読者が点を送れるようにする。

## 背景

種データに公開投影を足して記事は描けるようになった。`h1` は可視になり、404 は
0 件になっている。ところがその次で止まる。実文言:

```
Error: locator.selectOption: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByLabel('この記事は役に立ちましたか')

  175 |     await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
> 177 |     await page.getByLabel("この記事は役に立ちましたか").selectOption("5");
```

`blog-ops-crud.spec.ts` の読者側 2 件（「公開済みの記事は読めて、点を付けられる」
「点を選ばずに送ると断られる」）と、`public-site-lifecycle.spec.ts` の 2 件、
および `element(s) not found` 4 件が同じ画面に集まっている。

**これは ah-0d2q（改善要望の写しから送信 UI 自身を外す）が触っている当の UI である。**
P08 はその浮遊要素の名乗りと重なり監査の共通化を整えたが、
**そもそも読者の記事ページに描かれていない可能性がある。**
ここが出ないと feature の受入自体が確かめられない。

記事が 404 だった間、この失敗は「記事に着けない」に埋もれていた。

## 入力と前提条件

- 入力: 上記の失敗 10 件と、`src/presentation/site` の記事ページの実装
- 前提: **E2E の待ち時間を伸ばして通さない。**
  45 秒待って現れないものは、遅いのではなく無い

## 出力と成果物

- 更新対象: 記事ページに評価 UI を出す箇所（`src/presentation/site`）
- 期待: 読者が記事を読み、点を付けて送れる。空のまま送ると断られる

## 依存関係

- `depends_on`: なし（ah-iu3u の種データ修正は完了済み）
- ブロッカー: なし

## 実装対象

- Frontend: 評価 UI が描かれる条件の特定と、描かれない場合の実装
- Backend/API: 送信先が無いなら確認する（調査後に決まる）
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「どの記事ページに出るのか」の線引きを残す

## Write scope と競合制約

- `touches`: src/presentation/site src/presentation/ui
- 排他資源: なし
- 並列実行条件: ah-0d2q の残 phase と同時に走らせない（同じ UI を触る）
- branch: devgraph/task-reader-feedback-widget-missing
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-reader-feedback-widget-missing` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `/s/home-office-desk/best/chairs-for-long-hours` を開き、
   評価 UI が DOM に有るかを実際に見る
2. 無いなら、記事ページのどこで描くはずだったかを実装から特定する
3. `public-site-lifecycle` の `element(s) not found` 4 件が同じ原因かを切り分ける
   （別原因なら分けて起票する）
4. 実装して `pnpm run test:e2e` で 10 件が消えることを確かめる

## 受入条件

- [ ] `blog-ops-crud` の読者側 2 件が通る
- [ ] `public-site-lifecycle` の 2 件が通る、または別原因として分けて起票されている
- [ ] 待ち時間の延長・skip・除外で通していない

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 実際に記事を開いて点を送り、空のまま送って断られることを見る
- 証跡: E2E の実行ログ（修正前 10 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 待ち時間を伸ばして通すと、無いものを「遅い」と誤って記録する
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
