# 仕様反映 受領書

```yaml
receipt_id: spec-writeback-2026-08-30-task-worktree-dedup-parsers
recorded_at: 2026-08-30T01:20:00Z
beads_ids: [ah-6lf]
dev_graph_node_id: task-worktree-dedup
parent_feature: feat-ui-foundation
base_branch: dev
head_branch: daishiman/task-20
verdict: no-spec-impact
```

## 2026-08-30 最終レビューの判定

本変更は**仕様・設計へ影響しない。** 確定済みの製品要求・画面契約・データ契約を一切増減していない。
`system-spec/` `specs/` `architecture/` は変更していない。

### 影響が無いと判断した理由

| 変更 | 種類 | 判断根拠 |
|---|---|---|
| `parseNonEmptyParagraphs` の新設と 3 入口の差し替え | 挙動保存の共通化 | 差し替え前後で分割規則 `\n\s*\n` → trim → 空段落除去が同一。入出力契約は不変 |
| `parseNonEmptyLines` を `published-article-action.ts` へ適用 | 挙動保存の共通化 | 旧実装の `.filter(Boolean)` と新実装の `!== ""` は trim 済み文字列に対して同値 |
| `mergeSummariesWithSamples` の抽出（D1 reader 4 箇所） | 挙動保存の共通化 | 抽出前後で `mergeBySlug` の引数・`byUpdatedDesc` の並び順・`slice(0, limit)` の位置が同一。SQL 絞り込みは各 reader に残置 |
| `resolveSampleSiteDocument` の新設 | 見本データの不整合修正 | 見本の管理画面一覧がブログ固有の上書きを無視していた。読者画面は既に上書きを反映済みで、**読者画面の挙動が正**。管理画面を読者画面へ揃えた修正であり、要求の変更ではない |
| `SAMPLE_SITE_POLICY_OVERRIDES` の型を `Partial<Record<SiteDocumentKey, …>>` へ | 型の厳格化 | 実データは変えていない。`string` キーだった箇所を既存 enum へ縛っただけ |
| `docs/product/T3` `T4` の migration 名 `0019` → `0039` | 文書の誤り訂正 | 実ファイルは当初から `0039_gentle_archive.sql`。文書側が実体を誤って指していた |
| `allowed-values.md` の正本パス訂正 | 文書の誤り訂正 | `src/domain/reading/published-article.ts` は存在せず、正本は `src/application/read-models/published-article.ts` |

### 完全性レポートの指紋を焼き直した根拠（2026-08-30 追記）

`node scripts/spec-freshness.mjs` が `STALE` を返していた。**本タスクの変更が原因ではない。**
リビジョンごとに指紋を機械で再計算すると、境目はマージコミット `b344bfe` にある。

| リビジョン | 仕様入力 | verdict | 鮮度 |
|---|---|---|---|
| `origin/main` | 28 件 | PASS | FRESH |
| `origin/dev` | 81 件 | PASS | FRESH |
| `b344bfe`（main を取り込んだマージ） | 81 件 | PASS | **STALE** |
| `HEAD` | 81 件 | PASS | **STALE** |

レポートに焼かれた 81 件の逐一 sha256 と現在の中身を突き合わせると、動いたのは 3 件だけ。
その 3 件の実差分は**各 1 行、`acceptance-reconciliation` の `evaluated_digest` のみ**である。

```
docs/spec/feat-uiux-overhaul/acceptance-report.md
docs/spec/feat-uiux-overhaul/final-review.md
docs/spec/feat-uiux-overhaul/release-report.md

-"evaluated_digest":"sha256:2698a17d8a6e…"
+"evaluated_digest":"sha256:1c5a67484bce…"
```

