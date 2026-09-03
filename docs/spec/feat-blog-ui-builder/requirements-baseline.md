# 要求ベースライン（feat-blog-ui-builder / P01）

> **実装前 snapshot:** 本文の「現状」「未接続」「死蔵」は 2026-08-30 の着手前観測である。
> 受入条文は維持するが、現在の合否・正本判断は
> [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本) を参照する。

記録日: 2026-08-30
graph_node_id: `SYS-BLOG-UI-BUILDER-P01`
Beads: `ah-45ba.1`
source_feature_digest: `sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b`

## この文書の役割

`features/feat-blog-ui-builder.context.json` の `acceptance` 14 件を、**実装着手前に一意で検証可能な形へ落とす**。
各受入について「何が成立していれば合格か」を、既存コードの実在する場所へ接地させて書く。

先行する MVP スライス（Beads `ah-6lf`、`docs/spec/feat-blog-ui-builder/final-review.md`）は
SEO / AI 検索だけを実装し、A1〜A9 を「未充足」と自己申告して終わっている。
本ベースラインはその申告を**コードの実測で置き換える**。判定が変わったものは根拠を併記する。

## 用語の二重化について（先に潰すべき前提）

本 feature には、同じものを指す名札が 2 系統ある箇所が 3 つある。
**この解消を先に決めないと、受入の合否が数え方で変わる。**

| # | 二重化しているもの | 系統 A | 系統 B | 影響する受入 |
|---|---|---|---|---|
| V1 | 記事内の表現ブロック | `EXPRESSION_BLOCK_KINDS` 10 種<br>`src/domain/authoring/blog-template.ts:43-54`<br>（**導出専用・永続化されない**） | `ARTICLE_BLOCK_KINDS` 15 種<br>`src/domain/blogops/blueprint-parts.ts:122`<br>（**`blog_article_block` へ永続**） | A5・A12 |
| V2 | 固定ページの種別 | `FIXED_PAGE_KINDS` 8 種<br>`src/domain/blogops/fixed-page.ts:7-16` | `SITE_DOCUMENT_KEYS`<br>（`site_documents` 系） | A4 |
| V3 | 配色の持ち方 | `blog_theme` + `page_theme_override`<br>`src/db/schema.ts:2244,2261`（**未接続**） | `site_blueprints.theme`<br>`src/presentation/site/page-frame.tsx:113-114`（**実運用**） | A2・A8 |

`src/db/schema.ts:2285` 付近のコメントは V2 の危険を自ら明記している。
**V1〜V3 の正本決定は P02（データモデル・契約設計）の入口条件とする。**

## 死蔵テーブルの所在

migration `drizzle/0022_neat_virginia_dare.sql` は 6 表を追加したが、
うち 4 表は `src/db/schema.ts` **以外のどこからも参照されていない**。

| テーブル | schema 定義 | Port | UseCase | 画面 | 状態 |
|---|---|---|---|---|---|
| `blog_template` | `src/db/schema.ts:2226` | なし | なし | なし | **死蔵** |
| `blog_theme` | `src/db/schema.ts:2244` | なし | なし | なし | **死蔵** |
| `page_theme_override` | `src/db/schema.ts:2261` | なし | なし | なし | **死蔵** |
| `blog_affiliate_placement` | `src/db/schema.ts:2321` | なし | なし | なし | **死蔵** |
| `legal_page` | `src/db/schema.ts:2285` | `src/application/ports/blog-ops.ts:208-215` | `src/application/usecases/blog-ops/manage-blog-pages.ts` | `/admin/blog/pages` | 接続済み |
| `guideline_references` | `src/db/schema.ts:2342` | `src/application/ports/guideline-reference.ts:18-66` | `src/application/usecases/seo/manage-guideline-references.ts` | `/admin/settings/seo` | 接続済み |

**この 4 表が feat-blog-ui-builder の主要な欠落そのものである。**
A1・A2・A6・A7・A8 の未達はすべてここに帰着する。

## 受入 A1〜A14 の検証可能化

