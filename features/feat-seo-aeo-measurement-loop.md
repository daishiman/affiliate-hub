---
graph_node_id: "feat-seo-aeo-measurement-loop"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["seo","aeo","aio","search-console","citation-check","measurement","cron"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "SEO/AEO の自前計測と反映ループ (静的解析・Search Console・AI 被引用の 3 データ源)"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-07T23:39:50.162539Z"
status: "draft"
depends_on: ["feat-reader-surface","feat-analytics-insight","feat-blog-subdomain-routing"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","system-spec","docs/spec"]
purpose: "SEO と AEO の良し悪しを推測ではなく自前の計測で判断し、その結果をブログの構成へ戻せるようにする"
goal: "3つのデータ源を定期観測し、同じブログ・ページの課題と実績推移を確認できる。元記事の作成日時で対象と判定した記事について、運営者が承認した変更差分だけを版比較と一括保存で反映し、安全に取り消せる。夜間処理は観測のみとする。"
scope_in: ["データ源①サイト内静的解析: 自サイトの公開 HTML から title / meta description / canonical / OGP / JSON-LD / 見出し階層 / 内部リンク / 画像 alt と寸法 / llms.txt の有無を自前で抽出し、規則違反をページ単位の課題として記録する","データ源②Google Search Console 連携: Search Analytics API から クエリ・ページ・表示回数・クリック・平均掲載順位 を取得して保存する。資格情報はサーバー環境変数からのみ読み、リポジトリ・管理画面・ログに保存しない","データ源③AI 検索での被引用チェック: 自前の質問セットを AI 検索へ投げ、自サイトが引用されたか・どの URL が引用されたかを記録する。費用が件数に比例するため実行上限と頻度を設定できる (system-spec/backend.md 「被引用チェックの費用が比例する量」)","3 データ源を同じページ識別子へ突合する解析基盤と履歴保持・保持期間","課題から改善案の導出: 静的解析の所見を根拠に差分を作り、記事と変更前後を運営者が確認する。Search ConsoleとAI被引用の観測は同じページの推移を理解する材料であり、未承認の改稿や因果効果の断定に用いない。","管理画面のSEO/AEOダッシュボード: ブログ・記事の選択、課題一覧、観測時刻付き実績推移、変更前後の差分承認、反映履歴、版競合を保護した取消、反映の停止/再開。","承認した差分の安全な反映: 元記事の作成日時が導入時刻より後と確認できる記事だけを対象にする。記事更新・変更前後の履歴・所見状態を同一確定単位で保存し、失敗時は全体不変。承認対象と読取版を照合し、同時編集や取消前の追加編集を上書きしない。公開日を作成日に代用せず、日時不明も除外して理由を示す。","定期実行（Cron Trigger）は3データ源の観測と所見提示のみ。失敗と系統別最終収集時刻を記録し、次回の実行を妨げない。夜間処理から改稿を自動起動せず、反映停止中も収集を継続する。"]
scope_out: ["アフィリエイト成果のイベント計測・アトリビューション・KPI (feat-analytics-insight)","JSON-LD / llms.txt / sitemap.xml / robots.txt の生成そのもの (feat-blog-ui-builder)","有料広告の効果測定、外部 SEO SaaS の利用","未承認の自動反映、夜間の改稿、導入前または作成日時不明の記事へのこの経路からの反映、版競合時の上書き、一部のみ保存される反映/取消、観測値だけによる施策の因果効果の断定。","検索エンジンへの順位操作を目的とした手法"]
acceptance: ["3 データ源がそれぞれ単独で実行でき、1 つが失敗しても他の結果が失われない","静的解析が公開 HTML から title / description / canonical / OGP / JSON-LD / 見出し / 内部リンク / 画像 alt と寸法を抽出し、規則違反をページ単位で列挙する","Search Console の資格情報がサーバー環境変数からのみ読まれ、リポジトリ・管理画面・ログのいずれにも現れないことを機械検査で確認できる","被引用チェックの実行件数に上限を設定でき、上限到達時は記録して停止する","同じworkspace・ブログ・ページの3データ源を系統別に突合し、観測時刻付きの実績推移を表示する。未観測と0、期間絞り込みと最新N件を区別し、クリック・順位・被引用の変化を因果効果と呼ばない。","記事と変更前後の差分を承認するまで公開内容は変わらず、承認した対象だけを保存する。対象は元記事の作成日時で導入後と確認できる記事に限り、導入前・日時不明は理由を示して除外する。記事更新・変更履歴・所見状態は一括確定し、失敗/同時編集時は全体不変。","反映を次回の静的解析で確認できる。取消は現在版が当該反映後の版と一致する場合だけ記事復元と取消記録を一括確定し、追加編集を上書きしない。反映停止中も収集は継続し、通常公開・編集の版保護も回帰しない。","定期実行は観測と所見提示だけを行い、改稿を起動しない。失敗した回と理由を記録し、他系統の結果と次回の実行を保持する。"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-seo-aeo-measurement-loop.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "stale"
confirmation_evidence: {"evaluated_digest":"46209e547af534e49404d69ee60347cc4e61a4351d2310c497f51b36ee745eda","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-seo-aeo-measurement-loop/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"29aa61a24c6d2c8f117b334d8dc386e163f8a9e1f62a31f8ef3210e6ab8866dc","source_path":"system-spec/backend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望「AEO/SEO 対策を分析・解析してブログへ反映する仕組み」および「3 データ源をすべて自作」を C14 macro 分解で 1 feature 化。feat-analytics-insight はアフィリエイト成果の計測であり SEO/AEO の順位・被引用を含まないため責務は重ならない。system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6 / qa-decision-aeo-data-sources-v5 に接地"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-seo-aeo-measurement-loop.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-yxjg","github_mirror":null,"linked_at":"2026-09-04T07:33:08Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

SEO と AEO の良し悪しを推測ではなく自前の計測で判断し、その結果をブログの構成へ戻せるようにする

## 現行契約の承認

2026-09-06、利用者の「つづけて」により、提示済みSEO変更提案が承認された。正規QAは `qa-seo-approved-diff-20260906`、承認記録は `approval-seo-approved-diff-20260906`。以前の自動反映・事後通知という方針は本機能の現行契約ではない。旧QAと公開済み計画packageは履歴として保持し、旧packageの評価PASSを変更後の受入の評価へ流用しない。

## 到達状態

3つのデータ源を定期観測し、同じブログ・ページの課題と実績推移を確認できる。元記事の作成日時で対象と判定した記事について、運営者が承認した変更差分だけを版比較と一括保存で反映し、安全に取り消せる。夜間処理は観測のみとする。

## スコープ

- スコープ内:
  - データ源①サイト内静的解析: 自サイトの公開 HTML から title / meta description / canonical / OGP / JSON-LD / 見出し階層 / 内部リンク / 画像 alt と寸法 / llms.txt の有無を自前で抽出し、規則違反をページ単位の課題として記録する
  - データ源②Google Search Console 連携: Search Analytics API から クエリ・ページ・表示回数・クリック・平均掲載順位 を取得して保存する。資格情報はサーバー環境変数からのみ読み、リポジトリ・管理画面・ログに保存しない
  - データ源③AI 検索での被引用チェック: 自前の質問セットを AI 検索へ投げ、自サイトが引用されたか・どの URL が引用されたかを記録する。費用が件数に比例するため実行上限と頻度を設定できる (system-spec/backend.md 「被引用チェックの費用が比例する量」)
  - 3 データ源を同じページ識別子へ突合する解析基盤と履歴保持・保持期間
  - 課題から改善案の導出: 静的解析の所見を根拠に差分を作り、記事と変更前後を運営者が確認する。Search ConsoleとAI被引用の観測は同じページの推移を理解する材料であり、未承認の改稿や因果効果の断定に用いない。
  - 管理画面のSEO/AEOダッシュボード: ブログ・記事の選択、課題一覧、観測時刻付き実績推移、変更前後の差分承認、反映履歴、版競合を保護した取消、反映の停止/再開。
  - 承認した差分の安全な反映: 元記事の作成日時が導入時刻より後と確認できる記事だけを対象にする。記事更新・変更前後の履歴・所見状態を同一確定単位で保存し、失敗時は全体不変。承認対象と読取版を照合し、同時編集や取消前の追加編集を上書きしない。公開日を作成日に代用せず、日時不明も除外して理由を示す。
  - 定期実行（Cron Trigger）は3データ源の観測と所見提示のみ。失敗と系統別最終収集時刻を記録し、次回の実行を妨げない。夜間処理から改稿を自動起動せず、反映停止中も収集を継続する。
- スコープ外:
  - アフィリエイト成果のイベント計測・アトリビューション・KPI (feat-analytics-insight)
  - JSON-LD / llms.txt / sitemap.xml / robots.txt の生成そのもの (feat-blog-ui-builder)
  - 有料広告の効果測定、外部 SEO SaaS の利用
  - 未承認の自動反映、夜間の改稿、導入前または作成日時不明の記事へのこの経路からの反映、版競合時の上書き、一部のみ保存される反映/取消、観測値だけによる施策の因果効果の断定。
  - 検索エンジンへの順位操作を目的とした手法

## 受入正本レジストリ

- canonical source: `features/feat-seo-aeo-measurement-loop.md#frontmatter.acceptance`
- planner projection: `features/feat-seo-aeo-measurement-loop.context.json#/acceptance`
- ID mapping: 配列の1始まり順番を `A1`〜`A8` に対応させる。

受入文言はfrontmatterを正本とし、本文に二重保持しない。contextは同じ値の機械投影であり、実装要件・タスク・証跡はcanonical IDを参照する。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 計測は読者面の公開 HTML を入力とし、結果は運営者面のダッシュボードへ出る。入力と出力が二層をまたぐため arch-two-layer-platform に接地させる。仕様本文は system-spec/backend.md と maintenance-ops.md の確定章を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-reader-surface, feat-analytics-insight, feat-blog-subdomain-routing
- 依存理由:
  - feat-reader-surface: 計測対象である公開 HTML の構造 (§18 SEO・AI 検索・機械可読性) が定まっていないと、静的解析の規則を定義できない
  - feat-analytics-insight: ページ識別子とディメンションモデルを共有して突合するため、成果計測側の次元定義に従う
  - feat-blog-subdomain-routing: Search Console はホスト単位で権限を持つため、ブログの住所解決が先に決まっていないと連携先を確定できない

## Handoff

- per-feature planning: ready 到達後に system-dev-planner (`run-system-dev-plan`) を
  `--feature-id feat-seo-aeo-measurement-loop` と `--feature-context features/feat-seo-aeo-measurement-loop.context.json` で起動する。
  人間の手動 `/system-dev-plan` 実行結果も同じ登録経路 (C02 `register-package`) で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node の intra-feature DAG
- 登録先: 全 task を `parent_feature=feat-seo-aeo-measurement-loop` と共通 `feature_package_id` で C02 経由 atomic 登録する。expected/applied=13 を必須とする
- 完了 rollup: exact 13 が全て done で、かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ feature を done にする
