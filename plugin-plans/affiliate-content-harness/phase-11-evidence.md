---
id: P11
phase_number: 11
phase_name: evidence
category: 検証
prev_phase: 10
next_phase: 12
status: 未実施
gate_type: evidence
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P11 — evidence (手動テスト検証)

## 目的
実プラグイン build 後に、案件1件から生成したブログ記事と全媒体投稿(x/x-short/instagram/note/facebook)を実際に手動で確認し、index.md の受入確認表(purpose 由来の受入観点)が満たされることを証跡として残す。

## 背景
機械ゲートだけでは「読んで違和感がないか」「媒体をまたいで本当に矛盾していないか」の最終確認はできない。人による目視確認を evidence として残すフェーズを独立させ、build-後の実プラグインが当初 purpose を満たすかを最終的に人間が確認する。

## 前提条件
- P10 の final-gate が PASS している。
- 実プラグインが build 済みで、案件1件を通した end-to-end 実行が可能である。

## ドメイン知識
- evidence は「計画が criteria を携帯すること」ではなく「実行結果が purpose を満たすこと」を示す証跡。plan(L3)と実プラグイン(L4)の境界を跨ぐ唯一のフェーズ。

## 成果物
- 手動確認の証跡(スクリーンショット・実行ログ・確認者名等)。

## スコープ外
- 機械ゲートの再実行(P06/P09で完了済み)。

## 完了チェックリスト
- [ ] 案件1件からブログ記事+全媒体投稿を生成し、claims/導線契約が一致していることを目視確認している。
- [ ] index.md の受入確認表の各行が実際に確認されている。
- [ ] 確認結果が evidence として記録されている。

### 受入例
- 入力: build 済みの実プラグイン(P10 final-gate PASS済み)。
- 出力: 案件1件から review 型のブログ記事と X長文/X短文/instagram/note/facebook の投稿を生成し、claims(fact/inference/opinion)と affiliateUrl の有無が全媒体で一致していることを目視確認し、スクリーンショット・確認者名とともに記録する。

### 事前解決済み判断
- 機械ゲート(P06/P09)は本フェーズで再実行しない、人による目視確認のみを本フェーズの責務とする切り分けは既に確定している。

## 参照情報
- `index.md` (受入確認表)。
- 後続 P12 (documentation)。
