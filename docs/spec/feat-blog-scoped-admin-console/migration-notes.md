# 移行の記録 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P09 の成果物。

## この feature に DB 移行は無い

新しい表を作らず、既存の表の列も変えていない。

`drizzle/` に追加した SQL は無い。

**理由**: この feature は画面の並べ替えと台帳の整備であり、
保存するものが増えていない。

住所・観測・改善の表は
それぞれの feature が既に作っている:

| 表 | 作った feature |
|---|---|
| `site_custom_domain` | `feat-blog-custom-domain` |
| `reader_interaction_event` | `feat-reader-behavior-analytics` |
| `site_daily_metric` / `article_daily_metric` | `feat-blog-metrics-rollup` |
| `article_seo_assessment` | `feat-seo-assessment-reflection` |
| `site_aeo_profile` / `article_answer_unit` | `feat-aeo-answer-optimization` |

## 移行するのは URL

記事を単位にした画面から、
ブログを単位にした画面へ移った。

### 旧 URL は残っていない

`/admin/analytics` 配下にブログ別の画面を
作った時期は無い。

4 層の画面は最初から
`/admin/sites/[site]/` の下に作られた。

**したがってリダイレクトは不要。**

`admin-route-metadata.ts` の `redirectOnly` を
この feature では使っていない。

## ブックマークへの影響

無い。

新しく足した 5 画面（`domains` / `audience` /
`revenue` / `seo` / `aeo`）は、
以前どこにも無かった。

## 権限の移行

無い。

`sites` の `requires` は `content.read` のままで、
子の画面は `requires` を持たない
（判定はユースケース側）。

**既存の役割に新しい権限を配る作業が発生しない。**

読者の行動（`Editorial`）と
記事ごとの成果（`Commercial`）の印は
それぞれの feature が既に配線している。

## 申告表の更新

ゲートを走らせた結果、次が自動更新された:

```
docs/product/open-doors.md
docs/product/port-wiring.md
docs/product/required-test-types-report.md
docs/product/required-test-types.md
docs/product/test-traceability.md
docs/product/traceability.md
```

**生成物なので手で書かない。**

`node scripts/traceability.mjs` などを走らせれば
同じ内容が再生成される。

上限（`.mjs` の中の定数）は 1 つも動かしていない。

## 巻き戻すとき

この feature を戻すには、
`admin-route-metadata.ts` から 5 行を消し、
`admin-screen-task-manifest.ts` から
対応する 5 entry を消し、
`sites/[site]/page.tsx` の `actions` から
5 本の `TextLink` を消す。

**画面ファイル自体は残る。**

消さないと `uiux-screen-single-purpose.test.ts` の
1 対 1 が落ちる（実在するが台帳に無い）。

つまり**巻き戻しは 5 画面の削除とセット**。

途中まで戻すと赤になる。
これは意図した形で、
中途半端な状態を検出できる。

## 動かす前の確認

```bash
node scripts/traceability.mjs
node scripts/required-test-types.mjs
npx vitest run --project normal tests/ui/uiux-screen-single-purpose.test.ts
npx vitest run --project a11y tests/ui/blog-ops-a11y-floor.test.tsx
```

`port-wiring.mjs` は赤のままである
（`quality-report.md` 参照）。
