# 要件ごとの必須テスト種別（宣言表）

規範は `docs/spec/10-テスト戦略仕様.md` §14。
語彙（性質・種別の名前）と上限は `quality-gates.config.mjs` が正本
（`REQUIRED_TEST_TYPES` / `TEST_TYPES` / `TEST_TYPES_MAX_UNDECLARED`）。
判定は `node scripts/required-test-types.mjs`、結果は `docs/product/required-test-types-report.md`。

---

## 1. なぜ「書いたテスト」ではなく「書かねばならないテスト」を先に決めるのか

種別を決めないと、テストは**書きやすいところから書かれる**。
その結果、難しい種別が永久に残る。実際に残りやすいのは次の 3 つで、
いずれも**壊れたときの被害が最も大きい**側である。

| 残りやすい種別 | 書かれない理由 | 落ちたときに起きること |
| --- | --- | --- |
| 権限の**できてはいけない側** | 「できる」ことの確認で満足する | 他人のデータが見える |
| **禁止された**状態遷移 | 正常な順路を通せば緑になる | 承認前の記事が公開される |
| 障害注入 | 外部が落ちる状況を作るのが面倒 | 一部成功のまま二重投稿する |

この表は「何を書いたか」ではなく「**何を書かずに済ませられないか**」の表である。

## 2. 表の読み方

| 列 | 意味 |
| --- | --- |
| REQ | `docs/product/traceability.md` に実在する要件 ID |
| 性質 | `REQUIRED_TEST_TYPES` のキー。複数可（カンマ区切り） |
| 除外と理由 | `種別: 理由` をセミコロン区切り。**理由の無い除外は落ちる** |

満たしているかどうかは**この表に書かない**。
書くと自己申告になるためで、実際の充足は
テストの `@types` 印（`@req` で要件に結ばれているもの）から機械が数える。

例外は `mutation` で、これはファイル単位の印ではなく
`docs/product/mutation.md` の実測（`src/domain` と `src/application` が対象）から導く。
要件表の実装列がその 2 層を指していれば満たしたとみなす。

## 3. 宣言表

| REQ | 性質 | 除外と理由 |
| --- | --- | --- |
| REQ-P01 | has-tenant, has-permission, has-screen | — |
| REQ-P02 | has-input, has-external, has-screen, has-user-supplied-url | fault-injection: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45） |
| REQ-P03 | has-calculation, has-screen | boundary: 同一判定は識別子の一致・不一致だけで、大小の端が無い |
| REQ-P04 | has-calculation, has-screen | — |
| REQ-P05 | has-input, has-screen | — |
| REQ-P06 | has-input, has-screen, has-ai-text | — |
| REQ-P07 | has-input, has-state, has-screen | boundary: ウィザードの入力は選択肢と自由記述で、長さ上限を設けていないため端が無い。上限を入れる時に同時に書く |
| REQ-P08 | has-state, has-external, has-screen, has-db-table | fault-injection: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45） |
| REQ-P09 | has-input, has-tenant, has-external, has-screen, has-db-table | fault-injection: ASP への実接続がスタブで、落とす外部接続が実在しない |
| REQ-P10 | has-input, has-screen | — |
| REQ-B01 | has-screen | — |
| REQ-B02 | has-screen | — |
| REQ-B03 | has-screen | — |
| REQ-B04 | has-screen | — |
| REQ-B05 | has-screen | — |
| REQ-B06 | has-screen | — |
| REQ-B07 | has-screen | — |
| REQ-B08 | has-screen | — |
| REQ-B09 | has-screen | — |
| REQ-B10 | has-screen | — |
| REQ-B11 | has-screen | — |
| REQ-B12 | has-screen | — |
| REQ-B13 | has-screen | — |
| REQ-B14 | has-screen | — |
| REQ-B15 | has-screen | — |
| REQ-B16 | has-screen | — |
| REQ-B17 | has-screen | — |
| REQ-B18 | has-screen | — |
| REQ-S01 | has-screen | — |
| REQ-S02 | has-screen | — |
| REQ-S03 | has-screen | — |
| REQ-S04 | has-screen | — |
| REQ-S05 | has-screen | — |
| REQ-S06 | has-screen | — |
| REQ-S07 | has-screen | — |
| REQ-S08 | has-screen | — |
| REQ-S09 | has-screen | — |
| REQ-S10 | has-screen, has-permission | — |
| REQ-API02 | has-permission, has-tenant | — |
| REQ-R01 | has-permission | — |
| REQ-R02 | has-permission | — |
| REQ-R03 | has-permission | — |
| REQ-R04 | has-permission | — |
| REQ-R05 | has-permission | — |
| REQ-R06 | has-permission | — |
| REQ-R07 | has-permission | — |
| REQ-R08 | has-permission | — |
| REQ-R09 | has-permission | — |
| REQ-R10 | has-permission | — |
| REQ-R11 | has-permission | — |
| REQ-R12 | has-permission | — |
| REQ-QC12 | has-calculation | boundary: 公開ゲートの 13 項目は真偽の組合せで、大小の端が無い。組合せ側は性質テストが生成して当てている |
| REQ-IM05 | has-state | — |
| REQ-TH01 | has-screen | — |
| REQ-TH02 | has-enumerated-input | — |
| REQ-TH03 | has-enumerated-input | — |
| REQ-FB13 | has-permission, has-tenant | — |
| REQ-SEC01 | has-tenant | — |
| REQ-SEC02 | has-input, has-user-supplied-url | — |
| REQ-SEC03 | has-input | — |
| REQ-SEC04 | has-calculation | — |
| REQ-SEC05 | has-ai-text | — |
| REQ-SEC06 | has-enumerated-input | — |
| REQ-SEC07 | has-enumerated-input | — |
| REQ-SEC08 | has-screen | — |
| REQ-SEC09 | has-input, has-secret, has-db-table | boundary: 監査記録の入力は操作内容と差分で、大小の端が無い。見ているのは消す / 消さないの分かれ目だけ |
| REQ-SEC10 | has-secret, has-runtime-config | — |
| REQ-A01 | has-input, has-state, has-user-supplied-url | — |
| REQ-A02 | has-input | — |
| REQ-A03 | has-input | — |
| REQ-A04 | has-input, has-ai-text | — |
| REQ-A05 | has-state | — |
| REQ-A06 | has-state, has-tenant | — |
| REQ-A07 | has-permission | — |
| REQ-A08 | has-input | — |
| REQ-G01 | has-input | — |
| REQ-G02 | has-input | — |
| REQ-G03 | has-input, has-ai-text | — |
| REQ-G04 | has-input | — |
| REQ-G05 | has-state | — |
| REQ-G06 | has-input | — |
| REQ-G07 | has-permission | — |
| REQ-G08 | has-state, has-permission | — |
| REQ-G09 | has-input | — |
| REQ-G10 | has-state | — |
| REQ-G11 | has-input, has-ai-text, has-external, has-secret | — |
| REQ-API01 | has-permission, has-tenant | — |
| REQ-EV01 | has-input | — |
| REQ-EV02 | has-input | — |
| REQ-EV03 | has-input | — |
| REQ-EV04 | has-input | — |
| REQ-EV05 | has-input | — |
| REQ-EV06 | has-input | — |
| REQ-EV07 | has-input | — |
| REQ-EV08 | has-input | — |
| REQ-EV09 | has-input | — |
| REQ-EV10 | has-input | — |
| REQ-EV11 | has-input | — |
| REQ-EV12 | has-input | — |
| REQ-EV13 | has-input | — |
| REQ-EV14 | has-input | — |
| REQ-EV15 | has-input | — |
| REQ-EV16 | has-input | — |
| REQ-M01 | has-input | — |
| REQ-M02 | has-input | — |
| REQ-M03 | has-input, has-permission, has-tenant | — |
| REQ-WA01 | has-input | — |
| REQ-WA02 | has-input, has-permission | — |
| REQ-WB01 | has-input, has-permission | — |
| REQ-WB02 | has-permission | — |
| REQ-WC02 | has-state | — |
| REQ-WC04 | has-input | — |
| REQ-WC01 | has-enumerated-input | — |
| REQ-WC03 | has-enumerated-input | — |
| REQ-WC05 | has-enumerated-input | — |
| REQ-WC06 | has-permission | — |
| REQ-WC07 | has-enumerated-input | — |
| REQ-WC08 | has-enumerated-input | — |

