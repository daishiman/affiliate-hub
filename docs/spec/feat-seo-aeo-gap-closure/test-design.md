# テスト設計: 受入 6 件に対応するケース

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P04`
- 状態: 確定 (P04 成果物)
- 読んだもの: [design-review.md](./design-review.md) / [architecture.md](./architecture.md) / [data-model.md](./data-model.md) / [api-contract.md](./api-contract.md) / [requirements-baseline.md](./requirements-baseline.md)
- 実装は P05、実行は P06

## 0. 回帰の基準線

**基準線は「緑だった」ではなく「一度赤で、直してから緑にした」である。**
最初にこの節へ書いた「P04 時点で実行し現時点で緑」は事実ではなかった。実際に
`npx vitest run --reporter=dot` を通したところ **5 files / 52 tests が赤**で、
すべて本 feature とは無関係の system-spec harness 側の退行だった:

| ファイル | 内容 |
|---|---|
| `tests/architecture/chapter-confirmed-cell-transcript.test.ts` | 章の `## 確定セルの記録` が正本とずれていた |
| `tests/architecture/chapter-regeneration-floor.test.ts` | 同節が生成節になったのに定数へ未登録 |
| `tests/architecture/doctrine-citation-gap.test.ts` | 取得証跡の母数が 15 のまま (実測 19) |
| `tests/architecture/doc-source-version-gap.test.ts` | 同上 + 章別出典本数と鮮度例外 |
| `tests/architecture/blog-ui-spec-governance.test.ts` | 章の再生成で feature node の lineage digest が腐った |

赤を抱えたまま先へ進むと、P06 で出る赤が自分の変更由来かを切り分けられない。
そこで **P04 の中で 5 件すべてを根治**した (期待値を実測へ寄せるだけでなく、
腐る節を compile 生成へ移し、lineage は `upsert-node.py` で再 pin した)。

- 基準線の実測: **470 files / 10630 tests すべて緑** (2026-09-04)
- 取り直しコマンド: `npx vitest run --reporter=dot` (所要 約 5.5 分)
- `--reporter=basic` は現行 vitest v4.1.10 で使えない。`dot` を使うこと。

P06 はこの基準線に対して「新規ケースが増え、既存の失敗が 0 のまま」を確かめる。

> **この節に「緑だった」とだけ書き直さないこと。**赤を数えずに緑と書いた記録が
> 一度あったので、何が赤で何を直したかを残す。基準線の値打ちは数字ではなく、
> **その数字がどう作られたかが追えること**にある。

## 1. 既存の作法に合わせること

新しいテストは既存の 3 つの作法をそのまま継ぐ。**新しい作法を作らない。**

### 1-1. 先頭の docblock

```ts
/**
 * @tier 1
 * @req REQ-SEO06
 * @types equivalence, boundary
 */
```

`tests/application/seo/structured-data.test.ts` と同じ形。`@tier` は
1=単体 / 2=結合・画面。`@types` は `docs/product/required-test-types.md` の語彙。

### 1-2. `@req` の採番

既存は `REQ-SEO01`〜`REQ-SEO05` まで埋まっている
(`docs/product/traceability.md:1218-1222`)。本 feature は 2 件を新設する:

| 新 REQ | 内容 | 対応する受入 |
|---|---|---|
| `REQ-SEO06` | 手順記事と読み上げ向けの構造化データを読み取りモデルから導出する | A1, A2 |
| `REQ-SEO07` | AI 検索適合の点検結果を履歴として残し、公開後も定期に再点検する | A3, A4, A5 |

A6 は「既存の挙動が変わらない」なので新しい REQ を持たない。既存
`REQ-SEO01`〜`REQ-SEO05` のテストが緑のままであることが A6 の判定そのものである。

**`docs/product/traceability.md` への行追加は P12 の write scope**であり、
P04/P05 では触らない。ここは採番の予約と根拠の記録に留める。

### 1-3. D1 結合テストの入り方

`tests/integration/d1-*.test.ts` は例外なく `getPlatformProxy` +
`migrationStatements()` で始まる (`tests/integration/d1-indexnow-outcome-audit.test.ts:20-33`)。
本 feature の結合テストも同じ入り方にする。実 D1 を立てるので
`0044_ai_search_audit_history.sql` が適用され、**マイグレーションが壊れていれば
結合テストが落ちる**。スキーマの妥当性を別途検査する必要が無い。

## 2. 受入 → テストケース対応表

