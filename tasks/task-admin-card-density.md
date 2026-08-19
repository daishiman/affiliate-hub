---
graph_node_id: "task-admin-card-density"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["admin-ui","information-design"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "管理画面の間延びを実測してから詰める"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation","src/app","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"画面が間延びしてカードが大きすぎるという指摘。原因は未測定","mvp_fit":"direct","purpose":"余白の段数・最小高さの固定・本文の行長上限・カードの最小幅を数字で出してから直す","rationale":"「詰めました」だけの報告は受け取らないと明示されている。測定が先"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-admin-card-density.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "single standalone task, no feature package"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-admin-card-density.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

管理画面の間延びを、直す前に数字で出す。原因を特定してから詰める。

## 背景

「画面が間延びしていてカードが大きすぎる」という指摘があるが、原因は未測定である。「詰めました」だけの報告は受け取らないと明示されている。余白の重ねがけ・最小高さの固定・行長の上限なし・カードの最小幅の 4 つは症状が同じで原因が違うため、測らずに詰めると別の場所が崩れる。

## 入力と前提条件

- 入力: `src/presentation` のカード・レイアウト部品、Tailwind の余白指定
- 前提: 情報を減らして詰めない。同じ情報が入ったまま占有面積が減ることを目標にする
- 前提: 見た目の崩れを自動で見つける手段は無い (`task-visual-regression-gap` 参照)。preview で人が見る

## 出力と成果物

- 生成物: 測定結果 (4 項目の数字)、詰めたあとの部品、`/admin/ui-catalog` の比較用の並び
- 更新対象: `src/presentation`、`src/app/admin/ui-catalog`

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: カードとレイアウト部品の余白・最小高さ・行長・最小幅
- Backend/API: N/A: API 変更なし
- Database/Data: N/A: スキーマ変更なし
- Infrastructure: N/A: デプロイ単位は変えない
- Security/Privacy: N/A: 表示のみ
- Documentation: 測った数字を残す (「詰めた」ではなく前後の数字で書く)

## Write scope と競合制約

- touches: src/presentation/ src/app/ tests/
- 排他資源: 共通のカード部品
- 並列実行条件: `task-admin-nav-grouping` と同時に走らせない
- branch: feat/clean-architecture-skeleton
- worktree lease: 本 worktree で実行
- completion projection: manual

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: 前後の数字が出ていること
- Failure policy: local のまま残す
- Completion policy: manual
- PR linkage requirement: 本文に Beads ID と dev-graph: task-admin-card-density を書く
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. 余白の段数を数える。外枠・内枠・行間で同じ向きの余白が何段重なっているかを出す。使われていない段を特定する
2. 中身 1 行なのに大きい枠を探す。最小高さの固定 (`min-h-*` / 固定 `h-*`) を一覧にする
3. 本文の行長上限を測る。上限が無い箇所を一覧にする
4. 並べたカードの最小幅を測る。広い画面で何枚並ぶかを幅ごとに出す
5. 4 つの数字を出してから、原因のあるものだけを直す
6. `/admin/ui-catalog` に、詰める前と後を目で比べられる並びを置く
7. preview (`localhost:8787`) で 1 周する

## 受入条件

- [ ] 4 項目それぞれについて、直す前の数字が記録されている
- [ ] 直したものは前後の数字が両方書かれている
- [ ] 表示している情報の件数・項目数が減っていない
- [ ] `/admin/ui-catalog` で詰まり具合を目で比べられる
- [ ] 広い画面でカードが何枚並ぶかが、幅ごとに書かれている

## 検証方法

- 自動検証: `pnpm run verify`
- 手動検証: preview で 4 項目の前後を見比べる
- 証跡: 測定結果の数字

## リスクとロールバック

- リスク: 情報を削って「詰まった」ように見せてしまう。受入条件で件数を固定して防ぐ
- リスク: 見た目の回帰を測る手段が無いため、詰めた副作用は人の目でしか見つからない
- ロールバック: 表示だけの変更なので revert で戻せる

## Handoff

- 実装 route: agent
- 次に利用するノード: task-visual-regression-gap
