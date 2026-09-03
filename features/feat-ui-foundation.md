---
graph_node_id: "feat-ui-foundation"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["frontend","ux","a11y","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "UI/UX 共通基盤"
owners: ["daishiman"]
created_at: "2026-08-16T13:20:00Z"
updated_at: "2026-08-30T00:00:00Z"
status: "active"
depends_on: ["feat-auth-workspace"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "全画面で同じ操作作法・状態表現・アクセシビリティ水準を保ち、画面ごとの作り起こしをなくす"
goal: "共通レイアウト1箇所でナビゲーション・現在地・退避先が固定表示され、loading/empty/error/権限なしの4状態と入力作法が全画面で同一に振る舞い、WCAG 2.2 AA を満たす"
scope_in: ["共通レイアウトとナビゲーション (孤立ページを作らない)","状態表現4種 (loading / empty / error / 権限なし)","入力部品と入力作法 (Enter・貼り付け・単位・自動値の由来表示)","レスポンシブ","アクセシビリティ (キーボード操作・フォーカス・ラベル・コントラスト)","日本語UIの文言規則"]
scope_out: ["各機能固有の画面本体","記事本文の文章規則 (feat-writing-method)"]
acceptance: ["ナビゲーションから全機能へ到達でき、孤立ページが0件である","4状態のいずれも文言つきで表示され、エラー時に復帰導線がある","キーボードだけで主要導線を完了できる","入力作法が全画面で1組に統一されている"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-ui-foundation.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T13:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved two-layer specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-ui-foundation.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-o90","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

全画面で同じ操作作法・状態表現・アクセシビリティ水準を保ち、画面ごとの作り起こしをなくす

## 到達状態

共通レイアウト1箇所でナビゲーション・現在地・退避先が固定表示され、loading/empty/error/権限なしの4状態と入力作法が全画面で同一に振る舞い、WCAG 2.2 AA を満たす

## スコープ

- スコープ内:
  - 共通レイアウトとナビゲーション (孤立ページを作らない)
  - 状態表現4種 (loading / empty / error / 権限なし)
  - 入力部品と入力作法 (Enter・貼り付け・単位・自動値の由来表示)
  - レスポンシブ
  - アクセシビリティ (キーボード操作・フォーカス・ラベル・コントラスト)
  - 日本語UIの文言規則
- スコープ外:
  - 各機能固有の画面本体
  - 記事本文の文章規則 (feat-writing-method)

## 受入

- [ ] ナビゲーションから全機能へ到達でき、孤立ページが0件である
- [ ] 4状態のいずれも文言つきで表示され、エラー時に復帰導線がある
- [ ] キーボードだけで主要導線を完了できる
- [ ] 入力作法が全画面で1組に統一されている

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 二層構造の責務境界と共有ドメインサービス層を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-auth-workspace
- 依存理由: ログインとロールが決まらないと権限なし状態の表現を実装できない

## 実装の現在地（2026-08-22 / ah-8h2）

共通の並べ方を画面から部品へ寄せた。

- 同格の行き先は `InlineNav`。縦一覧は `StackedList` / `StackedRow`
- ログイン画面専用 CSS は参照 0 件になったため削除し、`SectionHeading` / `DefinitionList` / `Note` / `SeeAlso` / `Button` を正本にする
- 押しどころ 44px は、実ブラウザで不足していた見出しリンク・サイト名・商品名リンクへだけ広げた
- 実ブラウザ監査は `tests/e2e/`（signin を除く 53 画面 × desktop/mobile）

## 実装の現在地（2026-08-30 / ah-6lf）

入力作法のうち「複数行の欄をどう区切るか」を、画面ごとの実装から関数 1 本へ寄せた。

- 1 行 1 件の欄は `presentation/admin/non-empty-lines.ts` の `parseNonEmptyLines`（入口 6 つ）
- 空行区切りの本文欄は `domain/authoring/non-empty-paragraphs.ts` の `parseNonEmptyParagraphs`（入口 3 つ）
- 単一改行は段落内の改行として保つ。空の段落・空行は保存しない
- どちらも「別名で同じ実装を足す」を構造の重複として検知する検査を持ち、寄せた先が再び分岐しない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
