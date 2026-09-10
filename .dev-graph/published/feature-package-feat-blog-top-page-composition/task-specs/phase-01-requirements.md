# System task overlay: トップページ区画構成・カード規約・追従ヘッダー機能予算・非模倣ゲートの要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p01", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P01
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP01 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線の区画順・件数・空状態、記事カードの16:9規約とサムネイル欠落時のOGP自動生成fallback、追従ヘッダーへ置く機能をサイト名/検索起動/カテゴリへの移動の3つに限定する予算、フッター導線集約(運営者情報/全カテゴリー/サイトポリシー/プライバシーポリシー/特定商取引法に基づく表記/お問い合わせ/RSS/SNS)、JavaScript無効時のURL到達性、WebSite+SearchAction+ItemListの構造化データ、参照元(kajetblog.com)の非模倣ゲートの検査対象を、同じacceptance IDで確定する。

## 背景

利用者は kajetblog.com のトップページを参考に、ヘッダー・フッター・アイコン・画像を含めて直感的に見やすいブログを構成することを求めた。参照サイトの観測fact (system-spec/retrieval-evidence/kajetblog-top-analysis.md) は追従ヘッダーに ロゴ/キャッチコピー/グローバルナビ/検索アイコン/モバイルメニュー/SNS列 の6要素を並べるが、qa-uiux-web-top-composition-v6は『常に画面に留まる部品は、留まることで隠す面積の対価に見合う働きを持たせる』原則を適用し、サイト名/検索起動/カテゴリへの移動の3機能へ絞ることを確定している。観測した事実をそのまま実装契約に読み替えない。キャッチコピーとSNS列はフッターと本文の流れへ置く。画像を持たない記事のカードはqa-neutral-ogp-fallback-v6により自動生成のOGP画像で埋め、サムネイルの空いたカードを生じさせない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview
- Entry gate: parent_feature.depends_on all done|closed (P01)
- P01 upstream entry gate: parent_feature.depends_on all done|closed。dev-graph正本の依存4 feature(feat-blog-ui-builder, feat-reference-blog-admin-ux, feat-thumbnail-visual-system, feat-reader-search-quality)がdoneまたはclosedのときだけ着手する。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 要求文書の確定だけを行い実装は行わない
- Backend: N/A: サービス実装を行わない
- API: N/A: API実装を行わない
- Data: N/A: データ層の変更を行わない
- Infrastructure: N/A: 配備変更なし
- Security: applicable; 非模倣ゲートが検査する対象(参照元の文章・写真・ロゴ・固有名・色値・テーマ資産)の範囲を確定する
- Quality: applicable; A1-A8と要件文書・観測fact引用の対応を検算する
- Documentation: applicable; 要求ベースラインを正本化する
- Operations: applicable; 観測fact(kajetblog-top-analysis.md)の取得日・再取得方法を残す

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: 要求ベースライン、区画構成台帳(セクション順・件数・空状態)、追従ヘッダー機能予算定義、非模倣ゲート対象定義、acceptance traceability
- Consumed artifacts: features/feat-blog-top-page-composition.md, features/feat-blog-top-page-composition.context.json, system-spec/ui-ux.md (qa-uiux-web-top-composition-v6/qa-request-thumbnail-coverage-v6/qa-neutral-ogp-fallback-v6), system-spec/frontend.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md
- Write scope/touches: docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P01を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P01として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P01をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)
- サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)
- 検索の索引作成・順位付け・結果面 (feat-reader-search-quality)
- 記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)
- 管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有
- 参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)

## テスト戦略

- テストレベル選定: 単体はセクション順序決定・カード非空判定(自動生成OGP fallback選択含む)・URLパラメータ解析(sort=latest|popular)の純粋関数を検証する。結合はSSRされたトップページとJSON-LD生成・非模倣静的検査ツールの結合を検証する。境界値は空状態(記事0件)・画像不在記事・極端に長い題名・多バイト文字・sort未指定/不正値を検証する。回帰は既存のブログトップ(src/app/s/[site]/page.tsx)の記事一覧・カテゴリ一覧・検索導線・固定ページ導線を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らない。層別の上書きはせず、非模倣静的検査の判定関数は100%網羅を目標とする。
- 層別方針: Frontendは可視ラベルとaxe-coreによるbehaviorベースの検証、BackendはAPI契約とDB結合を確認する統合テスト、InfrastructureはIaC静的検証とsmokeテストを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、role/name/状態などアクセシブルな契約と出力データの契約で検証する。実装詳細に密結合した過剰テストを作らない。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-top-page-composition`
- Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json
- Acceptance state: P01: 区画順序(おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線)・カード16:9(約1200x675)規約とOGP自動生成fallback・追従ヘッダー機能予算(サイト名/検索起動/カテゴリへの移動の3つに限定し小画面での下方向スクロール中の畳みと上方向での復帰・アンカー移動時の見出し自己遮蔽回避)・フッター7導線・JavaScript無効時のURL到達性・WebSite+SearchAction+ItemListの構造化データ・非模倣ゲート対象(文章・写真・ロゴ・固有名・色値・テーマ資産)をA1-A8のacceptance idと1:1で対応させ、未対応0件を成立させる。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線の区画順・件数・空状態、記事カードの16:9規約とサムネイル欠落時のOGP自動生成fallback、追従ヘッダーへ置く機能をサイト名/検索起動/カテゴリへの移動の3つに限定する予算、フッター導線集約(運営者情報/全カテゴリー/サイトポリシー/プライバシーポリシー/特定商取引法に基づく表記/お問い合わせ/RSS/SNS)、JavaScript無効時のURL到達性、WebSite+SearchAction+ItemListの構造化データ、参照元(kajetblog.com)の非模倣ゲートの検査対象を、同じacceptance IDで確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 要求ベースライン、区画構成台帳(セクション順・件数・空状態)、追従ヘッダー機能予算定義、非模倣ゲート対象定義、acceptance traceabilityをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P01のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P01: 区画順序(おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線)・カード16:9(約1200x675)規約とOGP自動生成fallback・追従ヘッダー機能予算(サイト名/検索起動/カテゴリへの移動の3つに限定し小画面での下方向スクロール中の畳みと上方向での復帰・アンカー移動時の見出し自己遮蔽回避)・フッター7導線・JavaScript無効時のURL到達性・WebSite+SearchAction+ItemListの構造化データ・非模倣ゲート対象(文章・写真・ロゴ・固有名・色値・テーマ資産)をA1-A8のacceptance idと1:1で対応させ、未対応0件を成立させる。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P01
- Dependencies: なし
