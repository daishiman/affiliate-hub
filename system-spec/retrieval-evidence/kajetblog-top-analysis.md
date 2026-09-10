# 参照システム観測 fact: kajetblog.com トップページ

- 観測日: 2026-09-03
- 取得経路: `extract-system-blueprint/scripts/authz-classify.py` (decision=allow / robots_and_tos_clear) → `fetch-snapshot.py`
- 観測対象: `https://kajetblog.com/` (HTML 338,889 bytes) + 同一 origin の CSS/JS/画像 8 件
- 基盤: WordPress 6.7.7 + SWELL テーマ
- 比較参照 (差し替え前): `https://makuring.jp/` (WordPress + SANGO テーマ)

本ファイルは観測 fact のみを記す。設計判断は `spec-state.json` の qa_log を正本とする。

## 1. ヘッダー (観測 fact)

| 観測項目 | 値 |
|---|---|
| 追従ヘッダー | **あり**。`l-fixHeader` / `l-fixHeader__inner l-container` / `l-fixHeader__logo` |
| ロゴ | `c-headLogo -img` (画像ロゴ) |
| キャッチコピー | `c-catchphrase` |
| グローバルナビ | `c-gnav` / `l-header__gnav c-gnavWrap` |
| 検索 | ヘッダー内アイコン起動 `c-iconBtn__icon icon-search` |
| モバイルメニュー | `c-iconBtn -menuBtn` (ハンバーガー) |
| SNS | `c-iconList` に twitter-x / youtube / pinterest / feedly / rss / contact |

makuring.jp には追従ヘッダーが無く、モバイルで画面下部固定メニュー (`.fixed-menu ul { position: fixed; bottom: 0 }`) を使っていた。

## 2. トップページのセクション構成 (h2 原文)

1. `おすすめ記事`
2. `最新記事/人気記事` — タブ切り替え
3. `カテゴリーから探す`
4. 「記事一覧はこちら」への導線

h1 はトップページ本文中に無く、`<title>` が `カジェログ | カジュアルで分かりやすいイヤホン・オーディオレビューブログ`。

## 3. 記事カード (観測 fact)

- カード型、サムネイル画像あり (約 1200x675 = 16:9)
- 表示メタ情報: カテゴリ、公開日時
- 著者・タグ・読了時間の表示なし
- 画像は製品実写

## 4. 画像最適化 (観測 fact)

| 属性 | kajetblog.com | makuring.jp |
|---|---|---|
| img 総数 | 54 | 59 |
| `width` / `height` | 54 / 54 | 7 / 59 |
| `sizes` | 54 | 2 |
| `srcset` | 52 | 2 |
| `decoding="async"` | 54 | 51 |
| `<picture>` | 1 | 0 |

kajetblog.com は全画像に固有寸法を持たせ CLS を構造的に抑えている。

## 5. SEO fact

| 項目 | 値 |
|---|---|
| `<title>` | `カジェログ \| カジュアルで分かりやすいイヤホン・オーディオレビューブログ` |
| `meta description` | あり (約 130 字、対象製品カテゴリを列挙) |
| `meta keywords` | あり |
| `meta robots` | `max-image-preview:large` |
| `link canonical` | `https://kajetblog.com/` |
| OGP | `og:locale=ja_JP` / `og:type=website` / `og:title` / `og:description` / `og:url` / `og:site_name` |
| Twitter Card | `summary_large_image` / `twitter:site=@kajet_jt` |
| favicon | 32x32 / 192x192 / apple-touch-icon 180x180 |
| RSS | `link rel=alternate` で `/feed/` |

### JSON-LD (`@graph`)

| @type | 保持キー |
|---|---|
| `Person` | `@id` `name` `jobTitle` `url` `sameAs` `image` `telephone` |
| `Organization` | `@id` `name` `url` `logo` |
| `WebSite` | `@id` `url` `name` `description` `potentialAction` |

`WebSite.potentialAction` は SearchAction:

```json
{"@type":"SearchAction","target":"https://kajetblog.com/?s={s}","query-input":"name=s required"}
```

トップページに `BreadcrumbList` は無い (`breadcrumb` の CSS class は 22 箇所存在し、記事下層で使用)。

## 6. AIO fact (差し替え前 makuring.jp からの観測)

kajetblog.com に `llms.txt` の参照は **無い**。一方 makuring.jp は head に宣言していた:

```html
<link rel="alternate" href="https://makuring.jp/llms.txt">
<link rel="alternate" href="https://makuring.jp/llms-full.txt">
```

`llms.txt` の実体 (観測):

- `# <サイト名>` + `> <一行説明>` + 生成日時 + ファイル種別
- `### 投稿 (post)` / `### 固定ページ (page)` の H3 セクション
- 各行 `- [タイトル](URL)`
- 末尾に YAML: `license.allow-ai-training`、`disallow` パス一覧
- 規模: 投稿 約700件 + 固定ページ 約16件、約1,500行

## 7. 観測から導かれる欠測 (gap)

- kajetblog.com トップに `BreadcrumbList` / `ItemList` / `Blog` の JSON-LD が無い
- kajetblog.com に `llms.txt` が無い
- 両サイトともトップページに構造化された記事一覧 (`ItemList`) の宣言が無い