各行の「検証手段」は、後続 P04（テスト設計）が 1 対 1 で受け取る契約である。

### A1 テンプレート 6 種の選択と差し替え

> テンプレート 6 種のいずれかを選んで新規ブログを作成でき、作成後もテンプレートを差し替えても既存記事が壊れない

- **現状**: 部分的。カタログ `BLOG_TEMPLATE_IDS`（review_focus / comparison_focus / howto / news / minimal / gadget）が `src/domain/authoring/blog-template.ts:11-18`、実体 `BLOG_TEMPLATES` が `:108` にある。表 `blog_template` は `src/db/schema.ts:2226`。**Port・UseCase・repository・画面がすべて無い。**
- **合格条件**
  - A1-1 `/admin/sites/new` の作成導線でテンプレート 6 種が可視ラベルで選択でき、選択が `blog_template` へ永続する
  - A1-2 既存ブログのテンプレートを別の 1 種へ差し替えたあと、その ブログの既存記事が**すべて 200 で描画され続ける**
  - A1-3 差し替えで記事本文（`blog_article_block` の行）が削除・改変されない
- **検証手段**: 単体（`orderBlocksForTemplate` の並べ替えが 6 種すべてで全ブロックを保持する）／結合（テンプレート更新 usecase → D1 → 再読込で値が一致）／E2E（差し替え前後で記事ページの見出しが一致）
- **非対象**: テンプレートの新規作成・自由編集（`scope_out` の「管理画面全体の単一用途画面再編」に隣接するため 6 種固定）

### A2 配色 2 層と上書き解除

> ブログ既定の配色を選べ、任意のページで配色を上書きでき、上書きを外すとブログ既定に戻る

- **現状**: 部分的。純関数 `resolvePageTheme` が `src/domain/authoring/blog-template.ts:228` に既にある。表 `blog_theme`(`:2244`) / `page_theme_override`(`:2261`) もある。**どちらも未接続で、実運用の配色は `site_blueprints.theme` の 1 層のみ**（`src/presentation/site/page-frame.tsx:113-114`）。
- **合格条件**
  - A2-1 ブログ既定の配色（`brand_theme` と `color_mode`）を管理画面から選べ、`blog_theme` へ永続する
  - A2-2 任意のページパスに対して上書きを作れ、`page_theme_override` へ永続する
  - A2-3 **上書きを外すと行が消え、ブログ既定へ戻る**（「上書き無し＝行の不在」を維持する。NULL 行を残さない）
  - A2-4 公開面が V3 の正本側から配色を読む（`site_blueprints.theme` との二重管理を残さない）
- **検証手段**: 単体（`resolvePageTheme` の境界: 上書きあり／片側だけ上書き／上書き無し）／結合（解除で行が物理削除される）／E2E（同一ブログの 2 ページで配色が異なる）
- **境界値**: `brand_theme` のみ上書き・`color_mode` のみ上書きの片側ケース

### A3 sticky 常時表示と狭幅の折りたたみ

> 公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、狭幅ではサイドバーが折りたたまれる

- **現状**: 部分的。**サイドバーのみ** sticky（`src/presentation/ui/templates/site.module.css:982` `.siteAsideSticky`、`:633` `.tocSidebar`、狭幅の折りたたみは `:990` の `@media (width < 64rem)`）。`.siteHeader` は `position: relative`（`:34-39`）、`.siteFooter`（`:297`）も sticky ではない。
- **合格条件**
  - A3-1 ヘッダーがスクロール中も視野内に留まる
  - A3-2 フッターの扱いを決めて実装する（常時表示するのか、末尾固定なのか。**要求文の「常時表示」が 3 領域すべてに掛かるかを P02 で確定する**）
  - A3-3 幅 375px でサイドバーが折りたたまれ、折りたたみ後も中身へ到達できる（到達手段が消えない）
  - A3-4 sticky にした結果、本文の可読領域が狭幅で不足しない
