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
| Web (web) | 確定 | 確定質疑: qa-infra-web-post-deploy-smoke。裏付け質疑 (`qa_refs`): `qa-infra-web-deploy-steps`, `qa-infra-web-branch-flow`, `qa-infra-web-schema-drift`, `qa-infra-web-migration-guard`, `qa-infra-web-spec-intake`, `qa-infra-web`, `qa-infra-web-redirect` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-infra-web-migration-guard-v2 (対応セル: web)

**質問**: 本番 D1 のスキーマ変更を公開ワークフローが自動で適用してよい条件を、控えが取れることの 1 点のままにするか。
`deploy.yml` を検査と公開の 2 job へ分けたとき、それぞれの持ち時間をどう置き、上限が適用の最中に発火したら
どうふるまうべきか。承認は検査の前と後のどちらに置くか。

**回答**: 控えが取れて、**かつ途中で止まったことが次の回に分かる**なら本番も自動でよい。
控えは「戻れる」ことしか言わない。**「戻るべきか」を判断するには、途中で止まったことが見えていなければならない。**

- `deploy.yml` を検査 (`inspect`) と公開 (`release`) の 2 job に分け、持ち時間は仕事の性質に合わせて置く
  （`inspect` は `ci.yml` と同じ検査の集合なので同じ 45 分、`release` は変更の大きさで伸びない仕事だけなので 30 分）。
  `release` は `needs: inspect` なので、検査が赤でも時間切れでも始まらない
- 適用ステップ「データの形を合わせる」に、**job 上限より先に切れる step 上限 (10 分)** を置く。
  job 上限が発火すると走っていたステップは道半ばのまま run ごと畳まれて「どこで終わったか」が残らないが、
  step 上限で切れれば **そのステップが `cancelled` として run に確定して残る**
- 次の run は `release` の先頭でその記録を読み、`cancelled` または結論なしなら**自動では進まない**。
  うまくいった回には記録が残らないので、**印を消す操作は誰にも要求しない**
- 印を D1 の表として持たない。その表は形のずれ検査に「余り」として出て、
  アプリのスキーマへ運用用の表を混ぜるか検査を緩めるかの二択になる
- 承認 (`environment: production`) は `release` 側に付ける。人は**検査が通ったのを見てから押す**
- 前回の run を読めない・公開の job が見当たらない・適用ステップの名前が見つからないは、
  いずれも「測れなかった」として**止める側へ倒す**

規範は `docs/spec/11-CI-CD・品質ゲート仕様.md` §4-1 / §4-1-3 が正本。

### qa-infra-web-post-deploy-smoke (対応セル: web)

**質問**: 公開が終わったあと、動いていることをどう確かめるか。1 回の確認で足りるか。

**回答**: 「デプロイ成功」はファイルが届いたことしか意味しない。
- スモークテストを **30 秒待つ → 1 回目 → 90 秒待つ → 2 回目** の二段構えで実行する。
  Cloudflare Workers は旧版の実行環境を数十秒〜1〜2 分保持するため、
  1 回だけの確認では反映を判定できない（直っているのに落ちる／壊れているのに通る、が両方起こる）。
- スモークテストが落ちたらワークフローを失敗させる。
  **「デプロイは成功したがアプリは壊れている」を緑で通さない。**

### qa-infra-web-deploy-steps (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 通常の公開は、どの順序で何をするか。その並びのどこが支点で、同じ対象を変えうる別経路とはどう調停するか。

**回答**: `deploy.yml` は dev / 本番のどちらでも、通常の公開を1 本で完了させる。
1. 控えを取る（`wrangler d1 export`）
2. **中身が空でないことを確かめる。空ならそこで止まり、適用へ進まない**
3. 成果物として 30 日保管する（落ちても控えが残るよう、適用より先に保存する）
4. データの形を適用する
5. 未適用が 0 件になったことを確かめる（公開の直前・§4-1-1）
6. 実際の表・列・索引・トリガーが正本と合うことを確かめる（§4-1-2）
7. アプリを公開する
2 が支点である。ここが通らなければ 4 は起きない。
- `deploy.yml` と `migrate.yml` は、同じ dev / production の D1 を同時に変更しない。
  同一環境の concurrency group を共有し、先に始まったほうが台帳・形の確認まで終わるのを待つ

### qa-infra-web-branch-flow (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 公開へ至る枝の順番は、何によって守られるか。またワークフローはどの単位で分かれているか。

