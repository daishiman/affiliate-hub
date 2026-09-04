---
graph_node_id: "feat-blog-provisioning-integrity"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["blog","provisioning","atomicity","aggregate","site-network-nodes","404"]
priority: "high"
start_date: "2026-08-31"
target_date: null
iteration: null
title: "ブログ作成の原子性と公開必須要素の充足 (作成済み表示と読者到達の一致)"
owners: ["daishiman"]
created_at: "2026-08-31T00:00:00Z"
updated_at: "2026-08-31T00:00:00Z"
status: "active"
depends_on: ["feat-site-builder","feat-blog-ops-crud"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-site-blueprint","feat-data-model"]
resource_scope: ["src/application/usecases/site","src/infrastructure/persistence/d1","src/presentation/admin/publish","drizzle","system-spec","features/feat-blog-provisioning-integrity.context.json"]
purpose: "ブログ新規作成を create-only の Unit of Work に閉じ、必須実体・下書き完了・作成監査の部分成功と、衝突失敗時の既存サイト破壊をなくす"
goal: "13 問の回答から作られた新規ブログが、site_blueprints・active network node・8 種の下書き固定ページ・既定の帯とスロット・カテゴリー正本・下書き完了・作成監査を D1 batch で揃えたときだけ provisioningComplete を返し、記事と公開固定ページを含む contentReady と分離されている"
scope_in: ["新規作成を plain INSERT に限定し、same/cross workspace の slug 衝突で既存サイトを上書きまたは削除しない","site_network_nodes(status=active, workspace_id 一致, 論理削除なし) の 1 行を作成と同一 D1 batch に含める","8 種の固定ページを空の draft 実体として生成し、既定の帯とスロットと共に同一 D1 batch に含める","カテゴリーは blueprint JSON を正本とし、別表に複製しない","作成必須要素の定義を 1 か所に持ち、provisioningComplete を network/fixed pages/bands/slots/categories から、contentReady をそれらの公開状態と articles から判定する","設計図・必須実体・下書き完了・作成監査を同一 D1 batch に閉じ、1 失敗で全巻き戻しする","site_drafts の単調 revision を正本とし、保存は expected revision の CAS、作成は source_draft_id と source_draft_revision の DB claim で古い回答を拒否する","読者表示に使う enabled layout と作成充足を測る全 provisioned layout を public-site-projection 内で分離し、作成直後と再読込後の判定を一致させる","public-site-projection の公開 identity と構成投影を管理画面でも再利用し、別経路の重複カウントを持たない","site_network_nodes を持たない既存 site_blueprints 行の migration 補填","D1 batch に収まらない規模になった場合の境界引き直し条件の明文化"]
scope_out: ["サブドメイン住所の付与とホスト解決 (feat-blog-subdomain-routing)","管理画面での構成要素一覧・プレビュー・不足提示の UI (feat-blog-composition-visibility)","ウィザードの 13 問そのものの設計と入口 (feat-site-builder)","記事本文の AI 生成 (feat-ai-content-studio)","閲覧者向けレンダリングの部品仕様 (feat-blog-ops-crud)"]
acceptance: ["ウィザードで 13 問に回答して作成したブログが /s/<slug> で公開 identity に解決され、404 にならない","作成後に active network node が当該 workspace に 1 件だけ存在し、resolvePublicSiteIdentity が非 null を返す","network・band/slot 途中・fixed page・draft 完了更新・audit の各障害注入で batch 全体が巻き戻り、作成行も成功メッセージも残らない","same/cross workspace の新規 draft が既存 slug と衝突しても、既存の blueprint/network/bands/slots/fixed pages/audit が不変である","provisioningComplete は required fixed pages/bands/slots/categories/network を保存値から検証し、articles を含めない","contentReady は provisioningComplete に加えて公開固定ページと article を要求し、reachable とも分離される","8 種の固定ページ draft・既定 bands/slots・network が同時に生成され、categories は blueprint JSON の正本から数えられる","site_network_nodes を持たない既存 site_blueprints 行が migration で補填される","同じ draft からの二重新規作成は編集画面へ誘導して拒否され、既存サイトを再作成しない","slug が同じでも name/categories を変更した stale create は実行順にかかわらず拒否され、最新の draft と site が不変である","作成後に遅れて到着した stale save と同じ revision からの並行 save は CONFLICT となり、created_site_slug と最新 draft_json を巻き戻さない","作成が成功した直後に実 PublicBlogPort.openSite が non-null を返し、作成返却と再読込の件数・provisioningComplete が一致する結合テストが CI で走る","公開画面は enabled bands/slots のみを描画し、provisioningComplete は保存済みの全 provisioned bands/slots を数える","0041 適用前から存在する site_blueprints 行が migration fixture で active network node に補填される","公開構成投影は既存 public-site-projection を再利用し、管理画面専用の重複カウントが 0 件である","resolvePublicSiteIdentity の fail-closed 判定 (rows.length !== 1 で null) を緩めていない","作成監査が同一 batch で保存され、失敗した作成の虚偽の成功監査は残らない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-provisioning-integrity.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-31T00:00:00Z","origin_kind":"generated","source_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者報告『13 問に答えてもブログが作成できない (作成済み表示のあと /s/<slug> が 404)』を C14 macro 分解の 1 feature 化。確定質疑 qa-database-web-blog-provisioning-integrity / qa-backend-web-blog-creation-atomicity を lineage 参照し、細分は system-dev-planner の P01..P13 へ委譲"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-provisioning-integrity.md","confidence":0.95}]
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

ブログ新規作成を create-only の Unit of Work に閉じ、必須実体・下書き完了・作成監査の部分成功と、衝突失敗時の既存サイト破壊をなくす

## 到達状態

13 問の回答から作られた新規ブログが、site_blueprints・active network node・8 種の下書き固定ページ・既定の帯とスロット・カテゴリー正本・下書き完了・作成監査を D1 batch で揃えたときだけ provisioningComplete を返し、記事と公開固定ページを含む contentReady と分離されている

## スコープ

スコープ内:

- 新規作成を plain INSERT に限定し、same/cross workspace の slug 衝突で既存サイトを上書きまたは削除しない
- active network node 1 行、8 種の固定ページ draft、既定の帯とスロットを同一 D1 batch に含める
- カテゴリーは blueprint JSON を正本とし、別表に複製しない
- `provisioningComplete` を network/fixed pages/bands/slots/categories から、`contentReady` をそれらの公開状態と articles から判定する
- 設計図・必須実体・下書き完了・作成監査を同一 D1 batch に閉じ、1 失敗で全巻き戻しする
- site_drafts の単調 revision を正本とし、保存は expected revision の CAS、作成は source_draft_id と source_draft_revision の DB claim で古い回答を拒否する
- 読者表示に使う enabled layout と作成充足を測る全 provisioned layout を public-site-projection 内で分離し、作成直後と再読込後の判定を一致させる
- public-site-projection の公開 identity と構成投影を管理画面でも再利用し、別経路の重複カウントを持たない
- site_network_nodes を持たない既存 site_blueprints 行を migration で補填する
- D1 batch に収まらない規模になった場合の境界引き直し条件を明文化する

スコープ外:

- サブドメイン住所の付与とホスト解決 (feat-blog-subdomain-routing)
- 管理画面での構成要素一覧・プレビュー・不足提示の UI (feat-blog-composition-visibility)
- ウィザードの 13 問そのものの設計と入口 (feat-site-builder)
- 記事本文の AI 生成 (feat-ai-content-studio)
- 閲覧者向けレンダリングの部品仕様 (feat-blog-ops-crud)

## 受入

- [ ] 作成直後に /s/<slug> の公開 identity へ解決でき、404 にならない
- [ ] active network node が当該 workspace に 1 件だけ存在し、resolvePublicSiteIdentity が非 null を返す
- [ ] network・band/slot 途中・fixed page・draft 更新・audit の各障害注入で batch 全体が巻き戻る
- [ ] same/cross workspace の slug 衝突で、既存の blueprint/network/bands/slots/fixed pages/audit が不変である
- [ ] `provisioningComplete` は required fixed pages/bands/slots/categories/network を検証し、articles を含めない
- [ ] `contentReady` は公開固定ページと article も要求し、`reachable` とも分離される
- [ ] 8 種の固定ページ draft・既定 bands/slots・network が同時に生成され、categories は blueprint JSON から数えられる
- [ ] site_network_nodes を持たない既存 site_blueprints 行が migration で補填される
- [ ] 同じ draft からの二重新規作成は編集画面へ誘導して拒否される
- [ ] slug が同じでも name/categories を変更した stale create は実行順にかかわらず拒否され、最新の draft と site が不変である
- [ ] 作成後に遅れて到着した stale save と同じ revision からの並行 save は CONFLICT となり、created_site_slug と最新 draft_json を巻き戻さない
- [ ] 作成直後に実 PublicBlogPort.openSite が non-null を返し、作成返却と再読込の件数・provisioningComplete が一致する結合テストが CI で走る
- [ ] 公開画面は enabled bands/slots のみを描画し、provisioningComplete は保存済みの全 provisioned bands/slots を数える
- [ ] 0041 適用前から存在する site_blueprints 行が migration fixture で active network node に補填される
- [ ] 公開構成投影は public-site-projection を再利用し、管理画面専用の重複カウントが 0 件である
- [ ] resolvePublicSiteIdentity の fail-closed 判定 (rows.length !== 1 で null) を緩めていない
- [ ] 作成監査が同一 batch で保存され、失敗した作成の虚偽の成功監査は残らない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- 関連ノード: `spec-system-spec-index`、`arch-system-spec-overview`、`feat-site-blueprint`、`feat-data-model`

## 機能間依存

- `depends_on`: `feat-site-builder`
- `depends_on`: `feat-blog-ops-crud`
- 依存理由: 作成の完了条件そのものを引き上げるため、13 問ウィザードの入口 (feat-site-builder) と、ブログ実体の CRUD 経路 (feat-blog-ops-crud) が先に存在している必要がある。この 2 つが提供する draft と保存経路の上に、原子性と充足判定を被せる。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-provisioning-integrity` と repo-relative `--feature-context features/feat-blog-provisioning-integrity.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-provisioning-integrity` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 作成 use case の完了条件・transaction 境界・巻き戻し・移行を P01..P13 へ分解する。P07/P10/P11 の evidence は「作成直後に読者面が 200 を返すこと」を実測で示すこと。
- 完了 rollup: exact 13 が全て done かつ P07/P10/P11 の evidence が上記受入 13 件を満たした場合だけ本 feature を done にする。