- **検証手段**: 単体（CSS モジュールのクラス契約）／E2E（desktop 1280px と mobile 375px の 2 プロジェクトで、スクロール後もヘッダーのアクセシブル名が見える）
- **未確定**: A3-2 のフッター解釈。`system-spec/ui-ux.md` の `qa-uiux-web-blog-builder` を P02 で再読して確定する

### A4 固定ページ 6 種の CRUD

> 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの 6 ページを管理画面から作成・編集・公開できる

- **現状**: **実装済み。** 語彙 `FIXED_PAGE_KINDS` 8 種が `src/domain/blogops/fixed-page.ts:7-16`、Port が `src/application/ports/blog-ops.ts:208-215`、UseCase が `src/application/usecases/blog-ops/manage-blog-pages.ts:74,135,174,254,313`、D1 が `src/infrastructure/persistence/d1/blog-ops-repository.ts:997-1114`、画面が `/admin/blog/pages` と `/admin/sites/[site]/documents`、公開が `src/app/s/[site]/[fixedPage]/page.tsx`。
- **残る問題**: V2 の名札二重化。要求は 6 種だが実装語彙は 8 種（`review_guidelines` と `company` が余剰）。
- **合格条件**
  - A4-1 要求の 6 種すべてが作成・編集・公開できる（既に成立の見込み。**回帰として固定する**）
  - A4-2 V2 を解消し、固定ページの名札が 1 系統になる
  - A4-3 要求 6 種と実装 8 種の差（`review_guidelines`・`company`）の扱いを明記する（削除するのか、6 種の外側として残すのか）
- **検証手段**: 結合（6 種の CRUD 往復）／E2E（`/admin/blog/pages` から作成 → `/s/{site}/{fixedPage}` で 200）

### A5 記事内表現ブロックとスロット差し替え

> 記事内で図解・比較表・CTA・要約・スペック表のブロックを挿入でき、ガジェット依存部分はスロット差し替えで別カテゴリでも再利用できる

- **現状**: 部分的。型は `EXPRESSION_BLOCK_KINDS` 10 種（`src/domain/authoring/blog-template.ts:43-54`）に揃っているが、**`fillSlots`（`:196`）の呼び出しが 0 件**。永続は別語彙の `ARTICLE_BLOCK_KINDS` 15 種。`figure`（図解）は `src/application/seo/expression-blocks.ts:21` が自ら「未接続」と書いている。
- **合格条件**
  - A5-1 要求の 5 種（図解・比較表・CTA・要約・スペック表）を記事編集画面から挿入でき、**永続する**
  - A5-2 `fillSlots` が実際の描画経路から呼ばれ、`BlockSlot`（name + fallback、`:76`）の差し替えが効く
  - A5-3 スロットを差し替えた同一ブロックが、別カテゴリの記事で再利用でき、fallback が効く
  - A5-4 V1 を解消し、表現ブロックの語彙が 1 系統になる
- **検証手段**: 単体（`fillSlots` の差し替えと fallback）／結合（挿入 → D1 → 公開面で描画）／E2E（記事編集で挿入し公開面に出る）
- **これが本 feature で最も実装量が大きい**

### A6 ブログごとの掲載アフィリエイト一覧

> 管理一覧でブログごとの掲載アフィリエイトが一覧でき、アフィリエイトから掲載ブログ/ページへ逆引きできる（前半）

- **現状**: **未着手。** 表 `blog_affiliate_placement`（`src/db/schema.ts:2321`、列は workspace_id / site_slug / article_slug / placement / tracking_code / position）のみ。Port・UseCase・画面すべて無い。ドメイン型も `src/domain/monetization/` に無い。
- **合格条件**
  - A6-1 ブログを 1 つ選ぶと、そのブログに掲載中のアフィリエイトが記事単位で一覧できる
  - A6-2 一覧に `placement`（掲載位置）と `tracking_code` が出る
  - A6-3 掲載が 0 件のブログで空状態が壊れずに出る
- **検証手段**: 結合（placement 保存 → 一覧 usecase が返す）／E2E（管理一覧に出る）
- **境界値**: 掲載 0 件・同一記事に複数 placement

### A7 アフィリエイトからの逆引きと保存前後の一致

