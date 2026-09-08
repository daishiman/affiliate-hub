# 移行報告 (P08)

更新日: 2026-09-01

local implementation status: **complete**

local implementation validation: **GREEN**

remote migration status: **not_applied**

rollout status: **in_progress**（実ドメイン・wildcard route・proxied DNS 証跡待ち）

## 現行の決着: `articles` が唯一の編集正本

- `drizzle/0029_dashing_gamma_corps.sql`: 統合前の `blog_article` と `site_network_node` に `deleted_at` を追加
- `drizzle/0030_unify_blog_article_ssot.sql`: `articles` にブログ属性を追加し、`blog_article` 全行を ID 維持で backfill した後に過渡表を DROP
- `drizzle/0031_publish_fixed_pages.sql`: 固定ページの公開状態・論理削除と canonical kind への移行
- `drizzle/0032_square_wolfpack.sql`: `blog_article_tag` から `articles` / `blog_tag` へ
  `ON DELETE CASCADE` FK を追加

0028 は T1→`ranking`, T2→`review`, T3/T4→`guide` を domain mapping と同じ対応で backfill し、ステータス・公開時刻・論理削除時刻・作成更新時刻を保持する。legacy AI 行のブログ属性は推測せず NULL のまま保つ。`content_variants` / `publications` の `articles.id` 参照は維持する。

ブログ D1 adapter は `articles as blogArticles` を通じて本体を read/write し、`blog_article` へ dual-write しない。用途別の `/admin/content/**` と `/admin/blog/**` は入口を分けたまま、本体の永続正本だけを共有する。`published_articles` は公開read projection であり編集正本ではない。

## 0042 公開 projection 一本化 (2026-09-01、ローカル実装・検証完了)

今回の監査で、編集正本の一本化後も公開経路が二系統残っていることが分かった。
`/blog`・構成件数・評価は `articles`、型別記事・検索・人物・SEO・feed は
`published_articles` を読んでおり、同じ site で一覧と本文の集合が一致しない。

是正方針は次のとおり。

- `articles`: 編集 aggregate、revision/CAS、論理削除、評価の親 ID
- `published_articles`: 唯一の canonical public projection
- `source_article_id`: ブログ運用由来 projection と既存 `articles.id` の追跡
- 公開・更新・非公開化・削除: 編集 aggregate と projection を同一 D1 batch で更新
- AI/BlogOps の同一 URL 並行公開: source 不一致を DB 内 guard で検出し、競合側の
  aggregate・本文・projection を batch 全体で rollback
- 公開 reader: `PublishedContentPort` へ統合し、`articles` 直読・sample fallback・union を禁止
- 配信診断: `articles.status` ではなく実際の canonical public projection だけを点検
- URL: `articleHref` を単一定義とし、旧 `/blog/:slug` は 308 redirect

既存データは物理削除せず、add-only / idempotent / fail-closed の forward migration で
補完する。所有者不一致や曖昧な identity は推測で修正しない。

`drizzle/0042_canonical_public_articles.sql` と正規 snapshot
`drizzle/meta/0042_snapshot.json` を追加した。次回の Drizzle generate は差分 0、
`drizzle-kit check` も PASS している。remote D1 には適用していないため、ローカル実装の
完了と rollout 完了を同一視しない。

0030 は表の作り直し前に、結合先の不存在と workspace/site 不一致を
CHECK guard で fail-fast する。不整合行をフィルタして無断削除はしない。移行末尾で
`PRAGMA foreign_key_check` を実行し、D1 統合検査も違反 0 件を確認する。

ローカル検証（2026-09-01）:

- canonical public projection 対象: 10 files / 318 tests PASS
- 旧 FAIL の再検証: 15 files / 2,543 tests PASS
- 全回帰: 435 files / 10,194 tests PASS
- system-spec architecture: 6 files / 182 tests PASS
- TypeScript: PASS
- ESLint: 0 errors（既存 `stryker.config.mjs` warning 1）
- Next.js production build / OpenNext Cloudflare build: PASS
- production dependency audit: 既知脆弱性 0
- Worker gzip: 2,990 KiB / 3,072 KiB（PASS、残り 82 KiB のため容量リスクあり）
- Drizzle snapshot/check: PASS、次回 generate 差分 0
- traceability: 435 / 435 test files に由来あり
- acceptance reconciliation: 10 IDs / 201 evidence files PASS

P07/P09 を含むローカル実装・検証は完了した。remote D1 適用、deploy、実ドメイン、
wildcard route、proxied DNS の確認は未実施であり、rollout の `completion_evidence` は
in_progress を維持する。

published generation は digest で固定した監査履歴のため書き換えない。以下の別表方針は 2026-08-26 の過去判断として保持するが、現行仕様に使用しない。

## Historical snapshot (superseded; audit only)

> 以下の別表判断と実測値は現行 P08 の完了証明に使用しない。

