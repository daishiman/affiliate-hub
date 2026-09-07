---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "documentation"
tags: ["p01","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "19種断片カタログと保存形式・Worker API画像契約の要求ベースライン確定"
owners: ["daishiman"]
status: "active"
depends_on: []
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/requirements-baseline.md","docs/spec/feat-article-block-editor/block-catalog-decisions.md","docs/spec/feat-article-block-editor/image-upload-decisions.md"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P01"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p01.md"
tracker_binding: "beads"
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
source_lineage: {"origin_kind":"system-dev-planner","source_digest":"sha256:9a9bfacc9dd444dfcaaf27d9ac1d83a0a3596dce3afffc094f1ace4d430eac02","source_plugin":"system-dev-planner","source_version":"0.1.0"}
---

# System task overlay: 19種断片カタログと保存形式・Worker API画像契約の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p01", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P01
- classification: confidence=1.0; reason=feat-article-block-editor の P01 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-article-block-editor の受入7件 (A1-A7) を実装着手前に一意で検証可能な要求ベースラインへ確定する。19種の断片カタログ (現行10種 + code/table/image-row/toggle/checklist/embed/cta-button/link-card/columns の追加9種) の名称・属性・保存形式表現、拡張Markdown文字列 (prose-format.ts) と ProseNode 木の相互変換規約、画像参照の正本 (Editorial 側 D1 の article_image テーブル) と同一生成元 Worker API (`POST /api/article-images`) によるアップロード契約、公開ページ描画の許可リストの範囲を、実装済みの `src/domain/blogops/prose-node.ts` (19種・373行) と `src/app/api/article-images/route.ts` (138行) の実測に接地させて決める。

## 背景

現行実装では `prose-node.ts` に19種 (`PROSE_NODE_KINDS`) が定義済みであり、`src/app/api/article-images/route.ts` の Worker API が画像受信・認可・バイト署名検査・R2 保存・台帳更新を実装している。2026-09-06 の承認 (`approval-article-image-upload-path-worker-20260906`) により、旧 presigned PUT 案は採用しないことが確定した。本 phase はこれらの実態に要求ベースラインを接地させ、後続 phase が参照できる検証可能な文書を確定する。Worker API 契約の要点は、(1) 8 MiB 上限をサーバー側で強制、(2) object key はサーバーが生成しクライアントは指定不可、(3) ログイン・workspace・記事の編集権限を Worker が検証、(4) PNG/JPEG/WebP/GIF のマジックバイト検査を R2 write 前に実施、(5) pending 予約→R2 put→ready 確定の状態機械、(6) presigned URL・ブラウザ直接 PUT・R2 write CORS を採用しない、の6点である。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: P01 upstream entry gate — parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A — 本 phase は編集面・公開面のコードを触らない
- Backend: applicable — 保存形式 (拡張 Markdown ⇄ ProseNode 木) の往復規約と画像参照の正本所在および Worker API 契約を要求として確定する
- API: N/A — Worker API の詳細設計は P02 が所有する
- Data: applicable — 画像参照テーブル (DB-IMAGE-01〜03) の保持項目 (article_image テーブル: id/workspace_id/article_id/object_key/lifecycle/byte_size/mime_type 等) を要求として確定する
- Infrastructure: applicable — Worker API 経由の R2 書き込み方式 (INF-IMG-01〜05 の現行確定版) の要求を確定する
- Security: applicable — 公開ページ描画の許可リスト (SEC-REQ-006〜009) の範囲を要求として確定する
- Quality: applicable — 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable — 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A — 運用手順 (孤児画像回収・既存記事移行) は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/requirements-baseline.md (A1-A7 の検証可能化と要件ID対応表); docs/spec/feat-article-block-editor/block-catalog-decisions.md (19種の断片カタログと各種属性・保存形式表現の決定と根拠); docs/spec/feat-article-block-editor/image-upload-decisions.md (画像参照の正本所在・Worker API 契約の確定記録と 2026-09-06 承認の引用・許可リストの範囲)
- Consumed artifacts: features/feat-article-block-editor.md, features/feat-article-block-editor.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, src/domain/blogops/prose-node.ts, src/domain/blogops/article-image-policy.ts, src/app/api/article-images/route.ts, src/db/schema.ts
- Write scope/touches: docs/spec/feat-article-block-editor/requirements-baseline.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P01; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (docs/spec/feat-article-block-editor) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文の AI 生成、SEO/AEO の構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴 UI と差分表示、商品データそのものの取込・更新) に該当する変更
- src/domain/authoring/blog-template.ts の ExpressionBlock レジストリと src/application/adapters/expression-article-block.ts の型・変換ロジックの書き換え (表現ブロックと記事版面ブロックの意味を統合しない)
- 参考ブログの文章・素材・デザインの複製
- presigned URL の発行、ブラウザから R2 への直接 PUT、R2 write CORS の採用検討 (2026-09-06 承認により採用しないことが確定している)

## テスト戦略

- テストレベル選定: 単体テストで ProseNode 19種の parse/serialize 純関数、許可リスト判定関数、マジックバイト検査 (`detectArticleImageMimeType`)、Worker API 認可ロジックを入力から出力で検証する。結合テストで編集面から保存・再読込までの往復、画像アップロード (Worker API) から R2 参照確定 (ready 状態) までの経路、商品検索から断片挿入までの経路を検証する。境界値テストで19種各1件の挿入・編集・公開描画一致、見出しレベル固定の挿入・移動・削除・貼り付け全操作、商品検索 0件/複数件、画像アップロード 8 MiB 以下成功/8 MiB 超過拒否/許可外 MIME 拒否/MIME 申告と実バイト不一致拒否/未認証拒否/記事所属不正拒否、許可リスト外タグ混入の無害化、既存 10種記事の読み込みと再保存不変性を検証する。回帰テストで既存 tests/ 配下の全スイートを 0件失敗のまま維持する。
- カバレッジ目標: 80% — 新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/app/api/article-images) に適用する。
- 層別方針: フロントエンド — N/A: 本 phase は編集面のコードを触らないため対象外 (P02 以降で behavior 検証を設計・適用する)。バックエンド — API 契約テスト (エンドポイント形状・認可要件・8 MiB 上限・マジックバイト検査・状態機械・エラーコード) を P02 の設計と P04 のテスト設計がそのまま照合できる粒度で明記し、画像参照テーブルの保持項目に対する DB 結合テスト (D1 への INSERT/SELECT 往復) 検証観点を P04 へ引き渡す。インフラ — IaC 静的検証 (wrangler.toml の R2 バケット/バインディング定義) の観点を後続 phase へ引き渡し、smoke テストで Worker API 経由の R2 書き込み方式を疎通確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-article-block-editor の受入7件 (A1-A7) を実装着手前に一意で検証可能な要求ベースラインへ確定し、19種の断片カタログ・拡張 Markdown ⇄ ProseNode 木の相互変換規約・Worker API 画像アップロード契約 (pending 予約→R2 put→ready 確定、8 MiB 上限・マジックバイト検査・presigned PUT 不使用) ・公開ページ描画の許可リストの範囲を、実装済みの `prose-node.ts` と `article-images/route.ts` の実測に接地させて決める。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定 80%) green・既存テストの回帰 0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、findings を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価が confirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: N/A — P01 は intra-feature 依存を持たない起点 task である

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
