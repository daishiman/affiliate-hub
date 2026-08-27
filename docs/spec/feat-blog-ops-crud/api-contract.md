# 管理 API 契約

本 feature は **Server Action を正本の入口**とし、REST は置かない。
理由は既存の管理面と同じで、同じ操作に 2 つの入口があると
権限判定と監査記録が 2 か所に分かれ、片方だけ古くなる。

すべての操作は `UseCase<Input, Output>` を通り、
第一引数に `ActorContext` を取り、失敗を `Result<T, DomainError>` で返す (throw しない)。

## 決着: P05 仕様の「管理 API」条項との食い違い (2026-08-26)

P05 フェーズ仕様 (`.dev-graph/published/.../task-specs/phase-05-implementation.md`) の
37 行目は `src/app/api/admin/site-network`, `src/app/api/admin/blog` 配下に
管理 API を置くと書いている。**この文書 (api-contract.md) が正本で、置かない。**

- **なぜこちらが正本か。** フェーズ仕様は P01–P13 を機械が定型生成した雛形で、
  「API: applicable」は層の当たり判定であって設計判断ではない。
  設計判断は P02 (データモデルと API 契約の設計) の成果物、つまりこの文書で下す。
  P05 は P02 を `Consumed artifacts` に挙げている (54 行目)。**下流が上流を上書きしない。**
- **なぜ REST を置かないか。** 上に書いたとおり、同じ操作に入口が 2 つあると
  権限判定と監査記録が 2 か所に分かれる。片方だけ古くなった日に、
  古い方から権限を迂回できる。Server Action は入口が 1 つで、
  `ActorContext` を第一引数に強制できる。
- **published generation は書き換えない。** あれは digest で固定された記録で、
  中身を直すと「そのとき何を計画したか」が消える。食い違いは**ここに残す**のが正しい。
  計画と実装が違った事実そのものが、次に同じ雛形を読む人への情報になる。
- **例外は 1 本だけある。** `src/app/api/dev-signin/route.ts` は手元で画面を見るための
  入口で、CRUD の口ではない。旗が 2 つ同時に立たないと存在しない
  (`tests/architecture/open-doors.test.ts` と `tests/infrastructure/dev-signin.test.ts` が固定)。

この決着を破って `src/app/api/admin/**` を足すと、
`tests/architecture/open-doors.test.ts` が「宣言のない開いた口」として落とす。
足すなら意図の宣言と `OPEN_DOORS_MAX_PUBLIC_BY_DECLARATION` の引き上げが要る
= diff に必ず残る。

## 操作一覧

