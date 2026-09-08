# 設計レビュー (P03)

feature: `feat-site-scoped-authoring-ia` / phase: P03 / graph node: `SYS-SITE-SCOPED-AUTHORING-IA-P03`

P02 が確定させた 5 つの契約文書を、実装に入る前に独立で読み直した結果である。
観点は task spec が指定する 4 つ:

1. 旧 URL 転送の網羅性
2. 他ブログの内容を出さない越境防止設計
3. 動詞ラベル規則 (`feat-reference-blog-admin-ux`) との整合
4. 危険操作分離の分岐設計

各指摘は **設計へ反映すべきもの** と **本 feature のスコープ外として残す残課題** に分けた。
分けない指摘は、実装中に「これもやるべきでは」と蒸し返されて範囲が膨らむ。

## 0. このレビューの実施形態 (先に断る)

当初は独立 context の fork (`p03-design-reviewer`) に監査させる予定だったが、
fork は 2 度とも報告を返さずに idle へ落ちた。**推測で埋めるのは監査の意味を失わせる**ので、
本文脈で 4 観点を読み直す形へ切り替えた。したがって本レビューは
**独立 context による監査ではない**。P09/P11 の証跡整理でこの制約を明記する。

事実確認は推測ではなく機械で行った (`route-inventory.json` / `redirect-map-draft.json` を
Python で読み出して突き合わせた)。以下の F-01・F-02 はその突き合わせで出たものである。

---

## 1. 設計へ反映すべき指摘

### F-01 [重大] `route-inventory.json` の `relocates_to` が P02 の確定住所と食い違う

**観点**: 旧 URL 転送の網羅性
**場所**: `docs/spec/feat-site-scoped-authoring-ia/route-inventory.json`
(`personas` / `personas/new` / `personas/audiences` / `personas/audiences/new` の各 `relocates_to`)

P01 で書いた `relocates_to` が古い住所のまま残っている。

| route_id | inventory の `relocates_to` | P02 の確定住所 |
|---|---|---|
| `personas` | `sites/[site]/personas` | `sites/[site]/audience/authors` |
| `personas/new` | `sites/[site]/personas/new` | `sites/[site]/audience/authors/new` |
| `personas/audiences` | `sites/[site]/personas/audiences` | `sites/[site]/audience/personas` |
| `personas/audiences/new` | `sites/[site]/personas/audiences/new` | `sites/[site]/audience/personas/new` |

**なぜ問題か**: A1 と A8 の判定は `route-inventory.json` を入力にすると
`requirements-baseline.md` §2 に書いてある。判定の入力が古いままだと、
**正しく実装したのに A1 が落ちる**か、逆に古い住所で実装しても通る。
どちらに転んでも判定が信用できない。`redirect-map-draft.json` の方は P02 で
更新済みなので、いま同じ事実が 2 か所に食い違ったまま存在している。

さらに、同じ対応表が inventory の中で **2 か所**に写されていた
(`routes[].relocates_to` と top-level の `relocations`)。片方だけ直せば黙って食い違う。
本 feature が無くそうとしている形そのものが、本 feature の判定入力に入っていた。

**反映 (適用済み)**: `relocates_to` 4 件と `relocations` 4 件を確定住所へ揃え、
両者が一致することを機械で確かめた (食い違い 0 件)。
住所の正本が `site-scoped-route-contract.md` §1 であることを
`$comment_authority` に書いた。P06 で両者の一致を継続検査に入れる。

### F-02 [重大] 「読者」群の中身が読者だけではない (A6 と衝突する)

**観点**: 動詞ラベル規則との整合 / A6
**場所**: `entry-consolidation-contract.md` §2 の `reader` 行、
`route-inventory.json` の `personas` 系 4 件 (`work_object: reader`)

`reader` (ラベル「読者」) に寄せる入口は `personas` / `contact` / `feedback` だが、
`personas` の実際のラベルは **「書き手と読者像」** で、
`personas/new` は **「書き手を作る」** である。

