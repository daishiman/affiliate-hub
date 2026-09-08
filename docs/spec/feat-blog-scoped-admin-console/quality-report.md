# 品質ゲートの記録 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P07 の成果物。2026-09-04 実測。

## 結果

| ゲート | 結果 |
|---|---|
| `scripts/traceability.mjs` | 緑（exit 0） |
| `scripts/required-test-types.mjs` | 緑（exit 0） |
| `scripts/port-wiring.mjs` | **赤（exit 1）** |
| `tests/architecture/generated-doc-freshness.test.ts` | 緑（5 件） |
| 画面のテスト 6 ファイル | 緑（350 件） |

## traceability

```
テストと要件の対応
  テストファイル  485
  由来が分かる    485
  由来不明        0（上限 2）

OK 由来不明は上限以内です。
```

**485 件すべてが `@req` を持つ。**

上限 2 を使っていない。

## required-test-types

```
要件ごとの必須テスト種別
  要件          295
  宣言済        290
  未宣言        5（上限 5）
  理由つき除外  5（上限 7）

OK 必須種別の欠けはありません。
```

**未宣言が上限ちょうど（5 / 5）。**

緑だが、余裕が無い。
次に要件を 1 件足して宣言を書き忘れると赤になる。

## port-wiring — 赤

```
書き込みなのに記録へ届いていない入口
  届いていない    0（上限 0）
  理由つき除外    6（上限 5）
  判定できない    0（上限 0）

NG 書き込み側の除外が上限を 1 件超えました。
```

### 原因

隣の feature（`feat-reader-behavior-analytics`）が
`createRecordReaderInteractionsUseCase` を追加した。

読者の閲覧・滞在・クリックを受ける入口で、
**操作の記録（監査ログ）へ届かない**。

理由つき除外に 1 件加わり、5 → 6 になった。

`docs/product/port-wiring.md` に理由が書いてある:

```
自動の計測。読者のブラウザから届く閲覧・滞在・クリックを 1 回にまとめて受ける入口で、
1 人が 1 記事を読むだけで数十件届く。操作の記録へ入れると、承認や公開の行が
その中に埋もれて読めなくなる。**残すのは集計のやり直し (`metrics_rollup.rebuilt`) の側**で、
そちらは人が「この日が壊れている」と判断して呼んだ回だけが行になる。
生の観測の正本は `reader_interaction_event` にあり、90 日で消える
```

**除外の判断自体は正しい。**

### この feature が原因ではない

ブログごとの管理画面は
新しいユースケースを 1 つも追加していない。

既存の口を並べ替えて画面に出しただけ。

port-wiring の対象は
`src/application/usecases/` であり、
`src/app/admin/` は数えていない。

### 上限を上げていない

`5` を `6` にすれば緑になる。

**しない。**

上限は「除外がこれ以上増えたら設計を見直す」という
合図として置いてある。

1 件超えたから 1 上げる、を繰り返すと
上限が実態を追いかけるだけの数字になり、
合図として働かなくなる。

### `docs/product/port-wiring.md` の注記

表の 6 行に対し、文中の注記は
「（現在 5 件。上限も 5。）」のまま。

**書き換えていない。**

注記を 6 に直すと、
表と注記が一致して落ち着いて見える。

赤の原因が文書からは読めなくなる。

**食い違っていること自体が、いま赤である印。**

### 直す道筋（この feature の範囲外）

2 つある。

1. `createRecordReaderInteractionsUseCase` を
   監査ログへ届く形にする（設計変更）
2. 除外の分類を「読者の操作」と「自動の計測」に分け、
   後者に別の上限を置く

どちらも `feat-reader-behavior-analytics` の判断。
ここでは決めない。

## generated-doc-freshness

```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

`KNOWN_STALE_MAX` を触っていない。

## 申告表の自動更新

ゲートを走らせた結果、次が書き換わった:

```
docs/product/open-doors.md
docs/product/port-wiring.md
docs/product/required-test-types-report.md
docs/product/required-test-types.md
docs/product/test-traceability.md
docs/product/traceability.md
```

**画面を足したことによる件数の更新。**

上限（`.mjs` の中の数字）は 1 つも動かしていない。

## この feature が緑にできなかったもの

port-wiring 1 件のみ。

原因は隣の feature。
上限を上げずに残す。
