# リリース報告（feat-uiux-overhaul / P13）

作成日: 2026-08-22
対象: 枝 `daishiman/ui-ux調整`（HEAD = `43a12ce` からの未コミット差分 203 件）

<!-- acceptance-reconciliation {"implementation_status":"pass","release_status":"unpublished","tracking_status":"active","evaluated_digest":"sha256:faac0174f559e9ff599e41350bbe534d3dd9c40edc04705c65fd1f53719ff8e3","acceptance_ids":["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10"]} -->

> この文書名の「リリース報告」は P13 の履歴名であり、公開済みを意味しない。
> 現在の状態は **実装受入は合格 / 未公開 / tracking は active**。
> 以下の件数・HEAD・差分数は 2026-08-22 当時の記録で、現在値ではない。
> 現在の評価対象は [`acceptance-reconciliation.json`](./acceptance-reconciliation.json)、
> 最新の突合結果は [`evidence/09-acceptance-reconciliation.txt`](./evidence/09-acceptance-reconciliation.txt) を参照する。

---

## 1. 反映前の確認（実測）

### 型検査

```
npx tsc --noEmit  → exit=0（エラー 0 件）
```

### 本番ビルド

```
npx next build  → 成功
```

ビルドが数えた route:

| 区分 | 件数 |
|---|---:|
| 全 route | 82 |
| `/admin` 配下 | **49** |
| `/api` 配下 | 7 |

`/admin` 49 は、受入条件 A1（画面を単一用途へ分割）の実測値と一致する。
**検査だけでなくビルドが同じ数を数えている。**

### 受入条件の検査

```
npx vitest run tests/ui/uiux-*.test.ts tests/ui/uiux-*.test.tsx
→ Test Files 9 passed (9) / Tests 275 passed (275)
```

P10 の判定時は 8 ファイル 273 件だった。差の 1 ファイル 2 件は
`uiux-form-declaration.test.ts`（P08 の移行検査）で、P10 の再実行が
ファイルを明示列挙していて拾えていなかった分。**新たに足した検査ではない。**

### 当時の既知の失敗（履歴）

当時は 52 件（`ah-a0o` 51 / `ah-v6n` 1）。本 feature の当時の作業では **1 件も増減していなかった**。
内訳は [`evidence/06-known-failures.txt`](./evidence/06-known-failures.txt)。

---

## 2. 開発環境への反映（2026-08-23 最終レビューで着手）

2026-08-22 時点では conservative profile のため未コミットだった。
2026-08-23 の最終レビューで、本 feature の対象ファイルだけを
`devgraph/feat-uiux-overhaul` へ commit し、宛先 `dev` の draft PR を出す。

無関係な既存差分（`.claude/`、章再生成の退行、harness follow-up の task 仕様、
`system-spec/spec-state.json` 全体、completeness FAIL レポート）は含めない。

手順は `AGENTS.md` の枝の順番に従う。`main` への PR は比較元が `dev` か
`hotfix/*` でないと `branch-flow.yml` が落とす。

仕様反映の受領は [`spec-writeback-receipt.md`](./spec-writeback-receipt.md)。

---

## 3. system-spec への書き戻し（行っていない）

本 phase の write scope には `system-spec/ui-ux.md` と `system-spec/frontend.md` が
含まれている。**手で書き戻さなかった。** 理由を残す。

### 理由 1: この 2 ファイルは単一 writer の管轄である

`system-spec/` への正本書込経路は
`plugins/system-spec-harness/skills/run-system-spec-compile/scripts/compile-spec-doc.py`
に一本化されている。仕様の内容は `spec-state.json`（別の単一 writer が所有）から
コンパイルされて生成される。**章の Markdown は生成物であって、原稿ではない。**

手で章を編集すると、次にコンパイルが走った時点で消える。
消えないとすれば、それはコンパイラを通していないということで、
生成物と正本が食い違ったまま残る。

### 理由 2: 対象の章はいま退行している

`chapter-regeneration-floor` が要求する章の形は 13 節（11 節 + gap 1 の 2 節）だが、
現在の `ui-ux.md` / `frontend.md` は **5 節しか持っていない**。

| 章 | 現在の節数 | 行数 |
|---|---:|---:|
| `system-spec/ui-ux.md` | 5 | 245 |
| `system-spec/frontend.md` | 5 | 194 |

失われているのは「状態の意味 / As-Is / To-Be / Delta / Dependencies /
Acceptance evidence」と gap 1 の 2 節。これが `ah-a0o` の 51 件の実体で、
8 章すべてに同じ欠落がある。

### 理由 3: 手で節を書き足すのは、検査を無効化することである

節を手で書き足せば `chapter-regeneration-floor` は緑になる。**やらない。**

