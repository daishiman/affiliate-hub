# 画面棚卸し（feat-blog-ui-builder / P01）

記録日: 2026-08-30
graph_node_id: `SYS-BLOG-UI-BUILDER-P01`
Beads: `ah-45ba.1`

> **歴史 snapshot:** 以下は 2026-08-30 の P01 棚卸しであり、当時の重複を残す証跡である。
> 2026-08-31 に `/admin/sites/[site]/documents` と `SiteDocumentKey` を正本へ統一し、
> `/admin/blog/pages` は canonical 管理口へ転送する legacy adapter へ縮退した。
> 現行判定は [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本) を参照する。

## この文書の役割

既存の `src/app/admin/` と `src/app/s/[site]/` を棚卸しし、
**受入 A1〜A14 を満たすために足りない画面**を差分として確定する。

「画面が無い」と「画面はあるが繋がっていない」を区別して書く。
後者のほうが多く、かつ見落とされやすい。

## 1. 管理画面（`src/app/admin/`）

`src/app/admin/` 配下には 86 本の `page.tsx` がある。本 feature に関係するものだけを挙げる。

### 1.1 ブログ（サイト）の管理

| ルート | 役割 | 根拠 | 本 feature との関係 |
|---|---|---|---|
| `/admin/sites` | ブログ一覧 | `src/app/admin/sites/page.tsx:45` | A1 のテンプレート列を足す先 |
| `/admin/sites/[site]` | ブログ 1 件の位置づけ・10 観点・公開可否 | `src/app/admin/sites/[site]/page.tsx:50,102,130,133` | A1/A2 の設定入口の候補 |
| `/admin/sites/[site]/edit` | 設計図（blueprint）を直す | `src/app/admin/sites/[site]/edit/page.tsx:32,44` | **V3 の現行正本**（`site_blueprints.theme`）を触る画面 |
| `/admin/sites/[site]/documents` | 固定ページ編集（未記入枚数の警告つき） | `src/app/admin/sites/[site]/documents/page.tsx:35,51,56` | A4。**`/admin/blog/pages` と役割が重複** |
| `/admin/sites/new` | 新しいブログを作る（13 段階ウィザード） | `src/app/admin/sites/new/page.tsx:45,102,132,148` | **A1 のテンプレート選択を挿す先** |

### 1.2 ブログの版面

| ルート | 役割 | 根拠 | 本 feature との関係 |
|---|---|---|---|
| `/admin/blog` | 「ブログの版面」ハブ | `src/app/admin/blog/page.tsx:17` | A1/A2 の新規画面をぶら下げる先 |
| `/admin/blog/layout` | 版面の枠と帯（header / sidebar / sidebar_sticky / footer + 4 帯） | `src/app/admin/blog/layout/page.tsx:39,79` | **A3 の sticky 設定が既にここにある**（`sidebar_sticky`） |
| `/admin/blog/pages` | 固定ページの一覧・編集（最終更新表示） | `src/app/admin/blog/pages/page.tsx:34,77,109` | A4。**実装済み** |
| `/admin/blog/articles` ほか | 記事 CRUD・削除復元 | 同ディレクトリ | **A5/A12 の表現ブロック挿入を足す先** |
| `/admin/blog/tags` / `delivery` / `evaluate` | タグ・配信・評価 | 同上 | 直接の関係なし |

### 1.3 設定とアフィリエイト

| ルート | 役割 | 根拠 | 本 feature との関係 |
|---|---|---|---|
| `/admin/settings/appearance` | **管理画面自身**の見た目 | `src/app/admin/settings/appearance/page.tsx:21,25,34` | **A2 とは別物。** 公開面の配色ではない。混同注意 |
| `/admin/settings/seo` | SEO/AI 検索の指針＝出典レジストリ | `src/app/admin/settings/seo/page.tsx:45,104` | A14。**実装済み** |
| `/admin/affiliate` | 提携の入口 | `src/app/admin/affiliate/page.tsx` | **A6/A7 の掲載一覧・逆引きを足す先** |
| `/admin/affiliate/links` | 提携リンク一覧 | 同ディレクトリ | A7 の逆引き起点の候補 |

### 1.4 管理画面に「無い」もの

`grep -rn "テンプレート" src/app/admin src/presentation/admin` の結果は **0 件**。

- **ブログのテンプレート選択画面**（A1）— 存在しない
- **ブログ既定の配色を選ぶ画面**（A2）— 存在しない（`settings/appearance` は管理画面自身の配色）
- **ページ単位の配色上書き画面**（A2）— 存在しない
- **ブログごとの掲載アフィリエイト一覧**（A6）— 存在しない
- **アフィリエイトからの逆引き画面**（A7）— 存在しない

## 2. 公開面（`src/app/s/[site]/`）

| ルート | メタ生成 | JSON-LD | 根拠 |
|---|---|---|---|
| `page.tsx`（トップ） | あり | — | `src/app/s/[site]/page.tsx:12` |
| `blog/page.tsx`（記事一覧） | あり | — | `src/app/s/[site]/blog/page.tsx:12` |
| **`blog/[article]/page.tsx`** | **無し** | **無し** | 該当記述 0 件 → **A10/A12 の穴** |
| `reviews/[product]` | あり | あり | `page.tsx:7` `createArticlePageMetadata` / `src/presentation/site/article-page.tsx:141-200` |
| `compare/[comparison]` | あり | あり | 同上 |
| `best/[topic]` | あり | あり | 同上 |
| `guides/[topic]` | あり | あり | 同上 |
| `tools/[tool]` | あり | あり | 同上 |
| `categories/[category]` / `authors/[author]` / `experts/[expert]` / `search` / `shortlist` | 一覧系 | — | — |
| 方針ページ 11 本（`advertising-policy` / `ai-policy` / `editorial-policy` / `methodology` / `measurement` / `corrections` / `privacy` / `terms` / `tokushoho` / `operator` / `contact`） | ハードコード route | — | — |
| `[fixedPage]/page.tsx` | 汎用固定ページ 8 種を 1 route | — | `src/app/s/[site]/[fixedPage]/page.tsx:14-30`（`contact` は notFound） |
| `sitemap.xml` / `robots.txt` / `feed.xml` / `llms.txt` | 機械向け | — | 各 `route.ts`（27 / 26 / 26 / 38 行） |
| `not-found.tsx` | 404 | — | — |

