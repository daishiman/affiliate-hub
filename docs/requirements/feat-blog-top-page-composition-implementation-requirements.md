# 実装要件定義書: feat-blog-top-page-composition

> 本書は dev-graph `requirements` verb が、確定 system spec、参照サイトの観測 fact、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:c6a9b3c405b1c23842659b80e914c70979f381e221267a16ad8551055cdfe341`
- graph revision: `463`
- scope digest: `sha256:d691c400be6cd842edffc9ff11f6b5c5e48ee7dce7b76433c229d6030c64c684`
- feature package: `feature-package/feat-blog-top-page-composition`
- promoted generation digest: `sha256:527391117e2989ab2cdfba1fe6e95b526a8246a10561987153453687d101333c`
- promoted generation path: `.dev-graph/published/feature-package-feat-blog-top-page-composition`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T13:00:00Z`

## 目的と到達状態

- 目的: 読者がトップページに来た瞬間に「何のブログで、何が読めて、次にどこへ行けばよいか」を迷わず掴めるようにし、参照ブログの情報階層だけを抽象化して独自の構成へ翻訳する。
- 到達状態: トップページが おすすめ記事 → 最新/人気の切り替え → カテゴリーから探す → 記事一覧への導線 の順で構成され、各記事がサムネイル付きカードで並び、ヘッダーはスクロール中も追従してヘッダー内から検索を起動でき、フッターに運営者情報・法務ページ・SNS・RSS の導線が揃い、JavaScript が無効でも全導線が URL で機能する。
- 対象は読者向けトップページ 1 画面の情報設計に限る。sticky ヘッダー部品と配色の選択 UI は `feat-blog-ui-builder`、サムネイル生成は `feat-thumbnail-visual-system`、検索の索引と結果面は `feat-reader-search-quality`、記事本文ページは `feat-reader-surface`、自動反映の履歴・差分・取り消し面は `feat-seo-aeo-measurement-loop` が所有する。

## 観測 fact と設計判断の分離

`system-spec/retrieval-evidence/kajetblog-top-analysis.md` は 2026-09-03 に取得した参照サイトの観測記録であり、実装契約ではない。観測を実装へ無批判に読み替えないため、両者を明示的に分けて扱う。

| 観測 fact (参照サイトではこうだった) | 本 feature の設計判断 |
|---|---|
| §1 追従ヘッダーに ロゴ / キャッチコピー / グローバルナビ / 検索アイコン / モバイルメニュー / SNS 列 の 6 種が並ぶ | 追従ヘッダーへ置くのは サイト名 / 検索起動 / カテゴリへの移動 の 3 機能に限る。キャッチコピーと SNS 列はフッターと本文の流れの中へ置く |
| §2 h2 が おすすめ記事 → 最新記事/人気記事 (タブ) → カテゴリーから探す → 記事一覧導線 の順 | 同じ区画順を採るが、見出し文言・タブ挙動・件数・空状態は本プロダクトの語彙と URL 契約で独自に定義する |
| §3 カード型でサムネイル約 1200x675 (16:9)、メタはカテゴリと公開日時 | 16:9 のカード規約を採る。画像の無い記事は自動生成 OGP 画像で埋め、空スロットを作らない |
| §4 全 54 画像に width/height を持たせ CLS を構造的に抑えている | 寸法宣言先行の原則を採り、面をまたいで使える少数の寸法型として 1 か所で定める |
| §5 JSON-LD は Person / Organization / WebSite(+SearchAction) | WebSite + SearchAction は採り、参照サイトに無い ItemList を独自に足す |
| §7 参照サイトのトップに ItemList が無く、`llms.txt` も無い (欠測) | 欠測は「参照しない」ではなく「自分で埋める」対象として扱う |

参照サイトの文章・写真・ロゴ・固有名・色値・テーマ資産は転用しない。移すのは情報階層と操作原則だけである。

## 区画構成と表示順

トップページは次の 4 区画をこの順で描画する。順序は読者がトップページで果たそうとする用事の束 (「何のブログか掴む」「今読むべき記事を選ぶ」「目当ての話題へ移る」) を、頻度と外したときの損で並べた結果であり、面の都合で入れ替えない。

| 区画 | 読者の用事 | 中身 | 空状態 |
|---|---|---|---|
| おすすめ記事 | 何のブログか掴む | 運営者が選んだ記事のカード列。高さを抑え再訪者のスクロール負担にしない | 未選定である旨と、最新記事へ進む導線を 1 つ示す |
| 最新記事 / 人気記事 | 今読むべき記事を選ぶ | 切り替え式の記事カード一覧。既定は最新 | 記事 0 件の説明と、記事を待つ間の代替導線を示す |
| カテゴリーから探す | 目当ての話題へ移る | カテゴリー名の一覧。カテゴリーにサムネイルは与えない | カテゴリー未作成である旨を説明する |
| 記事一覧への導線 | 続きを読む | 記事一覧ページへの単一リンク | 記事 0 件のときは導線を出さず理由を説明する |

