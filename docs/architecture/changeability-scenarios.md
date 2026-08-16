# 変更容易性シナリオ

「変更しやすい」は感想では確かめられない。
よくある変更を先に列挙し、**そのとき触るファイル**を数えて記録する。

判定の基準は 1 つだけ。

> **domain を触らずに済むか。**
>
> 済むなら、その変更は外側の付け替えで終わる（安全）。
> domain を触るなら、業務の決まりごと自体が変わったということ（テストで守る）。

各シナリオの「今の状態」は 2026-08-17 時点。`(未作成)` は骨格だけがあり実装がまだない箇所。

---

## ① ASP を 1 つ追加する（例: afb）

**実測済み 2026-08-17。** 一覧に無かった `afb`（アフィリエイトB）を実際に足して測った。

| 層 | 触ったファイル | 作業 |
| --- | --- | --- |
| domain | `src/domain/monetization/affiliate-program.ts` **2 行** | `AspKind` に 1 語、`ASP_LABEL` に 1 行 |
| application | **なし** | `AspAdapterPort` は変わらない |
| infrastructure | `src/infrastructure/asp/asp-registry.ts` **1 行** | 対応表に 1 行（中身が済むまではスタブを差す） |
| presentation | **なし** | 選択肢は `ASP_LABEL` から自動で出る |
| 自動生成 | `docs/product/stub-ledger.md` | テストが作り直す。手で書かない |

実測（`git diff --stat`）:

```
 docs/product/stub-ledger.md                  |  3 ++-
 src/domain/monetization/affiliate-program.ts |  2 ++
 src/infrastructure/asp/asp-registry.ts       |  1 +
 tests/infrastructure/stub-registry.test.ts   | 10 +++++++++-
```

**測って初めて分かったこと**: `tests/infrastructure/stub-registry.test.ts` が
提携先の数を `toHaveLength(8)` とべた書きしていた。
これでは提携先を足すたびにテストも直すことになる（＝触るファイル数の水増し）。
**数の比較をやめ、`ASP_LABEL` の一覧と差し込み口の一覧が一致するかの比較に直した。**
この修正は 1 回きりで、次回からは **3 ファイル**（うち 1 つは自動生成）で済む。
「実測しないと気づけない種類の劣化」の実例として残しておく。

**本実装（API 連携）を足すとき**: `src/infrastructure/asp/afb-adapter.ts` を新規に書き、
対応表の 1 行をスタブから差し替える。domain・application・presentation は再び無変更。

**domain を触るか**: 触る（2 行）。ただし**判断ロジックには一切触らない**。

**なぜ 1 ファイルで済むか**: 商品検索・成果取得・リンク発行の 3 つの形が `AspAdapterPort` に
固定されているため。ASP ごとの差（ページングの方式、日付の書式、通貨）は
アダプタの中で吸収し、外へ漏らさない。

**やってはいけないこと**: ユースケースに `if (asp === "moshimo")` を書く。
これを 1 回書くと、以後すべての ASP 追加で全ユースケースを触ることになる。

---

## ② LLM プロバイダを差し替える（例: 別ベンダへ）

**一部実測済み 2026-08-17。** 提供元 `google_gemini`（Google Gemini）を実際に足して測った。

| 層 | 触ったファイル | 作業 |
| --- | --- | --- |
| domain | **なし** | 生成の結果を受け取るだけで、誰が生成したかを知らない |
| application | **なし** | `LlmPort` の形は変わらない |
| infrastructure | `src/infrastructure/llm/llm-provider-registry.ts` **3 行** | 種類・表示名・対応表に 1 行ずつ |
| presentation | **なし** | |
| 自動生成 | `docs/product/stub-ledger.md` | テストが作り直す |

実測（`git diff --stat`）:

```
 docs/product/stub-ledger.md                     | 3 ++-
 src/infrastructure/llm/llm-provider-registry.ts | 4 +++-
 2 files changed, 5 insertions(+), 2 deletions(-)
```

**まだ測れていない部分**: 「使う提供元を切り替える」操作そのもの
（組み立て部の 1 行の書き換え）は、**`LlmPort` を使うユースケースがまだ 1 つも無いため
実測できていない**。記事生成のユースケースを実装した時点で測り直す。
ここを「済」と書かないのは、`AppDeps` に `llm` の欄がまだ無いという
事実をごまかさないため。

