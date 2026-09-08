# 品質検査の報告 (P09 / SYS-SITE-SCOPED-AUTHORING-IA-P09)

- feature: `feat-site-scoped-authoring-ia`
- 実施日: 2026-09-08
- 消費した成果物: `docs/spec/feat-site-scoped-authoring-ia/migration-report.md`

## 1. 判定一覧

| 検査 | 基準 | 実測 | 判定 |
|---|---|---|---|
| 型検査 (`pnpm run typecheck`) | エラー 0 | 0（出力なし） | **PASS** |
| lint (`pnpm run lint`) | 指摘 0 | 0（出力なし） | **PASS** |
| axe-core | 重大違反 0 | **違反 0**（重大に限らず全件） | **PASS** |
| 動詞ラベルの正答率 | 90% 以上 | 参加者 0 名 | **BLOCKED** |
| 危険操作の確認分岐 | 新設画面が規則から外れない | 新設 5 枚は危険操作を 1 つも持たない | **PASS** |
| 応答性能 | 基準の明文なし | 認証関門までの応答は中央値 3.5–4.5ms。**画面本体の描画時間は未測定** | **PARTIAL** |
| 決定論検証 (`validate-system-plan.py`) | `violations: []` | `violations: []` | **PASS** |

## 2. axe-core — 「重大違反 0」より厳しい基準で通っている

本 repository の axe 検査は、P09 の基準（重大違反 0）より広い。

- 見る規則: **WCAG 2.2 AA まで + `best-practice`**（`tests/support/a11y.ts` の `A11Y_TAGS`）
- 判定: `expect(violations).toEqual([])` ——
  **impact の重さで絞らず、1 件でも出れば落ちる。**

新設 6 画面がこの検査に載っていることは、載せ方が保証している。
`tests/ui/route-cases.ts` の管理画面ケースは `ADMIN_ROUTE_METADATA`（route の正本）からの
**射影**であり、手書きの一覧ではない。

```ts
const ADMIN: readonly RouteCase[] = ADMIN_ROUTE_METADATA.map((route) => { ... });
```

つまり **route を 1 本足せば、その画面は自動的に描画と axe の対象になる**。
「画面は足したが検査の一覧に足し忘れた」という抜け方ができない。

実測: `npx vitest run tests/ui` → **120 ファイル / 3808 テスト 全通過**（182.97s）。

### 自動検査で分からないことを、分かったことにしない

`tests/support/a11y.ts` 自身が書いているとおり、axe が見つけるのは
アクセシビリティの問題のおよそ 3〜4 割である。「この代替テキストが内容を説明しているか」は
機械には判定できない。**axe が通ったことを「アクセシブルである」と読み替えていない。**
本 repository は分からない側を別の検査（`axe-blind-spots.test.ts` /
`tap-target-floor.test.ts` / `layout-density.test.ts`）で補っており、それらも同じ 120 ファイルに含まれる。

## 3. 危険操作の確認分岐

規則そのものの正本は `feat-reference-blog-admin-ux` であり、本 feature は**適用する側**である。
したがってここで見るのは 1 点、**新設画面が規則の外に新しい危険操作を持ち込んでいないか**。

新設 5 枚（`authors` / `authors/new` / `audience/personas` / `audience/personas/new` / `writing`）の
本文を走査し、`deleteSite` / `publishSite` / `updateDomain` / `deleteArticle` の
いずれも呼んでいないことを確認した（`tests/acceptance/site-scoped-redirect-map.test.ts` A9 群）。

この検査には**母集団の床**が張ってある。5 枚を実際に読めたことを先に主張してから
「違反 0」を言うので、画面が消えても緑になる形にはなっていない。

## 4. 動詞ラベルの正答率 — BLOCKED

初見の運営者にラベル一覧だけを見せ、各入口で何ができるかを言わせる調査で、
**外部参加者を必要とする**。参加者 0 名。自動テストで代用していない。

代用しない理由は明確で、この基準が測っているのは「実装がラベルを出しているか」ではなく
**「そのラベルを読んだ初見の人が意味を取れるか」**だからである。
前者はテストで緑にできるが、それを根拠に 90% と書けば数字を捏造したことになる。

規則の正本 `feat-reference-blog-admin-ux` の同基準（A6）も、同じ理由で BLOCKED のまま。
`docs/spec/feat-reference-blog-admin-ux/usability-test-protocol.md` に手順がある。

## 5. 応答性能 — PARTIAL

`pnpm run preview`（`http://localhost:8787`）で各 route を 3 回ずつ叩き、中央値を取った。

| path | 中央値 |
|---|---:|
| `/admin/personas`（転送の殻） | 4.5 ms |
| `/admin/writing`（転送の殻） | 3.6 ms |
| `/admin/sites/first-camera/authors` | 3.5 ms |
| `/admin/sites/first-camera/writing` | 3.9 ms |
| `/admin/writing/template` | 3.6 ms |

**この数字は画面の描画時間ではない。** どれも未ログインで、認証関門が
`/signin` への 307 を返すまでの時間である。ログイン後の描画は測っていない。
数字だけを表に並べて「速い」と書くと、測っていないものを測ったことにできてしまうので明記する。

言えるのは次の 2 点に留まる。

1. 対象 9 route すべてが 500 / 404 を出さずに関門へ到達する（＝ route が配線されている）
2. 本 feature は**新しい集計表も新しい問い合わせも増やしていない**（A10 / `drizzle/*.sql` は 51 本のまま）。
   新設画面が読むのは既存の repository で、画面 1 枚あたりの問い合わせ本数は移設前と同じである

P07 の基準に応答性能の**数値目標が書かれていない**ため、閾値との比較はしていない。
数値目標を置くなら P12（運用）で決めるのが筋である。

## 6. 既存の失敗 3 ファイルの扱い（P06 からの申し送り）

`npx vitest run`（全量）は 530 ファイル中 527 通過、3 失敗である（テスト件数では 11,879 件中 5 件）。

| ファイル | 失敗 | 領域 |
|---|---:|---|
| `tests/architecture/blog-ui-spec-governance.test.ts` | 1 | `.dev-graph/` の feature node lineage |
| `tests/architecture/chapter-regeneration-floor.test.ts` | 3 | `system-spec/` の章の再生成 |
| `tests/architecture/reopen-discard-restore-gap.test.ts` | 1 | `system-spec/` の退避セルの復帰 |

**本 feature の回帰ではない。** `HEAD`（`ed98785a`）の一時 worktree を作って同じ 3 ファイルを
走らせたところ、同じ 5 件が同じ理由で落ちた（`test-run-report.md` §3）。
いずれも `system-spec/` と `.dev-graph/` の文書ガバナンス側で、本 feature の作業ツリーは
その配下を 1 バイトも変更していない。

P09 として取れる対処は無い。3 件はいずれも
**別 feature の文書世代（`feat-blog-ui-builder` の lineage、`system-spec` の章の再生成）**が原因で、
本 feature の write scope の外にある。P10 で「別 feature の残課題」として切り出す。

## 7. 実行したコマンド

```
pnpm run typecheck                       # 出力なし = エラー 0
pnpm run lint                            # 出力なし = 指摘 0
npx vitest run tests/ui                  # 120 files / 3808 tests 全通過
npx vitest run                           # 530 files / 527 pass / 3 fail（§6 の既存分）
pnpm run build                           # exit 0
pnpm run preview                         # Ready on http://localhost:8787
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia   # violations: []
```

- Required evidence: 本ファイル
