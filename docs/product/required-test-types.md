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
| REQ-P02 | has-input, has-external, has-screen | boundary: 入力が URL 文字列で長さ上限を設けていないため、端が存在しない。上限を入れる時に同時に書く; fault-injection: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45） |
| REQ-P03 | has-calculation, has-screen | boundary: 同一判定は識別子の一致・不一致だけで、大小の端が無い |
| REQ-P04 | has-calculation, has-screen | — |
| REQ-P05 | has-input, has-screen | — |
| REQ-P06 | has-input, has-screen, has-ai-text | — |
| REQ-P07 | has-input, has-state, has-screen | boundary: ウィザードの入力は選択肢と自由記述で、長さ上限を設けていないため端が無い。上限を入れる時に同時に書く |
| REQ-P08 | has-state, has-external, has-screen | fault-injection: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45） |
| REQ-P09 | has-input, has-tenant, has-external, has-screen | fault-injection: ASP への実接続がスタブで、落とす外部接続が実在しない |
| REQ-P10 | has-input, has-screen | — |
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
| REQ-FB13 | has-permission, has-tenant | — |
| REQ-SEC01 | has-tenant | — |
| REQ-SEC02 | has-input | — |
| REQ-SEC03 | has-input | — |
| REQ-SEC04 | has-calculation | — |
| REQ-SEC05 | has-ai-text | — |
| REQ-SEC06 | has-input | boundary: 入力は関係の種類（列挙）で、大小の端が無い。組合せ側は性質テストが全通り生成して当てている |
| REQ-SEC07 | has-input | boundary: 入力は文章とルールの照合で、大小の端が無い。効き目は「当たらねばならない文 / 当たってはならない文」で見ている |
| REQ-SEC08 | has-screen | — |
| REQ-SEC09 | has-input, has-secret | boundary: 監査記録の入力は操作内容と差分で、大小の端が無い。見ているのは消す / 消さないの分かれ目だけ |
| REQ-SEC10 | has-secret | — |
| REQ-A01 | has-input, has-state | — |
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
| REQ-WC06 | has-permission | — |

## 4. 未宣言の要件について（正直に書く）

要件表には **241 件**の要件 ID がある。上の宣言表はそのうち **83 件**である。
残り 158 件は未宣言で、**この検査の対象外**にある。

全部に宣言を書き切るまで検査を入れない、という順にすると**検査は永久に入らない**。
そこで `TRACEABILITY_MAX_UNLINKED` と同じ形にした。

- 未宣言の上限 `TEST_TYPES_MAX_UNDECLARED` を実測（158）に置く
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

#### 保留した 5 件と、その理由

`REQ-WC01`（正規経路）`REQ-WC03`（機能フラグ）`REQ-WC05`（宣言型フォーム）
`REQ-WC07`（エラー形式）`REQ-WC08`（旧 3 ツールの扱い）の 5 件である。

どれも**入力が列挙**（新経路／旧経路／無し・on／off・属性の有無・
旧実装の有無）で、`has-input` を名乗ると必須になる `boundary` の
当てどころが無い。大小の端が無いものに境界値は書けない。

この形の要件は既に 6 件あり（`REQ-P03` `REQ-P07` `REQ-QC12` `REQ-SEC06`
`REQ-SEC07` `REQ-SEC09`）、いずれも「`has-input` を宣言して `boundary` を
理由つき除外」で処理している。同じやり方をすると除外が 10 → 15 になるが、
`TEST_TYPES_MAX_EXCLUSIONS` は 11 で**空きが 1 しかない**。
上限を動かす判断はここではしないので、5 件は未宣言のまま残した。

**検査そのものは 5 件とも既にある**（機能フラグ 3 件・宣言型フォーム 6 件・
エラー形式は `entry-points`、正規経路は今回書いた `webmcp-registration`）。
足りないのは印であって、確かめる手ではない。

根はもっと手前にある。`contract` / `infra-config` / `decision-table` といった
種別が**どの性質からも指されていない**（下の「まだどの性質からも
指されていない種別」）。列挙の網羅を名指しできる性質があれば、
除外を増やさずに宣言できる。`ah-wes` を先に片付けると、この 5 件は
除外を 1 件も使わずに済む可能性がある。

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

### まだどの性質からも指されていない種別（`ah-0ip` の残り）

`secrets` は片付いたが、**同じ食い違いが 7 つ残っている**。
いずれも印としては使われているが、**要求されてはいない**——
つまり書いた人の善意だけで存在しており、書かなくても検査は緑になる。

数え方: `tests/` の `@types` 印を全部集めると 19 種別が使われている。
そのうち `REQUIRED_TEST_TYPES` が要求するのは 12 種別（＋ 印ではなく実測から導く `mutation`）。
差の 7 種別が下の表である。**`TEST_TYPES` にあるが印としても使われていない種別
（`scenario` / `pairwise` / `e2e` / `load` など）は、まだ 1 行も無いので別の話**。

| 種別 | いま印を持つファイル | 性質にするなら対象は | なぜ今回まとめてやらないか |
| --- | --- | --- | --- |
| `audit-log` | 5 | 記録を残す書き込みの入口（21 件） | 対象が広く、宣言表に無い要件へ一気に波及する。入口が記録へ届いているかは `scripts/port-wiring.mjs` が別途 0 件で押さえている（**テストがあるかは見ていない**ので、いずれ要る） |
| `ssrf` | 2 | 外部へ自分で取りに行く経路（`guarded-fetch` を通る側） | 対象は狭く、次に片付けやすい。`REQ-SEC02` が `has-input` で宣言済みのため、性質を足すと同じ要件に 2 つ目の必須が乗る。その影響を確かめてから足す |
| `decision-table` | 4 | 入力の組合せで結果が分かれる判定 | `has-input`（等価分割・境界値）と重なる。線引きを決めずに足すと、どちらを書いても片方が欠けたままになる |
| `contract` | 3 | 3 つの入口（REST / MCP / WebMCP）を持つ要件 | 入口が 3 つあることは要件の文からは読めず、実装を見ないと分からない。性質の判定を実装依存にしてよいかを先に決める |
| `infra-config` | 3 | 実行環境の設定に依存する要件（`env` の配線・binding） | 要件表の側に「設定」の要件がほとんど無く、当てる先が `REQ-SEC01` などに偏る。要件を足すのが先 |
| `db-migration` | 2 | スキーマを持つ要件 | 往復の検査は `tests/integration/` 側にあり、要件ではなくテーブル単位で並んでいる。要件へ結び直す作業が先に要る |
| `property` | 5 | 手法であって性質ではない | 「性質テストを書くべき要件」を機械で言い当てられない。無理に性質を作ると、当たった要件が全部除外理由を書くことになる |

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
