# テストの実行結果 — 読者行動の観測 (feat-reader-behavior-analytics)

P07 の成果物。実測値。

## この feature に関わるファイルだけを回した結果

```
$ pnpm vitest run --project normal \
    tests/ui/reader-behavior-probe.test.tsx \
    tests/application/reader-interaction-intake.test.ts \
    tests/ui/blog-metrics-pages.test.tsx
 Test Files  2 passed (2)
      Tests  43 passed (43)

$ pnpm vitest run --project a11y   （同じ 3 ファイル指定）
 Test Files  1 passed (1)
      Tests  18 passed (18)

$ pnpm vitest run tests/integration/d1-reader-metrics.test.ts
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  6.11s
```

**赤 0 件。**

`tests/ui/blog-metrics-pages.test.tsx` は `a11y` プロジェクトの
対象範囲に入るため、`normal` では拾われない。
3 プロジェクト構成（`vitest.projects.mjs`）を意識せずに
`--project normal` だけで確かめると、**画面側が回っていないことに気づけない**。

## 全体

```
$ pnpm test
 Test Files  485 passed
      Tests  10969 passed
   Duration  424.53s
 exit 0
```

feat-blog-metrics-rollup の回と同じ実行を共有している。
この feature の追加ぶんは既にこの数に含まれている。

## 途中で赤になったもの

### 短い記事の到達率が 0 のままだった

`scroll` イベントの発火を待つ作りだったため、
**画面に収まる記事ではスクロールが 1 度も起きず**、
「窓に収まる短い記事は、開いた時点で読み切ったと数える」が落ちた。

直し方: 登録直後に `onScroll()` を 1 回呼ぶ。
下端が既に見えていれば、その場で 4 つの刻みが全部立つ。

### 滞在が 2 件になり、平均が半分になった

「裏に回ってから閉じても、滞在と離脱は 1 件ずつのまま」が落ちた。
`visibilitychange`（`hidden`）と `pagehide` の両方で `finish()` を
呼んでいたため。

直し方: `done` フラグで 1 度だけにした。
**この赤はテストが無ければ気づけない**。本番では
「平均滞在がちょうど半分」という、受け入れられてしまう値になる。

### 幅で絞ると内訳が 0 になった

「画面幅で絞ると、同じ記事でも別の分布になる」を通す実装が、
`byViewport` にも同じ絞り込みを掛けていた。
指定した幅だけが非 0 で残り 2 つが 0 という、内訳でないものが出た。

直し方: 到達の分布だけを絞る。読者の内訳は絞らない。
この分離をテストで固定した（`blog-metrics-pages` の 14）。

## 実行しなかったもの

| 対象 | 理由 |
|---|---|
| 定時起動（cron） | Workers の実環境でしか回らない |
| 実ブラウザでのスクロール | jsdom は `scrollHeight` を実測しない |
| 90 日の実経過 | 発生時刻を過去に置いて代替した |

**実ブラウザでの到達率は未検証**である。
jsdom は値を注入しているので、刻みの判定ロジックは確かめられているが、
実レイアウトでの `scrollHeight` の取り方は確かめていない。