## 決着: フェーズ仕様の「単一テーブルへ統合」条項 (2026-08-26)

P08 のフェーズ仕様 (`.dev-graph/published/.../task-specs/phase-08-refactoring-migration.md`) は
既存 `articles` と本 feature の `blog_article` を「後方互換 migration で単一テーブルへ統合」せよ
と書いている。**統合しない。**

- **なぜ統合しないと決められるか。** 上流の `migration-plan.md` (P02 の成果物) が
  「既存 `articles` 表は触らない」を先に決めている。P08 は P02 を `Consumed artifacts` に
  挙げる下流である。**下流が上流を上書きしない** (`api-contract.md` の決着と同じ理由づけ)。
- **中身の理由。** `articles.status` は**生成の進み具合** (`draft`/`review`/`published`/`archived`) を
  表し、`blog_article.status` は**読者から見える状態** (下書き/公開) を表す。語彙は同じでも
  指しているものが違う。1 つの列に両方を載せると「レビュー中の記事は読者に見えるのか」が
  画面ごとに変わる。分けておけば、片方の語彙を増やしても他方は動かない。
- **`articles` を参照している既存の関心事。** `content_variants` / `publications` の
  AI コンテンツ生成パイプラインが `articles.id` を外部キーで掴んでいる
  (`src/db/schema.ts` の 333/359/380/400/420 行)。統合はこの 5 本の参照先の意味を変える。

published generation は digest で固定された記録なので書き換えない。
計画と実装が違った事実そのものを、ここに残すのが正しい。

## 移行前後の対応表

| 既存 | 本 feature | 関係 |
|---|---|---|
| `articles` (AI 生成の下書き) | `blog_article` (人が書くブログ記事) | **別表。列も enum も足していない** |
| `articles.status` (生成の進み具合) | `blog_article.status` (読者から見える状態) | 語彙は同じ、意味は別 |
| `articles.category_id` | `blog_article_tag` → `blog_tag` | 1 対 1 の分類 → 多対多のタグ |
| `legal_page.kind` 6 種 | 同じ列に 8 種 | enum 配列に 2 種を足しただけ。DDL 変更なし |

追加した表は 9 つ (`site_network_node` / `blog_layout_slot` / `blog_layout_band` /
`blog_article` / `blog_article_block` / `blog_delivery_part` / `blog_tag` /
`blog_article_tag` / `blog_article_rating`)。実ファイルは `drizzle/0025_faithful_ultimatum.sql`。

- 既存行への backfill: **不要** (既存表に変更が無い)
- ロールバック時のデータ損失: **既存に無い**。新設 9 表を落とすだけで戻る
  (手順は `migration-plan.md` の「ロールバック」節)

## 重複解消の証跡

管理画面は 2 系統ある。**混ぜないことで重複を消した。**

| 系統 | 画面 | 入口 | 見る表 |
|---|---|---|---|
| AI コンテンツ生成 | `src/app/admin/content/**` (6 枚) | `contentUseCases()` | `articles` / `content_variants` / `publications` |
| ブログ運用 CRUD | `src/app/admin/blog/**` (9 枚) | `blogOpsEntry()` | `blog_article` ほか 9 表 |

機械が守っているもの — `tests/architecture/blog-ops-content-separation.test.ts` (4 件):

1. 走査が空になっていない (AI 生成側 6 枚・ブログ運用側 9 枚の床)
2. AI 生成の画面が `blogOpsEntry` を import していない
3. ブログ運用の画面が `contentUseCases` / `editorialContentNotice` を import していない
4. `articles` 表の定義に `article_template` / `author_profile_id` / `blog_category` が現れない
   (統合が始まった跡が出たら落ちる)

2026-08-26 の実測: **4 件すべて緑、違反 0 件**。

## この phase で直したこと

`tests/ui/route-table.ts` が `art_sample_review` / `net_sample_root` という
**見本に存在しない識別子**で 2 枚 (`/admin/blog/articles/[article]` /
`/admin/site-network/[node]`) を開いていた。画面は「見つかりません」を描き、
例外にはならないので分量検査も見出し検査も axe も緑だった。
**この 2 枚は中身を 1 度も検査されていない。**

直した形:

- 見本側が `BLOG_OPS_SAMPLE_ROUTE_IDS` を `export` し、テストは手で文字列を作らない
  (`src/infrastructure/persistence/sample/blog-ops-sample-repository.ts`)。
  見本の id が変わった日に型が合わなくなる。
- `tests/ui/page-render.test.tsx` に「目当ての物が見つかった状態を描いている」を足した。
  `notFound()` の文言 (`〜 が見つかりません (id: …)`) を描いた画面は落ちる。
  全 86 ルートに掛かる。同じ穴が他の画面で開いても、今度は止まる。

実測: `tests/ui/page-render.test.tsx` は 465 件 → **551 件**に増えて全緑。