## 4. 未宣言の要件について（正直に書く）

要件表には **241 件**の要件 ID がある。上の宣言表はそのうち **118 件**である
（`node scripts/required-test-types.mjs` の出力から書き写す。手で数えない。
ここは長らく 83 と書いたまま古くなっていたことがある。
**手で書いた数字は、古くなっても古く見えない**）。
残り 123 件は未宣言で、**この検査の対象外**にある。
この 123 が `TEST_TYPES_MAX_UNDECLARED` と一致していることが、
この節の数字が実測と合っていることの確かめになる。

全部に宣言を書き切るまで検査を入れない、という順にすると**検査は永久に入らない**。
そこで `TRACEABILITY_MAX_UNLINKED` と同じ形にした。

- 未宣言の上限 `TEST_TYPES_MAX_UNDECLARED` を実測に置く（置いた当初は 158。現在 123）
- **新しく足す要件は、宣言しなければ CI が落ちる**
- 既存の未宣言は減らせるが増やせない。**上げて緑にすることを禁じる**

減らす作業は残課題 45（`docs/product/backlog.md`）で、1 件ずつ中身を読んで性質を決める。
まとめて機械的に性質を割り当てると、除外理由の欄が「あとで書く」で埋まり、
**この表は読まれなくなる**。

### 2026-08-17 に減らしたぶん（228 → 205）

権限・テナント・セキュリティの 24 件（ah-99p）。**23 件を宣言し、1 件を保留した。**

宣言のために新しく書いた検査は 2 つある。**印を付けただけの件は 1 件も無い。**

| 足りなかった種別 | どうしたか |
| --- | --- |
| `keyboard`（7 件が除外だった） | `tests/ui/keyboard-operation.test.tsx` を書いた。画面の一覧（`route-table.ts`）から**全画面を回し**、順番を手で決めていないか・押せるものに辿り着けるか・辿った先に名前があるかを見る（195 件） |
| `permission-matrix`（役割ごとの「持たない側」） | `tests/domain/permissions.test.ts` に、REQ-R01〜R10 の文が「〜は持たない」と言い切っている分だけを表にして足した |
| `boundary`（SSRF の上限） | `tests/infrastructure/guarded-fetch.test.ts` に、転送回数と本文の大きさの**ちょうど / 1 つ超え**を足した。「回り続けたら止まる」だけでは上限が 5 でも 500 でも緑になる |

**保留した 1 件: `REQ-SEC10`（秘密情報の取り扱い）。**
性質の語彙（`REQUIRED_TEST_TYPES` の 8 つ）に当てはまるものが無い。
この要件は入力でも画面でも計算でもなく、「**リポジトリに秘密が入っていないこと**」である。
種別としては `secrets` があるのに、そこへ至る性質が無い。
語彙を増やすかどうかは、この課題の範囲では決めない（増やすと既存の宣言済み 36 件の判定が変わる）。
起票済み（`ah-0ip` / `tasks/task-test-type-trait-for-secrets.md`）。
→ **2026-08-18 に解いた。下の節を見てほしい。**

### 2026-08-18 に減らしたぶん（205 → 204）と、語彙に足した性質（`ah-0ip`）

保留していた `REQ-SEC10` を宣言した。**数の上では 1 件しか動かないが、
この 1 件のために新しい検査を書いている。**

**足す前に数えた。** 語彙を先に足してから当てはまる要件を探すと、
赤を消す作業になり、印だけが増える。順番を逆にした。

| 数えたこと | 結果 |
| --- | --- |
| 宣言済み 36 件のうち `has-secret` に当たるもの | **1 件**（`REQ-SEC09`。監査記録の伏せ字は秘密の扱いである） |
| `REQ-SEC09` に `secrets` の実体があるか | **あった**（`tests/domain/records-and-metrics.test.ts` が `apiKey` / `access_token` / `Cookie` の伏せ字を見ている）。印だけが無かったので足した |
| `REQ-SEC10` に `secrets` の実体があるか | **無かった**。確かめた欄は `NOT RUN`、証拠は `.gitignore` の 1 行だけだった |
| 語彙を足したことで赤になった既存の宣言 | **0 件** |

`REQ-SEC10` のために書いたのが `tests/architecture/secrets-not-in-repo.test.ts`（5 件）。
**git が追跡しているもの全部**を毎回読み、既知の発行元の形（Anthropic / OpenAI /
Google OAuth / GitHub / AWS / Slack / 秘密鍵）と、名前つきの実値代入を探す。

書くときに決めたことが 3 つある。

- **自前でフォルダを辿らず `git ls-files` を使う。** 自前で辿ると「見に行かない場所」の
  一覧が要る。その一覧はそのまま逃げ道になる（隠したい値をそこへ置けば通る）。
- **当たった値を失敗の文言に出さない。** 場所と指紋（SHA-256 の頭 16 文字）だけを出す。
  出すと CI のログと画面に鍵が増え、漏れを見つける仕掛けが漏らす側に回る。
- **形は同じだが秘密でない値は、ファイル単位ではなく指紋 1 件ずつで許す。**
  実際に 1 件あった（外から入れた道具 `dev-graph` の同梱テストが使う架空のトークン）。
  ファイルごと外すとそこが通り道になるが、指紋で許せば**同じファイルに別の値が
  現れた瞬間に落ちる**。値を書かずに済むので許可一覧を見ても鍵は増えない。

効くことは実測した。架空の鍵を書いたファイルを追跡させると落ち（場所と指紋だけが出た）、
`REQ-SEC10` の行から `@types secrets` の印を外すと `node scripts/required-test-types.mjs`
が `REQ-SEC10: secrets` と言って落ちる。

### 2026-08-18 に減らしたぶん（204 → 196）: 受け入れ条件 8 件（`ah-zs0`）

`REQ-A01`〜`REQ-A08`。要求仕様 §30.1〜§30.8 の受け入れ条件で、
「依頼者が受け取ったときに確かめる操作」がそのまま要件になっている。

**ここでいちばん大事だったのは、印を貼る先を間違えないことだった。**

この 8 件の検証は `tests/acceptance/acceptance-criteria.test.ts` にある。
入口（ツールカタログ）から 1 本ずつ通す検査で、43 件ある。
最初はこのファイルに `@req REQ-A01`〜`REQ-A08` を貼れば済むように見えた。
**それは間違いだった。** 入口を 1 本通すことと、必須種別を満たすことは別である。

例で言うと、受け入れ側の §30.1 は悪い URL を 5 個試して落ちることを見ている。
一方で `172.16.0.1` と `172.31.255.255`（内部ネットワークの端）は試していない。
`boundary` という種別が求めているのはその端の方で、
入口を通る 1 本ではない。同じことが 8 件すべてに当てはまった。

そこで印は、**その分かれ目を実際に持っている単体側の検査**へ付けた。

下の表は 1 列目を要件 ID にしていない。**宣言表の読み取りが、この文書の
どこにあっても「先頭セルが要件 ID の行」を宣言として拾うため**である
（`scripts/required-test-types.mjs` の `readRegistry`）。
ここで `| REQ-A01 |` と書き出すと、解説の表が 2 つ目の宣言として数えられ、
「除外に知らない種別 `tests/domain/...`」という意味の通らない誤りが出る。
正本は §3 の表 1 つだけ、という形を崩さないための書き方である。

