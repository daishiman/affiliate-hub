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
| Web (web) | 確定 | 確定質疑: qa-database-web-article-image-verbatim。裏付け質疑 (`qa_refs`): `qa-database-web-domain-aeo-behavior`, `qa-database-web-audit-history-window-p13-v3`, `qa-database-web-blog-provisioning-integrity`, `qa-database-web-blog-builder`, `qa-database-web-spec-intake`, `qa-database-web`, `qa-database-web-analytics`, `qa-database-web-aeo-analysis-storage-v4`, `qa-seo-approved-diff-20260906`, `qa-neutral-search-method-v6`, `qa-answer-aeo-feasibility-v6`, `qa-decision-aeo-data-sources-v5` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末側にローカル DB を置かない。オフライン時の書込みキュー・端末間の競合解決・端末側スキーマ移行を設計対象から外し、永続化は D1 を単一の正本とする。記事画像の参照状態もここだけが持つ。 |
| タブレット (tablet) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末側にローカル DB を置かない。オフライン時の書込みキュー・端末間の競合解決・端末側スキーマ移行を設計対象から外し、永続化は D1 を単一の正本とする。記事画像の参照状態もここだけが持つ。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末側にローカル DB を置かない。オフライン時の書込みキュー・端末間の競合解決・端末側スキーマ移行を設計対象から外し、永続化は D1 を単一の正本とする。記事画像の参照状態もここだけが持つ。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末側にローカル DB を置かない。オフライン時の書込みキュー・端末間の競合解決・端末側スキーマ移行を設計対象から外し、永続化は D1 を単一の正本とする。記事画像の参照状態もここだけが持つ。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末側にローカル DB を置かない。オフライン時の書込みキュー・端末間の競合解決・端末側スキーマ移行を設計対象から外し、永続化は D1 を単一の正本とする。記事画像の参照状態もここだけが持つ。 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | database × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database-web-article-image-verbatim` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 1 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`database`) を主担当とする **2 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 |
| `dec-analysis-history-retention` | AEO/SEO 解析の結果履歴を D1 にどう保持するか。最新だけを持つのか、推移を追えるよう履歴を積むのか、積むならどこで打ち切るのか。 | `opt-append-with-window` | confirmed | G3, G2 |

- **`decision-editorial-commercial-split` の caveat**: 既存テーブルの引っ越しが 1 回必要で、その回だけは本番データを触る / DB をまたぐ集計はアプリ側の突合になるため、突合のテストを先に書く / 分けたあとも、Commercial の値を関数の引数として渡せば混ざる。バインディングの分離は「うっかり」を防ぐが「意図」は防がない

- **`dec-analysis-history-retention` の caveat**: 保持件数・保持期間の具体値は本セッションで根拠を持たない。実際にどれだけの期間を比較したいか (施策の効果が現れるまでの期間) を決めてから設定すること。根拠なく数値を確定しないこと / 刈り取りの失敗は容量が伸びるだけで画面に何も現れない。刈り取りの最終実行時刻と削除件数を記録し、確認できるようにすること / 解析ロジックのバージョンを各行へ記録すること。記録しないと、スコアの変化が記事の改善によるのか解析側の変更によるのか区別できず、履歴が比較に使えなくなる / 根拠として引用した Cloudflare D1 と Drizzle は取得済みの入口ページで、無料枠の具体的な容量上限は本セッションで再取得していない。保持件数を決める際に公式資料で再確認すること

## 確定内容 (質疑録)

### qa-database-web-article-image-verbatim (対応セル: web)

**質問**: database×web: 記事への画像添付について利用者は何を求め、格納経路に何を選んだか。参照状態の設計を起草する前に、逐語で記録する

**回答**: [機能要望 (2026-09-05)]
「ブログを作成するためのブログエディターが欲しいです。Notionのような管理画面の方でブログを編集できるようなブログエディターが欲しいです。その際に記述したら、もうその瞬間に表示されるようなコードブロックで表示されるような形ではなく、どのような形で表示されるかが見た目的にわかるようなコードエディターが欲しいです。ただし、編集したら見出し2が見出し1に変わるなど、Notionを改善するような形で構築できてほしいです。カードだったり画像を添付したりとか、そのようなところもしっかりと反映できるように、全ての今のブログを構成する情報が編集表示できるように、そのように整えてほしいです。今それが全然反映されていないです。」

[AskUserQuestion「画像添付の経路」への選択]
「Cloudflare R2 へ直接アップロード（推奨）」

※ この answer は利用者の逐語のみで構成する。ここから導いた受入条件・要件 ID は design_applications と chapter_notes に置く (harness doctrine: 利用者の逐語へ後から気づいた突き合わせを足さない)。

### qa-database-web-domain-aeo-behavior (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: ブログごとに独自ドメインを接続でき、読者がどこに時間をかけ・どこを押したかを座標まで含めて解析でき、AEO (回答エンジン最適化) の状態を管理でき、ブログ横断で売上と PV を集約できるようにするには、データをどう持つか。既存の『読者向けホスト名は DB に保存せず SITE_BASE_DOMAIN から導出する』という site_blueprints の判断はどう扱うか

**回答**: 既存の導出は消さず、既定の住所として残す。カスタムドメインはそれを置き換えるのではなく別名として足す。site_custom_domains 表を新設し、workspace_id / site_slug / hostname (一意) / status (pending→verifying→active→failed→revoked) / verification_token / provider_hostname_id (Cloudflare for SaaS のカスタムホスト名 id) / cert_status / verified_at / last_checked_at / failure_reason を持つ。環境ごとの値を行へ焼き込む懸念は、dev/prod で D1 binding が分かれている既存の分離に委ねる (行に environment 列を作らない)。読者行動は telemetry_events を太らせず reader_interaction_events を別表にする。1 記事の 1 回の閲覧で数十から数百行に達し、保持期間も既存イベントより短くしたいためである。列は workspace_id / site_slug / article_slug / occurred_at / reader_key (同意なしは null) / kind (scroll_depth | dwell | element_click | pointer_sample) / viewport_bucket / element_ref / x_ratio / y_ratio / value。座標は絶対値でなく要素基準の比率で持ち、端末幅が違っても重ねられるようにする。集計は毎回の全走査に頼らず、site_daily_metrics (site_slug × 日付: 訪問・PV・クリック・成果・収益) と article_daily_metrics (記事 × 日付: PV・平均滞在・到達深度中央値・CTR・成果・収益) の日次ロールアップを置く。既存の affiliate_conversions / affiliate_links / redirect_resolutions から収益側を、reader_interaction_events から行動側を、同じ site_slug で突き合わせる。AEO は site_aeo_profiles (site_slug ごとの llms.txt 方針・AI クローラー許可・回答単位の生成方針) と article_answer_units (記事内の一問一答単位: 問い・答え・根拠 ref・構造化データ出力可否) を持つ。SEO/AEO の評価結果は article_seo_assessments (記事 × 評価時点: 見出し構造・内部リンク・構造化データ充足・回答単位数・指摘一覧) に残し、記事本文とは分けて時系列で追える形にする

### qa-database-web-audit-history-window-p13-v3 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

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

**回答**:

#### 5. 集計層(MetricRollup)

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

### qa-seo-approved-diff-20260906 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 2026-09-06、提示済み eval-log/affiliate-hub/current-worktree/elegant-review/20260906/seo-change-proposal.md への続行確認。承認対象は次の変更提案全体（これは提示内容の要約で、利用者の逐語回答ではない）: 記事と変更前後の差分を運営者が確認し、承認した対象だけを反映する。夜間処理は観測だけを行う。記事更新・変更前後の履歴・所見の反映済み状態を同一の確定単位で保存し、途中失敗時は全体を変更しない。反映と取消は読み出した版との一致を確認し、同時編集や取消前の追加編集を上書きしない。対象範囲は元記事の作成日時で判定し、導入前の記事と作成日時不明の記事はこの反映経路から除外する。SEO実績は選択したブログ・記事と同じページの観測時刻付き推移へ接続し、クリック数だけで因果効果を断定しない。

**回答**: つづけて

### qa-neutral-search-method-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 読者向けブログの検索はどの方式にしますか。Cloudflare Workers + D1 構成が前提です。(a) D1 の FTS5 全文検索 — 本文まで検索できる。外部サービスを増やさず D1 の中で完結する。日本語は形態素解析が使えず trigram の部分一致が上限なので検索精度に天井がある。索引のぶん保存量と書き込み費用が増える。(b) 題名・カテゴリの部分一致のみ — 実装が最も軽く、索引を持たないので保存量も書き込み費用も増えない。本文中の語では記事が見つからないため、題名に含まれない話題を探している読者は辿り着けない。(c) 外部検索サービスを足す — 日本語の形態素解析やあいまい検索など、精度の上限が最も高い。一方で鍵の管理・障害時の縮退・月額費用という運用が新たに3つ増え、Cloudflare の外に依存先ができる。（2026-09-03 AskUserQuestion『検索方式』。独立監査 C06 が qa-decision-search-method-v4 を『推奨バッジが片方にだけ付いた状態で提示されており、他の選択肢と対等に提示されていない疑いがある』と指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者は前回と同じ案を選んだ）

**回答**: D1 の FTS5 全文検索

### qa-answer-aeo-feasibility-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 利用者が qa-decision-aeo-data-sources-v5 の回答末尾で『1、2、3を自作で行いたいなと思ってます。可能ですか？』と逆質問したことへの応答。3 系統 (サイト内静的解析 / Google Search Console 連携 / AI 検索での被引用チェック) を自作することは可能か。（独立監査 C06 が『利用者の疑問に対する応答が qa_log 上に残っていない』と指摘したため、応答を記録として残す）

**回答**: 可能です。系統1 (サイト内静的解析) は自分の記事データを走査するだけなので外部依存が無く、Workers の中で完結します。系統2 (Google Search Console) は公式 API が公開されており、運営者が登録した認証情報で表示回数・クリック・掲載順位・クエリを取り込めます。系統3 (AI 検索での被引用) は AI 基盤の web 検索機能へ問い合わせ、返る引用 URL に自サイトが含まれるかを記録する形で作れます。ただし 3 系統は再現性が大きく異なるため、同じ『分析結果』として混ぜず、収集・保持・表示のすべての層で分けて持つ必要があります。

### qa-decision-aeo-data-sources-v5 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AEO/SEO の分析・解析はどのデータ源で行いますか。(1) サイト内の静的解析（自分の記事データから構造化データ・見出し階層・内部リンク・画像 alt などを走査して採点する。外部依存なし） (2) Google Search Console 連携（表示回数・クリック・掲載順位・クエリを取り込む。API 認証が要る） (3) AI 検索での被引用チェック（AI 検索面へ問い合わせ、自サイトが引用されたかを記録する）。どれを使いますか。（2026-09-03 AskUserQuestion『データ源』。qa-followup-aeo-data-sources-v5 と同一の問答を、裏付け entry へ要求される設計適用を伴う形で作り直したもの）

**回答**: 1、2、3を自作で行いたいなと思ってます。可能ですか？

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)

`feat-blog-ui-builder` (P01〜P12) の実装で確定したデータモデルを記録する。
定義の正本は `src/db/schema.ts` である。**ここは正本の写しではなく、
なぜその形なのかと、実装で分かった未解決の欠陥を書く。**

#### 1. 確定した 6 表

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

#### 2. 「上書きが無い」を NULL でなく行の不在で表す

`page_theme_override` は、行を消すとブログ既定へ戻る。
NULL 値で「上書きなし」を表すと、「上書きしていない」と
「上書きの結果 NULL になった」が区別できなくなる。

同じ理由で `legal_page` の不在は「未整備」であり、既定文を出さない。
**見本の文を本物として配らない。**

#### 3. `guideline_references` — 確認日と取得時刻を別の列で持つ

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

#### 4. 未解決の欠陥 (2026-08-30 時点)

##### 4.1 🔴 `workspace_id` の migration が未コミット

`blog_theme` と `page_theme_override` の `workspace_id` は
`src/db/schema.ts` に定義済みだが、対応する migration
(`drizzle/0040_serious_madelyne_pryor.sql`) が生成済み・**未コミット**である。

**このまま本番へ出すと、D1 に列が無いのにコードは列があるつもりで問い合わせ、
配色の保存も読み出しも実行時に落ちる。**

`pnpm run verify` の「マイグレーションの作り忘れ」検査は
`git status --porcelain drizzle` を見るので、生成しただけでは緑にならない。
**この検査は「生成できるか」ではなく「コミットに入っているか」を見ている。**
生成だけで緑になると、CI は通るのにデプロイで落ちる状態が作れてしまう。

##### 4.2 🔴 `legal_page` を 2 系統の語彙が触っている

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

##### 4.3 ⚠️ 書き込みが操作の記録に届かない

`createManageBlogAppearanceUseCase` (配色の保存) と
`createReviewBlogPlacementsUseCase` (掲載の増減) の書き込みが、
操作の記録に届いていない (`pnpm run verify` の「つなぎ目の呼び出し」検査が検出)。

**掲載の増減は金銭に直結するため、いつ・誰が・何を消したかを
後から機械で追えない状態は出す前に直すものである。**

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: feat-blog-ui-builder P01〜P12 で確定した 6 表のデータモデル (workspace_id を列として持つ理由・索引順・行の不在で状態を表す設計) と、実装で判明した未解決の欠陥 3 件を正本へ記録する。章へ直接書くと compile で消えるため。

### migration の未コミットを解消 — feat-blog-ui-builder リリース (P13、2026-08-31)

同章の「実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)」§4.1 で
🔴 として記録した「`workspace_id` の migration が未コミット」は、**本リリース commit で解消した。**
前の記録は消さずに残す。消すと「一度この状態で出そうとしていた」という事実が引けなくなる。

#### 解消した内容

`drizzle/0040_serious_madelyne_pryor.sql` と `drizzle/meta/0040_snapshot.json` を
リリース commit に含めた。これで `pnpm run verify` の
「マイグレーションの作り忘れ」検査 (`git status --porcelain drizzle` を見る) が緑になる。

**この検査が見ているのは「生成できるか」ではなく「commit に入っているか」である。**
生成だけで緑になる設計だと、CI は通るのにデプロイで落ちる状態が作れてしまう。
今回はまさにその状態が 1 日残っていた。

#### 0040 が壊れ方を選んでいる形

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

#### 残る 🔴 / ⚠️ は解消していない

§4.2 (`legal_page` を 2 系統の語彙が触っている / 18 経路中 12 経路が 404) と
§4.3 (配色の保存と掲載の増減が操作の記録に届かない) は**本リリースの範囲外で、開いたままである。**
`dev` 環境へ出すのは、この 2 件が開いていることを承知の上での MVP としてである。
本番 (`main`) へ進める前に §4.3 を先に閉じること — 掲載の増減は金銭に直結し、
いつ・誰が・何を消したかを後から機械で追えない状態を本番に置くべきではない。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 同章 §4.1 が 🔴『migration が未コミット』と記録した状態を本リリース commit で解消したため、正本を現状に一致させる。前の記録は消さず差分として足す。

### 書き込みが操作の記録に届かない状態を解消 — feat-blog-ui-builder リリース (P13、2026-08-31)

同章の「実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)」§4.3 で
⚠️ として記録した「書き込みが操作の記録に届かない」は、**本リリース commit で解消した。**
前の記録は消さずに残す。消すと「一度この状態で出そうとしていた」という事実が引けなくなる。

#### 解消した内容

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

#### なぜ掲載だけ「足す」と「外す」を分けたか

台帳 `blog_affiliate_placement` の行は**外すと物理削除される**（所在の記録であって
履歴ではない、という表そのものの設計である）。つまり
**外した事実が残る場所は `audit_log` しかない。**
1 語にまとめると「掲載が消えている」を差分から読むことになるが、
消えた行の差分は消えているので読めない。

外した内容は `before` ではなく `after` に平文で並べている。台帳から引き直せない以上、
記録の側が「どの記事のどの位置から、どのコードの掲載が消えたか」を単独で言えるべきである。

#### 見た目の変更にも記録が要ると判断を変えた理由

`manage-blog-appearance.ts` は当初「配色とテンプレートは読者の目に映るだけで、
法令上の主張を 1 つも含まない」として記録を書いていなかった。**この理由は誤りではないが、
足りなかった。**記録が要るのは法令上の主張があるときだけではない。

見た目は**上書きで消える設定**である。誰かが配色を変えた翌日に「読みにくくなった」と
言われても、変える前の値はどこにも残っていない。枠の並び (`blog_layout.changed`) は
残していて配色だけ残さないのは一貫していなかった——後から読む人にとって問いは同じ
（「そのとき読者に何がどう見えていたか」）である。

#### 記録が書けなかったときは「変えました」で終わらせない

保存は済んだが `audit_log` へ書けなかったとき、**保存を取り消さない。**
取り消すと、押した人には「効かなかった」と見えるのに保存先には残っている、という
別の食い違いを新しく 1 つ作ることになる。返すのは
`auditWriteFailure`（済んだことと、残っていないことを両方その場で書く断り）である。

#### ポートの名前を 1 つ変えた

`BlogAppearancePort.selectTemplate` を `saveTemplate` へ改名した。
`scripts/port-wiring.mjs` が読み書きを判定できずに止まったためで、
語彙表へ `select` を足して黙らせることもできたが、**それをすると将来の読み取り手続きが
黙って書き込み扱いになる**（SQL の `SELECT` は読みの語である）。名前の側を直した。

#### 残る 🔴 は §4.2 のみ

§4.2（`legal_page` を 2 系統の語彙が触っている / 18 経路中 12 経路が 404）は
**開いたままである。**本番 (`main`) へ進める前に閉じること。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 同章 §4.3 が ⚠️『配色の保存と掲載の増減が操作の記録に届かない』と記録した状態を本リリース commit で解消したため、正本を現状に一致させる。前の記録は消さず差分として足す。

### SEOの現行承認契約（2026-09-06）

**2026-09-06 の利用者承認 `approval-seo-approved-diff-20260906` / `qa-seo-approved-diff-20260906` が、SEOの反映方法に関する現在の正規契約である。**

記事と変更前後の差分を運営者が確認し、承認した対象だけを反映する。夜間処理は観測だけを行う。記事更新・変更前後の履歴・所見の反映済み状態を同一の確定単位で保存し、途中失敗時は全体を変更しない。反映と取消は読み出した版との一致を確認し、同時編集や取消前の追加編集を上書きしない。対象範囲は元記事の作成日時で判定し、導入前の記事と作成日時不明の記事はこの反映経路から除外する。SEO実績は選択したブログ・記事と同じページの観測時刻付き推移へ接続し、クリック数だけで因果効果を断定しない。

前掲の旧QAの逐語回答・旧設計適用、および2026-09-04の公開済み計画packageは、その時点の判断の履歴として残す。そこでの「機械が自動で反映し事後通知」「承認の関門が無い」は、今回承認されたSEO反映には適用しない。SEO以外のブログトップ・検索・AI向け表現物など、変更していない決定は引き続き有効である。

- 正規の現行受入: `features/feat-seo-aeo-measurement-loop.md#frontmatter.acceptance`。実装要件: `docs/requirements/feat-seo-aeo-measurement-loop-implementation-requirements.md`。
- 差分承認は記事・変更内容・読取版へ束縛する。承認後に内容を再生成して別の差分を保存しない。未承認記事や競合記事をまとめて上書きしない。
- 取消も現在版が当該反映後の版に一致するときだけ成功させ、記事復元と取消記録を同時に確定する。失敗・競合・重複実行で一部だけ変わる経路を持たない。
- 作成日時の正本は編集側の元記事であり、公開日/更新日を代用しない。導入前・不明は理由を示して所見提示に留める。
- 観測データはサイト/ページ/系統/観測時刻を保つ。期間指定は実際の期間絞り込みと一致させ、件数上限だけの場合は「最新N観測」と表示する。未観測を0にせず、順位・クリック・被引用の変化を施策の因果効果と呼ばない。
- 通常公開・編集も同じ永続化正本と版比較を使い、夜間収集から改稿を起動しない。