サイト外だが関連: `src/app/indexnow.txt/route.ts`（A13 の鍵ファイル配信）

### 2.1 公開面の構造的な非対称

**記事に 2 系統ある。**

- `published_articles` 経路（reviews / compare / best / guides / tools の 5 ルート）
  → `ArticlePage` 共通コンポーネントを通り、メタも JSON-LD も揃っている
- `blog-ops` 経路（`/blog/[article]`）
  → `generateMetadata` も JSON-LD も無い

**A10・A12 の「記事ページ」がどちらを指すかで合否が変わる。**
受入文の「記事ページの HTML に…」は後者（ブログ記事）を含むと読むのが自然であり、
本ベースラインは**両方を対象**として扱う。

### 2.2 sticky の現状（A3）

`src/presentation/ui/templates/site.module.css` の実測:

| 領域 | 現状 | 行 |
|---|---|---|
| ヘッダー | `position: relative` — **sticky でない** | `:34-39` |
| サイドバー | `.siteAsideSticky` で sticky | `:982` |
| 目次サイドバー | `.tocSidebar` で sticky | `:633` |
| 狭幅の折りたたみ | `@media (width < 64rem)` | `:990` |
| フッター | `.siteFooter` — **sticky でない** | `:297` |

**A3 の欠落はヘッダーとフッターの 2 領域。** 狭幅の折りたたみは既にある。

## 3. 新規に要る画面の差分

| # | 画面 | 置き場所の案 | 受入 | 種別 |
|---|---|---|---|---|
| N1 | ブログのテンプレート選択 | `/admin/sites/new` の段階に追加 + `/admin/blog/layout` に差し替え口 | A1 | **新規** |
| N2 | ブログ既定の配色 | `/admin/blog/layout` 内、または `/admin/blog/theme` | A2 | **新規** |
| N3 | ページ単位の配色上書き（一覧と解除） | `/admin/blog/theme` の下 | A2 | **新規** |
| N4 | 記事編集の表現ブロック挿入 UI | `/admin/blog/articles/[article]` に追加 | A5・A12 | **新規** |
| N5 | ブログごとの掲載アフィリエイト一覧 | `/admin/blog/affiliates` または `/admin/affiliate` 内のタブ | A6 | **新規** |
| N6 | アフィリエイトからの逆引き | `/admin/affiliate/links/[link]` | A7 | **新規** |
| N7 | ブログ記事のメタ + JSON-LD | `src/app/s/[site]/blog/[article]/page.tsx` に `generateMetadata` と JSON-LD | A10・A12 | **既存ルートの補完** |
| N8 | ヘッダー・フッターの sticky | `src/presentation/ui/templates/site.module.css` | A3 | **既存 CSS の変更** |

### 3.1 「画面はあるが繋がっていない」もの

新規画面より先に潰すべきもの。

| # | 状態 | 受入 |
|---|---|---|
| U1 | `/admin/blog/layout` に `sidebar_sticky` の設定はあるが、ヘッダー・フッターの sticky 設定が無い | A3 |
| U2 | `/admin/sites/[site]/documents` と `/admin/blog/pages` が固定ページで役割重複（V2 の表れ） | A4 |
| U3 | `fillSlots`（`src/domain/authoring/blog-template.ts:196`）の呼び出しが 0 件 | A5 |
| U4 | `blog_template` / `blog_theme` / `page_theme_override` / `blog_affiliate_placement` の 4 表が死蔵 | A1・A2・A6・A7 |

## 4. 影響を受ける既存テスト

| 検査 | 影響 |
|---|---|
| `tests/e2e/app-routes.spec.ts:224` | **「route registry は 87 画面」を数え上げで固定している。** N1〜N6 で画面が増えるとこの数が変わる |
| `tests/ui/route-table.ts` | 同上。ルート表の正本 |
| `tests/ui/blog-ops-a11y-floor.test.tsx:16` | 条文が「A14」を指しており、本 feature の A9 と番号が衝突 |
| `tests/ui/theme-contrast.test.ts` | A2 で配色経路が変わると影響 |
| `tests/visual/baseline-updates.jsonl` | A3 の sticky 変更で視覚基準が動く |

**`app-routes.spec.ts` の 87 という数は、画面を足すたびに更新が要る。**
P04（テスト設計）はこの更新を計画に含めること。

## 5. スコープ外（画面を作らないもの）

`features/feat-blog-ui-builder.md` の `scope_out` より:

- 記事本文の AI 生成本体（`/admin/generation` 系）
- アフィリエイト URL の登録・商品識別（`/admin/affiliate/programs/new` 等の既存画面はそのまま）
- クリック計測の分析基盤（`/admin/analytics` 系）
- 管理画面全体の単一用途画面への再編（**これは `feat-admin-cognitive-load-ui` が持つ**）
- 独自ドメイン運用
- makuring.jp の機械取得や文章・素材の複製（**参照は構成・配置・表記法のみ**）
