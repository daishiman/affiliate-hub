# System task overlay: site_custom_domains のデータモデルと provider 連携契約の確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-custom-domain
- owners: ["daishiman"]
- tags: ["p02", "feat-blog-custom-domain"]
- related_nodes: []
- parent_feature: feat-blog-custom-domain
- phase_ref: P02
- classification: confidence=1.0; reason=feat-blog-custom-domain の P02 lifecycle 責務への確定写像; candidate=tasks/feat-blog-custom-domain/sys-blog-custom-domain-p02.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

site_custom_domains のスキーマ (workspace_id / site_slug / hostname UNIQUE / status / verification_token / provider_hostname_id / cert_status / verified_at / last_checked_at / failure_reason) と、connect・verify・disconnect の3ユースケース契約、および Host ヘッダから site_slug を解決する経路の設計を確定した状態を成立させる。

## 背景

P01 が確定した受入と状態遷移を、D1 上のテーブル定義・Drizzle スキーマ・API 契約・middleware の解決順序へ落とす。hostname の UNIQUE 制約は「同じホスト名を2つのブログへ同時に繋げない」という受入を、アプリ層ではなくデータ層で保証するための設計判断である。provider 側の識別子 provider_hostname_id を保持することで、同じ hostname での二度目の接続が custom hostname を重複登録しない冪等性を成立させる。

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
- Compatibility/migration/backfill: 既存 src/middleware.ts のサブドメイン解決を壊さない追加として設計し、移行そのものは P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-custom-domain/data-model.md (site_custom_domains の列・制約・インデックスと既存 sites との関係); docs/spec/feat-blog-custom-domain/admin-api-contract.md (接続・検証・切断の要求/応答と失敗理由の語彙); docs/spec/feat-blog-custom-domain/host-resolution-design.md (Host ヘッダから site_slug への解決順序と既定住所への委譲条件)
- Consumed artifacts: features/feat-blog-custom-domain.md; features/feat-blog-custom-domain.context.json; system-spec/infrastructure.md; system-spec/backend.md; system-spec/database.md
- Write scope/touches: docs/spec/feat-blog-custom-domain/data-model.md, docs/spec/feat-blog-custom-domain/admin-api-contract.md, docs/spec/feat-blog-custom-domain/host-resolution-design.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-CUSTOM-DOMAIN-P02; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-CUSTOM-DOMAIN-P02; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-CUSTOM-DOMAIN-P02 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-custom-domain 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 (slug.基底ドメイン 形式のサブドメイン) の導出とワイルドカード経路 (feat-blog-subdomain-routing が所有する)
- ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console が所有する)
- P02 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 設計段階のため実行テストは持たず、P04 のテスト設計が本契約を入力として受け取れる粒度であることを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/domains, src/application/domains, src/infrastructure/cloudflare, src/app/admin/sites/[site]/domain) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (設計文書が前提とする既存の型と齟齬が無いことを確認する)
- Automated commands: `pnpm run lint` (設計に伴う既存コードの参照整合を静的に確認する)
- Required evidence: P02 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: site_custom_domains のスキーマ (workspace_id / site_slug / hostname UNIQUE / status / verification_token / provider_hostname_id / cert_status / verified_at / last_checked_at / failure_reason) と、connect・verify・disconnect の3ユースケース契約、および Host ヘッダから site_slug を解決する経路の設計を確定した状態を成立させる。
- Generic execution prompt: feat-blog-custom-domain の goal (所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P02 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P02 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P02 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: スキーマ・API 契約・Host 解決順序が確定し、P04 のテスト設計が着手できる

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/infrastructure.md, system-spec/backend.md, system-spec/database.md, system-spec/security.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-custom-domain
- Phase doc: system-plan-phase-names.md#P02
- Dependencies: SYS-BLOG-CUSTOM-DOMAIN-P01
