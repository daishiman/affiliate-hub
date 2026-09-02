# 既存サイト管理画面の新エンティティ移行レポート（P08）

> **歴史 snapshot:** 以下は 2026-08-30 の P08 記録で、固定ページ二重語彙を未解消としている。
> 2026-08-31 に `SiteDocumentKey` を正本、`FixedPageKind` をlegacy adapterへ縮退し、
> 0040でtheme/override/document/placementをbackfill・整合化した。現行判定は
> [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本) を参照する。

- 作成日: 2026-08-30
- 対象: `src/app/admin/sites/` 配下 7 画面 / `src/presentation/ui/templates/` 配下 6 ファイル
- 前段: P05（新エンティティの実装）、P07（受入判定）

---

## 0. この phase が解こうとしたこと

P05 が `blog_template` / `blog_theme` / `page_theme_override` / `legal_page` /
`blog_affiliate_placement` を足した。**足しただけでは、古い経路は消えない。**
古い経路と新しい経路が同じ顔で並んでいると、運営者はどちらを直せば読者に届くのか
分からなくなる。この phase は既存画面を新エンティティ側へ寄せ、
重複を数え、消せなかったものを名指しで残す。

---

## 1. 移行前後の対応表

| 概念 | 移行前（この phase の前） | 移行後 | 状態 |
| --- | --- | --- | --- |
| 配色（ブログ既定） | `/admin/sites/[site]` が `site_blueprint.theme.brandTheme` を表示 | `publicBlogAppearance()` で `blog_theme` → `page_theme_override` を解決した**実効値**を表示 | ✅ 移行済み |
| 明暗 | 同上（`theme.colorScheme`） | 同上 | ✅ 移行済み |
| 余白・角丸 | `site_blueprint.theme` | **据え置き**（2 層の対象外）。値の横に「（設計図）」と出所を書いた | ✅ 明示済み |
| テンプレート | `/admin/sites/[site]` の「型」（`patternLabel`）と `blog_template` が別物 | 「型」は事業の型で、見せ方（`blog_template`）とは別概念だと確認。**重複ではない** | ✅ 重複なし |
| 見せ方・配色の編集 | `/admin/sites/[site]/appearance` に**入口が無かった** | 詳細画面から導線を追加 | ✅ 移行済み |
| 掲載の台帳 | `/admin/sites/[site]/placements` に**入口が無かった** | 同上 | ✅ 移行済み |
| 固定ページ | `/admin/sites/[site]/documents`（`SiteDocumentKey` 9 種）と `/admin/blog/pages`（`FixedPageKind` 8 種）の 2 画面 | **未解消**（§3） | ❌ 残件 |

---

## 2. 消した重複 — 配色

### 何が重なっていたか

`/admin/sites/[site]`（ブログの詳細）は「このブログの位置づけ」という 1 つの表に、
出所の違う 2 種類の値を並べていた。

```
型 / 扱う分野 / 収益の形          ← 設計図。書いてあるものがそのまま効く
色の組み合わせ / 明暗の切り替え    ← 設計図。**もう読者には効かない**
余白の詰め方 / 角の丸み            ← 設計図。今も効く
AI 向けの案内ファイル              ← 設計図。今も効く
```

P05 が `blog_theme` / `page_theme_override` を足し、公開面は
`publicBlogAppearance()` でそちらを読むようになった。その時点で
**この画面の「色の組み合わせ」は、読者が見ている色と一致しなくなった**。
それでも同じ表の同じ書式で並んでいたので、見分けはつかない。

`/admin/sites/[site]/appearance`（P05 が足した画面）は正しく `blog_theme` を出していた。
つまり **同じブログの配色について、2 つの画面が別の値を出しうる状態**だった。

### どう直したか

1. 配色を「このブログの位置づけ」から**独立した節に出した**。
   出所の違う値を同じ表に並べると、片方だけ古いことに気付けない。
2. 値を `publicBlogAppearance({ siteSlug, pagePath: "/", fallback })` から取る。
   これは公開面が読むのと**同じ関数**である。別の読み方を用意すると、
   また 2 つの値が生まれる。
3. 解決できなかったとき（保存先が無い／1 度も保存していない）は、
   `resolved: false` を受けて**そう書く**。黙って設計図の値へ落ちると、
   今回と同じ取り違えが起きる。
4. 余白・角丸は 2 層の対象外なので設計図のまま残し、
   値の横に「（設計図）」と書いた。「配色を変えたのに余白が変わらない」の
   理由が画面から消えないようにするため。
5. **この画面からは配色を変えられないことを明記した。**
   同じものを 2 か所で直せると、後から書いたほうが静かに勝つ。

