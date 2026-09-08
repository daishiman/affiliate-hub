---
graph_node_id: "feat-seo-aeo-analysis-feedback"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["seo","aeo","analysis","editor","publish-gate","feedback-loop"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "SEO/AEO 充足度の解析とエディター差し戻し"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T00:00:00Z"
status: "tombstoned"
closed_at: "2026-09-04T00:00:00Z"
depends_on: []
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["src","drizzle","system-spec","features/feat-seo-aeo-analysis-feedback.context.json"]
purpose: "公開記事の機械可読要素の充足度を記事の実データから解析し、欠落を「どの記事のどこが何を欠いているか」まで名指しして書き手のエディターへ返す。充足率を数えるだけでは記事は直らない。直せる場所へ差し戻して初めて閉じる。"
goal: "確定 decision のとおり、解析が公開ゲートと定期実行の両方で走り (dec-aeo-analysis-trigger = opt-publish-gate-plus-scheduled)、判定根拠のガイドライン参照が固定間隔で再確認され陳腐化が旗で見える (dec-guideline-registry-recheck = opt-fixed-interval-with-staleness-flag)、解析結果が窓付き追記で履歴として残り推移を追える (dec-analysis-history-retention = opt-append-with-window) 状態で、O3 の充足率と公開前検出割合が計測できるようになっている"
scope_in: ["記事の実データを入力に SEO/AEO 充足度を判定する解析器 (構造化データ必須種別・見出し階層・画像 alt と width/height・canonical・広告 rel)","公開ゲートでの解析実行と、公開後の定期実行 (両方・dec-aeo-analysis-trigger)","判定根拠となるガイドライン参照レジストリの固定間隔再確認と staleness flag","解析結果の D1 保持 (窓付き追記・dec-analysis-history-retention)","エディター上での欠落の名指し提示 (該当見出し・該当画像・該当リンクへ直接飛べる)","書きながら素材が揃う編集体験: 見出し階層・画像 alt・内部リンク・構造化データの素材が入力欄として編集画面に存在し、公開前に欠落が見える (I8)","O3 指標 (公開記事あたりの充足率・公開前に検出された欠落の割合) の算出と表示"]
scope_out: ["機械可読要素そのものの生成 (feat-seo-aeo-machine-readable)","外部順位データ・検索順位の推測に基づく判断","クリック・成果のアトリビューション分析 (feat-analytics-insight)","記事本文の自動書き換え (指摘は提示するが本文を勝手に直さない)","管理画面全体の画面分割・共通部品化 (feat-uiux-overhaul)"]
acceptance: ["記事を公開しようとすると解析が走り、必須要素の欠落があるものは欠落の一覧と該当箇所を示して公開ゲートで止まる","定期実行が既存の公開済み記事を解析し、公開後に生じた欠落 (参照切れ・画像差し替えによる alt 欠落等) を検出する","エディター上で欠落が該当箇所へのリンク付きで提示され、その場で直して再判定できる","解析結果が窓付きで追記保持され、1 記事の充足率の推移を期間指定で参照できる","ガイドライン参照レジストリが固定間隔で再確認され、期限を過ぎた参照は staleness flag が立ち、判定結果にその旨が併記される","O3 の 2 指標 (充足率・公開前検出割合) が算出され、初回は current=未計測 として基準値取得から始まり、根拠のない target を確定しない","解析は記事の実データだけを入力とし、外部順位データの推測を判定根拠にしない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-seo-aeo-analysis-feedback.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"2e3b834654f7407de7a5408d25a79eda49a7e8a216f3abfb92748e0a039bb741","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"29c9e6c7be6c64d71cc39c3575795f6211a47129a089deb10f0a5971c9002f2c","source_path":"system-spec/backend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "撤回。実装コードと突き合わせた結果、本 feature の scope_in の大半が feat-blog-ui-builder で既に実装済みだった (src/application/seo/structured-data.ts の JSON-LD 導出、src/application/usecases/seo/manage-guideline-references.ts の出典レジストリ、src/application/seo/ai-search-audit.ts と publish-article.ts の公開時点検)。feature の scope 記述だけを見て未被覆と判断したのが誤り。真に未実装だった 3 項目 (HowTo/Speakable の JSON-LD・解析履歴の保持・定期再解析) は feat-seo-aeo-gap-closure へ移した。"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-seo-aeo-analysis-feedback.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

公開記事の機械可読要素の充足度を記事の実データから解析し、欠落を「どの記事のどこが何を欠いているか」まで名指しして書き手のエディターへ返す。充足率を数えるだけでは記事は直らない。直せる場所へ差し戻して初めて閉じる。

## 到達状態

確定 decision のとおり、解析が公開ゲートと定期実行の両方で走り (dec-aeo-analysis-trigger = opt-publish-gate-plus-scheduled)、判定根拠のガイドライン参照が固定間隔で再確認され陳腐化が旗で見える (dec-guideline-registry-recheck = opt-fixed-interval-with-staleness-flag)、解析結果が窓付き追記で履歴として残り推移を追える (dec-analysis-history-retention = opt-append-with-window) 状態で、O3 の充足率と公開前検出割合が計測できるようになっている

## スコープ

### スコープ内

- 記事の実データを入力に SEO/AEO 充足度を判定する解析器 (構造化データ必須種別・見出し階層・画像 alt と width/height・canonical・広告 rel)
- 公開ゲートでの解析実行と、公開後の定期実行 (両方・dec-aeo-analysis-trigger)
- 判定根拠となるガイドライン参照レジストリの固定間隔再確認と staleness flag
- 解析結果の D1 保持 (窓付き追記・dec-analysis-history-retention)
- エディター上での欠落の名指し提示 (該当見出し・該当画像・該当リンクへ直接飛べる)
- 書きながら素材が揃う編集体験: 見出し階層・画像 alt・内部リンク・構造化データの素材が入力欄として編集画面に存在し、公開前に欠落が見える (I8)
- O3 指標 (公開記事あたりの充足率・公開前に検出された欠落の割合) の算出と表示

### スコープ外

- 機械可読要素そのものの生成 (feat-seo-aeo-machine-readable)
- 外部順位データ・検索順位の推測に基づく判断
- クリック・成果のアトリビューション分析 (feat-analytics-insight)
- 記事本文の自動書き換え (指摘は提示するが本文を勝手に直さない)
- 管理画面全体の画面分割・共通部品化 (feat-uiux-overhaul)

## 受入

- [ ] 記事を公開しようとすると解析が走り、必須要素の欠落があるものは欠落の一覧と該当箇所を示して公開ゲートで止まる
- [ ] 定期実行が既存の公開済み記事を解析し、公開後に生じた欠落 (参照切れ・画像差し替えによる alt 欠落等) を検出する
- [ ] エディター上で欠落が該当箇所へのリンク付きで提示され、その場で直して再判定できる
- [ ] 解析結果が窓付きで追記保持され、1 記事の充足率の推移を期間指定で参照できる
- [ ] ガイドライン参照レジストリが固定間隔で再確認され、期限を過ぎた参照は staleness flag が立ち、判定結果にその旨が併記される
- [ ] O3 の 2 指標 (充足率・公開前検出割合) が算出され、初回は current=未計測 として基準値取得から始まり、根拠のない target を確定しない
- [ ] 解析は記事の実データだけを入力とし、外部順位データの推測を判定根拠にしない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 参照のみで内容は複製しない。仕様本文の正本は `system-spec/backend.md` (digest `29c9e6c7be6c64d7`)。

## 機能間依存

- `depends_on`: `feat-seo-aeo-machine-readable`, `feat-reference-blog-admin-ux`
- 依存理由: 解析は『何が出ているはずか』の定義を feat-seo-aeo-machine-readable から借りる。生成側が未定のまま解析器を作ると、判定基準が解析側に二重定義される。差し戻し先のエディター体験は feat-reference-blog-admin-ux が持つ管理 UX の上に置く。

## Handoff

- per-feature planning: 機能間 depends_on が満たされた時点で `run-system-dev-plan` を起動する。人間の `/system-dev-plan` 実行結果も同じ登録経路 (graph_node_id + source_digest を冪等キー) で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-seo-aeo-analysis-feedback` と同一 `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)。
- 完了 rollup: exact 13 が全て done で、P07/P10/P11 の evidence が上の受入条件を満たしたときだけ feature を done にする。
