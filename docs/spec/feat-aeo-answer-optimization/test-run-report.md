# 実行の記録 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P06 の成果物。実測値。

## 実行

```bash
npx vitest run --project normal \
  tests/application/manage-blog-improvement.test.ts \
  tests/application/seo/feeds.test.ts \
  tests/application/seo/structured-data.test.ts \
  tests/presentation/seo-route-handlers.test.ts \
  tests/application/blog-delivery-check.test.ts

npx vitest run --project normal \
  tests/ui/article-faq.test.tsx \
  tests/acceptance/feat-blog-ui-builder/machine-feeds.test.ts

npx vitest run --project worker-runtime \
  tests/integration/d1-seo-assessment.test.ts
```

## 結果

| プロジェクト | ファイル | 件数 | 結果 | 時間 |
|---|---|---|---|---|
| normal（1 回目） | 5 | 81 | 全て通過 | 445ms |
| normal（2 回目） | 2 | 18 | 全て通過 | 381ms |
| worker-runtime | 1 | 14 | 全て通過 | 6.84s |
| **合計** | **8** | **113** | **全て通過** | |

vitest 4.1.10。

## `--project` を必ず書く

このリポジトリの vitest は 3 プロジェクト構成
（`normal` / `a11y` / `worker-runtime`、`vitest.projects.mjs`）。

**ファイル名だけを渡すと、そのプロジェクトの `include` に
入っていないファイルは黙って無視される。**

`tests/integration/d1-*.test.ts` は `worker-runtime` にしか無い。
`--project normal` に渡すと「5 passed」で終わり、
14 件が実行されなかったことに気づかない。

### 今回の実測

`tests/ui/article-faq.test.tsx` を `--project a11y` に渡したところ、
`include` に無いとして 0 件で終わった:

```
filter: tests/ui/article-faq.test.tsx
projects: a11y
include: tests/ui/affiliate-preview-card.test.tsx, ... （article-faq は無い）
```

同じ `tests/ui/` の下でも、a11y に入るファイルと入らないファイルがある。
`article-faq.test.tsx` は `normal` 側だった。

**「通った」ではなく「実行された件数」を見る。**

## AEO 単体の件数

上の 113 件は SEO 側と共有しているファイルを含む。
AEO だけに効くケースは以下:

| 由来 | 件数 |
|---|---|
| d1（構え・抽出） | 6 |
| usecase（隙間・権限・境界） | 6 |
| feeds（robots の AI クローラ・llms.txt） | 10 |
| structured-data（FAQPage・著者・エスケープ） | 9 |
| route-handlers（llms.txt の 503・404） | 4 |
| acceptance（4 つの口） | 12 |
| ui（FAQ を畳まない） | 4 |
| **計** | **51** |

残りは SEO 診断・順位表・記事本体の構造化データが持っている。

## 分けなかった理由

`article_answer_unit` と `article_seo_assessment` は
同じ `d1-seo-assessment.test.ts` に置いた。

どちらも `manage-blog-improvement` という
1 つのユースケースが所有していて、
同じ権限の枠組みと同じ監査経路を共有する。

**ファイルを分けると、権限の話が 2 か所に散る。**
