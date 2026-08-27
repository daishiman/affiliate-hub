# 移行報告 (P08)

更新日: 2026-08-27  
execution status: **in_progress**  
local implementation validation: **GREEN**

## 現行の決着: `articles` が唯一の編集正本

- `drizzle/0027_dashing_gamma_corps.sql`: 統合前の `blog_article` と `site_network_node` に `deleted_at` を追加
- `drizzle/0028_unify_blog_article_ssot.sql`: `articles` にブログ属性を追加し、`blog_article` 全行を ID 維持で backfill した後に過渡表を DROP
- `drizzle/0029_publish_fixed_pages.sql`: 固定ページの公開状態・論理削除と canonical kind への移行
- `drizzle/0030_square_wolfpack.sql`: `blog_article_tag` から `articles` / `blog_tag` へ
  `ON DELETE CASCADE` FK を追加

0028 は T1→`ranking`, T2→`review`, T3/T4→`guide` を domain mapping と同じ対応で backfill し、ステータス・公開時刻・論理削除時刻・作成更新時刻を保持する。legacy AI 行のブログ属性は推測せず NULL のまま保つ。`content_variants` / `publications` の `articles.id` 参照は維持する。

ブログ D1 adapter は `articles as blogArticles` を通じて本体を read/write し、`blog_article` へ dual-write しない。用途別の `/admin/content/**` と `/admin/blog/**` は入口を分けたまま、本体の永続正本だけを共有する。`published_articles` は公開read projection であり編集正本ではない。

0030 は表の作り直し前に、結合先の不存在と workspace/site 不一致を
CHECK guard で fail-fast する。不整合行をフィルタして無断削除はしない。移行末尾で
`PRAGMA foreign_key_check` を実行し、D1 統合検査も違反 0 件を確認する。

局所検証:

- migration canonical SSOT test: 1/1 PASS
- 関連 runtime: 5 files / 202 tests PASS
- TypeScript: PASS

これは局所 GREEN であり、P07/P09 再検証・全回帰・開発環境 migration 適用はまだ完了していない。したがって P08/P10/P13 の `completion_evidence` は in_progress を維持する。

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
`blog_article_tag` / `blog_article_rating`)。実ファイルは `drizzle/0023_faithful_ultimatum.sql`。

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