| 受入 | ケース id | 層 | ファイル |
|---|---|---|---|
| A1 | T1-1 〜 T1-5 | 単体 | `tests/application/seo/structured-data.test.ts` (追記) |
| A2 | T2-1 〜 T2-4 | 単体 | 同上 |
| A2 | T2-5 | 画面 | `tests/ui/article-speakable-anchor.test.tsx` (新規) |
| A3 | T3-1 〜 T3-5 | 結合 | `tests/integration/d1-ai-search-audit-history.test.ts` (新規) |
| A4 | T4-1 〜 T4-5 | 結合 | 同上 |
| A5 | T5-1 〜 T5-3 | 単体 | `tests/application/list-failing-audits.test.ts` (新規) |
| A5 | T5-4 〜 T5-5 | 画面 | `tests/ui/published-articles-failing-audits.test.tsx` (新規) |
| A6 | T6-1 〜 T6-3 | 回帰 | 既存スイート全体 + 追記 |

**新規ファイルは 4 件、追記は 1 件。** `structured-data.test.ts` へ追記するのは、
新しい builder が既存 6 builder と同じモジュール・同じ純関数の性質を持つためで、
分けると「同じ性質のものが 2 ファイルに散る」状態になる。

---

## 3. A1: HowTo (T1-1 〜 T1-5)

導出規則は [derivation-rules.md](./derivation-rules.md) の D1。

| id | 入力 | 期待 | 種別 |
|---|---|---|---|
| T1-1 | `type: "guide"`、`steps` 節に非空段落 3 件 | `@type === "HowTo"`、`step` の要素数が 3、各 `step` の本文が段落と同順・同文 | equivalence |
| T1-2 | `type: "guide"`、`steps` 節の `paragraphs` が `[]` | **`null`** (空の HowTo を出さない) | boundary |
| T1-3 | `type: "guide"`、`steps` 節そのものが無い | `null` | boundary |
| T1-4 | `type: "ranking"` / `"review"` / `"comparison"` / `"tool"` の 4 型 | いずれも `null` | equivalence |
| T1-5 | 補助情報 (`required_time` / `required_cost` / `prerequisites` / `outcome_state`) が有る記事と無い記事 | 有れば `totalTime` / `estimatedCost` / `supply`・`tool` / `description` に写る。無ければ**キーごと出ない** (`undefined` や `null` を値として置かない) | equivalence |

T1-4 で 4 型すべてを回すのは、`ARTICLE_TYPES` の 5 型から `guide` を引いた
残り全部が「出ない」側だからである。1 型だけ確かめると、型ごとの分岐が
入り込んだときに気づけない。

T1-5 の「キーごと出ない」は既存 builder の作法
(`buildItemList` / `buildFaqPage` が出せないものを省く) と揃える。
`"totalTime": null` を出すと、読む側には「所要時間が null という値だ」と見える。

### 壊して測る (P06 で実施)

`buildHowTo` の `step` 生成を `paragraphs.slice(0, 1)` に書き換えて T1-1 が赤になること。
`REQ-SEO01` が `buildPerson` の欠落で 10/10 緑だった前例
(`traceability.md:1218`) があるので、**書いたケースが本当に落ちるか**を測る。

---

## 4. A2: Speakable (T2-1 〜 T2-5)

導出規則は D2。

| id | 入力 | 期待 | 種別 |
|---|---|---|---|
| T2-1 | `summary` が非空、`keyPoints` が非空 | `speakable.cssSelector` に `[data-speakable="answer"]` と `[data-speakable="key-points"]` の 2 件 | equivalence |
| T2-2 | `summary` のみ非空 | selector 1 件 (`answer` のみ) | boundary |
| T2-3 | `keyPoints` のみ非空 | selector 1 件 (`key-points` のみ) | boundary |
| T2-4 | 両方空 (`summary: ""`、`keyPoints: undefined` または `[]`) | **`null`** | boundary |
| T2-5 | 公開ページを描画 | T2-1 の selector 2 件が、描画された DOM の要素に**実際に一致する** | screen-states |

### T2-5 が要る理由

T2-1 〜 T2-4 は「文字列が出た」しか見ない。`cssSelector` が
公開ページのどの要素にも当たらなくても、単体テストは全部緑になる。
requirements-baseline.md の A2 反例が名指ししているのがこれ
(「`cssSelector` が公開ページ上のどの要素にも一致しない = 読み上げ機構が
何も読めない `speakable` は嘘の宣言」)。

**測り方**: `tests/support/render` の `renderDom` で記事ビューを描き、
`container.querySelectorAll('[data-speakable="answer"]')` の件数が 1 であることを見る。
`renderMarkup` (文字列) ではなく `renderDom` を使う — 属性セレクタの一致は
文字列の部分一致では確かめられない。

