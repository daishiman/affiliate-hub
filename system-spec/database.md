---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1, G2, G3]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-audit-history-window-p13-v3。裏付け質疑 (`qa_refs`): `qa-database-web-blog-provisioning-integrity`, `qa-database-web-blog-builder`, `qa-database-web-spec-intake`, `qa-database-web`, `qa-database-web-analytics`, `qa-database-web-aeo-analysis-storage-v4` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | database × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database-web-audit-history-window-p13-v3` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`database`) を主担当とする **2 件**。全 12 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 |
| `dec-analysis-history-retention` | AEO/SEO 解析の結果履歴を D1 にどう保持するか。最新だけを持つのか、推移を追えるよう履歴を積むのか、積むならどこで打ち切るのか。 | `opt-append-with-window` | confirmed | G3, G2 |

- **`decision-editorial-commercial-split` の caveat**: 既存テーブルの引っ越しが 1 回必要で、その回だけは本番データを触る / DB をまたぐ集計はアプリ側の突合になるため、突合のテストを先に書く / 分けたあとも、Commercial の値を関数の引数として渡せば混ざる。バインディングの分離は「うっかり」を防ぐが「意図」は防がない

- **`dec-analysis-history-retention` の caveat**: 保持件数・保持期間の具体値は本セッションで根拠を持たない。実際にどれだけの期間を比較したいか (施策の効果が現れるまでの期間) を決めてから設定すること。根拠なく数値を確定しないこと / 刈り取りの失敗は容量が伸びるだけで画面に何も現れない。刈り取りの最終実行時刻と削除件数を記録し、確認できるようにすること / 解析ロジックのバージョンを各行へ記録すること。記録しないと、スコアの変化が記事の改善によるのか解析側の変更によるのか区別できず、履歴が比較に使えなくなる / 根拠として引用した Cloudflare D1 と Drizzle は取得済みの入口ページで、無料枠の具体的な容量上限は本セッションで再取得していない。保持件数を決める際に公式資料で再確認すること

## 確定内容 (質疑録)

### qa-database-web-audit-history-window-p13-v3 (対応セル: web)

**質問**: database×web: 点検履歴と定期再点検の最新実行状態を D1 にどう分けて保存し、workspace 境界と状態整合を保証するか (P13 書き戻し・v3)。

**回答**: 記事単位の点検履歴は既存 0044 の `ai_search_audit_history` に保持し、記事ごと直近 30 件、追記と刈り取りを同一トランザクション、記事への外部キー無しという規則は変えない。刈り取り単体の実行マーカーは不要だが、それは cron 全体の成否を記録しないという意味ではない。

0044 を編集せず、0045 で SEO 再点検専用の `ai_search_reaudit_runs` を追加する。これは履歴を無限に追記する表ではなく、1 workspace に直近の最終状態 1 行を上書き保存する投影である。`workspace_id` を主キーとして `workspaces.id` へ外部キーを持ち、管理画面の取得 SQL は必ず actor の `workspace_id` で絞る。

`status` は `succeeded | partial | failed`、`failure_code` は `target_list_unavailable | article_audit_failed | null`。非負整数と `scanned = recorded + failed`、完了時刻が開始時刻以上、status・failure code・件数の正しい組み合わせを D1 CHECK 制約で保証する。時刻は UTC epoch 秒の integer timestamp で、`started_at` と `completed_at` を持つ。実行結果に自由文や秘匿情報は保存しない。

0045 適用時に過去の cron を推定して backfill せず、初期は「未実行」と読む。次の cron 完了後に初めて最終状態と時刻が入る。巻き戻しは 0045 の表を先に落とし、その後に必要なら 0044 を落とす。記事本体は変更しない。

### qa-database-web-blog-provisioning-integrity (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 13問のウィザードで作ったブログが読者側で404になる。作成が書き切るべき保存の境界と、サブドメイン割り当てに必要な保存項目は何か。

**回答**: 原因は作成が site_blueprints 1表しか書かないこと。公開判定 (resolvePublicSiteIdentity) は site_blueprints に加えて site_network_nodes に active かつ未削除の行がちょうど1件あることを要求するため、作成後も読者側は null 解決となり404になる。したがって新規作成を create-only の Unit of Work とし、source_draft_id と source_draft_revision の DB claim、site_blueprints、active network node、8 種の固定ページ draft、既定 bands/slots、下書き完了、作成監査を 1 回の D1 batch で逐次実行する。site_drafts は秒精度時刻ではなく単調 revision を持ち、保存は expected revision の CAS、作成は current revision の trigger 検証で stale request を拒否する。カテゴリーは blueprint JSON を正本とし、別表へ複製しない。1 ステップでも失敗すれば全体を巻き戻す。公開表示は enabled bands/slots、provisioningComplete は保存済みの全 provisioned bands/slots を同じ投影で数える。reader hostname は永続化せず、slug と環境ごとの SITE_BASE_DOMAIN から実行時に一意に導出する。既存行の hostname backfill と slug 変更時の追随書き込みは持たない。

### qa-database-web-blog-builder (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: ブログテンプレート・テーマ・固定ページ・ブログ×アフィリエイト対応の永続化をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録)。参考ブログ https://makuring.jp/ は構成のみ参考にし、文章・素材は転用しない。同サイトの機械取得は本セッションで拒否されたため、構成の一次根拠は利用者の説明とする。

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
#### database 章への反映方針
- 追加エンティティ: blog_template (セクション構成の宣言データ)、blog_theme (デザイントークン集合、ブログ既定)、page_theme_override (ページ単位の配色上書き)、legal_page (固定ページ種別と本文、ブログ単位)、blog_affiliate_placement (ブログ/記事×アフィリエイト案件の反映対応)。
- 既存 32 エンティティ (Site/Brand/Article/Offer 等) を拡張し、複製しない。テンプレート・テーマは version を持ち、公開済みブログが参照する版を固定できる。
- 保存先は既存 D1 (Drizzle) を継続する。

- (注記: 正本 qa_log[qa-database-web-blog-builder].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-database-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: SiteBlueprint はどのパラメータを持ち、どの検証で BLOCK するか (書面入力 docs/spec/06 §2)

**回答**: | BP-01 | `ranking_model_id` が他サイトの Blueprint と重複しない | BLOCK（§16.6 言い換え記事の防止） |
| BP-02 | `ranking_inputs_prohibited` に報酬関連フィールドが全件含まれる | BLOCK（§19.4） |
| BP-03 | `audience_persona_ids` が1件以上 | BLOCK |
| BP-04 | `disclosure_policy_id` が実在する Disclosure を指す | BLOCK |

### qa-database-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: データベース (database) × web の技術要件は何か (2026-08-16 対話ヒアリング)

**回答**: 現行構成で確定。技術基盤は現行リポジトリの構成(Next.js + Cloudflare Workers/OpenNext + D1 + Drizzle ORM)を正として仕様に確定する。

### qa-database-web-analytics (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: 集計層 MetricRollup のスキーマと再計算方針は何か (書面入力 docs/spec/03 §5)

**回答**: #### 5. 集計層(MetricRollup)

```yaml
metric_rollup:
  date: date
  grain: day
  dimensions:                       # §3 の組み合わせ(正規化キー)
    channel: string | null
    angle: string | null
    placement: string | null
    audience_persona_id: string | null
    # ... 任意の組み合わせ
  measures:
    impressions: number
    link_impressions: number
    clicks: number
    conversions_pending: number
    conversions_approved: number
    revenue_pending: number
    revenue_confirmed: number
    pv: number
    read_through: number
