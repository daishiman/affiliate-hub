---
graph_node_id: "feat-thumbnail-visual-system"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["thumbnail","image","r2","cls","icon","reader-surface","admin"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "サムネイルと図版の体系 (全画面表示・代替生成・版面崩れ防止)"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-07T23:40:13.858231Z"
status: "active"
depends_on: ["feat-blog-ops-crud","feat-ui-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","system-spec"]
purpose: "記事・ブログ・管理画面のどの一覧でも内容を一目で識別できるサムネイルが必ず表示され、画像が無いことによる空白や版面のずれが起きないようにする"
goal: "記事とブログにサムネイルを登録・自動生成でき、R2 に保存された画像が 16:9 の固有寸法と srcset/sizes つきで配信され、トップページ・記事一覧・カテゴリー・検索結果・関連記事・管理画面の各一覧でサムネイルが表示され、画像が無い場合も版面が崩れない代替表示が出る状態になっている"
scope_in: ["サムネイル登録経路の優先順位: 記事編集での明示アップロード / アイキャッチ指定 / 本文先頭画像からの自動採用","画像が無いときの代替図版の決定論的生成: タイトル・カテゴリー・ブログ配色トークンから組み立て、外部サービスへ接続しない","R2 への保存と配信: オリジナル保持と表示用派生 (16:9 crop・複数幅) の生成・命名規約・キャッシュ・再生成の抑止","全画面での表示適用: トップページ / 記事一覧 / カテゴリー / タグ / 検索結果 / 関連記事 / 管理画面のブログ一覧・記事一覧・プレビュー","サムネイル・代替図版・アイコンに限った CLS 抑制の実装規約: 固有 width/height、srcset と sizes、decoding=async、初期表示外は loading=lazy (観測 fact system-spec/retrieval-evidence/kajetblog-top-analysis.md §4 で参照サイトが 54/54 の寸法保持を達成していることを確認済み)。記事本文中の画像を含む画面全体の表示品質規約は所有しない","OGP / Twitter Card (summary_large_image) 画像としてのサムネイル再利用","アイコン素材: グローバルナビ・SNS・状態表示のアイコンを独自 SVG セットとして定義し、サムネイルと同じ配色トークンに従わせる","画像取得・生成に失敗したときの代替表示と、失敗の記録"]
scope_out: ["記事本文および本文中図解の AI 生成 (feat-ai-content-studio)","トップページの区画構成と表示順 (feat-blog-top-page-composition)","外部 EC からの商品画像取得・再配信 (feat-affiliate-inbox / feat-product-intelligence)","テンプレート・配色の選択 UI そのもの (feat-blog-ui-builder)","記事本文中の画像を含む画面全体の表示品質・アクセシビリティ規約 (feat-reader-surface が system-spec/frontend.md §20 で所有)。本 feature はサムネイル・代替図版・アイコンだけを対象とする","画像の著作権処理・素材調達の運用"]
acceptance: ["記事にサムネイルを登録でき、未登録でも本文先頭画像かタイトル由来の代替図版が必ず表示される","代替図版が外部サービスへ接続せずに生成され、同じ入力からは同じ画像が得られる","トップページ・記事一覧・カテゴリー・検索結果・関連記事・管理画面の各一覧すべてでサムネイルが表示される","サムネイル・代替図版・アイコンの全ての img が固有の width/height を持ち srcset と sizes が付き、サムネイルを含む画面の CLS が 0.1 未満である","R2 に保存された派生画像がキャッシュされ、同一画像の派生が二度生成されない","OGP と Twitter Card (summary_large_image) の画像がサムネイルから生成される","画像の取得・生成に失敗しても版面が崩れず、代替表示と理由が出る"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-thumbnail-visual-system.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"3495330b8d67c78fac526b7468ec270cb6f15e6e8c07d88d6e80dd526d37109d","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-thumbnail-visual-system/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-08T00:00:00Z","origin_kind":"generated","source_digest":"c8089536f8fa40067b561bb1be5a705bd4ccb77c83e163bbfe28bfa66f079670","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望「各画面のサムネイルを表示する。トップ画面にもサムネイルを表示する」を C14 macro 分解で 1 feature 化。system-spec/ui-ux.md qa-request-thumbnail-coverage-v6 に接地。細分は system-dev-planner の P01..P13 へ委譲"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-thumbnail-visual-system.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-txu7","github_mirror":null,"linked_at":"2026-09-04T07:33:03Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

記事・ブログ・管理画面のどの一覧でも内容を一目で識別できるサムネイルが必ず表示され、画像が無いことによる空白や版面のずれが起きないようにする

## 到達状態

記事とブログにサムネイルを登録・自動生成でき、R2 に保存された画像が 16:9 の固有寸法と srcset/sizes つきで配信され、トップページ・記事一覧・カテゴリー・検索結果・関連記事・管理画面の各一覧でサムネイルが表示され、画像が無い場合も版面が崩れない代替表示が出る状態になっている

## スコープ

- スコープ内:
  - サムネイル登録経路の優先順位: 記事編集での明示アップロード / アイキャッチ指定 / 本文先頭画像からの自動採用
  - 画像が無いときの代替図版の決定論的生成: タイトル・カテゴリー・ブログ配色トークンから組み立て、外部サービスへ接続しない
  - R2 への保存と配信: オリジナル保持と表示用派生 (16:9 crop・複数幅) の生成・命名規約・キャッシュ・再生成の抑止
  - 全画面での表示適用: トップページ / 記事一覧 / カテゴリー / タグ / 検索結果 / 関連記事 / 管理画面のブログ一覧・記事一覧・プレビュー。読者向けの一覧と管理画面の一覧は求められるものが違うため、読者側は記事内容を想像させる大きさ、管理側は多数の行を見渡せる小さい行高とサムネイル表示の折りたたみを持たせ、寸法は面ごとに書き分けず少数の型として 1 か所で定める (確定 qa qa-request-thumbnail-coverage-v6 の design_applications と tradeoffs)
  - サムネイル・代替図版・アイコンに限った CLS 抑制の実装規約: 固有 width/height、srcset と sizes、decoding=async、初期表示外は loading=lazy (観測 fact system-spec/retrieval-evidence/kajetblog-top-analysis.md §4 で参照サイトが 54/54 の寸法保持を達成していることを確認済み)。記事本文中の画像を含む画面全体の表示品質規約は所有しない
  - OGP / Twitter Card (summary_large_image) 画像としてのサムネイル再利用
  - アイコン素材: グローバルナビ・SNS・状態表示のアイコンを独自 SVG セットとして定義し、サムネイルと同じ配色トークンに従わせる
  - 画像取得・生成に失敗したときの代替表示と、失敗の記録
- スコープ外:
  - 記事本文および本文中図解の AI 生成 (feat-ai-content-studio)
  - トップページの区画構成と表示順 (feat-blog-top-page-composition)
  - 外部 EC からの商品画像取得・再配信 (feat-affiliate-inbox / feat-product-intelligence)
  - テンプレート・配色の選択 UI そのもの (feat-blog-ui-builder)
  - 記事本文中の画像を含む画面全体の表示品質・アクセシビリティ規約 (feat-reader-surface が所有)。本 feature はサムネイル・代替図版・アイコンだけを対象とする
  - 画像の著作権処理・素材調達の運用

## 受入

- [ ] 記事にサムネイルを登録でき、未登録でも本文先頭画像かタイトル由来の代替図版が必ず表示される
- [ ] 代替図版が外部サービスへ接続せずに生成され、同じ入力からは同じ画像が得られる
- [ ] トップページ・記事一覧・カテゴリー・検索結果・関連記事・管理画面の各一覧すべてでサムネイルが表示される
- [ ] サムネイル・代替図版・アイコンの全ての img が固有の width/height を持ち srcset と sizes が付き、サムネイルを含む画面の CLS が 0.1 未満である
- [ ] R2 に保存された派生画像がキャッシュされ、同一画像の派生が二度生成されない
- [ ] OGP と Twitter Card (summary_large_image) の画像がサムネイルから生成される
- [ ] 画像の取得・生成に失敗しても版面が崩れず、代替表示と理由が出る

## 受入正本レジストリ

- canonical source: `features/feat-thumbnail-visual-system.md#frontmatter.acceptance`
- planner projection: `features/feat-thumbnail-visual-system.context.json#/acceptance`
- ID mapping: 配列の 1 始まり順番を `A1` 〜 `A7` に対応させる

受入の文言は frontmatter にのみ保持する。実装要件・タスク仕様書・証跡は canonical ID を参照し、
同じ ID に別の文言を与えない。件数を本文へ書き写さないのは、文言が二箇所で分裂するのを防ぐためである。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 読者面 (公開ブログの一覧・カード) と運営者面 (管理画面の一覧・プレビュー) の二層境界をまたいで同じサムネイル正本を使うため、両面を貫く配信規約を arch-two-layer-platform に接地させる。仕様本文は system-spec/ui-ux.md の確定章を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-blog-ops-crud, feat-ui-foundation
- 依存理由:
  - feat-blog-ops-crud: 記事とブログの CRUD が先に立たないと、サムネイルを何に紐づけるかが決まらない
  - feat-ui-foundation: 配色トークンと共通部品が無いと、代替図版の決定論的生成が配色に従えない

## Handoff

- per-feature planning: ready 到達後に system-dev-planner (`run-system-dev-plan`) を
  `--feature-id feat-thumbnail-visual-system` と `--feature-context features/feat-thumbnail-visual-system.context.json` で起動する。
  人間の手動 `/system-dev-plan` 実行結果も同じ登録経路 (C02 `register-package`) で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node の intra-feature DAG
- 登録先: 全 task を `parent_feature=feat-thumbnail-visual-system` と共通 `feature_package_id` で C02 経由 atomic 登録する。expected/applied=13 を必須とする
- 完了 rollup: exact 13 が全て done で、かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ feature を done にする
