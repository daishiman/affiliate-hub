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
| REQ-P02 | has-input, has-external, has-screen, has-user-supplied-url, has-recorded-operation | fault-injection: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45） |
| REQ-P03 | has-calculation, has-screen | boundary: 同一判定は識別子の一致・不一致だけで、大小の端が無い |
| REQ-P04 | has-calculation, has-screen | — |
| REQ-P05 | has-input, has-screen | — |
| REQ-P06 | has-input, has-screen, has-ai-text | — |
| REQ-P07 | has-input, has-state, has-screen | boundary: ウィザードの入力は選択肢と自由記述で、長さ上限を設けていないため端が無い。上限を入れる時に同時に書く |
| REQ-P08 | has-state, has-external, has-screen, has-db-table, has-recorded-operation | fault-injection: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45） |
| REQ-P09 | has-input, has-tenant, has-external, has-screen, has-db-table, has-recorded-operation | fault-injection: ASP への実接続がスタブで、落とす外部接続が実在しない |
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
| REQ-S09 | has-screen, has-permission | — |
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
| REQ-QC01 | has-enumerated-input | — |
| REQ-QC02 | has-input, has-enumerated-input | — |
| REQ-QC03 | has-enumerated-input | — |
| REQ-QC04 | has-enumerated-input | — |
| REQ-QC05 | has-input | — |
| REQ-QC06 | has-input, has-enumerated-input | — |
| REQ-QC07 | has-enumerated-input | — |
| REQ-QC08 | has-input | — |
| REQ-QC09 | has-enumerated-input | — |
| REQ-QC10 | has-input | — |
| REQ-QC11 | has-enumerated-input | — |
| REQ-QC12 | has-calculation | boundary: 公開ゲートの 13 項目は真偽の組合せで、大小の端が無い。組合せ側は性質テストが生成して当てている |
| REQ-W01 | has-enumerated-input | — |
| REQ-W02 | has-enumerated-input | — |
| REQ-W03 | has-enumerated-input | — |
| REQ-W04 | has-enumerated-input | — |
| REQ-W05 | has-enumerated-input | — |
| REQ-W06 | has-enumerated-input | — |
| REQ-W07 | has-enumerated-input | — |
| REQ-W08 | has-enumerated-input | — |
| REQ-W09 | has-input | — |
| REQ-W10 | has-input | — |
| REQ-W11 | has-enumerated-input | — |
| REQ-W12 | has-enumerated-input | — |
| REQ-TM01 | has-enumerated-input | — |
| REQ-TM02 | has-enumerated-input, has-calculation, has-screen | — |
| REQ-TM03 | has-calculation, has-screen | — |
| REQ-TM04 | has-enumerated-input | — |
| REQ-TM05 | has-enumerated-input, has-screen | — |
| REQ-TM06 | has-enumerated-input, has-screen | — |
| REQ-TM07 | has-enumerated-input | — |
| REQ-TM08 | has-enumerated-input | — |
| REQ-TM09 | has-enumerated-input, has-input, has-tenant | — |
| REQ-TM10 | has-screen | — |
| REQ-TM11 | has-input | — |
| REQ-TM13 | has-db-table | — |
| REQ-FD02 | has-enumerated-input, has-code-placement-rule | — |
| REQ-FD03 | has-input | — |
| REQ-FD01 | has-code-placement-rule | — |
| REQ-FD05 | has-code-placement-rule | — |
| REQ-FD06 | has-code-placement-rule | — |
| REQ-TM12 | has-code-placement-rule | — |
| REQ-E01 | has-input, has-enumerated-input | — |
| REQ-E02 | has-secret | — |
| REQ-E03 | has-input | — |
| REQ-E04 | has-input | — |
| REQ-E05 | has-state | — |
| REQ-E06 | has-input | — |
| REQ-E07 | has-input | — |
| REQ-E08 | has-input | — |
| REQ-E09 | has-secret | — |
| REQ-E10 | has-input, has-secret | — |
| REQ-E11 | has-input | — |
| REQ-E12 | has-input | — |
| REQ-E13 | has-input, has-state, has-user-supplied-url | — |
| REQ-E14 | has-input | — |
| REQ-E15 | has-input | — |
| REQ-E16 | has-input | — |
| REQ-E17 | has-input | — |
| REQ-E18 | has-input | — |
| REQ-E19 | has-input, has-state | — |
| REQ-E20 | has-input | — |
| REQ-E21 | has-input | — |
| REQ-E22 | has-input | — |
| REQ-E23 | has-enumerated-input | — |
| REQ-E24 | has-input | — |
| REQ-E25 | has-input, has-state | — |
| REQ-E26 | has-input | — |
| REQ-E27 | has-input, has-state | — |
| REQ-E28 | has-input | — |
| REQ-E29 | has-input | — |
| REQ-E30 | has-input, has-state | — |
| REQ-E31 | has-enumerated-input | — |
| REQ-E32 | has-enumerated-input, has-secret, has-recorded-operation | — |
| REQ-IM01 | has-enumerated-input | — |
| REQ-IM02 | has-enumerated-input | — |
| REQ-IM03 | has-enumerated-input | — |
| REQ-IM04 | has-enumerated-input | — |
| REQ-IM05 | has-state | — |
| REQ-IM06 | has-state, has-permission | — |
| REQ-IM07 | has-input | — |
| REQ-IM08 | has-calculation | — |
| REQ-IM09 | has-state, has-screen, has-permission | — |
| REQ-IM10 | has-enumerated-input | — |
| REQ-IM11 | has-enumerated-input | — |
| REQ-IM12 | has-enumerated-input | — |
| REQ-IM13 | has-db-table, has-tenant, has-state, has-enumerated-input | — |
| REQ-TH01 | has-screen, has-color-scheme-variants | — |
| REQ-TH02 | has-enumerated-input, has-color-scheme-variants | — |
| REQ-TH03 | has-enumerated-input | — |
| REQ-FB08 | has-state, has-recorded-operation | — |
| REQ-FB09 | has-secret, has-recorded-operation | — |
| REQ-FB12 | has-secret, has-recorded-operation | — |
| REQ-FB13 | has-permission, has-tenant | — |
| REQ-SEC01 | has-tenant | — |
| REQ-SEC02 | has-input, has-user-supplied-url, has-code-placement-rule | — |
| REQ-SEC03 | has-input | — |
| REQ-SEC04 | has-calculation, has-code-placement-rule | — |
| REQ-SEC05 | has-ai-text | — |
| REQ-SEC06 | has-enumerated-input | — |
| REQ-SEC07 | has-enumerated-input | — |
| REQ-SEC08 | has-screen | — |
| REQ-SEC09 | has-input, has-secret, has-db-table, has-recorded-operation | boundary: 監査記録の入力は操作内容と差分で、大小の端が無い。見ているのは消す / 消さないの分かれ目だけ |
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
| REQ-TS04 | has-permission, has-tenant, has-enumerated-input | — |
| REQ-TS05 | has-screen | — |
| REQ-TS07 | has-db-table | — |
| REQ-TS01 | has-code-placement-rule | — |
| REQ-TS06 | has-color-scheme-variants | — |
| REQ-TS08 | has-input | — |
| REQ-TS09 | has-code-placement-rule | — |
| REQ-TS11 | has-known-breakage | — |
| REQ-TS12 | has-input | — |
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
| REQ-CI01 | has-runtime-config | — |
| REQ-CI02 | has-runtime-config | — |
| REQ-CI03 | has-runtime-config | — |
| REQ-CI04 | has-runtime-config | — |
| REQ-CI05 | has-runtime-config | — |
| REQ-CI06 | has-runtime-config | — |
| REQ-CI07 | has-runtime-config, has-secret | — |
| REQ-CI09 | has-runtime-config | — |
| REQ-CI10 | has-runtime-config | — |
| REQ-CI11 | has-runtime-config | — |
| REQ-CI12 | has-input | — |
| REQ-CI13 | has-runtime-config | — |
| REQ-FB01 | has-enumerated-input | — |
| REQ-FB02 | has-screen, has-permission | — |
| REQ-FB03 | has-input, has-screen | — |
| REQ-FB04 | has-screen | — |
| REQ-FB05 | has-screen | — |
| REQ-FB06 | has-input | — |
| REQ-FB07 | has-screen | — |
| REQ-FB10 | has-enumerated-input, has-secret | — |
| REQ-FB11 | has-ai-text | — |

## 4. 未宣言の要件について（正直に書く）

要件表には **241 件**の要件 ID がある。上の宣言表はそのうち **234 件**である
（`node scripts/required-test-types.mjs` の出力から書き写す。手で数えない。
ここは長らく 83 と書いたまま古くなっていたことがある。
**手で書いた数字は、古くなっても古く見えない**）。
残り **7 件**は未宣言で、**この検査の対象外**にある。
この 7 が `TEST_TYPES_MAX_UNDECLARED` と一致していることが、
この節の数字が実測と合っていることの確かめになる。

全部に宣言を書き切るまで検査を入れない、という順にすると**検査は永久に入らない**。
そこで `TRACEABILITY_MAX_UNLINKED` と同じ形にした。

- 未宣言の上限 `TEST_TYPES_MAX_UNDECLARED` を実測に置く（置いた当初は 158。現在 7）
- **新しく足す要件は、宣言しなければ CI が落ちる**
- 既存の未宣言は減らせるが増やせない。**上げて緑にすることを禁じる**

減らす作業は残課題 45（`docs/product/backlog.md`）で、1 件ずつ中身を読んで性質を決める。
まとめて機械的に性質を割り当てると、除外理由の欄が「あとで書く」で埋まり、
**この表は読まれなくなる**。

### 未宣言の山は、書き忘れた印の山ではなく、まだ作っていないものの山である

宣言が付かない理由の大半は「印を書き忘れた」ではない。**当てどころが実装に無い**。
だから未宣言を減らす作業は、印を足す作業ではなく、**作る作業**になる。

これで 3 度目に同じ効き方をした。

| 回 | 未宣言だった理由 | 減らしたときに実際にやったこと |
| --- | --- | --- |
| `REQ-TS01` | 判定欄が実装を指していて、検査そのものが無い | 検査を書いた（印を足したのではない） |
| `REQ-FD05` | `W03` 型。壊しても赤にならない＝検査が存在しない | 検査を書いた |
| `REQ-IM13` | 保存先のテーブルが `src/db/schema.ts` に無い | **テーブルと保存の道筋を作った** |

未宣言の欄を「印の抜け」と読むと、埋める作業が書き写しに見えて、
**空の印だけが増える**。読み方をここに固定しておく。

### 決まり: 語彙を足した回・検査を書いた回は、未宣言の理由を全件読み直す

**できない理由は、環境が変わると黙って嘘になる。**しかも理由が書いてあるぶん、
次に読む人は納得して素通りする。未宣言の欄は「まだできないもの」の置き場だが、
**置いた時点の事実で書かれており、置いたあとの変化を知らない。**

実例（2026-08-19、`REQ-TS09`）。「`contract` 単独の性質が無いので宣言できない」と
書いてあったが、その直後に足した `has-code-placement-rule`（構造の境界）がそのまま
当たっていた。**語彙を足した時点で解けていたのに、解けていない理由のほうが
古いまま残った。**このときは気づいたが、次は気づかない。

だから作業のほうを決まりにする。

| 足したもの | 回すもの |
| --- | --- |
| 語彙に性質を足した | **宣言済の側**（他に当たる要件が無いか横断で洗う） |
| 語彙に性質を足した | **未宣言の側**（「その性質が無いから」と書いてある理由を全件読み直す） |
| 検査を新しく書いた | 未宣言の側（「検査が無いから」と書いてある理由を全件読み直す） |

宣言済の側だけを回すと、当たりが増えるのは見えるが、**言い訳が古くなったことは見えない**。
`REQ-TS06` で `has-color-scheme-variants` を足したときは宣言済の側を洗って
`REQ-TH01` / `REQ-TH02` にも当てたが、未宣言の側を回したのは別の流れだった。
両方を 1 組にする。

以下の各回に「印を外して赤を確かめた」と書いてある。
**その後始末に `git checkout --` を使わない。**手順と理由は
`docs/architecture/testing-architecture.md` §5-2。
この作業場所では、これで未コミットの追加を 3 度失っている。

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
（**上限に空きがあっても当てない。**理由は「書けない」ではなく「対象が無い」である）。

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
（**上限に空きがあっても当てない。**理由は「書けない」ではなく「対象が無い」である）。

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

> **2026-08-18（同日、残課題 69）に結んだ。** 上の判断は「当たる先が無いうちは
> 結ばない」という順番の話であって、永久に結ばないという意味ではなかった。
> 順番どおり、要件を宣言表へ載せてから結んでいる。下の節を見よ。
> **この節の「実質 0 件」は、当時の宣言表に対する実測として正しい。**
> 数え方は変えていない。数える相手（宣言表）が増えた。

### 2026-08-18 に減らしたぶん（123 → 120）: 記録の義務 7 件（残課題 69）

`audit-log` を `has-recorded-operation` に結んだ。上の「今は結ばない」から
**順番どおりに**進めた回で、先に要件を宣言表へ載せ、そのうえで性質を当てている。

#### 性質の元にしたもの

**実装が `auditLog.append` を呼んでいるかどうかを条件にしなかった。**
それを条件にすると、**呼んでいないことが「性質が無い」ことの証拠になる**。
呼んでいない要件こそ、この性質が捕まえたい相手である。

代わりに元にしたのは 2 つ。

1. `docs/spec/02-補充仕様-ギャップと追加要件.md` §7 の列挙
   （**公開 / 削除 / リンク差し替え / 権限変更 / 成果データ修正 / エクスポート**）
2. **要件の文が記録を明示的に求めているもの**
   （`REQ-FB09`「渡した記録に『誰が・どの鍵で』を残す」、
   `REQ-FB12`「回数制限と操作の記録を持つ」、`REQ-FB08`「操作の記録は消さずに積む」）

#### 当てた 7 件

| REQ | 記録の義務がどこから来るか | 当たった先 |
| --- | --- | --- |
| REQ-P02 | §7「リンク差し替え」 | `link-inbox`（受け取り・広告主の差し替え・対象外。`before` / `after` の `programId` まで見る） |
| REQ-P08 | §7「公開」「エクスポート」 | `publish-article` / `schedule-publication` / `publication-calendar` / `manage-distribution` |
| REQ-P09 | §7「成果データ修正」 | `affiliate`（`conversion.adjusted`。修正前後の金額と理由まで見る） |
| REQ-SEC09 | 要件そのものが監査記録 | `d1-audit-log` / `records-and-metrics` / `d1-content` / `manage-content` |
| REQ-FB08 | 要件の文「操作の記録は消さずに積む」 | `feedback`（1 回の変更で履歴がちょうど 1 行増える／空の履歴を積まない） |
| REQ-FB09 | 要件の文「誰が・どの鍵で」 | `feedback`（払い出しの記録） |
| REQ-FB12 | 要件の文「操作の記録を持つ」 | `feedback`（発行と失効を別の語で残す／鍵そのものは記録に入れない） |

