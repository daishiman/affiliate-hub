# テーマ実装契約（feat-blog-ui-builder / P02）

記録日: 2026-08-30
graph_node_id: `SYS-BLOG-UI-BUILDER-P02`
Beads: `ah-45ba.2`
受入: **A2**（ブログ既定の配色 + ページ単位の上書きと解除）、**A8**（配色を変えても部品は変わらない）

## この文書の役割

`blog_theme`（既定）と `page_theme_override`（上書き）の 2 層が、
CSS の `light-dark()` と data 属性へどう落ちるかを確定する。

決定 `decision-ui-theme-implementation`（`opt-css-light-dark`）に従う。

## 1. 大原則 —「色」をどこにも持たない

**DB にも TypeScript にも 16 進値を置かない。**

置ける場所は `src/presentation/ui/tokens/themes.css` だけである。
DB が持つのは `graphite-amber` のような**名札**で、
その名札が `[data-brand-theme="graphite-amber"]` を選び、
CSS 側で `light-dark(明るいときの色, 暗いときの色)` が解く。

この分け方の実際の効き目（`src/presentation/ui/appearance.ts:9-11` が既に宣言している）:

> 配色を 1 つ足す → 触るのは domain の一覧と `themes.css` だけ。
> 共通 UI も下の部品も変わらない。

**これが受入 A8「配色を変えても部品は変わらない」の実装そのもの**であり、
A8 は新しく作る機能ではなく、この構造を壊さないことで満たされる。

## 2. 2 つの軸

見た目は掛け合わせではなく **2 つの独立した軸**で決まる。

| 軸 | 型 | 値 | 属性 |
|---|---|---|---|
| 配色 | `BrandTheme` | `graphite-amber` / `indigo-teal` / `teal-clay` / `indigo-clay` / `blue` / `pink` / `white` / `gray` / `green` / `purple`（10 種） | `data-brand-theme` |
| 明暗 | `ColorMode` | `auto` / `light` / `dark` | `data-color-mode` |

正本は `src/domain/authoring/site-blueprint.ts:136,179`。

**掛け合わせの数だけ設定を持たない。**「青系のダーク」という 1 つの名前にすると、
配色が 1 つ増えるたびに設定値が 2 つ増える。

### 2.1 `auto` は属性を出さない

`color_mode = "auto"` のとき、`data-color-mode` 属性を**出さない**
（`appearanceAttributes()` の既存挙動、`src/presentation/ui/appearance.ts:53`）。

出さないことが「端末の設定に従う」の意味になる。
`data-color-mode=""` を出すと、セレクタには当たらないのに属性としては残り、
後から見て理由が分からなくなる。

`light-dark()` が端末設定を見るのは `:root` の `color-scheme: light dark` による。
`data-color-mode` が付いたときだけ `color-scheme` を片方へ固定する。

```css
/* semantic.css — 契約 */
:root { color-scheme: light dark; }
:root[data-color-mode="light"] { color-scheme: light; }
:root[data-color-mode="dark"]  { color-scheme: dark; }
```

## 3. 解決の優先順（読み取り契約）

読者 1 人・1 ページについて、実際に当たる `Appearance` は次の順で決まる。
**上が強い。**

| # | 出どころ | 適用範囲 | 根拠 |
|---|---|---|---|
| 1 | 読者本人が選んだもの（cookie `ah_theme` / `ah_mode`） | その読者だけ | `appearance.ts:27` |
| 2 | `page_theme_override`（そのページの行） | そのページだけ | 受入 A2 |
| 3 | `blog_theme`（ブログ既定） | そのブログ全体 | 受入 A2 |
| 4 | `site_blueprints.theme`（旧正本） | そのブログ全体 | 移行期のフォールバック |
| 5 | `DEFAULT_THEME`（`graphite-amber` / `auto`） | 全体 | `site-blueprint.ts:205` |

### 3.1 読者の選択がブログ既定より強い理由

暗い場所で読む人が、ブログの都合で眩しい画面を強制されないようにするため。
ブログ側の既定は**何も選んでいない人**に対してだけ効く
（`src/domain/authoring/appearance.ts` のコメントが既に宣言している）。

