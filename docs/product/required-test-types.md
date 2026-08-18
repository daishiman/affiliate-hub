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

## 4. 未宣言の要件について（正直に書く）

要件表には **241 件**の要件 ID がある。上の宣言表はそのうち **37 件**である。
残り 204 件は未宣言で、**この検査の対象外**にある。

全部に宣言を書き切るまで検査を入れない、という順にすると**検査は永久に入らない**。
そこで `TRACEABILITY_MAX_UNLINKED` と同じ形にした。

- 未宣言の上限 `TEST_TYPES_MAX_UNDECLARED` を実測（204）に置く
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

### まだどの性質からも指されていない種別（`ah-0ip` の残り）

`secrets` は片付いたが、**同じ食い違いが 5 つ残っている**。
いずれも印としては使われているが、**要求されてはいない**——
つまり書いた人の善意だけで存在しており、書かなくても検査は緑になる。

| 種別 | いま印を持つファイル | 性質にするなら対象は | なぜ今回まとめてやらないか |
| --- | --- | --- | --- |
| `audit-log` | 5 | 記録を残す書き込みの入口（21 件） | 対象が広く、宣言表に無い要件へ一気に波及する。入口が記録へ届いているかは `scripts/port-wiring.mjs` が別途 0 件で押さえている（**テストがあるかは見ていない**ので、いずれ要る） |
| `ssrf` | 2 | 外部へ自分で取りに行く経路（`guarded-fetch` を通る側） | 対象は狭く、次に片付けやすい。`REQ-SEC02` が `has-input` で宣言済みのため、性質を足すと同じ要件に 2 つ目の必須が乗る。その影響を確かめてから足す |
| `decision-table` | 4 | 入力の組合せで結果が分かれる判定 | `has-input`（等価分割・境界値）と重なる。線引きを決めずに足すと、どちらを書いても片方が欠けたままになる |
| `db-migration` | 2 | スキーマを持つ要件 | 往復の検査は `tests/integration/` 側にあり、要件ではなくテーブル単位で並んでいる。要件へ結び直す作業が先に要る |
| `property` | 5 | 手法であって性質ではない | 「性質テストを書くべき要件」を機械で言い当てられない。無理に性質を作ると、当たった要件が全部除外理由を書くことになる |

**指されない種別は、一度も要求されない。**一覧に名前があるだけで、門としては無い。
この 5 つは `ah-0ip` から切り出して起票した（`ah-wes` /
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
