---
id: P02
phase_number: 2
phase_name: design
category: 設計
prev_phase: 1
next_phase: 3
status: 未実施
gate_type: none
entities_covered: [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16]
applicability:
  applicable: true
  reason: ""
---

# P02 — design (設計)

## 目的
capability を5種の component_kind (skill/sub-agent/slash-command/hook/script) へ写像し、N=16 実体を `component-inventory.json` へ分解する。各 component の build_target・依存 DAG・品質機構を確定し、plugin envelope (`.claude-plugin/plugin.json`) の draft を設計する owner フェーズ。

## 背景
P01 で確定した goal-spec を、実際に build 可能な実体へ落とす最初の設計フェーズ。skill 偏重を避けるため5種の component_kind を必ず検討した上で N=16 実体(skill×4/sub-agent×4/slash-command×2/hook×1/script×5)へ分解する。検証の3層(媒体内/媒体横断の主張一貫性/導線・広告表記整合)を独立 script に分離し、C7/C8 を per-medium validator に折り込まない設計判断をここで確定する。既存 `.claude/plugins/blog-authoring/` の資産(validate-blog-content.mjs 含む)は移設・拡張し二重管理を避ける(C9)。

## 前提条件
- P01 の `goal-spec.json` が確定している。
- 5種の component_kind の写像規約 (`references/component-domain.md`) と envelope 物理契約 (`references/plugin-creator-contract.md`) を参照できる。
- `.claude/plugins/blog-authoring/` の既存資産と `/Users/dm/dev/dev/ObsidianMemo/.claude/skills/x-longpost-creator` の層構造を設計入力として参照済みである。

## ドメイン知識
- 正規化原則: build_target/depends_on は `component-inventory.json` のみが保持し、phase ファイルは `entities_covered` の id 参照だけで紐づく(二重保持は drift 源)。
- kind 写像の判定核: `needs_independent_context`→sub-agent、`needs_lifecycle_enforcement`→hook、決定論検査→script(5種の定義は index `## ドメイン知識` 参照)。
- `placement_scope`: script のみ持つ配置属性。C12-C16 はすべて複数の component 種別(skill/sub-agent/slash-command)から共有されるため plugin-root へ hoist する。
- 設計判断(明示記録): 本プラグインの成果物 script (C12-C16) は Node.js 標準モジュールのみで実装する。既存 `validate-blog-content.mjs` と同じ流儀を引き継ぐための意図的な逸脱であり、plugin-dev-planner 自身の scripts(Python標準)規約は planner 自身の資産に対する規約であって量産先の成果物には適用しない。
- 設計判断(明示記録): task-graph.json は `shape_marker=fixed-13-phase`(index frontmatter で明示)を採用し、13 phase §5 完了チェックリストからの `verification-claim`/`phase-gate` のみで構成する意図的な選択。build dispatch は task-graph ではなく `handoff-run-plugin-dev-plan.json` の `routes[]` が単独で担う(`references/task-graph-contract.md` の bootstrap→target 移行 gate (l) が定める既存6 bootstrap plan と同じ後方互換経路)。target shape (`task-graph-derived`・task-specs/*.md 必須) への移行は本 plan のスコープ外とし `open_issues` (GAP-TASK-GRAPH-SHAPE-001) に記録する。
- 既存資産承継(C9): `.claude/plugins/blog-authoring/` の templates/site.json → C02、templates/article.{ranking,review,comparison,guide}.json (4件) → C03、references/display-map.md → C15(判定根拠)へそれぞれ承継する設計判断を `component-inventory.json` の `design_notes.existing_asset_migration` に確定する。

## 成果物
- `component-inventory.json` (build 軸の唯一 SSOT・全16 component)。
- `envelope-draft/plugin.json` (manifest draft)。

## スコープ外
- 設計の合否判定(P03 design-gate へ委譲・自己承認しない)。
- 受入 criteria の導出(P04 へ委譲)。
- 実体の生成(P05・実 `plugins/` へは書かない)。

## 完了チェックリスト
- [ ] 全16 component が build_target 非空・builder/build_kind 整合・depends_on 非循環で inventory に載っている。
- [ ] considered_component_kinds が5種全列挙され、plugin_level_surfaces の採否が明示されている。
- [ ] `envelope-draft/plugin.json` に manifest draft (entry_points / hooks 配線 / distribution) が設計されている。
- [ ] 検証の3層(媒体内 C13・媒体横断の主張一貫性 C14・導線と広告表記の整合 C15)が独立 script として分離されている。

### 受入例
- 入力: `goal-spec.json` の checklist C1-C10。
- 出力: `component-inventory.json` に16 component が定義され、例えば C15(`validate-affiliate-disclosure.mjs`)が hook C11・skill C04 から depends_on として参照され、kind 写像根拠(決定論検査→script・placement_scope=plugin-root)が明記されている状態。

### 事前解決済み判断
- 検証3層(C13 媒体内 / C14 媒体横断の主張一貫性 / C15 導線・広告表記整合)を per-medium validator に折り込まず独立 script として分離する設計は本フェーズで確定し、P03 では審査のみで再設計しない前提。
- 成果物 script(C12-C16)は Node.js 標準モジュールのみで実装する逸脱、および task-graph.json の `shape_marker=fixed-13-phase` 採用(GAP-TASK-GRAPH-SHAPE-001)は本フェーズの設計判断として確定済み。
- 既存 `.claude/plugins/blog-authoring/` 資産の承継先(templates/site.json→C02、article テンプレート4件→C03、display-map.md→C15)も本フェーズで `design_notes.existing_asset_migration` として確定済み。

## 参照情報
- `references/component-domain.md` / `references/phase-lifecycle.md` / `references/plugin-creator-contract.md`。
- 対象 component C01-C16 (`component-inventory.json`)。
- 後続 P03 (この設計を design-gate で審査する)。
