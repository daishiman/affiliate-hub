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
created_at: "2026-08-16T12:08:04Z"
updated_at: "2026-08-16T12:08:04Z"
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
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:08:04Z","origin_kind":"system-spec-harness","source_digest":"7417024d0735df8d693ac23f5fb358472804c87d9608bf02087b5c790cc95b5f","source_path":"system-spec/00-requirements-definition.md","source_plugin":"system-spec-harness","source_version":"0.1.0"}
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
completion_evidence: {"completed_at":"2026-08-16T12:08:04Z","evidence_refs":["system-spec/completeness-report.json"],"policy":"manual","reconciled_at":"2026-08-16T12:08:04Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-16T12:08:04Z","missing_sections":[],"status":"complete"}
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed` (要求判断の収集済みを表す。実装完了・試験合格ではない)
- 状態の正本: `spec-state.json` の `lifecycle` と `review_runs`
- 実装の現在地: 単一D1、`asps/programs/conversions`、案件一覧、Remote MCP/WebMCPの3ツールによるPoC。Better Auth、Workspace、TrackingLink、イベント基盤、二D1、Resolver/Queue、Analytics画面は未実装

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

- **対象 (in)**: マルチテナント, 複数ブランド・複数ブログ構築, アフィリエイトURL登録・商品情報抽出・商品データベース, 比較候補抽出, 書き手・読者ペルソナ, AI文章生成・投稿パターン生成, SNS連携・投稿カレンダー, アフィリエイトリンク管理, クリック・成果分析, 更新管理・広告法令確認, WebMCP・バックエンドMCP・API, チーム権限・承認フロー
- **対象外 (out)**: 他サイトの無断複製・規約違反スクレイピング, CAPTCHA等の回避, 架空の体験・資格, 無確認の大量自動投稿・スパム, 報酬額基準のランキング, アフィリエイトリンクの無断改変, 非公式note APIへの依存, 投稿先ポリシーを無視した自動化

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

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| decision-auth-method | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | confirmed | opt-better-auth:Better Auth + Google OAuth (自己ホスト) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': 'ライブラリ無料。運用コストは自前ホスティング (既存 Workers 内) のみで追加費用なし'} / free=OSS のため利用数制限なし / fit=マルチテナントSaaSの一般ユーザー認証に適合。Drizzle/D1 アダプタで現行スタックと同居し、§25 のロール権限と組み合わせやすい / pros=無料・OSS, D1/Drizzle アダプタで現行構成に統合, Google ログインに加えメール/パスワード・パスキーを後付け可能, ベンダーロックインなし / cons=認証基盤の運用 (アップデート・監視) が自前, 組織管理UIは自作が必要 / risks=OSS のメンテナンス状況に依存するためバージョン追従を保守運用に組み込む / lock-in=なし (自己ホスト・標準プロトコル) / ops=中 (ライブラリ更新とセッションストア運用) / evidence=https://www.better-auth.com/docs/introduction<br>opt-idaas:IDaaS (Clerk / Auth0) / cost={'category': 'low-cost', 'amount': 3500, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '無料枠超過後は月間アクティブユーザー数課金。ユーザー増で費用が逓増'} / free=Clerk: 10,000 MAU まで無料 (2026-08 時点) / fit=認証機能自体は充足するが、Workspace 単位のテナント分離は自前実装が残る / pros=運用負荷が最小, 組織管理・MFA が既製 / cons=ユーザー数課金, 外部サービス依存 / risks=ベンダーロックイン, 料金体系変更の影響を受ける / lock-in=高 (ユーザーデータ移行が必要) / ops=低 / evidence=https://clerk.com/pricing<br>opt-cf-access:Cloudflare Access (Zero Trust) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '50ユーザーまで無料。超過はシート課金'} / free=50 ユーザーまで無料 / fit=社内ツールのアクセス制御向き。一般公開SaaSの会員登録・セルフサインアップには不適合 / pros=インフラと同一ベンダーで設定が容易 / cons=セルフサインアップに不向き, テナント概念がない / risks=利用者数拡大時にシート課金が急増する / lock-in=中 (Cloudflare 依存) / ops=低 / evidence=https://developers.cloudflare.com/cloudflare-one/policies/access/ | opt-better-auth — 費用ゼロ・ロックインなしで現行の D1/Drizzle/Workers 構成に統合でき、一般公開SaaSのセルフサインアップと §25 ロール権限の要件を満たす (注意: ライブラリ更新の追従を保守運用 (maintenance-ops) に組み込むこと, 組織 (Workspace) 管理UIは自作となる; confidence=high; checked=2026-08-16T00:00:00Z) | opt-better-auth @ 2026-08-16T00:00:00Z | G1 |
