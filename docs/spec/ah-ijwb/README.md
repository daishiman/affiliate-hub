# 主要ブログ導線のブラウザ E2E と Core Web Vitals（ah-ijwb）

- 実施日: 2026-08-30
- ブランチ: `daishiman/task-20`
- 対象: 公開ブログの主要導線（トップ / ブログトップ / 記事 / 診断 / 管理画面）

> **総合: 計測は完了。ただし「導線が通っている」とは言えない。**
> E2E は 437 passed / 41 failed。失敗は**既知の根本原因 2 件に集約される**。
> Core Web Vitals は全指標が Google 推奨値内だが、
> **これは速さの成果ではなく「本文が載っていない」ことの現れである。**

---

## 1. 成果物

| ファイル | 内容 |
| --- | --- |
| [`e2e-run.txt`](./e2e-run.txt) | Playwright の生結果（437 passed / 41 failed、desktop + mobile） |
| [`core-web-vitals.txt`](./core-web-vitals.txt) | TTFB / FCP / LCP / CLS / DOM 数 / 転送量の実測（10 経路） |

---

## 2. E2E — 41 failed は根本原因 2 件に集約される

```
437 passed / 41 failed （2.4m、desktop + mobile の 2 プロファイル）
```

### 2.1 原因 A — 記事本文が 1 文字も出ていない（🔴）

失敗の実エラー:

```
browser content /s/e2e-public-lifecycle-mobile/blog/same-article-after-restore:
  要点 with timeout 1000ms / element(s) not found
```

`tests/e2e/public-site-lifecycle-fixture.ts` は
`articleBlockHeading: "要点"`（`key_points` ブロックの見出し）が
公開記事に出ることを期待している。**出ていない。**

P11 で HTTP 実測から検出した「公開記事の本文が 1 文字も出ていない
（H1 記事名と H2『この記事の評価』のみ）」を、**ブラウザ側から独立に裏付けた。**

該当: `public-site-lifecycle.spec.ts:116` × 2 プロファイル
および `app-routes.spec.ts:231`（ルート本体到達）desktop 7 + mobile 12 = 19 件。

### 2.2 原因 B — 固定ページの 404（🔴、A4 と同根）

固定ページ 18 経路のうち 12 経路が 404。
語彙が 2 系統（`SiteDocumentKey` 9 種 / `FixedPageKind` 8 種）に割れており、
写像表 `KEY_TO_KIND` が 9 鍵中 4 鍵しか持たないことが原因である。

該当: `app-routes.spec.ts:224`（route registry 87 画面）× 2、
`pending-hit-targets.spec.ts:70/90` の計 18 件。

mobile のみ admin 系 4 件（`admin/evidence` / `admin/content/published` /
`admin/sites/[site]` / `admin/affiliate`）が追加で落ちる。

### 2.3 前回（P07）比

| 時点 | failed |
| --- | --- |
| P07 | 39 |
| 本計測 | 41 |

**2 件増えている。** 増分は mobile の admin 系であり、
本 feature の変更が新たに壊したというより、
mobile プロファイルでの到達性が元から不安定である可能性が高い。
**ただし断定できるだけの再現確認をしていない。**

---

## 3. Core Web Vitals — 全指標が推奨値内、ただし読み方に注意

全文は [`core-web-vitals.txt`](./core-web-vitals.txt)。

```
## desktop
| トップ `/`                        | 200 | TTFB 26ms | FCP 76ms  | LCP 76ms  | CLS 0 | DOM 81  | 4KB  |
| ブログトップ `/s/home-office-desk` | 200 |      66ms |     120ms |     120ms |     0 |     340 | 12KB |
| 記事 `.../blog/starter-kit-2026`  | 200 |      39ms |      64ms |      64ms |     0 |     215 | 10KB |
| 机と椅子診断 `.../desk-chair-fit`  | 404 |      24ms |      76ms |      76ms |     0 |      58 | 3KB  |
| 管理画面 `/admin`                  | 200 |      12ms |      36ms |      36ms |     0 |      62 | 4KB  |
```