> アフィリエイトから掲載ブログ/ページへ逆引きできる／作成・保存・公開面の各面で当該ページに反映されているアフィリエイトが表示され、保存前後で表示が一致する

- **現状**: **未着手。** `affiliate_links`（`src/db/schema.ts:1569`）に記事を指す列が無く、逆引きの経路が構造的に存在しない。
- **合格条件**
  - A7-1 アフィリエイト 1 件から、掲載しているブログと記事の一覧へ辿れる
  - A7-2 記事の**作成画面・保存後・公開面**の 3 面で、その記事に反映されているアフィリエイトが同じ集合として表示される
  - A7-3 保存の前後で表示が一致する（保存で消えたり増えたりしない）
- **検証手段**: 結合（逆引き usecase）／E2E（3 面の表示集合を突き合わせる）
- **依存**: A6 の placement モデルが先に要る
- **非対象**: アフィリエイト URL の登録・商品識別・クリック計測（`scope_out`）

### A8 配色・テンプレート・固定ページの D1 永続化

> 配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、再読み込み後も保持される

- **現状**: 部分的。**固定ページのみ**永続化済み。配色・テンプレートは表があるだけで書き込む経路が無い。
- **合格条件**
  - A8-1 配色（A2）・テンプレート（A1）・固定ページ（A4）の 3 種すべてが D1 へ永続する
  - A8-2 再読み込み後も値が保持される
  - A8-3 V3 を解消し、配色の正本が 1 か所になる
- **検証手段**: 結合（3 種それぞれで書き込み → 新しい接続で読み直し → 一致）
- **注**: A8 は A1・A2・A4 の従属受入であり、独立した実装対象ではない

### A9 axe-core 重大違反 0 件と light/dark コントラスト

> 公開面のレイアウト・配色は axe-core の重大違反 0 件で、light/dark 両方で本文コントラストが基準を満たす

- **現状**: 検査基盤は実装済み（`tests/ui/blog-ops-a11y-floor.test.tsx`、`tests/ui/theme-contrast.test.ts`、`tests/ui/axe-blind-spots.test.ts`、`tests/ui/axe-rule-coverage.test.ts`、共通 `tests/support/a11y.ts`）。
- **ただし** `tests/ui/blog-ops-a11y-floor.test.tsx:16` の条文が「A14」と書かれており、**受入番号の対応がずれている**（あちらは feat-blog-ops-crud の A14）。
- **合格条件**
  - A9-1 A1〜A8 で新規追加した画面が axe-core 重大違反 0 件
  - A9-2 light / dark 両方で本文コントラストが基準を満たす
  - A9-3 受入番号の参照が本 feature の A9 を指すよう修正される
- **検証手段**: 既存の a11y 検査基盤へ新規画面を追加する
- **注**: MVP スライスでは「visual ゲートは外す」として未実施だった（`final-review.md`）。**本 feature では外さない。**

### A10 記事 HTML のメタと JSON-LD

> 記事ページの HTML に本文・タイトル・description・canonical・OGP・JSON-LD (BlogPosting+BreadcrumbList、FAQ ブロックがあれば FAQPage) がサーバー側で含まれ、pure 関数の単体テストで検証できる

- **現状**: 部分的。生成関数は揃っている（`buildBlogPosting` `src/application/seo/structured-data.ts:58`、`buildBreadcrumbList` `:155`、`buildFaqPage` `:176`、メタは `src/presentation/site/site-metadata.ts:100-145`）。埋め込みも `src/presentation/site/article-page.tsx:141-200` にある。
- **しかし対象が `published_articles` 経路の 5 ルート（reviews / compare / best / guides / tools）だけで、`/s/[site]/blog/[article]` には `generateMetadata` も JSON-LD も無い。**
- **合格条件**
  - A10-1 `/s/{site}/blog/{article}` が `generateMetadata` を持ち、title / description / canonical / OGP を出す
  - A10-2 同ルートが BlogPosting + BreadcrumbList の JSON-LD をサーバー側で埋め込む
  - A10-3 FAQ ブロックがある記事は FAQPage も出す
  - A10-4 生成が pure 関数の単体テストで検証できる（既存 `structured-data.ts` の関数を再利用し、経路を増やさない）
