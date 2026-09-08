# 設計レビュー: 要求の被覆と既存実装との重複有無

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P03`
- 状態: 確定 (P03 成果物)
- 読んだもの: [architecture.md](./architecture.md) / [data-model.md](./data-model.md) / [api-contract.md](./api-contract.md) / [requirements-baseline.md](./requirements-baseline.md)
- 実行日: 2026-09-04

## 判定

**条件付き PASS。** 重複は 0 件。要求 A1〜A6 の被覆にも穴は無い。
ただし設計文書に **3 件の是正**が要る (下記 F1〜F3)。いずれも設計の
方針そのものではなく、**設計が指している既存コードの実態と食い違っている記述**である。
P05 は下記の是正後の記述に従って実装する。

本 phase の write scope は本文書 1 件なので、`architecture.md` 自体は書き換えていない。
是正の適用先と内容を F ごとに明記する。

---

## 1. 重複の検査 (この feature の存在根拠)

本 feature は撤回した 2 feature から「`src/` への grep が 0 件だった 3 項目」だけを
残した差分 feature である。その前提が今も成り立つかを実測した。

### 1-1. 足すものが既に無いこと

| 足すもの | 検査 | 結果 |
|---|---|---|
| HowTo の JSON-LD | `grep -rn "buildHowTo\|\"HowTo\"\|'HowTo'" src/` | **0 件** |
| Speakable の JSON-LD | `grep -rn "buildSpeakable\|speakable\|Speakable" src/` | **0 件** |
| 点検履歴の保存 | `grep -rn "ai_search_audit\|aiSearchAuditHistory\|auditHistory" src/db/schema.ts drizzle/` | **0 件** |

3 項目とも実装が無い。差分 feature の前提は保たれている。

### 1-2. 触らないもの (scope_out) が実在し、設計が変更を宣言していないこと

| scope_out | 実体 | 設計での扱い |
|---|---|---|
| JSON-LD 導出本体 | `src/application/seo/structured-data.ts` の既存 7 関数 | 関数を **足すだけ**。既存 7 関数の本体に変更なし |
| llms.txt | `src/app/s/[site]/llms.txt/route.ts` | 言及なし = 変更なし |
| IndexNow | `src/app/indexnow.txt/route.ts`, `src/infrastructure/indexnow/indexnow-client.ts`, `src/domain/seo/indexnow.ts`, `src/application/seo/indexnow-outcome-audit.ts` | 言及なし = 変更なし |
| sitemap | `src/app/s/[site]/sitemap.xml` | 言及なし = 変更なし |
| RSS | `src/application/seo/feeds.ts` | 言及なし = 変更なし |
| 出典レジストリ | `src/domain/seo/guideline-reference.ts`, `src/app/admin/settings/seo/page.tsx` | 言及なし = 変更なし |
| 公開時点検の判定ロジック | `src/application/seo/ai-search-audit.ts` | architecture.md が「**変更しない**」と明記 |

`architecture.md` の「触るファイル一覧」10 行に、上表の実体は 1 つも入っていない
(`structured-data.ts` は同一ファイルだが、既存関数の本体ではなく追加関数のみ)。
**重複 0 件。**

---

## 2. 是正が要る指摘

### F1 (中): `scheduled` ハンドラは既に存在する

`architecture.md` の C 節は「`worker-entry.js` に `scheduled` ハンドラを足す」と書き、
署名を `scheduled(event, env, ctx)`、時刻を `event.scheduledTime` としている。

**実態**: `worker-entry.js:44` に既に `async scheduled(controller, env, ctx)` があり、
`ctx.waitUntil` の独立ブロックを 4 本持つ (写しの掃除 / 配信監査 outbox /
予約配信 / 技術診断の保持期限)。`controller.scheduledTime` から `now` も
45 行目で既に算出されている。

そのまま実装すると、**既存の 4 本を持つハンドラを新しいハンドラで置き換える**か、
`event` という存在しない引数を参照して壊れるかのどちらかになる。

**是正 (P05 はこう実装する)**:

- ハンドラを新設せず、既存 `scheduled` の中に **5 本目の `ctx.waitUntil` ブロック**を足す。
- 引数名は `controller`。時刻は 45 行目の既存 `now` を再利用し、`new Date()` も
  `event.scheduledTime` も書かない。「Cron の起動時刻と処理内で見る時刻をずらさない」という
  architecture.md の意図は、既存 `now` の再利用でそのまま満たされる。
- 既存 4 本と同じ作法に従う: `env.DB === undefined` の早期 return、
  独立した `ctx.waitUntil` (他の掃除と道連れにしない)、例外は投げ返さず
  `console.error` に落とす (次の回が拾う)。

この作法は `worker-entry.js` の冒頭コメントが理由込みで書いている
(「一つにまとめると、置き場がつながっていない環境で、こちらまで一緒に止まる」)。
再点検も同じ性質を持つ — 失敗しても読者の画面には影響せず、次の日が拾える。

### F2 (中): 管理画面の置き場が触るファイル一覧から欠けている

`architecture.md` の D 節は置き場を「管理画面の SEO 系ページに一覧を追加」とだけ書き、
**触るファイル一覧の 10 行に管理画面のファイルが 1 行も無い**。A5 は管理画面の一覧を
求めているので、このままでは受入を満たすファイルが計画に存在しない。

さらに「SEO 系ページ」を字面どおり取ると `src/app/admin/settings/seo/page.tsx` になるが、
そこは**出典レジストリ = scope_out の画面**であり、`admin-screen-task-manifest.ts:106` が
宣言する目的は「SEO/AI 指針の出典を登録し、90 日超を再確認する」。
落ちている記事の一覧は、この目的に属さない。

**是正 (P05 はこう実装する)**: 一覧の置き場は
`src/app/admin/content/published/page.tsx` とする。同 manifest の 64 行が宣言する
この画面の目的は **「読者に出ている記事から、訂正する 1 本を探す」** であり、
A5 の用途 (落ちている記事を見つけて直す) と一致する。既存画面へ節を 1 つ足す形なので、
feature の scope_out「管理画面の単一用途画面再編」にも触れない。

触るファイル一覧へ次の 2 行を足す:

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/app/admin/content/published/page.tsx` | 変更 | 落ちている記事の節を追加 |
| `src/presentation/composition.ts` | 変更 | `listFailingAudits` の合成を追加 |