#### 当てなかったもの

| REQ | 理由 |
| --- | --- |
| REQ-P07 | `site.created` を出しているが、**要件の文も §7 の列挙も記録を求めていない**。**印が付いていることを、性質がある理由にしない** |
| REQ-R11 | 承認の記録は `REQ-SEC09` が既に持っている。重ねると**同じ検査を 2 回数えた**ことになる |
| REQ-P01 | §7 の「権限変更」に当たるが、**書く側の実装がまだ無い**（残課題 62）。実装が来た日に当たる |
| REQ-SEC01 / REQ-SEC05 | `manage-llm-credentials` が鍵の登録・失効を記録しているが、**両要件の文はテナント分離とプロンプトインジェクションの話**であって、記録の話ではない |

「削除」は当たる先が無い。**削除のユースケースがコード全体に 1 つも無い。**

#### 印を足すだけでは済まなかった 1 件

`REQ-P08` に性質を当てた時点で、**記録されていない持ち出しが 1 つ**残っていた。

`createExportManualDraftUseCase`（手作業での書き出し）は、
記事の本文をまるごと markdown にして人に渡す。渡した先で何が起きるかは
こちらから見えないので、§7 は「エクスポート」を必須記録対象に挙げている。
`AuditAction` にも `export.performed` という語が**最初から**あった。
**その語を出す場所が、コード全体に 1 つも無かった。**

見つからなかった理由がはっきりしている。
`scripts/port-wiring.mjs` が記録を要求するのは**保存先へ書く入口だけ**で、
書き出しは `content.read` の**読み取り**である。構造からは掛からない。
**書き込みが無いから見張りに掛からないが、要件は記録を求めていた。**

足した記録は、**渡す前**に書く。
記録が残せなければ下書きを渡さない（渡してから断ると、
記録に残らない持ち出しがそのぶん起きる）。本文は記録に入れない
（入れると、記録そのものが本文の 2 つ目の置き場所になる）。

#### その直しが暴いた、注釈の嘘

記録を足したら、無関係に見えた `tests/presentation/tool-catalog-adapters.test.ts`
の正常系が落ちた。見本データの `auditLog.append` は**必ず失敗するスタブ**なので、
記録を必須にした道具はそこで断られる。

落ちた場所が答えだった。この道具は `readOnly: true` で登録されていた。
そして `readOnly` は 3 つのことに使われている
——MCP の `readOnlyHint`、正常系を測る対象、そして **WebMCP に載せるかどうか**。

つまり **`export_manual_draft` は、ページ内の AI から呼べる道具だった**。
記事の本文を丸ごと返す道具が、**痕跡を 1 つも残さずに**呼べていた。

記録は状態の変更である。`readOnly: false` へ直した
（`src/presentation/tools/distribution-tools.ts`）。WebMCP からは外れ、
人が画面と REST から使う道は変わらない。

**注釈が嘘であることは、注釈を読んでも分からなかった。**
記録を義務にして初めて、実装と注釈が食い違う場所が赤になった。
`readOnly` のような**1 語で 3 つの意味を持つ印**は、
1 つの意味が変わった日に、残りの 2 つが黙って古くなる。

#### 結んだあとに測った、印 8 件の効き方

残課題 70 で `audit-log` の印を付けたのは 8 ファイル。性質を結んだあとで、
**1 ファイルずつ印を外して赤くなるか**を測った。結果は割れた。

| 印を外したファイル | 結果 |
| --- | --- |
| `feedback` | **赤**（REQ-FB12 が落ちる） |
| `affiliate` | **赤**（REQ-P09 が落ちる） |
| `link-inbox` | **赤**（REQ-P02 が落ちる） |
| `publish-article` / `schedule-publication` / `publication-calendar` / `manage-distribution` | 緑のまま |
| `build-site` | 緑のまま |

**外して緑のままの 5 件には、理由が 2 通りある。**

前の 4 件は `REQ-P08` を**4 ファイル + `manage-content` の 5 つで満たしている**。
1 つ外しても残りが満たすので落ちない。これは要件 1 つに対して入口が
複数あることの帰結で、冗長そのものは悪くない。ただし
**その 1 ファイルが要件から外れたことには、誰も気づけない。**
`REQ-SEC09` も同じ形（4 ファイル）である。

`build-site` は違う。`REQ-P07` に `has-recorded-operation` を
**当てなかった**（要件文が記録を求めていないため。上記「当てなかったもの」）。
つまりこの印は**誰からも要求されていない**。
それでも外さないのは、**印が事実だから**である——このテストは実際に
記録を見ている。外すと、見ているものが見ていないことになる。

**「要求されていない印」と「嘘の印」は別物である。**
前者は残してよい。後者は残してはいけない。
今回残っているのは前者で、`REQ-P07` の要件文が将来
記録を求めるようになった日に、そのまま宣言できる。

#### まだ出されていない操作の語

`AuditAction` の **28 語**を、`src/` の中で実際に出している場所と突き合わせた
（`export.performed` は今回 1 段目へ入った）。3 段に分かれる。

| 段 | 語数 | 中身 |
| --- | --- | --- |
| 実処理から出している | 19 | — |
| **見本データの中だけ** | 2 | `content.created` / `ranking_model.changed` |
| **出す場所がどこにも無い** | 7 | `connector.connected` / `connector.disconnected` / `content.corrected` / `content.unpublished` / `disclosure.changed` / `member.role_changed` / `policy_rule.changed` |

2 段目は `settings-sample-repository.ts` の中にしか無い。**画面には記録が並ぶが、
その行を作った操作は存在しない。**見本を消した時点で 0 件になる語である。

3 段目は、**機能がまだ無いもの**（`member.role_changed` は残課題 62 で
「書く側が見本のまま」、`connector.*` は ASP 接続がスタブ）と、
**機能はあるのに出していないもの**（`content.unpublished`。取り下げは
`content.state_changed` に混ざっており、`manage-content.ts:668` のコメントが
自ら「理由を受け取っていない（残課題）」と書いている）が混ざっている。

**語だけがあって出す場所が無いのは、`export.performed` と同じ形**である。
今回はそこから 1 件、実際の穴（本文を人へ渡すのに記録が無い）が出た。
残る 9 語（2 段目 + 3 段目）は残課題 74 に置き、1 語ずつ実装と突き合わせる。

#### 赤の実測

| 外した印 | 落ちた要件 |
| --- | --- |
| `feedback` の `audit-log` | REQ-FB08 / REQ-FB09 / REQ-FB12（3 件） |
| `link-inbox` と `affiliate` の `audit-log` | REQ-P02 / REQ-P09（2 件） |
| 配信まわり 4 ファイル + `manage-content` の `audit-log` | REQ-P08（1 件） |

`REQ-SEC09` だけは 1 ファイル外しても落ちない。**印を持つファイルが 4 つある**
（監査記録そのものの要件なので、当然そうなる）。落とすには 4 つとも外す必要がある。

書き出しの記録は、**呼び出しを外すと 2 件落ちる**ことを実測した。
ただし「本文は記録に入れない」の 1 件は、記録が 0 件でも通る
（空のものは本文を含まない）。**これは単独では何も証明していない検査**で、
記録がある状態を保ったまま本文が混ざるのを止める役だけを持つ。

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
**今の実装に無い**。実装が端を持てば、そのまま宣言できる。

**理由つき除外に載せる道は取らなかった。**除外は「宣言したうえで、
この種別は**書かないと決めた**」の一覧であって、`REQ-S01` はそうではない
（まだ手を付けていないだけ）。だから正しい置き場所は**未宣言の側**である。
未宣言の上限は**下げる方向にしか動かない**ので、ここに置けば必ず目に入る。
除外の上限（7）が満杯であることは、この判断の理由ではない。残課題 71 に置いた。

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

### 2026-08-18: 印を付けずに足した検査 1 本（`readonly-honesty`）

残課題 69 で `export_manual_draft` の `readOnly: true` が嘘だったと分かったあと、
「`readOnly: false` の道具が `PAGE_TOOLS` に載っていないこと」を検査で固定するよう指示を受けた。

**測ったら、その検査は既に 3 本あった。**
`tests/presentation/webmcp-policy.test.ts` の「渡す道具はすべて読み取り専用」と
「管理画面にも状態を変える道具を渡さない」、
`tests/presentation/tool-catalog-adapters.test.ts` の「WebMCP には読み取り専用だけを、上限の数まで載せる」。

**その 3 本は、今回の穴を素通りした。**旗が嘘だったからである。
**旗を読む検査は、旗が嘘のときには守りにならない。**4 本目を足しても同じことになる。

代わりに `tests/presentation/readonly-honesty.test.ts` を足した。
`readOnly` を名乗る道具を**実際に動かして**、記録の口（`auditLog.append`）へ
手が伸びないことを見る。記録を書くなら状態を変えているので、旗は事実と違う。

既存の正常系では足りない理由も書いておく。あの穴が見つかったのは記録を足したら
正常系が落ちたからだが、落ちた理由は**見本の `auditLog.append` がいつも失敗を返すスタブだから**で、
記録が書けたことを見ていたわけではない。**記録が成功するようになった日に、あの守りは消える。**
新しい検査は成否を見ないので、その日も残る。

実測は 2 つ取った。

| 測ったこと | 結果 |
|---|---|
| 何件が実際に動いたか | `readOnly` を名乗る道具 81 件が**全件 `ok`**（入力不足で素通りしていない） |
| 旗を嘘に戻すと落ちるか | `export_manual_draft` を `readOnly: true` に戻すと `export_manual_draft → export.performed` を名指しして赤 |

**`@types` は付けていない。**`@req REQ-WC04` だけである。
REQ-WC04 の必須種別（`equivalence` / `boundary`）は `webmcp-policy.test.ts` が満たしており、
ここが見ているのはそのどちらでもない。**満たしていない種別の名前を借りると、
本来その種別を持つべき検査を消しても緑になる。**
未宣言 120・除外 7 は動かない（`@req` があるので由来不明にも入らない。129 → 130）。

### 2026-08-18: 記録の語を、語の側から数える 1 本（残課題 74）

残課題 69 で `AuditAction` の 28 語を実装と突き合わせたとき、
**実処理から出しているのは 19 語**で、残り 9 語は出す場所を持っていなかった。
このとき見つかった `export.performed`（語だけあって出す場所が無い）は、
**実際に穴**だった——記事の本文を人へ丸ごと渡すのに記録が 1 件も無かった。
**語だけがあって出す場所が無いのは、機能の抜けの影である。**

`port-wiring.mjs` の 3 つの見張りは、これを 1 つも見ていない。
どれも**入口から記録へ届いているか**を見ており、**語の側から見ていない**。
語が union にあるだけで誰も出していない状態は、入口の側に不足が無いので緑のまま通る。

9 語を 1 語ずつ実装と突き合わせた結果は 2 つに分かれた。

| 分類 | 語 | どうしたか |
|---|---|---|
| 機能はあるのに出していない | `content.unpublished` | **実装した**（下） |
| 機能がまだ無い | 残り 8 語 | 数を上限で固定した |

**`content.unpublished` の実装**。`ARCHIVED` はどの段階からも行けるので、
「まだ誰も見ていない記事を没にした」と「読者が見ていた記事を取り下げた」が
`content.state_changed` の 1 語に潰れていた。`isUnpublishing`
（`src/domain/authoring/content-state.ts`）で分け、取り下げのときだけ理由を必須にした。
判定はドメインに置いた。画面側で `to === "ARCHIVED" && from === "PUBLISHED"` と
書き直すと、公開中の段階が増えた日に**画面は理由欄を出さないのに
ユースケースは理由を要求する**状態になり、理由の書きようが無い画面ができる。

**この実装が本番の不具合を 1 つ露出させた。**理由の確認を `saveState` の**後**に置いていて、
理由が空のときに**記事は先に読者から消え、記録は 1 行も残らなかった**。
自分で書いたテストが赤にして教えた（`expected 'ARCHIVED' to be 'PUBLISHED'`）。
確認を保存の前へ動かした。

**残り 8 語は実装ではなく数の固定にした。**機能そのものが無いので、
記録だけ先に足しても出す機会が来ない。
`tests/architecture/audit-action-emitters.test.ts` が `AuditAction` を型定義から読み、
`src/` を歩いて 3 分類する。

| 分類 | 数 | 上限 |
|---|---|---|
| 実処理から出している | 20 | 下限 20（下回ったら赤） |
| 見本データの中だけ | 2 | `AUDIT_ACTIONS_MAX_SAMPLE_ONLY = 2` |
| どこにも出す場所が無い | 6 | `AUDIT_ACTIONS_MAX_WITHOUT_EMITTER = 6` |

**日本語ラベルの表は数えない。**`manage-workspace.ts` に 28 語すべての訳が並んでおり、
最初に数えたときはここを拾って**全語が出している**という答えになった。
`"語": "日本語"` の形の行だけを外している。

**下限も一緒に見ているのは、上限だけだと語ごと消せば緑になるから**である。
消して減らすのは正しい直し方の 1 つだが、出していた語まで一緒に消えても気づけない。

**手で数えた表を置かなかった理由。**この数え直しは 2026-08-18 に 2 度やった。
1 度目は `action:` の直値だけを見て、引数として渡される語を取りこぼした。
**手で書いた数字は、古くなっても古く見えない。**

実測は 2 つ取った。

| 測ったこと | 結果 |
|---|---|
| いまの内訳 | 実処理 20 / 見本のみ 2（`content.created` `ranking_model.changed`）/ なし 6 |
| 語を足すと落ちるか | union に 1 語足すと `7 to be less than or equal to 6` で赤。名指しで語名も出る |

**`@types` は付けていない。**`@req REQ-SEC09` だけである。
REQ-SEC09 の必須種別（`audit-log` / `boundary` / `db-migration` / `equivalence` / `secrets`）は
既存の検査が満たしており、ここが見ているのはそのどれでもない。
`readonly-honesty` と同じ判断で、**満たしていない種別の名前を借りない**。

残る 8 語は、それぞれの機能（残課題 62 の権限変更 / ASP 接続のスタブ /
是正記録 / 開示設定）が入った時点で 1 語ずつ落とす。上限は下げる方向にしか動かさない。

### 2026-08-18: `readOnly` の 3 つの意味のうち、分けたのは 1 つ（残課題 76）

`readOnly` が兼ねていた 3 つの決定を測り直した。

| 決定 | 場所 | どうしたか |
|---|---|---|
| ① MCP の `readOnlyHint` | `mcp-adapter.ts` | そのまま（これが本来の意味） |
| ② 検査の測定対象に入るか | `tool-catalog-adapters.test.ts` | **切り離した** |
| ③ WebMCP に載る資格 | `toWebMcpDescriptors` | **分けなかった**（下） |

