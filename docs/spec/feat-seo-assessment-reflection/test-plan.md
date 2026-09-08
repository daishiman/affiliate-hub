# 確かめ方 — SEO の診断と反映 (feat-seo-assessment-reflection)

P04 の成果物。何を、どの層で確かめるか。

## 層の割り当て

| 層 | ファイル | 確かめること |
|---|---|---|
| 領域 | `tests/domain/seo/guideline-reference.test.ts` | 90 日の境界、指紋の比較、状態の優先 |
| 応用 | `tests/application/manage-blog-improvement.test.ts` | 権限、記録、失敗時に何を残さないか |
| 応用 | `tests/application/seo/structured-data.test.ts` | JSON-LD の形。純関数なので入出力だけ |
| 応用 | `tests/application/seo/feeds.test.ts` | robots.txt / sitemap / RSS / llms.txt の文字列 |
| 提示 | `tests/presentation/seo-route-handlers.test.ts` | 配信の境界。切らない・嘘の 200 を返さない |
| 実体 | `tests/integration/d1-seo-assessment.test.ts` | 一意制約、置き換え、workspace の隔離 |

## なぜこの割り方か

**判断のある場所に、その判断を確かめるテストを置く。**

- 90 日の境界は領域の値なので領域で確かめる。
  応用から確かめると、間に権限や記録が挟まって
  境界がずれた理由が分かりにくくなる。
- 権限と記録は応用の責務。
  d1 を挟まずに確かめられるので挟まない。
- 一意制約は **SQLite が守る**ので、d1 でしか確かめられない。
  応用のモックで「置き換わったつもり」を確かめても
  本物の索引が無ければ意味がない。

## 実体のテストが要る理由

`d1-seo-assessment.test.ts` は本物の SQLite（Miniflare）で回す。

一意制約と workspace の隔離は、
**アプリ側のコードを読んでも「守られている」と言えない**。
表の側が守るからである。

`worker-runtime` プロジェクトに置いてあり、
`--project normal` では拾われない。

## 受入条件との対応

| 条件 | 確かめる場所 |
|---|---|
| 1 公開・更新のたびに診断が生成される | **確かめていない（未達）** |
| 2 月次で全公開記事の診断が更新される | **確かめていない（未達）** |
| 3 妥当性検証が純関数で外部通信なし | `structured-data.test.ts` 全 19 件（fetch を一切使わない） |
| 4 不正な構造化データが指摘になる | `structured-data.test.ts` の壊れた carrier / 空の FAQ |
| 5 反映は下書きまで | `manage-blog-improvement` の published: false / d1 の drafted |
| 6 承認なしに公開面が変わらない | 型に公開の口が無い（`writeback-constraints.md`）+ d1 |
| 7 根拠の無い指摘を出さない | d1 の「根拠の無い指摘が 1 件混ざると…」 |
| 8 クローラ拒否を robots.txt へ | **満たさない（`feeds.test.ts` が「遮断を 1 行も書かない」を固定）** |
| 9 検証できない指摘を出さない | `assessment-catalog.md` + 常に 0 件の 2 観点 |
| 10 指針の出典が 90 日見直し | `guideline-reference.test.ts` 14 件 |

## 確かめないもの

- **実際に検索順位が上がるか。** 測れない。
- **リッチリザルトが実際に出るか。** 外部の判断で、こちらは制御できない。
- **診断の指摘が「良い助言か」。** 良し悪しは人が決める。
  機械が確かめるのは「根拠があるか」「同じ入力で同じ結果か」まで。

## 境界を意識して置いたケース

- 90 日**ちょうど**（`verified_fresh`）と 91 日（`review_due`）
- 答えの長さが**ちょうど上限**（隙間にしない）
- 公開記事 **50,000 件超**（黙って切らず 503）
- 公開記事 **21 件目**（新着 20 件で切らない）

上限の 1 つ手前と 1 つ先を両方置く。
片側だけだと、比較演算子の向きが逆でも通る。
