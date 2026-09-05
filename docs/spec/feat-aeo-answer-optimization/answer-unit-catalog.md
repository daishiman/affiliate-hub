# 引用単位の種類 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P02 の成果物。正本は `src/domain/aeo/answer-unit.ts`。

## 単位は 5 種

`ANSWER_UNIT_KINDS`:

| 値 | 表示名 | 何を答えるか |
|---|---|---|
| `definition` | 語の意味 | 「〜とは何か」 |
| `direct-answer` | 問いへの答え | 問いへの短い答え |
| `step-list` | 手順 | 「どうやるか」 |
| `comparison` | 比較 | 「どちらがよいか」 |
| `fact` | 事実・数値 | 数値や事実 |

### なぜ型を持つのか

同じ記事でも、**問いの形によって引用される部分が違う**。

「〜とは？」と聞かれたときに引かれるのは語義の段落で、
「〜のやり方は？」なら手順の節である。

1 記事 = 1 回答として扱うと
どの部分が引かれたのか分からず、直す場所を決められない。

## 問いが必ず付く

```ts
export function validateAnswerUnit(
  unit: Pick<AnswerUnit, "question" | "answer">,
): Result<true, DomainError>
```

問いが空なら弾く。答えが空でも弾く。

### なぜ問いを必須にしたか

**答えだけの断片は、何に対する答えか分からない。**

単体で引用されると意味が変わる。

「3 か月です」という文は、
「どのくらいで乾くか」の答えなら正しく、
「保証期間」の答えとしては嘘になる。

## 答えの長さは 300 文字まで

```ts
export const MAX_ANSWER_UNIT_LENGTH = 300;
```

これを超えると、回答エンジンは要約し直すか、丸ごと使わない。

**どちらの場合も、書き手が意図した言い回しは読者へ届かない。**

## 埋もれの閾値は 0.5

```ts
export const BURIED_ANSWER_THRESHOLD = 0.5;
```

答えが記事の後半（`positionRatio > 0.5`）にあると
「埋もれている」と判定する。

記事の後ろにある答えは、
回答エンジンにとっても読者にとっても見つけにくい。

## 隙間は 6 種

`AEO_GAP_KINDS`:

| 値 | 表示名 | 機械が判定できるか |
|---|---|---|
| `no-direct-answer` | 問いに直接答えている箇所がない | 抽出 0 件で分かる |
| `answer-too-long` | 答えが長すぎて引用できない | **文字数** |
| `buried-answer` | 答えが記事の奥に埋もれている | **位置比** |
| `unsourced-claim` | 出どころのない断定がある | **`sourceRef === null` かつ `kind === "fact"`** |
| `ambiguous-subject` | 主語が曖昧で単体では意味が通らない | **指示語で始まるか** |
| `missing-qa-markup` | 問答の構造化データがない | 構造化データの出力で分かる |

### `detectGaps` が実装しているのは 4 つ

```ts
export function detectGaps(unit: AnswerUnit): readonly AeoGapKind[] {
  const gaps: AeoGapKind[] = [];
  if (unit.answer.length > MAX_ANSWER_UNIT_LENGTH) gaps.push("answer-too-long");
  if (unit.positionRatio > BURIED_ANSWER_THRESHOLD) gaps.push("buried-answer");
  if (unit.kind === "fact" && unit.sourceRef === null) gaps.push("unsourced-claim");
  if (/^(これ|それ|あれ|この|その|あの|こう|そう)/.test(unit.answer.trim())) {
    gaps.push("ambiguous-subject");
  }
  return gaps;
}
```

**単位 1 つを見て判定できるものだけ**をここに置いた。

`no-direct-answer` は「単位が 1 つも取れなかった」という
記事全体の事実なので、単位からは出せない。

`missing-qa-markup` は構造化データを出すかどうかの設定
（`structuredDataEnabled`）で決まるので、
ブログの構えの側の話である。

### 指示語の判定について

`これ / それ / あれ / この / その / あの / こう / そう` で始まる答えを
`ambiguous-subject` とする。

**荒い判定である。**

「これから説明します」は指示語で始まるが曖昧ではない。
逆に「同社は」で始まる答えは曖昧だが引っかからない。

それでも入れたのは、
**指示語で始まる文が単体で引用されると高確率で意味が壊れる**からで、
偽陽性のほうが偽陰性より安い。

指摘であって禁止ではないので、
運用者が見て「これは大丈夫」と判断できる。

## 「もっと分かりやすく」を出さない

`detectGaps` の doc:

> 機械が現物を見て真偽を判定できるものだけを返す。
> 「もっと分かりやすく」のような指摘は、
> 直したかどうかを誰も確かめられないので出さない。

SEO 側の `evidence` 必須と同じ方針である。

## ブログの構え

```ts
export type SiteAeoProfile = {
  siteSlug, topicScope, audience, publisherName,
  structuredDataEnabled, updatedAt,
};
```

記事ごとの単位とは別に持つ。

**「このブログは何に答える場所か」が記事をまたいで一貫していないと、
どの記事も中途半端に引かれるだけで終わる。**

`publisherName` は構造化データの発行元になるので、
表示用の名前ではなく、名乗る主体として扱う。
