---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P02"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "documentation"
tags: ["p02","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "ブロックエディター描画・保存契約とWorker API画像アップロード経路の設計"
owners: ["daishiman"]
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P01"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/architecture.md","docs/spec/feat-article-block-editor/data-model.md","docs/spec/feat-article-block-editor/api-contract.md"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P02"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p02.md"
tracker_binding: "beads"
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
source_lineage: {"origin_kind":"system-dev-planner","source_digest":"sha256:9a9bfacc9dd444dfcaaf27d9ac1d83a0a3596dce3afffc094f1ace4d430eac02","source_plugin":"system-dev-planner","source_version":"0.1.0"}
---

# System task overlay: ブロックエディター描画・保存契約とWorker API画像アップロード経路の設計

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p02", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P02
- classification: confidence=1.0; reason=feat-article-block-editor の P02 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p02.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01 の要求に沿って、節 (外側・ArticleBlockKind・見出し2固定) / 断片 (内側・ProseNode・見出し3/4) 2層の UI 表現契約、`/` 挿入メニューの19種構成と5群分類 (文章/一覧/見せ方/データ/差し込み)、19種それぞれの編集面コンポーネント構成と公開ページ描画部品の共有方式、拡張 Markdown ⇄ ProseNode 木の変換規則の追加分、商品検索結果選択 UI の契約、同一生成元 Worker API (`POST /api/article-images`) による画像アップロード経路の設計と Editorial D1 の画像参照テーブル (DB-IMAGE-01〜03) の設計、公開ページ許可リストレンダラの設計を確定する。presigned PUT 発行 API は設計対象に含めない。

## 背景

`src/app/api/article-images/route.ts` は Worker が multipart/form-data を受信し、認可・8 MiB 上限・マジックバイト検査を行い、`reserveArticleImage` (pending 予約) → `putArticleImageObject` (R2 書き込み) → `finalizeArticleImage` (ready 確定) の3段階で画像を登録する実装が済んでいる。`src/db/schema.ts` には `article_image` テーブルと `articleImageSweepState`・`articleImageReferenceTexts` ビューが定義されている。本 phase はこれらの実装を設計文書へ接地させ、後続 phase が実装・テスト・検証の根拠として使える形にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P01 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — 節/断片2層の UI 表現と19種の編集面コンポーネント構成、商品検索選択 UI、公開ページ描画部品の共有方式を設計する
- Backend: applicable — 画像参照 port/usecase と Worker API ルートハンドラ (`/api/article-images`) の設計を確定する
- API: applicable — Worker API (`POST /api/article-images`) の契約 (multipart/form-data フィールド・レスポンス JSON・エラーコード・認可要件) と商品検索 API の契約を設計する
- Data: applicable — 画像参照テーブル (article_image) の列定義・索引・lifecycle 状態機械 (pending/ready/deleting/deleted) を設計する
- Infrastructure: applicable — R2 バケットへの書き込みを Worker binding 経由に限定し、ブラウザ向け CORS 設定や presigned URL を持たない設計を確定する
- Security: applicable — 公開ページ許可リストレンダラ (許可外の断片・属性・スタイルを出力しない) の設計と same-origin 検証の組み込み位置を設計する
- Quality: applicable — 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable — 設計文書そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/architecture.md (2層 UI 表現・19種コンポーネント構成・許可リストレンダラの設計); docs/spec/feat-article-block-editor/data-model.md (article_image テーブルと ProseNode 拡張の列/属性定義・lifecycle 状態機械); docs/spec/feat-article-block-editor/api-contract.md (Worker API `POST /api/article-images` の契約と商品検索連携の契約、presigned PUT 不採用の根拠記録)
- Consumed artifacts: docs/spec/feat-article-block-editor/requirements-baseline.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md, src/presentation/prose/prose-editor.tsx, src/presentation/prose/prose-body.tsx, src/app/api/article-images/route.ts, src/infrastructure/platform/article-image-r2.ts, src/domain/blogops/article-image-policy.ts, src/db/schema.ts, src/application/ports/product.ts
- Write scope/touches: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P02; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P02; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P02 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO の構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴 UI と差分表示、商品データそのものの取込・更新) に該当する変更
- presigned PUT 発行 API の設計 (採用しないことが確定しており、設計対象に含めない)
- ブラウザ向け R2 write CORS 設定の設計 (同上)
- src/presentation/site/expression-block-view.tsx が担う表現ブロック描画の変更

## テスト戦略

- テストレベル選定: 単体テストで ProseNode 19種の parse/serialize 純関数、許可リスト判定関数、`assertArticleImageIsStorable` (8 MiB 上限・マジックバイト検査) を入力から出力で検証する。結合テストで編集面から保存・再読込までの往復、Worker API 経由の画像アップロードから R2 参照確定 (ready 状態) までの経路、商品検索から断片挿入までの経路を検証する。境界値テストで 8 MiB 以下成功/8 MiB 超過拒否/許可外 MIME (SVG 等) 拒否/MIME 申告と実バイト不一致拒否/未認証拒否/same-origin 違反拒否/記事所属不正拒否を検証する。回帰テストで既存 tests/ 配下の全スイートを 0件失敗のまま維持する。
- カバレッジ目標: 80% — 新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/app/api/article-images) に適用する。
- 層別方針: フロントエンド — 節/断片2層の UI 設計と19種の編集面コンポーネント構成を、可視ラベルとアクセシブル名による behavior 検証が成立する境界で設計する。バックエンド — API 契約テスト (multipart/form-data フィールド・レスポンス JSON・エラーコード・認可要件・8 MiB 上限・マジックバイト検査) を明文化し、画像参照 port/usecase を DB 結合テスト (pending/ready/deleting/deleted ライフサイクルの D1 往復) で検証可能な形に設計する。インフラ — IaC 静的検証 (wrangler.toml の R2 バケット/バインディング定義) で R2 バケットへの書き込みが Worker binding 限定であることを確認し、smoke テストで疎通確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P02 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P01 の要求に沿って、節/断片2層の UI 表現契約、`/` 挿入メニューの19種構成、19種それぞれの編集面コンポーネント構成と公開ページ描画部品の共有方式、拡張 Markdown ⇄ ProseNode 木の変換規則の追加分、商品検索結果選択 UI の契約、Worker API `POST /api/article-images` と Editorial D1 の画像参照テーブル (DB-IMAGE-01〜03) の設計、公開ページ許可リストレンダラの設計を確定する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P02 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定 80%) green・既存テストの回帰 0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、findings を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P02 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P02 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価が confirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P01

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
