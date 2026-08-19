---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1, G2]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**スキーマ適用済み・データ移行済み・分離検証済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §2 / §5、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

### As-Is（2026-08-16 のリポジトリ実体、Phase 1 マージ後）

- 環境ごとに D1 binding `DB` が1つある。運営者ドメインは `asps`、`programs`、`conversions` の3テーブル。読者ドメインは Phase 1 で `categories`、`people`、`disclosures`、`products`、`articles`、`article_people`、`article_products`、`conversation_blocks` 等を追加した。両ドメインは同一 D1 に同居するが、コードコメントと `docs/spec/data-model-gap.md` で分離を宣言している。
- 全テーブルに `workspace_id` がなく、actor / Workspace / membership / role / consent の永続化もない。D1 自体に行レベル認可はないため、現状はテナント分離を満たさない。
- `conversions.external_id` は任意かつ非一意で、単一 `status` は `pending | approved | rejected` の判断現在値だけ。取込原票、冪等性、判断履歴、`cancelled`、独立した入金状態を保持しない。
- ClickEvent、BehaviorEvent、MetricRollup、KPI辞書、`content_analytics_projection`、outbox は未実装である。
- 公開ゲート `src/lib/content/publish-gate.ts` は記事メタ（著者・広告表記・更新責任者・結論・カテゴリー・次回確認日）だけを検査する。Claim / Evidence は未実装。

### To-Be（規範契約）

| ID | 契約 | 配置 / 状態 |
|---|---|---|
| DB-BOUNDARY-01 | `EDITORIAL_DB` と `COMMERCIAL_DB` の2つの D1 を物理境界とする。Editorial は利用者・Workspace・コンテンツ・根拠・公開業務、Commercial は affiliate account/link、tracking、consent、event、conversion、attribution、rollup を所有する。cross-D1 foreign key / transaction は前提にしない | 未実装 |
| DB-TENANT-01 | tenant-owned row は `workspace_id NOT NULL`。主キー以外の business uniqueness、検索 index、repository 条件は workspace scope を先頭に含める。グローバル辞書だけを明示的な例外とする | 未実装 |
| DB-IDENTITY-01 | Editorial に actor（user / service account）と `workspace_membership(actor_id, workspace_id, role, status)` を持つ。認可の同一性は actor ID 単体でなく、この membership tuple とする。Commercial へは監査用 actor ID のみ記録し、権限判定を複製しない | 未実装 |
| DB-CONSENT-01 | Commercial に `consent_record(workspace_id, site_id, consent_key_hash, purpose, state, policy_version, effective_at)` を履歴として保持する。state は `granted \| denied \| withdrawn`。granted 前の event は session ID / IP hash を持たず、withdrawn 後は新規の識別可能 event を拒否する | 未実装 |
| DB-CONVERSION-01 | backend の BE-CONV-01 に従い conversion、import record、decision / settlement history を分離する。`conversion_key` は Workspace と affiliate account に scope された一意制約、`import_record_key` は再送 no-op の一意制約とする。conversion の現在値は二軸を投影し、単一 `status` 列は持たない | 未実装 |
| DB-STATE-01 | 承認軸は `approval_status = pending \| approved \| rejected \| cancelled`、支払軸は `payment_status = not_eligible \| unpaid \| scheduled \| paid \| reversed` とする。`scheduled/paid` は `approval_status=approved` の場合だけ許可する CHECK 制約を持つ。各軸の source timestamp と遷移を append し、古い原票で現在値を巻き戻さない。各変更は outbox event で集計再計算を要求する | 未実装 |
| DB-KPI-01 | KPI名、version、分子、分母、bot/速報/承認/支払の除外規則、最低標本数を辞書として一元化し、rollup に `kpi_definition_version` / `aggregation_set_version` を記録する。`revenue_approved` は `approval_status=approved` の `commission_amount_approved`、`revenue_paid` は `payment_status=paid` の `commission_amount_paid` と定義し、混同・合算しない。その他の定義は `docs/spec/03-分析・解析基盤仕様.md` §4–§5 を参照し、画面ごとに式を複製しない | 未実装 |
| DB-PROJECTION-01 | Editorial の transaction は同一DB内の `outbox_event` へ、分析に必要な非機密の content dimension 変更を同時記録する。consumer は event ID で冪等化し、Commercial の `content_analytics_projection` を upsert する。projection は `workspace_id + content/variant/publication ID + dimension values + source_version` を持ち、収益を Editorial へ逆流させない | 未実装 |

### Delta

