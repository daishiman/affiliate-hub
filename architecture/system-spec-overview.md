---
graph_node_id: "arch-system-spec-overview"
artifact_kind: "architecture"
artifact_subtypes: ["backend","data","security"]
project_id: "system-spec-import"
domain: "system-spec"
tags: ["system-spec","source-lineage","imported"]
priority: null
start_date: null
target_date: null
iteration: null
title: "system-spec architecture overview"
owners: ["system-spec-harness"]
created_at: "2026-08-29T14:27:14Z"
updated_at: "2026-08-29T14:27:14Z"
status: "active"
depends_on: []
related_nodes: []
resource_scope: ["system-spec/00-requirements-definition.md","system-spec/completeness-report.json"]
purpose: "確定済み system-spec の architecture context を参照可能にする。"
goal: "仕様由来の architecture context を feature から参照できる状態。"
scope_in: ["confirmed system-spec requirements artifact"]
scope_out: ["confirmed artifacts are not rewritten by this adapter"]
acceptance: ["source lineage と evaluator evidence を保持する","C02 でのみ登録する"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/system-spec-overview.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"aebfe3781f374c60b41c2a6698ec24c90e9aa58bed3903675e1b174fc75597a1","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-29T14:27:14Z","origin_kind":"system-spec-harness","source_digest":"af460e02930459d08ad7ac2414875f4d5ab4fdc2489ce7cafe51c99263467058","source_path":"system-spec/00-requirements-definition.md","source_plugin":"system-spec-harness","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "system-spec-harness が確定した architecture context の import。"
classification_candidates: [{"artifact_kind":"architecture","candidate_path":"architecture/system-spec-overview.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-29T14:27:14Z","evidence_refs":["system-spec/completeness-report.json"],"policy":"manual","reconciled_at":"2026-08-29T14:27:14Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-29T14:27:14Z","missing_sections":[],"status":"complete"}
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed` (matrix.state=確定 と frontmatter status=confirmed は要求判断の収集済みのみを表し、文書承認・実装完了・検証合格を表さない)
- 状態の正本: `spec-state.json` の `lifecycle` と `review_runs`

## U1 本質的目的 (essential_purpose)

発信者が、一つの信頼できる商品・サービス情報を起点に、複数のブログやSNSへ「誰が・誰に・何を・なぜ伝えるか」が一貫した高品質コンテンツを効率的に生成・公開・改善できる状態をつくり、読者の意思決定品質と発信者の継続的な収益性を同時に高める。

## U2 背景 (background)

アフィリエイトURL・ASP管理画面・商品情報・比較表・記事原稿・SNS投稿文・画像・ペルソナ・投稿スケジュール・クリック数・成果報酬・更新履歴が別々の場所で管理され、同じ商品名・価格・特徴を何度も入力し、修正時にも複数の投稿を個別に直す必要が生じている。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 一つのアフィリエイトURLを起点に、正しい商品情報・比較候補・根拠・書き手・読者・媒体・広告表示を統合し、目的の異なる高品質コンテンツを安全に作成・公開・改善できる |
| G2 | どういう情報・切り口・媒体・配置がクリック率とアフィリエイト成果に有効かを計測・分析し、一元管理できる |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | North Star Metric: 根拠確認と人間承認を完了し、複数媒体へ展開されたコンテンツパッケージ数を継続的に増やす | 承認済み・複数媒体展開済みコンテンツパッケージ数 (生成数・投稿数は中心指標にしない) |
| O2 | クリック・成果の要因分析が可能な計測カバレッジを確保する | 成果のアトリビューション突合率 (sub_id/クリックID一致の割合) |

目標値は根拠のない数値を確定しない。各指標は `current / target / measurement_window / event_or_query / owner / decision_due` を一組で持ち、初回実装では `current=未計測` として基準値を取得する。基準値取得後に target を決定するまで、能力要件の充足と成果目標の達成を混同しない。

## U5 成功基準 (success_criteria)

- 情報源↔商品↔主張↔コンテンツパッケージ↔媒体別文章↔投稿↔クリック↔成果の経路を双方向に追跡できる
- 第30章の受け入れ条件 (URL登録・比較・ペルソナ・AI生成・ブログ・配信・アフィリエイト・追跡可能性) をすべて満たす
- 配置・切り口・ペルソナ別のCTR/CVR/EPCを比較でき、根拠のない発見を表示しない

成功基準の判定には、少なくとも tenant 越境拒否、未同意イベント、同一成果の再取込、成果状態更新、計測D1障害中の既知リンク転送、KPI定義一致、n不足時の結論抑制を含む受入証拠が必要である。

## U6 ステークホルダー (stakeholders)

- 読者: 自分に合う商品かを根拠と弱点込みで判断でき、広告であることを認識できる
- 発信者 (個人〜小規模チームのアフィリエイト運営者): 商品調査を媒体ごとに繰り返さず、複数ブログ・SNSを一元運営し、何が成果につながったかを確認できる
- チームメンバー: Researcher/Writer/Reviewer/Publisher/Analyst のロールで分業する

## U7 スコープ (scope)

- **対象 (in)**: マルチテナント, 複数ブランド・複数ブログ構築, ブログ記事作成, アフィリエイトURL登録・商品情報抽出・商品データベース, 比較候補抽出, 書き手・読者ペルソナ, AI文章生成・投稿パターン生成, 画像・動画台本管理, SNS連携・投稿カレンダー, アフィリエイトリンク管理, クリック・成果分析, 更新管理・広告法令確認, WebMCP・バックエンドMCP・API, チーム権限・承認フロー
- **対象外 (out)**: 他サイトの無断複製・規約違反スクレイピング, 非公開情報の取得, CAPTCHAやアクセス制御の回避, 架空の体験・資格, 無確認の大量自動投稿・スパム, 自動購入, 報酬額基準のランキング, アフィリエイトリンクの無断改変, 非公式note APIへの依存, 投稿先ポリシーを無視した自動化

## U8 制約 (constraints)

- 媒体ごとに公式APIの認証・権限・投稿形式・利用料金・審査条件が異なる (X APIは従量課金)
- noteは一般公開の公式投稿APIがなく、出力・手動連携のみで設計する
- ASPのリンク・広告コード改変禁止 (original_urlを無改変で保持)
- 景品表示法ステルスマーケティング規制への適合 (広告表記必須)
- 外部公開・予約投稿等の重要操作は人間の承認を必須とする

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | アフィリエイトURL登録から商品識別・情報収集・比較候補抽出・根拠付きデータ作成までを一元化する | G1 |
| I2 | 書き手・読者ペルソナと媒体ルールを入力に、ブログ・X・Instagram・Threads・note等の媒体別コンテンツを生成し人間承認を経て公開する | G1 |
| I3 | どういう情報がクリック率が高いか・アフィリエイトに有効かを管理できる分析・解析の仕組みを整える (クリック計測・成果突合・ディメンション分析・Insight Engine) | G2 |
| I4 | 分析結果を次のコンテンツ生成 (Brief提案・配信戦略) へ反映する。ただし商品評価・ランキングへは自動反映しない | G2, G1 |

## 実装の現在地 (implementation_snapshot)

> 正本 `spec-state.json` の `implementation_snapshot` をそのまま描く。取得時点: **2026-08-16T00:00:00+09:00**。
> **収集状態 (`status: confirmed`) とは別の軸である。**確定は要求判断の収集済みを表し、ここは実装の有無を表す。

### 実装済み (9 件)

- Next.js 16 + Cloudflare Workers/OpenNext
- 環境ごとに分離した単一D1 bindingとR2 binding
- 運営者ドメイン: asps/programs/conversions (workspace_idなし)
- 読者ドメイン Phase 1: categories/people/disclosures/products/articles/article_people/article_products/conversation_blocks 等
- 公開ゲート src/lib/content/publish-gate.ts (記事メタのみ)
- 案件一覧画面
- list_programs/record_conversion/get_revenue_summaryの3 Remote MCPツール
- navigator.modelContextを使う読み取りWebMCP PoC
- MCP_TOKENとsame-origin判定によるPoC認証

### 未実装 (6 件)

- Better Auth + Google OAuth
- Workspace/roleによるマルチテナント認可
- AffiliateLink/TrackingLink/ClickEvent/BehaviorEvent/MetricRollup/Attribution/Insight
- Editorial D1とCommercial-Analytics D1の物理分離とprojection/outbox
- Redirect Resolver StoreとQueue
- Analytics画面とInsightワークフロー

### 数えた基準ファイル

- `src/db/schema.ts`
- `src/lib/mcp/specs.ts`
- `src/lib/mcp/tools.ts`
- `src/lib/webmcp/client.ts`
- `src/app/page.tsx`
- `wrangler.jsonc`
- `package.json`

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| decision-auth-method | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | confirmed | opt-better-auth:Better Auth + Google OAuth (自己ホスト) / cost=無料 (ライブラリ無料。運用コストは自前ホスティング (既存 Workers 内) のみで追加費用なし) / free=OSS のため利用数制限なし / fit=マルチテナントSaaSの一般ユーザー認証に適合。Drizzle/D1 アダプタで現行スタックと同居し、§25 のロール権限と組み合わせやすい / pros=無料・OSS, D1/Drizzle アダプタで現行構成に統合, Google ログインに加えメール/パスワード・パスキーを後付け可能, ベンダーロックインなし / cons=認証基盤の運用 (アップデート・監視) が自前, 組織管理UIは自作が必要 / risks=OSS のメンテナンス状況に依存するためバージョン追従を保守運用に組み込む / lock-in=なし (自己ホスト・標準プロトコル) / ops=中 (ライブラリ更新とセッションストア運用) / evidence=https://www.better-auth.com/docs/introduction<br>opt-idaas:IDaaS (Clerk / Auth0) / cost=低コスト 月額3500 JPY (無料枠超過後は月間アクティブユーザー数課金。ユーザー増で費用が逓増) / free=Clerk: 10,000 MAU まで無料 (2026-08 時点) / fit=認証機能自体は充足するが、Workspace 単位のテナント分離は自前実装が残る / pros=運用負荷が最小, 組織管理・MFA が既製 / cons=ユーザー数課金, 外部サービス依存 / risks=ベンダーロックイン, 料金体系変更の影響を受ける / lock-in=高 (ユーザーデータ移行が必要) / ops=低 / evidence=https://clerk.com/pricing<br>opt-cf-access:Cloudflare Access (Zero Trust) / cost=無料 (50ユーザーまで無料。超過はシート課金) / free=50 ユーザーまで無料 / fit=社内ツールのアクセス制御向き。一般公開SaaSの会員登録・セルフサインアップには不適合 / pros=インフラと同一ベンダーで設定が容易 / cons=セルフサインアップに不向き, テナント概念がない / risks=利用者数拡大時にシート課金が急増する / lock-in=中 (Cloudflare 依存) / ops=低 / evidence=https://developers.cloudflare.com/cloudflare-one/policies/access/ | opt-better-auth — 費用ゼロ・ロックインなしで現行の D1/Drizzle/Workers 構成に統合でき、一般公開SaaSのセルフサインアップと §25 ロール権限の要件を満たす (注意: ライブラリ更新の追従を保守運用 (maintenance-ops) に組み込むこと, 組織 (Workspace) 管理UIは自作となる; confidence=high; checked=2026-08-16T00:00:00Z) | opt-better-auth @ 2026-08-16T00:00:00Z | G1 |
| decision-editorial-commercial-split | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | confirmed | opt-single-db-schema-split:D1 は 1 本のまま、テーブル名前空間と型で分ける / cost=無料 (追加費用なし。いまの構成（DB バインディング 1 本）のまま) / free=D1 無料枠の範囲内（現行と同じ 1 データベース） / fit=G2（成果の一元管理）には都合がよい。同じ DB なので集計を SQL の JOIN で書ける / pros=いまの構成から何も変えない, 集計クエリが 1 本で書ける, マイグレーションの管理先が 1 つ / cons=§19.4 の禁止（報酬を推薦スコアの入力にしない）を、コードの外から確かめられない, 禁止依存 FD-2 の担保が型だけになり、型を外せば通る / risks=境界を越える SQL が 1 本混ざっても、画面からは何も変わって見えない（残課題 51 と同じ形） / lock-in=なし / ops=低（現行のまま） / evidence=https://developers.cloudflare.com/d1/, https://orm.drizzle.team/docs/overview<br>opt-two-databases:D1 を 2 本に分け、バインディングを分ける（DB_EDITORIAL / DB_COMMERCIAL） / cost=無料 (D1 は無料枠内で複数データベースを持てるため追加費用なし。作業費は移行の 1 回ぶん) / free=D1 無料枠の範囲内（データベース数の上限は無料枠でも 1 本ではない） / fit=G1（安全な作成・公開）に直結。ランキング計算の関数へ Commercial のバインディングを渡さなければ、混ぜようがない / pros=§19.4 と FD-2 を、コードではなく構成で担保できる, 越境が git の差分に出る（wrangler.jsonc の変更として見える）, Commercial 側だけを別の保管期間・別の権限で扱える / cons=DB をまたぐ JOIN が書けない。突合はアプリ側で ID を突き合わせる, マイグレーションが 2 系統になる, 既存テーブルの引っ越しが 1 回必要 / risks=アプリ側の突合を書き間違えると、集計がずれる（SQL の JOIN より落ちにくいので気づきにくい）, 2 本の間で整合が必要な操作は、トランザクションで守れない / lock-in=なし（どちらも D1） / ops=中（マイグレーション 2 系統・バックアップ 2 本） / evidence=https://developers.cloudflare.com/d1/, https://orm.drizzle.team/docs/overview | opt-two-databases — 禁止（報酬額をランキングの入力にしない）は仕様の中でいちばん強い制約で、二層のどの経路からも迂回できない位置で担保すると 04 §2-4 が書いている。1 本のままだと、その位置がコードの中にしかない。2 本にすると、越えるには設定を書き換えるしかなくなり、越えたことが差分に残る。残課題 51 で実際に踏んだ「宣言だけが守っていて、画面からは何も変わって見えない」形を、ここでは最初から避けられる。 (注意: 既存テーブルの引っ越しが 1 回必要で、その回だけは本番データを触る, DB をまたぐ集計はアプリ側の突合になるため、突合のテストを先に書く, 分けたあとも、Commercial の値を関数の引数として渡せば混ざる。バインディングの分離は「うっかり」を防ぐが「意図」は防がない; confidence=high; checked=2026-08-19T00:00:00Z) | opt-two-databases @ 2026-08-19T00:00:00Z | G1, G2 |
| decision-redirect-measurement-async | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | confirmed | opt-waituntil-direct:ctx.waitUntil で D1 へ直接書く / cost=無料 (追加費用なし。いまの構成のまま) / free=D1 の書き込み無料枠の範囲内 / fit=G2（計測）を最短で満たす。転送は先に返すので読者を待たせない / pros=部品が増えない, 書いた瞬間に集計へ反映される, 実装がいちばん短い / cons=D1 が落ちている間のクリックは、記録が消える（退避先が無い） / risks=障害の時間帯だけ成果が欠測し、あとから埋められない / lock-in=なし / ops=低 / evidence=https://developers.cloudflare.com/workers/<br>opt-queues:Cloudflare Queues へ積み、consumer が D1 へ書く / cost=低コスト 月額750 JPY (Queues は Workers 有料プラン（$5/月、約 750 円）が前提。現在この契約が有効かは未確認で、本人確認が要る) / free=無料プランでは使えない（有料プランの中に含まれる） / fit=G2 の欠測をいちばん減らす。再試行と順序が仕組みとして付く / pros=再試行が仕組みとして付く, D1 の一時的な障害を吸収できる, 書き込みをまとめられる / cons=有料プランが前提, 部品が 1 つ増え、詰まったときの見張りが要る / risks=契約が無料プランのままだと、そもそも動かない（実装してから気づくと痛い） / lock-in=中（Cloudflare 固有。他所へ移すと書き直し） / ops=中（キューの滞留を見る必要がある） / evidence=https://developers.cloudflare.com/queues/<br>opt-waituntil-fallback-cron:ctx.waitUntil で D1 へ書き、失敗ぶんだけ R2 へ退避して Cron で回収する / cost=無料 (追加費用なし。Cron Triggers は無料枠にあり、退避は R2 の既存バケットを使う) / free=Cron Triggers・R2 とも既存の無料枠の範囲内 / fit=G2 の欠測を、有料プランを増やさずに減らせる。G1 の「転送は必達」も保てる / pros=無料枠のまま欠測を減らせる, 既に Cron Triggers を使っている（画面の写しの掃除、日本時間 2:00）ので、置き場が既にある, 契約状態に依存しない / cons=回収までに時差がある（最大 1 日）, 退避と回収のコードを自分で持つ / risks=回収の失敗が静かに起きうる。回収の結果を記録し、溜まったら気づける形にしないと、退避先が墓場になる / lock-in=低（Cron と R2 は置き換えやすい） / ops=中（回収の見張りが要る） / evidence=https://developers.cloudflare.com/workers/configuration/cron-triggers/, https://developers.cloudflare.com/r2/ | opt-waituntil-fallback-cron — 02 §7 と既存の qa は「転送は必達、計測はベストエフォート」と書いている。3 案とも転送は止めないので、差は欠測をどこまで減らすかと、その値段である。Queues がいちばん堅いが有料プランが前提で、いまその契約が有効かを私は確かめられない。退避＋Cron は無料枠のままで欠測をほぼ同じだけ減らせ、Cron の置き場は既にある。契約が確かめられたあとで Queues へ移ることもできる（退避のコードは捨てられる）。 (注意: 回収が静かに失敗すると退避先が墓場になる。回収した件数と残件数を記録し、残件が増え続けたら赤くする, 有料プランが既に有効なら Queues のほうが素直。契約状態は本人しか確かめられない, 最大 1 日の時差があるため、当日の速報値は「まだ確定していない」と画面に出す（03 §8 の速報と確定の区別）; confidence=medium; checked=2026-08-19T00:00:00Z) | opt-waituntil-fallback-cron @ 2026-08-19T00:00:00Z | G2, G1 |
| decision-llm-provider | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | confirmed | opt-single-anthropic:Anthropic 1 社に固定する / cost=有料 月額1 USD (従量課金。金額は生成量に比例し、下限は無い（1 は「0 ではない」ことを表す最小値）) / free=無料枠なし（従量課金のみ） / fit=G1 の品質は満たしやすいが、値上げ・提供停止のときに逃げ場が無い / pros=実装が最も短い, プロンプトを 1 社の癖に合わせて詰められる, 鍵の管理先が 1 つ / cons=値上げ・提供停止・品質変化のときに逃げ場が無い, 用途ごとに安いモデルを選べない / risks=1 社の障害が、生成機能そのものの停止になる / lock-in=高（プロンプトが 1 社の形に寄る） / ops=低 / evidence=https://docs.claude.com/<br>opt-catalog-multi:単価表（config/llm-provider-catalog.json）を正本に、複数社を差し替え可能にする（現行） / cost=有料 月額1 USD (従量課金。用途ごとに安いモデルを選べるぶん、1 社固定より下がる方向に動く) / free=無料枠なし（従量課金のみ） / fit=G1 に適合。長い記事は高いモデル、判定は安いモデル、と用途で分けられる / pros=既に実装されている（wrangler の LLM_PROVIDER_CATALOG と同期の検査つき）, 単価が vars にあるので、値上げに気づける（secret にすると読めなくなる）, 1 社が落ちても他社へ回せる / cons=鍵が増える, プロバイダごとの出力差を吸収する層が要る / risks=どの社をどの用途に当てるかが決まっていないと、いちばん高い社が既定になりがち / lock-in=低 / ops=中（単価表の更新が要る。更新は catalog:sync がある） / evidence=https://docs.claude.com/, https://ai.google.dev/gemini-api/docs, https://platform.openai.com/docs<br>opt-workers-ai:Workers AI（Cloudflare のモデル）を主にする / cost=低コスト 月額750 JPY (Workers 有料プランの中に無料枠があり、超過分が従量。現在の契約状態は未確認) / free=有料プランに日次の無料枠がある（無料プランでは使えない） / fit=G1 の品質要求（根拠つきの長文）に対しては、モデルの選択肢が狭い / pros=鍵を持たなくてよい, 同じプラットフォーム内で完結し、遅延が小さい, 無料枠がある / cons=長文・根拠つきの生成では選べるモデルが限られる, 有料プランが前提 / risks=品質が足りずに結局よそへ出すことになり、両方の実装を抱える / lock-in=高（Cloudflare 固有） / ops=低 / evidence=https://developers.cloudflare.com/workers-ai/, https://developers.cloudflare.com/ai-gateway/ | opt-catalog-multi — 既に実装があり、単価表を vars に置いて値上げに気づけるようにしてある。07 §0 の GC-5（レビュー系は執筆系と分離し、自作自演の検証にしない）は、書き手と検査役に別のモデルを当てられるほうが素直に満たせる。1 社固定はいまより短くなるが、既にある仕組みを捨てることになる。 (注意: 鍵が社数ぶん増える。登録は本人がブラウザで行い、こちらでは受け取らない（11 §5）, どの用途にどの社を当てるかが未定のままだと、いちばん高い社が既定になる。用途ごとの既定を決める必要がある, 単価表の pricedOn は 2026-08-18 のまま。実費の見積りは llm-cost-simulator で別途取る; confidence=medium; checked=2026-08-19T00:00:00Z) | opt-catalog-multi @ 2026-08-19T00:00:00Z | G1 |
| decision-ui-theme-implementation | 配色と明暗の 2 軸を、どの技術で実装するか | confirmed | opt-css-light-dark:CSS の light-dark() と data 属性（配色は属性、明暗は color-scheme） / cost=無料 (追加費用なし。ブラウザの標準機能) / free=制限なし / fit=09 §2 の 2 軸モデルをそのまま表現できる。掛け合わせを設定値にしない / pros=配色を 1 つ増やしても設定値は 1 つしか増えない, 部品ごとに明暗の分岐を書かなくてよい（09 §5）, 依存を増やさない / cons=light-dark() を解さない古いブラウザでは既定色になる / risks=色の定義が CSS に散ると、コントラストの下限を測る場所が分かりにくくなる / lock-in=なし（標準） / ops=低 / evidence=https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark<br>opt-tailwind-dark-class:Tailwind の dark: クラスと、配色ごとのクラス群 / cost=無料 (追加費用なし。Tailwind は既に入っている) / free=制限なし / fit=掛け合わせがクラス名に出る。配色 × 明暗の数だけクラスが増え、09 §2 が禁じた形に近づく / pros=既に Tailwind を使っている, 書いた場所で色が読める / cons=配色を 1 つ増やすたびに、全部品のクラスが増える, 部品の中に明暗の分岐が書かれる（09 §5 が禁じている） / risks=増やすのが面倒になり、配色を増やさない方向へ運用が寄る / lock-in=中（Tailwind の書き方に寄る） / ops=中 / evidence=https://tailwindcss.com/docs/dark-mode | opt-css-light-dark — 09 §2 は「掛け合わせを設定として持たない」と書いており、light-dark() は掛け合わせを CSS 側で解く仕組みそのものである。Tailwind のクラス方式は、禁じられている掛け合わせがクラス名として現れる。Tailwind は配置と余白に使い、色だけこの方式にすれば両方使える。 (注意: 色の定義を 1 か所へ集めないと、コントラストの下限（09 §4）を測る対象が散る, cookie と URL から来る名前は必ず解析関数を通す（09 §2-2）。素通しにすると壊れて見えない画面になる, light-dark() を解さない環境では既定色になる。それが読める色であることを確かめる; confidence=high; checked=2026-08-19T00:00:00Z) | opt-css-light-dark @ 2026-08-19T00:00:00Z | G1 |
| decision-test-ci-tooling | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | confirmed | opt-keep-current:現行のまま（Vitest / Stryker / fast-check / axe-core / GitHub Actions） / cost=無料 (追加費用なし。公開リポジトリの標準ランナーは無料・無制限（11 §8-1 の実測）) / free=公開リポジトリでは実行時間の制限なし / fit=10 の 7 種のうち、単体・契約・境界値・ミューテーション・性質・読み上げを既に覆っている / pros=既に 181 のテストファイルが動いている, 3 段の置き場が既にあり、重いものを移せる（11 §8-2）, 道具を増やさないぶん、守るものが増えない / cons=見た目の回帰（ビジュアルリグレッション）を測る道具が無い / risks=見た目の崩れは、画面のテストでは捕まらないまま残る / lock-in=低 / ops=低（現行のまま） / evidence=https://vitest.dev/, https://stryker-mutator.io/docs/, https://docs.github.com/en/actions<br>opt-add-playwright:Playwright を足し、3 段で見た目の回帰と実ブラウザの通しを測る / cost=無料 (公開リポジトリの標準ランナーは無料。実行時間が伸びるが 11 §8-1 のとおり費用ではない) / free=公開リポジトリでは実行時間の制限なし / fit=10 §7 の見た目の回帰を初めて測れる。9 の配色 × 明暗の組み合わせを実際に描いて確かめられる / pros=配色を増やしたときに、全組み合わせのコントラストを実描画で測れる, 3 段（手動・止めない）に置けるので、速い門は重くならない / cons=画像の基準を持つことになり、基準の更新が新しい仕事として増える, 3 段は誰かが打たないと走らない（11 §8-2）。打つ場面を書かないと存在しない検査になる / risks=基準画像の更新が面倒になり、落ちたら基準を上書きする運用に流れる（それは閾値を下げるのと同じ） / lock-in=低 / ops=中（基準画像の管理） / evidence=https://playwright.dev/, https://vitest.dev/ | opt-keep-current — 結論は現行のままだが、これは「Playwright は不要」という判断ではない。10 の 7 種のうち見た目の回帰だけは現行で測れておらず、その穴は実在する。足さない理由は必要性ではなく走らせ方にある。11 §8-2 の 3 段 (手動・止めない) は 2026-08-18 に定例をやめており、いま基準画像を持つ検査を足すと、誰も打たない検査が 1 つ増えるだけになる。基準画像は、打たれないあいだ古くなり続け、次に打った人が「全部落ちるので基準を上書きする」に流れる。それは閾値を下げるのと同じである。したがって、走る段が決まるまで保留する。保留のあいだ穴は開いたままなので、穴そのもの(見た目の崩れを自動で見つける手段が無いこと) を本文ではなく検査として固定し、画像比較の仕組みが足された日に赤くなる形にしておく (ah-h57)。 (注意: これは「不要と判断した」ではなく「走る段が決まるまで保留した」である。次に読む人が前者と読み違えないよう、この一文を消さない —— 【2026-08-20 追記。上の一文は原文のまま残してある】2026-08-20、利用者本人が opt-keep-current を直接選び、状態は保留から確定へ変わった。したがって現在の事実は「現行の 7 種で足りていると確定した」である。上の一文は保留を確定と読み違えさせないために置かれた。いまは逆向き (確定を保留と読み違える) を防ぐ必要が生じたので、同じ目的のために追記した。消去ではなく更新である。, 保留のあいだ、見た目の回帰は測れない。穴は ah-h57 の検査として固定してあり、本文ではなく検査が現状を知らせる, 見直しの引き金は 2 つ: 3 段を打つ場面が決まったとき / 配色を 1 つ増やす作業が決まったとき。どちらか先に来たほうで再評価する。確定は「もう二度と見直さない」という意味ではない, 足すと決めたときは、同じ回に「いつ打つか」を文書へ書く。場面を書かずに足すと、名前だけの検査になる; confidence=medium; checked=2026-08-19T00:00:00Z) | opt-keep-current @ 2026-08-20T00:00:00Z | G1, G2 |
| decision-screen-priority | ui-ux×web の画面で、先頭に何を置くか。UIUX-REQ-001 は「今、利用者が判断・回復すべき業務状態」を先頭に置くと書いており、qa-uiux-web-screen-priority の本人回答は「記事の成績比較」を先頭に置くと言っている。両者は先頭の 1 つを争っている | confirmed | opt-performance-first:記事の成績比較を先頭に置き、回復すべき業務状態はその下に常設の帯として置く / cost=無料 (画面の並び順の決定であり、追加費用は生じない) / free=制限なし / fit=G2「どういう情報・切り口・媒体・配置がクリック率とアフィリエイト成果に有効かを計測・分析し、一元管理できる」に直結する。成績比較は毎日見る対象で、開いた理由そのものである / pros=利用者本人が「これが先頭」と逐語で答えている（qa-uiux-web-screen-priority）, 毎回開く理由と先頭が一致するので、目的の情報まで到達する操作が 0 回になる, 回復すべき状態は件数が 0 の日が多く、0 件の枠が先頭を占め続ける形を避けられる / cons=回復作業が必要な日に、それが 2 番目になる, UIUX-REQ-001 の本文と先頭が食い違うため、要件 ID 側の更新が別途要る / risks=回復すべき状態の帯が視覚的に弱いと、要対応が放置される。帯には未対応時のみ色と件数を出す必要がある / lock-in=なし（並び順の変更はいつでもできる） / ops=低 / evidence=https://developer.apple.com/design/human-interface-guidelines/layout<br>opt-recovery-first:回復すべき業務状態を先頭に置き、記事の成績比較はその下に置く（UIUX-REQ-001 の現行本文どおり） / cost=無料 (画面の並び順の決定であり、追加費用は生じない) / free=制限なし / fit=G1 の「安全に作成・公開・改善できる」に寄る。壊れている状態を先に見せることで、気づかないまま公開が続く事態を防ぐ / pros=要対応が確実に目に入る, UIUX-REQ-001 の本文をそのまま実装でき、要件 ID の更新が要らない / cons=要対応が 0 件の日は、空の枠が先頭を占める, 利用者本人の回答と食い違う / risks=0 件の枠を毎日見ることで、先頭の領域そのものが読み飛ばされるようになる。そうなると要対応が出た日にも気づかれない / lock-in=なし / ops=低 / evidence=https://sre.google/sre-book/monitoring-distributed-systems/ | opt-performance-first — 先頭を争う 2 つのうち、片方は「毎日ある」もの、もう片方は「たまにある」ものである。たまにあるものを常に先頭へ置くと、無い日の空枠が先頭を占め、その領域自体が読み飛ばされる。SRE book が alerting について述べている「対応不要な通知は、対応が要る通知の信頼を削る」と同じ構造が、画面の先頭でも起きる。成績比較を先頭に置き、回復すべき状態は「未対応があるときだけ色と件数が出る帯」として先頭のすぐ下に常設するのが、両方を満たす形である。 (注意: UIUX-REQ-001 の本文は、この決定を根拠に設計側で別途更新すること。収集の記録が要件 ID の本文を書き換えると、いつ誰が変えたかが消える（system-spec/ui-ux.md L140）, 回復すべき状態の帯は、未対応 0 件のとき表示そのものを消すのではなく、高さを保ったまま無彩色にする。消すと下の内容が毎日ずれる, 「成績比較」が何と何の比較かは、この決定では確定していない。比較軸の設計は別の課題として残る; confidence=high; checked=2026-08-22T00:00:00Z) | opt-performance-first @ 2026-08-22T00:00:00Z | G1, G2 |

- 内訳 (分母 = 正本 `spec-state.json` の `decisions[]` 全 7 件): `confirmed` 7 件。利用者確定日: 2026-08-16T00:00:00Z 〜 2026-08-22T00:00:00Z。
