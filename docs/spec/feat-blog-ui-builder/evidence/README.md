# 受入・品質証跡（feat-blog-ui-builder / P11）

- 集約日: 2026-08-30
- 集約元: `acceptance-report.md`（P07）、`quality-report.md`（P09）、`final-review.md`（P10）
- graph_node_id: `SYS-BLOG-UI-BUILDER-P11`

**この文書の目的は「第三者が同じ手順で同じ結果に辿り着けること」である。**
判定の理由は各 report に書いてある。ここに置くのは**materialsそのもの**と、
それを取り直す手順である。

---

## 0. 再現の前提

| 項目 | 値 |
| --- | --- |
| 開発サーバ | `http://localhost:3001`（`pnpm run dev`） |
| 対象ブログ | `home-office-desk`（`SAMPLE_SITE_SLUG`） |
| 管理画面のセッション | Cookie `ah_session=affiliate-hub-manual-local-session` |
| 利用者 | `owner@local.test`（役割 `owner` / 作業場所 `ws_sample`） |
| 実行環境 | `darwin-arm64-chrome151`（Chrome/151.0.7922.174）、vitest 4.1.10 |

> **注意**: ポート 3000 と 8788 は別の worktree が使っている。
> 3001 以外を叩いたり、そちらのプロセスを止めたりしないこと。

---

## 1. 証跡の索引

| ファイル | 対応する受入 | 中身 |
| --- | --- | --- |
| `11-a1-a8-acceptance-tests.txt` | A1–A8 | 受入テスト 6 ファイル 54 件の個別結果 |
| `11-a9-axe-core.txt` | A9 | axe-core 系 5 spec / 855 件の結果 |
| `11-a9-contrast-light-dark.txt` | A9 | コントラスト 31 件（11 配色 × light/dark） |
| `11-a10-meta-tags.txt` | A10 | 記事 1 本の `<head>` メタ 20 個 |
| `11-a10-json-ld.json` | A10 | 同じ記事の JSON-LD 2 ブロック |
| `11-a11-sitemap.xml` | A11 | sitemap（14 URL、うち blog 7 本） |
| `11-a11-robots.txt` | A11 | robots |
| `11-a11-llms.txt` | A11 | llms.txt（AI 向けの案内） |
| `11-a11-feed.xml` | A11 | RSS/Atom フィード |
| `11-a5-a12-article-blocks.txt` | A5 / A12 | 記事 2 本の見出し階層（§3.1 の所見あり） |
| `11-a4-a13-http-status.txt` | A4 / A13 | 固定ページ 18 経路と IndexNow 鍵の HTTP ステータス |
| `11-a14-guideline-references-screen.txt` | A14 | 出典レジストリ画面の可視テキスト |
| `10-final-review-gates-20260824.txt` | （履歴） | 旧 package `ah-6lf` の品質ゲート |

### スクリーンショットではなくテキストにした理由

A14 の受入は「管理画面スクリーンショット」と書いてある。ここではテキストにした。

- 画像は **grep できない**。3 か月後に「あの数字はどこで見たか」を探せない
- 画像は **差分が読めない**。画面が変わったとき、何が変わったか目で追うしかない
- 画像は環境（フォント・DPI・OS）で変わる。**再現の手順として弱い**

判定に必要なのは「何が画面に出ていたか」であって「どう見えたか」ではない。
見た目の崩れは別の仕組み（`pnpm run visual` の視覚回帰）が担当している。
画像が要るなら `pnpm run visual` の見本を参照するのが筋で、
ここで別系統の画像を増やすと**同じものを 2 か所で管理することになる**。

---

## 2. 取り直す手順

### 2.1 サーバを立てる

```bash
pnpm run dev          # http://localhost:3001 で待ち受ける
```

### 2.2 A11（sitemap / robots / llms.txt / feed）

```bash
S=http://localhost:3001
E=docs/spec/feat-blog-ui-builder/evidence
curl -s "$S/s/home-office-desk/sitemap.xml" -o $E/11-a11-sitemap.xml
curl -s "$S/s/home-office-desk/robots.txt"  -o $E/11-a11-robots.txt
curl -s "$S/s/home-office-desk/llms.txt"    -o $E/11-a11-llms.txt
curl -s "$S/s/home-office-desk/feed.xml"    -o $E/11-a11-feed.xml

# 期待: 4 経路すべて 200、sitemap の <loc> が 14 件（うち /blog/ が 7 件）
grep -c '<loc>' $E/11-a11-sitemap.xml
grep -c '<loc>.*/blog/' $E/11-a11-sitemap.xml
```

