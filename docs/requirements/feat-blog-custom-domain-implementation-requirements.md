# 実装要件定義書: feat-blog-custom-domain

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:32201ef63bbd04e586be9983b6765d83305d310be3ed94024a39e4884371eded`
- feature package: `feature-package/feat-blog-custom-domain`
- promoted generation digest: `sha256:e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-blog-custom-domain/e33eb8d95a75835e66b14bef7d64e50b255e1ee0063d3b8d10a59fca9d73e581`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

住所層。ブログ 1 本ごとに利用者が取得したドメインを繋ぎ、所有権が検証されたものだけを active にする。既定住所は常に生きたままにする。

- 目的: 利用者が自分で取得したドメインをブログ 1 本ごとに繋ぎ、繋がっているか・証明書が生きているかを管理画面の一箇所で見て操作できるようにする
- 到達状態: 所有権が検証されたドメインだけが active になり、Host ヘッダから site_slug が解決されて当該ブログが配信され、active の間は canonical が独自ドメインを指し、切断しても行は revoked として残り、既定住所は常に生きている状態になっている

## 実装範囲

- site_custom_domains テーブル (workspace_id / site_slug / hostname UNIQUE / status pending→verifying→active→failed→revoked / verification_token / provider_hostname_id / cert_status / verified_at / last_checked_at / failure_reason)
- connect-custom-domain ユースケース: hostname を受け取り Cloudflare for SaaS の custom hostname として登録し、利用者へ提示する CNAME と所有権確認用 TXT を返す
- verify-custom-domain ユースケース: provider 側の検証・証明書発行状態を取り込み status と cert_status を進める
- disconnect-custom-domain ユースケース: 行を物理削除せず revoked にし、hostname の再接続経路を残す
- middleware での Host ヘッダ→ site_custom_domains active 行 → site_slug 解決 (該当なしは既定住所の解決へ委譲)
- active の間 canonical / og:url / sitemap の絶対 URL を独自ドメインへ切り替える
- 接続・切断の権限を Publisher 以上に限り、切断はブログ名の入力を要求し、いずれも audit_logs へ残す
- 管理画面 /admin/sites/[site]/domain での接続手順・現在状態・失敗理由の提示

## 範囲外

- ドメインの購入・レジストラ契約そのもの (利用者が外部で取得する)
- 自前 ACME による証明書発行 (Cloudflare for SaaS が発行する)
- 既定住所 <slug>.<基底ドメイン> の導出とワイルドカード経路 (feat-blog-subdomain-routing)
- ドメイン状態の定期監視と期限警告の掲出順序 (feat-blog-scoped-admin-console)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-blog-ops-crud` | 先に成立していることを前提にする |
| feature depends_on | `feat-blog-subdomain-routing` | 先に成立していることを前提にする |
| feature depends_on | `feat-auth-workspace` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 所有権が検証されるまで status が active にならず、未検証ホストへのアクセスで当該ブログが配信されない | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11,P13 |
| A2 | hostname に UNIQUE 制約があり、同じホスト名を 2 つのブログへ同時に繋げない | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11 |
| A3 | active な独自ドメインへのアクセスが当該ブログの内容を 200 で返す | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A4 | 独自ドメインが active の間も既定住所 <slug>.<基底ドメイン> が 200 を返し、ブログが消えない | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A5 | active の間 canonical が独自ドメインを指し、非 active へ戻ると既定住所へ戻る | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A6 | 切断しても行が削除されず status=revoked として残り、hostname の履歴が追える | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A7 | 接続・切断が Publisher 未満の役割から実行できず、切断はブログ名の一致入力なしに完了しない | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A8 | 接続・検証・切断の各操作が audit_logs に残る | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A9 | provider 側の検証失敗・証明書失敗が failure_reason として管理画面に文言で出る | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11,P12 |
| A10 | 同じ hostname で接続を二度実行しても custom hostname が重複登録されない (冪等) | features/feat-blog-custom-domain.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-blog-custom-domain.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-BLOG-CUSTOM-DOMAIN-P01` | 独自ドメイン接続の要求ベースライン確定 | — |
| P02 | `SYS-BLOG-CUSTOM-DOMAIN-P02` | site_custom_domains のデータモデルと provider 連携契約の確定 | P01 |
| P03 | `SYS-BLOG-CUSTOM-DOMAIN-P03` | 独自ドメイン設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-BLOG-CUSTOM-DOMAIN-P04` | 独自ドメイン受入のテスト設計 | P03 |
| P05 | `SYS-BLOG-CUSTOM-DOMAIN-P05` | 独自ドメイン接続機能の実装 | P04 |
| P06 | `SYS-BLOG-CUSTOM-DOMAIN-P06` | 独自ドメイン機能のテスト実行と緑化 | P05 |
| P07 | `SYS-BLOG-CUSTOM-DOMAIN-P07` | 独自ドメイン受入10件の判定 | P06 |
| P08 | `SYS-BLOG-CUSTOM-DOMAIN-P08` | 既存ホスト解決経路との重複解消と移行 | P05 |
| P09 | `SYS-BLOG-CUSTOM-DOMAIN-P09` | 独自ドメイン機能の非機能検査 | P08 |
| P10 | `SYS-BLOG-CUSTOM-DOMAIN-P10` | 独自ドメイン機能の最終レビュー | P09 |
| P11 | `SYS-BLOG-CUSTOM-DOMAIN-P11` | 独自ドメイン機能の証跡集約 | P07, P09 |
| P12 | `SYS-BLOG-CUSTOM-DOMAIN-P12` | 独自ドメイン接続の運用手順と利用者向け説明 | P10, P11 |
| P13 | `SYS-BLOG-CUSTOM-DOMAIN-P13` | 独自ドメイン機能のリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-blog-custom-domain` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-BLOG-CUSTOM-DOMAIN-P01..P13` | confirmed | pass | complete | なし |

closure 17 node すべてが同一 graph snapshot 上で三 gate を通過している。`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph build への制約

- 実装前に、このリポジトリの `node_modules/next/dist/docs/` で対象 API の Next.js 16 現行ガイドを読む。訓練データの Next.js とは異なる。
- 既存の blog-ops、affiliate、auth、D1/Drizzle、Cloudflare Workers/OpenNext の境界を維持し、同じ責務の use case / store を増やさない。
- P04 のテストを先に定義し、pixel 位置や DOM 構造ではなく、可視ラベル、accessible name、状態、API 契約、永続化結果で検証する。
- 4 層の禁止依存 (観測層→改善層の直接呼び出し、改善層→公開面の直接書き込み、提示層での再集計、`site_slug` 以外のブログ識別子の定義) を実装で破らない。
- 本番公開、外部サービス契約変更、破壊的移行は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各 task の write_scope と Verification and evidence を実装 authority とする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-blog-custom-domain.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-blog-custom-domain.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-blog-custom-domain.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-blog-custom-domain.json`
- implementation code generated by this verb: `0`