**なぜ問題か**: 書き手は読者ではない。書く側の人物像である。
A6 は「一段目のラベルから、何ができるかが言い当てられる (正答率 90%)」を要求する。
「読者」というラベルの下に「書き手を作る」が入っていると、
**この 1 点だけで A6 の測定が落ちる**。しかも A6 は人を集めないと測れないので、
落ちたことに気付くのが最後になる。

住所側にも同じずれが入っている。`sites/[site]/audience/authors` は
「audience (読者) の下の authors (書き手)」という入れ子で、URL が同じ矛盾を持つ。

**反映**: 次のどちらかを P02 契約へ確定させてから P05 に入る。

- (A) 群のラベルを「読者」から、書き手と読者像の両方を含意する語へ変える
- (B) `personas` (書き手) を `article` 群へ移し、`reader` 群には読者像・問い合わせ・感想だけを残す

**このレビューの推奨は (B)** である。理由は 2 つ。
第一に、A5 が要求するのは「対象物 5 つ」であって、ラベルの言い換えでは
対象物の切り方そのもののずれは直らない。第二に、書き手は記事を書く人であり、
運営者が書き手を触るのは記事を書かせるときである。作業の流れの上でも `article` 側にある。

**決定: (B) を採る。** 内訳は次の通り。

| 対象 | 変更前 | 変更後 |
|---|---|---|
| `personas` 入口の群 | `reader` (読者) | `article` (記事) |
| `personas` 入口のラベル | 書き手と読者像 | **書き手** |
| 書き手の住所 | `sites/[site]/audience/authors` | **`sites/[site]/authors`** |
| 書き手を作る住所 | `sites/[site]/audience/authors/new` | **`sites/[site]/authors/new`** |
| 読者像の住所 | `sites/[site]/audience/personas` | 変更なし |
| `reader` 群の中身 | `personas`, `contact`, `feedback` | `contact`, `feedback` |

読者像の住所を動かさないのは、`sites/[site]/audience` (読者の動き) が既にあり、
「誰が読んでいるか」と「誰に向けて書くと決めたか」は同じ問いの表裏だからである
(`site-scoped-route-contract.md` の理由)。P05 task spec の produced artifacts が
名指ししている `src/app/admin/sites/[site]/audience/personas/` とも一致する。
動かすのは書き手だけなので、波及は 2 行に収まる。

`reader` 群に `personas` が無くなっても群は空にならない (問い合わせ・感想が残る)。
A5 が数えるのは群の数なので 5 群は保たれる。

### F-02b [重大・F-02 に付随] `shortcut-contract.md` §5 の「畳む前 1 クリック」が実測と違う

**観点**: 動詞ラベル規則との整合 / A8
**場所**: `shortcut-contract.md` §2 の表、§5 のクリック数表

`ADMIN_NAV` (`src/presentation/ui/templates/app-shell.tsx`) の射影条件は
`route.nav !== null && route.label !== null` で、`child()` は `nav: null` を固定する。
つまり**サイドバーに出るのは `nav()` で作られた入口だけ**である。

`personas/audiences` (読者像) は `personas` の子なので、**今もサイドバーに出ていない**。
読者像へ着くには「書き手と読者像」を開いてから読者像へ移るので、**畳む前は 2 クリック**である。

`shortcut-contract.md` §2 は「サイドバーの項目」として `/admin/personas/audiences` を
挙げ、§5 は「読者像 前=1 後=1」と書いている。どちらも実測と違う。

**なぜ問題か**: A8 の判定式は「後 ≤ 前」である。前を 1 と誤記したまま実装すると、
本当は満たしている設計が落ちる。逆に、誤った前提の上で「近道が要る」と判断して
不要な入口を足すと、A5 の 5 群と A6 の一意性を無駄に汚す。

**反映**: §2 の表からサイドバー項目でない `/admin/personas/audiences` を外し、
§5 のクリック数を実測から作り直す。数えるのは `ADMIN_NAV` の射影であって、
手で書いた表ではない。

| 画面 | 畳む前 | 畳んだ後 | 経路 |
|---|---|---|---|
| 書き手 | 1 | 1 | 旧入口「書き手」→ 転送 |
| 読者像 | 2 | 2 | ブログ → 読者 → 読者像 (もしくは旧入口の子から転送) |
| 書き方の決め事 | 1 | 1 | 旧入口 → 転送 |
| 記事 | 1 | 1 | 旧入口 → 転送 |

