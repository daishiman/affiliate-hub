---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P12"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "operations"
tags: ["p12","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "ドキュメント化・運用 — 孤児回収手順と管理者向け説明"
owners: ["daishiman"]
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P10","SYS-ARTICLE-BLOCK-EDITOR-P11"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/operations.md"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P12"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p12.md"
tracker_binding: "beads"
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
source_lineage: {"origin_kind":"system-dev-planner","source_digest":"sha256:9a9bfacc9dd444dfcaaf27d9ac1d83a0a3596dce3afffc094f1ace4d430eac02","source_plugin":"system-dev-planner","source_version":"0.1.0"}
---

# System task overlay: ドキュメント化・運用 — 孤児回収手順と管理者向け説明

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p12", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P12
- classification: confidence=1.0; reason=feat-article-block-editor の P12 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p12.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

孤児画像の回収運用手順 (OPS-REQ-008〜010 に対応するランブック) と管理者向けの説明文書を operations.md として生成する。画像ライフサイクル (pending 予約→R2 put→ready 確定→記事から外す→deleting→R2 delete→deleted 墓標) の各段階の説明、24時間猶予 (未参照)/30日猶予 (参照後外した) の設定根拠、掃除ジョブの実行形式 (Cron Trigger)・idempotency key・AuditLog への削除記録・失敗時の再実行手順を記載する。Worker API 経由でのアップロードに特有の途中失敗 (pending のまま残ったオブジェクト) の回収方法を明記する。

## 背景

Worker API 経由のアップロードは pending 予約後に R2 put が失敗した場合、D1 に pending のまま残る。また ready 確定の応答が不明な場合も残存する可能性がある。OPS-REQ-008〜010 の掃除ジョブは、旧 presigned PUT 方式固有の問題ではなく、Worker API 経由でも生じる状態遷移上の運用責務である (2026-09-06 の正本更新で確認済み)。本 phase はこれらの運用手順を operations.md として明文化し、P13 のリリース後に運用担当者が参照できる状態にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/maintenance-ops.md, system-spec/database.md, system-spec/infrastructure.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P10 done|closed および SYS-ARTICLE-BLOCK-EDITOR-P11 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A — 追加実装は行わない
- Backend: N/A — 追加実装は行わない
- API: N/A — 追加実装は行わない
- Data: applicable — article_image テーブルの lifecycle 状態 (pending/ready/deleting/deleted) と猶予期間設定の説明を記載する
- Infrastructure: applicable — 掃除ジョブの実行形式 (Cloudflare Cron Trigger) と R2 バインディング経由の削除手順を記載する
- Security: N/A — 追加実装は行わない
- Quality: applicable — operations.md の完全性確認が本 phase の完了条件である
- Documentation: applicable — operations.md そのものが本 phase の成果物である
- Operations: applicable — OPS-REQ-008〜010 に対応するランブックの生成が本 phase の主責務である

## Architecture and deploy unit

- Architecture decisions: system-spec/maintenance-ops.md, system-spec/database.md, system-spec/infrastructure.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 移行スクリプトが不要であることを operations.md に記録する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/operations.md (画像ライフサイクル説明・孤児回収ランブック・掃除ジョブの実行形式・猶予期間設定根拠・途中失敗 (pending残存) の回収方法・管理者向け説明・移行スクリプト不要の記録)
- Consumed artifacts: docs/spec/feat-article-block-editor/evidence.md (P11), docs/spec/feat-article-block-editor/final-review.md (P10), system-spec/maintenance-ops.md, src/domain/blogops/article-image-policy.ts, src/infrastructure/platform/article-image-reclaim.ts
- Write scope/touches: docs/spec/feat-article-block-editor/operations.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P12; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P12; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P12 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 実装コードの変更
- system-spec への書き戻し (P13 が所有する)
- 掃除ジョブの実装 (operations.md への手順記載のみ。実装は別 feature が所有する)
- presigned PUT / signed URL / R2 write CORS に関する運用手順 (採用していないため不要)

## テスト戦略

- テストレベル選定: 単体テストとして operations.md が OPS-REQ-008〜010 の3件すべてをカバーし、各ランブックに実行コマンドまたは操作手順が記載されていることを確認する。結合テストとして `ARTICLE_IMAGE_UPLOAD_GRACE_MS` (24時間) と `ARTICLE_IMAGE_UNREFERENCED_GRACE_MS` (30日) の設定値が operations.md と `article-image-policy.ts` で一致していることを確認する。境界値テストとして pending 残存の回収手順 (pending 状態で猶予経過後の deleting 遷移と R2 delete) が operations.md に記載されていることを確認する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗であることを確認する。
- カバレッジ目標: 80% — OPS-REQ-008〜010 全3件のカバレッジ確認を完了条件とする。
- 層別方針: フロントエンド — N/A: 本 phase は追加実装を行わないため behavior 検証は対象外。バックエンド — N/A: 本 phase は追加実装を行わないため API 契約テスト・DB 結合テストは対象外。インフラ — IaC 静的検証の観点で掃除ジョブの実行形式 (Cloudflare Cron Trigger) と R2 バインディング経由の削除手順を確認し、smoke テストの観点で Cron Trigger の疎通を確認する。手順書の静的確認 (記載内容の完全性・正確性) を主手段とする。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、ランブックのコマンドを operations.md に記録して別の実行者が同じ手順で再現できることを確認する。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: docs/spec/feat-article-block-editor/operations.md の存在と OPS-REQ-008〜010 全3件カバレッジの記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 孤児画像の回収運用手順 (OPS-REQ-008〜010 対応ランブック) と管理者向け説明・移行スクリプト不要の記録を operations.md として生成する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P12 の目的を満たす成果物を作らせる
- Rubric: OPS-REQ-008〜010 全3件カバレッジ・猶予期間一致確認・Worker API 固有の pending 残存回収手順の記載・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: カバレッジ不足の場合は P11/P09 の成果物を再確認し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P12 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: operations.md の生成に失敗した場合、write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P10 done + P11 done + operations.md に OPS-REQ-008〜010 全3件と Worker API 固有の回収手順が記載されている

## 参照情報

- System specification: system-spec/maintenance-ops.md, system-spec/database.md, system-spec/infrastructure.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P10, SYS-ARTICLE-BLOCK-EDITOR-P11

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
