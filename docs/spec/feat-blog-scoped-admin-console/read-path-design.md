# 読み取りの経路 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P02 の成果物。画面が値をどこから取るか。

## 画面は数えない（AD-2）

画面がするのは 3 つだけ。

1. 読み口を 1 回呼ぶ
2. 結果が `ok` でなければ理由を出す
3. `ok` なら値を並べる

**計算・集計・判定を画面に置かない。**

例（`sites/[site]/aeo`）:

```tsx
const entry = await blogAeoEntry();
```

隙間の件数を数えるのはユースケース側
（`manage-blog-improvement.test.ts`
「長すぎる答えと埋もれた答えを、画面に代わって数える」）。

## 入口が権限で分かれている

```
/**
 * 読者の行動を見る画面。**売上は出さない。**
 *
 * 入口が売上と分かれているのは、必要な権限が違うからで、見た目の
 * 都合ではない (`blogAudienceEntry` / `blogRevenueEntry` の doc)。
 * ここに報酬の列を足すと、読者の見え方だけを見せたい役割に
 * 報酬まで渡ることになる。
 */
```

| 入口 | 印 | 画面 |
|---|---|---|
| `blogAudienceEntry` | `Editorial` | `sites/[site]/audience` |
| `blogRevenueEntry` | `Commercial` | `sites/[site]/revenue` |
| `blogAeoEntry` | `Editorial` | `sites/[site]/aeo` |

**同じ画面に両方を並べない。**

「読者の行動」に報酬の列を 1 本足すだけで、
`Editorial` の役割に `Commercial` の値が渡る。

見た目の都合で列を足せない構造になっている
（`architecture/arch-blog-operations-console.md` §12.3）。

## 読めないときの形

```tsx
const entry = await blogAudienceEntry();
if (!entry.ready) {
  return (
    <AdminShell routeId="sites/[site]/audience" ...>
```

**骨格は同じで、中身だけ変わる。**

`/admin/sites/[site]` にこの判断が書いてある:

```
骨格を 2 回書かない。失敗しても出す骨格は同じで、変わるのは題と中身だけ。
早期 return で骨格ごと分けると、パンくずや戻り先を片方だけ直した状態が作れる。
```

`AdminShell` の外で `return` しない。

## 失敗したら次を読まない

```tsx
const result = await platform.getSite.execute(actor, { siteSlug });
// 設計図が無い場合は、公開投影を追加で読まない。
const composition = result.ok
  ? await platform.inspectComposition.execute(actor, { siteSlug })
  : null;
```

設計図が無いブログの公開投影を読んでも意味が無い。

`null` は「読まなかった」で、
`{ ok: false }` は「読んで失敗した」。
画面はこの 2 つを別に扱う:

```tsx
{composition?.ok ? (
  <SiteReachability value={composition.value} />
) : composition === null ? null : (
  <ErrorView title="このブログが読者に届くか、確かめられませんでした" ... />
)}
```

## 設計図と実物を別の節に置く

```
ここに出る数は**設計図ではなく保存先を数え直したもの**である。
設計図の側（下の節）は「そう作るつもりだった」を、ここは
「実際にそう置かれている」を出す。この 2 つを 1 つの節に混ぜていたのが、
13 問すべてに答えて緑の成功表示が出るのに `/s/<URL名>` が 404、
という食い違いの正体だった。
```

| 節 | 出所 |
|---|---|
| このブログは読者に届くか | 公開投影（実物） |
| このブログの位置づけ | 設計図（予定） |
| 読者に出ている配色 | `blog_theme` / `page_theme_override` を解いた結果 |

### 配色だけ 3 つ目の出所

配色は設計図に書いてあるが、公開面はそれを読んでいない。

```
2026-08-30 まで、この画面は `blueprint.theme` の 4 項目を「このブログの配色」
として出していた。P05 が `blog_theme` / `page_theme_override` を足し、
公開面はそちらを読むようになった時点で、**この画面の数字は読者に効かなくなった**。
それでも同じ場所に同じ顔で出ていたので、見分けはつかなかった。
```

**出所の違う値を同じ表に並べない**が、この節の要点。

余白と角丸だけは 2 層の対象外なので、
同じ表に置いた上で**値の側に「（設計図）」と書く**:

```tsx
value: `${blueprint.theme.density === "compact" ? "詰める" : "ゆったり"}（設計図）`,
```

### 解けなかったことを黙らない

```tsx
{appearance.resolved ? null : (
  <Prose>
    保存された配色をまだ読めていません（保存先につながっていないか、このブログの配色を
    1 度も保存していない）。下の値は設計図の既定で、保存先のある実行では別の色が出ます。
  </Prose>
)}
```

fallback したことを画面に書く。
黙ると、また同じ取り違えが起きる。

## URL の絞り込み

```tsx
/*
  画面幅の絞り込み。**知らない値は「絞らない」に倒す。**
  URL を手で書き換えられても空の表を出さないため、そして
  区分名を増やした日に古いリンクが壊れないためである。
*/
const viewportBand = VIEWPORT_BANDS.find((band) => band === query.viewport);
```

`find` は見つからなければ `undefined`。
`undefined` は「絞らない」。

**エラーにしない。**

`blog-metrics-pages.test.tsx`
「知らない幅を URL で渡されても、絞らずに描く」で固定。

### 他の条件を保つ

```tsx
const audienceHref = (band: ViewportBand | null): string => {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (articleSlug !== "") params.set("article", articleSlug);
  if (band !== null) params.set("viewport", band);
  return `${sitePath}/audience?${params.toString()}`;
};
```

幅を切り替えるリンクが、期間と記事の選択を落とさない。

**落とすと、切り替えるたびに条件が初期化される。**

## 根拠の足切り

```ts
export const MIN_EVIDENCE_SAMPLES = 30;
```

`src/domain/analytics/reader-interaction.ts`:

```
ここでも厳密な検定の閾値としてではなく**足切り**として使う。
```

30 件に満たない数字には、
読み方の代わりに理由を出す。

`blog-metrics-pages.test.tsx`:
- 「足切り未満だと、読み方の代わりに理由が出る」
- 「足切りを越えると、読み方が出て理由は出ない」
- 「記事の中の読まれ方も、根拠が足りなければ読み方を伏せる」

**数字は出す。読み方だけ伏せる。**

数字ごと隠すと「まだ記録が無い」と読まれる。
記録はあるが少ない、という状態を表せない。
