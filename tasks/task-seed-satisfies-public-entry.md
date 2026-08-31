---
graph_node_id: "task-seed-satisfies-public-entry"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["data","dx","regression"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "見本データが読者側の入口を満たしていない（設計図・作業場所・URL 名の 3 点）"
owners: ["daishiman"]
created_at: "2026-08-30T13:00:00Z"
updated_at: "2026-08-30T13:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["scripts","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"固定ページ 16 経路が 404 だったので実測したところ、見本データが読者側の公開条件を 3 点で満たしていなかった","mvp_fit":"enabling","purpose":"開発機で画面を触れる状態を、DB の残骸に頼らず見本データだけで再現できるようにする","rationale":"3 つとも INSERT は成功し行も在りログも無言なので、画面の 404 からは『まだ作っていないページ』と区別が付かない。検査を SQL の側に置く"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-seed-satisfies-public-entry.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-30T13:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"scripts/seed/local-seed-data.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "開発機の見本データと読者側公開経路の整合。実装ではなく開発体験と回帰検査の課題"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-seed-satisfies-public-entry.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

開発機に入れる見本データを、**読者側の入口が実際に要求している条件**まで満たす形にする。
併せて、同じ壊れ方が戻ってきた日に **SQL の側で赤くなる**検査を置く。

## 背景

`/s/<ブログ>` 以下を開くと `src/presentation/site/page-frame.tsx` は骨格を描く前に
`readPublicSiteProjection` を呼び、`null` なら `notFound()` する。その内側
（`resolvePublicSiteIdentity`、`src/infrastructure/persistence/d1/blog-ops-repository.ts`）が
通るには **2 つの表がそろっている**必要がある。

1. `site_blueprints` にそのブログの設計図が在る
2. `site_network_node` に同じ URL 名が `status='active'` / `deleted_at IS NULL` で
   **ちょうど 1 行**在り、作業場所が設計図と一致する

2026-08-30 の実測で、見本データはこの条件を 3 通りに破っていた。

- `legal_page` など 4 表の `INSERT` が `workspace_id` を書いていなかった。この列は
  `DEFAULT '' NOT NULL` なので、**書かなければ空文字が黙って入る。**
- 子ブログの URL 名が手書きの `"gear-for-small-kitchen"` で、見本の 2 本目
  （`compact-kitchen-gear`）と食い違っていた。**設計図の無い URL 名**へ固定ページ 8 枚と
  版面と記事を入れていたことになる。
- `site_blueprints` そのものを見本データが **1 行も書いていなかった。** それでも画面が
  出ていたのは、D1 に過去の別経路で入った行が残っていたからである。
  `pnpm db:migrate:local` から作り直せば `/s/` 以下が 1 枚残らず 404 になる。

3 つとも壊れ方が同じ形をしている。**`INSERT` は通る / 行は在る / `status` も
`published` / ログにも何も出ない。** 画面の 404 は「まだ作っていないページ」と
区別が付かず、データを開いて欄が空であることに気づくまで原因の候補にすら挙がらない。

## 実装対象

- `scripts/seed/local-seed-data.ts`
  - `SEED_HUB_SLUG` / `SEED_SUB_SLUG` を、値を写さず見本
    （`@/infrastructure/persistence/sample/site-sample-repository`）から import して指す
  - `site_blueprints` の `DELETE` + `INSERT` を追加する
  - `legal_page` の `DELETE` を、URL 名ではなく id の接頭辞 `lp_seed_` を目印にする
- `tests/architecture/seed-satisfies-public-entry.test.ts`（新規）
- `tests/architecture/seed-writes-workspace-id.test.ts`（新規）
- `tests/architecture/seed-covers-cases.test.ts`（id 抽出を列名基準へ修正）

## 入力と前提条件

- `drizzle/meta/*_snapshot.json` が最新であること（`workspace_id` を持つ表の一覧をここから引く）
- `sampleSites()` が公開ブログの正本であること
- `pnpm db:migrate:local` で作り直した空の D1 でも成立すること

## 出力と成果物

- 見本データが、読者側の入口が要求する **組**（設計図と網）を満たす
- 作業場所の列を持つ 59 表すべてについて、`INSERT` が列を落としていないことを見る検査
- 上記 3 通りの壊れ方が戻ったら落ちる検査（合計 12 件）

## 実行手順

1. `resolvePublicSiteIdentity` を読み、公開の条件を正本から確定する
2. sqlite を直接開き、どの表に何が入っているかを実測する
3. `SEED_SUB_SLUG` を見本の import へ差し替える
4. `site_blueprints` の書き込みを足す
5. `legal_page` の `DELETE` を id 接頭辞へ変える（主キー衝突の回避）
6. 検査を書き、**直す前の状態で赤くなることを確かめてから**通す

## 受入条件

- `pnpm db:migrate:local` からやり直しても `/s/home-office-desk` と
  `/s/compact-kitchen-gear` の固定ページ 8 経路ずつが 200 を返す
- 作業場所の列を持つ表への `INSERT` が、列を落とすと赤くなる
- 網に載せる URL 名に設計図が無いと赤くなる
- 見本の 1 本目・2 本目と `SEED_HUB_SLUG` / `SEED_SUB_SLUG` がずれると赤くなる
- 検査は母数を同じ `it` の中に併記し、対象 0 件で緑になる形を作らない

## 検証方法

- `npx vitest run tests/architecture` → 69 files / 837 tests 緑（2026-08-30 実測）
- `npx vitest run`（全体）→ 434 files / 10101 tests 緑（2026-08-31 実測）
- `npx tsc --noEmit --incremental false` → 出力なし
- `npx eslint`（対象 5 ファイル）→ 出力なし
- 実測（修正後）:
  `home-office-desk` top=200 blog=200 固定ページ 8/8=200、
  `compact-kitchen-gear` 同上、記事本文 1600 文字（修正前 1086 文字）

3〜5 本目のブログ（`first-camera` / `run-and-recover` / `mobile-plan-navi`）は
404 のままだが、これは仕様どおりである。`resolvePublicSiteIdentity` が
`site_network_node` の `active` 行を公開の条件にしており、見本データは網に 2 本しか
載せない。網に載せる本数を変えるのは仕様判断なので、この task では変えていない。

## 依存関係

無し。前段の `workspace_id` 書き落としの修正は本 task に含まれている。

## Write scope と競合制約

`scripts/seed/` と `tests/architecture/`。

`scripts/seed/local-seed-data.ts` には他セッション由来の変更（`SeedFixedPage` 型の新設、
`legal_page` の `deleted_at` 固定）が同一ファイルに混在しており、分離できない。
このファイルは丸ごとコミットする。

`docs/product/test-traceability.md` は生成物で、他セッションの未コミットテストを
大量に含むため **コミットに含めない**（含めると docs が実在しないファイルを指す）。

## リスクとロールバック

見本データだけを触っており、製品の振る舞いは変えていない。壊れても影響は開発機に閉じる。
戻すときは `scripts/seed/local-seed-data.ts` の 3 箇所を revert して
`pnpm db:seed:local` を当て直す。

`site_blueprints` の `DELETE` は `workspace_id` と `slug` で絞っているので、
見本以外の設計図は消さない。

## Handoff

**「行が在る」を確認しても足りない。** 読者側の公開は 2 つの表の組で決まる。
片方だけ在る状態は画面から「まだ作っていない」と区別が付かない。

**偶然の一致は、次に正本が変わった日に切れる。** 親側の URL 名は見本を写した値で
偶然一致していたので誰も気づかなかった。値を写さず import して指すこと。

## GitHub publication

`draft_pr`。base は `dev`。

## 規範

- `src/infrastructure/persistence/d1/blog-ops-repository.ts`（公開条件の正本）
- `src/infrastructure/persistence/sample/site-sample-repository.ts`（見本の正本）
- `tests/architecture/form2-population-floor.test.ts`（母数を同じ検査に置く規約）
