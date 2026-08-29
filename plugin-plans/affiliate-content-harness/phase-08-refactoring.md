---
id: P08
phase_number: 8
phase_name: refactoring
category: 改善
prev_phase: 7
next_phase: 9
status: 未実施
gate_type: tdd-refactor
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P08 — refactoring (リファクタリング)

## 目的
criteria を Green に保ったまま、SSOT 重複(C9)や設計の粗さを解消する。特に既存 `.claude/plugins/blog-authoring/` からの移設で生じうる二重定義(validate-blog-content.mjs の重複実装、site-blueprint.ts 列挙値の書き写し)を除去する。

## 背景
実装直後は動くが重複や粗さが残りやすい。criteria を退行させずに、媒体プロファイル(references/media-profiles.json)が本当に1箇所に集約されているか、campaign-brief.json からの継承が生成ロジック内で再度ハードコードされていないかを重点的に洗い出す。

## 前提条件
- P07 で criteria が Green かつ checklist 被覆が確定している。

## ドメイン知識
- リファクタリングは criteria(P04で固定)を変えずに内部構造のみを改善する(判定基準の都合の良い再定義は禁止)。
- SSOT 重複の典型: 列挙値の書き写し、媒体規則の複数箇所分散、claims/evidence の媒体ごとの再定義。

## 成果物
- 重複排除後の component 実体(criteria は Green のまま)。

## スコープ外
- 新規機能追加(スコープ外・checklist に無い要件は追加しない)。

## 完了チェックリスト
- [ ] `references/media-profiles.json` 以外に媒体規則の値が存在しないことを確認している。
- [ ] `site-blueprint.ts` の列挙値がプラグイン側コードに書き写されていない(実行時参照のみ)。
- [ ] リファクタリング後も P04 の criteria が Green のままである。

### 受入例
- 入力: P07 で checklist 被覆が確定した実装。
- 出力: 媒体規則の値が `references/media-profiles.json` 以外(例えば C13/C15 のスクリプト内)にハードコードされていないことを確認し、あれば `media-profiles.json` へ集約して除去する。

### 事前解決済み判断
- リファクタリングは P04 で固定した criteria を変えずに内部構造のみ改善する(判定基準の都合の良い再定義は禁止)という制約は本フェーズ以前から確定済み。

## 参照情報
- `component-inventory.json`。
- 後続 P09 (quality-assurance)。
