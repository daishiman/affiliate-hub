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
| Web (web) | 確定 | 確定質疑: `qa-database-web-spec-intake` (正本 `spec-state.json` の `qa_ref`)。先行質疑 `qa-database-web-analytics` は `qa_refs` に残り、本章にも併記する |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.database.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | database × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database-web-spec-intake` |
| 資するゴール (serves_goals) | G1, G2 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | written-requirements |
| 出典 path | `docs/spec/06-サイトブループリント-記事構成テンプレート.md` |
| 出典 節 | §2 SiteBlueprint のパラメータ定義 |
| 出典 sha256 | `d53fe38abd234fffa7905c74000b7198c025e5c84cbb019b88fa30245c99e18b` |
| 適用された設計知識 (design_applications) | 7 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由 (2026-08-20 実測)

C05 gaps[0] は「8 章 + 00 を再生成して確定セル内容と decisions[] を本文へ載せる」と書いているが、**再生成も本文複製もしない**。理由は 3 つあり、どれも読んで判断したのではなく測った結果である。次に読む人が善意で「正本に合わせる」と、下に書いた退行が起きる。**この節はそのために置いてある。**

**理由 1: 再生成すると章の規範本文が消える。** compile 出力と本番章を突き合わせた結果、章にあって生成器にも正本にも無い行が `system-spec/*.md` 10 枚で **374 回出現**した (分母 = 10 枚の空行を除く全行)。同じ行をファイル内で畳むと **366 行**、10 枚を横断して畳むと **316 行**。3 つの数はすべて正しく、数えている対象が違うだけである (出現回数 / ファイル内一意 / 全体一意)。消えるのは To-Be 契約表 (`DB-*` / `BE-*` / `INF-*` / `*-REQ-*` / `*-ACC-*`)、故障モード、初期 SLO、Acceptance evidence、index の状態軸。

**理由 2: 正本の回答は章より古い。** 章と正本の両方に現れうるトークン 9 個で照合した (分母 = 照合トークン 9 個)。

| トークン | 正本 `qa-database-web-spec-intake` の回答 | `system-spec/database.md` |
|---|---|---|
| `conversions_pending` | 1 | 0 |
| `conversions_approved` | 1 | 0 |
| `revenue_confirmed` | 1 | 0 |
| `conversions_decision_pending` | 0 | 2 |
| `conversions_settlement_paid` | 0 | 2 |
| `revenue_approved` | 0 | 4 |
| `revenue_paid` | 0 | 4 |
| `approval_status` | 0 | 7 |
| `payment_status` | 0 | 5 |

上 3 行は正本にしかない**旧名**、下 6 行は章にしかない**現行名**である。つまり `MetricRollup` の列名について**正本のほうが古い**。正本の本文を章へ複製すると列名が旧名へ戻る。「正本が新しい」という前提が成り立たない以上、複製は同期ではなく退行になる。

**理由 3: 章が名指す確定質疑が正本の `qa_ref` と食い違っていた。** 8 カテゴリ中 **7 件で不一致**、一致は auth のみだった (分母 = `coverage_matrix` の web セル 8 件)。章側は `qa-*-analytics` / `qa-*-web` を、正本側は `qa-*-spec-intake` を名指していた。本節と `## カテゴリ別収集状態` の Web 行は**正本の値を正**として書き直した。章側の旧 ID が指していた質疑録の本文は `## 確定内容 (質疑録)` にそのまま残してあり、**消していない** (理由 2 のとおり、章側の本文のほうが新しいため)。

以上より gaps[0] は、**本文を増やさず「確定の根拠がどこにあるか」を章に載せる**形で実行した。正本の所在は 2 つに分かれる — **規範本文の正本は章、確定セルの状態の正本は `spec-state.json`**。食い違ったら、本節の表は `spec-state.json` を正とし、規範本文は章を正とする。

## 意思決定 (decisions)

> 正本 `decisions[]` の全 6 件。**6 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| **`decision-editorial-commercial-split`** | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | **database** |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | frontend |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |

- **`decision-editorial-commercial-split` が本章に効く形**: 「報酬額をランキングの入力にしない」という禁止を、コードの中ではなく **D1 を 2 本に分ける**位置で担保する。越えるには設定を書き換えるしかなくなり、越えた事実が差分に残る。

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

### qa-database-web-spec-intake (対応セル: web)

**質問**: database×web: SiteBlueprint はどのパラメータを持ち、どの検証で BLOCK するか (書面入力 docs/spec/06 §2)

**回答**: | BP-01 | `ranking_model_id` が他サイトの Blueprint と重複しない | BLOCK（§16.6 言い換え記事の防止） |
| BP-02 | `ranking_inputs_prohibited` に報酬関連フィールドが全件含まれる | BLOCK（§19.4） |
| BP-03 | `audience_persona_ids` が1件以上 | BLOCK |
| BP-04 | `disclosure_policy_id` が実在する Disclosure を指す | BLOCK |

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

##### 確定内容 qa-database-web-spec-intake (対応セル: web)

- 確定要件: | BP-01 | `ranking_model_id` が他サイトの Blueprint と重複しない | BLOCK（§16.6 言い換え記事の防止） |
| BP-02 | `ranking_inputs_prohibited` に報酬関連フィールドが全件含まれる | BLOCK（§19.4） |
| BP-03 | `audience_persona_ids` が1件以上 | BLOCK |
| BP-04 | `disclosure_policy_id` が実在する Disclosure を指す | BLOCK |
- 設計解釈の記録経路: `dialogue`
- 原則: SiteBlueprint はウィザード 13 ステップと 1 対 1 で対応するパラメータ集合であり、blueprint_id と version を持ち変更時にインクリメントする (`docs/spec/06-サイトブループリント-記事構成テンプレート.md#§2`)
  - 採否: `applied`
  - 章固有の根拠: Blueprint を 1 テーブルの版付きレコードとして持ち、Site から version 付きで参照する。ステップの追加はパラメータの追加として表現し、別テーブルを増やさない
  - トレードオフ:
    - 1 レコードが大きくなるが、ウィザードの並びと保存形が一致し対応の追跡が容易になる
- 原則: BP-01〜BP-06 の検証規則。BP-01（ranking_model_id のサイト間重複）と BP-02（報酬関連フィールドが ranking_inputs_prohibited に全件含まれる）は BLOCK (`docs/spec/06-サイトブループリント-記事構成テンプレート.md#§2-1`)
  - 採否: `applied`
  - 章固有の根拠: 検証をアプリ層だけに置かず、ranking_model_id には一意制約を張る。BP-02 は報酬関連フィールドの一覧を 1 箇所に持ち、差集合が空でなければ保存を拒否する
  - トレードオフ:
    - Blueprint の保存が失敗しやすくなるが、言い換え記事と報酬由来の順位づけを保存の時点で止められる
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1 | 2026-04-30 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |
