# 証跡（feat-blog-ops-crud / P11）

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- current status: `revalidated (2026-09-08)`

**ログは 2 世代ある。**

| 世代 | 置き場 | 扱い |
|---|---|---|
| **2026-09-08**（現行） | [`2026-09-08/`](./2026-09-08/) — 12 ファイル | P10 promotion の入力はこちら |
| 2026-08-26（履歴） | この階層直下の `00-`〜`08-` | 監査履歴。削除せず保持。**判定に使わない** |

新しい回を古いファイルへ上書きしていないのは、**数字が動いた事実そのものが証拠**だからである。
上書きすると「最初からこの数字だった」ように読めてしまう。
2026-09-08 の回では E2E を実際に走らせている（P06 が空欄にした欄がここで埋まった）。

集約日: 2026-08-26（この階層直下のログ） / 2026-09-08（`2026-09-08/`）

ここに置いてあるのは **実行ログそのもの**である。要約は
[`../qa-report.md`](../qa-report.md) と [`../final-review.md`](../final-review.md) にある。

**受入条文 A1〜A14 と証跡の対応は
[`acceptance-evidence-map.json`](./acceptance-evidence-map.json) が正本**であり、
下の「## 条文と証跡の対応」はその読みやすい写しである。
機械が読む側を正本にしたのは、条文の被覆を人が目で数え直すと数え方がその都度変わるためである。

**この 2 つを分けてある理由。** 要約だけがある文書は、次に読む人が
「本当にそう出たのか」を確かめられない。ログだけがある置き場は、
読む人が何百行の中から意味を拾い直す羽目になる。片方だけでは足りない。

**原本は書き換えていない。** ここのログはこの回に**新しく取り直したもの**で、
判定に使った仕様文書（`acceptance-report.md` など）は同じ階層の原本を
リンクで指している。コピーを置くと、原本を直した日にここが古いまま残る。

---

## 条文と証跡の対応

正本は [`acceptance-evidence-map.json`](./acceptance-evidence-map.json)。以下はその写し。

| 条文 | 被覆 | 主な証跡 |
|---|---|---|
| A1 サイト網の CRUD・削除後 404・復元 | 部分 | `tests/e2e/public-site-lifecycle.spec.ts` ほか |
| A2 ハブトップ 5 帯の順序と件数上限 | 機械 | `tests/ui/blog-top-bands.test.tsx:104` |
| A3 サブサイトの独自要素と網共有ヘッダー | 機械 | `tests/acceptance/feat-blog-ops-crud/subsite-shared-header.test.ts` |
| **A4 T1-T4 テンプレートと AT/BP 検証エラー** | **実装未達** | **無し**（監査イベント側のみ `tests/integration/d1-blog-ops-tenancy.test.ts`） |
| A5 T1 記事の部品列・カード再掲・目次階層 | 機械 | `tests/ui/blog-article-view.test.tsx` |
| A6 サイドバー 8+2・HTML 除去・折りたたみ | 機械 | `tests/ui/blog-sidebar.test.tsx`, `tests/domain/custom-html-sanitize.test.ts` |
| A7 固定ページ 8 種と legal-nav 自動反映 | 機械 | `tests/ui/public-site-projection.test.ts` |
| A8 kind=brand タグとクラウド反映 | 機械 | `tests/ui/blog-sidebar.test.tsx`, `tests/domain/blog-ops.test.ts` |
| A9 配信物一式と delivery_snapshots 記録 | 部分 | `tests/application/blog-ops-usecases.test.ts` ほか |
| A10 評価 3 列の並べ替え・絞り込み | 機械 | `tests/domain/blogops/operational-health.test.ts` |
| A11 読者評価の送信・非表示・公開面非露出 | 機械 | `src/domain/blogops/reader-rating.ts:68` ほか |
| **A12 全操作の監査と edge cache TTL 10 分** | **条文と機構が食い違い** | 監査側のみ。TTL 側は `revalidatePath` で設計が異なる |
| A13 参考サイト転用 0 件の grep ゲート | 部分 | `2026-09-08/05-reference-reuse-gate.txt`（構造側のみ） |
| A14 主要 6 画面の axe-core 重大違反 0 | 機械 | `tests/ui/blog-ops-a11y-floor.test.tsx` |

**空欄を作らず「無し」と書いてある。** 表から行ごと省くと、
その条文を確かめ忘れたのか確かめて無かったのかが後から区別できない。
A4 と A12 が promotion を止めている理由は
[`../final-review.md`](../final-review.md) にある。

条文をまたぐ所見（E2E の flaky・`feat-site-blueprint` の宣言と実態の食い違い）は
map の `cross_cutting_findings` にある。**どの条文にも属さないので条文表からは見えない。**

## ログ一覧（2026-09-08 / 現行）

