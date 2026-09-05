# System task overlay: ブロックエディター描画・保存契約とR2アップロード経路の設計

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

P01 の要求に沿って、節 (外側) / 断片 (内側) 2層のUI表現契約、`/` 挿入メニューの19種構成、19種それぞれの編集面コンポーネント構成と公開ページ描画部品の共有方式、拡張Markdown⇄ProseNode木の変換規則の追加分、商品検索結果選択UIの契約、R2 presigned PUT発行APIとEditorial D1の画像参照テーブル (DB-IMAGE-01〜03) の設計、公開ページ許可リストレンダラの設計を確定する。

## 背景

既存の編集面構成は src/presentation/prose/{prose-editor.tsx, prose-body.tsx, prose-outline.tsx, prose-section.tsx, prose-table-frame.tsx, prose.module.css} に分かれており、商品カードと画像だけが手入力のinput要素になっている。src/application/adapters/expression-article-block.ts には「表現ブロックと記事版面ブロックは意味が違うので、型やテーブルを統合しない」という既存コメントがあり、本設計はこの境界を維持したまま ArticleBlockKind(節)/ProseNode(断片) の2層だけを対象にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 節/断片2層のUI表現と19種の編集面コンポーネント構成、商品検索選択UI、公開ページ描画部品の共有方式を設計する
- Backend: applicable; 画像参照 port/usecase と R2 presigned PUT発行の設計を行う
- API: applicable; presigned PUT発行APIと商品検索APIの契約を設計する
- Data: applicable; 画像参照テーブルの列定義・索引・保持項目を設計する
- Infrastructure: applicable; R2バケットへのpresigned PUTの発行点と有効期限を設計する
- Security: applicable; 公開ページ許可リストレンダラ (許可外の断片・属性・スタイルを出力しない) の設計を行う
- Quality: applicable; 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable; 設計文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/architecture.md (2層UI表現・19種コンポーネント構成・許可リストレンダラの設計); docs/spec/feat-article-block-editor/data-model.md (画像参照テーブルとProseNode拡張の列/属性定義); docs/spec/feat-article-block-editor/api-contract.md (presigned PUT発行APIと商品検索連携の契約)
- Consumed artifacts: docs/spec/feat-article-block-editor/requirements-baseline.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md, src/presentation/prose/prose-editor.tsx, src/presentation/prose/prose-body.tsx, src/application/adapters/expression-article-block.ts, src/application/ports/product.ts
- Write scope/touches: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P02; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P02; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P02 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (src, drizzle, tests, worker-entry.js, docs/spec, system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文のAI生成、SEO/AEOの構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴UIと差分表示、商品データそのものの取込・更新) に該当する変更
- src/domain/authoring/blog-template.ts の ExpressionBlock レジストリと src/application/adapters/expression-article-block.ts の型・変換ロジックの書き換え (表現ブロックと記事版面ブロックの意味を統合しない)
- src/presentation/site/expression-block-view.tsx が担う表現ブロック描画の変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体: ProseNode 19種のparse/serialize純関数、許可リスト判定関数、presigned PUT発行の署名生成を入力から出力で検証する。結合: 編集面から保存・再読込までの往復、画像アップロードからR2参照確定までの経路、商品検索から断片挿入までの経路を検証する。境界値: 19種各1件の挿入・編集・公開描画一致、見出しレベル固定の挿入・移動・削除・貼り付け全操作、商品検索0件/複数件、画像アップロード成功/失敗、許可リスト外タグ混入、既存10種記事の読み込みと再保存不変性を検証する。回帰: 既存 tests/ 配下の全スイートを0件失敗のまま維持する。
- カバレッジ目標: 既定80%を新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: 節/断片2層のUI設計と19種の編集面コンポーネント構成を、可視ラベルとアクセシブル名によるbehavior検証が成立する境界 (DOM構造や座標に依存しない責務分割) で設計する。バックエンド: presigned PUT発行APIと商品検索APIをAPI 契約 (リクエスト/レスポンススキーマ・エラーコード・認可要件) として明文化し、画像参照 port/usecase をDB 結合 (D1へのCRUD) で検証可能な形に設計する。インフラ: R2バケットへのpresigned PUT発行点と有効期限をIaC (wrangler.tomlのR2バインディング定義) として表現し、発行直後にsmoke (実PUTの成功確認) を行える手順を設計する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P02 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P01 の要求に沿って、節 (外側) / 断片 (内側) 2層のUI表現契約、`/` 挿入メニューの19種構成、19種それぞれの編集面コンポーネント構成と公開ページ描画部品の共有方式、拡張Markdown⇄ProseNode木の変換規則の追加分、商品検索結果選択UIの契約、R2 presigned PUT発行APIとEditorial D1の画像参照テーブル (DB-IMAGE-01〜03) の設計、公開ページ許可リストレンダラの設計を確定する。
- Generic execution prompt: feat-article-block-editor の goal (編集面と公開ページが同一の描画部品を通り、節と本文断片の2層がUI上で見分けられ、どの編集操作でも見出しレベルが動かず、19種の断片が`/`から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P02 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P02 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P02 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Phase doc: system-plan-phase-names.md#P02
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P01
