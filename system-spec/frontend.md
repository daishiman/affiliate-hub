---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-frontend-web-blog-composition-visibility。裏付け質疑 (`qa_refs`): `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-frontend-web-blog-composition-visibility (対応セル: web)

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

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| presentation | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | apple-hig は取得済み (retrieval-evidence/apple-hig.json, 17681 B) だが、取得物は JavaScript シェルで本文を含まない。可視テキストは 'This page requires JavaScript. Please turn on JavaScript in your browser and refresh the page to view its content.' のみ、見出し 1 件 (同文)、テキストを持つリンク 0 件。取得できているのはページの殻であって内容ではないため、引くべき条項がそもそも取得物に存在しない。 |
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述。fetched-references.json の取得対象 8 件のいずれでもなく、retrieval-evidence にも record が存在しない。この作業場所には書籍本文を取得する経路が無い。 |

- **presentation が引用可になる条件**: JS 実行後の DOM を取得できる経路 (browser-render 等) で本文を取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得経路を変えれば塞がる穴であって、塞げない穴ではない。
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

##### 確定内容 qa-frontend-web-blog-composition-visibility (対応セル: web)

- 確定要件: 4つすべてを満たす。(a) 作成直後に読者側の住所が実際に開き、404にならない。(b) 管理画面にそのブログの構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) を実データの件数と各実体へのリンク付きで一覧する。(c) 管理画面の中で読者と同じ見た目をプレビューでき、公開前に確認できる。(d) 作成時点で公開に必要なのに無い要素を名指しで提示し、その場へ移動できる。描画は既存の SiteFrame と public-site-projection を通し、読者用と別の描画経路を作らない。作ると管理画面で見える姿と読者が見る姿がずれる。
- 設計解釈の記録経路: `dialogue`
- 原則: 表示モデル — domain model (正本の意味と値) から view model への変換規則を明示し、表示層は勝手に再計算しない (`information-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 管理画面の構成要素一覧 (固定ページ・版面の帯・スロット・カテゴリー・記事) は、読者側と同じ public-site-projection を通して読む。記事は published_articles を唯一の canonical public projection とし、一覧・本文・検索・カテゴリー・人物・SEO・composition が同じ PublishedContentPort の identity 集合を使う。管理画面専用の数え直しや PublicBlogPort の articles 直読を残すと、『見えているのに直らない』が再発する。件数も各実体へのリンクも同じ正本から導く
  - トレードオフ:
    - 読者用 projection に管理画面の都合 (未公開要素の可視化) を混ぜると読者側へ漏れる危険がある。projection は共有しつつ、可視性の絞り込みは呼び出し側の権限で行う
    - 共有するぶん、読者側の変更が管理画面を壊しうる。ずれない代わりに結合は強くなる
    - 旧 /blog/:slug は同じ projection から articleHref の canonical URL へ 308 redirect し、既存入口を残したまま二重本文を作らない
