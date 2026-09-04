# 受入・品質の証跡と再現手順

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P11`
- 状態: 確定 (P11 成果物)
- 読んだもの: [acceptance.md](./acceptance.md) / [quality-assurance.md](./quality-assurance.md) / [test-run.md](./test-run.md) / [migration-compatibility.md](./migration-compatibility.md)
- 集約日: 2026-09-04

## 0. この文書の使い方

**結論の一覧ではなく、他人が同じ手順で同じ結論に至るための地図。**

「A3 は PASS」と書いてあるだけの表は、読んだ人に何も渡さない。
各項目に「どのコマンドを打つと、どのファイルの何行目が答えるか」を書く。
それが書けない項目は、証跡が無いということなので、そう書く。

## 1. 5 分で全部を確かめる

```bash
# 1. 全量（約 6-7 分）
pnpm vitest run --reporter=dot

# 2. 型
pnpm run typecheck

# 3. 静的検査
pnpm run lint

# 4. plan の決定論検証
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure
```

この feature に絞って速く回す（約 13 秒）:

```bash
pnpm vitest run --project worker-runtime tests/integration/d1-ai-search-audit-history.test.ts
pnpm vitest run tests/application/seo/structured-data.test.ts \
  tests/ui/article-speakable-anchor.test.tsx \
  tests/application/list-failing-audits.test.ts \
  tests/ui/published-articles-failing-audits.test.tsx
```

## 2. 実測（P11 時点・P08 の整理を含む）

| 項目 | 値 | 取得 |
|---|---|---|
| テストファイル | **474** | `pnpm vitest run --reporter=dot` |
| テストケース | **10673** | 同上 |
| 失敗 | **0** | 同上 |
| 所要 | 397.77s | 同上（P09 時点の同一構成で 367.36s。実行ごとに 30s 程度ぶれる） |
| `tsc --noEmit` | exit 0 | `pnpm run typecheck` |
| lint | 0 errors / warning 2 | `pnpm run lint` |
| plan 検証 | `violations: []` | `validate-system-plan.py` |

P06 時点（10672）から **+1** は、P09 が足した N4（監査記録の残存）1 件。

lint の warning 2 件（`src/db/schema.ts:33` の `SiteDocumentKey` 未使用、
`stryker.config.mjs:31` の匿名 default export）は、
`git diff` で該当行が変更行 (`+`) ではなく context 行であることを確認済み。
**件数だけを見て「前からあった」と書いていない**（[test-run.md](./test-run.md) 3 節）。

## 3. 受入 A1-A6 の証跡

| 受入 | 判定 | 実装 | 検査 |
|---|---|---|---|
| A1 HowTo | PASS | `src/application/seo/structured-data.ts#buildHowTo` | `tests/application/seo/structured-data.test.ts` |
| A2 Speakable | PASS | 同 `#buildSpeakable` + 公開ページの `data-speakable` | `tests/ui/article-speakable-anchor.test.tsx` |
| A3 追記と保持窓 30 | PASS | `src/application/usecases/seo/record-ai-search-audit.ts` + `src/infrastructure/persistence/d1/ai-search-audit-history-repository.ts` | `tests/integration/d1-ai-search-audit-history.test.ts`（保持窓 5 件） |
| A4 定期再点検 | PASS | `src/application/usecases/seo/reaudit-stale-articles.ts` + `worker-entry.js#scheduled` + `wrangler.jsonc` の cron 3 箇所 | 同上（定期再点検 7 件） |
| A5 落ちた記事の一覧 | PASS | `src/application/usecases/seo/list-failing-audits.ts` + `src/app/admin/content/published/page.tsx` | `tests/application/list-failing-audits.test.ts` / `tests/ui/published-articles-failing-audits.test.tsx` |
| A6 既存挙動の不変 | **PASS（再確認済み）** | — | 4 節 |

判定の根拠と「その判定が見ていないもの」は [acceptance.md](./acceptance.md) が持つ。
ここでは**どこを見れば確かめられるか**だけを示す。

## 4. A6 の再確認（P07 が P08 へ条件付けた項目）

[acceptance.md](./acceptance.md) の A6 は
「PASS（ただし P08 の後で再確認が必要）」として確定した。
整理は挙動を変えない前提の作業だが、**前提が守られたことは実行して初めて言える**ためである。

**再確認の結果: PASS。**

| | P07 時点 | P08 の整理後（P11 時点） |
|---|---|---|
| テストファイル | 474 | 474 |
| テストケース | 10672 | 10673（N4 の +1） |
| 失敗 | 0 | **0** |

P08 が変えたのは `src/application/seo/structured-data.ts` の組み立て経路だけで、
既存 builder 7 関数を見ているテストは全て緑のまま。とくに:

- `mainEntityOfPage` / `itemListElement` / `faq.mainEntity` / `author` を
  **`toEqual`（完全一致）**で見ている箇所が緑。キーが 1 つ増えても減っても落ちる。
- `serializeJsonLd` の `<` → `<` 置換（`</script>` による脱出の阻止）の検査が緑。