```

* 日次バッチ + 直近分の準リアルタイム加算(ダッシュボードは「本日分は速報」表示)
* 成果の状態変化(pending→approved等)は対象日のロールアップを遡って再計算
* 高カーディナリティ組み合わせは事前集計せず、生イベントへのアドホック集計で対応(集計セット定義はバージョン管理)

- (注記: 正本 qa_log[qa-database-web-analytics].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-database-web-aeo-analysis-storage-v4 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: AEO/SEO 解析結果とガイドライン参照レジストリ、および記事の機械可読要素の素材 (alt・出典・FAQ・手順・著者) をどこにどう保存するか。2026-09-03 利用者ヒアリング。

**回答**: 既存の確定 (qa-database-web-blog-provisioning-integrity) の原則 — 正本を1か所に置き、別表へ複製しない — をそのまま適用する。

#### 記事の機械可読要素の素材
結論・要点・比較表・FAQ・手順・出典・著者/監修者・画像の alt と寸法・装飾画像の宣言は、記事本体の保存実体 (published_articles の記事 JSON) の中に持つ。構造化データ用の別表を作らない。別表にすると、記事を直したのに構造化データが古いまま残る状態が生まれる。

#### 解析結果
解析結果は記事単位・実行時刻付きの履歴として保存する。最新1件だけを上書き保存しない。上書きすると「直したのに直っていない」のか「判定が変わった」のかを後から区別できない。保存する内容は判定項目ごとの3値 (充足/不足/対象外)・不足時の該当箇所・判定に使った規則の版。記事本文は複製せず参照で持つ。

#### ガイドライン参照レジストリ
発行元・URL・確認日・要約を保存する。要約は取得した文章の複製ではなく、こちらで書いた要約であることを明示する。

#### テナント境界
解析結果とレジストリはワークスペースで区切る。読者向けの読み取り (記事一覧・本文・検索・カテゴリー・人物) はサイト単位で区切る既存の方針を維持し、解析結果を読者経路から読まない。

- (注記: 正本 qa_log[qa-database-web-aeo-analysis-storage-v4].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)

`feat-blog-ui-builder` (P01〜P12) の実装で確定したデータモデルを記録する。
定義の正本は `src/db/schema.ts` である。**ここは正本の写しではなく、
なぜその形なのかと、実装で分かった未解決の欠陥を書く。**

### 1. 確定した 6 表

| 表 | 一意性 | 作業場所索引 | 役割 |
|---|---|---|---|
| `blog_template` | `site_slug` | `(workspace_id, site_slug)` | 1 ブログ 1 テンプレート |
| `blog_theme` | `site_slug` | `(workspace_id, site_slug)` | 1 ブログ 1 配色 |
| `page_theme_override` | `(site_slug, page_path)` | `(workspace_id, site_slug)` | ページ単位の配色例外 |
| `legal_page` | `(site_slug, kind)` | `(workspace_id, site_slug, kind)` | 固定ページ 8 種 |
| `blog_affiliate_placement` | なし (複数可) | `(workspace_id, site_slug)` | 記事 × 掲載位置 |
| `guideline_references` | なし | `(workspace_id)` | SEO/AI 指針の出典 |

**確定した契約 — `workspace_id` を全表が列として持つ。**
`site_slug` から `site_blueprints` を辿れば所有は分かるが、それでは足りない。

- slug の一意性は `site_blueprints` の索引 1 本が支えているだけで、
  **作業場所ごとに slug を再利用したくなった日に黙って崩れる**
- 経由の確認は**書き手が正しく書いた場合しか効かない**。
  列は、誰が次の問い合わせを書いても外せない床になる

**1 本のクエリが単体で作業場所に絞れること**を表の側で持つ
(`tests/architecture/tenant-scoped-schema.test.ts` が検査する)。

**確定した契約 — 索引の 1 段目は必ず `workspace_id`。**
`site_slug` 始まりの索引しか無いと、絞り込みの過程で他所の行まで読む。

**確定した契約 — 一意性は `site_slug` のままにする (作業場所を跨がない)。**
「1 ブログ 1 配色」という制約そのものは作業場所と無関係だからである。

### 2. 「上書きが無い」を NULL でなく行の不在で表す

`page_theme_override` は、行を消すとブログ既定へ戻る。
NULL 値で「上書きなし」を表すと、「上書きしていない」と
「上書きの結果 NULL になった」が区別できなくなる。

同じ理由で `legal_page` の不在は「未整備」であり、既定文を出さない。
**見本の文を本物として配らない。**

### 3. `guideline_references` — 確認日と取得時刻を別の列で持つ

| 列 | 何を表すか |
|---|---|
| `checked_at` | 要旨を読んで確認した日 (YYYY-MM-DD) |
| `source_fetched_at` | 原典の本文を取得した時刻 (ISO 8601)。null は未取得 |
| `source_sha256` | 取得した本文の指紋 |
| `previous_source_sha256` | 1 つ前の指紋。これと違えば指針が書き換わっている |
| `re_evaluated_sha256` | **この本文版について仕様の再評価を完了した指紋** |

**確定した契約 — 再取得だけでは `re_evaluated_sha256` を動かさない。**
取得と再評価は別の事実である。1 列にまとめると、
「取ってきたが読んでいない」状態を機械が持てなくなる。

**確定した契約 — 出典そのものの本文は保存しない。**
古くなった写しを正本に見せないためである。指紋だけを持つ。

90 日の判定は `src/domain/seo/guideline-reference.ts` の
`referenceReviewStatus` だけが行う。表は日付を持つだけで、判定は持たない。

### 4. 未解決の欠陥 (2026-08-30 時点)

#### 4.1 🔴 `workspace_id` の migration が未コミット

`blog_theme` と `page_theme_override` の `workspace_id` は
`src/db/schema.ts` に定義済みだが、対応する migration
(`drizzle/0040_serious_madelyne_pryor.sql`) が生成済み・**未コミット**である。

**このまま本番へ出すと、D1 に列が無いのにコードは列があるつもりで問い合わせ、
配色の保存も読み出しも実行時に落ちる。**

`pnpm run verify` の「マイグレーションの作り忘れ」検査は
`git status --porcelain drizzle` を見るので、生成しただけでは緑にならない。
**この検査は「生成できるか」ではなく「コミットに入っているか」を見ている。**
生成だけで緑になると、CI は通るのにデプロイで落ちる状態が作れてしまう。

#### 4.2 🔴 `legal_page` を 2 系統の語彙が触っている

同じ表を `SiteDocumentKey` (9 種) と `FixedPageKind` (8 種) が触っている。
`site-document-repository.ts` が写像してから書く形になっているが、
写像表 `KEY_TO_KIND` は **9 鍵中 4 鍵しか持たない**。
残る 5 行は永久に「未記入」として扱われる。

同居させると、同じ 1 枚を 2 つの画面が別の行として作り、
**後から書いたほうが黙って勝つ。**

加えて永続層に 3 件の欠陥がある。

1. `save()` が `status` を書かない → 新規が `draft` のまま `[fixedPage]` に永遠に出ない
2. `findSiteDocument()` が `deleted_at` を見ない → 論理削除した行が読める
3. `findSiteDocument()` が `workspace_id` で絞らない → **作業場所の越境**

3 は §1 で列を足した目的そのものが達成されていない箇所である。
**列があることと、クエリがそれを使うことは別である。**

実測では 18 経路のうち 12 経路が 404
(`docs/spec/feat-blog-ui-builder/evidence/11-a4-a13-http-status.txt`)。

#### 4.3 ⚠️ 書き込みが操作の記録に届かない

`createManageBlogAppearanceUseCase` (配色の保存) と
`createReviewBlogPlacementsUseCase` (掲載の増減) の書き込みが、
操作の記録に届いていない (`pnpm run verify` の「つなぎ目の呼び出し」検査が検出)。

**掲載の増減は金銭に直結するため、いつ・誰が・何を消したかを
後から機械で追えない状態は出す前に直すものである。**

- 正本へ入れた理由: feat-blog-ui-builder P01〜P12 で確定した 6 表のデータモデル (workspace_id を列として持つ理由・索引順・行の不在で状態を表す設計) と、実装で判明した未解決の欠陥 3 件を正本へ記録する。章へ直接書くと compile で消えるため。

### migration の未コミットを解消 — feat-blog-ui-builder リリース (P13、2026-08-31)

同章の「実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)」§4.1 で
🔴 として記録した「`workspace_id` の migration が未コミット」は、**本リリース commit で解消した。**
前の記録は消さずに残す。消すと「一度この状態で出そうとしていた」という事実が引けなくなる。

### 解消した内容

`drizzle/0040_serious_madelyne_pryor.sql` と `drizzle/meta/0040_snapshot.json` を
リリース commit に含めた。これで `pnpm run verify` の
「マイグレーションの作り忘れ」検査 (`git status --porcelain drizzle` を見る) が緑になる。

**この検査が見ているのは「生成できるか」ではなく「commit に入っているか」である。**
生成だけで緑になる設計だと、CI は通るのにデプロイで落ちる状態が作れてしまう。
今回はまさにその状態が 1 日残っていた。

### 0040 が壊れ方を選んでいる形

`workspace_id` の埋め戻しは、親 `site_blueprints` から所有が一意に決まらない行があると
**schema 変更より前に停止する**。停止のさせ方は、`CHECK (workspace_backfill = 0)` を持つ
guard 表へ `SELECT count(*) ... HAVING count(*) > 0` を INSERT する形である。

- 孤児が 0 件 → 行が 1 つも挿入されず、そのまま通る
- 孤児が 1 件でもある → CHECK 違反で migration 全体が落ちる

**「所有者不明の行を空文字で埋めて先へ進む」を、書き方の約束ではなく DB の制約で不可能にしてある。**
guard 表は `CREATE TABLE IF NOT EXISTS` + 先頭の `DELETE` なので、
失敗したあとの再実行でも同じ判定をやり直せる。列だけ追加された半端な状態を作らない。

固定ページ (`legal_page`) の `kind` 語彙統合も同じ形で守っている。
移行先の無い旧 `kind` が残っていれば止まり、`profile` と `company` が同じ site に両方あれば
（どちらを `operator` として残すか決める根拠が無いので）止まる。**後勝ちで本文を捨てない。**

### 残る 🔴 / ⚠️ は解消していない

§4.2 (`legal_page` を 2 系統の語彙が触っている / 18 経路中 12 経路が 404) と
§4.3 (配色の保存と掲載の増減が操作の記録に届かない) は**本リリースの範囲外で、開いたままである。**
`dev` 環境へ出すのは、この 2 件が開いていることを承知の上での MVP としてである。
本番 (`main`) へ進める前に §4.3 を先に閉じること — 掲載の増減は金銭に直結し、
いつ・誰が・何を消したかを後から機械で追えない状態を本番に置くべきではない。

- 正本へ入れた理由: 同章 §4.1 が 🔴『migration が未コミット』と記録した状態を本リリース commit で解消したため、正本を現状に一致させる。前の記録は消さず差分として足す。

### 書き込みが操作の記録に届かない状態を解消 — feat-blog-ui-builder リリース (P13、2026-08-31)

同章の「実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)」§4.3 で
⚠️ として記録した「書き込みが操作の記録に届かない」は、**本リリース commit で解消した。**
前の記録は消さずに残す。消すと「一度この状態で出そうとしていた」という事実が引けなくなる。

### 解消した内容

`createManageBlogAppearanceUseCase`（見せ方の選択・ブログ既定の配色・ページ上書きの
保存と取り消しの 4 操作）と `createReviewBlogPlacementsUseCase`（掲載の足し引き）が、
書き込みのたびに `audit_log` へ 1 行残すようにした。
`pnpm run verify` の「つなぎ目の呼び出し」検査は
**届いていない 0（上限 0）・判定できない 0（上限 0）** で緑になっている。

足した語は 3 つである。

| 語 | 残すもの |
|---|---|
| `blog_appearance.changed` | 見せ方と配色の 4 操作。差は `targetType` と `after` に出す |
| `blog_placement.changed` | 記事のどこに成果リンクを載せたか |
| `blog_placement.removed` | 記事のどこから外したか |

### なぜ掲載だけ「足す」と「外す」を分けたか

台帳 `blog_affiliate_placement` の行は**外すと物理削除される**（所在の記録であって
履歴ではない、という表そのものの設計である）。つまり
**外した事実が残る場所は `audit_log` しかない。**
1 語にまとめると「掲載が消えている」を差分から読むことになるが、
消えた行の差分は消えているので読めない。

外した内容は `before` ではなく `after` に平文で並べている。台帳から引き直せない以上、
記録の側が「どの記事のどの位置から、どのコードの掲載が消えたか」を単独で言えるべきである。

### 見た目の変更にも記録が要ると判断を変えた理由

`manage-blog-appearance.ts` は当初「配色とテンプレートは読者の目に映るだけで、
法令上の主張を 1 つも含まない」として記録を書いていなかった。**この理由は誤りではないが、
足りなかった。**記録が要るのは法令上の主張があるときだけではない。

見た目は**上書きで消える設定**である。誰かが配色を変えた翌日に「読みにくくなった」と
言われても、変える前の値はどこにも残っていない。枠の並び (`blog_layout.changed`) は
残していて配色だけ残さないのは一貫していなかった——後から読む人にとって問いは同じ
（「そのとき読者に何がどう見えていたか」）である。

### 記録が書けなかったときは「変えました」で終わらせない

保存は済んだが `audit_log` へ書けなかったとき、**保存を取り消さない。**
取り消すと、押した人には「効かなかった」と見えるのに保存先には残っている、という
別の食い違いを新しく 1 つ作ることになる。返すのは
`auditWriteFailure`（済んだことと、残っていないことを両方その場で書く断り）である。

### ポートの名前を 1 つ変えた

`BlogAppearancePort.selectTemplate` を `saveTemplate` へ改名した。
`scripts/port-wiring.mjs` が読み書きを判定できずに止まったためで、
語彙表へ `select` を足して黙らせることもできたが、**それをすると将来の読み取り手続きが
黙って書き込み扱いになる**（SQL の `SELECT` は読みの語である）。名前の側を直した。

### 残る 🔴 は §4.2 のみ

§4.2（`legal_page` を 2 系統の語彙が触っている / 18 経路中 12 経路が 404）は
**開いたままである。**本番 (`main`) へ進める前に閉じること。

- 正本へ入れた理由: 同章 §4.3 が ⚠️『配色の保存と掲載の増減が操作の記録に届かない』と記録した状態を本リリース commit で解消したため、正本を現状に一致させる。前の記録は消さず差分として足す。

### 意思決定が本章に効く形

正本 `decisions[]` の一覧と状態は `00-requirements-definition.md` が正本から生成する。
**ここには表を写さない。**写した表は正本が動いても追従せず、2026-09-04 まで
「全 7 件」と書かれたまま残った (実際には 12 件) のがその実例である。

- **`decision-editorial-commercial-split` が本章に効く形**: 「報酬額をランキングの
  入力にしない」という禁止を、コードの中ではなく **D1 を 2 本に分ける**位置で
  担保する。越えるには設定を書き換えるしかなくなり、越えた事実が差分に残る。
- **`dec-analysis-history-retention` が本章に効く形** (2026-09-04 確定、
  `opt-append-with-window`): 解析結果は上書きせず追記する。上書きすると「施策の
  前後で何が変わったか」が原理的に取れず、AEO/SEO の改善が効いたのかを判定する
  手段が消える。無制限に貯めないのは D1 の無料枠が有限だからで、**保持件数・
  保持期間の具体値は本決定では確定しない** — 施策の効果が現れるまでの期間を
  決めてから設定する。
- **各行に解析ロジックのバージョンを記録する。**これが無いと、判定基準を変えた
  前後の行が同じ土俵に並び、実際にはロジックが変わっただけの差を「改善」と
  読み違える。刈り取り (retention) は、この列を持つ行を古い順に消す形で実装する。
- **編集用と商用の分離は解析履歴にも及ぶ。**解析結果は編集判断の入力なので、
  報酬データと同じ本に置かない。

- 正本へ入れた理由: 各章の手書き意思決定表は正本 decisions[] の写しで、件数が 7 のまま古びていた。表は 00-requirements-definition.md が正本から生成するので削る。削れない章固有の突き合わせ (この決定が本章にどう効くか) を正本へ移し、compile の純関数出力として復元されるようにする。

### 章の規範本文を正本から再生成しない理由

**2026-09-04 追記**: `## 確定セルの記録` そのものは、この日から compile が正本 `matrix` / `qa_log` から描く (手写しを 15 日続けた結果、2 度腐ったため)。
**以下の 3 つの実測が指しているのは、その表ではなく章の規範本文である。**
「章を丸ごと再生成して正本の本文で置き換える」を採らない理由として、そのまま生きている。

