# 仕様反映 受領書

```yaml
receipt_id: spec-writeback-2026-08-24-feat-auth-workspace-final-review-2
recorded_at: 2026-08-24T13:30:00Z
beads_ids: [ah-361, ah-361.1, ah-361.2, ah-361.3, ah-361.4, ah-361.5, ah-361.6, ah-361.7, ah-361.8, ah-361.9, ah-361.10, ah-361.11, ah-361.12, ah-361.13, ah-099, ah-lqu, ah-au4, ah-xp8, ah-6hc.5]
dev_graph_node_id: feat-auth-workspace
base_branch: dev
head_branch: devgraph/feat-auth-workspace
draft_pr: https://github.com/daishiman/affiliate-hub/pull/29
verdict: accepted-with-release-follow-up
```

## 2026-08-24 最終レビュー（2回目）の判定

本変更は**確定済みの製品要求を増減しない。** 前回受領（同日 11:45）で `auth.web` の実装投影は正規 R4 済み。今回は実行完了の投影漏れを直した。

| 層 | 今回の反映 |
|---|---|
| `docs/` | 実装要件の受入チェック、README、doc-spec-index、setup-tasks、本受領書 |
| `features/` | `feat-auth-workspace` に draft PR #29 を紐付け。compliance / affiliate / feedback は部分実装の投影のみ（feature 全体は done にしない） |
| `specs/` | `system-spec-index.md` の auth / security 実装状態を 2026-08-24 実測へ同期 |
| `system-spec/` | **追加の章本文変更なし。** `index.md` は C03 compile 出力で、再 compile は手書き節欠落リスク（`ah-a0o`）があり、指紋対象のため触らない |
| `architecture/` | 二層アーキテクチャのテナント検証の現在地を更新 |
| `tasks/` | P01〜P13 の `completion_evidence` を done にし、実行記録を追記 |
| Beads | closed 課題へ最終レビューと PR を追記。新規課題は作らない |

### 要求変更が無い判断理由

- Better Auth、Workspace、tenant 分離、広告表記、成果リンク、診断保持は既存 To-Be に含まれる。
- 今回直したのは完了証跡と投影の遅れであり、新しい画面契約や新しい要求 ID は無い。
- `system-spec/security.md` の As-Is が「tenant 未実装」のままなのは確定章の直接編集禁止と compile リスクのため。To-Be は変えていない。追随は writer/compile 改善（`ah-u5l` / `ah-a0o`）の後。

### 品質ゲート（本レビュー）

- `validate-system-plan.py --feature-package feature-package/feat-auth-workspace`: PASS、digest `35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c`、13 phase、violations 0
- 対象試験: `tests/acceptance/feat-auth-workspace` + artifact/tenant/reconciliation 8 files / 67 tests PASS
- `origin/dev` は本ブランチへ取り込み済み（Already up to date）
- completeness 指紋対象（`docs/spec/**` / `system-spec/**`）は触っていない

---

## 以前の受領書（2026-08-24 11:45）

```yaml
receipt_id: spec-writeback-2026-08-24-feat-auth-workspace-final-review
recorded_at: 2026-08-24T11:45:00Z
beads_ids: [ah-361, ah-361.1, ah-361.2, ah-361.3, ah-361.4, ah-361.5, ah-361.6, ah-361.7, ah-361.8, ah-361.9, ah-361.10, ah-361.11, ah-361.12, ah-361.13, ah-099, ah-lqu, ah-au4, ah-xp8, ah-6hc.5]
dev_graph_node_id: feat-auth-workspace
base_branch: dev
head_branch: devgraph/feat-auth-workspace
verdict: accepted-with-release-follow-up
```

## 2026-08-24 最終レビューの判定

本変更は**確定済みの製品要求を増減しない**。一方で、実装状態、データ境界、運用設計、派生タスク文書には影響があるため書き戻しが必要と判断した。

