---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G1, G3]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-seo-approved-diff-20260906。裏付け質疑 (`qa_refs`): `qa-neutral-search-method-v6`, `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-auto-scope-v6`, `qa-neutral-citation-check-v6`, `qa-answer-aeo-feasibility-v6`, `qa-decision-aeo-data-sources-v5`, `qa-backend-web-blog-creation-atomicity`, `qa-backend-web-spec-intake`, `qa-backend-web`, `qa-backend-web-analytics`, `qa-backend-web-overhaul-v2`, `qa-backend-web-prose-verbatim`, `qa-backend-web-domain-aeo-behavior`, `qa-backend-web-seo-audit-writeback-p13-v3`, `qa-backend-web-aeo-analysis-pipeline-v4` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
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
| 確定質疑 (qa_ref) | `qa-seo-approved-diff-20260906` |
| 資するゴール (serves_goals) | G2, G1, G3 |
| required-info | `domain-model` — missing_effect: block / 接地: 済 (`qa-backend-web-spec-intake`) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 1 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`backend`) を主担当とする **3 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 |
| `dec-aeo-analysis-trigger` | AEO/SEO の充足度解析を、いつ・どの頻度で走らせるか。記事の公開前に止めるのか、公開後に気づかせるのか、その両方か。 | `opt-publish-gate-plus-scheduled` | confirmed | G3, G2 |
| `dec-article-body-storage-format` | 断片カタログを 19 種へ広げた記事本文を、どの形で保存するか (拡張 Markdown 文字列のままか、構造化 JSON ツリーへ移すか) | `opt-extended-markdown-string` | confirmed | G1, G3 |

- **`decision-llm-provider` の caveat**: 鍵が社数ぶん増える。登録は本人がブラウザで行い、こちらでは受け取らない（11 §5） / どの用途にどの社を当てるかが未定のままだと、いちばん高い社が既定になる。用途ごとの既定を決める必要がある / 単価表の pricedOn は 2026-08-18 のまま。実費の見積りは llm-cost-simulator で別途取る

- **`dec-aeo-analysis-trigger` の caveat**: ゲートの強さ (公開を止めるか、警告して通すか) を項目ごとに決めること。全項目を必須にすると公開できない記事が滞留し、ゲートを迂回する運用が生まれて検出が形骸化する / 定期実行の失敗は画面に何も現れない。実行の成否と最終実行時刻を管理画面から確認できるようにすること / 公開操作に解析の待ち時間が乗る。解析が重くなった場合に公開を待たせない逃げ道 (非同期化) を後から入れられる形で実装すること / 根拠として引用した Cloudflare Workers と Google 検索セントラルは取得済みの入口ページで、Cron Triggers の実行回数制限と個別型の必須プロパティは本セッションで再取得していない。実装着手時に公式資料で再確認すること

- **`dec-article-body-storage-format` の caveat**: 19 種すべてで parseProse(serializeProse(nodes)) === nodes を検証しない限り、記法の追加が既存本文を壊しうる / 未知の記法は捨てずに literal な文字列を保持する段落として残すこと。読めないことと失ってよいことは違う / 表と段組みで記法の冗長さが実用限界を超えるなら、その断片だけ構造化して埋め込む折衷を再検討する

## 確定内容 (質疑録)

### qa-seo-approved-diff-20260906 (対応セル: web)

**質問**: 2026-09-06、提示済み eval-log/affiliate-hub/current-worktree/elegant-review/20260906/seo-change-proposal.md への続行確認。承認対象は次の変更提案全体（これは提示内容の要約で、利用者の逐語回答ではない）: 記事と変更前後の差分を運営者が確認し、承認した対象だけを反映する。夜間処理は観測だけを行う。記事更新・変更前後の履歴・所見の反映済み状態を同一の確定単位で保存し、途中失敗時は全体を変更しない。反映と取消は読み出した版との一致を確認し、同時編集や取消前の追加編集を上書きしない。対象範囲は元記事の作成日時で判定し、導入前の記事と作成日時不明の記事はこの反映経路から除外する。SEO実績は選択したブログ・記事と同じページの観測時刻付き推移へ接続し、クリック数だけで因果効果を断定しない。

**回答**: つづけて

### qa-neutral-search-method-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 読者向けブログの検索はどの方式にしますか。Cloudflare Workers + D1 構成が前提です。(a) D1 の FTS5 全文検索 — 本文まで検索できる。外部サービスを増やさず D1 の中で完結する。日本語は形態素解析が使えず trigram の部分一致が上限なので検索精度に天井がある。索引のぶん保存量と書き込み費用が増える。(b) 題名・カテゴリの部分一致のみ — 実装が最も軽く、索引を持たないので保存量も書き込み費用も増えない。本文中の語では記事が見つからないため、題名に含まれない話題を探している読者は辿り着けない。(c) 外部検索サービスを足す — 日本語の形態素解析やあいまい検索など、精度の上限が最も高い。一方で鍵の管理・障害時の縮退・月額費用という運用が新たに3つ増え、Cloudflare の外に依存先ができる。（2026-09-03 AskUserQuestion『検索方式』。独立監査 C06 が qa-decision-search-method-v4 を『推奨バッジが片方にだけ付いた状態で提示されており、他の選択肢と対等に提示されていない疑いがある』と指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者は前回と同じ案を選んだ）

**回答**: D1 の FTS5 全文検索