**domain を触るか**: **触らない**（実測で確認済み）。

**成立の条件**: `LlmPort` が「文字列を投げて文字列を受け取る」ではなく、
**`outputSchema` を渡して型付きの結果を受け取る**形になっていること
（`src/application/ports/llm.ts`）。この形なら、ベンダ固有の JSON モードや
関数呼び出しの違いをアダプタ側に押し込める。

**同時に守られること**: `LlmRequest` は `instructions` と `untrustedContext` を
別の欄で受け取る。取り込んだページの文字列は必ず `untrustedContext` に入るため、
**ページ内の文章が指示として実行されない**。プロバイダを替えてもこの構造は変わらない。

---

## ③ 新しいブログを 1 つ追加する

| 層 | 触るファイル | 作業 |
| --- | --- | --- |
| domain | **なし** | |
| application | **なし** | |
| infrastructure | **なし** | |
| presentation | **なし** | |
| データ | `Site` レコードを 1 件、`SiteBlueprint` を選び、設定値を入れる | 管理画面から |

**domain を触るか**: **触らない。コードを 1 行も書かない。**

**実測済み（2026-08-17）**: 3 本目のブログを実際に足した。
触ったのは設計図の保管場所 1 ファイルのみ、46 行の追加だけ。
画面・部品・ルート表は無変更。詳細は ⑪ を参照。

これが「サイトブループリント（型）+ 設定値」で表現している理由。
ブログごとにフォルダをコピーする作りにすると、5 ブログ目で修正が 5 箇所になる。

**ブループリントに無い構成が必要になったら**: 新しいブログのために分岐を書くのではなく、
**ブループリント自体に選択肢を 1 つ足す**。足した選択肢は既存の全ブログから使える。

**判定**: 「このブログだけ」の要望が来たとき、設定値で表せるかを先に考える。
表せないなら、それは新しいブループリントである。

---

## ④ SNS チャネルを 1 つ追加する（例: Bluesky）

**実測済み 2026-08-17。** Bluesky を実際に足して測った。

| 層 | 触ったファイル | 作業 |
| --- | --- | --- |
| domain | `src/domain/distribution/channel.ts` **+14 行** | `ChannelKind` に 1 語、`CHANNEL_CAPABILITIES` に 1 件（上限 300 字・画像 4 枚・出し方） |
| application | **なし** | `ChannelConnectorPort` は変わらない |
| infrastructure | `src/infrastructure/channels/channel-registry.ts` **1 行** | 対応表に 1 行（中身が済むまではスタブ） |
| presentation | **なし** | 出し先の一覧は能力表から生成される |
| 自動生成 | `docs/product/stub-ledger.md` | テストが作り直す |

実測（`git diff --stat`）:

```
 docs/product/stub-ledger.md                     |  3 ++-
 src/domain/distribution/channel.ts              | 15 ++++++++++++++-
 src/infrastructure/channels/channel-registry.ts |  1 +
 3 files changed, 17 insertions(+), 2 deletions(-)
```

**手で直したテストは 0 件。** 文字数上限の検査・投稿可否の判定・画面の選択肢は
すべて能力表から導かれているため、追加しただけで
「300 字を超えたら止める」が全経路（画面・REST・WebMCP・MCP）で効く。

**本実装（API 連携）を足すとき**: `src/infrastructure/channels/bluesky-connector.ts` を
新規に書き、対応表の 1 行をスタブから差し替える。他の層は再び無変更。

**domain を触るか**: 触る（能力表に 1 件）。判定ロジックは触らない。

**能力表を domain に置いた理由**: 「280 字を超えたら公開できない」は業務の決まりごとであり、
接続の都合ではない。ここに書いておけば、**文字数の判定は 1 箇所**で済み、
画面・API・WebMCP のどこから来ても同じ結果になる。

**公式 API が無い先を足す場合**: `publishMode: "manual_export"` と `basisNote` を書く。
`advance()` が `SENDING` への遷移を拒むため、**「直接公開できます」と表示してしまう事故が
コード上で起きない**（note がこの扱い）。

