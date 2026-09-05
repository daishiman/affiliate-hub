# 反映の設計 — SEO の診断と反映 (feat-seo-assessment-reflection)

P02 の成果物。指摘から下書きまでの道筋。

## 4 つの操作

`ManageSeoAssessmentInput`:

| action | すること |
|---|---|
| `read` | 未対応の指摘を、出す順で返す |
| `assess` | 診断を回す。`articleSlug` を省くとブログ全体 |
| `draft_fix` | 指摘から下書きを作る（公開しない） |
| `dismiss` | 「直さない」と記録する（理由必須） |

## 返す形

```ts
type SeoAssessmentView = {
  siteSlug: string;
  openFindings: readonly SeoFinding[];
  assessedArticles: number | null;   // null = この操作では診断していない
  draftRevisionId: string | null;    // draft_fix で作った改訂の id
};
```

### `assessedArticles` が `null` と `0` で違う

| 値 | 意味 |
|---|---|
| `null` | この操作では診断していない（`read` / `dismiss`） |
| `0` | 診断したが、対象の記事が 1 本も無かった |

**0 本は「指摘なし」ではなく「対象なし」である。**

公開記事が 1 本も無いブログで診断を回すと 0 が返る。
これを「指摘なし」と表示すると、
「調べたら問題なかった」に見えるが、実際は調べていない。

`AssessmentRun.assessedArticles` の doc に同じことを書いた。

## 診断は置き換え

```
assess(workspaceId, target)
```

既存の指摘は、同じ観点なら置き換える。積み増さない。

理由は `data-model.md` の一意制約の節。

### `dismissed` は置き換えの対象外

「直さない」と決めた指摘は、次の診断で復活しない。

d1 の「「直さない」と決めた指摘は、次の診断で復活しない」で
固定してある。ここが崩れると、
運用者の判断が毎日上書きされ、一覧が信用を失う。

### `dismissed` からは下書きを作れない

d1 の「「直さない」と決めた指摘からは下書きを作れない」。

直さないと決めたものの下書きを作れると、
その判断が何だったのか分からなくなる。

## 下書きを作る道筋

```
指摘 (SeoFinding.suggestion)
  ↓ draftFix
改訂の下書き (draftRevisionId)
  ↓ 呼び出し側が既存の編集画面へ渡す
記事の編集
  ↓ 既存の承認経路
公開
```

**この feature が持つのは最初の矢印だけである。**

`suggestion` が `null` の指摘からは下書きを作れない。
提案する直し方が無いのに下書きだけ作ると、
中身が元と同じ改訂が積まれる。

## 診断器は差し替えられる

```ts
// src/infrastructure/persistence/d1/seo-assessment-repository.ts
export type SeoAnalyzer = /* 記事 1 本から Raw な指摘を作る */;
```

保存側は `SeoAnalyzer` を受け取る形になっており、
`article-seo-analyzer.ts` はその 1 実装である。

分けたのは、**診断の中身と保存の仕方が別々に変わる**からである。
観点を足すときに保存側を触りたくない。

## `dismiss` の理由

空白だけの理由は受け付けない。

`manage-blog-improvement` の「理由が空白だけなら断る」。

理由を必須にしたのは、半年後に同じ指摘を見た人が
「なぜこれは直さないことになっているのか」を辿れるようにするため。
理由が空だと、判断そのものが残っても根拠が残らない。

理由は `audit_logs` の行にも残る
（「理由があれば、その理由が記録の行に残る」）。

## 診断器が落ちていたとき

**記録も残さず、失敗として返す。**

`manage-blog-improvement` の
「診断器が落ちていたら、記録も残さず失敗として返す」。

先に `seo_assessment.ran` を記録してから診断を回すと、
落ちた回も「診断を回した」として残る。
後から `assessed_at` を見た人が、
診断が回っていると誤解する。
