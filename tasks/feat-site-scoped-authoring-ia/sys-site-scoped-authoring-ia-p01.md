---
graph_node_id: "SYS-SITE-SCOPED-AUTHORING-IA-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-site-scoped-authoring-ia"
domain: "documentation"
tags: ["p01","feat-site-scoped-authoring-ia"]
priority: null
start_date: null
target_date: null
iteration: null
title: "サイト所属型オーサリングIAの要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-09-08T04:15:58Z"
updated_at: "2026-09-09T00:00:00Z"
status: "active"
depends_on: []
related_nodes: []
resource_scope: ["docs/spec/feat-site-scoped-authoring-ia/requirements-baseline.md","docs/spec/feat-site-scoped-authoring-ia/route-inventory.json","docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json"]
purpose: "受入10件 (A1-A10) を実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 93 本の管理ルートの棚卸し、作業の対象物 (ブログ・記事・読者・商品・配信) への束ね直しマッピング、/admin/content/*・/admin/personas/*・/admin/writing/* の転送要件、site 未解決時の notFound 要件、近道要件、書き方の決め事の雛形複製要件を、既存コード (src/app/admin/ 配下) の実体に接地させた状態を成立させる。"
goal: "受入10件 (A1-A10) を実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 93 本の管理ルートの棚卸し、作業の対象物 (ブログ・記事・読者・商品・配信) への束ね直しマッピング、/admin/content/*・/admin/personas/*・/admin/writing/* の転送要件、site 未解決時の notFound 要件、近道要件、書き方の決め事の雛形複製要件を、既存コード (src/app/admin/ 配下) の実体に接地させた状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-site-scoped-authoring-ia/requirements-baseline.md (A1-A10の検証可能化と対応表); docs/spec/feat-site-scoped-authoring-ia/route-inventory.json (既存93ルートの棚卸しと作業対象物 (ブログ/記事/読者/商品/配信) への束ね直しマッピング); docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json (/admin/content・/admin/personas・/admin/writing の旧→新パス対応ドラフト)","Consumed artifacts: features/feat-site-scoped-authoring-ia.md, features/feat-site-scoped-authoring-ia.context.json, system-spec/ui-ux.md, system-spec/frontend.md, features/feat-blog-scoped-admin-console.md (受け皿確認用、変更しない), features/feat-reference-blog-admin-ux.md (規則参照用、変更しない)","Write scope/touches: docs/spec/feat-site-scoped-authoring-ia/requirements-baseline.md, docs/spec/feat-site-scoped-authoring-ia/route-inventory.json, docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json"]
scope_out: ["新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)","/admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)","記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)","ブログの作成・削除そのもの (feat-blog-ops-crud)","権限モデルの新設 (既存 workspace 権限を使う)","管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本","既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本)","makuring.jp 等の外部参照ブログの機械取得や文章・素材の複製"]
acceptance: ["Automated commands: `pnpm run typecheck`","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P01 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-site-scoped-authoring-ia"
feature_package_id: "feature-package/feat-site-scoped-authoring-ia"
phase_ref: "P01"
file_path: "tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p01.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-08T04:15:58Z","origin_kind":"system-dev-planner","source_digest":"1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf","source_path":".dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-site-scoped-authoring-ia の P01 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ro3w.1","github_mirror":null,"linked_at":"2026-09-08T05:32:27Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-08T09:08:53Z","evidence_refs":["beads:ah-ro3w.1"],"policy":"manual","reconciled_at":"2026-09-09T00:00:00Z","source":"reconciliation","status":"done"}
implementation_readiness: {"checked_at":"2026-09-08T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: サイト所属型オーサリングIAの要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-site-scoped-authoring-ia
- owners: ["daishiman"]
- tags: ["p01", "feat-site-scoped-authoring-ia"]
- related_nodes: []
- parent_feature: feat-site-scoped-authoring-ia
- phase_ref: P01
- classification: confidence=1.0; reason=feat-site-scoped-authoring-ia の P01 lifecycle 責務への確定写像; candidate=tasks/feat-site-scoped-authoring-ia/sys-site-scoped-authoring-ia-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入10件 (A1-A10) を実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 93 本の管理ルートの棚卸し、作業の対象物 (ブログ・記事・読者・商品・配信) への束ね直しマッピング、/admin/content/*・/admin/personas/*・/admin/writing/* の転送要件、site 未解決時の notFound 要件、近道要件、書き方の決め事の雛形複製要件を、既存コード (src/app/admin/ 配下) の実体に接地させた状態を成立させる。

## 背景

system-spec/ui-ux.md の qa-uiux-web-site-scoped-authoring-ia と system-spec/frontend.md の qa-frontend-web-site-scoped-route-ownership は、管理ルートが 93 本あり作業の対象物単位ではなく機能単位で並んでいるため目的の画面へ辿り着く前にどれが自分の作業かを判断する手間が挟まっている現状課題と、読者像・書き方の決め事を /admin/sites/[site]/ 配下へ所属替えし、記事・所属替え対象以外の旧入口は転送で受ける方針を利用者本人の回答として確定している。受け皿である /admin/sites/[site]/ 階層と記事画面そのものの新設・配置は feat-blog-scoped-admin-console が正本であり、本 feature はその配下へ読者像 (/admin/personas/*) と書き方の決め事 (/admin/writing/*) を所属替えし、記事については旧 /admin/content/* からの転送だけを担う。動詞ラベル・危険操作の分離・直接編集の UX 規則そのものは feat-reference-blog-admin-ux が正本であり、本 feature はそれを適用する側に回る。既存指標の提示順序そのものの規則は feat-blog-scoped-admin-console が正本、数値の正本は feat-blog-metrics-rollup の site_daily_metrics / article_daily_metrics であり、本 feature は新しい指標や集計表を作らない。 既存 src/app/admin 配下には page.tsx が 93 本存在し、読者像 (personas) と書き方の決め事 (writing) はサイト非依存の機能単位で配置されているため、本 phase でこれらの棚卸しと要求の書き下ろしを行い、後続設計の判断根拠にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-site-scoped-authoring-ia, system-spec/ui-ux.md, system-spec/frontend.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json


## Workstream applicability

- Frontend: applicable; 既存 src/app/admin 配下の page.tsx 93本を単一用途の観点で棚卸しし、作業対象物 (ブログ・記事・読者・商品・配信) への束ね直し案を要求として確定する
- Backend: N/A: 転送・所属替えの実装はP05が所有する
- API: N/A: 本 feature は新規APIを持たない
- Data: N/A: 新しいデータモデルは作らない (既存 site_daily_metrics / article_daily_metrics のみ読む)
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: N/A: 権限要求は既存 workspace RBAC の範囲を超えないためP01では扱わない
- Quality: applicable; 受入10件を検証可能な形へ書き下すことを完了条件とする
- Documentation: applicable; 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 /admin/content・/admin/personas・/admin/writing 配下画面の転送シェルへの置換と重複実装解消はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-site-scoped-authoring-ia/requirements-baseline.md (A1-A10の検証可能化と対応表); docs/spec/feat-site-scoped-authoring-ia/route-inventory.json (既存93ルートの棚卸しと作業対象物 (ブログ/記事/読者/商品/配信) への束ね直しマッピング); docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json (/admin/content・/admin/personas・/admin/writing の旧→新パス対応ドラフト)
- Consumed artifacts: features/feat-site-scoped-authoring-ia.md, features/feat-site-scoped-authoring-ia.context.json, system-spec/ui-ux.md, system-spec/frontend.md, features/feat-blog-scoped-admin-console.md (受け皿確認用、変更しない), features/feat-reference-blog-admin-ux.md (規則参照用、変更しない)
- Write scope/touches: docs/spec/feat-site-scoped-authoring-ia/requirements-baseline.md, docs/spec/feat-site-scoped-authoring-ia/route-inventory.json, docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SITE-SCOPED-AUTHORING-IA-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SITE-SCOPED-AUTHORING-IA-P01; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SITE-SCOPED-AUTHORING-IA-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
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
- makuring.jp 等の外部参照ブログの機械取得や文章・素材の複製

## テスト戦略

- テストレベル選定: 単体: 転送先パス解決関数・site セグメント解決関数・作業対象物への束ね直しマッピング関数の単体テストを緑化する。結合: 旧 URL アクセスから転送先ページ描画までの結合テストを緑化する。境界値: site 未解決時の notFound 遷移・ブログ未特定時のブログ選択誘導・危険操作の確認有無分岐の境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/app/admin/sites/[site]/, src/app/admin/personas/, src/app/admin/writing/, src/app/admin/content/, src/app/admin/page.tsx, src/app/admin/layout.tsx) に適用する。
- 層別方針: フロントエンド: behavior ベースで転送遷移・notFound 遷移・入口ラベル表示・近道導線・雛形複製導線の振る舞いを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・遷移先URLなど振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入10件 (A1-A10) を実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 93 本の管理ルートの棚卸し、作業の対象物 (ブログ・記事・読者・商品・配信) への束ね直しマッピング、/admin/content/*・/admin/personas/*・/admin/writing/* の転送要件、site 未解決時の notFound 要件、近道要件、書き方の決め事の雛形複製要件を、既存コード (src/app/admin/ 配下) の実体に接地させた状態を成立させる。
- Generic execution prompt: feat-site-scoped-authoring-ia の goal (読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-site-scoped-authoring-ia
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` で published task spec と package 全体を再検証する。