### qa-neutral-aio-policy-v7 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索（AIO）へ向けて、記事の内容をどこまで出しますか。(a) 目次のみ（llms.txt）＋AI学習は許可 — 題名・URL・短い説明だけを出す。【利点】本文は自サイトへ読みに来てもらう形が保たれ、流入が維持される。出す情報が少ないので生成の経路も軽い。後から全文へ広げる余地が残る。【懸念】AI 検索面が本文を引用しにくく、被引用の機会は全文提供より減る。学習許可により自分の文章は学習に使われる。(b) 全文（llms-full.txt）まで出す — 【利点】AI 検索面が本文を引用しやすく、被引用の機会が最も多い。AI 経由の可視性が最大になる。【懸念】本文が自サイトの外で読めてしまうため流入は減りうる。一度出した本文は取り消せない。(c) 何も出さず AI 学習も拒否 — AI 向けの表現物を作らない。【利点】実装コストがゼロで、生成・更新・混入事故の面倒が一切生じない。自分の文章が学習にも引用にも使われず、著作物の管理が手元に完全に残る。読者は必ず自サイトへ来る。【懸念】AI 検索経由の可視性は得られない。今後 AI 検索の比重が上がった場合、後から方針を変えても失った期間は取り戻せない。（2026-09-04 AskUserQuestion『AIO方針』。独立監査 C06 が qa-neutral-aio-policy-v6 の質問文自体を『(a)(b) は「利点＋懸念」の対称構成なのに (c) だけ肯定的な言い回しが一切なく、実装コストがゼロ・学習データへの不使用というありうる利点が書かれていない。否定側の排除に類する機序として中立回答を妨げる疑いがある』と指摘したため、3 案とも「利点＋懸念」を揃えて再提示した。順序は前回と同一。利用者の選択は前回と同じ (b) で変わらなかった）

**回答**: (b) 全文まで出す

### qa-neutral-ai-surface-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索への出し方はどの形にしますか。(a) llms-full.txt ＋ WebMCP の両方 — AI 検索に引用される経路と、AI エージェントに検索・記事取得を使わせる経路の両方を持つ。実装は 2 系統分増える。WebMCP はまだ新しい仕様で対応するエージェントが限られるため、効果が出るのは先になる。(b) llms-full.txt のみ — AI 検索への被引用を狙う目的に対してはこれだけで十分で、今すぐ効く。実装も静的ファイルの生成だけで済む。サイトを訪れた AI エージェントは、普通の人間と同じように画面を読むしかない。(c) WebMCP のみ — AI エージェントに対しては最も高度なことができる。ただし AI 検索のクローラは WebMCP を呼ばないので、『検索結果に引用される』という今回の目的には直接は効かない。（2026-09-03 AskUserQuestion『AIへの出し方』。利用者が qa-neutral-aio-policy-v6 の回答内で『webmcpとか使えばいい？』と逆質問したことへ、llms-full.txt は取りに来るクローラに読ませるもの・WebMCP は訪れたエージェントに操作させるもので狙う場面が別であると回答したうえで提示した）

**回答**: llms-full.txt ＋ WebMCP の両方

### qa-neutral-auto-scope-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 自動反映で、機械が公開中の記事を書き換えてよい範囲はどこまでですか。いずれも事後通知と差分履歴・取り消しは共通で付けます。(a) 本文以外のみ（メタ情報系）— 題名タグ・説明文・構造化データ・alt テキスト・内部リンクだけを機械が直す。読者が目にする本文は変わらないので、書き手の文章が勝手に変わる事態が起きない。本文の問題 (見出しの欠落など) は提案のまま残る。(b) 本文の見出し・導入文まで — 見出し階層の欠落や導入文の不足という、検索への影響が大きい部分も機械が直せる。本文の骨格に機械が手を入れるため、書き手の文章の調子が変わることがある。(c) 制限なし（本文全体も含む）— 分析が示した箇所は本文全体を含めて機械が直す。所見が一つも放置されない一方で、推敲した表現や体験談が機械の都合で書き換えられうる。取り消せるが、検索側が変更後を取得した後ならその記録は戻らない。（2026-09-03 AskUserQuestion『自動の範囲』）

**回答**: 次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て

### qa-neutral-citation-check-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索で自サイトが引用されたかを調べるのに、どの問い合わせ先を使いますか。鍵はいずれも運営者が Cloudflare の画面から登録し、リポジトリには置きません。(a) 既に使っている AI 基盤の web 検索機能 — Claude / OpenAI / Gemini はすでにこの製品の取得対象一覧に入っており、新しい契約先を増やさない。引用 URL の返り方は各社で形が違うため、揃える処理を自分で書くことになる。(b) Perplexity Sonar API を足す — 引用した URL が最も構造化された形で返るため、被引用の記録を作る実装が一番素直になる。契約先と鍵が 1 つ増え、月額費用がかかる。(c) 両方を使う — AI 検索面はサービスごとに異なる結果を返すため、複数を見ないと『引用されていない』との判断が偏る。収集先が増えるぶん、実装量と月額費用の両方が増える。（2026-09-03 AskUserQuestion『被引用の確認先』。利用者は選択肢を選ばず費用の制約を述べたため、その制約に沿って (a) を採り、加えてモデルと実行頻度の選び方を回答内容から確定した）

**回答**: コストをできるだけ抑えたい。最小限のllmのモデルでも良い