**まず訂正から。**残課題 69 で「`export_manual_draft` がページ内の AI に本文を渡していた」と
書いたが、**事実ではなかった。**ブラウザへ届く道は `PAGE_TOOLS`（`webmcp-policy.ts`）だけで、
`git log -S export_manual_draft -- src/presentation/tools/webmcp-policy.ts` は**空**である。
`readOnly: true` は**載る資格**を与えていたが、載せる決定は別の場所にあり、下りていなかった。
記録が 1 件も無かったことは事実で、そこは直っている。
**「載せられる状態だった」と「載っていた」は別である。**

**ただし危なさの見立てを下げるだけにしない。**「資格はあるが、載せる決定が別の場所にある」
という状態は、**決定側が 1 行変わった日に、誰の目にも触れずに載る**ということである。
その 1 行は `src/presentation/tools/webmcp-policy.ts` の `PAGE_TOOLS` に
道具の名前を 1 つ書き足すことで、**ページの表示は変わらず、diff は 1 行**である。
いま `export_manual_draft` は `readOnly: false` なので、その 1 行を書いても
`webmcp-policy.test.ts:74` が落ちる。**落ちる理由は旗が正しくなったからで、
旗が嘘に戻れば同じ 1 行が通る。**旗が嘘かどうかは
`readonly-honesty.test.ts` が実際に動かして見ている。

**③ を分けなかった理由。**載せる決定は `PAGE_TOOLS` が既に持っている。
`readOnly` はその**前提条件**として二重に効いているだけで、決定ではない。
ここに旗をもう 1 つ足しても、**人が手で書く値が 1 つ増えるだけで、決める場所は増えない。**
実際に載る資格が嘘だったときに捕まえるのは、旗を読む検査ではなく
`readonly-honesty.test.ts`（実際に動かして記録の口へ手が伸びないか見る）である。

**② には実害があった。**テナント分離の検査が `readOnly` で絞った一覧を回しており、
**書き込みの道具 25 個が丸ごと対象外**だった。
`readOnly` は MCP の注釈のために書く旗で、**「他社のデータに触れるか」とは別の問い**である。
そして**他社のデータを読めるより、書き換えられるほうが重い。**

対象を「入力の見本が作れる道具すべて」に変えた。

| 測ったこと | 前 | 後 |
|---|---|---|
| テナント分離を当てた道具 | 81 | **111** |
| そのうち**他社の身元で `ok` まで届いた**道具 | 61 | **66** |
| そのうち**分離を実際に確かめられた**道具 | — | **20** |

**増えた 30 件のぶん守りが強くなったわけではない。**この検査は `result.ok` が false なら
中身を見ずに通るので、断りの理由が「他社だから」でも「入力の見本が足りない」でも緑になる。
実際に増えたのは 5 件だけ（`save_to_shortlist` / `remove_from_shortlist` /
`start_site_draft` / `hand_off_feedback` / `create_blog_draft`）。

**件数だけを見ると強くなったように見える。**だから 2 つの下限を別々に置いた
（どちらも上限ではなく**下限**である——下げて緑にすることを禁じる向きが逆になる）。

| 下限 | 値 | 何を数えているか |
|---|---:|---|
| `TENANT_ISOLATION_MIN_REACHED` | 66 | 他社の身元で `ok` が返る件数。**分離の証明ではない** |
| `TENANT_ISOLATION_MIN_SEPARATION_PROVEN` | 20 | 持ち主で通り、他社で断られる件数。**これが守りたいもの** |

**2026-08-18 に 66 の名前を `TENANT_ISOLATION_MIN_INSPECTED` から変えた。**
「中身まで見た」と読める名前だったが、実際に数えていたのは `ok` が返ったことだけである。
`ok` が返る道は 2 通りあり、①誰でも読める情報を返した ②他社なので絞り込みで 0 件になり、
空の結果を `ok` として返した——のどちらも同じ 66 に入る。例えば `hand_off_feedback` は
他社の身元で `ok` を返すが、中身は 0 件である（`findById(actor.workspaceId, id)` で弾かれる）。
**分離は効いているが、効いていることを `ok` という値は証明していない。**

**安く動くほうを下限にしない。**66 は 111 件中 66 件と大きく見えるが、
そのうち分離を実際に示しているのは 20 件である。

実測は 2 つ。

| 測ったこと | 結果 |
|---|---|
| 赤になるか | 他社の識別子を自社に戻すと 8 件が名指しで落ちる。うち 2 件（`validate_content_variant` / `research_product`）は**今回増えた書き込みの道具** |
| 件数 | 462 件 通過（前 461 件。2026-08-18 に下限を 2 つへ分けたため 1 件増） |
| 20 の下限が効くか | 21 に上げると `expected 20 to be greater than or equal to 21` で落ちる（実測値はちょうど 20） |

**残したもの**: 正常系のほうはまだ `readOnly` 由来である。書き込み 28 個のうち
見本の入力で `ok` を返すのは 4 個しかなく、広げるには `tool-inputs.ts` の見本を
足す必要がある。残課題 77 として切った。**それをやると下限 20 が上がる。**

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

### 2026-08-19 に減らしたぶん（120 → 109）: 記事の品質 11 件（REQ-QC01〜QC11）

QC-01〜QC-17 の品質検査である。除外は **1 件も増やしていない（7 件のまま）**。

**足す前に数えた。**`quality-check.ts` と `author-persona.ts` を読んでから性質を決めた。
読んだ結果、印を貼る前に直すべきものが 1 つ見つかった。

#### 見つけたこと: 一覧で決めている検査が、一覧の 1 行だけで試されていた

品質検査のうち 5 つは、正規表現や語の**一覧**が中身そのものである。

| 一覧 | 行数 | 貼る前に試されていた行 |
| --- | --- | --- |
| `EXAGGERATION_PATTERNS`（誇大表現） | 8 | 1 |
| `VAGUE_HEADING_PATTERNS`（結論の分からない見出し） | 8 | 1 |
| `RELATIVE_DATE_PATTERNS`（相対的な日付） | 11 | 1 |
| `MEASURE_WORDS`（単位を付ける語） | 13 | 1 |
| `FIRSTHAND_EXPERIENCE_PATTERNS`（一人称の体験） | 6 | 1 |

1 行だけ試すと、次の 3 つがどれも緑のまま通る。
**一覧から語を消す** / **足した正規表現が何にも当たらない** / **書き換えて別のものを指す**。
`domain-events.test.ts` で直したのと同じ形（16 件のうち 1 件だけを試していた）である。

そこで `tests/domain/quality-check-tables.test.ts` を書いた（41 件）。
一覧の**全行**に例を当て、**当たってはならない側**も 1 つずつ持たせている。

書くときに決めたことが 2 つある。

- **期待する側の数は、一覧から作らない。** 一覧を回して当てるだけだと、
  一覧から語を消したときに**輪が縮むだけで緑になる**。例の数と一覧の数を突き合わせ、
  `MEASURE_WORDS` は 13 語を手で書き写して `toEqual` で比べている。
  **消えたことが緑として現れないようにする**ためである
- **例文から一覧を作らない。** `FIRSTHAND_EXPERIENCE_PATTERNS` は
  `checkFactBoundary()` を直に呼び、返ってくる `pattern`（当たった正規表現そのもの）で
  行ごとに突き合わせる。当たらない行が 1 つでもあれば、その行の字面を出して落ちる

#### 赤の実測（検査の側）

一覧から 1 行ずつ消す・正規表現を当たらない形に書き換える、の 6 通りを実際に入れた。
**10 件が落ちた。**

    EXAGGERATION_PATTERNS から「最安」を消す   → 例の数が合わない + 「最安」は止まる
    VAGUE_HEADING_PATTERNS から「その他」を消す → 例の数が合わない + 「その他」は知らせる
    RELATIVE_DATE_PATTERNS から「今週」を消す   → 例の数が合わない + 「今週」は知らせる
    MEASURE_WORDS から「奥行」を消す            → 13 語と一致しない + 単位の無い数字が止まる
    ^.{1,12}とは$ を ^.{1,12}ときは$ へ書き換え → 「HDRとは」は知らせる
    /体感で/ を /体感でででで/ へ書き換え        → どれかの例文で実際に止まる

#### 性質の当て方

線引きは既存どおり「**端があるか**」の 1 点。ただし
**REQ-QC02 と REQ-QC06 の 2 件だけ、両方の性質を宣言した**。
この 2 件は仕様の側で 3 つの検査を束ねており（QC-02〜QC-04 / QC-08〜QC-10）、
束の中に**端のあるもの**（1 文 80 文字 / 冒頭と最終の結論の近さ 0.3）と
**列挙**（見出し 8 種 / 単位を付ける語 13 語 / 相対的な日付 11 種）が同居している。
片方だけを名乗ると、もう片方が誰にも見られないまま残る。
**緩めたのではなく、`equivalence` `boundary` `decision-table` の 3 つとも必須になる、
より強い側へ倒した**。「両方を名乗る要件は無い」と書いていたのは、
1 つの入力軸について両方を名乗るなという意味で、束ねられた要件の話ではない。

1 列目を要件 ID にしていないのは上の節と同じ理由である。

| 要件 | 内容 | 性質 | 印を付けた先 | そこにある分かれ目 |
| --- | --- | --- | --- | --- |
| QC01 | 必須セクションの存在 | has-enumerated-input | `writing-rules` | 記事の型を総当たりし、広告表記・デメリット・出典・訂正報告が任意になっていないこと |
| QC02 | 段落・文長・見出し | has-input, has-enumerated-input | `invariants` ＋ `quality-check-tables` | 3 文まで / 4 文、80 文字まで / 81 文字、見出し 8 種の全行 |
| QC03 | 禁止表現 | has-enumerated-input | `quality-check-tables` | 誇大表現 8 種の全行と、当たってはならない文 |
| QC04 | 事実分類の付与 | has-enumerated-input | `fact-source` | 6 種の分類ごとに、表示名・語調のきまり・画面の文言がそろっていること |
| QC05 | 根拠のない主張 | has-input | `invariants` ＋ `boundaries` | 数値があるのに主張が無い / 主張があるのに出典が無い、有効期間の端 |
| QC06 | 単位・結論一致・日付 | has-input, has-enumerated-input | `invariants` ＋ `quality-check-tables` | 近さ 0.3 ちょうど / その手前、単位を付ける 13 語、相対的な日付 11 種 |
| QC07 | ペルソナ差分の事実境界 | has-enumerated-input | `quality-check-tables` | 一人称の言い回し 6 行の全行、検証記録があれば全部通ること |
| QC08 | マルチサイト重複 | has-input | `invariants` ＋ `writing-rules` | 重なり率 0.85 ちょうど / その手前、違う軸が 2 つ / 3 つ |
| QC09 | 広告表記 | has-enumerated-input | `invariants` ＋ `publish-gate.property` | リンクがあって表記が空、本文内表記を要求する媒体での有無 |
| QC10 | 会話ブロック制約 | has-input | `writing-rules` | 40 文字ちょうど / 39、120 / 121、2 個続く / 3 個 |
| QC11 | 薬機法・景表法 | has-enumerated-input | `policy-rule-seed` | 初期ルール 13 件の全行に「当たる文」と「当たってはならない文」 |

#### 印を貼るために新しく書いた検査（`quality-check-tables` のほかに 8 件）

宣言に必要な `boundary` が、**実在しなかった**ものがある。
既にあった検査は上限を超えたことしか見ておらず、**通る側の端を持っていなかった**。

さらに悪い形が `conversation-block` にあった。**上限を定数から組み立てた入力**である。

    text: "あ".repeat(CONVERSATION_MAX_LENGTH + 1)   // 必ず 1 文字超える

この書き方は、定数を 120 から 1200 にしても**同じ側に居続ける**。
赤くならないのに、テストの名前だけが「長すぎる」と古い主張を続ける。
足した 8 件では**定数を輸入せず、数字を手で書いた**（39 / 40 / 120 / 121 のように）。
値を変えるときに 2 か所直させるのが目的である。

- `invariants` に 5 件（3 文 / 80 文字 / 行動を促す文 3 箇所の端、重なり率 0.85、結論の近さ 0.3）
- `writing-rules` に 3 件（40・120 文字の端、吹き出し 2 個 / 3 個、違う軸 2 つ / 3 つ）

**赤の実測**: 上限を緩める向きに動かすと落ちる。
`MAX_SENTENCE_LENGTH` 80→100 / `MAX_SENTENCES_PER_PARAGRAPH` 3→4 /
`MAX_CTA_OCCURRENCES` 3→4 / `0.85`→`0.9` / `0.3`→`0.2` で **6 件**、
`CONVERSATION_MIN_LENGTH` 40→30 / `CONVERSATION_MAX_LENGTH` 120→200 /
`MAX_CONSECUTIVE_BLOCKS` 2→3 / `MIN_DIFFERENT_AXES` 3→2 で **4 件**が落ちた。
このとき**既存の「長すぎる発言も作れない」は緑のまま**で、
定数から組み立てた入力が上限を見ていないことが実測で出た。

#### 印を外したときの赤（1 ファイルずつ）

    invariants から外す            → REQ-QC02 / REQ-QC06: boundary
                                     REQ-QC05 / REQ-QC09: equivalence
    writing-rules から外す         → REQ-QC01: decision-table, equivalence
                                     REQ-QC10: boundary, equivalence
    quality-check-tables から外す  → REQ-QC02 / REQ-QC06: decision-table
                                     REQ-QC03 / REQ-QC07: decision-table, equivalence
    fact-source から外す           → REQ-QC04: decision-table, equivalence
    policy-rule-seed から外す      → REQ-QC11: decision-table, equivalence

#### この検査が名指しできない残り（正直に書く）

**REQ-QC05 と REQ-QC08 は、印を 1 つ外しても赤にならない。**
どちらも 2 つのファイルに分かれて置いてあり、片方だけで必須種別がそろうためである
（QC05 は `invariants` が `equivalence` と `boundary` の両方を名乗り、
QC08 は `invariants` と `writing-rules` がどちらも両方を名乗る）。
印は**ファイル単位で種別を名乗る**仕組みなので、
「この要件は 2 つのファイルの両方が要る」を表す書き方が無い。

嘘の緑ではない（分かれ目は 2 か所とも実在する）が、
**片方を消したときに、この検査は何も言わない**。
そこが消えたときに赤くするのは vitest 側で、
上に書いた 8 件（0.85 / 0.3 / 3 軸 / 40・120 文字）がその役をしている。

### 2026-08-19 に減らしたぶん（109 → 100）: 書き方の決めごと 9 件

対象は `REQ-W01`〜`REQ-W05` / `REQ-W07` / `REQ-W09` / `REQ-W10` / `REQ-W12`。
`REQ-W06` / `REQ-W08` / `REQ-W11` は**宣言していない**（理由は後述）。

#### 足す前に数えた（ここでも一覧が 1 行だけ試されていた）

記事の型は 5 つあり、型ごとに足す節が `ARTICLE_TYPE_SECTIONS` にある。
節の数と、名指しされていた数を数えた。