### 2.3 A10（メタと JSON-LD）

```bash
curl -s "$S/s/home-office-desk/blog/starter-kit-2026" -o /tmp/art.html
# <head> の meta/title/canonical を取り出す → 11-a10-meta-tags.txt
# application/ld+json の中身を取り出す      → 11-a10-json-ld.json

# 期待: meta 20 個、JSON-LD 2 ブロック
#   1 本目: BlogPosting / Person / Organization / WebPage
#   2 本目: BreadcrumbList / ListItem × 3
```

### 2.4 A4・A13（固定ページと IndexNow 鍵の HTTP ステータス）

```bash
for p in profile sitemap site-policy privacy-policy commercial-transaction \
         contact review-guidelines company \
         operator privacy terms tokushoho \
         ai-policy methodology editorial-policy advertising-policy \
         corrections measurement; do
  printf "%-28s %s\n" "/$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' $S/s/home-office-desk/$p)"
done
```

### 2.5 A9（axe-core とコントラスト）

```bash
npx vitest run tests/ui/page-render.test.tsx tests/ui/blog-ops-a11y-floor.test.tsx \
  tests/ui/axe-blind-spots.test.ts tests/ui/axe-rule-coverage.test.ts \
  tests/ui/tap-target-floor.test.ts          # 期待: 855 件全合格

npx vitest run tests/ui/theme-contrast.test.ts --reporter=verbose
                                             # 期待: 31 件全合格
```

### 2.6 A1–A8（受入テスト）

```bash
npx vitest run tests/acceptance/feat-blog-ui-builder/ --reporter=verbose
                                             # 期待: 6 ファイル 54 件全合格
```

### 2.7 A14（出典レジストリ画面）

```bash
curl -s -H "Cookie: ah_session=affiliate-hub-manual-local-session" \
  "$S/admin/settings/seo" -o /tmp/seo.html
# <main> からタグを除いた可視テキスト → 11-a14-guideline-references-screen.txt
```

---

## 3. 証跡から読み取れること

### 3.1 🔴 記事本文が読者に出ていない（A5 / A12 に関わる新しい所見）

`11-a5-a12-article-blocks.txt` を取ったとき、**記事 2 本とも見出しが 2 個しかなかった**。

```
/blog/starter-kit-2026                        H1 記事名 / H2「この記事の評価」
/blog/choosing-a-laptop-for-long-timeline-editing  H1 記事名 / H2「この記事の評価」
```

`<main>` の中身を数えると、`p` が 4 個・`ul` 0 個・`table` 0 個・`details` 0 個で、
可視テキストは **パンくず / 記事名 / 説明文 / 執筆者と更新日 / 評価ウィジェット** だけである。

**つまり記事の本文が 1 文字も出ていない。**
表現ブロック（A5）も SEO 標準ブロック（A12）も、載る場所そのものが空である。

P07 は A5 と A12 を 🟡（単体テストは緑だが実測が無い）と判定した。
**この実測はその 🟡 の中身を具体化する。**「実測が無い」のではなく
「実測すると本文が出ていない」ことが分かった。

ただし判定を書き換えるのは P11 の仕事ではない（write scope は `evidence/` のみで、
`final-review.md` は P10 の所有物）。**事実として記録し、P13 へ渡す。**
A5 / A12 は 🟡 のままでよいのか、🔴 に落とすべきかの再判定が要る。

### 3.2 A4 の 404 は 12 経路（P07 の 8 経路より広い）

`11-a4-a13-http-status.txt` で 18 経路を測った結果:

| 状態 | 件数 | 経路 |
| --- | --- | --- |
| 200 | 6 | `/operator` `/privacy` `/terms` `/tokushoho` `/corrections` `/measurement` |
| 404 | 12 | 固定ページ 8 種すべて + 方針 4 本 |

`/corrections` と `/measurement` が 200 なのは、これらが
`GENERATED_POLICY_ROUTES`（本文を機械が組み立てる 2 本）で、
`legal_page` 表を読まないためである。**保存先を要らない 2 本だけが生き残っている。**

これは A4 の原因の裏付けになる。**404 になるのは、`legal_page` を読む経路だけである。**

### 3.3 A14 の出典レジストリは 1 件も登録されていない

`11-a14-guideline-references-screen.txt` より:

