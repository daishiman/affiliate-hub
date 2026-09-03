---
graph_node_id: "feat-blog-composition-visibility"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["blog","admin","visibility","preview","projection","missing-elements"]
priority: "high"
start_date: "2026-08-31"
target_date: null
iteration: null
title: "ブログ構成要素の可視化・管理画面プレビュー・不足要素の提示"
owners: ["daishiman"]
created_at: "2026-08-31T00:00:00Z"
updated_at: "2026-08-31T00:00:00Z"
status: "active"
depends_on: ["feat-blog-provisioning-integrity"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-blog-ops-crud","feat-reference-blog-admin-ux"]
resource_scope: ["src/presentation/admin","src/presentation/site","src/application/usecases/site","system-spec","features/feat-blog-composition-visibility.context.json"]
purpose: "作られたブログが何で構成され、どんな形で読者に見えるのかを管理画面から確認できるようにし、見えないままでは改善できないという状態を解消する"
goal: "管理画面から、実ブログが実際に開けること・構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) の一覧・管理画面内でのプレビュー・作成時点で不足している要素の 4 つを、読者面と同じ正本 (public-site-projection) を通して確認でき、管理画面で見える姿と読者が実際に見る姿がずれない状態になっている"
scope_in: ["管理画面の構成要素一覧 (固定ページ・版面の帯・スロット・カテゴリー・記事) を public-site-projection 経由で読む (管理画面専用の別経路で数え直さない)","公開表示は enabled bands/slots を、作成充足の件数は全 provisioned bands/slots を同じ public-site-projection で一度だけ読み分ける","D1/live では published_articles を唯一の canonical public projection とし、記事一覧・本文・検索・カテゴリー・人物・SEO・composition を同じ PublishedContentPort へ揃える。PublicBlogPort は articles を公開用に直読せず、code sample fallback・union・件数の足し合わせを行わない","各構成要素からその実体の編集画面への導線","管理画面内プレビュー: 既存 SiteFrame を通して描画し、プレビュー専用のコンポーネント木を作らない","SiteFrame の『見つからない』の扱いを呼び出し側で受け取れる形へ分離 (notFound() 直呼びからの切り出し)","作成時点で公開に必要なのに無い要素の名指し提示と、その場へ移動できる導線","不足の強さの区別 (公開を止めている要素 / 質を下げるだけの要素) と表示の強弱","情報の優先順位を『開けるか』>『不足している要素』>『構成の内訳』とした画面配置","住所表示: slug + SITE_BASE_DOMAIN の導出サブドメインを正、パス形式を併記 (SITE_BASE_DOMAIN 未設定時はパス形式を正へ繰り上げ)","内部構造の語 (版面の帯・スロット) を利用者の語へ言い換える対応表"]
scope_out: ["構成要素そのものの CRUD (feat-blog-ops-crud)","作成の原子性と充足判定の実装 (feat-blog-provisioning-integrity)","導出ホスト名と slug の解決 (feat-blog-subdomain-routing)","テンプレート・配色の選択 UI (feat-blog-ui-builder)"]
acceptance: ["管理画面のブログ詳細から、そのブログが読者側で開けるかどうかが最初に分かる","構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) の件数と一覧が表示され、各項目から実体の編集画面へ移動できる","一覧の件数が読者面の public-site-projection と一致し、管理画面専用の数え直し経路が 0 件である","作成直後の返却 report と PublicBlogPort.openSite から再投影した report の件数・readiness が一致する","D1 が空なら code sample の記事一覧・本文が出ず、一覧・本文・検索・カテゴリー・人物・SEO・composition が published_articles の同じ article identity 集合を返す","PublicBlogPort の公開記事実装に articles 直読・sample fallback・union・独自件数集計が 0 件である","公開一覧とトップ帯は articleHref だけで URL を作り、旧 /blog/:slug は同じ projection を引いて canonical URL へ 308 redirect する","管理画面内で読者面と同じ SiteFrame による描画をプレビューでき、プレビュー専用のコンポーネント木が 0 件である","SiteFrame が『見つからない』を呼び出し側へ返せる形になっており、管理画面の中で 404 が全画面に伝播しない","公開に必要なのに無い要素が名指しで表示され、その場から補完先へ移動できる","不足が『公開を止めている』か『質を下げるだけ』かで表示の強さが分かれる","画面上の位置と強さが『開けるか』>『不足している要素』>『構成の内訳』の順になっている","住所欄が slug + SITE_BASE_DOMAIN の導出サブドメインを正として表示し、パス形式を併記する","SITE_BASE_DOMAIN 未設定の環境ではパス形式が正へ繰り上がって表示される","内部構造の語が利用者の語へ言い換えられ、言い換え対応表が 1 か所にある","初回作成直後の画面が不足表示で埋まらず、優先度による強弱が効いている","管理画面の当該 3 画面 (詳細 / 構成要素一覧 / プレビュー) が axe-core の重大違反 0 件である"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-composition-visibility.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-31T00:00:00Z","origin_kind":"generated","source_digest":"9853917fad7f15aca04f95d9c8e47819b99ad56f3bcb59e030191c1ee62e7a62","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者報告『ブログを構成するための要素や、どのような形でブログができるのかが見えないため、構築されたブログの改善が行えない』への対応。利用者選択 (可視化 4 種すべて) を反映。確定質疑 qa-frontend-web-blog-composition-visibility / qa-ui-ux-web-creation-completion-feedback を lineage 参照"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-composition-visibility.md","confidence":0.95}]
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

