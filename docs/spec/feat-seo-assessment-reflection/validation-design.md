# 構造化データの検証 — SEO の診断と反映 (feat-seo-assessment-reflection)

P02 の成果物。受入条件 3・4 に対応する。
正本は `src/application/seo/structured-data.ts`。

## 純関数であること

条件 3 は「妥当性検証が純関数で、外部通信なしにテストできる」。

`structured-data.ts` は `fetch` も環境変数も読まない。
入力は公開記事の投影（`PublishedArticle`）とサイト情報、
出力は JSON-LD のオブジェクトである。

画面（presentation）は出来上がった文字列を
`<script type="application/ld+json">` に置くだけ
（`src/presentation/site/json-ld-script.tsx`）。

### なぜ外部検証器を呼ばないか

Google の Rich Results Test のような外部検証器を呼ぶと:

- 通信が要る → テストが遅く、不安定になる
- 相手の都合で結果が変わる → 同じ記事から違う指摘が出る
- 落ちているときに診断が回らない

**自分で判定できることを、他所に聞きに行かない。**

外部検証器でしか分からないこと（実際にリッチリザルトが出るか）は、
そもそも条件 9 が禁じている「検証できない指摘」にあたる。

## URL を組み立て直さない

```ts
const url = `${site.origin}${site.basePath}${articleHref(article)}`;
```

記事の URL は `articleHref` から引く。**ここで組み立て直さない。**

組み立て直すと、画面のリンクと構造化データの URL が
別々にずれる。ずれても画面は正しく見えるので、
検索エンジン側でしか気づけない。

## 同じ射影から作る

構造化データも画面と同じ `expressionBlocksOf(article)` から作る。

`sections[].claims[].evidence` を自前で辿り直すと、
重複のまとめ方や期限切れの扱いが監査と別々に育ち、
**公開判定と検索エンジンへ渡す集約出典が食い違う**。

画面内の `EvidenceList` は「どの主張の根拠か」という文脈を持つので、
同じ出典を主張ごとに残す。記事全体の `citation` とは別の表示責務である。
この 2 つは意図的に違う形をしている。

## 空の構造を作らない

```ts
...(person.credentials.length === 0
  ? {}
  : { hasCredential: person.credentials.map(...) })
```

資格が 1 つも無いときは**キーごと省く**。

空配列の資格一覧は「資格の無い資格持ち」という嘘の構造になる。
`hasCredential: []` は「資格を持っているが、それは空である」と読める。

### 著者の URL は常に出す

`url` は `/authors/<slug>` を指す。

E-E-A-T の「誰が言っているか」を機械が辿れる形にするのが目的で、
**辿れない URL を出すくらいなら出さないほうがよい**。

著者ページは公開ルートとして常に実在する
（`view-model.ts` の `authorHref` と同じ道）ので、常に出す。

## 不正なものが指摘として立つ（条件 4）

`structured-data` は診断の観点の 1 つでもある
（`assessment-catalog.md`）。

組み立てた結果が不正なら指摘が立ち、妥当なら立たない。
**両方向を確かめる**のが条件 4 の要点で、
「不正が立つ」だけだと、常に立つ実装でも通ってしまう。

テストは `tests/application/seo/structured-data.test.ts`（19 件）。

## 指針の出典を 90 日で見直す（条件 10）

`src/domain/seo/guideline-reference.ts`:

```ts
export const REVIEW_INTERVAL_DAYS = 90;
```

指針は生きた文書で、黙って変わる。
URL を貼るだけでは「いつの内容を根拠にしたか」が残らない。

### 確認の深さを 2 段階に分けた

```ts
type GuidelineVerification =
  | { kind: "summary_only" }
  | { kind: "source_fetched"; fetchedAt; contentSha256; previousSha256?; ... };
```

確認日だけでは、**要旨を読んだ**のと**原典の本文を取得した**のが
区別できない。

区別が無いと、要旨しか読んでいない行が原典確認済みの行と
同じ見た目で並び、**日付が新しいほど確かに見える**という
逆さまが起きる。

但し書き（`note`）に書いても、それは人が読む文であって
機械は判定に使えない。

### 指紋を 2 つ並べて持つ

`contentSha256` と `previousSha256` を**同じ行に**置く。

「前回」を別の表に置かない。
指針の変化に気づけるかどうかはこの 2 つが並んでいるかだけで決まり、
離すと片方だけ消える。

### 再取得と再評価を分ける

`reEvaluatedSha256` / `reEvaluatedAt` が別にある。

取得を繰り返した事実と、
その本文について仕様章を読み直した事実は別である。

再取得だけでここが動くと、
**本文が変わったという警告を、確認しないまま消せてしまう**。

## 状態は 3 つ

`ReferenceReviewStatus`:

| 値 | 意味 |
|---|---|
| `verified_fresh` | 原典を取得済みで、確認日も 90 日以内 |
| `review_due` | 確認日から 90 日超（原典取得の有無によらず読み直す） |
| `unverified` | 原典の本文をまだ取得していない |

日数の計算は UTC の 0 時に固定して行う。
`Date.parse` に任意の書式を読ませない。
端末の時差で 1 日ずれる余地を消すためである。

テストは `tests/domain/seo/guideline-reference.test.ts`（14 件）。
