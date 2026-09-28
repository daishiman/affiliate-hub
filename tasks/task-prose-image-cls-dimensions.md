---
graph_node_id: "task-prose-image-cls-dimensions"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["cls","prose","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "本文画像(prose)のCLS対策: 画像ノードに寸法を持たせる"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["feat-thumbnail-visual-system","feat-blog-ui-builder"]
resource_scope: ["src/presentation","src/domain/blogops","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"prose-body.tsx:175 と prose-editor.tsx:523 の本文画像は width/height を持たず、絵が届いた瞬間に下の文章を押し下げる","mvp_fit":"deferred","purpose":"読者が読んでいる最中に文章が動かないようにする","rationale":"表紙側は寸法つきで解決済みだが、本文画像は運営者がその場で貼る URL で寸法も許可ホストも事前に確定できず、画像ノード自身に寸法を持たせるデータ変更が要るため範囲が別"}
scope_in: ["本文の画像ノードへ寸法を持たせる保存形式の変更と、既存記事の移行","貼り付け時にブラウザ側で寸法を測って書き込む経路 (prose-editor.tsx:523)","寸法の無いノードの描画時の扱い (aspect-ratio の既定値で場所を確保する)"]
scope_out: ["記事の表紙(サムネイル)。こちらは寸法つきで解決済み","外部ホストの画像を取得して寸法を測る仕組み"]
acceptance: ["本文の画像ノードが width / height を保持し、公開面の img が寸法つきで描かれる","寸法を持たない既存の本文画像でも、場所だけは先に確保されて文章が押し下げられない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-prose-image-cls-dimensions.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-prose-image-cls-dimensions.md","confidence":0.9}]
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

記事を読んでいる最中に、あとから届いた本文画像が下の文章を押し下げないようにする。

## 背景

記事の表紙 (サムネイル) は `feat-thumbnail-visual-system` で `width`/`height` 付きになったが、本文 (prose) の画像は別経路である。`src/presentation/components/blog/prose-body.tsx:175` の `img` は寸法属性を持たず、`src/presentation/components/blog/prose-editor.tsx:523` の貼り付け経路も寸法を保存しない。そのため画像が届いた瞬間に高さが確定し、読者が読んでいた行が下へ飛ぶ (CLS)。

表紙と同じ解き方ができないのは、本文画像が**運営者がその場で貼る URL** だからである。アップロード経路を通らないので、保存時点では寸法も許可ホストも分からない。

## 入力と前提条件

- 入力: 既存記事の本文 JSON (prose ノード列) と、貼り付け時のブラウザ側 `Image` オブジェクト
- 前提: workerd に画像デコーダは無い。寸法はブラウザ側でしか測れない
- 前提: 既存記事は寸法を持たない。移行できないノードが必ず残る

## 出力と成果物

- 生成物: prose の画像ノードに `width`/`height` を持たせた保存形式と、その型定義
- 更新対象: `prose-body.tsx` (描画)、`prose-editor.tsx` (貼り付け時の採寸)、本文 JSON の schema とテスト

## 依存関係

- `depends_on`: なし (表紙側の実装は完了済みで、参照するだけ)
- ブロッカー: なし

## 実装対象

- Frontend: `img` へ寸法属性を出す。貼り付け時に `Image` で採寸して本文 JSON へ書く
- Backend/API: N/A: 本文 JSON はそのまま保存されるので API の形は変わらない
- Database/Data: 本文 JSON の中身が変わる。既存記事は寸法なしのまま読める後方互換が要る
- Infrastructure: N/A: 置き場も定期実行も増えない
- Security/Privacy: 採寸のために外部ホストへ画像取得が走る。許可ホスト以外を採寸しない
- Documentation: 本文 JSON の形の説明を更新する

## Write scope と競合制約

- `touches`: src/presentation/components/blog/ src/domain/blogops/ tests/
- 排他資源: 本文 JSON の型定義
- 並列実行条件: 表紙まわりの task とは資源が重ならないので同時に走らせてよい
- branch: devgraph/task-prose-image-cls-dimensions
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-prose-image-cls-dimensions` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 本文 JSON の画像ノードへ `width`/`height` を任意項目として足し、無い場合の読みを決める
2. 貼り付け経路 (`prose-editor.tsx`) で `Image` を使って採寸し、書き込む
3. 描画側 (`prose-body.tsx`) で寸法があれば属性として出す
4. 寸法が無いノードは `aspect-ratio` の既定値で場所だけ先に確保する
5. 既存記事が壊れないことを、寸法なしの本文 JSON を読ませるテストで確かめる

## 受入条件

- [ ] 本文の画像ノードが `width`/`height` を保持し、公開面の `img` が寸法つきで描かれる
- [ ] 寸法を持たない既存の本文画像でも、場所だけは先に確保されて文章が押し下げられない
- [ ] 採寸に失敗した画像でも本文の保存が失敗しない

## 検証方法

- 自動検証: `pnpm vitest run tests/unit/prose-body.test.ts tests/unit/prose-editor.test.ts` と `npx tsc --noEmit`
- 手動検証: DevTools の Performance で Layout Shift を記録し、本文画像の到着で shift が出ないことを見る
- 証跡: 記録した Performance トレースの要約を PR 本文へ貼る

## リスクとロールバック

- リスク: 採寸のために外部ホストへ取得が走り、遅いホストで貼り付けが待たされる
- ロールバック: 寸法は任意項目なので、書き込みだけを止めれば以前の描画に戻る

## Handoff

- 実装 route: human。次に利用するノード: `feat-thumbnail-visual-system` (寸法の扱いを揃える先)
