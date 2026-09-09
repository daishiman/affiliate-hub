---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2, G3]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-frontend-web-site-scoped-route-ownership。裏付け質疑 (`qa_refs`): `qa-frontend-web-editor-verbatim`, `qa-frontend-web-blog-scoped-admin`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2`, `qa-frontend-web-aeo-emission-v4`, `qa-seo-approved-diff-20260906`, `qa-frontend-web-fixed-header-seo-aio-v6`, `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-request-thumbnail-coverage-v6` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: Web 以外を対象外にした帰結として、断片の描画部品を React 以外の描画系 (SwiftUI / Compose / デスクトップ) へ移植する必要がない。19 種の断片に対する描画部品の正本を 1 系統に留められる。 |
| タブレット (tablet) | 対象外 | 理由: Web 以外を対象外にした帰結として、断片の描画部品を React 以外の描画系 (SwiftUI / Compose / デスクトップ) へ移植する必要がない。19 種の断片に対する描画部品の正本を 1 系統に留められる。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Web 以外を対象外にした帰結として、断片の描画部品を React 以外の描画系 (SwiftUI / Compose / デスクトップ) へ移植する必要がない。19 種の断片に対する描画部品の正本を 1 系統に留められる。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Web 以外を対象外にした帰結として、断片の描画部品を React 以外の描画系 (SwiftUI / Compose / デスクトップ) へ移植する必要がない。19 種の断片に対する描画部品の正本を 1 系統に留められる。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: Web 以外を対象外にした帰結として、断片の描画部品を React 以外の描画系 (SwiftUI / Compose / デスクトップ) へ移植する必要がない。19 種の断片に対する描画部品の正本を 1 系統に留められる。 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | frontend × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-frontend-web-site-scoped-route-ownership` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`frontend`) を主担当とする **2 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 |
| `dec-structured-data-emission` | 構造化データ (Article/BlogPosting・FAQPage・HowTo・Speakable・BreadcrumbList) と canonical・OGP・robots を、どこで生成するか。現状は記事本文へ書き手が書き込む前提の箇所があり、書かれなければ欠落したまま公開される。 | `opt-render-time-derive` | confirmed | G3, G1 |

- **`decision-ui-theme-implementation` の caveat**: 色の定義を 1 か所へ集めないと、コントラストの下限（09 §4）を測る対象が散る / cookie と URL から来る名前は必ず解析関数を通す（09 §2-2）。素通しにすると壊れて見えない画面になる / light-dark() を解さない環境では既定色になる。それが読める色であることを確かめる

- **`dec-structured-data-emission` の caveat**: 生成関数の回帰は画面から見えない。構造化データの出力を対象にした検査を実装と同時に置くこと。置かなければ『生成しているつもりで壊れている』状態が長期間検出されない / FAQPage/HowTo/Speakable は記事本文から機械的に導出できない情報を要する。記事データ側にその項目を持たせる設計を先に決めること。持たせずに始めると、生成できる型だけを生成して型の数を満たしたことにする Goodhart 化が起きる / 根拠として引用した Google 検索セントラルと schema.org は 2026-09-03 取得の入口ページで、個別型 (FAQPage/HowTo/Speakable) の要件ページは本セッションで再取得していない。実装着手時に各型の必須プロパティを公式資料で再確認すること / 書き手の入力を値として埋め込む際のエスケープを生成関数の内側で行うこと。呼び出し側の責務にすると呼び忘れが起きる

## 確定内容 (質疑録)

### qa-frontend-web-site-scoped-route-ownership (対応セル: web)