- 正本へ入れた理由: 利用者が直前のSEO変更提案へ続行を指示し承認済み。旧QAを改変せず現行契約と履歴の優先関係を明示する。

### Search Console検索語保存と取得範囲（2026-09-06実装確認）

既存の「クエリ・ページ・表示回数・クリック・平均掲載順位を取得して保存する」要件を次の収集・保存契約で具体化する。受入A1〜A8と、承認差分だけを反映する契約は変更しない。

- ページ全体の実績（date/page）と検索語別の内訳（date/page/query）を別取得・別保存する。匿名検索語を含まない内訳を加算して全体実績を作らない。Search Console由来の検索語は、読者のサイト内自由検索語を新規収集しないtelemetry契約と別のデータ源である。
- 両取得は日ごとにstartRowでページングし、API公開上限の1日・検索種別・プロパティあたり50,000行を境界にする。上限到達はAPI公開範囲までの取得であり、匿名検索語を含む実際の全検索や全ページの完全取得を意味しない。
- 検索語取得は定期実行全体で40,000行を共有上限とし、日付・次のstartRow・版を保存して次回に継続する。予算による未完了とAPI公開上限到達を区別し、実行結果へ理由を返す。
- workspaceと選択ブログを読取・書込で隔離し、検索語内訳はページ・日・検索語で保持する。途中取得は準備中のrunへ保存し、その日の取得完了時だけ完了分を読む参照先を切り替える。途中失敗は前回完了分を保ち、版比較と同じD1 batchで競合・遅延書込による上書きを防ぐ。
- ページ実績は検索語内訳から独立して保持し、AI観測値を保つ。公開上限で未返却ページの所見を解消済みにしない。検索語の読取口は選択ブログ・ページ・期間と最新1〜100件に限定する。これは保存と読取口の実装確認であり、検索語内訳や上限状態の新しい管理画面表示を実装済みとはしない。

