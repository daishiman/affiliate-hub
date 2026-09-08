---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P03"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "quality"
tags: ["p03","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "設計レビュー — Worker API契約とpresigned PUT残滓の不在確認"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-07T15:51:14.311373Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P02"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/design-review.md"]
purpose: "P02 の設計成果物 (architecture.md / data-model.md / api-contract.md) を独立した目線でレビューし、(1) presigned PUT・ブラウザ直接 PUT・R2 write CORS・signed URL への言及が設計文書に残っていないこと、(2) Worker API の認可・8 MiB 上限・マジックバイト検査・状態機械・same-origin 検証が設計文書で一貫していること、(3) 節/断片 2層モデルと19種カタログが要求 (P01 成果物) と整合していること、(4) セキュリティ要件 (SEC-REQ-006〜009) が設計の各層に割り当てられていること、の4点を確認し、findings を記録した design-review.md を生成する。"
goal: "P02 の設計成果物に presigned PUT 残滓が無いこと・Worker API 契約が4層で一貫していること・19種カタログが要求と整合していること・SEC-REQ-006〜009 が各層に割り当てられていることを独立に確認し、findings を design-review.md に記録する。"
scope_in: ["Produced artifacts: docs/spec/feat-article-block-editor/design-review.md (4点のレビューチェックリスト結果・findings・差し戻し判定または承認の記録)","Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/requirements-baseline.md, system-spec/security.md","Write scope/touches: docs/spec/feat-article-block-editor/design-review.md"]
scope_out: ["P02 の設計文書の書き直し (findings を P02 差し戻しとして記録し、P02 の write_scope で修正する。P03 は設計文書を上書きしない)","src の実装コードの変更","参考ブログの文章・素材・デザインの複製"]
acceptance: ["Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: docs/spec/feat-article-block-editor/design-review.md の存在と4点チェックリスト全件 PASS の記録"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P03"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p03.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-03-design-review.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P03 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p03.md","confidence":1.0}]
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

# System task overlay: 設計レビュー — Worker API契約とpresigned PUT残滓の不在確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p03", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P03
- classification: confidence=1.0; reason=feat-article-block-editor の P03 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計成果物 (architecture.md / data-model.md / api-contract.md) を独立した目線でレビューし、(1) presigned PUT・ブラウザ直接 PUT・R2 write CORS・signed URL への言及が設計文書に残っていないこと、(2) Worker API の認可・8 MiB 上限・マジックバイト検査・状態機械・same-origin 検証が設計文書で一貫していること、(3) 節/断片 2層モデルと19種カタログが要求 (P01 成果物) と整合していること、(4) セキュリティ要件 (SEC-REQ-006〜009) が設計の各層に割り当てられていること、の4点を確認し、findings を記録した design-review.md を生成する。

## 背景

P02 で presigned PUT を前提にした設計が混入していないかを独立に検査する必要がある。Worker API 契約 (pending 予約→R2 put→ready 確定の状態機械・8 MiB サーバー強制・マジックバイト先行検査) は 2026-09-06 の承認で確定しており、この決定と矛盾する設計残滓が P05 実装に持ち込まれると後続の QA コストが高くなる。本 phase は実装前の最後の設計ゲートである。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P02 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — 節/断片 2層 UI 設計と19種コンポーネント構成が要求と整合しているか確認する
- Backend: applicable — Worker API の認可フロー・状態機械・エラーコードが設計文書で一貫しているか確認する
- API: applicable — `POST /api/article-images` の契約に presigned PUT・signed URL への言及が無いことを確認する
- Data: applicable — article_image テーブルの lifecycle 状態機械 (pending/ready/deleting/deleted) が data-model.md で正確に定義されているか確認する
- Infrastructure: applicable — R2 write CORS 設定・presigned URL 発行の設計が architecture.md / api-contract.md に含まれていないことを確認する
- Security: applicable — SEC-REQ-006〜009 が設計の各層に割り当てられているか確認する
- Quality: applicable — 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable — design-review.md そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/design-review.md (4点のレビューチェックリスト結果・findings・差し戻し判定または承認の記録)
- Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/requirements-baseline.md, system-spec/security.md
- Write scope/touches: docs/spec/feat-article-block-editor/design-review.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P03; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P03; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P03 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- P02 の設計文書の書き直し (findings を P02 差し戻しとして記録し、P02 の write_scope で修正する。P03 は設計文書を上書きしない)
- src の実装コードの変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体テストとして設計文書内の "presigned PUT"・"signed URL"・"direct PUT"・"R2 write CORS"・"R2 CORS" の文字列検索を行い、検出 0件であることを確認する。結合テストとして architecture.md・data-model.md・api-contract.md の各文書が P01 要求ベースラインの4点 (Worker API 認可・8 MiB・マジックバイト・状態機械) を各1箇所以上でカバーしていることを文書間照合で確認する。境界値テストとして19種カタログが P01 block-catalog-decisions.md と1対1で一致することを文書間の照合で確認する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗のまま維持されることを確認する。
- カバレッジ目標: 80% — 4点のレビューチェックリスト全件 PASS を完了条件とする。本 phase が生成するコードは無いため、カバレッジ数値は文書カバレッジとして適用する。
- 層別方針: フロントエンド — 節/断片 2層 UI 設計と19種コンポーネント構成が要求と整合していることを behavior 検証の設計観点で確認する。バックエンド — API 契約テストの観点で Worker API の認可フロー・状態機械・エラーコードが設計文書で一貫しているか確認し、DB 結合テストの観点で article_image テーブルの lifecycle 状態機械が data-model.md で正確に定義されているか確認する。インフラ — IaC 静的検証の観点で R2 write CORS 設定・presigned URL 発行の設計が architecture.md / api-contract.md に含まれていないことを確認し、smoke テストの観点で疎通確認の設計が存在するか確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、レビューチェックリストの判定基準を design-review.md に明記して再実行可能な形で残す。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: docs/spec/feat-article-block-editor/design-review.md の存在と4点チェックリスト全件 PASS の記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計成果物に presigned PUT 残滓が無いこと・Worker API 契約が4層で一貫していること・19種カタログが要求と整合していること・SEC-REQ-006〜009 が各層に割り当てられていることを独立に確認し、findings を design-review.md に記録する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P03 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・4点チェックリスト全件 PASS・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の4点をすべて満たすこと
- Feedback loop: findings が有る場合は P02 へ差し戻し、findings を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P03 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P03 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P02 done + design-review.md の4点チェックリスト全件 PASS が記録されている

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P02

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