### qa-answer-aeo-feasibility-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 利用者が qa-decision-aeo-data-sources-v5 の回答末尾で『1、2、3を自作で行いたいなと思ってます。可能ですか？』と逆質問したことへの応答。3 系統 (サイト内静的解析 / Google Search Console 連携 / AI 検索での被引用チェック) を自作することは可能か。（独立監査 C06 が『利用者の疑問に対する応答が qa_log 上に残っていない』と指摘したため、応答を記録として残す）

**回答**: 可能です。系統1 (サイト内静的解析) は自分の記事データを走査するだけなので外部依存が無く、Workers の中で完結します。系統2 (Google Search Console) は公式 API が公開されており、運営者が登録した認証情報で表示回数・クリック・掲載順位・クエリを取り込めます。系統3 (AI 検索での被引用) は AI 基盤の web 検索機能へ問い合わせ、返る引用 URL に自サイトが含まれるかを記録する形で作れます。ただし 3 系統は再現性が大きく異なるため、同じ『分析結果』として混ぜず、収集・保持・表示のすべての層で分けて持つ必要があります。

### qa-decision-aeo-data-sources-v5 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AEO/SEO の分析・解析はどのデータ源で行いますか。(1) サイト内の静的解析（自分の記事データから構造化データ・見出し階層・内部リンク・画像 alt などを走査して採点する。外部依存なし） (2) Google Search Console 連携（表示回数・クリック・掲載順位・クエリを取り込む。API 認証が要る） (3) AI 検索での被引用チェック（AI 検索面へ問い合わせ、自サイトが引用されたかを記録する）。どれを使いますか。（2026-09-03 AskUserQuestion『データ源』。qa-followup-aeo-data-sources-v5 と同一の問答を、裏付け entry へ要求される設計適用を伴う形で作り直したもの）

**回答**: 1、2、3を自作で行いたいなと思ってます。可能ですか？

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

### qa-backend-web-prose-verbatim (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: 記事本文の保存について利用者は何を求めたか。保存形の受入条件を起草する前に、利用者が実際に発した言葉を逐語で記録する

**回答**: [追加要望 (2026-09-05)]
「これ以外にもコードブロックだったり、カードを生成したりとか、横に画像を並べたりとか、表形式を作成するだったりとか、色をつけたものを作るとか、そういうようないろんなものに対応できるように、記事を作成する上で必要な情報を全て盛りだくさんに入れておいてほしいです。」

[機能要望 (2026-09-05)]
「ブログを作成するためのブログエディターが欲しいです。Notionのような管理画面の方でブログを編集できるようなブログエディターが欲しいです。その際に記述したら、もうその瞬間に表示されるようなコードブロックで表示されるような形ではなく、どのような形で表示されるかが見た目的にわかるようなコードエディターが欲しいです。ただし、編集したら見出し2が見出し1に変わるなど、Notionを改善するような形で構築できてほしいです。カードだったり画像を添付したりとか、そのようなところもしっかりと反映できるように、全ての今のブログを構成する情報が編集表示できるように、そのように整えてほしいです。今それが全然反映されていないです。」

※ この answer は利用者の逐語のみで構成する。ここから導いた受入条件・要件 ID は design_applications と chapter_notes に置く (harness doctrine: 利用者の逐語へ後から気づいた突き合わせを足さない)。

### qa-backend-web-domain-aeo-behavior (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: カスタムドメインの接続・検証・証明書、読者行動の受け口、日次ロールアップ、SEO/AEO の評価と記事への反映は、どの処理単位でどう並べるか

**回答**: 4 つのユースケース群に分ける。(1) ドメイン接続: connect-custom-domain が hostname を受け、所有権確認用のトークンを発行し、Cloudflare for SaaS のカスタムホスト名として登録する。verify-custom-domain は provider へ状態を問い、pending/verifying/active/failed を site_custom_domains へ書き戻す。証明書の発行と更新は provider 側の仕事で、こちらは状態を読むだけにする。切断 disconnect-custom-domain は provider から外し、行は revoked として残す (同じホスト名を別 workspace が即座に奪えないようにするため)。(2) 行動計測の受け口: ingest-reader-interactions は 1 リクエストで複数イベントを受け、同意が無ければ reader_key を null のまま保存する。書き込みは append のみで、読者側の描画を待たせない。(3) 集計: rollup-daily-metrics を日次で回し、reader_interaction_events と affiliate_conversions から site_daily_metrics / article_daily_metrics を作る。再実行しても同じ結果になるよう、対象日を丸ごと置き換える形で書く。(4) SEO/AEO: assess-article-seo が公開済み記事の見出し構造・内部リンク・構造化データ・回答単位を測って article_seo_assessments へ残し、apply-seo-recommendation が指摘を記事の下書きへ反映する。反映は自動で公開せず、既存の人間承認の経路に載せる。AEO の出力 (llms.txt・構造化データ・回答単位) は既に公開画面と同じデータから生成している経路を使い、生成ロジックを二重化しない

### qa-backend-web-seo-audit-writeback-p13-v3 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: backend×web: 定期 SEO/AEO 再点検の対象 0 件成功、一部失敗、全件失敗、対象取得失敗をどう区別し、最終実行時刻をどの workspace の管理画面に表示するか (P13 書き戻し・v3)。

**回答**: 2026-09-04 時点の実装では、記事単位の点検結果と cron 自体の実行結果を別の状態として扱う。記事は未点検／全合格／要修正／取得不能、定期再点検は未実行／成功／一部失敗／失敗／状態取得不能を区別する。成功は失敗 0 件で対象 0 件も含み、一部失敗は保存の成功と失敗が混在、全件の保存失敗と対象取得失敗は失敗とする。固定 failure code で後ろ 2 つも区別し、自由文の例外は保存しない。