これは `pnpm run acceptance:reconcile` がマージ後の証跡に対して**再生成した機械の値**であり、
人が仕様を書き換えたものではない。値そのものの正しさは別の門
`受入IDの証跡突合`（同 CI で OK）が見ている。**2 つの指紋機構の玉突き**であり、
完全性評価の 6 観点（上位概念 trace / 意思決定 / マトリクス網羅性 / 設計知識反映 /
最新ドキュメント出典 / prompt 品質）はこのフィールドを読まないため、判定は動かない。

以上を確認したうえで `node scripts/spec-freshness.mjs --write` で指紋を焼き直した。
**評価の中身を再実行してはいない。** 上の 3 件以外に 1 バイトの差も無いことを
逐一 digest で示したことが、その代わりの根拠である。
仕様書の本文が動いたときは、この近道を使わず正規の再評価（`ah-8h2.2`）へ回すこと。

### 反映した層

| 層 | 今回の反映 |
|---|---|
| `docs/` | `product/T3-technical-spec.md` / `product/T4-delivery-plan.md` の migration 名訂正、`product/test-traceability.md` の再生成、本受領書 |
| `features/` | `feat-ui-foundation.md` に「実装の現在地（2026-08-30）」を追記。受入 4 番目「入力作法が全画面で 1 組に統一」の現在地 |
| `tasks/` | `task-worktree-dedup.md` の出力・実行手順・受入・検証方法を 2026-08-30 実測へ更新 |
| `specs/` | **変更なし**（製品要求の増減が無いため） |
| `system-spec/` | **変更なし**（実装投影に変化が無く、完全性レポートの指紋対象を無用に汚さないため） |
| `architecture/` | **変更なし**（二層構造の責務境界・依存方向は不変。domain → application → infrastructure の向きを保っている） |
| Beads | `ah-6lf` に本レビューの実測と PR を追記。親は残件があるため in_progress を維持 |

### 品質ゲート（2026-08-30 実測）

| ゲート | 結果 |
|---|---|
| `pnpm run verify --tier 1` | PASS（exit 0、7 項目すべて OK） |
| `pnpm run typecheck` | PASS（exit 0） |
| `pnpm run lint` | PASS（exit 0） |
| `tests/{application,infrastructure,domain,architecture}` | 228 files / 4,513 tests PASS |
| `tests/{presentation,integration,ui,security,e2e-lite}` | 166 files / 5,146 tests PASS |
| `node scripts/traceability.mjs` | PASS（409 files / 由来不明 2 件、上限 2 以内） |
| `node scripts/migration-generated.mjs` | PASS（スキーマと migration が揃っている） |
| `pnpm run acceptance:reconcile` | PASS |

### 意図的にやらなかったこと

- スキーマ変更・migration 追加（不要）
- `system-spec/**` `docs/spec/**` の編集（完全性評価の指紋対象。要求変更が無い以上は触らない）
- 実ブラウザ E2E（`pnpm test:e2e`）と mutation testing（MVP のため最小検証に留める）

### 残課題

- `ah-8h2.2`: 仕様完全性評価を PASS へ戻す（本変更の対象外）
- `ah-6lf.12` / `.14` / `.15` / `.17`: Turnstile 実往復、外部媒体 worker、remote D1 migration 履歴、dev 公開 smoke
- 見本の固定文書は「いつ直したか」を持たない（`updatedAt: null`）。本物の運用データが入るまで作り話の日付を入れない方針を継続

---

## 以前の受領書（2026-08-24）

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

---

# 仕様反映 受領書（2026-08-31・見本データと読者側の入口）

```yaml
receipt_id: spec-writeback-2026-08-31-task-seed-satisfies-public-entry
recorded_at: 2026-08-31T06:10:00Z
beads_ids: [ah-ghmb]
dev_graph_node_id: task-seed-satisfies-public-entry
base_branch: dev
head_branch: devgraph/task-seed-satisfies-public-entry
verdict: no-spec-impact
```

## 判定

本変更は **仕様・設計へ影響しない。** 確定済みの製品要求・画面契約・データ契約を
一切増減していない。`system-spec/` `specs/` `architecture/` は変更していない。

