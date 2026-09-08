# 19 種断片カタログと保存形式の決定 (P01)

- feature: `feat-article-block-editor`
- phase: P01
- 接地元: `src/domain/blogops/prose-node.ts`, `src/domain/blogops/prose-format.ts`

## 1. 保存形式の決定

**決定 `dec-article-body-storage-format` = `opt-extended-markdown-string`** (利用者確認済み)

記事本文は、これまで通り**拡張 Markdown の 1 本の文字列**として D1 に保存する。
JSON 木として保存し直すことはしない。

理由:

1. 既存記事がすべてこの形で入っている。形を変えると A7 (既存記事が壊れない) が
   移行の成否に依存してしまう。文字列のままなら、既存記事は「新しい記法を
   1 つも使っていない記事」として何もせず読める。
2. 本文はいずれ人が直接読み書きしうる。JSON 木は機械には正確だが、
   壊れたときに人が直せない。
3. **19 種への拡張は DB マイグレーションを必要としない。** 列も型も変わらない。
   増えるのは文字列の中の記法だけである。

代償として、パーサとシリアライザの往復不変性がこの feature の生命線になる。
そこは `tests/domain/blogops/prose-format.test.ts` が全種について見る。

## 2. 断片カタログ (19 種)

### 既存 10 種 (記法は変えない)

| kind | 保存形式 | 属性 |
| --- | --- | --- |
| `paragraph` | 素の行 | `text` |
| `heading` | `### ` / `#### ` | `level` (3\|4), `text` |
| `bullet-list` | `- ` | `items[]` |
| `ordered-list` | `1. ` | `items[]` |
| `quote` | `> ` | `text` |
| `callout` | `:::callout tone=… title=…` | `tone`, `title`, `text` |
| `product-card` | `:::product-card id=…` | `productId` |
| `comparison-table` | パイプ表 (素) | `headers[]`, `rows[][]` |
| `image` | `![alt](src)` | `src`, `alt` |
| `divider` | `---` | — |

**既存 10 種の記法を 1 文字も変えないことが A7 の根拠**である。
追加 9 種はすべて、既存の記事には現れない記法だけを使う。

### 追加 9 種

| kind | 保存形式 | 属性 | 決定の理由 |
| --- | --- | --- | --- |
| `code` | `` ```lang `` フェンス | `language`, `text` | Markdown 標準の記法をそのまま使う。編集面ではフェンス行を見せず、言語選択と本文欄に分ける (A1) |
| `table` | `:::table` + パイプ表 + `:::` | `headers[]`, `rows[][]` | 素のパイプ表は `comparison-table` が既に取っている。囲みで包んで**別種と区別**する |
| `image-row` | `:::image-row` + `![]()` 複数 + `:::` | `images[]` | 中身は既存の画像記法の並びなので、パーサを共用できる |
| `toggle` | `:::toggle title=…` | `title`, `text` | 折りたたみ。title は属性、本文は囲みの中 |
| `checklist` | `- [ ] ` / `- [x] ` | `items[]` (`text`, `checked`) | GitHub Flavored Markdown と同じ記法。`bullet-list` と先頭で判別できる |
| `embed` | `:::embed url=… title=…` | `url`, `title` | 外部埋め込み。**属性に URL を持つが、これは断片の本体**であり A5 の「画像 URL 手入力」とは別物 |
| `cta-button` | `:::cta-button …` | ラベル・リンク | 行動喚起ボタン。公開面でのみ意味を持つ |
| `link-card` | `:::link-card …` | URL・見出し | リンクの見せ方だけが `embed` と違う |
| `columns` | `:::columns` + 左 + `:::split` + 右 + `:::` | `left`, `right` | 2 段組み。区切りに `:::split` を使い、入れ子の `:::` と衝突させない |

### 記法の設計則

追加 9 種のうち 7 種が `:::name attr=…` … `:::` の**同じ形**をしている。
これは意図的である。パーサ側は「囲みを 1 つ切り出す」処理を 1 か所に持ち、
`name` で分岐するだけで済む (`prose-format.ts` の `case` 群)。
記法ごとに固有のパーサを書くと、種類が増えるたびに壊れる場所が増える。

例外は `code` と `checklist` で、どちらも **Markdown に既にある記法**を使った。
自前の囲みを新設するより、外の世界と同じ形のほうが将来の移出入で得をする。

## 3. 2 層モデル (節と断片)

| 層 | 型 | 見出し | 責務 |
| --- | --- | --- | --- |
| 外側 = 節 | `ArticleBlock` | `h2` 固定 | 記事の章立て |
| 内側 = 断片 | `ProseNode` | `h3` / `h4` | 節の中身 |

この 2 層はドメインには元からあったが、編集面が層の別を見せていなかった。
P05 で編集面に層を表示する。**ドメインのモデルは変えない。**

## 4. スコープ外との境界

`src/domain/authoring/blog-template.ts` の `ExpressionBlock` は「表現ブロック」で、
本 feature の `ProseNode` (記事版面ブロック) とは**別の概念**である。
名前が似ているが統合しない。`ExpressionBlock` はテンプレート側の見た目部品、
`ProseNode` は記事本文の意味単位である。P03 が grep 根拠でこの非侵犯を確認する。