| 受け入れ条件 | REQ | 性質 | 印を付けた先 | そこにある分かれ目 |
| --- | --- | --- | --- | --- |
| §30.1 URL登録 | REQ-A01 | has-input, has-state | `tests/domain/link-ingestion.test.ts` | 受け取る / 受け取らない URL、内部ネットワークの端、受信箱の 4 状態 |
| §30.2 比較 | REQ-A02 | has-input | `tests/application/read-product.test.ts` | 1 つでは比較にならない、1 つでも引けなければ途中まで出さない、件数の上限 |
| §30.3 ペルソナ | REQ-A03 | has-input | `tests/application/manage-personas.test.ts` | 試した記録が無い書き手の一人称は止まる / 公式情報に基づく書き方は通る |
| §30.4 AI生成 | REQ-A04 | has-input, has-ai-text | `generation-matrix.test.ts` / `generation-plan.test.ts` | 上限 0 以下は断る、指示として読ませる書き方の検出、3 回を超えたら成功にしない |
| §30.5 ブログ | REQ-A05 | has-state | `tests/application/build-site.test.ts` | 13 段階のどこが埋まっていないか、保存すると次が開く |
| §30.6 配信 | REQ-A06 | has-state, has-tenant | `tests/application/manage-distribution.test.ts` | 公開済みからはどこへも進めない、他の作業場所の配信は見せない |
| §30.7 アフィリエイト | REQ-A07 | has-permission | `tests/application/affiliate.test.ts` | 売上を見る権限が無ければ一覧そのものを返さない |
| §30.8 追跡可能性 | REQ-A08 | has-input | `tests/application/read-product.test.ts` | 事実と推測を読者へ出す言葉で区別する、実測の主張には資料が付く |

**受け入れ用の検査そのものには印を付けていない。**
付けても構わないが、付けると「入口を通したこと」が種別の充足として数えられ、
分かれ目が無いまま緑になる。それはこの表が防ぎたかったことである。

#### 途中で取り下げた性質 2 つ（数を減らすために付けなかった）

一度は宣言に書いたが、中身に照らして外した。

- **`REQ-A05` の `has-screen`**。付けると `screen-states` / `a11y` / `keyboard` が要る。
  実体は全画面を回す `tests/ui/*` にあるが、あれは §30.5 の受け入れ条件
  （複数サイト・設定・標準構成・共通部品・信頼ページ）を見ているわけではない。
  ここに `@req REQ-A05` を足すのは**印だけを増やす行為**なので、性質ごと外した。
- **`REQ-A02` の `has-calculation`**。付けると `mutation` が要る。
  `mutation` はファイルの印ではなく、要件表の実装欄が `src/domain` /
  `src/application` を指しているかで決まる。受け入れ節の表は「条件 / 検証方法 / 結果」の
  3 列で実装欄が無いため、この経路では永久に満たされない。
  加えて §30.2 の受け入れ条件は点数の**計算**ではなく**提示**（区別・理由・手動増減）で、
  計算の側は `REQ-P04` と `REQ-SEC04` が `has-calculation` として既に受け持っている。

効くことは実測した。`tests/application/affiliate.test.ts` から
`permission-matrix` の印を外すと `REQ-A07: permission-matrix` と言って落ちる。

### 2026-08-18 に減らしたぶん（196 → 168）: 生成基盤・入口・出来事 28 件（`ah-29w`）

`REQ-G01`〜`REQ-G11`（生成の仕組み 11 件）、`REQ-API01`（入口の群）、
`REQ-EV01`〜`REQ-EV16`（文脈をまたぐ連絡 16 件）。

**この 28 件は、印を貼るだけなら 5 分で終わった。** 検査は既にあり、
`generation-plan.test.ts` に `@req REQ-G01`〜`REQ-G08` と
`@types equivalence, boundary, state-transition, permission-matrix` を書けば緑になる。

そうしなかったのは、3 か所で「**1 件だけ試して、全部ぶん緑**」になっていたからである。
印は、その 3 つを直してから貼った。

| 直した検査 | 直す前に見ていたもの | 通ってしまう壊れ方 |
| --- | --- | --- |
| `tests/domain/domain-events.test.ts` | 16 件のうち 1 件（`content_variant.approved`）だけ、必須項目を落として断られることを見ていた | 残り 15 件は `requiredKeys` に名前を書いただけで誰も試していない。空の配列にしても緑 |
| `tests/evals/generation-eval-set.test.ts` | `canActivatePromptVersion()` が `false` を返すことだけ | **常に `false` を返す関数**でも通る。基準を満たしたときに開くことを誰も見ていない |
| `tests/application/draft-content-variant.test.ts` | 1 回呼んだときの依頼の中身 | 呼ぶたびに指示文が変わっても気づけない（同じ素材から違う記事が出て、違いの理由が残らない） |

足した検査は 3 つとも「そろった形の**すぐ隣**」を見る形にした。
16 件のイベントは必須項目を 1 つずつ落とし、門は止める基準を 1 つずつ未実行に戻し、
生成の依頼は 2 回組み立てて字面ごと比べる。

性質の当て方は次のとおり。1 列目を要件 ID にしていない理由は 1 つ上の節と同じ。

| 要件 | 性質 | 印を付けた先 | そこにある分かれ目 |
| --- | --- | --- | --- |
| G01 指示文の版 | has-input | `tests/domain/generation-plan.test.ts` | `v1` は版・`v0` と `draft` は版でない、いまの版は書き換えられない |
| G02 渡す項目 | has-input | 同上 | 何も渡さない / 1 つだけ渡す / 順位の記事で順位の決め方が無い |
| G03 取り込んだ文章 | has-input, has-ai-text | 同上 | 攻撃文 5 種は見つかり普通の商品説明は引っかからない、3 回目と 4 回目 |
| G04 受け取りの形 | has-input | 同上 | 散文、20 のうち 1 つだけ、20 に 1 つ足した形 |
| G05 手順 8 種 | has-state | 同上 | 前提の済んでいない手順へ進めない（`skillOrderBreaches`） |
| G06 役 6 種 | has-input | 同上 | 書き直し 3 巡目は再試行、その次は人へ回す |
| G07 執筆と検証の分離 | has-permission | 同上 | 役 × 道具 の総当たり（確かめる役に `generate` が 1 つも無い） |
| G08 承認 12 段階 | has-state, has-permission | 同上 | 人の承認が要る段階を AI が進められない（`STAGE_BRIDGE`） |
| G09 評価セット | has-input | `tests/evals/generation-eval-set.test.ts` | 記事タイプ・切り口・出し先・知識量の全区分、下限 50 件、9 = 3 × 3 |
| G10 ローンチ基準 | has-state | 同上 | 未実行なら上げられない / 全部そろえば上げられる / 1 つ欠けても上げられない |
| G11 生成の実行 | has-input, has-ai-text, has-external, has-secret | `draft-content-variant.test.ts` と `llm-providers.test.ts` | 呼ぶ前に止まる条件、打ち切りと形違いの応答、鍵の扱い、同じ入力から同じ依頼 |
| API01 入口の群 | has-permission, has-tenant | `entry-points.test.ts` と `one-usecase-three-adapters.test.ts` | 入口 3 種 × 操作 の総当たり、他の作業場所は「見つかりません」 |
| EV01〜EV16 出来事 | has-input | `tests/domain/domain-events.test.ts` | 16 件それぞれの「そろった形」と「必須のうち 1 つだけ欠けた形」 |

#### 付けなかった性質と、その理由

- **`REQ-API01` の `has-input`**。入口は入力の**形を配る**ところで、
  各ツールの入力の分かれ目はそのツールの要件の側にある。
  ここに付けると、入口 1 か所の印で全ツールの入力検査を名乗ることになる。
- **`REQ-EV01`〜`REQ-EV16` の `has-state`**。出来事は連絡の形の約束であって、
  状態の遷移そのものではない。どの状態変化で出るかは**出す側の要件**が持つ
  （`affiliate_url.submitted` なら `REQ-P01` の受信箱で、遷移は
  `tests/domain/link-ingestion.test.ts`「受信箱の 4 状態」にある）。
  まだどこからも出していない 9 件と出している 7 件で扱いを変えていないのは、
  出す側が未実装であることと、約束の形が決まっていることが別だからである。