変えたのは **開発機に入れる見本データ**と、それを見張る回帰検査だけである。

## 影響が無いと判断した理由

| 変更 | 種類 | 判断根拠 |
|---|---|---|
| `site_blueprints` への `DELETE` + `INSERT` を追加 | 見本データの欠落補填 | 公開の条件は `resolvePublicSiteIdentity` が既に定めており、そこは変えていない。**条件を満たすデータを入れていなかった側**を直した |
| `SEED_SUB_SLUG` を `SECOND_SITE_SLUG` の import へ | 見本データの不整合修正 | 手書きの `gear-for-small-kitchen` は見本のどこにも存在しない URL 名だった。正本（`sampleSites()`）を指し直しただけ |
| `legal_page` の `DELETE` を id 接頭辞へ | 冪等性の修正 | 同じ行を 2 度当てても増えない、という既存の性質を保つための修正。表の定義は不変 |
| `seed-covers-cases.test.ts` の id 抽出を列名基準へ | 検査の誤報修正 | 「1 番目の値が id」の決め打ちが、列を足した日に別の値を id と誤認していた。判定の意味は不変 |
| 新規検査 3 本 | 回帰の固定 | 検査の追加は仕様を増やさない。既に正本にある条件を機械で確かめるだけ |

## 仕様側に反映したこと（文書のみ）

`README.md` のセットアップに `pnpm seed:local` と、読者側の公開が
**`site_blueprints` と `site_network_node` の組**で決まることの明記を足した。

これは要求の追加ではなく、**既にコードが要求していた条件を人が読める場所に書いた**ものである。
手順を飛ばすと `/s/` 以下が 404 になることが、いままでどこにも書かれていなかった。

## 品質ゲート

| ゲート | 結果 |
| --- | --- |
| `npx tsc --noEmit --incremental false` | PASS（出力なし） |
| `npx eslint`（対象 5 ファイル） | PASS（出力なし） |
| `npx vitest run tests/architecture` | PASS（69 files / 837 tests） |
| `npx vitest run`（全体） | PASS（434 files / 10101 tests） |
| `pytest test_compile_heading_demotion_real_data.py` | PASS（7 passed） |
| `upsert-node.py`（dev-graph node 登録） | PASS（revision 305 → 306） |
| `bd-bridge.py --op create` | PASS（ah-ghmb） |

## 意図的にやらなかったこと

- **網に載せるブログの本数を増やすこと。** 3〜5 本目（`first-camera` /
  `run-and-recover` / `mobile-plan-navi`）は設計図は在るが `site_network_node` に
  載っておらず 404 になる。これは `resolvePublicSiteIdentity` の定めどおりであり、
  本数を変えるのは仕様判断なので触っていない。
- `docs/product/test-traceability.md` の再生成分のコミット。生成物であり、
  他セッションの未コミットテストを大量に含むため、含めると docs が実在しない
  ファイルを指すことになる。

## 残課題

- 網に載せる本数を 2 本のままにするかの仕様判断（未起票）
- `docs/product/test-traceability.md` の再生成は、他セッションの変更が
  出そろってからまとめて行う

---

# 仕様反映 受領書（2026-08-31・ブログ UI ビルダーの開発環境リリース）

```yaml
receipt_id: spec-writeback-2026-08-31-feat-blog-ui-builder-p13
recorded_at: 2026-08-31T03:20:00Z
beads_ids: [ah-45ba, ah-45ba.13]
dev_graph_node_id: SYS-BLOG-UI-BUILDER-P13
parent_feature: feat-blog-ui-builder
base_branch: dev
head_branch: devgraph/SYS-BLOG-UI-BUILDER-P13
verdict: spec-impact-written-back
```

## 判定

本変更は**仕様・設計へ影響する。反映済みである。**

