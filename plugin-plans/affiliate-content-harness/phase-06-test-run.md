---
id: P06
phase_number: 6
phase_name: test-run
category: テスト
prev_phase: 5
next_phase: 7
status: 未実施
gate_type: none
entities_covered: [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16]
applicability:
  applicable: true
  reason: ""
---

# P06 — test-run (テスト実行)

## 目的
P05 で Green にした全16 component のテスト・決定論ゲートを実際に実行し、SCRIPT_TESTS_MIN(script は12件以上)を含むカバレッジ最低要件を満たすことを確認する。

## 背景
実装が Green になっただけでは不十分で、実行して結果を確認するフェーズを独立させる。特に C12-C16 の5 script は Node 標準機能のみで書かれる決定論ゲートであり、案件正本(campaign-brief.json)からの継承・媒体プロファイル・媒体横断の主張一貫性・導線契約という4種の異なる検証責務をそれぞれ独立にテストする。

## 前提条件
- P05 で全16 component が build_target に実体化されている。
- C12-C16 のテストケース(SCRIPT_TESTS_MIN=12以上)が用意できる。

## ドメイン知識
- 決定論ゲートは「送信前検証(inner criterion)」の実行手段であり、テスト実行はその再現性を確認する。
- script の tests_min は構造要件(specfm.SCRIPT_TESTS_MIN)として12件以上が必須。

## 成果物
- 全16 component のテスト実行結果(pass/fail レポート)。

## スコープ外
- 受入判定そのもの(P07)。
- リファクタリング(P08)。

## 完了チェックリスト
- [ ] C01-C04 の feedback_contract.criteria が実行され結果が記録されている。
- [ ] C12-C16 の script がそれぞれ12件以上のテストケースで実行されている。
- [ ] `check-spec-gates.py` / `check-spec-matrix-coverage.py` が exit0。

### 受入例
- 入力: P05 で Green になった C15(`validate-affiliate-disclosure.mjs`)。
- 出力: `affiliateUrl`/`trackingCode` を両方省略した商品カードで `blockedReason` が出る/片方だけ残すと矛盾検知で止まる、という判定を含め12件以上のテストケースが実行され pass/fail が記録される。

### 事前解決済み判断
- script の tests_min(`SCRIPT_TESTS_MIN=12`件以上)は `specfm.py` が定める構造要件として本フェーズ以前から確定済みであり、本フェーズはこの下限を満たしているかを実行確認するのみ。

## 参照情報
- `component-inventory.json` (quality_gates/harness_coverage)。
- 対象 component C01-C16。
- 後続 P07 (acceptance-criteria)。
