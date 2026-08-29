---
id: P09
phase_number: 9
phase_name: quality-assurance
category: 品質
prev_phase: 8
next_phase: 10
status: 未実施
gate_type: qa
entities_covered: [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16]
applicability:
  applicable: true
  reason: ""
---

# P09 — quality-assurance (品質保証)

## 目的
全16 component の quality_gates(p0_lint/build_trace/elegant_review C1-C4/content_review verdict/evaluator≥80,high0)と harness_coverage(min≥80/kind_pass)が実測で満たされていることを確認する QA ゲート。

## 背景
本フェーズは「設計として quality_gates を携帯している」(P02/P03)を超えて、「実測でその基準を満たす」ことを確認する。特に skill C01-C04 は outer criterion(受入テスト)が実際に PASS するか、sub-agent C05-C08 は独立 context での content_review が verdict=PASS になるかを検証する。

## 前提条件
- P08 のリファクタリングが完了し criteria が Green のまま保たれている。

## ドメイン知識
- 現状値非焼込: 「≥80%を満たす設計」を要件化し、harness 現状未達数値を component エントリへ焼かない(Goodhart 回避)。
- elegant_review の4条件(C1-C4)は plugin-dev-planner 側の品質規律であり、goal-spec.checklist の C1-C10 とは別軸(命名の衝突に注意)。

## 成果物
- QA ゲート通過記録(全16 component の quality_gates/harness_coverage 実測結果)。

## スコープ外
- 最終レビュー承認そのもの(P10)。

## 完了チェックリスト
- [ ] 全16 component の evaluator スコアが閾値80以上・high_max=0を満たす。
- [ ] harness_coverage が全 component で min=80以上を満たす。
- [ ] `check-spec-frontmatter.py` / `check-spec-gates.py` が exit0。

### 受入例
- 入力: 全16 component の実装(P08 リファクタリング後)。
- 出力: 例えば C07(assign-blog-content-reviewer)の content_review verdict が独立 context で PASS になり、evaluator スコアが閾値80以上・high_max=0であることが実測で確認される。

### 事前解決済み判断
- 「evaluator≥80・high0を満たす設計」を要件化し、harness の現状未達数値そのものを component エントリへ焼き込まない(Goodhart 回避)という方針は P02 で既に確定している。

## 参照情報
- `component-inventory.json` (quality_gates/harness_coverage)。
- 対象 component C01-C16。
- 後続 P10 (final-review)。
