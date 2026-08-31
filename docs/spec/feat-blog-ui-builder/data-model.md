# データモデル契約（feat-blog-ui-builder / P02）

記録日: 2026-08-30
更新日: 2026-08-31（固定文書の正本を現行実装へ同期）
graph_node_id: `SYS-BLOG-UI-BUILDER-P02`
Beads: `ah-45ba.2`
source_feature_digest: `sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b`

## この文書の役割

6 エンティティ（`blog_template` / `blog_theme` / `page_theme_override` /
`legal_page` / `blog_affiliate_placement` / `guideline_references`）の
**列・関連・D1 永続化契約**を確定する。

表そのものは migration `0022_neat_virginia_dare` と
`0035_seo_ai_search.sql` 系で既に存在する。本 phase が確定するのは
**「表に何が書かれてよいか」と「誰が書くか」**であって、DDL ではない。

> P01 が「4 表が死蔵」と記録した状態を、P03 以降が Port と UseCase で
> 繋ぐための契約を先に固定する。表を先に作って繋ぎ方を決めなかったことが
> 死蔵の原因なので、ここで繋ぎ方を書き切る。

## 0. P01 の未決事項（V1〜V3 / Q1〜Q3）の決着

P01 は語彙の二重化 3 件を P02 へ委ねた。**本契約で決着させる。**

### V1 / Q1 — 記事内ブロックの語彙

| | `EXPRESSION_BLOCK_KINDS` | `ARTICLE_BLOCK_KINDS` |
|---|---|---|
| 場所 | `src/domain/authoring/blog-template.ts:43` | `src/domain/blogops/blueprint-parts.ts:122` |
| 数 | 10 | 15 |
| 永続 | しない | `blog_article_block` へする |
| 所有 feature | **本 feature** | `feat-blog-ops-crud` |

**決定: 本 feature の正本は `EXPRESSION_BLOCK_KINDS`（10 種）。**

数だけ見ると「10 と 15 のどちらか」に見えるが、10 種の内訳は
**SEO/AI 引用用の標準ブロック 5 種**（`answer` / `key_points` / `faq` /
`sources` / `freshness`）と**記事表現ブロック 5 種**（`figure` / `comparison` /
`cta` / `summary` / `spec_table`）であり、これは本 task の purpose 文
「記事表現ブロック5種+スロット+SEO/AI引用用標準ブロック (answer/key-points/FAQ/sources/freshness)」
と 1 対 1 で対応する。**要求文がそのまま語彙になっている側が正本である。**

- `ARTICLE_BLOCK_KINDS` は `feat-blog-ops-crud` が所有する永続語彙であり、本 feature は変更しない。
- 統合はしない。統合すると片方の feature の受入が他方の変更で動く。
- **写像の責務**: 記事編集画面が `ExpressionBlock` を挿入するとき、
  永続へ落とす直前に `blueprint-parts` 側の語彙へ写す。写像表は
  `src/application/adapters/expression-article-block.ts` に 1 本だけ置く。
  写像を持つ場所を 2 箇所にしないこと（P01 が V2 で見つけた事故の型と同じ）。

### V2 / Q2 — 固定ページの名札

**決定: `SITE_ROUTES` から導く `SITE_DOCUMENT_KEYS`
（`src/domain/authoring/site-routes.ts`、8 種）が唯一の正本。**

`legal_page.kind` は `SiteDocumentKey` をそのまま保存し、管理・公開の双方が
`site-document-repository.ts` を通る。`FIXED_PAGE_KINDS` は旧公開 URL を
canonical URL へ redirect する adapter の入力に限り、表の名札には使わない。
旧名札からの既存行移行は `drizzle/0040_serious_madelyne_pryor.sql` が担う。

要求が挙げる 6 種に対して正本が 8 種なのは、編集可能な方針ページを
route catalog から漏れなく導くためである。要求の 6 種は最小集合であって上限ではない。

### V3 / Q3 — 公開面の配色の正本

**決定: `blog_theme` + `page_theme_override` の 2 層を正本とし、
`site_blueprints.theme` は「ブログ既定が未登録のときのフォールバック」へ降格する。**

理由は本 task の purpose が「配色2層」を明示していること、および
`page_theme_override` はページ単位の粒度を持ち `site_blueprints.theme` には
その粒度が無いこと。粒度の粗い側を正本にすると受入 A2 が構造的に満たせない。

移行は破壊的に行わない。読み取りは次の優先順で解決する（詳細は `theme-contract.md`）。

## 1. `blog_template` — ブログのテンプレート選択

`src/db/schema.ts:2226` / migration `0022`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | **絞り込みの 1 段目。** `site_slug` から辿れば分かる、では足りない |
| `site_slug` | text | 不可 | どのブログか |
| `template_id` | text | 不可 | `BLOG_TEMPLATE_IDS`（6 種）の値のみ |
| `updated_at` | integer(ts) | 不可 | 既定 `unixepoch()` |

