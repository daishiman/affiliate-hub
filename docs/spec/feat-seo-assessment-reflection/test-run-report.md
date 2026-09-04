# 実行の記録 — SEO の診断と反映 (feat-seo-assessment-reflection)

P05 の成果物。実際に流した結果。

## SEO 関連だけ

### `--project normal`（5 ファイル）

```
$ npx vitest run --project normal \
    tests/application/manage-blog-improvement.test.ts \
    tests/domain/seo/guideline-reference.test.ts \
    tests/application/seo/structured-data.test.ts \
    tests/application/seo/feeds.test.ts \
    tests/presentation/seo-route-handlers.test.ts

 RUN  v4.1.10

 Test Files  5 passed (5)
      Tests  86 passed (86)
   Duration  415ms
```

内訳（1 ファイルずつ実測）:

| ファイル | 件数 |
|---|---|
| `manage-blog-improvement.test.ts` | 19 |
| `guideline-reference.test.ts` | 14 |
| `structured-data.test.ts` | 19 |
| `feeds.test.ts` | 23 |
| `seo-route-handlers.test.ts` | 11 |
| 計 | **86** |

### `--project worker-runtime`（1 ファイル）

```
$ npx vitest run --project worker-runtime tests/integration/d1-seo-assessment.test.ts

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  5.65s
```

**合計 100 件、全部緑。**

## プロジェクトを分けて回した理由

`vitest.projects.mjs` は `normal` / `a11y` / `worker-runtime` の 3 つを持つ。

`d1-seo-assessment.test.ts` は Miniflare 上の本物の SQLite を要るので
`worker-runtime` に属し、**`--project normal` では拾われない**。

ファイル名を渡しただけでは「5 passed」で終わって
静かに 1 ファイル落ちるので、
プロジェクトを明示して 2 回に分けた。

同じ落とし穴に reader-behavior-analytics でも当たっている
（あちらは `a11y` プロジェクト）。

## 速さの違い

| | 時間 |
|---|---|
| normal 86 件 | 415ms |
| worker-runtime 14 件 | 5.65s |

1 件あたり 1000 倍近い差がある。

本物の SQLite を立てる代金であり、
**だから一意制約と隔離だけをそこに置く**
（`test-plan.md` の層の割り当て）。
全部を d1 で確かめると回らなくなる。

## 出力の読み方について

`--reporter=basic` は vitest 4 では出力が空になる。
素の実行に戻して `tail` で拾っている。

## 全体の実行

feature 単位ではなく repo 全体の結果は
`quality-report.md` に書いた。