**質問**: frontend×web: ブログ単位へ移す画面の URL 階層をどう決め、いまの横断 URL (/admin/content/*, /admin/blog/*) からの移行をどう扱うか

**回答**: /admin/sites/[site]/ を正本の階層とし、記事・読者像・書き方の決め事もこの配下へ置く。ブログを特定しない画面 (ブログ一覧・ブログ間比較) だけが /admin/sites とその上位に残る。既存の /admin/content/* と /admin/blog/* は消さずに転送で受け、ブログが特定できる場合は対応する /admin/sites/[site]/... へ、特定できない場合はブログ選択へ送る。既存の入口を突然消すと、書き手が覚えている経路と保存済みのリンクが一斉に死ぬためである。site セグメントが解決できないときは notFound とし、他ブログの内容を出さない。画面には『いまどのブログを見ているか』を常に出し、ブログの切替は同じ画面のまま別ブログへ移れる形にする

### qa-frontend-web-editor-verbatim (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 記事に置ける表現物として利用者は何を挙げたか。断片カタログを起草する前に、利用者が実際に挙げた対象を逐語で記録する

**回答**: [追加要望 (2026-09-05)]
「これ以外にもコードブロックだったり、カードを生成したりとか、横に画像を並べたりとか、表形式を作成するだったりとか、色をつけたものを作るとか、そういうようないろんなものに対応できるように、記事を作成する上で必要な情報を全て盛りだくさんに入れておいてほしいです。」

[機能要望 (2026-09-05)]
「ブログを作成するためのブログエディターが欲しいです。Notionのような管理画面の方でブログを編集できるようなブログエディターが欲しいです。その際に記述したら、もうその瞬間に表示されるようなコードブロックで表示されるような形ではなく、どのような形で表示されるかが見た目的にわかるようなコードエディターが欲しいです。ただし、編集したら見出し2が見出し1に変わるなど、Notionを改善するような形で構築できてほしいです。カードだったり画像を添付したりとか、そのようなところもしっかりと反映できるように、全ての今のブログを構成する情報が編集表示できるように、そのように整えてほしいです。今それが全然反映されていないです。」

[AskUserQuestion「編集体験をどうするか」への選択]
「断片欄を維持し、全断片を見た目へ（推奨）」

※ この answer は利用者の逐語のみで構成する。ここから導いた受入条件・要件 ID は design_applications と chapter_notes に置く (harness doctrine: 利用者の逐語へ後から気づいた突き合わせを足さない)。

### qa-frontend-web-blog-scoped-admin (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 管理画面 88 ページを『記事ごと』ではなく『ブログごと』に扱えるようにするには、画面の構造をどう組み替えるか。ヒートマップの描画はどう実現するか

**回答**: ブログを選ぶ操作を、画面ごとの絞り込みではなく URL の階層そのものにする。/admin/sites/[site]/ の下へ、そのブログに閉じた画面 (記事・レイアウト・固定ページ・ドメイン・分析・SEO/AEO・配信) を集め、いま /admin/blog/* や /admin/analytics にある横断画面は『全ブログの比較』として別に残す。どちらの画面を見ているのかが URL とパンくずで分かる状態にし、絞り込みの選択が画面遷移で消えないようにする。既存 /admin/blog/* は当面残して /admin/sites/[site]/ へ転送し、リンク切れを作らない。ヒートマップは読者側と管理側の 2 つに分ける。読者側は IntersectionObserver で到達深度を、visibilitychange と滞在タイマーで滞在を、クリックは委譲したリスナ 1 つで要素基準の比率へ変換して送る。送信は個別ではなく sendBeacon でまとめて送り、読者の体感を落とさない。管理側は記事のプレビューを背景に、比率で受け取った点を canvas へ重ねて描く。端末幅ごとに重ねると意味が壊れるので、viewport_bucket (狭い/中/広い) を切り替えて表示する。同意が無い読者の点も (reader_key を持たないまま) 描画対象に含める

### qa-frontend-web-blog-composition-visibility (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 作ったブログが何で構成されているかが見えず改善に着手できない。どこまで見えれば解決とみなすか。

**回答**: 4つすべてを満たす。(a) 作成直後に読者側の住所が実際に開き、404にならない。(b) 管理画面にそのブログの構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) を実データの件数と各実体へのリンク付きで一覧する。(c) 管理画面の中で読者と同じ見た目をプレビューでき、公開前に確認できる。(d) 作成時点で公開に必要なのに無い要素を名指しで提示し、その場へ移動できる。描画は既存の SiteFrame と public-site-projection を通し、読者用と別の描画経路を作らない。作ると管理画面で見える姿と読者が見る姿がずれる。

### qa-frontend-web-capture-self-occlusion (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 改善要望フィードバックで画面の写しを撮るとき、送信モーダルと固定ボタン自身の写り込みをどう扱うか (2026-08-30 利用者ヒアリング)

**回答**: 利用者本人の回答を逐語主旨で記録する。(1) 「改善したい箇所のスクリーンショットを撮ると、編集画面の『改善したいことを送る』という画面が表示され、そのスクリーンショットが貼られてしまう」。(2) 「これでは本当に改善したい箇所を伝えることができない」。(3) 対処の範囲を 3 案 (機能ごと無効化 / 撮影中だけ自動で隠す / モーダルの自動表示だけ止める) で確認したところ、利用者は「撮影中だけ自動で隠す」を選択した。すなわちフィードバック機能そのものは残し、写しの取得が確定するまでの間だけ、送信モーダルと右下の固定ボタンを写しの対象から外す。(4) 撮り直し (再撮影) のときも同じ扱いとする。

### qa-frontend-web-affiliate-link-preview-v3 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 成果リンクを貼り付けた直後、登録判断のために何を画面へ表示するか（2026-08-29 利用者追加入力）

**回答**: アフィリエイトの、えーと、リンクを貼ったら、えーと、その画像、えーと、が表示されるとか、えー、この辺、えー、とりあえず、えー、画面を見て、えー、確認もしておいてください。

### qa-frontend-web-seo-ai-search-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: SEO と AI 検索最適化 (SSR・構造化データ自動生成・robots/sitemap/RSS/llms.txt・IndexNow・鮮度表示) の実装契約と、最新ガイドライン出典の取り込み経路をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録) + 同日ウェブ調査。

**回答**: 利用者本人の回答を逐語主旨で記録する。
(1) 合わせて、SEO や AI による『その SEO に変わるやつ』(AI 検索・生成 AI 回答での引用) にも対応できるようにしておく。AI からの検索や評価が高くなるような仕組みにしておく。
(2) 最新のこれらの情報 (SEO / AI 検索最適化のガイドライン) をウェブから、海外も日本の情報も含めて取得した上で、それを反映できるようなブログを構築できるようにしておく。
#### 調査結果 (2026-08-24、海外+日本。一次情報と業者推定を区別)
- 一次情報: Google Search Central『AI 最適化ガイド』(2026-05-15 公開) は、AI Overviews / AI Mode が既存ランキング+RAG+query fan-out で動き、追加の技術要件は無く、index 可能かつ snippet 表示可能であることが唯一の条件、llms.txt や特別な schema は不要と明言する。Search Console に AI 機能由来の impressions を見る report がある。
- 一次情報: llms.txt (Answer.AI) は root の /llms.txt に Markdown を置く規約で正式標準ではない。IndexNow (Bing/Yandex/Naver/Seznam) は URL 更新 push で Google 非対応。ChatGPT search の retrieval は Bing index 由来のため IndexNow が AI 検索への到達経路になる。
- 海外/日本の業者知見 (推定値扱い): AI クローラ (GPTBot / ClaudeBot / PerplexityBot / Google-Extended) を遮断しない、各節冒頭に 2〜3 文の『答え』、統計・出典の明記、FAQPage/HowTo/Article/Person/Organization/BreadcrumbList の JSON-LD、最終更新日と『〜時点』の可視化、著者ページ (E-E-A-T)、AI 引用の定点観測。日本では FAQ 構造化データと結論ファーストを優先する論調が多く、アフィリエイト記事は一次体験・独自比較表・図解が有利。
#### frontend 章への反映方針
- 公開面は SSR/ISR で本文を HTML に含め、semantic HTML (article/section/h1〜h3/time) で出力する。robots.txt はテンプレート既定で AI クローラを許可し、ブログ単位で拒否リストを設定できる。
- ブロック構造から JSON-LD を自動生成する: BlogPosting/Article・Person (著者)・Organization・BreadcrumbList・FAQPage (FAQ ブロック)・HowTo (手順ブロック)・Product/Review (比較表・レビュー)。schema.org の型・必須プロパティを検証する pure 関数を置き、テストで妥当性を確認する。
- 配信: sitemap.xml・RSS/Atom・/llms.txt (低コスト・効果未確認と明記) を自動生成し、公開・更新時に IndexNow へ送信する (API key はブログ単位、秘密はサーバ側のみ)。
- 鮮度: 各記事に dateModified を出し、公開面にも『最終更新日』『〜時点』を表示する。
- 最新情報の取り込み: SEO / AI 検索ガイドラインの出典 (Google AI 最適化ガイド・AI 機能ページ・llms.txt・IndexNow) を仕様状態の targets / fetched-references に登録し、doc-fetch (C02) と鮮度監査 (C08) で再取得・再照合できるようにする。アプリ側は参照レジストリ (guideline_references) を DB に持ち、管理画面で確認日・要約を更新できる。

- (注記: 正本 qa_log[qa-frontend-web-seo-ai-search-v2].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-frontend-web-blog-builder (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: ブログテンプレート/テーマ/常時表示レイアウト/法定ページ/図解・比較ブロックの実装契約をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録)。参考ブログ https://makuring.jp/ は構成のみ参考にし、文章・素材は転用しない。同サイトの機械取得は本セッションで拒否されたため、構成の一次根拠は利用者の説明とする。

**回答**: 利用者本人の回答を逐語主旨で記録する。
(1) ブログを作成するための UI を構築・変更したい。今後様々なブログを作るため、ブログごとにテンプレートを元に作成できるようにする。
(2) ブログの色合い (配色) はその都度選択して構成を変更できるようにする。ページ単位で「このページはこの色合い」と調整できるようにする。
(3) ブログに関して、見える部分 (公開面)・作成する部分 (編集)・保存する部分 (永続化)・管理上で一覧表示する部分 (管理一覧) のそれぞれで、どのブログにどのアフィリエイトが反映されているかを管理できる UI/UX にする。
(4) 参考ブログ (makuring.jp) を丸パクリせず、配置・構成・タイトルの表記方法・トップページから作れるページ種別を参考に構築する。文章はそのまま使わない。
(5) 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせを含めて全て構築できるようにする。
(6) 各ページの構成・記事の見やすい配置・図解・比較などの表現パターンも参考にして構築できるようにする。
(7) 参考ブログはガジェット前提だが本システムはガジェット限定ではないので、ジャンル依存部分 (スペック表など) は差し替え・調整できるようにする。
(8) サイドバー・ヘッダー・フッターは常に見えるようにする。参考ブログはスクロールで流れてしまうので、スクロール追従 (sticky) で整える。
(9) 今回で全ての内容を実装したいので、要件定義からタスク管理表まで作成する。
#### frontend 章への反映方針
- ブログ構成は宣言的データ (blog blueprint) とし、レンダリングは共通コンポーネント群 (Next.js/React) が担う。テンプレート = セクション型カタログの組合せ、テーマ = デザイントークン集合 (色は light-dark() で解決)。
- レイアウト部品: StickyHeader / StickySidebar / Footer を共通 layout に固定し、ページテンプレートはメイン領域だけを差し替える。
- 記事ブロック: figure(図解)/comparison(比較表)/cta/summary/spec-table(ジャンル依存スロット) の block 型を持ち、エディタで挿入・並べ替えできる。
- 固定ページ: 運営者情報/サイトポリシー/プライバシーポリシー/特定商取引法/お問い合わせ/全カテゴリー を固定ページ型テンプレートから生成し、フッターへ自動導線。お問い合わせは既存フォーム基盤 (改善要望フィードバック) を再利用する。
- 管理画面: ブログ一覧・ブログ詳細 (テンプレート/テーマ/掲載アフィリエイト) ・テーマ編集・テンプレート編集を単一用途画面として分離する。
- 参考サイトの文章・画像は取り込まず、構成のみ参照する。

- (注記: 正本 qa_log[qa-frontend-web-blog-builder].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-frontend-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 改善要望の送信モーダルは何を見せ、何を強制しないか (書面入力 docs/spec/12 §5)

**回答**: - **FB-AC-07**: 「この画面から一緒に送られるもの」を展開でき、自動収集される項目を送信前に確認できる。隠さない。
- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、「この画面には、絵として写しにくい部品があります。撮れた画像を確かめてください。」を常に表示し、プレビューを見てから送る。完全性を保証しない。
- **FB-AC-10**: 「撮り直す」「**画像を外す（文章だけで送る）**」を常に選べる。貼り付け（Ctrl+V）とファイル選択も受け付ける。**画像なしでも送信は成立する。**

### qa-frontend-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: フロントエンド (frontend) × web のアーキテクチャは何か (2026-08-16 対話ヒアリング)

**回答**: 現行構成で確定。技術基盤は現行リポジトリの構成(Next.js + Cloudflare Workers/OpenNext + D1 + Drizzle ORM)を正として仕様に確定する。

### qa-frontend-web-analytics (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: Analytics 拡張の画面ビュー要件は何か (書面入力 docs/spec/03 §8)

**回答**: v1.0 22.8章のフィルタに加えて、次のビューを定義する。
| ビュー | 内容 |
| --- | --- |
| パフォーマンス概要 | 期間比較付きの主要KPI(PV/クリック/CTR/発生・承認CVR/承認・支払EPC/承認・支払報酬)。watermarkによる速報・確定・遅延を区別 |
| ファネル | 表示→閲覧→リンク表示→クリック→成果発生→承認→支払 の残存率。consent区分と対象ディメンションを表示 |
| 切り口分析 | angle × 媒体 のヒートマップ(CTR/EPC切替)。セルにnを常時表示 |
| 配置分析 | 記事テンプレート上に placement 別CTRをオーバーレイ表示 |
| リンク台帳 | TrackingLink 単位の一覧。CTR・EPC・状態・掲載先。並べ替え・CSV出力 |
| インサイト受信箱 | InsightReport の一覧。確認→適用(Brief作成へ遷移)→却下 |
| 実験 | Experiment の事前登録値、探索率、holdout、進捗、信頼区間、guardrail |
| ASP突合状況 | プログラム別の成果件数・承認率・突合率・取り込みエラー |

### qa-frontend-web-overhaul-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 単一用途画面分割・基本管理機能・再利用コンポーネント・マルチブログ/マルチ SNS 対応のフロントエンド要件は何か (2026-08-21 利用者ヒアリング逐語)

**回答**: 利用者本人の回答を逐語主旨で記録する。(1) 管理画面を単一用途ごとの画面に分割する (一覧・詳細・作成・編集の分離)。(2) 各管理対象に新規作成・削除を含む基本 CRUD 操作の UI を備える。(3) 1 つの商品に対して複数のブログを対応付けられる構成にする。各ブログにはそれぞれのコンセプトがあり、コンセプトごとに文章を作成できる UI にする。(4) SNS は X・Facebook など様々なものに対応できる拡張可能なチャネル構成とし、各 SNS への投稿状態が画面に反映されるようにする。(5) UI はコンポーネント化して再利用する。ハードコーディングの重複を書かず共通化する。(6) ブログごとにブログの構成を作成したい。新しくブログを構築する際には、そのブログごとにコンポーネントを作成できる仕様にする (ブログ単位の構成テンプレート/コンポーネントセットを定義・管理できる)。(7) 既存スタック (Next.js/React) を継続使用する。

### qa-frontend-web-aeo-emission-v4 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 記事の実データから SEO/AEO の機械可読要素をどう生成し、欠落をどう機械が検出するか。従来の確定 (公開面 SSR・構成の可視化・JSON-LD 自動生成・sitemap/RSS/IndexNow) を維持したうえで、参考サイト実測を上回るために何を足すか。2026-09-03 利用者ヒアリング。

**回答**: 既存の確定 (qa-frontend-web-seo-ai-search-v2 / qa-frontend-web-blog-composition-visibility) を土台にし、次を追加する。

#### 生成の原則
機械可読要素は記事の保存実体から導出する。人手で別途書き足す前提の欄を作らない。書き足しが要るのは『元データが無い情報』(著者の経歴・出典 URL・FAQ の設問文) だけで、それ以外 (見出し階層・パンくず・公開日・更新日・画像寸法) は保存実体から計算する。読者面と管理画面プレビューは同じ public-site-projection を通し、描画経路を二重に持たない。

#### 出力する機械可読要素
(1) JSON-LD: Article/BlogPosting・Person (著者)・Organization・BreadcrumbList を常時、FAQ ブロックがあれば FAQPage、手順ブロックがあれば HowTo、結論ブロックがあれば Speakable を出す。schema.org の型と必須プロパティを検証する純粋関数を置き、テストで妥当性を確認する。ブロックが無い記事に空の構造化データを出さない。
(2) head: canonical、og:type/title/url/description/image/site_name、twitter:card=summary_large_image、robots に max-image-preview:large を出す。
(3) 画像: width/height を必ず出して読み込み中の版面ずれを防ぎ、本文外の画像は遅延読み込み、ヒーロー画像は先読みする。alt は保存実体の値をそのまま出し、空を許すのは装飾宣言済みのときだけ。
(4) 見出し: 本文の見出しだけを h2/h3 として出し、関連記事・SNS・広告の見出しは本文階層に混ぜない。
(5) 目次: 追従表示と本文内表示のどちらを出しても、支援技術へ露出する見出しリストは1つに保つ。
(6) リンク: 広告・アフィリエイトリンクには rel に sponsored (必要に応じ nofollow) を機械的に付ける。付け忘れを手作業に委ねない。
(7) 配信: sitemap.xml・RSS/Atom を自動生成し、公開・更新時に IndexNow へ送信する。/llms.txt は低コストかつ効果未確認と明記したうえで生成する。

#### 欠落の検出
公開済み記事1本ごとに、上記のうち検証可能な項目の充足を判定する純粋関数を置く。判定は記事の保存実体だけを入力とし、外部の順位データや推測を混ぜない。判定結果は項目名・該当箇所・不足理由を持ち、管理画面のエディターへそのまま差し戻せる形で返す。アーキテクチャテストで、この判定関数が読者向け描画と同じ投影を読んでいることを機械が確認する。

- (注記: 正本 qa_log[qa-frontend-web-aeo-emission-v4].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-seo-approved-diff-20260906 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 2026-09-06、提示済み eval-log/affiliate-hub/current-worktree/elegant-review/20260906/seo-change-proposal.md への続行確認。承認対象は次の変更提案全体（これは提示内容の要約で、利用者の逐語回答ではない）: 記事と変更前後の差分を運営者が確認し、承認した対象だけを反映する。夜間処理は観測だけを行う。記事更新・変更前後の履歴・所見の反映済み状態を同一の確定単位で保存し、途中失敗時は全体を変更しない。反映と取消は読み出した版との一致を確認し、同時編集や取消前の追加編集を上書きしない。対象範囲は元記事の作成日時で判定し、導入前の記事と作成日時不明の記事はこの反映経路から除外する。SEO実績は選択したブログ・記事と同じページの観測時刻付き推移へ接続し、クリック数だけで因果効果を断定しない。

**回答**: つづけて

### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 追従ヘッダー・サムネイル・構造化データ・AI 向け表現物 (llms-full.txt と WebMCP) を、画面の側の要件としてどう書き分けるか。直前の qa-frontend-web-fixed-header-seo-aio-v5 は AI 向けの出力を目次のみ (llms.txt) として要件化していたが、2026-09-03 の対等提示による再確認で全文提供へ変わり、さらに WebMCP が加わったため差し替える

**回答**: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。

### qa-neutral-aio-policy-v7 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索（AIO）へ向けて、記事の内容をどこまで出しますか。(a) 目次のみ（llms.txt）＋AI学習は許可 — 題名・URL・短い説明だけを出す。【利点】本文は自サイトへ読みに来てもらう形が保たれ、流入が維持される。出す情報が少ないので生成の経路も軽い。後から全文へ広げる余地が残る。【懸念】AI 検索面が本文を引用しにくく、被引用の機会は全文提供より減る。学習許可により自分の文章は学習に使われる。(b) 全文（llms-full.txt）まで出す — 【利点】AI 検索面が本文を引用しやすく、被引用の機会が最も多い。AI 経由の可視性が最大になる。【懸念】本文が自サイトの外で読めてしまうため流入は減りうる。一度出した本文は取り消せない。(c) 何も出さず AI 学習も拒否 — AI 向けの表現物を作らない。【利点】実装コストがゼロで、生成・更新・混入事故の面倒が一切生じない。自分の文章が学習にも引用にも使われず、著作物の管理が手元に完全に残る。読者は必ず自サイトへ来る。【懸念】AI 検索経由の可視性は得られない。今後 AI 検索の比重が上がった場合、後から方針を変えても失った期間は取り戻せない。（2026-09-04 AskUserQuestion『AIO方針』。独立監査 C06 が qa-neutral-aio-policy-v6 の質問文自体を『(a)(b) は「利点＋懸念」の対称構成なのに (c) だけ肯定的な言い回しが一切なく、実装コストがゼロ・学習データへの不使用というありうる利点が書かれていない。否定側の排除に類する機序として中立回答を妨げる疑いがある』と指摘したため、3 案とも「利点＋懸念」を揃えて再提示した。順序は前回と同一。利用者の選択は前回と同じ (b) で変わらなかった）

**回答**: (b) 全文まで出す

### qa-neutral-ai-surface-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索への出し方はどの形にしますか。(a) llms-full.txt ＋ WebMCP の両方 — AI 検索に引用される経路と、AI エージェントに検索・記事取得を使わせる経路の両方を持つ。実装は 2 系統分増える。WebMCP はまだ新しい仕様で対応するエージェントが限られるため、効果が出るのは先になる。(b) llms-full.txt のみ — AI 検索への被引用を狙う目的に対してはこれだけで十分で、今すぐ効く。実装も静的ファイルの生成だけで済む。サイトを訪れた AI エージェントは、普通の人間と同じように画面を読むしかない。(c) WebMCP のみ — AI エージェントに対しては最も高度なことができる。ただし AI 検索のクローラは WebMCP を呼ばないので、『検索結果に引用される』という今回の目的には直接は効かない。（2026-09-03 AskUserQuestion『AIへの出し方』。利用者が qa-neutral-aio-policy-v6 の回答内で『webmcpとか使えばいい？』と逆質問したことへ、llms-full.txt は取りに来るクローラに読ませるもの・WebMCP は訪れたエージェントに操作させるもので狙う場面が別であると回答したうえで提示した）

**回答**: llms-full.txt ＋ WebMCP の両方

### qa-neutral-ogp-fallback-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 記事に画像が無いとき、一覧のカードをどう埋めますか。(a) 自動生成のOGP画像で埋める — カードの寸法が記事によらず一定になり、読み込み中に版面が飛ばない。外部共有時も画像が付く。生成の実装が要り、題名を直したら作り直す手当ても要る。内容を表さない画像なので実写より情報量は劣る。(b) 無地のプレースホルダを置く — 実装が最も軽く、寸法も一定に保てる。ただし全ての画像なし記事が同じ見た目になるため、一覧でカードを見分ける手がかりにならない。外部共有時の見栄えも弱い。(c) 画像枠ごと省いて高さ可変 — 無意味な画像を出さずに済み、文字情報の密度が上がる。カードの高さが記事ごとに変わるので一覧の視線の流れが乱れ、読み込み中に並びが動く。（2026-09-03 AskUserQuestion『画像不在時』。独立監査 C06 が qa-decision-ogp-fallback-v4 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者は前回と同じ案を選んだ）

**回答**: 自動生成のOGP画像で埋める

### qa-request-thumbnail-coverage-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 記事一覧のサムネイル表示は、どの画面を対象にしますか。（2026-09-03 利用者発話『各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。』を受けた要件化。発話は表示する場所を『各画面』と『トップ画面』としか述べていないため、対象の具体化はこの entry の設計適用で行い、発話が述べていない事柄を発話由来として扱わない）

**回答**: 各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)

> 上の「確定内容 (質疑録)」は**方針**である。本節は `feat-blog-ui-builder` (P01〜P12) の
> 実装で**実際に確定した契約**と、方針と実装がずれた点を記録する。
> **方針を書き換えず、差分として足してある。**ずれを上書きで消すと、なぜその形になったかが読めなくなる。

#### 1. テーマ実装契約 — 2 層 + 単一読み取り口

配色は 3 段で解決する。

```
page_theme_override（ページ単位の例外）
        ↓ 無ければ
blog_theme（ブログ既定）
        ↓ 無ければ
site_blueprint.theme（設計図の既定）
```

**確定した契約 — 読む口は `publicBlogAppearance()` の 1 本だけ。** 公開面も管理画面もここを通る。
別の読み方を作ると、同じブログの配色について 2 つの画面が別の値を出す
(2026-08-30 に実際に発生。`docs/spec/feat-blog-ui-builder/migration-report.md` §2)。

**確定した契約 — 2 層で上書きできるのは色 (`brandTheme`) と明暗 (`colorMode`) だけ。**
余白 (`density`) と角丸 (`radius`) は設計図のみ。
ページごとに骨格が変わると読者が「同じサイトだ」と思えなくなるためである。

**確定した契約 — dark を light の単純反転にしない**
(`tests/ui/theme-contrast.test.ts` が止める)。数値上 AA を満たしても暗所で眩しくなる。
11 配色 × light/dark = 22 通りが WCAG 2.2 AA を満たすことを実測済み。

方針の「色は light-dark() で解決」はそのまま成立している。

#### 2. コンポーネント契約 — テンプレートは「並び方」だけを決める

テンプレートは 6 種で確定した (`src/domain/authoring/blog-template.ts`)。
`review_focus` / `comparison_focus` / `howto` / `news` / `minimal` / `gadget`。

**確定した契約 — テンプレートは記事の中身を知らない。** 決めるのは 4 つのみである。

- トップの区画の並び (`homeSections`)
- 記事ブロックの推奨順 (`articleBlockOrder`)
- サイドバーを既定で出すか (`sidebar`。`news` と `minimal` は `false`)
- 追加で薦める固定ページ (`suggestedPages`)

**「このテンプレートでは図解が使えない」の類を書いてはならない。**
書くとテンプレート差し替えの瞬間に既存記事の図解が消える。
`orderBlocksForTemplate()` は推奨順に無い種類を末尾へ元の順のまま付け、**1 つも落とさない**。

方針にあった `StickyHeader` / `StickySidebar` / `Footer` は実装済みである。
ただし受入 A3 (sticky 常時表示) の判定は保留で、単体・受入テストは緑だが
**「常時表示」の言葉の意味が受入文言として定まっていない**
(`docs/spec/feat-blog-ui-builder/final-review.md`)。

表現ブロックは 10 種で確定した。`answer` `key_points` `faq` `sources` `freshness`
`figure` `comparison` `cta` `summary` `spec_table`。
方針の 5 種 (figure/comparison/cta/summary/spec-table) に、AI 検索向けの 5 種が加わった形である。
記事ブロックの並びは全テンプレート共通で
`[answer, key_points]` で始まり `[faq, sources, freshness]` で終わる。
先頭が結論でないと AI 検索に途中から切り取られ、
信頼を確かめる材料は読み終わったところに置くためである。

#### 3. SEO / AI 検索実装契約 (A10〜A14)

##### 3.1 JSON-LD — 画面と機械向け出力は同じ読み取りモデルから作る

**確定した契約 — 別の組み立てを置かない。**
置くと、記事を直したのに sitemap だけ古い、が起きる。

**確定した契約 — 構造化データを HTML に埋めるときは `<` を `<` に逃がしてから埋める。**
逃がさないと、本文に `</script>` を含む記事でスクリプトが途中で閉じ、
以降の JSON が本文として描画される。

**確定した契約 — 更新日は JSON-LD の `dateModified` と `<time dateTime>` で同じ値を出す。**
2 か所で別々に組み立てると、読者に見える日付と機械が読む日付がずれる。

**確定した契約 — 報酬・運営情報は読者向け読み取りポートを通さない。**

##### 3.2 sitemap / robots / RSS / llms.txt

**確定した契約 — origin は届いたリクエストの Host から作る。環境変数に固定しない。**
固定すると、プレビュー環境が本番の URL を書いた sitemap を出す。

**確定した契約 — `llms.txt` は設計図の任意項目。出さない設定なら 404 を返す (空ファイルを返さない)。**
空ファイルは「用意したが中身が無い」と読まれ、404 は「用意していない」と読まれる。意味が違う。

方針の「効果未確認と明記」は維持する。**Google は llms.txt を使わないと明言している。**

##### 3.3 IndexNow — 鍵の環境変数分離

**確定した契約 — 鍵はリポジトリ・管理画面・D1 のいずれにも置かず、Worker の環境変数 `INDEXNOW_KEY` だけに置く。**
鍵ファイル `/indexnow.txt` の中身が鍵そのもので、それが所有権の証明であるためである。
方針の「API key はブログ単位、秘密はサーバ側のみ」のうち、
**実装は環境変数 1 本に確定した** (ブログ単位ではない)。

**確定した契約 — 鍵が無いときは記事の公開は通り、通知だけが飛ばない。**
通知は届けば早くなるだけのもので、届かなくても記事は出る。
公開を止める設計にすると、鍵の設定漏れが公開停止として現れる。

担保している spec は 4 本ある。`tests/domain/seo/indexnow.test.ts` (送信判断の純関数) /
`tests/infrastructure/indexnow-client.test.ts` (鍵が無いときの送信スキップ) /
`tests/presentation/publish-article-indexnow.test.ts` (公開時の連動) /
`tests/architecture/open-doors.test.ts` (外向きに開いた口の台帳)。

##### 3.4 guideline_references — 90 日再確認

**確定した契約 — 90 日の判定は `referenceReviewStatus` だけが行う。画面側で数え直さない。**
2 か所で数えると、時差や境界の扱いが食い違ったときどちらが正しいか決められなくなる。

**確定した契約 — 90 日を超えた行は「再確認」と表示し、自動では消さない。**
消すと、古い指針に基づいた記事が残っていることに気付けなくなる。

**確定した契約 — ガイドラインの中身が変わったときは仕様セルを R4-reopen する。**
アプリのレジストリを直しただけでは仕様は動かない。
方針にあった「doc-fetch (C02) と鮮度監査 (C08) で再取得・再照合」はこの経路である。

**確定した契約 — 記事公開後の AI 検索点検は公開の条件にしない。**
条件にすると、点検を通すために内容を歪める力が働く。足りない項目は直し方 (hint) まで出す。

2026-08-30 時点の実測では、レジストリの登録は 0 件で、コードに書かれた候補 4 件
(Google AI 最適化ガイド / AI features and your website / llms.txt / IndexNow) は
すべて「原典未取得」である。**90 日の判定は動くが、判定する対象が無い。**

#### 4. 方針どおりにならなかった点 (2026-08-30 時点で未解決)

| 方針 | 実装の現状 | 影響 |
|---|---|---|
| 固定ページ 6 種を固定ページ型テンプレートから生成しフッターへ自動導線 | **固定ページの語彙が 2 系統に割れている** (`SiteDocumentKey` 9 種 / `FixedPageKind` 8 種、同じ `legal_page` 表) | 18 経路のうち 12 経路が 404。新しい種別を足せない |
| 公開面は SSR/ISR で本文を HTML に含める | **公開記事の本文が 1 文字も出ていない** (H1 記事名 / H2「この記事の評価」のみ) | JSON-LD の元になるブロックが載る場所そのものが空 |

証跡は `docs/spec/feat-blog-ui-builder/evidence/11-a4-a13-http-status.txt` および
同 `evidence/README.md` §3.1 にある。原因の分析は `migration-report.md` §3。

**この 2 件を解いていない状態では、§3.1 の JSON-LD 契約は「あるべき契約」であって
現状の説明ではない。** 契約が守られていることの確認は、本文が出てから行う。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: feat-blog-ui-builder P01〜P12 の実装で確定したテーマ実装契約・コンポーネント契約・SEO/AI検索実装契約 (JSON-LD/sitemap/IndexNow/guideline_references) を、方針を上書きせず差分として正本へ記録する。章へ直接書くと compile で消えるため。

### 記事カードの図版と題名リンクの読み上げ契約（2026-09-06）

同じ現行契約の全文と記録理由は [記事カードの図版と題名リンクの読み上げ契約（2026-09-06）](ui-ux.md) を参照。本章にも同じ契約を適用する。

### SEOの現行承認契約（2026-09-06）

同じ現行契約の全文と記録理由は [SEOの現行承認契約（2026-09-06）](database.md) を参照。本章にも同じ契約を適用する。

### Search Console検索語内訳の管理画面表示（2026-09-08実装確認）

同じ現行データ・表示契約の全文と記録理由は [Search Console検索語内訳の管理画面表示（2026-09-08実装確認）](database.md) を参照。frontendにも同じ段階表示と読取専用の契約を適用する。

- 正本へ入れた理由: GSC検索語の完成snapshot・再取得状態・上限と選択記事UIを同じ意味へ同期する。旧QA・公開履歴・feature評価と全163仕様のSTALEを保持する。

### 意思決定が本章に効く形

- **`decision-ui-theme-implementation` が本章に効く形**: 09 §2 は「配色 × 明暗の掛け合わせを設定として持たない」と書いている。`light-dark()` は掛け合わせを CSS 側で解く仕組みそのものなので、この禁止が実装の形で担保される。Tailwind の `dark:` クラス方式だと、禁じられている掛け合わせがクラス名として現れてしまう。Tailwind は配置と余白に使い、**色だけ `light-dark()`** にする。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

### 章の規範本文を正本から再生成しない理由

同じ現行契約の全文と記録理由は [章の規範本文を正本から再生成しない理由](auth.md) を参照。本章にも同じ契約を適用する。

### この章の要件 ID を書いたのは誰か

この章の FRONT-REQ-005〜008 は、**AI が導いた受入条件**である。利用者が逐語で述べた要求そのものではない。出所を次のとおり分けて記録する。

**利用者の逐語（`qa-frontend-web-editor-verbatim` の answer に原文がある）**

> コードブロックだったり、カードを生成したりとか、横に画像を並べたりとか、表形式を作成するだったりとか、色をつけたものを作るとか

**そこから AI が導いた受入条件**

- 断片カタログが、逐語で名指しされた 5 種（コードブロック・カード・並列画像・表・色付き文字）を含むこと
- 色は独立した断片種にせず、断片の内側の装飾属性として持つこと
- 断片の描画部品を編集面と公開ページで共有すること

**利用者の確認を受けている範囲**

断片カタログの具体的な種類数（19 種）と各断片の属性設計は、利用者へ提示していない。

この区別を残すのは、要件 ID の文面を後から見直すときに「利用者が言ったから変えられない」ものと「AI が導いたので設計判断で変えてよい」ものを取り違えないためである。

- 正本へ入れた理由: C06 round3 の指摘: AI が起草した受入条件が利用者の回答の顔で正本に載っていた。質疑側は逐語だけに作り直したので、章側で要件 ID の出所 (逐語 / AI 導出 / 利用者確認済みの範囲) を名乗らせる。

### AI が起草した設計宣言（質疑から移した本文）

以下は **AI が起草した設計宣言**である。利用者が述べた要求ではない。

この本文はもともと質疑 `qa-frontend-web-prose-fragment-catalog` の answer として `spec-state.json` に置かれ、`source.kind=user-dialogue`（＝利用者との対話に由来する）を名乗っていた。しかし内容は設計判断の宣言であり、利用者の発言ではない。独立監査 C06 が「AI 起草の設計宣言が利用者の回答の顔で正本に載っている」としてこれを指摘した。

**内容を捨てるのではなく、居場所を移す。** 設計として要る記述なので章の散文として置き直し、元の質疑は取り下げた（`retracted_qa_log`）。この章のセルが実際に引く裏付けは `qa-frontend-web-editor-verbatim` である。

利用者の逐語は `qa-frontend-web-editor-verbatim` および同章の「この章の要件 ID を書いたのは誰か」に記録がある。以下の記述で利用者の確認を受けているのは、そこに逐語として載っている範囲だけである。

---

**当初の問い**

> frontend×web: 記事作成に要る表現を賄うため、本文断片 (ProseNode) のカタログを現行 10 種からどこまで広げ、編集画面でどう出すか。

**設計宣言の本文**

**現行 10 種を保ったまま 9 種を足し、19 種にする。**現行は paragraph / heading / bullet-list / ordered-list / quote / callout / product-card / comparison-table / image / divider。既存記事を壊さないため、この 10 種の記法は変えない。足すのは次の 9 種である。

1. **code** — 言語指定つきコードブロック。言語を選ぶと編集中も色分けして出る。言語不明は plain。
2. **table** — 行数と列数を自由に決められる表。comparison-table (商品比較の定型) とは別物として持つ。見出し行の有無を選べる。
3. **image-row** — 画像を横に 2〜4 枚並べる。各枚に alt とキャプションを持つ。狭い画面では縦に落ちる。
4. **toggle** — 見出しをたたんで中に段落を隠す折りたたみ。長い補足を本筋から外に出すために使う。
5. **checklist** — チェック状態つきの箇条書き。手順の確認に使う。
6. **embed** — 外部埋め込み (YouTube / X / 汎用 iframe)。許可した提供元だけを受ける。
7. **cta-button** — 文言とリンク先と見た目 (主/副) を持つボタン。アフィリエイト計測の属性を落とさない。
8. **link-card** — URL を入れると題名・説明・画像を引いてカードで出す。取得できないときは素のリンクへ落とす。
9. **columns** — 2 段組み。左右それぞれに断片を入れられる。狭い画面では縦に落ちる。

**文字の装飾は断片ではなく段落の中に持つ。**太字・斜体・打ち消し・行内コード・リンク・**文字色と背景色**は、段落・箇条書き・表のセルといった文字を持つ断片の中で効く行内装飾とする。色は自由な hex ではなく、記事のトークンから引いた名前つきの色 (既定/強調/注意/控えめ など) の許可リストに絞る。自由な色指定を許すと記事ごとに配色が壊れ、暗い配色での可読性も保証できない。

**編集画面での出し方。**各断片の下の「+」と `/` の両方から全 19 種へ到達できる。種類は「文章」「一覧」「見せ方」「データ」「差し込み」の 5 群に分けて出す。19 個を平らに並べると選べない。

- 正本へ入れた理由: C06 round4 の指摘: AI 起草の設計宣言が source.kind=user-dialogue を名乗って正本に載っていた。内容は設計として要るので章の散文へ移し、元の質疑は取り下げる。

### 歴史的スナップショット（現行規範ではない、2026-09-06 移送）

> 既存章にしか存在しなかった規範・受入条件・実装記録の保全移送。以下の本文は移送前のまま保持する。As-Is、Delta、PASS 等の実装・検証記録は本文に記された時点の記録であり、今回の実装完了・本番反映・新しい利用者承認を意味しない。後日の確定判断は本章の現在の質疑録・意思決定・日付付き注記を参照する。

#### 状態の意味 (State semantics)

- `confirmed` / 「確定」は Analytics 画面要求の**判断済み**を表し、画面実装や受入試験の完了を表さない。
- 後段の `採否: applied` は設計に採用したことを表し、画面実装済みを表さない。
- 本章の実装状態は `partial`、検証状態は `unverified`。「Analytics 拡張」は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §7〜§8、`00-requirements-definition.md` の I3〜I4、および本章の公式出典とする。


#### As-Is

- `src/app/page.tsx` に D1 から最大20件を読む案件一覧がある。空状態と DB 接続失敗状態は表示する。
- `WebMcpProvider` と `/api/mcp` による WebMCP / Remote MCP PoC、`list_programs` / `record_conversion` / `get_revenue_summary` の3ツールがある。
- Analytics のルート、KPI、ファネル、ヒートマップ、インサイト受信箱、実験、ASP突合画面は未実装。
- 記事本文の断片は 10 種で、編集面には描画部品が無く記法の文字列として扱われる。コード・表・画像の横並び・トグル・チェックリスト・埋め込み・CTA ボタン・リンクカード・段組みの 9 種は存在しない。文字色/背景色の概念も無い。


#### To-Be

| 要件ID | 目標状態 |
|---|---|
| FRONT-REQ-001 | `docs/spec/03` §8 の8ビューを、共通の Workspace / 期間 / ディメンション条件で表示する |
| FRONT-REQ-002 | 発生見込・承認報酬・支払報酬をラベル・定義・数値のいずれでも混同させず、合算値を単一の「確定収益」として表示しない |
| FRONT-REQ-003 | 比較セルにnと期間を常時付与し、設定閾値未満は結論・率・勝者操作を抑止する |
| FRONT-REQ-004 | データ取得とドメイン判断を分離し、UI は同じ KPI 定義の表示モデルのみを消費する |
| FRONT-REQ-005 | 断片カタログを 19 種で実装する。既存 10 種 (paragraph / heading / bullet-list / ordered-list / quote / callout / product-card / comparison-table / image / divider) に加え、code (言語指定つき) / table (自由な行列) / image-row (2〜4 枚を横並び) / toggle / checklist / embed / cta-button / link-card / columns (2 段組) を持つ |
| FRONT-REQ-006 | 編集面の描画と公開ページの描画は同一の描画部品を通る。断片ごとに 2 系統の実装を持たない |
| FRONT-REQ-007 | 文字の装飾 (太字・斜体・打ち消し・行内コード・リンク・文字色/背景色) は断片ではなく、文字を持つ断片の内側の装飾として実装する。色は名前付きトークンの集合に限り、任意の 16 進値を受け取らない |
| FRONT-REQ-008 | 節の見出しレベルは編集器の状態ではなく骨格から導出する。利用者操作で節の見出しレベルを変更する経路を実装しない |


#### Delta

1. 案件一覧は維持し、Analytics ルートとサーバー側データ取得境界を追加する。
2. KPI 式をコンポーネント内に重複実装せず、Analytics API / rollup の定義を唯一の入力にする。
3. 速報/確定、n不足、同意の影響、更新時刻を共通表示モデルで扱う。
4. 記事編集の入力欄を、断片ごとの描画部品を並べる編集面へ置き換える。描画部品は公開ページと共有し、編集面専用の描画を作らない。
5. 断片の描画部品を 9 種追加する。追加分も既存 10 種と同じ登録表 (断片種別 → 描画部品 → 挿入メニューの群) を通し、種別ごとの分岐をコンポーネント内へ散らさない。
6. 文字装飾を断片種別から分離し、文字を持つ断片が共通の装飾レイヤを使う形にする。色トークンの集合を 1 か所で定義する。


#### Dependencies

`auth / Workspace context` → `tenant 付き Analytics API` → `MetricRollup / KPI dictionary` → `Analytics 表示モデル` → `8ビュー`

- 生イベントテーブルを画面から直接参照しない。同意ゲート、速報/確定判定、n閾値は backend/database/security の正本に従属する。

記事エディターの従属:

`断片種別の定義 (backend の parseProse/serializeProse)` → `断片 → 描画部品の登録表` → `編集面と公開ページの共通描画` → `挿入メニュー 5 群` → `視覚差分・a11y 検証`

- 断片の種別と記法を frontend で新設しない。増やすときは backend の往復変換を先に通す。
- 描画時の許可リスト (どの要素・属性を通すか) は security の正本に従属し、frontend で緩めない。
- 商品検索と画像アップロードの経路は backend / infrastructure に従属する。frontend は結果を描くだけで、R2 の鍵の並びを組み立てない。


#### Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| FRONT-ACC-001 | `commission_amount_pending=1000円` / `commission_amount_approved=500円` / `commission_amount_paid=300円` の fixture を表示 | 「発生見込 1,000円」「承認報酬 500円」「支払報酬 300円」が別表示され、合算値を「確定収益」とする表示がない。コンポーネントテストとスクリーンショットを保存 |
| FRONT-ACC-002 | `n < configured_min_sample` の比較セル | nと「サンプル不足」を表示し、率・勝者ラベル・結論操作を表示しない/無効化する。境界値前後の自動テストを保存 |
| FRONT-ACC-003 | Analytics API が `503`の後に復旧 | 何が起き、データが安全か、次の行動が何かを表示。「再試行」の1回で復帰する E2E 記録を保存 |
| FRONT-ACC-004 | Workspace A から B のクエリ条件を送信 | B の数値・名前・件数を DOM / RSC payload / CSV に含まないことを統合テストで証明 |
| FRONT-ACC-005 | 19 種すべてを含む記事 fixture を、編集面と公開ページの両方で描画する | 断片 → 描画部品の登録表に 19 件が揃い、未登録の種別が 0 件。両面が同一部品を通ることを、部品呼び出しを記録するテストで証明して保存 |
| FRONT-ACC-006 | 文字色・背景色に、トークン外の値 (`#ff0000` 等) を指定した本文を読み込む | トークン外の値は描画に反映されず、既定の文字色で描かれる。トークン一覧の定義箇所が 1 か所であることを検査するテストと併せて保存 |
| FRONT-ACC-007 | 節の見出し要素に対して、キーボードとツールバーの双方からレベル変更を試みる | レベルを変更する操作が提供されておらず、DOM 上の節見出しが `h2` のまま。断片側の見出しは `h3`/`h4` のみ出現することを、描画結果の見出し列を検査するテストで保存 |
| FRONT-ACC-008 | code 断片に言語指定つきの内容、table 断片に 3 行 4 列、image-row に 4 枚、columns に 2 段を入れて描画する | いずれも記法の文字列が画面に露出せず、横に長い表とコードは横スクロールが表内に収まり、ページ本体が横スクロールしない。4 断片ぶんのスクリーンショットを保存 |

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 既存章にだけ存在する要件定義表・受入条件とその文脈を、正規writerのchapter_notesへ逐語移送して再生成時の欠落を防ぐ。利用者回答や承認内容は改変せず、過去の実装記録を現在のPASSとして扱わない。

### To-Be（規範契約）

> 2026-09-06 現行規範。旧注記「章の規範本文を正本から再生成しない理由」は superseded とし、その「再生成しない」指示を無効化する。正本 chapter_notes と正規 compiler を唯一の更新経路とする。旧 374 行等の欠落原因・旧方式・過去の実装/PASS 状態は歴史的スナップショットとして保持する。以下は要求であり、実装・受入・remote migration・本番公開の完了を意味しない。

| 要件ID | 目標状態 |
|---|---|
| FRONT-REQ-001 | `docs/spec/03` §8 の8ビューを、共通の Workspace / 期間 / ディメンション条件で表示する |
| FRONT-REQ-002 | 発生見込・承認報酬・支払報酬をラベル・定義・数値のいずれでも混同させず、合算値を単一の「確定収益」として表示しない |
| FRONT-REQ-003 | 比較セルにnと期間を常時付与し、設定閾値未満は結論・率・勝者操作を抑止する |
| FRONT-REQ-004 | データ取得とドメイン判断を分離し、UI は同じ KPI 定義の表示モデルのみを消費する |
| FRONT-REQ-005 | 断片カタログを 19 種で実装する。既存 10 種 (paragraph / heading / bullet-list / ordered-list / quote / callout / product-card / comparison-table / image / divider) に加え、code (言語指定つき) / table (自由な行列) / image-row (2〜4 枚を横並び) / toggle / checklist / embed / cta-button / link-card / columns (2 段組) を持つ |
| FRONT-REQ-006 | 編集面の描画と公開ページの描画は同一の描画部品を通る。断片ごとに 2 系統の実装を持たない |
| FRONT-REQ-007 | 文字の装飾 (太字・斜体・打ち消し・行内コード・リンク・文字色/背景色) は断片ではなく、文字を持つ断片の内側の装飾として実装する。色は名前付きトークンの集合に限り、任意の 16 進値を受け取らない |
| FRONT-REQ-008 | 節の見出しレベルは編集器の状態ではなく骨格から導出する。利用者操作で節の見出しレベルを変更する経路を実装しない |

- 正本へ入れた理由: 現行要件表を正本へ接続。旧再生成禁止 note を superseded とし、画像契約は現行実装・確定判断に同期。

### 意思決定が本章に効く形

正本 `decisions[]` の一覧と状態は `00-requirements-definition.md` が正本から生成する。
**ここには表を写さない。**写した表は正本が動いても追従せず、2026-09-04 まで
「全 7 件」と書かれたまま残った (実際には 12 件) のがその実例である。

- **`decision-ui-theme-implementation` が本章に効く形**: 09 §2 は「配色 × 明暗の
  掛け合わせを設定として持たない」と書いている。`light-dark()` は掛け合わせを
  CSS 側で解く仕組みそのものなので、この禁止が実装の形で担保される。Tailwind の
  `dark:` クラス方式だと、禁じられている掛け合わせがクラス名として現れてしまう。
  Tailwind は配置と余白に使い、**色だけ `light-dark()`** にする。
- **`dec-structured-data-emission` が本章に効く形** (2026-09-04 確定、
  `opt-render-time-derive`): 構造化データ (Article/BlogPosting/FAQPage/HowTo/
  Speakable/BreadcrumbList)・canonical・OGP・robots は、**保存時に別途持たず
  配信時に記事データから導出する**。別に持つと記事本文と構造化データが二つの
  正本になり、本文だけ直したときに黙って食い違う。検索エンジンが読むのは
  構造化データの側なので、この食い違いは画面上どこにも現れない。
- 導出にする代償は 2 つあり、どちらも先に手当てする。(1) **生成関数の回帰検査を
  実装と同時に置く** — 導出は関数 1 本に集約されるので、そこが壊れると全記事が
  同時に壊れる。(2) **FAQPage / HowTo / Speakable が要する項目を記事データ側へ
  先に設計する** — 見出しからの機械推定で埋めると、書き手の意図と無関係な
  構造化データが出る。エディタ側にこれらを入力する場所を用意することが前提になる。

- 正本へ入れた理由: 各章の手書き意思決定表は正本 decisions[] の写しで、件数が 7 のまま古びていた。表は 00-requirements-definition.md が正本から生成するので削る。削れない章固有の突き合わせ (この決定が本章にどう効くか) を正本へ移し、compile の純関数出力として復元されるようにする。

### 実装で確定した URL 階層・転送規則・雛形複製経路 (feat-site-scoped-authoring-ia)

**以下は利用者の回答ではない。** `feat-site-scoped-authoring-ia` の実装 (2026-09-08) で
確定した URL 階層と転送規則を、章にしか居場所が無いまま消えないよう正本へ移したものである。
上の質疑録と混ぜて読まないために区切ってある。

`qa-frontend-web-site-scoped-route-ownership` で利用者は「ブログ単位へ移す画面の URL 階層」と
「横断 URL を転送で受ける」方針を決めた。**どの住所をどこへ送るか、送らない住所はどれかは、
受け皿の有無で決まる。**実装で確定した対応を残す。

#### 所属替えした 6 route

| 新しい住所 | 何の画面か |
|---|---|
| `/admin/sites/[site]/authors` | 書き手 |
| `/admin/sites/[site]/authors/new` | 書き手を作る |
| `/admin/sites/[site]/audience/personas` | 読者像 |
| `/admin/sites/[site]/audience/personas/new` | 読者像を作る |
| `/admin/sites/[site]/writing` | 書き方の決めごと (ブログの型で重み付けした複製) |
| `/admin/writing/template` | 共通の雛形そのもの (横断に残す 1 枚) |

管理 route は 93 本から 99 本になった。**畳んだのは入口の段であって route の本数ではない。**

#### データ層は動かしていない

**site 配下へ移ったのは画面 (住所) だけで、データはワークスペース単位のままである。**
書き手も読者像も `workspaceId` で引く。

この境界は意図的である。データを site 単位へ割ると既存ブログ全部に移行が要り、
新規ブログを足すたびに初期データの作成が要る。住所だけを移せば、新しいブログを
足した瞬間から書き手も読者像も配下に見える。ブログ固有の書き手が要るという要望が
出たときに初めてデータ層を割る。

その代わり **site 配下の画面は中身を読む前に必ず `resolveSiteOrNotFound(site)` を通す。**
順番が逆だと、存在しないブログの住所でも一覧が出る。`getSite` が失敗したときは
理由を言い分けずに `notFound()` を返す。「権限がありません」と「ありません」を
出し分けると、住所を打つだけで他ワークスペースのブログの存否が読み取れる。
受け先の `not-found.tsx` は `AppShell` を import も描画もしないので、
サイドバーにブログ名が並ぶこともない。

#### 転送規則

転送する 5 本 (`legacyAdminRedirect` だけを呼ぶ殻。DOM を持たず `redirectOnly: true`):
`/admin/personas`, `/admin/personas/new`, `/admin/personas/audiences`,
`/admin/personas/audiences/new`, `/admin/writing`。

ブログを特定できないとき (cookie 無し / 一覧が引けない / `?site=` が配列 /
対応表に無い住所) は、どの不調でも `/admin/sites` (ブログ選択) へ出す。
外の世界が期待どおり返らなかったことを利用者の画面に例外として見せない。

**`/admin/content/*` は転送していない。**転送先の `/admin/sites/[site]/articles` が
存在しない (正本は `feat-blog-scoped-admin-console`) ためで、存在しない住所へ
転送する殻を先に置くと旧 URL が今より確実に壊れる。**移設は、受け皿が立ってから
でなければ移設ではなく破壊である。**受け皿が入れば対応表 `LEGACY_SITE_SCOPED_ROUTES` に
1 行足すだけで他の 5 本と同じ形になる。未転送の理由は
`docs/spec/feat-site-scoped-authoring-ia/redirect-map-draft.json` の `not_redirected` に
理由付きで載っており、黙って落としてはいない。

#### 雛形の複製経路 — 複製するのは重みだけ

`/admin/sites/[site]/writing` は `cloneWritingMethodForSite(共通雛形, そのブログの型)` を呼ぶ。
**節も文体の決まりも共通のままで、変わるのは「このブログの型で特に外せない節に印が付く」
ことだけである。**

決めごとを丸ごと複製すると 10 本のブログで 10 通りの決まりができ、公開前の検査が
どれを見るか決まらなくなる。この画面と公開前の検査は、コードの中の同じ 1 つの定義を読む。
手引きを別文書として書けば、どちらかが必ず古くなり「手引きどおりに書いたのに検査で落ちる」が起きる。

#### route を 1 本足すと同時に整合が要求される表

`admin-route-metadata.ts` (route の正本) / `ADMIN_NAV_GROUPS` / `screen-information-ledger.json` /
`admin-disclosure-contract.ts` / `tests/ui/route-cases.ts`。

**後ろの 4 つは手書きの一覧ではなく正本からの射影である。**
`tests/ui/route-cases.ts` の管理画面ケースが `ADMIN_ROUTE_METADATA.map(...)` である結果、
route を 1 本足せばその画面は自動的に描画と axe (WCAG 2.2 AA + best-practice、違反 0 が条件) の
対象になる。「画面は足したが検査の一覧に足し忘れた」という抜け方ができない。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: P13 書き戻し: 所属替えした6route・データ層を動かさない境界・転送5本と未転送/admin/content/*の理由・複製するのは重みだけ、は実装で確定した内容で章にしか居場所が無い。利用者の逐語には足さない。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| presentation | 引用可 | 第 1 章 Purpose — Make something meaningful. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Purpose) / 第 2 章 Agency — Let people do things their own way. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Agency) / 第 3 章 Responsibility — Act in people's best interest. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Responsibility) / 第 4 章 Familiarity — Build on what people know. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Familiarity) / 第 5 章 Flexibility — Adapt to diverse contexts and needs. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Flexibility) / 第 6 章 Simplicity — Be clear and direct. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Simplicity) / 第 7 章 Craft — Care about every detail. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Craft) / 第 8 章 Delight — Make it human. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Delight) |
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述。fetched-references.json の取得対象 8 件のいずれでもなく、retrieval-evidence にも record が存在しない。この作業場所には書籍本文を取得する経路が無い。 |

- **presentation の引用範囲**: 取得物は Design principles の記事 1 本 (機械可読 endpoint, 26295 B)。引用根拠にできるのは**この記事に実在する 8 原則の名称・一文の定義・各原則配下の詳細項目の文言**まで。HIG の他ページ (Layout, Accessibility, Typography 等) は取得していないので、そこの主張を要件文の根拠にはできない。chapter 番号は Apple が付けたものではない — 記事は 8 つの h2 を番号無しで並べているだけで、ここでの番号は取得物の並び順に付けた序数である。番号を Apple の章番号として引かないこと。

- **application-architecture の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないこと。fetched-but-no-body と not-in-fetch-targets は取得すれば塞がるが、これは塞がらない。3 種を『条項引用不可』の一語に潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

#### 本章での適用

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/frontend.md`](applied/frontend.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| nextjs | 16.3.4 | Vercel (nextjs.org) | https://nextjs.org/docs | 2026-09-02T09:14:35Z | 2026-09-02T09:14:35Z |
| mdn-light-dark | 2026-04-18 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark | 2026-08-22T15:05:07Z | 2026-08-22T15:05:07Z |
| llms-txt | 2026-08-10 | Jeremy Howard (Answer.AI) (llmstxt.org) | https://llmstxt.org/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |
| webmcp | 2026-09-04 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-08T12:32:03Z | 2026-09-08T12:32:03Z |
| google-search-central | 2025-12-10 | Google (developers.google.com) | https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data | 2026-09-04T05:01:57Z | 2026-09-04T05:01:57Z |
| schema-org | 30.0 | Schema.org Community Group (W3C) (schema.org) | https://schema.org/docs/releases.html | 2026-09-04T05:01:57Z | 2026-09-04T05:01:57Z |
| web-dev-core-web-vitals | 2024-10-31 | Google (web.dev) | https://web.dev/articles/vitals | 2026-09-03T23:21:19Z | 2026-09-03T23:21:19Z |