mobile も同じ DOM 数・転送量で、TTFB 10〜48ms / FCP 32〜72ms。

> **幅が E2E と揃っていない。** CWV の mobile は Playwright の
> `devices["iPhone 13"]`（390px）で測っており、E2E の mobile プロファイル
> （`playwright.config.ts` の 375×812）とは 15px 違う。
> DOM 数・転送量が両者で一致しているため今回の結論は変わらないが、
> **本文が入った後に再計測するときは 375px へ揃えること。**
> 本文が入れば折り返し位置が変わり、幅の差が LCP に効きうる。

### 3.1 🔴 10 経路すべてで LCP == FCP

最大の要素が最初の描画と同時に出ている。つまり
**後から入ってくる大きな要素（画像・遅延読み込みされる本文）が 1 つも無い。**

数字としては最良だが、**これは速さの成果ではなく
「載っているものが少ない」ことの現れである。**

### 3.2 記事の DOM 215 がブログトップの 340 より小さい

記事ページのほうが一覧ページより軽い。
**§2.1 の「本文が空」の、E2E とは独立した 3 本目の裏付けである。**

### 3.3 合否は出していない

**本リポジトリに性能の受入条件が無い。**
P09 で「閾値の無い計測は合否を判定できない」として未実施にした経緯があり、
その判断は今も有効である。ここでは数字だけを採った。
`✓` は Google 推奨値との比較であって、本リポジトリの合否ではない。

### 3.4 ⚠️ この数字は本文が入る前のものである

**再計測が必要な時点 — 記事本文が出るようになった後。**
いまの数字を「速い」として残すと、本文を入れた後の悪化を
「もともと速かったのに遅くなった」と読み違える。
CLS も同様で、いまの 0 は「ずれる要素そのものが無い」からである。

---

## 4. 計測の方法（再現手順）

### 4.1 E2E

```bash
PLAYWRIGHT_PORT=8789 pnpm test:e2e
```

`playwright.config.ts` の既定ポートは `PLAYWRIGHT_PORT ?? "8788"`。
**既定のままにしない。** 同じマシンの他 worktree が 8787 / 8788 / 3000 を
占有しており、既定で起動すると他セッションの作業を壊す。

### 4.2 Core Web Vitals

計測スクリプトは scratchpad に置いた（リポジトリには入れていない）。
中核は次の一点である。

```js
// LCP と CLS は performance.getEntriesByType() では拾えない。
// PerformanceObserver を「ページのスクリプトより先に」仕込む必要がある。
await ctx.addInitScript(`
  window.__cwv = { lcp: null, cls: 0 };
  new PerformanceObserver((l) => {
    const es = l.getEntries();
    window.__cwv.lcp = es[es.length - 1].startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cwv.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
`);
```

**`goto` の後に `observe()` しても遅い。** それ以前の描画を取り逃す。
`context` に入れるのは、以降の全 `goto` で自動的に再仕込みされるためである。

第 1 版は `getEntriesByType("largest-contentful-paint")` で書いており、
**LCP が全経路で欠測した。** この API は LCP を返さない。

---

## 5. 判定

| 項目 | 状態 |
| --- | --- |
| 主要導線のブラウザ E2E を実施した | 🟢 |
| Core Web Vitals を実測した | 🟢 |
| **主要導線が期待どおり動いている** | **🔴** |
| 性能の合否 | ⬜ 判定不能（受入条件が未定義） |

**計測は完了したが、「導線が通っている」とは言えない。**
記事本文が空である限り、E2E も CWV も
「本文が入る前の状態」を測っているにすぎない。

先に直すべきは §2.1（記事本文）と §2.2（固定ページ 404）であり、
これらは `docs/spec/feat-blog-ui-builder/release-report.md` §4 の
「出す前に直すもの」に既に登録されている。