---

## ⑤ ランキングの評価軸を 1 つ追加する（例: 「修理のしやすさ」）

**実測済み 2026-08-17。** 実際に `repairability`（修理のしやすさ）を足して測った。

| 層 | 触ったファイル | 作業 |
| --- | --- | --- |
| domain | `src/domain/ranking/ranking-model.ts` **1 行** | 許可リスト `ALLOWED_RANKING_CRITERIA` に 1 語足す |
| application | **なし** | |
| infrastructure | `.../sample/ranking-sample-repository.ts` | 評価基準のバージョンを上げ、軸・重み・各商品の点数を足す |
| presentation | **なし** | 画面は軸を配列として回すだけで、軸名で分岐していない |

実測（`git diff --stat`）:

```
 src/domain/ranking/ranking-model.ts                       |  1 +
 .../persistence/sample/ranking-sample-repository.ts       | 15 +++++++++++++--
 2 files changed, 14 insertions(+), 2 deletions(-)
```

**domain を触るか**: **触る（1 行だけ、許可リストのみ）。**
当初この文書は「触らない／0 ファイル」と書いていたが、実測すると誤りだった。
`AllowedCriterionKey` は閉じた許可リストで、未知の軸は
`createRankingModel()` が `VALIDATION_FAILED` で拒否する。

**この 1 行を無くさない理由**: 許可リストを開いて任意の文字列を受け付けるようにすれば
domain の変更は 0 になるが、同時に `affiliate_commission` のような軸も
（禁止リストに書き忘れた瞬間に）通ってしまう。
**「順位づけに報酬を入力しない」を型で守ることの代金が、この 1 行である。**
判定ロジック・重みづけの計算には一切手を入れていないので、
足す作業は許可リストへの追記だけで完了する。

**バージョンを必ず上げる理由**: 過去に公開した記事の順位が、後から静かに変わってはいけない。
評価基準はバージョンごとに固定し、記事はどのバージョンで採点されたかを記録する。

**触ってはいけないもの**: 追加する軸が「報酬率」「売れ行き」だった場合、それは
評価軸ではない。`domain/analytics/feedback-policy.ts` が拒否し、
`tests/architecture/` が import を落とす。

---

## ⑥ 保存先を見本データから D1 へ替える（**実測済み** 2026-08-17）

**実測済み 2026-08-17。** 成果リンク受信箱の保存先を、見本データから
実際に D1（`link_ingestions` テーブル）へ替えて測った。

| 層 | 触るファイル | 実測 |
| --- | --- | --- |
| domain | `src/domain/shared/ids.ts` | **1 行**（`asLinkIngestionId` の追加。ID の作り方が無かっただけで、業務の決めごとは無変更） |
| application | **なし** | ポート `LinkIngestionRepositoryPort` の形は 1 文字も変わっていない |
| infrastructure | `persistence/d1/link-inbox-repository.ts`（新規）、`persistence/d1/connection.ts`（新規）、`db/schema.ts`、`drizzle/0002_*.sql`（生成）、`composition.ts` | 新規 2 ファイル + 差し替え 1 箇所 |
| presentation | `composition.ts`、`admin/inbox-action.ts`、`app/admin/inbox/page.tsx` | 接続の取得が非同期になったための `await` 追加のみ。**表示も操作も無変更** |

実測（`git diff --stat` + 新規ファイル）:

```text
 src/db/schema.ts                       | 48 +++++++++++++++++++++++++++++++++-
 src/domain/shared/ids.ts               |  1 +
 src/infrastructure/composition.ts      | 17 +++++++++---
 src/presentation/composition.ts        | 20 ++++++++++----
 src/presentation/admin/inbox-action.ts |  5 ++--
 src/app/admin/inbox/page.tsx           |  5 ++--
 新規: src/infrastructure/persistence/d1/link-inbox-repository.ts
 新規: src/infrastructure/persistence/d1/connection.ts
 新規: drizzle/0002_oval_rumiko_fujikawa.sql（drizzle-kit が生成）
```

**domain を触るか**: ほぼ触らない（ID の作り方 1 行のみ）。
不変条件・状態遷移・URL の扱いは 1 行も変わっていない。
domain が `drizzle-orm` を import していないことは `pnpm test` が毎回確認している。

