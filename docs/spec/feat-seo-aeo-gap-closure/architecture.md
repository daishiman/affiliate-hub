# 層境界と組込点

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P02`
- 状態: 確定 (P02 成果物)
- 姉妹文書: [data-model.md](./data-model.md) / [api-contract.md](./api-contract.md)
- 上流: [requirements-baseline.md](./requirements-baseline.md) / [derivation-rules.md](./derivation-rules.md) / [retention-policy.md](./retention-policy.md)

## 全体像

本 feature が足すのは 3 本の経路であり、どれも既存の経路を**分岐させずに末端へ足す**。

```
                       ┌─ buildHowTo      (新) ─┐
公開ページ ── articleJsonLd ─┤                        ├─→ <script type="application/ld+json">
                       └─ buildSpeakable  (新) ─┘

publishArticle ──→ auditArticleForAiSearch (既存) ──→ recordAiSearchAudit (新) ──→ D1
                                                          ↑
scheduled(cron) ──→ reauditStaleArticles (新) ────────────┘

管理画面 ──→ listFailingAudits (新) ──→ D1 (最新行だけを読む)
```

## A. 構造化データ (HowTo / Speakable)

### 置き場

`src/application/seo/structured-data.ts` に `buildHowTo` と `buildSpeakable` を足す。
新しいファイルを作らない。既存の `buildBlogPosting` / `buildFaqPage` / `buildItemList` /
`buildBreadcrumbList` が同居しており、JSON-LD の組み立ては 1 か所に集めるという既存の
配置がある。分けると「どの JSON-LD がどこにあるか」を探す手間が増えるだけで、
得るものが無い。

### 署名

```ts
export function buildHowTo(
  article: PublishedArticle,
  site: SiteJsonLdInput,
): JsonLdObject | null;