C05 gaps[0] は「8 章 + 00 を再生成して確定セル内容と decisions[] を本文へ載せる」と書いているが、**再生成も本文複製もしない**。理由は 3 つあり、どれも読んで判断したのではなく測った結果である。次に読む人が善意で「正本に合わせる」と、下に書いた退行が起きる。**この節はそのために置いてある。**

**理由 1: 再生成すると章の規範本文が消える。** compile 出力と本番章を突き合わせた結果、章にあって生成器にも正本にも無い行が `system-spec/*.md` 10 枚で **374 回出現**した (分母 = 10 枚の空行を除く全行)。同じ行をファイル内で畳むと **366 行**、10 枚を横断して畳むと **316 行**。3 つの数はすべて正しく、数えている対象が違うだけである (出現回数 / ファイル内一意 / 全体一意)。消えるのは To-Be 契約表 (`DB-*` / `BE-*` / `INF-*` / `*-REQ-*` / `*-ACC-*`)、故障モード、初期 SLO、Acceptance evidence、index の状態軸。

**理由 2: 正本の回答は章より古い。** 章と正本の両方に現れうるトークン 9 個で照合した (分母 = 照合トークン 9 個)。

| トークン | 正本 `qa-database-web-spec-intake` の回答 | `system-spec/database.md` |
|---|---|---|
| `conversions_pending` | 1 | 0 |
| `conversions_approved` | 1 | 0 |
| `revenue_confirmed` | 1 | 0 |
| `conversions_decision_pending` | 0 | 2 |
| `conversions_settlement_paid` | 0 | 2 |
| `revenue_approved` | 0 | 4 |
| `revenue_paid` | 0 | 4 |
| `approval_status` | 0 | 7 |
| `payment_status` | 0 | 5 |

