# データモデル (migration 0023 以降)

canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`  
acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`

方針: 記事本体の canonical write model は既存 `articles` に一本化する。
`blog_article` は過渡表であり、P08 migration がデータを `articles` へ backfill した後に削除する。
`published_articles` は公開時の読み取り専用 snapshot であり、編集正本や dual-write 先として扱わない。

既存 AI コンテンツ行の `content_variants` / `publications` 外部キーと旧来列は維持する。
ブログ運用の付加属性は nullable 列とし、legacy AI 行に値を推測して埋めない。

すべての表は `workspace_id` を持ち、問い合わせは必ず where に置く (テナント境界)。
評価だけは読者が書く経路なので `workspace_id` を持たず、`article_id` を通じて所属が決まる。

## 1. `site_network_node` — サイト網の節点 (§1)

| 列 | 型 | 内容 |
|---|---|---|
| id | text PK | `snn_*` |
| workspace_id | text NOT NULL | テナント |
| site_slug | text NOT NULL | URL 名。`/s/<site_slug>` |
| role | text NOT NULL | `hub` / `sub` / `mini` |
| parent_slug | text NULL | 上位節点。`hub` は必ず NULL |
| name | text NOT NULL | 表示名 |
| one_line | text NOT NULL | 1 文説明 |
| position | integer NOT NULL | 並び |
| status | text NOT NULL | `active` / `hidden` |
| created_at / updated_at | integer | |

unique(`workspace_id`, `site_slug`) / index(`workspace_id`, `parent_slug`)

## 2. `blog_layout_slot` — ヘッダー・サイドバー・フッターの枠 (§3.1 / §3.4 / §3.5)

| 列 | 内容 |
|---|---|
| id / workspace_id / site_slug | |
| region | `header` / `sidebar` / `sidebar_sticky` / `footer` |
| slot_key | §3 の部品 id (`header-brand`, `site-search`, `legal-nav` …) |
| title / body | 見出しと本文 (自由 HTML 枠は body を使う) |
| position / enabled | 並びと有効可否 |

unique(`workspace_id`, `site_slug`, `region`, `slot_key`)

## 3. `blog_layout_band` — ハブトップの 4 帯 (§3.2)

`band` は `latest_posts` / `sister_sites` / `category_hub` / `navigator`。
`item_limit` で 1 帯に出す件数を持つ。unique(`workspace_id`, `site_slug`, `band`)

## 4. `articles` — 記事編集正本 (§4)

| 列 | 内容 |
|---|---|
| id | 既存 PK。`content_variants` / `publications` の FK を維持 |
| workspace_id / site_slug | ブログ行の tenant/公開 site。legacy AI 行は NULL |
| slug | 記事 URL 名。ブログ行は site 内で一意 |
| article_template | `T1` / `T2` / `T3` / `T4`。legacy AI 行は NULL |
| type | 既存列。ブログ保存時は domain SSOT で T1→`ranking`, T2→`review`, T3/T4→`guide` を導出 |
| title / lead / author_name | 題名・1 文要約・表示上の書き手 |
| status | 既存 `draft` / `review` / `published` / `archived` |
| deleted_at | NULL=有効、値あり=論理削除。復元は NULL へ戻す |
| published_at / updated_at | 公開時刻と鮮度の判定 |

ブログ adapter は `articles` のみを read/write し、`blog_article` へ dual-write しない。
`blog_article_block` / `blog_article_tag` / `blog_article_rating` は `articles.id` を親とする子データとして維持する。

## 5. `blog_article_block` — 記事本文の部品列 (§3.3)

`kind` は §3.3 の部品 id。`position` で並ぶ。通常の記事削除は `articles.deleted_at` を
設定するだけで、ブロック・タグ結合・評価は保持する。復元時は同じ ID・URL・
本文へ戻す。FK の cascade は通常の論理削除では発火しない。

## 6. `blog_tag` / 7. `blog_article_tag` — ブランドタグ (§3.4 `brand-tag-cloud`)

`blog_tag` は unique(`workspace_id`, `site_slug`, `slug`)。
`blog_article_tag` は (`article_id`, `tag_id`) の複合 PK。migration 0030 で
`article_id → articles.id` と `tag_id → blog_tag.id` の FK (どちらも
`ON DELETE CASCADE`) を持つ。記事保存は Port で tagIds の重複・不存在・
別 workspace・別 site を全件先に検証し、D1 batch 中の FK が検証後の
競合削除も検出する。違反時は記事本体・ブロック・既存タグ結合を
batch 全体でロールバックする。

