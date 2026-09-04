# 実装要件定義書: feat-reference-blog-admin-ux

> 本書は dev-graph `requirements` verb が、確定 system spec、参照サイト解析、現行画面 gap、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:4671e5c50b4c15e57a02fe4cd2910358db78dbe200215b5f1fa6fca4657ac919`
- graph revision: `276`
- scope digest: `sha256:7d6e7ce01c9bac96b4f5c52f41ab401d2e311269dab4d0d0ba5b0e2c30b4eee8`
- feature package: `feature-package/feat-reference-blog-admin-ux`
- promoted generation digest: `sha256:a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-08-29T15:07:22Z`

## 目的と到達状態

- 目的: 参照ブログの公開ページ群と現行管理画面を証跡付きで解析し、著作物・ブランドを複製せずに読みやすいブログ構成へ抽象化するとともに、運営者が新規作成・改善・保存・アフィリエイト確認を迷わず完了できる管理体験を作る。
- 到達状態: 全公開 URL が画面型へ分類され、公開面と管理面の詳細画面一覧、共通レイアウト、記事の会話・比較・まとめの構成、非模倣デザイントークンが実装可能な仕様として揃う。管理面は1画面1目的・主要操作1つ・段階的開示を守り、保存5状態、アフィリエイト URL の即時リッチプレビュー、掲載ページ/ブロックへの逆引きを一貫した操作で提供する。

## 分析対象と証跡基準

公開情報だけを対象とし、認証・有料・非公開領域、robots やアクセス制御の回避は対象外とする。2026-08-29 の分析ベースラインは次のとおりである。

| 区分 | ベースライン | 要件 |
|---|---:|---|
| sitemap parts | 14 | sitemap index と各 part の URL・取得時刻・応答・digest を保存する |
| 2018–2026 年記事 | 968 | 年別件数を再計算し、全件を記事画面型へ分類する |
| 固定ページ | 17 | profile、sitemap、policy、比較/ナビゲーター等へ分類する |
| category | 32 | 一覧型として代表 desktop/mobile 証跡を持つ |
| tag | 32 | ブランド/主題一覧型として代表証跡を持つ |
| author | 23 | 著者プロフィール/投稿一覧型として代表証跡を持つ |
| canonical URL 合計 | 1,072 | 重複 sitemap entry を除外し、未分類0件にする |

「全ページ分析」は全1,072 URLを台帳化・分類・差分検知の対象にし、各画面型から複数の代表ページを詳細解析することを意味する。各 URL の本文や画像を複製して保存することは意味しない。

## 公開面の画面型と詳細構成

| 画面型 | 主目的 | desktop 構成 | mobile 構成 | 必須解析項目 |
|---|---|---|---|---|
| サイトトップ | 最新・主要カテゴリへの案内 | header、hero、最新帯、カテゴリ群、補助導線、footer | 1カラム、優先順に折り畳み | 情報優先度、帯の順序、CTA、回遊 |
| ブログ一覧 | 記事探索 | breadcrumb、見出し、記事カード一覧、sidebar | sidebar を本文後またはdrawerへ | カード密度、pagination、絞り込み、空状態 |
| 記事詳細 | 読了と比較・判断 | 本文カラム + 追従 sidebar | 1カラム + 目次/CTAの非阻害配置 | 下記「記事解剖」の全ブロック |
| category/tag | 主題別探索 | 見出し、説明、記事一覧、sidebar | 1カラム | taxonomy、件数、並び順、canonical |
| author | 信頼形成と投稿探索 | profile、資格/方針、投稿一覧 | profileを先頭に集約 | 著者情報、監修、関連投稿 |
| profile/policy | 運営主体・法務確認 | 本文中心、局所ナビ、footer | 1カラム | 見出し階層、問い合わせ/法務導線 |
| sitemap | サイト全体探索 | 分類別リンク群 | 折り畳み可能な1カラム | 全体IA、件数、階層 |
| comparison/navigator | 選択支援 | 条件、比較表、診断/絞り込み、CTA | 横表をカード/scrollへ変換 | 条件、比較軸、根拠、次行動 |

### 記事詳細の解剖順序

1. breadcrumb、記事タイトル、公開/更新日、著者。
2. リード文と結論の先出し。必要な場合だけ独自図解の featured visual を置く。
3. アフィリエイト開示、商品カード、利点/欠点、目次。
4. 診断・比較・条件分岐などの選択支援モジュール。
5. H2/H3 本文、会話、注意、比較表、スペック表、手順、独自図解。
6. 文脈上必要な位置だけ CTA を再掲し、同一 CTA の過密表示を避ける。
7. まとめ、著者/監修、関連記事、前後記事、共有、タグ、コメント。
8. sidebar は検索、著者、カテゴリ/タグ、人気/新着、補助 CTA、目次を役割別に配置する。狭幅では本文を遮らない。
9. footer はサイト案内、運営/法務、関連サイト/補助リンクの階層を持つ。

写真は転載せず、構造図、比較図、フロー、判断ツリー、アイコン、データ表、抽象的な独自イラストへ置き換える。図解には要点、読み順、代替テキスト、出典種別を持たせる。

## 非模倣デザイン要件

- 参照元の文章、写真、ロゴ、イラスト、固有名、色値、CSS、テーマ/プラグイン資産を転用しない。
- 再利用するのは情報階層、画面型、読み進める順序、操作原則、観測可能な配置パターンだけとする。
- 色、type scale、spacing、radius、shadow、iconography は本プロダクト固有 token として定義する。参照元の実測値を token 値にしない。
- 会話表現は役割とテンポだけを抽象化し、人物名、口調、文言、吹き出し造形を独自化する。
- CI の non-copying gate は禁止ホスト/固有文字列/画像 hash/色値リストを検査し、例外は根拠付き allowlist に限定する。

## 管理画面一覧と認知負荷要件

| screen ID | 画面 | 1つの目的 | 主操作 | 常時見える情報 | 段階的に開く情報 |
|---|---|---|---|---|---|
| ADM-OVERVIEW | ブログ運用ホーム | 次に行う作業を決める | `記事を作る` | 下書き、要改善、保存失敗、要確認リンク | 詳細指標、履歴 |
| ADM-CONTENT-LIST | 記事/固定ページ一覧 | 対象を見つける | `新規作成` | 状態、タイトル、サイト、更新、改善数、リンク数 | bulk操作、詳細filter |
| ADM-ARTICLE-NEW | 新規記事 | 最初の下書きを作る | `下書きを作成` | テンプレート、タイトル、サイト、必須項目 | SEO、配置、公開設定 |
| ADM-ARTICLE-EDIT | 記事編集 | 内容を安全に直す | `保存` | 保存5状態、preview、outline、該当block | 高度な属性、履歴、公開設定 |
| ADM-IMPROVEMENT | 改善 | 指摘を理解して反映する | `この改善を適用` | 重要度、該当箇所、before/after、根拠 | 一括適用、詳細分析 |
| ADM-SITE-LAYOUT | サイト/レイアウト | 公開面構成を整える | `変更を保存` | header/body/sidebar/footer preview | 詳細token、例外設定 |
| ADM-AFFILIATE-LIST | アフィリエイト一覧 | 状態と掲載状況を把握する | `リンクを追加` | 商品、提携先、状態、最終確認、掲載数、要確認 | 高度filter、監査履歴 |
| ADM-AFFILIATE-NEW | URL登録 | 保存前にリンク内容を確認する | `この内容で登録` | URL解析状態と9項目preview | 手動補正、取得詳細 |
| ADM-AFFILIATE-DETAIL | リンク詳細 | 内容と掲載先を直す | `変更を保存` | 商品情報、状態、全掲載数 | 取得履歴、監査情報 |
| ADM-PLACEMENTS | 掲載先逆引き | 掲載箇所を特定する | `記事で確認` | site/page/block、状態、最終描画 | 過去配置、差替え履歴 |
| ADM-ANALYSIS | 解析台帳 | 分析の鮮度と欠落を確認する | `差分を確認` | URL数、画面型、取得日時、未分類、gap | sitemap詳細、代表証跡 |

### 共通操作原則

- 1画面1目的、視覚的 primary action は1つ。同価値の強いボタンを並べない。
- ラベルは `作成する`、`保存する`、`改善を適用`、`記事で確認` のような日本語の動詞で結果を表す。
- 新規作成は「テンプレートを選ぶ → 必須情報を入れる → 下書きを作る」の主導線1本にし、詳細設定は作成後に開く。
- 一覧から行を選ぶと同じ文脈で編集へ進み、戻ったときの検索・絞り込み・scroll位置を保持する。
- 空状態は説明より先に推奨行動を1つ示す。エラーは原因、保持された内容、復旧操作を同じ場所に示す。
- 危険操作は通常操作から分離し、対象名と影響を確認してから実行する。単なる保存に確認dialogを出さない。
- keyboard、200% zoom、screen reader を標準経路として扱い、状態を色だけで伝えない。

## 保存と改善の状態機械

保存状態は全編集画面で同じ位置・語彙・iconで表す。

| 状態 | 表示 | 操作 |
|---|---|---|
| 未保存 | `未保存の変更があります` | 保存、差分確認 |
| 保存中 | `保存しています…` | 二重送信を抑止し、編集内容は保持 |
| 保存済み | `保存済み 00:00` | preview、次作業 |
| 保存失敗 | `保存できませんでした` + 理由 | 再試行、内容copy、local復元 |
| 競合 | `別の更新があります` | 差分比較、自分/相手/merge選択 |

- 自動保存と明示保存は同じ revision/token と状態表示を使い、「保存されたか」を二重管理しない。
- 画面遷移時に未保存があれば、内容を失わない選択肢を提示する。
- 改善は重要度と該当 block でまとめ、1件ずつ preview → 適用 → 取消しできる。一括適用は全差分確認後だけ許可する。

## アフィリエイト URL プレビューと一覧

URL 貼付後、登録前に次を同じ preview card へ表示する。

1. 正規化前 URL と canonical URL。
2. 商品名/リンク名。
3. 販売元・提携先。
4. 商品画像。利用不可・権利不明・未取得時は独自図解 fallback。
5. 価格、通貨、取得時刻。価格保証ではないことを明示する。
6. 取得元と取得方法。
7. 同一 canonical/product の重複候補。
8. 取得状態と失敗理由。
9. 保存後に利用可能になる掲載先/置換方針。

- remote fetch は allowlist/denylist、DNS/IP 再検証、redirect 上限、timeout、response size/content-type 制限を持ち、private/loopback/link-local/metadata endpoint を拒否する。
- third-party画像を無断再配信しない。保存可能な権利/契約が確認できない画像は remote reference または独自図解 fallback を使う。
- 一覧は状態、提携先、最終確認、掲載数、要確認で絞り込みできる。行から1操作で site/page/block の掲載先へ移動する。
- 差替えは対象配置数と影響ページを事前表示し、監査履歴へ actor、before/after、時刻、理由を残す。

## データ/API境界

- URL inventory、sitemap snapshot、page archetype、screen inventory、gap ledger は取得証跡と digest を持つ再生成可能な分析 read model とする。
- affiliate canonical record と placement record を分離し、1リンクから複数 site/page/block を逆引きできる。
- preview は未保存状態を表す一時結果であり、登録 use case と同一視しない。重複判定を通過して明示確定した時だけ永続化する。
- article/site CRUD、save revision、improvement patch、affiliate preview/registration/placement は既存 blog-ops/monetization use case を拡張し、並行する正本を作らない。
- Workspace/Brand境界、role authorization、audit event、optimistic concurrency を全 mutation に適用する。

## 受入条件トレーサビリティ

| ID | 要件要約 | confirmed source | 主phase | 必須証跡 |
|---|---|---|---|---|
| A1 | 14 sitemap・1,072 URL台帳 | feature/context A1・frontend sitemap read model | P01,P04,P07,P10,P11 | snapshot、URL inventory |
| A2 | 全URL分類とdesktop/mobile代表解析 | feature/context A2・frontend blog builder・architecture | P01,P02,P04,P07,P10,P11 | archetype analysis |
| A3 | 公開/管理の詳細画面一覧 | feature/context A3・UIUX-REQ・frontend blog builder | P01,P02,P04,P07,P10,P11 | screen inventory、component contract |
| A4 | 非模倣tokenと図解置換 | feature/context A4・requirements U7・frontend・architecture | P01,P02,P03,P04,P05,P06,P07,P09,P10,P11,P13 | design system、non-copying report |
| A5 | 新規作成の主導線1本 | feature/context A5・UI-UX認知負荷・単一用途CRUD | P01,P02,P03,P04,P05,P06,P07,P09,P10,P12 | state machine、usability report |
| A6 | 保存5状態と無損失復旧 | feature/context A6・UIUX-REQ・frontend preview | P02,P03,P04,P05,P06,P07,P08,P09,P10,P12,P13 | save tests、競合/復元証跡 |
| A7 | 改善の個別preview/適用/取消し | feature/context A7・UI-UX認知負荷・単一用途CRUD | P02,P03,P04,P05,P06,P07,P09,P10,P12 | improvement flow evidence |
| A8 | URL貼付時の9項目preview | feature/context A8・frontend preview・architecture | P01,P02,P03,P04,P05,P06,P07,P08,P09,P10,P12,P13 | preview contract、SSRF tests |
| A9 | affiliate一覧と掲載先逆引き | feature/context A9・UI-UX・frontend・affiliate正本 | P01,P02,P03,P04,P05,P06,P07,P08,P09,P10,P12,P13 | placement map、usability report |
| A10 | 初見タスク成功率90%以上 | feature/context A10・UI-UX認知負荷・UIUX-ACC-004 | P04,P06,P07,P09,P10,P11 | usability protocol/report |
| A11 | a11y・200% zoom・keyboard | feature/context A11・UIUX-ACC-004・architecture | P02,P03,P04,P05,P06,P07,P09,P10,P11 | axe/E2E evidence |
| A12 | gap ledgerと実装証跡の対応 | feature/context A12・UIUX-REQ・単一用途CRUD | P01,P04,P07,P10,P11,P13 | acceptance trace、evidence index |

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-REFERENCE-BLOG-ADMIN-UX-P01` | 全公開URL・画面型・現行画面の要求ベースライン確定 | — |
| P02 | `SYS-REFERENCE-BLOG-ADMIN-UX-P02` | 低認知負荷UI・URL preview・非模倣公開面の設計 | P01 |
| P03 | `SYS-REFERENCE-BLOG-ADMIN-UX-P03` | 設計の独立レビューと非模倣・安全性ゲート | P02 |
| P04 | `SYS-REFERENCE-BLOG-ADMIN-UX-P04` | 受入・回帰・a11y・usabilityのテスト設計 | P03 |
| P05 | `SYS-REFERENCE-BLOG-ADMIN-UX-P05` | 分析基盤・公開面・管理CRUD・affiliate可視化の実装 | P04 |
| P06 | `SYS-REFERENCE-BLOG-ADMIN-UX-P06` | 単体・結合・E2E・securityテストの実行 | P05 |
| P07 | `SYS-REFERENCE-BLOG-ADMIN-UX-P07` | A1–A12と初見操作性のfeature受入 | P06 |
| P08 | `SYS-REFERENCE-BLOG-ADMIN-UX-P08` | 既存blog-ops・affiliate・保存モデルとの移行 | P05 |
| P09 | `SYS-REFERENCE-BLOG-ADMIN-UX-P09` | a11y・性能・安全性・非模倣の独立QA | P07,P08 |
| P10 | `SYS-REFERENCE-BLOG-ADMIN-UX-P10` | 目的・受入・品質証跡の独立最終レビュー | P09 |
| P11 | `SYS-REFERENCE-BLOG-ADMIN-UX-P11` | 全URL分析・受入・QA証跡の再現可能な集約 | P07,P09,P10 |
| P12 | `SYS-REFERENCE-BLOG-ADMIN-UX-P12` | 管理者ガイド・分析更新runbook・障害対応 | P10,P11 |
| P13 | `SYS-REFERENCE-BLOG-ADMIN-UX-P13` | development展開・rollback・仕様書への書き戻し | P12 |

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-reference-blog-admin-ux` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `SYS-REFERENCE-BLOG-ADMIN-UX-P01..P13` | confirmed | pass | complete | なし |

`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph buildへの制約

- implementation前に、このrepositoryの `node_modules/next/dist/docs/` で対象APIのNext.js 16現行ガイドを読む。
- 既存 blog-ops、affiliate、auth、D1/Drizzle、Cloudflare Workers/OpenNext の境界を維持し、同じ責務のuse case/storeを増やさない。
- P04のテストを先に定義し、pixel位置やDOM構造ではなく、可視ラベル、accessible name、状態、API契約、永続化結果で検証する。
- 本番公開、外部サービス契約変更、破壊的移行は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各taskのwrite_scopeとVerification and evidenceを実装authorityとする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-reference-blog-admin-ux.json`
- implementation code generated by this verb: `0`
