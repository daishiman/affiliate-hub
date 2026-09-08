---
status: confirmed
category: backend
aggregate: 確定
spec_cells: [backend.web, backend.mobile, backend.tablet, backend.desktop-windows, backend.desktop-linux, backend.desktop-macos]
serves_goals: [G2, G1]
---

# バックエンド (backend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-seo-approved-diff-20260906。裏付け質疑 (`qa_refs`): `qa-neutral-search-method-v6`, `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-auto-scope-v6`, `qa-neutral-citation-check-v6`, `qa-answer-aeo-feasibility-v6`, `qa-decision-aeo-data-sources-v5`, `qa-backend-web-blog-creation-atomicity`, `qa-backend-web-spec-intake`, `qa-backend-web`, `qa-backend-web-analytics`, `qa-backend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

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

## 意思決定 (decisions)

> **本章を主担当とする論点だけ**を載せる。全 8 件の一覧・候補比較・推奨根拠は [`00-requirements-definition.md`](./00-requirements-definition.md) にある。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 |

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
| openai-platform | gpt-6-astra | OpenAI (developers.openai.com) | https://developers.openai.com/api/docs/models | 2026-09-03T21:46:11Z | 2026-09-03T21:46:11Z |
| google-gemini | Gemini 3 系 (gemini-3.8-flash / gemini-3.7-flash / gemini-3.6-flash / gemini-3.5-flash / gemini-3.1-pro-preview) | Google (ai.google.dev) | https://ai.google.dev/gemini-api/docs/models | 2026-09-02T21:20:17Z | 2026-09-02T21:20:17Z |
| google-search-console-api | 2026-08-11 | Google (developers.google.com) | https://developers.google.com/webmaster-tools/v1/searchanalytics/query | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |
| anthropic-web-search-tool | web_search_20260318 | Anthropic (platform.claude.com) | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool | 2026-09-03T20:57:54Z | 2026-09-03T21:02:59Z |
| gemini-google-search-grounding | Gemini 3.8 Flash | Google (ai.google.dev) | https://ai.google.dev/gemini-api/docs/google-search.md.txt | 2026-09-03T20:57:55Z | 2026-09-03T20:57:55Z |

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

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.backend.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | backend × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-seo-approved-diff-20260906` |
| 資するゴール (serves_goals) | G2, G1 |
| required-info | `domain-model` — missing_effect: block / 接地: 済 (`qa-backend-web-spec-intake`) |
| 出典 kind | written-requirements |
| 出典 path | `docs/spec/04-二層構造統合仕様.md` |
| 出典 節 | §3 WebMCP の確定契約 / §4 禁止依存 |
| 出典 sha256 | `101ad27f5bf796c7180815bd2d1e582f9378b645c5aea9e9f1d65330af27b6ef` |
| 適用された設計知識 (design_applications) | 10 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 章にしか無い記述 (正本へ未接続)

> 以下の 10 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-backend-web-site-search-llms-txt-v4b (対応セル: web)`, `##### 確定内容 qa-backend-web-site-search-llms-txt-v4b (対応セル: web)`, `### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 確定内容 qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`, `### 章にしか無い記述 (正本へ未接続)`, `##### qa-backend-web-site-search-llms-txt-v4b (対応セル: web)`, `##### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `##### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### qa-backend-web-site-search-llms-txt-v4b (対応セル: web)

**質問**: backend×web: 読者向け全文検索の提供方式と、AIO 向け llms.txt・OGP 自動生成の生成責務をどう要件化するか。直前の qa-backend-web-site-search-llms-txt-v4 は日本語トークナイザを『bigram 系』としたが実在しないため、trigram を前提に設計解釈を正す（2026-09-03 公式ドキュメント照合による訂正）

**回答**: 検索とかも含めて、このトップページを分析・解析を行った上で、それを反映してブログを構築できるように修正してください。／それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）検索方式は D1 の FTS5 全文検索。AIO は目次のみ（llms.txt）を出し AI学習は許可。画像が無い記事は自動生成の OGP 画像で埋める。

##### 確定内容 qa-backend-web-site-search-llms-txt-v4b (対応セル: web)

