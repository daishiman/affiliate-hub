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

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-frontend-web-overhaul-v2 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

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

> 正本 `decisions[]` の全 6 件。**6 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| **`decision-ui-theme-implementation`** | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | **frontend** |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |

- **`decision-ui-theme-implementation` が本章に効く形**: 09 §2 は「配色 × 明暗の掛け合わせを設定として持たない」と書いている。`light-dark()` は掛け合わせを CSS 側で解く仕組みそのものなので、この禁止が実装の形で担保される。Tailwind の `dark:` クラス方式だと、禁じられている掛け合わせがクラス名として現れてしまう。Tailwind は配置と余白に使い、**色だけ `light-dark()`** にする。

## 確定内容 (質疑録)

### qa-frontend-web-overhaul-v2 (対応セル: web)

**質問**: frontend×web: 単一用途画面分割・基本管理機能・再利用コンポーネント・マルチブログ/マルチ SNS 対応のフロントエンド要件は何か (2026-08-21 利用者ヒアリング逐語)

**回答**: 利用者本人の回答を逐語主旨で記録する。(1) 管理画面を単一用途ごとの画面に分割する (一覧・詳細・作成・編集の分離)。(2) 各管理対象に新規作成・削除を含む基本 CRUD 操作の UI を備える。(3) 1 つの商品に対して複数のブログを対応付けられる構成にする。各ブログにはそれぞれのコンセプトがあり、コンセプトごとに文章を作成できる UI にする。(4) SNS は X・Facebook など様々なものに対応できる拡張可能なチャネル構成とし、各 SNS への投稿状態が画面に反映されるようにする。(5) UI はコンポーネント化して再利用する。ハードコーディングの重複を書かず共通化する。(6) ブログごとにブログの構成を作成したい。新しくブログを構築する際には、そのブログごとにコンポーネントを作成できる仕様にする (ブログ単位の構成テンプレート/コンポーネントセットを定義・管理できる)。(7) 既存スタック (Next.js/React) を継続使用する。

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

### qa-frontend-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 改善要望の送信モーダルは何を見せ、何を強制しないか (書面入力 docs/spec/12 §5)

**回答**: - **FB-AC-07**: 「この画面から一緒に送られるもの」を展開でき、自動収集される項目を送信前に確認できる。隠さない。
- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、「この画面には、絵として写しにくい部品があります。撮れた画像を確かめてください。」を常に表示し、プレビューを見てから送る。完全性を保証しない。
- **FB-AC-10**: 「撮り直す」「**画像を外す（文章だけで送る）**」を常に選べる。貼り付け（Ctrl+V）とファイル選択も受け付ける。**画像なしでも送信は成立する。**

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

##### 確定内容 qa-frontend-web-overhaul-v2 (対応セル: web)

- 確定要件: 利用者本人の回答を逐語主旨で記録する。(1) 管理画面を単一用途ごとの画面に分割する (一覧・詳細・作成・編集の分離)。(2) 各管理対象に新規作成・削除を含む基本 CRUD 操作の UI を備える。(3) 1 つの商品に対して複数のブログを対応付けられる構成にする。各ブログにはそれぞれのコンセプトがあり、コンセプトごとに文章を作成できる UI にする。(4) SNS は X・Facebook など様々なものに対応できる拡張可能なチャネル構成とし、各 SNS への投稿状態が画面に反映されるようにする。(5) UI はコンポーネント化して再利用する。ハードコーディングの重複を書かず共通化する。(6) ブログごとにブログの構成を作成したい。新しくブログを構築する際には、そのブログごとにコンポーネントを作成できる仕様にする (ブログ単位の構成テンプレート/コンポーネントセットを定義・管理できる)。(7) 既存スタック (Next.js/React) を継続使用する。
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
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| nextjs | 16.3.1 | Vercel (nextjs.org) | https://nextjs.org/docs | 2026-08-16T09:01:51Z | 2026-08-16T09:02:16Z |
