# 仕様反映 受領書

```yaml
receipt_id: spec-writeback-2026-08-22-task-worktree-dedup
recorded_at: 2026-08-22T01:00:00Z
beads_ids: [ah-8h2]
dev_graph_node_id: task-worktree-dedup
parent_feature: feat-ui-foundation
related_features: [feat-improvement-feedback]
base_branch: dev
head_branch: devgraph/task-worktree-dedup
verdict: accepted-with-follow-up
```

## 判定

本変更は **製品要求の To-Be（確定セル）を変えない。** 変えたのは実装契約と、既存受け入れ条件の守り方である。

`docs/spec/12` の FB-AC-12 / FB-AC-13 は既に「技術情報を集める」「秘密を集めない」と定めている。今回は収集項目を増やさず、**保存する語彙を固定する**実装契約を `docs/architecture/feedback-loop.md` へ書いた。`docs/spec/12` 本文は指紋対象のため書き換えていない（現行 completeness-report の入力 hash を崩さない）。

UI の部品化（`InlineNav`、未使用 CSS 削除、押しどころ）は `docs/spec/09` / 共通 UI 要求の実装であり、新しい画面契約ではない。

担当者数の正本を membership へ移したことは、既存の Workspace 容量表示の実装修正であり、認証仕様の To-Be 変更ではない。

## 影響がある理由（実装契約・検査）

- 同格リンクを縦一覧の生クラスで横に並べていた役の食い違いを、部品として固定した
- 技術診断の生 URL / 例外 / 操作名が保存され、画像の黒塗り数と伏せ件数が混ざっていた
- 担当者数が workspace 見本の固定件数で、一覧と食い違っていた
- E2E の実ブラウザ入口が仕様表では「未着手」のままだった（`docs/spec/10` の該当行のみ更新。completeness-report はこの入力で再評価済み）

## 反映した正本と投影

| 関心 | 正本 | 投影 |
| --- | --- | --- |
| 共通 UI の部品 | `docs/architecture/ui-system.md` | `features/feat-ui-foundation.md` |
| 改善要望の診断 | `docs/spec/12` FB-AC-12/13（本文維持） | `docs/architecture/feedback-loop.md` §2-1 / `features/feat-improvement-feedback.md` |
| テストの置き場所 | `docs/spec/10`（E2E / 見た目の回帰の行） | `docs/architecture/testing-architecture.md` |
| 担当者の書き込み | `docs/product/first-owner-row.md` | `docs/product/setup-tasks.md` S-03A / `tasks/task-membership-write-repository.md` |
| 作業単位 | Beads `ah-8h2` | `tasks/task-worktree-dedup.md` |
| 二層アーキテクチャ | `architecture/arch-two-layer-platform.md`（To-Be 非変更、実装の現在地のみ） | — |
| 仕様完全性 | 確定章本文は非変更 | `system-spec/completeness-report.json`（FRESH / **FAIL**。旧 PASS は流用していない） |

## 確定章を書き換えなかった理由

`system-spec/*.md` と `docs/spec/*.md` は completeness の入力指紋である。確定章の To-Be を触ると、現行 FAIL レポートが STALE になり「いつの判定か」が消える。今回の差分は確定セルの要求判断を変えないため、実装契約（`docs/architecture/`）と feature / task へ投影した。C02 への再 import は evaluator PASS が前提なので行わない（`ah-8h2.2`）。

## 品質ゲート（MVP）

| ゲート | 結果 |
| --- | --- |
| `pnpm run verify --tier 1` | PASS。型検査・lint・段指定・マイグレーション・1 段テスト 166 ファイル / 3674 件 |
| spec inventory Python 契約 | PASS（2 件） |
| Playwright E2E / 全体ミューテーション | 本 PR では再実行しない（preview 起動と全体変異が重い。入口と見本は追加済み） |
| completeness evaluator 再 fork | 実施済みの FRESH/FAIL を採用。2 段の `spec-freshness` は FAIL レポートで赤になる。旧 PASS は流用しない。PASS 化は `ah-8h2.2` |