- **検証手段**: 単体（pure 関数）／結合（ルートの HTML に `<script type="application/ld+json">` が含まれる）

### A11 sitemap / robots / feed / llms.txt

> `/s/{site}/sitemap.xml`・`robots.txt`・`feed.xml`・`llms.txt` が公開記事から自動生成され、robots.txt が GPTBot/ClaudeBot/PerplexityBot/Google-Extended を遮断しない

- **現状**: **実装済み。** 4 route（`src/app/s/[site]/{sitemap.xml,robots.txt,feed.xml,llms.txt}/route.ts`）と本体 `src/application/seo/feeds.ts`、共通ローダ `src/presentation/site/seo-routes.ts`。AI クローラー非遮断は `src/app/s/[site]/robots.txt/route.ts:11-12` と `buildRobotsTxt`。llms.txt は `blueprint.emitLlmsTxt` で出し分け（`llms.txt/route.ts:26-32`）。
- **合格条件**
  - A11-1 4 経路が 200 を返し、公開記事の増減が反映される（**回帰として固定する**）
  - A11-2 robots.txt が 4 つの AI クローラーを遮断しない
  - A11-3 A5 で表現ブロックが増えても sitemap の対象が壊れない
- **検証手段**: 既存検査の維持 + A5 実装後の回帰

### A12 SEO 標準ブロックと dateModified の可視化

> 記事に結論・要点・FAQ・出典・最終更新ブロックを挿入でき、公開面で最終更新日 (dateModified) が可視化される

- **現状**: 部分的。抽出は `src/application/seo/expression-blocks.ts:40`、`dateModified` は `structured-data.ts:86`、可視化は `src/presentation/ui/templates/article-view.tsx:186` と `src/presentation/site/blog-article-view.tsx:101`。
- **ただし A10 と同根で、ブログ記事経路の JSON-LD が無いため `dateModified` が構造化データに出ない。**また「挿入できる」（永続する）が A5 と同じく未達。
- **合格条件**
  - A12-1 結論・要点・FAQ・出典・最終更新の 5 種を記事編集画面から挿入でき、永続する
  - A12-2 公開面で最終更新日が可視のテキストとして出る
  - A12-3 `/s/{site}/blog/{article}` の JSON-LD に `dateModified` が入る
- **依存**: A5（挿入と永続）と A10（ブログ記事経路の JSON-LD）

### A13 IndexNow の鍵の扱い

> IndexNow 送信は鍵をサーバー環境変数からのみ読み、鍵未設定時は送信をスキップして記録に残す（鍵をリポジトリや管理画面に保存しない）

- **現状**: **実装済み。** `src/infrastructure/indexnow/indexnow-client.ts:38-45` が `env["INDEXNOW_KEY"]` を Worker env からのみ読み、未設定時は `{ status: "skipped", reason }` を返す。`:71-75` で鍵を伏せ字にする。呼び出しは `src/presentation/composition.ts:2121`。
- **残る問題**: 記録先が `src/presentation/admin/publish-article-action.ts:182-184` の `console.info({ event: "indexnow_publish" })` **のみで、永続的な監査ログではない**。「記録に残す」を満たすかは解釈次第。
- **合格条件**
  - A13-1 鍵がサーバー環境変数からのみ読まれる（**回帰として固定する**）
  - A13-2 鍵未設定時に送信がスキップされる（**回帰として固定する**）
  - A13-3 スキップが**後から確認できる形**で記録される（`console.info` で足りるか、`audit_log` へ書くかを P02 で確定する）
- **検証手段**: 単体（env 未設定でスキップ）／結合（記録先に行が残る）

### A14 ガイドライン出典レジストリと 90 日超の再確認

> 管理画面の参照レジストリで SEO/AI 検索ガイドラインの出典 (URL・発行元・確認日) を登録・一覧でき、確認日から 90 日超は再確認対象として表示される

