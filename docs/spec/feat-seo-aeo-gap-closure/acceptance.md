# 受入判定: A1-A6

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P07`
- 状態: 確定 (P07 成果物)
- 読んだもの: [requirements-baseline.md](./requirements-baseline.md) / [test-run.md](./test-run.md)
- 判定日: 2026-09-04

## 0. この判定の立ち位置

**受入は「テストが緑」とは別の問いである。**
とくに A5 は「`hint` が人間に読める文言として画面に出ているか」であって、
`AiSearchCheck` に `hint` フィールドが存在することとは同じではない。

そこで各判定には次の 2 つを分けて書く。

- **根拠**: 何を見てそう言えるか（実装の該当箇所と、それを見ているテスト）
- **この判定が見ていないもの**: 根拠が届いていない範囲

「全部 PASS」とだけ書いた表は、次に読む人にとって何の役にも立たない。

## 1. 判定表

| 受入 | 判定 | 主な根拠 |
|---|---|---|
| A1 HowTo の出力と非出力 | **PASS** | `buildHowTo` が `steps` 節 0 件で `null` |
| A2 Speakable の出力と実在する指し先 | **PASS** | `buildSpeakable` + 公開ページの `data-speakable` 属性 |
| A3 公開時の追記と保持窓 30 | **PASS** | `publish-article.ts` の追記 + 追記と同一トランザクションの刈り取り |
| A4 定期再点検と同一履歴への追記 | **PASS** | `runScheduledAiSearchReaudit` + `trigger: "scheduled"` |
| A5 落ちた記事の一覧と読める理由 | **PASS** | 画面が `check` ではなく `hint` を出している |
| A6 既存挙動の不変 | **PASS（P08 後の再確認が必要）** | 全量 474 files / 10672 tests 失敗 0 |

## 2. 各受入の判定

### A1: 手順ブロックを持つ記事に HowTo が出て、手順なしの記事には出ない

**判定: PASS**

**根拠**

- `src/application/seo/structured-data.ts#buildHowTo` は `paragraphsOfSection(article, "steps")` の
  結果が 0 件のとき `null` を返す。`paragraphsOfSection` は空白のみの段落を落とす
  (`p.trim() !== ""`) ので、「空の段落が 1 つある `guide`」でも `null` になる。
- `step` 配列は `steps.map(...)` なので、要素数は非空段落数と一致する。
  段落を落とす処理も足す処理も間に無い。
- 検査は `tests/application/seo/structured-data.test.ts`。

**記事型による分岐を書いていないこと（設計判断）**

反例「`guide` 以外の記事型で HowTo が出る」に対して、実装は**記事型を見ていない**。
`steps` 節を持つのは `ARTICLE_TYPE_SECTIONS` 上 `guide` だけなので、
他の型では `paragraphsOfSection` が空配列を返し、構造から自動的に `null` になる。

型を見た分岐を足すと、同じ判断が「節の定義」と「builder の分岐」の 2 か所に載る。
節の定義が変わった日に、片方だけ古いまま残る。

**この判定が見ていないもの**

- `ARTICLE_TYPE_SECTIONS` に将来 `guide` 以外の型へ `steps` 節が足された場合、
  その型でも HowTo が出る。これは仕様変更として扱うべきで、
  今の実装は「`steps` 節を持つ記事は手順記事である」という前提に乗っている。

### A2: 結論・要点ブロックを持つ記事に Speakable が出る

**判定: PASS**

**根拠**

- `buildSpeakable` は `article.summary` が非空なら `[data-speakable="answer"]` を、
  `article.keyPoints` が 1 件以上なら `[data-speakable="key-points"]` を積む。
  どちらも空なら `null`（読み上げ先の無い `speakable` を出さない）。
- `cssSelector` の**指し先が実在すること**は `tests/ui/article-speakable-anchor.test.tsx` が
  公開ページの DOM を描いて確かめている。selector を定数として共有しているので、
  片方だけ変えると赤くなる。

**この判定が見ていないもの**

- 実際の読み上げ機構（音声アシスタント）がその要素をどう読むかは検査していない。
  確かめているのは「指した先に要素がある」までで、
  「読んで意味が通る」は人が記事を書くときの責任に残る。

### A3: 公開のたびに追記され、保持窓を超えた古い分だけが落ちる

**判定: PASS**

**根拠**

- 公開 1 回につき 1 行。`src/application/usecases/site/publish-article.ts` が
  `auditArticleForAiSearch(article)` の結果を履歴へ渡す。
- 保持窓は `AUDIT_HISTORY_WINDOW = 30`（[retention-policy.md](./retention-policy.md) の D3）。
- **刈り取りは追記と同じトランザクション**に入っている
  (`src/infrastructure/persistence/d1/ai-search-audit-history-repository.ts`)。
  夜間バッチを持たないので「追記されたが刈り取られていない状態」が
  観測できる時間帯が無い。
- 31 件目で最古の 1 行だけが消えること、それ以外の行が不変であることは
  `tests/integration/d1-ai-search-audit-history.test.ts` が **D1 実機**で確かめている。
  刈り取りの判定は SQL の中にあるので、port の代役では検査にならない。