export function buildSpeakable(article: PublishedArticle): JsonLdObject | null;
```

`buildHowTo` が `site` を取るのは `mainEntityOfPage` に記事 URL を出すため
(`buildBlogPosting` と同じ)。`buildSpeakable` は `cssSelector` しか出さないので
`site` を取らない。**取らない引数を「対称性のために」足さない** —
常に使われない引数は、いつか誰かが使い方を誤る。

### 純関数であること

既存の 5 つの builder と同じく fetch も環境変数も読まない。
`expressionBlocksOf` を通す点も同じ。ただし `buildHowTo` だけは
`article.sections` を直接引く — 手順は表現ブロックではないという D1 の帰結。

### 呼び出し側

公開ページの JSON-LD 組み立て箇所で、`null` のときはそのまま出さない。
`buildFaqPage` / `buildItemList` が既に `null` を返しており、呼び出し側は
`null` を「出さない」に写す形になっている。同じ形に合わせる。

### Speakable の selector

D2 が「安定した selector を持たせる」とだけ決め、実際の文字列は P02 が決める。

| 対象 | selector | 付ける場所 |
|---|---|---|
| 冒頭の結論 | `[data-speakable="answer"]` | `summary` を描く要素 |
| 要点 | `[data-speakable="key-points"]` | `keyPoints` を描く要素 |

**装飾クラスではなく `data-*` 属性にする。** クラス名はデザイン変更で
消える・改名される。`data-speakable` は用途が名前に書いてあるので、
消す前に「これは何のためか」が読む人に分かる。属性セレクタは
CSS のクラス設計と独立しており、Tailwind のようなユーティリティ主体の
スタイリングとも衝突しない。

## B. 点検履歴の記録

### 層の割り当て

| 層 | 置き場 | 責務 |
|---|---|---|
| domain | (新規なし) | 保持窓の値は application 層の定数。判定ロジックを持つドメイン概念ではない |
| application | `src/application/usecases/seo/record-ai-search-audit.ts` (新) | 点検結果 1 件を追記し、保持窓を超えた分を落とす |
| application | `src/application/usecases/seo/reaudit-stale-articles.ts` (新) | 最終点検から 7 日以上経った公開記事を再点検する |
| infrastructure | 既存の D1 リポジトリ実装に追加 | テーブルの読み書き |

**`auditArticleForAiSearch` は変更しない。** あれは純関数の判定で、
保存の関心を持たせると「点検したら記録される」という副作用が
テストからも呼び出し側からも見えなくなる。記録は別の usecase が
判定結果を受け取って行う。

### publish 経路への組込点

`src/application/usecases/site/publish-article.ts:488` は
`createAuditArticleDraftUseCase`（**下書きの試し点検**）であり、
ここは保存しない経路として明示されている（「保存は一切しない」）。
記録を足すのはここではない。

実際の公開が通る経路 —
`src/presentation/admin/publish/publish-article-action.ts:190` の
`if (published.ok) aiSearch = auditArticleForAiSearch(published.value);` —
の直後に `recordAiSearchAudit` を呼ぶ。**公開が成功した後**なので、
公開されなかった記事の点検結果が履歴に混ざらない。

記録の失敗で公開を巻き戻さない。公開は既に済んでおり、
記録できなかったことを理由に読者から記事を取り上げるのは筋が通らない。
失敗は記録側のログに残し、次の定期再点検が拾う。

### 契機 (trigger) の値

`"publish"` と `"scheduled"` の 2 値。R3 が「テーブルは分けない」と決めており、
どちらの経路で入った行かを列で区別する。

## C. 定期再点検 (scheduled)

### 入口

`worker-entry.js` に `scheduled` ハンドラを足す。`wrangler.jsonc` の
3 箇所（トップ / dev / production）が既に `"crons": ["0 17 * * *"]` を宣言しており、
**新しい cron 式を足さない**（R2）。

```
scheduled(event, env, ctx) → reauditStaleArticles(deps, { now: new Date(event.scheduledTime) })
```

`event.scheduledTime` を使い、`new Date()` を新たに読まない。
Cron の起動時刻と処理内で見る時刻が数百 ms ずれると、
「最終点検から 7 日」の境界にいる記事が回によって入ったり入らなかったりする。

### 対象の選び方

1. `published_articles` のうち `archived_at IS NULL`（読者に出ている記事だけ）
2. その記事の点検履歴の最新 `checked_at` が `now - 7日` より古い、または履歴が 1 件も無い
3. `checked_at` の古い順（履歴の無い記事を最優先）

1 回の起動で処理する件数に上限を置く（下記）。

### 1 回あたりの上限

**1 起動 50 件**とする。

Cloudflare Workers の scheduled ハンドラには CPU 時間の制限がある。
点検自体は純関数で速いが、記事 1 本ごとに `article_json` を読んで
projection を組み立てる読み取りが要る。無制限にすると、記事が増えた日に
起動が途中で打ち切られ、**どこまで進んだか分からない**まま終わる。

50 件 × 毎日 = 週 350 件の再点検能力があり、R1 が想定する
「1 記事あたり週 1 回」なら記事 350 本まで賄える。
上限に達した回は残りを次の日が拾う（古い順に選ぶので、
取り残された記事が永久に後回しになることはない）。

### 同じ入力を見る

`dec-aeo-analysis-trigger` の「解析関数は生成関数と同じ入力を見る」を守る。
再点検も公開時と同じ `auditArticleForAiSearch(article: PublishedArticle)` を呼ぶ。
`published_articles.article_json` を `PublishedArticle` へ戻したものを渡す。
再点検専用の軽量な入力を作らない — 作ると、公開時に落ちなかった記事が
再点検で落ちる（またはその逆）という経路依存の判定になる。

## D. 管理画面の一覧

### 置き場

- usecase: `src/application/usecases/seo/list-failing-audits.ts` (新)
- 画面: 管理画面の SEO 系ページに一覧を追加

返却形は [api-contract.md](./api-contract.md) が定める。

### 「新たに落ちた」の意味

A5 は「再点検で新たに落ちた記事」を求める。**最新の点検で落ちている記事**を
出す（前回との差分ではない）。

差分にしない理由: 差分は「前回も落ちていて今回も落ちている記事」を隠す。
落ちたまま放置された記事こそ運営者が見るべきものであり、
一度見逃したら二度と一覧に出ないのは、通知としてはともかく
**一覧としては欠陥**である。

## 触るファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/application/seo/structured-data.ts` | 変更 | `buildHowTo` / `buildSpeakable` を追加 |
| `src/db/schema.ts` | 変更 | 点検履歴テーブルを追加 |
| `drizzle/00xx_*.sql` | 新規 | 上記テーブルのマイグレーション |
| `src/application/usecases/seo/record-ai-search-audit.ts` | 新規 | 追記と刈り取り |
| `src/application/usecases/seo/reaudit-stale-articles.ts` | 新規 | 定期再点検 |
| `src/application/usecases/seo/list-failing-audits.ts` | 新規 | 一覧の取得 |
| `worker-entry.js` | 変更 | `scheduled` ハンドラ |
| `src/presentation/admin/publish/publish-article-action.ts` | 変更 | 公開後に記録を呼ぶ |
| 公開ページの JSON-LD 箇所 | 変更 | HowTo / Speakable を出す |
| 公開ページの結論・要点の要素 | 変更 | `data-speakable` 属性 |
| `tests/**` | 新規 | P04 が設計、P05 が実装 |

`resource_scope` の 6 要素（`src` / `drizzle` / `tests` / `worker-entry.js` /
`docs/spec` / `system-spec`）にすべて収まる。

## この文書が扱わないこと

- 列名・型・索引の具体（[data-model.md](./data-model.md) が所有する）
- 返却形の具体（[api-contract.md](./api-contract.md) が所有する）
- テストケースの設計（P04 が所有する）
