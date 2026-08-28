# T4 — 実装分解と検証対応

| 縦切り | 実装 | 検証 |
|---|---|---|
| 公開共通シェル | `SiteShell` / `SiteFrame` / `toChrome` | 全route描画、デザインtoken検査、a11y |
| ホーム・一覧 | `SiteHomeHero` / `CategoryDirectory` / `ArticleList` | 375/768/1280/1600 visual |
| 記事詳細 | `ArticleView` / `ArticleTableOfContents` / author card | PC sticky TOC、SP inline TOC、公開表記 |
| 新規作成導線 | `/admin/content/new` | 商品→生成→配信の到達可能性 |
| 公開済み一覧 | `/admin/content/published` / admin port list | 検索・状態絞り込み、テナント境界、SPカード化 |
| 訂正 | edit route / update action/use case / D1 replace | 理由必須、操作記録、下書き復元、非表示維持 |
| 非表示 | archive action/use case / `archived_at` | reader list/find/search/personから除外、adminに残存、見本へ逆戻り防止 |
| データ移行 | `0019_gentle_archive.sql` + snapshot/journal | migration freshness / D1 integration |
| 成果物 | `preview:static` の記事シェル | HTML生成、空描画検知 |

## 受け入れ順序

1. TypeScriptとESLintで入口・ポート・ルートの整合を確認する。
2. 公開UI、application use case、D1結合、route総当たりをfocused testで確認する。
3. `preview:static`で実部品と実CSSの静的HTMLを作る。
4. `next build`とCloudflare worker dry-runで生成・実行境界を確認する。
5. 375 / 768 / 1280 / 1600pxでシェル、目次、検索、一覧、編集の収まりを確認する。

公開、commit、push、remote migrationはこの実装範囲に含めない。