| 記事の型 | 型が足す節 | 名指しされていた節 | 見ていた場所 |
| --- | ---: | ---: | --- |
| 順位をつける記事 | 6 | 3 | `tests/application/writing-method.test.ts` |
| 1 つを詳しく見る記事 | 4 | **0** | 無し |
| 2 つ以上を比べる記事 | 2 | **0** | 無し |
| やり方を説明する記事 | 8 | 3 | `tests/application/writing-method.test.ts` |
| 計算・判定の道具のページ | 2 | **0** | 無し |
| 合計 | **22** | **6** | |

`tests/domain/writing-rules.test.ts` の「どの型でも、広告表記・デメリット・出典・
訂正報告は欠かせない」は 5 つの型を回しているが、当てているのは**共通の骨格の 4 節**で、
型固有の節は 1 つも見ていない。5 つ回っているので**総当たりに見えるが、
消えたときに赤くなるのは共通側だけ**である。

要件表は `REQ-W02`〜`REQ-W04` の判定欄に「PASS（同上・型ごとの必須節）」と書いてあった。
これは**書いた時点でも事実ではなかった**（W03 / W04 を見る検査は無かった）。
実測で置き換えてある。

#### 実測（既存の検査は消しても緑だった）

`src/domain/authoring/article-structure.ts` を 3 通りに壊し、
既存の `writing-rules` + `writing-method`（33 件）だけを走らせた。

| 壊し方 | 既存 33 件 | 新しい 16 件 |
| --- | --- | --- |
| 1 つを詳しく見る記事から「検証条件」を消す | **33 件すべて緑** | 3 件が赤 |
| 比べる記事から「差分表」を消す | **33 件すべて緑** | 4 件が赤 |
| 道具のページから「計算・判定の根拠」を消す | **33 件すべて緑** | 2 件が赤 |

新しく書いたのは `tests/domain/article-type-sections.test.ts`（16 件）。
さらに 4 通りで赤を確かめた。

| 壊し方 | 結果 |
| --- | --- |
| 順位の記事の「各商品カード」を推奨どまりへ格下げ | 2 件が赤 |
| やり方の記事の「全手順」のラベルを変える | 1 件が赤 |
| 追加節の差し込み位置を本文の後ろへ | 1 件が赤 |
| 表を直さずに節を 1 つ足す | 2 件が赤 |

最後の 1 行が、この検査を書いた理由そのものである。
期待値を `ARTICLE_TYPE_SECTIONS` から作ると、**節を消しても繰り返しが 1 周
短くなるだけで緑のまま**になる。22 個は手で書き写してあり、合計の 22 も
実装から数えていない。

#### 性質の割り当て

| 要件 | 性質 | 名乗るファイル |
| --- | --- | --- |
| REQ-W01（共通 25 節） | has-enumerated-input | `tests/domain/writing-rules.test.ts` |
| REQ-W02〜W05（型ごとの節） | has-enumerated-input | `tests/domain/article-type-sections.test.ts` |
| REQ-W07（事実 6 分類） | has-enumerated-input | `tests/ui/fact-source.test.ts` |
| REQ-W09（会話 40〜120 字・連続 2） | has-input | `tests/domain/writing-rules.test.ts` |
| REQ-W10（10 軸・3 軸以上・0.85） | has-input | `tests/domain/writing-rules.test.ts` |
| REQ-W12（ペルソナの事実境界 6 型） | has-enumerated-input | `tests/domain/quality-check-tables.test.ts` |

W09 と W10 だけ `has-input` にしてあるのは、**端があるから**である
（40 / 120 文字、連続 2 回、3 軸、似ている度 0.85）。
他の 7 件は端の無い一覧なので `has-enumerated-input`。

印を 1 つずつ外して赤を確かめた。9 件すべて、名指しするファイルは 1 つだけである
（借りた名前は無い）。

```
article-type-sections から外す → REQ-W02〜W05: decision-table, equivalence
writing-rules から外す         → REQ-W01: decision-table, equivalence
                                 REQ-W09 / REQ-W10: boundary, equivalence
fact-source から外す           → REQ-W07: decision-table, equivalence
quality-check-tables から外す  → REQ-W12: decision-table, equivalence
```

#### 宣言しなかった 3 件（実装が境界を持てば宣言できる）

`REQ-W06` / `REQ-W08` / `REQ-W11` は未宣言のまま残した。
**除外の枠（7/7）へは回していない。**枠が満杯だからではなく、
除外は「その性質が要らない理由」を書く場所であって、
ここは性質が要るのに検査がまだ無いだけだからである。

| 要件 | 一覧の件数 | いま当たっている範囲 |
| --- | ---: | --- |
| REQ-W06 段落の並べ方 `PARAGRAPH_ORDER` | 7 段 | 先頭「結論」と末尾「次の行動」の 2 つだけ。間の 5 段は入れ替えても緑 |
| REQ-W08 文体の決まり `STYLE_RULES` | 9 件 | 「理由が空でない」の総当たりのみ。決まり自体を消しても、9 という数も内容も誰も見ていない |
| REQ-W11 節ごとの雛形 `OPENING_PATTERNS` | 型ごと | **テストからの参照が 1 つも無い**。`SectionSpec.purpose` の「空でない」だけが当たっている |

3 件とも、要件が求めているのは「一覧の中身が決まりどおりか」である。
いま在るのは「一覧が空でないか」で、**中身が入れ替わっても気づけない**。
W02〜W05 と同じ形の検査（期待値を手で書き写した表）を書けば宣言できる。
書く前に宣言すると、`decision-table` という名前だけが付いて、
本来その名前が守るはずの検査を消しても緑になる。

### 2026-08-19 に減らしたぶん（100 → 95）: 計測 5 件

対象は `REQ-TM01` / `TM04` / `TM07` / `TM08` / `TM09`。

#### 足す前に数えた（消えていたイベントが 2 件あった）

計測イベントは 12 件。**テストのどこかに名前が出てくるか**を数えた。

| イベント | テストに出るか |
| --- | --- |
| page_view / scroll_depth / affiliate_click / page_exit | 出る（複数の場所） |
| section_dwell / element_click / ranking_row_click / internal_link_click | 出る（1 か所） |
| ai_model_usage / variant_exposure | 出る（1 か所） |
| **search_performed** | **どこにも出ない** |
| **filter_changed** | **どこにも出ない** |

`REQ-TM04` は「検索と絞り込み」を明示して求めている要件である。
表からこの 2 件を丸ごと消して全部走らせたところ、**3810 件すべてが緑**だった（実測）。

禁止語（記録してはいけない項目）は 17 語。実際に送って落ちることを
確かめてあったのは **3 語**（`ip` / `email` / `prompt`）、
宣言の段階で見ていたのは 7 語。**残り 10 語は消しても誰も気づかない**。

組み立て（`buildTelemetryEvent`）を実際に通していたイベントも
12 件中 3 件（`page_view` / `scroll_depth` / `affiliate_click`）だけだった。

#### 実測

新しく書いたのは `tests/domain/telemetry-tables.test.ts`（65 件）。

| 壊し方 | 新しい 65 件 |
| --- | --- |
| 検索と絞り込みのイベントを消す（3810 件が緑だった壊し方） | 6 件が赤 |
| 禁止語を 3 つ消す | 4 件が赤 |
| `page_view` の参照元を任意へ緩める | 1 件が赤 |
| 節ごとの滞在を同意なしで測れるようにする | 1 件が赤 |
| 禁止語の判定を完全一致から前方一致へ | 1 件が赤 |

4 行目が `REQ-TM07` の要点である。**同意なしで測れるものが 1 つ増える**のは
断った読者から取れるものが 1 つ増えることなので、増える側を名指しで固定した
（「同意が要らないイベントは、この 4 つだけ」）。既存の
「同意が要るイベントの判定が 1 箇所に揃っている」は期待値に
`requiresConsent()` を使っており、**実装を実装で確かめている**ので増えても緑になる。

5 行目は逆向きの端である。何でも落とすようにすると `bodyLength` のような
真っ当な欄まで送れなくなり、禁止の一覧が使えなくなる。

#### 保存期間の端を、定数から作らない形に置き直した

既存の「期限を過ぎたものは期限切れと判定される」は `retentionDeadline()` から端を
作っているので、**90 日を 9000 日に変えても同じ側に居続ける**。
`CONVERSATION_MAX_LENGTH + 1` と同じ形である。
90 と 400 を実数で書いた端（ちょうど / 1 ミリ秒手前 / 89 日目）を足した。
既存のほうは消していない（別のことを見ているため）。

#### 性質の割り当て

| 要件 | 性質 | 名乗るファイル |
| --- | --- | --- |
| REQ-TM01（イベントの表 12 件） | has-enumerated-input | `telemetry-tables.test.ts` |
| REQ-TM04（読者の行動計測 10 種） | has-enumerated-input | 同上 |
| REQ-TM07（同意管理） | has-enumerated-input | 同上 |
| REQ-TM09（仮名化・保存期間・削除） | has-enumerated-input, has-input, has-tenant | 同上 |
| REQ-TM08（DNT / GPC の順番） | has-enumerated-input | `telemetry.test.ts` |

`REQ-TM09` だけ 3 つ名乗る。禁止語 17 は端の無い一覧（`has-enumerated-input`）、
保存期間は端がある（`has-input`）、目印はブログをまたがない（`has-tenant`）。
**3 つとも当てどころが実在する**ので、まとめて 1 つに寄せない。

印を 1 つずつ外して赤を確かめた。5 件すべて、名指しするファイルは 1 つだけである。

```
telemetry-tables から外す → REQ-TM01 / TM04 / TM07: decision-table, equivalence
                            REQ-TM09: boundary, decision-table, equivalence, tenant-isolation
telemetry から外す        → REQ-TM08: decision-table, equivalence
```

#### 要件表の判定欄に嘘が 1 件あった

`REQ-TM04` の判定欄は「PASS（`telemetry.test.ts`「同意が無くても、回数だけの
イベントは記録できる」ほか）」だった。**挙げられている検査は同意の話で、
読者の行動計測 10 種を見ていない。**しかも 2 件は表から消しても緑だった。
実測へ置き換え、いつまでそうだったかも欄に残してある。
`REQ-TM01` と `REQ-TM09` は嘘ではなかったが、代表 1 件ずつしか見ていないことが
分かる書き方へ直した（`W` 群の `REQ-W02`〜`W04` に続いて 2 例目）。

#### この回で宣言していない TM（8 件）

`REQ-TM02` / `TM03` / `TM05` / `TM06` / `TM10` / `TM11` / `TM12` / `TM13`。
画面（`/admin/ai-usage`）を持つもの、送り方の端（15 秒 / 20 件 / 32KB / 50 件）を
持つもの、保存先（`telemetry_events`）を持つものが混ざっており、
それぞれ別の性質を当てる必要がある。**まとめて名乗ると、いちばん軽い検査で
いちばん重い性質の名前が付く。**次の区切りで 1 つずつ数えてから宣言する。

### 2026-08-19 に減らしたぶん（95 → 83）: エンティティ 12 件

対象は `REQ-E02` / `E05` / `E09` / `E10` / `E11` / `E13` / `E15` / `E22` / `E23` /
`E24` / `E26` / `E30`。

#### 足す前に数えた（断る側だけが確かめられていなかった）

`src/domain` にある「作る関数」39 個について、**テストから直接呼ばれているか**を数えた。
呼ばれていないものが 4 つあった。

| エンティティ | 直接呼ぶテスト | どこから呼ばれていたか |
| --- | --- | --- |
| **E09** ChannelConnection | **0 件** | `distribution-sample-repository.ts` が正しい値で 1 回 |
| **E10** AffiliateAccount | **0 件** | `affiliate-sample-repository.ts` が正しい値で 1 回 |
| **E11** AffiliateProgram | **0 件** | 同上 |
| **E15** Product | **0 件** | `product-sample-repository.ts` が正しい値で 1 回 |

4 つとも要件表の結果欄は「実装済」である。**嘘ではない。実装はある。**
ただし通っていた道は正常系だけで、断る側は一度も通っていなかった。

確かめた: この 4 つの中の断り 11 か所を `if (false)` に変えて全部走らせたところ、
**3875 件すべてが緑**だった。同じ 11 か所に対して、新しく書いた
`tests/domain/entity-guards.test.ts`（35 件）は **21 件が赤**になる。

これは W 群・TM 群で見つけた形とも違う。W は「回している数と当てている中身が別」、
TM は「一覧の端まで当たっていない」。ここは**入口が 1 つしかなく、そこを通る値が
いつも正しい**。使われていることが、確かめられていることに見えていた。

#### `has-input` を名乗るために端を足した

既にあった `tests/domain/entity-invariants.test.ts`（26 件）は等価分割だけで、
**端を 1 つも見ていなかった**。期間は 9/15 と 10/2、件数は 120 と 700、
期限は 8/1 と 8/17——どれも端から離れた 2 点である。
`has-input` は等価分割と境界値の両方を求めるので、名前だけ借りることはできない。
端を足して 57 件にした。

| 壊し方 | 赤 |
| --- | --- |
| キャンペーン: 終わりの端を 1 つずらす（`>=` → `>`） | 1 件 |
| 実験: 必要件数を 1 件甘くする | 1 件 |
| 素材: 許諾の期限ちょうどを使える側へ倒す（`>` → `>=`） | 1 件 |
| ブログ: 終了したものも公開できるようにする | 2 件 |
| 企画: 分野の判定を「文字列なら何でも通す」に緩める | 6 件 |
| 実験: 開始の状態の門を外す | 2 件 |

上 3 つは、端を足す前は**すべて緑のまま通っていた**壊し方である。

日付・件数・文字数は実数で書いている。`campaign.endsAt` や
`experiment.minimumSamples` から作ると、値が動いても同じ側に居続ける
（`CONVERSATION_MAX_LENGTH + 1` と同じ形。`TM` 群の保存期間でも同じ直しをした）。

#### 性質の割り当て

| 要件 | 性質 | 名乗るファイル |
| --- | --- | --- |
| REQ-E02 User | has-secret | `entity-invariants.test.ts` |
| REQ-E05 Site | has-state | 同上 |
| REQ-E22 Campaign | has-input | 同上 |
| REQ-E24 MasterBrief | has-input | 同上 |
| REQ-E26 Asset | has-input | 同上 |
| REQ-E30 Experiment | has-input, has-state | 同上 |
| REQ-E09 ChannelConnection | has-secret | `entity-guards.test.ts` |
| REQ-E10 AffiliateAccount | has-input, has-secret | 同上 |
| REQ-E11 AffiliateProgram | has-input | 同上 |
| REQ-E15 Product | has-input | 同上 |
| REQ-E23 ContentPackage | has-enumerated-input | `planning.test.ts` |
| REQ-E13 TrackingLink | has-input, has-state, has-user-supplied-url | 4 ファイル（下記） |

