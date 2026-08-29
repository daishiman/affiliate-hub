---
id: P03
phase_number: 3
phase_name: design-review
category: レビュー
prev_phase: 2
next_phase: 4
status: 未実施
gate_type: design-gate
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P03 — design-review (設計レビューゲート)

## 目的
P02 の `component-inventory.json` と `envelope-draft/plugin.json` を、設計提案者とは独立の context の approver が審査する(proposer≠approver)。skill 偏重の退化・C7/C8 検証が per-medium validator に折り込まれていないか・案件正本(campaign)からの継承関係の欠落を審査基準に含める。

## 背景
設計フェーズの自己承認は品質崩壊の典型原因であるため、独立 context のレビューを design-gate として挟む。特に本プラグインは「媒体を追加するときは1箇所の編集で追随する」(C6)設計原則の遵守と、「媒体横断の主張一貫性(C7)」「導線・広告表記の整合(C8)」が per-medium validator に混入していないかを重点審査する。

## 前提条件
- P02 の `component-inventory.json` / `envelope-draft/plugin.json` が確定している。
- 独立 context の approver (design-gate reviewer) が利用可能である。

## ドメイン知識
- proposer≠approver: 設計/最終レビューは提案者と別 context の approver が承認する。
- 審査観点の核: (a) 5種の component_kind が全て検討されたか、(b) N=16 が水増しや過小でなく目的から導かれているか、(c) 検証3層(媒体内/媒体横断一貫性/導線整合)が分離されているか。

## 成果物
- design-gate の承認記録(PASS/差し戻し理由)。

## スコープ外
- 設計そのものの修正(差し戻し時は P02 へ戻る)。
- 受入 criteria の導出(P04)。

## 完了チェックリスト
- [ ] 独立 context の approver が `component-inventory.json` を審査し PASS している。
- [ ] skill 偏重(単一 skill への退化)が無いことが確認されている。
- [ ] C7/C8 の検証が per-medium validator に折り込まれず独立 script (C14/C15) として分離されていることが確認されている。

### 受入例
- 入力: P02 の `component-inventory.json`(全16 component)。
- 出力: 独立 context の approver が、C7(媒体横断の主張一貫性)が C14、C8(導線・広告表記整合)が C15 として per-medium validator (C13等)に混入せず分離されていることを確認し、PASS または差し戻し理由付きで承認記録を残す。

### 事前解決済み判断
- proposer(P02 の設計担当)と approver(design-gate reviewer)は別 context で実行し自己承認しない、という原則は plan 全体の不変ルールとして本フェーズ以前から確定済み。

## 参照情報
- `component-inventory.json` / `envelope-draft/plugin.json`。
- 後続 P04 (test-design)。