- **`REQ-G11` の `has-state`**。下書きを 1 本作らせるユースケースは何も保存しない。
  状態が動くのは受け取った下書きを記事へ入れる側（`REQ-P07` / `REQ-G08`）である。

理由つき除外は 1 件も増やしていない（10 件のまま）。

効くことは実測した。印を 1 つ外すと、外した種別を名指しして終了コード 1 で落ちる。

    generation-plan から permission-matrix     → REQ-G07 / REQ-G08: permission-matrix
    domain-events から boundary                → REQ-EV01〜REQ-EV16: boundary（16 件）
    generation-eval-set から state-transition  → REQ-G10: state-transition
    draft-content-variant から idempotency     → REQ-G11: idempotency
    entry-points から permission-matrix        → REQ-API01: permission-matrix

### 2026-08-18 に減らしたぶん（168 → 158）: WebMCP・バックエンド MCP 10/15 件（`ah-44d`）

15 件のうち **10 件を宣言し、5 件を保留した。** 保留の理由は下に書く。

宣言のために新しく書いた検査が 1 つある。
`tests/presentation/webmcp-registration.test.ts` で、対象は
`resolveModelContext()` と `registerWebMcpTools()`。
この 2 つには**検査が 1 つも無かった**。どちらも React の部品の中にあり、
画面を描かないと触れなかったためである。そこで `resolveModelContext()` を
`webmcp-provider.tsx` から `webmcp-adapter.ts` へ移し、登録先を引数で
渡せるようにした。移す前は、次の 2 つがどちらも壊しても誰も落ちなかった。

- **正規の経路を先に見ること**。`document.modelContext` と
  `navigator.modelContext` の順を入れ替えても、いまのブラウザでは動いてしまう。
  非推奨が外れた日に**黙って**止まる（落ちないので気づけない）
- **離脱時に道具を渡し直して空にすること**。返す関数を `() => {}` にしても
  そのページでは何も起きない。ページを離れた後、前のページの道具が
  AI から見えたままになる

#### 宣言した 10 件と、性質を当てた場所

| 要件 | 内容 | 性質 | 分かれ目を持っている検査 |
|---|---|---|---|
| M01 | Resources 8 種 | has-input | `spec-contract`（8 種の個数一致・知らない URI） |
| M02 | Tools 8 種 | has-input | `spec-contract`（実装済／スタブ／別名の 3 区分） |
| M03 | MCP の入口と認可 | has-input, has-permission, has-tenant | `api-routes`（本文の形・見せる範囲と実行範囲の総当たり）＋ `tool-catalog-adapters`（テナント分離） |
| WA01 | 管理側 読み取り 10 種 | has-input | `spec-contract` |
| WA02 | 管理側 状態変更 8 種 ＋ 確認必須 | has-input, has-permission | `spec-contract` ＋ `api-routes`（確認が要る道具は入口に出さない） |
| WB01 | 読者側 読み取り 9 種 | has-input, has-permission | `reader-tools`（0 件・記事無し・管理用は断る） |
| WB02 | 読者側 状態変更 1 種 | has-permission | `feedback-tools`（ページ内 AI にはどのページでも渡さない） |
| WC02 | 能力検出と通常 UI へのフォールバック | has-state | `webmcp-registration`（未登録 → 登録済み → 解除） |
| WC04 | 1 ページ 6 ツール以下 | has-input | `webmcp-policy`（7 ページ種別すべてに当てて上限を見る） |
| WC06 | §14.6 オリジン制約 | has-permission | `api-routes`（自分／よそ／明示的に許した先） |

#### 残っていた 5 件（2026-08-18 に解決）

`REQ-WC01`（正規経路）`REQ-WC03`（機能フラグ）`REQ-WC05`（宣言型フォーム）
`REQ-WC07`（エラー形式）`REQ-WC08`（旧 3 ツールの扱い）の 5 件である。

どれも**入力が列挙**（新経路／旧経路／無し・on／off・属性の有無・
旧実装の有無）で、`has-input` を名乗ると必須になる `boundary` の
当てどころが無い。大小の端が無いものに境界値は書けない。

慣行どおりなら「`has-input` を宣言して `boundary` を理由つき除外」だが、
それをすると除外が 10 → 15 になり、上限 11 を超える。
**上限は動かさず、語彙の側を直した。**下の
「2026-08-18: 語彙へ足した性質 2 つ（`ah-wes`）」を見てほしい。

#### 付けなかった性質と、その理由

- **REQ-WA01 / REQ-WA02 の `has-tenant`** — 管理側の道具にも作業場所の境界は
  あるが、それは道具ごとではなく入口が持つ約束である。
  `tool-catalog-adapters` の「テナント分離」が 95 個の道具すべてに当てており、
  そこは REQ-M03 が持っている。同じ検査を 2 つの要件で二重に数えない
- **REQ-WB01 の `has-tenant`** — 「比較記事に順位を尋ねても、ほかの記事の
  順位を返さない」は記事の境界であって、作業場所の境界ではない
- **REQ-WC02 の `has-input`** — 登録先は「新しい経路／旧経路／無し」の
  3 通りで、境界値の当てどころが無い。上の保留 5 件と同じ事情である。
  状態の遷移（未登録 → 登録済み → 解除）だけを宣言した

効くことは実測した。印の `@types` 行を外すと、外した種別を名指しして
終了コード 1 で落ちる。7 ファイルすべてで確かめた。

    spec-contract から外す           → REQ-M01 / REQ-M02 / REQ-WA01: boundary, equivalence
    api-routes から外す              → REQ-M03: boundary, equivalence, permission-matrix
                                       REQ-WA02 / REQ-WC06: permission-matrix
    tool-catalog-adapters から外す   → REQ-M03: tenant-isolation
    webmcp-policy から外す           → REQ-WC04: boundary, equivalence
    reader-tools から外す            → REQ-WB01: boundary, equivalence, permission-matrix
    feedback-tools から外す          → REQ-WB02: permission-matrix
    webmcp-registration から外す     → REQ-WC02: state-transition

新しく書いた検査の側も、実装を壊して赤になることを確かめた。

    経路の優先順位を入れ替える       → 「両方あるときは、新しい経路を使う」が落ちる
    解除で空を渡さないようにする     → 「登録すると渡り、解除すると空になる」が落ちる

### 2026-08-18: 語彙へ足した性質 2 つ（`ah-wes`）と、除外 11 → 7（`ah-44d` 完了）

指されていなかった 7 種別のうち、**`ssrf` と `decision-table` の 2 つを性質へ結んだ**。
結んだことで `TEST_TYPES_MAX_UNDECLARED` は 158 → 153、
`TEST_TYPES_MAX_EXCLUSIONS` は 11 → **7** に下がった。
**除外を使わずに 5 件を足し、しかも既存の除外が 3 件消えた。**

#### `has-user-supplied-url`（→ `ssrf`）

外向きに取りに行く先が、**こちらが受け取った値で決まる**という性質。

線の引き方をここに書いておく。「外部と通信する」では広すぎて、提供元が
列挙されている LLM 呼び出しや、登録済みの ASP・配信先まで巻き込む。
それらに `ssrf` を要求しても書きようが無く、除外理由が並ぶだけになる。
SSRF が成り立つ条件は**行き先を攻撃者が決められること**の 1 点なので、
性質もそこだけを名指しする。

**足す前に数えた**（宣言済み 83 件のうち当たったのは 3 件）。

