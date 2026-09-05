# System task overlay: AEO 設計の独立レビューと着手可否判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-aeo-answer-optimization
- owners: ["daishiman"]
- tags: ["p03", "feat-aeo-answer-optimization"]
- related_nodes: []
- parent_feature: feat-aeo-answer-optimization
- phase_ref: P03
- classification: confidence=1.0; reason=feat-aeo-answer-optimization の P03 lifecycle 責務への確定写像; candidate=tasks/feat-aeo-answer-optimization/sys-aeo-answer-optimization-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

配信路が既存の公開面生成経路に載っていること、回答単位が下書き経由でしか公開されないこと、構造化データ検証の重複実装が無いことを独立観点で検査し、実装着手の可否を判定した状態を成立させる。

## 背景

別系統の配信路を増やすと、公開面の真実が二箇所に分かれる。設計レビューで、AEO の出力がすべて既存経路を通ることを経路として確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-aeo-answer-optimization, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/ui-ux.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 記事の回答単位ブロックと著者プロフィール面を扱う
- Backend: applicable; 回答単位の管理と引用観測台帳の記録を扱う
- API: applicable; llms.txt と robots.txt の AI クローラ方針配信を扱う
- Data: applicable; site_aeo_profiles と article_answer_units の設計を扱う
- Infrastructure: N/A: 既存 Workers/D1 デプロイ単位を変更しない
- Security: applicable; 回答単位が下書き経由でしか公開面へ入らないことを扱う
- Quality: applicable; 回答単位の欠落が機械的に検出されることを検証する
- Documentation: applicable; 回答単位の書き方と AI クローラ方針の説明を扱う
- Operations: applicable; 引用状況の定点観測の運用を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-aeo-answer-optimization/design-review-findings.md (設計レビューの指摘と解決状況); docs/spec/feat-aeo-answer-optimization/delivery-path-diagram.md (回答単位から公開面・llms.txt・robots.txt までの経路)
- Consumed artifacts: features/feat-aeo-answer-optimization.md; features/feat-aeo-answer-optimization.context.json; system-spec/frontend.md; system-spec/database.md; docs/spec/feat-seo-assessment-reflection/validation-design.md
- Write scope/touches: docs/spec/feat-aeo-answer-optimization/design-review-findings.md, docs/spec/feat-aeo-answer-optimization/delivery-path-diagram.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AEO-ANSWER-OPTIMIZATION-P03; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AEO-ANSWER-OPTIMIZATION-P03; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-AEO-ANSWER-OPTIMIZATION-P03 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-aeo-answer-optimization 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 特定の AI 検索サービスでの露出保証や順位保証 (作らない)
- 索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection が所有する)
- 回答単位の本文を自動生成して無承認で公開すること (行わない)
- 残数・優先度の提示順序 (feat-blog-scoped-admin-console が所有する)
- P03 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: レビュー phase のため実行テストを持たず、配信経路図が新設経路0件であることを示すことを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/aeo, src/application/aeo, src/components/reader) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run lint` (レビュー対象の既存コードが静的検査を通ることを確認する)
- Required evidence: design-review-findings.md の全指摘が解決済みまたは後続 phase へ委譲済みであること
- Required evidence: P03 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 配信路が既存の公開面生成経路に載っていること、回答単位が下書き経由でしか公開されないこと、構造化データ検証の重複実装が無いことを独立観点で検査し、実装着手の可否を判定した状態を成立させる。
- Generic execution prompt: feat-aeo-answer-optimization の goal (記事が結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持ち、article_answer_units と site_aeo_profiles として管理され、llms.txt とブログごとのクローラ方針が配信され、AI 検索での引用状況を定点で記録できる状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P03 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P03 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P03 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 設計レビューの高重大度指摘が0件になり、テスト設計へ進める

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-aeo-answer-optimization
- Phase doc: system-plan-phase-names.md#P03
- Dependencies: SYS-AEO-ANSWER-OPTIMIZATION-P02