旧詳細差分の検索語保存と1,000行固定打切りはこの範囲で解消した。AIの月次累積予算とサイト横断の静的監査は残る。全163仕様の完全性評価はSTALEを維持し、この局所同期を全体PASSへ昇格しない。

- 正本へ入れた理由: 既存GSC検索語保存要件の実装確認。日別pagination、取得上限と継続、別保存と隔離の実測結果を同期し、受入・QA・公開履歴と全体評価状態を変更しない。

### AI被引用チェックの月次検索枠（2026-09-07実装確認）

既存の「月あたりの検索回数」要件を以下の実装契約で具体化する。2026-09-06のGSC注記で残差としたAI月次累積予算（#2）はこの範囲で解消し、本注記を最新の状態とする。旧QA・過去の公開packageは改変せず、承認差分のみを反映する契約を維持する。

- 月次上限はworkspaceの全ブログで共有するUTC暦月のWeb検索回数。初期値はNULL（未設定）で外部通信を開始しない。0も停止するが未設定と区別する。設定可能値は0〜100,000の整数。資格情報なし、1実行の記事数上限0、月次枠不足も理由を分け、検索していない記事を「引用なし」にしない。
- 1回のHTTP問い合わせは最大3検索、1回の収集は既定50記事であり、月次検索回数とは別の上限。残量に応じて問い合わせのmax_usesを減らす。月次上限は検索回数の制御であり、トークン課金や請求額の上限ではない。
- 使用数は提供元usageで確認した検索回数、未確認数は送信後に使用量を確認できず再利用しない枠、予約数は実行中に確保する枠。残量は上限から3値を引き0未満にしない。上限未設定の残量はNULLで、0に代用しない。設定の変更で使用済み・未確認数を戻さず、確保済みの実行は確定を続ける。
- 外部送信前にD1の条件付き更新でworkspace総枠・ブログ割当・現在の月次設定値・同一ブログの実行中予約を同時に照合する。古い設定で新規予約しない。検索枠はworkspace×UTC月×ブログの1行に集約し、予約IDに束縛した確定と記事の試行履歴を同batchで保存する。途中失敗・二重確定・別workspaceの確定を成功にしない。
- 1時間経過した未確定予約は使用数未確認の枠として保ち、単なる期限切れで残量へ戻さない。翌月は別の月キーで開始し、遅い確定は予約した月に適用する。問い合わせ直前に実時計のUTC月を確認し、月をまたいだ残りの送信は止め、未使用予約を返して次回へ回す。
- 月次枠は実行時の同一workspaceの公開ブログ間で均等配分し、端数を受け取る順番を月ごとにずらす。記事は未試行→最古試行の順で巡回する。成功観測と失敗を含む試行を混ぜず、試行台帳はworkspace×ブログ×記事の最新1行にし、本文や問い合わせ文章を保存しない。
- HTTP 200でもツールエラー、max_uses到達、未完了、検索未実行、使用数不明は確認失敗として扱う。実検索が確認できた完了応答の本文citationと対象URLを照合し、検索結果にURLが載っただけでは「引用あり」にしない。失敗でも確認できた検索数は計上し、不明なら当該問い合わせ枠を未確認数へ計上する。
- 設定と状況は既存/admin/seoの補助区画にまとめ、全ブログ共通・UTC月・残り・確認済み・実行中の確保・使用数未確認を表示する。人かつsite.manage権限で月次上限を保存する。0で新規AIチェックだけを止め、サイト内解析・Search Console・確保済み処理を一緒に止めない。既存AIトークン概算や生成回数の台帳を検索回数の正本へ流用しない。

