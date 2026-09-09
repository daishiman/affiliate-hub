# System task overlay: 受入10件の受け入れ判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-site-scoped-authoring-ia
- owners: ["daishiman"]
- tags: ["p07", "feat-site-scoped-authoring-ia"]
- related_nodes: []
- parent_feature: feat-site-scoped-authoring-ia
- phase_ref: P07
- classification: confidence=1.0; reason=feat-site-scoped-authoring-ia の P07 lifecycle 責務への確定写像; candidate=tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

A1-A10すべてについて `pnpm run preview` 上での実物判定を完了し、各受入条件の判定結果 (PASS/FAIL) と根拠が記録された状態を成立させる。

## 背景

system-spec/ui-ux.md の qa-uiux-web-site-scoped-authoring-ia と system-spec/frontend.md の qa-frontend-web-site-scoped-route-ownership は、管理ルートが 93 本あり作業の対象物単位ではなく機能単位で並んでいるため目的の画面へ辿り着く前にどれが自分の作業かを判断する手間が挟まっている現状課題と、読者像・書き方の決め事を /admin/sites/[site]/ 配下へ所属替えし、記事・所属替え対象以外の旧入口は転送で受ける方針を利用者本人の回答として確定している。受け皿である /admin/sites/[site]/ 階層と記事画面そのものの新設・配置は feat-blog-scoped-admin-console が正本であり、本 feature はその配下へ読者像 (/admin/personas/*) と書き方の決め事 (/admin/writing/*) を所属替えし、記事については旧 /admin/content/* からの転送だけを担う。動詞ラベル・危険操作の分離・直接編集の UX 規則そのものは feat-reference-blog-admin-ux が正本であり、本 feature はそれを適用する側に回る。既存指標の提示順序そのものの規則は feat-blog-scoped-admin-console が正本、数値の正本は feat-blog-metrics-rollup の site_daily_metrics / article_daily_metrics であり、本 feature は新しい指標や集計表を作らない。 A6 (動詞ラベルの正答率90%以上) は feat-reference-blog-admin-ux の受入と同一基準のラベル読み取り調査を、A8 (近道クリック数の削減) は束ね直す前の構成との比較クリック数計測を、それぞれ根拠として要求する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-site-scoped-authoring-ia, system-spec/ui-ux.md, system-spec/frontend.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P07 upstream entry gate: SYS-SITE-SCOPED-AUTHORING-IA-P06 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json


## Workstream applicability

- Frontend: applicable; 実物画面でのA1-A10の受入判定を行う
- Backend: N/A: 本 feature に新規バックエンドロジックはない
- API: N/A: 本 feature は新規APIを持たない
- Data: N/A: 新しいデータモデルは作らない
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: applicable; site未解決時のnotFoundと越境防止 (A4) を実物判定する
- Quality: applicable; A1-A10のPASS/FAIL判定と根拠記録を完了条件とする
- Documentation: applicable; 受入判定報告そのものが本 phase の成果物である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 /admin/content・/admin/personas・/admin/writing 配下画面の転送シェルへの置換と重複実装解消はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-site-scoped-authoring-ia/acceptance-report.md
- Consumed artifacts: docs/spec/feat-site-scoped-authoring-ia/test-run-report.md
- Write scope/touches: docs/spec/feat-site-scoped-authoring-ia/acceptance-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SITE-SCOPED-AUTHORING-IA-P07; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SITE-SCOPED-AUTHORING-IA-P07; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SITE-SCOPED-AUTHORING-IA-P07 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-site-scoped-authoring-ia 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)
- /admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)
- 記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)
- ブログの作成・削除そのもの (feat-blog-ops-crud)
- 権限モデルの新設 (既存 workspace 権限を使う)
- 管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本
- 既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本)

## テスト戦略

- テストレベル選定: 単体: 転送先パス解決関数・site セグメント解決関数・作業対象物への束ね直しマッピング関数の単体テストを緑化する。結合: 旧 URL アクセスから転送先ページ描画までの結合テストを緑化する。境界値: site 未解決時の notFound 遷移・ブログ未特定時のブログ選択誘導・危険操作の確認有無分岐の境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/app/admin/sites/[site]/, src/app/admin/personas/, src/app/admin/writing/, src/app/admin/content/, src/app/admin/page.tsx, src/app/admin/layout.tsx) に適用する。
- 層別方針: フロントエンド: behavior ベースで転送遷移・notFound 遷移・入口ラベル表示・近道導線・雛形複製導線の振る舞いを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・遷移先URLなど振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run build`
- Automated commands: `pnpm run preview`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P07 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: A1-A10すべてについて `pnpm run preview` 上での実物判定を完了し、各受入条件の判定結果 (PASS/FAIL) と根拠が記録された状態を成立させる。
- Generic execution prompt: feat-site-scoped-authoring-ia の goal (読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P07 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P07 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P07 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-site-scoped-authoring-ia
- Phase doc: system-plan-phase-names.md#P07
- Dependencies: SYS-SITE-SCOPED-AUTHORING-IA-P06
