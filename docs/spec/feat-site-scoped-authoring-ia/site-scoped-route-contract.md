# 所属替え契約 (P02)

feature: `feat-site-scoped-authoring-ia` / phase: P02 / 受入: A1, A4, A10

読者像・書き方の決め事を `/admin/sites/[site]/` 配下へ移すときの決めごと。

## 1. 何を移して、何を移さないか

**移すのは住所だけ。** 保存されているデータの持ち主は変えない。

`author_personas` と `audience_personas` は `workspace_id` で持たれており
(`src/db/schema.ts`)、ブログ単位の列を持たない。本 feature は新しいデータモデルを
作らない (P05 Workstream: Data = N/A) ので、site 配下の画面が出すのは
**ワークスペースの書き手・読者像を、このブログの文脈で見たもの**である。

書き手・読者像のデータ所有範囲は本節を唯一の正本とする。一覧・作成の4画面は
共通部品 `SharedPersonaScopeNotice` でこの範囲を常時表示し、登録後は解決済みの
site slug から組み立てた同じ一覧へ戻る。画面から送られた任意URLは戻り先に使わない。

この差は必ず画面に出す。出さないと、`/admin/sites/quiet-rental/audience/personas` を見た人は
そこに出ている読者像を「quiet-rental 専用に作られたもの」と読む。
別のブログで読者像を 1 つ消したときに、こちらからも消えて初めて気付くことになる。

| 移す画面 | 新しい住所 | データの持ち主 |
|---|---|---|
| 書き手 | `/admin/sites/[site]/authors` | ワークスペース |
| 書き手を作る | `/admin/sites/[site]/authors/new` | ワークスペース |
| 読者像 | `/admin/sites/[site]/audience/personas` | ワークスペース |
| 読者像を作る | `/admin/sites/[site]/audience/personas/new` | ワークスペース |
| 書き方の決め事 | `/admin/sites/[site]/writing` | 共通の雛形 (§ 雛形複製契約) |
| ~~記事 (一覧)~~ | ~~`/admin/sites/[site]/articles`~~ | **本 feature では作らない** |

**記事一覧の行は P01 の見込みで、本 feature では実装していない。**
新設の正本は `feat-blog-scoped-admin-console` で、本 feature の scope_out である。
消さずに取り消し線で残すのは、この行を見て
「作るはずだったのに漏れた」と読まれるのを防ぐためで、**意図的に作っていない**。
旧 URL (`/admin/content`, `/admin/content/published`) を転送していない理由も同じで、
`redirect-map-draft.json` の `not_redirected` に記録してある。

**読者像を `audience` の下に置く理由**: `/admin/sites/[site]/audience` (読者の行動) が既にある。
「誰が読んでいるか」を見る場所と「誰に向けて書くと決めたか」を置く場所は
同じ問いの表と裏なので、別の枝に分けると片方を見た人がもう片方に辿り着けない。
配置は P05 task spec の produced artifacts
(`src/app/admin/sites/[site]/audience/personas/`) と一致させている。

**書き手を `audience` の下に置かない理由**: 書き手は読者ではない。書く側の人物像である。
`audience` (読者) の下に `authors` (書き手) を入れると、住所そのものが
「読者の下に書き手がいる」と言うことになり、A6 の「ラベルから中身が言い当てられる」に反する。
同じ理由で、サイドバーの入口「書き手」は `reader` 群ではなく `article` 群に置く
(`design-review.md` F-02)。

## 2. `[site]` セグメントの解決 (A4)

site 配下の全画面が、描き始める前に同じ 1 つの関数を通る。

```
resolveSiteOrNotFound(siteSlug) -> SiteSummary   // 解決できなければ notFound() を投げる
```

**骨格を描く前に投げる。** 描いてから中身だけ差し替えると、
題・パンくず・サイドバーの選択状態が「そのブログが在る」前提で出てしまう。
存在しないブログの名前が入るはずだった場所に別の何かが入る。

