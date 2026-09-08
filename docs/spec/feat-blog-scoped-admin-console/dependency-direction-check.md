# 依存の向きの照合 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P03 の成果物。`architecture/arch-blog-operations-console.md` の
AD-1〜AD-5 と §12.3 に、提示層が違反していないかを照合する。

## AD-1 一方向依存

> 住所層 → 観測層 → 改善層 → 提示層。逆向きに参照しない。

### 照合

提示層（`src/app/admin/sites/[site]/**`）が
import しているもの:

| import 元 | 層 | 判定 |
|---|---|---|
| `@/domain/analytics/reader-interaction` | 観測層の型・定数 | ✅ 下位を参照 |
| `@/presentation/admin/metrics-range` | 提示層 | ✅ 同層 |
| `@/presentation/composition` | 配線 | ✅ 同層 |
| `@/presentation/admin/observe/metrics-rebuild-form` | 提示層 | ✅ 同層 |

**改善層・観測層から `src/app/admin/` を参照している箇所は無い。**

Next.js の App Router では `src/app/` が最上位で、
下位から参照する動機が生まれにくい。

構造が向きを守っている（規律ではなく）。

## AD-2 提示層で計算しない

> 集計・判定は読み取りが済ませ、画面は並べるだけ。

### 照合 — 満たしている 3 例

| 画面 | 計算していそうなもの | 実際にどこで |
|---|---|---|
| `audience` | 足切りの判定 | `evidenceVerdict`（domain） |
| `revenue` | 記事ごとの合計 | rollup（観測層） |
| `aeo` | 隙間の件数 | `manage-aeo-answers`（応用層） |

`manage-blog-improvement.test.ts`
「長すぎる答えと埋もれた答えを、画面に代わって数える」
というテスト名が、この境界を名指ししている。

### 照合 — グレーな 1 例

`sites/[site]` の `SiteReachability` が
公開投影の件数を数えている。

```
ここに出る数は**設計図ではなく保存先を数え直したもの**である。
```

数え直しているのは**読み取りの結果**であり、
画面は返ってきた配列の `length` を出しているだけ。

`inspectComposition` が数えて返す。

### 照合 — 判断が要る 1 例

`sites/[site]` の配色の表で、
設計図の値をラベルへ変換している:

```tsx
value: `${blueprint.theme.density === "compact" ? "詰める" : "ゆったり"}（設計図）`,
```

これは**計算ではなく表示の言い換え**。

`compact` を「詰める」と読むのは提示層の仕事で、
値そのものは変えていない。

AD-2 が禁じているのは
「画面を見ないと結果が分からない状態」であり、
語の置き換えは含まない。

## AD-3 改善層は公開面へ書けない

> 診断・提案は読者に見えるものを直接変えない。

### 照合

`sites/[site]/seo` と `sites/[site]/aeo` は
どちらも**指摘を出すだけ**で、
記事を書き換える操作を持たない。

`seo` の目的文:

> 検索から届かない原因を 1 つ選び、**直しに行く**

「直す」ではなく「直しに行く」。
直す場所は記事の編集画面で、
そこは改善層ではない。

**画面の目的文に AD-3 が現れている。**

## AD-4 生イベントは 90 日で捨てる

提示層は生イベントを読まない。
rollup 済みの日次だけを読む。

`chooseMetricsRange` が期間を決めるが、
90 日より前を指定しても
rollup が残っていれば読める。

**生イベントの寿命は提示層に見えない。**

これは正しい。
提示層が保持期間を知っていると、
期間の選択肢を保持期間に合わせて出したくなり、
観測層の実装が提示層に漏れる。

## AD-5 `site_slug` が唯一の結合キー

### 照合

URL が `/admin/sites/[site]/...`。
`[site]` がそのまま `siteSlug` になる。

```tsx
const result = await platform.getSite.execute(actor, { siteSlug });
```

**画面は数値 ID を扱わない。**

`site_id` を URL に出すと、
`site_slug` との 2 つの識別子が並ぶ。

どちらが正かを画面ごとに決めることになる。

## §12.3 口の分離

> `BlogAudiencePort`（`Editorial`）と
> `BlogRevenuePort`（`Commercial`）。

### 照合

| 画面 | 呼ぶ口 | 印 |
|---|---|---|
| `audience` | `blogAudienceEntry` | `Editorial` |
| `revenue` | `blogRevenueEntry` | `Commercial` |

`audience/page.tsx` は
`blogRevenueEntry` を import していない。

**import していないことが、この検査の実体。**

コード上で呼べない状態にしてある。

### 画面を分けたことの意味

同じ画面で 2 つの口を呼ぶと、
どちらかの権限しか無い人に
片方だけ空の表が出る形になる。

分けてあれば、
権限が無い口の画面はサイドバーから消える。

## 検出した弱点

### D-1 `blogAeoEntry` の印が `Editorial`

AEO は収益に効く施策だが、印は `Editorial`。

意図通り（改善層は収益を入力にできない）だが、
**「回答エンジンからの流入がいくらになったか」を
この画面では出せない**ことを意味する。

出したければ `revenue` 側に置く。

### D-2 提示層のテストが実装を読んでいる

`uiux-spacing-and-copy.test.ts` は
`page.tsx` のソースを正規表現で走査する:

```ts
const count = (screen.source.match(/<Callout[\s/>]/g) ?? []).length;
```

`<Callout>` を別名で re-export すると数えられない。

依存の向きの問題ではないが、
**検査が実装の書き方に依存している**。

いまは全画面が直接 `<Callout>` を書いているので通る。

### D-3 `actions` の並びが手書き

`sites/[site]` の 11 本の `TextLink` は手で並べてある。

route metadata から自動生成していないので、
**足し忘れを機械が検出できない**。

`navigation-inventory.md` に理由を書いた
（並び順を作業順に合わせるため）が、
弱点であることは変わらない。

コメントの「足したら同時にここへ出す」が唯一の防御。
