# P07 feature 受入レポート (SYS-SITE-SCOPED-AUTHORING-IA-P07)

- feature: `feat-site-scoped-authoring-ia`
- 実施日: 2026-09-08 JST
- 判定: **停止 / BLOCKED**
- 停止理由: A6（初見の運営者によるラベル読み取り調査 正答率 90% 以上）が**外部参加者を必要とし、参加者 0 名**である。
  先行 feature `feat-reference-blog-admin-ux` の A10 と同じ境界で、自動テストで代用していない。
- 消費した成果物: `docs/spec/feat-site-scoped-authoring-ia/test-run-report.md`

## 0. 判定に使った実行環境

| 手段 | 結果 |
|---|---|
| `pnpm run build` | exit 0。新設 6 route が route 表に載った（下記 §1） |
| `pnpm run preview` (= `build:worker` + `opennextjs-cloudflare preview`) | `Ready on http://localhost:8787`。全 route が 500/404 を出さずに認証関門へ落ちる |
| `npx vitest run` | 530 ファイル中 527 通過。残る 3 は `HEAD` でも落ちる既存分（`test-run-report.md` §3） |
| `validate-system-plan.py --feature-package feature-package/feat-site-scoped-authoring-ia` | `violations: []` |

### この報告が「実物判定」をどこまでやったか（先に書く）

`pnpm run preview` は起動し、対象 route はすべて実在して認証関門まで届いた。
**ただし、ログイン後の画面そのものを本執筆者は開いていない。**
手元のログインは `/api/dev-signin` への POST 1 回で通るが、**その POST の実行許可が下りなかった**ため、
ログイン後の描画を要する判定（A2 の転送先の中身・A5 のボード表示・A7 の複製導線の押下）は
**コードと自動テストによる根拠**で下している。live 画面での最終確認は §4 の手順で利用者が行う。
この区別を伏せると「見たことにした」報告になるので、verdict 欄に根拠の種別を明示する。

## 1. A1–A10

| ID | expected | actual | evidence | verdict |
|---|---|---|---|---|
| A1 | 読者像・書き方の決め事の各画面が `/admin/sites/[site]/` 配下に在る | `authors` / `authors/new` / `audience/personas` / `audience/personas/new` / `writing` の 5 枚と、共通雛形 `writing/template` の計 6 枚が実在し、build の route 表にも載る | build ログ 112–128 行 / `site-scoped-redirect-map.test.ts` A4 群 | **PASS** |
| A2 | 旧 URL がブログを特定できるとき対応する site 配下へ転送される | `/admin/personas` `/admin/personas/new` `/admin/personas/audiences` `/admin/personas/audiences/new` `/admin/writing` の 5 本が `legacyAdminRedirect` だけを呼ぶ殻になっている。**`/admin/content/*` は未着手**（§3） | `redirect-map-draft.json` / `site-scoped-redirect-map.test.ts` A2 群 / `site-scoped-redirect.test.ts` | **PARTIAL** |
| A3 | ブログを特定できない旧 URL がブログ選択へ送られる | cookie 無し・一覧が引けない・`?site=` が配列・対応表に無い住所、の 4 通りすべてで `/admin/sites` を返す | `tests/presentation/site-scoped-entry.test.ts` 5 件 | **PASS** |
| A4 | site が解決できないとき `notFound` になり他ブログの内容が出ない | 新設 5 枚すべてが中身を読む前に `resolveSiteOrNotFound` を通す。`getSite` 失敗時は理由を言い分けずに `notFound()`。受け先 `not-found.tsx` は `AppShell` を import も描画もしない（＝サイドバーにブログ名が並ばない） | `site-scoped-entry.test.ts` / `site-scoped-redirect-map.test.ts` A4 群 | **PASS** |
| A5 | 一段目の入口が作業の対象物の数まで畳まれている | 一段目は ブログ / 記事 / 読者 / 商品 / 配信 の **5 つ**。ホームのボードはサイドバーと同じ `nav.group` からの射影で、第 2 の表を持たない | `ADMIN_NAV_GROUP_LABELS` / `work-object-board.ts` / `entry-consolidation-contract.md` §2 | **PASS**（描画の目視は §4） |
| A6 | 初見の運営者のラベル正答率 90% 以上 | 参加者 0 名。ラベル規則の正本は `feat-reference-blog-admin-ux` で、その受入も同じ理由で BLOCKED のまま | — | **BLOCKED** |
| A7 | 書き方の決め事を共通の雛形から複製する経路が在る | `/admin/sites/[site]/writing` が `cloneWritingMethodForSite(共通雛形, そのブログの型)` を呼び、型ごとの重み付けを施した複製を表示する。雛形そのものは `/admin/writing/template` で読める | `clone-writing-method-for-site.ts`（被覆 100%）/ `pattern-writing-emphasis.ts`（同）| **PASS** |
| A8 | 近道が在り、到達クリック数が畳む前以下 | `personas` / `writing` / `content` の旧入口は残っている。ただし複数ブログ時に転送先を決める `ah_last_site` は読取のみで書込経路が無く、実クリック数は未確認 | `site-scoped-entry.test.ts` / `shortcut-contract.md` | **PARTIAL** |
| A9 | 危険操作に確認が挟まり、下書き編集には挟まらない | 新設 5 枚は `deleteSite` / `publishSite` / `updateDomain` / `deleteArticle` のいずれも呼ばない（＝確認の分岐規則から外れる操作を新たに持ち込んでいない）。規則そのものの正本は `feat-reference-blog-admin-ux` | `site-scoped-redirect-map.test.ts` A9 群 | **PASS** |
| A10 | 新しい集計表を追加していない | `drizzle/*.sql` は着手時点と同じ **51 本**。新設画面はどれも指標の読み書きを持たない | `site-scoped-redirect-map.test.ts` A10 群 | **PASS** |

