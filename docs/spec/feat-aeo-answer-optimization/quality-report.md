# 品質ゲートの記録 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P07 の成果物。実測値。

## 結果

| ゲート | 終了コード | 状態 |
|---|---|---|
| vitest（AEO 関連 8 ファイル / 113 件） | 0 | 緑 |
| `scripts/traceability.mjs` | 0 | 緑 |
| `scripts/required-test-types.mjs` | 0 | 緑 |
| `scripts/port-wiring.mjs` | **1** | **赤** |

## traceability

```
テストと要件の対応
  テストファイル  485
  由来が分かる    485
  由来不明        0（上限 2）
```

由来不明 0。上限にも達していない。

## required-test-types

```
要件ごとの必須テスト種別
  要件          295
  宣言済        290
  未宣言        5（上限 5）
  理由つき除外  5（上限 7）
```

**未宣言 5 は上限 5 と同じ。余裕が無い。**

次に要件を 1 つ増やして種別を宣言し忘れると赤になる。
この feature では要件を増やしていないので現状維持。

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
`createRecordReaderInteractionsUseCase` を追加し、
理由つき除外が 5 件から 6 件になった。

**この feature が増やしたものではない。**

AEO のユースケース（`manage-aeo-answers`）は
`aeo_profile.changed` / `aeo_answer_units.extracted` を
必ず監査へ書くので、除外に入っていない。

### 上限を上げない

登録簿（`docs/product/port-wiring.md`）の指示は
「移した分だけ `PORT_WIRING_MAX_UNRECORDED` を下げる」。

**上げる方向の操作はこの指示に無い。**

上限を 6 にすれば緑になるが、それは
「記録に届いていない入口が 1 つ増えたこと」を
見えなくするだけである。

上限は上げていない。

### 注記の食い違いも直していない

`docs/product/port-wiring.md` の本文に
「（現在 5 件。上限も 5。）」という注記があり、
表の 6 行と食い違っている。

**この注記を 6 に書き換えると、赤の原因が
文書の側から見えなくなる。**

赤が消えるまで注記は 5 のままにしてある。
食い違い自体が「上限を超えた」という事実の印になる。

### 「書けても書けなくても進む」2 件

```
- createStartSiteDraftUseCase  (build-site.ts:435)
- createSaveSiteDraftStepUseCase  (build-site.ts:527)
```

上限 2 でちょうど。この feature とは無関係の既存 2 件。

## 呼ばれていない口

```
呼ばれていない  52（上限 79）
```

上限に余裕がある。

AEO で足した `AnswerUnitPort` / `SiteAeoProfilePort` は
`manage-aeo-answers` から呼ばれているので
この 52 には入っていない。

## まとめ

この feature が原因の赤は無い。

**赤は 1 件残っている**（port-wiring）。
原因は隣の feature で、上限を上げずに残してある。
