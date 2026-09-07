# System task overlay: 品質保証と非機能検査

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

許可リストの網羅性、画像アップロードのRBAC境界、編集面のアクセシビリティ、19種断片描画のパフォーマンスを非機能検査として確認する。

## 背景

A6 (許可リストによる絞り込み) は網羅的なテストケースだけでなく、許可外の断片・属性・スタイルを実際に投入した際の非機能検査で裏付ける必要がある。画像アップロードのpresigned PUT発行は既存 admin RBAC の範囲を超えないことも検査対象とする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 編集面のアクセシビリティ (可視ラベル・アクセシブル名) を検査する
- Backend: applicable; presigned PUT発行のRBAC境界を検査する
- API: N/A: API固有の追加検査は行わない
- Data: N/A: データ固有の追加検査は行わない
- Infrastructure: N/A: デプロイ単位を変更しない
- Security: applicable; 許可リストの網羅性 (許可外の断片・属性・スタイルが出力されないこと) を検査する
- Quality: applicable; 非機能検査そのものが本 phase の責務である
- Documentation: applicable; 検査結果文書が本 phase の成果物である
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/quality-assurance.md (許可リスト網羅性・RBAC境界・アクセシビリティの検査結果); tests (非機能検査の自動化分)
- Consumed artifacts: docs/spec/feat-article-block-editor/migration-compatibility.md, docs/spec/feat-article-block-editor/architecture.md
- Write scope/touches: docs/spec/feat-article-block-editor/quality-assurance.md, tests

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P09; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P09; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
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
- 層別方針: フロントエンド: 編集面のアクセシビリティを、可視ラベル・アクセシブル名・キーボード操作によるbehavior観点で検査する。バックエンド: presigned PUT発行のRBAC境界をAPI 契約 (認可ヘッダ・エラーコードの網羅) として検査し、画像参照usecaseのDB 結合 (D1上での権限外アクセス拒否) を検査する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm vitest run --reporter=dot`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P09 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 許可リストの網羅性、画像アップロードのRBAC境界、編集面のアクセシビリティ、19種断片描画のパフォーマンスを非機能検査として確認する。
- Generic execution prompt: feat-article-block-editor の goal (編集面と公開ページが同一の描画部品を通り、節と本文断片の2層がUI上で見分けられ、どの編集操作でも見出しレベルが動かず、19種の断片が`/`から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P09 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P09 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Phase doc: system-plan-phase-names.md#P09
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P08