## 2. verdict の根拠の種別

「PASS」と書いた 7 件のうち、**live 画面を開いて確かめたものは 0 件**である。
内訳は次のとおりで、いずれも「実行される物」を見ている（仕様書どうしの突き合わせではない）。

- build の route 表（A1）: 実際に配られる route の一覧
- HTTP 応答（A1/A2/A3/A4 の到達性）: preview 上の 9 route がすべて認証関門へ届く
- 単体・受入テスト（A2–A5, A7–A10）: 実装本体を実行して振る舞いを見る

## 3. A2 を PARTIAL に留めた理由

受入 A2 は `/admin/content/*` を含む。本 feature はこれを**まだ転送していない**。
転送先である `/admin/sites/[site]/articles` が**まだ存在しない**（正本は `feat-blog-scoped-admin-console`）ためで、
存在しない住所へ転送する殻を先に置くと、旧 URL が今より確実に壊れる。

対応方針は 2 つに分かれる。どちらを採るかは P10 で判断する。

1. `feat-blog-scoped-admin-console` が記事画面を置くまで待ち、その後に転送を足す（本 feature のスコープ外へ送る）
2. 記事だけ「ブログ選択へ送る」暫定転送を置く（住所は壊れないが、行き先が目的の画面ではない）

`redirect-map-draft.json` の `not_redirected` に理由付きで載せてあり、黙って落としてはいない。

## 4. 停止境界と、次にやること

A6 以外は PASS または PARTIAL である。P07 の完了条件は A1–A10 全件の判定完了なので、
総合判定を PASS へ繰り上げない。次の 3 つが済んだときに再判定する。

1. **A2**: `/admin/sites/[site]/articles` の受け皿が立った後、`/admin/content/*` の旧 URL を転送する。
2. **A6**: `feat-reference-blog-admin-ux` の `usability-test-protocol.md` に従い、初見の運営者に
   一段目のラベル一覧だけを見せ、各入口で何ができるかを言わせる。正答率 90% 以上を記録する。
3. **A8**: ブログを選択・表示したときに `ah_last_site` を更新し、複数ブログで到達クリック数を実測する。

併せて、未実施の live 画面確認は下記の順で行う。

```
http://localhost:3000/signin  で「owner@local.test として入る」を押す
  → /admin            … 一段目が 5 つ (ブログ/記事/読者/商品/配信) に畳まれているか
  → /admin/personas   … /admin/sites/<ブログ>/authors へ飛ぶか
  → /admin/writing    … /admin/sites/<ブログ>/writing へ飛ぶか
  → /admin/sites/no-such-blog/authors … 「見つかりません」でサイドバーにブログ名が並ばないか
  → /admin/sites/<ブログ>/writing … 型に応じた重み付きの雛形の複製が出るか
```

- Required evidence: 本ファイル