```
登録済みの出典
  まだ出典を登録していません
初期候補 (未登録)
  Google 検索の AI 機能で成功するためのガイド … 原典未取得
  AI features and your website              … 原典未取得
  llms.txt の提案（/llms.txt）                … 原典未取得
  IndexNow プロトコルの文書                    … 原典未取得
```

画面は動く。登録の口もある。**ただし中身が空で、候補 4 件はすべて「原典未取得」である。**
P07 の A14 🟡 はこの状態を指している。90 日の期限判定は単体テストで緑だが、
**期限を判定する対象が 1 件も無い。**

### 3.4 A13 は 404 が正しい

IndexNow の鍵ファイルが 404 なのは**期待どおり**である。
200 が返ったら、鍵がリポジトリに commit されていることになり、そちらが事故である。
`11-a4-a13-http-status.txt` の最後の 2 行はその確認である。

---

## 4. 判定項目

- [x] `evidence/` に A1–A9 の証跡が存在する
      — `11-a1-a8-acceptance-tests.txt` / `11-a9-axe-core.txt` / `11-a9-contrast-light-dark.txt`
- [x] `evidence/` に A10 の証跡（HTML/JSON-LD 出力サンプル）が存在する
      — `11-a10-meta-tags.txt` / `11-a10-json-ld.json`
- [x] `evidence/` に A11 の証跡（sitemap/robots/llms.txt サンプル）が存在する
      — `11-a11-sitemap.xml` / `11-a11-robots.txt` / `11-a11-llms.txt` / `11-a11-feed.xml`
- [x] `evidence/` に A13 の証跡（IndexNow スキップログ）が存在する
      — `11-a4-a13-http-status.txt`（鍵 404 の実測）
- [x] `evidence/` に A14 の証跡（出典レジストリ管理画面）が存在する
      — `11-a14-guideline-references-screen.txt`（画像ではなくテキスト、§1 の理由）
- [x] 再現手順が記述されている — §2

---

## 4.1 `pnpm run verify` の実行結果（4 件が赤）

P11 の Automated command として `pnpm run verify` を実行した。
**17 門のうち 4 門が赤で、うち 3 件はこの feature package のコードが原因である。**

| 門 | 結果 | 内容 |
| --- | --- | --- |
| 型検査 | 🟢 | — |
| 書き方の検査 | 🟢 | — |
| 段の指定漏れ | 🟢 | 417 件（1 段 307 / 2 段 109 / 3 段 1） |
| **マイグレーションの作り忘れ** | 🔴 | §4.2 |
| 公開前コンテンツ一式の検品 | 🟢 | 3 成果物、止めるもの 0 件 |
| 受入 ID の証跡突合 | 🟢 | 10 IDs / 200 evidence files |
| テストとカバレッジ | 🟢 | 417 ファイル / 10023 件（別実行） |
| テストと要件の対応 | 🟢 | 由来不明は上限以内 |
| **要件ごとの必須テスト種別** | 🔴 | §4.3 |
| **つなぎ目の呼び出し** | 🔴 | §4.4 |
| **仕様レポートの鮮度** | 🔴 | §4.5 |
| 見た目の回帰 | 🔴 | `quality-report.md` §4（本 package 外） |

> `verify` は最初の赤で止まる作りなので、
> 「マイグレーション」以降の門は**個別に実行して**状態を確かめた。

### 4.2 🔴 マイグレーションの作り忘れ

`src/db/schema.ts` の変更に対する migration が生成されていなかった。
検査が `drizzle-kit generate` を走らせ、次の 3 ファイルを作った。

```
drizzle/0040_serious_madelyne_pryor.sql   （新規）
drizzle/meta/0040_snapshot.json           （新規）
drizzle/meta/_journal.json                （更新）
```

中身:

```sql
ALTER TABLE `blog_theme`          ADD `workspace_id` text DEFAULT '' NOT NULL;
CREATE INDEX `blog_theme_workspace_idx`          ON `blog_theme` (`workspace_id`,`site_slug`);
ALTER TABLE `page_theme_override` ADD `workspace_id` text DEFAULT '' NOT NULL;
CREATE INDEX `page_theme_override_workspace_idx` ON `page_theme_override` (`workspace_id`,`site_slug`);
CREATE INDEX `blog_affiliate_placement_workspace_idx` ON `blog_affiliate_placement` (`workspace_id`,`site_slug`);
CREATE INDEX `blog_template_workspace_idx`            ON `blog_template` (`workspace_id`,`site_slug`);
```

