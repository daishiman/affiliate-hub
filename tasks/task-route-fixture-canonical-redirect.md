---
graph_node_id: "task-route-fixture-canonical-redirect"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "testing"
tags: ["e2e","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "route fixture の割り当てが正規 URL 転送と食い違う (E2E 5 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests/ui/route-table.ts","tests/ui/route-cases.ts"]
purpose: null
goal: null
mvp_alignment: {"background":"/s/…/blog/chairs-for-long-hours は /best/… へ、/s/…/profile は /operator へ、/admin/blog/pages は /admin/sites/<site>/documents へ着く。転送はいずれも正しく、合っていないのは tests/ui/route-table.ts の fixture の割り当て","mvp_fit":"deferred","purpose":"E2E の route fixture を、実装が返す正規 URL と一致させる","rationale":"転送側を止めれば正規 URL が壊れる。直すのは fixture の側で、しかし「転送されたから合格」にすると入口の消失を見逃す"}
scope_in: ["blog 入口に ranking 記事を割り当てている fixture の是正","[fixedPage] の別名の是正","admin/blog/pages の redirectOnly 扱いの判定"]
scope_out: ["到達判定を「転送先でも可」に緩めること"]
acceptance: ["`ではなく … に着きました` が 0 件","到達判定そのものは緩めていない","転送が正しいことを確かめた根拠が書かれている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-route-fixture-canonical-redirect.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while triaging the E2E red set"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-route-fixture-canonical-redirect.md","confidence":0.9}]
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

E2E の route fixture を、実装が返す正規 URL と一致させる。

## 背景

到達判定が 5 件赤い。実文言:

```
/s/home-office-desk/blog/chairs-for-long-hours ではなく
  /s/home-office-desk/best/chairs-for-long-hours に着きました
/s/home-office-desk/profile ではなく /s/home-office-desk/operator に着きました
/admin/blog/pages ではなく /admin/sites/home-office-desk/documents に着きました
```

**転送はいずれも正しい。**記事は種類（ranking / review / comparison / guide）
ごとに正規の入口を持ち、`chairs-for-long-hours` は ranking なので `/best/` が正名である。
固定ページも同じで、`profile` は `operator` の別名らしい。

合っていないのは `tests/ui/route-table.ts` の fixture の割り当てで、
`blog` 入口に ranking の記事を、`[fixedPage]` に転送される側の名前を置いている。

`admin/blog/pages` は別種で、この route 自体が転送専用の入口である可能性がある
（`route-cases.ts` は `redirectOnly` という扱いを持っている）。3 件を同じ直し方で
片付けず、1 件ずつどちらの側の誤りかを決めること。

## 入力と前提条件

- 入力: 上記 5 件（desktop/mobile 分を含む）
- 前提: **到達判定を「転送先でも可」に緩めない。**
  この判定は「入口が黙って消えていないか」を見ており、緩めると
  入口を 1 つ消した日に誰も気づかなくなる

## 出力と成果物

- 更新対象: `tests/ui/route-table.ts` の fixture、必要なら `tests/ui/route-cases.ts` の
  `redirectOnly` の宣言
- 期待: 5 件が 0 件になり、判定そのものは変わっていない

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A（実装は正しい前提。誤りが実装側だと分かったらそこで判断を戻す）
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「なぜこの slug をこの入口に割り当てるか」を fixture に一言残す

## Write scope と競合制約

- `touches`: tests/ui/route-table.ts tests/ui/route-cases.ts
- 排他資源: なし
- 並列実行条件: `route-cases.ts` を触る task と同時に走らせない
- branch: devgraph/task-route-fixture-canonical-redirect
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-route-fixture-canonical-redirect` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 記事の種類から正規の入口を決めている実装を読み、転送が正しいことを確かめる
2. `blog` 入口に割り当てるべき slug（種類が `article` のもの）を見本から選び直す
3. `[fixedPage]` の正名を確かめて fixture を直す
4. `admin/blog/pages` が転送専用の入口かを判定し、そうなら `redirectOnly` を宣言する
5. `pnpm run test:e2e` で 5 件が消えることを確かめる

## 受入条件

- [ ] `ではなく … に着きました` が 0 件
- [ ] 到達判定そのものを緩めていない（転送先での合格を許していない）
- [ ] 転送が正しいことを実装から確かめた根拠が書かれている

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 各 URL を開いて着いた先を見る
- 証跡: E2E の実行ログ（修正前 5 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 3 件を同じ直し方で片付けると、実装側の誤りが 1 件混ざっていたときに隠れる
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
