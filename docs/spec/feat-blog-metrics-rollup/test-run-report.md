# テスト実行の記録 — 日次集計 (feat-blog-metrics-rollup)

P05 の成果物。実際に走らせた結果。

## 全体

```
npx vitest run
```

| 項目 | 値 |
|---|---|
| プロジェクト | `normal` / `a11y` / `worker-runtime`（3 つ全部） |
| ファイル | 485 passed (485) |
| ケース | 10969 passed (10969) |
| 所要 | 424.53s |
| 終了コード | 0 |

失敗 0、スキップ 0。

## 途中で赤くなり、直したもの

### `tests/presentation/admin-action-result.test.ts`

```
✗ observe/metrics-rebuild-state.ts は AdminActionState を使う
```

`MetricsRebuildState` を独自の構造として書いていた。このテストは
2 つのことを同時に見ている:

- `expect(source).toContain("AdminActionState")`
- `expect(source).not.toContain('readonly status: "idle" | ...')`

つまり「共通型を参照していること」と「同じ形を手で書き直していないこと」の
両方を要求する。片方だけでは、`import` したうえで結局同じ形を再定義する、
という抜け道が通る。

**直し方**: 別名に変えた。

```ts
export type MetricsRebuildState = AdminActionState;
```

型として何も足していないのに別名を置いた理由は、form と action が
同じ型を指していることを名前で示すため、および後から
「やり直した日」などを足すときの置き場所にするため。
その判断をファイルの doc に書いた。

**なぜ `"use server"` から分けたか**: `metrics-rebuild-action.ts` は
`"use server"` を持ち、非同期の関数しか外へ出せない
（`tests/architecture/server-action-exports.test.ts` が見張っている）。
型と初期値をそこに置くと落ちるので、別ファイルに分けてある。

## 実 D1 に対する結合テスト

`tests/integration/d1-reader-metrics.test.ts` は miniflare の D1 に当てている。
模擬ではなく本物の SQLite なので、以下が実際に検証されている:

- `ON CONFLICT DO UPDATE` の挙動
- 主キーの一意制約（重複行が作れないこと）
- `avg` が `NULL` を数えないこと（F-04 の対処）
- `db.batch()` の全部か無しか

## 手元での動作確認

`pnpm db:migrate:local` → `pnpm seed:local` → `pnpm dev` で
http://localhost:3001 が上がることを確認した。

見本データの実測件数:

| 表 | 件数 |
|---|---|
| `reader_interaction_event` | 3708 |
| `site_daily_metric` | 28（2 ブログ × 14 日） |
| `article_daily_metric` | 112 |
| `article_seo_assessment` | 16 |
| `site_aeo_profile` | 2 |
| `article_answer_unit` | 16 |
| `site_custom_domain` | 5 |
