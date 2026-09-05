---
graph_node_id: "feat-blog-custom-domain"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "infrastructure"
tags: ["blog","domain","custom-hostname","cloudflare-for-saas","tls","canonical"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "ブログごとの独自ドメイン接続と一式管理"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:28:24.476655Z"
status: "active"
depends_on: ["feat-blog-ops-crud","feat-blog-subdomain-routing","feat-auth-workspace"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-reader-surface"]
resource_scope: ["src/db/schema.ts","src/domain/domains/","src/application/domains/","src/infrastructure/cloudflare/custom-hostname.ts","src/middleware.ts","src/app/admin/sites/[site]/domain/","system-spec","features/feat-blog-custom-domain.context.json"]
purpose: "利用者が自分で取得したドメインをブログ 1 本ごとに繋ぎ、繋がっているか・証明書が生きているかを管理画面の一箇所で見て操作できるようにする"
goal: "所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている"
scope_in: ["site_custom_domains テーブル (workspace_id / site_slug / hostname UNIQUE / status pending→verifying→active→failed→revoked / verification_token / provider_hostname_id / cert_status / verified_at / last_checked_at / failure_reason)","connect-custom-domain ユースケース: hostname を受け取り Cloudflare for SaaS の custom hostname として登録し、利用者へ提示する CNAME と所有権確認用 TXT を返す","verify-custom-domain ユースケース: provider 側の検証・証明書発行状態を取り込み status と cert_status を進める","disconnect-custom-domain ユースケース: 行を物理削除せず revoked にし、hostname の再接続経路を残す","middleware での Host ヘッダ→ site_custom_domains active 行 → site_slug 解決 (該当なしは既定住所の解決へ委譲)","active の間 canonical / og:url / sitemap の絶対 URL を独自ドメインへ切り替える","接続・切断の権限を Publisher 以上に限り、切断はブログ名の入力を要求し、いずれも audit_logs へ残す","管理画面 /admin/sites/[site]/domain での接続手順・現在状態・失敗理由の提示"]
scope_out: ["ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)","自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)","既定住所 <slug>.<基底ドメイン> の導出とワイルドカード経路 (feat-blog-subdomain-routing)","ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console)"]
acceptance: ["所有権が検証されるまで status が active にならず、未検証ホストへのアクセスで当該ブログが配信されない","hostname に UNIQUE 制約があり、同じホスト名を 2 つのブログへ同時に繋げない","active な独自ドメインへのアクセスが当該ブログの内容を 200 で返す","独自ドメインが active の間も既定住所 <slug>.<基底ドメイン> が 200 を返し、ブログが消えない","active の間 canonical が独自ドメインを指し、非 active へ戻ると既定住所へ戻る","切断しても行が削除されず status=revoked として残り、hostname の履歴が追える","接続・切断が Publisher 未満の役割から実行できず、切断はブログ名の一致入力なしに完了しない","接続・検証・切断の各操作が audit_logs に残る","provider 側の検証失敗・証明書失敗が failure_reason として管理画面に文言で出る","同じ hostname で接続を二度実行しても custom hostname が重複登録されない (冪等)"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-custom-domain.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-custom-domain/e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-infra-web-custom-hostname / qa-database-web-domain-aeo-behavior / qa-backend-web-domain-aeo-behavior / qa-security-web-domain-behavior-privacy / qa-auth-web-domain-analytics-authority を lineage 参照。利用者要望『各ブログごとにドメインを取得して、そのドメインをここの管理画面で一式で管理できるような構成』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-custom-domain.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-t7vv","github_mirror":null,"linked_at":"2026-09-04T02:05:39Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

利用者が自分で取得したドメインをブログ 1 本ごとに繋ぎ、繋がっているか・証明書が生きているかを管理画面の一箇所で見て操作できるようにする

## 到達状態

所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている

## スコープ

スコープ内:

- site_custom_domains テーブル (workspace_id / site_slug / hostname UNIQUE / status pending→verifying→active→failed→revoked / verification_token / provider_hostname_id / cert_status / verified_at / last_checked_at / failure_reason)
- connect-custom-domain ユースケース: hostname を受け取り Cloudflare for SaaS の custom hostname として登録し、利用者へ提示する CNAME と所有権確認用 TXT を返す
- verify-custom-domain ユースケース: provider 側の検証・証明書発行状態を取り込み status と cert_status を進める
- disconnect-custom-domain ユースケース: 行を物理削除せず revoked にし、hostname の再接続経路を残す
- middleware での Host ヘッダ→ site_custom_domains active 行 → site_slug 解決 (該当なしは既定住所の解決へ委譲)
- active の間 canonical / og:url / sitemap の絶対 URL を独自ドメインへ切り替える
- 接続・切断の権限を Publisher 以上に限り、切断はブログ名の入力を要求し、いずれも audit_logs へ残す
- 管理画面 /admin/sites/[site]/domain での接続手順・現在状態・失敗理由の提示

スコープ外:

- ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 <slug>.<基底ドメイン> の導出とワイルドカード経路 (feat-blog-subdomain-routing)
- ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console)

## 受入

- [ ] 所有権が検証されるまで status が active にならず、未検証ホストへのアクセスで当該ブログが配信されない
- [ ] hostname に UNIQUE 制約があり、同じホスト名を 2 つのブログへ同時に繋げない
- [ ] active な独自ドメインへのアクセスが当該ブログの内容を 200 で返す
- [ ] 独自ドメインが active の間も既定住所 <slug>.<基底ドメイン> が 200 を返し、ブログが消えない
- [ ] active の間 canonical が独自ドメインを指し、非 active へ戻ると既定住所へ戻る
- [ ] 切断しても行が削除されず status=revoked として残り、hostname の履歴が追える
- [ ] 接続・切断が Publisher 未満の役割から実行できず、切断はブログ名の一致入力なしに完了しない
- [ ] 接続・検証・切断の各操作が audit_logs に残る
- [ ] provider 側の検証失敗・証明書失敗が failure_reason として管理画面に文言で出る
- [ ] 同じ hostname で接続を二度実行しても custom hostname が重複登録されない (冪等)

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`arch-system-spec-overview`、`feat-reader-surface`

## 機能間依存

- `depends_on`: `feat-blog-ops-crud`
- `depends_on`: `feat-blog-subdomain-routing`
- `depends_on`: `feat-auth-workspace`
- 依存理由: 接続先のブログ実体 (feat-blog-ops-crud) と、独自ドメインが無い間の既定住所・ホスト解決経路 (feat-blog-subdomain-routing)、および接続/切断を許す権限判定の土台 (feat-auth-workspace) が先に要る。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-custom-domain` と repo-relative `--feature-context features/feat-blog-custom-domain.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-custom-domain` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: site_custom_domains のスキーマ・provider 連携・所有権検証・Host 解決・canonical 切替・権限と監査ログを P01..P13 へ分解する。evidence は未検証ホストが配信されないことと既定住所が生き続けることを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 10 件を evidence が満たした場合だけ本 feature を done にする。