旧詳細差分として残るのはサイト横断の静的監査（#3）。全163仕様の完全性評価はSTALEのままとし、この局所実装を全体PASSやfeatureの評価昇格へ置き換えない。

- 正本へ入れた理由: 既存の月次検索回数要件を実装証拠へ同期する。単位・未設定・原子予約・未確認・月替り・ブログ配分・引用の意味を明記し、旧QAと公開履歴を保ちながら残差#2の現状を更新する。

### サイト内の全公開ページ監査（2026-09-07実装確認）

旧詳細残差#3のサイト横断監査は、同じworkspaceの同じ公開ブログを比較集合とする以下の有限巡回として実装した。過去注記の「#3が残る」は当時の記録とし、現在の到達範囲は本注記とSEO実装要件で示す。

- 公開readerと同じactive・削除・workspace・slug一意の境界を確認し、共通ルートと公開記事正本からトップ、索引、カテゴリー、人物、文書、記事、実在する一覧paginationを列挙する。記事0件でも確認し、検索・保存一覧・旧redirectは独立ページに数えない。page=N（N>1）は別ページとして保持する。
- seo_static_audit_scanはworkspace×ブログの現行1世代、targetsは世代×pageKeyの観測と試行を持つ。対象hashの変更で世代を切り替え、25件以下・10分leaseの取得権と継続位置を原子的に更新する。失敗しても後続へ進み、旧世代・失効lease・遅い保存を成功にしない。
- 日次Cronの全ブログ共有枠は25ページで、日ごとに開始ブログを交替する。対象最大1,000、公開記事読取はLIMIT 1001で超過を拒否する。応答は10秒・1,000,000 bytes、内部リンク先500件、観測JSON 128 KiB、完了候補8 MiBを上限とし、超過・欠測を全体完了や問題なしにしない。本文や秘密は観測JSONへ保存しない。
- 配信HTMLをHTMLRewriterで観測し、単体の欠落/長短・見出し/画像・OGP/JSON-LD規則に加え、全成功集合でtitle/description重複と他ページからの内部被リンク0を判定する。canonicalはこの公開集合との突合、JSON-LD日時は可視timeとの日付単位の照合であり、任意外部URLの疎通や全schemaの完全検証を称しない。llms.txtは別取得し、配信設定と404/空/内容ありを照合する。
- 全対象とllms確認が成功した世代だけmarkPublishedを通す。ready世代/版/実行権なしのCAS、siteのstatic所見snapshot、旧static所見の置換、成功観測stamp、source成功時刻、完了状態を同D1 batchで確定する。失敗時は全体不変、他系統不変、古い観測で巻き戻さず、未完で前回所見を解消しない。
- 既存SEO画面の補助区画で対象・確認済み・未確認・失敗・再確認待ち・所見をブログ範囲と共に表示する。total=current+never+failed+stale、再確認待ちは14日超または観測後更新である。前回全体完了日時は保存するが画面の直接表示は今回含めない。巡回途中の所見は前回完了分と区別する。
- この範囲で#3を実装へ接続したが、巡回は開始から完了までの観測であり同時刻snapshotやSEO効果の証明ではない。記事保存時起動、任意外部canonical疎通、全JSON-LD schema検証は未実装のまま明示する。夜間観測のみと承認差分反映を維持し、旧QA・公開package・feature評価STALE・全163仕様の完全性STALEを変更しない。