scheduler は非停止 workspace を列挙した後、既存の古い順の全体バッチを 1 回だけ取得する。1 起動の上限 50 件は変えず、処理結果だけを workspace 別に集計する。対象取得自体が失敗したときも、列挙済みの各 workspace へ失敗と開始／完了時刻を残してから入口へ失敗を返す。run-state の保存失敗も成功に潰さない。Worker はジョブごとの独立 `waitUntil` と catch を維持し、失敗時は成功ログを出さず retry も要求しない。DB binding が無い場合は警告ログのみとする。

管理画面は actor の `workspaceId` だけを読み口へ渡し、隣の workspace の状態や件数を表示しない。各最終状態に開始時刻と最終完了時刻、この回の対象／保存／失敗件数を表示する。対象 0 件は「この回で再点検した記事は無い」という事実だけを示し、未実行や失敗と混ぜない。

HowTo/Speakable の導出、点検履歴 30 件、最終点検から 7 日以上、1 起動 50 件、毎日 `0 17 * * *` の既存値は変えない。実 D1 での所要時間と記事 350 本超の挙動は引き続き未測定である。

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

### 被引用チェックの費用が比例する量

被引用チェック (AEO 系統3) の費用は、**モデルを小さくしても下がらない部分がある。**
2026-09-04 に公式出典を取得して確かめた事実を、設計が前提を取り違えないようここへ置く。

利用者は費用について『コストをできるだけ抑えたい。最小限のllmのモデルでも良い』と述べた
(`qa-neutral-citation-check-v6`)。この意図のうち **実際に効くのはトークン単価の側だけである。**

Anthropic の出典は逐語でこう述べる — 「per 1,000 searches, plus standard token costs for
search-generated content. Web search results retrieved throughout a conversation are counted
as input tokens, in search iterations executed during a single turn and in subsequent
conversation turns.」
(出典: `system-spec/retrieval-evidence/anthropic-web-search-tool.json`)

ここから 3 つが従う。

1. **検索回数の従量とトークン課金は別建てである。**モデルを小さくしても検索 1,000 件あたりの
   課金は下がらない。費用の主たる量は検索回数のほうである。
2. **実効的な制御点は 1 リクエストあたりの検索回数上限である。**同出典は逐語で「max_uses to cap
   the number of searches for each request」と述べる。実装はこの上限を必ず指定する。
3. **検索結果は以後の会話ターンでも入力トークンに数え続けられる。**よって被引用チェックは会話を
   継続させず、1 回の問い合わせで完結させる。判定は「自サイトの URL が引用一覧に含まれるか」と
   いう文字列の照合であり、追加の問い直しを要さないため、この制約で失うものは無い。

問い合わせ先を将来 Gemini へ替える場合、**課金の単位が違う。**Gemini の出典は逐語で「your project
is billed for each search query that the model decides to execute」と述べる
(出典: `system-spec/retrieval-evidence/gemini-google-search-grounding.json`)。Anthropic は
「検索 1,000 件あたり」、Gemini は「モデルが実行を決めた検索クエリごと」であり、見積り式が別になる。

したがって **運営者へ見せる費用の上限は「月あたりの検索回数」という単位にする。**これがどちらの社の
課金単位にも翻訳できる唯一の量である。金額を単位にすると、社を替えたときに設定値の意味が変わる。

**取りこぼしを被引用の不在と読み違えないこと。**max_uses で検索回数を絞ると、自サイトを引用しうる
問い合わせを取りこぼす。取りこぼしは「引用されていない」と区別がつかないため、記録には検索回数上限に
達したかどうかを併せて残す。

- 正本へ入れた理由: qa-neutral-citation-check-v6 の設計適用は『最小限のモデルでよい』を費用抑制の手として置いていたが、2026-09-04 に取得した公式出典 2 件により、検索回数の従量課金はモデルの大小と無関係であることが判明した。利用者の逐語 (answer) にも、対話経路として保護されている design_applications にも足せない事実であり、章の生成節へ書けば compile のたび消える。取得由来の事実が設計の前提を取り違えさせないよう、消えない場所へ置く。

### SEOの現行承認契約（2026-09-06）

同じ現行契約の全文と記録理由は [SEOの現行承認契約（2026-09-06）](database.md) を参照。本章にも同じ契約を適用する。

### Search Console検索語保存と取得範囲（2026-09-06実装確認）

同じ現行契約の全文と記録理由は [Search Console検索語保存と取得範囲（2026-09-06実装確認）](database.md) を参照。本章にも同じ契約を適用する。

### AI被引用チェックの月次検索枠（2026-09-07実装確認）

同じ現行契約の全文と記録理由は [AI被引用チェックの月次検索枠（2026-09-07実装確認）](database.md) を参照。本章にも同じ契約を適用する。

### サイト内の全公開ページ監査（2026-09-07実装確認）

同じ現行契約の全文と記録理由は [サイト内の全公開ページ監査（2026-09-07実装確認）](database.md) を参照。本章にも同じ契約を適用する。

### 静的監査の上限時の継続補足（2026-09-08）

同じ現行契約の全文と記録理由は [静的監査の上限時の継続補足（2026-09-08）](database.md) を参照。本章にも同じ契約を適用する。

### 静的監査の公開境界と容量結果の訂正（2026-09-08）