## 意図的にやらなかったこと

- `docs/spec/12` 本文の改稿（指紋維持。実装契約へ落とした）
- 確定 system-spec 章の To-Be 書き換えと C02 upsert
- `ah-au4`（成果リンクの商品スナップショット）と `ah-lqu`（診断の保持期限）の業務判断

## 残課題

- `ah-8h2.2`: 完全性評価を PASS へ戻す
- `ah-lqu`: 技術診断の保持期限と削除ジョブ
- `ah-au4`: affiliate_links の登録経路と商品スナップショット
- Playwright E2E は既定の `pnpm verify` に入れない（preview が重い）

---

# 以前の受領書（2026-08-16）

```yaml
receipt_id: spec-writeback-2026-08-16-task-spec-writeback

recorded_at: 2026-08-16T11:21:00Z
beads_ids: [ah-bvu, ah-bgp]
dev_graph_node_id: task-spec-writeback
parent_feature: feat-spec-canonicalization
base_branch: dev
head_branch: devgraph/task-spec-writeback
verdict: accepted-with-follow-up
```

## 判定

本変更は仕様・設計へ影響がある。アプリの実行コードは追加していない。影響範囲は正本の優先順位、Phase 0 文書の位置づけ、system-spec の As-Is、dev-graph と Beads の初期化である。正規フロー（docs/spec 正本 → system-spec 投影 → C02 upsert → Beads）で反映した。

## 影響がある理由

- `docs/spec/01`〜`03` が未登録のまま追加されており、Phase 0 の読者面契約と並立していた
- `origin/main` の Phase 1 で読者テーブルと公開ゲートが入り、`system-spec/database.md` の As-Is（運営者 3 テーブルのみ）が古くなっていた
- Analytics 詳細の正本が `03` であることと、読者面の正本が `ai-first-webmcp.md` であることを文書間で固定する必要があった

## 反映した正本と投影

| 関心 | 正本 | 投影 |
| --- | --- | --- |
| 優先順位と状態軸 | `docs/spec/00-README.md` | `docs/doc-spec-index.md` |
| 製品要求 | `docs/spec/01-要求仕様書-v1.0.md` | `specs/spec-product-requirements.md` |
| ギャップ・未決 | `docs/spec/02-補充仕様-ギャップと追加要件.md` | `specs/spec-gap-ledger.md` |
| Analytics | `docs/spec/03-分析・解析基盤仕様.md` | `specs/spec-analytics-foundation.md` |
| 読者面 | `docs/spec/ai-first-webmcp.md` | `specs/spec-reader-surface.md` |
| ドメイン分離 | 上記 + Phase 1 スキーマ | `architecture/arch-spec-governance.md` |
| 実装投影 | system-spec 各章 | `system-spec/index.md` / `database.md` / `spec-state.json` |

## 品質ゲート（MVP・機械層）

| ゲート | 結果 |
| --- | --- |
| validate-coverage-matrix.py --require-complete --require-foundation | PASS |
| validate-source-citation.py | PASS |
| validate-knowledge-graph.py knowledge / required-info / doctrine / cross | PASS |
| validate-graph-schema.py | PASS |
| task / specification / architecture 必須見出しと placeholder | PASS |
| assign-system-spec-completeness-evaluator の再 fork | 未実施。既存レポートは STALE のまま。後続 Beads で再評価する |

## 意図的にやらなかったこと

- アプリコード、スキーマ、公開ゲートの変更
- exact-13 の新規実装 package（仕様整理であり実装 feature ではない）
- completeness evaluator の独立 fork（MVP では機械層のみ）
- 公式サイトへの鮮度再照合

## 残課題

- `ah-7lo`: `system-spec/completeness-report.json` が STALE。入力 hash 付きで再評価する
- `ah-ez9`: 読者面と発信者面の接続境界は 02 §9 項 5 が open
- Auth / Workspace / 2 D1 / Redirect / Insight は未実装（本 PR の対象外）
