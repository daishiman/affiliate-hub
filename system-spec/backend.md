---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G1, G2, G3]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-backend-web-seo-audit-writeback-p13-v3。裏付け質疑 (`qa_refs`): `qa-backend-web-blog-creation-atomicity`, `qa-backend-web-spec-intake`, `qa-backend-web`, `qa-backend-web-analytics`, `qa-backend-web-overhaul-v2`, `qa-backend-web-aeo-analysis-pipeline-v4` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | backend × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-backend-web-seo-audit-writeback-p13-v3` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | `domain-model` — missing_effect: block / 接地: 済 (`qa-backend-web-spec-intake`) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`backend`) を主担当とする **2 件**。全 12 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 |
| `dec-aeo-analysis-trigger` | AEO/SEO の充足度解析を、いつ・どの頻度で走らせるか。記事の公開前に止めるのか、公開後に気づかせるのか、その両方か。 | `opt-publish-gate-plus-scheduled` | confirmed | G3, G2 |

- **`decision-llm-provider` の caveat**: 鍵が社数ぶん増える。登録は本人がブラウザで行い、こちらでは受け取らない（11 §5） / どの用途にどの社を当てるかが未定のままだと、いちばん高い社が既定になる。用途ごとの既定を決める必要がある / 単価表の pricedOn は 2026-08-18 のまま。実費の見積りは llm-cost-simulator で別途取る

- **`dec-aeo-analysis-trigger` の caveat**: ゲートの強さ (公開を止めるか、警告して通すか) を項目ごとに決めること。全項目を必須にすると公開できない記事が滞留し、ゲートを迂回する運用が生まれて検出が形骸化する / 定期実行の失敗は画面に何も現れない。実行の成否と最終実行時刻を管理画面から確認できるようにすること / 公開操作に解析の待ち時間が乗る。解析が重くなった場合に公開を待たせない逃げ道 (非同期化) を後から入れられる形で実装すること / 根拠として引用した Cloudflare Workers と Google 検索セントラルは取得済みの入口ページで、Cron Triggers の実行回数制限と個別型の必須プロパティは本セッションで再取得していない。実装着手時に公式資料で再確認すること

## 確定内容 (質疑録)

### qa-backend-web-seo-audit-writeback-p13-v3 (対応セル: web)

**質問**: backend×web: 定期 SEO/AEO 再点検の対象 0 件成功、一部失敗、全件失敗、対象取得失敗をどう区別し、最終実行時刻をどの workspace の管理画面に表示するか (P13 書き戻し・v3)。

**回答**: 2026-09-04 時点の実装では、記事単位の点検結果と cron 自体の実行結果を別の状態として扱う。記事は未点検／全合格／要修正／取得不能、定期再点検は未実行／成功／一部失敗／失敗／状態取得不能を区別する。成功は失敗 0 件で対象 0 件も含み、一部失敗は保存の成功と失敗が混在、全件の保存失敗と対象取得失敗は失敗とする。固定 failure code で後ろ 2 つも区別し、自由文の例外は保存しない。

scheduler は非停止 workspace を列挙した後、既存の古い順の全体バッチを 1 回だけ取得する。1 起動の上限 50 件は変えず、処理結果だけを workspace 別に集計する。対象取得自体が失敗したときも、列挙済みの各 workspace へ失敗と開始／完了時刻を残してから入口へ失敗を返す。run-state の保存失敗も成功に潰さない。Worker はジョブごとの独立 `waitUntil` と catch を維持し、失敗時は成功ログを出さず retry も要求しない。DB binding が無い場合は警告ログのみとする。

管理画面は actor の `workspaceId` だけを読み口へ渡し、隣の workspace の状態や件数を表示しない。各最終状態に開始時刻と最終完了時刻、この回の対象／保存／失敗件数を表示する。対象 0 件は「この回で再点検した記事は無い」という事実だけを示し、未実行や失敗と混ぜない。

HowTo/Speakable の導出、点検履歴 30 件、最終点検から 7 日以上、1 起動 50 件、毎日 `0 17 * * *` の既存値は変えない。実 D1 での所要時間と記事 350 本超の挙動は引き続き未測定である。

### qa-backend-web-blog-creation-atomicity (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: ブログ作成の完了条件をどう定義し、サブドメインから slug への解決をどこで行うか。

**回答**: 作成ユースケースは create-only の Unit of Work が完了したときだけ成功を返す。1つでも失敗したら全体を巻き戻し、成功メッセージも読者リンクも出さない。下書き保存は expected revision の CAS、作成は同じ revision の DB claim を要求し、古い回答や作成後の遅延保存を conflict にする。作成直後は provisioningComplete を fixed pages/全 provisioned bands・slots/categories/network から判定し、公開表示用の enabled layout、および公開固定ページと articles を要求する contentReady と分離する。D1/live の公開 reader へ code sample fallback を混ぜず、記事一覧・本文・composition は同じ PublicBlog の保存実体を読む。ホスト→slug の解決は middleware が単一の場所で行い、<slug>.<基底ドメイン> を受けたら既存の /s/<slug> ルートへ内部委譲する。ブログ1本ごとにルートもコードも増やさない。未知ホストは404とし、存在するブログの一覧を推測させない。

### qa-backend-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: 二層構造での WebMCP 契約・禁止依存・生成基盤の設計制約は何か (書面入力 docs/spec/04 §3 §4 / 05 / 07 §0)

**回答**: | 登録先 | **`document.modelContext`**。`navigator.modelContext` は Chrome 150 で非推奨のため legacy fallback 専用（CHG-001） |
| ツール数 | 1ページあたり原則6個以下 |
| FD-1 | ランキング式を UI 層・WebMCP 層へ重複実装する | `src/lib/domain/ranking.ts` 以外に重み計算が現れないことを grep テストで固定 |
| FD-2 | 報酬データを推薦スコアの入力にする | Ranking Service の入力型に Commercial DB 由来の型が含まれないことを型で担保 |
| FD-4 | WebMCP でしか到達できない機能を作る | 全 WebMCP ツールに対応する通常 UI 経路が存在することをトレーサビリティ表で確認 |

### qa-backend-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 書面入力 docs/spec/01-要求仕様書-v1.0.md §18.3 のバックエンド (backend) × web 要件は何か

**回答**: * 同一投稿の重複実行を防ぐ
* Idempotency Keyを使用
* 投稿前にアカウントを再確認
* トークン期限を確認
* API制限を確認
* 公開操作を監査ログに残す
* 予約直前の編集を検知する
* 投稿失敗時に自動で無限再試行しない
* 削除・更新は別承認を要求できる
* 外部投稿のURLを保存する

### qa-backend-web-analytics (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: 分析・解析パイプライン (収集→正規化→集計→分析→活用) の要件は何か (書面入力 docs/spec/03 §1)

**回答**: ClickEvent(リダイレクトサービス)
  BehaviorEvent(ブログ計測タグ)
  Channel Insights(SNS API)
  Conversion(ASP API / CSV)
      ↓
[正規化層]
  bot除外・重複排除・セッション化・ディメンション付与
      ↓
[集計層]
  MetricRollup(日次 × ディメンション組み合わせ)
      ↓
[分析層]
  KPIディクショナリ / Attribution / Experiment / Insight Engine
      ↓
[活用層]
  Analyticsダッシュボード / InsightReport / 生成時の推奨(Brief への提案)
```