- 正本へ入れた理由: 旧詳細の静的監査を公開集合・有限巡回・原子的所見公開・確認範囲表示の実装へ同期する。観測の限界と未実装範囲を明記し、旧QAと公開履歴と評価STALEを保持する。

### 静的監査の上限時の継続補足（2026-09-08）

2026-09-07の「サイト内の全公開ページ監査」の上限・継続に関する記述は、以下を現行契約として優先する。公開対象、単一の所見公開writer、旧所見保持と他系統の保護は維持する。

- 公開記事読取はLIMIT 1001。1,001件返れば正確な全件数を求めず下限total=1001・targets空・complete=falseを非エラーで返し、limited世代を保持して取得と所見更新を見送る。値を正確な対象件数や未開始として扱わない。
- 日次Cronの全ブログ共有枠25は、HTMLとllms.txtを合わせた外部取得回数である。HTML取得で使い切った場合はready世代を保持し、llms.txtは次回に確認する。
- 観測JSON合計8 MiB超はlimitedへ移し前回所見を保持する。同じinventoryHashでは容量超過時刻から14日以降の次回実行で新世代を開始し、hash変更時は14日を待たず新世代にする。単体の容量超過はresource_limitとして記録し、一巡内の後続確認を続ける。

- 正本へ入れた理由: 最終実装の非エラーlimited、HTMLとllmsの共有取得枠、容量超過後の再試行条件へ同期する。前日注記を履歴として保ち、この3点の現行契約を明確にする。

### 静的監査の公開境界と容量結果の訂正（2026-09-08）

静的監査の公開対象と容量結果について、前の実装確認注記より以下を優先する。旧QA・旧注記・公開履歴は当時の記録として保持し、他の有限巡回・原子公開・再試行契約は維持する。

- 公開ブログはreaderと同じく、対象workspaceのsite_blueprintsが存在し、site_retirementsに無いことを条件とする。site_network_nodeの有無・active等の状態は公開資格に使わず、監査対象・定期列挙・coverageをこの公開境界に揃える。
- 固定文書は同じworkspace/ブログのlegal_pageでstatus=publishedかつ未削除のものを対象とする。blueprint.pagesに無くても公開readerが返す文書は共通ルートで列挙し、下書きと削除済みは含めない。
- 単体の保存観測JSONが128 KiBを超えればresource_limitで記録し、stageはresourceLimitFailuresを返す。収集側はこの件数を失敗へ加算しpagesExaminedから減らして、その実行の再試行理由・失敗記録へ接続する。取得できたことだけで保存済み成功に数えない。
- 合計8 MiB超の候補判定は最終HTML batchのstage直後にも行い、llms用の外部取得枠を使い切った場合でも後回しにしない。loadCompleteCandidateのlimitedReasonを同じ実行のskippedReasonと系統の失敗記録へ返し、旧所見を保持する。記録の失敗も成功として隠さない。

- 正本へ入れた理由: 最終統合で確認したreaderの公開条件、設計図外の公開文書、単体と合計容量の実行結果契約へ同期する。旧QA・旧注記・公開履歴を保ち現行の4点だけを訂正する。

### Search Console検索語内訳の管理画面表示（2026-09-08実装確認）

既存の「Search Console検索語保存と取得範囲（2026-09-06実装確認）」が収集・保存・読取口までを記録したのに続き、検索語内訳を選択記事の管理画面へ接続した現行契約を記録する。旧注記、旧QA、公開済みpackageは当時の履歴として残し、この局所実装をfeature全体や全163仕様の完全性PASSへ置き換えない。

