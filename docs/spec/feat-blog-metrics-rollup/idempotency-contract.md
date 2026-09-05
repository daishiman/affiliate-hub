# 冪等の契約 — 日次集計 (feat-blog-metrics-rollup)

P02 の成果物。受入条件 1・6・8 の設計上の根拠。

## 契約

> **同じ日を何度集計しても同じ結果になる。足し込みではなく置き換え。**

型では表せないので、`MetricsRollupPort` の doc に文として書き、
テストで検証する（`tests/application/rebuild-daily-metrics.test.ts`）。

## 実装の形（仕様書との差の申告）

仕様書の初稿は「対象日の行を DELETE してから INSERT する」と書いていた。
**実装は upsert（`INSERT ... ON CONFLICT DO UPDATE`）にした。**

理由は 2 つある。

### 1. DELETE + INSERT には、行が無い瞬間ができる

D1 は単一の Worker 実行内でしか transaction を張れない。DELETE の直後に
画面が同じ日を読むと、**その日の数字が 0 として表示される**。
運営者から見ると「集計が壊れた」ようにしか見えない。

upsert なら行は常に存在し、値が古いか新しいかのどちらかにしかならない。

### 2. DELETE + INSERT は売上を消す

`revenue_minor` と `conversions` は観測イベントからは出ない。報酬側
（feat-affiliate-hub）が別の経路で同じ行へ書き込む。DELETE してしまうと、
**再集計のたびに報酬の記録が消える。**

upsert の `set` に売上と成果を含めていないのがこの対策である
（`reader-metrics-repository.ts` の該当箇所にコメントとして残してある）:

```ts
// 置き換えで書く。`set` に売上と成果を含めないのが要点で、
// 含めると再集計のたびに成果側の記録が既定値へ戻る。
```

**`set` に含める列**: `views`, `clicks`, `unique_sessions`,
`average_dwell_seconds`, `average_scroll_ratio`, `clicks_by_element`,
`sample_count`, `computed_at`

**`set` に含めない列**: `revenue_minor`, `conversions`

初回の INSERT ではこの 2 列は既定値の 0 で入る。報酬側が後から上書きし、
以降の再集計はその値に触らない。

## 受入条件 8「部分的に書かれた日が残らない」

1 日ぶんの書き込みは `db.batch()` で 1 回にまとめてある。

```ts
// 1 日ぶんをまとめて書く。ブログ側だけ更新されて記事側が
// 古いままになると、合計と内訳が合わない画面ができる。
await db.batch(statements);
```

D1 の `batch` は全文が成功するか、1 つも適用されないかのどちらかになる。
したがって「ブログ側だけ新しく、記事側は古い」という中途半端な日は残らない。

**この保証が及ぶのは 1 (workspace, site, day) の組の中だけ**である。
複数の組をまとめて処理する定時実行では、組ごとに独立して成否が決まる。
1 組の失敗で全体を止めないのは意図的で、理由は `operations-runbook.md` に書いた。

## 受入条件 6「その日だけが置き換わり他の日が変わらない」

`rollupDay(workspaceId, siteSlug, day)` は `day` を WHERE に固定して
生イベントを読み、同じ `day` の行だけを upsert する。
他の日を触る経路が実装に存在しない。

再実行の入口（`createRebuildDailyMetricsUseCase`）も 1 日しか受け取らない。
範囲指定を許さないのは、範囲を許すと「どこから壊れているか分からないので
全部やり直す」が常態になり、`sample_count` の意味が薄れるためである。

## やり直してよい日の線引き

`validateRollupTargetDay(day, now)` がドメイン側で判定する。

集計は置き換えなので、**生イベントが消えた日をやり直すと、今ある集計が
0 で潰れる**。したがって保持期限（90 日）を過ぎた日は入口が拒む。

未来の日も拒む。未来の日には観測が存在しないので、やり直せば必ず 0 になる。

## 「観測が無い日」の扱い

`pendingDays()` は生イベントの側から対象を数え上げる。指定した日に観測が
無ければ 0 件が返り、集計は 1 行も書かれない。

**無い観測を 0 の行として書きに行かない。** 0 の行を書くと、
「観測が無かった日」と「集計がまだの日」が画面で区別できなくなる。

再実行の戻り値 `rebuilt: 0` は失敗ではなく「その日に観測が無かった」を意味する。
