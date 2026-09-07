---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "frontend"
tags: ["p05","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "ブロックエディターWYSIWYG化とWorker API画像アップロード・許可リスト描画の実装"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-07T15:51:15.836446Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P04"]
related_nodes: []
resource_scope: ["src/domain/blogops","src/domain/authoring/article-structure.ts","src/presentation/prose","src/presentation/admin/publish","src/application/ports","src/application/usecases","src/infrastructure/persistence/d1","src/infrastructure","src/db/schema.ts","drizzle","src/app/admin","src/app/api","src/app/s","worker-entry.js","tests"]
purpose: "P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張し (既に `prose-node.ts` で実装済みの場合は確認・補完)、`prose-editor.tsx` を入力欄集約から WYSIWYG へ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像を同一生成元 Worker API (`POST /api/article-images`) への multipart/form-data 送信でアップロードできるようにし (presigned PUT・ブラウザ直接 PUT・R2 write CORS は実装しない)、公開ページの描画を許可リストで絞り込む。P04 が指定したテストケースを緑化することを完了条件とする。"
goal: "P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張・確認し、prose-editor.tsx を WYSIWYG へ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像を同一生成元 Worker API への送信でアップロードできるようにし (presigned PUT・ブラウザ直接 PUT・R2 write CORS は実装しない)、公開ページの描画を許可リストで絞り込む。"
scope_in: ["Produced artifacts: src/domain/blogops/ (ProseNode 19種の確認・prose-format.ts の相互変換完成); src/presentation/prose/ (prose-editor.tsx 等の WYSIWYG 化・商品検索選択 UI・画像 Worker API 送信 UI); src/presentation/admin/publish/ (節/断片2層の UI 表現); src/application/ports/ と src/application/usecases/ (画像参照 port/usecase・商品検索 usecase の確認・補完); src/infrastructure/persistence/d1/ (article-image-repository の確認・補完); src/db/schema.ts と drizzle/ (article_image テーブルとマイグレーションの確認・補完); src/app/api/ (Worker API ルートハンドラの確認・補完・presigned PUT エンドポイントの不在確認); src/app/s/ (公開ページの許可リストレンダラ); 上記に対応する tests/ 配下のテスト","Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/test-design.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md, src/application/ports/product.ts","Write scope/touches: src/domain/blogops, src/domain/authoring/article-structure.ts, src/presentation/prose, src/presentation/admin/publish, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/infrastructure, src/db/schema.ts, drizzle, src/app/admin, src/app/api, src/app/s, worker-entry.js, tests"]
scope_out: ["feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO の構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴 UI と差分表示、商品データそのものの取込・更新) に該当する変更","presigned PUT 発行 API・ブラウザ向け R2 write CORS 設定・signed URL 生成の実装 (採用しないことが確定している)","src/domain/authoring/blog-template.ts の ExpressionBlock レジストリと src/application/adapters/expression-article-block.ts の型・変換ロジックの書き換え","src/presentation/site/expression-block-view.tsx が担う表現ブロック描画の変更","参考ブログの文章・素材・デザインの複製"]
acceptance: ["Automated commands: `pnpm run typecheck`","Automated commands: `pnpm run lint`","Automated commands: `pnpm vitest run --reporter=dot` (P04 が指定した回帰スイートを含む全量)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P05 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P05"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p05.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P05 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p05.md","confidence":1.0}]
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

# System task overlay: ブロックエディターWYSIWYG化とWorker API画像アップロード・許可リスト描画の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p05", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P05
- classification: confidence=1.0; reason=feat-article-block-editor の P05 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張し (既に `prose-node.ts` で実装済みの場合は確認・補完)、`prose-editor.tsx` を入力欄集約から WYSIWYG へ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像を同一生成元 Worker API (`POST /api/article-images`) への multipart/form-data 送信でアップロードできるようにし (presigned PUT・ブラウザ直接 PUT・R2 write CORS は実装しない)、公開ページの描画を許可リストで絞り込む。P04 が指定したテストケースを緑化することを完了条件とする。

## 背景

`src/app/api/article-images/route.ts` は Worker が認可・8 MiB 上限・マジックバイト検査・pending 予約→R2 put→ready 確定を実装済みである。`src/domain/blogops/prose-node.ts` には19種の `ProseNode` 型と `PROSE_NODE_KINDS` が定義済みである。`src/domain/blogops/article-image-policy.ts` には `assertArticleImageIsStorable`・`articleImageKey`・`articleImageHref` が実装済みである。本 phase は未実装の編集面 WYSIWYG 化・商品検索選択 UI・画像送信 UI (Worker API 呼び出し)・許可リストレンダラを実装し、P04 で設計したテストスイートを緑化する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P04 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — prose-editor.tsx 等の編集面を WYSIWYG 化し、商品検索選択 UI と画像 Worker API 送信 UI を実装する
- Backend: applicable — 画像参照 port/usecase を確認・補完し、商品検索 usecase を配線する
- API: applicable — `POST /api/article-images` の配線確認と商品検索連携の実装を行う
- Data: applicable — article_image テーブルと drizzle マイグレーションと repository を確認・補完する
- Infrastructure: applicable — R2 バケットへの書き込みを Worker binding 経由で行う配線を確認し、CORS 設定・presigned URL 発行エンドポイントを実装しないことを確認する
- Security: applicable — 公開ページの許可リストレンダラを実装し、許可外の断片・属性・スタイルを出力しない
- Quality: applicable — P04 の設計テストを緑化することを完了条件とする
- Documentation: N/A — 文書化は P12 が所有する
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: src/domain/blogops/ (ProseNode 19種の確認・prose-format.ts の相互変換完成); src/presentation/prose/ (prose-editor.tsx 等の WYSIWYG 化・商品検索選択 UI・画像 Worker API 送信 UI); src/presentation/admin/publish/ (節/断片2層の UI 表現); src/application/ports/ と src/application/usecases/ (画像参照 port/usecase・商品検索 usecase の確認・補完); src/infrastructure/persistence/d1/ (article-image-repository の確認・補完); src/db/schema.ts と drizzle/ (article_image テーブルとマイグレーションの確認・補完); src/app/api/ (Worker API ルートハンドラの確認・補完・presigned PUT エンドポイントの不在確認); src/app/s/ (公開ページの許可リストレンダラ); 上記に対応する tests/ 配下のテスト
- Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/test-design.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md, src/application/ports/product.ts
- Write scope/touches: src/domain/blogops, src/domain/authoring/article-structure.ts, src/presentation/prose, src/presentation/admin/publish, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/infrastructure, src/db/schema.ts, drizzle, src/app/admin, src/app/api, src/app/s, worker-entry.js, tests

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P05; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (src, drizzle, tests, worker-entry.js, docs/spec, system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO の構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴 UI と差分表示、商品データそのものの取込・更新) に該当する変更
- presigned PUT 発行 API・ブラウザ向け R2 write CORS 設定・signed URL 生成の実装 (採用しないことが確定している)
- src/domain/authoring/blog-template.ts の ExpressionBlock レジストリと src/application/adapters/expression-article-block.ts の型・変換ロジックの書き換え
- src/presentation/site/expression-block-view.tsx が担う表現ブロック描画の変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体テストで `assertArticleImageIsStorable` の8 MiB 境界値・マジックバイト一致・MIME 申告不一致の純関数テスト、`parseProse`/`serializeProse` の19種往復テスト (`parseProse(serializeProse(nodes)) === nodes`)、許可リスト判定関数の19種×許可外属性パターンテストを実行する。結合テストで `POST /api/article-images` ルートハンドラへの multipart/form-data 送信テスト (未認証/same-origin違反/8 MiB超過/マジックバイト不一致のそれぞれが R2 put 前に拒否されること、成功時に pending→ready の D1 遷移が起きること)、article_image テーブルへの D1 結合テストを実行する。境界値テストで tests/e2e/block-editor-publish.e2e.ts を P04 設計に沿って実装する。回帰テストで `pnpm vitest run --reporter=dot` により P04 指定スイートを含む全量を 0件失敗で通す。
- カバレッジ目標: 80% — 新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/app/api/article-images) に適用する。
- 層別方針: フロントエンド — 実装した prose-editor.tsx 等の編集面を P04 が設計した behavior 検証 (可視ラベル・アクセシブル名) に通す。バックエンド — API 契約テストで Worker API ルートハンドラ (`/api/article-images`) の実装を P04 の境界値テストに通し、DB 結合テストで article-image-repository の実装を D1 往復で検証する。インフラ — IaC 静的検証で R2 バケットへの書き込みが Worker binding 経由になっていること (CORS 設定なし・presigned URL 不使用) を確認し、smoke テストで `src/app/api/article-images/route.ts` の動作確認を行う。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm run lint`
- Automated commands: `pnpm vitest run --reporter=dot` (P04 が指定した回帰スイートを含む全量)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張・確認し、prose-editor.tsx を WYSIWYG へ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像を同一生成元 Worker API への送信でアップロードできるようにし (presigned PUT・ブラウザ直接 PUT・R2 write CORS は実装しない)、公開ページの描画を許可リストで絞り込む。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定 80%) green・既存テストの回帰 0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、findings を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P04 done + 全テストが緑 + typecheck/lint PASS

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P04

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
