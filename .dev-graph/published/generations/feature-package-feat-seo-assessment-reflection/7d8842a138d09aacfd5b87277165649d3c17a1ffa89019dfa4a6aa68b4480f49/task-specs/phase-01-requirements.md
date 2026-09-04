# System task overlay: SEO 診断と書き戻しの要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-assessment-reflection
- owners: ["daishiman"]
- tags: ["p01", "feat-seo-assessment-reflection"]
- related_nodes: []
- parent_feature: feat-seo-assessment-reflection
- phase_ref: P01
- classification: confidence=1.0; reason=feat-seo-assessment-reflection の P01 lifecycle 責務への確定写像; candidate=tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-seo-assessment-reflection の受入10件を検証可能な条件文へ写像し、提示してよい指摘の範囲 (機械的に検証できるものだけ) と、書き戻しが必ず下書きを経ることを要求として確定した状態を成立させる。

## 背景

SEO は推測が入り込みやすい領域である。順位予測のような検証できない助言を混ぜると、画面全体の信頼が落ちる。要求段階で「検証できる指摘だけを立てる」を条文として固定し、何を指摘しないかを先に決める。書き戻しについても、公開面を直接触る経路を要求段階で禁じる。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-assessment-reflection, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, system-spec/ui-ux.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 記事画面の診断結果と推奨採用の操作面を扱う
- Backend: applicable; assess-article-seo と apply-seo-recommendation を扱う
- API: applicable; sitemap.xml / RSS・Atom / robots.txt の配信経路を扱う
- Data: applicable; article_seo_assessments の設計を扱う
- Infrastructure: N/A: 既存 Workers/D1 デプロイ単位を変更しない
- Security: applicable; 推奨採用が承認経路を迂回しないことを扱う
- Quality: applicable; 検証できない指摘が要求に混入していないことを検査する
- Documentation: applicable; 指針の出典と 90 日見直しの説明を扱う
- Operations: applicable; 月次再診断の定期実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-seo-assessment-reflection/requirements-baseline.md (受入10件と検証条件の一意対応表); docs/spec/feat-seo-assessment-reflection/assessment-catalog.md (立ててよい指摘項目と、その検証手段・重大度基準); docs/spec/feat-seo-assessment-reflection/writeback-constraints.md (下書き経由の書き戻しと承認経路の不可迂回条件)
- Consumed artifacts: features/feat-seo-assessment-reflection.md; features/feat-seo-assessment-reflection.context.json; system-spec/backend.md; system-spec/database.md; system-spec/frontend.md
- Write scope/touches: docs/spec/feat-seo-assessment-reflection/requirements-baseline.md, docs/spec/feat-seo-assessment-reflection/assessment-catalog.md, docs/spec/feat-seo-assessment-reflection/writeback-constraints.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-ASSESSMENT-REFLECTION-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-ASSESSMENT-REFLECTION-P01; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-SEO-ASSESSMENT-REFLECTION-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-seo-assessment-reflection 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 検索順位そのものの保証や、ベンダー推定の数値目標 (作らない)
- 公開面を直接書き換える経路 (必ず下書き経由とする)
- AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization が所有する)
- 診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console が所有する)
- P01 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 文書 phase のため実行テストを持たず、受入10件すべてが検証可能文へ写像されたことを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/seo, src/application/seo, src/app/admin/sites) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (要求が参照する既存型と矛盾しないことを確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-seo-assessment-reflection` (本 package の C12 決定論検証を再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-seo-assessment-reflection の受入10件を検証可能な条件文へ写像し、提示してよい指摘の範囲 (機械的に検証できるものだけ) と、書き戻しが必ず下書きを経ることを要求として確定した状態を成立させる。
- Generic execution prompt: feat-seo-assessment-reflection の goal (公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件の要求写像、指摘カタログ、書き戻し制約が確定している

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-seo-assessment-reflection
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