| 列 | 内容 |
|---|---|
| id / site_slug / slug / name / description | |
| kind | `brand` (商品の作り手) / `topic` (記事のまとめ方)。既定 `topic` (migration `0027_careless_goliath`) |

**`brand-tag-cloud` に出るのは `kind='brand'` だけである。**
枠は読者に「これは商品の作り手だ」と言っているので、話題タグが混じると
枠そのものが嘘になる。絞る条件は `domain/blogops/blog-tag.ts` の
`brandTagCloud()` 1 か所にあり、画面ごとの `filter` としては書かない。
書き忘れた画面から非ブランドが漏れても**画面は正しく見える**ため、
気づく機会が無いからである。

**既定を `topic` にしたのは、間違え方が軽い側だから。**種類を足す前からある
タグはどちらとも分からない。既定を `brand` にすると枠が「これは作り手だ」と
嘘を言い、既定を `topic` にすると枠が寂しくなるだけで済む。
運営側の一覧 (`/admin/blog/tags`) は総数と別に**ブランドの件数**を出す。
総数だけだと「タグは 20 件あるのに枠は空」を、読者の画面を開くまで気づけない。

## 8. `blog_delivery_part` — 配信部品 9 種 (§6)

`part` は `canonical` / `og_twitter_meta` / `jsonld_website` / `jsonld_article` /
`jsonld_collection` / `rss_feeds` / `sitemap_index` / `llms_txt` / `robots`。
unique(`workspace_id`, `site_slug`, `part`)

### 8-2. `blog_delivery_snapshot` — 点検した結果 (canonical A9)

| 列 | 内容 |
|---|---|
| id | 1 回の点検の 1 部品ぶん |
| workspace_id / site_slug | |
| part | 上と同じ 9 種 |
| ok | 組み立て / 材料の確認が通ったか |
| detail | 何を見たかの 1 文 (日本語) |
| checked_at | 点検した時刻。1 回の点検の 9 行は同じ値を持つ |

**設定表 (`blog_delivery_part`) と別の表にしてある。**1 つに畳むと、設定を保存した
ときに結果まで書き換わり、「いつの結果か」が言えなくなる。設定は「出す / 切る」の
意思で、結果は「出せた / 出せなかった」の観測であり、書き換わる理由が違う。

**unique 制約を置かず、`onConflictDoUpdate` も使わない。**点検は履歴として積むもので、
上書きにすると「いつ壊れたか」が 1 件ずつ静かに消える。一覧
(`/admin/blog/delivery`) は部品ごとに `checked_at` の最新 1 件だけを採る。

読み出し側の状態は 4 値 (`ok` / `missing` / `unchecked` / `off`) で、
**`unchecked` を `ok` に畳まない** (`src/domain/blogops/delivery-snapshot.ts`)。
見ていないことは、良いことでも悪いことでもなく見ていないとしか言えない。

## 9. `blog_article_rating` — 閲覧者評価 (§3.3 評価部品)

| 列 | 内容 |
|---|---|
| id / article_id | |
| reader_key | 閲覧者の識別。個人を特定する値は入れない (cookie 由来の不透明な鍵) |
| score | 1–5 の整数 |
| comment | 任意。空文字は NULL |
| hidden | 運営が伏せた印。既定 `false` (migration `0026_black_vargas`) |
| created_at | |

unique(`article_id`, `reader_key`) — 同じ閲覧者の再送は置き換え (`REQ-BOPS09`)。

**`hidden` は列であって、削除ではない。**運営が読者の書き込みを見えなくするとき、
行は残して印だけを付け替える。消す形にすると「伏せた」と「最初から無かった」が
同じ姿になり、伏せた判断そのものを後から確かめられない。
読者側の平均と件数は `hidden=false` だけを数え、運営側の 1 件ずつの画面
(`/admin/blog/evaluate/[article]`) は伏せたものも返す。
付け替えは監査に `blog_rating.hidden` / `blog_rating.shown` として残り、
**どちらも理由が必須**である (`REASON_REQUIRED`)。戻す側も必須にしているのは、
理由を言わずに伏せた判断を覆せると、伏せた判断が黙って消えるため。

## 固定ページ 8 種

`legal_page.kind` を 6 種から 8 種へ広げる (`all_authors`, `disclaimer` を追加)。
SQLite に列挙型は無く、Drizzle の `enum` は TypeScript 側の制約なので
**列の作り直しは要らない**。既存行は影響を受けない。
