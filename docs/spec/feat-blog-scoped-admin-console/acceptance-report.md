# 受入の判定 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P08 の成果物。`requirements-baseline.md` の 10 条件に対する判定。

## 判定

| # | 条件 | 判定 |
|---|---|---|
| 1 | ブログ 1 本の下に住所・観測・改善がぶら下がる | 達成 |
| 2 | 各画面に目的が 1 つだけ宣言されている | 達成 |
| 3 | 足した画面は `/admin/sites/[site]` から辿れる | 達成（機械では未検査） |
| 4 | route・ナビ・パンくず・分類が同じ表から派生 | 達成 |
| 5 | 実 URL・選択中ナビ・パンくずを別々に解決 | 達成 |
| 6 | 根拠が足りない数字は読み方を伏せる | 達成 |
| 7 | 空の表を「出せた」と言わない | 達成 |
| 8 | 押せない要素に `onclick` を付けない | 達成 |
| 9 | 断りは原因になった入力欄に出る | 達成 |
| 10 | 常時表示の注意書きは 2 個まで | 達成 |

**10 件中 10 件達成。ただし条件 3 は機械で検査していない。**

## 条件 1 — 住所の階層

```
/admin/sites/[site]/domains   ← 住所層
/admin/sites/[site]/audience  ← 観測層
/admin/sites/[site]/revenue   ← 観測層
/admin/sites/[site]/seo       ← 改善層
/admin/sites/[site]/aeo       ← 改善層
```

5 画面すべてが `sites/[site]` の子。

`analytics` の下に置いていない。

**根拠**: `admin-route-metadata.ts`、
`app-shell-nav.test.tsx`「動的 route の実 URL、選択中ナビ、
パンくずを別々に解決する」。

## 条件 2 — 目的が 1 つ

`admin-screen-task-manifest.ts` に
route ごとに 1 文。

`uiux-screen-single-purpose.test.ts`
「screen mutation が所属する primary task は
route ごとに 1 種類以下」。

## 条件 3 — 親から辿れる（弱い）

`/admin/sites/[site]` の `actions` に
10 画面のうち 9 本 + 戻りが並ぶ。

**目視で確認した。機械は見ていない。**

`design-review-findings.md` F-01 に記録。

`actions` は手書きで、
route metadata から自動生成していない。

次に画面を足した人が
`actions` に足し忘れても、テストは通る。

### なぜ「達成」と書くか

いま現在、10 画面すべてが親から辿れる。

条件は「足した画面は辿れる」であり、
**今の状態は満たしている**。

将来の足し忘れを防ぐ仕組みが無いことは
別の指摘（F-01）として残す。

条件そのものを未達にはしない。

## 条件 4 — 1 つの表から派生

`app-shell-nav.test.tsx`
「93画面・ナビ・分類は同じ metadata から派生する」。

93 のファイルと 93 の定義が一致。

## 条件 5 — 3 つを別々に解決

`app-shell-nav.test.tsx`
「動的 route の実 URL、選択中ナビ、パンくずを別々に解決する」。

## 条件 6 — 足切り

`MIN_EVIDENCE_SAMPLES = 30`。

`blog-metrics-pages.test.tsx` 1〜3 件目。

**数字は出し、読み方だけ伏せる。**

## 条件 7 — 空の表

`blog-metrics-pages.test.tsx` 4〜6 件目。

3 つの「空」を区別している:

- 保存先につながっていない
- 記録が 1 件も無い
- 記録はあるが該当 0 件

## 条件 8 — `onclick`

`blog-ops-console-forms.test.tsx`
「操作は button であって、押せない要素に
onclick を付けていない」。

## 条件 9 — 断りの場所

`blog-ops-console-forms.test.tsx` 6〜8 件目。

住所の形 → 住所の欄。
構えの断り → 名乗る名前の欄。
欄を特定できない断り → フォームの結果。

## 条件 10 — 注意書き 2 個

`uiux-spacing-and-copy.test.ts` §3 が
**93 画面それぞれ**を検査。

上限そのものも §0 で境界を当てている。

`/admin/sites/[site]` は 2 個使い切っており、
3 つ目を地の文で出した。

## 作らないと決めたものの確認

| # | 作らないもの | 確認 |
|---|---|---|
| 1 | ブログ切り替えの選択欄 | 無い |
| 2 | ブログをまたぐ合算画面 | 無い |
| 3 | 画面ごとの権限の作り分け | 無い（`child` に `requires` なし） |
| 4 | ブログ専用の画面 | 無い |
| 5 | 画面での計算 | 無い（AD-2 照合済み） |

`dependency-direction-check.md` に照合を記録。

## 品質ゲート

`port-wiring.mjs` が赤（exit 1）。

**この feature が原因ではない。**
隣の feature が追加した口による。

`quality-report.md` に記録。上限は上げていない。

## テスト

350 件（normal 325 + a11y 25）全部通過。