### F-03 [中] 転送でクエリ文字列をどう扱うかが決まっていない

**観点**: 旧 URL 転送の網羅性
**場所**: `redirect-contract.md` §3・§5

§5 の実装形は `legacyAdminRedirect("/admin/personas", await searchParams)` と
`searchParams` を受け取る形だが、§3 の純粋関数の signature は
`siteScopedRedirectTarget(legacyPath, siteSlug | null) -> string | null` で、
**クエリを受け取らない**。したがって次が未規定である。

- `?site=<slug>` 以外のクエリ (絞り込み・検索語など) を新 URL へ引き継ぐのか捨てるのか
- 引き継ぐ場合、`/admin/content/published` の行き先が既に `?state=published` を
  持っているので、**併合の規則**が要る (同じ鍵が来たらどちらが勝つか)

**なぜ問題か**: 決めていないと、7 本の殻それぞれで実装者が別々に決める。
それは §1 が「関数 1 つに寄せる」で避けようとした片肺の状態そのものである。

**反映**: `redirect-contract.md` §3 へ次を追記する。

- signature を `siteScopedRedirectTarget(legacyPath, siteSlug | null, query) -> string | null` にする
- `site` は解決に使い切ったので**引き継がない**
- それ以外は引き継ぐ。表の `to` が既に持つ鍵 (`state`) が勝つ
  (行き先の意味を決めているのは表であって、旧 URL のクエリではない)

### F-04 [中] `notFound()` の 404 画面が他ブログの名前を出しうる

**観点**: 越境防止設計 / A4
**場所**: `site-scoped-route-contract.md`、P05 で新設する `sites/[site]/audience/*`

A4 の判定は「`notFound()` が投げられること」に加えて
**「応答の中に他ブログの名前・slug が 1 件も含まれない」** である
(`requirements-baseline.md` §2 A4)。

`notFound()` は最も近い `not-found.tsx` を描く。その 404 画面が `AppShell` を描き、
`AppShell` のサイドバーやパンくずがワークスペースのブログ一覧を持っていると、
**`notFound()` を正しく投げたのに A4 の後半が落ちる**。存在しない slug を打った人に
「このワークスペースには他にこれらのブログがある」と教えてしまう。

**なぜ問題か**: A4 が守ろうとしているのは「無いものは無いと言う」だけではなく、
**存在の推測をさせない**ことである。404 の中身に一覧が出るなら、
総当たりで slug を試す必要すらない。

**反映**: `site-scoped-route-contract.md` へ次を明記する。

- `sites/[site]/` 配下の `not-found.tsx` は `AppShell` を描かない
  (ブログ一覧を持つ描画を通さない)
- 検証は「`notFound()` が投げられる」ではなく
  **「応答本文に他ブログの slug が 0 件」** を機械で数える形にする

### F-05 [中] 新設画面での site 解決と本文描画の順序が決まっていない

**観点**: 越境防止設計 / A4
**場所**: `site-scoped-route-contract.md`

書き手・読者像のデータは `workspace_id` 持ちである
(`requirements-baseline.md` §2 A1 の既知の制約)。つまり
**site が解決できなくてもワークスペースの一覧は引ける**。

順序を決めておかないと、site の検査より先に一覧を引く実装が書ける。
その場合、存在しない slug で開いても中身が出る。A4 は落ちるが、
落ち方が「404 が出ない」ではなく「中身が見える」なので、実害の方が大きい。

**反映**: 「site の解決に失敗したら、ワークスペースのデータを 1 件も読まずに
`notFound()` を投げる」を契約として書く。順序であって性能の話ではない。

### F-06 [小] A9 に対して、新設画面に危険操作が無いことが宣言されていない

**観点**: 危険操作分離の分岐設計
**場所**: `requirements-baseline.md` §2 A9、P02 の各契約

A9 は「本 feature は**新設した画面がその規則から外れていないか**だけを検査する」と
書いてあるが、**新設画面に危険操作があるのか無いのか**がどこにも書かれていない。
無いなら「検査対象 0 件で PASS」だが、書いていないと P07 で
「調べていないだけでは」と判定が割れる。

