# 仕様反映 受領書

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