同じ現行契約の全文と記録理由は [静的監査の公開境界と容量結果の訂正（2026-09-08）](database.md) を参照。本章にも同じ契約を適用する。

### Search Console検索語内訳の管理画面表示（2026-09-08実装確認）

同じ現行データ・実行契約の全文と記録理由は [Search Console検索語内訳の管理画面表示（2026-09-08実装確認）](database.md) を参照。backendにも同じ読取snapshotと部分障害の契約を適用する。

- 正本へ入れた理由: GSC検索語の完成snapshot・再取得状態・上限と選択記事UIを同じ意味へ同期する。旧QA・公開履歴・feature評価と全163仕様のSTALEを保持する。

### 意思決定が本章に効く形

- **`decision-llm-provider` が本章に効く形**: 複数プロバイダを保つのは選択肢を増やすためではなく、07 §0 GC-5 (レビュー系を執筆系から分離し、自作自演の検証にしない) を**書き手と検査役に別モデルを当てる**ことで満たすためである。1 社固定にするとこの分離が構成では表せなくなる。単価は `vars` に置き、値上げに気づける状態を保つ。
- **鍵の扱い**: API 鍵は利用者本人がブラウザまたは別端末で登録する。値も断片もこの作業場所には置かない。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

### 章の規範本文を正本から再生成しない理由

同じ現行契約の全文と記録理由は [章の規範本文を正本から再生成しない理由](auth.md) を参照。本章にも同じ契約を適用する。

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

(2026-09-04 追記: 本節はこの日まで章にだけ在り、`## 章にしか無い記述 (正本へ未接続)` として引き継がれていた。同じ見出しの節が P13 の書き戻しでもう 1 つ生まれ、`##` 単位の引き継ぎが衝突して本節が落ちた。**落ちようのない場所へ移すのが直し方である**ため、正本の `chapter_notes` へ入れた。文面は落ちる前の逐語のままで、この段落だけが追記である。)

- 正本へ入れた理由: 章にだけ在った本節が、P13 の書き戻しで同名の「章にしか無い記述」節が 2 つになった結果、## 単位の引き継ぎが衝突して落ちた。守るのではなく落ちようのない場所へ移す。

### BE-PROSE-01 が前提とする保存形は未確定である

この章の BE-PROSE-01〜03 / BE-PRODUCT-01 / BE-IMAGE-01 は、利用者の逐語（`qa-backend-web-prose-verbatim`）から **AI が導いた受入条件** であり、利用者が逐語で述べた要求そのものではない。導出の対応は次のとおり。

- 利用者の逐語: 「記事を作成する上で必要な情報を全て盛りだくさんに入れておいてほしいです」
- そこから導いた条件: 編集面が扱える断片が、保存形への直列化と保存形からの解析を往復しても失われないこと（BE-PROSE-01〜03）

**BE-PROSE-01 が前提とする保存形の決定は、まだ利用者の確認を受けていない。** `decisions.dec-article-body-storage-format`（記事本文を拡張 Markdown 文字列のまま広げるか、構造化された木として持ち直すか）は `recommended_pending_confirmation` の状態にある。AI 推奨は「拡張 Markdown 文字列のまま広げる」だが、利用者はこの二択を提示されておらず、選んでもいない。

したがって BE-PROSE-01 の受入条件は「往復で断片が失われないこと」までが確定であり、**その往復が拡張 Markdown 上で起きるという前提は未確定**である。保存形が構造化された木へ変わった場合、BE-PROSE-01 の受入条件そのものは生き残るが、記法の衝突検査（BE-PROSE-02）の対象は入れ替わる。

実装に着手する前に、この二択を利用者へ提示して確認を得ること。確認前に保存形を既定として実装すると、未確認の決定が実装によって既成事実になる。

- 正本へ入れた理由: C05 round3 の指摘: BE-PROSE-01 が status=recommended_pending_confirmation の決定に依拠しているのに、規範表にその印が無い。章の手書きでは compile のたび消えるため正本へ置く。

### AI が起草した設計宣言（質疑から移した本文）

以下は **AI が起草した設計宣言**である。利用者が述べた要求ではない。

この本文はもともと質疑 `qa-backend-web-prose-roundtrip-and-product-search` の answer として `spec-state.json` に置かれ、`source.kind=user-dialogue`（＝利用者との対話に由来する）を名乗っていた。しかし内容は設計判断の宣言であり、利用者の発言ではない。独立監査 C06 が「AI 起草の設計宣言が利用者の回答の顔で正本に載っている」としてこれを指摘した。

**内容を捨てるのではなく、居場所を移す。** 設計として要る記述なので章の散文として置き直し、元の質疑は取り下げた（`retracted_qa_log`）。この章のセルが実際に引く裏付けは `qa-backend-web-prose-verbatim` である。

利用者の逐語は `qa-backend-web-prose-verbatim` および同章の「この章の要件 ID を書いたのは誰か」に記録がある。以下の記述で利用者の確認を受けているのは、そこに逐語として載っている範囲だけである。

---

**当初の問い**

> backend×web: 本文断片を 19 種へ増やしても保存形 (拡張 Markdown 文字列) を保つために、往復変換と未知記法の扱い、および商品カードの選択に要る検索をどう定めるか。

**設計宣言の本文**

**保存形は拡張 Markdown 文字列のままにする。**JSON の木へ移さない理由は 3 つある。既存記事のデータが 1 件も壊れない、人が読める、AI が書ける。断片を 9 種足しても、足すのは記法であって保存形ではない。

