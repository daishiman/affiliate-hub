# P06 テスト実行の記録

- graph_node_id: `SYS-AUTH-WORKSPACE-P06`
- 実行日: 2026-08-24
- 位置づけ: 派生文書（非規範）。規範は確定済み仕様章（auth / security / database）。

## この文書が答えること

**何を走らせ、何が取れて、何が取れなかったか。** 取れなかったものを空白にしない。

## 実行条件

| 項目 | 値 |
|---|---|
| ブランチ | `daishiman/task20-2` |
| 作業ツリー | 未コミット変更あり。**他の作業者（ah-099 コンプライアンス）が並走中** |
| 実行時刻 | 13:13〜13:45 JST |

## ① 全テストの実行（証跡: `test-results.json`）

```
pnpm vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary \
  --coverage.reportsDirectory=evidence/P06/coverage \
  --reporter=json --outputFile=evidence/P06/test-results.json
```

| 項目 | 値 |
|---|---|
| テスト総数 | **6748** |
| 通過 | **6748** |
| 失敗 | **0** |
| 終了コード | **0** |

**パイプを通していない。** `| tail` を挟むと終了コードが化けて、赤でも 0 が返る。

### 緑になるまでに直した 5 件

最初の実行は 5 件赤だった。5 件とも本 feature の外（ah-099 のコンプライアンス作業と、
それが持ち込んだ 50 枚目の画面）に由来する。**閾値は 1 つも下げていない。**

| # | 何が赤だったか | どう直したか |
|---|---|---|
| 1 | `tests/ui/app-shell-nav.test.tsx`: 画面数 49 期待、実物 50 | `find src/app/admin -name page.tsx \| wc -l` = **50** を確かめたうえで 50 へ。これは「画面を足したら人が必ず気づく」ための仕掛け線であって品質の閾値ではない |
| 2 | `tests/architecture/open-doors.test.ts`: `editDisclosureAction()` / `editPolicyRuleAction()` の意図が未宣言 | `ACTION_INTENT` へ 2 件を宣言（どちらも「ログイン」・可逆「つく」）。`UPDATE_OPEN_DOORS=1` で人が読む台帳 `docs/product/open-doors.md` も作り直した |
| 3 | `tests/ui/screen-hit-and-current.test.tsx`: `settings/compliance` の `<input>` 4 本が押しどころの下限を持たない | 素の `<input type="checkbox">` を直に置いていた。`Checkbox` 部品を新設し（`.choiceItem` で包む）差し替え |
| 4 | `tests/ui/ui-layers.test.ts`: 新設 `Checkbox` が見本帳に無い | `/admin/ui-catalog` の入力見本へ追加（`CheckboxGroup` の隣に置き、使い分けを見比べられるようにした） |
| 5 | `tests/architecture/acceptance-reconciliation.test.ts`: 評価 digest が古い | `node scripts/acceptance-reconciliation.mjs --write`（10 IDs / 136 証跡ファイルで PASS） |

## ② カバレッジ（**取れた**）

`evidence/P06/coverage/coverage-summary.json`

| | 実測 | 下限 | 判定 |
|---|---|---|---|
| Lines | **91.53%** (9433/10305) | 80% | **満たす** |
| Statements | **89.25%** (10487/11749) | 80% | **満たす** |
| Functions | **89.56%** (2883/3219) | 80% | **満たす** |
| Branches | **81.56%** (7482/9173) | 80% | **満たす** |

### P11 の 69.32% との差は、回帰でも改善でもない

P11 は `tests/{acceptance,domain,infrastructure,application,presentation,property}` の 6 ディレクトリだけで
測っており、`tests/ui` `tests/architecture` `tests/integration` が担当する `src/app/` が
丸ごと未実行として分母に乗っていた。P11 自身が「**下振れ**」と明記している。
**同じ土俵の数字ではないので、69.32 → 91.53 を「上がった」と読んではいけない。**

### この feature が動かした値

| ファイル | 前 | 後 |
|---|---|---|
| `src/middleware.ts` | **0%**（3611 件で 1 行も実行されず。P10 FR-02） | **100%** |
| `src/application/access-denial.ts` | 存在しない | 100% |
| `src/application/usecases/generation/draft-content-variant.ts` | — | 98.07% |
| `src/presentation/ui/primitives/checkbox.tsx` | 存在しない | 100% |

### なぜ最初の 3 回は取れなかったのか（実測で確かめた）

**このリポジトリの vitest は、テストが 1 件でも落ちると `coverage-summary.json` を書かない。**
同じフラグで 2 通り走らせて確かめてある。

| 実行対象 | 結果 | `coverage-summary.json` |
|---|---|---|
| 全体（5 赤のとき） | 赤 | **書かれない** |
| `tests/acceptance/feat-auth-workspace`（47 件全緑） | 緑 | 書かれた |
| 全体（0 赤になった後） | 緑 | **書かれた** |

つまり「カバレッジが出ない」は測定の失敗ではなく、**先にツリーを緑にせよ**という順序の制約である。

## ③ Workers ランタイム（`pnpm run preview`）は**途中まで**

**確かめられたこと。**

| 何 | 結果 |
|---|---|
| `pnpm run build`（Next の組み立て、`tsc` を含む） | 終了コード **0** |
| `pnpm run build:worker`（OpenNext での worker 化） | `.open-next/worker.js` を出力。「OpenNext build complete.」 |
| `opennextjs-cloudflare preview` の起動 | `workerd` が `127.0.0.1:8787` と `[::1]:8787` で LISTEN（`lsof` で確認） |
| 結び付け | `env.DB`（`affiliate-hub-db-dev`, D1 local）/ `env.BUCKET`（`affiliate-hub-assets-dev`, R2 local）/ `env.ASSETS` / `env.LLM_PROVIDER_CATALOG` |

途中で `next build` が **`tests/acceptance/feat-auth-workspace/brand-defaults-wiring.test.ts(136,7): TS2741 Property 'embed' is missing`**
で落ちた。vitest は型を見ないので、この誤りは**テストが全部緑のまま**残っていた。
偽の `LlmPort` に `embed` を足して直した（空配列ではなく投げる実装にした。
空を返すと、うっかり `embed` を呼ぶ経路が緑のまま通ってしまう）。

**確かめていないこと。** 起動した 8787 へ **HTTP 要求を 1 本も出していない。**
本セッションでは疎通確認のコマンドが利用者に断られており、
別の書き方で通すことはしていない（「断られたコマンドは迂回しない」）。
したがって「画面が Workers 上で正しく描画される」は**未検証**である。
引き取り先は `docs/spec/feat-auth-workspace/release-notes.md` §7。

## 走らせていないもの

| 何 | なぜ |
|---|---|
| `tests/e2e`（Playwright） | ブラウザ実行が要る。`pnpm run test:e2e:prepare` によるセッション投入は済み |
| ミューテーション検査 | 段 3（`runOn: "nightly"`）。P06 の範囲外 |
| 8787 への HTTP 要求 | 上記のとおり。起動までは確認済み |
