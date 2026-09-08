---
graph_node_id: "task-article-toc-zero-hit-target"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "記事本文の目次リンクが実寸 0×0 (E2E 4 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/site","src/presentation/ui"]
purpose: null
goal: null
mvp_alignment: {"background":"種データに公開投影を足して記事が描けるようになり、初めて測れた指摘。差し込み待ち (waitForStreamedContent) は既に入っており、navLink の件とは別物","mvp_fit":"deferred","purpose":"記事の目次リンク（「結論」「どうやって比べたか」「選び方」）が押せる大きさを持つようにする","rationale":"404 で止まっていた間は「測っていないのに緑」だった。ここを緩めると、読者が最も使う導線が押せないまま残る"}
scope_in: ["記事本文の目次リンクが矩形を持たない条件の特定","実装と検査のどちらの誤りかの判定"]
scope_out: ["下限 44px (--tap-target-min) を下げること"]
acceptance: ["目次リンクの実寸が 0×0 でなくなる、または測らない線引きが理由付きで書かれている","下限 44px を下げていない","pending-hit-targets の該当 4 件が 0 件"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-article-toc-zero-hit-target.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while triaging the E2E red set"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-article-toc-zero-hit-target.md","confidence":0.9}]
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

記事本文の目次リンクが、宣言した下限どおりの押せる大きさを持つようにする。

## 背景

種データに公開投影（`published_articles`）を足して記事が描けるようになり、
**初めて測れるようになった指摘**である。実文言:

```
/s/home-office-desk/best/chairs-for-long-hours a.「結論」
  宣言44.0px / 実寸0.0×0.0px < 44.0px
/s/home-office-desk/best/chairs-for-long-hours a.「どうやって比べたか」 …
/s/home-office-desk/best/chairs-for-long-hours a.「選び方」 …
```

`/s/…/best/[topic]` と `/s/…/blog/[article]` の desktop/mobile で計 4 件。

**これは 2026-09-05 に直した `a.navLink` の 0×0 とは別物である。**
あちらは React の streaming SSR の差し込み前に測っていたのが原因で、
`tests/e2e/streamed-content.ts` の `waitForStreamedContent` は既にこの検査にも
入っている。待ってなお 0×0 なので、原因は別にある。

記事が 404 だった間、この画面は 1 度も測られていなかった。
**「測っていないのに緑」だった箇所が、種データを直した結果として見えた。**

## 入力と前提条件

- 入力: 上記 4 件の指摘と、そこに出る文言（記事内の見出しへ飛ぶ目次リンク）
- 前提: **下限 44px（`--tap-target-min`）を下げない。**
  読者が最も使う導線であり、押せないことの言い訳に検査を使わない

## 出力と成果物

- 更新対象: 記事本文の目次を描いている箇所（`src/presentation/site` 周り）、
  または測り方（どちらかは調査後に決まる）
- 期待: 目次リンクが実寸を持ち、44px 以上である

## 依存関係

- `depends_on`: なし
- ブロッカー: なし（種データの修正は完了済み: ah-iu3u）

## 実装対象

- Frontend: 目次リンクが矩形を持たない条件の特定
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「畳まれた目次を測らない」等の線引きをするなら理由を残す

## Write scope と競合制約

- `touches`: src/presentation/site src/presentation/ui
- 排他資源: なし
- 並列実行条件: `ui.module.css` を触る task と同時に走らせない
- branch: devgraph/task-article-toc-zero-hit-target
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-article-toc-zero-hit-target` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `/s/home-office-desk/best/chairs-for-long-hours` を開き、
   目次リンクの `getBoundingClientRect()` が 0 になる条件を実際に見る
2. 折り畳み・`details`・`position` のいずれで矩形が消えているかを特定する
3. **どちらの誤りかを決める** —
   (a) 実装の誤り: 開いているはずの目次が場所を持っていない → 実装を直す
   (b) 検査の誤り: 畳まれた状態で測っている → 開いてから測るか対象から外す
4. `pnpm run test:e2e` で 4 件が消えることを確かめる

## 受入条件

- [ ] 目次リンクの実寸が 0×0 でなくなる、または「測らない」線引きが理由付きで書かれている
- [ ] 下限 44px を下げていない
- [ ] `pending-hit-targets` の該当 4 件が 0 件

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 実際に記事を開き、目次を指で押せるか見る
- 証跡: E2E の実行ログ（修正前 4 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 「測れないから対象外」とすると、押せない目次が検査を素通りする
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
