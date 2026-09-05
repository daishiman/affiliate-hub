# System task overlay: ブロックエディターWYSIWYG化とR2直接アップロード・許可リスト描画の実装

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

P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張し、prose-editor.tsx を入力欄集約からWYSIWYGへ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像をブラウザからR2へ直接presigned PUTでアップロードできるようにし、公開ページの描画を許可リストで絞り込む。

## 背景

src/domain/blogops/prose-node.ts (187行) の10種を19種へ拡張し、src/domain/blogops/prose-format.ts (310行) の拡張Markdown⇄ProseNode 相互変換に9種分を追加する。src/presentation/prose/prose-editor.tsx (682行) の商品id手入力input要素と画像URL手入力input要素を、商品検索結果からの選択コンポーネントとブラウザ→R2直接アップロードコンポーネントへ置き換える。ArticleBlockKind (節・見出し2固定) と ProseNode (断片・見出し3/4) の2層をUIで見分けられるようにし、どの操作でも見出しレベルが動かないようにする。ExpressionBlockレジストリ (blog-template.ts) とexpression-article-block.tsは変更しない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; prose-editor.tsx等の編集面をWYSIWYG化し、商品検索選択UIと画像アップロードUIを実装する
- Backend: applicable; 画像参照 port/usecase と presigned PUT発行 usecase を実装する
- API: applicable; presigned PUT発行APIと商品検索連携の配線を実装する
- Data: applicable; 画像参照テーブルと drizzle マイグレーションと repository を実装する
- Infrastructure: applicable; R2バケットへのpresigned PUT発行点を配線する
- Security: applicable; 公開ページの許可リストレンダラを実装し、許可外の断片・属性・スタイルを出力しない
- Quality: applicable; P04 の設計テストを緑化することを完了条件とする
- Documentation: N/A: 文書化は P12 が所有する
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: src/domain/blogops/ (ProseNode 19種への拡張・prose-format.ts の相互変換拡張); src/presentation/prose/ (prose-editor.tsx 等のWYSIWYG化・商品検索選択UI・画像アップロードUI); src/presentation/admin/publish/ (節/断片2層のUI表現); src/application/ports/ と src/application/usecases/ (画像参照 port/usecase・presigned PUT発行 usecase); src/infrastructure/persistence/d1/ (画像参照 repository); src/db/schema.ts と drizzle/ (画像参照テーブルとマイグレーション); src/app/api/ (presigned PUT発行エンドポイント); src/app/s/ (公開ページの許可リストレンダラ); 上記に対応する tests/ 配下のテスト
- Consumed artifacts: docs/spec/feat-article-block-editor/architecture.md, docs/spec/feat-article-block-editor/data-model.md, docs/spec/feat-article-block-editor/api-contract.md, docs/spec/feat-article-block-editor/test-design.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md, src/application/ports/product.ts
- Write scope/touches: src/domain/blogops, src/domain/authoring/article-structure.ts, src/presentation/prose, src/presentation/admin/publish, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/infrastructure, src/db/schema.ts, drizzle, src/app/admin, src/app/api, src/app/s, worker-entry.js, tests

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
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
- 層別方針: フロントエンド: 実装したprose-editor.tsx等の編集面を、P04が設計したbehavior検証 (可視ラベル・アクセシブル名) に通す。バックエンド: presigned PUT発行APIと商品検索APIの実装をP04のAPI 契約テストに通し、画像参照usecaseの実装をD1へのDB 結合テストに通す。インフラ: R2バケットへのpresigned PUT発行点の配線をIaC定義 (wrangler.toml) と一致させ、配線完了後にsmoke (実PUTの成功確認) を1回実施する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm run lint`
- Automated commands: `pnpm vitest run --reporter=dot` (P04 が指定した回帰スイートを含む全量)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計と P04 のテスト設計に沿って、ProseNode を19種へ拡張し、prose-editor.tsx を入力欄集約からWYSIWYGへ置き換え、商品カードを検索結果選択のみで挿入できるようにし、画像をブラウザからR2へ直接presigned PUTでアップロードできるようにし、公開ページの描画を許可リストで絞り込む。
- Generic execution prompt: feat-article-block-editor の goal (編集面と公開ページが同一の描画部品を通り、節と本文断片の2層がUI上で見分けられ、どの編集操作でも見出しレベルが動かず、19種の断片が`/`から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P04
