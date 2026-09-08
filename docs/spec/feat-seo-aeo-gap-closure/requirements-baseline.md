# feat-seo-aeo-gap-closure 要求ベースライン

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P01`
- 状態: 確定 (P01 成果物)
- 姉妹文書: [derivation-rules.md](./derivation-rules.md) / [retention-policy.md](./retention-policy.md)

## この文書が答えること

feature の受入 6 件 (A1-A6) は、そのままでは「出力される」「反映される」といった宣言で、
何をもって満たしたと言えるかが一意でない。ここでは各受入について
**観測点 (どこを見るか)** と **判定 (何がどうなっていれば PASS か)** と
**反例 (何が起きたら FAIL か)** の 3 つを与え、P04 のテスト設計と P07 の受け入れ判定が
同じものを見るようにする。

## 決まっていなかった 3 点 (本 phase で確定)

| # | 未確定だったこと | 確定した内容 | 根拠 |
|---|---|---|---|
| D1 | HowTo の手順をどこから導出するか | 公開記事の `sections` のうち `id === "steps"` の節の `paragraphs` を 1 段落 = 1 手順とする | [derivation-rules.md#d1](./derivation-rules.md#d1-howto-の導出元) |
| D2 | Speakable が読み上げ対象として指すもの | 冒頭結論 (`answer` / `summary`) と要点 (`key_points` / `keyPoints`) の 2 か所を `cssSelector` で指す | [derivation-rules.md#d2](./derivation-rules.md#d2-speakable-の読み上げ対象) |
| D3 | 点検履歴の保持窓幅 | 記事ごと直近 30 件 (件数のみ。日数窓を併用しない) | [retention-policy.md](./retention-policy.md) |

## 受入 6 件の検証可能化

### A1: 手順ブロックを持つ記事に HowTo の JSON-LD が出力され、手順なしの記事には出力されない

- **「手順ブロックを持つ記事」の定義**: 記事型が `guide` であり、かつ `steps` 節の本文が
  空でない段落を 1 つ以上持つ記事。記事型の集合は `src/domain/authoring/article-structure.ts` の
  `ARTICLE_TYPES` (`ranking` / `review` / `comparison` / `guide` / `tool`) が正本で、
  手順節 (`steps`) を持つのは `guide` だけ。
- **観測点**: 公開ページに埋め込まれる JSON-LD 文字列。
- **判定**: 上記に当たる記事では `@type: "HowTo"` のオブジェクトが 1 件出力され、
  その `step` 配列の要素数が `steps` 節の非空段落数と一致する。
- **反例 (FAIL)**: `guide` 以外の記事型で HowTo が出る / `steps` 節が空の `guide` 記事で
  `step: []` を持つ HowTo が出る / 段落数と `step` 数がずれる。
- **空のときの振る舞い**: builder は `null` を返し、呼び出し側は JSON-LD をそのキーごと出さない。
  既存 `buildFaqPage` / `buildItemList` が「出せないものは `null`」を返す作法に揃える
  (`src/application/seo/structured-data.ts`)。空の HowTo は「手順の無い手順書」という
  事実に反する構造になるため出さない。

### A2: 結論・要点ブロックを持つ記事に Speakable の JSON-LD が出力される

- **「結論・要点ブロック」の定義**: 表現ブロック `answer` (読み取りモデル上は記事の `summary`)
  と `key_points` (同 `keyPoints`)。`src/domain/authoring/blog-template.ts` の
  `EXPRESSION_BLOCK_KINDS` 10 種のうち、`AI_FIRST` として記事先頭へ寄せられる 2 種と一致する。
- **観測点**: 公開ページの JSON-LD、および公開ページ DOM の該当要素。
- **判定**: 2 ブロックのうち少なくとも 1 つが非空のとき `speakable` が出力され、
  その `cssSelector` が指す要素が公開ページに実在する。
- **反例 (FAIL)**: 両方空なのに `speakable` が出る / `cssSelector` が公開ページ上の
  どの要素にも一致しない (読み上げ機構が何も読めない `speakable` は嘘の宣言)。

### A3: 公開のたびに点検結果が履歴へ追記され、保持窓を超えた古い分だけが落ちる

- **点検結果の定義**: `src/application/seo/ai-search-audit.ts` の
  `auditArticleForAiSearch` が返す `AiSearchCheck[]` (7 件)。各要素は
  `check` / `ok` / `hint` を持つ。
- **観測点**: 点検履歴テーブルの、対象記事に紐づく行。
- **判定**: 公開 1 回につき 1 行が追記される。追記後、その記事の行数は
  30 を超えない。31 件目の追記時に最古の 1 行だけが消え、それ以外の行は
  内容・順序ともに不変。
- **反例 (FAIL)**: 公開しても行が増えない / 追記のたびに過去行が書き換わる (上書き) /
  保持窓を超えても古い行が残る / 保持窓を超えたときに 1 件より多く消える。
- **保持窓の値と算定根拠**: [retention-policy.md](./retention-policy.md)。

### A4: 定期実行で公開済み記事が再点検され、結果が同じ履歴へ追記される

- **「同じ履歴」の定義**: A3 と同一のテーブル・同一の行形状。公開由来か定期由来かは
  行の `trigger` 列で区別し、テーブルを分けない。分けると「何件比較できるか」が
  経路ごとに変わり、A3 の保持窓が二重管理になる。
- **観測点**: 定期実行の 1 回転と、その前後の履歴行。
- **判定**: 対象記事 1 件につき 1 行が追記され、`trigger` が定期を示す。
  保持窓の適用は A3 と同じ規則。
- **反例 (FAIL)**: 定期実行が公開済みでない記事を点検する / 別テーブルへ書く /
  同一記事に 1 回転で 2 行以上追記する。
- **対象記事の絞り込み**: 最終点検から 7 日以上経った公開済み記事のみ。
  根拠は [retention-policy.md](./retention-policy.md)。

### A5: 再点検で落ちた記事が管理画面の一覧に現れ、落ちた理由 (hint) が読める

- **「落ちた」の定義**: 最新の履歴行に `ok: false` の check が 1 件以上ある状態。
- **観測点**: 管理画面の該当一覧。
- **判定**: 落ちた記事が一覧に現れ、各行から `AiSearchCheck.hint` の文言が読める。
  検証は可視ラベルとアクセシブル名で行い、DOM 構造や座標に依存しない
  (task 仕様書「保守性制約」)。
- **反例 (FAIL)**: 落ちた記事が一覧に出ない / 出るが理由が読めず `check` の
  識別子だけが出る / すべて通っている記事が一覧に混じる。

### A6: 既存の JSON-LD・llms.txt・IndexNow・出典レジストリ・公開時点検の挙動が変わらない

- **観測点**: 既存 `tests/` 配下の全スイート、および既存 builder の出力。
- **判定**: 既存テストが 0 件失敗。既存 builder
  (`buildBlogPosting` / `buildItemList` / `buildBreadcrumbList` / `buildFaqPage` /
  `buildBlogOpsFaqPage` / `buildBlogOpsPosting` / `serializeJsonLd`) の
  同一入力に対する出力が変わらない。`auditArticleForAiSearch` の 7 チェックの
  判定結果も変わらない (永続化を足すだけで判定は触らない)。
- **反例 (FAIL)**: 既存テストの失敗 / 既存 builder の出力差分 /
  `serializeJsonLd` の `<` → `<` 置換 (記事本文からの XSS 阻止) の消失。

## 受入と参照仕様の対応表

| 受入 | 参照する system-spec の決定 | 参照する実装の型契約 |
|---|---|---|
| A1 | `system-spec/frontend.md` (構造化データの出力方針) | `article-structure.ts#ARTICLE_TYPE_SECTIONS.guide`, `publish-article.ts#PublishedSection` |
| A2 | `system-spec/frontend.md`, `system-spec/ui-ux.md` | `blog-template.ts#EXPRESSION_BLOCK_KINDS`, `published-article.ts#PublishedArticle.summary/keyPoints` |
| A3 | `system-spec/database.md#dec-analysis-history-retention` (`opt-append-with-window`) | `ai-search-audit.ts#AiSearchCheck` |
| A4 | `system-spec/backend.md#dec-aeo-analysis-trigger` (`opt-publish-gate-plus-scheduled`) | `wrangler.jsonc#crons` (`0 17 * * *`) |
| A5 | `system-spec/ui-ux.md` (管理画面の情報優先度) | `ai-search-audit.ts#AiSearchCheck.hint` |
| A6 | 上記すべて | `structured-data.ts` の既存 7 関数 |

## 受入と phase の対応 (feature の trace 表より)

| 受入 | 担当 phase |
|---|---|
| A1 | P01, P02, P04, P05, P06, P07, P11 |
| A2 | P01, P02, P04, P05, P06, P07, P11 |
| A3 | P01, P02, P04, P05, P06, P07, P08, P11 |
| A4 | P01, P02, P04, P05, P06, P07, P11 |
| A5 | P01, P02, P04, P05, P06, P07, P09, P11 |
| A6 | P03, P06, P08, P09, P10, P11, P13 |

## この文書が扱わないこと

- API 契約・テーブル DDL・関数シグネチャの設計 (P02 が所有する)
- テストケースの列挙 (P04 が所有する)
- 既存実装との重複有無の独立検証 (P03 が所有する)
