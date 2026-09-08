---
graph_node_id: "task-article-breadcrumb-parent-not-linked"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up","ux"]
priority: "low"
start_date: null
target_date: null
iteration: null
title: "記事ページのパンくずの親がリンクでない（種類の索引ページが無い）"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-reader-feedback-widget-missing"]
resource_scope: ["src/presentation/site","src/app/s"]
purpose: null
goal: null
mvp_alignment: {"background":"article-page.tsx が trail の親に path を渡していないのは、種類の索引ページが 1 つも存在しないため。ah-kreb の作業中に、public-site-lifecycle が待っていた 記事一覧 リンクが実在しないことから判明した","mvp_fit":"deferred","purpose":"記事を読み終えた読者が、同じ種類の記事の一覧へ 1 手で戻れるようにする","rationale":"おすすめ順位 と書いてあるのに押せないのは、無いより悪い。読者は押せると思って押す"}
scope_in: ["記事ページのパンくずの真ん中の階を、押せるようにするか出さないかを決める","種類の索引ページ（/s/<site>/best 等）を作るかどうかの判断","決めた結論を E2E で見張る"]
scope_out: ["articleHref が決める正名を 2 つに増やすこと","パンくずの見た目だけを変えて行き先の話を先送りすること"]
acceptance: ["記事ページのパンくずの真ん中の階が、押せるか・出ないかのどちらかになっている","「押せるように見えて押せない」状態が残っていない","決めた理由が実装のそばに書かれている","E2E がその結論を見張っている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-article-breadcrumb-parent-not-linked.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while fixing ah-kreb"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-article-breadcrumb-parent-not-linked.md","confidence":0.9}]
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

記事を読み終えた読者が、同じ種類の記事の一覧へ 1 手で戻れるようにする。

## 背景

**赤い検査は無い。**ah-kreb の途中で見つけた、検査が無いまま残っている穴である。

記事ページのパンくずは 3 階建てで、真ん中の階が**文字のまま**になっている:

```
E2E 公開ライフサイクル desktop  /  おすすめ順位  /  E2E 公開記事 desktop
        ↑ リンク                    ↑ ただの文字      ↑ ただの文字
```

`src/presentation/site/article-page.tsx` が `trail={[{ label: routeLabel }, …]}` と
`path` を渡していないためで、これは**そもそも行き先が無い**からである。
記事の正名は種類ごとの入口（`/best/<slug>`・`/reviews/<slug>`・`/compare/<slug>`・
`/guides/<slug>`・`/tools/<slug>`）だが、`src/app/s/[site]` に `best/[topic]` は
あっても `best/page.tsx` は無い。**種類の索引ページが 1 つも無い。**

`/s/<site>/blog` は全記事の一覧で、種類では絞られていない。
ヘッダーの案内も トップ・カテゴリー・探す だけで、記事一覧への口が無い。

つまり読者が記事から出る道は「トップへ戻る」か「カテゴリーへ行く」しかない。
`おすすめ順位` と書いてあるのに押せないのは、無いより悪い（押せると思って押す）。

2026-09-05 まで `public-site-lifecycle.spec.ts` が
`記事一覧 → /blog` のリンクを待っていたが、これは記事が `/blog/<slug>` で
描かれていた頃の名残で、手前の一覧が落ちていたため誰も気づいていなかった。
今はパンくずの「ブログ名 → トップ」を見張る形へ直してある。

## 入力と前提条件

- 入力: 記事ページのパンくずの真ん中の階と、`PATH_PREFIX` の 5 種類
- 前提: **文字のまま置いて「これで良い」と決めない。**
  押せないラベルを残すか、行き先を作るか、ラベルごと外すかの 3 択を決める

## 出力と成果物

- 更新対象: `src/presentation/site/article-page.tsx`、必要なら
  `src/app/s/[site]/{best,reviews,compare,guides,tools}/page.tsx`
- 期待: 記事から同じ種類の一覧へ 1 手で戻れる。または戻り先が無いことを
  読者に見せない形にする

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: パンくずの真ん中の階の扱いを決める
- Backend/API: 種類の索引を作るなら、種類で絞る読み口が要る（調査後に決まる）
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「なぜこの階が押せる／押せないのか」を実装のそばに残す

## Write scope と競合制約

- `touches`: src/presentation/site src/app/s
- 排他資源: なし
- 並列実行条件: `article-page.tsx` を触る task と同時に走らせない
- branch: devgraph/task-article-breadcrumb-parent-not-linked
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-article-breadcrumb-parent-not-linked` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 記事ページを開き、パンくずの真ん中の階を実際に押してみる
2. 5 種類それぞれに索引ページを作る価値があるかを、読者の道筋から決める
3. 作らないなら、押せないラベルを残す理由を書くか、ラベル自体を見直す
4. 作るなら、`/s/<site>/blog` との重複（全件 vs 種類別）の線引きを決める
5. パンくずの検査を `public-site-lifecycle.spec.ts` に足す

## 受入条件

- [ ] 記事ページのパンくずの真ん中の階が、押せるか・出ないかのどちらかになっている
- [ ] 「押せるように見えて押せない」状態が残っていない
- [ ] 決めた理由が実装のそばに書かれている
- [ ] E2E がその結論を見張っている（人の目視だけで終わらせない）

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 記事ページからパンくずで上へ戻れるかを実際に押して見る
- 証跡: E2E の実行ログと、パンくずの DOM

## リスクとロールバック

- リスク: 種類の索引を作ると `/s/<site>/blog` と役割が重なり、
  同じ記事に入口が 2 つできる（`articleHref` が正名を 1 つに決めている趣旨に反する）
- リスク: ラベルだけ外すと、読者は今どの種類の記事を読んでいるか分からなくなる
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
