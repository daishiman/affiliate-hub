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

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-database-web-blog-builder。裏付け質疑 (`qa_refs`): `qa-database-web-spec-intake`, `qa-database-web`, `qa-database-web-analytics` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-database-web-blog-builder (対応セル: web)

**質問**: database×web: ブログテンプレート・テーマ・固定ページ・ブログ×アフィリエイト対応の永続化をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録)。参考ブログ https://makuring.jp/ は構成のみ参考にし、文章・素材は転用しない。同サイトの機械取得は本セッションで拒否されたため、構成の一次根拠は利用者の説明とする。

**回答**: 利用者本人の回答を逐語主旨で記録する。
(1) ブログを作成するための UI を構築・変更したい。今後様々なブログを作るため、ブログごとにテンプレートを元に作成できるようにする。
(2) ブログの色合い (配色) はその都度選択して構成を変更できるようにする。ページ単位で「このページはこの色合い」と調整できるようにする。
(3) ブログに関して、見える部分 (公開面)・作成する部分 (編集)・保存する部分 (永続化)・管理上で一覧表示する部分 (管理一覧) のそれぞれで、どのブログにどのアフィリエイトが反映されているかを管理できる UI/UX にする。
(4) 参考ブログ (makuring.jp) を丸パクリせず、配置・構成・タイトルの表記方法・トップページから作れるページ種別を参考に構築する。文章はそのまま使わない。
(5) 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせを含めて全て構築できるようにする。
(6) 各ページの構成・記事の見やすい配置・図解・比較などの表現パターンも参考にして構築できるようにする。
(7) 参考ブログはガジェット前提だが本システムはガジェット限定ではないので、ジャンル依存部分 (スペック表など) は差し替え・調整できるようにする。
(8) サイドバー・ヘッダー・フッターは常に見えるようにする。参考ブログはスクロールで流れてしまうので、スクロール追従 (sticky) で整える。
(9) 今回で全ての内容を実装したいので、要件定義からタスク管理表まで作成する。
#### database 章への反映方針
- 追加エンティティ: blog_template (セクション構成の宣言データ)、blog_theme (デザイントークン集合、ブログ既定)、page_theme_override (ページ単位の配色上書き)、legal_page (固定ページ種別と本文、ブログ単位)、blog_affiliate_placement (ブログ/記事×アフィリエイト案件の反映対応)。
- 既存 32 エンティティ (Site/Brand/Article/Offer 等) を拡張し、複製しない。テンプレート・テーマは version を持ち、公開済みブログが参照する版を固定できる。
- 保存先は既存 D1 (Drizzle) を継続する。