`feat-blog-ui-builder`（P01〜P12）の実装で確定した契約を、正本 `system-spec/spec-state.json` の
`chapter_notes` へ `set-chapter-note` で記録し、章 `.md` を `compile-spec-doc.py` で再生成した。
**章を直接編集していない。**確定済みセルの直接 Edit は `guard-confirmed-chapter-overwrite` が拒否する。
章は正本の純関数であり、正本に無い散文は compile のたび消えるためでもある。

## 反映した正本と投影

| 正本（`chapter_notes` の章） | 記録した内容 | 投影先 |
|---|---|---|
| `ui-ux` | 規則の 3 層（不変／契約／運用）、テンプレートの不変条件、配色 2 層の適用範囲、アクセシビリティの床、design token 制約、受入 4 件の保留 | `system-spec/ui-ux.md` |
| `frontend` | テーマ実装契約（2 層 + 単一読み取り口）、コンポーネント契約、SEO/AI 検索実装契約（JSON-LD / sitemap / IndexNow / guideline_references） | `system-spec/frontend.md` |
| `database` | 6 表のデータモデル、`workspace_id` を列として持つ理由、索引の 1 段目、行の不在で状態を表す設計、未解決の欠陥 3 件 | `system-spec/database.md` |
| `database`（本リリースで追加） | §4.1 の 🔴「migration が未コミット」を本 commit で解消した記録と、0040 の停止条件 | `system-spec/database.md` |

`infrastructure.md` / `maintenance-ops.md` は生成の副次差分（4 行）のみで、契約は増減していない。

## 方針を上書きせず差分として足した理由

書き戻しはすべて `## 章の注記 (chapter_notes)` という**別の節**へ入れてある。
上の「確定内容（質疑録）」は利用者の逐語であり、そこへ実装の都合を混ぜると
**利用者が言っていないことが利用者の声の顔で残る。**

方針と実装がずれた点も、ずれを消して片方だけを残さず並べてある。
上書きで消すと、なぜその形になったかが後から読めなくなる。

## 品質ゲート（MVP）

| ゲート | 結果 |
|---|---|
| `npx vitest run`（全体） | **PASS** — 434 files / 10101 tests |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | **PASS** — `"violations": []` |
| `pnpm run build` | 本リリース commit 前に実行 |
| `pnpm run preview`（Workers ランタイム） | PASS — 証跡 `docs/spec/feat-blog-ui-builder/evidence/13-preview-workers-runtime.txt` |
| 受入 A1〜A14 | 証跡 `docs/spec/feat-blog-ui-builder/evidence/` 配下、判定は同 `final-review.md` |

## 意図的にやらなかったこと

- **受入 A4（固定ページ 18 経路中 12 経路が 404）を本リリースで直すこと。**
  原因は `legal_page` を `SiteDocumentKey`（9 種）と `FixedPageKind`（8 種）の
  2 系統の語彙が触っていることで、語彙の統合は本 feature の scope の外にある。
  正本 `database` §4.2 に 🔴 として記録済みで、隠していない。
- **視覚回帰の見本の撮り直し（`pnpm run visual --accept`）。**
  差分の原因は本 feature が変えていない部品（`0ed9e2b` / `e97e5bc`、すでに main）である。
  撮り直しは「この変化は正しい」と宣言する取り消しにくい操作であり、
  **変えていない側の担当が署名するのは筋が通らない。**

## 残課題

- 🔴 `legal_page` の語彙 2 系統統合（受入 A4／正本 `database` §4.2）
- 🔴 公開記事の本文が HTML に出ていない（受入 A5 / A12／正本 `frontend` §4）
- ⚠️ 配色の保存と掲載の増減が操作の記録に届かない（正本 `database` §4.3）。
  **本番（`main`）へ進める前にこれを閉じること。**掲載の増減は金銭に直結する
- 🟡 受入 A3「sticky 常時表示」の受入文言が未定義
- 🟡 `guideline_references` の登録が 0 件（判定は動くが対象が無い）
