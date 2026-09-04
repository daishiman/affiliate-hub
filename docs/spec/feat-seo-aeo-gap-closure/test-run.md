# テスト全量実行の記録

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P06`
- 状態: 確定 (P06 成果物)
- 読んだもの: [test-design.md](./test-design.md) の 0 節（回帰の基準線）
- 実行日: 2026-09-04

## 0. この文書が主張すること

**「失敗 0 件だった」ではなく「一度赤で、何を直して緑にしたか」を残す。**
test-design.md の 0 節が同じ理由で基準線をそう書いた。数字だけを残すと、
次にこの表を読む人は「その数字がどう作られたか」を追えなくなる。

## 1. 実測

| | 基準線 (P04 時点) | P06 実測 | 差分 |
|---|---|---|---|
| テストファイル | 470 | **474** | +4 |
| テストケース | 10630 | **10672** | +42 |
| 失敗 | 0 | **0** | ±0 |

- コマンド: `pnpm vitest run --reporter=dot`
- 所要: 354.70s (約 5.9 分)
- vitest v4.1.10。`--reporter=basic` は使えないので `dot` を使う。

増えた 4 ファイル・42 ケースはすべて P05 が足したもの。既存の失敗は 0 件のままで、
**新規ケースが増え、既存の失敗が 0 のまま**という P06 の判定条件を満たす。

### 増えたテストファイル

| ファイル | 名乗る REQ | 見ているもの |
|---|---|---|
| `tests/application/seo/structured-data.test.ts` (拡張) | REQ-SEO06 | `buildHowTo` / `buildSpeakable` の導出（手順 0 件は null、冒頭の結論が無ければ対象要素なし） |
| `tests/ui/article-speakable-anchor.test.tsx` | REQ-SEO06 | Speakable が指す selector が本文に実在する要素を指していること |
| `tests/integration/d1-ai-search-audit-history.test.ts` | REQ-SEO07 | 履歴の追記・保持窓 30・7 日超の再点検抽出・作業場所の境界 |
| `tests/application/list-failing-audits.test.ts` | REQ-SEO07 | 落ちている記事の抽出（先週落ちて今週直った記事は出さない） |
| `tests/ui/published-articles-failing-audits.test.tsx` | REQ-SEO07 | 管理画面の表・0 件の文言・上限で切ったときの告知・a11y・キーボード到達 |

## 2. 一度赤だったもの（P05 の実装中に出て、直したもの）

**7 件が赤だった。すべて根治し、閾値を上げて緑にしたものは 1 件も無い。**

| # | 赤かった検査 | 何が起きていたか | どう直したか |
|---|---|---|---|
| 1 | `tests/architecture/tenant-scoped-schema.test.ts` | 刈り取りの `workspace_id` 絞りを生 SQL 文字列に書いていた。検出器は TypeScript の AST を歩いて `aiSearchAuditHistory.workspaceId` という**式**を探すので、文字列は映らない | 外側の絞りを `and(eq(aiSearchAuditHistory.workspaceId, ...), sql\`...\`)` へ移した |
| 2 | `node scripts/traceability.mjs` (exit 1) | 新しいテストが名乗る REQ-SEO06 / REQ-SEO07 が要件表に無かった | `docs/product/traceability.md` へ 2 要件を追記 |
| 3 | `node scripts/required-test-types.mjs` (未宣言 7 / 上限 5) | 要件が 2 件増えたぶん性質宣言が足りなかった | `docs/product/required-test-types.md` へ性質を宣言 |
| 4 | 同上（REQ-SEO07 に a11y / keyboard / tenant-isolation が欠けている） | 性質を宣言した結果、対応する印を持つテストが要求された | **上限を上げず、3 種のテストを実際に書いた**（UI に a11y 1 件・keyboard 2 件、統合に tenant-isolation 2 件） |
| 5 | `tests/architecture/ci-config.test.ts` | axe を使うテストを足したのに `A11Y_TEST_FILES` へ登録していなかった | `vitest.projects.mjs` へ 1 行追加 |
| 6 | `tests/architecture/test-foundation.test.ts` | 切り分け用に作った一時ファイルが基準時刻を書き写していた | 一時ファイル `tests/integration/d1-zz-debug.test.ts` を削除 |
| 7 | `tests/architecture/generated-doc-freshness.test.ts` | 6 でファイルを 1 本消したため、生成物が名乗る件数 (475) と実数 (474) がずれた | `pnpm run generate` で生成し直した |

### 6 と 7 について

一時ファイルを消したら別の検査が赤くなった。**生成物の鮮度検査は「増やしたとき」だけでなく
「減らしたとき」も赤くなる**からで、掃除もまた記録し直す対象である。
`KNOWN_STALE_MAX` を上げれば緑になるが、上げた時点でこの検査は何も見なくなる。

## 3. 併走する 3 ゲート

| ゲート | 結果 |
|---|---|
| `pnpm run typecheck` (`tsc --noEmit`) | exit 0 |
| `pnpm run lint` | 0 errors / **warning 2 件**。`src/db/schema.ts:33` (`SiteDocumentKey` 未使用) と `stryker.config.mjs:31` (匿名 default export)。どちらも `git diff HEAD` で context 行（先頭が空白）であることを確認済みで、**今回の変更由来ではない** |
| `validate-system-plan.py --feature-package feature-package/feat-seo-aeo-gap-closure` | `violations: []` / `pass` |

lint の 2 件を「今回のせいではない」と言うために、`git diff` で該当行が
変更行 (`+`) ではなく context 行であることを実際に見た。
**警告の件数だけを見て「前からあった」と書かない。**

## 4. 測れていないと分かっているもの

正直に残す。次にこの feature を触る人が、緑を過信しないため。

- **刈り取りの `workspace_id` 単独の効き**は現時点で観測できない。
  `site_blueprints` の `(workspace_id, slug)` 一意制約により隣の作業場所が同じ
  `site_slug` を持てないので、`workspace_id` の条件を落としても `site_slug` の側で分かれる。
  `tests/integration/d1-ai-search-audit-history.test.ts` の該当テストが今見ているのは
  「刈り取りが自分の範囲を超えない」までで、その旨をテスト本文のコメントに書いてある。
- **`tests/ui/published-articles-failing-audits.test.tsx` のキーボード検査は Tab を押していない。**
  `href` を持つ `<a>` であることから到達順と押下の効きを推定している
  （`tests/ui/keyboard-operation.test.tsx` と同じ前提）。
- **axe は行の見出しの向きと到達可能性の意図を見ない。** 自動検査は重ねるものであって、
  手で書いた 2 件の代わりではない。

## 5. 再現手順

```bash
pnpm vitest run --reporter=dot          # 全量。約 6 分
pnpm run typecheck
pnpm run lint
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure
```

新しい統合テストだけを速く回したいときは project を絞る（約 10 秒）:

```bash
pnpm vitest run --project worker-runtime tests/integration/d1-ai-search-audit-history.test.ts
```
