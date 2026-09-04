# 導出規則と保持方針の参照先

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P12`
- 状態: 確定 (P12 成果物)
- 読んだもの: [final-review.md](./final-review.md) / [evidence.md](./evidence.md) / [retention-policy.md](./retention-policy.md)
- 作成日: 2026-09-04

## 0. この文書の役目

この feature は 16 本の仕様書を持つ。**次に触る人が最初に開くべき 1 本**として、
「どの決定がどこに書いてあり、それがコードのどこに現れているか」だけを並べる。

決定の**理由**はここに写さない。写すと 2 か所に同じ話が載り、
片方だけ直された日に、どちらが正しいか誰にも言えなくなる。
ここにあるのは**行き先**だけである。

判定結果と再現手順は [evidence.md](./evidence.md)、
残課題は [final-review.md](./final-review.md)、
日々の運用は [operations.md](./operations.md)。

## 1. 実装した 3 つのこと

| # | 何を | 決定の在り処 | 実装 |
|---|---|---|---|
| 1 | 手順記事から HowTo の JSON-LD を出す | [derivation-rules.md](./derivation-rules.md) D1 | `src/application/seo/structured-data.ts#buildHowTo` |
| 2 | 結論と要点を読み上げ対象として指す（Speakable） | [derivation-rules.md](./derivation-rules.md) D2 | 同 `#buildSpeakable` + `src/presentation/ui/templates/article-view.tsx` の `data-speakable` |
| 3 | 点検結果を履歴に残し、7 日超の記事を再点検する | [retention-policy.md](./retention-policy.md) R1-R4 | 下の 3 節 |

## 2. 導出規則（JSON-LD）

### HowTo

| 決めたこと | 在り処 | 実装 |
|---|---|---|
| 導出元は `steps` 節。0 件なら出さない | D1 | `buildHowTo` の `steps.length === 0` で `null` |
| 記事型では分岐しない（`steps` 節を持つ = 手順記事） | D1 / [design-review.md](./design-review.md) A1 節 | 実装に型判定が無い |
| 補助情報は有るときだけキーを出す（`null` を値にしない） | D1 | `...(totalTime === null ? {} : { totalTime })` の形 |
| 事前準備は `supply` にだけ写し、`tool` は出さない | [final-review.md](./final-review.md) D1 | 実装のコメントが理由を持つ |

検査: `tests/application/seo/structured-data.test.ts`

### Speakable

| 決めたこと | 在り処 | 実装 |
|---|---|---|
| 指し先は `[data-speakable="answer"]` と `[data-speakable="key-points"]` | D2 | `buildSpeakable` |
| `id` ではなく `data-*` で揃える | [design-review.md](./design-review.md) O1 | `article-view.tsx` |
| 指し先が本文に実在すること | A2 | `tests/ui/article-speakable-anchor.test.tsx` |

**取り違え注意**: `article-view.tsx` の `MOVABLE_BLOCKS` にある `"summary"` は
**目次**を指す別物である。読み上げ対象は `article.summary`（冒頭の結論）の方。

### 共通部品

`@context` や `mainEntityOfPage` の組み立ては
`structured-data.ts` の先頭にヘルパとして寄せてある
（`jsonLdDocument` / `webPageRef` / `organizationRef` / `faqMainEntity` / `articleUrl`）。
経緯と「出力が変わっていない根拠」は
[migration-compatibility.md](./migration-compatibility.md) 1 節。

## 3. 保持方針（点検履歴）

| 決定 | 中身 | 在り処 | 実装 |
|---|---|---|---|
| R1 | 保持窓は記事ごと直近 **30 件**（件数のみ。日数で切らない） | [retention-policy.md](./retention-policy.md) | `AUDIT_HISTORY_WINDOW` |
| R2 | 既存の毎日 Cron に相乗り。最終点検から **7 日**超が対象、1 回 **50 件** | 同上 | `REAUDIT_AFTER_DAYS` / `REAUDIT_BATCH_LIMIT` |
| R3 | 1 行に残すもの（`checks_json` に全チェックの結果） | 同上 | `drizzle/0044_ai_search_audit_history.sql` |
| R4 | 刈り取りは追記と**同一トランザクション** | 同上 | `ai-search-audit-history-repository.ts#record` の `db.batch` |

### 置き場

