---
id: P01
phase_number: 1
phase_name: requirements
category: 要件
prev_phase: 0
next_phase: 2
status: 未実施
gate_type: none
entities_covered: []
applicability:
  applicable: true
  reason: ""
---

# P01 — requirements (要件定義)

## 目的
「1つのアフィリエイト案件を正本にして、ブログ記事とSNS投稿を媒体をまたいで矛盾なく生成・検品する」という構想を目的ドリブンに要件化し、後続フェーズが参照する `goal-spec.json` を確定させる。target_plugin_slug=`affiliate-content-harness` を固定し、既存 `.claude/plugins/blog-authoring/` 資産の取り込み(二重管理禁止)と、`src/domain/authoring/site-blueprint.ts` を実行時参照する制約を開示する。

## 背景
現状 `.claude/plugins/blog-authoring/` にブログ単体の暫定プラグインがあるが、(1) 文章の粒度が骨組み止まり、(2) 文体がペルソナに結びついていない、(3) SNS への展開経路が無く媒体間で主張がずれても気づけない、という3つの穴がある。X長文投稿には成熟した資産(x-longpost-creator)があるが一人称「僕」のカジュアル文体に固定されており、層構造と検査の作り方だけを再利用しゲノムそのものはブログごとの入力として持たせる必要がある。

## 前提条件
- プラグイン構想1件(自然文+既存資産の引用)が入力として与えられている。
- 汎用の `run-goal-elicit` が利用可能で、purpose/background/goal/checklist を `goal-spec.schema.json` で抽出できる(再実装しない)。
- このフェーズは特定 component へ紐づかない(責務は goal-spec 確定・target_plugin_slug 固定)。

## ドメイン知識
- 正本(SSOT) = 案件(campaign)1件。ブログ記事・全媒体投稿はすべて同一案件idからclaims/evidence/導線契約を継承する(purposeの中核受入観点)。
- ブログ側の型の正本は `src/domain/authoring/site-blueprint.ts` であり、プラグインは書き写さず実行時に読む。
- goal-spec は全 goal-seek 周回で不変のアンカー(target_plugin_slug/plan_dir を含め以降のフェーズが書き換えない)。
- その他の plan 全体用語(component_kind/媒体プロファイル等)は index `## ドメイン知識` を参照。

## 成果物
- `goal-spec.json` (purpose/background/goal/checklist C1-C10/constraints/handoff_targets)。
- target_plugin_slug と plan_dir の確定値。

## スコープ外
- component 分解・envelope 設計(P02 へ委譲)。
- ヒアリング機構の再実装(`run-goal-elicit` を引用するのみ)。
- 実装・build(P05 と後段 builder の責務)。

## 完了チェックリスト
- [ ] `goal-spec.json` が purpose を非空で保持し、受入観点が purpose 語彙から導出されている。
- [ ] target_plugin_slug が ASCII kebab (`affiliate-content-harness`) で確定し以降のフェーズがそれを参照できる。
- [ ] `check-plugin-goal-spec.py` が exit0 (R1 goal-spec + plugin 固有アンカー充足)。

### 受入例
- 入力: 「1件のアフィリエイト案件を正本に、ブログ記事とSNS投稿(X長文/X短文/将来Instagram・note・Facebook)を媒体をまたいで矛盾なく作りたい。既存 `.claude/plugins/blog-authoring/` 資産がある」という自然文構想。
- 出力: `goal-spec.json` の purpose に上記趣旨が非空で記録され、checklist C1(設計図確定)〜C10(独立レビュー経路)が purpose の語彙(案件id・媒体・主張の一貫性)から具体的に導出され、`target_plugin_slug="affiliate-content-harness"` が確定した状態。

### 事前解決済み判断
- Instagram/note/Facebook の媒体プロファイルは今回は骨組み(規則の置き場所と検品の口)のみ用意し、実際の規則値は媒体運用開始後に埋める(goal-spec.json `open_questions` で確認済みの前提としてP01時点で固定)。
- `src/domain/authoring/site-blueprint.ts` の列挙値は書き写さず実行時に読む制約は P01 で確定し、以降のフェーズはこの制約を覆さない。

## 参照情報
- `references/purpose-driven-requirements.md` (目的ドリブン要件化の正本)。
- `schemas/plugin-goal-spec.schema.json` / `scripts/check-plugin-goal-spec.py`。
- 後続 P02 (この goal-spec を component 分解の入力とする)。
