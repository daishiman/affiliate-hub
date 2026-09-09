# 入口束ね直し契約 (P02)

feature: `feat-site-scoped-authoring-ia` / phase: P02 / 受入: A5, A6

93 ルートの一段目の入口を、作業の対象物 5 つまで畳む。

## 1. いま何が起きているか

一段目の見出しは 6 つで、すべて**動詞**である。

```
素材 / 書く / 出す / 稼ぐ / 見る / 整える
```

動詞で切ると、1 つの対象物についての作業が複数の見出しに散る。
「商品」は *素材*（商品を登録する）と *稼ぐ*（提携と成果）の両方にある。
運営者は「商品の話をしたい」と思ったとき、どちらを開くか決められない。
どちらを開いても半分しか無いので、結局両方開く。

一段目の入口 (その下に項目をぶら下げている見出し) は 21 件ある。

## 2. 何に畳むか

見出しを**対象物**に変える。運営者が「これについて作業する」と言える単位は 5 つ。

| id | ラベル | 寄せる入口 | ルート数 |
|---|---|---|---|
| `blog` | ブログ | `sites`, `site-network`, `blog`, `analytics` | 28 |
| `article` | 記事 | `content`, `generation`, `evidence`, `rankings`, `improvement`, `writing`, `personas` (書き手) | 27 |
| `reader` | 読者 | `contact`, `feedback` (読者像は `sites/[site]/audience` 配下) | 5 |
| `product` | 商品 | `products`, `affiliate`, `inbox` | 11 |
| `delivery` | 配信 | `distribution` | 5 |

正本は `route-inventory.json` の `work_object` 列。93 件すべてに行き先があり
`unassigned_entries` は空である。

**書き手 (`personas` / `personas/new`) を `reader` ではなく `article` に置く。**
書き手は読者ではなく、書く側の人物像である。「読者」というラベルの下に
「書き手を作る」が入っていると、その 1 点だけで A6 の正答率が落ちる。
書き手を触るのは記事を書かせるときなので、作業の流れの上でも記事側にある。
読者像 (`personas/audiences` 系) は `reader` に残る (`design-review.md` F-02)。

## 3. 補助領域を入口に数えない

`settings` / `ai-usage` / `tools` / `ui-catalog` (計 16 ルート) は
**運営者が「これについて作業する」と言う対象物ではない**。
設定は「設定について作業する」のではなく「何かを設定する」ための場所である。

5 つに無理に混ぜると、たとえば設定を `delivery` の下に置くことになる。
そうすると「配信」というラベルから設定が出てくることを言い当てられない。
A6 (ラベルから中身が言い当てられる、正答率 90%) と正面から衝突する。

したがって補助領域は**分類の外の常設帯**として、対象物の群とは
別の領域に置く。`ADMIN_NAV_GROUPS` には含めない。

置き方は既存の `UNGROUPED_NAV_HREFS` と同じで、`nav.group` を `null` にする。
`groupedNav` (`src/presentation/ui/templates/app-shell.tsx`) は
`ungrouped` を群より**先に**描くので、実際の位置はサイドバー上部
(ホームの隣) になる。「下部」と書くと実装と食い違うので、
位置ではなく**分類の外にある**ことで定義する。A5 が数えるのは
`ADMIN_NAV_GROUPS` の長さなので、上下どちらに出ても判定は変わらない。

**A5 の判定式**: `ADMIN_NAV_GROUPS.length === 5` かつ id 集合が
`{blog, article, reader, product, delivery}` と一致すること。

## 4. 項目は畳まない (A8 の担保)

畳むのは**見出しの数だけ**であって、見出しの下の項目ではない。
群の下の項目はこれまで通り全部出す。

畳んだ結果として既存画面の到達クリック数が増えることはない。
増えるのは所属替えで site 配下へ移った 5 画面だけで、これは
旧入口を転送の殻として残すこと (`shortcut-contract.md`) で 1 クリックへ戻す。

## 5. ラベルの規則 (A6)

ラベルの規則そのものの正本は `feat-reference-blog-admin-ux`。
本 feature は**規則に従っているか**だけを検査する。

- 名詞 1 語。運営者が普段使う語。
- 社内語・英語のカタカナ書きを使わない (「コンテンツ」ではなく「記事」)。
- 中に何が入るかがラベルから言える。

人による正答率 90% の測定は外部参加者を要する。集められない場合、
P07 は FAIL ではなく `BLOCKED (外部参加者が必要)` として記録し、
機械で確かめられる部分だけを PASS にする
(`feat-reference-blog-admin-ux` が同じ理由で停止しているので扱いを揃える)。

## 6. 実装の置き場所

`ADMIN_NAV_GROUP_LABELS` (`src/presentation/ui/admin-route-metadata.ts`) が唯一の正本。
`app-shell.tsx` の `ADMIN_NAV_GROUPS` はここから射影する。
サイドバーに第 2 の表を作らない。作ると、ルートを 1 本足したときに
片方だけ更新された状態が生まれる。

## 7. 検証

- 単体: `ADMIN_NAV_GROUPS.length === 5`、id 集合が上の 5 つと一致
- 単体: 補助領域 4 件が `ADMIN_NAV_GROUPS` に含まれない
- 単体: 全 nav 入口が 5 群か補助帯のどちらかに属し、どちらにも属さない入口が 0
- 単体: `route-inventory.json` の `unassigned_entries` が空
