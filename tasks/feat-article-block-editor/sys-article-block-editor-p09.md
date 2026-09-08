---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P09"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "quality"
tags: ["p09","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "品質保証 — Worker API認可境界・セキュリティ・パフォーマンス検証"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-07T15:51:18.889169Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P08"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/qa-report.md"]
purpose: "P08 のリファクタリング済み実装に対して、Worker API 認可境界の検証 (SEC-REQ-006〜008)、許可リスト描画の無害化検証 (SEC-REQ-009)、パフォーマンス計測を行い、qa-report.md に findings を記録する。特に、presigned PUT 発行エンドポイント・ブラウザ向け R2 write CORS 設定・signed URL 生成コードが実装に含まれていないことを静的検査とコードレビューで確認する。SEC-ACC-006 (presigned URL の再利用シナリオ) は本実装で採用していないため検証対象外とし、代わりに Worker API の same-origin 検証・認可拒否・マジックバイト拒否の3シナリオを検証する。"
goal: "P08 のリファクタリング済み実装に対して Worker API 認可境界の検証・SEC-REQ-006〜009 の PASS 確認・presigned PUT 不在の静的確認・パフォーマンス計測を行い、qa-report.md に findings を記録する。"
scope_in: ["Produced artifacts: docs/spec/feat-article-block-editor/qa-report.md (Worker API 認可境界の検証結果・SEC-REQ-006〜009 の PASS/FAIL・presigned PUT 不在確認・パフォーマンス計測・findings)","Consumed artifacts: src (P08 リファクタリング済み実装全量), system-spec/security.md, docs/spec/feat-article-block-editor/design-review.md","Write scope/touches: docs/spec/feat-article-block-editor/qa-report.md"]
scope_out: ["P08 実装コードの変更 (findings は P10 で対応する)","SEC-ACC-006 (presigned URL の再利用シナリオ) の検証 (本実装に presigned URL が存在しないため対象外)","presigned PUT / signed URL / R2 write CORS の動作検証 (存在しないことの静的確認のみ)"]
acceptance: ["Automated commands: `pnpm run typecheck`","Automated commands: `pnpm vitest run --reporter=dot`","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`","Required evidence: docs/spec/feat-article-block-editor/qa-report.md の存在と SEC-REQ-006〜009 の PASS 記録・presigned PUT 不在の静的検査結果"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P09"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p09.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-09-quality-assurance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P09 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p09.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 品質保証 — Worker API認可境界・セキュリティ・パフォーマンス検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p09", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P09
- classification: confidence=1.0; reason=feat-article-block-editor の P09 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P08 のリファクタリング済み実装に対して、Worker API 認可境界の検証 (SEC-REQ-006〜008)、許可リスト描画の無害化検証 (SEC-REQ-009)、パフォーマンス計測を行い、qa-report.md に findings を記録する。特に、presigned PUT 発行エンドポイント・ブラウザ向け R2 write CORS 設定・signed URL 生成コードが実装に含まれていないことを静的検査とコードレビューで確認する。SEC-ACC-006 (presigned URL の再利用シナリオ) は本実装で採用していないため検証対象外とし、代わりに Worker API の same-origin 検証・認可拒否・マジックバイト拒否の3シナリオを検証する。

## 背景

SEC-REQ-006 (現行版) は「署名付き URL を発行しない。同一生成元の Worker API でログイン・workspace・記事の編集権限を検証し、サーバー生成鍵と pending/ready 台帳を用いる」と定義されている。P09 はこの要件が実装に正しく反映されていることを独立した目線で検証する。presigned PUT 境界の検証 (旧 P09 の責務) は削除し、Worker API 認可境界の検証を責務とする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/security.md, system-spec/backend.md, system-spec/infrastructure.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P08 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A — 追加実装は行わない
- Backend: applicable — Worker API 認可フロー (`signedInActor`・`requireWorkspaceWideCapability`・`ownsImageArticle`) の独立検証を行う
- API: applicable — `POST /api/article-images` の same-origin 検証・8 MiB 上限・マジックバイト検査が R2 put 前に発生することを確認する
- Data: N/A — 追加実装は行わない
- Infrastructure: applicable — presigned URL 発行エンドポイント・R2 write CORS 設定が wrangler.toml や src に含まれていないことを静的検査で確認する
- Security: applicable — SEC-REQ-006〜009 の実装への反映を独立検証する
- Quality: applicable — qa-report.md の生成と findings の P10 への引き継ぎが本 phase の責務である
- Documentation: applicable — qa-report.md そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/security.md, system-spec/backend.md, system-spec/infrastructure.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/qa-report.md (Worker API 認可境界の検証結果・SEC-REQ-006〜009 の PASS/FAIL・presigned PUT 不在確認・パフォーマンス計測・findings)
- Consumed artifacts: src (P08 リファクタリング済み実装全量), system-spec/security.md, docs/spec/feat-article-block-editor/design-review.md
- Write scope/touches: docs/spec/feat-article-block-editor/qa-report.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P09; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P09; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- P08 実装コードの変更 (findings は P10 で対応する)
- SEC-ACC-006 (presigned URL の再利用シナリオ) の検証 (本実装に presigned URL が存在しないため対象外)
- presigned PUT / signed URL / R2 write CORS の動作検証 (存在しないことの静的確認のみ)

## テスト戦略

- テストレベル選定: 単体テストで `assertArticleImageIsStorable` の拒否パターン (PNG マジックを持つ JPEG 申告・JPEG マジックを持つ PNG 申告・8 MiB 超過・完全な空ファイル) を検証する。結合テストで認可境界 (未認証 401・same-origin 違反 403・workspace 権限不足 403・記事所属不正 404) の各ケースを `POST /api/article-images` で実行し、いずれも R2 put に到達しないことを確認する。境界値テストで 8 MiB の PNG を Worker API 経由でアップロードし Worker の CPU 時間・リクエスト時間を計測し、許可リスト外の `javascript:` リンク・許可外ホストの iframe・script 要素を仕込んだ本文の描画で除去されることを確認する。回帰テストで `pnpm vitest run` が 0件失敗で終了することを確認する。
- カバレッジ目標: 80% — SEC-REQ-006〜009 全4件の PASS 確認を完了条件とする。
- 層別方針: フロントエンド — N/A: 本 phase は追加実装を行わないため behavior 検証は対象外。バックエンド — API 契約テストで Worker API 認可フローの独立検証 (P05 実装者とは別の目線) を行い、DB 結合テストで article_image テーブルの lifecycle 遷移を確認する。インフラ — IaC 静的検証で presigned URL 発行コードと R2 write CORS 設定の不在を `grep -r` で確認し、smoke テストで Worker API 経由のアップロード疎通を確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、静的検査コマンドを qa-report.md に記録して再実行可能な形にする。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm vitest run --reporter=dot`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: docs/spec/feat-article-block-editor/qa-report.md の存在と SEC-REQ-006〜009 の PASS 記録・presigned PUT 不在の静的検査結果

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P08 のリファクタリング済み実装に対して Worker API 認可境界の検証・SEC-REQ-006〜009 の PASS 確認・presigned PUT 不在の静的確認・パフォーマンス計測を行い、qa-report.md に findings を記録する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
- Rubric: SEC-REQ-006〜009 全4件 PASS・presigned PUT 不在確認・findings の P10 引き継ぎ・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: FAIL findings は P10 で対応する。P09 は findings を記録するだけで実装を変更しない。rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P09 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: qa-report.md の生成に失敗した場合、write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P08 done + qa-report.md に SEC-REQ-006〜009 の検証結果が記録されている

## 参照情報

- System specification: system-spec/security.md, system-spec/backend.md, system-spec/infrastructure.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P08

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
