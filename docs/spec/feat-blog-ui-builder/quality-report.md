# 品質保証とアクセシビリティ・非機能検査（P09）

> **歴史 snapshot:** 以下の件数と visual FAIL は 2026-08-30 の P09 記録である。
> 現行のコード受入判定は [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本)、
> 最新コマンド結果はこの作業の最終報告を正とする。外部preview/deploy未実施をコードFAILへ混ぜない。

- 実施日: 2026-08-30
- 対象: `feat-blog-ui-builder`（P01〜P08 の成果）
- 環境: `darwin-arm64-chrome151`（Chrome/151.0.7922.174）、Node 経由 vitest 4.1.10
- 前段: P08（`migration-report.md`）

**総合判定: 5 項目中 4 項目 PASS、1 項目 FAIL。FAIL 1 件は本 package 起因ではない**（§4）。

---

## 1. 検査結果の一覧

| # | 検査 | コマンド | 結果 |
| --- | --- | --- | --- |
| 1 | 型検査 | `pnpm run typecheck` | 🟢 exit 0 |
| 2 | 静的解析 | `pnpm run lint` | 🟢 exit 0（指摘 0 件） |
| 3 | 全テスト | `pnpm test` | 🟢 417 ファイル / **10023 件全合格**（314.9s） |
| 4 | 視覚回帰 | `pnpm run visual` | 🔴 **5 枚中 5 枚が差分**（§4） |
| 5 | 計画の決定論検証 | `validate-system-plan.py` | 🟢 `"violations": []` |

---

## 2. アクセシビリティ（受入 A9）

### 2.1 axe-core — 重大違反 0 件

| テストファイル | 件数 | 結果 |
| --- | --- | --- |
| `tests/ui/page-render.test.tsx` | — | 🟢 |
| `tests/ui/blog-ops-a11y-floor.test.tsx` | — | 🟢 |
| `tests/ui/axe-blind-spots.test.ts` | — | 🟢 |
| `tests/ui/axe-rule-coverage.test.ts` | — | 🟢 |
| `tests/ui/tap-target-floor.test.ts` | — | 🟢 |
| **合計** | **855 件** | **🟢 全合格（64.3s）** |

**重大違反は 0 件である。** 検査は `tests/support/a11y.ts` の共通口を通っており、
`serious` / `critical` の違反が 1 件でもあればテストが赤くなる。

`axe-blind-spots.test.ts` を併走させているのは、**axe が見ていない箇所を数えるため**である。
axe は自動検査で拾える範囲しか拾わない。「axe が緑」を「アクセシブル」と読み替えると、
自動検査の穴がそのまま製品の穴になる。この spec はその穴を明示的に列挙し、
穴が黙って増えていないことを検査している。

### 2.2 コントラスト — light / dark 両方が AA を満たす

`tests/ui/theme-contrast.test.ts`: **31 件全合格**。

| 配色 | 明るい | 暗い |
| --- | --- | --- |
| 既定（グラファイト × アンバー） | 🟢 AA | 🟢 AA |
| インディゴ × ティール | 🟢 AA | 🟢 AA |
| ティール × クレイ | 🟢 AA | 🟢 AA |
| インディゴ × クレイ | 🟢 AA | 🟢 AA |
| 青系 | 🟢 AA | 🟢 AA |
| ピンク系 | 🟢 AA | 🟢 AA |
| ホワイト系 | 🟢 AA | 🟢 AA |
| グレー系 | 🟢 AA | 🟢 AA |
| グリーン系 | 🟢 AA | 🟢 AA |
| パープル系 | 🟢 AA | 🟢 AA |

**11 配色 × 2 明暗 = 22 通りすべてが WCAG 2.2 AA を満たす。**

検査している組は 7 種類（本文と背景 / 補足の文字と背景 / 見出しと一段上げた面 /
本文と沈めた面 / 操作の色と背景 / 強い枠線と背景 / 焦点の輪と背景）。
さらに次の 3 件が併走している。

- 「手で書いた組の指し先が、実物の規則を指している」（7 件）
  — 検査表が実在しないトークンを指していれば、**何も検査していないのに緑になる**。
- 「検査対象を実際に読めている」
  — `themes.css` を読めずに 0 件検査して緑になる事故を止める。
- 「暗いときの色を明るいときの反転で済ませていない」
  — 単純反転は数値上 AA を満たしても、暗所で眩しくなる。

### 2.3 WCAG 2.2 の sticky 関連（reflow / focus-not-obscured）

`tests/acceptance/feat-blog-ui-builder/`: **6 ファイル / 54 件全合格**
（`sticky-layout.test.ts` を含む）。

ただし受入 A3（sticky 常時表示）の実測判定は P07 で 🟡 である。
単体・受入テストは緑だが、**実画面での「常時表示」の言葉の意味が定まっていない**
というのが P07 の指摘で、これは検査の失敗ではなく受入文言の問題である。
P13 で文言を見直す申し送りになっている。

---

## 3. セキュリティ（静的検査）

| 項目 | 結果 |
| --- | --- |
| IndexNow 鍵のリポジトリ漏洩 | 🟢 なし |
| admin RBAC 契約 | 🟢 既存契約の範囲内（新規の権限緩和なし） |

IndexNow は次の 4 spec が担保している。

