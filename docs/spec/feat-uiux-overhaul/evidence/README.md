# 証跡（feat-uiux-overhaul / P11）

初回集約日: 2026-08-22

## 現在の証跡

`00`〜`08` は 2026-08-22 の P11 履歴であり、そこにある 52 failures や test 件数を
現在値として扱わない。現在のA1〜A10は次の2つで読む。

- [`../acceptance-reconciliation.json`](../acceptance-reconciliation.json): A1〜A10を
  requirement / runtime / test / report / trackingへjoinする正本
- [`09-acceptance-reconciliation.txt`](./09-acceptance-reconciliation.txt): 現在の評価対象digestと
  3状態軸（実装合格 / 未公開 / active）の自動生成結果
- [`10-final-review-gates-20260823.txt`](./10-final-review-gates-20260823.txt): 2026-08-23 最終レビューで再実行した型検査・受入検査・突合の生結果

実テストの最新件数は、この突合証跡ではなく、その時点の `pnpm test -- --reporter=dot` の
実行結果を使う。reconciliation PASSをテスト実行PASSの代わりにしない。

判定の根拠がレポートの文章の中にしか無いと、後から退行したときに
「そのとき何が緑だったのか」を誰も確かめられない。ここには**コマンドの生出力**を置く。

各報告書（[`acceptance-report.md`](../acceptance-report.md) /
[`quality-report.md`](../quality-report.md) /
[`final-review.md`](../final-review.md)）に書いた数字は、すべてこの中の出力から来ている。

---

## 2026-08-22 の履歴

| ファイル | 何の出力か | 要点 |
|---|---|---|
| `00-environment.txt` | 環境（node / vitest / OS / 枝 / HEAD / 未コミット差分の件数） | 再現条件。ここが違えば数字は一致しない |
| `01-typecheck.txt` | `npx tsc --noEmit` | **エラー 0 件**（exit=0） |
| `02-lint.txt` | `npx eslint` | **0 errors / 1 warning**（`stryker.config.mjs` の 1 件は本 feature 以前から在る） |
| `03-acceptance-tests.txt` | A1〜A10 に対応する検査 8 群 | **273 件すべて通過**（exit=0） |
| `04-full-suite-coverage.txt` | `npx vitest run --coverage --coverage.reportOnFailure` | 52 failed / 5447 passed。失敗はすべて既知 blocker |
| `05-coverage-by-layer.txt` | `node scripts/coverage-report.mjs` | **すべての層が下限を満たしています。** 下限は 1 つも下げていない |
| `06-known-failures.txt` | 04 から失敗を自動集計 | 6 ファイル・計 52 件。集計方法も併記 |
| `07-a4-channel-extension.txt` | A4 の実測（配信先を 1 件足して測る） | 画面側 **0 行**。型エラーは `channel-registry.ts` の 1 件だけ |
| `08-plan-validation.txt` | `validate-system-plan.py` | **実行できなかった**（current ポインタが無く入口で停止）。手で書いて通していない理由と follow-up `ah-k9b` |

---

## 再現手順

作業ツリーの根で、上から順に実行する。所要はおおむね 3 分。

```bash
# 0. 環境を控える（数字が合わないときの最初の確認先）
node -v && npx vitest --version && git rev-parse HEAD

# 1. 型検査
npx tsc --noEmit

# 2. 静的解析
npx eslint

# 3. 受入 A1〜A10 の検査
npx vitest run \
  tests/ui/uiux-screen-single-purpose.test.ts \
  tests/ui/uiux-admin-api-contract.test.ts \
  tests/ui/uiux-channel-status.test.tsx \
  tests/ui/uiux-concept-matrix.test.tsx \
  tests/ui/uiux-duplicate-implementation.test.ts \
  tests/ui/uiux-blog-scaffold.test.ts \
  tests/ui/uiux-spacing-and-copy.test.ts \
  tests/ui/uiux-sidebar-icons.test.tsx

# 4. 全量とカバレッジ
npx vitest run --coverage --coverage.reportOnFailure

# 5. 層別カバレッジの判定
node scripts/coverage-report.mjs
```

### 手順 4 の `--coverage.reportOnFailure` は外さないこと

`coverage.reportOnFailure` の既定は **false**。テストが 1 件でも落ちていると
`coverage/coverage-summary.json` を含むレポートが**一切生成されない**。

このリポジトリは既知 blocker で 52 件が赤いままなので、この指定を外すと
手順 5 が「測れない」ではなく「0 件」として読まれる。ここが最も踏みやすい落とし穴。

### A4（手順 7）だけは手順が違う

`07-a4-channel-extension.txt` に、退避 → 1 エントリ追加 → 測定 → 復元の
全手順と、退避前後の sha1 を書いてある。**変更量では測れない**理由もそこに書いた。

---

## 数字が合わなかったときの読み方

| 症状 | まず見る場所 |
|---|---|
| カバレッジが 0 と出る | `--coverage.reportOnFailure` が付いているか |
| 失敗が 52 件より多い | `06-known-failures.txt` の 6 ファイルと突き合わせる。それ以外が増えていれば本作業以降の退行 |
| 失敗が 52 件より少ない | `ah-a0o` / `ah-v6n` のどちらかが解決された可能性。喜んでよいが、床を下げて緑にしていないかを先に確認する |
| 層別で下限割れが出る | `quality-gates.config.mjs` が下限の正本。**下げて緑にすることは禁止**（`docs/product/ci-cd-guide.md` ④） |

## 2026-08-22 当時の既知の失敗 52 件

| blocker | 件数 | 検査 |
|---|---:|---|
| `ah-a0o` | 42 | `chapter-regeneration-floor` |
| `ah-a0o` | 3 | `chapter-normative-body-unreproducible` |
| `ah-a0o` | 3 | `doctrine-citation-gap` |
| `ah-a0o` | 2 | `doc-source-version-gap` |
| `ah-a0o` | 1 | `generated-doc-freshness` |
| `ah-v6n` | 1 | `qa-scope-notes-coverage` |

この 52 件は P01 の着手前から赤く、当時の本 feature 作業では **1 件も増減していなかった**。
現在の失敗件数を表すものではない。
根は `system-spec/*.md` の章再生成退行で、この feature の外にある。

## ここに無いもの

証跡が無いということは、測っていないということ。「問題なし」ではない。

- 計画パッケージの決定論検証（`ah-k9b`。`08-plan-validation.txt` に、実行できなかった記録と、
  手でポインタを書いて通さなかった理由を残した）
- アクセシビリティの自動検査（`ah-9pk`）
- 見た目の崩れの自動検出（`ah-h57`。基準画像 5 枚を置いた段階で、差分検出の常時実行は無い）
- 応答性能
- 実ブラウザでの動作確認