- カテゴリーへ画像を与えないのは、カテゴリーが概念であって記事ではないためで、画像を与えると記事カードと見分けがつかなくなる。
- 各区画の表示件数は本書では未決とする。P01 の区画構成台帳で確定し、根拠のない数値を実装側で発明しない。
- 空状態は説明より先に「次にできること」を 1 つ示す。区画ごとに文言を分散させず、区画種別ごとの型として定める。

## 記事カードと 16:9 サムネイル

- カードの構成要素は サムネイル / 題名 / カテゴリ / 公開日時 とする。著者・タグ・読了時間はトップページのカードには載せない。
- サムネイルは 16:9 (約 1200x675) を基準比とし、`width` / `height` を全画像へ明示する。実体が届く前に高さが確定するため、読み込み中に並びが動かない。
- 寸法は面ごとに書かず、面をまたいで使える少数の寸法型 (読者向けの大 / 読者向けの小 / 運営向け) として 1 か所で定め、トップページはその型を選ぶだけとする。トップページは読者向けの大を選ぶ。
- 読者向け一覧が現れる全ての面 (トップ・カテゴリ一覧・タグ一覧・検索結果・関連記事・アーカイブ) でサムネイルが出ることを前提とし、トップページはその 1 面として欠けを残さない。他面の適用は各所有 feature が担う。
- 画像を持たない記事は自動生成の OGP 画像で埋め、サムネイルの空いたカードをトップページに生じさせない。生成そのものは `feat-thumbnail-visual-system` の所有で、本 feature は「空スロットを描画しない」ことを表示側の契約として持つ。
- 自動生成図版が隣接する同じ記事の題名リンクと情報を繰り返すカードでは、図版を空 `alt`、図版側の重複リンクを `aria-hidden` / `tabIndex=-1` とし、題名リンクを一度だけ読み上げる。題名リンクを伴わない単独図版では、記事の題名を含む代替文を付ける。`system-spec/ui-ux.md`・`frontend.md` の章注記「記事カードの図版と題名リンクの読み上げ契約（2026-09-06）」をこの文脈で優先し、画像一般への空alt規則には広げない。

## 追従ヘッダーの機能予算

常に画面に留まる部品は、留まることで隠す面積の対価に見合う働きを持つものだけを残す。

- 追従ヘッダーに置く機能は **サイト名 / 検索起動 / カテゴリへの移動 の 3 つに限る**。これを超えて機能を足さない。
- サイト名は「今どこにいるか」を返す。検索起動と カテゴリへの移動 は、どの位置までスクロールしていても要る移動手段である。
- キャッチコピーと SNS アイコン列は参照サイトの観測 fact §1 にあるが、追従ヘッダーへは置かず、フッターと本文の流れの中へ配置する。
- 狭い画面では占有面積の比率が大きくなるため、下方向スクロール中はヘッダーを畳み、上方向へ動かしたときに戻す。
- 追従ヘッダーは、見出しアンカーへ移動したとき移動先の見出しを自身の下へ隠す。この自己遮蔽は追従配置に固有の副作用なので、見出しの上余白をヘッダーの高さぶん確保して打ち消す。
- 検索起動は JavaScript 無効時に検索ページへの通常リンクとして機能する。起動 UI が動かないことが検索への到達不能を意味しない。
- ヘッダーに 3 機能しか置かない代償として、それ以外の入口は本文の流れの中に散る。散った入口は記事をまたいで同じ位置に置き、探し直しを起こさない。

## フッターの導線集約

フッターは次の導線を集約し、トップページから 1 操作で到達できる状態にする。

| 導線 | 位置づけ |
|---|---|
| 運営者情報 | 運営主体の確認 |
| 全カテゴリー | 追従ヘッダーのカテゴリ移動より網羅的な一覧 |
| サイトポリシー | 法務 |
| プライバシーポリシー | 法務 |
| 特定商取引法に基づく表記 | 法務 |
| お問い合わせ | 既存フォーム基盤 (改善要望フィードバック) を再利用する |
| RSS | `link rel=alternate` の宣言と可視リンクの双方 |
| SNS | 追従ヘッダーから外した SNS 列の受け皿 |

受入 A4 が到達を求めるのは 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせ・RSS の 7 導線であり、SNS は scope_in のフッター配置要件として満たす。

## 独自アイコン体系

- グローバルナビ・SNS・検索・メニューを本プロダクト固有のアイコンセットで表す。参照元のロゴ・アイコン資産・テーマ資産を転用しない。
- 折りたたみ時にラベルが消える経路があるため、アイコン単体で項目を識別できる形とする。
- アイコンだけで状態を伝えない。可視ラベルまたは accessible name を必ず持たせ、色だけで区別しない。