この検査が防いでいるのは「**再生成したら痩せる**」ことである。
手書きで太らせると、次の再生成でまた痩せる。検査だけが緑になり、
退行はそのまま残る。緑は「再生成しても痩せない」ことの証拠でなくなる。

これは P11 で `state/current/` のポインタを手で書かなかったのと同じ形である
（[`evidence/08-plan-validation.txt`](./evidence/08-plan-validation.txt)）。
**検査の前提を手で作ると、検証しているのは自分が今書いた値になる。**

### 正しい向き

`ah-a0o` の解決が先にある。取りうる道は 2 つで、**どちらを採るかは人が決める**。

| 道 | 内容 |
|---|---|
| **A** | `system-spec/*.md` を HEAD の内容へ戻す（退行前の章を復元する） |
| **B** | `compile-spec-doc.py` を直して再コンパイルする |

**C（床を下げて緑にする）は採らない。** 床は検出器であり、下げると検出をやめるだけ。

`ah-a0o` が解けた後に、次節の内容を `spec-state.json` 経由で入れて再コンパイルする。

---

## 4. 書き戻すべき内容（`ah-a0o` 解決後に入れるもの）

手で書けないので、**入れるべき事実をここに確定した形で置く**。
これが失われると、次の feature が古い仕様を根拠に作業する。

正本は [`ui-rules.md`](./ui-rules.md) と [`operations.md`](./operations.md)。

### `system-spec/ui-ux.md` へ入れるもの

| 項目 | 確定した内容 |
|---|---|
| 間隔 | カード内 padding `--space-5` / 画面の縦 gap `--space-4` / 見出しと説明文 `--space-2`。カード内がカード間より広い（近接） |
| 生値の禁止 | `padding` / `gap` に `px` / `rem` を書かない |
| 文章量 | 画面説明文 40 字以内・常時表示 `Callout` 2 個以内。例外は `/admin/ui-catalog` の `callout_max` のみ |
| 常時表示の判定 | 初期表示に出ているかで判定する。DOM から消えているかは問わない |
| サイドバー | 19 項目 / 6 分類（素材・書く・出す・稼ぐ・見る・整える）+ 分類外 1（ホーム） |
| アイコン | 項目ごとに必須・重複禁止・意味を持たせない（読み上げから隠す） |
| 折りたたみ | 畳んでも 19 項目の名前・経路・Tab 順路がすべて残る |
| 分類の境目 | 線と余白の両方で作る。線は隣り合わせ規則のみ（6 分類なら 5 本） |
| 情報の優先度 | keep / drop / transform。順位は task 頻度 × 失敗コスト。金銭・秘密・公開の注意は `never_drop` |
| 画面の単位 | 状態を変えるフォームは 1 画面 1 つ。49 画面すべてで成立 |

### `system-spec/frontend.md` へ入れるもの

| 項目 | 確定した内容 |
|---|---|
| 部品の段 | primitives / patterns / templates の 3 段。事業の決めごとを持つものは patterns 以上 |
| 配信先の扱い | `CHANNEL_CAPABILITIES` が唯一の正本。`ChannelKind = keyof typeof CHANNEL_CAPABILITIES` |
| 画面の分岐禁止 | 画面・部品は `ChannelKind` で分岐しない。表示に要る値は能力表から受け取る |
| 配信先の追加 | 能力表に 1 エントリ + `channel-registry.ts` に 1 行。**画面側は 0 行**（実測） |
| ブログの追加 | 既定はデータ（`SiteBlueprint` 1 件）のみ。固有ファイルは 2 条件を満たす例外のときだけ |
| ブログ名の分岐禁止 | 共通部品に `if (slug === …)` を書かない。固有部品の有無は `sites/<slug>/index.ts` の存在で決める |
| 案内の登録 | 画面を足したら `admin-route-metadata.ts` に 1 件追加する。`ADMIN_NAV` / `ADMIN_NAV_GROUPS` / route 一覧はそこから導出し、別々に書き足さない |

---

## 5. 仕様側の記述の訂正（[`final-review.md`](./final-review.md) §5 の引き継ぎ）

| 対象 | 現状の記述 | 正しい記述 |
|---|---|---|
| API の置き場所 | `src/app/api/admin` | **`src/app/api`**（`admin` 階層は実在しない。ビルドが数えた `/api` 7 件もこの階層） |
| A4 の文言 | 「プロバイダ追加のみで拡張できる」 | 「**画面の変更は不要／接続実装は必要**」 |
| A4 の測り方 | 「git diff のパス集合で機械判定する」 | 「画面側無改修で型検査が通るか／UI テストが緑か」の 2 問で判定する |

