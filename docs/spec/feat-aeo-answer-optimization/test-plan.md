# 確かめ方の計画 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P04 の成果物。何をどの層で確かめるか。

## 層の割り当て

| 層 | ファイル | 確かめるもの |
|---|---|---|
| 実体 (D1) | `tests/integration/d1-seo-assessment.test.ts` | 一意制約・置き換え・workspace 分離 |
| ユースケース | `tests/application/manage-blog-improvement.test.ts` | 権限・隙間の集計・境界 |
| 配り物 | `tests/application/seo/feeds.test.ts` | robots / sitemap / RSS / llms.txt の形 |
| 構造化データ | `tests/application/seo/structured-data.test.ts` | FAQPage・著者・引用・エスケープ |
| 入口 | `tests/presentation/seo-route-handlers.test.ts` | 200 を返さない条件・上限 |
| 受入 | `tests/acceptance/feat-blog-ui-builder/machine-feeds.test.ts` | 4 つの口が同じ道を使う |
| 画面 | `tests/ui/article-faq.test.tsx` | FAQ が畳まれず読める形で出る |

## 判断のある場所に置く

テストを置いたのは、**間違えられる場所**である。

- 「300 文字を超えたら」の境界 → ちょうど 300 は隙間にしない
- 「同じ問いが 2 つ」→ 先に出たほうを残す
- 「取り下げた記事」→ 0 件
- 「0 件の FAQ」→ `null`（空の `FAQPage` を出さない）
- 「壊れた記事」→ 503（空の 200 ではない）

**値の受け渡しだけの場所には置いていない。**

## 実体テストが要る理由

`article_answer_unit` の一意制約は
`(workspace_id, site_slug, article_slug, question)`。

これは**SQLite が守る**。
モックでは守られない。

「抽出し直すと、記事から消えた問いは表からも消える」は
`replaceForArticle` が本当に delete + insert しているかどうかで、
本物の D1 でしか確かめられない。

同じ理由で「他の記事の単位は、抽出し直しても巻き添えにならない」を
実体で置いた。**削除の WHERE 句が広すぎる**のが
この種の実装で最も起きやすい誤りである。

## 受入条件との対応

| 条件 | 確かめている場所 |
|---|---|
| 1. 引用単位を切り出せる | d1「抽出 0 件は失敗ではない」ほか |
| 2. 隙間を指摘できる | usecase「長すぎる答えと埋もれた答えを、画面に代わって数える」 |
| 3. 問いが鍵として一意 | d1「抽出し直すと、記事から消えた問いは表からも消える」 |
| 4. ブログの構えを持てる | d1「構えが未設定のブログは null を返す」 |
| 5. FAQ を構造化データへ | structured-data「0 件なら null」ほか 3 件 |
| 6. 著者を名乗れる | structured-data「著者は実在する著者ページの URL を持ち」ほか 3 件 |
| 7. 出典を出せる | structured-data の `citation` 群 |
| 8. AI クローラへ配る | feeds「AI クローラー 4 種を明示的に Allow する」ほか |
| 9. 壊れたら 200 を返さない | seo-route-handlers 3 件 |
| 10. 権限を分ける | usecase「記事を書く人は抽出できるが、構えは保存できない」 |

## 確かめないもの

1. **回答エンジンが実際に引用するか**
   外部の挙動で、こちらから観測できない（`design-review-findings.md` F-01）。

2. **抽出の精度**
   「この記事から 5 件取れるべき」という正解が無い。
   取れた数ではなく、**取れなかったときに嘘をつかないこと**を確かめる。

3. **指示語判定の精度**
   偽陽性・偽陰性の割合を測っていない（F-02）。

## 境界のケース

| 値 | 確かめている |
|---|---|
| 答えがちょうど 300 文字 | 隙間にしない |
| `positionRatio` がちょうど 0.5 | `>` なので隙間にしない |
| 節が 1 つだけ | `total <= 1` で 0 |
| FAQ が 0 件 | `FAQPage` を `null` |
| 記事が 0 本 | 空の `urlset` / 骨組みだけの llms.txt |
| 記事が 50,001 本 | 503 |