- 一意制約: `blog_template_site_idx(site_slug)` — **1 ブログ 1 テンプレート。**
- `template_id` の妥当性は D1 の CHECK ではなくドメイン側（`BLOG_TEMPLATE_IDS`）で担保する。
  D1 に enum を焼くと、テンプレートを 1 つ足すたびに migration が要る。
- **行が無い＝既定テンプレート**（`review_focus`）。行を必ず作る運用にしない。
  作る運用にすると、既存 87 ブログ全部に backfill が要る。
- **テンプレートは並び方だけを決める。** 記事の中身はテンプレートを知らない。
  差し替えても既存記事は壊れない（受入 A1）。この不変条件は P04 が検査で固定する。

## 2. `blog_theme` — ブログ既定の配色

`src/db/schema.ts:2244` / migration `0022`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | **絞り込みの 1 段目** |
| `site_slug` | text | 不可 | どのブログか |
| `brand_theme` | text | 不可 | `BRAND_THEMES`（10 種）の値のみ |
| `color_mode` | text | 不可 | `auto` / `light` / `dark`、既定 `auto` |

- 一意制約: `blog_theme_site_idx(site_slug)` — **1 ブログ 1 既定。**
- 索引: `blog_theme_workspace_idx(workspace_id, site_slug)`
- **値は色そのものではなく、`tokens/themes.css` の `[data-brand-theme=…]` を選ぶ名札である。**
  ここに 16 進値を入れない。入れると配色の定義が CSS と DB の 2 箇所になる。
- `workspace_id` と `site_blueprints` 経由の所有確認を併用する。
  列は問い合わせ単体の床、所有確認は親サイトとの整合を担うため、片方で代用しない。

## 3. `page_theme_override` — ページ単位の配色上書き

`src/db/schema.ts:2261` / migration `0022`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | **絞り込みの 1 段目** |
| `site_slug` | text | 不可 | どのブログか |
| `page_path` | text | 不可 | 公開面のパス（先頭 `/`、末尾スラッシュ無し） |
| `brand_theme` | text | **可** | NULL は「配色は既定のまま」 |
| `color_mode` | text | **可** | NULL は「明暗は既定のまま」 |

- 一意制約: `page_theme_override_site_page_idx(site_slug, page_path)`
- 索引: `page_theme_override_workspace_idx(workspace_id, site_slug)`
- **「上書きが無い」は行の不在で表す。NULL 行を残さない。**
  受入 A2 の「上書きを解除すると既定へ戻る」は
  **`DELETE`** で実現する。両方の列を NULL にした行は作らない。
  作れてしまうと「上書きしていない上書き行」が一覧に並び、
  解除したのに一覧から消えないという見え方の破れが起きる。
- 片方だけ NULL の行は**許す**（配色だけ変えて明暗は既定、が正当な要求のため）。
- 両方 NULL の行は**リポジトリが拒否する**（保存時に `DELETE` へ倒す）。
  この分岐は D1 の制約では書けないので、UseCase の責務として P03 が持つ。

## 4. `legal_page` — 固定ページ 8 種

`src/db/schema.ts:2285` / migration `0022`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | 既定 `""`。**絞り込みの 1 段目** |
| `site_slug` | text | 不可 | どのブログか |
| `kind` | text | 不可 | `SITE_DOCUMENT_KEYS`（8 種）のみ |
| `title` | text | 不可 | |
| `body` | text | 不可 | |
| `status` | text | 不可 | `draft` / `published`、既定 `draft` |
| `deleted_at` | integer(ts) | 可 | 論理削除 |
| `updated_at` | integer(ts) | 不可 | 既定 `unixepoch()` |

- 一意制約: `legal_page_site_kind_idx(site_slug, kind)` — **1 ブログにつき各 1 枚。**
- 索引: `legal_page_workspace_idx(workspace_id, site_slug, kind)`
- **公開経路は `status='published' AND deleted_at IS NULL` を必ず両方掛ける。**
  片方だけだと下書きか削除済みのどちらかが漏れる。
- **未整備のとき既定文を出さない。** 無いことは「未整備」であって、
  見本の文を本物として配ることではない（canonical `PolicyPage` が `notFound()`）。
- canonical な書き込み口は `/admin/sites/[site]/documents` の 1 画面。
  `/admin/blog/pages?site=...` はそこへ寄せる旧 URL の redirect adapter であり、
  独立した一覧・編集経路を持たない。

## 5. `blog_affiliate_placement` — 記事へのアフィリエイト配置

`src/db/schema.ts:2321` / migration `0022`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | **絞り込みの 1 段目** |
| `site_slug` | text | 不可 | どのブログか |
| `article_slug` | text | 不可 | どの記事か |
| `placement` | text | 不可 | 記事内の位置の名札 |
| `tracking_code` | text | 可 | 計測用の符号 |
| `position` | integer | 不可 | 同一 placement 内の並び、既定 `0` |

