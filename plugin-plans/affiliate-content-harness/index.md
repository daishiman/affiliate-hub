---
id: IDX0
title: affiliate-content-harness 開発計画 index (main)
shape_marker: fixed-13-phase
plugin_meta:
  manifest:
    required: true
    path: .claude-plugin/plugin.json
    name_matches_folder: true
    no_unresolved_placeholders: true
    validate_plugin: true
  marketplace:
    default_personal: true
    policy:
      installation: NOT_AVAILABLE
      authentication: ON_INSTALL
      category: Content
    cachebuster_for_update: true
  distribution:
    distributable: false
    bundles: []
    marketplace: false
  pkg_contract:
    applicable: false
    reason: 配布しない社内限定プラグインのためPKGパッケージング契約は非該当
  governance:
    runbook: required
  ci:
    workflow: governance-check
  ssot_dedup:
    lint: ssot-duplication
    references_config_assets: tracked
  feedback_deploy:
    deploy: run-skill-feedback
    enabled: false
    reason: affiliate-hubリポジトリ限定の非配布プラグインであり、Notion受け皿への改善要望フィードバック配備は対象外とする
  harness_eval:
    evals_json: EVALS.json
    mechanical: required
    llm_eval: required
---

# affiliate-content-harness 開発計画 index (main)

> プラグイン構想「1つのアフィリエイト案件を正本にして、ブログ記事とSNS投稿(X長文/X短文/Instagram/note/Facebook)を媒体をまたいで矛盾なく生成・検品する」を、人間可読な13フェーズのライフサイクル(本 index + phase-01..13.md)と、機械可読な buildable component 目録 (`component-inventory.json`) の2軸直交で計画したもの。
> ライフサイクル軸(フェーズ)は宣言型のタスク仕様(`specfm.PHASE_BODY_SECTIONS` の8節)で primary deliverable。成果物実体軸(component)は build routing・依存 DAG・品質機構を保持する唯一の SSOT。フェーズは component id を `entities_covered` で参照するだけで build_target を再記述しない(正規化)。