作られたブログが何で構成され、どんな形で読者に見えるのかを管理画面から確認できるようにし、見えないままでは改善できないという状態を解消する

## 到達状態

管理画面から、実ブログが実際に開けること・構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) の一覧・管理画面内でのプレビュー・作成時点で不足している要素の 4 つを、読者面と同じ正本 (public-site-projection) を通して確認でき、管理画面で見える姿と読者が実際に見る姿がずれない状態になっている

## スコープ

スコープ内:

- 管理画面の構成要素一覧 (固定ページ・版面の帯・スロット・カテゴリー・記事) を public-site-projection 経由で読む (管理画面専用の別経路で数え直さない)
- 公開表示は enabled bands/slots を、作成充足の件数は全 provisioned bands/slots を同じ public-site-projection で一度だけ読み分ける
- D1/live では `published_articles` を唯一の canonical public projection とし、記事一覧・本文・検索・カテゴリー・人物・SEO・composition を同じ `PublishedContentPort` へ揃える。`PublicBlogPort` は `articles` を公開用に直読せず、code sample fallback・union・件数の足し合わせを行わない
- 各構成要素からその実体の編集画面への導線
- 管理画面内プレビュー: 既存 SiteFrame を通して描画し、プレビュー専用のコンポーネント木を作らない
- SiteFrame の『見つからない』の扱いを呼び出し側で受け取れる形へ分離 (notFound() 直呼びからの切り出し)
- 作成時点で公開に必要なのに無い要素の名指し提示と、その場へ移動できる導線
- 不足の強さの区別 (公開を止めている要素 / 質を下げるだけの要素) と表示の強弱
- 情報の優先順位を『開けるか』>『不足している要素』>『構成の内訳』とした画面配置
- 住所表示: slug + SITE_BASE_DOMAIN の導出サブドメインを正、パス形式を併記 (SITE_BASE_DOMAIN 未設定時はパス形式を正へ繰り上げ)
- 内部構造の語 (版面の帯・スロット) を利用者の語へ言い換える対応表

スコープ外:

- 構成要素そのものの CRUD (feat-blog-ops-crud)
- 作成の原子性と充足判定の実装 (feat-blog-provisioning-integrity)
- 導出ホスト名と slug の解決 (feat-blog-subdomain-routing)
- テンプレート・配色の選択 UI (feat-blog-ui-builder)

## 受入

- [ ] 管理画面のブログ詳細から、そのブログが読者側で開けるかどうかが最初に分かる
- [ ] 構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) の件数と一覧が表示され、各項目から実体の編集画面へ移動できる
- [ ] 一覧の件数が読者面の public-site-projection と一致し、管理画面専用の数え直し経路が 0 件である
- [ ] 作成直後の返却 report と PublicBlogPort.openSite から再投影した report の件数・readiness が一致する
- [ ] D1 が空なら code sample の記事一覧・本文が出ず、一覧・本文・検索・カテゴリー・人物・SEO・composition が `published_articles` の同じ article identity 集合を返す
- [ ] `PublicBlogPort` の公開記事実装に `articles` 直読・sample fallback・union・独自件数集計が 0 件である
- [ ] 公開一覧とトップ帯は `articleHref` だけで URL を作り、旧 `/blog/:slug` は同じ projection を引いて canonical URL へ 308 redirect する
- [ ] 管理画面内で読者面と同じ SiteFrame による描画をプレビューでき、プレビュー専用のコンポーネント木が 0 件である
- [ ] SiteFrame が『見つからない』を呼び出し側へ返せる形になっており、管理画面の中で 404 が全画面に伝播しない
- [ ] 公開に必要なのに無い要素が名指しで表示され、その場から補完先へ移動できる
- [ ] 不足が『公開を止めている』か『質を下げるだけ』かで表示の強さが分かれる
- [ ] 画面上の位置と強さが『開けるか』>『不足している要素』>『構成の内訳』の順になっている
- [ ] 住所欄が slug + SITE_BASE_DOMAIN の導出サブドメインを正として表示し、パス形式を併記する
- [ ] SITE_BASE_DOMAIN 未設定の環境ではパス形式が正へ繰り上がって表示される
- [ ] 内部構造の語が利用者の語へ言い換えられ、言い換え対応表が 1 か所にある
- [ ] 初回作成直後の画面が不足表示で埋まらず、優先度による強弱が効いている
- [ ] 管理画面の当該 3 画面 (詳細 / 構成要素一覧 / プレビュー) が axe-core の重大違反 0 件である

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- 関連ノード: `spec-system-spec-index`、`arch-system-spec-overview`、`feat-blog-ops-crud`、`feat-reference-blog-admin-ux`

## 機能間依存

- `depends_on`: `feat-blog-provisioning-integrity`
- 依存理由: 「何が足りないか」を画面に出すには、公開必須要素の定義と充足判定が先に 1 か所へ確定している必要がある。判定を持たないまま可視化を作ると、管理画面が独自に数え直す第二の正本が生まれ、見えている姿と読者が見る姿がずれるという同じ失敗を繰り返す。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-composition-visibility` と repo-relative `--feature-context features/feat-blog-composition-visibility.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-composition-visibility` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 構成要素一覧・プレビュー・不足提示・住所表示を P01..P13 へ分解する。evidence は管理画面の件数が public-site-projection と一致することを示すこと。
- 完了 rollup: exact 13 が全て done かつ P07/P10/P11 の evidence が上記受入 13 件を満たした場合だけ本 feature を done にする。