1. `EDITORIAL_DB` / `COMMERCIAL_DB` の migration と binding を用意し、legacy `DB` の3テーブルを所有境界へ割り当てる。切替完了までは dual-write でなく、停止可能な backfill + 検証 + cutover を使う。
2. DB-TENANT-01 / DB-IDENTITY-01 を先行し、テナント条件のない repository を許可しない。
3. DB-CONSENT-01 / DB-CONVERSION-01 / DB-STATE-01 と append-only event を追加する。
4. DB-PROJECTION-01 の outbox relay 後に DB-KPI-01 と MetricRollup を構築する。

### Dependencies

依存方向は `前提 → 後続` とする。

- DB-BOUNDARY-01 → infrastructure の2 D1 binding、環境別 migration、backup / restore 手順。
- auth の session / service-account identity + DB-IDENTITY-01 → backend の BE-AUTH-01。
- DB-CONSENT-01 → 計測タグと event ingestion の同意判定。
- DB-PROJECTION-01 の outbox + Queue / dead-letter → projection consumer。consumer は `source_version` で順序逆転を解決する。
- DB-KPI-01 → BE-ANA-01 と Analytics 表示/API。Commercial data を商品評価・ランキングへ入力しない。

### Acceptance evidence

- schema snapshot で2 D1の所有テーブル、全 tenant-owned table の `workspace_id NOT NULL` と scoped unique/index を検査した記録。
- cross-workspace fixture が repository / API / MCP の全経路で分離されるテスト。
- granted 前・withdrawn 後の event に session ID / IP hash が保存されない privacy test。
- outbox を重複・順序逆転で配送しても projection が一意かつ最新になり、再送後に未処理 outbox がゼロになる recovery test。
- conversion の再取込・遅延した二軸の状態更新・rollup 再計算と、KPI version 一致を示す migration / contract test。DB が `scheduled/paid + approval_status!=approved` を拒否し、approved/unpaid は `revenue_approved` のみ、approved/paid は `revenue_paid` も計上すること。

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-analytics |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-database-web-analytics (対応セル: web)

**質問**: database×web: 集計層 MetricRollup のスキーマと再計算方針は何か (書面入力 docs/spec/03 §5)

**回答**: ## 5. 集計層(MetricRollup)

```yaml
metric_rollup:
  date: date
  grain: day
  dimensions:                       # §3 の組み合わせ(正規化キー)
    channel: string | null
    angle: string | null
    placement: string | null
    audience_persona_id: string | null
    # ... 任意の組み合わせ
  measures:
    impressions: number
    link_impressions: number
    clicks: number
    conversions_decision_pending: number
    conversions_decision_approved: number
    conversions_settlement_paid: number
    revenue_pending: number
    revenue_approved: number
    revenue_paid: number
    pv: number
    read_through: number
```