設計原則:

* **イベントは不変(append-only)**。修正は打ち消しイベントで行う
* **集計は再計算可能**。生イベントから任意時点のロールアップを再構築できる
* **転送は必達、計測はベストエフォート**。リダイレクトはDB障害時も止めない
* **Editorial / Commercial 分離**(v1.0 19.4章)。Insight Engine は配信戦略・表現の学習にのみ収益データを使い、商品評価・ランキングへは出力しない
```

- (注記: 正本 qa_log[qa-backend-web-analytics].answer のコードフェンスが閉じていないため、章の構造を守るためコンパイラが閉じた。正本側の修正が要る)

### qa-backend-web-overhaul-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: UI/UX 改善で必要になる API は何か (2026-08-21 利用者ヒアリング逐語)

**回答**: 利用者本人の回答を逐語主旨で記録する。「この UI、UX を整える際に必要な API があれば、それも併せて実行するような流れにしておいてください」。具体的には (1) 各管理対象 (商品・ブログ・SNS チャネル・記事等) の新規作成・削除を含む CRUD API。(2) 商品×ブログの多対多対応付けと、ブログごとのコンセプト管理 API。(3) コンセプトごとの文章生成・保存 API。(4) X・Facebook 等を抽象化した SNS チャネル登録・投稿状態参照 API (プロバイダ追加可能な構成)。(5) ブログごとの構成 (セクション並び・テンプレート・コンポーネントセット) を保存・取得する構成管理 API。ドメインモデルは既確定の qa-backend-web-spec-intake を基礎とし、ブログ構成とチャネルの 2 概念を拡張する。既存のバックエンドスタック (Cloudflare Workers/D1) を継続使用する。

### qa-backend-web-aeo-analysis-pipeline-v4 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: AEO/SEO の充足度を解析し、その結果をブログと記事エディターへ反映する仕組みをどこにどう置くか。API 契約はどうするか。2026-09-03 利用者ヒアリング。

**回答**: 利用者の指示は「AEO,SEO 対策ができるように。で、それを分析、解析して、それをブログの方に反映できるように、そういうような仕組みを整えてほしい」。仕組みは次の3層に分ける。

#### 1. 解析 (analyze)
公開済み記事の保存実体を入力に、検証可能な項目の充足を判定する純粋関数をドメイン層に置く。判定項目は index 可否 (noindex/robots)・canonical の有無・JSON-LD の型と必須プロパティ・見出し階層の妥当性 (本文外見出しの混入なし)・画像の alt 被覆と width/height・広告リンクの rel・最終更新日の表示・結論/FAQ/手順/出典ブロックの有無・最終更新からの経過日数。各項目は充足/不足/対象外の3値と、不足時の該当箇所を返す。順位・流入・引用率のような外部由来の推定値は判定に含めない。含めると、確かめられない数字を根拠に記事を書き換えることになる。

#### 2. 保存 (record)
解析結果は記事単位・実行時刻付きで保存し、いつの時点の判定かを常に言えるようにする。保存はワークスペースで区切り、他テナントの記事の判定を読めない。

#### 3. 反映 (apply)
解析結果は2つの経路で反映する。(a) 管理画面の記事エディターへ、不足項目を名指しで差し戻す。書き手はその場で直せる。(b) 記事一覧に充足度を出し、どの記事から直すべきかを判断できるようにする。自動で本文を書き換えない。自動書き換えは、書き手が読んでいない文章が公開される状態を作る。

#### API 契約 (api カテゴリは backend で扱う既存方針を踏襲)
解析の実行・結果の取得・記事単位の再解析を、既存の管理 API と同じ規約 (ワークスペース境界・認可・エラー形状) で提供する。公開読者面はこの API を呼ばない。読者に見せる必要が無い情報を読者経路へ流さない。

#### ガイドライン参照レジストリ
SEO/AI 検索ガイドラインの出典 (発行元・URL・確認日・要約) をレジストリとして持ち、確認日から90日を超えたものを要再確認として管理画面へ出す。ガイドライン変更時は仕様セルを R4-reopen する運用とし、判定項目を勝手に書き換えない。

- (注記: 正本 qa_log[qa-backend-web-aeo-analysis-pipeline-v4].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 意思決定が本章に効く形

正本 `decisions[]` の一覧と状態は `00-requirements-definition.md` が正本から生成する。
**ここには表を写さない。**写した表は正本が動いても追従せず、2026-09-04 まで
「全 7 件」と書かれたまま残った (実際には 12 件) のがその実例である。

- **`decision-llm-provider` が本章に効く形**: 複数プロバイダを保つのは選択肢を
  増やすためではなく、07 §0 GC-5 (レビュー系を執筆系から分離し、自作自演の検証に
  しない) を**書き手と検査役に別モデルを当てる**ことで満たすためである。1 社固定に
  するとこの分離が構成では表せなくなる。単価は `vars` に置き、値上げに気づける
  状態を保つ。
- **鍵の扱い**: API 鍵は利用者本人がブラウザまたは別端末で登録する。値も断片も
  この作業場所には置かない。
- **`dec-aeo-analysis-trigger` が本章に効く形** (2026-09-04 確定、
  `opt-publish-gate-plus-scheduled`): 解析は公開操作の経路に置く。解くべき問題は
  「欠落に気づく」ではなく**「欠落したまま公開される」**なので、検出を増やしても
  公開経路の外に置く限り問題は残る。ゲートの強さは項目ごとに決める — 全項目を
  必須にすると公開できない記事が滞留し、ゲートを迂回する運用が生まれて検出が
  形骸化する。定期再解析は Cron に乗せ、**成否と最終実行時刻を管理画面から
  読める**ようにする。定期実行の失敗は画面に何も現れないため、記録しなければ
  「再解析されていないこと」に永久に気づけない。
- **解析関数は生成関数と同じ入力を見る**。`dec-structured-data-emission` が
  配信時導出を選んだのは、解析の判定と実際に出力される構造化データが食い違わない
  ことを構造で保証するためである。解析側が独自にパースし直す実装にすると、この
  保証が消える。

- 正本へ入れた理由: 各章の手書き意思決定表は正本 decisions[] の写しで、件数が 7 のまま古びていた。表は 00-requirements-definition.md が正本から生成するので削る。削れない章固有の突き合わせ (この決定が本章にどう効くか) を正本へ移し、compile の純関数出力として復元されるようにする。

### 章の規範本文を正本から再生成しない理由

`## 確定セルの記録` は 2026-09-04 から compile が正本 `matrix` / `qa_log` から描く。
一方で **章の規範本文 (To-Be 契約表・故障モード・初期 SLO・Acceptance evidence) は
正本から再生成しない。** その判断の根拠となる 3 つの実測 (再生成で消える 374 行 /
正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が
8 件中 7 件で不一致) は `system-spec/database.md` の同じ節に 1 か所だけ書いてある。
**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