**回答**: | `branch-flow.yml` | main への PR | 比較元の枝を見る | **なし** |
`branch-flow.yml` を `ci.yml` に混ぜなかった理由は、見ているものが違うからである。
`ci.yml` は**中身が正しいか**を、`branch-flow.yml` は**どこから来たか**を見る。
混ぜると、枝の順番だけを守らせたい場面で検査一式が動く。
| CI-AC-03 | ワークフローが壊すものの重さで分かれている（検査 / 枝の順番 / 公開 / 構造変更 / 深い門 / AI 評価 / Actions 使用量の 7 本） | — |
| CI-AC-20 | `main` への PR は比較元が `dev` か `hotfix/*` でないとマージ前に落ちる | — |

### qa-infra-web-schema-drift (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: infrastructure×web: データの形を適用したあと、アプリを公開する前に何を確かめるか。また、公開経路と手動適用経路が同じ環境の D1 を同時に触ることを許すか (書面入力 docs/spec/11-CI-CD・品質ゲート仕様.md §4-1 / §4-1-2)

**回答**: 1. 控えを取る（`wrangler d1 export`）
2. **中身が空でないことを確かめる。空ならそこで止まり、適用へ進まない**
4. データの形を適用する
5. 未適用が 0 件になったことを確かめる（公開の直前・§4-1-1）
6. 実際の表・列・索引・トリガーが正本と合うことを確かめる（§4-1-2）
7. アプリを公開する
- `deploy.yml` と `migrate.yml` は、同じ dev / production の D1 を同時に変更しない。
  同一環境の concurrency group を共有し、先に始まったほうが台帳・形の確認まで終わるのを待つ
置き場所は**適用の後・公開の前**でなければならない。適用の前に置くと、
未適用の分がすべて「足りない」として出て、常に赤になる。
`deploy.yml` と `migrate.yml` の両方に置く。**片方だけ緩いと、ずれはその片方から入る。**

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

##### 確定内容 qa-infra-web-post-deploy-smoke (対応セル: web)

- 確定要件: 「デプロイ成功」はファイルが届いたことしか意味しない。
- スモークテストを **30 秒待つ → 1 回目 → 90 秒待つ → 2 回目** の二段構えで実行する。
  Cloudflare Workers は旧版の実行環境を数十秒〜1〜2 分保持するため、
  1 回だけの確認では反映を判定できない（直っているのに落ちる／壊れているのに通る、が両方起こる）。
- スモークテストが落ちたらワークフローを失敗させる。
  **「デプロイは成功したがアプリは壊れている」を緑で通さない。**
- 設計解釈の記録経路: `dialogue`
- 原則: 届いたことと動いていることは別である。公開の成功をもって正常とみなさない (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-3`)
  - 採否: `applied`
  - 章固有の根拠: デプロイ成功はファイルが届いたことしか意味しない。実際に応答を取りに行って初めて、壊れているかどうかが分かる
  - トレードオフ:
    - 公開のたびに待ち時間と確認 2 回ぶんが加算され、ワークフローの所要時間が最低でも 2 分ほど延びる
    - スモークテスト自体が不安定だと、正常な公開まで赤くなる
    - 確認するのは叩いた経路だけで、叩いていない画面の故障は依然として通る
- 原則: 実行環境が入れ替わる途中で測らない。間隔を空けて 2 回測り、両方で判定する (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-3`)
  - 採否: `applied`
  - 章固有の根拠: Cloudflare Workers は旧版の実行環境を数十秒から 1〜2 分保持する。1 回だけの確認では、直っているのに落ちる場合と壊れているのに通る場合が両方起こる
  - トレードオフ:
    - 30 秒 + 90 秒の待機が固定費として公開のたびにかかる
    - 保持時間が想定より長い環境では 2 回目でも旧版を掴む可能性が残る
    - 待ち時間を仕様に埋め込んだので、基盤側の挙動が変われば仕様の側も直す必要がある
##### 接地根拠 qa-infra-web-deploy-steps (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-deploy-steps` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 戻せない操作を機械にやらせる条件は 1 つだけである — 戻る先があること。控えを取るだけでなく、中身が空でないことを確かめ、適用より先に保管する (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: 控えの取得が成功を返しても中身が空なら戻る先は無い。空検査を適用の手前に置き、保管を適用より先に済ませることで、適用が落ちた瞬間にも既に控えが残っている状態を作る
  - トレードオフ:
    - 公開のたびに控えの取得・検査・保管の 3 手が必ず走るため、形を変えない公開でも所要時間が延びる
    - 30 日ぶんの成果物を保持するので保管量と費用が積み上がる
    - 空でないことしか見ないので、中身が壊れている控えは通る。戻る先が在ることの保証は完全ではない
