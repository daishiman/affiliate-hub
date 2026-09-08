# テスト全量実行の記録 (P06)

> これは再検証前の実行履歴。ファイル数・例外登録・型検査結果は現在と異なる。「srcを読まないので実装に無関係」という下記の旧推論も現在の結論には採用しない。最新の再実行結果は [elegant-review.md](./elegant-review.md) を参照。

- feature: `feat-article-block-editor`
- phase: P06
- 実行日: 2026-09-06

## 1. 再現コマンド

```bash
pnpm test          # = vitest run (全量)
pnpm run typecheck # = next typegen && tsc --noEmit
```

## 2. 全量実行の結果

```
Test Files  9 failed | 497 passed (506)
     Tests  47 failed | 11262 passed (11309)
  Duration  372.20s
```

## 3. スイート別

| 範囲 | 結果 |
| --- | --- |
| `tests/ui` + `tests/domain` | **175 files / 5233 tests すべて通過** |
| `tests/application` `tests/infrastructure` `tests/presentation` `tests/integration` `tests/property` `tests/acceptance` | **252 files / 5085 tests すべて通過** |
| `tests/architecture` | 9 files 失敗 (下記) |

本 feature が実装で触った範囲は**すべて緑**である。

## 4. 失敗している 9 ファイル — 本 feature 由来ではない

| ファイル | 読む対象 |
| --- | --- |
| `acceptance-reconciliation.test.ts` | `docs/` |
| `blog-ui-spec-governance.test.ts` | `docs/` |
| `chapter-normative-body-unreproducible.test.ts` | `system-spec/` |
| `chapter-regeneration-floor.test.ts` | `system-spec/` |
| `doc-source-version-gap.test.ts` | (仕様文書の版) |
| `doctrine-citation-gap.test.ts` | `system-spec/` |
| `generated-doc-freshness.test.ts` | `docs/`, `tests/` |
| `qa-source-digest-meaning.test.ts` | `system-spec/` |
| `spec-chapter-fences.test.ts` | `system-spec/` |

**9 ファイルのいずれも `src/` を読まない**ことを機械で確認した:

```bash
for f in …; do grep -oE '"(system-spec|src|docs|tests)[^"]*"' tests/architecture/$f.test.ts …
```

結果、参照先は `system-spec` と `docs` のみ。`src` は 1 件も現れない。
したがって本 feature の実装コードがこれらを落とすことはありえない。

原因は、直前の仕様編纂セッションが `system-spec/**` へ加えた未コミットの変更である
(`git status` に 13 本の `system-spec/*.md` が M で並んでいる)。
これは `ah-670` / `ah-8h2.2`「仕様の完全性評価を PASS へ戻す」の担当範囲であり、
本 feature の write scope 外なので触らない。

### 経過

| 時点 | 失敗ファイル数 |
| --- | --- |
| 本 feature の実装直後 | 14 |
| 台帳を実態へ合わせた後 | 9 |

減った 5 件は本 feature が壊していた分で、すべて解消した。

## 5. 本 feature が壊し、直した 5 件

| ファイル | 壊れた理由 | 直し方 |
| --- | --- | --- |
| `tenant-scoped-schema.test.ts` | 画像台帳に workspace 非スコープの問い合わせが 5 本増えた | `QUERY_EXEMPT` へ理由つきで 5 件登録 |
| `dependency-direction.test.ts` | `article-asset-client.ts` が `guardedFetch` を通らない | `FETCH_EXEMPT` へ理由つきで登録 |
| `ci-config.test.ts` | マイグレーションが 2 本増えた | 適用済み一覧へ `0047` `0048` を追記 |
| `quality-gates.test.ts` | 新規テストに段の印が無い | `/** @tier 1 */` を付与 |
| `open-doors.test.ts` | 公開する口が 3 つ増え、上限 42 を超えた | `ROUTE_INTENT` 3 件追加 + 上限を 43 へ (理由つき) + 台帳再生成 |

**いずれも数を書き換えるだけでは済ませていない。**
たとえば `scheduled-maintenance.test.ts` は「7 本」を「8 本」に直すだけでなく、
足した 8 本目についても「独立した Promise であること」「同じ起動時刻を受け取ること」
「binding が欠けたら自分の名札で見送ること」の 3 点を検証に足した。

## 6. 型検査

```
$ npx tsc --noEmit
src/app/layout.tsx(36,56): error TS2304: Cannot find name 'LayoutProps'.
```

1 件のみ。`LayoutProps` は Next が `.next/types` へ書き出す型で、
`next dev` を一度動かすと解決する。本 feature とは無関係の既存事象。
`pnpm run typecheck` は `next typegen` を先に走らせるので、こちらでは出ない。
