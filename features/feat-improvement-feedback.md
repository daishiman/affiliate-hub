---
graph_node_id: "feat-improvement-feedback"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "operations"
tags: ["feedback","loop","mvp"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "改善要望フィードバック（受け取り → 一覧 → 払い出し）"
owners: ["daishiman"]
created_at: "2026-08-17T00:00:00Z"
updated_at: "2026-08-30T12:03:07Z"
status: "closed"
closed_at: "2026-08-17T04:25:22Z"
depends_on: []
related_nodes: ["task-telemetry-to-metrics"]
resource_scope: ["src/domain/feedback","src/application/usecases/feedback","src/infrastructure","src/presentation","src/app/admin/feedback","tests"]
purpose: "管理者から届いた改善要望を、画面の写しつきで受け取り、作業する側へ安全に渡す"
goal: "右下の改善ボタンから送った要望が一覧に残り、指示文または取得の口から作業へ渡る"
mvp_alignment: {"background":"改善のやり取りが口頭と記憶に依存し、何を直すかが残らない","mvp_fit":"direct","purpose":"管理者から届いた改善要望を、作業する側へそのまま渡せるようにする","rationale":"要望が残らないと、直す判断そのものができない"}
scope_in: ["全画面の右下に出る改善ボタン（共通UIの型、管理者だけ）","書き込み欄（画面名の自動記入・3 つの種類・必須と任意の欄・送る内容の開示）","画面の写しと書き込み（手書き/四角/矢印/文字/黒塗り、元に戻す、撮り直す、画像を外す）","一覧画面（状態ごとの件数・重ねられる絞り込み・まとめて払い出し）","詳細画面 10 区画（状態・メモ・扱いの決定・やり直せる操作の記録）","払い出し 2 経路（人が写して渡す / 鍵で取りに来る）と指示文の版管理","連携の鍵の発行・失効・最終利用・使える範囲"]
scope_out: ["読者向けの意見箱（対象は管理者だけ）","統計による判定（1 件届いたら扱いを決める。標本として扱わない）","Beads の状態をこの機能側へ写すこと（作業単位の正本は Beads）","画像を指示文へ入れること","外部のチケット管理サービスとの連携"]
acceptance: ["FB-AC-01〜24（docs/spec/12-改善要望フィードバック仕様.md）","黒塗りが画像そのものを塗り替えており、保存された値から元画像を取り出せない","要望の本文を指示文へ入れても、区切りの外へ出ず、命令として実行されない","指示文に氏名・メールアドレス・画像・鍵・他の作業場所のデータが 1 つも含まれない","連携の鍵が発行時に 1 度だけ表示され、保存された値から復元できない","追跡表 T 節（REQ-FB01〜12）の 12 行がすべて実装済になる"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-improvement-feedback.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"f814f1a62e30eebb4512ba0c7964bfdb6986c4007af406aab7d8d7e58e17a856","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/spec/12-改善要望フィードバック仕様.md"}
source_lineage: {"imported_at":"2026-08-17T00:00:00Z","origin_kind":"generated","source_digest":"f814f1a62e30eebb4512ba0c7964bfdb6986c4007af406aab7d8d7e58e17a856","source_path":"docs/spec/12-改善要望フィードバック仕様.md","source_plugin":"app-orchestrator","source_version":"1.0.0"}
classification_confidence: 0.95
classification_reason: "docs/product/backlog.md の残課題を作業単位として登録"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-improvement-feedback.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-w6y","github_mirror":null,"linked_at":"2026-08-17T02:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-17T04:25:22Z","evidence_refs":["beads:ah-w6y"],"policy":"manual","reconciled_at":"2026-08-30T12:03:07Z","source":"reconciliation","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

管理者から届いた改善要望を、画面の写しつきで受け取り、作業する側へ安全に渡す。

規範は `docs/spec/12-改善要望フィードバック仕様.md`（FB-AC-01〜24）、
実装契約は `docs/architecture/feedback-loop.md`、
要件は `docs/product/traceability.md` の T 節（REQ-FB01〜12）。

## 到達状態

右下の改善ボタンから送った要望が一覧に残り、指示文または取得の口から作業へ渡る。
**ループの 2 件目**として作る（`src/domain/analytics/loop-kinds.ts` に `product_improvement` を足す）。
新しい仕組みを横に建てない。

## スコープ

含む:

- 全画面の右下に出る改善ボタン（共通 UI の型、管理者だけ）
- 書き込み欄（画面名の自動記入・3 つの種類・必須と任意の欄・送る内容の開示）
- 画面の写しと書き込み（手書き / 四角 / 矢印 / 文字 / 黒塗り、元に戻す、撮り直す、画像を外す）
- 一覧画面（状態ごとの件数・重ねられる絞り込み・まとめて払い出し）
- 詳細画面 10 区画（状態・メモ・扱いの決定・やり直せる操作の記録）
- 払い出し 2 経路（人が写して渡す / 鍵で取りに来る）と指示文の版管理
- 連携の鍵の発行・失効・最終利用・使える範囲

含まない:

- 読者向けの意見箱（対象は管理者だけ）
- 統計による判定（1 件届いたら扱いを決める。標本として扱わない）
- Beads の状態をこの機能側へ写すこと（作業単位の正本は Beads）
- 画像を指示文へ入れること
- 外部のチケット管理サービスとの連携

## 受入

- FB-AC-01〜24 を満たす
- 黒塗りが**画像そのものを塗り替えて**おり、保存された値から元画像を取り出せない
- 要望の本文を指示文へ入れても、区切りの外へ出ず、**命令として実行されない**
- 指示文に氏名・メールアドレス・画像・鍵・他の作業場所のデータが 1 つも含まれない
- 連携の鍵が発行時に 1 度だけ表示され、保存された値から復元できない
- 追跡表 T 節（REQ-FB01〜12）の 12 行がすべて実装済になる

**封筒に氏名・メール・画像を入れないことは仕組みで保証するが、
「本文から取り除いた」とは書かない。** 取りこぼしたときに誤った安心を与えるためである。

## アーキテクチャ参照

- `docs/architecture/feedback-loop.md`（実ファイルまで落とした実装契約）
- `docs/architecture/context-map.md`（10 個目のコンテキスト `src/domain/feedback/` と、Analytics へ入れない理由）
- `docs/architecture/ubiquitous-language.md`（改善要望の言葉 9 語）
- `architecture/arch-two-layer-platform.md`

## 機能間依存

`depends_on` は無い。既にある 3 つの仕組みへ相乗りする。

- ループの種類の登録表（`analytics/loop-kinds.ts`）— 参照は一方向のみ
- 経路の表と道具の一覧の総当たり検査 — **新しい検査の枠を作らない**
- 指示文の版管理（生成基盤の既存の仕組み）

## 実装の現在地（2026-08-22 / ah-8h2）

- 技術診断は `domain/feedback/diagnostics.ts` が保存前に固定語彙へ縮約する。生の例外文・操作ラベル・User-Agent・クエリは残さない
- 画像の黒塗り数と診断の伏せ数は別の意味。混ぜると「隠したつもり」の件数が嘘になる
- 要望・鍵の表は D1。画面の写しの置き場（R2）は残課題
- 技術診断の保持期限と削除ジョブは 2026-08-24 に追加した（Beads `ah-lqu`、`docs/architecture/feedback-loop.md` §2-2）

## Handoff

作業単位は 12 の要件行（REQ-FB01〜12）に対応する。
1 件の要望が持つ Beads の課題番号は最大 1 つとし、
**着手・完了の状態は Beads を正とし、要望側へ写さない**。
