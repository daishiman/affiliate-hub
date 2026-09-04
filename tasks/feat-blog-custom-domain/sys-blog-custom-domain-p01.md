---
graph_node_id: "SYS-BLOG-CUSTOM-DOMAIN-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-custom-domain"
domain: "documentation"
tags: ["p01","feat-blog-custom-domain"]
priority: null
start_date: null
target_date: null
iteration: null
title: "独自ドメイン接続の要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-09-03T23:50:30Z"
updated_at: "2026-09-04T02:35:59.415244Z"
status: "active"
depends_on: []
related_nodes: []
resource_scope: ["docs/spec/feat-blog-custom-domain/requirements-baseline.md","docs/spec/feat-blog-custom-domain/domain-state-machine.md","docs/spec/feat-blog-custom-domain/screen-inventory.md"]
purpose: "feat-blog-custom-domain の受入10件それぞれを、検証可能な条件文と対応する状態遷移・画面要求へ一意対応させ、既定住所と独自ドメインが同時に生きるという不変条件を実装着手前に確定した状態を成立させる。"
goal: "feat-blog-custom-domain の受入10件それぞれを、検証可能な条件文と対応する状態遷移・画面要求へ一意対応させ、既定住所と独自ドメインが同時に生きるという不変条件を実装着手前に確定した状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-custom-domain/requirements-baseline.md (受入10件と状態遷移・画面要求の一意対応表); docs/spec/feat-blog-custom-domain/domain-state-machine.md (pending から verifying, active, failed, revoked への遷移条件と禁止遷移); docs/spec/feat-blog-custom-domain/screen-inventory.md (既存 src/app/admin/sites 配下の棚卸しと domain 画面の差分)","Consumed artifacts: features/feat-blog-custom-domain.md; features/feat-blog-custom-domain.context.json; system-spec/infrastructure.md; system-spec/backend.md; system-spec/database.md","Write scope/touches: docs/spec/feat-blog-custom-domain/requirements-baseline.md, docs/spec/feat-blog-custom-domain/domain-state-machine.md, docs/spec/feat-blog-custom-domain/screen-inventory.md"]
scope_out: ["ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)","自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)","既定住所 (slug.基底ドメイン 形式のサブドメイン) の導出とワイルドカード経路 (feat-blog-subdomain-routing が所有する)","ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console が所有する)","P01 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm run typecheck` (要求文書が参照する既存型契約と矛盾しないことを静的に確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-custom-domain` (本 package の C12 決定論検証を再実行する)","Required evidence: P01 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-blog-custom-domain"
feature_package_id: "feature-package/feat-blog-custom-domain"
phase_ref: "P01"
file_path: "tasks/feat-blog-custom-domain/sys-blog-custom-domain-p01.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-custom-domain/e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:50:30Z","origin_kind":"system-dev-planner","source_digest":"e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581","source_path":".dev-graph/published/generations/feature-package-feat-blog-custom-domain/e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-custom-domain の P01 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-custom-domain/sys-blog-custom-domain-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-t7vv.1","github_mirror":null,"linked_at":"2026-09-04T02:05:41Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 独自ドメイン接続の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-custom-domain
- owners: ["daishiman"]
- tags: ["p01", "feat-blog-custom-domain"]
- related_nodes: []
- parent_feature: feat-blog-custom-domain
- phase_ref: P01
- classification: confidence=1.0; reason=feat-blog-custom-domain の P01 lifecycle 責務への確定写像; candidate=tasks/feat-blog-custom-domain/sys-blog-custom-domain-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-blog-custom-domain の受入10件それぞれを、検証可能な条件文と対応する状態遷移・画面要求へ一意対応させ、既定住所と独自ドメインが同時に生きるという不変条件を実装着手前に確定した状態を成立させる。

## 背景

system-spec/infrastructure.md の確定質疑 qa-infra-web-custom-hostname は、利用者が外部で取得したドメインを Cloudflare for SaaS の custom hostname として引き受ける方針を利用者本人の回答として確定している。既存 src/middleware.ts は既定住所のサブドメイン解決だけを持ち、任意ホスト名から site_slug を解決する経路と、所有権が未検証のホストを配信しないための状態機械が存在しない。本 phase では受入10件を検証可能な形へ書き下ろし、後続設計の判断根拠にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-custom-domain, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/infrastructure.md, system-spec/backend.md, system-spec/database.md, system-spec/security.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; /admin/sites/[site]/domain の接続手順・現在状態・失敗理由の提示を扱う
- Backend: applicable; connect/verify/disconnect の3ユースケースと Host 解決を扱う
- API: applicable; 管理画面から呼ぶ接続・検証・切断エンドポイントの契約を扱う
- Data: applicable; site_custom_domains テーブルと hostname UNIQUE 制約を扱う
- Infrastructure: N/A: provider 連携の設計は P02 が所有する
- Security: applicable; Publisher 以上への権限限定・ブログ名一致入力・audit_logs 記録を扱う
- Quality: applicable; 受入10件を検証可能な形へ書き下すことを完了条件とする
- Documentation: applicable; 接続手順の利用者向け説明を扱う
- Operations: N/A: 定期監視と警告掲出は feat-blog-scoped-admin-console が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-custom-domain/requirements-baseline.md (受入10件と状態遷移・画面要求の一意対応表); docs/spec/feat-blog-custom-domain/domain-state-machine.md (pending から verifying, active, failed, revoked への遷移条件と禁止遷移); docs/spec/feat-blog-custom-domain/screen-inventory.md (既存 src/app/admin/sites 配下の棚卸しと domain 画面の差分)
- Consumed artifacts: features/feat-blog-custom-domain.md; features/feat-blog-custom-domain.context.json; system-spec/infrastructure.md; system-spec/backend.md; system-spec/database.md
- Write scope/touches: docs/spec/feat-blog-custom-domain/requirements-baseline.md, docs/spec/feat-blog-custom-domain/domain-state-machine.md, docs/spec/feat-blog-custom-domain/screen-inventory.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-CUSTOM-DOMAIN-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-CUSTOM-DOMAIN-P01; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-CUSTOM-DOMAIN-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-custom-domain 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 (slug.基底ドメイン 形式のサブドメイン) の導出とワイルドカード経路 (feat-blog-subdomain-routing が所有する)
- ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console が所有する)
- P01 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 本 phase は文書成果物のため実行テストを持たず、受入10件が漏れなく検証可能文へ写像されたことのレビューを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/domains, src/application/domains, src/infrastructure/cloudflare, src/app/admin/sites/[site]/domain) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (要求文書が参照する既存型契約と矛盾しないことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-custom-domain` (本 package の C12 決定論検証を再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-blog-custom-domain の受入10件それぞれを、検証可能な条件文と対応する状態遷移・画面要求へ一意対応させ、既定住所と独自ドメインが同時に生きるという不変条件を実装着手前に確定した状態を成立させる。
- Generic execution prompt: feat-blog-custom-domain の goal (所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件の要求写像が確定し、既定住所を壊さない不変条件が文書として固定されている

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/infrastructure.md, system-spec/backend.md, system-spec/database.md, system-spec/security.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-custom-domain
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