| 要件 | 当たる／当たらない | 実体 |
| --- | --- | --- |
| REQ-SEC02 URL 取り込みの SSRF 対策 | 当たる | `tests/infrastructure/guarded-fetch.test.ts` |
| REQ-P02 アフィリエイト URL 受信箱 | 当たる | `tests/domain/link-ingestion.test.ts`（`isInternalHost`） |
| REQ-A01 受け入れ条件 §30.1 | 当たる | 同上 |
| REQ-G11 生成の実行 | 当たらない | 提供元は列挙で、行き先を利用者が決められない |
| REQ-P09 Affiliate Hub | 当たらない | 行き先は登録済み ASP |
| REQ-P08 配信 | 当たらない | 送信先は登録済みの媒体 |

足したときに**副産物が 1 つ出た**。REQ-P02 の印を `link-ingestion.test.ts` へ
結び直したところ、「`boundary`: 端が存在しない」という除外の理由が事実と
食い違い、検査が落ちた（同じファイルに境界値の印が付いている）。
除外を取り消して 10 → 9 になった。**除外の理由が古びたことを、機械が見つけた。**

まだ宣言表に無いが、宣言するときに当たるのが `REQ-E13`（`/go/[code]` の転送）。
転送先は保存値だが、その保存値のもとは利用者が出した URL である。

#### `has-enumerated-input`（→ `equivalence` + `decision-table`）

入力の軸が**すべて有限の列挙**で、大小・長短の端が無いという性質。

`has-input` との線引きは「**端があるか**」の 1 点だけにした。
端があるなら `has-input`（等価分割＋境界値）、端が無いならこちら
（等価分割＋判定表）。両方を名乗る要件は無い。
§4 の表で「線引きを決めずに足すと `has-input` と重なり、どちらを書いても
片方が欠けたままになる」と書いていたのが、この 1 点で解ける。

`decision-table` を必須にしたのは、列挙で本当に困るのが**数え落とし**だから
である。3 つのうち 2 つだけ試しても等価分割としては成立してしまう。
判定表は「全通りを表にして、埋まっていない行が無いこと」を名指しする。

**これは逃げ道ではない。**今までこの形の要件は「`has-input` を宣言して
`boundary` を理由つき除外」で処理してきたが、それは**端が無いことを毎回
言い訳として書く**やり方で、数え落としのほうは誰も見ていなかった。

当てはめた結果、**4 か所で数え落としが見つかった**。印だけでは済まなかった。

| 要件 | 判定表にそろえて見つかったこと |
| --- | --- |
| REQ-WC01 登録先の選び方 | 条件 2 つ＝ 4 通りのうち 3 通りしか無く、「新しい経路だけがある」が抜けていた。実装は正しかったが、**壊れても落ちない**状態だった |
| REQ-WC03 機能フラグ | 止める値の一覧を検査側へ書き写しており、実装にある `disabled` が試されていなかった。実装から取る形に直した（`WEBMCP_OFF_VALUES` を外へ出した） |
| REQ-WC07 エラー形式 | `statusOf()` も `errorToMcpResult()` も `tests/` のどこからも呼ばれておらず、**番号の表を丸ごと消しても（全部 500 になっても）誰も落ちなかった**。`tests/presentation/error-format.test.ts` を新しく書いた（50 件） |
| REQ-WC08 旧 3 ツール | 「移行済み」としか書かれておらず、`record_conversion` に代わる**書き込みの口が 1 つも無い**ことが見えていなかった。表の 1 行を空欄のまま残し、口が生えたら落ちる形にした |

既に同じ形だった 2 件（`REQ-SEC06` `REQ-SEC07`）も `has-input` から
`has-enumerated-input` へ移した。どちらも `decision-table` の実体を持っており、
印を書き換えるだけで除外が 2 件消えた。

`REQ-WC05` の印は `tests/ui/tool-form.test.tsx` **だけ**に付けている。
`webmcp-policy.test.ts` にも宣言型フォームの節があるが、そちらへ印を付けると
このファイルの `decision-table`（中身は REQ-WC03 のもの）が REQ-WC05 の充足として
数えられ、**描画側の判定表を丸ごと消しても緑になる**。

効くことは実測した。5 件それぞれで `decision-table` の印を外すと、
その要件を名指しして終了コード 1 で落ちる。

#### まだ結んでいない 5 種別

`contract` / `infra-config` / `db-migration` / `audit-log` / `property` の 5 つは
まだどの性質からも指されていない。事情は下の表のままである。

**2026-08-18 追記**: 5 つとも決着した（経緯はすべて下の節にある）。

| 種別 | どうしたか |
| --- | --- |
| `db-migration` | `has-db-table` に**結んだ** |
| `infra-config` | `has-runtime-config` に**結んだ** |
| `contract` | **結ばないと決めた**（要件ではなくつなぎ目の性質だった） |
| `audit-log` | **今は結ばないと決めた**（当たる先が実質 0 件。要件を宣言したら再検討） |
| `property` | **結ばないと決めた**（手法であって性質ではない、を数えて確かめた） |

### 2026-08-18: `contract` は結ばないと決めた（`ah-wes`）

**足す前に数えた。** 数えた結果、結ばないほうが正しいと分かった種別である。
「結べなかった」ではなく「結ばないと決めた」なので、理由をここに残す。

#### 表に書いてあった理由が、実際と違っていた

上の表は `contract` の対象を「3 つの入口（REST / MCP / WebMCP）を持つ要件」と
書いていた。**印を持つ 3 ファイルを読んだら、どれもそれではなかった。**

| ファイル | `@req` | 実際に固定しているもの |
| --- | --- | --- |
| `tests/architecture/tenant-scoped-ports.test.ts` | REQ-SEC01, REQ-P01 | つなぎ目の形（作業場所を必ず引数に持つこと） |
| `tests/infrastructure/llm-connectivity.test.ts` | REQ-SEC01 | 約束（作っていない提供元を成功にしない） |
| `tests/infrastructure/llm-provider-catalog.test.ts` | REQ-SEC01 | 設定の読み取り契約 |

入口の数は 1 件も見ていない。**表の「対象は」の欄が、印の実態を写していなかった。**
この行を消さずに取り消し線で残すのは、次に読む人が同じ調べ直しをしないためである。

#### 次に立てた仮説と、その数え方

実態に合う性質として「**同じ約束を守る実装が 2 つ以上あるつなぎ目**」を立てた。

数え方: `src/infrastructure/persistence/d1/` と同 `sample/` の両方に、
`: XxxPort` の形で値を名乗っているポートを取り、両側に出るものを対とする。

```bash
comm -12 \
 <(grep -rhoE "(:|=>)\s*[A-Za-z]+Port\b" src/infrastructure/persistence/d1/ | grep -oE "[A-Za-z]+Port" | sort -u) \
 <(grep -rhoE "(:|=>)\s*[A-Za-z]+Port\b" src/infrastructure/persistence/sample/ | grep -oE "[A-Za-z]+Port" | sort -u)
```

**17 対**あった（`AuditLogPort` / `ChannelConnectionRepositoryPort` /
`ClickTrackingPort` / `CommercialConversionRepositoryPort` /
`EditorialContentVariantRepositoryPort` / `EditorialPublishedArticleWriterPort` /
`EditorialPublishedContentPort` / `EditorialSiteDraftRepositoryPort` /
`EditorialSiteRepositoryPort` / `FeedbackRepositoryPort` / `IntegrationKeyPort` /
`MetricsRepositoryPort` / `PublicationRepositoryPort` / `RedirectResolverPort` /
`TelemetrySinkPort` / `TrackingCoveragePort` / `TrackingLinkIssuerPort`）。

**このうち、両側を同じ言明に通しているものは 0 対である。**
両側を同じテストに読み込んでいるファイルは 7 つあるが、比較しているのは 1 か所だけで、
それも手続きの名前が揃っているかを見る形の比較である
（`tests/infrastructure/d1-link-inbox.test.ts:162`）。

しかもその 1 か所は上の 17 対に入っていない。D1 側は `LinkIngestionRepositoryPort`、
見本側は `CommercialLinkIngestionRepositoryPort` と、**別の型を名乗っている**。
名前の比較が拾えているものを、型は対だと思っていない。

