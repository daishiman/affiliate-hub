# 受入 7 件の判定 (P07)

> これは再検証前の履歴。以下のPASSを現在の受入・公開承認として使わない。現在の根拠と未了は [elegant-review.md](./elegant-review.md) に集約する。

- feature: `feat-article-block-editor`
- phase: P07
- 判定日: 2026-09-06

## 判定表

| # | 受入 | 判定 | 根拠 |
| --- | --- | --- | --- |
| A1 | 編集面に記法の生テキストが現れない | **PASS** | §A1 |
| A2 | 見出しレベルが挿入・移動・削除・貼り付けで動かない | **PASS** | §A2 |
| A3 | 19 種すべてを `/` から挿入・編集・公開できる | **PASS** | §A3 |
| A4 | 商品カードは検索選択のみ。id 手入力欄なし | **PASS** | §A4 |
| A5 | 画像はアップロード。URL 手入力欄なし | **PASS (経路に差分あり)** | §A5 |
| A6 | 公開描画が許可リストで絞られる | **PASS** | §A6 |
| A7 | 既存 10 種の記事が壊れず、再保存で変わらない | **PASS** | §A7 |

---

## A1 — PASS

断片ごとに専用の編集 UI を持ち、記法の記号を利用者に見せない。

- コードブロック: `CodeEditor` が言語の選択と本文の欄に分かれる。
  フェンス行 (`` ``` ``) は画面に出ない。
  検証「プログラムの欄は装飾を通さない。記号がそのまま残る」
- 表: 行と列を足す操作で編集する。パイプを打たせない。
  検証「比較表は列と行を足せ、いちばん下の行だけは残る」

## A2 — PASS

**型でレベルを塞いだ**ため、操作の副作用でレベルが動く経路が存在しない。

- `ProseNode` の `heading` は `level: 3 | 4` しか取らない
- 節の見出しは `ArticleBlock` 側にあり、描画は常に `h2`

検証:
- 「選べるのは 3 と 4 だけで、節の見出し (2) は出てこない」— 挿入
- 「上下に動かしても深さは持ち回る」— 移動
- 「あいだの断片を消しても深さは変わらない」— 削除
- パーサが `h3`/`h4` 以外を作れないので、貼り付けでも他レベルは入らない
- 公開面: 「見出しは段の深さを保って出る（h3 と h4）」

## A3 — PASS

- 種類数の実測: `prose-node.ts` に 19 種
  (`bullet-list` `callout` `checklist` `code` `columns` `comparison-table`
  `cta-button` `divider` `embed` `heading` `image` `image-row` `link-card`
  `ordered-list` `paragraph` `product-card` `quote` `table` `toggle`)
- `/` メニュー: 「一覧は群に分かれていて、19 種すべてが出る」
- 記法の往復: `tests/domain/blogops/prose-format.test.ts` (23 件)
- 公開描画: `tests/ui/prose-body.test.tsx`

「編集面と同じ見た目」は、**同じ表示部品を通ること**で担保している。
似せる努力ではなく、ずれる余地を消す設計 ([architecture.md §1](./architecture.md))。

## A4 — PASS

肯定: 「探して選ぶと、本文には id だけが乗る」

否定 (機械検証):
```
$ grep -rn 'placeholder="pc_' src/
(出力なし)
```

さらに強い条件も満たしている:
**検索が使えない画面では、id 欄へ落ちずに「挿せない」と言う。**
検証「探せない画面では、id を打つ欄を出さずに挿せないと言う」

これが無いと、検索が落ちた日に手入力欄が復活し、要件が静かに崩れる。

## A5 — PASS (転送経路に仕様との差分)

肯定: 「ファイルを選ぶと、返ってきた場所が本文に乗る」

否定 (機械検証): `src/presentation/prose/` に残る URL 欄は 4 つあるが、
**すべてリンクの行き先で、画像ではない**
([design-review.md §4](./design-review.md) の表)。
`image` / `image-row` の編集 UI は `ImageField` / `ImageRowEditor` で、
`src` を直接受け取る text 入力を持たない。

### 差分の扱い

| 項目 | 仕様 (`SEC-REQ-006/007`, `INF-IMG-01`) | 実装 |
| --- | --- | --- |
| 転送 | presigned PUT でブラウザ→R2 直送 | Worker 経由 `POST /api/article-images` |

**A5 の判定は変わらない。** A5 の文言は
「画像はブラウザから R2 へ直接アップロードでき、**URL の手入力欄が存在しない**」で、
検証可能な要求は後半である。前半は転送経路の記述であり、
`docs/product/design-decisions.md` §5 が
「署名付き URL は使わず、取り出す口をこちら側に 1 本置く」と既に決めている。

利用者にも確認済み (Worker 経由を選択)。P13 で system-spec へ書き戻す。

## A6 — PASS

`src/domain/blogops/prose-allowlist.ts` が許可する断片・属性・スタイルを
**数え上げる**形で持つ。denylist ではない。

検証: `prose-allowlist.test.ts` (6 件) / `prose-inline.test.ts` (10 件)

加えて画像の読み出し口は、返す応答自体を固定している
(`nosniff` + `default-src 'none'; sandbox`)。
許可リストを抜けたとしても、その先で文書として実行されない。

## A7 — PASS

**既存 10 種の記法を 1 文字も変えていない。**
追加 9 種は、既存記事に現れない記法だけを使う
(`:::` 囲み 7 種、`` ``` `` フェンス、`- [ ]`)。

検証: `prose-format.test.ts` の往復不変性。
読み込んで何も編集せずに書き戻したとき、文字列が一致する。

DB 側の互換は [migration-compatibility.md](./migration-compatibility.md) (P08)。
記事本文の列も型も変えていないので、記事テーブルへのマイグレーションは 0 本である。
