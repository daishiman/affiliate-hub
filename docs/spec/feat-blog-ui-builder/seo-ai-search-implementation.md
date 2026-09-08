# feat-blog-ui-builder — SEO / AI 検索対応の実装記録

更新日: 2026-08-24

仕様反映の受領: [`spec-writeback-receipt.md`](./spec-writeback-receipt.md)。最終レビュー: [`final-review.md`](./final-review.md)。

## 目的

読者向けブログを従来 SEO と AI 検索 (AI Overviews / AI Mode / ChatGPT search / Perplexity 等)
の両方から見つけられ・引用されやすくする。画面描画と機械向け出力は
同じ読み取りモデル (`PublishedArticle` / `PublicSiteBlueprint`) から派生させ、食い違いを型で防ぐ。

## 配信ルート (公開・認証なし)

| パス | 生成元 | 備考 |
|---|---|---|
| `/s/{site}/sitemap.xml` | `buildSitemapXml` | 公開記事の `articleHref` から。`force-dynamic` |
| `/s/{site}/robots.txt` | `buildRobotsTxt` | AI クローラ (GPTBot/ClaudeBot/PerplexityBot/Google-Extended) を遮断しない。Sitemap 行付き |
| `/s/{site}/feed.xml` | `buildRssXml` | RSS 2.0 |
| `/s/{site}/llms.txt` | `buildLlmsTxt` | `blueprint.emitLlmsTxt=false` なら 404 (設計図の任意項目。効果は未確認と管理画面に明記) |

- 実装: `src/app/s/[site]/{sitemap.xml,robots.txt,feed.xml,llms.txt}/route.ts` + `src/presentation/site/seo-routes.ts`
- 公開ルート台帳: `tests/architecture/open-doors.test.ts` に intent「誰でも」で 4 件登録、上限 26→30 (`quality-gates.config.mjs`)

## 構造化データ・メタデータ

- `src/application/seo/structured-data.ts`: `buildBlogPosting` / `buildBreadcrumbList` / `buildFaqPage` (0 件は null) / `serializeJsonLd` (`<`→`\u003c` で script 挿入 XSS 封じ)
- 記事ページ (`src/presentation/site/article-page.tsx`) がサーバー側で JSON-LD 2 本 (BlogPosting + BreadcrumbList) を埋め込む。origin は `headers()` の x-forwarded-host/proto から
- `generateMetadata`: `src/presentation/site/site-metadata.ts` (`siteHomeMetadata` / `articleMetadata`) をトップ + 記事 5 種 (best/reviews/compare/guides) に配線。tools/[tool] は reader tool 定義から生成
- `dateModified` の可視化: `article-view.tsx` の更新履歴を `<time dateTime>` 化

## AI 引用されやすい記事構造 (標準ブロック)

`src/domain/authoring/blog-template.ts`:
- 表現ブロック 10 種のうち前半 5 種が AI 構造: `answer` (結論先出し) / `key_points` / `faq` / `sources` (checkedAt 付き) / `freshness`
- 全テンプレート 6 種の `articleBlockOrder` が answer/key_points を先頭、faq/sources/freshness を末尾に固定
- `orderBlocksForTemplate` はブロックを 1 つも落とさない (テンプレート差し替えで記事が壊れない)

## IndexNow

- `src/domain/seo/indexnow.ts` (本文の形) + `src/infrastructure/indexnow/indexnow-client.ts` (送信)
- 鍵は Worker 環境変数 `INDEXNOW_KEY` からのみ。リポジトリ・管理画面・DB に保存しない。戻り値・ログ・例外に鍵を入れない
- 鍵未設定は `{status:"skipped", reason}` を返す (黙って何もしない、ではない)。送信失敗は throw しない (通知は公開の条件ではない)
- Google は IndexNow 非対応 (Bing 系 = ChatGPT search 基盤に有効)。コストほぼゼロのため既定 ON

## 参照レジストリ (guideline_references)

- スキーマ: `src/db/schema.ts` `guidelineReferences` (workspaceId/title/url/publisher/region global|jp/checkedAt/note)
- `src/domain/seo/guideline-reference.ts`: `REVIEW_INTERVAL_DAYS=90`、`referenceReviewStatus()`、初期データ `INITIAL_GUIDELINE_REFERENCES`
- **注記**: 公式 4 出典 (Google AI 最適化ガイド / AI features / llms.txt / IndexNow) は本セッションで WebFetch 不在・curl 不許可のため全文の機械取得はできず、WebSearch で存在・発行元・要旨・鮮度を確認して「本文全文は未取得」注記付きで初期データに登録 (2026-08-24)。管理画面の 90 日再確認フローで追跡する
- **WebSearch 検証結果 (2026-08-24)**: Google の AI 最適化ガイドの正式 URL は `https://developers.google.com/search/docs/fundamentals/ai-optimization-guide` (2026-05-15 公開)。同ガイドで Google は **llms.txt を使用しない**と明言し、AI Overviews / AI Mode に追加の技術要件を課さない。IndexNow は Bing/Yandex/Naver 参加・Google 非対応で、鍵ファイルのホスト公開配信が所有権検証 (`/indexnow.txt` 配信ルートを実装済み。keyLocation はドメイン層で固定)

## AI 検索監査

- `src/application/seo/ai-search-audit.ts`: `auditArticleForAiSearch` (要約 50〜160 字、answer/sources/freshness の有無等を判定)。管理画面のチェックパネルから利用

## 検証

- `pnpm run typecheck` exit 0 / `pnpm vitest run tests/application/seo tests/architecture/open-doors.test.ts` → 41 tests PASS (2026-08-24)
- migration: `drizzle/0022_neat_virginia_dare.sql` (6 テーブル)