- 確定要件: 検索とかも含めて、このトップページを分析・解析を行った上で、それを反映してブログを構築できるように修正してください。／それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）検索方式は D1 の FTS5 全文検索。AIO は目次のみ（llms.txt）を出し AI学習は許可。画像が無い記事は自動生成の OGP 画像で埋める。
- 設計解釈の記録経路: `dialogue`
- 原則: 検索は問い合わせ条件を明示した読み取り専用の資源として設計し、結果の順序と打ち切り条件を呼び出し側から観測できるようにする (`ref-system-design-knowledge:api-design-patterns`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイトの検索は WordPress の `?s=` を SearchAction として宣言していた (system-spec/retrieval-evidence/kajetblog-top-analysis.md 第5節)。本システムは Cloudflare Workers + D1 構成のため外部検索サービスを増やさず、D1 の FTS5 (trigram トークナイザ) を単一の検索経路とする。検索 API は問い合わせ語・対象ブログ・件数・継続位置を明示的に受け、公開済み記事だけを対象とし、順序 (関連度→新しさ) と打ち切り件数を応答に含める。trigram は3文字未満の問い合わせを最適化できないため、2文字以下の検索語は索引経由にせず題名の前方一致で応じ、その事実を応答で区別できるようにする。SearchAction の target はこの検索経路の URL と一致させ、宣言と実装を分岐させない。llms.txt は公開済み記事の目次として同じ読み取り経路から生成し、OGP 画像は記事保存時に画像が無い場合だけ自動生成して保存する
  - トレードオフ:
    - 検索方式を trigram の部分一致に寄せると形態素解析より無関係な一致が増えるため、関連度に加えて公開日の新しさを従属順位に置き、上位の実用性を保つ
    - llms.txt を公開済み記事の全件目次にすると記事数の増加に比例して肥大するため、生成は逐次ではなく更新契機での再生成とし、応答は静的配信する
    - AI 向けの目次を出すと本文への流入が減る可能性があるが、利用者は目次のみ提供・AI学習許可を選択したため、全文 (llms-full.txt) は出さない
- 原則: 外部から与えられた入力は境界で検証し、公開してよい範囲だけを応答に載せる (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 検索語は外部入力であり、FTS5 の問い合わせ構文として解釈されうる。問い合わせ語は構文記号を含めて literal として束縛し、任意の FTS 構文を通さない。検索対象は公開済み・非削除の記事に限定し、下書き・予約公開・非公開ブログの本文が検索経由で漏れないことを既定とする。llms.txt も同じ公開判定を通し、AI 学習許可は公開済み範囲に対してのみ宣言する
  - トレードオフ:
    - 問い合わせ語を literal 化すると利用者が AND/OR などの高度な検索構文を使えなくなるが、読者向けの主要タスクは語句一致であり、構文開放より漏洩防止を優先する
    - 検索語の長さと件数に上限を課すと極端に長い問い合わせが打ち切られるため、打ち切りを応答で明示して黙って結果を減らさない

> 以下の 4 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 確定内容 qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)

**質問**: backend×web: AEO/SEO の分析を 3 系統で収集し、その結果を自動で記事へ反映する経路を、どう要件化するか。直前の qa-backend-web-aeo-analysis-pipeline-v5 は反映を『提案を作るところで必ず止まる』設計としていたが、2026-09-03 の対等提示による再確認で自動反映へ変わり、対象範囲が次回以降の記事に限定され、被引用チェックの費用制約が加わったため差し替える。あわせて AI 向け表現物が目次のみから全文 + WebMCP へ変わったことを反映する

**回答**: （対等提示での再確認）機械が自動で反映し事後通知／次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て／コストをできるだけ抑えたい。最小限のllmのモデルでも良い／llms-full.txt ＋ WebMCP の両方／D1 の FTS5 全文検索

### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 検索最適化の分析結果を、ブログへどう反映しますか。(a) 提案を出し、運営者が承認して反映 — 公開中の本文や宣言が書き手の確認を経ずに書き換わることがない。承認の記録が残り、後から反映の理由を辿れる。反映の速度が運営者の作業量で律速し、明らかに直すべき所見も承認されなければ放置されうる。(b) 機械が自動で反映し事後通知 — 運営者の手数が最小で、所見が放置されない。一方で機械が公開中の本文と宣言を書き換えるため、書き手の意図した表現が壊れうる。公開後に取り消しても検索側の記録は元に戻らない。(c) 表示するだけで反映機構は作らない — 実装量が最も少なく、誤った自動変更のリスクがゼロ。分析結果を見ても直す作業は全て手作業になるため、所見と実際の記事のあいだが人の手でしか埋まらない。（2026-09-03 AskUserQuestion『反映方法』。独立監査 C06 が qa-decision-aeo-application-mode-v5 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者の選択は前回の (a) から (b) へ変わった）

**回答**: 機械が自動で反映し事後通知

##### 確定内容 qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)

- 確定要件: （対等提示での再確認）機械が自動で反映し事後通知／次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て／コストをできるだけ抑えたい。最小限のllmのモデルでも良い／llms-full.txt ＋ WebMCP の両方／D1 の FTS5 全文検索
- 設計解釈の記録経路: `dialogue`
- 原則: 由来の違う情報を、同じものとして扱わない (`ref-system-design-knowledge:ddd`)
  - 採否: `applied`
  - 章固有の根拠: 3 系統は再現性が根本的に違う。系統1 (サイト内静的解析) は自分のデータだけで完結し何度でも同じ結果が出る。系統2 (Google Search Console) は外部が持つ値で遅れて確定し後から訂正される。系統3 (AI 検索での被引用) は問い合わせた瞬間の観測で同じ問いでも次は違う答えが返る。これらを 1 つの『分析結果』として混ぜると最も弱い系統の性質が全体の信頼度になる。よって 3 系統は収集の層で分けたまま持ち、自動反映の根拠にできるのは再現する系統1 だけとする。系統2・系統3 は反映の後で何が動いたかを見る材料に留める。反映が自動になったことでこの区別は前より重要になった — 承認制なら運営者が根拠の弱さを見て止められたが、自動反映では止める人がいないため、根拠にしてよい系統を型の側で限る
  - トレードオフ:
    - 系統2・系統3 を自動反映の根拠から外すと『順位が落ちた記事を機械が直す』が成立しない。実績の面から静的解析の所見へ辿る導線だけをつなぎ、運営者が手で判断する余地を残す
    - 3 系統を分けて持つと収集の実装が 3 本になる。共通化して 1 本にすると由来の区別が実装の中で失われるため、分けたまま持つ
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 自動反映の経路は、記事を書き換える前に必ず変更前の状態を記録し、1 操作で戻せる形にしてから書き換える。記録が取れなければ書き換えを実行しない (記録の失敗を無視して先へ進まない)。対象は記事の作成時刻がこの仕組みの導入時刻より後の記事に限り、それ以前の記事は所見を提示するに留めて書き換えない。この境界は機械が判定できる値で引き、運用の心がけに委ねない。範囲内では本文・題名・画像を含む全要素を対象とし、要素の種類では線を引かない。反映の実行後は何をどう変えたかを運営者へ通知するが、通知は可逆性の担保ではなく気づきの手段として扱う
  - トレードオフ:
    - 変更前の状態を毎回記録すると保存量が増える。取り消せる期間を定め、期間を過ぎた記録は要約へ畳む
    - 記録に失敗したとき書き換えを行わない設計は、記録側の障害が反映を全て止めることを意味する。反映は緊急性の無い処理なので、止まって困る性質のものではない
- 原則: 外部へ払う費用と外部から受け取る秘密は、実装ではなく運用の側に置く (`ref-system-design-knowledge:site-reliability-engineering`)
  - 採否: `applied`
  - 章固有の根拠: 系統2 と系統3 は外部サービスへの問い合わせを伴い、認証情報と費用が発生する。認証情報は運営者が Cloudflare の画面または wrangler から登録し、リポジトリ・環境変数ファイル・コマンド引数・ログのいずれにも現れない。系統3 の費用は問い合わせ回数に比例するため、新しい契約先を増やさず既に使っている AI 基盤の最小モデルを用い、実行の契機を記事の公開時と週次の 2 つに限る。被引用の判定は自サイトの URL が引用一覧に含まれるかという文字列の照合であって文章の理解を要さないため、最小モデルで足りる。費用の上限は運営者が画面から変えられるようにし、実装の中に固定しない
  - トレードオフ:
    - 低頻度の収集では AI 検索面の変化への追随が遅れる。被引用は日単位で動く指標ではないため、失われる情報は少ないと判断する
    - 認証情報を運営者の手に委ねると、登録されるまで系統2・系統3 が動かない。系統1 は外部依存が無いため、認証情報が未登録でも分析と自動反映は成立する形にする

##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-neutral-application-mode-v6` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 推奨表示を外して再提示したところ選択が (a) 承認制 から (b) 自動反映 へ反転した。前回の qa-decision-aeo-application-mode-v5 は『取り消しの効かない変更は人の判断を挟まずに実行させない』という原理を適用していたが、対等な提示のもとで利用者は自動反映を選んだ。設計原理は決定を正当化する道具であって決定を決める権限を持たないため、原理の適用先を『承認を課す』から『承認が無い状態を安全にする』へ移す。承認という事前の関門が無くなったぶん、事後の可逆性が唯一の防御になる — よって反映は必ず差分として記録され、1 操作で元へ戻せ、何がいつなぜ変わったかが運営者へ通知される。この 3 つが揃わない反映経路を実装として持たない。可逆性が担保できない種類の変更 (外部へ出た後の表現物など) は、この経路の対象から外し qa-neutral-auto-scope-v6 の範囲制限で扱う
  - トレードオフ:
    - 自動反映は運営者の手数を最小にする代わりに、書き手の推敲した表現が機械の都合で書き換わりうる。差分履歴と取り消しで元へ戻せる形にして受け止める
    - 事後通知は読まれない前提で設計する必要があるため、通知を見逃しても後から変更の一覧を辿れる面を用意し、通知そのものを可逆性の担保にしない

### 章にしか無い記述 (正本へ未接続)

> 以下の 2 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-backend-web-site-search-llms-txt-v4b (対応セル: web)`, `##### 確定内容 qa-backend-web-site-search-llms-txt-v4b (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

##### qa-backend-web-site-search-llms-txt-v4b (対応セル: web)

**質問**: backend×web: 読者向け全文検索の提供方式と、AIO 向け llms.txt・OGP 自動生成の生成責務をどう要件化するか。直前の qa-backend-web-site-search-llms-txt-v4 は日本語トークナイザを『bigram 系』としたが実在しないため、trigram を前提に設計解釈を正す（2026-09-03 公式ドキュメント照合による訂正）

**回答**: 検索とかも含めて、このトップページを分析・解析を行った上で、それを反映してブログを構築できるように修正してください。／それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）検索方式は D1 の FTS5 全文検索。AIO は目次のみ（llms.txt）を出し AI学習は許可。画像が無い記事は自動生成の OGP 画像で埋める。

####### 確定内容 qa-backend-web-site-search-llms-txt-v4b (対応セル: web)

- 確定要件: 検索とかも含めて、このトップページを分析・解析を行った上で、それを反映してブログを構築できるように修正してください。／それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）検索方式は D1 の FTS5 全文検索。AIO は目次のみ（llms.txt）を出し AI学習は許可。画像が無い記事は自動生成の OGP 画像で埋める。
- 設計解釈の記録経路: `dialogue`
- 原則: 検索は問い合わせ条件を明示した読み取り専用の資源として設計し、結果の順序と打ち切り条件を呼び出し側から観測できるようにする (`ref-system-design-knowledge:api-design-patterns`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイトの検索は WordPress の `?s=` を SearchAction として宣言していた (system-spec/retrieval-evidence/kajetblog-top-analysis.md 第5節)。本システムは Cloudflare Workers + D1 構成のため外部検索サービスを増やさず、D1 の FTS5 (trigram トークナイザ) を単一の検索経路とする。検索 API は問い合わせ語・対象ブログ・件数・継続位置を明示的に受け、公開済み記事だけを対象とし、順序 (関連度→新しさ) と打ち切り件数を応答に含める。trigram は3文字未満の問い合わせを最適化できないため、2文字以下の検索語は索引経由にせず題名の前方一致で応じ、その事実を応答で区別できるようにする。SearchAction の target はこの検索経路の URL と一致させ、宣言と実装を分岐させない。llms.txt は公開済み記事の目次として同じ読み取り経路から生成し、OGP 画像は記事保存時に画像が無い場合だけ自動生成して保存する
  - トレードオフ:
    - 検索方式を trigram の部分一致に寄せると形態素解析より無関係な一致が増えるため、関連度に加えて公開日の新しさを従属順位に置き、上位の実用性を保つ
    - llms.txt を公開済み記事の全件目次にすると記事数の増加に比例して肥大するため、生成は逐次ではなく更新契機での再生成とし、応答は静的配信する
    - AI 向けの目次を出すと本文への流入が減る可能性があるが、利用者は目次のみ提供・AI学習許可を選択したため、全文 (llms-full.txt) は出さない
- 原則: 外部から与えられた入力は境界で検証し、公開してよい範囲だけを応答に載せる (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 検索語は外部入力であり、FTS5 の問い合わせ構文として解釈されうる。問い合わせ語は構文記号を含めて literal として束縛し、任意の FTS 構文を通さない。検索対象は公開済み・非削除の記事に限定し、下書き・予約公開・非公開ブログの本文が検索経由で漏れないことを既定とする。llms.txt も同じ公開判定を通し、AI 学習許可は公開済み範囲に対してのみ宣言する
  - トレードオフ:
    - 問い合わせ語を literal 化すると利用者が AND/OR などの高度な検索構文を使えなくなるが、読者向けの主要タスクは語句一致であり、構文開放より漏洩防止を優先する
    - 検索語の長さと件数に上限を課すと極端に長い問い合わせが打ち切られるため、打ち切りを応答で明示して黙って結果を減らさない

> 以下の 4 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 確定内容 qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

##### qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)

**質問**: backend×web: AEO/SEO の分析を 3 系統で収集し、その結果を自動で記事へ反映する経路を、どう要件化するか。直前の qa-backend-web-aeo-analysis-pipeline-v5 は反映を『提案を作るところで必ず止まる』設計としていたが、2026-09-03 の対等提示による再確認で自動反映へ変わり、対象範囲が次回以降の記事に限定され、被引用チェックの費用制約が加わったため差し替える。あわせて AI 向け表現物が目次のみから全文 + WebMCP へ変わったことを反映する

**回答**: （対等提示での再確認）機械が自動で反映し事後通知／次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て／コストをできるだけ抑えたい。最小限のllmのモデルでも良い／llms-full.txt ＋ WebMCP の両方／D1 の FTS5 全文検索

##### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 検索最適化の分析結果を、ブログへどう反映しますか。(a) 提案を出し、運営者が承認して反映 — 公開中の本文や宣言が書き手の確認を経ずに書き換わることがない。承認の記録が残り、後から反映の理由を辿れる。反映の速度が運営者の作業量で律速し、明らかに直すべき所見も承認されなければ放置されうる。(b) 機械が自動で反映し事後通知 — 運営者の手数が最小で、所見が放置されない。一方で機械が公開中の本文と宣言を書き換えるため、書き手の意図した表現が壊れうる。公開後に取り消しても検索側の記録は元に戻らない。(c) 表示するだけで反映機構は作らない — 実装量が最も少なく、誤った自動変更のリスクがゼロ。分析結果を見ても直す作業は全て手作業になるため、所見と実際の記事のあいだが人の手でしか埋まらない。（2026-09-03 AskUserQuestion『反映方法』。独立監査 C06 が qa-decision-aeo-application-mode-v5 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者の選択は前回の (a) から (b) へ変わった）

**回答**: 機械が自動で反映し事後通知

####### 確定内容 qa-backend-web-aeo-analysis-pipeline-v6 (対応セル: web)

- 確定要件: （対等提示での再確認）機械が自動で反映し事後通知／次回以降の記事全般・文章・タイトル・画像など、記事を構成する全て／コストをできるだけ抑えたい。最小限のllmのモデルでも良い／llms-full.txt ＋ WebMCP の両方／D1 の FTS5 全文検索
- 設計解釈の記録経路: `dialogue`
- 原則: 由来の違う情報を、同じものとして扱わない (`ref-system-design-knowledge:ddd`)
  - 採否: `applied`
  - 章固有の根拠: 3 系統は再現性が根本的に違う。系統1 (サイト内静的解析) は自分のデータだけで完結し何度でも同じ結果が出る。系統2 (Google Search Console) は外部が持つ値で遅れて確定し後から訂正される。系統3 (AI 検索での被引用) は問い合わせた瞬間の観測で同じ問いでも次は違う答えが返る。これらを 1 つの『分析結果』として混ぜると最も弱い系統の性質が全体の信頼度になる。よって 3 系統は収集の層で分けたまま持ち、自動反映の根拠にできるのは再現する系統1 だけとする。系統2・系統3 は反映の後で何が動いたかを見る材料に留める。反映が自動になったことでこの区別は前より重要になった — 承認制なら運営者が根拠の弱さを見て止められたが、自動反映では止める人がいないため、根拠にしてよい系統を型の側で限る
  - トレードオフ:
    - 系統2・系統3 を自動反映の根拠から外すと『順位が落ちた記事を機械が直す』が成立しない。実績の面から静的解析の所見へ辿る導線だけをつなぎ、運営者が手で判断する余地を残す
    - 3 系統を分けて持つと収集の実装が 3 本になる。共通化して 1 本にすると由来の区別が実装の中で失われるため、分けたまま持つ
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 自動反映の経路は、記事を書き換える前に必ず変更前の状態を記録し、1 操作で戻せる形にしてから書き換える。記録が取れなければ書き換えを実行しない (記録の失敗を無視して先へ進まない)。対象は記事の作成時刻がこの仕組みの導入時刻より後の記事に限り、それ以前の記事は所見を提示するに留めて書き換えない。この境界は機械が判定できる値で引き、運用の心がけに委ねない。範囲内では本文・題名・画像を含む全要素を対象とし、要素の種類では線を引かない。反映の実行後は何をどう変えたかを運営者へ通知するが、通知は可逆性の担保ではなく気づきの手段として扱う
  - トレードオフ:
    - 変更前の状態を毎回記録すると保存量が増える。取り消せる期間を定め、期間を過ぎた記録は要約へ畳む
    - 記録に失敗したとき書き換えを行わない設計は、記録側の障害が反映を全て止めることを意味する。反映は緊急性の無い処理なので、止まって困る性質のものではない
- 原則: 外部へ払う費用と外部から受け取る秘密は、実装ではなく運用の側に置く (`ref-system-design-knowledge:site-reliability-engineering`)
  - 採否: `applied`
  - 章固有の根拠: 系統2 と系統3 は外部サービスへの問い合わせを伴い、認証情報と費用が発生する。認証情報は運営者が Cloudflare の画面または wrangler から登録し、リポジトリ・環境変数ファイル・コマンド引数・ログのいずれにも現れない。系統3 の費用は問い合わせ回数に比例するため、新しい契約先を増やさず既に使っている AI 基盤の最小モデルを用い、実行の契機を記事の公開時と週次の 2 つに限る。被引用の判定は自サイトの URL が引用一覧に含まれるかという文字列の照合であって文章の理解を要さないため、最小モデルで足りる。費用の上限は運営者が画面から変えられるようにし、実装の中に固定しない
  - トレードオフ:
    - 低頻度の収集では AI 検索面の変化への追随が遅れる。被引用は日単位で動く指標ではないため、失われる情報は少ないと判断する
    - 認証情報を運営者の手に委ねると、登録されるまで系統2・系統3 が動かない。系統1 は外部依存が無いため、認証情報が未登録でも分析と自動反映は成立する形にする

####### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-neutral-application-mode-v6` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 推奨表示を外して再提示したところ選択が (a) 承認制 から (b) 自動反映 へ反転した。前回の qa-decision-aeo-application-mode-v5 は『取り消しの効かない変更は人の判断を挟まずに実行させない』という原理を適用していたが、対等な提示のもとで利用者は自動反映を選んだ。設計原理は決定を正当化する道具であって決定を決める権限を持たないため、原理の適用先を『承認を課す』から『承認が無い状態を安全にする』へ移す。承認という事前の関門が無くなったぶん、事後の可逆性が唯一の防御になる — よって反映は必ず差分として記録され、1 操作で元へ戻せ、何がいつなぜ変わったかが運営者へ通知される。この 3 つが揃わない反映経路を実装として持たない。可逆性が担保できない種類の変更 (外部へ出た後の表現物など) は、この経路の対象から外し qa-neutral-auto-scope-v6 の範囲制限で扱う
  - トレードオフ:
    - 自動反映は運営者の手数を最小にする代わりに、書き手の推敲した表現が機械の都合で書き換わりうる。差分履歴と取り消しで元へ戻せる形にして受け止める
    - 事後通知は読まれない前提で設計する必要があるため、通知を見逃しても後から変更の一覧を辿れる面を用意し、通知そのものを可逆性の担保にしない

- 正本へ入れた理由: 章の生成節の内側へ手で書かれており、compile のたび消えていた散文。内容は正本から導けないため、消えようのない場所へ移した (2026-09-08 / ah-lwmf)。