* 日次バッチ + 直近分の準リアルタイム加算(ダッシュボードは「本日分は速報」表示)
* 承認状態(`approval_status`: pending→approved等)または支払状態(`payment_status`: not_eligible→unpaid→paid等)の変化は対象日のロールアップを遡って再計算
* 高カーディナリティ組み合わせは事前集計せず、生イベントへのアドホック集計で対応(集計セット定義はバージョン管理)

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| data-access | Robert C. Martin — Clean Architecture | 永続化を境界の外側へ追い出し interface adapter で隔離する | Clean Architecture — gateways/repositories boundary |
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| data-access | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | application-architecture と同一 authority (書籍)。取得経路が無い点も同じ。 |
| reliability | 引用可 | 第 4 章 Service Level Objectives (https://sre.google/sre-book/service-level-objectives/) / 第 6 章 Monitoring Distributed Systems (https://sre.google/sre-book/monitoring-distributed-systems/) / 第 24 章 Distributed Periodic Scheduling with Cron (https://sre.google/sre-book/distributed-periodic-scheduling/) / 第 26 章 Data Integrity: What You Read Is What You Wrote (https://sre.google/sre-book/data-integrity/) |

- **reliability の引用範囲**: 取得済みなのは目次 (table of contents) のみ。引用根拠にできるのは『その章が存在すること・章番号・章題・正規 URL』まで。章本文は未取得のため、章の中の主張を要約して要件文の根拠にすることはできない。それをやると、取得していない内容を出典に帰属させることになる (C05 が実在しない日付 2026-07-03 を公式表明値として書いたのと同じ形)。

- **data-access の反転先**: 反転先は無い。application-architecture の reversal_note と同じ理由。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、スキーマ適用済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は DB-BOUNDARY-01〜DB-PROJECTION-01 と参照先仕様で管理する。

### Domain-Driven Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/ddd.md`

#### 目的

businessの重要なruleと用語をmodel/code/会話で一致させ、複雑性を適切な境界へ閉じ込め、継続的な学習をsoftwareへ反映する。

#### 解決する問題

- 仕様語、画面語、DB列、code名がずれ、変更時に意味を再解釈する。
- 異なる業務文脈の同名概念を一modelへ押し込み、巨大で矛盾したmodelになる。
- invariantとtransaction ownerが不明で、どこからでもdataを変更できる。
- legacy codeのtechnical構造がbusiness capabilityを隠し、改善順を決められない。

#### 適用条件

- rule、例外、用語、状態遷移が多く、domain expertとの継続的なmodel学習が価値を持つ。
- team/部門ごとに言葉やownershipが異なり、integrationで翻訳が必要。
- core domainの差別化がsystemの本質的目的に直結する。

#### 非適用条件

- 単純CRUD、汎用supporting機能、既製serviceで十分なgeneric subdomain。
- domain expertへアクセスできず、用語とruleを検証するfeedback loopを作れない段階。
- bounded contextをservice数へ機械変換する目的。monolith内moduleでも境界は成立する。

#### トレードオフ・失敗モード

- workshop、model、mapping、専門語彙の維持に継続的な時間が必要。
- aggregateを大きくしすぎてlock/latencyを増やす、細かくしすぎてinvariantをeventual consistencyへ漏らす。
- 「Repository/Entity」等のpattern名だけ採用したanemic modelになり、business ruleがserviceへ散る。
- bounded contextを組織図やDB tableから決め、実際の言語・capability境界を検証しない。
- eventを事実でなくcommandとして命名し、ordering/idempotency/failure recoveryを設計しない。

#### goalへの寄与

- U1-U9の語彙をmodelへ接続し、goalがどのcontext/capability/invariantで実現されるかを示す。
- core domainへ設計投資を集中し、generic領域は無料/低コストserviceや標準実装も比較対象にできる。
- refactoringは一括rewriteでなく、重要なbusiness rule周辺からstrangler/bubble context等で境界を育てる。

---

#### 本章での適用

##### 確定内容 qa-database-web-analytics (対応セル: web)

- 確定要件: ## 5. 集計層(MetricRollup)

```yaml
metric_rollup:
  date: date
  grain: day
  dimensions:                       # §3 の組み合わせ(正規化キー)
    channel: string | null
    angle: string | null
    placement: string | null
    audience_persona_id: string | null
    # ... 任意の組み合わせ
  measures:
    impressions: number
    link_impressions: number
    clicks: number
    conversions_decision_pending: number
    conversions_decision_approved: number
    conversions_settlement_paid: number
    revenue_pending: number
    revenue_approved: number
    revenue_paid: number
    pv: number
    read_through: number
```

* 日次バッチ + 直近分の準リアルタイム加算(ダッシュボードは「本日分は速報」表示)
* 承認状態(`approval_status`: pending→approved等)または支払状態(`payment_status`: not_eligible→unpaid→paid等)の変化は対象日のロールアップを遡って再計算
* 高カーディナリティ組み合わせは事前集計せず、生イベントへのアドホック集計で対応(集計セット定義はバージョン管理)
- 設計解釈の記録経路: `dialogue`
- 原則: 日次グレインのロールアップを正とし、`approval_status` (pending→approved等) と `payment_status` (not_eligible→unpaid→paid等) の変化は対象日を遡って再計算する (`docs/spec/03-分析・解析基盤仕様.md#§5`)
  - 採否: `applied`
  - 章固有の根拠: D1 (SQLite) に metric_rollup テーブルを Drizzle スキーマで定義し、workspace_id 必須のテナント分離を全イベント/集計テーブルに強制する。ClickEvent/BehaviorEvent は append-only、ip_hash は 90 日で削除
  - トレードオフ:
    - 高カーディナリティ組み合わせを事前集計しないため、アドホック分析はレイテンシが増えるが、D1 の容量とコストを抑えられる
- 原則: Editorial Database と Commercial Database を分離し、成果・報酬データは Commercial 側のみに格納する (`docs/spec/03-分析・解析基盤仕様.md#§2`)
  - 採否: `applied`
  - 章固有の根拠: Conversion/ClickEvent/MetricRollup は Commercial 系スキーマに置き、Editorial 側から参照不可にする (v1.0 §19.4 の物理的強制)
  - トレードオフ:
    - スキーマが二系統になり管理コストが増えるが、法令・信頼性要件を構造で担保できる
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1 | 2026-08-16 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-08-16T09:01:52Z | 2026-08-16T09:02:16Z |
