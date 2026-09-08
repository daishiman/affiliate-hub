# テスト全量実行の報告 (P06 / SYS-SITE-SCOPED-AUTHORING-IA-P06)

- feature: `feat-site-scoped-authoring-ia`
- 実行日: 2026-09-08
- 実行環境: darwin 25.3.0 / Node (pnpm) / Vitest 4.1.10
- 消費した設計: `docs/spec/feat-site-scoped-authoring-ia/test-design.md`

## 1. 実行したコマンドと結果

| コマンド | 結果 |
|---|---|
| `pnpm test` (= `vitest run`, 全量) | **530 ファイル中 527 通過 / 3 失敗**（11,879 件中 5 件失敗。失敗は下記 §3 の既存分のみ） |
| `pnpm run test:coverage` (本 feature の範囲へ絞った再測定を含む) | 実行完了。新規コードのカバレッジは §2 |
| `pnpm run typecheck` | 通過（型エラー 0） |
| `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` | `violations: []` |

本 feature が触る 4 スイート（`tests/ui` / `tests/presentation` / `tests/acceptance` / `tests/application`）は、
上記の全量実行ですべて通過している。

## 2. 新規実装コードのカバレッジ

受入条件は「新規実装コードで 80% 以上」。本 feature が新しく書いたモジュールの実測は次のとおり。

| ファイル | 行 | 分岐 | 関数 |
|---|---|---|---|
| `src/domain/authoring/pattern-writing-emphasis.ts` | 100% | 100% | 100% |
| `src/application/usecases/authoring/clone-writing-method-for-site.ts` | 100% | 100% | 100% |
| `src/presentation/admin/site-scoped-redirect.ts` | 100% | 100% | 100% |
| `src/presentation/admin/legacy-admin-redirect.ts` | 100% | 100% | 100% |
| `src/presentation/admin/resolve-site.ts` | 100% | 100% | 100% |
| `src/presentation/admin/work-object-board.ts` | 96% | 100% | 100% |

`work-object-board.ts` の未踏 1 行は `topLevelOf` の**周回上限に達したときの `return null`** である。
`ADMIN_ROUTE_METADATA` の親子関係に循環が入らない限り到達しない防御で、
到達させるには正本の表を壊した状態を作る必要がある。壊した表を検査用に用意すると
「正本を 1 つに保つ」という本 feature の前提そのものを検査の中で破ることになるので、埋めていない。

### 測定中に足したテスト

初回測定で `resolve-site.ts` の分岐 50%、`legacy-admin-redirect.ts` の分岐 66.7% だった。
未踏だったのは**外の世界が期待どおりに返らなかったとき**の枝で、
どれも「例外にせずブログ選択へ出す」(A3) という約束そのものだった。
`tests/presentation/site-scoped-entry.test.ts` (7 件) を足して 100% にした。

- ブログ一覧が引けないとき、cookie に slug があっても採用せずブログ選択へ送る
- cookie が無くてもブログが 1 本ならそこへ送る
- `?site=` が配列で来たら無かったものとして扱う（`site=a,b` のような住所を作らない）
- 対応表に無い旧住所は勝手な行き先を作らない
- `resolveSiteOrNotFound` が引けたときに名前と型を渡し、引けないときは理由を言い分けずに `notFound()`

## 3. 残っている失敗 3 ファイル（本 feature の変更が原因ではない）

| ファイル | 失敗 | 内容 |
|---|---|---|
| `tests/architecture/blog-ui-spec-governance.test.ts` | 1 | `feat-blog-ui-builder` の feature node lineage が source chapter の bytes と一致しない |
| `tests/architecture/chapter-regeneration-floor.test.ts` | 3 | `frontend` / `ui-ux` 章の再生成結果が現行ファイルと一致しない・compile の申し送り増 |
| `tests/architecture/reopen-discard-restore-gap.test.ts` | 1 | `ui-ux/web: required_info_checks` が退避されたまま確定セルへ戻っていない |

**推測ではなく実測で切り分けた。** `HEAD` (`ed98785a`) の一時 worktree を作り、この 3 ファイルだけを走らせたところ
**同じ 5 件が同じ理由で落ちた**。いずれも `system-spec/` と `.dev-graph/` の文書ガバナンス側で、
本 feature の作業ツリーはその配下を 1 バイトも変更していない。

> 後片付けの申し送り: 切り分けに使った `/tmp/ah-base` の worktree は、撤去コマンド
> (`git worktree remove --force /tmp/ah-base`) の実行許可が下りなかったため**残置している**。
> 不要になり次第、手元で撤去すること。

## 4. 本 feature の変更が原因で落ち、この phase で直したもの

| 検査 | 何が起きたか | どう直したか |
|---|---|---|
| `tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts` | 情報台帳が 93 route のままで、新設 6 画面が載っていない | 台帳へ 6 route を追記し `routeCount` を 99 へ。`foldableRouteIds` を移設先へ差し替え |
| 同上 | `FOLDABLE_ROUTES` が転送の殻になった `personas/audiences` を指していた | 実体のある `sites/[site]/audience/personas` へ移した |
| 同上 | `ADMIN_CARD_ROUTE_IDS` に移設先の 2 画面が無い | `sites/[site]/authors/new` と `sites/[site]/audience/personas/new` を追加 |
| `tests/architecture/form2-population-floor.test.ts` | 床を持たない検査が 25 件（上限 24）。増やしたのは本 feature の 3 件 | 3 件それぞれの `it` の中へ、**実際に読めたファイル数**への床を足した（配列リテラルではなく走査結果へ張る） |
| `tests/architecture/open-doors.test.ts` | 入口の台帳が新設 route を知らない | `UPDATE_OPEN_DOORS=1` で再生成 |
| `tests/architecture/generated-doc-freshness.test.ts` | `docs/product/test-traceability.md` のテストファイル数が古い | `node scripts/traceability.mjs` で再生成（テストを足すたびに要る） |
| `tests/architecture/acceptance-reconciliation.test.ts` | 評価 digest と検査対象パターンの実測が古い | `node scripts/acceptance-reconciliation.mjs --write` で再生成（PASS / 10 IDs / 220 evidence files） |

## 5. 判定

- 新規実装コードのカバレッジ 80% 以上: **達成**（行 96–100% / 分岐 100% / 関数 100%）
- 本 feature に由来する失敗: **0 件**
- 既存テストの回帰: **0 件**（残る 3 ファイルは `HEAD` でも同じく落ちる既存分）
- Required evidence: 本ファイル

受入条件のうち「`pnpm test` の失敗 0 件」だけは、上記の既存 3 ファイルが残るため**文字どおりには満たしていない**。
既存分であることを実測で示したうえで、本 feature のスコープ外として P09 / P10 へ申し送る。
