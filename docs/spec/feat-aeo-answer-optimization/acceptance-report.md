# 受入条件の照合 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P08 の成果物。`requirements-baseline.md` の 10 件を実装と突き合わせた結果。

## 結果

| # | 条件 | 判定 |
|---|---|---|
| 1 | 記事から引用単位を切り出して保存できる | 達成 |
| 2 | 引用されにくい形を隙間として指摘できる | **一部**（6 種のうち 4 種） |
| 3 | 同じ問いは 1 行（問いが鍵） | 達成 |
| 4 | ブログごとに構えを持てる | 達成 |
| 5 | FAQ を構造化データへ出せる | 達成 |
| 6 | 誰が答えているかを機械へ渡せる | 達成 |
| 7 | 断定の出どころを出せる | 達成 |
| 8 | AI クローラへ読んでよいと伝える | 達成 |
| 9 | 壊れているとき 200 を返さない | 達成 |
| 10 | 抽出と構えで権限を分ける | 達成 |

**10 件中 9 件達成。1 件が一部達成。**

## 達成した条件の根拠

### 1. 引用単位の切り出し

`createAnswerUnitExtractor`（`src/infrastructure/improvement/answer-unit-extractor.ts`）が
6 か所から切り出す。

`src/presentation/composition.ts:2202` で
`manage-aeo-answers` へ配線されている。

d1「抽出 0 件は失敗ではない」「問いか答えが空の単位は保存しない」で確認。

### 3. 問いが鍵

```sql
CREATE UNIQUE INDEX article_answer_unit_question_idx
  ON article_answer_unit (workspace_id, site_slug, article_slug, question);
```

d1「抽出し直すと、記事から消えた問いは表からも消える」
「他の記事の単位は、抽出し直しても巻き添えにならない」で確認。

### 4. ブログの構え

`site_aeo_profile`。行が無ければ `null`。

d1「構えが未設定のブログは null を返す（既定値をでっち上げない）」
「構えは上書き保存できる」で確認。

### 5. FAQ の構造化データ

`buildFaqPage`。0 件で `null`、`</script>` を閉じさせない。

structured-data 3 件で確認。

### 6. 名乗り

`buildPerson`。`url` は常に実在する著者ページ、
資格 0 件で `hasCredential` ごと省く、監修者は `contributor`。

structured-data 4 件で確認。

### 7. 出どころ

記事の `citation`（URL の無い出典も名前だけで出す）と
`AnswerUnit.sourceRef`。

### 8. AI クローラ

```ts
export const AI_CRAWLERS = ["GPTBot","ClaudeBot","PerplexityBot","Google-Extended"] as const;
```

feeds「AI クローラー 4 種を明示的に Allow する」
「既定の User-agent: * が Allow: / で始まる」
「遮断（Disallow）を 1 行も書かない」で確認。

### 9. 壊れたら 200 を返さない

seo-route-handlers 4 件、machine-feeds「記事が読めなければ、
欠けた配信物を 200 で配らない」で確認。

### 10. 権限

| 操作 | 権限 |
|---|---|
| `read` | `content.read` |
| `extract` | `content.write` |
| `save_profile` | `site.manage` |

usecase「記事を書く人は抽出できるが、構えは保存できない」で確認。

## 条件 2 が一部達成である理由

`AEO_GAP_KINDS` は 6 種を定義しているが、
`detectGaps` が返すのは 4 種だけである。

| 隙間 | 出る |
|---|---|
| `answer-too-long` | はい |
| `buried-answer` | はい |
| `unsourced-claim` | はい |
| `ambiguous-subject` | はい |
| `no-direct-answer` | **いいえ** |
| `missing-qa-markup` | **いいえ** |

どちらも単位 1 つを見ても判定できない
（`answer-unit-catalog.md` / `design-review-findings.md` F-03）。

- `no-direct-answer` = 記事から単位が 1 件も取れなかったという事実
- `missing-qa-markup` = ブログの `structuredDataEnabled` が偽であるという事実

**一覧の値としては存在するが、誰も出していない。**

隙間の一覧に載っているのに一度も出ないものがあることを
「達成」と書くのは正確でないので、一部達成とした。

## 受入条件に無いが未対応のこと

`design-review-findings.md` に記録した:

- F-01 引用されたかを測れない（設計として測らない）
- F-04 出典が消えた履歴が無い
- F-06 抽出が自動で回らない（記事を公開しても回らない）
- F-09 空の構えを保存できる

**F-06 は SEO 側の F-01 と同じ構造の穴である。**
`publish-article` の経路に AEO の抽出は配線されていない
（`grep` で確認、該当 0 件）。

管理画面から `extract` を押したときだけ回る。
