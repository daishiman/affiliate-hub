---
graph_node_id: "feat-blog-top-page-composition"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["blog","top-page","information-architecture","reader-surface","sticky-header","non-imitation"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "ブログトップページの構成 (参照ブログの情報階層を非模倣で抽象化)"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-07T23:37:55.246864Z"
status: "active"
depends_on: ["feat-blog-ops-crud","feat-blog-ui-builder","feat-reference-blog-admin-ux","feat-thumbnail-visual-system","feat-reader-search-quality"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","docs/spec","system-spec"]
purpose: "読者がトップページに来た瞬間に「何のブログで、何が読めて、次にどこへ行けばよいか」を迷わず掴めるようにし、参照ブログの情報階層だけを抽象化して独自の構成へ翻訳する"
goal: "トップページが おすすめ記事 → 最新/人気の切り替え → カテゴリーから探す → 記事一覧への導線 の順で構成され、各記事がサムネイル・カテゴリー・公開日時付きカードで並び、ヘッダーはスクロール中も追従してヘッダー内から検索を起動でき、フッターに運営者情報・法務ページ・RSS の7導線が揃い、JavaScript が無効でも全導線が機能する状態になっている"
scope_in: ["トップページの区画構成 (おすすめ記事 / 最新記事・人気記事の切り替え / カテゴリーから探す / 記事一覧への導線) と表示順・件数・空状態。観測 fact は system-spec/retrieval-evidence/kajetblog-top-analysis.md §2","記事カードの構成要素 (サムネイル・カテゴリー・公開日時) と 16:9 (約 1200x675) の寸法規約。画像を持たない記事のカードはfeat-thumbnail-visual-systemが保存時生成したOGP画像URLで埋め、サムネイルの無いカードを生じさせない","追従ヘッダーのトップページ適用: サイト名 / 検索起動 / カテゴリへの移動 の3機能に限り、狭い画面では下方向スクロール中に畳み上方向で戻す。アンカー移動時はヘッダー高ぶんの余白で見出しの自己遮蔽を防ぐ","フッターの導線集約: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ / RSS の7導線","最新/人気の切り替えを JavaScript 無効でも URL パラメータで到達可能にする段階的強化","トップページ固有の構造化データ: WebSite + SearchAction + ItemList","src/配下のruntime code/assetsへ参照元の文章・写真・ロゴ・固有名・色値・テーマ資産を転用しない非模倣ゲート。provenance文書と検査fixtureは出典・規則検証に必要なため走査対象外とする"]
scope_out: ["sticky ヘッダー / サイドバー / フッターの部品実装そのもの、共有アイコン体系、折りたたみ表現、テンプレート・配色の選択 UI (feat-blog-ui-builder)","サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)","検索の索引作成・順位付け・結果面 (feat-reader-search-quality)","記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)","管理画面の画面構成。本 feature は読者向けトップページ 1 画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面は feat-seo-aeo-measurement-loop の所有","参照サイトの解析・URL 台帳化そのもの (feat-reference-blog-admin-ux)","SNS導線の新規要件化。現時点では公開URL・表示データ・正本acceptanceが無いため必須scopeへ含めず、情報源とroute契約を持つ別feature判断に委ねる"]
acceptance: ["トップページが おすすめ記事 → 最新/人気 → カテゴリーから探す → 記事一覧導線 の順で描画され、各区画に記事が無いときは空状態の説明が表示される","最新/人気の切り替えが JavaScript を無効にした状態でも URL 経由で到達でき、選択中の側が視覚的に判別できる","ヘッダーがスクロール中も追従し、置かれている機能が サイト名 / 検索起動 / カテゴリ移動 の3つに限られ、ヘッダー内の検索起動から検索入力へ到達できる。JavaScript無効時は検索ページへの通常リンクとして機能する。狭い画面で下方向へスクロールすると畳まれ上方向で戻り、アンカー移動した見出しはヘッダーの下へ隠れない","フッターから運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせ・RSSへ到達できる","トップページの HTML に WebSite + SearchAction + ItemList の JSON-LD がサーバー側で含まれ、pure 関数の単体テストで検証できる","src/配下のruntime code/assetsに参照元の文章・画像・ロゴ・固有名・色値・テーマ資産が存在しないことを機械検査で確認できる。provenance文書と検査fixtureは走査対象外として保持される","トップページが axe-core の重大違反0件で、light/dark双方で本文コントラストが基準を満たす","記事カードがサムネイル・カテゴリー・公開日時を表示し、全画像が固有のwidth/heightを持ち、トップページのCLSが0.1未満である。画像を持たない記事もfeat-thumbnail-visual-systemが保存時生成したOGP画像URLで埋まり、サムネイルが空のカードが生じない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-top-page-composition.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-08T04:21:47Z","origin_kind":"generated","source_digest":"304b260301083dd4e28f8e5c6094a8b0a659d6326ea2a88ed49389bad1e67403","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望「kajetblog.com のトップページを参考に、ヘッダー・フッター・アイコン・画像を含め直感的に見やすいブログを構成する」を C14 macro 分解で 1 feature 化。sticky ヘッダー部品と配色は feat-blog-ui-builder、参照サイト解析は feat-reference-blog-admin-ux が既に所有しているため、本 feature はトップページという 1 画面の情報設計に限定して二重化を避ける。system-spec/ui-ux.md qa-uiux-web-kajetblog-top-composition-v4 に接地"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-top-page-composition.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-v2xx","github_mirror":null,"linked_at":"2026-09-04T07:33:11Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# 目的

読者がトップページに来た瞬間に「何のブログで、何が読めて、次にどこへ行けばよいか」を迷わず掴めるようにし、参照ブログの情報階層だけを抽象化して独自の構成へ翻訳する

## 到達状態

トップページが おすすめ記事 → 最新/人気の切り替え → カテゴリーから探す → 記事一覧への導線 の順で構成され、各記事がサムネイル・カテゴリー・公開日時付きカードで並び、ヘッダーはスクロール中も追従してヘッダー内から検索を起動でき、フッターに運営者情報・法務ページ・RSS の7導線が揃い、JavaScript が無効でも全導線が機能する状態になっている

## スコープ

- スコープ内:
  - トップページの区画構成 (おすすめ記事 / 最新記事・人気記事の切り替え / カテゴリーから探す / 記事一覧への導線) と表示順・件数・空状態。観測 fact は system-spec/retrieval-evidence/kajetblog-top-analysis.md §2
  - 記事カードの構成要素 (サムネイル・カテゴリー・公開日時) と 16:9 (約 1200x675) の寸法規約。画像を持たない記事のカードはfeat-thumbnail-visual-systemが保存時生成したOGP画像URLで埋め、サムネイルの無いカードを生じさせない
  - 追従ヘッダーのトップページ適用: 常時追従するヘッダーへ置くのは サイト名 / 検索起動 / カテゴリへの移動 の 3 機能に限る (占有面積の対価に見合う働きを持つものだけを残す。qa-uiux-web-top-composition-v6)。狭い画面では下方向のスクロール中は畳み、上方向へ動かしたときに戻す。アンカー移動時に見出しが追従ヘッダーの下へ潜らないよう、ヘッダーの高さぶんの余白を見出しに与える。キャッチコピーは参照サイトの観測 fact §1 にはあるが追従ヘッダーには置かず本文の流れの中へ配置する
  - フッターの導線集約: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ / RSS の7導線
  - 最新/人気の切り替えを JavaScript 無効でも URL パラメータで到達可能にする段階的強化
  - トップページ固有の構造化データ: WebSite + SearchAction + ItemList。参照サイトに ItemList と llms.txt が無い欠測 (観測 fact §7) を独自に埋める
  - `src/` 配下のruntime code/assetsへ参照元の文章・写真・ロゴ・固有名・色値・テーマ資産を転用せず、情報階層と操作原則だけを移す非模倣ゲートと、その機械検査。provenance文書と検査fixtureは出典・規則検証に必要なため走査対象外とする
- スコープ外:
  - sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択 UI (feat-blog-ui-builder)
  - グローバルナビ・検索・メニュー等の共有アイコン体系と折りたたみ表現の部品実装 (feat-blog-ui-builder)。本featureは提供された部品を配置し、独自icon setを再実装しない
  - サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)
  - 検索の索引作成・順位付け・結果面 (feat-reader-search-quality)
  - 記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)
  - 管理画面の画面構成。本 feature は読者向けトップページ 1 画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面は feat-seo-aeo-measurement-loop の所有
  - 参照サイトの解析・URL 台帳化そのもの (feat-reference-blog-admin-ux)

## 受入

- A1〜A8 は `frontmatter.acceptance` の1始まりの配列indexへ対応する。この本文には受入文言を複製せず、実装要件・task・evidenceはIDと同時にfrontmatter acceptanceのdigestを参照する

## 受入正本レジストリ

- canonical source: `features/feat-blog-top-page-composition.md#frontmatter.acceptance`（このmacro proposalの`node-input.json#/patch/acceptance`が次世代候補）
- planner projection: `features/feat-blog-top-page-composition.context.json#/acceptance`
- ID mapping: 配列の 1 始まり順番を `A1` 〜 `A8` に対応させる

受入の文言は frontmatter にのみ保持する。実装要件・タスク仕様書・証跡は canonical ID を参照し、
同じ ID に別の文言を与えない。件数を本文へ書き写さないのは、文言が二箇所で分裂するのを防ぐためである。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: トップページは読者面の最上位入口であり、管理画面のプレビューにも同じ正本が投影される。二層で見える姿がずれない制約を arch-two-layer-platform に接地させる。仕様本文は system-spec/ui-ux.md の確定章を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-blog-ops-crud, feat-blog-ui-builder, feat-reference-blog-admin-ux, feat-thumbnail-visual-system, feat-reader-search-quality
- 依存理由:
  - feat-blog-ops-crud: 運営者が保存順で設定したおすすめ記事と公開可否を提供する側。本 feature はその公開 read model を表示し、選択・永続化を再実装しない
  - feat-blog-ui-builder: sticky ヘッダー・フッター部品、共有アイコン体系、折りたたみ表現、配色トークンを提供する側。本 feature はそれらを配置するだけで再実装しない
  - feat-reference-blog-admin-ux: 参照サイトの観測 fact と非模倣ゲートの定義元。本 feature はその成果を消費する
  - feat-thumbnail-visual-system: 記事カードのサムネイルが無いとトップページの区画が成立しない
  - feat-reader-search-quality: ヘッダー内検索の起動先が無いと検索導線が空振りする

## Handoff

- per-feature planning: ready 到達後に system-dev-planner (`run-system-dev-plan`) を
  `--feature-id feat-blog-top-page-composition` と `--feature-context features/feat-blog-top-page-composition.context.json` で起動する。
  人間の手動 `/system-dev-plan` 実行結果も同じ登録経路 (C02 `register-package`) で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node の intra-feature DAG
- 登録先: 全 task を `parent_feature=feat-blog-top-page-composition` と共通 `feature_package_id` で C02 経由 atomic 登録する。expected/applied=13 を必須とする
- 完了 rollup: exact 13 が全て done で、かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ feature を done にする

## 2026-09-08 最終レビュー

- MVP の実装済み部分（A1/A2/A5/A6の局所契約）は対象テストと型検査で再確認した。
- A4 のフッター全導線、A7 のa11y/コントラスト、A8 のCLS/thumbnail fallback、P13のdevelopment展開は未完了である。
- したがって feature と exact-13 Beads は open のまま、PR は draft とする。
- task仕様の再評価packageは `sha256:a3ead33cd3c445dbd86ac6bb7b301323862bd442b445d6160e30036b75f9f680` で4条件PASS。
- 仕様影響と受領は `docs/spec/feat-blog-top-page-composition/spec-writeback-receipt.md`、技術境界は `architecture/arch-blog-top-page-composition-final-review.md` を参照する。