## JS 無効での到達性 (段階的強化)

- 最新 / 人気の切り替えは `?sort=latest|popular` の URL パラメータで表現し、JavaScript 無効でも URL 経由で到達できる。選択中の側は色以外の手がかりでも判別できるようにする。
- 未指定は最新として扱う。不正値は既定へ落として 200 を返し、エラー面にしない。
- 追従ヘッダーの検索起動、カテゴリ移動、記事一覧導線、フッターの全導線は通常のリンクとして機能する。JavaScript は挙動を良くするだけで、到達性の前提にしない。
- 切り替えはサーバー側で描画済みの状態を返す。クライアント側だけで一覧を差し替える経路を唯一の実装にしない。

## 構造化データ (WebSite + SearchAction + ItemList)

- トップページの HTML にサーバー側で JSON-LD を含める。型は `WebSite`、`WebSite.potentialAction` としての `SearchAction`、記事一覧に対応する `ItemList` の 3 つとする。
- `ItemList` は参照サイトに無い欠測 (観測 fact §7) を独自に埋めるものであり、参照サイトの記述を写したものではない。
- 構造化データは画面に出ている内容の再記述に限る。画面に無い主張を構造化データにだけ書かない。
- 生成は記事データという 1 つの正本からの変換として実装し、手書きの JSON-LD を許さない。変換は pure 関数として単体テストで検証できる形にする。
- `SearchAction` の target は本プロダクトの検索 URL 契約に従う。参照サイトの URL 形をそのまま持ち込まない。

## 非模倣ゲートと機械検査

- 検査対象は 参照元の文章・写真・ロゴ・固有名・色値・テーマ資産 とする。リポジトリ内にこれらが存在しないことを静的検査で確認する。
- 検査は CI に組み込み、人の注意力に頼らない。例外は根拠付き allowlist に限る。
- 観測 fact ファイル自体は「参照サイトではこうだった」という事実の記録であり、検査の allowlist として扱う対象と、転用にあたる対象を P01 の非模倣ゲート対象定義で区別する。
- 非模倣静的検査の判定関数はカバレッジ 100% を目標とする。

## アクセシビリティと版面安定

- トップページは axe-core の重大違反 0 件とする。
- light / dark 双方で本文コントラストが基準を満たす。色は `light-dark()` で解決し、片方のモードだけ検証した状態を残さない。
- 記事カードが全て固有の `width` / `height` を持ち、トップページの CLS が 0.1 未満である。
- キーボード操作と screen reader を標準経路として扱う。追従ヘッダーの畳み/復帰でフォーカスが失われない。
- 検証は pixel 位置や DOM 構造ではなく、可視ラベル、accessible name、状態、URL、出力データの契約で行う。

## データ / 描画境界

- トップページの描画は既存の読者向け描画経路 (`src/app/s/[site]/page.tsx` と site presentation 層) を通し、管理画面プレビュー用の別経路を作らない。作ると管理画面で見える姿と読者が見る姿がずれる。
- 区画順序の決定、カード非空判定 (OGP fallback 選択を含む)、`sort` パラメータ解析は副作用を持たない pure 関数として切り出し、単体で検証できるようにする。
- サムネイル画像の登録・生成・保存・配信、検索の索引と結果面、sticky ヘッダー部品そのものは本 feature の write scope 外であり、契約の消費側として扱う。

## 受入条件トレーサビリティ

canonical source は `features/feat-blog-top-page-composition.md#frontmatter.acceptance` であり、配列の 1 始まり順を A1〜A8 に対応させる。文言は本書で言い換えず、要約だけを載せる。

