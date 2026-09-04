# 仕様反映の受領書（feat-uiux-overhaul / P13）

記録日: 2026-08-23
記録者: 最終レビュー（git status / diff / 品質ゲート再実行）
graph_node_id: `feat-uiux-overhaul`
対象 Beads: epic `ah-6hc`、P01–P13（`ah-82u` … `ah-qzk`）、子課題 `ah-6hc.1`–`ah-6hc.4`

<!-- acceptance-reconciliation {"implementation_status":"pass","release_status":"unpublished","tracking_status":"active","evaluated_digest":"sha256:396ddfc13e9918420b5b29734b4c023880bd1b39d949de0396751ee93962cd82","acceptance_ids":["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10"]} -->

---

## 1. 判定

**影響はある。** 管理画面の単位、CRUD API、配信先の拡張契約、間隔・文章量・サイドバーの規則が実装で確定した。これらは設計判断であり、仕様・アーキテクチャへ戻さないと次の feature が古い前提で進む。

正規フローは `spec-state.json`（単一 writer）→ `compile-spec-doc.py` → `system-spec/*.md` である。章 Markdown を手で増やすと、次のコンパイルで消えるか、検査だけが緑になる。

## 2. 正規フローで反映したもの

| 正本 | 反映内容 | 経路 |
|---|---|---|
| `system-spec/spec-state.json` の作業ツリー | `qa-uiux-web-overhaul-v2` / `qa-frontend-web-overhaul-v2` / `qa-backend-web-overhaul-v2` を qa_log へ記録済み | system-spec-harness elicit |
| `system-spec/ui-ux.md` | 上記 UI 質疑を「確定内容 (質疑録)」へ投影。13 節は維持 | compile-spec-doc |
| `system-spec/frontend.md` | 部品 3 段・能力表・画面分岐禁止・ナビ正本 | compile-spec-doc |
| `system-spec/backend.md` | 管理対象 CRUD API・コンセプト別文章・チャネル抽象 | compile-spec-doc |
| `docs/spec/feat-uiux-overhaul/ui-rules.md` | 実装後に成立している間隔・文章量・サイドバー規則 | P12 成果物 |
| `docs/spec/feat-uiux-overhaul/operations.md` | ブログ追加・SNS 追加の手順 | P12 成果物 |
| `architecture/arch-two-layer-platform.md` | 運営者面の画面規則の所在を related_nodes で結線 | 本受領 |
| `specs/system-spec-index.md` | UI-UX / frontend の実装状態を本 feature へ更新 | 本受領 |
| `features/feat-uiux-overhaul.md` | 受入 A1–A10 の実装合格と未公開を追跡 | 本 feature 正本 |
| `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p13.md` | 本受領書と品質ゲート証跡を completion_evidence へ | P13 overlay |

`specs/` に `feat-uiux-overhaul` 専用の仕様ファイルは置かない。画面規則の正本は `docs/spec/feat-uiux-overhaul/`、収集セルの正本は `system-spec/spec-state.json` であり、二重正本を作らない。

## 3. 本 PR に載せないもの（判断理由）

| 対象 | 判断 | 理由 |
|---|---|---|
| `system-spec/spec-state.json` 全体 | **載せない** | overhaul 質疑と、章規範接地（`*-normative-v1` 8 件）・reopen 履歴が同一ファイルに混在する。無関係な harness 差分を本 feature の PR に入れない |
| `system-spec/index.md` の作業ツリー | **載せない** | 作業ツリーは状態軸（requirement / document / implementation / verification）の説明を落としている。これは ah-a0o 系の再生成退行であり、本 feature の成果ではない |
| `system-spec/completeness-report.json` | **載せない** | 観点 `doc_freshness` が apple-hig の Last-Modified を再取得できず `INDETERMINATE`。verdict=FAIL は本 feature の受入とは別件（`ah-k9b` / gap-doc-freshness-unreachable-header） |
| `system-spec/auth.md` ほか overhaul 以外の章 | **載せない** | 本 feature の write_scope 外。規範接地の再コンパイル結果 |

章 3 ファイル（ui-ux / frontend / backend）は、overhaul 質疑の人間可読な投影なので本 PR に含める。機械可読正本（spec-state 全体）の commit は、completeness が PASS になり harness 差分を分けられるまで延期する。延期先は既存 Beads `ah-k9b`。

## 4. 実装で確定し、仕様へ戻す事実（再掲）

正本は [`ui-rules.md`](./ui-rules.md) と [`operations.md`](./operations.md)。章へ既に投影済みの質疑と、まだ spec-state 経由で確定セルへ上げていない実装規則を分ける。

### 既に章の質疑録へ投影済み

- 1 画面は単一用途。状態を変えるフォームは 1 つ
- 管理対象（ブログ・記事・商品・配信）に一覧・新規・編集・削除の API を揃える
- SNS は能力表と接続実装の追加で広げる。画面側は 0 行（実測）。接続実装は必要
- 1 商品から複数ブログへコンセプト別文章を作る

### spec-state 確定セルへの繰り上げを延期している実装規則

間隔トークン、文章量上限、サイドバー 19 項目 / 6 分類、ナビ正本 `admin-route-metadata.ts`、API の置き場所は `src/app/api`（`src/app/api/admin` は実在しない）。詳細は [`release-report.md`](./release-report.md) §4–5。

## 5. 品質ゲート（2026-08-23 再実行）

証跡: [`evidence/10-final-review-gates-20260823.txt`](./evidence/10-final-review-gates-20260823.txt)

| コマンド | 結果 |
|---|---|
| `npx tsc --noEmit --incremental false` | exit 0 |
| 受入・CRUD・関連検査 29 files / 662 tests | 全通過 |
| `node scripts/acceptance-reconciliation.mjs` | PASS（10 IDs / 128 evidence）digest `sha256:396ddfc13e9918420b5b29734b4c023880bd1b39d949de0396751ee93962cd82` |
| `validate-system-plan.py --feature-package feature-package/feat-uiux-overhaul` | exit 2。current ポインタ無し（`ah-k9b`。手で書いて通していない） |
| `pnpm run preview` | **未実行**。MVP のため Workers 本番相当の起動は本レビューの最小ゲートから外す |

## 6. 受領

- 仕様・設計への影響: **あり**
- 正規フローでの章投影: **ui-ux / frontend / backend の質疑録まで完了**
- spec-state 全体と completeness PASS: **未完了（`ah-k9b`）**
- 本 feature の公開: **未実施**。tracking は `active` のまま