- `tests/domain/seo/indexnow.test.ts` — 送信判断の純関数
- `tests/infrastructure/indexnow-client.test.ts` — 鍵が無いときの送信スキップ
- `tests/presentation/publish-article-indexnow.test.ts` — 公開時の連動
- `tests/architecture/open-doors.test.ts` — **外向きに開いた口の台帳**

鍵はリポジトリに置かず環境変数から読む。P07 の実測でも鍵ファイルの URL は
404 を返しており、**鍵が commit されていないことが実行結果としても確かめられている**。

---

## 4. 🔴 視覚回帰 — 5 枚すべてが差分（本 package 起因ではない）

```
陽性対照 OK: 1px ずらした絵は、大きさは同じまま 105743 画素（4.99%）の違いとして赤くなりました
見た目が変わっています（5 / 5 枚）:
  - nav-and-density          大きさが違います（見本 1280x1489 / いま 1280x1657）
  - nav-and-density-dark     大きさが違います（見本 1280x1489 / いま 1280x1657）
  - nav-and-density-narrow   大きさが違います（見本  390x2706 / いま  390x2905）
  - input-samples            大きさが違います（見本 1280x1156 / いま 1280x1274）
  - feedback-samples         104215 画素（8.13%）違います
```

**陽性対照は OK である。**つまり検査自体は生きていて、差分が出ているのは
本当に見た目が変わっているからである。「検査が壊れて全部赤い」ではない。

### 原因の切り分け

| 事実 | 確認方法 |
| --- | --- |
| 見本の最終更新は `a07a9e0`（2026-08-28） | `git log -1 -- tests/visual/baseline` |
| `src/presentation/ui` はその後 2 回変わっている（`0ed9e2b` / `e97e5bc`、いずれも 2026-08-30） | `git log -3 -- src/presentation/ui` |
| その 2 commit は**すでに main へ入っている** | 同上 |
| 撮っている部品は `DensitySamples` / `InputSamples` / `FeedbackSamples` の 3 つ | `scripts/visual-regression.tsx` の `SHOTS` |
| この 3 部品は**本 package の作業ツリー変更に含まれていない** | `git status --short` |

作業ツリーが触っている presentation は
`templates/{article-view.tsx, site-shell.tsx, site.module.css}` と
`admin-route-metadata.ts` で、いずれも上の 3 部品ではない。

**結論: 見本が `0ed9e2b`（見本データの網羅化）と `e97e5bc`（規則の実装を 1 本へ寄せる）で
撮り直されないまま main に入り、その負債がここで初めて赤くなった。**
高さが一律に増えている（+168px / +199px / +118px）のは、
行の高さか間隔のトークンが 1 段変わったときの出方と一致する。

### 直さなかった理由

P09 の write scope は `docs/spec/feat-blog-ui-builder/quality-report.md` のみで、
scope_out に「検査で FAIL となった場合の実装修正」が明記されている。
見本の撮り直し（`pnpm run visual -- --accept --why "…"`）は実装修正ではないが、
`tests/visual/baseline/` も write scope の外である。

そして**撮り直しの判断はこの phase では下せない**。
`--accept` は「この変化は正しい」と宣言する操作であり、
`accept-limit-history.jsonl` に理由が残る取り消しにくい記録である。
本 package が変えていない部品の見た目を、本 package の担当が
「正しい変化だ」と署名するのは筋が通らない。
`0ed9e2b` / `e97e5bc` の変更意図を知っている側が判断すべきである。

### 申し送り

- 撮り直すなら: `pnpm run visual -- --accept --why "0ed9e2b で行の高さのトークンが変わったため"`
- 差分の絵は `tests/visual/__diff__/feedback-samples.diff.png` にある
- これは **P13 の申し送りに載せる**（本 package の外に原因があるため、
  `requirements-baseline.md` の受入項目には紐づかない）

---

## 5. 受入 A9 の判定

| 完了条件 | 判定 | 根拠 |
| --- | --- | --- |
| axe-core の重大違反が 0 件である | 🟢 | §2.1（855 件全合格） |
| light/dark 両方のコントラストが基準を満たす | 🟢 | §2.2（11 配色 × 2 = 22 通り AA） |
| `src/application/seo` 配下の型検査・lint が合格する | 🟢 | §1 の #1・#2（全体検査に含まれる） |
| `quality-report.md` が存在する | 🟢 | 本ファイル |

---

## 6. 判定項目

- [x] `pnpm run typecheck` が合格する（`src/application/seo` を含む）
- [x] `pnpm run lint` が合格する
- [x] axe-core 重大違反 0 件が記録されている（§2.1）
- [x] light/dark コントラスト基準充足が記録されている（§2.2）
- [x] `quality-report.md` が存在する（本ファイル）

`pnpm run visual` は Automated commands の 1 つだが、
**判定項目には含まれていない**。上の 5 項目はすべて満たしている。
視覚回帰の FAIL は §4 の通り本 package の外に原因があり、事実として記録した。
記録せずに緑だけ並べると、次に見る人は「見本が古い」ことに気付けない。

---

## 7. 未実施

| 検査 | 状態 | 理由 |
| --- | --- | --- |
| `pnpm run test:e2e` | 未実施 | P07 で 439 passed / 39 failed。39 件はすべて `acceptance-report.md` §4 の既存分。本 phase は検査の記録が責務で、実装修正は scope 外 |
| 応答性能の実測 | 未実施 | 本 package に性能の受入条件（数値の閾値）が無い。閾値の無い計測は合否を判定できないため、数字だけ並べることはしなかった。閾値が要るなら P13 で受入に足す |