3 件目は本 phase で追加した訂正。`sns-provider-contract.md` が
git diff による判定を書いているが、作業ツリーがベースから 76 ファイル分の差分を持つため
1 エントリの効果が埋もれ、**実際には測れなかった**。経緯は
[`evidence/07-a4-channel-extension.txt`](./evidence/07-a4-channel-extension.txt) の冒頭。

いずれも**仕様書の側を実装へ合わせる**のが正しい向き。実装を仕様書へ合わせて
`admin` 階層を作ると、既存の経路が二重になる。

この 3 件も `system-spec` の管轄なので、§3 と同じ理由で手では直していない。
`sns-provider-contract.md`（`docs/spec/` 配下・本 phase の write scope 外）の
訂正も同様に残っている。

---

## 6. 当時の残課題（履歴）

2026-08-22 時点。当初の 8 件のうち **6 件を閉じ**、作業中に見つけた `ah-lzk` も閉じた（計 7 件）。
残る 2 件は**どちらも同じ理由で残っている**——
機械が「独立した監査が実際に走った」ことを要求しており、それを人の許可なしには作れない。

### 閉じたもの（2026-08-22）

| bd | 内容 | 決着 |
|---|---|---|
| `ah-v6n` | 確定セルの `qa_refs[]` へ既存 qa entry を後から結び直す op が無い | 結び直しの op を足した |
| `ah-brd` | 重複実装の検査が `src/app` しか見ていない（実体は `src/presentation`） | 実体側を見るようにした |
| `ah-jbj` | `.sectionLead` が `admin.module.css` に残る | 共通部品側（`SubSection` / `Prose`）へ寄せた |
| `ah-1kz` | `information-priority-map.json` の `current_totals` が baseline の写し | 実測を入れ、写しが古びたら赤くなる検査を置いた |
| `ah-9pk` | axe が見ていない領域を一度洗う（個別に塞ぐやり方が 3 回続いた） | 凡例の根拠を「当たり 45」から「破ると赤くなる 33」へ移した |
| `ah-h57` | 見た目の崩れを自動で見つける手段が無いことを検査として固定する | `visual` を誰も指していなかった穴を塞ぎ、3 要件から指した |
| `ah-lzk` | 確定セルが「block 必須情報 0 件」を名乗るのに、数えた記録を持たない | 数える op は既に在ったので 4 セルへ通した（`ah-v6n` の作業中に見つけた別件） |

この 7 件に共通する形が 1 つある。**`ah-h57` `ah-jbj` `ah-lzk` はどれも「作る」ではなく
「通す」だけで済んだ** —— `visual` という種別、`Prose` という部品、
`record-required-info-check` という op は、いずれも**既に在って誰も指していなかった**。
足りなかったのは仕掛けではなく指し手である。この壊れ方は、
一覧を眺めた人には**全部使われているように見える**ので、数えないと見つからない。

### 残るもの — どちらも「監査を実際に走らせる」ことが前提

| bd | 内容 | 何が要るか |
|---|---|---|
| `ah-a0o` | `system-spec/*.md` 8 章の退行（50 件）。書き戻しの前提 | **人**（A か B の選択）。加えて `guard-confirmed-chapter-overwrite.py` が `system-spec/` への操作を遮断するため、通常操作では解けない |
| `ah-k9b` | 計画パッケージの feature 別 current ポインタが無く決定論検証が入口で止まる | **人**（監査 subagent を fork する許可）。詳細は下記 |

`ah-k9b` は 2026-08-22 に追試して真因が変わった。
「昇格されていない」のではなく **「旧い版の手続きで昇格した」** ——
`state/current.json`（旧・最後の 1 件だけ）には在り、`state/current/<slug>.json`（新・feature 別）に無い。
手でポインタを書かず再 promotion を通そうとしたところ、その手前の readiness gate が
`eval-log/system-spec-harness/audit-fork-ledger.jsonl` の不在を理由に止めた。
この台帳は監査を実際に fork した瞬間に hook が書くもので、
**行を手で足すと「独立した監査が走った」という主張を、走らせずに作ることになる。**
staging は復元済み（digest は promotion intent と一致）なので、fork の許可だけが残っている。
実測の全文は [`evidence/08-plan-validation.txt`](./evidence/08-plan-validation.txt)。

未計測のまま残るもの: 応答性能、実ブラウザでの動作確認。
**「問題なし」ではなく「測っていない」。**

---

## 7. この phase で動かしていないもの

カバレッジの下限、`required-test-types.mjs` の上限、章の床、
`KNOWN_STALE_MAX`、`UNREFERENCED_BUNDLE_MAX`、`baseline_totals`。

**1 つも下げていない。** 緑にするために床を動かした箇所はない。
