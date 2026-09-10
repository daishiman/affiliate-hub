# 証跡の所在

**phase**: P11 / SYS-FB-CAPTURE-EXCLUSION-P11

すべて**再現できる形**で置く。画面の写しやログの貼り付けは 1 枚も使っていない。
貼った瞬間に、その証跡は取り直せなくなるからである。

## 受入ごと

| 受入 | 証跡 | 取り方 |
|---|---|---|
| A1 | `tests/ui/feedback-capture-exclusion.test.tsx` の退避時点、UI 未描画、次 video frame 待ち、非対応 fallback | `pnpm exec vitest run tests/ui/feedback-capture-exclusion.test.tsx` |
| A2 | 同「「撮り直す」でも…」と多重撮り直しの stale 結果破棄 | 同上 |
| A3 | 同の拒否・非対応・45秒境界・停止 rAF / video frame callback | 同上 |
| A4 | `src/presentation/ui/patterns/feedback-button.tsx` の `captureScreen` 冒頭 | 読む（自動検査を置かない理由は `test-design.md`） |
| A5 | 同「撮り終わったら…」「2 回呼んでも…」「入れ子でも…」 | 同上 |
| A6 | `capture-exclusion.ts` の `FLOATING_OVERLAY_ATTR` と `tests/e2e/app-routes.spec.ts:146,187` | `grep -n "data-floating-overlay" -r src tests` |
| A7 | `tests/ui/floating-overlay-declaration.test.ts` | 下の変異手順 (1) |
| A1（CSS 側） | `tests/e2e/capture-self-exclusion.spec.ts` — 本物の Chromium で `getComputedStyle(...).visibility` を見る | `pnpm exec playwright test tests/e2e/capture-self-exclusion.spec.ts` → desktop/mobile 4 件緑 |
| A1（実 capture probe） | `evidence/10-display-capture-probe.txt` | Chromium の `getDisplayMedia` は OS screen recording 境界で `NotReadableError`。直接画素証跡としては不採用 |
| **A1（実画素・本証跡）** | `evidence/12-capture-pixel-e2e.txt` — `tests/e2e/capture-pixel-exclusion.spec.ts` | `pnpm test:e2e:capture-pixel` → 1 passed。`floatingHits=0 / anchorHits=175561 / size=4480x3150`（2026-09-05 実測） |
| A6/A7（P08 統一） | `evidence/13-floating-overlay-unification.txt` | 重なり監査の `querySelector` 単数前提を複数の帯へ直した記録 |

**A1 に代理証跡が 3 段ある理由。** 退避は「属性を立てる側（TypeScript）」と
「それを見て隠す側（CSS）」に分かれ、さらにその後の video frame 到着を待つ。
**jsdom は CSS を当てない**ので、
単体テストは前者しか見ていない。規則の綴りが 1 文字違っても、
セレクタが CSS Modules に握り潰されても、**単体は全部緑のまま写り込みだけが戻る。**
後者は本物のブラウザでしか測れない。

3 段はどれも入力・中間状態の代理観測であり、**capture 出力自体の画素は読んでいない。**
そのため 2026-09-04 まで A1 は PARTIAL としていた。

**2026-09-05 に PARTIAL を解消した。**`tests/e2e/capture-pixel-exclusion.spec.ts` が
アプリ本体の経路（実際の「改善したいことを送る」ボタン → 実際の
`getDisplayMedia({ video: true, preferCurrentTab: true })`）を走らせ、
送信 UI が載せた canvas の**原寸の画素**（4480×3150 = 14,112,000 画素）を数える。

  - 浮遊要素 `[data-floating-overlay]` に magenta を塗る → 写しに **0 画素**
  - 浮遊**でない**固定要素に cyan を塗る → 写しに **175,561 画素**（対照）

**対照を先に検査しているのが要点である。**`toBe(0)` は走査が壊れていても通るので、
「無いことの証明」には「同じ手段で在るものが見つかる」ことが要る。
合成映像への差し替えはしていない。詳細と、走らせるのに要った 3 つの起動条件
（およびそれが撮影の中身を偽らない理由）は `12-capture-pixel-e2e.txt` に書いた。

## 変異手順（検査が空でないことの確認）

```bash
# (1) A7: 送信モーダルから名乗りを外す
#     feedback-button.tsx の dialog root から data-floating-overlay="true" を削除
pnpm vitest run tests/ui/floating-overlay-declaration.test.ts
#     → 赤。「.feedbackDialog」を名指しする。戻すと緑

# (2) A1(CSS 側): 退避規則の綴りを 1 文字だけ変える
#     patterns.module.css の html[data-capturing="true"] を "ture" にする
pnpm exec playwright test tests/e2e/capture-self-exclusion.spec.ts
#     → 4 件すべて赤（2026-08-30 実測）。戻すと 4 件緑
```

