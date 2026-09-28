# 実装要件定義書: feat-reader-search-quality

> 本書は dev-graph `requirements` verb が、確定 system spec、feature 文書、現行実装の実測、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:c6a9b3c405b1c23842659b80e914c70979f381e221267a16ad8551055cdfe341`
- graph revision: `463`
- scope digest: `sha256:67ce36d05a3b268cb34752a2c45e82e96b723eaf9128af375a68dee6ccf07baf`
- feature package: `feature-package/feat-reader-search-quality`
- promoted generation digest: `sha256:b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a`
- promoted generation path: `.dev-graph/published/feature-package-feat-reader-search-quality`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T13:00:00Z`

## 目的と到達状態

- 目的: 読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する。
- 到達状態: D1 上の全文検索索引が公開記事から自動で保たれ、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、検索の入口が構造化データと llms.txt にも表れている。
- 品質制約 (goal-spec `quality_constraints`): 外部検索 SaaS へ委ねず D1 内で完結する。既存 SearchBox の `method=get` と `searchArticles` ユースケースを壊さない。`WebSite`/`SearchAction`/`ItemList` の JSON-LD 生成そのものは feat-blog-top-page-composition の所有であり、本 feature は URL 契約の提供と整合確認までを負う。

## 現況ベースライン (2026-09-04 実測)

| 対象 | 実測 | 本 feature での扱い |
|---|---|---|
| `src/application/ports/site.ts` | `PublishedContentPort.search(siteSlug, query, limit)` が唯一の検索ポート | 契約を保ったまま索引実装へ差し替える |
| `src/infrastructure/persistence/d1/published-article-repository.ts` | `title`/`summary` への `LIKE '%q%'`、`archivedAt is null` で絞り、`updatedAt` 降順 | 本文が検索されず順位付けも無い。FTS5 経路へ移行する (P08) |
| `src/application/usecases/site/read-site.ts` | `createSearchArticlesUseCase`、空語は `VALIDATION_FAILED`、既定件数 `DEFAULT_LIST_LIMIT = 20`、0 件は成功 | 「0 件を失敗にしない」既存判断を維持する |
| `src/presentation/site/search-box.tsx` | `ToolForm` `method="get"`、入力名 `q`、`toolName="searchArticles"` | 二経路入口と WebMCP 同一化の起点。破壊しない |
| `src/app/s/[site]/search/page.tsx` | `?q=` を読み、未入力／0 件／結果あり／失敗の 4 状態を出す | URL 契約の現況。抜粋・サムネイル・代替提案が未実装 |
| `src/application/read-models/published-article.ts` | `ArticleSummary` は slug/siteSlug/type/title/summary/categorySlug/updatedAt/authorName | 公開日・抜粋・サムネイルを持たない。A3 の前提として拡張が要る |
| `src/db/schema.ts` `published_articles` | `title`/`summary`/`category_slug`/`published_at`/`updated_at`/`archived_at`/`article_json` | 記事の正本。索引はここから導く派生物とする |
| `src/app/s/[site]/llms.txt/route.ts` | `emitLlmsTxt` が偽なら 404、公開記事の目次を配る | 検索入口を llms.txt が指す整合確認の対象 |
| `src/presentation/tools/` | `webmcp-adapter.ts` / `reader-tools.ts` 等は存在するが、`searchArticles` の定義は `search-box.tsx` の `ToolForm` 宣言だけ | 画面宣言と道具カタログの一本化が A5 の実作業 |
| 観測 fact `system-spec/retrieval-evidence/kajetblog-top-analysis.md` | §5 で `WebSite.potentialAction` が `SearchAction`、target `?s={s}`。ヘッダーは検索アイコン起動 | 参照は情報設計のみ。URL 形と実装は本システム固有に定める |

## D1 FTS5 trigram 索引と migration

確定根拠は `system-spec/database.md#qa-database-web-fts5-trigram-index-v4b` と `system-spec/backend.md#qa-backend-web-site-search-llms-txt-v4b`。

- 記事の正本は `published_articles` とし、FTS5 仮想表は読み取り専用の派生物として定義する。本文の正本を索引側へ複製しない。
- トークナイザは `tokenize='trigram'` に固定する。FTS5 の組込トークナイザは unicode61 / ascii / porter / trigram の 4 種であり bigram は存在しない。既定の unicode61 は日本語本文をほぼ一語として扱うため使わない。
- 索引対象の列は題名・要約・本文の平文化の 3 列に限る。trigram は保存量と書き込み費用を増やすため、補助属性は索引へ載せず列の絞り込みで解く。
- 複数ブログが同一 D1 に載るため、索引はブログ識別子と公開状態を列として持ち、絞り込みを索引内で完結させる。
- 本文の平文化 (整形処理) は保存前に済ませ、索引更新の所要を書き込み経路へ持ち込まない。
- migration は `drizzle/` の追記として与え、`published_articles` schema と既存 `search` ポートの後方互換を壊さない。
- 索引定義の変更時は `EXPLAIN QUERY PLAN` による問い合わせ計画の検証を移行手順へ含める。索引の実効性は定義だけでは保証できない。
- 索引の再構築手順を運用側に用意し、索引の破損を記事の損失から切り離す (P12 の runbook)。

