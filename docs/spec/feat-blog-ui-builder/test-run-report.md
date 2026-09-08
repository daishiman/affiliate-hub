# テスト実行報告 (P06)

> **歴史 snapshot:** 以下は 2026-08-30 の実行結果であり、現在のテスト件数・受入判定ではない。
> 2026-08-31 の現行 A1〜A14 判定と追加証拠は
> [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本) を参照する。
> とくに「A5未接続」「A13は鍵だけ」という記述は改善前のRED証拠として残している。

実行日: 2026-08-30。実行環境: 手元 (darwin 25.3.0 / pnpm / vitest 4.1.10 / Node.js)。

## 実行結果

| 検査 | コマンド | 結果 |
|---|---|---|
| 単体・結合・境界値・契約 | `pnpm test` | **416 ファイル / 10011 件 すべて緑** (exit 0)。所要 273 秒 |
| 同上 + カバレッジ | `pnpm run test:coverage` | **416 ファイル / 10011 件 すべて緑** (exit 0)。所要 371 秒 |
| 型 | `pnpm run typecheck` | exit 0 |
| 静的検査 | `pnpm run lint` | exit 0 / 警告 0 件 |
| 移行生成 | `pnpm run db:generate` | `No schema changes, nothing to migrate` |
| 計画の決定論検証 | `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | exit 0 / `violations: []` |

## カバレッジ

```
Statements   : 88.49% ( 17319/19570 )
Branches     : 80.32% ( 12273/15279 )
Functions    : 90.03% (  4473/4968  )
Lines        : 91.10% ( 15525/17041 )
```

目標は 80%。**4 指標すべてが上回っているが、Branches は 80.32% で床から 0.32 ポイントしか離れていない。**
この数字を「達成」の一語に畳むと、次に分岐を 50 本足した日に静かに割れる。
`Statements` との 8 ポイント差は「行は通っているが、その行の片方の枝しか通っていない」量である。

## 回帰の有無

| 時点 | ファイル | 件数 |
|---|---|---|
| P04 完了時 (ベースライン) | 409 | 9885 |
| P05 完了時 | 416 | 10011 |

差は **+7 ファイル / +126 件**で、すべて本 feature が足した分である。
**赤へ転じた既存テストは 0 件。** P05 の途中で 2 度赤が出たが、いずれも
生成物 (`docs/product/test-traceability.md` のファイル数、
`feat-uiux-overhaul` の評価 digest) が実体に追いついていないことの検出で、
主張の側は 1 つも動かしていない。上限や床を上げて緑にする対処は取っていない。

## 受入 A1-A14 の対応テスト

| 受入 | 状態 | 主な検査 |
|---|---|---|
| A1 テンプレート 6 種の選択と差し替え | 🟢 | `tests/acceptance/feat-blog-ui-builder/template-and-theme.test.ts`, `article-block-order.test.tsx`（並べ替えても塊が 1 つも落ちないこと）、`tests/integration/d1-blog-appearance.test.ts` |
| A2 配色 2 層と上書き解除 | 🟢 | `public-appearance.test.ts`（7 件。軸ごとの独立・語彙外の名札・読み取り失敗時の退避）、`template-and-theme.test.ts`, `tests/ui/public-shell-appearance.test.tsx` |
| A3 sticky 常時表示と狭幅の折りたたみ | 🟢 | `sticky-layout.test.ts` |
| A4 固定ページ 6 種の CRUD | 🟢 | `tests/ui/public-site-projection.test.ts` ほか既存の固定ページ検査 |
| A5 記事内表現ブロックとスロット差し替え | 🟡 **部分** | `article-block-order.test.tsx`（並びは緑）。**スロット差し替えは未接続** — 下の「残件」を読むこと |
| A6 ブログごとの掲載アフィリエイト一覧 | 🟢 | `tests/integration/d1-blog-affiliate-placement.test.ts` |
| A7 アフィリエイトからの逆引きと保存前後の一致 | 🟢 | 同上（作業場所始まりの索引 `blog_affiliate_placement_workspace_idx` を含む） |
| A8 配色・テンプレート・固定ページの D1 永続化 | 🟢 | `tests/integration/d1-blog-appearance.test.ts`, `public-appearance.test.ts` |
| A9 axe 重大違反 0 件と light/dark コントラスト | 🟢 | `tests/ui/page-render.test.tsx`。新規 2 画面 (`sites/[site]/appearance`, `sites/[site]/placements`) は `ADMIN_ROUTE_METADATA` 経由で `route-cases.ts` へ**自動的に**入るので、登録漏れが起きない |
| A10 記事 HTML のメタと JSON-LD | 🟢 | `article-html-contract.test.ts`（**入口 2 系統の両方**を見る）、`tests/application/seo/structured-data.test.ts` |
| A11 sitemap / robots / feed / llms.txt | 🟢 | `tests/application/seo/feeds.test.ts` |
| A12 SEO 標準ブロックと dateModified の可視化 | 🟢 | `article-html-contract.test.ts`, `tests/application/seo/expression-blocks.test.ts` |
| A13 IndexNow の鍵の扱い | 🟢 | `tests/infrastructure/indexnow-client.test.ts` |
| A14 ガイドライン出典レジストリと 90 日超の再確認 | 🟢 | `tests/domain/seo/guideline-reference.test.ts`, `tests/application/manage-guideline-references.test.ts`, `tests/infrastructure/d1-guideline-reference-repository.test.ts` |

## この回で見つけた「検査そのものの欠陥」

### 1. 受入 A10 を、**入口の片方しか見ていなかった**

公開面には記事の入口が 2 系統ある。

- `/best` `/guides` `/reviews` `/compare` → `src/presentation/site/article-page.tsx`
- `/blog/<slug>` → `src/app/s/[site]/blog/[article]/page.tsx`

`article-html-contract.test.ts` は前者のファイルだけを読んでいた。
実測 (2026-08-30) で、**後者には canonical も OGP も JSON-LD も 1 つも無かった**
(`curl` の応答に `ld+json` が 0 件)。同じ受入 A10 の対象なのに、
検査が読むファイルが 1 本だったので気づけなかった。

対処は 2 つ。実装側に `generateMetadata` と `buildBlogOpsPosting` を接続し、
検査側に**後者のファイルを読む describe を足した**。
「同じ画面に見えるものが同じ経路とは限らない」——入口ごとに見る。

### 2. 末尾スラッシュの検査が、実質何も見ていなかった

`public-appearance.test.ts` の「`/about/` と `/about` が同じ上書きに当たる」は、
最初の版では緑でも赤でもなかった。**模造の保管庫が `pagePath` を無視していた**ので、
正規化 (`normalizePagePath`) を実装から丸ごと削っても緑のまま通る。

`overrideOf` が `pagePath === "/about"` のときだけ上書きを返す模造に差し替え、
`/other` が既定へ落ちることも併せて見るようにした。

### 3. フィクスチャの `as` が、型崩れを隠していた

`article-block-order.test.tsx` の記事フィクスチャを `as ArticleViewModel` で
押し込んでいたため、`comparison.rows` の形が実物と違っていた
(`{ key, cells: { noise: "静か" } }` — 実物は `{ id, cells: { noise: { value } } }`)。
TypeScript の型アサーションは「重なりが薄い」ときしか警告しないので、
**構造が違うのに形は似ている**間違いは `as` を外すまで表に出ない。
外して実物の形へ直した。押し込んだままだと、画面が受け取る形が変わった日に
「並びは正しいが中身が描けない」を見逃す。

## 残件 (P13 の書き戻しへ引き継ぐ)

- **A5-2 / A5-3 スロット差し替え** — `fillSlots` の呼び出しは依然 0 件。
  スロットを持つ表現ブロックの**供給元が無い**。作ろうとすると
  `expressionBlocksOf` の「保存せず読み取りモデルから組み立てる」方針
  (`docs/product/design-decisions.md` §6) と衝突する。
  図解 (`figure`) は画像の配信方式が未決 (`seo-ai-search-contract.md` §5)。
  **作為的に繋げば緑にはできるが、それは繋がったふりである。**
- **A5-4 語彙の一本化 (V1)** — 表現ブロックが `EXPRESSION_BLOCK_KINDS` (10 種) と
  `ARTICLE_BLOCK_KINDS` (15 種) の 2 系統のまま。統一は永続層の移行を伴う。
- `requirements-baseline.md` の現状対応表は**実装前の状態のまま**。
  A1 / A2 / A5 / A6 / A7 / A10 の行の書き戻しが要る。

## 見ていないもの

- **実描画での確認は P09 の e2e が持つ。** ここまでの検査が見ているのは
  「部品が正しい」ことと「画面の本文に繋ぎが書かれている」ことまでで、
  ブラウザで実際にその順に出るところは見ていない。
  ただし本 phase では手元の dev サーバ (`localhost:3001`) で
  A2 (`data-brand-theme="green"` / `data-color-mode="dark"`)、
  A5 の並び (`gadget` で 比較 → 買う導線 → まとめ)、
  A10 (`ld+json` 2 件と canonical / OGP) を目視・実測で確認している。
- E2E (`pnpm test:e2e`) は本 phase の受入コマンドに含まれない (P09 の所有)。
