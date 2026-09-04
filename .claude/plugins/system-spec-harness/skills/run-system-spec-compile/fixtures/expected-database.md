---
status: confirmed
category: database
aggregate: 確定
spec_cells: [database.web, database.mobile, database.tablet, database.desktop-windows, database.desktop-linux, database.desktop-macos]
serves_goals: [G1]
---

# データベース (database)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database |
| モバイル (mobile) | 確定 | 確定質疑: qa-database |
| タブレット (tablet) | 確定 | 確定質疑: qa-database |
| デスクトップ (Windows) (desktop-windows) | 確定 | 確定質疑: qa-database |
| デスクトップ (Linux) (desktop-linux) | 確定 | 確定質疑: qa-database |
| デスクトップ (macOS) (desktop-macos) | 確定 | 確定質疑: qa-database |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | database × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | G1 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

| 項目 | 値 |
|---|---|
| セル | database × mobile |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | — |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

| 項目 | 値 |
|---|---|
| セル | database × tablet |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | — |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

| 項目 | 値 |
|---|---|
| セル | database × desktop-windows |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | — |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

| 項目 | 値 |
|---|---|
| セル | database × desktop-linux |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | — |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

| 項目 | 値 |
|---|---|
| セル | database × desktop-macos |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database` |
| 資するゴール (serves_goals) | — |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | — |
| 出典 path | — |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 0 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`database`) を主担当とする **0 件**。全 1 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

- 本章を主担当とする決定は無い。

## 確定内容 (質疑録)

### qa-database (対応セル: web, mobile, tablet, desktop-windows, desktop-linux, desktop-macos)

**質問**: データ永続化方式は?

**回答**: PostgreSQL 16 を全プラットフォーム共通で採用

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

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

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

##### 確定内容 qa-database (対応セル: web, mobile, tablet, desktop-windows, desktop-linux, desktop-macos)

- 確定要件: PostgreSQL 16 を全プラットフォーム共通で採用
- 設計解釈の記録経路: `unrecorded`
- 設計原則の採否根拠: 未記録。この質疑に `design_applications` が無いため、章はこの質疑を根拠に設計原則の採否を主張しない
- 資するゴール: G1

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| postgres | 16.1 | PostgreSQL Global Development Group (www.postgresql.org) | https://www.postgresql.org/docs/16/ | 2026-07-11T00:00:00Z | 2026-07-11T00:00:00Z |
