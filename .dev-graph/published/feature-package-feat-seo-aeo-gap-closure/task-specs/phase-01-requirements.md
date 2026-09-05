# System task overlay: SEO/AEO 未実装差分の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-aeo-gap-closure
- owners: ["daishiman"]
- tags: ["p01", "feat-seo-aeo-gap-closure"]
- related_nodes: []
- parent_feature: feat-seo-aeo-gap-closure
- phase_ref: P01
- classification: confidence=1.0; reason=feat-seo-aeo-gap-closure の P01 lifecycle 責務への確定写像; candidate=tasks/feat-seo-aeo-gap-closure/sys-seo-aeo-gap-closure-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-seo-aeo-gap-closure の受入6件 (A1-A6) を実装着手前に一意で検証可能な要求ベースラインへ確定し、HowTo の導出元となる手順の表現方法・Speakable の読み上げ対象・点検履歴の保持窓幅の 3 つを、既存 src/domain/authoring/blog-template.ts の表現ブロック 10 種と src/domain/authoring/article-structure.ts の記事型 5 種の実測に接地させて決める。

## 背景

system-spec/backend.md は dec-analysis-history-retention を append-with-window で、dec-aeo-analysis-trigger を公開時と定期の二経路で確定している。しかし実装側を grep すると src/application/seo/structured-data.ts に HowTo と Speakable の builder が無く、src/application/seo/ai-search-audit.ts の結果は src/application/usecases/site/publish-article.ts でその場に計算されるだけで永続化されず、wrangler.jsonc が crons を 3 箇所で宣言しているのに src/ に scheduled handler が 1 件も無い。決めたが動いていないこの 3 点を、まず要求として書き下ろす。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-aeo-gap-closure, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase は公開面・管理画面のコードを触らない
- Backend: applicable; HowTo と Speakable の導出元をどこに置くかの要求を確定する
- API: N/A: API 契約設計は P02 が所有する
- Data: applicable; 点検履歴の保持窓幅と 1 件あたりの保持内容を要求として確定する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2) のデプロイ単位を変更しない
- Security: N/A: 権限要求は既存 admin RBAC の範囲を超えない
- Quality: applicable; 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable; 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 SEO 実装と追加マイグレーションの互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-seo-aeo-gap-closure/requirements-baseline.md (A1-A6 の検証可能化と参照仕様の対応表); docs/spec/feat-seo-aeo-gap-closure/derivation-rules.md (HowTo の手順表現と Speakable の読み上げ対象の決定と根拠); docs/spec/feat-seo-aeo-gap-closure/retention-policy.md (点検履歴の保持窓幅・保持項目・落とし方の決定と根拠)
- Consumed artifacts: features/feat-seo-aeo-gap-closure.md, features/feat-seo-aeo-gap-closure.context.json, system-spec/backend.md, system-spec/frontend.md, system-spec/database.md, src/domain/authoring/blog-template.ts, src/domain/authoring/article-structure.ts, src/application/seo/ai-search-audit.ts, src/application/seo/structured-data.ts
- Write scope/touches: docs/spec/feat-seo-aeo-gap-closure/requirements-baseline.md, docs/spec/feat-seo-aeo-gap-closure/derivation-rules.md, docs/spec/feat-seo-aeo-gap-closure/retention-policy.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-AEO-GAP-CLOSURE-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-AEO-GAP-CLOSURE-P01; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SEO-AEO-GAP-CLOSURE-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
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

- Automated commands: `pnpm run typecheck` (要求文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-seo-aeo-gap-closure の受入6件 (A1-A6) を実装着手前に一意で検証可能な要求ベースラインへ確定し、HowTo の導出元となる手順の表現方法・Speakable の読み上げ対象・点検履歴の保持窓幅の 3 つを、既存 src/domain/authoring/blog-template.ts の表現ブロック 10 種と src/domain/authoring/article-structure.ts の記事型 5 種の実測に接地させて決める。
- Generic execution prompt: feat-seo-aeo-gap-closure の goal (手順記事と読み上げ向けの構造化データが記事から導出され、公開時点検の結果が履歴として残り、公開後の記事も定期に再点検されて陳腐化に気づける状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入6件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-seo-aeo-gap-closure
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
