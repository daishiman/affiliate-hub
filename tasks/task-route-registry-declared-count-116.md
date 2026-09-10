---
graph_node_id: "task-route-registry-declared-count-116"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "route registry の宣言 111 と実在 116 のずれを内訳を確かめて直す"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests/e2e/app-routes.spec.ts"]
purpose: null
goal: null
mvp_alignment: {"background":"app-routes.spec.ts:247 が 111 を宣言しているが ALL_ROUTES は 116。ブログトップ画面変更で 5 枚増えた分","mvp_fit":"deferred","purpose":"画面の増減を見張る検査を、実在数と一致させたうえで生かし続ける","rationale":"数だけ書き換えると意図しない画面が紛れても緑になる。5 枚を 1 枚ずつ確かめてから宣言を直す"}
scope_in: ["増えた 5 枚の特定と出所の確認","宣言数と検査名の更新"]
scope_out: ["内訳を確かめずに数だけ書き換えること"]
acceptance: ["増えた 5 枚の内訳が列挙され出所が分かる","宣言数と検査名の数が実在数と一致する","内訳を確かめずに数だけ書き換えた形跡が無い"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-route-registry-declared-count-116.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed from the P08 e2e run"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-route-registry-declared-count-116.md","confidence":0.9}]
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

route registry が宣言する画面数（111）と、実際に存在する画面数（116）のずれを、
**増えた 5 画面を 1 枚ずつ確かめてから**解消する。

## 背景

`pnpm run test:e2e` の `app-routes.spec.ts:247` が落ちている。

```
expect(received).toHaveLength(expected)
  Expected length: 111
  Received length: 116
```

`ALL_ROUTES` は `page.tsx` を走査して集めた実在の画面で、これが 116。
検査が宣言している数は 111。今回のブログトップ画面変更で画面が 5 枚増えた分である。

**これは「上限を上げてゲートを緑にする」話ではない。**この検査は
「知らないうちに画面が増減していないか」を見張るもので、増えたのが意図した
5 枚なら宣言を 116 へ**直す**のが正しい。増えたのが意図しない画面なら、
消すのが正しい。**どちらかは 5 枚を目で見ないと決まらない。**

数だけ 116 へ書き換えると、意図しない画面が紛れていても検査は緑になる。
検査名（`route registryは111画面、signin確認済みを除く監査対象は110画面`）にも
数が埋め込まれているので、そこも合わせて直す。

## 入力と前提条件

- 入力: `ALL_ROUTES` が集めた 116 画面と、`app-routes.spec.ts:247` の宣言 111
- 前提: **5 枚の差分を 1 枚ずつ列挙し、それぞれが意図した追加であることを確かめる**

## 出力と成果物

- 更新対象: `tests/e2e/app-routes.spec.ts`（宣言数と検査名）
- 期待: 宣言数が実在数と一致し、5 枚の内訳が PR 本文に残る

## 依存関係

- `depends_on`: なし
- ブロッカー: 5 枚の内訳を確定するまで数を書き換えない

## 実装対象

- Frontend: 増えた 5 画面の実体を確認する
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 5 枚の内訳と、なぜ 116 が正しいかを PR 本文へ

## Write scope と競合制約

- `touches`: tests/e2e/app-routes.spec.ts
- 排他資源: なし
- 並列実行条件: `app-routes.spec.ts` を触る他 task と同時に走らせない
- branch: devgraph/task-route-registry-declared-count-116
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-route-registry-declared-count-116` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `ALL_ROUTES` の 116 件を、`git diff` で増えた `page.tsx` と突き合わせ、
   差分の 5 枚を特定する
2. 5 枚それぞれについて、どの task が追加したかを確かめる
3. 全て意図した追加であることを確認してから、`247` 行の宣言と `248` 行の
   監査対象数、および検査名の数を書き換える
4. `pnpm run test:e2e` で該当の 4 件（desktop/mobile × 2 検査）が消えることを確かめる

## 受入条件

- [ ] 増えた 5 枚の内訳が列挙され、それぞれの出所が分かる
- [ ] 宣言数と検査名の数が実在数と一致する
- [ ] 内訳を確かめずに数だけ書き換えた形跡が無い

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 5 枚を実際に開き、意図した画面であることを見る
- 証跡: PR 本文の 5 枚の一覧

## リスクとロールバック

- リスク: 内訳を見ずに数だけ合わせると、この検査が「画面の増減を見張る」役目を
  失う。以後、意図しない画面が増えても誰も気づかない
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
