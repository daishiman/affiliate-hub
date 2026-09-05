# 出典の台帳 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P02 の成果物。「どこから来た話か」を残す仕組み。

## 台帳は 1 つではない

出典は**寿命の違う 3 か所**に分かれて置かれている。
専用の台帳表は作っていない。

| 置き場所 | 何の出典か | 寿命 |
|---|---|---|
| `AnswerUnit.sourceRef` | 引用単位の元になった根拠 | 記事と同じ（抽出で作り直される） |
| 記事の `citation`（公開面） | 記事全体の出典 | 記事と同じ |
| `guideline-reference.ts` | この製品が従う指針の出典 | ブログをまたいで長く残る |

### なぜ 1 つにまとめないか

まとめると**掃除の条件が書けなくなる**。

引用単位は抽出のたびに置き換わる。
記事の出典は記事が消えれば消える。
指針の出典はブログが全部消えても残る。

同じ表に置くと、
どの行をいつ消してよいかが行だけからは決まらない。

`feat-seo-assessment-reflection` の `data-model.md` でも
同じ理由で指針の出典を別扱いにしている。

## `AnswerUnit.sourceRef`

```ts
/** 出どころ。断定に根拠が要るのは SEO 側と同じ理由。 */
readonly sourceRef: string | null;
```

抽出側で埋める:

```ts
const evidence = claim.evidence[0];
const sourceRef = evidence === undefined ? null : (evidence.url ?? evidence.sourceLabel);
```

`url` が無ければ `sourceLabel` を使う。

### URL が無くても落とさない

書籍や実測は URL を持たない。

**URL を持たないことを理由に落とすと、
出典欄には並んでいるのに機械には「出典の無い記事」に見える。**

これは `citation` の実装でも同じ判断をしている:

```ts
citation: sources.items.map((item) => ({
  "@type": "CreativeWork",
  name: item.label,
  ...(item.url === undefined ? {} : { url: item.url }),
})),
```

名前だけでも出す。URL があれば足す。

### `null` を許す

`sourceRef` は `null` 可である。

根拠を必須にしていない。

代わりに、**`kind === "fact"` かつ `sourceRef === null` のときだけ**
`unsourced-claim` の隙間として指摘する。

| `kind` | `sourceRef` が `null` |
|---|---|
| `fact` | **指摘する** |
| `definition` / `direct-answer` / `step-list` / `comparison` | 指摘しない |

数値や事実の断定には出どころが要る。
語義や手順に毎回出典を求めるのは現実的でない。

### SEO 側との違い

| | SEO の `evidence` | AEO の `sourceRef` |
|---|---|---|
| NULL 可 | **不可**（`NOT NULL`） | 可 |
| 何の根拠か | 機械が数えた事実（「タイトルが 72 文字」） | 記事が引いている外部の出典 |

**別のものである。**

SEO の `evidence` は「なぜこの指摘を出したか」で、
機械が自分で数えた値が入る。根拠なしはありえない。

AEO の `sourceRef` は「記事の主張がどこから来たか」で、
記事が持っていなければ無い。

## 記事全体の `citation`

`BlogPosting.citation` に `CreativeWork` の配列で出す。

### 主張ごとの出典とは別責務

```
画面内の EvidenceList は「どの主張の根拠か」という文脈を持つので、
同じ出典を主張ごとに残す。記事全体の citation とは別の表示責務である。
この 2 つは意図的に違う形をしている。
```

- 主張ごと: 「この数字はここから」
- 記事全体: 「この記事はこれらを参照した」

同じ出典が両方に出るが、重複ではない。

## 指針の出典（`guideline-reference.ts`）

この製品が「SEO / AEO とはこういうものだ」と考える根拠。

90 日で見直す（`REVIEW_INTERVAL_DAYS = 90`）。

- `contentSha256` と `previousSha256` を同じ行に持ち、変化を検出
- 再取得（`fetchedAt`）と再評価（`reEvaluatedAt`）を分ける
- 原典未取得は `unverified` で、日付が新しくても `verified_fresh` を名乗れない

詳しくは
`docs/spec/feat-seo-assessment-reflection/validation-design.md`。

## 足りていないこと

**引用単位の出典が変わった履歴を持っていない。**

抽出は置き換えなので、
`sourceRef` が `null` から URL に変わっても、
逆に消えても、行の差分としては残らない。

監査には件数しか残らない
（`aeo_answer_units.extracted`）。

出どころが消えたことに気づく手段が無い。

`design-review-findings.md` に記録した。