### 注意書きを増やさなかったこと

`resolved: false` の断りは `Callout`（注意書き）ではなく地の文にした。
この画面の常時表示の注意書きは上限 2 個で
（`tests/ui/uiux-spacing-and-copy.test.ts` の A8 §3）、
既に「いまは公開できません」と「観点が空欄です」が使っている。
3 個目を足すと、**金銭と公開に関わる警告の重みが薄まる**。
上限に当たったとき、上限のほうを上げない。

---

## 3. 消せなかった重複 — 固定ページ（残件）

**`/admin/sites/[site]/documents` と `/admin/blog/pages` は、同じ `legal_page` 表を
別の語彙で触っている。** 表は 1 つなので「保存先が 2 つある」わけではない。
食い違うのは**語彙と、読者へ出る条件**である。

| | `/admin/sites/[site]/documents` | `/admin/blog/pages` |
| --- | --- | --- |
| 語彙 | `SiteDocumentKey` 9 種 | `FixedPageKind` 8 種 |
| 保存先 | `legal_page` | `legal_page`（同じ） |
| 公開状態 | **持たない** | `draft` / `published` |
| 削除 | 持たない | 論理削除＋復元 |
| 読者への出口 | 名前付きルート（`/operator` `/privacy` …） | `[fixedPage]` ルート（`/profile` `/site-policy` …） |

### 実害 1 — 同じ 1 枚に URL が 2 本あり、片方だけ 200

```
/s/home-office-desk/operator   200   ← findSiteDocument（status を見ない）
/s/home-office-desk/profile    404   ← 公開投影（published の行だけ載る）
```

`site-document-repository.ts` の `save()` は `status` を書かない。
新規 insert は表の既定（`draft`）になるので、
**この画面で書いた固定ページは `[fixedPage]` 側の読者に永遠に出ない。**
一方 `findSiteDocument()` は `status` を見ないので、名前付きルートには出る。

### 実害 2 — 削除した固定ページが片方に残る

`findSiteDocument()` は `deletedAt` を見ない。`/admin/blog/pages` で削除しても、
名前付きルートには出続ける。

### 実害 3 — 作業場所で絞っていない

`findSiteDocument()` の where 句は `siteSlug` と `kind` だけで、
`workspaceId` が入っていない。`legal_page` の schema はコメントで
**「1 本のクエリが単体で作業場所に絞れること」**を要求しており
（`tests/architecture/tenant-scoped-schema.test.ts`）、索引もそう張ってある。
この 1 本だけがそれを使っていない。別の作業場所に同じ slug のブログがあれば、
**他所の固定ページが読者に出る。**

### 実害 4 — 埋められない不足を警告し続ける

`/admin/sites/[site]/documents` は `SITE_DOCUMENT_KEYS` 9 種すべてを行として並べ、
未整備の数を数えて警告する。ところが `KEY_TO_KIND` の対応は 4 種しかない。

```
写せる:   operator→profile / privacy→privacy_policy
          terms→site_policy / tokushoho→commercial_transaction
写せない: methodology / editorial-policy / advertising-policy / ai-policy / contact
```

写せない鍵は `save()` が `NOT_IMPLEMENTED` で断る。つまり
**5 行が永久に「未記入」で、埋めようとすると断られ、その 5 件を数えた警告が出続ける。**
公開面でもこの 4 本の方針ページは 404 である（`contact` は両語彙に在るのに
`KEY_TO_KIND` から漏れているだけ）。

### なぜこの phase で直さなかったか

P08 の write scope は `src/app/admin/sites/` / `src/app/admin/sites/[site]/` /
`src/presentation/ui/templates/` / 本レポートである。
実害 1〜4 の根は `src/infrastructure/persistence/d1/site-document-repository.ts` と
`src/domain/blogops/fixed-page.ts`（語彙）にあり、4 本の方針ページを足すには
`FIXED_PAGE_KINDS` の enum を広げる schema 変更と移行が要る。

**画面の側だけで取り繕う道は採らなかった。** 画面に「この 5 行は保存できません」と
書くには、画面が対応表の写しを持つ必要がある。それは 3 つ目の写しであり、
V2（名札の二重化）を悪化させる。

### 引き渡し

`requirements-baseline.md` の A4-2「V2 を解消し、固定ページの名札が 1 系統になる」は
**未達のまま P13 へ渡す**。統合の向きは 2 つあり、選択には設計判断が要る。

- **案 A**: `FixedPageKind` を正本にし、方針 4 種を語彙に足す。
  `SiteDocumentKey` 側の画面は `[fixedPage]` の URL へ寄せる。
  公開状態と論理削除が全種に効くようになる。schema の enum 変更と移行が要る。