| ID | 要件要約 | confirmed source | 主phase | 必須証跡 |
|---|---|---|---|---|
| A1 | 区画 4 種の順序と各区画の空状態 | feature/context A1・ui-ux qa-uiux-web-top-composition-v6・観測 fact §2 | P01,P02,P04,P05,P06,P07,P08,P11 | 区画構成台帳、section-composition テスト |
| A2 | 最新/人気切替の JS 無効到達性 | feature/context A2・url-contract・progressive-enhancement | P01,P02,P04,P05,P06,P07,P11 | no-js e2e、URL 契約 |
| A3 | 追従ヘッダー 3 機能・畳み/復帰・自己遮蔽回避 | feature/context A3・ui-ux qa-uiux-web-top-composition-v6・frontend qa-frontend-web-fixed-header-seo-aio-v6 | P01,P02,P03,P04,P05,P06,P07,P08,P09,P11,P12 | 機能予算定義、sticky-header-budget テスト |
| A4 | フッター 7 導線への到達 | feature/context A4・frontend qa-frontend-web-blog-builder | P01,P02,P04,P05,P06,P07,P08,P11 | 導線到達テスト、acceptance report |
| A5 | WebSite+SearchAction+ItemList の JSON-LD | feature/context A5・frontend qa-frontend-web-seo-ai-search-v2・観測 fact §5/§7 | P01,P02,P04,P05,P06,P07,P11,P13 | JSON-LD 契約、schema 検証結果 |
| A6 | 参照元資産の非存在を機械検査 | feature/context A6・non-imitation・観測 fact 全体 | P01,P02,P03,P04,P06,P09,P10,P11,P12 | 非模倣静的検査ログ、CI 組込み確認 |
| A7 | axe-core 重大違反 0 と light/dark コントラスト | feature/context A7・ui-ux アクセシビリティ確定章 | P04,P06,P09,P11 | axe レポート、コントラスト測定 |
| A8 | カード固有寸法・CLS 0.1 未満・OGP fallback | feature/context A8・ui-ux qa-neutral-ogp-fallback-v6・frontend qa-request-thumbnail-coverage-v6・観測 fact §3/§4 | P01,P02,P04,P05,P06,P07,P09,P11 | CLS 測定ログ、fallback 選択の単体テスト |

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P01` | 区画構成・カード規約・ヘッダー機能予算・非模倣ゲートの要求ベースライン確定 | — |
| P02 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P02` | 構成コンポーネント・URL契約・JSON-LD契約・非模倣静的検査の設計 | P01 |
| P03 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P03` | 設計の独立レビュー (責務混入と観測 fact の読み替えの検出) | P02 |
| P04 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P04` | 区画/ヘッダー/JS無効/非模倣/JSON-LD の受入テスト契約を先に用意 | P03 |
| P05 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P05` | 区画構成・記事カード・追従ヘッダー配置・URL段階的強化・JSON-LD の実装 | P04 |
| P06 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P06` | 単体・結合・境界値・回帰・a11y・no-js テストの実行 | P05 |
| P07 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P07` | A1–A8 の feature 受入判定 | P06 |
| P08 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P08` | 既存トップページ実装の 3 機能予算への移行と後方互換 | P05 |
| P09 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P09` | a11y・CLS・非模倣 CI 組込み・運用 readiness の独立QA | P07,P08 |
| P10 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P10` | 独立最終レビュー (非模倣の実効性と feature 境界) | P09 |
| P11 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P11` | 再現可能な証跡の確定と evidence manifest | P07,P09,P10 |
| P12 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P12` | runbook・障害モード対応・引き継ぎの確定 | P10,P11 |
| P13 | `SYS-BLOG-TOP-PAGE-COMPOSITION-P13` | development 展開・rollback 確認・仕様書への書き戻し | P12 |

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-blog-top-page-composition` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `SYS-BLOG-TOP-PAGE-COMPOSITION-P01..P13` | confirmed | pass | complete | なし |

`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## 未決事項

書かれていない判断は創作せず、次の phase で確定する。

| 事項 | 確定先 |
|---|---|
| 各区画の表示件数 (おすすめ / 最新 / 人気 / カテゴリー) | P01 区画構成台帳 |
| 追従ヘッダーの高さと、見出しに与える上余白の具体値 | P02 アーキテクチャ設計 |
| 狭い画面の判定境界 (畳み挙動が始まる幅) | P02 アーキテクチャ設計 |
| `ItemList` に載せる件数と対象区画 | P02 JSON-LD 契約 |
| 非模倣検査の allowlist に置く項目 | P01 非模倣ゲート対象定義 |

## task-graph buildへの制約

- implementation 前に、この repository の `node_modules/next/dist/docs/` で対象 API の Next.js 現行ガイドを読む。
- 既存の読者向け描画経路 (`src/app/s/[site]/page.tsx`、site presentation 層、`public-site-projection`) を維持し、同じ責務の描画経路を増やさない。
- P04 のテストを先に定義し、pixel 位置や DOM 構造ではなく、可視ラベル、accessible name、状態、URL 契約、出力データの契約で検証する。
- 追従ヘッダーへ 3 機能を超えて足さない。参照サイトの観測 fact を実装契約へ無批判に読み替えない。
- 他 feature が所有する責務 (sticky 部品実装・配色選択 UI・サムネイル生成・検索索引と結果面・記事本文レイアウト・自動反映履歴面) を本 feature の write scope で実装しない。
- 本番公開、外部サービス契約変更、破壊的移行は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各 task の write_scope と Verification and evidence を実装 authority とする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-blog-top-page-composition.json`
- trace entries: `.dev-graph/handoff/requirements-trace-entries-feat-blog-top-page-composition.json`
- implementation code generated by this verb: `0`