`composition.ts` は既存の管理画面が usecase を受け取る合成点
(`guidelineReferenceEntry` などがここに居る)。api-contract.md が
「usecase 直呼び」と決めた以上、合成点を通るのは必然であり、
一覧に無いと P05 が触ってよいか判断できない。

いずれも `resource_scope` の `src` に収まる。

### F3 (小): 結論・要点の要素のファイルが特定されていない

`architecture.md` の触るファイル一覧の 10 行目は「公開ページの結論・要点の要素」と
書くだけで、ファイルが定まっていない。D2 の selector を付ける相手を P05 が
探し直すことになり、取り違えの余地が残る。

**是正**: `src/presentation/ui/templates/article-view.tsx` と名指しする。実測した位置:

| 対象 | 現在の要素 | 足す属性 |
|---|---|---|
| 冒頭の結論 (`article.summary`) | `article-view.tsx:391` の `<p className={styles.articleSummary}>` | `data-speakable="answer"` |
| 要点 (`article.keyPoints`) | `KeyPointsSection` (同 262-273 行) の `<section id="key-points">` | `data-speakable="key-points"` |

**取り違え注意**: 同ファイルの `MOVABLE_BLOCKS` に含まれる `"summary"` は
**目次**を指す別物である (325 行のコメント「目次を `summary` の中に入れてあるのは、
目次が指す先が節そのものだからである」)。読み上げ対象は目次ではなく
`article.summary` (391 行) の方。ここを取り違えると、読み上げ機構に目次を
読み上げさせる `speakable` が出る。

---

## 3. 是正不要と判断した観測

### O1: `key-points` には既に `id` があるが、それでも `data-speakable` を足す判断は妥当

`KeyPointsSection` は既に `id="key-points"` を持つので、`#key-points` を
`cssSelector` に使うこともできた。それでも `data-speakable` を新設する
architecture.md の判断を支持する — 結論側 (`<p className={styles.articleSummary}>`) には
安定した識別子が無く、片方を `id`・片方を `data-*` にすると、
読み上げ対象の探し方が 2 通りになる。2 通りあるものは、片方だけ直される。

### O2: A3 の「最古の 1 行だけが消える」と data-model.md の DELETE 文は矛盾しない

`requirements-baseline.md` の A3 は「31 件目の追記時に最古の 1 行だけが消え」と書き、
`data-model.md` の刈り取りは「上位 30 件以外を消す」と書く。
30 件溜まった状態からの 1 回の追記では、両者は同じ 1 行を消す。
「上位 30 件以外」は、40 件溜まった異常状態からも 1 回で戻れるようにする
より強い規則であり、A3 の判定を破らない。P04 は両方を境界値として持てばよい。

### O3: `structured-data.ts` へ関数を足すことは A6 の「既存 builder の出力が変わらない」を破らない

既存 7 関数はいずれも純関数で、モジュールに関数が増えても呼び出し結果は変わらない。
`buildBlogPosting` の返り値へ `howTo` や `speakable` を混ぜ込む設計にはなっておらず、
新しい JSON-LD は呼び出し側 (`article-page.tsx`) が別の `<JsonLdScript>` として
出す形になっている。既存の JSON-LD の中身は動かない。

---

## 4. 要求 A1〜A6 の被覆確認

| 受入 | 設計上の担い手 | 被覆 |
|---|---|---|
| A1 HowTo | architecture.md A (`buildHowTo`) + derivation-rules D1 (`steps` 節 → `step`) + 呼び出し側は `null` を出さない | OK |
| A2 Speakable | architecture.md A (`buildSpeakable`, selector 2 種) + F3 で要素を特定 | OK (F3 適用後) |
| A3 公開時の追記と保持窓 | architecture.md B (組込点 = `publish-article-action.ts:190` の直後) + data-model.md (テーブルと刈り取り SQL) | OK |
| A4 定期再点検 | architecture.md C (対象の選び方・50 件上限・同じ入力を見る) | OK (F1 適用後) |
| A5 管理画面の一覧 | api-contract.md (入出力・並び・抽出条件) + F2 で置き場を特定 | OK (F2 適用後) |
| A6 既存挙動の不変 | 本文書 1 節 (重複 0 件) + O3 | OK |

A5 の反例「すべて通っている記事が一覧に混じる」は api-contract.md の抽出条件
(最新の点検で `passed_count < total_count`) が塞ぐ。
A4 の反例「公開済みでない記事を点検する」は architecture.md の対象条件
(`published_articles` かつ `archived_at IS NULL`) が塞ぐ。
**要求側の穴は無い。**

## 5. この文書が扱わないこと

- 是正の適用そのもの (P05 が実装時に行う。本 phase の write scope は本文書のみ)
- テストケースの列挙 (P04 が所有する)
- マイグレーションの前方互換検証 (P08 が所有する)