**測ってみて分かったこと（当初の記述の誤り）**:

1. **「presentation なし」は誤りだった。** 接続は Workers ではリクエストごとに
   供給されるため、取得が非同期になる。同期で組み立てていた入口
   （`linkInboxUseCases()`）が `async` になり、呼び出し側 3 ファイルに `await` が要る。
   1 回だけの追加コストだが、「0 ファイル」ではない。
2. **「黙って見本データに落ちる」を作らないための表示が要る。**
   保存先が無い環境（`pnpm dev`・自動テスト）では見本データで動くので、
   いま何で動いているかを画面に文字で出す関数（`linkInboxNotice`）も
   非同期になった。ここを省くと「保存したのに消えた」という
   一番原因を探しにくい壊れ方になる。
3. **重複防止は保存先側にも要る。** アプリ側の確認だけだと、
   2 人が同時に入れたときにすり抜ける。一意制約を
   `link_ingestions_workspace_normalized_url_idx` として張った。

残り 10 個の保存先も同じ形で置き換えられる（ポートの形は共通）。
1 つあたり「新規ファイル 1 つ + 合成ルート 1 行 + テーブル定義」。

---

## ⑦ 認証の仕組みを替える（追加シナリオ）

| 層 | 触るファイル |
| --- | --- |
| domain | **なし** |
| application | **なし**（`AuthenticationPort` は `UserId` しか返さない） |
| infrastructure | `src/infrastructure/auth/*`（未作成） |
| presentation | ログイン画面の見た目のみ |

**成立の条件**: ポートが Better Auth のセッション型をそのまま返さないこと。
外部ライブラリの型が application に漏れた瞬間、差し替えは全ファイルに広がる。

---

---

## ⑧ ブランドの色を変える / ブランドを 1 つ増やす（**実測済み** 2026-08-17）

| 層 | 触るファイル | 作業 |
| --- | --- | --- |
| domain / application / infrastructure | **なし** | |
| presentation | `src/presentation/ui/tokens/themes.css` | 1 ブロック追加（10 行） |

**実際に行ったこと**: `[data-brand-theme="indigo-clay"]` を追加した。

**実測結果**: 変更したファイルは **1 つ**（`git status` で確認）。
部品のコードは 1 行も触っていない。

```
 M src/presentation/ui/tokens/themes.css
```

**成立の条件**: 部品が 1 段目のトークンと生の色コードを一切参照していないこと。
`tests/ui/design-tokens.test.ts` がこれを機械的に確認しているため、
「1 箇所だけ生の色で書いた」が入り込めない。

同テストは、追加したテーマが他のテーマと**同じトークン集合を上書きしているか**も見る。
一部だけ上書きすると、そのテーマにだけ既定色が混ざるため。

---

## ⑨ 比較表に列を 1 つ追加する（**実測済み** 2026-08-17）

| 層 | 触るファイル | 作業 |
| --- | --- | --- |
| domain / application / infrastructure | **なし** | |
| presentation | 呼び出し側の 1 ファイル | `columns` に 1 行、`cells` に 1 行 |

**実際に行ったこと**: 見本帳の比較表に「画面の大きさ」列を足した。

**実測結果**: 変更したファイルは **1 つ**。共通部品 `ComparisonTable` は無変更。

```
 M src/app/admin/ui-catalog/page.tsx
```

**成立の条件**: 列を配列 (`ComparisonColumn[]`) で受け取っていること。
列ごとに JSX を書く形だと、列の追加で「見出し・本体・狭い画面用」の
3 箇所を触ることになる。

**同時に確かめられたこと**: 値を入れなかった行（機種B の「画面の大きさ」）は
自動で「—」になった。空白のままにすると入力漏れと見分けが付かないため、
部品側で埋めている。

---

## ⑩ 広告表示の文言を変える（**実測済み** 2026-08-17）

| 層 | 触るファイル | 作業 |
| --- | --- | --- |
| domain / application / infrastructure | **なし** | |
| presentation | `src/presentation/ui/copy.ts` | 1 行 |

**実際に行ったこと**: `UI_COPY.disclosure.bannerBody` を書き換え、
「順位や評価には影響しません」を加えた。