**他ブログの内容を出さない。** `notFound()` を投げる経路では、
「近いブログはこちら」のような候補提示をしない。提示すると、
slug を総当たりで打つだけでワークスペースのブログ一覧が読み出せる。

現状の `/admin/sites/[site]/page.tsx` は解決できなくても `ErrorView` で骨格を描いている。
これを `notFound()` へ揃える。揃えないと、10 画面のうち 1 枚だけ挙動が違う状態が残る。

### 2.1 site を確かめるまでワークスペースのデータを読まない

書き手・読者像は `workspace_id` で持たれているので、
**site が解決できなくてもワークスペースの一覧は引ける**。

順序を決めておかないと、site の検査より先に一覧を引く実装が書ける。
その場合、存在しない slug で開いても中身が出る。
A4 が落ちるだけでなく、落ち方が「404 が出ない」ではなく「中身が見える」になる。

> site の解決に失敗したら、**ワークスペースのデータを 1 件も読まずに** `notFound()` を投げる。

これは性能の話ではなく順序の話である。

### 2.2 404 の画面はブログ一覧を持つ描画を通さない

`notFound()` は最も近い `not-found.tsx` を描く。
その 404 画面が `AppShell` を描くと、サイドバーやブログ切替がワークスペースの
ブログ一覧を持ち込む。**`notFound()` を正しく投げたのに、応答本文に他ブログの名前が載る。**

A4 が守るのは「無いものは無いと言う」だけでなく、**存在を推測させない**ことである。
404 の中身に一覧が出るなら、slug を総当たりする必要すらない。

> `src/app/admin/sites/[site]/not-found.tsx` は `AppShell` を描かない。

判定は「`notFound()` が投げられる」ではなく
**「応答本文に他ブログの slug が 0 件」**を数える形にする (`design-review.md` F-04)。

## 3. 新しい画面が守ること

- `AdminShell` の `routeId` は `ADMIN_ROUTE_METADATA` の id をそのまま渡す。
  パンくず・サイドバーの選択はそこから射影される (別表を作らない)。
- `routeParams={{ site: siteSlug }}` を必ず渡す。渡さないとパンくずの URL が
  `[site]` のまま出る。
- 新しい集計表を読まない (A10)。指標は既存の `site_daily_metrics` /
  `article_daily_metrics` だけ。`drizzle/` に migration を足さない。
- 危険な操作 (ブログ設定・ドメイン・公開) は既存の確認経路を通す (A9)。
  新設した画面で確認を省く近道を作らない。

### 3.1 新設画面の危険操作は 0 件である (A9 の判定対象)

A9 は「新設した画面が確認の分岐規則から外れていないか」だけを見る。
外れていないことを言うには、**そもそも何件あるのか**を書いておく必要がある。
書かないと P07 で「調べていないだけでは」と判定が割れる (`design-review.md` F-06)。

| 新設画面 | 操作 | 危険か |
|---|---|---|
| 書き手 / 読者像 (一覧・作成) | 下書き相当の保存 | 危険でない (A9 は下書き編集に確認を挟まないことを要求する) |
| 書き方の決め事 | 読み取りのみ (`createReadWritingMethodUseCase` は保存先を持たない) | 危険でない |
| 旧入口の転送の殻 | 転送のみ | 危険でない |

> 本 feature は削除操作・公開操作・ドメイン操作を 1 件も新設しない。
> したがって A9 の判定は「新設画面の危険操作 0 件、確認の分岐規則の変更 0 件」である。

## 4. 検証

- 単体: `resolveSiteOrNotFound` が未知 slug で `notFound()` を投げる
- 単体: 未知 slug の応答に他ブログの slug/名前が含まれない
- 単体: 5 つの新 route id が `ADMIN_ROUTE_METADATA` に存在する
- 機械検査: `drizzle/` 配下の migration 追加が 0 件