**往復の不変条件。**`parseProse(serializeProse(nodes)) === nodes` を全 19 種について保証する。新しい記法は、既存の Markdown 記法と衝突しない形で足す。コードブロックは三連バッククォートに言語名、表は既存の Markdown table、それ以外 (image-row / toggle / checklist / embed / cta-button / link-card / columns) は既存の callout や product-card と同じ「ディレクティブ行」の書き方に揃える。1 種類ごとに固有の記法を発明しない。

**未知の記法に出会ったら、落とさず段落へ退避する。**版が進んで新しい記法が入った記事を古い版が読むことは起こりうる。そのとき解釈できない行を捨てると本文が消える。解釈できないものは、書かれた文字列そのままを持つ段落として保持し、保存し直しても元の文字列が戻るようにする。**読めないことと、失ってよいことは違う。**

**商品検索 API。**商品カードで ID を手入力させないため、workspace 内の商品を名前で絞り込む読み取り専用の検索を足す。actor の workspace_id で必ず絞り、他 workspace の商品は 1 件も返さない。返すのはカードの描画に要る最小限 (id / 名称 / 画像 URL / 価格 / リンク) だけで、原価や内部メモは返さない。件数は上限を置き、無制限の全件取得にしない。

- 正本へ入れた理由: C06 round4 の指摘: AI 起草の設計宣言が source.kind=user-dialogue を名乗って正本に載っていた。内容は設計として要るので章の散文へ移し、元の質疑は取り下げる。

### 歴史的スナップショット（現行規範ではない、2026-09-06 移送）

> 既存章にしか存在しなかった規範・受入条件・実装記録の保全移送。以下の本文は移送前のまま保持する。As-Is、Delta、PASS 等の実装・検証記録は本文に記された時点の記録であり、今回の実装完了・本番反映・新しい利用者承認を意味しない。後日の確定判断は本章の現在の質疑録・意思決定・日付付き注記を参照する。

#### 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**実装済み・デプロイ済み・検証済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §1、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

##### As-Is（2026-08-16 のリポジトリ実体）

- Next.js / OpenNext の単一アプリ内に、D1 を直接読む stateless MCP PoC がある。
- MCP PoC は `list_programs`、`record_conversion`、`get_revenue_summary` の3ツールのみ。単一の `MCP_TOKEN` または same-origin 判定で入口を分けるが、利用者主体、Workspace membership、role による認可はない。same-origin は主体認証ではない。
- `record_conversion` は成果を1件追加するだけで、ASP API / CSV の一括取り込み、安定した成果同一性、再取り込みの冪等化、判断・入金の状態履歴はない。現在の単一 `status` は `pending | approved | rejected` のみで、入金状態を表現できない。任意の `external_id` に一意制約もない。
- ClickEvent / BehaviorEvent / Channel Insights の収集、正規化、MetricRollup、Attribution、Insight Engine、Brief への提案は未実装である。
- 記事本文の断片は 10 種で、`parseProse` / `serializeProse` の往復を 19 種で保証する検証はない。未知記法は保持されず落ちる。商品カード挿入のための商品検索 API と、記事画像の署名付き URL を発行する経路はいずれも存在しない。

##### To-Be（規範契約）

| ID | 契約 | 状態 |
|---|---|---|
| BE-ANA-01 | 収集→正規化→集計→分析→活用の責務境界は `docs/spec/03-分析・解析基盤仕様.md` §1–§7 を正本とする。各段は再実行可能な idempotent consumer とし、append-only の入力から同じ rollup を再構築できること | 未実装 |
| BE-CONV-01 | 成果の安定同一性 `conversion_key` は `(workspace_id, affiliate_account_id, import_source, source_record_id)`。source ID がない取込元だけ、状態を除く不変項目から source fingerprint を作る。`import_record_key` は原票1行の canonical hash とし、同一キー再送は no-op、同一 `conversion_key` の新しい原票は承認または支払の状態更新履歴として扱う。現在値は `approval_status ∈ {pending, approved, rejected, cancelled}` と `payment_status ∈ {not_eligible, unpaid, scheduled, paid, reversed}` の二軸で投影し、単一 `status` へ合成しない。`scheduled/paid` は `approval_status=approved` の場合だけ許可する | 未実装 |
| BE-AUTH-01 | UI / REST / WebMCP / backend MCP は共通の use-case 境界を呼び、そこで `actor(type, id) + workspace_id + membership status + role` を認可する。actor と workspace は検証済み session/token から導出し、ツール引数を信用しない | 未実装 |
| BE-MCP-01 | 現行 MCP は接続性検証用 PoC。製品版では BE-AUTH-01 を通る薄い adapter とし、§24.3 の resource/tool 契約、監査、確認必須操作、集計値のみの開示を通常 API と共有する | PoC のみ |
| BE-PROSE-01 | 記事本文の保存形は拡張 Markdown 文字列を維持する (`decisions[].dec-article-body-storage-format`)。構造化 JSON ツリーへ移さない。理由は 3 つ — 公開済み記事のデータが壊れない (移行不要)、DB を直接見て本文が読める、AI が文字列として本文を書ける | 未実装 |
| BE-PROSE-02 | 断片 19 種すべてで `parseProse(serializeProse(nodes)) === nodes` が成り立つ。往復で失われる断片・属性を 0 件にする | 未実装 |
| BE-PROSE-03 | `parseProse` が解釈できない記法は、捨てずに**その文字列を literal に保持する段落**として通す。読めないことと、失ってよいことは違う。未知記法を含む本文を保存し直しても、元の文字列が消えない | 未実装 |
| BE-PRODUCT-01 | 商品カード挿入のための、ワークスペース内商品の読み取り専用検索 API を持つ。返す項目は id / 名称 / 画像 URL / 価格 / リンクに限り、それ以外の商品属性を返さない。`workspace_id` はセッションから導出し、引数を信用しない (BE-AUTH-01 に従う) | 未実装 |
| BE-IMAGE-01 | 記事画像の署名付き URL 発行は backend の use-case 境界を通る。鍵は `workspace_id/記事id/一意なid.拡張子` の形で backend が組み立て、クライアントから受け取った鍵に署名しない | 未実装 |