**実測結果**: 変更したファイルは **1 つ**。文言を持つ箇所はコード全体で 1 つだけ
（`grep` で確認）。表示している画面・部品は 1 つも触っていない。

```
 M src/presentation/ui/copy.ts
```

**なぜこれが重要か**: 広告表示は景品表示法（ステマ告示）に関わる。
画面ごとに文言を書いていると、要件が変わったときに必ず直し漏れが出る。
`tests/ui/ui-layers.test.ts` が、画面側に開示文言を直接書くことを禁止している。

---

## ⑪ 新しいブログを 1 つ追加する（**実測済み** 2026-08-17）

③ の UI 側。サイトブループリントとテーマ名だけで増やす。

| 層 | 触るファイル | 作業 |
| --- | --- | --- |
| domain / application | **なし** | |
| infrastructure | 設計図の保管場所 1 ファイル | 設定値を 1 件足す |
| presentation | **なし** | 画面・部品・ルート表は無変更 |

**実際に行ったこと**: 3 本目「はじめての家電」
（`beginner_guide` / `indigo-teal` / 明るい配色固定）を足した。

**実測結果**: 変更したファイルは **1 つ**、**46 行の追加のみ**（削除 0 行）。

```
 M src/infrastructure/persistence/sample/site-sample-repository.ts
 1 file changed, 46 insertions(+)
```

3 本のブログはパターンもテーマも記事構成も違うが、
**画面のファイルは 19 本のまま増えていない**。
本番では、この 46 行は管理画面から入れる設定値になる（コードは 0 行）。

**機械的な確認**: `tests/domain/site-routes.test.ts` が
「ブログ名がファイル構成に混ざっていないこと」を毎回検査する。
`src/app/s/video-editing-gear/` のようなフォルダを作った瞬間にテストが落ちる。

**成立の条件**: ブランドテーマが**名前**であって色そのものではないこと。
色を設定値に持たせると、そのブログだけコントラスト比を割る配色が入り込める。
実体は `themes.css` の 1 ブロックにあり、`tests/ui/blueprint-theme.test.ts` が
名前と実体の一致を検査する。

## まとめ

| シナリオ | domain を触るか | 触るファイル数 | 実測したか |
| --- | --- | --- | --- |
| ① ASP 追加 | 2 行（一覧のみ） | **3**（うち 1 は自動生成） | 済（2026-08-17 実測） |
| ② LLM 差し替え | 触らない | **2**（提供元追加。うち 1 は自動生成） | 一部済（切替の実測は LLM 利用ユースケース待ち） |
| ③ ブログ追加 | 触らない | **1**（設定値のみ・追加 46 行） | **済**（2026-08-17。⑪ と同じ作業） |
| ④ SNS チャネル追加 | 1 件（能力表のみ） | **3**（うち 1 は自動生成） | 済（2026-08-17 実測） |
| ⑤ 評価軸追加 | 1 行（許可リストのみ） | **2** | 済（2026-08-17 実測） |
| ⑥ 保存先を D1 へ | **1 行**（ID の作り方のみ） | **6 変更 + 新規 3**（うち 1 は自動生成） | **済**（2026-08-17。受信箱で実測） |
| ⑦ 認証差し替え | 触らない | 実装群 | 未 |
| ⑧ ブランド色の変更 | 触らない | **1** | **済**（2026-08-17） |
| ⑨ 比較表の列追加 | 触らない | **1** | **済**（2026-08-17） |
| ⑩ 広告表示の文言変更 | 触らない | **1** | **済**（2026-08-17） |
| ⑪ ブログ追加（UI 側） | 触らない | **0**（画面・部品は無変更） | **済**（2026-08-17） |

「実測したか」の欄を分けているのは、**予想と実測を混ぜないため**。
「1 ファイルで済むはず」と「1 ファイルで済んだ」は別のことで、
前者を後者のように書くと、崩れていることに気づけなくなる。

**この表が崩れたら設計が壊れている。** 新しい機能を足すとき、
「ASP を 1 つ足すのに 5 ファイル触る」状態になっていたら、
分岐がユースケースに漏れ出している。そのときは分岐をアダプタへ押し戻す。