管理画面（`/admin/...`）にはこの階層を適用しない。
管理画面の見た目は `/admin/settings/appearance` が別に持つ。
**A2 は公開面の話であり、管理画面自身の配色ではない**（P01 の screen-inventory §1.3 の注意）。

### 3.2 2 層の合成は軸ごとに独立

`page_theme_override` の `brand_theme` が NULL で `color_mode` が非 NULL のとき、
**配色だけブログ既定を使い、明暗だけ上書きを使う。**

```
効く配色 = override.brand_theme ?? blog_theme.brand_theme ?? blueprint.theme.brandTheme ?? DEFAULT
効く明暗 = override.color_mode  ?? blog_theme.color_mode  ?? blueprint.theme.colorScheme ?? "auto"
```

軸ごとに独立に落とすのは、§2 の「2 軸を掛け合わせない」の帰結である。
片方だけ上書きしたいという要求は正当で、それを表せない設計にしない。

### 3.3 解除は行の削除

受入 A2 の「上書きを解除すると既定へ戻る」は **`DELETE`** で実現する。

両方の軸を NULL にした行を残さない。残すと
「上書きしていない上書き行」が一覧に並び、解除したのに消えないという見え方の破れになる。
この判断は UseCase が持つ（`data-model.md` §3、不変条件 I2）。

## 4. 未知の名札は既定へ落とす

cookie も URL も利用者が書き換えられる。
`parseBrandTheme` / `parseColorMode`（`src/domain/authoring/appearance.ts:52,58`）が
既に「知らない名前は `null`」を返す。**素通しさせない。**

素通しすると、トークンの無い名前が `data-brand-theme` に入り、
どのテーマも当たらない「色が半分だけ既定」の画面になる。

DB から読んだ値にも同じ検証を掛ける。
DB は信用できる、という前提を置かない — migration や手作業の SQL で
語彙の外の値が入る経路が実在する。

## 5. 最初の描画で色が確定していること（FOUC を作らない）

配色は**サーバー側の最初の描画で属性が付いていること**を契約とする。

cookie を使っているのはこのため（localStorage だと画面が出てから JS で直すことになり、
一瞬だけ前の色が見える）。`page_theme_override` の読み取りも
**RSC のサーバー側で解決してから属性を出す**。クライアントで後から当てない。

`page_theme_override` は 1 ページにつき 1 行の読み取りで済むが、
**静的化されたページでは読めない**。該当ページを静的化する場合、
上書きは build 時に解決されるものとし、その旨を運用手順（P12）に残す。

## 6. コントラストの床

`tests/ui/theme-contrast.test.ts` が既に本文コントラストを見ている。
配色を 10 種すべて × `light` / `dark` の 2 通りで検査する
（`auto` は端末設定次第なので、両方の実測で代替する）。

**新しい配色を足すときは、この検査を通ることが追加の条件である。**
通らない配色は名札を足さない。名札だけ足して色が読めない状態は、
選べるのに使えない選択肢を利用者に見せることになる。

## 7. 管理画面の設定 UI が満たすこと

詳細は `component-contract.md` と `admin-api-contract.md`。ここでは配色固有の要求だけ。

| # | 要求 | 理由 |
|---|---|---|
| T1 | 選択肢は**実際の本文の見え方**で見せる。16 進値を見せない | 名札と色の対応を覚えさせない |
| T2 | `light` / `dark` 両方のコントラスト判定を選択前に見せる | 選んでから読めないと分かるのは遅い |
| T3 | ブログ既定の画面から、上書き中のページ枚数が見える | 既定を変えても変わらないページがある、を既定側から気づける |
| T4 | 解除操作の直前に「既定へ戻る」と明示する | `DELETE` であることが利用者には見えない |

T1〜T4 は P01 の `information-priority-map.json` の N2 / N3 の
`keep` / `derive` と対応する。

## 8. 次 phase への引き継ぎ

| 項目 | 引き継ぎ先 |
|---|---|
| `resolveAppearance()` 純関数（§3.2 の合成）の実装 | P06 |
| `ThemePort` / `PageThemeOverridePort` の定義 | P03 |
| §3 の優先順を上から順に潰す境界値テスト | P04 |
| §6 のコントラスト検査を 10 配色へ拡張 | P04 |
| 静的化ページでの上書き解決（§5）の運用手順 | P12 |