**この手順を実行して赤が出ないなら、検査が壊れている。**

## 全体

| 検査 | コマンド | 結果 |
|---|---|---|
| 型 | `pnpm run typecheck` | エラー 0 |
| 静的解析 | `pnpm run lint` | 指摘 0 |
| 単体・結合 | `pnpm vitest run` | 411 files / 9907 tests passed（2026-09-03）→ **493 files / 10981 passed / 0 failed**（2026-09-05） |
| feature 対象 | `pnpm exec vitest run tests/ui/feedback-capture-exclusion.test.tsx tests/ui/floating-overlay-declaration.test.ts` | 2 files / 22 passed |
| 受入 reconciliation | `pnpm run acceptance:reconcile` | PASS — 10 IDs / 196 evidence files、`sha256:35822cc2…` |
| 受入 reconciliation test | `pnpm exec vitest run tests/architecture/acceptance-reconciliation.test.ts` | 5 passed |
| 画面 (e2e) | `pnpm exec playwright test tests/e2e/capture-self-exclusion.spec.ts` | 4 passed (desktop/mobile × 2) |
| 画面 (e2e 全件) | `pnpm run test:e2e` | **508 passed / 2 skipped / 0 failed**（2026-09-05・342s） |
| 画面 (実画素) | `pnpm test:e2e:capture-pixel` | **1 passed**（`floatingHits=0`・要 headed 実行環境） |
| 計画 | `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-feedback-capture-self-exclusion` | status=pass / violations 0 / digest `sha256:892cd561…` |
| graph | `python3 .claude/plugins/dev-graph/scripts/validate-graph-schema.py --repo-root . --graph .dev-graph/state/graph.json` | valid / violations 0 |
| system-spec freshness | `node scripts/spec-freshness.mjs` | FRESH / PASS / 94 inputs |
| system-spec resume | `python3 .claude/plugins/dev-graph/scripts/validate-system-spec-resume.py --repo-root .` | valid=true / failures 0 |

`acceptance-reconciliation` の receipt は正規経路で現 worktreeへ同期済みである。
画素を直接観測していない A1 の PARTIAL は残るが、証跡digestの不一致とは別問題であり、
全体の決定論 gate はすべて PASS している。

### system-plan の世代収束

旧 generation `sha256:13ad980a…` は 32 violations を持つ履歴として保持し、
`SUPERSEDED.json` で現行ではないことを明示した。生成 source を直して独立評価した
immutable generation `sha256:892cd561…` を正規昇格し、feature 別 current pointer から
解決できる状態にした。現行 validator は P01〜P13、test strategy、P13 writeback、
edge parity を含め violations 0 である。

task projection は P01〜P13 の13件、依存 edge 12件で Beads と一致する。
ライフサイクルも P01〜P06 closed、P07 open、P08〜P13 blocked/open で一致し、
A1 PARTIALのままP07以降をclosedにしていた旧状態は正規reconciliationで差し戻した。
feature-level だけは graph の `feat-improvement-feedback` 依存に対し、Beads が
epic `ah-0d2q` → task `ah-w6y` を型制約で拒否する。正規 bridge に型移行経路がないため、
直接CLIや重複epicで迂回せず、phase parity と分離した adapter limitation として
`.dev-graph/handoff/task-graph/feat-feedback-capture-self-exclusion.json` に記録した。

P13 は実 commit / PR / CI / merge 後にだけ閉じる。現時点の blocked/open 状態は、公開を
行っていない事実と一致しており、ローカルの13-phase構造やvalidatorの不整合ではない。

## 2026-09-05 の更新点

1. **A1 が PARTIAL でなくなった。**実画素証跡 `12-capture-pixel-e2e.txt` を取得した。
   代理証跡 3 段は消していない——実画素の検査は headed の実行環境でしか走らないため、
   CI で毎回効く網は依然として代理証跡の側だからである。
2. **E2E を全件走らせた。**2026-09-03 時点で緑を主張していたのは
   `capture-self-exclusion.spec.ts` の 4 件だけで、`pnpm run test:e2e`（全件）は赤だった。
   赤の 3 件（ah-od20 / ah-g4ev / ah-t8jr）は本 feature の外の指摘だが、
   **「関係ないので緑とみなす」とはせず実際に直してから**数え直した。
3. **閾値・免除表・除外表・母集団の床は 1 つも動かしていない。**
   `KNOWN_STALE_MAX` も上げず、`pnpm run generate` で生成物の側を合わせた。