- (注記: 正本 qa_log[qa-database-web-blog-builder].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-database-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: SiteBlueprint はどのパラメータを持ち、どの検証で BLOCK するか (書面入力 docs/spec/06 §2)

**回答**: | BP-01 | `ranking_model_id` が他サイトの Blueprint と重複しない | BLOCK（§16.6 言い換え記事の防止） |
| BP-02 | `ranking_inputs_prohibited` に報酬関連フィールドが全件含まれる | BLOCK（§19.4） |
| BP-03 | `audience_persona_ids` が1件以上 | BLOCK |
| BP-04 | `disclosure_policy_id` が実在する Disclosure を指す | BLOCK |

### qa-database-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: データベース (database) × web の技術要件は何か (2026-08-16 対話ヒアリング)

**回答**: 現行構成で確定。技術基盤は現行リポジトリの構成(Next.js + Cloudflare Workers/OpenNext + D1 + Drizzle ORM)を正として仕様に確定する。

### qa-database-web-analytics (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: database×web: 集計層 MetricRollup のスキーマと再計算方針は何か (書面入力 docs/spec/03 §5)

**回答**: #### 5. 集計層(MetricRollup)

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
    conversions_pending: number
    conversions_approved: number
    revenue_pending: number
    revenue_confirmed: number
    pv: number
    read_through: number
```

* 日次バッチ + 直近分の準リアルタイム加算(ダッシュボードは「本日分は速報」表示)
* 成果の状態変化(pending→approved等)は対象日のロールアップを遡って再計算
* 高カーディナリティ組み合わせは事前集計せず、生イベントへのアドホック集計で対応(集計セット定義はバージョン管理)

- (注記: 正本 qa_log[qa-database-web-analytics].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)

`feat-blog-ui-builder` (P01〜P12) の実装で確定したデータモデルを記録する。
定義の正本は `src/db/schema.ts` である。**ここは正本の写しではなく、
なぜその形なのかと、実装で分かった未解決の欠陥を書く。**

### 1. 確定した 6 表

| 表 | 一意性 | 作業場所索引 | 役割 |
|---|---|---|---|
| `blog_template` | `site_slug` | `(workspace_id, site_slug)` | 1 ブログ 1 テンプレート |
| `blog_theme` | `site_slug` | `(workspace_id, site_slug)` | 1 ブログ 1 配色 |
| `page_theme_override` | `(site_slug, page_path)` | `(workspace_id, site_slug)` | ページ単位の配色例外 |
| `legal_page` | `(site_slug, kind)` | `(workspace_id, site_slug, kind)` | 固定ページ 8 種 |
| `blog_affiliate_placement` | なし (複数可) | `(workspace_id, site_slug)` | 記事 × 掲載位置 |
| `guideline_references` | なし | `(workspace_id)` | SEO/AI 指針の出典 |

**確定した契約 — `workspace_id` を全表が列として持つ。**
`site_slug` から `site_blueprints` を辿れば所有は分かるが、それでは足りない。

- slug の一意性は `site_blueprints` の索引 1 本が支えているだけで、
  **作業場所ごとに slug を再利用したくなった日に黙って崩れる**
- 経由の確認は**書き手が正しく書いた場合しか効かない**。
  列は、誰が次の問い合わせを書いても外せない床になる

**1 本のクエリが単体で作業場所に絞れること**を表の側で持つ
(`tests/architecture/tenant-scoped-schema.test.ts` が検査する)。

**確定した契約 — 索引の 1 段目は必ず `workspace_id`。**
`site_slug` 始まりの索引しか無いと、絞り込みの過程で他所の行まで読む。

**確定した契約 — 一意性は `site_slug` のままにする (作業場所を跨がない)。**
「1 ブログ 1 配色」という制約そのものは作業場所と無関係だからである。

### 2. 「上書きが無い」を NULL でなく行の不在で表す

`page_theme_override` は、行を消すとブログ既定へ戻る。
NULL 値で「上書きなし」を表すと、「上書きしていない」と
「上書きの結果 NULL になった」が区別できなくなる。

同じ理由で `legal_page` の不在は「未整備」であり、既定文を出さない。
**見本の文を本物として配らない。**

### 3. `guideline_references` — 確認日と取得時刻を別の列で持つ

| 列 | 何を表すか |
|---|---|
| `checked_at` | 要旨を読んで確認した日 (YYYY-MM-DD) |
| `source_fetched_at` | 原典の本文を取得した時刻 (ISO 8601)。null は未取得 |
| `source_sha256` | 取得した本文の指紋 |
| `previous_source_sha256` | 1 つ前の指紋。これと違えば指針が書き換わっている |
| `re_evaluated_sha256` | **この本文版について仕様の再評価を完了した指紋** |

**確定した契約 — 再取得だけでは `re_evaluated_sha256` を動かさない。**
取得と再評価は別の事実である。1 列にまとめると、
「取ってきたが読んでいない」状態を機械が持てなくなる。

**確定した契約 — 出典そのものの本文は保存しない。**
古くなった写しを正本に見せないためである。指紋だけを持つ。

90 日の判定は `src/domain/seo/guideline-reference.ts` の
`referenceReviewStatus` だけが行う。表は日付を持つだけで、判定は持たない。

### 4. 未解決の欠陥 (2026-08-30 時点)

#### 4.1 🔴 `workspace_id` の migration が未コミット

`blog_theme` と `page_theme_override` の `workspace_id` は
`src/db/schema.ts` に定義済みだが、対応する migration
(`drizzle/0040_serious_madelyne_pryor.sql`) が生成済み・**未コミット**である。

**このまま本番へ出すと、D1 に列が無いのにコードは列があるつもりで問い合わせ、
配色の保存も読み出しも実行時に落ちる。**

`pnpm run verify` の「マイグレーションの作り忘れ」検査は
`git status --porcelain drizzle` を見るので、生成しただけでは緑にならない。
**この検査は「生成できるか」ではなく「コミットに入っているか」を見ている。**
生成だけで緑になると、CI は通るのにデプロイで落ちる状態が作れてしまう。

#### 4.2 🔴 `legal_page` を 2 系統の語彙が触っている

同じ表を `SiteDocumentKey` (9 種) と `FixedPageKind` (8 種) が触っている。
`site-document-repository.ts` が写像してから書く形になっているが、
写像表 `KEY_TO_KIND` は **9 鍵中 4 鍵しか持たない**。
残る 5 行は永久に「未記入」として扱われる。

同居させると、同じ 1 枚を 2 つの画面が別の行として作り、
**後から書いたほうが黙って勝つ。**

加えて永続層に 3 件の欠陥がある。

1. `save()` が `status` を書かない → 新規が `draft` のまま `[fixedPage]` に永遠に出ない
2. `findSiteDocument()` が `deleted_at` を見ない → 論理削除した行が読める
3. `findSiteDocument()` が `workspace_id` で絞らない → **作業場所の越境**

3 は §1 で列を足した目的そのものが達成されていない箇所である。
**列があることと、クエリがそれを使うことは別である。**

実測では 18 経路のうち 12 経路が 404
(`docs/spec/feat-blog-ui-builder/evidence/11-a4-a13-http-status.txt`)。

#### 4.3 ⚠️ 書き込みが操作の記録に届かない

`createManageBlogAppearanceUseCase` (配色の保存) と
`createReviewBlogPlacementsUseCase` (掲載の増減) の書き込みが、
操作の記録に届いていない (`pnpm run verify` の「つなぎ目の呼び出し」検査が検出)。

**掲載の増減は金銭に直結するため、いつ・誰が・何を消したかを
後から機械で追えない状態は出す前に直すものである。**

- 正本へ入れた理由: feat-blog-ui-builder P01〜P12 で確定した 6 表のデータモデル (workspace_id を列として持つ理由・索引順・行の不在で状態を表す設計) と、実装で判明した未解決の欠陥 3 件を正本へ記録する。章へ直接書くと compile で消えるため。

### migration の未コミットを解消 — feat-blog-ui-builder リリース (P13、2026-08-31)

同章の「実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)」§4.1 で
🔴 として記録した「`workspace_id` の migration が未コミット」は、**本リリース commit で解消した。**
前の記録は消さずに残す。消すと「一度この状態で出そうとしていた」という事実が引けなくなる。

### 解消した内容

`drizzle/0040_serious_madelyne_pryor.sql` と `drizzle/meta/0040_snapshot.json` を
リリース commit に含めた。これで `pnpm run verify` の
「マイグレーションの作り忘れ」検査 (`git status --porcelain drizzle` を見る) が緑になる。

**この検査が見ているのは「生成できるか」ではなく「commit に入っているか」である。**
生成だけで緑になる設計だと、CI は通るのにデプロイで落ちる状態が作れてしまう。
今回はまさにその状態が 1 日残っていた。

### 0040 が壊れ方を選んでいる形

`workspace_id` の埋め戻しは、親 `site_blueprints` から所有が一意に決まらない行があると
**schema 変更より前に停止する**。停止のさせ方は、`CHECK (workspace_backfill = 0)` を持つ
guard 表へ `SELECT count(*) ... HAVING count(*) > 0` を INSERT する形である。

- 孤児が 0 件 → 行が 1 つも挿入されず、そのまま通る
- 孤児が 1 件でもある → CHECK 違反で migration 全体が落ちる

**「所有者不明の行を空文字で埋めて先へ進む」を、書き方の約束ではなく DB の制約で不可能にしてある。**
guard 表は `CREATE TABLE IF NOT EXISTS` + 先頭の `DELETE` なので、
失敗したあとの再実行でも同じ判定をやり直せる。列だけ追加された半端な状態を作らない。

固定ページ (`legal_page`) の `kind` 語彙統合も同じ形で守っている。
移行先の無い旧 `kind` が残っていれば止まり、`profile` と `company` が同じ site に両方あれば
（どちらを `operator` として残すか決める根拠が無いので）止まる。**後勝ちで本文を捨てない。**

### 残る 🔴 / ⚠️ は解消していない

§4.2 (`legal_page` を 2 系統の語彙が触っている / 18 経路中 12 経路が 404) と
§4.3 (配色の保存と掲載の増減が操作の記録に届かない) は**本リリースの範囲外で、開いたままである。**
`dev` 環境へ出すのは、この 2 件が開いていることを承知の上での MVP としてである。
本番 (`main`) へ進める前に §4.3 を先に閉じること — 掲載の増減は金銭に直結し、
いつ・誰が・何を消したかを後から機械で追えない状態を本番に置くべきではない。

- 正本へ入れた理由: 同章 §4.1 が 🔴『migration が未コミット』と記録した状態を本リリース commit で解消したため、正本を現状に一致させる。前の記録は消さず差分として足す。

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

##### 確定内容 qa-database-web-blog-builder (対応セル: web)

- 確定要件: 利用者本人の回答を逐語主旨で記録する。
(1) ブログを作成するための UI を構築・変更したい。今後様々なブログを作るため、ブログごとにテンプレートを元に作成できるようにする。
(2) ブログの色合い (配色) はその都度選択して構成を変更できるようにする。ページ単位で「このページはこの色合い」と調整できるようにする。
(3) ブログに関して、見える部分 (公開面)・作成する部分 (編集)・保存する部分 (永続化)・管理上で一覧表示する部分 (管理一覧) のそれぞれで、どのブログにどのアフィリエイトが反映されているかを管理できる UI/UX にする。
(4) 参考ブログ (makuring.jp) を丸パクリせず、配置・構成・タイトルの表記方法・トップページから作れるページ種別を参考に構築する。文章はそのまま使わない。
(5) 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせを含めて全て構築できるようにする。
(6) 各ページの構成・記事の見やすい配置・図解・比較などの表現パターンも参考にして構築できるようにする。
(7) 参考ブログはガジェット前提だが本システムはガジェット限定ではないので、ジャンル依存部分 (スペック表など) は差し替え・調整できるようにする。
(8) サイドバー・ヘッダー・フッターは常に見えるようにする。参考ブログはスクロールで流れてしまうので、スクロール追従 (sticky) で整える。
(9) 今回で全ての内容を実装したいので、要件定義からタスク管理表まで作成する。
###### database 章への反映方針
- 追加エンティティ: blog_template (セクション構成の宣言データ)、blog_theme (デザイントークン集合、ブログ既定)、page_theme_override (ページ単位の配色上書き)、legal_page (固定ページ種別と本文、ブログ単位)、blog_affiliate_placement (ブログ/記事×アフィリエイト案件の反映対応)。
- 既存 32 エンティティ (Site/Brand/Article/Offer 等) を拡張し、複製しない。テンプレート・テーマは version を持ち、公開済みブログが参照する版を固定できる。
- 保存先は既存 D1 (Drizzle) を継続する。
- (注記: 正本 qa_log[qa-database-web-blog-builder].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)
- 設計解釈の記録経路: `dialogue`
- 原則: Aggregate 境界: Blog を root にテンプレート/テーマ/固定ページ/アフィリエイト配置を集約する (`ddd.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 『見える・作る・保存する・一覧する』の 4 面で同じブログ×アフィリエイト対応を参照するため、blog_affiliate_placement を Blog 集約下に置き、Offer (アフィリエイト案件) は既存 Commercial 境界を参照のみとする
  - トレードオフ:
    - テンプレート/テーマに version を持たせると公開済みブログの参照固定が要り、移行時の二重管理が発生する
    - 既存 32 エンティティへ 5 エンティティを追加するため、データモデル基盤 feature との整合レビューが必要
##### 接地根拠 qa-database-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-spec-intake` を参照
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
##### 接地根拠 qa-database-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Workspace IDによる全データのテナント分離 (`docs/spec/01-要求仕様書-v1.0.md §26.4`)
  - 採否: `applied`
  - 章固有の根拠: 全テーブルに workspace_id を保持し、リポジトリ層でオブジェクト単位認可を強制する。キャッシュ・検索インデックス・ファイルストレージも分離する
  - トレードオフ:
    - クエリごとに workspace_id 条件が必須となり、漏れは情報漏えいに直結するため共通データアクセス層で機械的に強制する
- 原則: Editorial / Commercial データベース分離 (`docs/spec/01-要求仕様書-v1.0.md §19.4`)
  - 採否: `applied`
  - 章固有の根拠: 商品評価・検証(Editorial)と報酬・成果(Commercial)をスキーマ分離し、Ranking Service は Editorial のみ参照可能にする
  - トレードオフ:
    - 物理分離により横断集計は分析基盤(MetricRollup)経由となり即時 JOIN はできない
- 原則: D1 + Drizzle ORM によるサーバーレスSQL (現行リポジトリ構成) (`cloudflare:d1-drizzle`)
  - 採否: `applied`
  - 章固有の根拠: 利用者が現行構成を正と確定。drizzle/ ディレクトリと wrangler.jsonc が実在し移行コストが最小
  - トレードオフ:
    - D1 にはDBサイズ・書き込みスループット上限があり、ClickEvent 等の大量イベントは集計特化ストア(Workers Analytics Engine 等)への分離を Phase 3 までに判断する
##### 接地根拠 qa-database-web-analytics (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-database-web-analytics` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 日次グレインのロールアップを正とし、成果状態変化 (pending→approved) は対象日を遡って再計算する (`docs/spec/03-分析・解析基盤仕様.md#§5`)
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
| cloudflare-d1 | 2026-04-30 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |

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

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.database.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | database × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-database-web-blog-builder` |
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

> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| **`decision-editorial-commercial-split`** | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | **database** |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | frontend |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |
| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |

- **`decision-editorial-commercial-split` が本章に効く形**: 「報酬額をランキングの入力にしない」という禁止を、コードの中ではなく **D1 を 2 本に分ける**位置で担保する。越えるには設定を書き換えるしかなくなり、越えた事実が差分に残る。