- 原則: 削除仮説 — 削除候補・代わりの手掛かり・誤読時の影響・検証方法・復元条件を持つ反証可能な仮説にする (`information-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 作成時点で公開に必要なのに無い要素は、隠さず名指しで提示し、その場へ移動できるようにする。『まだ無い』を画面から省くのは最も影響の大きい削除であり、省いた結果が今回の 404 である。不足の提示は削除候補から外す
  - トレードオフ:
    - 不足を全部出すと初回作成直後の画面が赤で埋まる。優先度 (公開を止めている要素か、質を下げるだけの要素か) で強さを分ける必要がある
- 原則: Screaming architecture — top-level 構造が framework 名でなく system の use case と domain を語る (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 管理画面内のプレビューは既存の SiteFrame を通して描画し、読者用と別の描画経路を作らない。プレビュー専用のコンポーネント木を立てると『プレビューでは出るが本番では出ない』という第二の乖離を作る
  - トレードオフ:
    - SiteFrame は notFound() を呼ぶ前提で書かれており、管理画面の中で使うには『見つからない』の扱いを呼び出し側で受け取れる形に分ける必要がある
##### 接地根拠 qa-frontend-web-capture-self-occlusion (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-capture-self-occlusion` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 自己観測する UI は、観測の対象から自分自身を外す (観測器を被写体に含めない) (`user-dialogue:2026-08-30#撮影中だけ自動で隠す`)
  - 採否: `applied`
  - 章固有の根拠: 写しの用途は『利用者が伝えたい箇所』の提示であり、送信 UI 自身はその情報を 1 ビットも運ばない。むしろ画面の中央を占有して被写体を隠すため、写りは純粋な損失である。撮影開始 (getDisplayMedia 呼出) と、送信 UI の可視化を別の時点に分け、写しが確定するまで送信 UI を描かない。撮影開始そのものは押した勢い (transient activation) を失わないよう onClick 内に留める。
  - トレードオフ:
    - モーダルの出現が写しの確定まで遅れるため、押してから開くまでの体感が伸びる。写しが撮れない・断られた環境では即座に開く経路を残し、待ちが無限に伸びないようにする
    - 『押した瞬間に開く』という既存の設計意図 (feedback-button.tsx の注記) を意図的に変更するため、変更理由をコード側にも残さないと元へ戻される
- 原則: 本文の上に浮く操作は、記録・監査の対象になるときだけ自分を名乗り、それ以外では退く (`ref-system-design-knowledge:information-design`)
  - 採否: `applied`
  - 章固有の根拠: 右下固定の起動ボタンは data-floating-overlay で本文の上に居ることを名乗っている。同じ理由で、写しという記録の中では退く側に回る。名乗りと退避を同じ属性系で扱うことで、重なり監査 (tests/e2e/app-routes.spec.ts) と写しの除外規則が別々の手掛かりに分岐しない。
  - トレードオフ:
    - 隠す対象を属性で選ぶため、将来別の浮遊要素が増えたときに同じ属性を付け忘れると写り込みが再発する。属性の付与漏れを検査で拾う必要がある
##### 接地根拠 qa-frontend-web-affiliate-link-preview-v3 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-affiliate-link-preview-v3` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 識別子ではなく判断対象そのものを先に見せ、入力と確認結果を同じ文脈に置く (`ref-system-design-knowledge:information-design`)
  - 採否: `applied`
  - 章固有の根拠: 現行の成果リンク受信箱はホスト名、URL、状態、商品IDの手入力を中心に表示し、リンクが指す商品を視覚的に照合できない。URL入力後は安全なサーバー取得を経て、取得元、正規URL、商品タイトル、販売元、利用可能な商品画像、価格の取得時点、既存商品候補、重複候補を一つの確認カードに表示する。画像が取得できない場合も壊れた枠にせず、取得不可の理由と手動選択を同じ位置に出す。確認前は保存可能な成果リンクとして扱わない
  - トレードオフ:
    - 外部URLからのメタデータ取得には遅延・失敗・画像利用条件・SSRFの危険があるため、貼り付けと同時にクライアントから直接取得せず、許可済み接続先をサーバー側で検査し、取得結果の出典と確認日時を表示する
- 原則: 非同期処理の進行、成功、部分成功、失敗と回復手段を利用者が見失わないようにする (`ref-system-design-knowledge:usability-accessibility`)
  - 採否: `applied`
  - 章固有の根拠: リンク貼り付け後は解析中、確認待ち、取得済み、画像のみ未取得、重複、取得失敗を可視テキストで区別し、入力値を保持したまま再試行、手動補完、対象外を選べるようにする。保存後は保存済み時刻と掲載先件数を表示し、一覧へ戻っても同じ状態語彙を使う
  - トレードオフ:
    - 状態を細分化すると表示語彙が増えるため、内部状態をそのまま露出せず、利用者が次に行える操作が同じものは一つの表示状態にまとめる
##### 接地根拠 qa-frontend-web-seo-ai-search-v2 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-seo-ai-search-v2` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 画面描画と機械向け出力 (JSON-LD / sitemap / RSS / llms.txt / robots) を同じ読み取りモデルから派生させる (`information-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 公開記事の読み取りモデル (PublishedArticle) を単一の正本にし、構造化データ・フィード・サイトマップ・llms.txt は application 層の pure 関数が文字列を生成する。Next.js の route handler は生成結果を返すだけにし、Server Component の generateMetadata も同じヘルパーから title/description/canonical/OGP を得る。これで画面と機械向け出力の食い違いを型で防ぐ
  - トレードオフ:
    - 全記事を列挙する読み取り口が無いため sitemap/feed は listRecent の大きな limit で代用する。記事数が上限を超えたら分割 sitemap を足す (今回の受入条件外)
    - route handler を 4 本足すと公開ルートの台帳 (open-doors) が増える。読者の道であることを確かめて上限を上げる
- 原則: 秘密は環境変数からだけ読み、失敗は黙らず記録する (`usability-accessibility.md#適用条件`)
  - 採否: `applied`
  - 章固有の根拠: IndexNow の鍵はサーバー環境変数からのみ読み、リポジトリ・管理画面・DB に保存しない。鍵が無いときは送信をスキップして『スキップした』ことを結果として返す。AI クローラ (GPTBot / ClaudeBot / PerplexityBot / Google-Extended) は robots.txt で既定許可にし、遮断するには設計図側の明示設定を要する
  - トレードオフ:
    - IndexNow は Google 非対応で、Bing 系 index (ChatGPT search の基盤) にだけ効く。効果は限定的だが送信コストがほぼ無いので既定 ON にする
    - llms.txt は正式標準ではなく主要 LLM クローラが読む保証が無い。emitLlmsTxt を設計図の任意項目に留め、効果未確認であることを管理画面の説明に明記する
##### 接地根拠 qa-frontend-web-blog-builder (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-blog-builder` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Composite / Strategy: 宣言的 blueprint と共通コンポーネント群によるレンダリング分離 (`design-patterns.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 『ブログごとにテンプレートを元に作成』『色合いはその都度選択』を、テンプレート=セクション型カタログの合成、テーマ=デザイントークン集合の差し替えとして実装し、ハードコードの重複を書かない既存要件と整合させる
  - トレードオフ:
    - 任意レイアウトを許さず固定カタログに絞るため、参考ブログの細部を再現できない箇所が残る。カタログ追加は後続 feature とする
    - light-dark() 方針により配色×明暗の掛け合わせを設定に持てないので、ページ単位上書きも色トークンのみに限定する
##### 接地根拠 qa-frontend-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-spec-intake` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 自動収集される項目は送信前に展開して確認できる (FB-AC-07)。画面の写しの不完全さを常に表示し、完全性を保証しない (FB-AC-09) (`docs/spec/12-改善要望フィードバック仕様.md#§5`)
  - 採否: `applied`
  - 章固有の根拠: 収集項目の一覧は送信処理と同じ 1 つの定義から描く。表示用に別の一覧を持つと、収集を増やしたときに表示だけ古くなる
  - トレードオフ:
    - モーダルの情報量が増えるが、送信者が何を送るのかを知らないまま送る状態が無くなる
- 原則: 画像なしでも送信は成立する (FB-AC-10)。任意欄が空のとき、詳細画面では「本人からの記入はありません」と明示する (FB-AC-06) (`docs/spec/12-改善要望フィードバック仕様.md#§5`)
  - 採否: `applied`
  - 章固有の根拠: 画像取得の失敗を送信の失敗にしない。空欄は欄ごと消さず、記入が無かったことを文で出す。この文言が出ることをテストで固定する
  - トレードオフ:
    - 空欄でも要素が残るため画面はやや長くなるが、「書かれなかった」と「表示していない」を読み分けられる
##### 接地根拠 qa-frontend-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Next.js (現行リポジトリ構成) によるレスポンシブ管理画面 (`nextjs:app-router`)
  - 採否: `applied`
  - 章固有の根拠: PC主体+モバイル併用の利用形態(qa-uiux-web の情報設計9項目)に対しレスポンシブWebで対応する
  - トレードオフ:
    - ネイティブアプリ非対応のためプッシュ通知等はメール/Slack通知で代替する
- 原則: WebMCP は機能フラグ配下の実験的追加インターフェース (`docs/spec/01-要求仕様書-v1.0.md §24.2`)
  - 採否: `applied`
  - 章固有の根拠: 現行PoCは navigator.modelContext をfeature detectionして使う。通常UIを主系統・WebMCPを追加系統とし、ブラウザー登録APIは製品契約として固定しない
  - トレードオフ:
    - 二系統の維持コストが生じるが、読み取り系ツールから段階導入して限定する
##### 接地根拠 qa-frontend-web-analytics (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-analytics` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 統計的規律の UI 反映: 速報と確定を区別し、ヒートマップのセルに n (サンプル数) を常時表示する (`docs/spec/03-分析・解析基盤仕様.md#§8`)
  - 採否: `applied`
  - 章固有の根拠: Next.js (App Router) の Server Components で D1 のロールアップを描画し、本日分は「速報」バッジ、n 不足セルは結論表示を抑制する (§7.3 の規律を UI で強制)
  - トレードオフ:
    - 表示ロジックが増えるが、根拠のない『勝ち宣言』を UI レベルで防げる
- 原則: インサイト受信箱: InsightReport は確認→適用 (Brief 作成へ遷移)→却下のワークフローで人間が裁定する (`docs/spec/03-分析・解析基盤仕様.md#§8`)
  - 採否: `applied`
  - 章固有の根拠: 分析結果の生成への反映 (I4) は自動ではなく、受信箱 UI での人間承認を経由させる
  - トレードオフ:
    - 自動最適化より反映は遅くなるが、人間承認必須の制約 (U8) と整合する
##### 接地根拠 qa-frontend-web-overhaul-v2 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-frontend-web-overhaul-v2` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: ブログ (配信先) ごとの構成をデータとして定義し、構成要素を再利用可能なコンポーネントとして組み立てる (`user-dialogue:2026-08-21#ブログ別構成コンポーネント`)
  - 採否: `applied`
  - 章固有の根拠: 利用者が「ブログごとにブログの構成を作成したい」「新しくブログを構築する際には、そのブログごとにコンポーネントを作成するような仕様にしたい」と明言した。ブログ=チャネルの構成 (セクション並び・記事テンプレート) を宣言的データとして持ち、レンダリングは共通コンポーネント群が担う構成にする
  - トレードオフ:
    - 構成の自由度を上げるほどスキーマとエディタ UI が複雑になる。初期はセクション型の固定カタログから選ぶ方式に絞り、任意レイアウトは後続にする
- 原則: 一覧・詳細・作成・編集を分離し、各画面の主要アクションを 1 つにする (`ref-system-design-knowledge:information-design`)
  - 採否: `applied`
  - 章固有の根拠: 単一用途画面への分割要求 (qa-uiux-web-overhaul-v2) をフロントエンドのルーティング/画面構成として実装する。CRUD の各操作は専用画面または明示的なモーダルに分離し、破壊的操作 (削除・公開) のみ確認を挟む (本人回答の誤操作コスト境界に従う)
  - トレードオフ:
    - 画面数が増えるため、共通レイアウト・ナビゲーション (整理後のサイドバー) の一貫性維持が前提になる
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| nextjs | 16.3.3 | Vercel (nextjs.org) | https://nextjs.org/docs | 2026-08-29T23:02:28Z | 2026-08-29T23:02:28Z |
| mdn-light-dark | 2026-04-18 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark | 2026-08-22T15:05:07Z | 2026-08-22T15:05:07Z |

## 状態の意味 (State semantics)

- `confirmed` / 「確定」は Analytics 画面要求の**判断済み**を表し、画面実装や受入試験の完了を表さない。
- 後段の `採否: applied` は設計に採用したことを表し、画面実装済みを表さない。
- 本章の実装状態は `partial`、検証状態は `unverified`。「Analytics 拡張」は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §7〜§8、`00-requirements-definition.md` の I3〜I4、および本章の公式出典とする。

## As-Is

- `src/app/page.tsx` に D1 から最大20件を読む案件一覧がある。空状態と DB 接続失敗状態は表示する。
- `WebMcpProvider` と `/api/mcp` による WebMCP / Remote MCP PoC、`list_programs` / `record_conversion` / `get_revenue_summary` の3ツールがある。
- Analytics のルート、KPI、ファネル、ヒートマップ、インサイト受信箱、実験、ASP突合画面は未実装。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| FRONT-REQ-001 | `docs/spec/03` §8 の8ビューを、共通の Workspace / 期間 / ディメンション条件で表示する |
| FRONT-REQ-002 | 発生見込・承認報酬・支払報酬をラベル・定義・数値のいずれでも混同させず、合算値を単一の「確定収益」として表示しない |
| FRONT-REQ-003 | 比較セルにnと期間を常時付与し、設定閾値未満は結論・率・勝者操作を抑止する |
| FRONT-REQ-004 | データ取得とドメイン判断を分離し、UI は同じ KPI 定義の表示モデルのみを消費する |

## Delta

1. 案件一覧は維持し、Analytics ルートとサーバー側データ取得境界を追加する。
2. KPI 式をコンポーネント内に重複実装せず、Analytics API / rollup の定義を唯一の入力にする。
3. 速報/確定、n不足、同意の影響、更新時刻を共通表示モデルで扱う。

## Dependencies

`auth / Workspace context` → `tenant 付き Analytics API` → `MetricRollup / KPI dictionary` → `Analytics 表示モデル` → `8ビュー`

- 生イベントテーブルを画面から直接参照しない。同意ゲート、速報/確定判定、n閾値は backend/database/security の正本に従属する。

## Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| FRONT-ACC-001 | `commission_amount_pending=1000円` / `commission_amount_approved=500円` / `commission_amount_paid=300円` の fixture を表示 | 「発生見込 1,000円」「承認報酬 500円」「支払報酬 300円」が別表示され、合算値を「確定収益」とする表示がない。コンポーネントテストとスクリーンショットを保存 |
| FRONT-ACC-002 | `n < configured_min_sample` の比較セル | nと「サンプル不足」を表示し、率・勝者ラベル・結論操作を表示しない/無効化する。境界値前後の自動テストを保存 |
| FRONT-ACC-003 | Analytics API が `503`の後に復旧 | 何が起き、データが安全か、次の行動が何かを表示。「再試行」の1回で復帰する E2E 記録を保存 |
| FRONT-ACC-004 | Workspace A から B のクエリ条件を送信 | B の数値・名前・件数を DOM / RSC payload / CSV に含まないことを統合テストで証明 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.frontend.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | frontend × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-frontend-web-spec-intake` |
| 資するゴール (serves_goals) | G1, G2 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | written-requirements |
| 出典 path | `docs/spec/12-改善要望フィードバック仕様.md` |
| 出典 節 | §5 送信モーダル（FB-AC-04〜10） |
| 出典 sha256 | `ccd052dfcbf69cbd8a0b5b4d16f2912267dd15afef81fb3dd23717ba50a36c39` |
| 適用された設計知識 (design_applications) | 6 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 意思決定 (decisions)

> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| **`decision-ui-theme-implementation`** | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | **frontend** |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |
| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |

- **`decision-ui-theme-implementation` が本章に効く形**: 09 §2 は「配色 × 明暗の掛け合わせを設定として持たない」と書いている。`light-dark()` は掛け合わせを CSS 側で解く仕組みそのものなので、この禁止が実装の形で担保される。Tailwind の `dark:` クラス方式だと、禁じられている掛け合わせがクラス名として現れてしまう。Tailwind は配置と余白に使い、**色だけ `light-dark()`** にする。