`REQ-E13` に `has-user-supplied-url` を当てたのは、
`quality-gates.config.mjs` の `has-user-supplied-url` のところに
**「まだ宣言表に無いが、宣言するときに当たるのが REQ-E13」と先に書いてあった**からである。
転送先は保存値だが、その保存値のもとは利用者が出した URL なので、行き先を利用者が決められる。
`ssrf` は `tests/presentation/go-route.test.ts` が持っている。

印を 1 つずつ外して赤を確かめた。`E13` 以外は名乗るファイルが 1 つだけである。

```
entity-guards から外す     → REQ-E09: secrets
                              REQ-E10: boundary, equivalence, secrets
                              REQ-E11 / E15: boundary, equivalence
entity-invariants から外す → REQ-E02: secrets / REQ-E05: state-transition
                              REQ-E22 / E24 / E26: boundary, equivalence
                              REQ-E30: boundary, equivalence, state-transition
planning から外す          → REQ-E23: decision-table, equivalence
go-route から外す          → REQ-E13: ssrf
```

`E13` だけは `redirect-resolution.test.ts` を外しても緑のままである。
`article-tracking.test.ts` が同じ種別を別の角度から持っているためで、
**1 つの要件を複数のファイルが支えている数少ない例**である。ここは弱点ではない。

#### 判定欄に嘘は無かった（4 件は書き方を強くした）

`E02` / `E05` / `E13` / `E22` / `E23` / `E24` / `E26` / `E30` の実装欄は
「〜をテストで固定」と書いてあり、**8 件とも実在した**。W 群・TM 群と違って、
この群では書いてあることと実物がずれていない。

代わりに `E09` / `E10` / `E11` / `E15` の結果欄（「実装済」）へ、
**直接呼ぶテストが 1 つも無かったこと**と、今回当てた端を書き足した。
「実装済」は嘘ではないが、それだけでは**断る側が空いていること**が読み取れない。

### 2026-08-19 に減らしたぶん（83 → 79）: テスト戦略 4 件

対象は `REQ-TS04` / `TS05` / `TS07` / `TS08`。10 件のうち 4 件しか宣言していない。
**この群は「残り 6 件を宣言しない」ことのほうが結論である。**

#### 宣言した 4 件

| 要件 | 性質 | 名乗るファイル |
| --- | --- | --- |
| REQ-TS04 入口 3 種への総当たり | has-permission, has-tenant, has-enumerated-input | `tool-catalog-adapters.test.ts` / `entry-points.test.ts` |
| REQ-TS05 画面の単体テスト | has-screen | `page-render.test.tsx` / `keyboard-operation.test.tsx` |
| REQ-TS07 実際の D1 とマイグレーション | has-db-table | `d1-link-inbox.test.ts` |
| REQ-TS08 境界値・異常系 | has-input | `boundaries.test.ts` / `boundaries-platform.test.ts` |

印を 1 つずつ外して赤を確かめた（7 通りのうち 6 通りが赤）。

```
tool-catalog-adapters から外す → REQ-TS04: tenant-isolation
entry-points から外す          → REQ-TS04: decision-table, equivalence, permission-matrix
page-render から外す           → REQ-TS05: a11y, screen-states
keyboard-operation から外す    → REQ-TS05: keyboard
d1-link-inbox から外す         → REQ-TS07: db-migration
boundaries-platform から外す   → REQ-TS08: equivalence
boundaries から外す            → 緑のまま
```

最後の 1 つが緑なのは、`boundaries-platform.test.ts` が `boundary` を別に持っているため。
`REQ-E13` と同じ「1 つの要件を複数のファイルが支えている」形で、弱点ではない。

#### 宣言しなかった 6 件と、その理由

| 要件 | なぜ宣言しないか |
| --- | --- |
| `TS01` 土台を 1 箇所に集める | 土台そのものには入力の端も状態も無い。**性質が無い** |
| `TS02` 業務の決まりごとの単体テスト | 「`tests/domain/` が存在すること」を言うメタ要件。性質を持つのは個々の業務要件の側で、そちらは既に宣言済み |
| `TS03` 手順の単体テスト | 同上。「外側をテストダブルに差し替える」は**差し替えの要求**であって障害注入ではない。`has-external` を借りると `fault-injection` を名乗ることになる |
| `TS06` 読み上げ検査とコントラスト | 実体は `a11y` とコントラストの総当たりだが、`a11y` だけを求める性質が語彙に無い。`has-screen` を借りると `screen-states` と `keyboard` まで名乗ることになり、この要件が求めていないものを名乗る |
| `TS09` 契約検査 | 種別 `contract` はどの性質にも束ねていない（意図的）。`has-runtime-config` を借りると `infra-config` を名乗るが、`TS09` が見ているのは設定ではなく構造 |
| `TS10` カバレッジを層別に測る | `has-calculation` は `mutation` を求め、`mutation` は要件表の実装欄が `src/domain` / `src/application` を指すかで決まる。`TS10` の実装は `vitest.config.mts` と `scripts/` なので**満たしようがない** |

**性質が無いものに、性質の名前を借りない。** 借りると、本来その性質を持つべき検査を
消しても緑になる。`TS06` と `TS09` は「当てどころはあるが、語彙の側に対応する性質が無い」
形で、**除外の枠（7/7、満杯）へ回すのではなく未宣言のまま残す**のが正しい。
除外の枠が空いても、この 2 件は書けない。**語彙に `a11y` 単独・`contract` 単独の
性質が増えれば宣言できる。**

#### 判定欄に嘘があった（1 件）

**`TS01` の「土台自身は `tests/architecture/` の契約検査で『各テストが自前で
組み立てていないこと』を見る」——この検査は存在しない。**

`tests/architecture/` の 15 ファイルの `describe` を全部読んで確かめた。
あるのは依存方向・Editorial/Commercial の遮断・鍵の漏れ・生成された文書であることの保証・閾値の一元化・
入口の一覧・Server Action・テストの誠実さ（空のテスト・`.skip`・`.only`）・
仕様の鮮度・1 概念 1 定義・秘密の値・Worker の配線・保存先の作業場所であり、
**「テストが `tests/support/` を通しているか」を見るものは 1 つも無い。**

これは残課題 80 の分類でいうと `REQ-W03` / `W04` と同じ**「検査が存在しない」**側である
（`REQ-TM04` の「検査はあるが別のことを見ていた」ではない）。
`test-honesty.test.ts` は名前が近いので当たっていそうに見えるが、
見ているのは**テストが何かを確かめているか**であって、
**何を使って組み立てたか**ではない。

同じ欄の後半（「型に項目を 1 つ足したときの書き換えが 1 箇所に閉じることを実測済み」）は
実測の記録であって検査ではない。**実測は 1 度きりで、次に崩れたときに知らせない。**

#### 手で書いた件数が 2 つとも古かった

| 要件 | 判定欄の数字 | 実測（2026-08-19） |
| --- | --- | --- |
| `TS04` | 368 件 | **463 件** |
| `TS08` | 121 件 | **122 件**（64 + 58） |

どちらも「増えている」ので害は小さいが、**手で書いた数字は古くなっても古く見えない**
（残課題 78 の族）。判定欄を実測へ置き換えた。

#### この回で宣言していない E（20 件）

`E01` / `E03` / `E04` / `E06` / `E07` / `E08` / `E12` / `E14` / `E16`〜`E21` /
`E25` / `E27` / `E28` / `E29` / `E31` / `E32`。
断りを持つものと、型だけで不変条件を持たないものが混ざっている。
**性質が当てられないもの（型に境界が無いもの）は、除外へ回さず未宣言のまま残す。**
除外の枠（7/7）が満杯だからではなく、**実装が境界を持てば宣言できる**からである。

### 2026-08-19 に減らしたぶん（79 → 68）: 改善ループ 11 件

対象は `REQ-IM01`〜`IM04` と `REQ-IM06`〜`IM12`。
**この回で出たのは、前の 4 回とは別の形である。**

#### 期待値を実装から作ると、実装が動いても検査は追従して緑のまま

改善ループの検査は「一覧を回す」形で書かれていた。たとえば
「調整してはいけないものは、どれも軸にできない」は `NON_OPTIMIZABLE` を回し、
各行が `assertRegistrable` に断られることを見る。**断る側の判定
（`NON_OPTIMIZABLE_KEYS`）も同じ一覧から作られている。**
だから一覧から 1 件消えると、残りを回して残りぶん確かめ、緑のまま通る。

宣言する前に、一覧の 37 項目を 1 件ずつ書き換えて（消さず、識別子を
`_MUT` 付きに変えて長さを保ったまま）測った。対象は
`tests/domain tests/property tests/presentation tests/application`（2562 件）。

| 一覧 | 件数 | 書き換えて緑だったもの |
| --- | ---: | --- |
| 調整してはいけないもの `NON_OPTIMIZABLE` | 6 | **6 件すべて** |
| 外せない約束 `UNIVERSAL_GUARDRAILS` | 5 | **5 件すべて** |
| 改善の軸 `OPTIMIZATION_DIMENSIONS` | 20 | 17 件（赤は `section_order` / `lead_length` / `brand_theme` の 3 件） |
| ループの種類 `LOOP_KINDS` | 6 | 4 件（赤は動いている 2 件だけ） |

**37 通りのうち 32 通りが緑だった。**

中でも重いのは調整禁止の 6 件である。そこから「広告であることの表示」を外すと
**それを A/B 試験の軸にできるようになる**（景品表示法のステマ告示に関わる）。
決まりが消えたのに、試験は残り 5 件を回して 5 件とも禁止を確かめ、緑を返す。
**消えたことは緑として現れる**の、これまでで最も直接的な例である。

塞ぎ方は 1 つで、**期待値を実装から作らず、テストの側に書く**。
`tests/domain/improvement.test.ts` の describe「一覧の中身そのもの
（実装から期待値を作らない）」に、4 つの一覧を文字列で置いた。
`tests/architecture/generated-docs.test.ts` の `STAMPED` と同じ形である。
塞いだあと同じ 37 通りを測り直して、**37/37 が赤**になることを確かめた。

#### `fc.pre` で外した側は、外したぶんだけ別に見る

同じ回に、総当たり（`fast-check`）の前提で除いた側の穴も出た。
`tests/property/variant-spec.property.test.ts`「承認できるのは 1 回だけ」は
`fc.pre(who.trim() !== "")` で空白の承認者を外している。外した先を誰も
見ていなかったので、`approveVariantSpec` の空白チェックを**丸ごと消しても緑**だった
（実測）。二重承認のほうは同じ試験が見ており、消すと赤になる。
「承認した人の名前が空なら承認できない」を足して塞いだ。

#### 判定欄の嘘（4 例目・5 例目）

`REQ-IM10` は行の 4 か所すべてが古かった。要件文「実装するのは 1 種類だけ」／
実装欄「`LOOP_KINDS` 5種。動くのは…1 種のみ」／結果欄「動くのは 1 種類。
残り 4 種類は形だけ」／test 欄が引用するテスト名「いま動くのは 1 種類だけ」。
実測は **6 種・`implemented` は 2 件**（`content_improvement` /
`product_improvement`）で、テストの名前も「いま動くのは 2 種類だけ」に変わっていた。
**引用符で写したテスト名は、その名前ではもう存在しなかった。**
名前を写す形の判定欄は、写した先が変わったことを教えてくれない。

`REQ-IM12` は形が違う。引用されたテストは実在し、いまも緑である。
だが上に書いたとおり、それは**一覧が欠けていないことを何も言っていない**。
`REQ-TM04` 型（検査はあるが別のことを見ている）だが、
「別のこと」の中身が「実装から作った期待値」である点が新しい。

#### この回で宣言していない IM（1 件）

`REQ-IM13`（`variant_specs` / `loop_runs` / `loop_observations` の保存先）。
見本データだけでテーブルが存在しないため、`db-migration` の当てどころが無い。
除外へ回さず未宣言のまま残す。**テーブルができれば宣言できる。**

### 2026-08-19 に減らしたぶん（68 → 49）: データモデル 19 件

対象は `REQ-E01, E03, E04, E06, E07, E08, E12, E14, E17, E18, E19, E20, E21,
E25, E27, E28, E29, E31, E32`。

#### 壊して測った: 断る場所 76 か所のうち 11 か所は、消しても緑だった

宣言する前に、`src/domain` の 18 ファイルにある**断る場所（`if` で
`Result` の失敗を返している箇所）76 か所**を 1 か所ずつ `if (false)` に
書き換えて測った。速い部分集合（`tests/domain tests/property
tests/application tests/presentation` / 2568 件）で赤なら確定、緑だった
ものだけ全件（165 ファイル / 約 3960 件）を回し直した。

| 見たもの | 件数 |
| --- | ---: |
| 断る場所 | 76 |
| 消すと赤（誰かが見ている） | 65 |
| **消しても緑（誰も見ていない）** | **11** |

緑だった 11 か所:

| ファイル | 断っていたもの |
| --- | --- |
| `affiliate-link.ts:60` | URL が空 |
| `claim.ts:77` | 主張の文が空 |
| `claim.ts:125` | 確認者の名前が空 |
| `content-variant.ts:102` | 本文が空 |
| `content-variant.ts:110` | 3 つの点数が 0〜1 の外 |
| `content-variant.ts:114` | プロンプト版が空 |
| `content-variant.ts:156` | 人が確認していない承認 |
| `policy-rule.ts:129` | ルール名が空 |
| `policy-rule.ts:132` | 検出する表現が空 |
| `policy-rule.ts:151` | 分野が語彙の外 |
| `policy-rule.ts:159` | 出力先が語彙の外 |

形は前の E 群の回（95 → 83）と同じである。**入口が 1 つしかなく、
そこを通る値がいつも正しい**（見本データが作成関数を正しい値で 1 度呼ぶだけ）。
断る側の枝は一度も通らないので、枝ごと消えても誰も気づかない。

**加えて、赤だった 65 か所も多くは「断るか」しか見ていなかった。**
上限で断ることは見ているが、上限の 1 つ手前が通ることは見ていない。
つまり**端は測られていなかった**。3 つの新しいファイルは、この
「どこから断るか」を数・長さ・時刻の 3 種の端について当てている。

#### 足したもの

| ファイル | 当てているもの |
| --- | --- |
| `tests/domain/entity-inputs.test.ts` | 17 要件の入力と端（`equivalence` / `boundary`） |
| `tests/domain/entity-states.test.ts` | E19 / E25 / E27 の状態の動き（`state-transition`） |
| `tests/domain/entity-enumerations.test.ts` | E01 / E31 / E32 の語彙と表（`equivalence` / `decision-table`） |

`REQ-E32` の `has-secret` と `has-recorded-operation` は、既にある
`tests/domain/records-and-metrics.test.ts`（`redactSensitive` と記録の中身を
当てている）に結んだ。ファイルを増やさず、印だけを足している。

