# 設計レビューと境界の独立検証 (P03)

- feature: `feat-article-block-editor`
- phase: P03
- 検証日: 2026-09-06

## 1. 受入と設計要素の対応

| 受入 | 設計要素 | 置き場所 |
| --- | --- | --- |
| A1 記法の生テキストが出ない | 断片ごとに専用の編集 UI。`CodeEditor` が言語と本文を分ける | `prose-editor.tsx` |
| A2 見出しレベルが動かない | `level: 3 \| 4` の型固定 + 節は `ArticleBlock` 側 | `prose-node.ts` |
| A3 19 種が挿入・編集・公開できる | `PROSE_MENU_GROUPS` (5 群) + 描画部品の共有 | `prose-editor.tsx` / `prose-body.tsx` |
| A4 商品は検索選択のみ | `pick-list.tsx` + `GET /api/article-products` | `article-asset-client.ts` |
| A5 画像はアップロードのみ | `ImageField` / `ImageRowEditor` + `POST /api/article-images` | 同上 |
| A6 許可リスト描画 | `prose-allowlist.ts` | domain |
| A7 既存記事が壊れない | 既存 10 種の記法を変えない | `prose-format.ts` |

## 2. スコープ外の非侵犯 (grep 根拠)

feature の `scope_out` は、表現ブロック側の 3 ファイルを触らないことを求める。

```
$ git status --porcelain | grep -E "blog-template|expression-article-block|expression-block-view"
(出力なし)
```

- `src/domain/authoring/blog-template.ts` — 未変更
- `src/application/adapters/expression-article-block.ts` — 未変更
- `src/presentation/site/expression-block-view.tsx` — 未変更

**`ExpressionBlock` と `ProseNode` は統合していない。**
名前も概念も似ているが、前者はテンプレートの見た目部品、
後者は記事本文の意味単位である。混ぜると、テンプレートを変えたら
記事本文が変わる、という因果が生まれる。

## 3. A4 の否定条件 — 機械検証

```
$ grep -rn 'placeholder="pc_' src/
(出力なし)
```

商品 id を受け取る text 入力は 1 つも残っていない。
`product-card` の編集 UI は `pick-list` (検索して選ぶ) だけを持つ。

## 4. A5 の否定条件 — 機械検証

`src/presentation/prose/` に残る URL 入力欄は 4 つある。
**すべて画像ではない**ことを確認した。

| 場所 | 欄 | 種別 | 判定 |
| --- | --- | --- | --- |
| `rich-text.tsx:239` | 行内リンクの行き先 | リンク先 | A5 対象外 |
| `prose-editor.tsx:623` | 埋め込みの宛先 | `embed` の**本体** | A5 対象外 |
| `prose-editor.tsx:643` | ボタンの行き先 | `cta-button` のリンク先 | A5 対象外 |
| `prose-editor.tsx:675` | リンクカードの行き先 | `link-card` のリンク先 | A5 対象外 |

画像断片 (`image`) と並列画像 (`image-row`) の編集 UI は
`ImageField` / `ImageRowEditor` で、どちらも `onUpload` を受け取る。
**`src` を直接受け取る text 入力は存在しない。**

```
case "image":
  return <ImageField alt={…} onUpload={onUploadImage} src={node.src} … />;
```

なお 4 つの URL 欄はいずれも `UrlField` を通り、`check` (`safeHref` /
`safeEmbedUrl`) で行き先を絞っている。`javascript:` などは入らない。
`link-card` は「見出しと説明を相手のページから取ってこない」と明記してある。
外のページを勝手に取りに行かない、という設計判断である。

## 5. 指摘 (設計段階で直したもの)

| # | 指摘 | 対応 |
| --- | --- | --- |
| 1 | `markArticleImagesReferenced` が `false` のとき `last_referenced_at` を null にしていた | 関数を 2 本に分割。外れても時刻を消さない |
| 2 | 回収索引が (`referenced`, `created_at`) で、外れた画像を拾い直せない | (`created_at`) 単独へ変更 (`0048`) |
| 3 | 台帳 insert が R2 put より先だった | 順を入れ替え。孤児オブジェクトのほうが軽い壊れ方 |

いずれも「動くが、時間が経ってから静かに壊れる」種類である。

## 6. 残る差分 (follow-up ではなく記録)

`SEC-REQ-006` / `SEC-REQ-007` / `INF-IMG-01` は presigned PUT を前提に書かれているが、
実装は Worker 経由を採った。根拠は `docs/product/design-decisions.md` §5。
**P13 で system-spec へ書き戻す。**
