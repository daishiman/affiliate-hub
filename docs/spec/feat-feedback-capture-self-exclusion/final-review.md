# 最終レビュー — 設計意図と現物の突合

**phase**: P10 / SYS-FB-CAPTURE-EXCLUSION-P10

## P03 の指摘の反映状況

| 失敗様式 | 設計上の遮断 | 現物 | 反映 |
|---|---|---|---|
| F1 隠し忘れ | 二層 + 名乗り検査 | `openWhenShotSettles` / `:global()` 規則 / `floating-overlay-declaration.test.ts` | 済 |
| F2 戻し忘れ | 復元手続きを返り値に、`finally` で囲む | `hideFloatingOverlays` + `try/finally` | 済 |
| F3 待ちが解けない | 三方から 1 回だけ開く | `openWhenShotSettles` の解決/棄却/上限 | 済 |
| F4 退避前の古い映像フレーム | DOM paint 後に次 video frame を待つ | `afterNextVideoFrame`（Abort + 非対応 fallback） | 済（代理証跡） |

P03 が残課題として挙げた 2 件は、いずれも**限界として明記する**方針どおり、
`design-review-findings.md` と `release-notes.md` の「既知の限界」に残っている。
潰したふりをしていない。

## 設計意図と現物のずれ

1 件あった。`floating-overlay-declaration.test.ts` で「走査が空振りしていないこと」を
**別の `it` に切り出していた**。読みやすさとしては正しいが、
`form2-population-floor.test.ts` が禁じている形そのもの——0 件を主張する `it` と
母集団が空でないと言う `it` が別々に緑になれる——だった。
**直したのは上限ではなく自分の側**で、床を同じ `it` の中へ移した。

## 設計意図と現物のずれ（2 件目）

P09 の時点で、**退避の CSS 側は 1 行も検証されていなかった**。
jsdom は CSS を当てないので、単体テストが見ていたのは
`html[data-capturing="true"]` を立てる側だけである。規則の綴りが 1 文字違っても、
セレクタが CSS Modules に握り潰されても、**全部緑のまま写り込みだけが戻る**形だった。
`tests/e2e/capture-self-exclusion.spec.ts` を足して塞いだ。

## 検査が空でないことの確認

いずれも変異で確かめた。**「緑だから守られている」ではなく「赤にできるから守られている」。**

| 検査 | 変異 | 結果 |
|---|---|---|
| 名乗り (`floating-overlay-declaration`) | 送信モーダルから `data-floating-overlay` を外す | `.feedbackDialog` を名指しして赤。戻すと緑 |
| 退避の CSS 側 (`capture-self-exclusion.spec`) | `data-capturing="true"` → `"ture"`（1 文字） | 4 件すべて赤（2026-08-30 実測）。戻すと 4 件緑 |

## 残課題と収束状態

| 残課題 | 帰属 |
|---|---|
| `position: fixed` 以外の浮かせ方は検査に現れない | 本 feature の既知の限界（記録済み） |
| capture 出力の実画素を観測していない | A1 は PARTIAL。ローカル実capture probeもOS境界で `NotReadableError`。P07をopen、P08〜P13をblockedへ正規差戻し |
| 待ちの上限 45 秒の根拠 | 本 feature の既知の限界（運用で決める） |
| `acceptance-reconciliation` | 正規 write 経路で receipt を更新し、10 IDs / 196 evidence files、architecture test 5/5 PASS へ収束 |
| `validate-system-plan.py` | 現行 immutable generation `sha256:892cd561…` を正規昇格し、13 phase / violations 0 で PASS |
| feature-level Beads dependency | graph 上の依存は保持。Beads は epic `ah-0d2q` → task `ah-w6y` を型制約で拒否し、正規 bridge に type migration が無いため、13 phase parity と分離した adapter limitation として handoff に記録 |
| phase lifecycle | P01〜P06はclosed/done、P07はactive/open、P08〜P13はactive/blocked。graphとBeadsを同じ状態へ収束 |
| P13 の公開 | 実際の commit / PR / CI / merge 後にだけ閉じる外部ライフサイクル。現在はblocked/openで、ローカル検証の完了とは混同しない |
| `tests/e2e/source-registries.ts` の構文木読み | production runtime 変更とは別責務の既存 E2E 前提修正。直さないと e2e が 1 件も走らないため処置した（`quality-report.md`） |

