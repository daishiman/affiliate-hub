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
| REQ-P09 | has-input, has-tenant, has-external, has-screen | fault-injection: ASP への実接続がスタブで、落とす外部接続が実在しない; idempotency: 成果の取込がスタブのため、同じ成果を 2 回受け取る経路そのものがまだ無い |
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
| REQ-SEC09 | has-input | boundary: 監査記録の入力は操作内容と差分で、大小の端が無い。見ているのは消す / 消さないの分かれ目だけ |

## 4. 未宣言の要件について（正直に書く）

要件表には **241 件**の要件 ID がある。上の宣言表はそのうち **36 件**である。
残り 205 件は未宣言で、**この検査の対象外**にある。

全部に宣言を書き切るまで検査を入れない、という順にすると**検査は永久に入らない**。
そこで `TRACEABILITY_MAX_UNLINKED` と同じ形にした。

- 未宣言の上限 `TEST_TYPES_MAX_UNDECLARED` を実測（205）に置く
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

同じ食い違いは `secrets` だけではない。`ssrf` / `audit-log` / `db-migration` /
`decision-table` / `property` も、どの性質からも指されていない。
**指されない種別は、一度も要求されない。**一覧に名前があるだけで、門としては無い。
この 6 つをまとめて `ah-0ip` で扱う。

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
