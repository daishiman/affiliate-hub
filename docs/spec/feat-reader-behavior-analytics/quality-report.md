# 品質ゲートの結果 — 読者行動の観測 (feat-reader-behavior-analytics)

P10 の成果物。実測値。

## 結果

| ゲート | コマンド | exit |
|---|---|---|
| vitest（3 プロジェクト） | `pnpm test` | **0** |
| traceability | `node scripts/traceability.mjs` | **0** |
| required-test-types | `node scripts/required-test-types.mjs` | **0** |
| port-wiring | `node scripts/port-wiring.mjs` | **1（赤）** |

## port-wiring が赤である

```
書き込みなのに記録へ届いていない入口
  届いていない    0（上限 0）
  理由つき除外    6（上限 5）
  判定できない    0（上限 0）

NG 書き込み側の除外が上限を 1 件超えました。
```

**届いていない入口は 0 件。** 増えたのは「理由つき除外」で、
本 feature が `createRecordReaderInteractionsUseCase` を追加したためである。

### なぜ除外なのか

読者の観測を `audit_logs` へ入れると、
1 人が 1 記事を読むだけで最大 7 行が積まれる。
承認・公開・権限変更といった**人が判断して押した行が埋もれる**。

`audit_logs` は「誰が何を決めたか」を残す場所であって、
読者が何をしたかを残す場所ではない。

理由は `docs/product/port-wiring.md` の除外表に登録した。

### なぜ上限を上げないのか

登録簿の指示は「移した分だけ `PORT_WIRING_MAX_UNRECORDED` を下げる」だが、
**その値は既に 0 で下げられない**。

上限（`PORT_WIRING_MAX_WRITE_EXCLUSIONS`）を 5 → 6 に上げれば緑になるが、
それは「除外を増やしたぶん、増やしてよいことにする」であって、
このゲートが見張っている性質そのものを無効にする。

**上げていない。赤のまま残している。**

### `port-wiring.md` の注記が古い

除外表の注記に「（現在 5 件。上限 `PORT_WIRING_MAX_WRITE_EXCLUSIONS` も 5。）」
とあり、表の 6 行と食い違っている。

**書き換えていない。** 注記を 6 に直すと数字が揃って見え、
赤の原因が文書側から読み取れなくなる。
上限の扱いを決めるのは人の判断であり、その判断が下るまで
食い違いを残しておくほうが状態を正しく表している。

## 型

```
$ pnpm typecheck
exit 0
```

`BlogAudiencePort` が `Omit<DailyMetrics, "revenueMinor">` を返すため、
読者側の画面から金額へ触ろうとするとここで落ちる。

## この feature が増やしたテスト

| ファイル | 件数 |
|---|---|
| `tests/ui/reader-behavior-probe.test.tsx` | 13 |
| `tests/application/reader-interaction-intake.test.ts` | 14 |
| `tests/integration/d1-reader-metrics.test.ts` | 15（うち観測側 6） |
| `tests/ui/blog-metrics-pages.test.tsx` | 14（うち読者行動 6） |

required-test-types が求める種別（application / integration / ui）を
いずれも満たしている。

## 残っている弱点

`final-review.md` に 5 件まとめた。
そのうち品質ゲートで見えるのは port-wiring の 1 件だけで、
残り 4 件は**緑のままでも残る**。