## 公開状態への索引追従

- 索引は記事の作成・更新・公開状態変更・削除を契機に、同じトランザクション内で追随させる。「公開されているのに検索に出ない」「非公開なのに検索に出る」を構造的に起こさせない。
- 索引更新は公開処理の中で完結させ、手動の再構築を通常運用の前提にしない (A8)。再構築は障害復旧の手段としてだけ残す。
- 検索対象は公開済み・非削除の記事に限定する。下書き・予約公開・非公開ブログの本文が検索経由で漏れないことを既定とする。
- 既存公開記事の backfill は再実行可能とし、件数差 0 を migration report で示す (P08)。

## 日本語部分一致と順位付け

- 検索語は FTS 構文記号を含めて literal として束縛する。任意の FTS 構文を通さない。読者向けの主要タスクは語句一致であり、構文開放より漏洩防止を優先する。
- 順位は関連度 (FTS5 既定 rank) → 公開日の新しさ → カテゴリー一致 の合成とする。trigram は形態素解析より無関係な一致が増えるため、新しさを従属順位に置いて上位の実用性を保つ。
- 2 文字以下の問い合わせは trigram が最適化できないため索引経由にしない。題名への前方一致 (`LIKE 'term%'`) とカテゴリー回遊への誘導で応じる。この境界は検索応答で読者に見える形にし、黙って 0 件を返さない。
- 応答は順序と打ち切り条件を呼び出し側から観測できる形で返す。問い合わせ語・対象ブログ・件数・継続位置を明示的に受ける。

## 検索ページの URL 契約

- 検索ページの query parameter 名と応答形を契約として固定し、`docs/spec/feat-reader-search-quality/url-contract.md` を正本とする。現況は `/s/{site}/search?q=`。
- `WebSite.potentialAction` (`SearchAction`) の target と llms.txt の検索導線が、この契約の URL と一致することを機械検査できるようにする。宣言と実装を分岐させない。
- JSON-LD の生成そのものは feat-blog-top-page-composition の所有である。本 feature は「契約の提供」と「一致の検査」までとし、生成側のコードを書き換えない。

## 検索結果面の表示要件

- 検索結果は件数・一致箇所の抜粋・サムネイル・カテゴリー・公開日を出す (A3)。
- 現行 `ArticleSummary` は公開日・抜粋・サムネイルを持たないため、読み取りモデルの拡張が実作業に含まれる。画面側で組み立てない (URL 生成を `articleHref` に集約している既存判断と同じ理由)。
- サムネイルは読者向け一覧の「大」の型を用いる。寸法は面ごとに書き分けず、面をまたぐ少数の型として 1 か所で定める (`system-spec/ui-ux.md#qa-request-thumbnail-coverage-v6`)。
- 画像を持たない記事は自動生成の代替図版で埋まるため、サムネイルの出ない行を作らない。生成・保存の実装は feat-thumbnail-visual-system の所有である。
- 一致箇所の抜粋は本文の平文化から作る。画面に無い主張を抜粋に混ぜない。

## 0 件時の代替提案

- 0 件は失敗ではない。既存ユースケースの「0 件を成功として返す」判断を維持し、「見つからなかった」と「壊れている」を画面上で区別する (現行 `search/page.tsx` の 4 状態を保つ)。
- 0 件のとき、カテゴリーまたは人気記事による代替の探し方を提示する (A6)。
- 2 文字以下の問い合わせによる索引非経由の応答も、0 件と同じ場所で理由と次の行動を示す。

## JavaScript 無効での完走 (progressive enhancement)

- 既存 SearchBox の `method="get"` による素の送信を壊さない。JavaScript は増補であって前提ではない。
- 二経路の入口 (ヘッダーからの検索起動、検索ページ) の双方が JavaScript 無効で完走する。ヘッダー側が JavaScript を要する起動方式を採る場合でも、非 JS 経路の到達先を必ず持たせる。
- 検証は可視ラベルとアクセシブル名で行い、pixel 位置や DOM 構造に依存させない。JavaScript 無効経路の axe 重大違反 0 を QA で独立確認する (P09)。