- **現状**: **実装済み。** 表 `guideline_references`（`src/db/schema.ts:2342`）、ドメイン `src/domain/seo/guideline-reference.ts:11`（`REVIEW_INTERVAL_DAYS = 90`）と `:99`（`referenceReviewStatus`）、Port `src/application/ports/guideline-reference.ts:18`、UseCase `src/application/usecases/seo/manage-guideline-references.ts`、画面 `/admin/settings/seo`（`src/app/admin/settings/seo/page.tsx:57,113,229,236`）、テスト `tests/ui/guideline-reference-page.test.tsx`。
- **合格条件**
  - A14-1 URL・発行元・確認日を登録でき、一覧できる（**回帰として固定する**）
  - A14-2 確認日から 90 日超が再確認対象として表示される（**回帰として固定する**）
  - A14-3 90 日ちょうど / 91 日の境界が検査で固定される
- **検証手段**: 既存検査の維持 + 境界値の追加

## 受入の状態まとめ

| # | 受入 | 実測判定 | 主要な欠落 |
|---|---|---|---|
| A1 | テンプレート 6 種 | 部分的 | Port / UseCase / 画面（表は死蔵） |
| A2 | 配色 2 層 | 部分的 | Port / UseCase / 画面（表は死蔵）、V3 の二重管理 |
| A3 | sticky 常時表示 | 部分的 | ヘッダー・フッターが sticky でない |
| A4 | 固定ページ 6 種 | **実装済み** | V2 の名札二重化のみ |
| A5 | 表現ブロック | 部分的 | 永続経路と `fillSlots` の呼び出し、V1 の語彙二重化 |
| A6 | 掲載一覧 | **未着手** | すべて（表は死蔵） |
| A7 | 逆引きと 3 面一致 | **未着手** | すべて（`affiliate_links` に記事参照列が無い） |
| A8 | D1 永続化 | 部分的 | A1・A2 の従属 |
| A9 | axe / コントラスト | 基盤あり | 新規画面への適用、受入番号の参照ずれ |
| A10 | メタと JSON-LD | 部分的 | `/blog/[article]` 経路が丸ごと欠落 |
| A11 | sitemap 他 4 経路 | **実装済み** | 回帰維持のみ |
| A12 | SEO 標準ブロック | 部分的 | A5・A10 の従属 |
| A13 | IndexNow 鍵 | **実装済み** | 記録先の永続性が要確定 |
| A14 | 出典レジストリ | **実装済み** | 境界値の追加のみ |

実装済み 4 件 / 部分的 7 件 / 未着手 2 件 / 基盤あり 1 件。

## P02 へ渡す未確定事項

1. **V1**（表現ブロック語彙 10 種 vs 15 種）の正本をどちらにするか
2. **V2**（固定ページ名札 8 種 vs `SITE_DOCUMENT_KEYS`）の正本と、要求 6 種との差の扱い
3. **V3**（配色を `blog_theme` に持つか `site_blueprints.theme` に持つか）の正本
4. **A3-2** 「常時表示」がフッターにも掛かるかの解釈（`system-spec/ui-ux.md` の `qa-uiux-web-blog-builder` を再読）
5. **A13-3** IndexNow スキップの記録先（`console.info` か `audit_log` か）
6. **A7** の逆引きを `blog_affiliate_placement` だけで実現するか、`affiliate_links` 側にも列を足すか

## 参照

- 受入正本: `features/feat-blog-ui-builder.context.json` の `acceptance`
- 仕様: `system-spec/ui-ux.md`（`qa-uiux-web-blog-builder`）、`system-spec/frontend.md`（`qa-frontend-web-seo-ai-search-v2`）、`system-spec/database.md`
- アーキテクチャ: `architecture/arch-two-layer-platform.md`
- 先行 MVP の自己申告: `docs/spec/feat-blog-ui-builder/final-review.md`
- 画面棚卸し: [`screen-inventory.md`](./screen-inventory.md)
- 情報優先度: [`information-priority-map.json`](./information-priority-map.json)
