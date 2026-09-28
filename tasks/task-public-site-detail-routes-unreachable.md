---
graph_node_id: "task-public-site-detail-routes-unreachable"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","seed-data","follow-up"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "公開サイトの詳細ページが種データで開けない (E2E 14 件の 404)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests/e2e","src/app/s"]
purpose: null
goal: null
mvp_alignment: {"background":"/s/{site}/blog/... や /experts/... が HTTP 404 で開けない (14 件)。加えて /profile を開くと /operator に着く。種データ不足とルート改名の 2 つの原因が混ざっている","mvp_fit":"deferred","purpose":"作った記事が本当に読者に届くことを E2E で言い切れるようにする","rationale":"検査を実装に合わせて書き換えると、意図しない改名を追認してしまう。どちらが正しいかを先に決める"}
scope_in: ["404 を種データ不足とルート改名へ分ける","/profile と /operator のどちらが正しいかの判断"]
scope_out: ["検査の URL を実装に合わせるだけの変更"]
acceptance: ["/s/{site}/... の詳細ページが全て HTTP 200 で開く","/profile と /operator のどちらが正しいかが決まり理由が書かれている","検査を実装に合わせただけの変更が無い"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-public-site-detail-routes-unreachable.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed from the P08 e2e run"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-public-site-detail-routes-unreachable.md","confidence":0.9}]
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

公開サイト側の詳細ページが種データで開けない状態を解き、
「作った記事が本当に読者に届く」を E2E で言い切れるようにする。

## 背景

`pnpm run test:e2e` の `app-routes.spec.ts` で、公開サイト `/s/{site}/...` の
詳細ページが開けない失敗が出ている。実文言:

```
Error: HTTP 404 でした                                      … 14 件
Error: /s/home-office-desk/blog/chairs-for-long-hours に到達できません
Error: /s/home-office-desk/experts/sakuma に到達できません
Error: /s/home-office-desk/compare/ergo-one-vs-flexseat に到達できません
Error: /s/home-office-desk/guides/choosing-desk-lighting に到達できません
Error: /s/home-office-desk/profile ではなく /s/home-office-desk/operator に着きました
```

**2 つの別の原因が混ざっている。**

1. **種データが無い** — `chairs-for-long-hours` などの slug が D1 に存在せず、
   ルート自体は正しいが中身が無いので 404 になる
2. **ルートが改名された** — `/profile` を開くと `/operator` に着く。
   検査側が古い名前を持っているか、実装側が改名を告知せずに移した

この 2 つは直し方が正反対である。前者は種データを足す、後者は**どちらの名前が
正しいかを決めてから**片方を直す。混ぜて「とりあえず検査を実装に合わせる」と、
意図しない改名を追認してしまう。

## 入力と前提条件

- 入力: `app-routes.spec.ts` の route registry と、E2E が使う種データ
- 前提: **検査を実装に合わせて書き換えるのを既定にしない。** どちらが正しいかを
  先に決める

## 出力と成果物

- 更新対象: E2E の種データ（`tests/e2e/` の fixture / seed）、
  および必要なら `app-routes.spec.ts` の route registry
- 期待: `/s/{site}/...` の詳細ページが全て到達可能になる

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: `/profile` と `/operator` のどちらが正しい名前かを決める
- Backend/API: N/A
- Database/Data: E2E の種データに、検査が開こうとする slug を揃える
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 改名があったなら、いつ何を何へ変えたかを残す

## Write scope と競合制約

- `touches`: tests/e2e src/app/s
- 排他資源: E2E の種データ
- 並列実行条件: 種データを触る他 task と同時に走らせない
- branch: devgraph/task-public-site-detail-routes-unreachable
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-public-site-detail-routes-unreachable` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 14 件の 404 を「種データが無い」と「ルートが違う」へ分ける
2. 種データ不足は、E2E の seed に該当 slug を足す
3. `/profile` → `/operator` は git log で改名の経緯を辿り、**どちらが正しいかを決める**
4. `pnpm run test:e2e` で該当の赤が消えることを確かめる

## 受入条件

- [ ] `/s/{site}/...` の詳細ページが全て HTTP 200 で開く
- [ ] `/profile` と `/operator` のどちらが正しいかが決まり、理由が書かれている
- [ ] 検査を実装に合わせただけの変更が無い（あるなら、なぜ実装側が正しいかを書く）

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 開発環境で公開サイトの記事ページを実際に開く
- 証跡: E2E の実行ログ（修正前 14 件の 404 → 修正後 0 件）

## リスクとロールバック

- リスク: 検査側の URL を実装に合わせるだけで済ませると、意図しない改名を
  検査が追認する。以後その改名は誰にも見えなくなる
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