素通り 17 件という数字だけを見れば、門を作る理由には十分に見えた。

#### それでも結ばなかった理由（ここが本題）

**見本版は、同じ約束を守っていない。守らないように作ってある。**

見本版の書き込みは `stubCall(...)` を返す。つまり**失敗する**
（`settings-sample-repository.ts:251` の「作業場所の保存」、
`distribution-sample-repository.ts:252` の「接続の保存」など）。
D1 版は成功する。同じ言明を両方に通す検査を書けば、これは必ず赤になる。

赤を緑にする道は 2 つしかない。

1. 見本版の書き込みを**成功したことにする** — `docs/product/stub-ledger.md` が
   禁じていることそのもの。「つながっているのに結果が空」という、
   いちばん分かりにくい壊れ方を作る
2. 書き込みを検査の対象から外す — 残るのは読み取りだけで、
   それは `d1-link-inbox.test.ts` が既にやっている形の比較に戻る

**門を作ると、1 の方向へ押す力になる。**
見本版は「本物の代わり」ではなく「**本物が無いことを声に出して言う置き換え**」である。
別物であることが仕様なのだから、同じ約束で縛る性質は成り立たない。

#### 要件の側から結ぶ道も、数えて閉じた

ポート側で駄目なら要件側から、と考えて `docs/product/traceability.md` を数えた。
**267 行**の実装欄のうち、保存先（`infrastructure/persistence`）を
名指ししているのは **7 行**だけだった。残りは `app/admin` 35 行、
`application/usecases` 29 行、`presentation/ui` 17 行のように、
**画面と手続き**を指している。

要件はポートを名指ししない。だから「2 つ実装があるポートに乗っている要件」を
要件表から機械で言い当てることはできない。当てるにはユースケース層を経由した
辿り直しが要り、それは性質の判定を実装の内部構造に依存させることになる。

#### 結論

`contract` は**要件の性質ではなく、つなぎ目の性質**である。
`REQUIRED_TEST_TYPES` は要件を鍵にした仕組みなので、この種別はここに収まらない。
印としては引き続き使ってよい（3 ファイルは有用である）が、
**この表からは要求しない**。要求できない理由が上の 2 つで、どちらも数えて確かめた。

将来やるなら置き場所は `scripts/port-wiring.mjs` の側で、
見るものは「約束が同じか」ではなく「**約束が違うことを、画面に文字で出しているか**」
になる。それは今 `stub-registry` が受け持っている。二重に作らない。

### 2026-08-18: `db-migration` を `has-db-table` に結んだ（`ah-wes`）

**足す前に数えた。** 表とマイグレーションを本当に持っている要件だけを対象にする。

`docs/product/traceability.md` の実装欄が `infrastructure/persistence` を
名指ししている行は、267 行中 **7 件**である。

| REQ | 表を持つか | 宣言表 | `db-migration` の検査 |
| --- | --- | --- | --- |
| REQ-P08 | 持つ | 済 | `tests/integration/d1-distribution.test.ts`（印あり） |
| REQ-P09 | 持つ | 済 | `tests/integration/d1-tracking-issuance.test.ts`（印あり） |
| REQ-SEC09 | 持つ | 済 | `tests/integration/d1-audit-log.test.ts`（**印を足した**） |
| REQ-E13 | 持つ | まだ | `tests/integration/d1-tracking-issuance.test.ts`（印あり） |
| REQ-TM13 | 持つ | まだ | `tests/integration/d1-telemetry.test.ts`（検査はある。印がまだ） |
| REQ-TM12 | **持たない** | まだ | 読み口の定義（`TelemetrySinkPort` ほか）で、表は TM13 側 |
| REQ-IM13 | **持たない** | まだ | 見本データだけ。**保存は本当に失敗を返す** |

宣言表に載っている 3 件に `has-db-table` を足した。
当たった 3 件のうち **2 件は既に検査があり、1 件（`REQ-SEC09`）だけが印を持っていなかった**。

`REQ-SEC09` に付けたのは、この検査が
「マイグレーションで表を作る → 書いて読み戻す → **表を落とすと失敗が返る**」を
実際に通しているからである（`d1-audit-log.test.ts` の
「表が無ければ、空の成功ではなく失敗が返る」）。ここが握り潰されていると、
画面には「記録 0 件」と出て**まだ何も操作していない状態と見分けが付かない**。
この検査だけが、その見分けの付かなさを潰している。

`REQ-TM12` と `REQ-IM13` に当てなかったのは、**表がまだ無い**からである。
当てれば書きようの無い要求になり、除外理由が 1 行増えるだけになる
（除外の上限は 7 で満杯なので、そもそも書けない）。

#### 赤の実測

`d1-audit-log.test.ts` の `@types` から `db-migration` を外すと、
`REQ-SEC09: db-migration` を名指しして NG になる。戻すと OK に戻る。
**当てた 3 件のうち 1 件は、外せば実際に落ちる。**

### 2026-08-18: `infra-config` を `has-runtime-config` に結んだ（`ah-wes`）

**足す前に数えた。** 当たったのは **`REQ-SEC10` の 1 件だけ**である。

上の表は対象を「実行環境の設定に依存する要件」と書いていたが、
これでは D1 も KV も R2 も入って `db-migration` と重なる。
線を引き直して「**設定を間違えると、コードを 1 行も変えずに壊れる要件**」にした。

数え方: `docs/product/traceability.md` を `wrangler` / `binding` / `env.` /
環境変数 で引くと `REQ-CI05` / `REQ-CI07` / `REQ-SEC10` / `REQ-TS07` の 4 件が出る。
このうち宣言表に載っているのは `REQ-SEC10` だけである。

#### `REQ-SEC01` には当てなかった

`infra-config` の印を持つ 3 ファイルのうち 2 つ（`worker-env-wiring` /
`llm-credential-entry`）は `@req REQ-SEC01` を名乗っている。
だが `REQ-SEC01` の要件の文は**テナント分離**であって、設定の話ではない。

**印が付いていることを、性質がある理由にしない。**
それを認めると、性質は「既にあるテストの集合」を後から言い換えたものになり、
足りないものを名指しする力を失う。`contract` で同じ罠を踏みかけた（上の節）。

#### `REQ-SEC10` に付けた理由

`secrets-not-in-repo.test.ts` の要件 4 と 5 が、まさにこれである。

- 要件 4: `wrangler.jsonc` の `vars` に秘密の名前が無い
  — `vars` は**そのままリポジトリに載り、そのまま配られる**
- 要件 5: 秘密の名前がブラウザへ渡る名前（`NEXT_PUBLIC_`）になっていない

どちらも、置き場所を間違えても**型は通り、単体テストは緑のまま配られる**。
配ったあとに気づく形なので、置き場所そのものを検査するしかない。
印だけが無かったので足した。

#### 赤の実測

`secrets-not-in-repo.test.ts` の `@types` から `infra-config` を外すと、
`REQ-SEC10: infra-config` を名指しして NG になる。戻すと OK に戻る。

### 2026-08-18: 宣言表の読み取りが §3 の外まで拾っていた（`ah-wes` の途中で見つけた）

上の `has-db-table` の経緯表を書いた直後、`node scripts/required-test-types.mjs` が
**宣言済み 88 → 95、未宣言 153 → 149** になった。テストも宣言表も触っていないのに動いた。

原因は `readRegistry()` が**この文書の全文**から
「先頭セルが要件 ID の表の行」を拾っていたことである。
§4 に経緯として書いた表（`| REQ-P08 | 持つ | 済 | …`）が 7 行、
宣言として数えられていた。

これは静かな抜け道である。未宣言の件数は上限
（`TEST_TYPES_MAX_UNDECLARED`）と突き合わせる数字なので、
**経緯を書き足すだけで上限に余裕が生まれる**。
上限を上げるのは禁じてあるのに、分子のほうを文章で動かせてしまう。

