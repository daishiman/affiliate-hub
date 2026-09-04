# System task overlay: 独自ドメイン機能の最終レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-custom-domain
- owners: ["daishiman"]
- tags: ["p10", "feat-blog-custom-domain"]
- related_nodes: []
- parent_feature: feat-blog-custom-domain
- phase_ref: P10
- classification: confidence=1.0; reason=feat-blog-custom-domain の P10 lifecycle 責務への確定写像; candidate=tasks/feat-blog-custom-domain/sys-blog-custom-domain-p10.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01 から P09 までの成果物を通しでレビューし、要求・設計・実装・テスト・受入判定の間に断絶が無いことを確認して残課題を確定した状態を成立させる。

## 背景

phase を跨ぐと、要求で書いた条件が設計で言い換えられ、実装で別の意味になることが起きる。最終レビューでは各 phase の成果物を並べ、受入条文から実装コードまでの追跡が切れていないことを確認する。

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
- Infrastructure: applicable; Cloudflare for SaaS custom hostname の登録と証明書状態の取り込みを扱う
- Security: applicable; Publisher 以上への権限限定・ブログ名一致入力・audit_logs 記録を扱う
- Quality: applicable; 未検証ホストが配信されないことと既定住所が生き続けることを検証する
- Documentation: applicable; 接続手順の利用者向け説明を扱う
- Operations: N/A: 定期監視と警告掲出は feat-blog-scoped-admin-console が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-custom-domain/final-review.md (通しレビューの結果と残課題)
- Consumed artifacts: features/feat-blog-custom-domain.md; features/feat-blog-custom-domain.context.json; system-spec/infrastructure.md; system-spec/backend.md; system-spec/database.md
- Write scope/touches: docs/spec/feat-blog-custom-domain/final-review.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-CUSTOM-DOMAIN-P10; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-CUSTOM-DOMAIN-P10; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-CUSTOM-DOMAIN-P10 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-custom-domain 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 (slug.基底ドメイン 形式のサブドメイン) の導出とワイルドカード経路 (feat-blog-subdomain-routing が所有する)
- ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console が所有する)
- P10 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: レビュー phase のため新規テストを追加せず、既存全テストの緑を維持することを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/domains, src/application/domains, src/infrastructure/cloudflare, src/app/admin/sites/[site]/domain) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (最終状態の型整合を確認する)
- Automated commands: `pnpm vitest run` (最終状態の全テスト緑を確認する)
- Required evidence: P10 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P01 から P09 までの成果物を通しでレビューし、要求・設計・実装・テスト・受入判定の間に断絶が無いことを確認して残課題を確定した状態を成立させる。
- Generic execution prompt: feat-blog-custom-domain の goal (所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P10 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P10 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P10 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 通しレビューの高重大度残課題が0件である

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/infrastructure.md, system-spec/backend.md, system-spec/database.md, system-spec/security.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-custom-domain
- Phase doc: system-plan-phase-names.md#P10
- Dependencies: SYS-BLOG-CUSTOM-DOMAIN-P09
