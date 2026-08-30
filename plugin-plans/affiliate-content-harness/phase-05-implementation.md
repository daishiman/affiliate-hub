---
id: P05
phase_number: 5
phase_name: implementation
category: 実装
prev_phase: 4
next_phase: 6
status: 未実施
gate_type: tdd-green
entities_covered: [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16]
applicability:
  applicable: true
  reason: ""
---

# P05 — implementation (実装)

## 目的
全16 buildable component を後段 builder へ委譲して実体化し、P04 で設計した criteria を満たす(Green)状態にする。build routing は `component-inventory.json` の依存 top-sort 順に実行する(phase 順 ≠ build 順)。

## 背景
build は phase 順ではなく component の依存 top-sort 順に走る(共有 script C12-C16 → skill C16依存元から順に → sub-agent → slash-command → hook)。phase 軸(人間可読)と build 軸(機械 routing)を分離しているため、実装は inventory の DAG を正本にする。手続き的な build 順は `handoff-run-plugin-dev-plan.json` の routes が SSOT であり、本フェーズはその実行結果(到達状態)を宣言する。

## 前提条件
- P04 で C01-C04 の criteria が Red で確定している。
- `handoff-run-plugin-dev-plan.json` の routes が inventory 由来で用意されている(共有 script C12-C16 → skill C01/C02/C03/C04 → sub-agent C05-C08 → slash-command C09/C10 → hook C11 の依存順)。
- 後段 builder (run-skill-create / run-build-skill / plugin-scaffold) が利用可能。

## ドメイン知識
- build 順の不変条件: inventory DAG の top-sort 順(依存先が常に先。phase 番号順ではない)。
- builder の実行実体差: `builder_status` が executor-backed(実行 skill 実在)/ contract-only(routing 語彙のみ・`gap_ref` 必須)を区別する(解決表は io-contract §9)。
- Green 判定の主体は P04 で固定した criteria(実装が判定基準を都合よく再定義しない)。

## 成果物
- 全16 component の実体(skills/agents/commands/hooks/scripts)が build_target に生成された状態。
- `envelope-draft/plugin.json` を基にした plugin manifest(後段 scaffold owner)。

## スコープ外
- カバレッジ拡充・テスト網羅(P06)。
- purpose 受入判定(P07)・SSOT 重複整理(P08)。
- builder 自体の改修(harness-creator 側の責務・gap は `open_issues` へ起票)。

## 完了チェックリスト
- [ ] 依存 top-sort 順に全 component が build され、skill loop の criteria が Green(受入テスト PASS)になる。
- [ ] build 実体パスが inventory の build_target と一致する。
- [ ] 共有 script C12-C16 が plugin-root へ実体化されている(単一 skill 配下に退化していない)。

### 受入例
- 入力: P04 で Red 固定された C01-C04 の criteria と `handoff-run-plugin-dev-plan.json` の routes(依存 top-sort 順: C12-C16→C01-C04→C05-C08→C09/C10→C11)。
- 出力: 依存 top-sort 順に全16 component が build され、例えば C03(run-blog-article)の outer criterion が Green(受入テスト PASS)になる。

### 事前解決済み判断
- build 順は phase 番号順ではなく inventory の DAG top-sort 順で実行する、という原則は P02 で確定済みであり本フェーズで再議論しない。
- `builder_status=contract-only`(`gap_ref=GAP-SCRIPT-BUILDER`)の script route(C12-C16)は、実行実体の生成が harness-creator 側 builder の責務であることが既に合意済みで、本フェーズはその routing 語彙を前提にする。

## 参照情報
- `handoff-run-plugin-dev-plan.json` (build routing) / `component-inventory.json` (依存 DAG)。
- 対象 component C01-C16。
- 後続 P06 (test-run)。