期待する一覧は**すべてテストの側に書き写した**。遷移表 10×10、プランの上限
3×4、分野 8 種・出力先 11 種、操作 34 種と理由が要る 9 種。実装の
`ALLOWED` / `PLAN_LIMITS` / `POLICY_DOMAIN_SCOPES` / `REASON_REQUIRED` を
読み込んで回すと、一覧から 1 件消えたときに短くなった一覧を回して緑を返す
（`docs/product/backlog.md` 項目 78 の 5 つ目）。遷移の総当たりは公開ゲートを
常に「通った」にして 100 通り全部を通す。前提で狭めた側を作らない（同 6 つ目）。

#### 判定欄の嘘（6 例目）

`docs/product/traceability.md` F 節の末尾に、**集合についての主張**があった。

> 不変条件は `tests/domain/entity-invariants.test.ts` と
> `tests/domain/invariants.test.ts` が機械で確かめている。

この 2 ファイルは実在し、いまも緑である。だが上の実測のとおり、
**断る場所 76 か所のうち 11 か所はその外にあった。**
`REQ-TM04` 型（検査はあるが別のことを見ている）だが、嘘の中身が
「個別の振る舞い」ではなく「**全部を見ている**」という集合の主張である点が新しい。
読んで確かめると本当に見える。壊して初めて外が見える。
**集合についての主張は、読むのではなく壊して測る。**

#### この回で宣言していない E（1 件）

`REQ-E16`（ProductVariant）。作る関数が無く、断る場所が 1 つも無いため、
`boundary` の当てどころが実装に存在しない。除外へ回さず未宣言のまま残す。
除外の枠が満杯（7/7）だから書けないのではなく、**実装が境界を持てば宣言できる**。

> **2026-08-19（同日、後の回）に宣言した。**「実装が境界を持てば宣言できる」と
> 書いてあったとおり、当てどころを作るほうを先にやった。§4 の「9 → 8」を見ること。

### 2026-08-19 に減らしたぶん（49 → 38）: 自動化と公開の設定 11 件

**まず 49 件の内訳を数えた。** 大きい群から順に当たるためである。

| 群 | 件数 |
| --- | --- |
| CI（自動化と公開） | **13** |
| FB（改善要望フィードバック） | 9 |
| TM（テレメトリ） | 8 |
| FD（フィード） | 6 |
| TS（技術スタック） | 6 |
| W（WebMCP） | 3 |
| TH（テストの正直さ） | 2 |
| E（データモデル） | 1 |
| IM（実装方針） | 1 |

最大は CI の 13 件。性質は `has-runtime-config` → `infra-config`。
語彙の線は「**設定を間違えると、コードを 1 行も変えずに壊れる要件**」で、
CI/CD の設定はそのまま当てはまる。**名前を借りたのではなく、線の文を当てた。**
線がこれまで実行環境（`wrangler.jsonc`）に寄って書いてあったので、
`quality-gates.config.mjs` の定義に理由つきで広げたことを書き足してある。

#### 宣言する前に、いまの検査が何を見ているかを測った

`.github/workflows/` を 1 か所ずつ壊して、赤くなるかを見た（20 通り）。

| 壊したもの | 結果 |
| --- | --- |
| 5 本それぞれに `coverage 80` を書き足す | 赤 |
| `ci.yml` に検査名を書き写す | **緑** |
| `ci.yml` から検査ステップ（`pnpm run verify`）を外す | **緑** |
| `ci.yml` を `deploy.yml` の中身で丸ごと上書きする | **緑** |
| `deploy.yml` にマイグレーション適用の行を足す | **緑** |
| `migrate.yml` から確認文字列 `APPLY` の判定を外す | **緑** |

**ワークフローの中身については、閾値の書き写し以外に何も見ていなかった。**
この 5 つを塞いだのが `tests/architecture/ci-config.test.ts`（21 件）で、
宣言のために新しく書いている。**印を付けただけの件は 1 件も無い。**
書いたあとに同じ 20 通りをもう一度当て、5 つが全部赤くなることを確かめた。

#### 端は別に当てた

到達（そこを誰かが通っているか）と境目（どこから断るか）は別の道具で測る。

| 端 | 当てた値 | 結果 |
| --- | --- | --- |
| AI 評価の上限 | 実件数ちょうど（51） | 通る |
| 同上 | 実件数 +1（52） | 止まる |
| 同上 | 0 | 止まる |
| 控えの保管日数 | 30 → 29 | 止まる |
| 公開後の確認 | 2 回 → 1 回 | 止まる |

#### 書いたばかりの検査にも、同じ穴が 2 つあった

測ったことで見つかった。**緑は、書いた本人にとっても証拠にならない。**

- `exit 1` があることだけを見ていた。`smoke.sh` には APP_URL 未設定の
  `exit 1` が別にあるので、**判定の枝から消しても緑のまま**だった。
  2 回目の判定の枝の中にあることを見る形へ直した。
- 控えの順番を、文字列を含むかどうかで見ていた。名前を変えるだけの書き換えでは
  順番は動かないので、**測ったつもりで何も測っていなかった**。
  ステップごと後ろへ動かす書き換えで測り直した。

#### この回で宣言していない CI（2 件）

- `REQ-CI08`（非エンジニアが読める運用説明）。文書のため、当てどころが実装に無い。
- `REQ-CI12`（目標時間の超過は警告であって落とさない）。超過時の挙動を測るには
  時間を外から渡せる作りが要るが、`scripts/verify.mjs` は受け取れない。
  除外の枠が満杯（7/7）だから書けないのではなく、
  **実装が時間を受け取れるようになれば宣言できる**。

#### 判定欄の嘘（7 例目・8 例目）

`REQ-CI01` の判定欄は「`ci.yml` の検査ステップは `pnpm run verify` の 1 行のみ」、
`REQ-CI03` は「`ci.yml` は呼ぶだけなので**ずれようがない**」と書いてあった。
**どちらも事実と違っていた。** `ci.yml` には「マイグレーション未生成の検出」という
独自の検査ステップがあり、`pnpm run verify` には含まれていなかった。
つまり **`REQ-CI01` の要件そのもの（機械の上でしか試せない状態を作らない）が
破れていた**。文章を直すのではなく、検査を `scripts/migration-generated.mjs` として
`verify` の中へ移し、`ci.yml` から外した。**塞げる穴は、文章ではなく実装で塞ぐ。**

### 2026-08-19 に減らしたぶん（38 → 29）: 改善要望の受け口 9 件

残り 38 件の内訳を数えると **FB 9 / TM 8 / FD 6 / TS 6 / W 3 / CI 2 / TH 2 / E 1 / IM 1**
で、最大の群が FB（利用者が画面から改善要望を送る仕組み）だった。9 件すべて宣言した。

| 要件 | 性質 | 当てた場所 |
|---|---|---|
| REQ-FB01 | has-enumerated-input | `tests/domain/loop-kinds.test.ts` |
| REQ-FB02 | has-screen, has-permission | `tests/ui/feedback-button.test.tsx` |
| REQ-FB03 | has-input, has-screen | `tests/ui/feedback-button.test.tsx` / `tests/domain/feedback.test.ts` |
| REQ-FB04 | has-screen | `tests/ui/feedback-button.test.tsx` / `tests/ui/capture-canvas.test.tsx` |
| REQ-FB05 | has-screen | `tests/ui/capture-canvas.test.tsx` |
| REQ-FB06 | has-input | `tests/domain/feedback.test.ts` |
| REQ-FB07 | has-screen | `tests/ui/page-render.test.tsx` / `tests/ui/keyboard-operation.test.tsx` |
| REQ-FB10 | has-enumerated-input, has-secret | `tests/domain/handoff-prompt.test.ts` |
| REQ-FB11 | has-ai-text | `tests/domain/handoff-prompt.test.ts` |

**印を付けただけの件は 1 件も無い。** 宣言する前に 19 通り壊して測り、直したうえで
19/19 が赤になる（宣言の印 7 / 実装 12。役割による出し分けの迂回、権限名の改名、
Esc、フォーカスの折り返し、開いたときの移動、選択の `aria-pressed`、
まとまりの名前、区切りの無害化、無害化と番人の順番、
差し込み一覧の縮小、禁止語一覧の縮小、知らない差し込みの黙った空欄）。

#### 端は別に当てた（7 通り。最初 2 つがみどりだった）

| 動かした端 | 結果 |
|---|---|
| 本文の上限 4000 を 1 文字ゆるめる | 赤 |
| ちょうど 4000 文字を断る側へ入れる | 赤 |
| 画像 4MiB ちょうどを断る側へ入れる | 赤 |
| 保存 180 日を 179 日に縮める | **最初みどり** → 塞いで赤 |
| 「どうなってほしいか」200 文字の端を動かす | **最初みどり** → 塞いで赤 |
| 受け取ってよい画像の種類を差し替える | 赤 |
| 画像の種類の検査を止める | 赤 |

保存日数がみどりだったのは、境目を `CAPTURE_RETENTION_DAYS` から作っていたためで、
**定数を動かすと境目も一緒に動く**。数え方の検査と数そのものの検査は別物なので、
`expect(CAPTURE_RETENTION_DAYS).toBe(180)` と 179/180 日の literal を足した。
「どうなってほしいか」の上限は、本文の端だけを見ていて誰も見ていなかった。

#### 書いたばかりの検査に見つけた穴 2 つ

- 禁止語の表を一覧から回して作っていた。**回して作る表は、増えたものには強く、
  減ったものには何も言わない。**一覧が縮んだ日に行も一緒に消える。名指しの 1 行を足した。
- axe は**名前の無い `role="group"` を違反として上げない**。読み上げの検査だけでは、
  道具の並びから名前が消えたことに気づけなかった。`getByRole("group", { name })` を足した。
  これは残課題 78 の②「壊しても赤にならない理由が、守られていないからではなく
  **壊し方が測定対象に届いていないから**」の 3 例目。

#### 判定欄の嘘（9 例目）

`REQ-FB03` の判定欄に「Esc で閉じる / フォーカスを閉じ込める」と書いてあったが、
**実装にどちらも無かった**。文章を直さず、`presentation/ui/patterns/feedback-button.tsx`
に実装した。`REQ-CI01` と同じ形で、判定欄の点検は
**破れている要件を見つける作業**になる。

#### この回で宣言していない FB（0 件）

FB は 9/9 宣言した。残る 29 件は TM 8 / FD 6 / TS 6 / W 3 / CI 2 / TH 2 / E 1 / IM 1 で、
次の回に回す（CI 2 と E 1 は前の回に書いたとおり、当てどころが実装に無い）。

### 2026-08-19: 性質を 1 つ足した（`has-code-placement-rule` → `code-boundary`）

**足してよいのは、既に実在して機能している検査に名前が無い場合だけ**という条件で足した。
検査を書く前に名前だけ足すのは、未宣言の数を下げるための語彙になる。

足した理由と線の引き方は `quality-gates.config.mjs` の `has-code-placement-rule` の
コメントに書いた。ここには**測った結果**だけ残す。

| 要件 | 禁止側をどう書いたか | 結果 |
| --- | --- | --- |
| `REQ-FD01` | 11 集合すべてを存在しない名前へ向けた（対象が消える形） | **11/11 赤** |
| `REQ-FD02` | `src/domain/ranking/scoring.ts` へ `monetization` の import を 1 行足した | 赤（1 failed / 23 passed） |
| `REQ-FD05` | `schema.ts` の `export *` を名指し輸出に変えた（入口が 2 つになる） | 赤（1 failed / 8 passed） |
| `REQ-FD06` | `export { X }` の再輸出を足した | 赤 |
| `REQ-TM12` | `src/domain/ranking/scoring.ts` へ `infrastructure` の import を 1 行足した | 赤（1 failed / 23 passed） |
| `REQ-SEC02` | `rank-products.ts` で `guardedFetch` を通さず `fetch(` を呼んだ | 赤（1 failed / 23 passed） |
| `REQ-SEC04` | `rank-products.ts` へ報酬ポートの import を 1 行足した | 赤（1 failed / 23 passed） |

**壊し方は、要件の文がそのまま禁じている行為にしてある。**判定式を偽に変える壊し方は
使っていない。後者だと「検査が動いているか」ではなく「その行を通ったか」しか測れない
（残課題 78 の天井②を、この回だけで 2 度踏んだ）。

**7 件のうち 3 件（`REQ-FD02` / `REQ-SEC02` / `REQ-SEC04`）は既に別の性質を宣言している。**
FD 群のためだけの名前になっていないことの確認として、横断で洗い直したときに出てきたものである。

当てなかったもの: `REQ-FD04`（検査が別のことを見ている。残課題 88）、
`REQ-TS01` / `REQ-TS03`（判定欄が実装を指していて、検査そのものが無い）。
**形は当たるが条件を満たさないので、未宣言のまま残す。**

### 2026-08-19 に減らしたぶん（22 → 20）: 禁止依存 6 件のうち 2 件

対象は `REQ-FD01`〜`REQ-FD06`。**宣言できたのは 2 件だけである**（`FD02` / `FD03`）。

判定欄の主張を **29 通り壊して測り、8 通りが緑のまま通った。**

| 要件 | 壊した通り数 | 緑だった通り数 | 何が緑だったか |
| --- | --- | --- | --- |
| `REQ-FD01` | 9 | 6 | 別名で書き直した重み付き合計 2 通り／層を 1 つ改名した 4 通り |
| `REQ-FD02` | 7 | 0 | （1 通りは測定が空振りしていた。下記） |
| `REQ-FD03` | 4 | 1 | 主張ちょうど 1 件・根拠 0 件が通るようになっても緑 |
| `REQ-FD04` | 3 | 0 | （壊せる範囲は全部赤。要件そのものを見る検査が無い） |
| `REQ-FD05` | 0 | — | **壊せない。検査が存在しない** |
| `REQ-FD06` | 6 | 1 | `export { X }` の再輸出 |

#### 判定欄に嘘があったか: **6 件中 4 件にあった**

- `REQ-FD05` — **`W03` 型**（検査が存在しない）。「スキーマ定義が `src/db/schema.ts` のみで
  あること」とだけ書いてあり、これを見るテストは無かった。**書いてある事実も違っていて**、
  `sqliteTable` は `schema.ts` と `auth-schema.ts` の 2 か所にある。実装欄も
  「実装済（現状1箇所）」で、実装の場所ではなく結果が書いてあった
- `REQ-FD04` — **`TM04` 型**（別のことを見ている）。「1 つのカタログを 4 入口へ写す」を
  見ているが、要件は「WebMCP でしか到達できない機能を作らない」である。
  **写しが一致していることと、画面から到達できることは別**
- `REQ-FD06` — 実装欄の**数の嘘**。「sites / fact-boundary / reschedule の 3 件」とあるが
  `*-state.ts` は 9 件（`src/presentation/admin/` の実数）ある。`REQ-TM02` の
  「17 項目 → 実際 16」と同じ形で、**数は書いた日に正しくても、増えたときに黙る**
- `REQ-FD03` — **`TM11` 型**（欄が実態より**悪い**）。結果欄が「スタブ」、判定欄が
  「公開ゲート QC-07」だったが、`QC-07` は要件表では `REQ-QC05` の側にある別の番号で、
  実物は `publish-gate.ts` に実在して機能していた。**実装は触っていない。欄だけ直した**

