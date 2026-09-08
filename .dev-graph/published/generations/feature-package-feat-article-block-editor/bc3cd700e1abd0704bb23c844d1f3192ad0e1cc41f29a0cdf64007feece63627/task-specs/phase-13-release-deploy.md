---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P13"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "operations"
tags: ["p13","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "開発環境へのリリースとWorker API決定のsystem-specへの書き戻し"
owners: ["daishiman"]
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P12"]
related_nodes: []
resource_scope: ["system-spec/frontend.md","system-spec/backend.md","system-spec/database.md","system-spec/infrastructure.md","system-spec/security.md","docs/spec/feat-article-block-editor/release.md"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P13"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p13.md"
tracker_binding: "beads"
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
source_lineage: {"origin_kind":"system-dev-planner","source_digest":"sha256:9a9bfacc9dd444dfcaaf27d9ac1d83a0a3596dce3afffc094f1ace4d430eac02","source_plugin":"system-dev-planner","source_version":"0.1.0"}
---

# System task overlay: 開発環境へのリリースとWorker API決定のsystem-specへの書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p13", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P13
- classification: confidence=1.0; reason=feat-article-block-editor の P13 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

変更を dev ブランチへのマージを経て開発環境へ出し、実装で確定した19種断片カタログ・保存形式 (`decisions[].dec-article-body-storage-format` = 拡張 Markdown 文字列維持)・Worker API 画像アップロード契約 (同一生成元 Worker API・8 MiB 上限・マジックバイト検査・pending 予約→R2 put→ready 確定・presigned URL 不採用) を system-spec の各章 (frontend.md / backend.md / database.md / infrastructure.md / security.md) へ書き戻し、切り戻し手順を記載した release.md を生成する。

## 背景

P13 は本 package の中で唯一 system-spec への書き戻しを所有する phase であり、実装で確定した決定を正本へ反映する。特に、2026-09-06 の承認 (`approval-article-image-upload-path-worker-20260906`) による画像アップロード経路の変更 (presigned PUT → Worker API) は、system-spec の BE-IMAGE-01/INF-IMG-01〜05/SEC-REQ-006〜008 に現行の確定内容として書き戻す必要がある。この書き戻しは旧 presigned PUT の記述を現行 Worker API 契約に同期させるものであり、spec-state.json の決定状態との整合を保つ。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P12 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A — 追加実装は行わない
- Backend: N/A — 追加実装は行わない
- API: N/A — 追加実装は行わない
- Data: N/A — 追加実装は行わない
- Infrastructure: applicable — 開発環境へのリリースそのものが本 phase の責務である (wrangler deploy / D1 マイグレーション適用)
- Security: N/A — 追加実装は行わない
- Quality: applicable — リリース後の疎通確認 (smoke) を行う
- Documentation: applicable — system-spec への書き戻しと release.md の生成が本 phase の成果物である
- Operations: applicable — 切り戻し手順の記載が本 phase の責務である

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーション不要。D1 の article_image テーブルマイグレーション (drizzle/ 配下) を開発環境へ適用する。

## 成果物

- Produced artifacts: system-spec/frontend.md への書き戻し (FRONT-REQ-005〜008 の19種断片カタログ確定); system-spec/backend.md への書き戻し (BE-PROSE-01〜03・BE-IMAGE-01 の Worker API 契約確定); system-spec/database.md への書き戻し (DB-IMAGE-01〜03 の lifecycle 状態機械確定); system-spec/infrastructure.md への書き戻し (INF-IMG-01〜05 の Worker API 方式確定); system-spec/security.md への書き戻し (SEC-REQ-006〜008 の Worker API 認可・マジックバイト・same-origin 制約の確定、presigned URL 不採用の記録); docs/spec/feat-article-block-editor/release.md (リリース記録・開発環境疎通確認・切り戻し手順)
- Consumed artifacts: docs/spec/feat-article-block-editor/evidence.md (P11), docs/spec/feat-article-block-editor/operations.md (P12)
- Write scope/touches: system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, docs/spec/feat-article-block-editor/release.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P13; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P13; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO の構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴 UI と差分表示、商品データそのものの取込・更新) に該当する変更
- 実装コードの変更 (system-spec への書き戻しと release.md の生成のみを行う)
- presigned URL / ブラウザ直接 PUT / R2 write CORS の system-spec への追記 (採用していないため追記しない)
- system-spec 内の他 feature の要件との整合 (本 feature の担当範囲のみを書き戻す)

## テスト戦略

- テストレベル選定: 単体テストとして system-spec の各章の書き戻し内容が evidence.md の確定内容と一致していることを文書間照合で確認する。結合テストとして dev 環境で編集面 (WYSIWYG)・画像 Worker API アップロード (`POST /api/article-images`)・公開ページの許可リスト描画の3経路を疎通確認する。境界値テストとして release.md の切り戻し手順が1名の運用担当者が手順通りに実行できる粒度で記載されていることを確認する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗であることを確認する。
- カバレッジ目標: 80% — smoke 3経路すべての PASS と system-spec 5章 (frontend/backend/database/infrastructure/security) への書き戻し完了を完了条件とする。
- 層別方針: フロントエンド — N/A: 本 phase は追加実装を行わないため behavior 検証は対象外。バックエンド — N/A: 本 phase は追加実装を行わないため API 契約テスト・DB 結合テストは対象外。インフラ — IaC 静的検証で dev 環境へのデプロイと D1 マイグレーション適用が wrangler.toml の定義通りに反映されることを確認し、smoke テストで3経路の疎通確認を実施する。ドキュメント — system-spec への書き戻しは presigned URL の記述を Worker API 契約に同期させる形で行い、spec-state.json の決定状態との整合を確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、smoke の手順を release.md に記録して再実行可能な形にする。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: docs/spec/feat-article-block-editor/release.md の存在と smoke 3経路の PASS 記録・system-spec 5章への書き戻し完了の記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 変更を dev ブランチへのマージを経て開発環境へ出し、実装で確定した19種断片カタログ・保存形式 (拡張 Markdown 文字列維持)・Worker API 画像アップロード契約 (presigned URL 不採用・8 MiB 上限・マジックバイト検査・pending→ready 状態機械) を system-spec の各章へ書き戻し、切り戻し手順を記載した release.md を生成する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: dev ブランチマージ完了・smoke 3経路 PASS・system-spec 5章への書き戻し完了・release.md の切り戻し手順記載・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の6点をすべて満たすこと
- Feedback loop: smoke で問題が発生した場合は切り戻し手順を実行し、P05/P08 へ差し戻し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: required — 実装で確定した19種断片カタログ・保存形式決定 (拡張 Markdown 文字列維持)・Worker API 画像アップロード契約 (BE-IMAGE-01/INF-IMG-01〜05/SEC-REQ-006〜008 の現行確定版) を system-spec/frontend.md / system-spec/backend.md / system-spec/database.md / system-spec/infrastructure.md / system-spec/security.md へ書き戻す。presigned URL・ブラウザ直接 PUT・R2 write CORS は書き戻しの対象に含めない (採用しないことが確定している)。

## Rollout and rollback

- Rollout: dev ブランチへのマージ後に wrangler deploy で開発環境へデプロイし、D1 マイグレーションを適用し、smoke で疎通確認する。system-spec への書き戻しを行い、release.md を生成する。
- Rollback trigger and steps: smoke で問題が発生した場合、release.md の切り戻し手順に従い dev ブランチを前の状態へ revert し、開発環境を前のデプロイへ切り戻す。system-spec への書き戻しも revert する。

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P12 done + dev ブランチマージ完了 + smoke PASS + system-spec 書き戻し完了 + release.md 生成

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P12

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