`scripts/required-test-types.mjs` に `registrySection()` を足し、
`## 3. 宣言表` の見出しから次の `##` までだけを読むようにした。
見出しが見つからなければ例外で止まる（黙って全文に戻らない）。

**赤の実測**: この修正を入れる前は 95 / 149、入れたあとは 88 / 153。
経緯表は今もこの文書にあるので、区切りを外せばまた 95 に戻る。

### 2026-08-18: 読まれない場所に印があった（`ah-wes` の途中で見つけた）

`audit-log` を数えているときに、`@types audit-log` と書いてあるのに
機械が数えていないファイルに気づいた。印を読むのは**先頭 40 行だけ**だからである。

実測 **3 ファイル 4 か所**。いずれも中身は正しく、置き場所だけが違っていた。

| ファイル | 行 | 書いてあった印 |
| --- | --- | --- |
| `tests/application/manage-content.test.ts` | 826 | `REQ-SEC07` / `decision-table` |
| `tests/application/manage-content.test.ts` | 997 | `REQ-SEC09` / `audit-log` |
| `tests/domain/planning.test.ts` | 250 | `REQ-SEC07, REQ-E23` / `decision-table` |
| `tests/integration/d1-content.test.ts` | 248 | `REQ-SEC09` / `audit-log` |

**今すぐ嘘の緑になるわけではない。** 読まれない印は、満たした側にも数えられない。
危ないのはその先で、**別の場所にあった本物の印を消したとき**である。
赤になったファイルを開くと目の前に `@types` が書いてあるので、
「印はあるのに落ちる」と読める。そこで疑われるのは検査のほうになる。

4 か所をファイル冒頭へ移し、元の位置には `@` を使わない文で
「印はファイル冒頭にある」と書いた（説明としての価値は残る）。
そのうえで `markersOutsideHeader()` を足し、
先頭 40 行より後ろに `@req` / `@types` があれば**行番号つきで落とす**ようにした。

**赤の実測**: `planning.test.ts` の印を 250 行目へ戻すと
`tests/domain/planning.test.ts: 250, 251 行目` を名指しして NG になる。

### 2026-08-18: `audit-log` は今は結ばないと決めた（`ah-wes`）

**足す前に数えた。** 当たる先が実質 0 件だったので、結ばない。

`docs/product/traceability.md` で監査・操作の記録に触れている要件は 5 件
（`REQ-E32` / `REQ-FB08` / `REQ-FB12` / `REQ-P01` / `REQ-SEC09`）。
**宣言表に載っているのは `REQ-P01` と `REQ-SEC09` の 2 件だけ**である。

| REQ | 当てられるか |
| --- | --- |
| REQ-SEC09 | 当てられるが、**既に満たしている**（`d1-audit-log` と `records-and-metrics`） |
| REQ-P01 | **当てられない**。記録すべき書き込みが無い |

`REQ-P01`（作業場所・ブランド管理）の手続きは
`src/application/usecases/identity/manage-workspace.ts` に 6 つあるが、
`createGetSettingsOverviewUseCase` / `ListRoles` / `ListMembers` / `ListBrands` /
`ListDisclosures` / `ListAuditLog` と、**全部が読み取りである**。
書き込みが 1 つも無いので、記録すべき操作が無い。
当てれば書きようの無い要求になり、除外理由が 1 行増えるだけになる
（除外は 7/7 で満杯なので、そもそも書けない）。

つまりこの性質は、**既に満たしている 1 件にしか当たらない**。
そういう性質は門ではなく、既にあるテストの言い換えである。

#### では本当の記録の義務はどこにあるのか

公開・配信・状態変更の側にある。それらの手続きは
`scripts/port-wiring.mjs` が「記録へ届いているか」を別途 0 件で押さえているが、
**そのことをテストが確かめているか**は見ていない。
確かめているテストは実在する（`tests/application/publish-article.test.ts` は
`content.published` の記録が 1 件増えることを見ている）。
ただし**このファイルは `@req` も `@types` も持っていない**。

結ぶのは、それらの要件が宣言表に載ってからでよい（残課題 45 の流れ）。
先に性質を作ると、当たる先が無いまま語彙だけが増える。

**やらないと決めたので、代わりに 2 つ残した。**
1 つは上の「読まれない場所の印」の検査（`audit-log` の印 2 つがそこにあった。
数え間違いの元を潰した）。もう 1 つは残課題への起票である。

### 2026-08-18: `property` は結ばないと決めた（`ah-wes`）

上の表は「手法であって性質ではない」と書いていた。**数えて、そのとおりだと確かめた。**

`tests/property/` の 5 ファイルが名乗る要件は延べ 17 件で、
どのファイルも `property` と**一緒に別の種別**を名乗っている。

| ファイル | 一緒に名乗っている種別 |
| --- | --- |
| `normalization.property.test.ts` | `equivalence`, `idempotency` |
| `publish-gate.property.test.ts` | `decision-table` |
| `ranking.property.test.ts` | `boundary` |
| `tenancy.property.test.ts` | `tenant-isolation`, `permission-matrix` |
| `variant-spec.property.test.ts` | `state-transition` |

つまり `property` は、**それらの種別を満たすために選んだ書き方**であって、
別に守るべき対象ではない。ここを性質として要求すると
「等価分割を、性質テストという書き方で書け」と命じることになる。
書き方を命じる検査は、同じ risk を別の書き方で押さえた人を落とす。

`property` は印として残す（どう書いたかの記録には値がある）。
**要求はしない。**

### 2026-08-18 に減らしたぶん（153 → 123）: 画面 30 件（`ah-cry`）

対象は 32 件（読者側 `REQ-B01`〜`B18` / §22 の画面仕様 `REQ-S01`〜`S10` /
外観 `REQ-TH02`〜`TH05`）。**30 件を宣言し、2 件は宣言しなかった。**

#### 数え方（先に数えてから決めた）

画面の検査は 1 枚ずつ手で書かれておらず、`tests/ui/route-table.ts` の表を
総当たりする作りになっている。まずその表に何本入っているかを数えた。

```
ENTRY 2 本（`/` と `/signin`）/ ADMIN 32 本 / READER 20 本 = 54 本
別の状態でもう一度開くもの 12 本
```

この 54 本を、次の 4 つがそれぞれ全数描いている。

| テスト | 見ているもの | 種別 |
| --- | --- | --- |
| `tests/ui/page-render.test.tsx` | 既定の表示・見出しの階層・a11y 違反 | `screen-states` `a11y` |
| `tests/ui/page-empty.test.tsx` | 何も登録されていないとき | `screen-states` |
| `tests/ui/page-degraded.test.tsx` | 読み出しが全部だめなとき | `screen-states` |
| `tests/ui/keyboard-operation.test.tsx` | 順番・辿り着けるか・名前があるか | `keyboard` |

`has-screen` が要求するのは `screen-states` `a11y` `keyboard` の 3 つで、
**この 4 ファイルで全部そろっている**。読者側 18 件の要件が
表のどの行に当たるかを 1 件ずつ突き合わせ、`REQ-B01`〜`B18` の
18 件すべてに描かれている行があることを確かめた（`REQ-B17` だけは
`privacy` と `terms` の 2 行）。

**つまりこの回は、足りなかったのが検査ではなく結び付けだけだった。**
印を足すだけで済んだ数少ない回である。逆に言うと、画面を 1 枚足したときに
要件との結びが自動で付くわけではない。表とファイルの 1 対 1 は機械が見ているが、
**要件と表の対応は誰も見ていない。**

#### `REQ-S01`〜`S08` に `has-screen` しか付けなかった理由

§22 の画面仕様は、§9 の機能仕様と**同じ画面を画面の側から書いた要件**である。

| §22（画面） | §9（機能）| §9 側の宣言 |
| --- | --- | --- |
| S02 受信箱 | P02 | has-input, has-external, has-screen, has-user-supplied-url |
| S03 商品 | P03 | has-calculation, has-screen |
| S04 書き手 | P05 | has-input, has-screen |
| S05 記事 | P06 | has-input, has-screen, has-ai-text |
| S06 ブログ | P07 | has-input, has-state, has-screen |
| S07 配信予定 | P08 | has-state, has-external, has-screen, has-db-table |
| S08 数字 | P10 | has-input, has-screen |