これは「DOM 構造依存のテスト」ではない。見ているのは**属性の存在**であって
親子関係でも順序でも位置でもない。selector 自体が仕様なので、
selector が当たることを見るのは振る舞い検証である。

### 取り違えの検査

design-review.md の F3 が指摘した取り違え (`MOVABLE_BLOCKS` の `"summary"` は
目次) を塞ぐため、T2-5 は `[data-speakable="answer"]` に一致した要素の
テキストが **`article.summary` と一致する**ことまで見る。目次に属性が付いた場合、
テキストが節見出しの並びになるので落ちる。

---

## 5. A3: 公開時の追記と保持窓 (T3-1 〜 T3-5)

`AUDIT_HISTORY_WINDOW = 30` ([data-model.md](./data-model.md))。

| id | 状況 | 期待 | 種別 |
|---|---|---|---|
| T3-1 | 履歴 0 件の記事を 1 回公開 | 1 行増える。`trigger === "publish"`、`passed_count`/`total_count` が `auditArticleForAiSearch` の結果と一致、`checks_json` に 7 件の `{check, ok, hint}` | equivalence |
| T3-2 | 履歴 29 件の記事を 1 回公開 | 30 行になる。**1 行も消えない** (保持窓ちょうど) | boundary |
| T3-3 | 履歴 30 件の記事を 1 回公開 | 30 行のまま。**最古の 1 行だけ**が消え、残り 29 行は `id`・`checked_at`・`checks_json` とも不変 | boundary |
| T3-4 | 履歴 40 件の異常状態から 1 回公開 | 30 行に戻る (保持窓超過からの復帰) | boundary |
| T3-5 | 同一秒に 2 行を追記 → 保持窓を超えるまで追記 | 消える行が実行のたびに変わらない (`ORDER BY checked_at DESC, id DESC` の決定性) | boundary |

### T3-3 の「残り 29 行が不変」を見る理由

A3 の反例に「追記のたびに過去行が書き換わる (上書き)」がある。
行数だけ数えると、**1 行消して 1 行足す実装と、既存行を上書きする実装が
どちらも 30 行**になって区別できない。`id` の集合を前後で比べる。

### T3-5 の測り方

`checked_at` を明示的に同値で 2 行入れ、刈り取り後に残る `id` を確かめる。
`tests/support/clock` の `NOW` を使い、壁時計を読まない。
これを書いておかないと、`id DESC` を第 2 キーから外す変更が
「たまたま通る」状態で入る。

---

## 6. A4: 定期再点検 (T4-1 〜 T4-5)

| id | 状況 | 期待 | 種別 |
|---|---|---|---|
| T4-1 | 最終点検が 8 日前の公開記事 1 件 | 1 行追記され、`trigger === "scheduled"` | equivalence |
| T4-2 | 最終点検が 6 日前の記事 | **追記されない** (7 日境界の内側) | boundary |
| T4-3 | 最終点検がちょうど 7 日前の記事 | 追記される (境界は「7 日以上」なので含む) | boundary |
| T4-4 | 履歴が 1 件も無い公開記事 | 追記される。かつ**最優先で選ばれる** (古い順の並びで先頭) | boundary |
| T4-5 | `archived_at` が入った記事 (取り下げ済み) | 追記されない | equivalence |

さらに 2 件:

| id | 状況 | 期待 |
|---|---|---|
| T4-6 | 対象が 60 件ある状態で 1 回転 | 追記は **50 行ちょうど**。残り 10 件は次の回に残る (`archived_at IS NULL` かつ古い順) |
| T4-7 | 1 回転の中で同じ記事が 2 度選ばれない | 対象記事 1 件につき追記は 1 行 (A4 の反例「同一記事に 1 回転で 2 行以上追記する」) |

### 時刻の与え方

`reauditStaleArticles(deps, { now })` に `now` を引数で渡す設計
([architecture.md](./architecture.md) C 節) なので、テストは `now` を固定値で渡す。
`vi.useFakeTimers()` を使わない — 関数が時計を読まない設計になっているのに
テストが時計を差し替えると、「時計を読んでいてもテストが通る」状態になり、
設計の意図が守られなくなる。

### `worker-entry.js` は検査しない

design-review.md の F1 で「既存 `scheduled` の 5 本目の `ctx.waitUntil` として足す」と
決めたが、`worker-entry.js` は型検査の外側にあり、テストも書かない
(ファイル冒頭のコメントが「ここには型で守るべき判断を置かない」と宣言している)。
検査するのは `reauditStaleArticles` の側。配線が抜けた場合は
P06 のスモークではなく **P07 の受け入れ**で拾う。

---

## 7. A5: 管理画面の一覧 (T5-1 〜 T5-5)

契約は [api-contract.md](./api-contract.md)。