| ユースケース | 入力 | 出力 | 権限 | 監査 |
|---|---|---|---|---|
| `listSiteNetwork` | `{}` | 節点一覧 + 親子の木 | `content.read` | — |
| `listDeletedSiteNetwork` | `{}` | 削除済み節点一覧 | `content.read` | — |
| `createSiteNetworkNode` | `{siteSlug, role, parentSlug, name, oneLine}` | 作った節点 | `site.manage` | `site_network.created` |
| `updateSiteNetworkNode` | `{nodeId, name?, oneLine?, position?, status?, parentSlug?}` | 変わった項目名 | `site.manage` | `site_network.changed` |
| `deleteSiteNetworkNode` | `{nodeId, reason}` | 論理削除した節点の名前。有効な子があれば全体を拒否 | `site.manage` | `site_network.deleted` |
| `restoreSiteNetworkNode` | `{nodeId}` | 復元した節点 | `site.manage` | `site_network.restored` |
| `readBlogLayout` | `{siteSlug}` | 枠 + 帯 + 配信部品 | `content.read` | — |
| `saveBlogLayoutSlot` | `{siteSlug, region, slotKey, title, body, position, enabled}` | 保存した枠 | `site.manage` | `blog_layout.changed` |
| `saveBlogLayoutBand` | `{siteSlug, band, title, enabled, position, itemLimit}` | 保存した帯 | `site.manage` | `blog_layout.changed` |
| `saveDeliveryPart` | `{siteSlug, part, enabled, note}` | 保存した部品 | `site.manage` | `blog_delivery.changed` |
| `checkBlogDelivery` | `{siteSlug, siteName, purpose, origin, basePath, emitLlmsTxt}` | 点検した 9 件 + 欠けた部品 | `site.manage` | `blog_delivery.checked` |
| `listBlogArticles` | `{siteSlug?}` | 記事一覧 (型・状態・鮮度・評価) | `content.read` | — |
| `getBlogArticle` | `{articleId}` | 記事 + ブロック + タグ | `content.read` | — |
| `createBlogArticle` | `{siteSlug, slug, template, title, lead, authorName}` | `articles` に作成した記事 | `content.write` | `blog_article.created` |
| `updateBlogArticle` | `{articleId, ...}` + `blocks` + `tagIds` | `articles` で変わった項目名 | `content.write` | `blog_article.changed` |
| `deleteBlogArticle` | `{articleId, reason}` | `articles.deleted_at` を設定した記事 | `content.write` | `blog_article.deleted` |
| `restoreBlogArticle` | `{articleId}` | `articles.deleted_at` を解除した記事 | `content.write` | `blog_article.restored` |
| `listFixedPages` | `{siteSlug}` | 固定ページ 8 種と未作成数 | `content.read` | — |
| `listDeletedFixedPages` | `{siteSlug}` | ID・title・body・status を保った削除済み一覧 | `content.read` | — |
| `saveFixedPage` | `{siteSlug, kind, title, body, status}` | 保存した kind。削除済み行は暗黙復活しない | `site.manage` | `blog_page.changed` |
| `deleteFixedPage` | `{siteSlug, kind, reason}` | 論理削除した kind | `site.manage` | `blog_page.deleted` |
| `restoreFixedPage` | `{siteSlug, pageId}` | 元の内容で明示復元した固定ページ | `site.manage` | `blog_page.restored` |
| `listBlogTags` / `saveBlogTag` / `deleteBlogTag` | | | `content.read` / `content.write` | `blog_tag.changed` / `blog_tag.deleted` |
| `evaluateBlogArticles` | `{siteSlug?}` | 記事ごとの平均評価・件数・鮮度・適合 | `content.read` | — |
| `submitArticleRating` | `{siteSlug, articleSlug, readerKey, score, comment}` | 反映後の平均と件数 | 読者 (権限不要) | — |

## 断り方

- 権限不足: `FORBIDDEN`。必要な capability を `suggestedAction` に出す。
- 見つからない: `NOT_FOUND`。
- 入力不正 (score が 1–5 の外、template が T1–T4 の外、必須ブロック欠け): `VALIDATION_FAILED`。
- 保存先の不調: `UPSTREAM_UNAVAILABLE` (`storageFailure()` の 1 か所だけで作る)。

## 閲覧者評価だけが違う点

読者経路なので `ActorContext` は `readerActorForSite()` の確かめていない身元になる。
評価は**書ける口**なので、記事の本文へ触れる口とは別のポートに分ける。
同じポートに混ぜると、読者からの要求で記事を書き換える経路が型の上で作れてしまう。

## 配信の点検だけが違う点

`checkBlogDelivery` は**保存の口と分けてある。**保存のついでに点検すると
「保存したから緑」になり、点検が保存の言い換えになる。押した時刻の結果が
1 件ずつ残ることに意味があるので、押す口も別にする。

`origin` は**届いたリクエストから作る** (`headers()` の `host` と
`x-forwarded-proto`)。sitemap / RSS の口と同じ規則で、環境変数に持つと
開発と本番で違う住所を点検したまま緑になる。`host` が無ければ断る。

戻りは `{checked, missing}` の 2 つで、`missing` は**入になっていて通らなかった
部品だけ**を数える。切ってある部品は欠落に数えない (出さない設定なのだから)。