- 公開済み記事一覧から、所見や差分候補がない記事も含め、選択した1記事の既存`/admin/seo`へ移動できる。検索語は同じ記事の「この記事の観測値」内で段階的に開き、新しい画面や操作を増やさない。
- 検索語内訳はworkspace・ブログ・ページと両端を含む直近28日へ束縛し、日付の新しい順、同日は表示回数の多い順で最大100件を返す。100件を超える場合は表示打切りを明示する。
- ページ全体の実績（date/page）と検索語内訳（date/page/query）は別の値として保つ。内訳は匿名化された検索語を含まず、1日・検索種別・プロパティあたり50,000行のAPI公開上限と最大100件の表示打切りがあるため、日別行を合算してページ総計や実際の全検索を作らない。未取得を0件にしない。
- 各日の完了参照先に、API公開上限へ達した可能性と完了時刻を保持し、再取得中のrunから分離する。行と全28日分の状態は一つのD1 statementで同じread snapshotから返す。更新途中は直前の完了分を表示し、初回の未完了は空の完了にしない。
- 表示は、Search Console未設定、ページ観測との未結合、未取得、初回取得未完了、直前の完了分を表示しながら更新未完了、完了した範囲の検索語0件、読取失敗、API公開上限、100件の表示打切りを区別する。資格情報を外した後も保存済みの完了分は表示し、新しい取得が止まっていることを併記する。
- 読取失敗は検索語区画に閉じ、同じ記事の差分とページ実績を残す。検索語の変化は承認tokenへ含めず、画面表示から外部API取得や記事改稿を起動しない。workspace・ブログ・ページの隔離と既存のCAS/pointer切替を維持する。

過去のQA・公開履歴・feature評価、および全163仕様のformal completenessはSTALEのまま保持する。

- 正本へ入れた理由: GSC検索語の完成snapshot・再取得状態・上限と選択記事UIを同じ意味へ同期する。旧QA・公開履歴・feature評価と全163仕様のSTALEを保持する。

### 意思決定が本章に効く形

- **`decision-editorial-commercial-split` が本章に効く形**: 「報酬額をランキングの入力にしない」という禁止を、コードの中ではなく **D1 を 2 本に分ける**位置で担保する。越えるには設定を書き換えるしかなくなり、越えた事実が差分に残る。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

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

### この章の要件 ID を書いたのは誰か

この章の DB-IMAGE-01〜03 は、**AI が導いた受入条件**である。利用者が逐語で述べた要求そのものではない。出所を次のとおり分けて記録する。

**利用者の逐語（`qa-database-web-article-image-verbatim` の answer に原文がある）**

> カードだったり画像を添付したりとか、そのようなところもしっかりと反映できるように

**そこから AI が導いた受入条件**

- どの記事がどの R2 鍵を参照しているかの正本を Editorial 側の D1 が単独で持つこと
- R2 側のオブジェクト一覧を参照状態の正本にしないこと
- 参照の消滅と実体の消滅がずれる期間を、状態として表現できること

**利用者の確認を受けている範囲**

AskUserQuestion で「Cloudflare R2 へ直接アップロード（推奨）」を選択済み（承認記録 approval-article-image-upload-path）。参照状態をどこが持つかは提示していない。

この区別を残すのは、要件 ID の文面を後から見直すときに「利用者が言ったから変えられない」ものと「AI が導いたので設計判断で変えてよい」ものを取り違えないためである。

- 正本へ入れた理由: C06 round3 の指摘: AI が起草した受入条件が利用者の回答の顔で正本に載っていた。質疑側は逐語だけに作り直したので、章側で要件 ID の出所 (逐語 / AI 導出 / 利用者確認済みの範囲) を名乗らせる。

### 画像送信経路変更後も維持するデータ契約（2026-09-06）

`DB-IMAGE-01〜03` の参照台帳・状態遷移・回収猶予は、アップロード経路を Worker に統一しても維持する。2026-09-06 の現行承認は `approval-article-image-upload-path-worker-20260906` であり、画像は Worker の保存前検査を通って R2 へ入る。

この章に先に残る「R2 へ直接アップロードを選択済み」は 2026-09-05 時点の確認範囲を記録した履歴で、現行の送信経路ではない。参照状態の正本を D1 に置き、R2 オブジェクト一覧を正本にしないという本章の契約は変わらない。

- 正本へ入れた理由: 送信経路の変更と参照台帳の不変契約を分け、旧承認の記述を現行決定と誤読させない

### 歴史的スナップショット（現行規範ではない、2026-09-06 移送）

> 既存章にしか存在しなかった規範・受入条件・実装記録の保全移送。以下の本文は移送前のまま保持する。As-Is、Delta、PASS 等の実装・検証記録は本文に記された時点の記録であり、今回の実装完了・本番反映・新しい利用者承認を意味しない。後日の確定判断は本章の現在の質疑録・意思決定・日付付き注記を参照する。

#### 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**スキーマ適用済み・データ移行済み・分離検証済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §2 / §5、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

##### As-Is（2026-08-16 のリポジトリ実体、Phase 1 マージ後）

- 環境ごとに D1 binding `DB` が1つある。運営者ドメインは `asps`、`programs`、`conversions` の3テーブル。読者ドメインは Phase 1 で `categories`、`people`、`disclosures`、`products`、`articles`、`article_people`、`article_products`、`conversation_blocks` 等を追加した。両ドメインは同一 D1 に同居するが、コードコメントと `docs/spec/data-model-gap.md` で分離を宣言している。
- 全テーブルに `workspace_id` がなく、actor / Workspace / membership / role / consent の永続化もない。D1 自体に行レベル認可はないため、現状はテナント分離を満たさない。
- `conversions.external_id` は任意かつ非一意で、単一 `status` は `pending | approved | rejected` の判断現在値だけ。取込原票、冪等性、判断履歴、`cancelled`、独立した入金状態を保持しない。
- ClickEvent、BehaviorEvent、MetricRollup、KPI辞書、`content_analytics_projection`、outbox は未実装である。
- 公開ゲート `src/lib/content/publish-gate.ts` は記事メタ（著者・広告表記・更新責任者・結論・カテゴリー・次回確認日）だけを検査する。Claim / Evidence は未実装。
- 記事画像の参照状態を持つテーブルが無い。どの記事がどの保管領域の実体を参照しているかを引く手段が無いため、記事から外された画像を孤児と判定できない。

##### To-Be（規範契約）