上 3 行は正本にしかない**旧名**、下 6 行は章にしかない**現行名**である。つまり `MetricRollup` の列名について**正本のほうが古い**。正本の本文を章へ複製すると列名が旧名へ戻る。「正本が新しい」という前提が成り立たない以上、複製は同期ではなく退行になる。

**理由 3: 章が名指す確定質疑が正本の `qa_ref` と食い違っていた。** 8 カテゴリ中 **7 件で不一致**、一致は auth のみだった (分母 = `coverage_matrix` の web セル 8 件)。章側は `qa-*-analytics` / `qa-*-web` を、正本側は `qa-*-spec-intake` を名指していた。本節と `## カテゴリ別収集状態` の Web 行は**正本の値を正**として書き直した。章側の旧 ID が指していた質疑録の本文は `## 確定内容 (質疑録)` にそのまま残してあり、**消していない** (理由 2 のとおり、章側の本文のほうが新しいため)。

以上より gaps[0] は、**本文を増やさず「確定の根拠がどこにあるか」を章に載せる**形で実行した。正本の所在は 2 つに分かれる — **規範本文の正本は章、確定セルの状態の正本は `spec-state.json`**。食い違ったら、本節の表は `spec-state.json` を正とし、規範本文は章を正とする。

- 正本へ入れた理由: 確定セルの記録を compile 生成へ移したため、その節の内側に手で書かれていた散文が 次の再生成で消える。散文が守っているのは「章の規範本文を正本で置き換えない」という 判断で、これは今も生きている。消えようのない場所 (正本) へ移して compile に描かせる。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |
| reliability | 引用可 | 第 4 章 Service Level Objectives (https://sre.google/sre-book/service-level-objectives/) / 第 6 章 Monitoring Distributed Systems (https://sre.google/sre-book/monitoring-distributed-systems/) / 第 24 章 Distributed Periodic Scheduling with Cron (https://sre.google/sre-book/distributed-periodic-scheduling/) / 第 26 章 Data Integrity: What You Read Is What You Wrote (https://sre.google/sre-book/data-integrity/) |

- **reliability の引用範囲**: 取得済みなのは目次 (table of contents) のみ。引用根拠にできるのは『その章が存在すること・章番号・章題・正規 URL』まで。章本文は未取得のため、章の中の主張を要約して要件文の根拠にすることはできない。それをやると、取得していない内容を出典に帰属させることになる (C05 が実在しない日付 2026-07-03 を公式表明値として書いたのと同じ形)。

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

#### 本章での適用

##### 確定内容 qa-database-web-audit-history-window-p13-v3 (対応セル: web)

- 確定要件: 記事単位の点検履歴は既存 0044 の `ai_search_audit_history` に保持し、記事ごと直近 30 件、追記と刈り取りを同一トランザクション、記事への外部キー無しという規則は変えない。刈り取り単体の実行マーカーは不要だが、それは cron 全体の成否を記録しないという意味ではない。

0044 を編集せず、0045 で SEO 再点検専用の `ai_search_reaudit_runs` を追加する。これは履歴を無限に追記する表ではなく、1 workspace に直近の最終状態 1 行を上書き保存する投影である。`workspace_id` を主キーとして `workspaces.id` へ外部キーを持ち、管理画面の取得 SQL は必ず actor の `workspace_id` で絞る。

`status` は `succeeded | partial | failed`、`failure_code` は `target_list_unavailable | article_audit_failed | null`。非負整数と `scanned = recorded + failed`、完了時刻が開始時刻以上、status・failure code・件数の正しい組み合わせを D1 CHECK 制約で保証する。時刻は UTC epoch 秒の integer timestamp で、`started_at` と `completed_at` を持つ。実行結果に自由文や秘匿情報は保存しない。

0045 適用時に過去の cron を推定して backfill せず、初期は「未実行」と読む。次の cron 完了後に初めて最終状態と時刻が入る。巻き戻しは 0045 の表を先に落とし、その後に必要なら 0044 を落とす。記事本体は変更しない。
- 設計解釈の記録経路: `dialogue`
- 原則: 記事の監査履歴とジョブの最新健全性投影を、異なるライフサイクルとして分ける (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 記事点検は過去 30 回の比較に要る追記履歴、run-state は今の運用健全性に要る直近 1 行である。同じ表に混ぜず、後者だけを workspace 主キーで上書きする
  - トレードオフ:
    - 過去の cron 実行の推移は run-state 表からは読めないが、そのための汎用イベント基盤は作らない
    - workspace 行を物理削除する前に run-state の扱いも決める必要があるため、現行どおり workspace は削除ではなく停止で扱う
- 原則: 観測状態自体にも、成功と失敗を取り違えない制約を置く (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 対象 0 件成功と対象取得失敗が同じ 0 件に見えないよう status と固定 failure code を分け、件数と時刻を CHECK 制約で結び付ける
  - トレードオフ:
    - 状態語彙を増やす際は domain 型、migration 制約、表示を同時に変更する必要がある
##### 接地根拠 qa-database-web-blog-provisioning-integrity (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-blog-provisioning-integrity` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Aggregate — 強い invariant を一 transaction で守る整合性境界。外部変更は aggregate root を経由する (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 新規作成の invariant は site_blueprints 1 表では表せない。source draft id + monotonic revision claim / active network node / 8 種の固定ページ draft / 既定 bands と slots / 下書き完了 / 作成監査をひとつの整合性境界として扱い、D1 batch で逐次実行する。CAS と trigger で stale create/save を明示的な conflict にする。カテゴリーは blueprint JSON が正本である。provisioningComplete は全 provisioned layout を含む作成責務を検証し、enabled layout の表示や、公開固定ページと article を要求する contentReady とは分離する
  - トレードオフ:
    - 境界を広げるぶん 1 回の作成が触る表が増える。D1 batch に収まらない規模になったら境界の引き直しを再検討する
    - 既存の site_blueprints 単独行 (site_network_nodes を持たない過去データ) は invariant を満たさないため、移行で補填するか公開対象外として明示的に落とす必要がある
- 原則: Boundary data — 境界を跨ぐ値は内側に都合のよい単純な model とし、DB row を持ち込まない (`clean-architecture.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: reader hostname は site_blueprints に保存せず、slug の一意制約と環境ごとの SITE_BASE_DOMAIN から siteHostname の 1 か所で導出する。ホスト解決の結果はアプリ内側へ『どのブログか』という単純な identity として渡し、middleware が D1 の row 形状を presentation 層へ持ち出さない
  - トレードオフ:
    - hostname を永続化しないため追随書き込みは不要。slug を変更すると次の request から導出住所が変わるので、旧住所の転送方針は別途明示する
    - hostname のデータ移行は不要であり、既存行も現在の SITE_BASE_DOMAIN と slug から同じ規則で住所を導出する
- 原則: 観測可能性 — 稼働中の実体を外部から確認でき、症状から原因へ辿れる状態を保つ (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 『作成済みと表示されたのに 404』は、症状 (404) から原因 (site_network_nodes 不在) へ辿る手段が保存値の側に無いために起きた。作成直後に『公開に必要なのに無い実体』を機械が数えられるよう、公開必須要素の充足を保存値から判定できる形で持つ
  - トレードオフ:
    - 充足判定を保存値から導出する以上、公開必須要素の定義を増やすたびに判定側も更新が要る。定義の正本を 1 か所に置かないと判定が実体から遅れる
- 原則: Projection — 編集 aggregate と公開読み取りモデルの責務を分け、状態遷移の境界で一貫して投影する (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: articles は編集 aggregate に限定し、published_articles を唯一の canonical public projection とする。ブログ運用由来の行は source_article_id で既存 articles.id を追跡し、公開・更新・非公開化・論理削除・復元と projection/墓標更新を同じ D1 batch に含める。公開 reader は articles を直読せず、一覧・本文・検索・カテゴリー・人物・SEO・composition を PublishedContentPort の同一集合から導く。新規公開は blueprint のカテゴリーを明示選択し、旧カテゴリー欠落は任意の分類を推測せず uncategorized（未分類）として公開継続する
  - トレードオフ:
    - projection を原子的に保つため公開境界の repository が触る表は増える。通常の下書き保存は境界外のままにし、公開状態を跨ぐ操作と公開中記事の復元だけを Unit of Work に含める
    - 既存データに所有者不一致や曖昧な site/slug がある場合は推測で結ばず、forward migration を fail-fast で止める
##### 接地根拠 qa-database-web-blog-builder (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-blog-builder` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Aggregate 境界: Blog を root にテンプレート/テーマ/固定ページ/アフィリエイト配置を集約する (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 『見える・作る・保存する・一覧する』の 4 面で同じブログ×アフィリエイト対応を参照するため、blog_affiliate_placement を Blog 集約下に置き、Offer (アフィリエイト案件) は既存 Commercial 境界を参照のみとする
  - トレードオフ:
    - テンプレート/テーマに version を持たせると公開済みブログの参照固定が要り、移行時の二重管理が発生する
    - 既存 32 エンティティへ 5 エンティティを追加するため、データモデル基盤 feature との整合レビューが必要
##### 接地根拠 qa-database-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-spec-intake` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: SiteBlueprint はウィザード 13 ステップと 1 対 1 で対応するパラメータ集合であり、blueprint_id と version を持ち変更時にインクリメントする (`docs/spec/06-サイトブループリント-記事構成テンプレート.md#§2`)
  - 採否: `applied`
  - 章固有の根拠: Blueprint を 1 テーブルの版付きレコードとして持ち、Site から version 付きで参照する。ステップの追加はパラメータの追加として表現し、別テーブルを増やさない
  - トレードオフ:
    - 1 レコードが大きくなるが、ウィザードの並びと保存形が一致し対応の追跡が容易になる
- 原則: BP-01〜BP-06 の検証規則。BP-01（ranking_model_id のサイト間重複）と BP-02（報酬関連フィールドが ranking_inputs_prohibited に全件含まれる）は BLOCK (`docs/spec/06-サイトブループリント-記事構成テンプレート.md#§2-1`)
  - 採否: `applied`
  - 章固有の根拠: 検証をアプリ層だけに置かず、ranking_model_id には一意制約を張る。BP-02 は報酬関連フィールドの一覧を 1 箇所に持ち、差集合が空でなければ保存を拒否する
  - トレードオフ:
    - Blueprint の保存が失敗しやすくなるが、言い換え記事と報酬由来の順位づけを保存の時点で止められる
##### 接地根拠 qa-database-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Workspace IDによる全データのテナント分離 (`docs/spec/01-要求仕様書-v1.0.md §26.4`)
  - 採否: `applied`
  - 章固有の根拠: 全テーブルに workspace_id を保持し、リポジトリ層でオブジェクト単位認可を強制する。キャッシュ・検索インデックス・ファイルストレージも分離する
  - トレードオフ:
    - クエリごとに workspace_id 条件が必須となり、漏れは情報漏えいに直結するため共通データアクセス層で機械的に強制する
- 原則: Editorial / Commercial データベース分離 (`docs/spec/01-要求仕様書-v1.0.md §19.4`)
  - 採否: `applied`
  - 章固有の根拠: 商品評価・検証(Editorial)と報酬・成果(Commercial)をスキーマ分離し、Ranking Service は Editorial のみ参照可能にする
  - トレードオフ:
    - 物理分離により横断集計は分析基盤(MetricRollup)経由となり即時 JOIN はできない
- 原則: D1 + Drizzle ORM によるサーバーレスSQL (現行リポジトリ構成) (`cloudflare:d1-drizzle`)
  - 採否: `applied`
  - 章固有の根拠: 利用者が現行構成を正と確定。drizzle/ ディレクトリと wrangler.jsonc が実在し移行コストが最小
  - トレードオフ:
    - D1 にはDBサイズ・書き込みスループット上限があり、ClickEvent 等の大量イベントは集計特化ストア(Workers Analytics Engine 等)への分離を Phase 3 までに判断する
##### 接地根拠 qa-database-web-analytics (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-analytics` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 日次グレインのロールアップを正とし、成果状態変化 (pending→approved) は対象日を遡って再計算する (`docs/spec/03-分析・解析基盤仕様.md#§5`)
  - 採否: `applied`
  - 章固有の根拠: D1 (SQLite) に metric_rollup テーブルを Drizzle スキーマで定義し、workspace_id 必須のテナント分離を全イベント/集計テーブルに強制する。ClickEvent/BehaviorEvent は append-only、ip_hash は 90 日で削除
  - トレードオフ:
    - 高カーディナリティ組み合わせを事前集計しないため、アドホック分析はレイテンシが増えるが、D1 の容量とコストを抑えられる
- 原則: Editorial Database と Commercial Database を分離し、成果・報酬データは Commercial 側のみに格納する (`docs/spec/03-分析・解析基盤仕様.md#§2`)
  - 採否: `applied`
  - 章固有の根拠: Conversion/ClickEvent/MetricRollup は Commercial 系スキーマに置き、Editorial 側から参照不可にする (v1.0 §19.4 の物理的強制)
  - トレードオフ:
    - スキーマが二系統になり管理コストが増えるが、法令・信頼性要件を構造で担保できる
##### 接地根拠 qa-database-web-aeo-analysis-storage-v4 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-aeo-analysis-storage-v4` を参照
- 設計解釈の記録経路: `secondary_ref_attachment` (`attach-qa-design-applications`)
- 原則: 正本を1か所に置き、別表へ複製しない (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 回答は既存の確定 qa-database-web-blog-provisioning-integrity の原則をそのまま引き、機械可読要素の素材 (結論・要点・比較表・FAQ・手順・出典・著者・alt と寸法・装飾宣言) を記事本体の保存実体の中に持ち、構造化データ用の別表を作らないと定めている。理由も回答自身が述べている — 別表にすると、記事を直したのに構造化データが古いまま残る状態が生まれる。これは dec-structured-data-emission で配信時導出を選んだ判断と同じ根拠に立っている
  - トレードオフ:
    - 記事 JSON が持つ項目が増え、記事1件あたりの保存サイズが伸びる。別表へ切り出せば個々は小さくなるが、記事と構造化データがずれる状態を許すことになるため採らない
    - FAQ・手順・出典のように記事によって有無が変わる項目を記事 JSON へ持つため、項目の追加・改名が記事全件へ影響する。素材の項目設計を実装着手前に固める必要がある
- 原則: いつの時点の判定かを常に言えるようにする (`cloudflare:d1-drizzle`)
  - 採否: `applied`
  - 章固有の根拠: 解析結果を記事単位・実行時刻付きの履歴として保存し、最新1件だけの上書きにしない。回答が挙げる理由は、上書きすると『直したのに直っていない』のか『判定が変わった』のかを後から区別できなくなることである。判定に使った規則の版を各行へ持たせるのは、この区別を成立させるための最小の情報であり、dec-analysis-history-retention の caveat と同じ内容を保存側から要求している
  - トレードオフ:
    - 履歴を積むため行数が記事数×解析回数で伸びる。dec-analysis-history-retention で保持件数の上限を設けることで上限付きに抑えるが、上限を超えた過去は失われる
    - 記事本文を複製せず参照で持つため、記事が後から改稿されると過去の判定が『どの本文に対する判定だったか』を復元できない。規則の版は残るが本文の版は残らない
- 原則: 境界は保存の側で区切り、読み取り経路の判断に委ねない (`secure-by-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 解析結果とガイドライン参照レジストリをワークスペースで区切り、読者向けの読み取り (記事一覧・本文・検索・カテゴリー・人物) はサイト単位で区切る既存方針を維持している。2つの区切りが別の軸である点が重要で、運営の内部評価をテナント境界に、読者に見せる内容をサイト境界に置くことで、読者経路から解析結果へ到達する経路そのものを作らない
  - トレードオフ:
    - 境界の軸が2つになるため、どちらの境界で区切るべきかを新しい表を足すたびに判断する必要がある。単一の境界に揃える方が単純だが、運営の内部評価と読者向け内容を同じ軸で区切ると、片方を緩めたときにもう片方まで緩む
    - レジストリの要約をこちらで書いた要約と明示するため、原文の複製で済ませられない。取得元の文章をそのまま保存する方が手間は少ないが、複製の可否という別の判断を持ち込むことになる
- 資するゴール: G1, G2, G3

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1 | 2026-04-30 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |

## 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**スキーマ適用済み・データ移行済み・分離検証済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §2 / §5、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

### As-Is（2026-08-16 のリポジトリ実体、Phase 1 マージ後）

- 環境ごとに D1 binding `DB` が1つある。運営者ドメインは `asps`、`programs`、`conversions` の3テーブル。読者ドメインは Phase 1 で `categories`、`people`、`disclosures`、`products`、`articles`、`article_people`、`article_products`、`conversation_blocks` 等を追加した。両ドメインは同一 D1 に同居するが、コードコメントと `docs/spec/data-model-gap.md` で分離を宣言している。
- 全テーブルに `workspace_id` がなく、actor / Workspace / membership / role / consent の永続化もない。D1 自体に行レベル認可はないため、現状はテナント分離を満たさない。
- `conversions.external_id` は任意かつ非一意で、単一 `status` は `pending | approved | rejected` の判断現在値だけ。取込原票、冪等性、判断履歴、`cancelled`、独立した入金状態を保持しない。
- ClickEvent、BehaviorEvent、MetricRollup、KPI辞書、`content_analytics_projection`、outbox は未実装である。
- 公開ゲート `src/lib/content/publish-gate.ts` は記事メタ（著者・広告表記・更新責任者・結論・カテゴリー・次回確認日）だけを検査する。Claim / Evidence は未実装。

### To-Be（規範契約）

| ID | 契約 | 配置 / 状態 |
|---|---|---|
| DB-BOUNDARY-01 | `EDITORIAL_DB` と `COMMERCIAL_DB` の2つの D1 を物理境界とする。Editorial は利用者・Workspace・コンテンツ・根拠・公開業務、Commercial は affiliate account/link、tracking、consent、event、conversion、attribution、rollup を所有する。cross-D1 foreign key / transaction は前提にしない | 未実装 |
| DB-TENANT-01 | tenant-owned row は `workspace_id NOT NULL`。主キー以外の business uniqueness、検索 index、repository 条件は workspace scope を先頭に含める。グローバル辞書だけを明示的な例外とする | 未実装 |
| DB-IDENTITY-01 | Editorial に actor（user / service account）と `workspace_membership(actor_id, workspace_id, role, status)` を持つ。認可の同一性は actor ID 単体でなく、この membership tuple とする。Commercial へは監査用 actor ID のみ記録し、権限判定を複製しない | 未実装 |
| DB-CONSENT-01 | Commercial に `consent_record(workspace_id, site_id, consent_key_hash, purpose, state, policy_version, effective_at)` を履歴として保持する。state は `granted \| denied \| withdrawn`。granted 前の event は session ID / IP hash を持たず、withdrawn 後は新規の識別可能 event を拒否する | 未実装 |
| DB-CONVERSION-01 | backend の BE-CONV-01 に従い conversion、import record、decision / settlement history を分離する。`conversion_key` は Workspace と affiliate account に scope された一意制約、`import_record_key` は再送 no-op の一意制約とする。conversion の現在値は二軸を投影し、単一 `status` 列は持たない | 未実装 |
| DB-STATE-01 | 承認軸は `approval_status = pending \| approved \| rejected \| cancelled`、支払軸は `payment_status = not_eligible \| unpaid \| scheduled \| paid \| reversed` とする。`scheduled/paid` は `approval_status=approved` の場合だけ許可する CHECK 制約を持つ。各軸の source timestamp と遷移を append し、古い原票で現在値を巻き戻さない。各変更は outbox event で集計再計算を要求する | 未実装 |
| DB-KPI-01 | KPI名、version、分子、分母、bot/速報/承認/支払の除外規則、最低標本数を辞書として一元化し、rollup に `kpi_definition_version` / `aggregation_set_version` を記録する。`revenue_approved` は `approval_status=approved` の `commission_amount_approved`、`revenue_paid` は `payment_status=paid` の `commission_amount_paid` と定義し、混同・合算しない。その他の定義は `docs/spec/03-分析・解析基盤仕様.md` §4–§5 を参照し、画面ごとに式を複製しない | 未実装 |
| DB-PROJECTION-01 | Editorial の transaction は同一DB内の `outbox_event` へ、分析に必要な非機密の content dimension 変更を同時記録する。consumer は event ID で冪等化し、Commercial の `content_analytics_projection` を upsert する。projection は `workspace_id + content/variant/publication ID + dimension values + source_version` を持ち、収益を Editorial へ逆流させない | 未実装 |

### Delta

1. `EDITORIAL_DB` / `COMMERCIAL_DB` の migration と binding を用意し、legacy `DB` の3テーブルを所有境界へ割り当てる。切替完了までは dual-write でなく、停止可能な backfill + 検証 + cutover を使う。
2. DB-TENANT-01 / DB-IDENTITY-01 を先行し、テナント条件のない repository を許可しない。
3. DB-CONSENT-01 / DB-CONVERSION-01 / DB-STATE-01 と append-only event を追加する。
4. DB-PROJECTION-01 の outbox relay 後に DB-KPI-01 と MetricRollup を構築する。

### Dependencies

依存方向は `前提 → 後続` とする。

- DB-BOUNDARY-01 → infrastructure の2 D1 binding、環境別 migration、backup / restore 手順。
- auth の session / service-account identity + DB-IDENTITY-01 → backend の BE-AUTH-01。
- DB-CONSENT-01 → 計測タグと event ingestion の同意判定。
- DB-PROJECTION-01 の outbox + Queue / dead-letter → projection consumer。consumer は `source_version` で順序逆転を解決する。
- DB-KPI-01 → BE-ANA-01 と Analytics 表示/API。Commercial data を商品評価・ランキングへ入力しない。

### Acceptance evidence

- schema snapshot で2 D1の所有テーブル、全 tenant-owned table の `workspace_id NOT NULL` と scoped unique/index を検査した記録。
- cross-workspace fixture が repository / API / MCP の全経路で分離されるテスト。
- granted 前・withdrawn 後の event に session ID / IP hash が保存されない privacy test。
- outbox を重複・順序逆転で配送しても projection が一意かつ最新になり、再送後に未処理 outbox がゼロになる recovery test。
- conversion の再取込・遅延した二軸の状態更新・rollup 再計算と、KPI version 一致を示す migration / contract test。DB が `scheduled/paid + approval_status!=approved` を拒否し、approved/unpaid は `revenue_approved` のみ、approved/paid は `revenue_paid` も計上すること。

## 章にしか無い記述 (正本へ未接続)

> 以下の 1 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### 本節を「転記」に留めた理由 (2026-08-20 実測)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### 本節を「転記」に留めた理由 (2026-08-20 実測)

C05 gaps[0] は「8 章 + 00 を再生成して確定セル内容と decisions[] を本文へ載せる」と書いているが、**再生成も本文複製もしない**。理由は 3 つあり、どれも読んで判断したのではなく測った結果である。次に読む人が善意で「正本に合わせる」と、下に書いた退行が起きる。**この節はそのために置いてある。**

**理由 1: 再生成すると章の規範本文が消える。** compile 出力と本番章を突き合わせた結果、章にあって生成器にも正本にも無い行が `system-spec/*.md` 10 枚で **374 回出現**した (分母 = 10 枚の空行を除く全行)。同じ行をファイル内で畳むと **366 行**、10 枚を横断して畳むと **316 行**。3 つの数はすべて正しく、数えている対象が違うだけである (出現回数 / ファイル内一意 / 全体一意)。消えるのは To-Be 契約表 (`DB-*` / `BE-*` / `INF-*` / `*-REQ-*` / `*-ACC-*`)、故障モード、初期 SLO、Acceptance evidence、index の状態軸。

**理由 2: 正本の回答は章より古い。** 章と正本の両方に現れうるトークン 9 個で照合した (分母 = 照合トークン 9 個)。

| トークン | 正本 `qa-database-web-spec-intake` の回答 | `system-spec/database.md` |
|---|---|---|
| `conversions_pending` | 1 | 0 |
| `conversions_approved` | 1 | 0 |
| `revenue_confirmed` | 1 | 0 |
| `conversions_decision_pending` | 0 | 2 |
| `conversions_settlement_paid` | 0 | 2 |
| `revenue_approved` | 0 | 4 |
| `revenue_paid` | 0 | 4 |
| `approval_status` | 0 | 7 |
| `payment_status` | 0 | 5 |

上 3 行は正本にしかない**旧名**、下 6 行は章にしかない**現行名**である。つまり `MetricRollup` の列名について**正本のほうが古い**。正本の本文を章へ複製すると列名が旧名へ戻る。「正本が新しい」という前提が成り立たない以上、複製は同期ではなく退行になる。

**理由 3: 章が名指す確定質疑が正本の `qa_ref` と食い違っていた。** 8 カテゴリ中 **7 件で不一致**、一致は auth のみだった (分母 = `coverage_matrix` の web セル 8 件)。章側は `qa-*-analytics` / `qa-*-web` を、正本側は `qa-*-spec-intake` を名指していた。本節と `## カテゴリ別収集状態` の Web 行は**正本の値を正**として書き直した。章側の旧 ID が指していた質疑録の本文は `## 確定内容 (質疑録)` にそのまま残してあり、**消していない** (理由 2 のとおり、章側の本文のほうが新しいため)。

以上より gaps[0] は、**本文を増やさず「確定の根拠がどこにあるか」を章に載せる**形で実行した。正本の所在は 2 つに分かれる — **規範本文の正本は章、確定セルの状態の正本は `spec-state.json`**。食い違ったら、本節の表は `spec-state.json` を正とし、規範本文は章を正とする。