- 正本へ入れた理由: 確定セルの記録を compile 生成へ移したため、その節の内側に手で書かれていた散文が 次の再生成で消える。散文が守っているのは「章の規範本文を正本で置き換えない」という 判断で、これは今も生きている。消えようのない場所 (正本) へ移して compile に描かせる。

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

(2026-09-04 追記: 本節はこの日まで章にだけ在り、`## 章にしか無い記述 (正本へ未接続)` として引き継がれていた。同じ見出しの節が P13 の書き戻しでもう 1 つ生まれ、`##` 単位の引き継ぎが衝突して本節が落ちた。**落ちようのない場所へ移すのが直し方である**ため、正本の `chapter_notes` へ入れた。文面は落ちる前の逐語のままで、この段落だけが追記である。)

- 正本へ入れた理由: 章にだけ在った本節が、P13 の書き戻しで同名の「章にしか無い記述」節が 2 つになった結果、## 単位の引き継ぎが衝突して落ちた。守るのではなく落ちようのない場所へ移す。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述。fetched-references.json の取得対象 8 件のいずれでもなく、retrieval-evidence にも record が存在しない。この作業場所には書籍本文を取得する経路が無い。 |
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |

- **application-architecture の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないこと。fetched-but-no-body と not-in-fetch-targets は取得すれば塞がるが、これは塞がらない。3 種を『条項引用不可』の一語に潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。
- **data-access の反転先**: 反転先は無い。application-architecture の reversal_note と同じ理由。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