本レビューの読み取りでは、新設 3 種の画面はいずれも危険操作を持たない。

| 新設画面 | 操作 | 危険か |
|---|---|---|
| 書き手 / 読者像 (一覧・作成) | 下書き相当の保存 | 危険でない (A9 は下書き編集に確認を挟まないことを要求) |
| 書き方の決め事 | 読み取りのみ (`createReadWritingMethodUseCase` は保存先を持たない) | 危険でない |
| 旧入口の転送の殻 | 転送のみ | 危険でない |

**反映**: 上の表を `entry-consolidation-contract.md` か新規の短い節へ置き、
A9 の判定を「新設画面の危険操作は 0 件であり、確認の分岐規則は一切変更していない」
という**確認可能な言明**にする。削除操作を新設しないことも併せて明記する。

---

## 2. 本 feature のスコープ外として残す残課題

以下は指摘として妥当だが、本 feature の scope_out か、他 feature の担当である。
**直さないことを決めた**ものとしてここに残す。「まだやっていない」との区別のためである。

### R-01 ブログごとの書き方の決め事を保存できない

`createReadWritingMethodUseCase()` は保存先を持たず、`src/db/schema.ts` に
該当する表も無い。A7 の複製は「読み出しのたびに雛形から作る」形になるので、
ブログごとに文言を上書きしても残らない。

本 feature は新しいデータモデルを作らない制約 (P05 Workstream: Data = N/A) を持つ。
新しい表を足すのは別 feature の判断である。**P10 の残課題として明記する**
(`requirements-baseline.md` §2 A7 に既に記載あり)。

### R-02 ブログ切替ドロップダウンが site 選択の第 2 の経路として残る

`src/presentation/admin/publish/blog-site-switch.tsx` は画面の中で
どのブログの記事かを選ばせている。URL の site セグメントとこのドロップダウンで、
ブログを決める経路が 2 つある状態が残る。

これは `feat-blog-scoped-admin-console` (記事画面の site 配下化) の担当範囲である。
本 feature が触ると担当境界が混ざる。**残課題**。

### R-03 記事画面そのものの site 配下化

`/admin/content/*` のうち転送するのは `/admin/content` と `/admin/content/published`
の 2 件だけで、残る 8 件は `redirect-map-draft.json` の `not_redirected` に
理由付きで載っている (網羅性は確認済み: 7 + 8 = 15 で `content`/`personas`/`writing`
配下の全件を覆う)。記事画面の新設は `feat-blog-scoped-admin-console` の担当。**残課題**。

### R-04 A6 の人による正答率 90% の測定

外部参加者を要する。`feat-reference-blog-admin-ux` が同じ理由で停止しているので、
P07 は `BLOCKED (外部参加者が必要)` として記録し、機械で確かめられる部分だけを
PASS にする。**残課題** (`requirements-baseline.md` §2 A6 に既に記載あり)。

---

## 3. 網羅性の確認結果 (機械)

| 検査 | 結果 |
|---|---|
| `content` / `personas` / `writing` 配下の全ルート数 | 15 |
| `redirects` に載る数 | 7 |
| `not_redirected` に理由付きで載る数 | 8 |
| どちらにも載らないルート | **0** |
| `not_redirected` で理由が空のもの | **0** |

転送表の網羅性そのものは満たされている。観点 1 で残る問題は F-01 (住所のずれ) と
F-03 (クエリ未規定) の 2 件である。

---

## 4. P04 へ入る前の必須事項 (すべて適用済み)

- [x] F-01: `relocates_to` / `relocations` の 8 件を確定住所へ揃え、一致を機械確認
- [x] F-02: 書き手を `article` 群・`sites/[site]/authors` へ。読者像は据え置き
- [x] F-02b: `shortcut-contract.md` §2 / §5 を `ADMIN_NAV` の実測へ作り直し
- [x] F-03: クエリ引継ぎ規則を `redirect-contract.md` §3.1 へ追記
- [x] F-04: 404 が `AppShell` を描かないことを `site-scoped-route-contract.md` §2.2 へ
- [x] F-05: site 解決を本文描画より先に行う順序を §2.1 へ
- [x] F-06: 新設画面の危険操作 0 件の言明を §3.1 へ