数字の作り方・状態の遷移・外部接続は**すでに P 側が宣言している**。
S 側に同じ性質を重ねると、同じ検査を 2 回数えたことになり、
「宣言済の件数」だけが増える。**S01 だけは §9 に相手がいない**
（11 個の数字を 1 つのユースケースで数え直す画面）。ここは
`has-calculation` を当てたかったが、`boundary` の当てどころ（数の端）が
今の実装に無く、理由つき除外は上限が満杯で書けない。残課題 71 に置いた。

#### `REQ-S09` に `has-permission` を付けなかった理由

`REQ-S09`（共通レイアウト）の要件文には「権限による表示制御」が入っている。
性質としては `has-permission` が正しい。**付けなかったのは、当てられる検査が
片側しか無いからである。**

- `tests/ui/page-render-privileged.test.tsx` … 持ち主の身元で描いて
  **断られていないこと**を見る（許可側）
- `tests/ui/page-render.test.tsx` … 読むだけの身元で描くが、
  見ているのは見出しと a11y だけで、**できない操作が出ていないことは見ていない**

`permission-matrix` という名前が要求しているのは「できる側とできてはいけない側の
両方」で、画面についてはできてはいけない側が空である。ここで `has-permission` を
宣言すると、`page-render-privileged` の印だけで緑になる。
**片側しか見ていない検査に、両側を見たという名前が付く。**
残課題 72 に「読むだけの身元では公開・招待の操作が出ないことを見る」を置いた。

なお `REQ-S10`（認証画面）は `has-permission` を宣言した。こちらは
`tests/infrastructure/entry-gate.test.ts` `session-issuer.test.ts`
`better-auth-gate.test.ts` `tests/architecture/open-doors.test.ts` が
**入れない側を実際に見ている**（`ah-1j5` が終わるまで画面は見本のままだが、
門の側の検査は実在する）。

#### `REQ-TH02` `REQ-TH03` に `has-enumerated-input` を当てた

外観の決まり方は、本人の選択 / ブログの既定 / 既定値 の 3 つの出どころと、
配色 / 明暗 の 2 軸を突き合わせた**表**である。
`tests/property/normalization.property.test.ts` が
「知らない名前は必ず null」「何を渡しても有効な外観が 1 組決まる」
「本人の選択はブログの既定より優先される」「選んでいない軸だけが既定に落ちる」を
見ており、これは組み合わせを生成で埋めた決定表そのものなので、
同ファイルへ `decision-table` を足した。

そのとき**印と説明文の食い違いを 1 件見つけた**。同ファイルの説明文に
「対応する要件: … REQ-B15（外観の選択）」とあったが、`REQ-B15` は読者側の
`/s/{site}/ai-policy` で外観とは関係が無い。冒頭の印のほうは `REQ-TH03` を
正しく指していたので、**検査は緑のまま何年でも通る**種類の食い違いだった。
機械は印しか読まず、人は説明文しか読まない。

#### 宣言しなかった 2 件

| REQ | 要件 | 宣言しなかった理由 |
| --- | --- | --- |
| REQ-TH04 | 再マウントもチラつき（FOUC）も起こさない | **自動の検査が 1 つも無い。**要件表の PASS 欄は `pnpm run preview` で 25 ルートを目で見た記録である。性質を宣言すると、その手動の記録が自動の緑に化ける |
| REQ-TH05 | 配色を増やすと自動でコントラスト検査に入る | 製品の振る舞いではなく**検査の仕組みそのもの**についての要件。当てるべき種別が語彙に無い（`meta` のような種別を作る話になり、この回の範囲を超える） |

`REQ-TH04` は残課題 73 に置いた。**「見ていない」と書いたまま置くほうが、
見たことにして数を 32 にするより安い。**

#### 赤の実測

| 外したもの | 出た失敗 |
| --- | --- |
| `keyboard-operation` の `@types keyboard` | `REQ-B01`〜`REQ-S10` を 1 件ずつ名指しして NG（40 件） |
| `page-render` の `a11y` | 同じく 40 件を `a11y` 欠けとして NG |
| `normalization.property` の `decision-table` | `REQ-TH02` `REQ-TH03` を名指しして NG |

いずれも戻して緑を確認した。

### まだどの性質からも指されていない種別（`ah-0ip` の残り）

**2026-08-18 に `ssrf` と `decision-table` を結んだので、残りは 5 つである**
（下の表は 7 つのまま残してある。結んだ 2 つの行に「済」と入れた）。

`secrets` は片付いたが、**同じ食い違いが 7 つあった**。
いずれも印としては使われているが、**要求されてはいない**——
つまり書いた人の善意だけで存在しており、書かなくても検査は緑になる。

数え方: `tests/` の `@types` 印を全部集めると 19 種別が使われている。
そのうち `REQUIRED_TEST_TYPES` が要求するのは 12 種別（＋ 印ではなく実測から導く `mutation`）。
差の 7 種別が下の表である。**`TEST_TYPES` にあるが印としても使われていない種別
（`scenario` / `pairwise` / `e2e` / `load` など）は、まだ 1 行も無いので別の話**。

| 種別 | いま印を持つファイル | 性質にするなら対象は | なぜ今回まとめてやらないか |
| --- | --- | --- | --- |
| `audit-log` | 5 | 記録を残す書き込みの入口 | **今は結ばないと決めた**（2026-08-18、下の節）。当たる先が 2 件しかなく、うち 1 件は書き込みを持たない |
| `ssrf` | 3 | 外部へ自分で取りに行く経路（`guarded-fetch` を通る側） | **済**（2026-08-18、`has-user-supplied-url`） |
| `decision-table` | 7 | 入力の組合せで結果が分かれる判定 | **済**（2026-08-18、`has-enumerated-input`）。`has-input` との線引きは「端があるか」の 1 点 |
| `contract` | 3 | ~~3 つの入口（REST / MCP / WebMCP）を持つ要件~~ | **結ばないと決めた**（2026-08-18、下の節）。ここに書いてあった理由は、印の実際の使われ方と合っていなかった |
| `infra-config` | 3 | 設定を間違えると、コードを変えずに壊れる要件 | **済**（2026-08-18、`has-runtime-config`） |
| `db-migration` | 2 | 表とマイグレーションを持つ要件 | **済**（2026-08-18、`has-db-table`） |
| `property` | 5 | 手法であって性質ではない | **結ばないと決めた**（2026-08-18、下の節）。数えて確かめた |

**指されない種別は、一度も要求されない。**一覧に名前があるだけで、門としては無い。
この 7 つは `ah-0ip` から切り出して起票した（`ah-wes` /
`tasks/task-test-type-traits-remaining.md`）。`ssrf` から順に、**1 種別ずつ**片付ける。

## 5. 除外という逃げ道について

除外に理由を書けば通るなら、全部を除外にすれば緑になる。
そうならないように、除外の総数も数えて上限に置いてある
（`TEST_TYPES_MAX_EXCLUSIONS`）。理由は書けるが、**数は増やせない**。

上限が満杯のまま要件を足そうとすると、行き止まりになる。
そのときに取る道は 1 つだけで、**足りない検査を先に書いて、既存の除外を消す**。
2026-08-17 はこれを行った（キーボードの除外 7 件を消して 5 件を足し、13 → 11）。
上限を上げて通す道は無い。

除外理由に使ってよいのは次の 2 つだけである。

1. **対象が存在しない**（端の無い入力に境界値、スタブしかない外部に障害注入）
2. **未実施であることと、いつ書くかが残課題として起票されている**

「重要度が低い」「時間が無い」は理由にしない。
それはこの表が防ごうとしている「書きやすいところから書く」そのものである。
