---
graph_node_id: "task-floating-button-covers-controls"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["e2e","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "浮いたボタンの帯から出せない主要操作 (E2E 18 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/ui"]
purpose: null
goal: null
mvp_alignment: {"background":"P08 の証跡が場所まで特定済み。ui.module.css の .content の padding-bottom が浮遊ボタンの帯より小さい。P08 の write_scope の外だったので別 task にした","mvp_fit":"deferred","purpose":"本文の下余白が足りず、一番下まで送っても浮遊ボタンの帯から出せない操作を無くす","rationale":"重なり監査は本物の指摘を出している。免除表へ逃がすと、指で押せない操作が緑のまま残る"}
scope_in: ["ui.module.css の .content 下余白と、浮遊要素の帯の高さの関係を決める","重なり 12 件・覆い 6 件が 0 件になることの確認"]
scope_out: ["重なり監査の閾値を緩めること","指摘のあった画面を監査対象から外すこと"]
acceptance: ["`浮いたボタンの下から出せない主要操作があります` が 0 件","`主要操作どうしが重なっています` が 0 件","監査側の閾値・除外表を変えていない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-floating-button-covers-controls.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while triaging the E2E red set"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-floating-button-covers-controls.md","confidence":0.9}]
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

本文の一番下まで送っても、浮いたボタンの帯から出せない主要操作を無くす。

## 背景

`pnpm run test:e2e` に 2 つの文言で計 18 件残っている。

```
Error: 浮いたボタンの下から出せない主要操作があります
Error: 主要操作どうしが重なっています
```

出る画面は `admin/content/published` / `admin/site-network` /
`admin/blog/evaluate/[article]` / `admin/settings/members` ほか。

**場所は P08 の証跡で特定済み**である
（`docs/spec/feat-feedback-capture-self-exclusion/evidence/13-floating-overlay-unification.txt`）:

> 「本文の下余白が足りず、一番下まで送っても浮いたボタンの帯から出せない操作」の
> 実在の指摘で、直す場所は `.content` の `padding-bottom`（ui.module.css）である。

P08 の write_scope（`src/presentation/ui/patterns`）の外にあったため、
その phase では直せず別 task にした。

## 入力と前提条件

- 入力: 上記 18 件の指摘と、そこに出る画面名・操作名
- 前提: **重なり監査の閾値を緩めない。免除表・除外表へ逃がさない。**
  この監査は「指で押せない操作が残っていないか」を見るもので、
  赤いこと自体が仕事をしている証拠である

## 出力と成果物

- 更新対象: `src/presentation/ui` の `ui.module.css`（`.content` の下余白）
- 期待: 18 件が 0 件になり、浮遊要素の帯と本文の下端が干渉しなくなる

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: `.content` の `padding-bottom` と浮遊要素の帯の高さの関係を決める
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 下余白が浮遊要素の高さに従属することをコメントに残す
  （数値を直接書くと、帯の高さを変えた日に黙ってずれる）

## Write scope と競合制約

- `touches`: src/presentation/ui
- 排他資源: なし
- 並列実行条件: `ui.module.css` を触る他 task と同時に走らせない
- branch: devgraph/task-floating-button-covers-controls
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-floating-button-covers-controls` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 指摘のある画面を 1 つ開き、一番下まで送って浮遊ボタンと操作の重なりを実際に見る
2. 浮遊要素の帯の高さと `.content` の `padding-bottom` を突き合わせる
3. 下余白を帯の高さに従属させる（固定値で合わせない）
4. `pnpm run test:e2e` で 18 件が消えることを確かめる

## 受入条件

- [ ] `浮いたボタンの下から出せない主要操作があります` が 0 件
- [ ] `主要操作どうしが重なっています` が 0 件
- [ ] 重なり監査の閾値・除外表を変えていない
- [ ] 下余白が帯の高さから導かれており、固定値の書き写しになっていない

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 指摘のあった画面を開き、一番下まで送って操作に指が届くか見る
- 証跡: E2E の実行ログ（修正前 18 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 固定値で下余白を足すと、帯の高さを変えた日に黙って足りなくなる
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