- 原則: 同じものを変えうる経路が 2 本あるなら同時に走らせない。片方の途中の状態を、もう片方が正本として読む (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: deploy と migrate が同一環境の D1 を同時に触ると、台帳の未適用件数も形の一致確認も、相手の途中経過を見て判定してしまう。concurrency group を共有し、先に始まったほうが確認まで終わるのを待たせる
  - トレードオフ:
    - 同一環境への 2 経路が直列化するため、移行中の公開は待ち行列に入る
    - 片方が詰まると無関係な変更の公開まで巻き添えで待つ
    - group を環境ごとに切る前提なので、環境名を誤ると別環境どうしが不要に直列化する
##### 接地根拠 qa-infra-web-branch-flow (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-branch-flow` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 見張りは、見ているものが違うなら分けて置く。中身が正しいかと、どこから来たかは別の問いである (`docs/spec/11-CI-CD・品質ゲート仕様.md#§3`)
  - 採否: `applied`
  - 章固有の根拠: 枝の順番だけを守らせたい場面で検査一式が動くと、順番の違反を知るまでに検査 1 本ぶんの時間がかかり、順番を直すだけの PR も同じ待ち時間を負う。分けておけば、どこから来たかの判定は検査の完了を待たずに返る
  - トレードオフ:
    - ワークフローが 7 本に増え、どれがどれを見ているかを把握する手間が増える
    - 門ごとに起動の重複が生じ、Actions 使用量は 1 本に束ねるより増える
    - 1 つの PR に対する結果が 7 個に散るため、全部緑かどうかを見るには一覧をたどる必要がある
- 原則: 合流できる経路を機械で狭める。作業者の記憶ではなく、マージ前に落ちる仕組みで守る (`docs/spec/11-CI-CD・品質ゲート仕様.md#§7`)
  - 採否: `applied`
  - 章固有の根拠: main へ直接出せてしまうと dev だけが古いまま取り残され、開発環境で確かめる手段が失われる。比較元を機械が見て落とすなら、間違えた側は必ず気づく
  - トレードオフ:
    - 正当な例外 (dev が壊れていて hotfix でもない状況) でも一律に落ちるため、迂回には枝の付け替えが要る
    - hotfix/* を通した後に dev へ戻す作業は機械が強制しないので、そこは依然として人の手順に依存する
    - 枝名の綴りに判定が依存し、命名規則を変えるとゲートも同時に直す必要がある
##### 接地根拠 qa-infra-web-schema-drift (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-infra-web-schema-drift` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 台帳に名前が載っていることと、実体の形が合っていることは別物である。名前だけを見る見張りは、逆向きのずれを緑のまま通す (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1-2`)
  - 採否: `applied`
  - 章固有の根拠: 適用の後・公開の前に、毎回空の一時ローカル D1 へ drizzle/*.sql を先頭から全部当てた結果を正本とし、対象環境のリモート D1 と sqlite_master どうしを比べる。不足・余り・同名異所属/異定義のいずれでも落とし、測れなかったときも落とす。適用の前に置くと未適用ぶんが常に不足として出るため、置き場所は適用の後でなければならない
  - トレードオフ:
    - 適用と公開の間に検査を 1 段はさむので、移行を伴う公開は必ずその分だけ遅れる。緊急の修正でも同じだけ待たされる
    - 実体と正本を突き合わせる検査自体が壊れると、移行が正しくても公開が止まる。見張りが増えた分、止まる理由も増える
    - 検査対象は表・列・索引・トリガーの形だけで、中身のデータのずれは見ない。形が合っていれば通るので「全部確かめた」とは言えない
- 原則: 同じものを変えうる経路が 2 本あるなら、同時に走らせない。片方の途中の状態をもう片方が正本として読む (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: deploy.yml と migrate.yml は同一環境の concurrency group を共有し、先に始まったほうが台帳と形の確認まで終わるのを待つ。通常公開は deploy.yml だけを起点にし、migrate.yml は公開と分けた明示適用と前方修復のためだけに残す
  - トレードオフ:
    - 同一環境への 2 経路が直列になるため、移行が走っている間の公開は待ち行列に入る。並べれば速い場面でも速くできない
    - 片方が長く詰まると、無関係な変更の公開まで巻き添えで待つ
    - group を環境ごとに切る前提なので、環境名の付け方を間違えると別環境どうしが不要に直列化する、あるいは同一環境が直列にならない
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

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.infrastructure.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | infrastructure × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-infra-web-migration-guard-v2` |
| 資するゴール (serves_goals) | G2, G1 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 意思決定 (decisions)

> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |
| **`decision-redirect-measurement-async`** | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | **infrastructure** |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | frontend |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |
| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |

- **`decision-redirect-measurement-async` が本章に効く形**: 転送は必達、計測はベストエフォート (02 §7)。3 案とも転送は止めないので、差は**欠測をどこまで減らすかとその値段**だった。`waitUntil` + 退避 + Cron 補完は無料枠のまま成立する。Queues はいちばん堅いが有料プランが前提で、契約状態をこちらから確かめられないため caveat に置き、必要になった時点で別の判断とする。**採用理由が契約状態に依存していない**ことが、この選択の要点である。