| ファイル | 内容 | 結果 | sha256（先頭 16） |
|---|---|---|---|
| [`00-environment.txt`](./2026-09-08/00-environment.txt) | node / pnpm の版、HEAD、未コミット差分の件数 | node v22.21.1 / HEAD `875457f9` | `6bbb3b3393ff66f3` |
| [`01-typecheck.txt`](./2026-09-08/01-typecheck.txt) | `npx tsc --noEmit` | エラー 0 件 | `bf4b0469930517ea` |
| [`02-lint.txt`](./2026-09-08/02-lint.txt) | `npx biome check src/ tests/ scripts/` | 指摘 0 件 | `ff6ff1597ef922fd` |
| [`03-full-suite.txt`](./2026-09-08/03-full-suite.txt) | `npx vitest run` | 514 files / 11392 tests 通過 / 0 失敗（469 秒） | `e5a9137a8c0b0ae1` |
| [`04-a11y-blog-ops.txt`](./2026-09-08/04-a11y-blog-ops.txt) | `npx vitest run tests/ui/blog-ops-a11y-floor.test.tsx` | 7 件通過 / 重大違反 0 件 | `8670e9771a57ee20` |
| [`05-reference-reuse-gate.txt`](./2026-09-08/05-reference-reuse-gate.txt) | `node scripts/check-reference-site-reuse.mjs` | 137 ファイル検査 / 疑い 0 件（名前側は見送り） | `0f463f51e18ab269` |
| [`06-plan-validation.txt`](./2026-09-08/06-plan-validation.txt) | `validate-system-plan.py` | `"violations": []` | `0ec67889bfc1150b` |
| [`07-traceability.txt`](./2026-09-08/07-traceability.txt) | `node scripts/traceability.mjs` | 507 ファイル / 由来不明 2（上限 2） | `9a26114da8a4566d` |
| [`08-e2e.txt`](./2026-09-08/08-e2e.txt) | `npx playwright test` | 542 件通過 / 2 skip / 0 失敗（2.8 分） | `41caa3f55e97b9c5` |
| [`09-e2e-flakiness.txt`](./2026-09-08/09-e2e-flakiness.txt) | 同じ spec を 4 回 | **1 回落ちた / 3 回緑** | `7c5e5bb598bd624f` |
| [`10-p11-acceptance.txt`](./2026-09-08/10-p11-acceptance.txt) | P11 の受入 2 件（JSON parse / `validate-system-plan.py`） | 両方 exit 0 / `violations: []` | `a8e0ea2ac998bc8e` |
| [`11-p12-acceptance.txt`](./2026-09-08/11-p12-acceptance.txt) | P12 の受入 2 件 + 文書 3 件の sha + 文書を見張る検査 | 両方 exit 0 / 1074 件通過 | `3f233fbe29eb9a2a` |

**`08` の 542 件緑を単独で読まないこと。** 同じ日の `09` が、同じコードで
1 回落ちることを示している。`08` は 1 回の抽選の結果であって、
`09` の方が feature の状態をよく表している。

## ログ一覧（2026-08-26 / 履歴・判定に使わない）

| ファイル | 内容 | 結果 | sha256（先頭 16） |
|---|---|---|---|
| [`00-environment.txt`](./00-environment.txt) | node / pnpm の版、HEAD、未コミット差分の件数 | — | `1970e5fde923d850` |
| [`01-typecheck.txt`](./01-typecheck.txt) | `npx tsc --noEmit` | エラー 0 件 | `81e79c6985552cd4` |
| [`02-lint.txt`](./02-lint.txt) | `npx biome check src/ tests/ scripts/` | 指摘 0 件 | `fbbbbc2be408d349` |
| [`03-full-suite.txt`](./03-full-suite.txt) | `pnpm test` | 288 files / 7235 tests 通過 / 0 失敗 | `e5ca408fa23b7948` |
| [`04-a11y-blog-ops.txt`](./04-a11y-blog-ops.txt) | `npx vitest run tests/ui/blog-ops-a11y-floor.test.tsx` | 7 件通過 / 重大違反 0 件 | `abc95b00f2bc2d46` |
| [`05-reference-reuse-gate.txt`](./05-reference-reuse-gate.txt) | `node scripts/check-reference-site-reuse.mjs` | 61 ファイル検査 / 疑い 0 件 | `fe583f50c60d6877` |
| [`06-plan-validation.txt`](./06-plan-validation.txt) | `validate-system-plan.py` | `"violations": []` | `cdf12f07e32ebc41` |
| [`07-traceability.txt`](./07-traceability.txt) | `node scripts/traceability.mjs` | 由来不明 2（上限 2） | `85a83456df600dc7` |
| [`08-e2e.txt`](./08-e2e.txt) | `npx playwright test` | 364 件通過 / 0 失敗 | `4def2f25614c744f` |

## 空のログについて

`01` と `02` は、コマンドが**何も出力しない**ことが正常な結果である。
`tsc` は型エラーが 0 件なら黙り、`biome` は指摘が 0 件なら黙る。

**空ファイルを置くと、それが「実行して 0 件だった」のか
「実行を忘れて空のまま残した」のか区別できない。**
そのため exit code と実行したコマンドを本文へ書き込んである。

## 読む順番

1. [`../final-review.md`](../final-review.md) — feature 全体の判定（promotion 可否）
2. [`../qa-report.md`](../qa-report.md) — 各ゲートの実測と、緑にしなかった箇所の理由
3. [`../acceptance-report.md`](../acceptance-report.md) — 受入条文 A1〜A14 の 1 件ずつ
4. このディレクトリ — 上の 3 つが引いている生ログ

## この回に測っていないもの

| 項目 | 理由 |
|---|---|
| 本番 Cloudflare Workers での動作 | デプロイしていない（push 禁止） |
| 転用禁止ゲートの「名前で見る検査」 | 禁止語リストをリポジトリへ置かない設計。手元にファイルがある人だけが回せる |
| Lighthouse / 実回線の表示速度 | 受入条文に速度の述語が無い |
| 変異検査（Stryker） | task 仕様が要求していない |

**測っていないものを「問題なし」と読まない。** 測っていないだけである。
