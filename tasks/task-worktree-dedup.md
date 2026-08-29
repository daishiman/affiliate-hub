---
graph_node_id: "task-worktree-dedup"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["ui","dedup","feedback","a11y"]
priority: "high"
start_date: "2026-08-21"
target_date: null
iteration: null
title: "今回のワークツリーの重複除去とコンポーネント整理"
owners: ["daishiman"]
created_at: "2026-08-21T00:00:00Z"
updated_at: "2026-08-22T00:00:00Z"
status: "active"
depends_on: []
related_nodes: ["feat-ui-foundation", "feat-improvement-feedback"]
resource_scope: ["src/presentation", "src/app", "src/domain/feedback", "src/application", "src/infrastructure", "tests"]
purpose: "開発中の実装を棚卸しし、重複と責務の錯綜を、挙動を保ったまま共通部品へ寄せる"
goal: "同じ役の見た目が 1 つの部品を通り、技術診断が生の秘密を保存せず、関連検査が緑である"
mvp_alignment: {"background":"同じ並べ方と診断の収集が画面ごとに分かれ、秘密や押しどころの不足が検査から漏れていた","mvp_fit":"direct","purpose":"重複を消して共通部品と保存前の縮約に寄せる","rationale":"画面ごとの例外を残すと、次の一括作業の母集団から外れる"}
scope_in: ["未使用 CSS の削除","InlineNav への横ナビ移行","押しどころ下限の実測適用","改善要望診断の固定語彙化","担当者数の正本を membership へ移す","MCP catalog の二重生成防止","実ブラウザ監査の入口"]
scope_out: ["affiliate_links の商品スナップショット契約","診断の保持期限と削除ジョブ","仕様完全性評価を PASS に戻すこと"]
acceptance: ["旧 .linkList と signin.module.css の参照が 0 件","診断の保存値に生の token / メール / 例外本文が残らない","担当者数が見本件数と D1 で食い違わない","関連する unit / lint / typecheck が緑"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-ui-foundation"
feature_package_id: null
phase_ref: null
file_path: "tasks/task-worktree-dedup.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task covering worktree dedup"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-worktree-dedup.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-8h2","github_mirror":null,"linked_at":"2026-08-22T00:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-22T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

今回のワークツリーで開発中の実装を棚卸しし、抜け漏れ・重複・既存実装との二重化・責務の錯綜を、挙動を保ったまま共通化・削除する。

## 背景

同じ並べ方が画面ごとの生クラスに残ると、一括の部品化の母集団から外れる。
改善要望の診断は補助情報なのに、生の URL・例外・操作名を保存すると秘密が残る。
担当者数を workspace 側の見本件数で出すと、画面の一覧と容量が食い違う。

## 入力と前提条件

- 入力: `src/presentation` の部品、`src/app` の画面、改善要望の診断、担当者の登録
- 前提: 業務判断が必要な契約（成果リンクの商品スナップショット、診断の保持期限）は創作しない
- 前提: 仕様完全性の PASS 化は子課題 `ah-8h2.2`

## 出力と成果物

- `InlineNav` と旧 `.linkList` の削除
- ログイン画面専用 CSS の削除
- `domain/feedback/diagnostics.ts` による保存前の縮約
- `MembershipRepositoryPort.countCurrent`
- `pnpm test:e2e` の入口

## 依存関係

- depends_on: なし
- ブロッカー: なし
- 発見して分けた課題: `ah-au4`（成果リンク、2026-08-24 closed）、`ah-lqu`（診断の保持期限、2026-08-24 closed）、`ah-8h2.2`（完全性 PASS、open）

## 実装対象

- Frontend: 共通 UI 部品、管理画面の横ナビ、押しどころ、改善要望ボタン
- Backend/API: MCP catalog を 1 要求 1 生成にする
- Database/Data: 担当者数の正本を memberships へ移す。スキーマ変更なし
- Infrastructure: Playwright preview 準備（ローカル D1 のみ）
- Security/Privacy: 技術診断の固定語彙化
- Documentation: UI システム、改善要望の実装契約、テスト構成、受領書

## Write scope と競合制約

- touches: src/presentation/ src/app/ src/domain/feedback/ src/application/ src/infrastructure/ tests/ docs/ features/ tasks/
- 排他資源: 共通 UI 部品、改善要望の診断語彙
- branch: `devgraph/task-worktree-dedup`
- completion projection: manual

## GitHub publication

- Mode: local_only
- PR linkage requirement: 本文に Beads ID `ah-8h2` と dev-graph: `task-worktree-dedup` を書く

## 実行手順

1. 役の違う横並びを `InlineNav` へ移し、旧 `.linkList` を削除する
2. 参照 0 件の `signin.module.css` を削除する
3. 技術診断を収集側と保存側の両方で固定語彙へ縮約する
4. 担当者数を `countCurrent` に移す
5. MCP catalog の二重生成を止める
6. `pnpm run verify --tier 1` を通す

## 受入条件

- [x] 旧 `.linkList` と `signin.module.css` の参照が 0 件
- [x] 診断の保存値に生の token / メール / 例外本文が残らない
- [x] 担当者数が見本件数と D1 で食い違わない
- [ ] 仕様完全性評価が PASS（`ah-8h2.2`）
- [ ] 関連する lint / 型検査 / テストが緑

## 検証方法

- 自動検証: `pnpm run verify --tier 1`
- 実ブラウザ: `pnpm test:e2e`（preview 起動を含む。既定の verify には入れない）
- 証跡: `docs/spec-writeback-receipt.md`

## リスクとロールバック

- リスク: 診断を縮約しすぎて再現に足りない。種類と経路は残し、本文だけ落とす
- リスク: 押しどころを広げすぎて右下の改善ボタンと重なる。一覧リンクは `align-self: flex-start`
- ロールバック: revert。スキーマ変更なし

## Handoff

- 実装 route: agent
- 次に利用するノード: `ah-8h2.2`（完全性 PASS）。`ah-lqu` と `ah-au4` は feat-auth-workspace の最終レビューで closed