## 画面と WebMCP 道具の同一ユースケース

- 画面の検索と WebMCP 道具 `searchArticles` は同一ユースケースを通り、同じ入力に対し同じ結果を返す (A5)。
- WebMCP から返す内容は公開済みの記事に限る。下書き・非公開へ到達する経路を作らない。公開する操作は読み取りに限り、書き込み・更新・削除の道具を持たない (`system-spec/frontend.md#qa-frontend-web-fixed-header-seo-aio-v6`)。
- 現況は `search-box.tsx` の `ToolForm` 宣言だけが `searchArticles` の出所である。道具定義とユースケースの結線を一本化し、同じ責務の経路を増やさない。
- 同一結果契約はテストで固定する。P04 は対象関数 100% 網羅を要求する。

## 負荷上限とページング

- 検索語の長さと件数に上限を課す。極端に長い問い合わせは打ち切り、打ち切りを応答で明示して黙って結果を減らさない。
- ページングは継続位置を応答に含め、呼び出し側が次の頁を要求できる形とする。既定件数は現行の `DEFAULT_LIST_LIMIT = 20` を出発点とする。
- 負荷上限超過時の fallback 手順を運用文書に持たせる (P12)。

## 安全性

- 検索語は外部入力であり FTS5 の問い合わせ構文として解釈されうる。literal 化を実装し、静的解析と実行時 trace の双方で注入 0 件を示す (P09)。
- 索引スコープに非公開記事を含めない。流出 0 件を P07 とは別証跡で独立確認する。
- 外部検索 SaaS への依存を持ち込まない。設計レビュー (P03) の明示チェック項目とする。

## 責務境界

| 事項 | 所有 | 本 feature の関与 |
|---|---|---|
| `WebSite`/`SearchAction`/`ItemList` の JSON-LD 生成 | feat-blog-top-page-composition | URL 契約を提供し、target 一致を検査するだけ |
| トップページ上の検索窓の配置と見た目 | feat-blog-top-page-composition | 関与しない |
| サムネイル・代替図版の生成・保存・寸法型 | feat-thumbnail-visual-system | 検索結果面での表示適用のみ |
| `published_articles` を唯一の公開正本とする投影 | feat-blog-composition-visibility | 索引の入力として前提にする |
| WebMCP Adapter の分離 | feat-webmcp-surface | 同一ユースケース化の前提にする |
| 管理画面内の記事検索 | 本 feature の範囲外 | 触らない |
| AI による回答生成・商品横断比較検索 | feat-ai-assistant / feat-comparison-engine | 触らない |

## 未決事項

実装前に確定が要る。P02 の設計成果物で解き、確定するまで数値を実装へ埋め込まない。

1. AIO 出力形式の食い違い。`system-spec/backend.md#qa-backend-web-site-search-llms-txt-v4b` は「目次のみ (llms.txt)、llms-full.txt は出さない」とし、`system-spec/frontend.md#qa-frontend-web-fixed-header-seo-aio-v6` は「llms-full.txt + WebMCP の両方」とする。検索入口をどちらの表現物が指すかは未確定。現行実装は `llms.txt` route のみを持つ。
2. 負荷上限の具体値。検索語長の上限、1 回の最大件数、打ち切り件数は system-spec に数値が無い。
3. ページングの方式。継続位置を offset で表すか cursor で表すかは未確定。
4. 「人気記事」の定義。0 件時の代替提案が参照する順位の正本が未確定。
5. D1 における「同じトランザクション内での索引追随」の実現手段。D1 のトランザクション制約下で何をもって同一性を保証するかを設計で確定する。
6. サムネイル供給元の依存。A3 は feat-thumbnail-visual-system の成果を要するが、本 feature の `depends_on` には含まれていない。順序の確定が要る。

## 受入条件トレーサビリティ

受入の文言の正本は `features/feat-reader-search-quality.md#frontmatter.acceptance`。ID は配列の 1 始まり順で A1〜A8 に対応する。

