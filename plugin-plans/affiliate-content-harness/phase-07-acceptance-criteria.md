---
id: P07
phase_number: 7
phase_name: acceptance-criteria
category: 判定
prev_phase: 6
next_phase: 8
status: 未実施
gate_type: none
entities_covered: [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16]
applicability:
  applicable: true
  reason: ""
---

# P07 — acceptance-criteria (受入基準判定)

## 目的
P06 のテスト実行結果を基に、goal-spec の checklist C1-C10 が各 component へ焼き込まれた criteria/quality_gates で被覆されているかを判定する。未被覆があれば differential として open_issues へ記録する。

## 背景
「計画が criteria を携帯していること」と「その criteria が checklist を実際に被覆していること」は別軸である。本フェーズは `check-requirements-coverage.py` 相当の判定を人間可読な形で確定し、C1(設計図確定)からC10(独立レビュー経路)までの各項目がどの component/phase で満たされるかを一意にマッピングする。

## 前提条件
- P06 のテスト実行結果が揃っている。
- goal-spec.json の checklist C1-C10 が確定している。

## ドメイン知識
- checklist → component/phase の対応は index.md の受入確認表が正本(1箇所に集約し重複させない)。
- C9(既存資産の取り込み・二重管理防止)/C10(独立レビュー経路)は verify_by=reasoning のため、機械ゲートに加えて設計文書上の説明責任を果たす。

## 成果物
- checklist C1-C10 → component/phase の対応マッピング(index.md 受入確認表)。

## スコープ外
- 未達項目の修正実装(差し戻して P05/P08 へ)。

## 完了チェックリスト
- [ ] C1-C10 の全項目が1つ以上の component または phase に対応付けられている。
- [ ] verify_by=script の項目(C1-C8)が対応する決定論ゲートで機械検証可能である。
- [ ] verify_by=reasoning の項目(C9/C10)が設計文書上の記述で説明されている。

### 受入例
- 入力: P06 のテスト実行結果と `goal-spec.json` checklist C1-C10。
- 出力: C3(案件id共有)が C01/C03/C04/C14/C16 へ、C9(既存資産の取り込み)が `component-inventory.json` の `design_notes.existing_asset_migration` へマッピングされ、`index.md` 受入確認表が更新される。

### 事前解決済み判断
- C9/C10 は `verify_by=reasoning` のため機械ゲートに加え設計文書上の説明責任で足りる、という判定基準は `goal-spec.json` 確定時点(P01)で既に決まっており本フェーズで新たに基準を作らない。

## 参照情報
- `goal-spec.json` (checklist)。
- `index.md` (受入確認表)。
- 後続 P08 (refactoring)。
