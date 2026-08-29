---
id: P04
phase_number: 4
phase_name: test-design
category: テスト
prev_phase: 3
next_phase: 5
status: 未実施
gate_type: tdd-red
entities_covered: [C01, C02, C03, C04]
applicability:
  applicable: true
  reason: ""
---

# P04 — test-design (テスト設計)

## 目的
skill_kind ∈ {run,wrap,delegate} を持つ C01(run-campaign-brief)/C02(run-blog-create)/C03(run-blog-article)/C04(run-social-post) の `feedback_contract.criteria` (inner/outer) を Red 状態で固定する。criteria は各 skill の goal/checklist 語彙と重なる purpose-traceable な文言で記述する。

## 背景
テスト設計を先に固定してから実装へ進む(TDD)。各 skill の inner criterion は決定論 script (validate-campaign-brief.mjs / validate-blog-content.mjs / validate-media-post.mjs 等) による送信前検証、outer criterion は「同一案件idからの継承が壊れていないか」「粒度・媒体規則・スタイルゲノム適用を満たすか」を受入テストとして固定する。

## 前提条件
- P03 の design-gate が PASS している。
- C01-C04 の `component-inventory.json` エントリに goal/checklist が確定している。

## ドメイン知識
- criteria の id 規則 (`^(IN|OUT|C)[0-9]+`)・loop_scope (inner/outer)・verify_by (lint/test/script/evaluator/elegant-review/live-trial/human/verification-obligation) の enum は `references/io-contract.md` を参照。
- purpose-traceability: 各 criterion の text は当該 component 自身の goal/checklist と語彙を共有しなければならない(汎用的な品質ゲート文言のみでは不可)。

## 成果物
- C01-C04 の `feedback_contract.criteria` (各 inner≥1・outer≥1) が Red 状態で固定されている。

## スコープ外
- 実装(P05)。
- C05-C16(sub-agent/slash-command/hook/script)は feedback_contract の対象外(skill_kind 限定の要件)。

## 完了チェックリスト
- [ ] C01-C04 それぞれに inner criterion(script検証)と outer criterion(受入テスト)が1件以上定義されている。
- [ ] criteria の text が purpose-traceability(自身の goal/checklist と語彙共有)を満たしている。
- [ ] `check-spec-gates.py` が criteria の id/verify_by/loop_scope enum 違反を検出しない。

### 受入例
- 入力: C03(run-blog-article)の goal/checklist。
- 出力: `feedback_contract.criteria` に inner="`validate-blog-content.mjs` による型別テンプレート準拠・粒度・claims件数・案件id参照の送信前検証"、outer="同一campaign idからの継承(claims/evidence)が壊れておらず参考ブログ並みの読み応えを満たす受入テスト"がRed状態で1件以上ずつ記録される。

### 事前解決済み判断
- criteria の id 規則(`^(IN|OUT|C)[0-9]+`)・loop_scope(inner/outer)・verify_by enum は `references/io-contract.md` が定める plan 全体共通の形式契約であり、本フェーズ独自に再定義しない。

## 参照情報
- `component-inventory.json` (C01-C04 の feedback_contract)。
- `references/io-contract.md` (criteria 契約)。
- 後続 P05 (implementation・この criteria を Green にする)。