| 役目 | ファイル |
|---|---|
| テーブル定義 | `drizzle/0044_ai_search_audit_history.sql` / `src/db/schema.ts` |
| 読み書き | `src/infrastructure/persistence/d1/ai-search-audit-history-repository.ts` |
| 公開時の追記 | `src/application/usecases/seo/record-ai-search-audit.ts` |
| 定期再点検 | `src/application/usecases/seo/reaudit-stale-articles.ts` |
| cron の入口 | `worker-entry.js` の `scheduled`（5 本目の `ctx.waitUntil`） |
| 管理画面の一覧 | `src/application/usecases/seo/list-failing-audits.ts` + `src/app/admin/content/published/page.tsx` |
| cron 時刻 | `wrangler.jsonc` の `crons`（**トップレベル・dev・production の 3 か所**） |

列ごとの理由と索引の設計は [data-model.md](./data-model.md)。
一覧の入出力・並び・抽出条件は [api-contract.md](./api-contract.md)。

### 触ると壊れるところ

- **`db.batch` に `db.run(sql)` の結果を渡さない。**
  `run()` はその場で実行を始めるので、`batch` が要求する「まだ組み立て途中の
  問い合わせ」ではなくなり、追記と刈り取りが別トランザクションに分かれる。
  実装のコメントが同じことを警告している。
- **`ai_search_audit_history` に外部キーを張らない。**
  記事が取り下げられたときに履歴が連鎖削除されると、
  取り下げた理由を後から辿れなくなる。
  `tests/integration/d1-ai-search-audit-history.test.ts` の
  「記事を消しても、その記事の履歴は 1 行も減らない」がこれを守っている。
- **`REAUDIT_BATCH_LIMIT` を上げない。**
  記事が増えたときは cron の頻度を上げる（[operations.md](./operations.md) 5 節）。

## 4. 要件との対応

| 要件 | 内容 | 受入 |
|---|---|---|
| `REQ-SEO06` | 手順記事と読み上げ向けの構造化データを読み取りモデルから導出する | A1, A2 |
| `REQ-SEO07` | AI 検索適合の点検結果を履歴として残し、公開後も定期に再点検する | A3, A4, A5 |

**両要件とも `docs/product/traceability.md` に追記済み**である
（計画では P12 の作業だったが、`scripts/traceability.mjs` が P05 の時点で
落ちたため前倒しした。経緯は [final-review.md](./final-review.md) D3）。
本 phase では追記済みであることの確認だけを行った。

テストと要件の対応は `docs/product/test-traceability.md`、
要件が要求するテスト種別は `docs/product/required-test-types.md` が持つ。
どちらも `pnpm run generate` が生成する。手で書かない。

## 5. 仕様書 16 本の索引

| 文書 | 何を持つ | 所有 phase |
|---|---|---|
| [requirements-baseline.md](./requirements-baseline.md) | 受入 A1-A6 の定義 | P01 |
| [architecture.md](./architecture.md) | 触るファイルと組込点 | P02 |
| [data-model.md](./data-model.md) | テーブル・列・索引・刈り取り SQL | P02 |
| [api-contract.md](./api-contract.md) | 一覧の入出力・並び・抽出条件・認可 | P02 |
| [derivation-rules.md](./derivation-rules.md) | D1 HowTo / D2 Speakable の導出元 | P02 |
| [retention-policy.md](./retention-policy.md) | R1-R4 保持方針 | P02 |
| [design-review.md](./design-review.md) | 重複 0 件の実測と是正 F1-F3 | P03 |
| [test-design.md](./test-design.md) | テストケース T1-1〜T5-5 の設計 | P04 |
| [test-run.md](./test-run.md) | 実行結果とゲートで詰まった箇所 | P06 |
| [acceptance.md](./acceptance.md) | A1-A6 の判定と「見ていないもの」 | P07 |
| [migration-compatibility.md](./migration-compatibility.md) | 0044 の前方互換と JSON-LD 整理 | P08 |
| [quality-assurance.md](./quality-assurance.md) | 非機能 N1-N4 の実測 | P09 |
| [final-review.md](./final-review.md) | 残課題の切り分けと設計とのずれ | P10 |
| [evidence.md](./evidence.md) | 証跡の集約と再現手順 | P11 |
| **[operations.md](./operations.md)** | 日々の運用手順 | P12 |
| **documentation.md**（本書） | 参照先の索引 | P12 |

## 6. この文書が扱わないこと

- 決定の理由（各仕様書が持つ。ここには写さない）
- 実装の手順（P05 が終えている）
- system-spec への書き戻し（P13 が持つ）
