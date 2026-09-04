# System task overlay: HowTo・Speakable 導出と点検履歴と定期再点検と管理画面一覧の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-aeo-gap-closure
- owners: ["daishiman"]
- tags: ["p05", "feat-seo-aeo-gap-closure"]
- related_nodes: []
- parent_feature: feat-seo-aeo-gap-closure
- phase_ref: P05
- classification: confidence=1.0; reason=feat-seo-aeo-gap-closure の P05 lifecycle 責務への確定写像; candidate=tasks/feat-seo-aeo-gap-closure/sys-seo-aeo-gap-closure-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計と P04 のテスト設計に沿って、structured-data.ts への HowTo と Speakable の builder 追加、点検履歴テーブルと drizzle マイグレーションと repository と port、publish-article からの履歴追記、scheduled handler による定期再点検、管理画面の落ちた記事一覧を実装する。

## 背景

src/application/seo/structured-data.ts の export は BlogPosting・ItemList・BreadcrumbList・FaqPage・BlogOpsFaqPage・BlogOpsPosting・serializeJsonLd で、HowTo と Speakable は無い。src/application/seo/expression-blocks.ts の expressionBlocksOf は answer・key_points・faq・sources・freshness の 5 種しか作らない。src/app/admin/ 24 エントリのうち SEO 関連は settings/seo のみである。本 phase はこれらの実測された空白だけを埋め、既に動いている経路には触れない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-aeo-gap-closure, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 管理画面の落ちた記事一覧と公開ページへの JSON-LD 出力を実装する
- Backend: applicable; usecase・port・scheduled handler を実装する
- API: applicable; 管理画面一覧の取得経路を実装する
- Data: applicable; 点検履歴テーブルと drizzle マイグレーションと repository を実装する
- Infrastructure: applicable; 既存 crons 宣言に対応する scheduled 入口を配線する
- Security: N/A: 権限要求は既存 admin RBAC の範囲を超えない
- Quality: applicable; P04 の設計テストを緑化することを完了条件とする
- Documentation: N/A: 文書化は P12 が所有する
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 SEO 実装と追加マイグレーションの互換確認は P08 が所有する

## 成果物

- Produced artifacts: src/application/seo/ への HowTo と Speakable の JSON-LD 導出; src/db/schema.ts への点検履歴テーブルと drizzle/ への対応マイグレーション; src/infrastructure/persistence/d1/ への点検履歴 repository と src/application/ports/ への port; src/application/usecases/site/publish-article.ts からの履歴追記; scheduled handler による公開済み記事の定期再点検; src/app/admin/ 配下の落ちた記事一覧; 上記に対応する tests/ 配下のテスト
- Consumed artifacts: docs/spec/feat-seo-aeo-gap-closure/architecture.md, docs/spec/feat-seo-aeo-gap-closure/data-model.md, docs/spec/feat-seo-aeo-gap-closure/api-contract.md, docs/spec/feat-seo-aeo-gap-closure/test-design.md, docs/spec/feat-seo-aeo-gap-closure/derivation-rules.md, docs/spec/feat-seo-aeo-gap-closure/retention-policy.md
- Write scope/touches: src/application/seo, src/domain/authoring, src/domain/seo, src/db/schema.ts, drizzle, src/infrastructure/persistence/d1, src/application/ports, src/application/usecases, src/app/admin, src/app/s, worker-entry.js, tests

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-AEO-GAP-CLOSURE-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-AEO-GAP-CLOSURE-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SEO-AEO-GAP-CLOSURE-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (src, drizzle, tests, worker-entry.js, docs/spec, system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-seo-aeo-gap-closure の scope_out (実装済みの JSON-LD 導出本体・llms.txt・IndexNow・sitemap・RSS・ガイドライン出典レジストリ・公開時点検の判定ロジック・記事本文の AI 生成・クリック成果のアトリビューション・管理画面の単一用途画面再編・参考ブログ水準の読者導線) に該当する変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体: JSON-LD 導出関数と点検判定の純関数を入力から出力で検証する。結合: 公開処理から点検履歴の永続化まで、および定期再点検から履歴追記までを検証する。境界値: 手順ブロック 0 件・保持窓ちょうど・保持窓超過・履歴が空の公開済み記事・再点検で新たに落ちた記事を検証する。回帰: 既存 tests/ 配下の全スイートを 0 件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/application/seo, src/application/usecases, src/infrastructure/persistence/d1, src/app/admin) に適用する。
- 層別方針: フロントエンド: 管理画面一覧を可視ラベルとアクセシブル名で検証する。バックエンド/データ: usecase の単体と D1 結合で履歴の追記と保持窓の適用を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm run lint`
- Automated commands: `pnpm vitest run --reporter=dot` (P04 が指定した回帰スイートを含む全量)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計と P04 のテスト設計に沿って、structured-data.ts への HowTo と Speakable の builder 追加、点検履歴テーブルと drizzle マイグレーションと repository と port、publish-article からの履歴追記、scheduled handler による定期再点検、管理画面の落ちた記事一覧を実装する。
- Generic execution prompt: feat-seo-aeo-gap-closure の goal (手順記事と読み上げ向けの構造化データが記事から導出され、公開時点検の結果が履歴として残り、公開後の記事も定期に再点検されて陳腐化に気づける状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入6件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-seo-aeo-gap-closure
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-SEO-AEO-GAP-CLOSURE-P04