---

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

### API Design Patterns — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/api-design-patterns.md`

#### 目的

consumerとproviderの独立変更を支える安定した契約を作り、再試行、失敗、並行更新、pagination、evolutionを予測可能にする。

#### 解決する問題

- resource/operationの意味、error、null、time、identifierがendpointごとに揺れる。
- timeout後の再試行で二重処理が起き、clientが成功/失敗を判断できない。
- collection増大や並行更新でoffset paginationと全件responseが破綻する。
- version/evolution方針がなく、provider変更がconsumerを突然壊す。

#### 適用条件

- 複数client/team/organizationが独立releaseで同じservice boundaryを利用する。
- network failureとretryが通常事象で、operation結果の重複や不明状態を制御する必要がある。
- contractの長期互換性とobservabilityが局所的な実装簡潔性より重要。

#### 非適用条件

- 同一process内のprivate callで、network boundaryや独立versioningが存在しない。
- hard real-time stream、双方向session、巨大event flowなど、request/response RESTが問題形状に合わない。
- 単純CRUD表面化がdomain invariantを迂回させる場合。use-case operationまたは別interaction modelを選ぶ。

#### トレードオフ・失敗モード

- version、idempotency ledger、schema governance、compatibility testに運用費がかかる。
- 「名詞URL」だけ守ってtransaction、authorization、error semanticsを設計しない表層RESTになる。
- offset paginationは簡単だが大規模/更新中datasetで遅延・重複・欠落を起こす。
- idempotency keyのscope/TTL/payload bindingが曖昧だと、別requestを誤って同一視する。
- breaking changeを新versionで逃がし続けると、複数version保守とsecurity patch負担が増える。

#### goalへの寄与

- mobile/web/desktop間で一貫したbusiness capabilityを共有し、platform別再実装を減らす。
- reliability goalにはretry-safe operationと明示的error、delivery goalにはcontract testとadditive evolutionを結ぶ。
- 選択はAPI様式の流行でなく、consumer、latency、consistency、offline、security、cost constraintsへの適合で評価する。

---

#### 本章での適用

##### 確定内容 qa-backend-web-seo-audit-writeback-p13-v3 (対応セル: web)

- 確定要件: 2026-09-04 時点の実装では、記事単位の点検結果と cron 自体の実行結果を別の状態として扱う。記事は未点検／全合格／要修正／取得不能、定期再点検は未実行／成功／一部失敗／失敗／状態取得不能を区別する。成功は失敗 0 件で対象 0 件も含み、一部失敗は保存の成功と失敗が混在、全件の保存失敗と対象取得失敗は失敗とする。固定 failure code で後ろ 2 つも区別し、自由文の例外は保存しない。

scheduler は非停止 workspace を列挙した後、既存の古い順の全体バッチを 1 回だけ取得する。1 起動の上限 50 件は変えず、処理結果だけを workspace 別に集計する。対象取得自体が失敗したときも、列挙済みの各 workspace へ失敗と開始／完了時刻を残してから入口へ失敗を返す。run-state の保存失敗も成功に潰さない。Worker はジョブごとの独立 `waitUntil` と catch を維持し、失敗時は成功ログを出さず retry も要求しない。DB binding が無い場合は警告ログのみとする。

管理画面は actor の `workspaceId` だけを読み口へ渡し、隣の workspace の状態や件数を表示しない。各最終状態に開始時刻と最終完了時刻、この回の対象／保存／失敗件数を表示する。対象 0 件は「この回で再点検した記事は無い」という事実だけを示し、未実行や失敗と混ぜない。

