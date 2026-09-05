---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G2]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infra-web-custom-hostname。裏付け質疑 (`qa_refs`): `qa-infrastructure-web-wildcard-subdomain`, `qa-infra-web-migration-guard-v2`, `qa-infra-web-migration-guard`, `qa-infra-web-spec-intake`, `qa-infra-web`, `qa-infra-web-redirect` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | infrastructure × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-infra-web-custom-hostname` |
| 資するゴール (serves_goals) | G1, G2 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`infrastructure`) を主担当とする **2 件**。全 12 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 |
| `dec-blog-domain-strategy` | 作成した各ブログにどうやって固有の住所 (ドメイン) を割り当てるか。現状はホスト解決が無く、全ブログが単一 Worker 上の /s/<slug> パスで、ドメインがブログの内容と無関係になっている。 | `opt-wildcard-subdomain` | confirmed | G1 |

- **`decision-redirect-measurement-async` の caveat**: 回収が静かに失敗すると退避先が墓場になる。回収した件数と残件数を記録し、残件が増え続けたら赤くする / 有料プランが既に有効なら Queues のほうが素直。契約状態は本人しか確かめられない / 最大 1 日の時差があるため、当日の速報値は「まだ確定していない」と画面に出す（03 §8 の速報と確定の区別）

- **`dec-blog-domain-strategy` の caveat**: 基底ドメインを1つ用意し、そのワイルドカード DNS を Worker へ向ける初回作業が必要である / 開発環境の workers.dev では任意サブドメインを生やせないため、パス方式 /s/<slug> を後方互換として残す必要がある。これが無いと開発環境で公開面を確認できなくなる / サブドメイン間で cookie を共有しない設定を明示的に行う必要がある。既定のまま親ドメインへ scope を広げると、あるブログの読者データが別ブログから読める / 根拠として引用した公式資料は harness が取得済みの入口ページ (Cloudflare Workers は 2026-08-19、Next.js は 2026-08-29 取得) であり、ワイルドカード route と証明書の個別ページを本セッションで再取得してはいない。実装着手時に route の記法と証明書の適用条件を公式資料で再確認すること

## 確定内容 (質疑録)

### qa-infra-web-custom-hostname (対応セル: web)

**質問**: infrastructure×web: ブログごとの独自ドメインを、どの仕組みで受け、どう配信へ結びつけるか

**回答**: Cloudflare for SaaS のカスタムホスト名を使う。利用者が外部で取得したドメインを管理画面から登録し、こちらは所有権確認用の CNAME (または TXT) を指示する。利用者がそのレコードを自分の DNS へ置くと、Cloudflare が検証して証明書を発行する。証明書の発行・更新・失効はすべて Cloudflare 側に任せ、自前で ACME を回さない。Worker 側は受け取った Host ヘッダからカスタムホスト名を引き、site_custom_domains で active な行があればその site_slug のブログとして描画する。無ければ従来どおり /s/<slug> の経路で扱う。既定の住所 (SITE_BASE_DOMAIN からの導出) は残し、カスタムドメインが未接続・検証中・失効中でもブログが読者から消えないようにする。カスタムドメインが active な間は、既定の住所から正規 URL (canonical) をカスタムドメイン側へ向け、検索エンジンから見て同じ内容が 2 つの住所に存在する状態を避ける。ドメインの取得 (購入) 自体は範囲に含めず、外部のレジストラで済ませた前提で接続だけを扱う

### qa-infrastructure-web-wildcard-subdomain (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: サブドメイン方式をどう配信構成へ落とすか。ブログを増やすたびの手作業をどう避けるか。

**回答**: ワイルドカード DNS (*.<基底ドメイン>) を Worker へ向け、wrangler の routes に *.<基底ドメイン>/* を1本だけ置く。ブログを増やしても DNS も routes も触らない。証明書は Cloudflare のワイルドカード証明書で賄い、ブログごとの発行・検証フローを持たない。開発環境の workers.dev はサブドメインを任意に生やせないため、パス方式 /s/<slug> を後方互換として残し、ホスト解決が効かない実行では従来どおり動く。既存の公開URLを壊さず、SITE_BASE_DOMAIN 未設定のブログもパス方式で到達できる。

### qa-infra-web-migration-guard-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: infrastructure×web: 本番 D1 のスキーマ変更を公開ワークフローが自動で適用してよい条件を、控えが取れることの 1 点のままにするか。deploy.yml を検査と公開の 2 job へ分けたとき、それぞれの持ち時間をどう置き、上限が適用の最中に発火したらどうふるまうべきか。承認は検査の前と後のどちらに置くか

**回答**: 控えが取れて、かつ途中で止まったことが次の回に分かるなら本番も自動でよい。控えは『戻れる』ことしか言わない。『戻るべきか』を判断するには、途中で止まったことが見えていなければならない。deploy.yml は検査 (inspect) と公開 (release) の 2 job に分け、持ち時間は仕事の性質に合わせて置く (inspect は ci.yml と同じ検査の集合なので同じ 45 分、release は変更の大きさで伸びない仕事だけなので 30 分)。release は needs: inspect なので、検査が赤でも時間切れでも始まらない。適用ステップ『データの形を合わせる』には job 上限より先に切れる step 上限 (10 分) を置く。job 上限が発火すると走っていたステップは道半ばのまま run ごと畳まれて『どこで終わったか』が残らないが、step 上限で切れればそのステップが cancelled として run に確定して残る。次の run は release の先頭でその記録を読み、cancelled または結論なしなら自動では進まない。うまくいった回には記録が残らないので、印を消す操作は誰にも要求しない。印を D1 の表として持たないのは、その表が形のずれ検査に『余り』として出て、アプリのスキーマへ運用用の表を混ぜるか検査を緩めるかの二択になるためである。承認 (environment: production) は release 側に付けるので、人は検査が通ったのを見てから押す。前回の run を読めない・公開の job が見当たらない・適用ステップの名前が見つからないは、いずれも『測れなかった』として止める側へ倒す

### qa-infra-web-migration-guard (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: infrastructure×web: 本番 D1 のスキーマ変更を、公開ワークフロー (deploy.yml) が自動で適用してよいか。よいなら、どんな条件が揃ったときに限るか

**回答**: 控えが取れたら本番も自動でよい。dev / 本番のどちらでも deploy.yml が『控えを取る → 中身が空でないことを確かめる → 適用する → 未適用 0 件を確かめる』の順で走る。控えが空なら、そこで止めて適用へ進まない。人が判断するのはこの並びの手前 (environment: production の承認) であり、控えを取ったかどうかではない。migrate.yml の手動起動＋APPLY は、公開と切り離して形だけ変えたいときのために残す

### qa-infra-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: infrastructure×web: 検査をどの段で走らせ、どこでマージを止めるか (書面入力 docs/spec/11 §8)

**回答**: | 1 速い門 | push / PR | 5 分 | **止める** | 型検査 / 書き方 / 段の指定漏れ / 単体・契約検査 |
| 2 広い門 | PR | 15 分 | **止める** | 結合 / API 契約 / 画面 / 読み上げ / 境界値 / カバレッジ閾値 / 変更範囲だけのミューテーション |
| 3 深い門 | **手動のみ**（定例なし。打つ場面は下） | 40 分（実測 27 分） | 止めない | 全体ミューテーション / 負荷 / 見た目の回帰 / 脆弱性の深掘り |
**実行時間は費用の要因ではない。** したがって「時間を減らすために CI からテストを外す」判断はしない。

### qa-infra-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: インフラ (infrastructure) × web の実行環境・デプロイは何か (2026-08-16 対話ヒアリング)

**回答**: 現行構成で確定。技術基盤は現行リポジトリの構成(Next.js + Cloudflare Workers/OpenNext + D1 + Drizzle ORM)を正として仕様に確定する。

### qa-infra-web-redirect (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: infrastructure×web: リダイレクトサービスの可用性要件は何か (書面入力 docs/spec/02 §7)

**回答**: | 障害時 | リダイレクトはresolver storeで転送先を解決し、計測eventをQueueへ非同期配送する。SLOと劣化モードは`03` §1を正とする |

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 意思決定が本章に効く形

正本 `decisions[]` の一覧と状態は `00-requirements-definition.md` が正本から生成する。
**ここには表を写さない。**写した表は正本が動いても追従せず、2026-09-04 まで
「全 7 件」と書かれたまま残った (実際には 12 件) のがその実例である。

- **`decision-redirect-measurement-async` が本章に効く形**: 転送は必達、計測は
  ベストエフォート (02 §7)。3 案とも転送は止めないので、差は**欠測をどこまで
  減らすかとその値段**だった。`waitUntil` + 退避 + Cron 補完は無料枠のまま
  成立する。Queues はいちばん堅いが有料プランが前提で、契約状態をこちらから
  確かめられないため caveat に置き、必要になった時点で別の判断とする。
  **採用理由が契約状態に依存していない**ことが、この選択の要点である。
- **`dec-blog-domain-strategy` が本章に効く形**: ブログを別ドメインへ切り出さず
  同一オリジンの経路として持つ。分けると評価が割れるうえ、認証境界と配信境界が
  二重になり、無料枠の中で運用する前提が崩れる。
- **`dec-aeo-analysis-trigger` の定期再解析が本章に落ちる形** (2026-09-04 確定):
  再解析は Cron Trigger に乗る。Cron は**失敗しても画面に何も現れない**ため、
  成否と最終実行時刻を記録し管理画面から読めるようにする。これが無いと
  「再解析されていない」ことに永久に気づけない。実行そのものは
  `decision-redirect-measurement-async` の Cron 補完と同じ土俵に乗るので、
  無料枠の実行回数を両者の合計で見積もる。

- 正本へ入れた理由: 各章の手書き意思決定表は正本 decisions[] の写しで、件数が 7 のまま古びていた。表は 00-requirements-definition.md が正本から生成するので削る。削れない章固有の突き合わせ (この決定が本章にどう効くか) を正本へ移し、compile の純関数出力として復元されるようにする。

### 章の規範本文を正本から再生成しない理由

`## 確定セルの記録` は 2026-09-04 から compile が正本 `matrix` / `qa_log` から描く。
一方で **章の規範本文 (To-Be 契約表・故障モード・初期 SLO・Acceptance evidence) は
正本から再生成しない。** その判断の根拠となる 3 つの実測 (再生成で消える 374 行 /
正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が
8 件中 7 件で不一致) は `system-spec/database.md` の同じ節に 1 か所だけ書いてある。
**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