### 単体 (usecase)

| id | 状況 | 期待 | 種別 |
|---|---|---|---|
| T5-1 | 落ちている記事 2 件、通っている記事 3 件 | `rows` は 2 件。通っている記事は混じらない | equivalence |
| T5-2 | ある記事が 3 日前に落ち、昨日通った | その記事は `rows` に出ない (**最新の行だけを見る**) | boundary |
| T5-3 | 落ちている記事が 60 件、`limit` 既定 | `rows` は 50 件、`truncated === true`。並びは `checked_at` の新しい順、同時刻は `slug` 昇順 | boundary |

T5-2 は api-contract.md の抽出条件そのもの。「過去に落ちたことがある記事」を
拾う実装と「最新で落ちている記事」を拾う実装は、履歴 1 件の記事では
同じ結果になる。**履歴 2 件で判定が割れる**入力でしか区別できない。

### 画面

| id | 状況 | 期待 | 種別 |
|---|---|---|---|
| T5-4 | 落ちた記事 1 件 (落ちたチェック 2 件) | 記事の題が**可視ラベル**として読め、2 件の `hint` の文言がそのまま読める | screen-states |
| T5-5 | 落ちた記事 0 件 | 「落ちている記事はありません」が読める。表の骨組みだけが出る状態にしない | screen-states |

**測り方**: `tests/ui/guideline-reference-page.test.tsx` と同じく
`@/presentation/composition` を `vi.mock` で差し替え、usecase の返り値を
固定して画面を描く。取得は `getByText` / `getByRole` の**アクセシブル名**で行い、
`querySelector('.someClass')` や `nth-child` を使わない (task 仕様書の保守性制約)。

T5-4 が hint の**文言そのもの**を見るのは、A5 の反例
「出るが理由が読めず `check` の識別子だけが出る」を塞ぐため。
`check` の識別子 (`has_answer` など) は英語の内部名で、運営者には読めない。

---

## 8. A6: 既存挙動の不変 (T6-1 〜 T6-3)

| id | 検査 | 期待 |
|---|---|---|
| T6-1 | 既存スイート全体 (`pnpm vitest run`) | 0 件失敗。0 節の基準線と同じ |
| T6-2 | 既存 7 builder の出力 | `structured-data.test.ts` の既存ケースが 1 件も変わらず緑。**既存ケースの期待値を書き換えない** |
| T6-3 | `auditArticleForAiSearch` の 7 チェック | `ai-search-audit.test.ts` の既存ケースが緑。判定に触らず永続化だけを足したことの証拠 |

**T6-2 の運用**: P05 が既存テストの期待値を 1 文字でも書き換えたら、
それは「既存の出力が変わった」ということであり A6 の反例に当たる。
P06 は `git diff tests/application/seo/structured-data.test.ts` が
**追記のみ** (既存行の削除・変更が 0) であることを見る。

---

## 9. カバレッジ

目標は既定 80%。対象は新規実装コードのみ:

| path | 主な中身 |
|---|---|
| `src/application/seo/structured-data.ts` | 追加した `buildHowTo` / `buildSpeakable` |
| `src/application/usecases/seo/record-ai-search-audit.ts` | 追記と刈り取り |
| `src/application/usecases/seo/reaudit-stale-articles.ts` | 定期再点検 |
| `src/application/usecases/seo/list-failing-audits.ts` | 一覧の取得 |
| `src/infrastructure/persistence/d1/` の追加分 | 履歴テーブルの読み書き |
| `src/app/admin/content/published/page.tsx` の追加分 | 落ちている記事の節 |

`worker-entry.js` は対象外 (型検査の外側・判断を置かない配線)。
`src/db/schema.ts` の列定義は宣言であり分岐を持たないので数に含めない。

## 10. 実行コマンド (P06 が使う)

```bash
# 新規 4 ファイル + 追記 1 ファイル
pnpm vitest run tests/application/seo/structured-data.test.ts \
  tests/application/list-failing-audits.test.ts \
  tests/integration/d1-ai-search-audit-history.test.ts \
  tests/ui/article-speakable-anchor.test.tsx \
  tests/ui/published-articles-failing-audits.test.tsx

# 回帰 (A6)
pnpm vitest run --reporter=dot
```

## 11. この文書が扱わないこと

- テストの実装 (P05 が書き、P06 が走らせる)
- `docs/product/traceability.md` への `REQ-SEO06` / `REQ-SEO07` の行追加 (P12)
- E2E (`tests/e2e`) の追加。本 feature の受入は単体・結合・画面で満たせており、
  ブラウザを起こす必要のある受入が無い
- 性能・応答時間の基準 (P09)