##### Delta

1. BE-AUTH-01 を先に実装し、すべての repository query に workspace scope を必須化する。
2. BE-CONV-01 の import command、idempotency ledger、判断・入金の状態履歴を実装する。現行 `record_conversion` の無条件 insert と単一 `status` は、移行後に二軸を扱う内部 command へ置換する。
3. BE-ANA-01 を収集・正規化・rollup・分析の順に追加し、同じ KPI 契約を画面/API/MCPで使用する。
4. 最後に BE-MCP-01 を PoC token 依存から actor-scoped credential に移行する。
5. `parseProse` / `serializeProse` を断片 10 種から 19 種へ広げる。保存形は変えないため既存記事の移行は発生しない。追加する記法は既存本文と衝突しないことを、予約記法の衝突検査で先に確かめる。
6. 未知記法の扱いを「落とす」から「literal な文字列を持つ段落として保持する」へ改める。これがないと、新しい記法で書かれた記事を古い版のコードが読んだときに本文が欠ける。
7. 商品検索 API と署名付き URL 発行 API を、いずれも BE-AUTH-01 の use-case 境界の上に追加する。MCP 側にも同じ境界を通した薄い adapter としてのみ露出する。

##### Dependencies

依存方向は `前提 → 後続` とする。

- `DB-IDENTITY-01` / `DB-TENANT-01` + auth 章の session 方針 → BE-AUTH-01。
- `DB-CONVERSION-01` + Commercial D1 + ASPごとの原票正規化規則 → BE-CONV-01。
- `DB-PROJECTION-01` / `DB-KPI-01` + infrastructure の Queue / Cron / Redirect Resolver → BE-ANA-01。
- BE-AUTH-01 + 各 use case → BE-MCP-01。MCP 固有ロジックから DB を直接操作しない。
- `ArticleBlockKind` の節骨格 + 断片カタログ 19 種の定義 → BE-PROSE-01/02/03。frontend の描画部品は本契約の後段であり、断片の種別を frontend 側で新設しない。
- BE-AUTH-01 + database の商品テーブル → BE-PRODUCT-01。
- BE-AUTH-01 + infrastructure の R2 バケットと鍵の並び → BE-IMAGE-01。署名で縛れる範囲は security の SEC-REQ-006/007 に従属する。

##### Acceptance evidence

- 同一取込ファイルを2回処理して成果件数・金額が増えず、後続の `approval_status` / `payment_status` 変更だけが同じ成果へ反映される自動テスト。
- 異なる Workspace の actor が同じ resource ID を指定しても参照・変更できず、role 不足が拒否される API/MCP 共通の認可テスト。
- 生イベントから rollup を全再計算した結果が増分集計と一致する fixture テスト。`approval_status=approved, payment_status=unpaid` では `revenue_approved` のみ、`payment_status=paid` への変更後は `revenue_paid` も計上され、承認報酬が二重加算されないこと。
- MCP の tool call と通常 API が同一 use case / KPI 定義 / 監査記録を使うことを示す contract test。
- **BE-PROSE-02**: 断片 19 種それぞれについて `parseProse(serializeProse(nodes)) === nodes` を検証する往復テスト。19 種すべてを含む 1 本の記事 fixture でも同じ等式が成り立つこと。属性 (コードの言語指定・表の列数・画像の代替テキスト・色トークン) が往復で失われないことを個別に検証した結果を保存。
- **BE-PROSE-03**: 未知の記法 (将来の断片を模した文字列) を含む本文を保存 → 読み出し → 再保存する往復テスト。元の文字列がバイト単位で一致して残り、段落として描かれることを保存。
- **BE-PROSE-01**: 現行の公開済み記事 fixture 全件を新しい `parseProse` で読み、既存の描画結果と差分が出ないことを示す退行テスト。保存形を変えていないため移行スクリプトが存在しないことを併せて記録。
- **BE-PRODUCT-01**: Workspace A のセッションで商品を検索し、B の商品名・画像・価格が結果に含まれないことを示す tenant 越境テスト。返却項目が id / 名称 / 画像 URL / 価格 / リンクの 5 つに限られ、それ以外の属性が response に無いことを schema テストで保存。
- **BE-IMAGE-01**: クライアントが `../` や別 workspace の鍵を指定して署名を要求し、いずれも拒否されるか、backend が組み立てた `workspace_id/記事id/一意なid.拡張子` の鍵でのみ署名が返ることを示す認可テストと、その拒否の監査記録。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 既存章にだけ存在する要件定義表・受入条件とその文脈を、正規writerのchapter_notesへ逐語移送して再生成時の欠落を防ぐ。利用者回答や承認内容は改変せず、過去の実装記録を現在のPASSとして扱わない。

### To-Be（規範契約）