出力の**キー順**が保たれる根拠は
[migration-compatibility.md](./migration-compatibility.md) 1.3 節。
`jsonLdDocument` が `{"@context", "@type", ...body}` を返す構造から言える。

## 5. 非機能 N1-N4 の証跡

| # | 観点 | 判定 | 検査 |
|---|---|---|---|
| N1 | 再点検の処理量 | PASS | 「対象が 60 件あっても、1 回の起動で触るのは 50 件ちょうど」 |
| N2 | 履歴の総量 | PASS | 保持窓 5 件（29→30 / 30→31 / 40→30 / 同秒 2 行） |
| N3 | 権限境界 | PASS | 「隣の作業場所のものは見えないし、触らない」describe 2 件 |
| N4 | 監査記録の残存 | PASS | 「記事を消しても、その記事の履歴は 1 行も減らない」 |

すべて `tests/integration/d1-ai-search-audit-history.test.ts`（19 件）にある。
数値と見積もりの根拠は [quality-assurance.md](./quality-assurance.md)。

## 6. マイグレーションの証跡

| 確認 | 根拠 |
|---|---|
| 0044 が既存表を変更しない | `drizzle/0044_ai_search_audit_history.sql` は CREATE TABLE 1 + CREATE INDEX 2 のみ |
| journal が追記のみ | `drizzle/meta/_journal.json` の idx 44 を末尾追加。既存 entry の `when`/`tag` 不変 |
| 履歴 0 件から立ち上がる | `listStale` の `LEFT JOIN` + `h.last_checked IS NULL` 分岐。テスト「履歴が 1 件も無い記事は、いちばん先に再点検される」 |
| 巻き戻せる | 表の追加だけなので `DROP TABLE` で 0043 時点と同一 |

詳細は [migration-compatibility.md](./migration-compatibility.md) 2 節。

### 定期実行そのものの観測

| 確認 | 根拠 |
|---|---|
| 対象 0 件の成功と対象取得失敗を区別 | `tests/domain/ai-search-reaudit-run.test.ts` + `tests/infrastructure/ai-search-reaudit-scheduler.test.ts` |
| 一部失敗と全件失敗を区別 | 同上。一部成功ありの場合だけ `partial`、保存 0 件は `failed` |
| workspace 横断を拒否 | `tests/application/get-latest-ai-search-reaudit-run.test.ts` + `tests/integration/d1-ai-search-reaudit-run.test.ts` |
| 空の workspace も「0 件成功」を残せる | D1 結合テストが記事 0 件の非停止 workspace を列挙 |
| 管理画面が未実行／成功／一部失敗／失敗／取得不能と時刻を表示 | `tests/ui/published-articles-reaudit-status.test.tsx` |
| 0045 が既存表を変更しない | `drizzle/0045_ai_search_reaudit_runs.sql` は最新状態テーブルの `CREATE TABLE` のみ |

## 7. 証跡が無い・弱いと分かっているもの

**ここが本文書でいちばん重要。**緑の一覧より、緑でないところの方が次の人に要る。

| # | 項目 | なぜ証跡が無いか | 引き継ぎ先 |
|---|---|---|---|
| E1 | 刈り取りの `workspace_id` 単独の効き | `site_blueprints` が `(workspace_id, slug)` 一意なので、条件を落としても `site_slug` の側で分かれる | P10 → follow-up |
| E2 | キーボード到達（Tab の実押下） | `href` を持つ `<a>` であることからの推定。既存 `tests/ui/keyboard-operation.test.tsx` と同じ前提 | P10 |
| E3 | 人がブラウザで見た確認 | 根拠は「描いた DOM に hint の文言が現れる」まで。文言が運営者にとって行動可能かは未検証 | P13 の手動確認 |
| E4 | 実 D1 での実行時間 | 1 日 1 回 50 件は設計値。実データ量での所要は未測定 | P10 → follow-up |
| E5 | 記事 350 本超での 7 日再点検 | 算術上、`50 × 7 = 350` を超えると要件を満たせない。実環境が遠いので未対処 | P10 → follow-up |
| E6 | 音声アシスタントの実際の読み上げ | Speakable の指し先が実在することまで。読んで意味が通るかは記事執筆側の責任 | 対象外（仕様） |

## 8. 第三者が再現するときの落とし穴

1. **`--reporter=basic` は使えない。** vitest v4.1.10 では削除されている。`dot` を使う。
2. **全量は約 6-7 分かかる。** 途中で止めると D1 の一時状態が残ることがある。
3. **`tests/support/clock.ts` の `NOW` を書き写さない。** 書き写すと
   `tests/architecture/test-foundation.test.ts` が落ちる。import すること。
4. **テストファイルを増減させたら `pnpm run generate` を走らせる。**
   生成物の鮮度検査は増やしたときだけでなく**減らしたときも**赤くなる。
   `KNOWN_STALE_MAX` を上げて緑にしないこと（上げた時点でこの検査は何も見なくなる）。
5. **D1 統合テストは project を指定する。**
   `--project worker-runtime` を付けないと該当ファイルが拾われない。
