---
id: P13
phase_number: 13
phase_name: release
category: 完了
prev_phase: 12
next_phase: 14
status: 未実施
gate_type: none
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P13 — release (完了/PR・リリース)

## 目的
`envelope-draft/plugin.json` を基に生成された実 manifest を確定し、非配布(`distributable: false`)の社内プラグインとして `.claude/plugins/affiliate-content-harness/` に配置・PR 化する。marketplace 登録は行わない。

## 背景
本プラグインは affiliate-hub リポジトリ内限定の利用を想定し、既存 `blog-authoring` と同様に `distributable: false` とする。リリースフェーズでは PR 作成・レビュー依頼までを完了条件とし、marketplace への配布登録は対象外とする(ユーザー承認後の別経路)。

## 前提条件
- P12 のドキュメントが確定している。
- 実プラグインの build が完了し、P11 の evidence が確認済みである。

## ドメイン知識
- `distributable: false` の場合、`distribution.bundles` は空、`distribution.marketplace` は false/不在が整合(非配布の明示)。

## 成果物
- PR (`.claude/plugins/affiliate-content-harness/` 一式)。
- リリース記録。

## スコープ外
- marketplace 登録(ユーザー明示承認後の別作業)。

## 完了チェックリスト
- [ ] manifest (`.claude-plugin/plugin.json`) が `envelope-draft/plugin.json` の draft と整合し実体化されている。
- [ ] 既存 `.claude/plugins/blog-authoring/` の `templates/site.json`(→C02)・`templates/article.{ranking,review,comparison,guide}.json` 計4件(→C03)・`references/display-map.md`(→C15)が `component-inventory.json` の `design_notes.existing_asset_migration` の承継先へ重複なく統合されている(C9)。
- [ ] 上記6ファイルの承継先が実体として存在することを確認したうえで、旧 `.claude/plugins/blog-authoring/` が残存していない(二重管理なし・C9)。承継先の実在確認を先に済ませること。順序を逆にすると、承継漏れがあったときに元が残っていない。
- [ ] PR が作成され、独立レビュー経路(C10)を経て承認されている。

### 受入例
- 入力: P12 のドキュメント。
- 出力: `.claude/plugins/affiliate-content-harness/` の PR が作成され、PR説明に `.claude/plugins/blog-authoring/` から移設した6ファイル(templates/site.json、templates/article.{ranking,review,comparison,guide}.json、references/display-map.md)の承継先(C02/C03/C15)が明記される。

### 事前解決済み判断
- `distributable: false` の社内プラグインとして marketplace 登録は行わない方針は `goal-spec.json`/`index.md` の時点で既に確定している。

## 参照情報
- `envelope-draft/plugin.json`。
- `handoff-run-plugin-dev-plan.json` の envelope ブロック。
