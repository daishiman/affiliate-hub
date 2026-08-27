# コンポーネント契約

## 管理面

既存の骨格をそのまま使う。新しい枠を作らない。

- `AdminShell routeId title lead actions` — パンくず・見出し・戻り先の正本。
- `Section` / `ListView` / `EmptyView` / `ErrorView` / `Callout` / `StorageNotice` — 状態表示。
- 入力は `useActionState` を使うクライアント部品 + `"use server"` のアクション、という
  既存 (`site-form.tsx` / `site-form-action.ts`) と同じ 2 ファイル構成。
  `"use server"` のファイルは非同期関数しか外へ出せないため、状態の型は `*-state.ts` へ置く。

新設する部品:

| 部品 | ファイル | 役割 |
|---|---|---|
| `SiteNetworkForm` | `src/presentation/admin/site-network-form.tsx` | 節点の作成・更新 |
| `BlogLayoutForm` | `src/presentation/admin/blog-layout-form.tsx` | 枠・帯・配信部品の保存 |
| `BlogArticleForm` | `src/presentation/admin/blog-article-form.tsx` | 記事の作成・更新 (ブロック列を含む) |
| `BlogPageForm` | `src/presentation/admin/blog-page-form.tsx` | 固定ページ 8 種 |
| `BlogTagForm` | `src/presentation/admin/blog-tag-form.tsx` | ブランドタグ |

`AdminRouteId` は `ADMIN_ROUTE_DEFINITIONS` のキーの集合なので、
新しい route を足すときは同ファイルへ 1 行足す。足さないと型検査が止める
(パンくず・サイドバー・分類が同時に増える仕組みのため)。

## 公開面

- `SiteFrame siteSlug currentPath pageKind` — 既存の枠。ヘッダー / サイドバー / フッターは
  レイアウト設定 (`blog_layout_slot`) を読んで並べる。設定が無い枠は**出さない** (`REQ-BOPS03`)。
- `ReaderRatingForm` — `src/presentation/site/reader-rating-form.tsx`。
  1–5 の選択と任意の一言。送信は `"use server"` のアクション経由で、
  読者の識別は cookie の不透明な鍵 (`rk`) を使う。個人を特定する値は保存しない。

## 出さない条件

| 条件 | 画面の振る舞い |
|---|---|
| 保存先 (D1) が無い | `StorageNotice` を出す。黙って見本へ落ちない (`REQ-BOPS12`)。 |
| 枠が無効 (`enabled=false`) | その枠を描かない。空の見出しも出さない。 |
| 配信部品が無効 | `feed.xml` / `sitemap.xml` / `llms.txt` / JSON-LD をその分だけ出さない (`REQ-BOPS08`)。 |
| 評価が 0 件 | 「まだ評価がありません」と出す。平均 0 と書かない。 |