反映後の整合確認 (機械):

| 検査 | 結果 |
|---|---|
| 契約文書・テストに残る旧住所 `audience/authors` / `sites/[site]/personas` | 0 件 |
| `routes[].relocates_to` と `relocations` の食い違い | 0 件 |
| `work_object` の総数 | 93 件 (blog 28 / article 27 / utility 16 / product 11 / reader 5 / delivery 5 / home 1) |

---

## 5. 実装後の再レビュー (2026-09-08、独立 context)

実装完了後にもう一度、独立 context のレビューを受けた。指摘 6 件のうち
**実在したのは 2 件で、4 件は下書き段階の版を読んだことによる**。
判定と根拠を残す。「レビューで 6 件指摘された」とだけ書くと、
何が本当に壊れていたのかが後から分からなくなる。

| id | 指摘 | 判定 | 根拠 |
|---|---|---|---|
| R1 | `/admin/content` の転送先が存在しない | **却下 (実装は既に正しい)** | `redirect-map-draft.json` の `not_redirected` に指摘と同じ理由で記録済み。`LEGACY_SITE_SCOPED_ROUTES` にも無い |
| R2 | 横断ボードが到達不能になる | **却下 (同上)** | 転送していないので到達不能にならない |
| R3 | 転送でクエリが落ちる | **却下 (F-03 で対処済み)** | `siteScopedRedirectTarget(legacyPath, siteSlug, query)` が第 3 引数を持ち、併合順序は §3.1 |
| R4 | 「解決規則は 1 つ」と書きながら 3 系統ある | **採用** | `blog/pages` (`permanentRedirect` + `?site` のみ) と `pickSiteSlug` 系が実在。下記 |
| R5 | 307/308 が未定で、前例は 308 | **採用** | 契約が種別を決めていなかった。下記 |
| R6 | パンくずが別ブログへ抜ける | **却下 (前提が成立しない)** | 前提の `content/published` 転送が存在しない |

**ただし R1 は半分当たっていた。**転送しないという判断は正しく実装されていたが、
`redirect-contract.md` §3 の表と `site-scoped-route-contract.md` の表が
**P01 の下書きのまま 7 件・記事一覧ありで残っていた。**
実装 (5 件) と契約文書 (7 件) が食い違っており、
契約文書だけを読んだ人は存在しない転送先を実装しようとする。
レビュアーが実際にそう読んだことが、その証拠である。

### 反映内容

- [x] R1 (文書側): `redirect-contract.md` §3 の表から content 2 行を削除し、
      入れない理由と「受け皿が立った時点で横断ボードを残すか畳むかを別途決める」を明記
- [x] R1 (文書側): `site-scoped-route-contract.md` の記事一覧の行を取り消し線にし、
      **意図的に作っていない**ことを明記 (消すと「漏れた」と読まれる)
- [x] R1 (文書側): 「7 本の殻」の記述を実装どおり 5 本へ (3 箇所)
- [x] R4: `blog/pages` と `pickSiteSlug` 系を `not_redirected` へ理由付きで追加。
      本 feature では統一しないが、**載せないと「漏れ」と区別がつかない**
- [x] R5: `redirect-contract.md` §5.1 に「307 のみ・`permanentRedirect` 禁止」を追加し、
      静的検査を `site-scoped-redirect-map.test.ts` へ追加

R5 は規則を書くだけでは足りない。隣に 308 の前例 (`blog/pages`) があり、
**前例を読んで真似ると壊れる**形だからである。あちらは行き先が `?site=` だけで
決まり cookie を見ないので 308 で壊れない。真似てよい前例かどうかを
各自の判断に委ねると、いつか誰かが間違える。だから機械に見張らせる。

R4 の挙動の食い違い (同一セッションで「いまのブログ」が 3 通りになりうる) は
**実在するが、本 feature が作ったものではない。**統一は
`feat-blog-scoped-admin-console` の所掌なので、残課題として記録するに留める。