#### 塞いでから宣言した（3 つの穴）

1. **層の空振り**（`FD01`）— `filesUnder()` はディレクトリが無いと例外を握りつぶして
   `[]` を返す。層を 1 つ改名しただけで 13 件すべて緑になった。層ごとの件数の下限を
   `describe("検査対象そのもの")` に置いた。**既にあった「読者の画面が 1 枚以上ある」は
   `src/app` 側の別の集合を守っていたので、ここが空になっても生き残っていた**
2. **再輸出**（`FD06`）— `export { LIMIT }` は `^export\s+(?!async function )(\w+)` の
   `(\w+)` が `{` に一致しないので素通りしていた。定数を `*-state.ts` へ移したあと
   元の場所から再輸出するのは自然な手順なので、ここが空くと決まりの効き目が消える
3. **端**（`FD03`）— 判定を `claimCount > 0` から `> 1` へ緩めても 96 件すべて緑だった。
   **主張がちょうど 1 件で根拠が 0 件**を誰も通していない。記事を書き始めた直後の、
   いちばん普通の状態である

#### 天井（②「測定が空振りする」）を、この回も 2 度踏んだ

`FD02` の提携側を測るとき、**メッセージの文字列だけを書き換えて `throw` に触れていなかった**。
緑を見て「見ていない」と読みかけたが、判定式 `readDataClass(deps[key]) !== "commercial"` を
常に偽にしたら赤になった。もう 1 度は、`FD01` に足した空振り防止を壊そうとして、
**新しく置いた `LAYERS` に届かない書き換え**（`filesUnder("application")` の呼び出し側）を
していた。`LAYERS` の値そのものを変えたら赤になった。
**どちらも「緑だった」ではなく「測れていなかった」である。**残課題 78 に既に書いてある形を、
書いた本人が同じ日に 2 度踏んだ。

#### 残した 4 件（`FD01` / `FD04` / `FD05` / `FD06`）

**当たる性質が語彙に無い。**4 件とも「実装をどこに置いてよいか」の禁止であって、
入力・状態・権限・画面・計算のどれでもない。検査は 4 件とも実在し、この回に穴も塞いだ。
**満たしていない種別の名前を借りないため、未宣言に残す。**除外の枠（7/7 満杯）は動かしていない。
`REQ-TM12` と同じ理由なので、語彙の不足（`ah-w9k`）は **4 件から 8 件**になった。
`TS06` / `TS09` / `TS10` / `TM12` / `FD01` / `FD04` / `FD05` / `FD06`。
**8 件たまった時点で、これは個別の残り物ではなく、語彙の側が「配置の禁止」を持っていない。**

### 2026-08-19 に減らしたぶん（29 → 22）: 計測 7 件

対象は `REQ-TM02, TM03, TM05, TM06, TM10, TM11, TM13`。

宣言する前に、判定欄の主張を **29 通り壊して測った**。
**12 通りが緑のまま通った。**このうち 7 件は、塞いでから宣言した。

| 壊したもの | 結果 |
| --- | --- |
| 価格表 (`MODEL_PRICES`) から 1 件消す | 緑だった |
| AI の記録の項目を 1 つ増やす | 緑だった |
| 表の行の見出し (`<th scope="row">`) をただのマスにする | 緑だった |
| 表の列の見出しから `scope` を全部落とす | 緑だった |
| 価格未登録の注意書きを、ただの金額にする | 緑だった |
| 集計キーの区切りを消す／空白にする | 緑だった（2 通り） |
| 要素の一覧から `affiliate_link` を消す | 緑だった |
| 節の一覧から `evidence` を消す | 緑だった |
| 節の名乗りを記事の器から丸ごと外す | 緑だった |
| 計時を始める割合 0.5 を 0 にする | 緑だった |
| 開示ページの説明を空にする／「いまの状態」を消す | 緑だった（2 通り） |

残り 17 通り（上限 50 件・32KB・413・20 件・15 秒・保存先の表名など）は赤くなった。
**守られている側と守られていない側が、判定欄からは見分けられなかった。**

#### 判定欄の嘘（10・11・12 例目）

- `REQ-TM05`「PASS（`tests/ui/ui-layers.test.ts`「部品が業務判断を持っていない」
  **「共通UIから通信しない」**）」→ **三重**。後者の名前の検査は存在せず（`IM10` 型）、
  同ファイルに `telemetry` の文字が 1 つも無く（`TM04` 型）、
  一覧を壊しても緑（`W03` 型）だった。**1 つの欄で 3 つの型が同時に起きうる。**
- `REQ-TM06`「節の種類は `TELEMETRY_SECTION_KINDS` に限定」→ `W03` 型。
  この名前は 2026-08-19 まで `tests/` 全体で参照 0 件だった。
- `REQ-TM10`「PASS（`tests/domain/site-routes.test.ts`「表にある道には画面がある」）」
  → `TM04` 型。道と画面の対応は見ているが、**説明の中身は誰も見ていない**。
- `REQ-TM11` の欄は「`pnpm run build` で全ルート生成」。これは検査ではない。
  ただし実際の検査（`api-routes.test.ts` / `telemetry-collector.test.tsx`）は実在し、
  壊すと全部赤くなった。**中身は正しいのに、欄が実在の検査を指していない**新しい形。
- `REQ-TM02` の実装欄「`ai_model_usage`（17項目）」→ **数の嘘**。数えると 16。

#### 見えない 1 バイトが正しさを担っていた

`src/domain/analytics/ai-usage.ts` の集計キーの区切りが、
`\u0000` のエスケープではなく**生の NUL バイト**で書かれていた。
読むと空白に見えるので、書き写した人は空白にする。空白にすると
「ブログ名に空白」と「モデル名に空白」で費用が別のブログに混ざる。
**そして区切りを消しても緑だった。**テストを足して塞いだうえで、
**同じ日に区切りそのものを直した**（`JSON.stringify([siteSlug, modelId])`）。

残課題へ起こさなかったのは、**検査は「間違えたことを教える」だけで、
間違えさせない作りにはしていない**からである。目に見えない区切りが残っている限り、
次に書き写す人は空白にする。**起票が要るのは、いま直せないものだけ。**

#### この回で宣言していない TM（1 件）

`REQ-TM12`（差し替え可能な接続部＝層の分離）。当たる性質が語彙に無い。
`tests/architecture/dependency-direction.test.ts` は実在して機能しているが、
**その検査に付ける名前が無い**。除外（7/7 満杯）へ回さず未宣言に残す。

残る 22 件は FD 6 / TS 6 / W 3 / CI 2 / TH 2 / E 1 / IM 1 / TM 1。

### 2026-08-19 に減らしたぶん（16 → 14）: テスト戦略の残り 6 件のうち 2 件

未宣言 16 件の内訳を数えたところ、**TS 6 件が最大の群**だった
（残りは W 3 / CI 2 / TH 2 / E16・IM13・FD04 の 3 件）。
この 6 件は前の回に一度点検して「宣言しない」と結論を書いた側である。
**同じ結論を書き直すために読み返したのではなく、結論の前提が動いていないかを見た。**
2 件は動いていた。

#### `REQ-TS09`（契約検査）— 前提が語彙の追加で消えていた

前の回に書いた理由は「種別 `contract` はどの性質にも束ねていない。
`has-runtime-config` を借りると `infra-config` を名乗るが、`TS09` が見ているのは
設定ではなく**構造**」だった。その直後に `has-code-placement-rule` →
`code-boundary`（＝構造の境界）を足している。**理由のほうが先に古くなっていた。**

名乗る先は `dependency-direction.test.ts` と `single-definition.test.ts`。
どちらも既に `code-boundary` を持っている。壊して測った結果:

| 壊し方 | 結果 |
| --- | --- |
| 2 ファイルの両方から `@req REQ-TS09` を外す | **赤**（`REQ-TS09: code-boundary`） |
| 2 ファイルの両方の `@types` から `code-boundary` を落とす | **赤**（同上） |
| 片方だけから外す（2 通り） | 緑のまま |

片方だけで緑なのは、もう片方が同じ種別を持っているため
（`REQ-E13` / `REQ-TS08` と同じ「1 つの要件を複数のファイルが支えている」形）。

#### `REQ-TS01`（土台を 1 箇所に集める）— 検査を書いてから宣言した

前の回に**判定欄の嘘**として記録した 1 件である。「契約検査で見る」と
書いてあったが、その検査は存在しなかった。今回
`tests/architecture/test-foundation.test.ts`（15 件）を書いて塞いだ。見るのは 3 つ:

1. 要件が挙げる 6 つの土台が実在し、どれも 1 つ以上のテストから使われている
2. axe を呼ぶ口は `tests/support/a11y.ts` の 1 つだけ
3. 基準時刻 `NOW` を土台の外に書き写していない

**書いた結果、3 に違反する 3 件が見つかった。**
`reader-interaction.test.ts` / `feedback.test.ts` / `boundaries-platform.test.ts` が
`2026-08-17T09:00` を自前で書いていた。`NOW` を動かしてもそこだけ古い時刻のまま
**緑で残る**形である。土台へ寄せてから宣言した。

| 壊し方（要件の文がそのまま禁じている行為） | 結果 |
| --- | --- |
| 基準時刻をテストに書き写す | **赤** 1/15 |
| axe-core を support の外から直接読む | **赤** 1/15 |
| 土台の 1 つ（`clock.ts`）を改名する | **赤** 2/15 |
| 走査先を存在しない名前へ向ける（空振り防止） | **赤** 15/15 |

**この検査自身が、書いた直後に自分の規則を破って赤くなった。**
探す日時を定数として書き写していたためである（`NOW` から作る形に直した）。
残課題 78 の「知識では防げない」にもう 1 例。

#### 宣言しなかった 4 件と、理由が変わったかどうか

| 要件 | 前の回の理由 | 今回 |
| --- | --- | --- |
| `TS02` 業務の決まりごとの単体テスト | メタ要件。性質を持つのは個々の業務要件の側 | 変わらず。判定欄が `pnpm test` というコマンドだけだったので、実測（31 ファイル / 998 件）へ置き換えた |
| `TS03` 手順の単体テスト | 同上。「差し替えの要求」は障害注入ではない | 変わらず。同じく実測（26 ファイル / 797 件）へ置き換えた |
| `TS06` 読み上げ検査とコントラスト | `a11y` だけを求める性質が語彙に無い | **語彙を足して解いた**（次の節）。判定欄が「PASS」だけだったので実測（配色 10 種 × 明暗 2 種 = 20 通り + 空振り防止）へ置き換えた |
| `TS10` カバレッジを層別に測る | `mutation` は実装欄が `src/domain` / `src/application` を指すかで決まり、`TS10` の実装は `scripts/` なので満たしようがない | 変わらず |

### 2026-08-19: 性質をもう 1 つ足した（`has-color-scheme-variants` → `a11y`）

`REQ-TS06` は「`a11y` だけを求める性質が語彙に無い」という理由で
2 回続けて未宣言に残していた。検査（`tests/ui/theme-contrast.test.ts`）は
実在して機能している。**足りないのは名前だけ**だったので足した。

`has-screen`（`screen-states` / `a11y` / `keyboard`）より軽いため、
放っておくと画面の要件がこちらへ逃げる道になる。そうならないよう、
当たるのは**配色・明暗の組み合わせの集合を持っている側**だけ、という線を
`quality-gates.config.mjs` の欄に書いた。ふつうの画面は配色の一覧を持たない
（`REQ-TH03` のとおり、切り替え部品は選択肢を渡してもらう形である）。

横断で洗い直して当たったのは 3 件。壊して測った結果:

| 壊し方 | 結果 |
| --- | --- |
| `theme-contrast.test.ts` から `@types a11y` を落とす | **赤**（`REQ-TS06: a11y`） |
| 同ファイルから `@req` を落とす | **赤**（同上） |
| `theme-contrast` と `page-render` の両方から `a11y` を落とす | **赤**（`REQ-TH01: a11y`） |
| 利用者が名指しした 5 系統から 1 つ（`green`）の名札を外す | **赤** 1/22 |
| 配色を 1 つ足して `themes.css` に何も書かない | **赤** 1/26（下記） |

#### 測る範囲を狭めると、無い穴が見える

最後の 1 つは、最初は**緑**だった。配色の名札だけ足すと
`theme-contrast.test.ts` は 23 件から 25 件へ増えたうえで全部通る
（`themeBlock()` が空を返し、色が `:root` の既定値に落ちて AA を満たす）。
「総当たりの件数が自動で増えること」と「増えたぶんが実際に見られていること」は
別である、と判断して検査を 1 つ足した。

**が、全部走らせると `tests/ui/blueprint-theme.test.ts` が 2 件落ちていた。**
製品としての穴は空いていなかった。空いていたのは**1 ファイルだけを対象に
測ったときの見え方**である。足した検査はそのまま残したが、
位置づけは「穴を塞いだ」ではなく「このファイルを単体で測っても
だませないようにした」に直した（コメントにもそう書いてある）。

残課題 78 に 8 つ目の形として記録する: **測定の範囲が狭いと、無い穴が見える。**
これまでの 7 つは「壊したのに緑」の形だったが、これは逆向きで、
**「緑にならないはずのものが赤に見える」**側の失敗である。
どちらも原因は同じ（測る当てどころと、主張の範囲がずれている）。

#### 判定欄に嘘があったか

**この回は無い。**古い数字が 2 つあっただけである
（`TS02` の「既存 9 ファイル」→ 31、`TS03` の「既存 8 ファイル」→ 26。
どちらも増えている側で、実測に置き換えた）。
前の回に見つけた `TS01` の嘘は、この回で**検査を書いて事実のほうを合わせた**。

### 2026-08-19 に減らしたぶん（13 → 10）: 残り 13 件を群に分けず 1 周した

もう群に分ける大きさではないので、`REQ-CI08` `REQ-CI12` `REQ-E16` `REQ-FD04`
`REQ-IM13` `REQ-TH04` `REQ-TH05` `REQ-TS02` `REQ-TS03` `REQ-TS10`
`REQ-W06` `REQ-W08` `REQ-W11` の 13 件をまとめて 1 周した。
**宣言できたのは 3 件**（`REQ-W06` / `REQ-W08` / `REQ-W11`）。

#### 語彙は 1 つも足していない。足りなかったのは検査のほうだった

3 件とも `has-enumerated-input`（等価分割＋判定表）で、性質は前からあった。
未宣言だった理由は「一覧の中身を見ている検査がまだ無い」であり、
**その理由は正しかった**（`REQ-TS09` のように古くなってはいなかった）。

| 要件 | 一覧 | それまで当たっていた範囲 |
| --- | --- | --- |
| `REQ-W06` | 段落の並べ方 7 段 | 先頭「結論」と末尾「次の行動」だけ。**間の 5 段は入れ替えても緑** |
| `REQ-W08` | 文体の決まり 9 件 | 「理由が空でない」の総当たりのみ。9 という数も中身も見ていない |
| `REQ-W11` | 記事タイプごとの書き出し | **テストからの参照が 1 つも無い** |

