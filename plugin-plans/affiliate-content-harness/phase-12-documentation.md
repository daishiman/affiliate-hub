---
id: P12
phase_number: 12
phase_name: documentation
category: 文書
prev_phase: 11
next_phase: 13
status: 未実施
gate_type: none
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P12 — documentation (ドキュメント)

## 目的
実プラグインの利用者向けドキュメント(README相当・媒体プロファイルの追加手順・案件正本の作り方)を整備し、C6(媒体追加=1箇所編集)の運用手順を文書化する。

## 背景
機構として C6 を満たしていても、実際に運用する人が「どこを編集すればよいか」を知らなければ運用時に事故が起きる。媒体プロファイル(references/media-profiles.json)への追加手順、案件(campaign)の正本化から記事・投稿生成までの一連の流れを文書化する。

## 前提条件
- P11 の evidence が確定している。

## ドメイン知識
- ドキュメントは実装(L4)の写像であり、実装と乖離したら文書側を更新する(spec-first の逆写像は行わない)。

## 成果物
- 利用者向けドキュメント(媒体追加手順・案件正本化フロー・レビュー経路の説明)。

## スコープ外
- 実装の修正(ドキュメント作業のみ)。

## 完了チェックリスト
- [ ] 媒体プロファイルへの追加手順が文書化されている。
- [ ] 案件正本化(run-campaign-brief)からブログ記事・SNS投稿生成までのフローが文書化されている。
- [ ] C07/C08 の独立レビュー経路の使い方が文書化されている。

### 受入例
- 入力: P11 の evidence。
- 出力: 「`references/media-profiles.json` に Instagram の媒体規則(文字数上限・改行規則・ハッシュタグ可否)を追加する編集手順」が具体的な編集箇所(1ファイル)付きで文書化される。

### 事前解決済み判断
- ドキュメントは実装(L4)の写像であり、実装と乖離したら文書側を更新する(spec-first の逆写像は行わない)方針は既に確定している。

## 参照情報
- `index.md`。
- 後続 P13 (release)。