- 索引: `blog_affiliate_placement_site_article_idx(site_slug, article_slug)`
- **読者向け読み取り経路はこの表を読まない。**
  報酬・成果の情報を読者経路に混ぜない。読者に出す成果リンクは
  記事本文のブロック（`cta`）が持ち、この表は**管理側の所在把握**専用である。
  この分離は P04 が「公開面のクエリにこの表が現れない」検査で固定する。
- 受入 A6（ブログ→掲載一覧）と A7（アフィリエイト→逆引き）は
  **同じ 1 表への向きの違う読み取り**である。表を 2 つ作らない。
- A7 の逆引き（Q6）は **`blog_affiliate_placement` だけで実現する。**
  `affiliate_links` 側に記事参照列を足さない。足すと同じ事実が 2 箇所に載り、
  片方だけ消える削除経路が生まれる。逆引きは
  `tracking_code` または `placement` を鍵にした 1 クエリで足りる。

## 6. `guideline_references` — SEO/AI 検索ガイドラインの参照レジストリ

`src/db/schema.ts:2342`

| 列 | 型 | NULL | 契約 |
|---|---|---|---|
| `id` | text | 不可 | 主キー |
| `workspace_id` | text | 不可 | **絞り込みの 1 段目** |
| `title` | text | 不可 | |
| `url` | text | 不可 | 出典 URL |
| `publisher` | text | 不可 | 発行元 |
| `region` | text | 不可 | `global` / `jp` |
| `checked_at` | text | 不可 | `YYYY-MM-DD`。90 日判定はドメイン関数 |
| `source_fetched_at` | text | 可 | 原典本文の取得時刻（ISO 8601）。NULL は未取得 |
| `source_sha256` | text | 可 | 取得本文の指紋 |
| `previous_source_sha256` | text | 可 | 1 つ前の指紋。差があれば指針が書き換わっている |
| `re_evaluated_sha256` | text | 可 | この本文版で再評価を完了した指紋 |
| `re_evaluated_at` | text | 可 | 再評価完了時刻 |
| `note` | text | 可 | 人が読む但し書き |
| `created_at` | integer(ts) | 不可 | 既定 `unixepoch()` |

- 索引: `guideline_references_workspace_idx(workspace_id)`
- **出典の本文そのものを保存しない。** 保存すると、古くなった写しが
  正本の顔で残る。持つのは指紋（sha256）だけである。
- **「要旨を読んだ」と「原典を取得した」を区別する。**
  区別が無いと、要旨しか読んでいない行が原典確認済みと同じ見た目で並び、
  日付が新しいほど確かに見えるという逆さまが起きる。
  区別は `source_fetched_at` の NULL / 非 NULL で表す
  （`GuidelineVerification` の `summary_only` / `source_fetched`）。
- **再取得と再評価を分ける。** `source_sha256` が動いても
  `re_evaluated_sha256` は動かない。取得しただけで「確認済み」に
  なってしまうと、本文が変わった警告を読まずに消せる。
- 90 日再確認ポリシーの詳細は `seo-ai-search-contract.md` に置く（受入 A14）。

## 7. 表をまたぐ不変条件

P04 が検査として固定する。

| # | 不変条件 | 破れたときに起きること |
|---|---|---|
| I1 | `blog_template.site_slug` / `blog_theme.site_slug` / `page_theme_override.site_slug` は `site_blueprints.slug` に存在する | 消えたブログの設定が残り、slug 再利用時に他人の設定が当たる |
| I2 | `page_theme_override` に `brand_theme` と `color_mode` が両方 NULL の行は存在しない | 解除したのに一覧から消えない |
| I3 | `legal_page` の `(site_slug, kind)` は重複しない | 同じ 1 枚を 2 画面が別行として作り、後から書いたほうが黙って勝つ |
| I4 | 公開面のクエリに `blog_affiliate_placement` が現れない | 報酬情報が読者経路に混ざる |
| I5 | `workspace_id` を持つ 6 表への読み書きは、必ず `workspace_id` を条件に含む | 作業場所をまたいだ読み書き |

I5 は既存の `tests/architecture/tenant-scoped-schema.test.ts` が
表の側を見ている。P04 は**クエリの側**を足す。

## 8. マイグレーション方針

基礎6表は migration `0022`、指針列は `0035` 系にある。
`0040_serious_madelyne_pryor.sql` が theme/override の `workspace_id` backfill と索引、
旧固定文書 key の canonical `SiteDocumentKey` への移行を担う。

将来の列追加・key改名は、その時点の理由、既存行の backfill、衝突時の停止条件を
新しい migration にまとめる。使われない予防列は足さない。

## 9. 次 phase への引き継ぎ

| 項目 | 引き継ぎ先 |
|---|---|
| 6 表それぞれの Port 定義 | P03 |
| `EXPRESSION_BLOCK_KINDS` → `ARTICLE_BLOCK_KINDS` の写像 1 本 | P03 |
| I1〜I5 の検査 | P04 |
| `blog_theme.workspace_id` の導入 | ✅ `0040` で完了 |
| `tests/e2e/app-routes.spec.ts:224` の画面数更新 | P04 |