| ID | 契約 | 配置 / 状態 |
|---|---|---|
| DB-BOUNDARY-01 | `EDITORIAL_DB` と `COMMERCIAL_DB` の2つの D1 を物理境界とする。Editorial は利用者・Workspace・コンテンツ・根拠・公開業務、Commercial は affiliate account/link、tracking、consent、event、conversion、attribution、rollup を所有する。cross-D1 foreign key / transaction は前提にしない | 未実装 |
| DB-TENANT-01 | tenant-owned row は `workspace_id NOT NULL`。主キー以外の business uniqueness、検索 index、repository 条件は workspace scope を先頭に含める。グローバル辞書だけを明示的な例外とする | 未実装 |
| DB-IDENTITY-01 | Editorial に actor（user / service account）と `workspace_membership(actor_id, workspace_id, role, status)` を持つ。認可の同一性は actor ID 単体でなく、この membership tuple とする。Commercial へは監査用 actor ID のみ記録し、権限判定を複製しない | 未実装 |
| DB-CONSENT-01 | Commercial に `consent_record(workspace_id, site_id, consent_key_hash, purpose, state, policy_version, effective_at)` を履歴として保持する。state は `granted \| denied \| withdrawn`。granted 前の event は session ID / IP hash を持たず、withdrawn 後は新規の識別可能 event を拒否する | 未実装 |
| DB-CONVERSION-01 | backend の BE-CONV-01 に従い conversion、import record、decision / settlement history を分離する。`conversion_key` は Workspace と affiliate account に scope された一意制約、`import_record_key` は再送 no-op の一意制約とする。conversion の現在値は二軸を投影し、単一 `status` 列は持たない | 未実装 |
| DB-STATE-01 | 承認軸は `approval_status = pending \| approved \| rejected \| cancelled`、支払軸は `payment_status = not_eligible \| unpaid \| scheduled \| paid \| reversed` とする。`scheduled/paid` は `approval_status=approved` の場合だけ許可する CHECK 制約を持つ。各軸の source timestamp と遷移を append し、古い原票で現在値を巻き戻さない。各変更は outbox event で集計再計算を要求する | 未実装 |
| DB-KPI-01 | KPI名、version、分子、分母、bot/速報/承認/支払の除外規則、最低標本数を辞書として一元化し、rollup に `kpi_definition_version` / `aggregation_set_version` を記録する。`revenue_approved` は `approval_status=approved` の `commission_amount_approved`、`revenue_paid` は `payment_status=paid` の `commission_amount_paid` と定義し、混同・合算しない。その他の定義は `docs/spec/03-分析・解析基盤仕様.md` §4–§5 を参照し、画面ごとに式を複製しない | 未実装 |
| DB-IMAGE-01 | Editorial に記事画像の参照状態を持つ。最低限 `article_image(workspace_id, article_id, object_key, referenced, last_referenced_at)` に相当する情報を保持し、「どの記事がどの R2 の鍵を参照しているか」を保管領域を走査せずに引けるようにする。孤児判定の根拠はここが唯一の正本であり、maintenance-ops の掃除ジョブは自前で数え直さない | 未実装 |
| DB-IMAGE-02 | 記事から画像を外す操作は、参照状態を「参照なし」へ更新して `last_referenced_at` を打つだけにし、実体の削除を伴わない。猶予期間内に同じ鍵が再び参照されたら「参照あり」へ戻る。物理削除は maintenance-ops の掃除ジョブが `OPS-REQ-009` の猶予を過ぎたものだけに対して行う | 未実装 |
| DB-IMAGE-03 | `object_key` の一意制約は `workspace_id` を先頭に含む (DB-TENANT-01 に従う)。同じ鍵が別 workspace の記事から参照される状態を、制約として作れないようにする | 未実装 |
| DB-PROJECTION-01 | Editorial の transaction は同一DB内の `outbox_event` へ、分析に必要な非機密の content dimension 変更を同時記録する。consumer は event ID で冪等化し、Commercial の `content_analytics_projection` を upsert する。projection は `workspace_id + content/variant/publication ID + dimension values + source_version` を持ち、収益を Editorial へ逆流させない | 未実装 |

##### Delta

1. `EDITORIAL_DB` / `COMMERCIAL_DB` の migration と binding を用意し、legacy `DB` の3テーブルを所有境界へ割り当てる。切替完了までは dual-write でなく、停止可能な backfill + 検証 + cutover を使う。
2. DB-TENANT-01 / DB-IDENTITY-01 を先行し、テナント条件のない repository を許可しない。
3. DB-CONSENT-01 / DB-CONVERSION-01 / DB-STATE-01 と append-only event を追加する。
4. DB-PROJECTION-01 の outbox relay 後に DB-KPI-01 と MetricRollup を構築する。
5. 記事画像の参照状態 (DB-IMAGE-01) を Editorial へ追加する。責務の分け方をここで明記するのは、以前この参照状態の持ち主が居らず、外した画像の実体が保管領域に残り続ける状態だったためである。database が「参照されているか」を持ち、maintenance-ops が「掃除を回す」。片方だけでは孤児は消えない。

##### Dependencies

依存方向は `前提 → 後続` とする。

- DB-BOUNDARY-01 → infrastructure の2 D1 binding、環境別 migration、backup / restore 手順。
- auth の session / service-account identity + DB-IDENTITY-01 → backend の BE-AUTH-01。
- DB-CONSENT-01 → 計測タグと event ingestion の同意判定。
- DB-PROJECTION-01 の outbox + Queue / dead-letter → projection consumer。consumer は `source_version` で順序逆転を解決する。
- DB-KPI-01 → BE-ANA-01 と Analytics 表示/API。Commercial data を商品評価・ランキングへ入力しない。
- DB-TENANT-01 → DB-IMAGE-01/03。参照状態も tenant-owned row であり、workspace scope の例外にしない。
- DB-IMAGE-01/02 → maintenance-ops の `OPS-REQ-008/009` の掃除ジョブ → infrastructure の R2 削除。この順を逆にすると、参照状態を持たないまま保管領域を走査する掃除になる。

##### Acceptance evidence

