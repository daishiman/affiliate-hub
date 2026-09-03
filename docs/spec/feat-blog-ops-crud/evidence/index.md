# 証跡（feat-blog-ops-crud / P11）

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- current status: `revalidation_pending` (以下の 2026-08-26 ログは削除せず監査履歴として保持)

集約日: 2026-08-26

ここに置いてあるのは **実行ログそのもの**である。要約は
[`../qa-report.md`](../qa-report.md) と [`../final-review.md`](../final-review.md) にある。

**この 2 つを分けてある理由。** 要約だけがある文書は、次に読む人が
「本当にそう出たのか」を確かめられない。ログだけがある置き場は、
読む人が何百行の中から意味を拾い直す羽目になる。片方だけでは足りない。

**原本は書き換えていない。** ここのログはこの回に**新しく取り直したもの**で、
判定に使った仕様文書（`acceptance-report.md` など）は同じ階層の原本を
リンクで指している。コピーを置くと、原本を直した日にここが古いまま残る。

---

## ログ一覧

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
