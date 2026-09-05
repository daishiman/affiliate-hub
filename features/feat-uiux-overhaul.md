---
graph_node_id: "feat-uiux-overhaul"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["ui-ux","frontend","api","componentization","multi-sns","multi-blog"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "管理画面 UI/UX 全面改善"
owners: ["daishiman"]
created_at: "2026-08-21T12:00:00Z"
updated_at: "2026-09-04T06:01:53.906511Z"
status: "active"
depends_on: ["feat-ui-foundation","feat-distribution-hub"]
related_nodes: []
resource_scope: ["src","docs/spec","system-spec"]
purpose: "管理画面を単一用途画面へ再編し、共通コンポーネント化と投稿状態の可視化によって、複数ブログ・複数SNSへの展開作業を迷いなく完了できるようにする"
goal: "全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、新SNSは能力表と接続実装の追加だけで既存画面を変更せず拡張できる構成になっている"
scope_in: ["単一用途画面への分割 (1画面1タスクの画面再編と遷移設計)","基本管理機能: ブログ・記事・商品・SNS投稿の一覧/新規作成/編集/削除と対応API","カード間隔・文章量の最適化 (密度・余白・要約量の規則化)","サイドバーの整理 (用途別グルーピング・現在地表示・各項目のアイコン表示・アイコンクリックでの開閉)","認知負荷の最小化 (タスク遂行に不要な情報・文章の非表示、直感的に操作だけで完了できる画面設計)","全画面の見直し (既存画面の単一用途化・状態表現の統一適用)","各サイト・SNSへの投稿部分の画面反映 (投稿状態の一覧・詳細表示とAPI)","マルチSNS構成 (能力表と接続実装の追加だけで既存画面を変更せず拡張できるプロバイダ抽象)","1商品→複数ブログのコンセプト別文章作成UI","UI共通コンポーネント化 (重複ハードコーディングの排除・共有部品への集約)","ブログ別コンポーネント作成仕様 (新規ブログ構築時のブログ固有コンポーネント scaffold)"]
scope_out: ["認証・Workspace基盤 (feat-auth-workspace)","記事生成エンジン本体 (feat-ai-content-studio)","SNS実配信・外部API接続の実行系 (feat-distribution-hub)","文章品質規則そのもの (feat-writing-method)","読者向け公開面 (feat-reader-surface)"]
acceptance: ["各管理画面が単一用途で、1画面に複数の主要タスクが混在しない","管理対象 (ブログ・記事・商品・SNS投稿) 全てに一覧・新規作成・編集・削除の操作と対応APIが存在する","各サイト・SNSへの投稿状態が管理画面の一覧・詳細に反映される","新しいSNSは能力表と接続実装の追加だけで既存画面を変更せず拡張できる","1商品から複数ブログへコンセプト別の文章を作成する導線が動作する","同等UIの重複実装が0件で、共通部品は共有コンポーネント経由で使用される","新規ブログ構築時にブログ別コンポーネント一式が仕様どおり scaffold される","カード間隔・文章量・サイドバー構成が規則として文書化され全画面へ適用されている","サイドバーの全項目にアイコンが付き、アイコンクリックで折りたたみ/展開が切り替わり、折りたたみ時もアイコンで項目を識別できる","各画面の表示情報がタスク遂行に必要な項目のみに絞られ、不要な文章・説明が非表示になっている (認知負荷の低減)"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-uiux-overhaul.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"c3b797019d4e6a44859a1e502255b51ee723bdc471d184e6f5b3a625728c7089","evaluator":"system-spec-harness/aggregate-completeness (C05, forks C06/C07/C08 resolved)","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"33d644c2cb19eee116a4d365c0a50c84c697f9a2e9afcc7afef6f06a3d9ad527","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "ユーザー要望の macro want を C14 分解で feature 化 (単一用途画面分割/基本管理/密度最適化/サイドバー/投稿反映/マルチSNS/複数ブログ/共通コンポーネント)"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-uiux-overhaul.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-6hc","github_mirror":null,"linked_at":"2026-08-21T12:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: [{"base_branch":"dev","closing_reference_verified":false,"head_branch":"devgraph/feat-uiux-overhaul","linked_at":"2026-08-23T11:34:01Z","merge_commit_sha":"eccadc2c44c598119c3dfa18bb65e202ddef4296","merged_at":"2026-08-23T19:41:21Z","pr_number":23,"repo":"daishiman/affiliate-hub","state":"merged","url":"https://github.com/daishiman/affiliate-hub/pull/23"}]
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":["docs/spec/feat-uiux-overhaul/acceptance-reconciliation.json","docs/spec/feat-uiux-overhaul/evidence/09-acceptance-reconciliation.txt"],"policy":"reconciliation-gate","reconciled_at":null,"source":"acceptance-reconciliation","status":"open"}
implementation_readiness: {"checked_at":"2026-08-21T12:00:00Z","missing_sections":[],"status":"complete"}
acceptance_reconciliation: {"implementation_status":"pass","release_status":"unpublished","tracking_status":"active","evaluated_digest":"sha256:f8f7c71df86562e1ac4f4311981041b722dfcb931464d95c921884f16651582d","manifest_ref":"docs/spec/feat-uiux-overhaul/acceptance-reconciliation.json"}
---

# 目的

管理画面を単一用途画面へ再編し、共通コンポーネント化と投稿状態の可視化によって、複数ブログ・複数SNSへの展開作業を迷いなく完了できるようにする

## 到達状態

全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、新SNSは能力表と接続実装の追加だけで既存画面を変更せず拡張できる構成になっている

## スコープ

- スコープ内:
  - 単一用途画面への分割 (1画面1タスクの画面再編と遷移設計)
  - 基本管理機能: ブログ・記事・商品・SNS投稿の一覧/新規作成/編集/削除と対応API
  - カード間隔・文章量の最適化 (密度・余白・要約量の規則化)
  - サイドバーの整理 (用途別グルーピング・現在地表示・各項目のアイコン表示・アイコンクリックでの開閉)
  - 認知負荷の最小化 (タスク遂行に不要な情報・文章の非表示、直感的に操作だけで完了できる画面設計)
  - 全画面の見直し (既存画面の単一用途化・状態表現の統一適用)
  - 各サイト・SNSへの投稿部分の画面反映 (投稿状態の一覧・詳細表示とAPI)
  - マルチSNS構成 (能力表と接続実装の追加だけで既存画面を変更せず拡張できるプロバイダ抽象)
  - 1商品→複数ブログのコンセプト別文章作成UI
  - UI共通コンポーネント化 (重複ハードコーディングの排除・共有部品への集約)
  - ブログ別コンポーネント作成仕様 (新規ブログ構築時のブログ固有コンポーネント scaffold)
- スコープ外:
  - 認証・Workspace基盤 (feat-auth-workspace)
  - 記事生成エンジン本体 (feat-ai-content-studio)
  - SNS実配信・外部API接続の実行系 (feat-distribution-hub)
  - 文章品質規則そのもの (feat-writing-method)
  - 読者向け公開面 (feat-reader-surface)

## 受入

- [x] A1 — 各管理画面が単一用途で、1画面に複数の主要タスクが混在しない
- [x] A2 — 管理対象 (ブログ・記事・商品・SNS投稿) 全てに一覧・新規作成・編集・削除の操作と対応APIが存在する
- [x] A3 — 各サイト・SNSへの投稿状態が管理画面の一覧・詳細に反映される
- [x] A4 — 新しいSNSは能力表と接続実装の追加だけで既存画面を変更せず拡張できる
- [x] A5 — 1商品から複数ブログへコンセプト別の文章を作成する導線が動作する
- [x] A6 — 同等UIの重複実装が0件で、共通部品は共有コンポーネント経由で使用される
- [x] A7 — 新規ブログ構築時にブログ別コンポーネント一式が仕様どおり scaffold される
- [x] A8 — カード間隔・文章量・サイドバー構成が規則として文書化され全画面へ適用されている
- [x] A9 — サイドバーの全項目にアイコンが付き、アイコンクリックで折りたたみ/展開が切り替わり、折りたたみ時もアイコンで項目を識別できる
- [x] A10 — 各画面の表示情報がタスク遂行に必要な項目のみに絞られ、不要な文章・説明が非表示になっている (認知負荷の低減)

受入checkboxは実装の合格だけを表す。公開は未実施で、feature tracking は `active` のまま継続する。

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 管理画面(運営者面)と読者面の二層構造の責務境界に従い、本 feature は運営者面の UI 層と対応 API 層のみを扱う。仕様本文は system-spec の確定章 (ui-ux / frontend / backend) を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-ui-foundation, feat-distribution-hub
- 依存理由: 共通レイアウト・状態表現・入力作法 (feat-ui-foundation) の上に単一用途画面と共通コンポーネントを構築する。投稿状態の画面反映は配信実行系 (feat-distribution-hub) が持つ投稿記録データを表示面へ引くため、そのデータモデルに依存する

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
