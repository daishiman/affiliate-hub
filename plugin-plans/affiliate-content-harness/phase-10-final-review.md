---
id: P10
phase_number: 10
phase_name: final-review
category: レビュー
prev_phase: 9
next_phase: 11
status: 未実施
gate_type: final-gate
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P10 — final-review (最終レビューゲート)

## 目的
独立 context の approver が、QA を通過した全16 component と goal-spec checklist C1-C10 の被覆を最終承認する(proposer≠approver)。C10 が要求する「独立文脈でのレビュー経路」自体がこのフェーズを含め正しく機能しているかも合わせて確認する。

## 背景
design-gate(P03)が設計時点の審査であるのに対し、final-gate は実装・QA を経た最終成果物全体を審査する。ブログ記事レビュー(C07)とSNS投稿レビュー(C08)がそれぞれ独立した proposer≠approver 経路として機能しているかを、final-gate の観点として明示的に確認する。

## 前提条件
- P09 の QA ゲートが全 component で通過している。
- 独立 context の final approver が利用可能である。

## ドメイン知識
- proposer≠approver: 最終レビューは実装者/設計提案者と別 context の approver が承認する。
- C10 の「独立レビュー経路」は component 単位(C07: ブログ、C08: SNS)で分離されており、final-review はこの分離が退化していないかを審査する。

## 成果物
- final-gate の承認記録(PASS/差し戻し理由)。

## スコープ外
- 実装の修正(差し戻し時は該当 phase へ戻る)。

## 完了チェックリスト
- [ ] 独立 context の approver が全成果物を審査し PASS している。
- [ ] C07(ブログ)/C08(SNS)の独立レビュー経路がそれぞれ機能していることが確認されている。
- [ ] checklist C1-C10 の被覆が P07 のマッピングと矛盾なく最終確認されている。

### 受入例
- 入力: P09 の QA 通過記録(全16 component)。
- 出力: 独立 context の final approver が、C07(ブログ記事レビュー)と C08(SNS投稿レビュー)がそれぞれ別 proposer≠approver 経路として機能していることを確認し、承認記録(PASS/差し戻し理由)を残す。

### 事前解決済み判断
- proposer≠approver の原則、および C10(独立レビュー経路)が C07/C08 で component 単位に分離された設計であることは P02/P03 で既に確定済みであり、本フェーズは審査のみを行い再設計しない。

## 参照情報
- `index.md` (受入確認表) / `component-inventory.json`。
- 後続 P11 (evidence)。