**削除の並びに `id DESC` を第 2 キーとして入れていること**

`checked_at` が同秒の行が複数あると、`ORDER BY checked_at DESC` だけでは
「残す 30 件」が実行のたびに変わりうる。同秒の追記は実際に起きる
（同じ公開処理の中で複数記事を公開する場合）。

### A4: 定期実行で再点検され、同じ履歴へ追記される

**判定: PASS**

**根拠**

- `wrangler.jsonc` の `crons: ["0 17 * * *"]`（トップレベルと dev / production の 3 か所すべて）。
- `worker-entry.js` の `scheduled(controller, env, ctx)` が
  `runScheduledAiSearchReaudit(env.DB, now)` を呼ぶ。
  `now` は `new Date(controller.scheduledTime)` で、**途中で `new Date()` を呼ばない**。
  呼ぶと、テストで時刻を差し込めなくなる。
- 対象は最終点検から `REAUDIT_AFTER_DAYS = 7` 日以上経った公開済み記事のみ。
  1 起動あたり `REAUDIT_BATCH_LIMIT = 50` 件まで。
- 行は A3 と**同一テーブル・同一行形状**で、`trigger` 列が `"scheduled"`。
  `AUDIT_TRIGGERS = ["publish", "scheduled"]` が値域の正本。
- 「1 回転で同一記事に 2 行以上追記しない」は `listStale` が記事ごと 1 件を返す形
  （最新の点検が古い記事の一覧）であることによる。

**保存先がつながっていないときの振る舞い**

`worker-entry.js` は `env.DB` が無いとき
`console.warn("[ai-search-reaudit] 保存先がつながっていないので、再点検を行いませんでした")`
を出して**先へ進む**。cron 全体を落とさない。
黙って何もしないと「再点検が回っている」と誤解される。

### A5: 落ちた記事が一覧に現れ、落ちた理由が読める

**判定: PASS**

**根拠**

- `src/app/admin/content/published/page.tsx` の一覧は、各行の「直すところ」列に
  `{item.hint}` を出している。**`item.check`（内部の識別子）ではない。**
  これが A5 の核で、反例「出るが理由が読めず `check` の識別子だけが出る」を直接外している。
- 「落ちた」の定義（最新の履歴行に `ok: false` が 1 件以上）は
  `src/application/usecases/seo/list-failing-audits.ts` が持ち、
  **先週落ちて今週直った記事は出さない**ことを `tests/application/list-failing-audits.test.ts` が確かめている。
- 0 件のときは節ごと消さず「落ちている記事はありません」を出し、列名だけの空表を出さない。
  節ごと消すと「点検が壊れて 0 件になった日」と見分けが付かない。
- 上限で切ったときは「上限まで表示しています」と告げる。
  黙って切ると「落ちているのはこの 50 件で全部」と読まれる。
- 検証は可視ラベルと DOM の textContent で行い、座標やクラス名に依存していない
  (`tests/ui/published-articles-failing-audits.test.tsx`)。

**この判定が見ていないもの**

- **人がブラウザで見て判断していない。** 根拠は「描いた DOM に hint の文言が現れる」まで。
  文言そのものが運営者にとって行動可能かは、`ai-search-audit.ts` の 7 件の hint を
  書いた時点の判断に乗っている。
- キーボード到達は `href` を持つ `<a>` であることからの推定で、実際に Tab を押してはいない
  （既存 `tests/ui/keyboard-operation.test.tsx` と同じ前提）。

### A6: 既存の挙動が変わらない

**判定: PASS（ただし P08 の後で再確認が必要）**

**根拠**

- 全量 `pnpm vitest run --reporter=dot` = **474 files / 10672 tests、失敗 0 件**
  ([test-run.md](./test-run.md))。既存 builder 7 関数
  (`buildBlogPosting` / `buildItemList` / `buildBreadcrumbList` / `buildFaqPage` /
  `buildBlogOpsFaqPage` / `buildBlogOpsPosting` / `serializeJsonLd`) を見ているテストは
  すべてこの中にあり、いずれも緑。
- `auditArticleForAiSearch` の 7 チェックの判定ロジックは**触っていない**。
  足したのは永続化（結果を保存する側）だけ。
- `serializeJsonLd` の `<` → `<` 置換（記事本文からの XSS 阻止）は残っている。

**なぜ「P08 後の再確認が必要」と書くか**

P08 は `src/application/seo/` の JSON-LD 組み立て経路を整理する。
整理は挙動を変えない前提の作業だが、**前提が守られたことは実行して初めて言える**。
A6 の判定は「今この時点で不変」であり、P08 の変更を跨いだ保証ではない。
P11（証跡の集約）で、P08 の後の全量結果に対して再度この項を確認する。

## 3. 未達 0 件

A1-A6 に未達なし。ただし上の各「この判定が見ていないもの」は、
**未達ではないが保証もしていない範囲**として P10（残課題の確定）へ引き継ぐ。
