---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P04"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "quality"
tags: ["p04","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "受入7件に対応するテスト設計 (Worker API境界値含む)"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-08T08:00:05.938144Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P03"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/test-design.md"]
purpose: "A1-A7 の各項目に対して最低1件の落とせるテストケースを対応づけ、19種の断片それぞれの挿入・編集・公開描画、見出しレベル固定の挿入・移動・削除・貼り付け全操作、商品検索 0件/複数件、Worker API 画像アップロードの境界値 (8 MiB 以下成功・8 MiB 超過拒否・許可外 MIME 拒否・MIME 申告と実バイト不一致拒否・未認証拒否・same-origin 違反拒否・記事所属不正拒否・pending→R2 put 失敗時の挙動・R2 put→ready 確定失敗時の挙動)、許可リスト外タグ混入時の無害化、既存 10種の断片で書かれた記事の読み込みと再保存の不変性を境界値として列挙し、既存回帰スイートを名前で指定する。"
goal: "A1-A7 の各項目に対して最低1件の落とせるテストケースを対応づけ、Worker API の画像アップロード境界値 (8 MiB 上限・マジックバイト検査・認可・same-origin・状態機械) を含む境界値ケースを列挙し、既存回帰スイートを名前で指定する。"
scope_in: ["Produced artifacts: docs/spec/feat-article-block-editor/test-design.md (A1-A7 対応表・Worker API 境界値ケース・回帰スイート指定)","Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/design-review.md","Write scope/touches: docs/spec/feat-article-block-editor/test-design.md"]
scope_out: ["feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO、公開ページ側の読者導線、管理画面全体の再編、複数媒体向け原稿生成、複数人同時編集、バージョン履歴 UI、商品データ取込・更新) に該当するテストケース","presigned PUT / signed URL / ブラウザ直接 PUT / R2 write CORS のテストシナリオ (採用しないことが確定しており、テスト対象に含めない)","P05 実装コードそのもの (テスト設計文書のみを書く)"]
acceptance: ["Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: docs/spec/feat-article-block-editor/test-design.md の存在と A1-A7 対応表・Worker API 境界値・回帰スイート指定の記載"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P04"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p04.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-04-test-design.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P04 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p04.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ibyh","github_mirror":null,"linked_at":"2026-09-08T07:14:07Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 受入7件に対応するテスト設計 (Worker API境界値含む)

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p04", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P04
- classification: confidence=1.0; reason=feat-article-block-editor の P04 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p04.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

A1-A7 の各項目に対して最低1件の落とせるテストケースを対応づけ、19種の断片それぞれの挿入・編集・公開描画、見出しレベル固定の挿入・移動・削除・貼り付け全操作、商品検索 0件/複数件、Worker API 画像アップロードの境界値 (8 MiB 以下成功・8 MiB 超過拒否・許可外 MIME 拒否・MIME 申告と実バイト不一致拒否・未認証拒否・same-origin 違反拒否・記事所属不正拒否・pending→R2 put 失敗時の挙動・R2 put→ready 確定失敗時の挙動)、許可リスト外タグ混入時の無害化、既存 10種の断片で書かれた記事の読み込みと再保存の不変性を境界値として列挙し、既存回帰スイートを名前で指定する。

## 背景

受入 A5 (画像の Worker API アップロード — 8 MiB 超過・許可外 MIME・MIME 不一致・未認証・same-origin 違反をすべて R2 保存前に拒否) と A3 (19種すべての挿入・編集・公開一致) と A7 (既存 10種記事の不変性) は組合せ数が大きく、境界値を先に固定しないと P05 実装時にテストが後追いになる。P03 で承認された設計成果物を根拠に、テストケースを先に確定する。Worker API のテストシナリオは presigned PUT シナリオを含まない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P03 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — 編集面コンポーネントの単体・結合テストケースを設計する (UIUX-ACC-005〜008)
- Backend: applicable — 保存形式往復・画像参照 usecase・Worker API ルートハンドラのテストケースを設計する (BE-PROSE-01〜03, BE-IMAGE-01)
- API: applicable — `POST /api/article-images` の境界値テストケース (8 MiB 上限・マジックバイト・same-origin・認可・状態機械) を設計する
- Data: applicable — article_image テーブルとマイグレーションのテストケースを設計する (DB-IMAGE-01〜03)
- Infrastructure: N/A — デプロイ単位を変更しない
- Security: applicable — SEC-ACC-006〜009 に対応するテストケースを設計する (Worker API 経由の認可境界・マジックバイト検査・許可リスト無害化)
- Quality: applicable — 回帰スイート指定と境界値の網羅が本 phase の責務である
- Documentation: applicable — テスト設計文書そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/test-design.md (A1-A7 対応表・Worker API 境界値ケース・回帰スイート指定)
- Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/design-review.md
- Write scope/touches: docs/spec/feat-article-block-editor/test-design.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P04; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P04; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P04 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO、公開ページ側の読者導線、管理画面全体の再編、複数媒体向け原稿生成、複数人同時編集、バージョン履歴 UI、商品データ取込・更新) に該当するテストケース
- presigned PUT / signed URL / ブラウザ直接 PUT / R2 write CORS のテストシナリオ (採用しないことが確定しており、テスト対象に含めない)
- P05 実装コードそのもの (テスト設計文書のみを書く)

## テスト戦略

- テストレベル選定: 単体テストで `assertArticleImageIsStorable` (8 MiB 上限・マジックバイト・MIME 一致) の純関数テスト、`parseProse`/`serializeProse` の19種往復テスト、許可リスト判定関数の入力パターンテストを設計する。結合テストで `POST /api/article-images` の multipart/form-data ハンドラに対する認可境界テスト (未認証/same-origin違反/workspace 権限不足/記事所属不正)、8 MiB 上限 boundary (8388608 byte PASS / 8388609 byte FAIL)、マジックバイト不一致 (PNG マジックを持つが Content-Type=image/jpeg と申告した場合の拒否)、pending→ready の D1 往復テストを設計する。境界値テストで19種断片の挿入・編集・公開描画一致 (UIUX-ACC-005)、見出しレベル固定操作 (UIUX-ACC-006)、挿入ボタン経由19種到達 (UIUX-ACC-007)、商品カード検索挿入と画像 Worker API 添付 (UIUX-ACC-008) を設計する。回帰テストで tests/domain/blogops/prose-format.test.ts / tests/infrastructure/article-image-storage-failure.test.ts / tests/integration/d1-article-image-lifecycle.test.ts 等の既存スイートを名前で指定する。
- カバレッジ目標: 80% — 新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/app/api/article-images) に適用する。
- 層別方針: フロントエンド — 編集面の behavior 検証を可視ラベル・アクセシブル名で行う。バックエンド — API 契約テストで Worker API の各境界値ケースを検証し、DB 結合テストで article_image テーブルの lifecycle 遷移 (pending/ready/deleting/deleted) を D1 往復で検証する。インフラ — N/A: 本 phase はデプロイ単位を変更しないため IaC 静的検証・smoke テストは対象外。セキュリティ — SEC-ACC-006 の「2回 PUT が期限内に成功」シナリオを削除し、Worker API の same-origin 検証・認可拒否・マジックバイト拒否の3シナリオに置き換える。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: docs/spec/feat-article-block-editor/test-design.md の存在と A1-A7 対応表・Worker API 境界値・回帰スイート指定の記載

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: A1-A7 の各項目に対して最低1件の落とせるテストケースを対応づけ、Worker API の画像アップロード境界値 (8 MiB 上限・マジックバイト検査・認可・same-origin・状態機械) を含む境界値ケースを列挙し、既存回帰スイートを名前で指定する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P04 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・A1-A7 全件のテストケース対応・Worker API 境界値の網羅・回帰スイート名前指定・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の6点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P09/P10 相当) へ渡し、findings を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P04 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P04 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P03 done + test-design.md の A1-A7 対応表と Worker API 境界値ケースが記載されている

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P03

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