- **案 B**: `SiteDocumentKey` を正本にし、`legal_page.kind` に鍵をそのまま入れる
  （`site-routes.ts:352` のコメントは元々そう書いてある）。
  `[fixedPage]` 側を寄せる。公開状態の扱いを別に決める必要がある。

どちらでも、**名前付きルートと `[fixedPage]` のどちらを canonical にするか**を
同時に決めなければならない。今は同じ 1 枚に URL が 2 本あり、
検索エンジンから見て重複コンテンツである。

### 実害 1〜4 を Beads へ起票できなかった理由

起票を試み、チョークポイントに断られた。

```
$ python3 .claude/plugins/dev-graph/scripts/bd-bridge.py --op create ... --priority 0
create requires --graph-node-id and --title
```

このリポジトリでは Beads の課題は dev-graph の node の投影であり、
**node を持たない課題は作れない**。そして dev-graph の node は
`feature_package_id` に属し、1 package ちょうど 13 個（`SYS-<FEATURE>-P01`〜`P13`）で、
`validate-system-plan.py` がその数を検証している。

つまり「拾った不具合を 1 件だけ足す」ための場所が、この設計には無い。
不具合は**次の feature package の P01〜P13 として計画に載る**か、
**現 package の成果物に書いて次 phase へ渡す**かのどちらかになる。
迂回して素の `bd create` を叩けば通るが、それをすると Beads と dev-graph の
状態が黙って食い違う（CLAUDE.md がまさにそれを禁じている）。

したがって実害 1〜4 と E2E の 39 件は、本レポート §3 と
`acceptance-report.md` §4・§6 を経路として **P13 の申し送りに載せた**。
P13 は `requirements-baseline.md` の対応表を書き戻す phase なので、
そこで A4-2 が未達であることが機械可読な形で残る。

---

## 4. 重複が無いことを確認したもの

| 見た場所 | 結果 |
| --- | --- |
| `src/presentation/ui/templates/site-shell.tsx` | 配色は `chrome.brandTheme` / `chrome.colorMode` の 1 経路だけ。P05 で統一済み。重複なし |
| `src/presentation/ui/templates/app-shell.tsx` | 管理画面の骨格。配色の分岐を持たない |
| `src/presentation/ui/templates/article-view.tsx` | 記事の塊の並びは `articleBlockOrder` の 1 経路 |
| `/admin/sites/[site]/edit` | 設計図の編集のみ。配色欄を持たない |
| `/admin/sites/new` | 同上 |
| `/admin/sites`（一覧） | 配色を出していない |
| `/admin/sites/[site]/placements` | `blog_affiliate_placement` の 1 経路。旧経路なし |

「型」（`summary.patternLabel`）と「見せ方」（`blog_template`）は名前が似ているが、
前者は事業の型（比較サイト・レビューサイトなど）、後者は記事の並べ方である。
**同じものの 2 系統ではない**ので、統合しない。

---

## 5. 検証

| コマンド | 結果 |
| --- | --- |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0（指摘なし） |
| `pnpm test` | **417 ファイル / 10023 件すべて合格**（2026-08-30 18:47、314.9s） |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | `"violations": []`（contract 1.3.0、P01〜P13） |

スクリプトの所在は `.claude/plugins/system-dev-planner/scripts/validate-system-plan.py`。
`dev-graph` 側ではない。

E2E（`pnpm run test:e2e`）はこの phase では回していない。P07 の時点で
439 passed / 39 failed であり、39 件はすべて P07 §4 に記録済みの既存分
（画面数宣言 87 対 実際 115 が 1 件、固定ページ 404 が 20 件、管理画面 3 枚が 18 件）。
本 phase の変更は `/admin/sites/[site]` の表示のみで、この 39 件のいずれとも重ならない。

`node scripts/acceptance-reconciliation.mjs --write` を実行した。
`/admin/sites/[site]` の変更で `feat-uiux-overhaul` の評価 digest が動いたため
（`docs/spec/feat-uiux-overhaul/acceptance-reconciliation.json` ほか）。
数値の宣言は上げていない（10 IDs / 200 evidence files のまま）。

---

## 6. 判定項目

- [x] `src/app/admin/sites` 配下の重複テンプレート/配色実装が 0 件である
      — 配色は解消。固定ページの語彙二重化は `src/app/admin/sites` の**外**（永続層と語彙）に根があり、§3 に残件として記録した
- [x] `pnpm run lint` が合格する
- [x] `pnpm run typecheck` が合格する
- [x] `migration-report.md` が存在する（本ファイル）