| ID | 要件要約 | confirmed source | 主phase | 必須証跡 |
|---|---|---|---|---|
| A1 | 索引追従と非公開記事の非表示 | feature/context A1・database FTS5 trigram・backend 検索資源 | P01,P02,P03,P04,P05,P06,P07,P08,P09,P11 | migration、索引追随テスト、流出0件 |
| A2 | 日本語部分一致と無関係語の0件 | feature/context A2・database trigram 順位・backend 順序契約 | P01,P02,P04,P05,P06,P07,P09,P11 | ranking テスト、境界値テスト |
| A3 | 抜粋・サムネイル・カテゴリー・公開日 | feature/context A3・ui-ux サムネイル対象面・frontend 寸法型 | P01,P02,P04,P05,P06,P07,P11 | 読み取りモデル契約、E2E 表示証跡 |
| A4 | JavaScript 無効での完走 | feature/context A4・現行 SearchBox method=get | P01,P02,P04,P05,P06,P07,P09,P11 | 非JS E2E、axe 重大0 |
| A5 | 画面とWebMCPの同一結果 | feature/context A5・frontend WebMCP 読み取り限定・arch-two-layer-platform | P02,P04,P05,P06,P07,P09,P11 | 同一結果契約テスト |
| A6 | 0件時の代替提案 | feature/context A6・backend 打ち切り明示・現行4状態 | P02,P04,P05,P06,P07,P11 | 0件経路の acceptance 証跡 |
| A7 | URL契約とSearchAction targetの機械検査 | feature/context A7・backend SearchAction 一致・観測fact §5 | P01,P02,P03,P04,P05,P06,P07,P09,P10,P12 | url-contract、整合検査テスト |
| A8 | 索引更新が公開処理内で完結 | feature/context A8・database 同一トランザクション追随 | P02,P05,P06,P07,P08,P12 | migration report、再構築 runbook |

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-READER-SEARCH-QUALITY-P01` | 検索入口2経路・FTS5索引スコープ・URL契約の要求ベースライン確定 | — |
| P02 | `SYS-READER-SEARCH-QUALITY-P02` | 索引・順位付け・URL契約・画面/WebMCP同一ユースケースの設計 | P01 |
| P03 | `SYS-READER-SEARCH-QUALITY-P03` | 設計の独立レビューと外部SaaS非依存・非公開流出防止・境界不可侵ゲート | P02 |
| P04 | `SYS-READER-SEARCH-QUALITY-P04` | A1–A8・索引追従・日本語部分一致・JS無効完走のテスト設計 | P03 |
| P05 | `SYS-READER-SEARCH-QUALITY-P05` | 索引migration・検索器・検索結果面・二経路入口・WebMCP同一化の実装 | P04 |
| P06 | `SYS-READER-SEARCH-QUALITY-P06` | 単体・結合・E2E・JS無効・WebMCP契約テストの実行と緑化 | P05 |
| P07 | `SYS-READER-SEARCH-QUALITY-P07` | A1–A8のfeature受入 | P06 |
| P08 | `SYS-READER-SEARCH-QUALITY-P08` | 既存LIKE検索からFTS5索引への移行とbackfill | P05 |
| P09 | `SYS-READER-SEARCH-QUALITY-P09` | 流出防止・FTS構文注入防止・境界動作・非侵犯境界の独立QA | P07,P08 |
| P10 | `SYS-READER-SEARCH-QUALITY-P10` | 目的・受入・品質証跡の独立最終レビュー | P09 |
| P11 | `SYS-READER-SEARCH-QUALITY-P11` | 索引・部分一致・順位付け・同一結果証跡の再現可能な集約 | P07,P09,P10 |
| P12 | `SYS-READER-SEARCH-QUALITY-P12` | 索引再構築runbook・負荷超過時fallback・URL/API契約の確定 | P10,P11 |
| P13 | `SYS-READER-SEARCH-QUALITY-P13` | development展開・rollback確認・仕様書への書き戻し | P12 |

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-reader-search-quality` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `SYS-READER-SEARCH-QUALITY-P01..P13` | confirmed | pass | complete | なし |

`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph buildへの制約

- implementation前に、このrepositoryの `node_modules/next/dist/docs/` で対象APIのNext.js現行ガイドを読む。
- P01 の upstream entry gate として `feat-blog-composition-visibility` と `feat-webmcp-surface` が done または closed であることを確認してから着手する。
- 既存 `PublishedContentPort.search`、`createSearchArticlesUseCase`、`SearchBox` の `method=get`、`published_articles` schema との後方互換を保ち、同じ責務の use case / port を増やさない。
- P04 のテストを先に定義し、pixel位置やDOM構造ではなく、可視ラベル、accessible name、状態、API契約、検索応答の内容で検証する。
- 「未決事項」の 6 件は P02 で確定させ、確定前の数値を実装へ埋め込まない。
- 破壊的移行は P08 の dry-run と rollback 証跡なしに実行しない。本番公開は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各taskのwrite_scopeとVerification and evidenceを実装authorityとする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-reader-search-quality.json`
- trace entries: `.dev-graph/handoff/requirements-trace-entries-feat-reader-search-quality.json`
- implementation code generated by this verb: `0`