- schema snapshot で2 D1の所有テーブル、全 tenant-owned table の `workspace_id NOT NULL` と scoped unique/index を検査した記録。
- cross-workspace fixture が repository / API / MCP の全経路で分離されるテスト。
- granted 前・withdrawn 後の event に session ID / IP hash が保存されない privacy test。
- outbox を重複・順序逆転で配送しても projection が一意かつ最新になり、再送後に未処理 outbox がゼロになる recovery test。
- conversion の再取込・遅延した二軸の状態更新・rollup 再計算と、KPI version 一致を示す migration / contract test。DB が `scheduled/paid + approval_status!=approved` を拒否し、approved/unpaid は `revenue_approved` のみ、approved/paid は `revenue_paid` も計上すること。
- **DB-IMAGE-01**: 記事へ画像を 3 枚入れて保存し、うち 1 枚を外して保存する。参照状態から「参照なし」の鍵が 1 件だけ引けること、その問い合わせが R2 の一覧取得を伴わないことを、クエリログと併せて保存。
- **DB-IMAGE-02**: 外した画像を猶予期間内に元へ戻して保存する。参照状態が「参照あり」へ戻り、`last_referenced_at` が更新されること。この時点で実体が削除されていないことを R2 のオブジェクト一覧で確認して保存。
- **DB-IMAGE-03**: Workspace A の記事が参照する鍵と同じ `object_key` を、Workspace B の記事から参照させる挿入を試みる。制約により作れないか、`workspace_id` が異なるため別行として扱われ、A の参照状態が B の操作で変化しないことを示す tenant 越境テスト。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 既存章にだけ存在する要件定義表・受入条件とその文脈を、正規writerのchapter_notesへ逐語移送して再生成時の欠落を防ぐ。利用者回答や承認内容は改変せず、過去の実装記録を現在のPASSとして扱わない。

### To-Be（規範契約）

> 2026-09-06 現行規範。旧注記「章の規範本文を正本から再生成しない理由」は superseded とし、その「再生成しない」指示を無効化する。正本 chapter_notes と正規 compiler を唯一の更新経路とする。旧 374 行等の欠落原因・旧方式・過去の実装/PASS 状態は歴史的スナップショットとして保持する。以下は要求であり、実装・受入・remote migration・本番公開の完了を意味しない。

画像関連要件は 2026-09-06 の現行 Worker アップロード・ライフサイクル契約で同 ID を改訂した。旧 direct PUT/CORS/容量・可逆性の規定は歴史記録のみとし適用しない。

| 要件ID | 目標状態 |
|---|---|
| DB-BOUNDARY-01 | `EDITORIAL_DB` と `COMMERCIAL_DB` の2つの D1 を物理境界とする。Editorial は利用者・Workspace・コンテンツ・根拠・公開業務、Commercial は affiliate account/link、tracking、consent、event、conversion、attribution、rollup を所有する。cross-D1 foreign key / transaction は前提にしない |
| DB-TENANT-01 | tenant-owned row は `workspace_id NOT NULL`。主キー以外の business uniqueness、検索 index、repository 条件は workspace scope を先頭に含める。グローバル辞書だけを明示的な例外とする |
| DB-IDENTITY-01 | Editorial に actor（user / service account）と `workspace_membership(actor_id, workspace_id, role, status)` を持つ。認可の同一性は actor ID 単体でなく、この membership tuple とする。Commercial へは監査用 actor ID のみ記録し、権限判定を複製しない |
| DB-CONSENT-01 | Commercial に `consent_record(workspace_id, site_id, consent_key_hash, purpose, state, policy_version, effective_at)` を履歴として保持する。state は `granted \| denied \| withdrawn`。granted 前の event は session ID / IP hash を持たず、withdrawn 後は新規の識別可能 event を拒否する |
| DB-CONVERSION-01 | backend の BE-CONV-01 に従い conversion、import record、decision / settlement history を分離する。`conversion_key` は Workspace と affiliate account に scope された一意制約、`import_record_key` は再送 no-op の一意制約とする。conversion の現在値は二軸を投影し、単一 `status` 列は持たない |
| DB-STATE-01 | 承認軸は `approval_status = pending \| approved \| rejected \| cancelled`、支払軸は `payment_status = not_eligible \| unpaid \| scheduled \| paid \| reversed` とする。`scheduled/paid` は `approval_status=approved` の場合だけ許可する CHECK 制約を持つ。各軸の source timestamp と遷移を append し、古い原票で現在値を巻き戻さない。各変更は outbox event で集計再計算を要求する |
| DB-KPI-01 | KPI名、version、分子、分母、bot/速報/承認/支払の除外規則、最低標本数を辞書として一元化し、rollup に `kpi_definition_version` / `aggregation_set_version` を記録する。`revenue_approved` は `approval_status=approved` の `commission_amount_approved`、`revenue_paid` は `payment_status=paid` の `commission_amount_paid` と定義し、混同・合算しない。その他の定義は `docs/spec/03-分析・解析基盤仕様.md` §4–§5 を参照し、画面ごとに式を複製しない |
| DB-IMAGE-01 | 記事画像のライフサイクル台帳を同一 D1 の article_image で保持する。workspace_id、article_id、object_key、pending/ready/deleting/deleted、参照状態と切断時刻を持ち、記事保存と参照状態更新を同一 transaction で同期する。孤児判定とdeleting（削除 claim）の判定は台帳と現在の本文/公開 JSON の参照を根拠とする。 |
| DB-IMAGE-02 | 記事保存時に参照が切れた画像の detachment timestamp を記録する。ready の猶予期間内なら再参照できるが、deleting（削除 claim）/deleted は不可逆とし再参照・復元を拒否する。保存時は物理削除せず、掃除ジョブが deleting（削除 claim）→R2 delete→deleted 墓標へ遷移する。 |
| DB-IMAGE-03 | `object_key` の一意制約は `workspace_id` を先頭に含む (DB-TENANT-01 に従う)。同じ鍵が別 workspace の記事から参照される状態を、制約として作れないようにする |
| DB-PROJECTION-01 | Editorial の transaction は同一DB内の `outbox_event` へ、分析に必要な非機密の content dimension 変更を同時記録する。consumer は event ID で冪等化し、Commercial の `content_analytics_projection` を upsert する。projection は `workspace_id + content/variant/publication ID + dimension values + source_version` を持ち、収益を Editorial へ逆流させない |

- 正本へ入れた理由: 現行要件表を正本へ接続。旧再生成禁止 note を superseded とし、画像契約は現行実装・確定判断に同期。

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

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/database.md`](applied/database.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1 | 2026-04-30 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |
| cloudflare-d1-use-indexes | 2026-08-10 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/best-practices/use-indexes/ | 2026-09-03T00:00:00Z | 2026-09-03T00:00:00Z |
| sqlite-fts5 | 2026-08-01 | SQLite (www.sqlite.org) | https://www.sqlite.org/fts5.html | 2026-09-08T12:32:03Z | 2026-09-08T12:32:03Z |
