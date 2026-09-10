---
graph_node_id: "SYS-SITE-SCOPED-AUTHORING-IA-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-site-scoped-authoring-ia"
domain: "frontend"
tags: ["p05","feat-site-scoped-authoring-ia"]
priority: null
start_date: null
target_date: null
iteration: null
title: "所属替え・転送・入口束ね直し・近道・雛形複製の実装"
owners: ["daishiman"]
created_at: "2026-09-08T04:15:58Z"
updated_at: "2026-09-09T00:00:00Z"
status: "active"
depends_on: ["SYS-SITE-SCOPED-AUTHORING-IA-P04"]
related_nodes: []
resource_scope: ["src/app/admin/sites/[site]/","src/app/admin/content/","src/app/admin/personas/","src/app/admin/writing/","src/app/admin/layout.tsx","src/app/admin/page.tsx"]
purpose: "受入10件 (A1-A10) に対応する実装 (読者像・書き方の決め事の /admin/sites/[site]/ 配下への所属替え、/admin/content・/admin/personas・/admin/writing からの site 特定可否分岐の転送、site 未解決時の notFound、93ルートを作業の対象物数まで畳む入口束ね直し、動詞ラベルの適用、よく使う画面への近道、書き方の決め事の共通雛形からの複製経路) を完了し、P04のテストを緑化した状態を成立させる。"
goal: "受入10件 (A1-A10) に対応する実装 (読者像・書き方の決め事の /admin/sites/[site]/ 配下への所属替え、/admin/content・/admin/personas・/admin/writing からの site 特定可否分岐の転送、site 未解決時の notFound、93ルートを作業の対象物数まで畳む入口束ね直し、動詞ラベルの適用、よく使う画面への近道、書き方の決め事の共通雛形からの複製経路) を完了し、P04のテストを緑化した状態を成立させる。"
scope_in: ["Produced artifacts: src/app/admin/sites/[site]/audience/personas/ 配下 (読者像画面の所属替え先); src/app/admin/sites/[site]/writing/ 配下 (書き方の決め事画面の所属替え先、共通雛形からの複製導線を含む); src/app/admin/personas/ 配下 (site特定可否で分岐する転送シェルへの置換); src/app/admin/writing/ 配下 (site特定可否で分岐する転送シェルへの置換); src/app/admin/content/ 配下 (site特定可否で分岐する転送シェルへの置換。転送先記事画面自体はfeat-blog-scoped-admin-console管轄); src/app/admin/page.tsx (93ルートを作業の対象物 (ブログ・記事・読者・商品・配信) 数まで畳んだ一段目入口ダッシュボード); src/app/admin/layout.tsx (よく使う画面への近道ナビゲーション)","Consumed artifacts: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md, docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md, docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md, docs/spec/feat-site-scoped-authoring-ia/shortcut-contract.md, docs/spec/feat-site-scoped-authoring-ia/template-clone-contract.md, docs/spec/feat-site-scoped-authoring-ia/test-design.md","Write scope/touches: src/app/admin/sites/[site]/, src/app/admin/content/, src/app/admin/personas/, src/app/admin/writing/, src/app/admin/layout.tsx, src/app/admin/page.tsx"]
scope_out: ["新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)","/admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)","記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)","ブログの作成・削除そのもの (feat-blog-ops-crud)","権限モデルの新設 (既存 workspace 権限を使う)","管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本","既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本)","write_scope外のパスへの変更","既存 feat-blog-scoped-admin-console が所有する /admin/sites/[site]/ 配下の記事画面そのものの新設"]
acceptance: ["Automated commands: `pnpm test`","Automated commands: `pnpm run typecheck`","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P05 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-site-scoped-authoring-ia"
feature_package_id: "feature-package/feat-site-scoped-authoring-ia"
phase_ref: "P05"
file_path: "tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p05.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-08T04:15:58Z","origin_kind":"system-dev-planner","source_digest":"1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf","source_path":".dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-site-scoped-authoring-ia の P05 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p05.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ro3w.5","github_mirror":null,"linked_at":"2026-09-08T05:32:34Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-08T10:34:45Z","evidence_refs":["beads:ah-ro3w.5"],"policy":"manual","reconciled_at":"2026-09-09T00:00:00Z","source":"reconciliation","status":"done"}
implementation_readiness: {"checked_at":"2026-09-08T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 所属替え・転送・入口束ね直し・近道・雛形複製の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-site-scoped-authoring-ia
- owners: ["daishiman"]
- tags: ["p05", "feat-site-scoped-authoring-ia"]
- related_nodes: []
- parent_feature: feat-site-scoped-authoring-ia
- phase_ref: P05
- classification: confidence=1.0; reason=feat-site-scoped-authoring-ia の P05 lifecycle 責務への確定写像; candidate=tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入10件 (A1-A10) に対応する実装 (読者像・書き方の決め事の /admin/sites/[site]/ 配下への所属替え、/admin/content・/admin/personas・/admin/writing からの site 特定可否分岐の転送、site 未解決時の notFound、93ルートを作業の対象物数まで畳む入口束ね直し、動詞ラベルの適用、よく使う画面への近道、書き方の決め事の共通雛形からの複製経路) を完了し、P04のテストを緑化した状態を成立させる。

## 背景

system-spec/ui-ux.md の qa-uiux-web-site-scoped-authoring-ia と system-spec/frontend.md の qa-frontend-web-site-scoped-route-ownership は、管理ルートが 93 本あり作業の対象物単位ではなく機能単位で並んでいるため目的の画面へ辿り着く前にどれが自分の作業かを判断する手間が挟まっている現状課題と、読者像・書き方の決め事を /admin/sites/[site]/ 配下へ所属替えし、記事・所属替え対象以外の旧入口は転送で受ける方針を利用者本人の回答として確定している。受け皿である /admin/sites/[site]/ 階層と記事画面そのものの新設・配置は feat-blog-scoped-admin-console が正本であり、本 feature はその配下へ読者像 (/admin/personas/*) と書き方の決め事 (/admin/writing/*) を所属替えし、記事については旧 /admin/content/* からの転送だけを担う。動詞ラベル・危険操作の分離・直接編集の UX 規則そのものは feat-reference-blog-admin-ux が正本であり、本 feature はそれを適用する側に回る。既存指標の提示順序そのものの規則は feat-blog-scoped-admin-console が正本、数値の正本は feat-blog-metrics-rollup の site_daily_metrics / article_daily_metrics であり、本 feature は新しい指標や集計表を作らない。 既存 src/app/admin/personas (page.tsx, audiences/, new/) と src/app/admin/writing (page.tsx) を src/app/admin/sites/[site]/ 配下 (feat-blog-scoped-admin-console が定義する既存9サブルート appearance/audience/domains/edit/placements/revenue/seo/aeo/documents と並ぶ位置) へ移設し、旧パスは Next.js の redirect()/notFound() を用いた薄い転送シェルへ置き換える。記事については既存 src/app/admin/content 配下を同様の転送シェルへ置き換えるが、転送先の記事画面そのものは feat-blog-scoped-admin-console が新設・配置するため、本 phase では転送のみを実装する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-site-scoped-authoring-ia, system-spec/ui-ux.md, system-spec/frontend.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P05 upstream entry gate: SYS-SITE-SCOPED-AUTHORING-IA-P04 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json


## Workstream applicability

- Frontend: applicable; site-scoped 化した読者像・書き方の決め事画面、転送シェル、入口束ね直しダッシュボード、近道導線、雛形複製導線を実装する
- Backend: N/A: 新規ユースケースは作らない (既存 site_daily_metrics / article_daily_metrics を読むだけ)
- API: N/A: 本 feature は新規APIを持たない
- Data: N/A: 新しいデータモデルは作らない
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: applicable; 所属替え後の画面で既存 workspace RBAC のチェックを維持する
- Quality: applicable; P04のテストが緑化することを完了条件とする
- Documentation: N/A: 文書更新はP12/P13が所有する
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 /admin/content・/admin/personas・/admin/writing 配下画面の転送シェルへの置換と重複実装解消はP08が所有する

## 成果物

- Produced artifacts: src/app/admin/sites/[site]/audience/personas/ 配下 (読者像画面の所属替え先); src/app/admin/sites/[site]/writing/ 配下 (書き方の決め事画面の所属替え先、共通雛形からの複製導線を含む); src/app/admin/personas/ 配下 (site特定可否で分岐する転送シェルへの置換); src/app/admin/writing/ 配下 (site特定可否で分岐する転送シェルへの置換); src/app/admin/content/ 配下 (site特定可否で分岐する転送シェルへの置換。転送先記事画面自体はfeat-blog-scoped-admin-console管轄); src/app/admin/page.tsx (93ルートを作業の対象物 (ブログ・記事・読者・商品・配信) 数まで畳んだ一段目入口ダッシュボード); src/app/admin/layout.tsx (よく使う画面への近道ナビゲーション)
- Consumed artifacts: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md, docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md, docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md, docs/spec/feat-site-scoped-authoring-ia/shortcut-contract.md, docs/spec/feat-site-scoped-authoring-ia/template-clone-contract.md, docs/spec/feat-site-scoped-authoring-ia/test-design.md
- Write scope/touches: src/app/admin/sites/[site]/, src/app/admin/content/, src/app/admin/personas/, src/app/admin/writing/, src/app/admin/layout.tsx, src/app/admin/page.tsx

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SITE-SCOPED-AUTHORING-IA-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SITE-SCOPED-AUTHORING-IA-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SITE-SCOPED-AUTHORING-IA-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
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
- write_scope外のパスへの変更
- 既存 feat-blog-scoped-admin-console が所有する /admin/sites/[site]/ 配下の記事画面そのものの新設

## テスト戦略

- テストレベル選定: 単体: 転送先パス解決関数・site セグメント解決関数・作業対象物への束ね直しマッピング関数の単体テストを緑化する。結合: 旧 URL アクセスから転送先ページ描画までの結合テストを緑化する。境界値: site 未解決時の notFound 遷移・ブログ未特定時のブログ選択誘導・危険操作の確認有無分岐の境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/app/admin/sites/[site]/, src/app/admin/personas/, src/app/admin/writing/, src/app/admin/content/, src/app/admin/page.tsx, src/app/admin/layout.tsx) に適用する。
- 層別方針: フロントエンド: behavior ベースで転送遷移・notFound 遷移・入口ラベル表示・近道導線・雛形複製導線の振る舞いを検証する。バックエンド/API/データ: 既存 site_daily_metrics / article_daily_metrics の読み出しが新規集計を追加しないことを、既存 API 契約の範囲内で DB 結合により検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・遷移先URLなど振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm test`
- Automated commands: `pnpm run typecheck`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入10件 (A1-A10) に対応する実装 (読者像・書き方の決め事の /admin/sites/[site]/ 配下への所属替え、/admin/content・/admin/personas・/admin/writing からの site 特定可否分岐の転送、site 未解決時の notFound、93ルートを作業の対象物数まで畳む入口束ね直し、動詞ラベルの適用、よく使う画面への近道、書き方の決め事の共通雛形からの複製経路) を完了し、P04のテストを緑化した状態を成立させる。
- Generic execution prompt: feat-site-scoped-authoring-ia の goal (読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-site-scoped-authoring-ia
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-SITE-SCOPED-AUTHORING-IA-P04

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` で published task spec と package 全体を再検証する。