HowTo/Speakable の導出、点検履歴 30 件、最終点検から 7 日以上、1 起動 50 件、毎日 `0 17 * * *` の既存値は変えない。実 D1 での所要時間と記事 350 本超の挙動は引き続き未測定である。
- 設計解釈の記録経路: `dialogue`
- 原則: 落ちても利用者の画面に何も起きない処理は、成功 0 件と未実行・失敗を同じ見た目にしない (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 記事の落ち方と cron の健全性を分け、workspace ごとの最新 run-state・固定 failure code・時刻を管理画面に出す。これにより 0 件成功、未実行、取得失敗を判定できる
  - トレードオフ:
    - 直近 1 回の投影だけを保存するため、cron 実行の長期トレンドはこの表からは読めない
    - D1 自体が利用できない障害では run-state も残せないため、固定ワーカーログを併用する
- 原則: 記事の点検結果と定期ジョブの実行状態を役割の異なる境界に分ける (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 既存の記事点検履歴を汎用ジョブイベントに変えず、SEO 再点検専用の domain・port・最新状態だけを追加した。管理画面も記事 4 状態と run 状態を別の節で読む
  - トレードオフ:
    - SEO 再点検以外のジョブに同じ表を流用できないが、未確定の汎用イベント基盤は持たない
##### 接地根拠 qa-backend-web-blog-creation-atomicity (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web-blog-creation-atomicity` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Use Cases — application 固有の処理を delivery/persistence から独立して表し、成功の定義を use case 側が持つ (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: createCreateSiteFromDraftUseCase は新規作成専用とし、既存 slug を上書きしない。source draft claim・設計図・必須実体・下書き完了・作成監査を persistence の 1 Unit of Work に渡し、1 つでも失敗したら全体を巻き戻して成功を返さない
  - トレードオフ:
    - use case が知る実体が増えるため、persistence 側の port が太る。port を分割しすぎると原子性を保証する主体が曖昧になるので、transaction 境界を握る port を 1 つに保つ
- 原則: Ports and Adapters / DIP — 内側が必要な port を定義し、外側 adapter が実装する (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: ホスト名から slug を導く解決は middleware という単一の場所で行い、<slug>.<基底ドメイン> を受けたら既存の /s/<slug> ルートへ内部委譲する。ブログ 1 本ごとにルートもコードも増やさない。ホスト解決は外側 adapter の関心で、内側の use case は解決済みの site identity だけを受け取る
  - トレードオフ:
    - middleware に判定が集まるため、ここが単一障害点になる。逆に判定箇所が 1 か所に閉じることでテナント境界の検査対象も 1 か所で済む
    - 未知ホストを 404 とする方針は、設定ミスとブログ不在を利用者から区別できなくする。存在するブログ一覧を推測させないことを優先し、切り分けは運用ログ側で行う
- 原則: Least privilege / deny by default — 判断不能時は fail closed (`secure-by-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: ホスト解決が一意に定まらない場合 (未知ホスト・導出 slug の公開 identity 欠落または曖昧・workspace 不一致) は配信せず 404 を返す。resolvePublicSiteIdentity が rows.length !== 1 で null を返す現行の fail-closed 判定はこの原則に合致しており、変えるのは『作成側が満たすべき前提を書き切っていない』側であって、読者側の厳格さではない
  - トレードオフ:
    - 読者側の判定を緩めれば 404 は即座に消えるが、それは不完全なブログを公開することと同義になる。是正の向きを作成側に固定するぶん、修正範囲は広くなる
- 原則: CQRS / Ports and Adapters — 編集用 aggregate と公開用 projection を分離し、公開側の port を一つにする (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: D1/live の公開記事は published_articles を唯一の canonical public projection とする。PublicBlogPort の記事一覧・詳細は PublishedContentPort へ委譲し、articles の直読、sample fallback、union、独自件数集計を持たない。ブログ運用と AI 生成の公開 writer は同じ projection statement builder を使い、公開・更新・非公開化・削除・復元の状態遷移で独立 writer を増やさない。source_article_id のある行は BlogOps 管理だけが更新し、AI 公開記事用 published admin から除外する
  - トレードオフ:
    - 公開 projection へ書けなければ編集 aggregate だけを公開済みにしない fail-closed 動作が必要で、単純な status 更新より transaction 境界が広がる
    - 旧 /blog/:slug は削除せず同じ projection を引いて articleHref の canonical URL へ 308 redirect するため、入口は残るが本文の描画経路は一つになる
##### 接地根拠 qa-backend-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web-spec-intake` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: ランキング計算・比較候補の分類・公開ゲート判定・広告表記の要否判定は src/lib/domain/ の純関数 1 箇所に置き、管理画面・公開ブログ・WebMCP・MCP のすべてがそこを呼ぶ (`docs/spec/04-二層構造統合仕様.md#§2-3`)
  - 採否: `applied`
  - 章固有の根拠: 計算の正本を 1 箇所に固定し、呼び出し側 (画面 / WebMCP / MCP) は結果を描画するだけにする。重複実装は FD-1 として grep テストで落とす
  - トレードオフ:
    - 経路ごとの最適化余地は減るが、経路によって順位が食い違う事態を構造的に排除できる
- 原則: WebMCP の登録先は document.modelContext。navigator.modelContext は legacy fallback 専用で、1 ページあたりのツールは原則 6 個以下 (`docs/spec/04-二層構造統合仕様.md#§3`)
  - 採否: `applied`
  - 章固有の根拠: 能力検出を先に行い、非対応環境は通常 UI へ落とす。ページ種別ごとに登録するツールを 6 個以下に選択する
  - トレードオフ:
    - ページごとに公開ツールを選ぶ手間が増えるが、モデル側の選択誤りを減らせる
- 原則: 禁止依存 FD-1〜FD-5。特に FD-4「WebMCP でしか到達できない機能を作る」は、全 WebMCP ツールに対応する通常 UI 経路が存在することをトレーサビリティ表で確認する (`docs/spec/04-二層構造統合仕様.md#§4`)
  - 採否: `applied`
  - 章固有の根拠: WebMCP は追加の入口であって唯一の入口ではない。docs/product/traceability.md の導線列で対応 UI を必須にする
  - トレードオフ:
    - UI 側の実装が常に先行するため WebMCP の追加が遅くなるが、機能フラグを落としたときに使えなくなる機能が生じない
- 原則: 生成基盤の設計制約 GC-1〜GC-6。AI に自由に書かせず、承認済みの事実・根拠・ペルソナ・媒体ルールを入力として与えて生成させる (GC-1)。レビュー系は執筆系と分離し自作自演の検証にしない (GC-5) (`docs/spec/07-生成基盤設計.md#§0`)
  - 採否: `applied`
  - 章固有の根拠: プロンプト入力変数を必須項目に固定し、欠落があれば生成を実行しない。Writer と Fact-checker / Compliance-reviewer を別サブエージェント・別コンテキストに置く
  - トレードオフ:
    - 入力を揃えるまで生成できず着手が遅れるが、根拠のない文章が生成物として残らない
- 原則: 執筆順序（結論→理由→根拠→具体例→例外→読者にとっての意味→次の行動）を節単位で必ず 1 周させる。根拠の段は省略不可 (`docs/spec/05-文章作成メソッド仕様.md#§1`)
  - 採否: `applied`
  - 章固有の根拠: 生成の出力契約をこの 7 段の構造体にし、根拠の段が空のまま公開ゲートを通らないようにする
  - トレードオフ:
    - 文章の自由度は下がるが、根拠のない主張が節の単位で検出できる
##### 接地根拠 qa-backend-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Idempotency Key による重複投稿防止と監査ログ (`docs/spec/01-要求仕様書-v1.0.md §18.3`)
  - 採否: `applied`
  - 章固有の根拠: 外部公開操作は冪等キー・トークン期限確認・監査ログ記録を必須とし、失敗時の無限再試行を禁止する
  - トレードオフ:
    - 冪等キー管理のため投稿キューに状態テーブルが必要となり実装が増えるが、重複公開事故を構造的に防げる
- 原則: Connector 契約と Capability Registry (`docs/spec/01-要求仕様書-v1.0.md §17.1`)
  - 採否: `applied`
  - 章固有の根拠: 媒体別の文字数・形式制約をコードへ直書きせず、バージョン管理された Capability Registry で管理する
  - トレードオフ:
    - レジストリの更新運用が必要になるが、媒体仕様変更時にコード改修なしで追従できる
- 原則: イベント駆動 (publication.published 等) の非同期処理 (`docs/spec/01-要求仕様書-v1.0.md §23.2`)
  - 採否: `applied`
  - 章固有の根拠: 投稿・成果・リンク切れをイベントとして発行し、通知・集計・再生成を疎結合にする
  - トレードオフ:
    - 結果整合となるためダッシュボードは速報値と確定値を区別表示する必要がある
##### 接地根拠 qa-backend-web-analytics (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web-analytics` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: イベントは不変 (append-only) とし、集計は生イベントから再計算可能にする (`docs/spec/03-分析・解析基盤仕様.md#§1`)
  - 採否: `applied`
  - 章固有の根拠: Cloudflare Workers 上のリダイレクト (/go/{tracking_link_id}) で ClickEvent を追記し、MetricRollup は日次バッチで再構築可能にする。既存の Workers + D1 + Drizzle スタックに Queue/Cron を追加して実装する
  - トレードオフ:
    - 打ち消しイベント方式は実装が複雑になるが、集計の監査可能性と再現性を得る
- 原則: Editorial / Commercial 分離: 収益データは配信戦略の学習にのみ使い、商品評価・ランキングへ出力しない (`docs/spec/03-分析・解析基盤仕様.md#§1`)
  - 採否: `applied`
  - 章固有の根拠: Insight Engine の入出力境界をコードレベルで分離し、Commercial DB への参照を Editorial 系モジュールから物理的に遮断する (v1.0 §19.4)
  - トレードオフ:
    - データ結合の自由度は下がるが、報酬額バイアスの混入を構造的に防止できる
##### 接地根拠 qa-backend-web-overhaul-v2 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web-overhaul-v2` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: UI の各操作は対応する API 契約と対で定義し、画面だけが先行して API 不在で死んでいる状態を作らない (`user-dialogue:2026-08-21#必要API併走`)
  - 採否: `applied`
  - 章固有の根拠: 利用者が「UI/UX を整える際に必要な API があれば併せて実行する」と明言した。各サイト・各 SNS への投稿部分が画面に反映されていない現状は、表示に必要な API/データ供給の欠落が一因であり、画面と API を同一タスク境界で対にする
  - トレードオフ:
    - API を同時に整備するぶん 1 機能あたりの実装範囲は広がる。画面ごとに必要最小の API から段階導入し、プロバイダ別 SNS 連携の実配信は契約定義と投稿状態参照を先行させる
##### 接地根拠 qa-backend-web-aeo-analysis-pipeline-v4 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-backend-web-aeo-analysis-pipeline-v4` を参照
- 設計解釈の記録経路: `secondary_ref_attachment` (`attach-qa-design-applications`)
- 原則: 判定はドメイン層の純粋関数に置き、外部由来の推定値を混ぜない (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 回答は解析を純粋関数としてドメイン層へ置き、順位・流入・引用率のような外部由来の推定値を判定に含めないと明記している。理由も回答自身が述べている — 含めると、確かめられない数字を根拠に記事を書き換えることになる。入力を記事の保存実体だけに限ると、同じ記事に対する判定が常に同じ結果になり、判定の再現性が保たれる
  - トレードオフ:
    - 実際に検索で見つかっているかという最も知りたい情報が判定に入らない。検証可能な項目だけを条件にする代わりに、施策の効果は間接的にしか測れない
    - 外部データを一切入れないため、ガイドライン側の変更は自動では反映されない。dec-guideline-registry-recheck の再確認と R4-reopen の運用が追従経路になる
- 原則: 対応不要な通知は、対応が要る通知の信頼を削る (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 各判定項目を充足/不足/対象外の3値にし、不足時にだけ該当箇所を返す形にしたのは、素材の無い記事に対して出せない型を『不足』と呼ばないためである。FAQ ブロックが無い記事に FAQPage の不足を出し続けると、指摘が常時赤い状態になり、実際に直すべき欠落まで読み飛ばされる。既存の decision-screen-priority で同じ構造の判断 (0件の枠が先頭を占め続けることを避ける) を採っている
  - トレードオフ:
    - 対象外の3値目を持つことで、『素材が無いから対象外』と『素材を足すべきなのに足していない』の区別が判定からは付かなくなる。どちらかを知りたい場合は別の観点として設計する必要がある
    - 反映を差し戻しと一覧表示に限り自動で本文を書き換えないため、欠落の解消は必ず人の操作を要する。自動修正より遅いが、書き手が読んでいない文章が公開される状態を作らない
- 原則: 読者に見せる必要が無い情報を読者経路へ流さない (`secure-by-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 回答は解析 API を既存の管理 API と同じ規約 (ワークスペース境界・認可・エラー形状) で提供し、公開読者面はこの API を呼ばないと定めている。解析結果は運営側の内部評価であり、読者経路へ出す必要が無い。経路を分けることで、認可の判断を読者面へ持ち込まずに済む
  - トレードオフ:
    - 読者面と管理面で API を分けるため、同じ記事データに対して2つの取得経路が生まれる。描画そのものは public-site-projection を共有させて二重化を避ける
    - 解析の実行を管理 API 側に置くため、公開操作からの呼び出しが認証済み経路を経る必要がある。外部から解析を任意に誘発できない利点と引き換えに、経路の設計が1段増える
- 資するゴール: G1, G2, G3

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| drizzle-orm | 0.45.2 | Drizzle Team (orm.drizzle.team) | https://orm.drizzle.team/docs/overview | 2026-08-16T09:01:52Z | 2026-08-22T22:20:35Z |
| anthropic-claude | 現行 active モデル (claude-fable-5-1 / claude-opus-5 / claude-sonnet-5 / claude-haiku-4-5-20251001) | Anthropic (platform.claude.com) | https://platform.claude.com/docs/en/models/overview | 2026-09-02T08:19:13Z | 2026-09-02T08:19:13Z |
| openai-platform | gpt-5.6 | OpenAI (developers.openai.com) | https://developers.openai.com/api/docs/models | 2026-08-22T15:05:04Z | 2026-08-22T15:05:04Z |
| google-gemini | Gemini 3 系 (gemini-3.8-flash / gemini-3.7-flash / gemini-3.6-flash / gemini-3.5-flash / gemini-3.1-pro-preview) | Google (ai.google.dev) | https://ai.google.dev/gemini-api/docs/models | 2026-09-02T21:20:17Z | 2026-09-02T21:20:17Z |

## 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**実装済み・デプロイ済み・検証済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §1、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

### As-Is（2026-08-16 のリポジトリ実体）

- Next.js / OpenNext の単一アプリ内に、D1 を直接読む stateless MCP PoC がある。
- MCP PoC は `list_programs`、`record_conversion`、`get_revenue_summary` の3ツールのみ。単一の `MCP_TOKEN` または same-origin 判定で入口を分けるが、利用者主体、Workspace membership、role による認可はない。same-origin は主体認証ではない。
- `record_conversion` は成果を1件追加するだけで、ASP API / CSV の一括取り込み、安定した成果同一性、再取り込みの冪等化、判断・入金の状態履歴はない。現在の単一 `status` は `pending | approved | rejected` のみで、入金状態を表現できない。任意の `external_id` に一意制約もない。
- ClickEvent / BehaviorEvent / Channel Insights の収集、正規化、MetricRollup、Attribution、Insight Engine、Brief への提案は未実装である。

### To-Be（規範契約）

| ID | 契約 | 状態 |
|---|---|---|
| BE-ANA-01 | 収集→正規化→集計→分析→活用の責務境界は `docs/spec/03-分析・解析基盤仕様.md` §1–§7 を正本とする。各段は再実行可能な idempotent consumer とし、append-only の入力から同じ rollup を再構築できること | 未実装 |
| BE-CONV-01 | 成果の安定同一性 `conversion_key` は `(workspace_id, affiliate_account_id, import_source, source_record_id)`。source ID がない取込元だけ、状態を除く不変項目から source fingerprint を作る。`import_record_key` は原票1行の canonical hash とし、同一キー再送は no-op、同一 `conversion_key` の新しい原票は承認または支払の状態更新履歴として扱う。現在値は `approval_status ∈ {pending, approved, rejected, cancelled}` と `payment_status ∈ {not_eligible, unpaid, scheduled, paid, reversed}` の二軸で投影し、単一 `status` へ合成しない。`scheduled/paid` は `approval_status=approved` の場合だけ許可する | 未実装 |
| BE-AUTH-01 | UI / REST / WebMCP / backend MCP は共通の use-case 境界を呼び、そこで `actor(type, id) + workspace_id + membership status + role` を認可する。actor と workspace は検証済み session/token から導出し、ツール引数を信用しない | 未実装 |
| BE-MCP-01 | 現行 MCP は接続性検証用 PoC。製品版では BE-AUTH-01 を通る薄い adapter とし、§24.3 の resource/tool 契約、監査、確認必須操作、集計値のみの開示を通常 API と共有する | PoC のみ |

### Delta

1. BE-AUTH-01 を先に実装し、すべての repository query に workspace scope を必須化する。
2. BE-CONV-01 の import command、idempotency ledger、判断・入金の状態履歴を実装する。現行 `record_conversion` の無条件 insert と単一 `status` は、移行後に二軸を扱う内部 command へ置換する。
3. BE-ANA-01 を収集・正規化・rollup・分析の順に追加し、同じ KPI 契約を画面/API/MCPで使用する。
4. 最後に BE-MCP-01 を PoC token 依存から actor-scoped credential に移行する。

### Dependencies

依存方向は `前提 → 後続` とする。

- `DB-IDENTITY-01` / `DB-TENANT-01` + auth 章の session 方針 → BE-AUTH-01。
- `DB-CONVERSION-01` + Commercial D1 + ASPごとの原票正規化規則 → BE-CONV-01。
- `DB-PROJECTION-01` / `DB-KPI-01` + infrastructure の Queue / Cron / Redirect Resolver → BE-ANA-01。
- BE-AUTH-01 + 各 use case → BE-MCP-01。MCP 固有ロジックから DB を直接操作しない。

### Acceptance evidence

- 同一取込ファイルを2回処理して成果件数・金額が増えず、後続の `approval_status` / `payment_status` 変更だけが同じ成果へ反映される自動テスト。
- 異なる Workspace の actor が同じ resource ID を指定しても参照・変更できず、role 不足が拒否される API/MCP 共通の認可テスト。
- 生イベントから rollup を全再計算した結果が増分集計と一致する fixture テスト。`approval_status=approved, payment_status=unpaid` では `revenue_approved` のみ、`payment_status=paid` への変更後は `revenue_paid` も計上され、承認報酬が二重加算されないこと。
- MCP の tool call と通常 API が同一 use case / KPI 定義 / 監査記録を使うことを示す contract test。