system-spec は `auth.web` を正規 writer で R4 `reopen` し、`system-spec/auth.md` の As-Is / Delta / 実装証跡を更新した後、要求判断を変えず同じ `qa-auth-web`、`serves_goals: [G1]`、`auth-model` で再確定した。`spec-state.json` の `reopen_log` が機械可読の受領履歴である。

### 反映先

| 層 | 反映内容 |
|---|---|
| `docs/` | auth release / final review、CI、診断保持、商品スナップショット、本受領書 |
| `features/` | `feat-auth-workspace` のローカル MVP 受入完了とリリース未検証の分離 |
| `specs/` | プロダクト要求の To-Be は維持し、2026-08-24 の実装投影を更新 |
| `system-spec/` | auth 確定章の古い `not_started` を `partial` とローカル検証証跡へ更新 |
| `architecture/` | Workspace / capability / tenant / request ID 監査の境界と正規 writeback 経路 |
| `tasks/` | Actions 使用量監視を現行 GitHub Billing API 契約と完了証跡へ更新 |
| Beads | auth P01〜P13 と関連タスクの最終レビュー、検証、PR を追記 |

### 要求変更が無い判断理由

- Better Auth、Google OAuth、Workspace role、tenant 分離、広告表示、監査、成果リンク、診断保持は既存 `docs/spec/01` と auth / security / database 章の To-Be に既に存在する。
- 今回追加したのは、それらを動く縦切りへ接続する application / persistence / presentation / scheduled job と検査である。
- Actions 使用量監視は製品機能ではなく CI 運用。GitHub の現行 API と照合したがプロダクト要求は変わらない。

### 未反映としたもの

- `system-spec/spec-state.json` top-level `implementation_snapshot` は writer に更新 action が無い。正本を直接編集せず Beads `ah-u5l` で追跡する。
- 本番 Google OAuth、dev / production D1 migration、複数ブランド選択 UI は未検証・未実装として残す。
- migration `0022` は既存 `disclosures` が 0 行であることを remote D1 で確認してから適用する（Beads `ah-6lf.7`）。

### 品質ゲート

- task package validator: digest `35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c`、13 phase すべて PASS。
- system-spec: matrix 48/48 判定済み、ヒアリング完全性 PASS、C13 公式出典 15/15 PASS。独立鮮度監査で検出した Vitest の古い日付は、公式 registry の現行版 `4.1.11` と公式 repository 履歴を正規 C02 フローで記録し直した。
- 構造ゲート: traceability / required test types / port wiring / `git diff --check` は PASS。
- テスト: 最終安定化 run は 279/279 ファイル、6,754/6,754 件 PASS。ホスト高負荷時の既定 run では a11y 2件が30秒 timeout したが、該当2ファイルの単独 242/242 件と低並列・手動 timeout 上限300秒の全体 run で再現せず、失敗 assertion は無い。
- coverage: 全体 Lines 91.78% / Branches 82.00% / Functions 89.72% / Statements 89.47%。層別も presentation の Lines 91.1% / Branches 80.4% / Functions 87.7% / Statements 89.7% を含め全層で設定下限以上。
- build / preview: `pnpm run build` と OpenNext worker build は PASS。`/admin` と `/admin/settings/compliance` は未ログイン時 `/signin` へ 307、`/signin` は 200。`MCP_TOKEN` 未設定の `/api/tools` は秘密値を表示せず登録手順を返して 503（fail-closed）。
- commit 後の `pnpm run verify` は typecheck / lint / tier audit / migration / acceptance / 6,749件回帰まで PASS。層別 coverage の不足を検出したため Server Action 5ケースを追加し、最終全体 6,754件と層別 coverage を PASS にした。変更21ファイル・1,710変異の mutation は初期2,281テスト PASS 後、推定1時間超のため MVP 方針で中断。coverage-report / traceability / required-test-types / port-wiring / spec-freshness / dependency audit は個別に PASS（脆弱性0）。

---

## 以前の受領書（2026-08-22）

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

## 以前の受領書（2026-08-16）

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
