---
graph_node_id: "feat-blog-subdomain-routing"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "infrastructure"
tags: ["blog","domain","subdomain","wildcard-dns","routing","middleware"]
priority: "high"
start_date: "2026-08-31"
target_date: null
iteration: null
title: "サブドメイン方式のブログ住所付与とホスト解決"
owners: ["daishiman"]
created_at: "2026-08-31T00:00:00Z"
updated_at: "2026-08-31T00:00:00Z"
status: "active"
depends_on: ["feat-blog-provisioning-integrity"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-reader-surface"]
resource_scope: ["src/middleware.ts","src/domain/authoring/site-hostname.ts","src/infrastructure/platform","wrangler.jsonc","config/site-domain-readiness.json","system-spec","features/feat-blog-subdomain-routing.context.json"]
purpose: "ブログごとの住所を slug と環境ごとの基底ドメインから導出し、保存値との二重管理を持たずに読者が指すホスト名とブログの中身を一対一で結びつける"
goal: "ワイルドカード DNS と wrangler routes 1 本で任意のブログ用サブドメインが Worker へ到達し、middleware がホスト名から slug を一意に解決して既存の読者面へ内部委譲し、解決できないホストは fail closed で 404 を返し、ホスト解決が効かない実行ではパス方式 /s/<slug> が後方互換として残る状態になっている"
scope_in: ["slug + SITE_BASE_DOMAIN を siteHostname の 1 か所でホスト名へ導出し、site_blueprints に hostname を永続化しない","基底ドメインを環境ごとの構成値として注入する仕組み (再ビルドせず同一成果物へ注入)","wrangler の routes へ *.<基底ドメイン>/* を 1 本だけ宣言する (ブログ追加で DNS も routes も触らない)","middleware でのホスト名→slug 解決と、既存 /s/<slug> ルートへの内部委譲","導出で得た slug を D1 公開 identity で fail closed 解決し、実体が無い場合は 404 にする","cookie の scope を親ドメインへ広げない設定 (サブドメイン間の信頼境界)","slug 変更時は次の request から導出ホストも自動で変わり、追随書き込みを不要にする","ホスト解決が効かない実行 (workers.dev 等) でのパス方式 /s/<slug> 後方互換","SITE_BASE_DOMAIN・wildcard route・proxied DNS 証跡が揃わない間は構成状態を blocked と明示する"]
scope_out: ["ワイルドカード DNS レコードと証明書の初回登録そのもの (人手作業・手順書として残す)","ブログ 1 本ごとの独自ドメイン持ち込み (BYO domain)","作成の原子性と公開必須要素の充足 (feat-blog-provisioning-integrity)","管理画面での住所表示 UI (feat-blog-composition-visibility)"]
acceptance: ["外部 DNS/route 構成完了後、作成したブログが <slug>.<基底ドメイン> で 200 を返し、/s/<slug> でも同じ内容が 200 で返る","wrangler の routes 宣言が *.<基底ドメイン>/* の 1 本だけで、ブログを増やしても routes を編集しない","存在しないサブドメインへのアクセスが 404 を返し、存在するブログ一覧を推測できる情報を返さない","hostname 列とホスト別の一意制約を持たず、slug の一意制約と SITE_BASE_DOMAIN から一意のホスト名を導出する","導出した slug の D1 公開 identity が一意に定まらない場合は配信せず 404 を返す","cookie の scope が親ドメインへ広がらず、あるブログの cookie が別ブログから読めない","ホスト名と slug の対応が siteHostname/siteSlugFromHost の 1 モジュールに閉じ、判定箇所の複製が 0 件である","基底ドメインが構成値として注入され、環境ごとの再ビルドが不要である","ホスト解決が効かない環境ではパス方式で到達でき、既存の公開 URL が壊れない","hostname のデータ移行を必要とせず、既存行も現在環境の slug + SITE_BASE_DOMAIN で住所が決まる","slug を変更すると永続 hostname への追随書き込みなしに次の request から導出住所が変わる","SITE_BASE_DOMAIN・wildcard route・proxied wildcard DNS 証跡が揃うまで準備状態が blocked と機械的に判定される","両経路 (サブドメイン / パス) が同じ SiteFrame へ収束することをテストが確認する"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-subdomain-routing.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-31T00:00:00Z","origin_kind":"generated","source_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者報告『ドメインを構築してドメインを作成し、ブログを構築できる形にしておかないと、ドメインが全く関係のないものになってしまう』への対応。利用者選択 (サブドメイン方式) を dec-blog-domain-strategy として確定済み。確定質疑 qa-infrastructure-web-wildcard-subdomain を lineage 参照"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-subdomain-routing.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-31T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

ブログごとの住所を slug と環境ごとの基底ドメインから導出し、保存値との二重管理を持たずに読者が指すホスト名とブログの中身を一対一で結びつける

## 到達状態

ワイルドカード DNS と wrangler routes 1 本で任意のブログ用サブドメインが Worker へ到達し、middleware がホスト名から slug を一意に解決して既存の読者面へ内部委譲し、解決できないホストは fail closed で 404 を返し、ホスト解決が効かない実行ではパス方式 /s/<slug> が後方互換として残る状態になっている

## スコープ

スコープ内:

- slug + SITE_BASE_DOMAIN を `siteHostname` の 1 か所でホスト名へ導出し、site_blueprints に hostname を永続化しない
- 基底ドメインを環境ごとの構成値として注入する仕組み (再ビルドせず同一成果物へ注入)
- wrangler の routes へ *.<基底ドメイン>/* を 1 本だけ宣言する (ブログ追加で DNS も routes も触らない)
- middleware でのホスト名→slug 解決と、既存 /s/<slug> ルートへの内部委譲
- 導出で得た slug を D1 公開 identity で fail closed 解決し、実体が無い場合は 404 にする
- cookie の scope を親ドメインへ広げない設定 (サブドメイン間の信頼境界)
- slug 変更時は次の request から導出ホストも自動で変わり、追随書き込みを不要にする
- ホスト解決が効かない実行 (workers.dev 等) でのパス方式 /s/<slug> 後方互換
- SITE_BASE_DOMAIN・wildcard route・proxied DNS 証跡が揃わない間は構成状態を blocked と明示する

スコープ外:

- ワイルドカード DNS レコードと証明書の初回登録そのもの (人手作業・手順書として残す)
- ブログ 1 本ごとの独自ドメイン持ち込み (BYO domain)
- 作成の原子性と公開必須要素の充足 (feat-blog-provisioning-integrity)
- 管理画面での住所表示 UI (feat-blog-composition-visibility)

## 受入

- [ ] 外部 DNS/route 構成完了後、作成したブログが <slug>.<基底ドメイン> で 200 を返し、/s/<slug> でも同じ内容が 200 で返る
- [ ] wrangler の routes 宣言が *.<基底ドメイン>/* の 1 本だけで、ブログを増やしても routes を編集しない
- [ ] 存在しないサブドメインへのアクセスが 404 を返し、存在するブログ一覧を推測できる情報を返さない
- [ ] hostname 列を持たず、slug の一意制約と SITE_BASE_DOMAIN から一意のホスト名を導出する
- [ ] 導出した slug の D1 公開 identity が一意に定まらない場合は配信せず 404 を返す
- [ ] cookie の scope が親ドメインへ広がらず、あるブログの cookie が別ブログから読めない
- [ ] ホスト名と slug の対応が siteHostname/siteSlugFromHost の 1 モジュールに閉じ、判定箇所の複製が 0 件である
- [ ] 基底ドメインが構成値として注入され、環境ごとの再ビルドが不要である
- [ ] ホスト解決が効かない環境ではパス方式で到達でき、既存の公開 URL が壊れない
- [ ] hostname のデータ移行を必要とせず、既存行も現在環境の slug + SITE_BASE_DOMAIN で住所が決まる
- [ ] slug を変更すると永続 hostname への追随書き込みなしに次の request から導出住所が変わる
- [ ] SITE_BASE_DOMAIN・wildcard route・proxied wildcard DNS 証跡が揃うまで準備状態が blocked と機械的に判定される
- [ ] 両経路 (サブドメイン / パス) が同じ SiteFrame へ収束することをテストが確認する

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- 関連ノード: `spec-system-spec-index`、`arch-system-spec-overview`、`feat-reader-surface`

## 機能間依存

- `depends_on`: `feat-blog-provisioning-integrity`
- 依存理由: 導出住所へ書き換える先の `/s/<slug>` が、原子的に作られた公開 identity だけを返すことが先に必要である。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-subdomain-routing` と repo-relative `--feature-context features/feat-blog-subdomain-routing.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-subdomain-routing` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: slug + SITE_BASE_DOMAIN の導出・構成値注入・wildcard route 宣言・middleware 解決・blocked 診断を P01..P13 へ分解する。evidence は両経路 (サブドメイン / パス) が同じ SiteFrame へ収束することを示すこと。
- 完了 rollup: exact 13 が全て done かつ P07/P10/P11 の evidence が上記受入 13 件を満たした場合だけ本 feature を done にする。