## 基本定義
- **プラグイン slug**: `affiliate-content-harness` (plan_dir=`plugin-plans/affiliate-content-harness/`・同一構想は常に同一出力先=再現性アンカー)。
- **最上位目的 (purpose)**: 1つのアフィリエイト案件(商品軸または記事軸)を正本にして、ブログ本体の記事とX長文・X短文・将来的にInstagram/note/Facebookの投稿文までを、同じコンセプトとペルソナから生成し、媒体をまたいでも主張と根拠が食い違わない状態で公開できるようにする。
- **仕様駆動(大前提)**: 本計画は harness-creator 仕様を基に作成される(規律の焼き先=`harness-creator-spec-reflection.md` マトリクスの引用・独自流儀の発明禁止)。要件の正本は `goal-spec.json` の checklist (C1-C10)、仕様書(本 index + 13 phase)はその被覆であり、実装との乖離が出たら**仕様を先に更新**してから build へ戻す(spec-first)。
- **スコープ(含む)**: index + 13フェーズ計画 + `component-inventory.json` の生成(計画=L3契約)。
- **スコープ(含まない)**: 実プラグイン/実コードの build(L4・後段 run-skill-create / run-build-skill へ委譲)、SNS実投稿(API連携・open_questions #3)、PR/配布登録。

## ドメイン知識
- **2軸直交**: ライフサイクル軸(13 phase・人間可読)と成果物実体軸(N=16 component・機械 SSOT)を二重に持たない。
- **component_kind (5種)**: skill / sub-agent / slash-command / hook / script。同一 kind の複数実体はそれぞれ独立 component (skill×4 / sub-agent×4 / slash-command×2 / hook×1 / script×5)。
- **phase ≠ component**: 13はフェーズ数の固定値、N=16は buildable 実体数で独立に決まる。phase は `entities_covered: [C01, ...]` の id 参照のみで component に紐づく。
- **案件(campaign)正本**: 1つのアフィリエイト案件を正本にし、ブログ記事・全媒体投稿はすべて同一案件idからclaims/evidence/導線契約(affiliateUrl/trackingCode/blockedReason)を継承する(purposeの中核受入観点・C3/C7/C8)。
- **媒体プロファイル**: 媒体ごとの規則(文字数上限・見出し記法・改行規則・ハッシュタグ・リンク可否・禁止表現)を `references/media-profiles.json` 1箇所に集約する。媒体追加はこのファイルへ1エントリ足すだけで生成(run-social-post)と検品(validate-media-post.mjs)の両方が追随する(C6)。

## インフラ
- **実行環境(逸脱の明示)**: 本プラグインの成果物 script (C12-C16) は Node.js 標準モジュールのみで実装する(npm依存なし)。既存 `.claude/plugins/blog-authoring/scripts/validate-blog-content.mjs` と同じ流儀を引き継ぐ設計判断であり、plugin-dev-planner 自身の scripts(Python標準ライブラリ正本)規約は planner 自身の資産に対する規約であって、量産先である本プラグインの成果物 script には適用しない(P02 design note)。lint/スクリプト起動は repo-root cwd 前提、skill 資産は self-relative 参照。
- **同梱決定論ゲート(2層命名・機械正本=`specfm.GATE_SCRIPTS`)**: core 5 scripts / 6 invocations = verify-index-topsort / detect-unassigned / check-spec-frontmatter / check-spec-gates / check-spec-matrix-coverage (--self-test + PLAN の2起動)。拡張ゲート = check-plugin-goal-spec / check-requirements-coverage / check-surface-inventory / check-build-handoff / validate-task-graph (デフォルト成果物 task-graph.json の10検査) / check-runtime-portability / check-plugin-surface-audit (総数の人間可読正本=io-contract §11表)。
- **task-graph.json の役割(shape_marker=fixed-13-phase・意図的な設計)**: 本 plan は `references/task-graph-contract.md` の bootstrap→target 移行 gate (l・GAP-BOOTSTRAP-TARGET-SHAPE-001) が定義する「非発火 (後方互換)」経路 — `shape_marker=fixed-13-phase` かつ全 node が `execution_kind` を携帯しない — を採用する。このため `task-graph.json` の全302 node は13 phase §5 完了チェックリスト項目からの `verification-claim`(検証トレース)と `phase-gate`(phase 集約点)のみで構成され、`component-build`/`direct-task` は0件になる。これは欠陥ではなく shape_marker の設計どおりの帰結であり、同文書は既存6 bootstrap plan(plugin-dev-planner/harness-creator/mf-kessai-invoice-check系/with-task-graph-goalseek)も同じ経路を採ることを明記する。**build dispatch の実行経路は `handoff-run-plugin-dev-plan.json` の `routes[]`(16件・component_kind/builder/build_target を明示)が単独で担う**。`render-task-execution-envelope.py` は `execution_kind ∈ {direct-task, component-build}` かつ `task_spec_ref`(task-specs/*.md)を要求する target shape (`shape_marker=task-graph-derived`) 専用の合成器であり、fixed-13-phase shape では非適用(exit1 は fail-closed の意図どおりで gap ではない)。target shape への移行(task-specs/*.md の新規著述)は本 plan のスコープ外とし、`handoff-run-plugin-dev-plan.json.open_issues` に低優先度の記録として残す(GAP-TASK-GRAPH-SHAPE-001)。
- **build の始め方(consumer 手順・宣言のみ)**: 後段 builder は `handoff-run-plugin-dev-plan.json` の routes を top-sort 順に消費する。skill route は routes[].build_args の `brief_path` で inventory から skill-brief JSON を決定論射影して `run-skill-create` へ渡す(詳細手順は焼かない)。
- **コンポーネント目録の所在**: buildable な実体(skill×4 / sub-agent×4 / slash-command×2 / hook×1 / script×5 = 計16)は `component-inventory.json` が唯一の SSOT。build_target・依存 DAG・quality_gates・harness_coverage・feedback_contract を目録側が保持する。
- **既存資産の承継(C9)**: `.claude/plugins/blog-authoring/` の全資産を二重管理なく統合する。references/allowed-values.md・references/granularity.md は media-profiles.json の設計根拠として下記 `references_config_assets` で追跡し、templates/site.json は C02、templates/article.{ranking,review,comparison,guide}.json (4件) は C03、references/display-map.md は C15(判定根拠)へそれぞれ承継する(詳細=`component-inventory.json` の `design_notes.existing_asset_migration`)。
- **Plugin-level surfaces**:

  | surface | 判定 | 記録先 |
  |---|---|---|
  | manifest | required | `plugin_meta.manifest` |
  | plugin-composition | required | `plugin-composition.yaml` |
  | harness/eval | required | `EVALS.json` + `plugin_meta.harness_eval` |
  | references/config/assets | required | `plugin_meta.ssot_dedup`(media-profiles.json / allowed-values.md / granularity.md / display-map.md 等)。templates/site.json・templates/article.{ranking,review,comparison,guide}.json はC02/C03の`design_notes.existing_asset_migration`で追跡 |
  | schemas | omitted | component inventory の omitted_reason(既存validate-blog-content.mjsと同じくinline検証) |
  | vendor | omitted | component inventory の omitted_reason(plugin-root hoistで携帯性を満たす) |
  | MCP/app connector | omitted | component inventory の omitted_reason(SNS実投稿API連携はスコープ外) |
  | notion_config | omitted | component inventory の omitted_reason(Notion等の外部DBを使用しない) |

## 環境ポリシー
- **品質基準**: 全 buildable component が quality_gates (p0_lint(kind別)/build_trace/elegant_review C1-C4/content_review verdict/evaluator≥80,high0) + harness_coverage(min≥80/kind_pass) を携帯する。
- **proposer≠approver**: 設計/最終レビューは提案者と別 context の approver が承認する(design-gate/final-gate)。ブログ記事(C07)とSNS投稿(C08)の生成物レビューも同様に独立 context の reviewer が担う(C10)。
- **現状値非焼込**: 「≥80%を満たす設計」を要件化し、harness 現状未達数値は component エントリへ焼かない(Goodhart 回避)。
- **エスカレーション**: ゲート未達は最大3周で findings を反映し再実行、超過時は `open_issues` に残し差し戻す。

## フェーズ一覧

1. P01 — requirements (要件定義) / 未実施
2. P02 — design (設計) / 未実施
3. P03 — design-review (設計レビューゲート) / 未実施
4. P04 — test-design (テスト設計) / 未実施
5. P05 — implementation (実装) / 未実施
6. P06 — test-run (テスト実行) / 未実施
7. P07 — acceptance-criteria (受入基準判定) / 未実施
8. P08 — refactoring (リファクタリング) / 未実施
9. P09 — quality-assurance (品質保証) / 未実施
10. P10 — final-review (最終レビューゲート) / 未実施
11. P11 — evidence (手動テスト検証) / 未実施
12. P12 — documentation (ドキュメント) / 未実施
13. P13 — release (完了/PR・リリース) / 未実施

## 完了チェックリスト
- [ ] 基本定義 (plugin slug / purpose / スコープ) が宣言されている。
- [ ] ドメイン知識 (2軸直交 / component_kind 5種 / 案件正本 / 媒体プロファイル) が宣言されている。
- [ ] インフラ (実行環境 / core scripts / 目録所在 / surface 採否) が宣言されている。
- [ ] 環境ポリシー (品質基準 / proposer≠approver / 現状値非焼込) が宣言されている。
- [ ] 13フェーズ (P01..P13) が phase_number 昇順で全存在し、各 phase 本文が §5 section 床 (`specfm.PHASE_BODY_SECTIONS` の宣言型8節) を満たす。
- [ ] `component-inventory.json` が5 component_kind の検討証跡と plugin-level surfaces の採否を記録し、全16 component が build_target 非空・builder/build_kind 整合・依存 DAG 非循環で core 規律 (quality_gates + harness_coverage + skill loop の feedback_contract) を携帯する。
- [ ] 各 component が>=1 phase の `entities_covered` に出現する(orphan 0件)。
- [ ] 同梱決定論ゲート (core + 拡張・機械正本=`specfm.GATE_SCRIPTS`) が全 exit0。
- [ ] `handoff-run-plugin-dev-plan.json` の routes が inventory 由来で builder/build_kind/build_args/build_target を持ち、各 component を後段 builder へルーティングする。

## 受入確認

> 計画(上記)が満たすのは「各 component が評価基準を携帯し決定論ゲートを通る」こと。**組み上がった実プラグインが当初 purpose を満たすか**は build 後に下記で確認する。plan は受入基準を**契約として焼く**だけで、実行は後段 build (run-skill-create の harness criteria-test)。purpose の正本 = `goal-spec.purpose`「1つのアフィリエイト案件を正本にして、ブログ記事とSNS投稿を媒体をまたいで矛盾なく生成・検品できるようにする」。

| 受入観点 (purpose/checklist 由来) | 確認の見方 (build 後) | 焼き先 |
|---|---|---|
| ブログ設計図(pattern/revenueModel/タブ/固定ページ/theme/差別化10軸)が確定しコード側列挙値で検証できる (C1) | site.json を validate-blog-content.mjs で検証し不正値0件 | run-blog-create (C02) の inner criterion |
| ペルソナとスタイルゲノム(L1/L2/L4/L5/L8)が固定値でなく設計図の一部として持てる (C2) | 複数ブログで異なる site.json を作り、生成される文体が site.json ごとに変わることを確認 | run-blog-create (C02) の outer criterion |
| 案件1件が正本として宣言でき、派生成果物が同じ案件idを指す (C3) | campaign-brief.json のidを記事・投稿から辿れることを確認 | run-campaign-brief (C01) の outer criterion |
| ブログ記事が参考ブログ並みの粒度で生成され機械検品できる (C4) | validate-blog-content.mjsのcheckGranularityでセクション数・字数・claims件数・fact割合を検証 | run-blog-article (C03) の inner/outer criterion |
| 同じ案件からX長文投稿を生成しスタイルゲノム適用を機械検品できる (C5) | validate-media-post.mjsで1文1行・冒頭の問いかけ・転換マーカー等を検証 | run-social-post (C04) の inner criterion |
| 媒体追加が1箇所の編集で生成・検品に追随する (C6) | media-profiles.json へ新規媒体を1件追加し、run-social-post/validate-media-post.mjsの両方が新媒体を扱えることを確認 | validate-media-post.mjs (C13) |
| 媒体をまたいだ主張の一貫性を検品できる (C7) | ブログのfact相当claimsとSNS投稿の言い切りを意図的に食い違わせ、検証が止まることを確認 | validate-cross-media-consistency.mjs (C14) |
| 提携の無い商品への導線混入を全媒体で防げる (C8) | blockedReason設定商品でSNS側にリンクを混入させ、検証が止まることを確認 | validate-affiliate-disclosure.mjs (C15) + guard-blocked-affiliate-link (C11) |
| 既存blog-authoring資産が二重管理にならず統合されている (C9) | .claude/plugins/blog-authoring/ の全資産(検品script・3参照・5テンプレート)の承継先が`component-inventory.json`の`design_notes.existing_asset_migration`とC02/C03/C15の各エントリで確認でき、旧ディレクトリが残存しないことを確認 | P02 design note + P13 release |
| ブログ記事・SNS投稿それぞれに独立文脈のレビュー経路がある (C10) | assign-blog-content-reviewer / assign-social-post-reviewer がそれぞれ独立contextで動作しproposer≠approverが成立することを確認 | assign-blog-content-reviewer (C07) / assign-social-post-reviewer (C08) |

build後、各 component の `feedback_contract.criteria` が criteria-test として実行され、上表の受入が PASS して初めて「purpose を満たすプラグインが出来た」と確定する。`EVALS.json` の `llm_eval` はこの受入が評価系に配線されていることを宣言する。
