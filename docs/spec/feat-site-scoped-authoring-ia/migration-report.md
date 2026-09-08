# 旧実装の撤去と重複 0 件の確認 (P08 / SYS-SITE-SCOPED-AUTHORING-IA-P08)

- feature: `feat-site-scoped-authoring-ia`
- 実施日: 2026-09-08
- 消費した成果物: `docs/spec/feat-site-scoped-authoring-ia/acceptance-report.md`

## 1. 何を確かめるための報告か

移設は「新しい場所に置く」だけでは終わらない。**古い場所に中身が残ったまま**だと、
同じ画面が 2 か所にあり、片方だけ直された日に、どちらが本物か誰にも決められなくなる。
本 feature が無くそうとしている形そのものである。

だから P08 が見るのは 1 点だけ ——
**移設した画面の実装が、この repository に 1 つしか無いこと**。

## 2. 機械が言えること: git が「複製」ではなく「移動」と読んでいる

```
$ git status --porcelain -- src/app/admin/
RM src/app/admin/personas/audiences/new/page.tsx -> src/app/admin/sites/[site]/audience/personas/new/page.tsx
RM src/app/admin/personas/audiences/page.tsx     -> src/app/admin/sites/[site]/audience/personas/page.tsx
RM src/app/admin/personas/new/page.tsx           -> src/app/admin/sites/[site]/authors/new/page.tsx
RM src/app/admin/personas/page.tsx               -> src/app/admin/sites/[site]/authors/page.tsx
RM src/app/admin/writing/page.tsx                -> src/app/admin/sites/[site]/writing/page.tsx
?? src/app/admin/personas/
?? src/app/admin/writing/
```

`R` は rename、つまり git の類似度検出が**旧 path の実装が新 path へ動いた**と判定したことを表す。
旧 path に改めて現れた `??`（追跡外の新規ファイル）が転送の殻である。
コピーであれば旧 path 側が `M`（中身の残った変更）として残り、`R` にはならない。
**「移した」と口で言うのではなく、履歴の側が移動と読んでいる。**

## 3. 旧ディレクトリに残っている物の全量

| path | 行数 | 正体 |
|---|---:|---|
| `src/app/admin/personas/page.tsx` | 22 | 転送の殻 |
| `src/app/admin/personas/new/page.tsx` | 22 | 転送の殻 |
| `src/app/admin/personas/audiences/page.tsx` | 22 | 転送の殻 |
| `src/app/admin/personas/audiences/new/page.tsx` | 22 | 転送の殻 |
| `src/app/admin/writing/page.tsx` | 22 | 転送の殻 |
| `src/app/admin/writing/template/page.tsx` | 113 | **殻ではない**。全ブログ共通の書き方の雛形を読む新設画面（A7 の複製元）で、移設対象ではない |

5 本の殻はいずれも `legacyAdminRedirect` を呼ぶ以外の処理を持たない。
行き先の組み立てを殻ごとに書いていないので、5 本のうち 1 本だけ規則がずれた状態は作れない。
（この「作れなさ」は `tests/acceptance/site-scoped-redirect-map.test.ts` A2 群が固定している。）

## 4. 部品側に取り残しが無いこと

移設で置き去りになりやすいのは page ではなく、page だけが読んでいた部品である。

```
$ grep -rn "persona-form" src/ --include=*.tsx --include=*.ts
src/app/admin/sites/[site]/authors/new/page.tsx           : CreateAuthorPersonaForm
src/app/admin/sites/[site]/audience/personas/new/page.tsx : CreateAudiencePersonaForm
src/presentation/admin/admin-screen-task-manifest.ts      : （新 route id で登録済み）
```

`persona-form.tsx` を読むのは**新設側の 2 枚だけ**である。旧 path からの参照は 0。
`src/presentation/admin/write/` 配下の 5 部品はいずれも参照 1 以上で、孤児は 0 件。

画面と操作の対応表 (`admin-screen-task-manifest.ts`) も、`persona.create-author` /
`persona.create-audience` の route id が `sites/[site]/authors/new` /
`sites/[site]/audience/personas/new` へ更新済みである。ここが旧 id のままだと、
「登録の口はあるが、それがどの画面のものか対応表が知らない」状態になる。

## 5. `/admin/content/` を殻にしていない — その判断と理由

P08 の write scope は `src/app/admin/content/` を含むが、**今回は 1 バイトも触っていない**。
配下 10 枚はすべて実装のまま残している。

理由は 1 つで、**転送先が無いから**である。記事画面 `/admin/sites/[site]/articles` は
`feat-blog-scoped-admin-console` が正本で、まだ存在しない。
存在しない住所へ転送する殻を先に置けば、いま動いている `/admin/content/*` を
**この feature が壊す**ことになる。移設は、受け皿が立ってからでなければ移設ではなく破壊である。

重複という観点では問題が無いことも確認した。`/admin/content/*` に対応する
site 配下の画面は 1 枚も存在しないので、**重複実装は 0 件**である。
「殻にしていない」ことと「二重に持っている」ことは別で、ここは前者だけが該当する。

`docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json` の `not_redirected` に
理由付きで記載済み。黙って落としていない。判断は P10 で確定する。

## 6. 検証

| コマンド | 結果 |
|---|---|
| `pnpm run typecheck` | 通過（出力なし = 型エラー 0） |
| `pnpm run lint` | 通過（出力なし = 指摘 0） |
| `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia` | `violations: []` |
| `npx vitest run tests/acceptance/site-scoped-redirect-map.test.ts` | 全通過（殻・転送先・重複覆いの検査を含む） |

- Required evidence: 本ファイル
