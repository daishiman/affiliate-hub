# 最終レビューと残課題の確定

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P10`
- 状態: 確定 (P10 成果物)
- 読んだもの: [acceptance.md](./acceptance.md) / [quality-assurance.md](./quality-assurance.md) / [design-review.md](./design-review.md) / [evidence.md](./evidence.md) / [migration-compatibility.md](./migration-compatibility.md) / [test-design.md](./test-design.md)
- 実施日: 2026-09-04

## 0. 結論

**この feature は完了してよい。受入 A1-A6 は全て PASS、非機能 N1-N4 も全て PASS。**

ただし「PASS」は 2 種類ある。

- **満たしている**（要件どおりに動き、それを見ている検査がある）
- **満たしているが保証していない**（動くと言える根拠が推定や設計値に留まる）

後者を「残課題」と呼ぶ。**未達ではない**ので、この feature を止める理由にはならない。
一方で放っておくと、次に触る人が「緑だから確かめ済み」と読む。
本文書はその境界を引くために書く。

## 1. 残課題の切り分け

`本 feature 内` は、この feature を閉じる前に手当てすべきもの。
`follow-up` は、別 feature として扱うべきもの。

| # | 課題 | 種別 | 切り分け | 理由 |
|---|---|---|---|---|
| R1 | 記事 350 本超で「7 日以内に全件再点検」が破綻する | 未保証 | **follow-up** | 現規模（サイト 2 件・記事数本）から 2 桁遠い。手当ては cron 頻度の変更で、この feature の scope 外 |
| R2 | 刈り取りの `workspace_id` 単独の効きが観測できない | 未保証 | **follow-up** | 観測には `site_blueprints` の一意制約を跨ぐ仕込みが要る。テスト基盤側の課題 |
| R3 | 実 D1 での 1 件あたり実行時間が未測定 | 未保証 | **follow-up** | 実環境が要る。P13 のリリース後に初めて測れる |
| R4 | 管理画面の一覧を人がブラウザで見ていない | 未保証 | **本 feature 内** | P13 の手動確認で消せる。実環境も新規実装も要らない |
| R5 | キーボード到達を実際に Tab で押していない | 未保証 | **本 feature 内**（対処せず） | 2 節 |
| R6 | 音声アシスタントが Speakable をどう読むかは未検証 | 対象外 | **仕様** | 2 節 |
| R7 | `ARTICLE_TYPE_SECTIONS` に `guide` 以外の型が `steps` 節を持つと HowTo が出る | 未保証 | **follow-up 不要** | 2 節 |
| R8 | 初回投入から数日、管理画面の一覧が過少表示になる | 仕様 | **本 feature 内** | 運用手順（P12）へ引き継ぐ |

## 2. 「対処しない」と決めたものの理由

**残課題を全部やる、が常に正しいわけではない。**
やらない判断こそ理由が要る。

### R5: キーボード到達の実押下

`tests/ui/keyboard-operation.test.tsx` を含む**既存の全 UI テストが同じ前提**に乗っている
（`href` を持つ `<a>` はキーボードで到達できる、という HTML の規約への信頼）。
この feature だけ実押下に切り替えると、検査の厳しさがこの 1 画面でだけ違う状態になる。
**基準がまちまちなテスト群は、どこが緩いか誰も言えなくなる。**
変えるなら全画面まとめてで、それはこの feature の仕事ではない。

### R6: 音声アシスタントの読み上げ

Speakable が保証するのは「読み上げ機構に、ここを読めと指す」までである。
指した先が読んで意味の通る文かは、**記事を書く人の責任**であって機構の責任ではない。
仕組み側で担保しようとすると、文章の良し悪しを機械が判定することになる。
これは feature の scope ではなく、そもそも解くべき問題が違う。

### R7: `steps` 節を持つ将来の記事型

今の実装は記事型を見ず、「`steps` 節がある = 手順記事」という前提に乗る
（[design-review.md](./design-review.md) の A1 節）。
`ARTICLE_TYPE_SECTIONS` に `guide` 以外で `steps` を足すのは**仕様変更**であり、
そのとき HowTo が出るのは事故ではなく設計どおりの帰結である。
「型ごとの分岐」を先回りで書くと、**まだ存在しない要求のための分岐**が
残り続ける。足す日に足すのが正しい。

## 3. 設計文書と実装がずれた箇所

**ずれた事実より、なぜずらしたかが要る。**理由の無いずれは、次に
「文書に合わせる」修正で静かに壊される。

### D1: `buildHowTo` が `tool` キーを出していない

[test-design.md](./test-design.md) の T1-5 は補助情報が
「`supply`・`tool`」へ写ると書くが、実装は `supply` にしか写していない。

**理由**: schema.org の `supply`（消費されるもの）と `tool`（消費されないもの）の
区別は、散文の `prerequisites` 節から機械的に付けられない。
両方へ同じ段落を出すと、同じ事実が 2 か所に載り、読む側には
**「材料でもあり道具でもあるもの」という嘘の構造**に見える。
実装のコメントに同じ理由が書いてある。

分けたいなら、記事側に「材料」「道具」の別の節を用意するのが先。
それは記事フォーマットの変更であり、この feature の scope 外。

### D2: T5-2 を単体ではなく D1 結合テストに置いた

[test-design.md](./test-design.md) の対応表は T5-1〜T5-3 を
`tests/application/list-failing-audits.test.ts`（単体）に置くと書くが、
T5-2「3 日前に落ちて昨日通った記事は出ない」は
`tests/integration/d1-ai-search-audit-history.test.ts:484` にある。

**理由**: T5-2 は「**最新の行だけを見る**」ことの検査で、
判定の主体が SQL 側（`listLatestFailing` の集約）にある。
単体テストで偽の repository を置くと、**その偽物に「最新だけ返す」と書いた自分を
検査するだけ**になり、本物の SQL が間違っていても緑になる。
実 D1 に履歴 2 件を入れて初めて判定が割れる。

### D3: `traceability.md` への要件追記を P12 ではなく P05 で行った

[test-design.md](./test-design.md) の 308 行は
`docs/product/traceability.md` への `REQ-SEO06` / `REQ-SEO07` 追加を P12 の仕事とする。
実際は P05 で行った。

**理由**: `node scripts/traceability.mjs` が P05 の時点で exit 1 になったため
（[test-run.md](./test-run.md) の 2 番）。新しいテストが名乗る要件 id が要件表に無いと
ゲートが落ちる。P12 まで待つと、その間ずっと赤いままになる。
**ゲートを緑にするために要件表を後回しにできない**という順序の制約が、
計画時に見えていなかった。

P12 は同じ作業を繰り返さず、追記済みであることを確認するだけでよい。

## 4. 実装として残っている借り

**ここは未保証ではなく、実際に直すべきもの。**

前区間に `db.batch` へ `db.run(sql)` の結果を渡している箇所を見つけ、修正済み。
`db.batch` は**未実行のステートメント配列**を取るが、`db.run` はその場で実行して
結果を返すので、渡した時点でトランザクションの外で走っていた。
追記と刈り取りが同一トランザクションに入るという
[retention-policy.md](./retention-policy.md) の R4 が、修正前は成り立っていなかった。

現在は `d1-ai-search-audit-history.test.ts` の保持窓 5 件が
この性質を見ている。**残っている借りは無い。**

## 5. 品質ゲートの最終状態

| ゲート | 結果 |
|---|---|
| `pnpm vitest run --reporter=dot` | 474 files / 10673 tests、失敗 0（397.77s） |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errors / warning 2（いずれも既存・変更行ではない） |
| `validate-system-plan.py` | `violations: []` |

再現手順は [evidence.md](./evidence.md) 1 節。

## 6. 後続 phase への引き継ぎ

| 宛先 | 引き継ぐもの |
|---|---|
| P12（運用手順と文書化） | R8（初回数日の過少表示）／D3（`traceability.md` は追記済みなので確認のみ）／R1 の対処方針（上限ではなく cron 頻度） |
| P13（開発環境へのリリース） | R4（管理画面を人が見る）／R3（実 D1 の所要時間をここで初めて測れる） |
| 次 feature の候補 | R1・R2・R3。いずれも実環境かテスト基盤の話で、この feature の実装には触れない |

## 7. この文書が扱わないこと

- 残課題の実装（follow-up は別 feature、本 feature 内のものは P12/P13 が持つ）
- system-spec への書き戻し（P13 が持つ）
- 手動確認の手順そのもの（P12 が運用手順として書く）
