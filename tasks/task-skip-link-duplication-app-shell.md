---
graph_node_id: "task-skip-link-duplication-app-shell"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["a11y","e2e","follow-up"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "管理画面の skip link 二重を 1 つにする (E2E 96 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/ui/templates/app-shell.tsx"]
purpose: null
goal: null
mvp_alignment: {"background":"app-shell.tsx:286 と :290 に同じ href・同じ文言の skip link が 2 つある。HEAD のままの重複で、管理画面は全てこのテンプレートを通るため 96 件の赤になっている","mvp_fit":"deferred","purpose":"読み上げで同じ行き先が 2 回読まれる状態を解き、重なり監査の 96 件を消す","rationale":"1 箇所の削除で E2E の赤 214 件のうち 96 件が消える。最も効く 1 手"}
scope_in: ["skip link を 1 つに減らす","Tab の 1 回目で本文へ飛べることの確認"]
scope_out: ["skip link の位置や見た目を変えること"]
acceptance: ["app-shell.tsx の skip link が 1 つになっている","Tab の 1 回目で skip link に焦点が当たり Enter で #admin-main-content へ飛ぶ","重なり監査の「本文へ移動 ↔ 本文へ移動」が 0 件になる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-skip-link-duplication-app-shell.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed from the P08 e2e run"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-skip-link-duplication-app-shell.md","confidence":0.9}]
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

管理画面の全ページで重なり監査が報告している「同じ操作が 2 つある」を、原因の 1 箇所を直して消す。

## 背景

`pnpm run test:e2e` が 214 件赤く、そのうち **96 件**が同一の指摘である。

```
<a> 本文へ移動 ↔ <a> 本文へ移動
```

出所は `src/presentation/ui/templates/app-shell.tsx` の 2 箇所:

- `:286` — shell 直下の skip link
- `:290` — sidebar (`<nav>`) の中の skip link

**href も文言も同じ**（`#admin-main-content` / 「本文へ移動」）。管理画面は全て
このテンプレートを通るので、1 箇所の重複が全ページの赤になっている。

`git diff HEAD` で確認済みで、**このファイルは HEAD のまま**である。今回の作業が
持ち込んだ変更ではなく、以前から在った重複を重なり監査が拾っている。

読み上げの側から見ると、Tab を 1 回押すたびに同じ行き先が 2 回読み上がる。
どちらへ飛んでも同じ場所なので、片方は情報を持たない。

## 入力と前提条件

- 入力: `tests/e2e/app-routes.spec.ts` の重なり監査が出す 96 件の指摘
- 前提: skip link は**焦点が当たるまで画面外**にある（`floating-overlay-declaration.test.ts` の
  `EXEMPT.skipLink` がその前提を明文化している）。位置を変える修正はその前提を崩す

## 出力と成果物

- 更新対象: `src/presentation/ui/templates/app-shell.tsx`
- 期待: 重なり監査の「本文へ移動 ↔ 本文へ移動」が 0 件になる

## 依存関係

- `depends_on`: なし
- ブロッカー: なし。単独で直せる

## 実装対象

- Frontend: skip link を 1 つに減らす。**どちらを残すかは焦点順序で決める** —
  skip link は Tab の最初に来る必要があるので、DOM 順で先に在る側（shell 直下）が残る
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: なぜ 1 つでよいかをコメントに残す（2 つに増やしたくなる次の人へ）

## Write scope と競合制約

- `touches`: src/presentation/ui/templates/app-shell.tsx
- 排他資源: なし
- 並列実行条件: `app-shell.tsx` を触る他 task と同時に走らせない
- branch: devgraph/task-skip-link-duplication-app-shell
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-skip-link-duplication-app-shell` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `app-shell.tsx:286` と `:290` の 2 つが同じ行き先であることを確かめる
2. sidebar 側（`:290`）を消す。sidebar の中の skip link は、そこへ辿り着くまでに
   既に案内リンクを通過しているため「本文へ飛ぶ」近道になっていない
3. キーボードだけで `/admin` を開き、Tab の 1 回目で skip link が現れ、Enter で
   本文へ飛ぶことを確かめる
4. `pnpm run test:e2e` を走らせ、96 件が消えることを確かめる

## 受入条件

- [ ] `app-shell.tsx` の skip link が 1 つになっている
- [ ] Tab の 1 回目で skip link に焦点が当たり、Enter で `#admin-main-content` へ飛ぶ
- [ ] 重なり監査の「本文へ移動 ↔ 本文へ移動」が 0 件になる

## 検証方法

- 自動検証: `pnpm run test:e2e`（重なり監査の該当指摘が 0 件）
- 手動検証: キーボードだけで管理画面を開き、Tab 1 回で本文へ飛べるか
- 証跡: E2E の実行ログ（修正前 96 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 残す側を間違えると、Tab の最初に skip link が来なくなり近道の意味が消える
- ロールバック: 1 ファイル 1 箇所の削除なので revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