書いたのは `tests/domain/writing-style-tables.test.ts`（33 件）。
期待値は手で書き写す（`telemetry-tables.test.ts` と同じ形）。ただし
**書き出しの型のキーだけは書き写さず、`ARTICLE_TYPES` から取る**。
5 つ書き並べると、記事タイプが 6 つ目に増えた日に書き出しが無いまま緑になる。

`quality-check.ts` の「`STYLE_RULES` の『1 段落は原則 1〜3 文』と同じ値」という
コメントも、ここで機械に結び直した。**コメントは値が離れても黙る。**

#### 赤の実測（壊し方は要件の文がそのまま禁じている行為で書いた）

判定式は 1 つも触っていない。理由は `tasks/task-judgment-column-audit.md`
の「壊し方の決まり」に書いた。

| 要件 | 壊し方 | 新しい検査 | それまでの検査 |
| --- | --- | --- | --- |
| W06 | 間の 5 段を入れ替える（理由 ⇄ 根拠） | 赤 | **緑** |
| W06 | 1 段（例外）を落とす | 赤 | **緑** |
| W08 | 決まりを 1 件（単位と条件）消す | 赤 | **緑** |
| W08 | 文長の決まりを 1〜3 文 → 1〜5 文 に書き換える | 赤 | **緑** |
| W11 | 記事タイプを 1 つ足して書き出しの型を書かない | 赤 | 赤 |
| W11 | 書き出しの型を 1 つ空にする | 赤 | **緑** |

「それまでの検査」は `tests/application/writing-method.test.ts` と
`tests/domain/invariants.test.ts`（判定欄が名指ししていた 2 つ）。
**6 通りのうち 5 通りが緑で通っていた。**W11 の 1 行だけ元から赤なのは、
記事タイプを足すと別の場所も落ちるためで、要件を見ていたからではない。

#### 残した 10 件（理由を全件読み直した結果）

上の「決まり」に従って 10 件すべての理由を読み直し、
**古くなっていたものは 0 件**だった。実物で確かめたものを添える。

| 要件 | 残す理由 | 確かめ方 |
| --- | --- | --- |
| `REQ-CI08` | 非エンジニア向けの説明文。当てどころが実装に無い | — |
| ~~`REQ-CI12`~~ | ~~超過時の挙動を測るには時間を外から渡せる作りが要る~~ **2026-08-19 に宣言済（渡せる作りにした）** | `scripts/verify.mjs` に判定 4 つと `VERIFY_ELAPSED_SECONDS` を足し、実物で超過させて exit 0 を確認した |
| ~~`REQ-E16`~~ | ~~`ProductVariant` に作る関数が無く、断る場所が 1 つも無い~~ **2026-08-19 に宣言済（当てどころを作った）** | `src/domain/product/product.ts` に `createProductVariant` と断り 4 か所を足した |
| `REQ-FD04` | **理由が古くなっていたので 2026-08-19 に書き直した。**検査は書いた（`tests/architecture/webmcp-reachability.test.ts`、9 件）。宣言できないのは別の理由で、**この検査が満たすのは `equivalence` 1 つだけ**なのに、`equivalence` だけを求める性質が語彙に無い。`has-input` は `boundary` も、`has-enumerated-input` は `decision-table` も連れてくる。持っていない種別の名前は借りない | `REQUIRED_TEST_TYPES` の 16 種を全部見て、`equivalence` 単独の性質が無いことを確かめた |
| `REQ-IM13` | 保存先のテーブルがまだ無い | `src/db/schema.ts` に `variant_specs` / `loop_runs` / `loop_observations` は無い |
| `REQ-TH04` | 自動の検査が 1 つも無く、宣言すると手動の記録が自動の緑に化ける（残課題 73） | — |
| `REQ-TH05` | 製品の振る舞いではなく検査の仕組みについての要件 | `has-color-scheme-variants` の欄に、名乗ると何が化けるかを書いてある |
| `REQ-TS02` `REQ-TS03` | 「その層にテストがあること」を言うメタ要件で、性質を持つのは個々の業務要件の側 | — |
| `REQ-TS10` | `has-calculation` の `mutation` は実装欄が `src/domain` / `src/application` を指す要件にしか当たらず、この要件の実装は `scripts/` にある | `has-enumerated-input` 側も見たが、層の一覧は要件の中心ではないので名乗らない |

`REQ-TS10` を見直した副産物が 1 つある。
`tests/architecture/quality-gates.test.ts` の「層の一覧が `src` の実際の作りと一致する」は
**`LAYER_COVERAGE` の側からしかたどっていない**。`src` に層が増えて
`LAYER_COVERAGE` に無い場合、その層は測られないまま緑になる（残課題 78 の⑤の形）。
これは**コードを読んで分かったことで、壊して測ってはいない**
（測るには `src` の下に置き場を作る必要があり、この作業場所では後始末に消す操作を使わない決まりのため）。
残課題へ起票した。

### 2026-08-19 に減らしたぶん（10 → 9）: `REQ-IM13` は「作った」ぶんで減った

前の回に「表がまだ無い」と書いて残した 1 件である。**印が抜けていたのではなく、
当てどころが無かった**。だから減らすためにやったのは、表と保存の道筋を作ることだった。
§4 の 3 行目に入れてある形と同じで、これで 3 度目になる。

作ったもの: `variant_specs` / `loop_runs` / `loop_observations` の 3 表
（`drizzle/0016_kind_stick.sql`）、保存の道筋
（`src/infrastructure/persistence/d1/improvement-repository.ts`）、
そして**保存先に置いてよいものの定義**（`src/domain/analytics/loop-record.ts`）。

#### 中心にあるのは「一覧が入口でしか守っていない」の解消

`createVariantSpec` / `createLoopRun` は作るときに一覧を突き当てる。
だが保存先は作られた値ではなく**渡された値**を受け取るので、
入口を通っていない値をそのまま `save〜` へ渡せる。
つまり「広告であることの表示」を軸にした記録が、入口を迂回すれば**書けてしまう**。

そこで同じ一覧（調整してはいけないもの 6 / 外せない約束 5 / 改善の軸 20 /
ループの種類 6）を保存側でも突き当てる。検査もこの形に合わせ、
**入口を一度も通さず値を直に組み立てて `save〜` を呼ぶ**。
入口を通すと入口が断ってしまい、保存側の穴は見えない。

#### 赤の実測（壊し方は要件の文がそのまま禁じている行為）

判定式は 1 つも触っていない。禁止のほうを取り払い、
**禁止行為が本当に成立する状態**にして測った（22 通り）。

| 段階 | 測った通り | 赤 | 緑のまま |
| --- | --- | --- | --- |
| 検査を書いた直後 | 22 | 17 | **5** |
| 穴を埋めたあと | 22 | **21** | 1 |

1 周目で緑のまま通った 5 つは、**書いたつもりで書けていなかった検査**である。
うち 4 つ（比べて決めないループ / 同じ設定どうし / 違いの無い比較 / 必要件数）は
検査を足して赤にした。**測らなければ、この 4 つは「守っている」と書けていた。**

残る 1 つは形が違う。`assertRecordableLoopRun` の中の `assertGuardrailsIntact`
呼び出しは、**呼び出しごと消しても緑のまま通る**。登録済みの 6 種がどれも
外せない約束をそろえているので、あの呼び出しに当たる値が作れないためである。
測れるようにするには「約束の欠けた種類を登録できる」ようにするしかなく、
それは守りたいものを壊す。**だから測れないままにして、測れなくしている前提のほうを見張る**
（`tests/domain/loop-record.test.ts` の「登録済みの 6 種は、どれも 5 件そろっている」。
6 種のどれかから約束が欠けた日に、この試験が赤くなって知らせる）。

#### 一覧を回す検査は空回りする、をもう一度踏まないために

`REQ-IM12` で一度そうなった。一覧を回して一覧由来の禁止を確かめると、
一覧から 1 件消えた日に**試験も 1 周短くなって緑のまま**になる。
そこで検査の側は `NON_OPTIMIZABLE` の 6 件と外せない約束 5 件を
**文字列で書き写して**持つ。実装は正本を参照し、検査は写しを持つ——向きが逆である。

#### 残した 9 件（理由を全件読み直した結果）

検査を書いた回なので、決まりに従って 9 件すべての理由を読み直した。
**古くなっていたものは 0 件。**実物で確かめたのは 3 件で、
`REQ-CI12`（`scripts/verify.mjs` は 47 行目でいまも `Date.now()` を自分で読む）、
`REQ-E16`（`src/domain/product/` に `createProductVariant` は無い。**この日のうちに作って宣言した**）、
`REQ-FD04`（道具と画面の対応表は、どこに置くかがまだ決まっていない）。
残る 6 件は当てどころが実装に無い、またはメタ要件で、前回から動いていない。

### 2026-08-19 に減らしたぶん（9 → 8）: `REQ-E16` も「作った」ぶんで減った

`REQ-IM13` と同じ形で、**印が抜けていたのではなく当てどころが無かった**。
これで 4 度目になる（`REQ-TS01` / `REQ-FD05` / `REQ-IM13` / `REQ-E16`）。

ただし前 3 件と 1 つ違う。E16 は「表がまだ無い」ではなく、
**型だけが在って、誰も組み立てていなかった**。`ProductVariant` は
`src` と `tests` を通して参照 0 件（`ProductVariantId` の型宣言を除く）で、
追跡表のデータ欄に書いてあった「見本データ」も事実ではなかった。
**誰も作らない型は、断る場所を持てない。**しかも型が在るので、
一覧を眺めるかぎりは他の 31 件と同じに見える。

作ったのは `createProductVariant` と断り 4 か所だけで、**画面は作っていない**。
追跡表の解除条件（色・容量ちがいを画面で分けて扱う要望が出たとき）はそのまま残る。
画面を作る理由と、組み立てを 1 か所に寄せる理由は別である。ここを混ぜると、
宣言を増やすために画面が生えることになり、宣言のほうが目的になる。

断り 4 か所は、`if (false)` ではなく**その断りを取り払って禁止行為が成立する状態**にして、
1 か所ずつ全件（4,296 件）を走らせた。**4 通り測って 4 通り赤**で、
1 周目に外していたものは無い。ただしこの 0 は自慢にならない——
断りとテストを同じ回に書いたので、外しようがない。
値打ちがあるのは残りの数字のほうで、**4 通りとも「私の足した 1〜2 件だけ」が落ちた**
（他の 4,294 件は全部緑）。つまりこの 4 か所を押さえているのは新しい 8 件だけで、
既存のどの検査も通り道を持っていなかった。

4 つのうち 3 つ（軸が空 / 値が空 / 識別子 0 件）は E15 の写しに近いが、
4 つ目は枝ちがい固有である: **仕様欄の「色」が赤なのに枝の値が青**でも型は通る。
通ったまま比較表に載ると、見出しと中身が食い違った表が出る。
黙って間違う形なので、画面ではなく作る時点で断る。
数値と文字列の突き合わせ（容量 `512` と `"512"`）も見ている。
型が違うだけで素通りすると、この断りは容量の枝には効かないため。

### 2026-08-19 に減らしたぶん（8 → 7）: `REQ-CI12` は「無かった」のではなく「通らなかった」

前 4 件（`REQ-TS01` / `REQ-FD05` / `REQ-IM13` / `REQ-E16`）は当てどころが**無かった**。
`REQ-CI12` は違う。**判定は前からそこに書いてあった。**
`scripts/verify.mjs` は目標時間を超えたら警告を出し、落とさない——要件のとおりである。

書いてあるのに宣言できなかったのは、**その行が現実には一度も通らない**ためだった。
1・2 段の実測は 46 秒で、目標は 20 分。超過の枝は誰も踏まない。
**通らない道は、そこに何が書いてあっても正しいかどうかを確かめられない。**
「書いてある」と「効いている」は別物で、この 1 件はその見分けの例になっている。

減らすためにやったのは、判定を 4 つの純粋な関数へ出し、時間だけを外から渡せるようにすること。

| 関数 | 何を決めるか |
| --- | --- |
| `judgeBudget` | 超えたかどうか。`blocking` は**常に false**（true になる分岐を作らない） |
| `readElapsedOverride` | `VERIFY_ELAPSED_SECONDS` を読む。測定のためだけにある |
| `describeOverride` | 外から渡したことの告知。**出さない経路を作らない** |
| `judgeRun` | 落とすかどうか。**`budget` を見ていない**——これが要件そのもの |

`main()` に入れて `import.meta.url` で守ったので、取り込んでも 15 分の検査は始まらない。
判定を検査するために検査を走らせなければならない作りだと、その判定は誰も見に行かない。

**測定の口は、そのまま嘘の口になる。**`VERIFY_ELAPSED_SECONDS` を黙って受け取れると、
遅いのに速いふりができてしまう。だから渡したことは実測と並べて必ず画面に出し、
出さない道が無いことを §4 の 2 件で見ている。

壊し方は 4 通りとも実装側で、**要件の文がそのまま禁じている行為**にした。

| 壊し方 | 落ちた検査 |
| --- | --- |
| 時間を exit code に混ぜる（`\|\| budget.over`） | §3 の 2 件 |
| 超過を `blocking: true` にする | §3 の 1 件 |
| 渡したことを黙る（告知を返さない） | §4 の 1 件 |
| 境目を 1 秒ずらす（`<=` → `<`） | §2 の 1 件 |

**4 通りとも赤。**元に戻したあと、`scratchpad` の複製と指紋が一致することを確かめてある。
実物でも `VERIFY_ELAPSED_SECONDS=99999 pnpm run verify --tier 1` を走らせ、
警告が出たうえで **exit 0** になることを見た（テストの中だけの話にしない）。

宣言した性質は `has-input` 1 つ（`equivalence` + `boundary`）。
時間という 1 つの数を目標と比べるだけなので、これ以上の名前は借りていない。

#### 同じ回に、`REQ-FD04` の理由が古いことが分かった

決まり「**検査を書いた回は、未宣言の理由を全件読み直す**」に従って 7 件を読み直したところ、
`REQ-FD04` の「要件そのものを見る検査が無い」が事実と食い違っていた。
検査は前の回に書いてある（`tests/architecture/webmcp-reachability.test.ts`、9 件）。

**それでも宣言はできない。**理由が変わっただけである。この検査が満たすのは
`equivalence` 1 つで、`equivalence` **だけ**を求める性質が語彙に無い。
`has-input` は `boundary` を、`has-enumerated-input` は `decision-table` を連れてくる。
**満たしていない種別の名前は借りない**ので、語彙の側に手を入れるまで未宣言に残す。
理由の欄はその内容へ書き直した。

古い理由は、古いまま読むと納得できてしまうところが厄介である。
「検査が無い」と書いてあれば、次に読む人は検査を書く仕事だと思って素通りする。
実際に足りないのは語彙のほうだった。

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
