---
graph_node_id: "arch-two-layer-platform"
artifact_kind: "architecture"
artifact_subtypes: ["backend","frontend","data","security","infrastructure"]
project_id: "affiliate-content-os"
domain: "platform-architecture"
tags: ["two-layer","platform","blog","webmcp","generation"]
priority: null
start_date: null
target_date: null
iteration: null
title: "二層構造プラットフォームのアーキテクチャ"
owners: ["app-orchestrator"]
created_at: "2026-08-16T13:00:00Z"
updated_at: "2026-08-24T12:00:00Z"
status: "active"
depends_on: []
related_nodes: ["arch-system-spec-overview", "feat-uiux-overhaul", "feat-auth-workspace", "feat-blog-ui-builder"]
resource_scope: ["src/domain/","src/db/schema.ts","src/lib/webmcp/","src/lib/mcp/","docs/spec/04-二層構造統合仕様.md","docs/spec/feat-uiux-overhaul/ui-rules.md","docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md"]
purpose: "プラットフォーム層とブログ層の責務境界、共有ドメインサービス層、禁止依存を実装可能な形で固定する。"
goal: "管理画面・公開ブログ・WebMCP・バックエンドMCPが同一のドメインサービス層を呼び、ランキング式と品質検査の重複実装が0件である状態。"
scope_in: ["レイヤー境界","32エンティティの正規定義の所在","Editorial/Commercial分離","テナント分離","WebMCP/MCPの二層","生成パイプライン"]
scope_out: ["個別画面のUI詳細","文章作成メソッド本文（docs/spec/05）","プロンプト本文（docs/spec/07）"]
acceptance: ["同一概念に2つの正規定義が存在しない","ランキング式が src/domain/ranking 以外に存在しない（grep検査）","Ranking Service の入力型に報酬フィールドが含まれない","WebMCP の登録先が document.modelContext である","全 WebMCP ツールに対応する通常UI経路が存在する"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-two-layer-platform.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d01442b19c1b9e29681719f2768847c39ec0fea34bfdf6438247c814c037f765","evaluator":"app-orchestrator/two-layer-arbitration","evidence_ref":"docs/spec/04-二層構造統合仕様.md"}
source_lineage: {"imported_at":"2026-08-16T13:00:00Z","origin_kind":"manual","source_digest":"d01442b19c1b9e29681719f2768847c39ec0fea34bfdf6438247c814c037f765","source_path":"docs/spec/04-二層構造統合仕様.md","source_plugin":null,"source_version":"1.0"}
classification_confidence: 1.0
classification_reason: "二層構造の裁定文書から導出したアーキテクチャ文脈。"
classification_candidates: [{"artifact_kind":"architecture","candidate_path":"architecture/arch-two-layer-platform.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-16T13:00:00Z","evidence_refs":["docs/spec/04-二層構造統合仕様.md"],"policy":"manual","reconciled_at":"2026-08-16T13:00:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-16T13:00:00Z","missing_sections":[],"status":"complete"}
---

# 二層構造プラットフォームのアーキテクチャ

## Architecture overview

プラットフォーム層（管理面）とブログ層（読者面）の二層で構成する。ブログ層はプラットフォーム層が管理する Site の実体であり、独立プロダクトではない。両層は `src/domain/` の純関数群を唯一の業務計算層として共有する。

```text
プラットフォーム層（管理面）
  Workspace / Brand / Site 階層
  Affiliate Inbox, Product Intelligence, Comparison Engine,
  Persona Studio, AI Content Studio, Site Builder,
  Distribution Hub, Affiliate Hub, Analytics
        │  Content Package を出力
        ▼
ブログ層（読者面）= Site の実体
  18ルート / 記事共通構成25 / 記事タイプ4種 / 会話ブロック
  WebMCP（document.modelContext）/ WCAG 2.2 AA
        │
        ▼
src/domain/（両層が共通で呼ぶ唯一の計算層）
  ranking, evidence, comparison, content-quality, shared
```

## Context and drivers

確定したプロダクト像は「ブログ単体も構築でき、それらをプラットフォームで管理できる。さまざまなアフィリエイトの内容を合わせて構築できる」である。ブログ構築は独立機能ではなく Content Package の一出力先として扱う。これにより、サイトが増えても記事生成・品質検査・ランキング算出の実装が増殖しない。

駆動要因は次の4点である。

- 同じ概念に2つの正規定義を作らないこと（プラットフォーム層 §21 とブログ層 §12 の同名エンティティは同一の正規データを指す）
- 編集評価と報酬データを分離すること（プラットフォーム層 §19.4）
- ランキング式を UI や WebMCP へ重複実装しないこと（ブログ層 §27 禁止依存）
- 根拠のない主張を公開させないこと（プラットフォーム層 §30.4）

## Goals and non-goals

達成目標は、管理画面・公開ブログ・WebMCP・バックエンド MCP の4つの入口がすべて同一のドメインサービス層を経由し、ランキング式と品質検査の重複実装が0件である状態である。

対象外は、個別画面のビジュアル詳細（`docs/spec/06` が担う）、文章作成メソッドの本文（`docs/spec/05` が担う）、プロンプト本文とスキル定義（`docs/spec/07` が担う）である。本書はそれらの配置先と依存の向きだけを固定する。

## 実装からの書き戻し（feat-blog-ui-builder / 2026-08-24）

公開ブログの画面描画と機械向け出力（JSON-LD / sitemap / RSS / robots / llms.txt）は、同じ読み取りモデル（`PublishedArticle` / `PublicSiteBlueprint`）から派生させる。報酬・運営情報は読者向け読み取りポートを通さない。詳細と受領は [`docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md`](../docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md)。

## System context and boundaries

| レイヤー | 置くもの | 置かないもの |
| --- | --- | --- |
| `src/app/(admin)/` | 管理画面の Server Component と Route Handler | 業務計算 |
| `src/app/(reader)/` | 公開ブログのルート | 業務計算 |
| `src/lib/webmcp/` | WebMCP 登録アダプタ | ツールの実処理 |
| `src/lib/mcp/` | バックエンド MCP のエンドポイントと認可 | 業務計算 |
| `src/domain/` | 業務計算・判定の純関数。単体テストの対象 | I/O、DB アクセス |
| `src/db/` | Drizzle スキーマとクエリ | 業務計算 |

外部境界は ASP コネクタ（プラットフォーム層 §17.1 Connector 契約）、LLM プロバイダ、配信先 SNS、計測基盤である。いずれもアダプタ越しに接続し、ドメイン層から直接呼ばない。

上表は入口と計算層の関係を示すもので、実装のフォルダ構成としては次の4層に展開している。アダプタの宣言（ポート）は `src/application/ports/`、実装は `src/infrastructure/` に置く。層ごとの「置くもの／置いてはいけないもの」の正本は次を参照する。

| 文書 | 内容 |
| --- | --- |
| `docs/architecture/layers.md` | 4層（domain / application / infrastructure / presentation）の責務と依存方向 |
| `docs/architecture/context-map.md` | 9つの境界づけられたコンテキストと、禁止された参照関係 |
| `docs/architecture/ubiquitous-language.md` | 仕様・コード・DB・UI 文言で共通に使う言葉の辞書 |
| `docs/architecture/changeability-scenarios.md` | ASP追加・LLM差し替え・ブログ追加などで触るファイルの記録 |

依存方向は人のレビューではなく `pnpm run lint`（`eslint.config.mjs` の import 制限）と `pnpm test`（`tests/architecture/dependency-direction.test.ts`）が機械的に落とす。

## Container and component view

デプロイ単位は Cloudflare Workers 上の Next.js アプリ1つである。D1 をトランザクション正本、R2 を画像・生成物の保管、KV をセッションとキャッシュに使う。

コンポーネントは次のとおり。

- 管理面ルート群（プラットフォーム層 §22 の8画面群に対応）
- 読者面ルート群（ブログ層 §7 の18ルートに対応）
- ドメインサービス（`ranking` / `evidence` / `comparison` / `content-quality` / `shared`）
- 永続化（`src/db/schema.ts` にプラットフォーム層 §21 の全32エンティティを定義する。現行は13テーブルで、差分は `docs/product/traceability.md` F 節に全件記録する）
- 生成パイプライン（`src/domain/generation/` の入力検証と出力契約、`prompts/generation/` のバージョン付きプロンプト）
- 公開ゲート（`src/lib/content/publish-gate.ts`）

## Cross-cutting contracts

**API とイベント**: プラットフォーム層 §23.1 の API 契約に従い、Route Handler を唯一の HTTP 入口とする。§23.2 の16種ドメインイベントは `src/domain/events.ts` に型として定義し、発火はドメインサービスと Route Handler の境界で行う。購読側（通知・再生成・リンク切れ検出）は Cloudflare Queues を想定するが、初回は同期処理でよい。

**Editorial / Commercial 分離**: Ranking Service の入力型 `EditorialProduct` は `commission_rate` / `payout_amount` / `asp_revenue` を持たない。報酬データは Commercial 側の型に隔離し、混入をコンパイル時に排除する。

**テナント分離**: 全クエリに `workspace_id` 制約を強制する。Repository 層の関数シグネチャで `WorkspaceId` の branded type を必須引数にし、これを経由しないクエリを書けなくする（プラットフォーム層 §26.4）。

**provenance**: 取込値と手修正を別枠で保持し、確定済み期間はマスタ変更で据え置いて差分通知する（プラットフォーム層 §10.5）。突合は商品識別キーの優先順位（GTIN → ASIN → 型番 → ブランド+商品名 → SKU → 名前類似度）に従う。

**権限**: プラットフォーム層 §25 の10ロールを `src/domain/shared/authz.ts` の単一判定関数に集約し、画面側は判定結果だけを使う。

## Subtype architecture

### Backend

Route Handler がリクエストを受け、認可判定 → テナント束縛 → ドメインサービス呼び出し → 永続化の順で処理する。ドメインサービスは純関数で、DB アクセスを持たない。エラーは `src/domain/shared/errors.ts` の型で表し、HTTP 層で表示用に変換する。

### Frontend

管理面と読者面をルートグループで分ける。共通レイアウト部品1箇所で現在地（ステップ・タブ）と退避先（保存・戻る・次へ）を固定表示する。入力作法（空欄の意味、自動計算値の初期表示と自動／手入力の区別、Enter の挙動）は全画面で1組に統一する。読者面はブログ層 §20 の WCAG 2.2 AA を満たす。

運営者面の画面単位・間隔・文章量・サイドバー・CRUD 導線は `feat-uiux-overhaul` が所有する。規則の正本は `docs/spec/feat-uiux-overhaul/ui-rules.md`、収集セルへの投影は `system-spec/ui-ux.md` と `system-spec/frontend.md`。本書は二層の責務境界だけを固定し、画面規則を複製しない。

### Data

`src/db/schema.ts` を唯一のスキーマ定義とする。ブログ層 §12 の8エンティティはプラットフォーム層 §21 の同名エンティティと同一テーブルを指し、別定義を作らない。スキーマ変更は新規マイグレーションファイルで行い、適用前に `wrangler d1 export` でバックアップを取る。

### Security

プロンプトインジェクション対策として、外部由来テキストは `untrusted_source` 要素で隔離してからモデルへ渡す（ブログ層 §16.1）。アフィリエイト URL の取り込みは SSRF 対策（プライベート IP 帯の拒否、リダイレクト追跡上限、スキーム制限）を行う。アフィリエイトリンクには `rel="sponsored"` を付与する（ブログ層 §17.2）。WebMCP はオリジン制約に従い、状態変更ツールは確認 UI を必須とする。

### Infrastructure

Cloudflare Workers へ OpenNext 経由でデプロイする。マイグレーションはデプロイより先に実行する。secrets は wrangler secret で登録し、リポジトリに置かない。

## Architecture decisions

- ADR-001: 二層構造を採用し、ブログ層を Site の実体として扱う
- ADR-002: `src/domain/` を管理画面・公開ブログ・WebMCP・MCP の共通入口にする
- ADR-003: 報酬データを Commercial 側の型に隔離し、Ranking Service の入力型から構造的に排除する
- ADR-004: WebMCP の登録先を `document.modelContext` とし、`navigator.modelContext` は legacy fallback に降格する
- ADR-005: 執筆系サブエージェントと検証系サブエージェントを別コンテキストに分離する
- ADR-006: 生成プロンプトはバージョンディレクトリで管理し、既存バージョンを書き換えない

決定の全文と却下案は `docs/product/ledgers.md` の D 節を正本とする。

## Delivery, migration and rollback

生成パイプラインの流れは次のとおり。

```text
承認済み素材（Product / Claim / Evidence / TestRun / Persona / Blueprint / Template）
  → validateGenerationInput（欠落があれば生成しない）
  → プロンプト（prompts/generation/バージョン別）
  → モデル呼び出し（構造化出力）
  → 出力契約 generated_variant（JSON Schema と追加検証）
  → 自動検査 QC-01 から QC-17（src/domain/content-quality/）
  → 人間承認（編集者 → 監修者）
  → 公開ゲート（BLOCK が0件のときだけ通過）
  → Publication
```

`generation_prompt_version` と `fact_fingerprint` を ContentVariant に必ず記録し、再現性とペルソナ差分の事実境界を担保する。

フェーズ対応はプラットフォーム層 §28 の Phase 0 から6 とブログ層 §26 を別軸として扱い、対応と依存の向きは `docs/spec/04-二層構造統合仕様.md` §2-5 を正本とする。

ロールバックは直前タグへ戻して再デプロイする。スキーマ変更を含む場合はマイグレーション → デプロイの順を固定し、逆順で実行しない。

## Risks and verification

| リスク | 現れ方 | 検査 |
| --- | --- | --- |
| ランキング式の重複実装 | UI や WebMCP でスコアを再計算する | `src/domain/ranking` 以外でスコア計算語彙が出現しないことを grep テストで固定 |
| 報酬データの推薦への混入 | 報酬率が高い商品が上位に来る | `EditorialProduct` 型に報酬フィールドが無いことを型で担保し、テストで固定 |
| テナント越境 | 他 Workspace のデータが見える | Repository 関数の `WorkspaceId` 必須引数と結合テスト |
| WebMCP 非対応環境での破綻 | ページが動作しない | 能力検出を先に行い、非対応時は通常 UI へフォールバックすることをテストで固定 |
| 根拠のない主張の公開 | Claim に Evidence が紐づかない記事が公開される | 公開ゲートで BLOCK 判定し、テストで固定 |

テナント越境と capability 拒否は、2026-08-24 時点でローカル受入試験が PASS している。受け入れ条件はプラットフォーム層 §30.1 から §30.8 をそのまま採用し、結果は `docs/product/traceability.md` の各行へ記録する。Google OAuth の本番実往復と remote D1 適用は未検証である。

## 実装の現在地（非規範・2026-08-24）

本章の To-Be と ADR は変えていない。認証 / Workspace 境界、画面の部品、改善要望の診断は、二層の計算層ではなく identity / presentation / feedback コンテキストの実装契約である。

- 入口の門・capability・tenant・拒否監査: `architecture/system-spec-overview.md` の feat-auth-workspace 節、`system-spec/auth.md`
- 共通 UI の並べ方: `docs/architecture/ui-system.md`（`InlineNav` / `StackedList`）
- 改善要望の技術診断と保持期限: `docs/architecture/feedback-loop.md` §2-1 / §2-2
- 作業単位: Beads `ah-361` / graph node `feat-auth-workspace`。派生は `ah-8h2` / `task-worktree-dedup`