ローカルで実行可能な正規 gate はすべて緑である。A1 の画素直接観測、P13 の公開、Beads の
feature-level型制約は、それぞれ観測限界・外部ライフサイクル・adapter能力境界として
区別して記録する。未達タスクを閉じず、13 phase の構造整合やローカル品質 gate の成功へ
偽装して混ぜない。

## 2026-09-05 の再判定（P08〜P11 の完了に伴う突合）

上の表は 2026-09-03 時点の判定である。**書き換えず残してある。**
当時 A1 は PARTIAL で、P07 を open・P08〜P13 を blocked へ正規差戻ししていた。
その差戻しは正しく、下の 2 件が解けたので改めて判定し直す。

| 前回の残課題 | 2026-09-05 の状態 |
|---|---|
| capture 出力の実画素を観測していない（A1 PARTIAL） | **解消。**`tests/e2e/capture-pixel-exclusion.spec.ts` が実 `getDisplayMedia` の写しを原寸で数え、`floatingHits=0 / anchorHits=175561 / size=4480x3150`。証跡は `evidence/12-capture-pixel-e2e.txt` |
| P08 の属性統一 | **完了。**残っていたのは監査側の `querySelector` 単数前提で、名乗る側は既に 2 箇所あった。複数の帯へ対応させた（`evidence/13-floating-overlay-unification.txt`） |
| P09 品質・非機能 | **完了。**`pnpm run test:e2e` を全件で 508 passed / 2 skipped / 0 failed、`npx vitest run` 493 files / 10981 passed |
| P10 最終レビュー | 本節 |
| P11 証跡 | **完了。**`evidence/index.md` に実画素証跡と全件 E2E を追記 |
| `position: fixed` 以外の浮かせ方 | 既知の限界のまま（記録済み。変えていない） |
| 待ちの上限 45 秒の根拠 | 既知の限界のまま（運用で決める） |
| feature-level Beads dependency | adapter limitation のまま（`ah-u7jp` として別 issue 化済み） |
| P13 の公開 | **未実施。**commit / PR / CI / merge は 1 つも行っていない |

### 設計意図と現物のずれ（3 件目）

P08 で 1 件見つかった。**名乗る側は複数を前提にしていたのに、読む側の 1 つだけが
単数前提だった。**

```
tests/e2e/app-routes.spec.ts:192（変更前）
  const overlay = document.querySelector("[data-floating-overlay]");
```

`querySelector` は DOM 順の先頭しか返さない。名乗る側は
`feedback-button.tsx:299`（起動ボタン）と `:590`（送信 UI）の 2 箇所ある。
**この食い違いは落ちない。**2 つ目が増えた日、検査は赤くならず*測る対象が減る*だけで、
緑のまま黙る。P05〜P07 で「手掛かりを 1 本に寄せた」つもりでいたが、
寄せたのは**書く側だけ**だった、というずれである。

帯を合成して 1 つの外接矩形にする案は採らなかった。右下と左上に浮遊要素があると、
その外接矩形が画面のほぼ全体になり、間にある操作が全部「覆われている」ことになる。
帯ごとに個別に判定している。

### 全件 E2E を通したこと自体が、この feature の外の 3 件を暴いた

P09 に書いたとおり、2026-09-03 時点で緑を主張していたのは本 feature 対象の 4 件だけで、
`pnpm run test:e2e` は赤だった。**その赤を「本 feature とは無関係」で済ませていたら、
P09 の「既存画面への副作用が基準を満たす」は誰も確かめていないまま閉じていた。**
3 件（ah-od20 / ah-g4ev / ah-t8jr）を実際に直した結果、うち 1 件は
`safeImageUrl` が URL の形を見ていないという**読者面にも及ぶ製品の欠陥**だった。

### 収束していないもの

**P13 だけである。**commit / PR / CI / merge を 1 つも行っていない
（利用者の指示「まだ何もしない」に従っている）。
これはローカル gate の不整合ではなく、外部ライフサイクルが未着手であるという事実で、
ローカルの緑と混ぜて「完了」と言わない。