> 2026-09-06 現行規範。旧注記「章の規範本文を正本から再生成しない理由」は superseded とし、その「再生成しない」指示を無効化する。正本 chapter_notes と正規 compiler を唯一の更新経路とする。旧 374 行等の欠落原因・旧方式・過去の実装/PASS 状態は歴史的スナップショットとして保持する。以下は要求であり、実装・受入・remote migration・本番公開の完了を意味しない。

画像関連要件は 2026-09-06 の現行 Worker アップロード・ライフサイクル契約で同 ID を改訂した。旧 direct PUT/CORS/容量・可逆性の規定は歴史記録のみとし適用しない。

| 要件ID | 目標状態 |
|---|---|
| BE-ANA-01 | 収集→正規化→集計→分析→活用の責務境界は `docs/spec/03-分析・解析基盤仕様.md` §1–§7 を正本とする。各段は再実行可能な idempotent consumer とし、append-only の入力から同じ rollup を再構築できること |
| BE-CONV-01 | 成果の安定同一性 `conversion_key` は `(workspace_id, affiliate_account_id, import_source, source_record_id)`。source ID がない取込元だけ、状態を除く不変項目から source fingerprint を作る。`import_record_key` は原票1行の canonical hash とし、同一キー再送は no-op、同一 `conversion_key` の新しい原票は承認または支払の状態更新履歴として扱う。現在値は `approval_status ∈ {pending, approved, rejected, cancelled}` と `payment_status ∈ {not_eligible, unpaid, scheduled, paid, reversed}` の二軸で投影し、単一 `status` へ合成しない。`scheduled/paid` は `approval_status=approved` の場合だけ許可する |
| BE-AUTH-01 | UI / REST / WebMCP / backend MCP は共通の use-case 境界を呼び、そこで `actor(type, id) + workspace_id + membership status + role` を認可する。actor と workspace は検証済み session/token から導出し、ツール引数を信用しない |
| BE-MCP-01 | 現行 MCP は接続性検証用 PoC。製品版では BE-AUTH-01 を通る薄い adapter とし、§24.3 の resource/tool 契約、監査、確認必須操作、集計値のみの開示を通常 API と共有する |
| BE-PROSE-01 | 記事本文の保存形は拡張 Markdown 文字列を維持する (`decisions[].dec-article-body-storage-format`)。構造化 JSON ツリーへ移さない。理由は 3 つ — 公開済み記事のデータが壊れない (移行不要)、DB を直接見て本文が読める、AI が文字列として本文を書ける |
| BE-PROSE-02 | 断片 19 種すべてで `parseProse(serializeProse(nodes)) === nodes` が成り立つ。往復で失われる断片・属性を 0 件にする |
| BE-PROSE-03 | `parseProse` が解釈できない記法は、捨てずに**その文字列を literal に保持する段落**として通す。読めないことと、失ってよいことは違う。未知記法を含む本文を保存し直しても、元の文字列が消えない |
| BE-PRODUCT-01 | 商品カード挿入のための、ワークスペース内商品の読み取り専用検索 API を持つ。返す項目は id / 名称 / 画像 URL / 価格 / リンクに限り、それ以外の商品属性を返さない。`workspace_id` はセッションから導出し、引数を信用しない (BE-AUTH-01 に従う) |
| BE-IMAGE-01 | 記事画像は同一生成元の Worker API と共通 use-case 認可境界を通る。workspace と記事の編集権限を検証し、鍵はサーバーが article-images/workspace_id/article_id/一意なid.拡張子として生成する。pending 予約→R2 put→ready 確定を経て利用可能とし、クライアント指定鍵や署名付き直接 PUT を受け付けない。 |

- 正本へ入れた理由: 現行要件表を正本へ接続。旧再生成禁止 note を superseded とし、画像契約は現行実装・確定判断に同期。

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

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/backend.md`](applied/backend.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| drizzle-orm | 0.45.2 | Drizzle Team (orm.drizzle.team) | https://orm.drizzle.team/docs/overview | 2026-08-16T09:01:52Z | 2026-08-22T22:20:35Z |
| anthropic-claude | 現行 active モデル (claude-fable-5-1 / claude-opus-5 / claude-sonnet-5 / claude-haiku-4-5-20251001) | Anthropic (platform.claude.com) | https://platform.claude.com/docs/en/models/overview | 2026-09-02T08:19:13Z | 2026-09-02T08:19:13Z |
| openai-platform | gpt-6-astra | OpenAI (developers.openai.com) | https://developers.openai.com/api/docs/models | 2026-09-04T13:41:59Z | 2026-09-04T13:41:59Z |
| google-gemini | Gemini 3 系 (gemini-3.8-flash / gemini-3.7-flash / gemini-3.6-flash / gemini-3.5-flash / gemini-3.1-pro-preview) | Google (ai.google.dev) | https://ai.google.dev/gemini-api/docs/models | 2026-09-02T21:20:17Z | 2026-09-02T21:20:17Z |
| google-search-console-api | 2026-08-11 | Google (developers.google.com) | https://developers.google.com/webmaster-tools/v1/searchanalytics/query | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |
| anthropic-web-search-tool | web_search_20260318 | Anthropic (platform.claude.com) | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool | 2026-09-03T20:57:54Z | 2026-09-03T21:02:59Z |
| gemini-google-search-grounding | Gemini 3.8 Flash | Google (ai.google.dev) | https://ai.google.dev/gemini-api/docs/google-search.md.txt | 2026-09-03T20:57:55Z | 2026-09-03T20:57:55Z |