- 正本へ入れた理由: 確定セルの記録を compile 生成へ移したため、その節の内側に手で書かれていた散文が 次の再生成で消える。散文が守っているのは「章の規範本文を正本で置き換えない」という 判断で、これは今も生きている。消えようのない場所 (正本) へ移して compile に描かせる。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| reliability | 引用可 | 第 4 章 Service Level Objectives (https://sre.google/sre-book/service-level-objectives/) / 第 6 章 Monitoring Distributed Systems (https://sre.google/sre-book/monitoring-distributed-systems/) / 第 24 章 Distributed Periodic Scheduling with Cron (https://sre.google/sre-book/distributed-periodic-scheduling/) / 第 26 章 Data Integrity: What You Read Is What You Wrote (https://sre.google/sre-book/data-integrity/) |
| operations | **条項引用不可** — 取得対象に無い (取れば可になる) | この concern の source_ref は SRE Workbook (https://sre.google/workbook/) だが、fetched-references.json の取得対象 8 件に含まれていない。取得していないものの章番号は引けない。同じ Google SRE でも reliability が引く sre-book とは別の本であり、sre-book の目次で workbook を代用することはできない。 |

- **reliability の引用範囲**: 取得済みなのは目次 (table of contents) のみ。引用根拠にできるのは『その章が存在すること・章番号・章題・正規 URL』まで。章本文は未取得のため、章の中の主張を要約して要件文の根拠にすることはできない。それをやると、取得していない内容を出典に帰属させることになる (C05 が実在しない日付 2026-07-03 を公式表明値として書いたのと同じ形)。

- **operations が引用可になる条件**: targets[] に SRE Workbook を足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Site Reliability Engineering — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/site-reliability-engineering.md`

#### 目的

実行基盤・環境・リソースの構成を、目標信頼性 (SLO) と運用負荷の観点から選び、稼働中の状態を観測して是正できる形にする。

#### 解決する問題

- 目標信頼性が未定義のまま冗長化・監視を積み、費用と運用負荷だけが増える。
- 環境 (本番/検証/ローカル) の差分が人の記憶に残り、本番でのみ再現する障害が生まれる。
- 稼働中の構成 (環境変数・binding・シークレット) を外から確認できず、障害時に仮説を検証できない。
- 復旧手順が実行されたことのない文書として存在し、実際の障害時に機能しない。
- 手作業の運用 (トイル) が担当者に固定化され、人の交代で運用品質が落ちる。

#### 適用条件

- 利用者に対する可用性・遅延の期待があり、逸脱を検知して是正する責任を負う。
- 環境が複数あり (本番・検証・ローカル)、差分が事故要因になり得る。
- 観測・デプロイ・復旧を自動化する余地があり、運用担当が継続的に関与する。

#### 非適用条件

- 利用者も稼働期間も限定された使い捨て環境に、SLO 運用とエラーバジェット会計を先行適用しない。
- 実測データが無い段階で SLO を数値確定しない (暫定値であることを明示して観測から始める)。
- マネージド基盤が既に保証している性質を、自前の冗長化で二重化しない (責任分界点を先に確認する)。

#### トレードオフ・失敗モード

- SLO を高く置きすぎ、変更速度と費用を不必要に犠牲にする。
- 監視項目を増やすこと自体を目的化し、誰も見ないダッシュボードとアラート疲れを生む。
- Infrastructure as Code を導入しても本番へ手作業変更を許し、宣言と実体が乖離する (drift)。
- 復旧手順を一度も実行せず、実際の障害時に前提条件の欠落が判明する。
- 稼働中ビルドの素性を確認する手段を用意せず、「コードは直っている」と「本番が直っている」を区別できなくなる。

#### goalへの寄与

- 基盤選定の判断を、製品名の比較ではなく目標指標への寄与として記述でき、後から根拠を検証できる。
- エラーバジェットにより、機能追加と安定化の優先順位を都度の力関係でなく事前合意で決められる。
- 稼働実体の観測手段を要件に含めることで、障害の切り分け時間を短縮し、原因究明のラウンド数を減らす。

---

#### 本章での適用

##### 確定内容 qa-infra-web-custom-hostname (対応セル: web)

- 確定要件: Cloudflare for SaaS のカスタムホスト名を使う。利用者が外部で取得したドメインを管理画面から登録し、こちらは所有権確認用の CNAME (または TXT) を指示する。利用者がそのレコードを自分の DNS へ置くと、Cloudflare が検証して証明書を発行する。証明書の発行・更新・失効はすべて Cloudflare 側に任せ、自前で ACME を回さない。Worker 側は受け取った Host ヘッダからカスタムホスト名を引き、site_custom_domains で active な行があればその site_slug のブログとして描画する。無ければ従来どおり /s/<slug> の経路で扱う。既定の住所 (SITE_BASE_DOMAIN からの導出) は残し、カスタムドメインが未接続・検証中・失効中でもブログが読者から消えないようにする。カスタムドメインが active な間は、既定の住所から正規 URL (canonical) をカスタムドメイン側へ向け、検索エンジンから見て同じ内容が 2 つの住所に存在する状態を避ける。ドメインの取得 (購入) 自体は範囲に含めず、外部のレジストラで済ませた前提で接続だけを扱う
- 設計解釈の記録経路: `dialogue`
- 原則: 自分で持たなくてよい運用責務は、それを本業にしている側へ預ける (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 証明書の自動更新は、失敗すると全読者にブラウザの警告が出る種類の運用である。ACME を自前で回せば更新の失敗も自分の当番になる。Cloudflare for SaaS に預ければ、こちらの責務は『状態を読んで管理画面に出す』だけに縮む
  - トレードオフ:
    - Cloudflare への依存が深まり、他の配信基盤へ移す際にこの部分を作り直すことになる。自前 ACME なら移設は容易だが、更新失敗の当番を負う
- 原則: 新しい経路の失敗が、既存の経路まで巻き込まないようにする (`site-reliability-engineering.md#トレードオフ・失敗モード`)
  - 採否: `applied`
  - 章固有の根拠: カスタムドメインの検証は利用者の DNS 操作待ちで、いつ終わるか分からない。接続の途中でブログが読者から消えると、ドメインを足した結果として悪化する。既定の住所を常に生かしておけば、カスタムドメイン側の失敗は『まだ新しい住所で見られない』だけに留まる
  - トレードオフ:
    - 同じ内容が 2 つの住所で見られる期間が生じる。canonical を向けて検索エンジンには 1 つに見せるが、直接アクセスは両方で通る
##### 接地根拠 qa-infrastructure-web-wildcard-subdomain (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infrastructure-web-wildcard-subdomain` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 環境の再現性 (Infrastructure as Code) — 環境と binding を宣言として持ち、差分を人手手順ではなく差分適用で解消する (`site-reliability-engineering.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: ワイルドカード DNS (*.<基底ドメイン>) を Worker へ向け、wrangler の routes に *.<基底ドメイン>/* を 1 本だけ宣言する。ブログを増やしても DNS も routes も触らない。証明書は Cloudflare のワイルドカード証明書で賄い、ブログごとの発行・検証フローを持たない。現状 wrangler.jsonc / wrangler.toml に routes の宣言が 1 つも無く、住所がコードの外で決まっている状態を宣言側へ戻す
  - トレードオフ:
    - 基底ドメインを 1 つ用意し、そのワイルドカード DNS を Worker へ向ける初回作業が人手で要る。以後の運用操作は発生しない
    - ワイルドカードで受けるため、意図しないサブドメインもすべて Worker へ到達する。未知ホストの 404 判定がアプリ側の責務になる
- 原則: 一度だけビルドして昇格させる — 環境ごとに再ビルドせず、同一成果物へ環境固有の構成を注入する (`continuous-delivery.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: 開発環境の workers.dev は任意サブドメインを生やせないため、基底ドメインを構成値として注入し、ホスト解決が効かない実行ではパス方式 /s/<slug> を後方互換として残す。同じ成果物が本番ではサブドメイン方式、開発環境ではパス方式で動く。SITE_BASE_DOMAIN 未設定のブログもパス方式で到達でき、既存の公開 URL を壊さない
  - トレードオフ:
    - 経路が 2 本になるため、片方だけで動く不具合が生まれうる。両経路が同じ SiteFrame へ収束する形にして分岐をホスト解決の 1 か所に閉じる
    - 開発環境で本番と同じ住所を確かめられない。サブドメイン固有の不具合 (cookie scope 等) は本番相当の環境でしか検証できない
- 原則: Data lifecycle / trust boundary — サブドメイン間の信頼境界を設計前提にする (`secure-by-design.md#中核概念`)
  - 採否: `applied`
  - 章固有の根拠: サブドメインを共有するため、cookie の scope を親ドメインへ広げない設定を明示的に行う。既定のまま親ドメインへ scope を広げると、あるブログの読者データが別ブログから読める。ホスト→slug の変換が middleware の 1 か所に閉じることで、テナント境界の判定箇所を増やさない
  - トレードオフ:
    - cookie を親ドメインで共有しないため、ブログを跨ぐログイン状態の引き継ぎはできない。読者側にその要求が生じたら別の仕組み (明示的な連携) が要る
##### 接地根拠 qa-infra-web-migration-guard-v2 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-migration-guard-v2` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 戻せない変更を機械にやらせる条件は、戻る先が在ることと、途中で止まったことが次の回に見えることの 2 点である (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: 控えの有無だけを条件にしていた間、適用が道半ばで畳まれた事実を告げるものが無く、次に来た人は台帳と実体がずれた D1 を揃っているつもりで引き継いだ。deploy.yml の release へ『前回の公開が途中で終わっていないか』を控えより前に置き、条件 2 を並びの先頭で満たす
  - トレードオフ:
    - 前回の run を読むために actions: read の権限が要る。権限を落とすとこの見張りは unknown で止まり続けるので、権限の欠落が公開の停止として現れる
- 原則: 上限は階層で置く。外側の上限が発火する前に、内側で切れるようにする (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1-3`)
  - 採否: `applied`
  - 章固有の根拠: job 上限 (30 分) が発火するとステップは道半ばのまま run ごと畳まれ、どこで終わったかが残らない。適用ステップへ 10 分の step 上限を置くと、切れたときそのステップが cancelled として run に確定して残り、その記録がそのまま次の回の印になる。実測は数十秒なので、正常に終わる適用はこの上限に触れない
  - トレードオフ:
    - 10 分を超える正当な適用 (大規模なデータ移行) は切られる。切られても控えは在り、次の run が止めて人へ渡すので、静かに壊れる側へは倒れない
- 原則: 見張りを足すために、別の見張りが見ている範囲を削らない (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1-2`)
  - 採否: `applied`
  - 章固有の根拠: 『適用の直前に行を書き、終わったら消す』を D1 の表で実装すると、その表が drift 検査に extra として出る。アプリのスキーマへ運用用の表を混ぜるか、余っている側を緩めるかの二択になり、後者は 0035 のトリガー消失を見えなくする。すでに残っている GitHub の run 履歴を読めば、増やすものが無い
  - トレードオフ:
    - 印の所在が GitHub 側にあるため、run 履歴の保持期間を過ぎると前回を読めなくなる。読めなければ unknown として止まるので、判定は緩まない
- 原則: 人が判断する場所は、判断材料が出そろった後に置く (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-2`)
  - 採否: `applied`
  - 章固有の根拠: environment: production を release 側へ移したので、承認を求められた時点で検査は通っている。1 つの job だった頃は、押してから 30 分測ってその先で落ちることがあった
  - トレードオフ:
    - 承認までの待ち時間が検査ぶん延びる。押した後に落ちる回が減るほうが、判断としては確かである
##### 接地根拠 qa-infra-web-migration-guard (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-migration-guard` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 戻せない変更を機械にやらせる条件は、戻る先が在ることの 1 点に絞る (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: deploy.yml は dev / 本番のどちらでも控え → 空でないことの確認 → 適用 → 未適用 0 件の確認の順で走り、控えが空なら exit 1 して適用へ進まない。承認は並びの手前 (environment: production) に置き、毎回同じ手順である控え取得を人の記憶に委ねない
  - トレードオフ:
    - 本番のスキーマ変更が承認後は人の介在なく進むため、承認者の登録漏れがそのまま無人適用になる。environment 側の設定が単一障害点になる
- 原則: 測れなかったことを、大丈夫と読み替える道を片方にも作らない (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1-1`)
  - 採否: `applied`
  - 章固有の根拠: require-migrations-applied.sh を検査一式の前 (PENDING_ACTION=report) と公開の直前 (fail) の 2 か所で呼ぶ。前倒し側が落とすのは unknown (資格情報切れ・D1 到達不可・出力形式の変更) だけで、pending は後続の自動適用が直す。既定値は fail で、書き忘れたら厳しい側へ倒れる
  - トレードオフ:
    - 同じスクリプトを 2 回呼ぶぶん実行時間は増えるが、8 分待ってから 30 秒で分かる失敗を受け取るよりは短い
##### 接地根拠 qa-infra-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-spec-intake` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 検査を 3 段に分け、1 段と 2 段はマージを止め、3 段は手動のみで止めない。重いテストを足す前に置き場所を先に作る (`docs/spec/11-CI-CD・品質ゲート仕様.md#§8-2`)
  - 採否: `applied`
  - 章固有の根拠: 段の定義を quality-gates.config.mjs の TIERS 1 箇所に置き、手元 (pnpm run verify) と CI が同じ表を読む。段を増やす前に走らせる場所を決める
  - トレードオフ:
    - 3 段は誰かが打たなければ走らないため、打つ場面を文書に書かないと存在しない検査になる
- 原則: 実行時間は費用の要因ではない (公開リポジトリの標準ランナーは無料)。時間を理由に CI からテストを外さない (`docs/spec/11-CI-CD・品質ゲート仕様.md#§8-1`)
  - 採否: `applied`
  - 章固有の根拠: 時間の超過は警告として表示するだけで、終了コードに混ぜない。落とす理由は検査の失敗だけに限る
  - トレードオフ:
    - 遅い検査が放置されうるが、時間を守るためにテストを削る力が働かない
- 原則: 手元と CI を同じにする。CI がやることを別の場所に書き写さない (`docs/spec/11-CI-CD・品質ゲート仕様.md#§2`)
  - 採否: `applied`
  - 章固有の根拠: CI のワークフローは pnpm run verify を呼ぶだけにし、走らせるものと順番は設定 1 箇所が決める
  - トレードオフ:
    - CI 固有の細かな制御はしにくいが、「手元では通るのに機械で落ちる」が構造的に起きない
##### 接地根拠 qa-infra-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: Cloudflare Workers + OpenNext での実行 (現行リポジトリ構成) (`cloudflare:workers-opennext`)
  - 採否: `applied`
  - 章固有の根拠: wrangler.jsonc・open-next.config.ts が実在する現行構成を正とし、エッジ実行でリダイレクトサービス(/go)の低遅延を確保する
  - トレードオフ:
    - Workers の CPU 時間・サブリクエスト制限内で Connector 処理を設計する必要があり、重い取り込みは Queues/cron へ逃がす
- 原則: Connector 別レート予算とコスト上限 (RateBudget) (`docs/spec/02-補充仕様-ギャップと追加要件.md §7`)
  - 採否: `applied`
  - 章固有の根拠: X API 従量課金等の外部APIコストを Connector 単位で監視し、上限接近で警告・超過で自動停止する
  - トレードオフ:
    - 自動停止は投稿予定の未実行を生むため、通知と再開手順をセットで提供する
##### 接地根拠 qa-infra-web-redirect (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-redirect` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 転送は必達、計測はベストエフォート: 計測 DB 障害時でもリダイレクトを止めない (`docs/spec/02-補充仕様-ギャップと追加要件.md#§7`)
  - 採否: `applied`
  - 章固有の根拠: Cloudflare Workers のエッジで original_url への 302 転送を先に確定し、ClickEvent の書き込みは waitUntil による非同期化 + 失敗時は Queue へ退避する。D1 障害が読者の遷移を阻害しない構成とする
  - トレードオフ:
    - 障害時のクリックは計測欠損になるが、読者体験と ASP 成果 (収益) を優先する
- 原則: リダイレクト先は登録済み original_url そのままとし、パラメータを削除・追加しない (`docs/spec/02-補充仕様-ギャップと追加要件.md#§1`)
  - 採否: `applied`
  - 章固有の根拠: ASP のリンク改変禁止 (U8) をインフラ層で保証する。sub_id 付与は対応 ASP のリンク生成時のみに限定する
  - トレードオフ:
    - 経路情報の付加余地は減るが、ASP 規約違反リスクを排除できる
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers | 2026-04-23 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |
| cloudflare-for-saas | 2026-04-29 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/ | 2026-09-03T12:55:14Z | 2026-09-03T12:55:14Z |
| cloudflare-r2 | 2026-08-07 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/ | 2026-09-03T12:55:14Z | 2026-09-03T12:55:14Z |

## 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**binding 作成済み・本番反映済み・SLO 達成済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/02` §1、`docs/spec/03` §1.2、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

### As-Is（2026-08-16 のリポジトリ実体）

- Cloudflare Workers（OpenNext）に observability を有効化し、環境ごとに単一 D1 binding `DB` と R2 binding `BUCKET` を定義している。
- `EDITORIAL_DB` / `COMMERCIAL_DB`、Redirect Resolver Store（KV等）、Queue、Cron trigger、dead-letter queue は未定義である。
- `/go/{tracking_link_id}` と ClickEvent producer/consumer は未実装。したがって現状は D1 障害時の転送継続性を実証していない。

### To-Be（規範契約）

| ID | 契約 | 状態 |
|---|---|---|
| INF-DB-01 | local / dev / production の各環境に `EDITORIAL_DB` と `COMMERCIAL_DB` を明示し、migration と backup / restore の対象を分離する。legacy `DB` は cutover 完了後に参照しない | 未実装 |
| INF-REDIRECT-01 | `/go/{tracking_link_id}` の同期 read path は Redirect Resolver Store を正とし、D1 を読まない。初期実装は KV の `tracking_link_id → validated original_url + enabled + version` を Last Known Good（LKG）として保持し、検証済み更新の公開に失敗した場合は旧値を残す。hot entry は Cache API に補助キャッシュしてよいが、D1 fallback は禁止する | 未実装 |
| INF-EVENT-01 | redirect response の確定と ClickEvent の計測を分離し、event enqueue は `waitUntil` で best-effort に行う。consumer が Commercial D1 へ idempotent append し、失敗は retry / dead-letter へ送る | 未実装 |
| INF-OBS-01 | redirect、resolver、enqueue、consumer、D1 write を別の signal として計測する。最低限 `redirect_requests_total`、`redirect_302_total`、`resolver_hit/miss/error/stale_total`、`click_enqueue_attempt/accepted/failed_total`、`click_consumer_success/retry/dead_letter_total`、oldest-message age を持つ | 未実装 |

### 故障モード

| 故障 | 転送 | 計測 / 復旧 |
|---|---|---|
| Commercial D1 停止 | LKG で302を継続 | Queue に滞留し、consumer retry。redirect handler は D1 を参照しない |
| Queue enqueue 失敗 | 302を継続 | `click_enqueue_failed_total` を記録し、計測欠損としてエラーバジェットへ算入 |
| consumer / migration 障害 | 302を継続 | retry 後に dead-letter。修復後、event ID で安全に replay |
| KV 読み取り障害 | Cache API の LKG hit 時だけ302 | cache miss では安全な転送先を推測せず503。resolver error alert を発報 |
| resolver key 欠落・無効・停止済み | 転送しない | 404 / 410 を区別し、D1 fallback はしない |
| resolver 更新失敗・遅延 | 旧LKGで302 | version / updated_at の鮮度を観測し、outbox / Queue から再配送 |

### 測定可能な初期 SLO

実測ベースライン取得までの**暫定値**とし、28日 rolling window で評価する。

| SLI | 初期目標 | 測定条件 |
|---|---|---|
| Redirect success | 有効な resolver key の 302 成功率 99.95%以上 | 無効ID、停止済みlink、client cancellationを分母から除外 |
| Redirect latency | Worker 処理時間 p95 < 100 ms、p99 < 250 ms | `/go/*` の edge server timing。遷移先サイト時間は除外 |
| Resolver freshness | 検証済み link 更新の99%が5分以内にLKGへ反映 | outbox timestamp→KV version 観測時刻 |
| Click acceptance | redirect request に対する Queue accepted 率 99.9%以上 | 同意・botに関係なく producer の配送成否を測定し、分析採用可否とは分離 |
| Queue recovery | oldest-message age p95 < 60秒、99% < 5分 | consumer retry を含み、dead-letter は別途即時alert |

### Delta

1. INF-DB-01 の2 D1と型定義を追加し、database の所有境界ごとに migration command を分ける。
2. validated original_url を outbox → Queue → KV へ発行する control plane と INF-REDIRECT-01 の read path を作る。
3. INF-EVENT-01 の Queue / dead-letter / consumer を接続し、INF-OBS-01 の metrics と alert を追加する。
4. D1・Queue・KV の故障注入後に上記 SLO を再測定し、暫定値を実測値でレビューする。

### Dependencies

依存方向は `前提 → 後続` とする。

- database の `DB-BOUNDARY-01` → INF-DB-01 → 環境ごとの schema migration。
- AffiliateLink / TrackingLink の検証、`original_url` 無改変、`redirect_allowed` / channel policy、outbox relay → INF-REDIRECT-01。
- event ID / dedup key、Commercial D1 の append-only schema、consent policy → INF-EVENT-01。
- log/metric retention、alert routing、dead-letter replay runbook → INF-OBS-01 の運用開始。

### Acceptance evidence

- `wrangler` 設定と生成型に全環境の2 D1 / KV / Queue bindings が存在し、legacy `DB` の runtime read がない静的検査。
- Commercial D1 を停止した故障注入で、有効なLKGへの302が継続し、復旧後にQueue滞留分が重複なく反映されるテスト。
- KV更新失敗時に既存LKGが維持され、`original_url` のbyte列を変更せず302 `Location` に返す contract test。
- dashboard / alert 上で各 SLI の分子・分母、Queue lag、dead-letter 件数を再現できる観測記録。

## 章にしか無い記述 (正本へ未接続)

> 以下の 1 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### 本節を「転記」に留めた理由`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## dev 合流で章から落ちた確定内容 (2026-09-05)

> **2026-09-05 の dev 合流で、同じセルを 2 系統の確定質疑が指す状態になった。**
> 生成器はセルの `qa_ref` を 1 本しか読まないため、`qa_refs[]` に併記したもう一方の
> 本文が章から落ちる。**正本 `spec-state.json` の `qa_log` には両方とも残っている。**
> 落ちた行を捨てずにここへ置く。正しい解消は 2 系統の質疑を 1 本へ統合して
> `qa_ref` を張り直すことで、それは合流とは別の便で行う (PR の残課題)。

- `serves_goals: [G2, G1]`
- `| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-wildcard-subdomain。裏付け質疑 (`qa_refs`): `qa-infra-web-migration-guard-v2`, `qa-infra-web-migration-guard`, `qa-infra-web-spec-intake`, `qa-infra-web`, `qa-infra-web-redirect` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |`
- `| 確定質疑 (qa_ref) | `qa-infrastructure-web-wildcard-subdomain` |`
- `| 資するゴール (serves_goals) | G2, G1 |`
- `| 適用された設計知識 (design_applications) | 3 件 — 本章 `## 適用された設計知識` を参照 |`
- `### qa-infrastructure-web-wildcard-subdomain (対応セル: web)`
- `##### 確定内容 qa-infrastructure-web-wildcard-subdomain (対応セル: web)`
- `- 確定要件: ワイルドカード DNS (*.<基底ドメイン>) を Worker へ向け、wrangler の routes に *.<基底ドメイン>/* を1本だけ置く。ブログを増やしても DNS も routes も触らない。証明書は Cloudflare のワイルドカード証明書で賄い、ブログごとの発行・検証フローを持たない。開発環境の workers.dev はサブドメインを任意に生やせないため、パス方式 /s/<slug> を後方互換として残し、ホスト解決が効かない実行では従来どおり動く。既存の公開URLを壊さず、SITE_BASE_DOMAIN 未設定のブログもパス方式で到達できる。`
- `- 資するゴール: G2, G1`