**これは深刻である。** `blog_theme` と `page_theme_override` に
`workspace_id` を足す schema 変更（P05）に対して migration が無いまま来ていた。
このまま出すと、**本番の D1 に列が無いのに、コードは列があるつもりで問い合わせる**。
配色の保存も読み出しも実行時に落ちる。

門はまだ赤い。判定が `git status --porcelain drizzle` を見ており、
**生成しただけでは足りず、コミットされて初めて緑になる**ためである。
本セッションはコミットの許可を持たないので、ここで止めて報告する。

- 直す手順: 上の 3 ファイルをコミットに含める
- 参照: `docs/product/ci-cd-guide.md` ④

### 4.3 🔴 要件ごとの必須テスト種別 — 知らない種別名が 6 ファイル

```
tests/acceptance/feat-blog-ui-builder/article-block-order.test.tsx : invariant
tests/acceptance/feat-blog-ui-builder/article-html-contract.test.ts: invariant
tests/acceptance/feat-blog-ui-builder/machine-feeds.test.ts        : invariant
tests/acceptance/feat-blog-ui-builder/public-appearance.test.ts    : error, invariant
tests/acceptance/feat-blog-ui-builder/sticky-layout.test.ts        : invariant
tests/acceptance/feat-blog-ui-builder/template-and-theme.test.ts   : invariant
```

**6 ファイルすべてが本 package の受入テストである**（P06 の成果物）。
`invariant` と `error` は `TEST_TYPES` に無い名前で、
表記ゆれで別種別に見えるのを防ぐために名前が固定されている。

要件側の数字は健全（289 要件 / 宣言済 284 / 未宣言 5（上限 5）/ 理由つき除外 6（上限 7））。
**落ちているのは名前だけである。**

### 4.4 🔴 つなぎ目の呼び出し — 書き込みが操作の記録に届いていない

```
今回から記録へ届かなくなったもの:
  createManageBlogAppearanceUseCase  [BlogAppearancePort.saveOverride, saveTheme]
    src/application/usecases/authoring/manage-blog-appearance.ts
  createReviewBlogPlacementsUseCase  [BlogAffiliatePlacementPort.remove, save]
    src/application/usecases/authoring/review-blog-placements.ts
```

**どちらも本 package が P05 で足した usecase である。**
配色の保存（A2）と掲載の増減（A6/A7）は書き込みなのに、
**誰がいつ変えたかの記録が残らない。**
掲載はアフィリエイトの金銭に直結するので、記録が無いと後から追えない。

あわせて「読み書きを判定できない手続き」が 4 件（上限 0）。

```
BlogAppearancePort.clearOverride / saveTemplate / templateOf / themeOf
```

`templateOf` / `themeOf` は読み取り、`saveTemplate` / `clearOverride` は書き込みだが、
名前が `NON_WRITE_VERBS` / `WRITE_VERBS` のどちらにも登録されていない。

### 4.5 🔴 仕様レポートの鮮度

レポートの判定自体は PASS だが、焼き付け（`node scripts/spec-freshness.mjs --write`）が
行われていない。**再評価してから焼き付ける**手順で、
焼き付けだけ先に走らせると「評価していないのに新鮮」と主張することになる。
本 phase の write scope（`evidence/`）の外なので実行しなかった。

---

## 5. P13 への申し送り（本 phase で増えた分）

| # | 事項 | 重さ | 場所 |
| --- | --- | --- | --- |
| 1 | **`workspace_id` の migration が未生成だった**（生成済み・未コミット）。このまま出すと本番で配色の読み書きが落ちる | **最重** | §4.2 |
| 2 | **配色の保存と掲載の増減が操作の記録に届いていない。** 金銭に関わる変更が追えない | **最重** | §4.4 |
| 3 | **記事本文が読者に出ていない。** A5 / A12 の判定を 🟡 のままでよいか再判定する | 重 | §3.1 |
| 4 | 受入テスト 6 ファイルの種別名が `TEST_TYPES` に無い（`invariant` / `error`） | 中 | §4.3 |
| 5 | `BlogAppearancePort` の 4 手続きが読み書き判定表に無い | 中 | §4.4 |
| 6 | A4 の 404 は 12 経路。`legal_page` を読む経路だけが落ちている | 中 | §3.2 |
| 7 | 出典レジストリが空（候補 4 件はすべて原典未取得）。A14 の「充足」の意味を決める | 中 | §3.3 |
| 8 | `spec-freshness` の焼き付けが未実施 | 小 | §4.5 |

**1 と 2 は「出す前に直すもの」である。** 3 以降とは重さが違う。
