# HowTo と Speakable の導出規則

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P01`
- 状態: 確定 (P01 成果物)
- 姉妹文書: [requirements-baseline.md](./requirements-baseline.md) / [retention-policy.md](./retention-policy.md)

## D1: HowTo の導出元

### 決定

公開記事の `sections` から `id === "steps"` の節を 1 件引き、その `paragraphs`
(空行区切りの段落列) を **1 段落 = 1 手順** として `HowTo.step` へ写す。
`steps` 節が無い、または `paragraphs` が空のときは builder が `null` を返す。

補助フィールドも同じ経路で引く:

| HowTo のフィールド | 導出元の section id | 記事型 `guide` での節ラベル |
|---|---|---|
| `step[]` | `steps` | 全手順 |
| `totalTime` | `required_time` | 必要時間 |
| `estimatedCost` | `required_cost` | 必要費用 |
| `supply` / `tool` の元情報 | `prerequisites` | 事前準備 |
| `description` | `outcome_state` | 完了後の状態 |

### 根拠

**1. 手順は表現ブロックではなく記事型の節に住んでいる。**
`src/domain/authoring/blog-template.ts` の `EXPRESSION_BLOCK_KINDS` は
`answer` / `key_points` / `faq` / `sources` / `freshness` / `figure` /
`comparison` / `cta` / `summary` / `spec_table` の 10 種で、**手順は含まれない**。
一方 `src/domain/authoring/article-structure.ts` の `ARTICLE_TYPE_SECTIONS.guide` は
8 節すべてが `required` で、そのうち `steps` (全手順) が「順番に実行できる粒度で書く」
という説明を持つ。したがって手順の住所は表現ブロック側ではなく記事型の節側にある。

**2. section id で確実に引ける。**
`src/application/usecases/site/publish-article.ts:701` が

```ts
const sections: readonly PublishedSection[] = written.map((s) => ({
  id: s.id,
  ...
}));
```

としているため、`PublishedSection.id` は `SectionId` そのもの。
`sections.find(s => s.id === "steps")` は文字列の当て推量ではなく型で保証された参照になる。

**3. 読み取りモデルへ手順専用の欄を足さない。**
`src/application/read-models/published-article.ts` の `PublishedArticle` は
`sections` を持つが手順専用の欄を持たず、専用欄を持つのは `keyPoints` だけ。
その `keyPoints` にはコメントで「同じ事実が 2 か所に載る」ことを避ける意図が記されている。
`steps` は `sections` から引けるのだから、専用欄を足せば同じ手順が 2 か所に載り、
片方だけ更新される事故の口を開ける。足さない。

**4. 出せないときは `null`。**
`src/application/seo/structured-data.ts` の `buildFaqPage` / `buildItemList` は
出せないとき `null` を返し、`hasCredential` / `datePublished` / `citation` は
出せないときキーごと省く。この 2 つの作法に揃える。
空の `HowTo` は「手順の無い手順書」という事実に反する構造データになるため出さない
(空の `FAQPage` が「質問の無い FAQ」になるのと同じ理由)。

### 帰結

- A1 の「手順ブロックを持つ記事」の正確な意味は **「記事型が `guide` で `steps` 節が埋まっている記事」**。
- `ranking` / `review` / `comparison` / `tool` の 4 型は `steps` 節を持たないので、
  定義上 HowTo は出力されない。これは条件分岐ではなく構造からの帰結であり、
  記事型が増えても `steps` 節を持たない限り自動的に HowTo は出ない。

## D2: Speakable の読み上げ対象

### 決定

`speakable` は `SpeakableSpecification` を `cssSelector` で与え、対象は次の 2 か所に限る。

| 順序 | 対象 | 読み取りモデル上の住所 | 表現ブロック |
|---|---|---|---|
| 1 | 冒頭の結論 | `PublishedArticle.summary` | `answer` |
| 2 | 要点 | `PublishedArticle.keyPoints` | `key_points` |

両方が空のときは `speakable` を出力しない (`null` を返す)。
片方だけ非空のときは、その 1 つだけを指す。

公開ページ側には、この 2 か所に **安定した selector** を持たせる。
selector は表示上の装飾クラスではなく、この用途のための識別子とする
(装飾クラスはデザイン変更で消えるため、読み上げ宣言の宛先にできない)。

### 根拠

**1. `AI_FIRST` と一致する。**
`blog-template.ts` の `AI_FIRST` は `["answer", "key_points"]` で、
テンプレート整列時にこの 2 種が記事先頭へ寄せられる。
「記事の冒頭で結論と要点を先に述べる」という既存の並び決定が、
そのまま「音声で最初に読み上げるべき箇所」と一致する。
別の対象を選ぶと、画面上の並びと読み上げの並びが食い違う。

**2. 読み取りモデルに住所がある 2 つだけを選んでいる。**
`expressionBlocksOf` が返すのは `answer` / `key_points` / `faq` / `sources` /
`freshness` の 5 種で、このうち読み取りモデルに専用欄を持つのは `keyPoints` だけ、
`answer` は `summary` に対応する。残る `faq` / `sources` / `freshness` は
読み上げ対象として適さない (質問応答の羅列・URL の列挙・日付)。

**3. `cssSelector` は実在する要素を指す必要がある。**
schema.org の `SpeakableSpecification` は `cssSelector` か `xpath` のいずれかを要求する。
どの要素にも一致しない selector を書くことは、読み上げ機構に対して
「ここを読め」と言いながら何も無い場所を指すことであり、A2 の反例に当たる。
したがって公開ページ側の安定 selector 付与は D2 と不可分であり、P05 で同時に行う。

**4. 出せないときは `null` (D1 と同じ作法)。**

## D3 との関係

本文書は「何を構造化データにするか」を決める。
その結果を **いつ点検し、どれだけ残すか** は
[retention-policy.md](./retention-policy.md) が決める。
両者は `AiSearchCheck` (7 チェック) を共有点として接続する —
D1/D2 が満たされているかは、既存の `auditArticleForAiSearch` の
「冒頭に結論」「要点」チェックがそのまま見ている。

## この文書が扱わないこと

- 関数シグネチャ・型定義・ファイル配置 (P02 が所有する)
- 実際の selector 文字列の決定 (P02 が公開ページの構造と合わせて決める)
- 既存 builder との重複有無の独立検証 (P03 が所有する)
