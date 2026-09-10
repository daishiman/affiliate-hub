---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G2, G3]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-worker-image-upload-confirmed-20260906。裏付け質疑 (`qa_refs`): `qa-infra-web-custom-hostname`, `qa-infrastructure-web-wildcard-subdomain`, `qa-infra-web-migration-guard-v2`, `qa-infra-web-migration-guard`, `qa-infra-web-spec-intake`, `qa-infra-web`, `qa-infra-web-redirect` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: Web 以外を対象外にした帰結として、ストア配信と端末向けビルド/配布パイプラインを構築対象から外す。配信経路は Cloudflare Workers とカスタムドメインの 1 系統のみで、記事画像も同じ経路上の R2 カスタムドメインから配る。 |
| タブレット (tablet) | 対象外 | 理由: Web 以外を対象外にした帰結として、ストア配信と端末向けビルド/配布パイプラインを構築対象から外す。配信経路は Cloudflare Workers とカスタムドメインの 1 系統のみで、記事画像も同じ経路上の R2 カスタムドメインから配る。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Web 以外を対象外にした帰結として、ストア配信と端末向けビルド/配布パイプラインを構築対象から外す。配信経路は Cloudflare Workers とカスタムドメインの 1 系統のみで、記事画像も同じ経路上の R2 カスタムドメインから配る。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Web 以外を対象外にした帰結として、ストア配信と端末向けビルド/配布パイプラインを構築対象から外す。配信経路は Cloudflare Workers とカスタムドメインの 1 系統のみで、記事画像も同じ経路上の R2 カスタムドメインから配る。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: Web 以外を対象外にした帰結として、ストア配信と端末向けビルド/配布パイプラインを構築対象から外す。配信経路は Cloudflare Workers とカスタムドメインの 1 系統のみで、記事画像も同じ経路上の R2 カスタムドメインから配る。 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | infrastructure × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-infrastructure-web-worker-image-upload-confirmed-20260906` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 1 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`infrastructure`) を主担当とする **3 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 |
| `dec-blog-domain-strategy` | 作成した各ブログにどうやって固有の住所 (ドメイン) を割り当てるか。現状はホスト解決が無く、全ブログが単一 Worker 上の /s/<slug> パスで、ドメインがブログの内容と無関係になっている。 | `opt-wildcard-subdomain` | confirmed | G1 |
| `dec-article-image-upload-path` | 記事エディターから添付する画像を、どの経路で Cloudflare R2 へ格納するか | `opt-worker-proxy-upload` | confirmed | G1 |

- **`decision-redirect-measurement-async` の caveat**: 回収が静かに失敗すると退避先が墓場になる。回収した件数と残件数を記録し、残件が増え続けたら赤くする / 有料プランが既に有効なら Queues のほうが素直。契約状態は本人しか確かめられない / 最大 1 日の時差があるため、当日の速報値は「まだ確定していない」と画面に出す（03 §8 の速報と確定の区別）

- **`dec-blog-domain-strategy` の caveat**: 基底ドメインを1つ用意し、そのワイルドカード DNS を Worker へ向ける初回作業が必要である / 開発環境の workers.dev では任意サブドメインを生やせないため、パス方式 /s/<slug> を後方互換として残す必要がある。これが無いと開発環境で公開面を確認できなくなる / サブドメイン間で cookie を共有しない設定を明示的に行う必要がある。既定のまま親ドメインへ scope を広げると、あるブログの読者データが別ブログから読める / 根拠として引用した公式資料は harness が取得済みの入口ページ (Cloudflare Workers は 2026-08-19、Next.js は 2026-08-29 取得) であり、ワイルドカード route と証明書の個別ページを本セッションで再取得してはいない。実装着手時に route の記法と証明書の適用条件を公式資料で再確認すること

- **`dec-article-image-upload-path` の caveat**: UIで8 MiB上限、許可形式、圧縮または再選択の案内を送信前と失敗時に示すこと / 受信量をストリーム境界で制限し、認可・Origin・MIME・ファイルシグネチャをR2保存前に検査すること / アップロード失敗率、処理時間、拒否理由を監視し、上限が実利用を阻害する場合だけmultipartまたは直接送信を再検討すること

## 確定内容 (質疑録)

### qa-infrastructure-web-worker-image-upload-confirmed-20260906 (対応セル: web)

**質問**: 画像送信を、確定仕様の『R2へ直接送信』から、現実装の『Workerで認可・容量・形式を検査して保存』に統一してよいですか？

**回答**: ok

### qa-infra-web-custom-hostname (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

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

- **`decision-redirect-measurement-async` が本章に効く形**: 転送は必達、計測はベストエフォート (02 §7)。3 案とも転送は止めないので、差は**欠測をどこまで減らすかとその値段**だった。`waitUntil` + 退避 + Cron 補完は無料枠のまま成立する。Queues はいちばん堅いが有料プランが前提で、契約状態をこちらから確かめられないため caveat に置き、必要になった時点で別の判断とする。**採用理由が契約状態に依存していない**ことが、この選択の要点である。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

### 章の規範本文を正本から再生成しない理由

同じ現行契約の全文と記録理由は [章の規範本文を正本から再生成しない理由](auth.md) を参照。本章にも同じ契約を適用する。

### AI が起草した設計宣言（質疑から移した本文）

以下は **AI が起草した設計宣言**である。利用者が述べた要求ではない。

この本文はもともと質疑 `qa-infrastructure-web-article-image-r2-upload` の answer として `spec-state.json` に置かれ、`source.kind=user-dialogue`（＝利用者との対話に由来する）を名乗っていた。しかし内容は設計判断の宣言であり、利用者の発言ではない。独立監査 C06 が「AI 起草の設計宣言が利用者の回答の顔で正本に載っている」としてこれを指摘した。

**内容を捨てるのではなく、居場所を移す。** 設計として要る記述なので章の散文として置き直し、元の質疑は取り下げた（`retracted_qa_log`）。この章のセルが実際に引く裏付けは `qa-infrastructure-web-r2-upload-actual-capability` である。

利用者の逐語は `qa-infrastructure-web-r2-upload-actual-capability` および同章の「この章の要件 ID を書いたのは誰か」に記録がある。以下の記述で利用者の確認を受けているのは、そこに逐語として載っている範囲だけである。

---

**当初の問い**

> infrastructure×web: 記事画像を Cloudflare R2 へ直接アップロードする経路をどう組むか。

**設計宣言の本文**

**R2 へ直接上げる。**画像の本体を Worker が中継しない。中継すると Worker のリクエスト上限と実行時間に画像の大きさが縛られ、大きい画像で失敗する。

**流れ。**編集画面が「この名前・この型・この大きさで上げたい」と申告する → Worker が検査した上で、その 1 件だけに有効な署名付きアップロード URL を返す → ブラウザがその URL へ直接 PUT する → 完了後、編集画面が公開 URL を本文へ書く。

**置き場。**記事画像専用のバケットを 1 つ持ち、鍵は `workspace_id/記事id/一意なid.拡張子` の形にする。workspace を先頭に置くのは、後から一括で消したり移したりする単位が workspace だからである。ファイル名は利用者が付けた名前をそのまま使わず、一意な id へ置き換える。名前の衝突と、名前に混ざる文字の問題を両方消せる。

**配信。**バケットを直接公開せず、独自ドメインを通して配信する。キャッシュはこの層で効かせる。

**消し方。**記事から画像を外しただけでは R2 の実体を消さない。編集の取り消しで戻せなくなるためである。参照されなくなった実体の刈り取りは、記事の公開状態が確定してから別の掃除として行う。

- 正本へ入れた理由: C06 round4 の指摘: AI 起草の設計宣言が source.kind=user-dialogue を名乗って正本に載っていた。内容は設計として要るので章の散文へ移し、元の質疑は取り下げる。

### 画像アップロード経路の再検討（2026-09-06、回答待ち）

これは実装観察であり、利用者の回答原文や新たな採用決定ではない。

`dec-article-image-upload-path` は、2026-09-05 の利用者回答に基づく R2 直接 PUT を記録している。一方、現在の `src/app/api/article-images/route.ts` は Worker が認可・容量・画像先頭バイトを検査して R2 へ保存する経路であり、両者は一致していない。過去の回答を現実装の承認へ読み替えない。

2026-09-06 に infrastructure.web と security.web を正規 writer の R4-reopen で再オープンした。正規経路をどちらにするか利用者へ確認中であり、本章は draft とする。既存の qa_refs・serves_goals・required_info_checks は reopen_log.discarded に保持されている。回答後は依存する検査境界、API、運用記述を揃えて再検証する。

画像の保存と回収の競合対策、公開参照の権限、検証結果の最新記録は [ブロックエディターの検証報告](../docs/spec/feat-article-block-editor/elegant-review.md) を参照する。ここへ件数や実装一覧を重複転記しない。

- 正本へ入れた理由: 承認済みの再検討を実施し、旧決定と実装観察を区別する。利用者発言を改変せず、未回答を確定扱いしない。

### 画像アップロード経路の確定（2026-09-06）

`dec-article-image-upload-path` の現行決定は `opt-worker-proxy-upload` である。2026-09-06、利用者は「現実装の Worker で認可・容量・形式を検査して保存」に統一する確認へ「ok」と回答した。根拠は `approval-article-image-upload-path-worker-20260906` に記録した。

現在の経路は、編集画面 → `POST /api/article-images` → Worker の認可・入力検査 → R2 保存である。画像1件の製品上限は 8 MiB。台帳を `pending` で予約し、R2 保存後に `ready` へ確定する。途中失敗・応答不明・参照解除は即時削除だけに頼らず、台帳と回収処理で収束させる。

この章に先に残る「R2 へ直接上げる」と「回答待ち」は、2026-09-05 の旧決定と2026-09-06の再検討中スナップショットであり、現行要件ではない。署名付き PUT URL の発行、ブラウザからの直接 PUT、R2 用 CORS は現在の実装対象に含めない。旧承認は監査履歴として `approval-article-image-upload-path` に保持する。

- 正本へ入れた理由: 旧直接PUT決定と回答待ちスナップショットを監査履歴として残しつつ、利用者が承認したWorker経由を現行要件として一意に示す

### 歴史的スナップショット（現行規範ではない、2026-09-06 移送）

> 既存章にしか存在しなかった規範・受入条件・実装記録の保全移送。以下の本文は移送前のまま保持する。As-Is、Delta、PASS 等の実装・検証記録は本文に記された時点の記録であり、今回の実装完了・本番反映・新しい利用者承認を意味しない。後日の確定判断は本章の現在の質疑録・意思決定・日付付き注記を参照する。

#### 状態の意味と実装差分

`confirmed` は要求判断と採用方針が確定していることを表す。**binding 作成済み・本番反映済み・SLO 達成済みを表さない**。実装状態は、以下の As-Is / Delta と Acceptance evidence で別に判定する。

- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/02` §1、`docs/spec/03` §1.2、`00-requirements-definition.md`、および本章の「最新ドキュメント出典」に記録した公式出典とする。

##### As-Is（2026-08-16 のリポジトリ実体）

- Cloudflare Workers（OpenNext）に observability を有効化し、環境ごとに単一 D1 binding `DB` と R2 binding `BUCKET` を定義している。
- `EDITORIAL_DB` / `COMMERCIAL_DB`、Redirect Resolver Store（KV等）、Queue、Cron trigger、dead-letter queue は未定義である。
- `/go/{tracking_link_id}` と ClickEvent producer/consumer は未実装。したがって現状は D1 障害時の転送継続性を実証していない。
- R2 binding `BUCKET` は定義済みだが、記事画像の用途では使っていない。署名付き URL の発行経路・バケットの CORS ポリシー・配信用カスタムドメインはいずれも未設定である。

##### To-Be（規範契約）

| ID | 契約 | 状態 |
|---|---|---|
| INF-DB-01 | local / dev / production の各環境に `EDITORIAL_DB` と `COMMERCIAL_DB` を明示し、migration と backup / restore の対象を分離する。legacy `DB` は cutover 完了後に参照しない | 未実装 |
| INF-REDIRECT-01 | `/go/{tracking_link_id}` の同期 read path は Redirect Resolver Store を正とし、D1 を読まない。初期実装は KV の `tracking_link_id → validated original_url + enabled + version` を Last Known Good（LKG）として保持し、検証済み更新の公開に失敗した場合は旧値を残す。hot entry は Cache API に補助キャッシュしてよいが、D1 fallback は禁止する | 未実装 |
| INF-EVENT-01 | redirect response の確定と ClickEvent の計測を分離し、event enqueue は `waitUntil` で best-effort に行う。consumer が Commercial D1 へ idempotent append し、失敗は retry / dead-letter へ送る | 未実装 |
| INF-OBS-01 | redirect、resolver、enqueue、consumer、D1 write を別の signal として計測する。最低限 `redirect_requests_total`、`redirect_302_total`、`resolver_hit/miss/error/stale_total`、`click_enqueue_attempt/accepted/failed_total`、`click_consumer_success/retry/dead_letter_total`、oldest-message age を持つ | 未実装 |
| INF-IMG-01 | 記事画像は Cloudflare R2 へ、ブラウザから署名付き URL で直接 PUT する (`decisions[].dec-article-image-upload-path`)。画像本体を Worker に通さない。理由は、Worker のリクエストボディ上限が「貼れる画像の大きさ」の天井になることを避けるためである | 未実装 |
| INF-IMG-02 | オブジェクトの鍵は `workspace_id/記事id/一意なid.拡張子` に固定する。鍵の先頭が workspace であることで、テナントを越えた参照が鍵の並びの上で生じない | 未実装 |
| INF-IMG-03 | 配信は R2 のカスタムドメイン経由で行い、バケットの公開 URL を記事本文へ直接埋めない。配信元を差し替えても記事本文の書き換えが要らない状態にする | 未実装 |
| INF-IMG-04 | R2 バケットに CORS ポリシーを設定する。`AllowedMethods` に PUT、`AllowedHeaders` にクライアントが送るヘッダ (Content-Type 等)、`ExposeHeaders` に ETag、`MaxAgeSeconds` に preflight のキャッシュ時間を置く。設定しない限りブラウザからの直接 PUT は preflight で落ちる | 未実装 |
| INF-IMG-05 | 単一 PUT の上限は 5 GiB である。これを超える画像は multipart upload へ切り替えるか、上限として拒否する。どちらを採るかを実装時に決め、暗黙に失敗させない | 未実装 |

##### 故障モード

| 故障 | 転送 | 計測 / 復旧 |
|---|---|---|
| Commercial D1 停止 | LKG で302を継続 | Queue に滞留し、consumer retry。redirect handler は D1 を参照しない |
| Queue enqueue 失敗 | 302を継続 | `click_enqueue_failed_total` を記録し、計測欠損としてエラーバジェットへ算入 |
| consumer / migration 障害 | 302を継続 | retry 後に dead-letter。修復後、event ID で安全に replay |
| KV 読み取り障害 | Cache API の LKG hit 時だけ302 | cache miss では安全な転送先を推測せず503。resolver error alert を発報 |
| resolver key 欠落・無効・停止済み | 転送しない | 404 / 410 を区別し、D1 fallback はしない |
| resolver 更新失敗・遅延 | 旧LKGで302 | version / updated_at の鮮度を観測し、outbox / Queue から再配送 |
| 画像の PUT が preflight で落ちる | 影響なし | CORS ポリシーの欠落・出所不一致として扱う。編集画面は「画像を保存できなかった」ことを本文の編集内容を失わずに伝える |
| 署名の期限切れ後に PUT | 影響なし | 401/403 を受けて署名を再発行し、同じ鍵へ再送する。鍵は再発行しても変わらないため記事本文の参照は保たれる |
| R2 停止 | 影響なし (転送経路とは独立) | 画像の追加のみ失敗する。既存記事の表示はカスタムドメインのキャッシュに従う。編集内容は保持し、再試行へ進める |

##### 測定可能な初期 SLO

実測ベースライン取得までの**暫定値**とし、28日 rolling window で評価する。

| SLI | 初期目標 | 測定条件 |
|---|---|---|
| Redirect success | 有効な resolver key の 302 成功率 99.95%以上 | 無効ID、停止済みlink、client cancellationを分母から除外 |
| Redirect latency | Worker 処理時間 p95 < 100 ms、p99 < 250 ms | `/go/*` の edge server timing。遷移先サイト時間は除外 |
| Resolver freshness | 検証済み link 更新の99%が5分以内にLKGへ反映 | outbox timestamp→KV version 観測時刻 |
| Click acceptance | redirect request に対する Queue accepted 率 99.9%以上 | 同意・botに関係なく producer の配送成否を測定し、分析採用可否とは分離 |
| Queue recovery | oldest-message age p95 < 60秒、99% < 5分 | consumer retry を含み、dead-letter は別途即時alert |

##### Delta

1. INF-DB-01 の2 D1と型定義を追加し、database の所有境界ごとに migration command を分ける。
2. validated original_url を outbox → Queue → KV へ発行する control plane と INF-REDIRECT-01 の read path を作る。
3. INF-EVENT-01 の Queue / dead-letter / consumer を接続し、INF-OBS-01 の metrics と alert を追加する。
4. D1・Queue・KV の故障注入後に上記 SLO を再測定し、暫定値を実測値でレビューする。
5. 既に定義済みの R2 binding `BUCKET` を記事画像の保管先として使う。新たに要るのは CORS ポリシー・カスタムドメイン・署名付き URL の発行経路の 3 つで、バケット自体の新設ではない。
6. 画像の削除は記事保存の同期処理に入れない。参照が切れた実体の刈り取りは maintenance-ops の掃除ジョブへ渡す (`OPS-REQ-008`)。infrastructure は保管と配信の側だけを持つ。

##### Dependencies

依存方向は `前提 → 後続` とする。

- database の `DB-BOUNDARY-01` → INF-DB-01 → 環境ごとの schema migration。
- AffiliateLink / TrackingLink の検証、`original_url` 無改変、`redirect_allowed` / channel policy、outbox relay → INF-REDIRECT-01。
- event ID / dedup key、Commercial D1 の append-only schema、consent policy → INF-EVENT-01。
- log/metric retention、alert routing、dead-letter replay runbook → INF-OBS-01 の運用開始。
- auth の Workspace membership + backend の `BE-IMAGE-01` (鍵の組み立て) → INF-IMG-01/02。infrastructure は鍵を受け取って保管する側であり、鍵を組み立てない。
- INF-IMG-04 (CORS) → INF-IMG-01。CORS を設定しない限り直接 PUT は成立しないため、順序が逆にならない。
- database の画像参照状態 → maintenance-ops の掃除ジョブ → R2 の削除。infrastructure から直接刈り取らない。

##### Acceptance evidence

- `wrangler` 設定と生成型に全環境の2 D1 / KV / Queue bindings が存在し、legacy `DB` の runtime read がない静的検査。
- Commercial D1 を停止した故障注入で、有効なLKGへの302が継続し、復旧後にQueue滞留分が重複なく反映されるテスト。
- KV更新失敗時に既存LKGが維持され、`original_url` のbyte列を変更せず302 `Location` に返す contract test。
- dashboard / alert 上で各 SLI の分子・分母、Queue lag、dead-letter 件数を再現できる観測記録。
- **INF-IMG-01/02**: 管理画面から画像を 1 枚アップロードし、R2 のオブジェクト一覧で鍵が `workspace_id/記事id/一意なid.拡張子` の形であることを確認。アップロード中の Worker のリクエスト数・CPU 時間が画像サイズに比例して増えないこと (本体が Worker を通っていないこと) を、Worker のログと突き合わせて保存。
- **INF-IMG-03**: 記事本文に保存された画像の URL がカスタムドメインを指し、バケットの公開 URL を含まないことを検査するテスト。配信元のドメインだけを差し替え、記事本文を書き換えずに表示が続くことを実測して保存。
- **INF-IMG-04**: CORS ポリシーを外した状態でブラウザから PUT し、preflight で落ちることを確認。設定を戻して成功することを確認。両方の HTTP トレース (`Origin` ヘッダを含む要求と、`Access-Control-*` 応答ヘッダの有無) を保存。
- **INF-IMG-05**: 5 GiB を超える入力に対して、選んだ方 (multipart へ切り替える / 上限として拒否する) の挙動が実際に起きることを示すテスト。暗黙に失敗せず、利用者に理由が伝わることを併せて保存。

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 既存章にだけ存在する要件定義表・受入条件とその文脈を、正規writerのchapter_notesへ逐語移送して再生成時の欠落を防ぐ。利用者回答や承認内容は改変せず、過去の実装記録を現在のPASSとして扱わない。

### To-Be（規範契約）

> 2026-09-06 現行規範。旧注記「章の規範本文を正本から再生成しない理由」は superseded とし、その「再生成しない」指示を無効化する。正本 chapter_notes と正規 compiler を唯一の更新経路とする。旧 374 行等の欠落原因・旧方式・過去の実装/PASS 状態は歴史的スナップショットとして保持する。以下は要求であり、実装・受入・remote migration・本番公開の完了を意味しない。

画像関連要件は 2026-09-06 の現行 Worker アップロード・ライフサイクル契約で同 ID を改訂した。旧 direct PUT/CORS/容量・可逆性の規定は歴史記録のみとし適用しない。

| 要件ID | 目標状態 |
|---|---|
| INF-DB-01 | local / dev / production の各環境に `EDITORIAL_DB` と `COMMERCIAL_DB` を明示し、migration と backup / restore の対象を分離する。legacy `DB` は cutover 完了後に参照しない |
| INF-REDIRECT-01 | `/go/{tracking_link_id}` の同期 read path は Redirect Resolver Store を正とし、D1 を読まない。初期実装は KV の `tracking_link_id → validated original_url + enabled + version` を Last Known Good（LKG）として保持し、検証済み更新の公開に失敗した場合は旧値を残す。hot entry は Cache API に補助キャッシュしてよいが、D1 fallback は禁止する |
| INF-EVENT-01 | redirect response の確定と ClickEvent の計測を分離し、event enqueue は `waitUntil` で best-effort に行う。consumer が Commercial D1 へ idempotent append し、失敗は retry / dead-letter へ送る |
| INF-OBS-01 | redirect、resolver、enqueue、consumer、D1 write を別の signal として計測する。最低限 `redirect_requests_total`、`redirect_302_total`、`resolver_hit/miss/error/stale_total`、`click_enqueue_attempt/accepted/failed_total`、`click_consumer_success/retry/dead_letter_total`、oldest-message age を持つ |
| INF-IMG-01 | 記事画像は認証済み管理画面から同一生成元の Worker API へ送り、Worker が検証後に R2 binding で格納する。2026-09-06 の dec-article-image-upload-path 改訂に従い、旧署名付き URL によるブラウザ直接 PUT は採用しない。 |
| INF-IMG-02 | オブジェクト鍵は article-images/workspace_id/article_id/一意なid.拡張子に統一し、サーバーだけが組み立てる。workspace と記事の所有関係は鍵の並びだけに頼らず、認可・台帳・保存時の制約で検証する。 |
| INF-IMG-03 | 記事本文の画像参照は /api/article-images/{imageId} の不透明な ID を用い、R2 バケット URL や object_key を埋めない。配信口は台帳の ready 状態と公開本文参照または編集権限を検証し、保管場所の変更を本文から切り離す。 |
| INF-IMG-04 | R2 への書き込みは Worker binding に限定し、ブラウザ向け直接 PUT/CORS 設定や署名発行を前提としない。管理 API は同一生成元の送信とサーバー側認証・認可を要求する。 |
| INF-IMG-05 | 記事画像は 1 枚 8 MiB 以下の PNG/JPEG/WebP/GIF に限定する。API 入口と use-case で容量・実バイトの画像型を検証し、上限超過や不一致を R2 保存前に拒否する。multipart upload はこの契約に含めない。 |

- 正本へ入れた理由: 現行要件表を正本へ接続。旧再生成禁止 note を superseded とし、画像契約は現行実装・確定判断に同期。

### 公開と復旧の運用規範 (章にしか居場所が無かった 4 件)

**以下は利用者の逐語ではない。**章にだけ在った 4 件の記述を、消えようのない場所へ移したものである。
元は `qa-infra-web-post-deploy-smoke` / `qa-infra-web-deploy-steps` / `qa-infra-web-branch-flow` /
`qa-infra-web-schema-drift` という名の小節だったが、**この 4 つの ID は `qa_log` に存在しない**。
どのセルの `qa_ref` / `qa_refs` / `required_info[].grounded_by` からも引かれておらず、
`reopen_log[].discarded` にも現れない。章の側にだけ残っていた。書面の出典は
`docs/spec/11-CI-CD・品質ゲート仕様.md` である。内容は変えず、見出しだけ改めた。

#### 公開が終わったあとの確認 (旧 qa-infra-web-post-deploy-smoke)

「デプロイ成功」はファイルが届いたことしか意味しない。

- スモークテストを **30 秒待つ → 1 回目 → 90 秒待つ → 2 回目** の二段構えで実行する。
  Cloudflare Workers は旧版の実行環境を数十秒〜1〜2 分保持するため、
  1 回だけの確認では反映を判定できない (直っているのに落ちる／壊れているのに通る、が両方起こる)。
- スモークテストが落ちたらワークフローを失敗させる。
  **「デプロイは成功したがアプリは壊れている」を緑で通さない。**

原則: 届いたことと動いていることは別である。公開の成功をもって正常とみなさない
(`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-3`)。
実行環境が入れ替わる途中で測らない。間隔を空けて 2 回測り、両方で判定する。

トレードオフ: 公開のたびに待ち時間と確認 2 回ぶんが加算され所要時間が最低 2 分ほど延びる。
スモークテスト自体が不安定だと正常な公開まで赤くなる。確認するのは叩いた経路だけで、
叩いていない画面の故障は依然として通る。保持時間が想定より長い環境では 2 回目でも旧版を掴む
可能性が残る。待ち時間を仕様に埋め込んだので、基盤側の挙動が変われば仕様の側も直す必要がある。

#### 通常の公開の並びと、その支点 (旧 qa-infra-web-deploy-steps)

`deploy.yml` は dev / 本番のどちらでも、通常の公開を 1 本で完了させる。

1. 控えを取る (`wrangler d1 export`)
2. **中身が空でないことを確かめる。空ならそこで止まり、適用へ進まない**
3. 成果物として 30 日保管する (落ちても控えが残るよう、適用より先に保存する)
4. データの形を適用する
5. 未適用が 0 件になったことを確かめる (公開の直前・§4-1-1)
6. 実際の表・列・索引・トリガーが正本と合うことを確かめる (§4-1-2)
7. アプリを公開する

**2 が支点である。ここが通らなければ 4 は起きない。**

- `deploy.yml` と `migrate.yml` は、同じ dev / production の D1 を同時に変更しない。
  同一環境の concurrency group を共有し、先に始まったほうが台帳・形の確認まで終わるのを待つ。

原則: 戻せない操作を機械にやらせる条件は 1 つだけである — 戻る先があること。控えを取るだけでなく、
中身が空でないことを確かめ、適用より先に保管する (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)。
同じものを変えうる経路が 2 本あるなら同時に走らせない。片方の途中の状態を、もう片方が正本として読む。

トレードオフ: 形を変えない公開でも控えの取得・検査・保管の 3 手が必ず走るため所要時間が延びる。
30 日ぶんの成果物を保持するので保管量と費用が積み上がる。空でないことしか見ないので、
中身が壊れている控えは通る (戻る先が在ることの保証は完全ではない)。同一環境への 2 経路が
直列化するため移行中の公開は待ち行列に入り、片方が詰まると無関係な変更まで巻き添えで待つ。
group を環境ごとに切る前提なので、環境名を誤ると別環境どうしが不要に直列化する。

#### 公開へ至る枝の順番を誰が守るか (旧 qa-infra-web-branch-flow)

| `branch-flow.yml` | main への PR | 比較元の枝を見る | **なし** |

`branch-flow.yml` を `ci.yml` に混ぜなかった理由は、見ているものが違うからである。
`ci.yml` は**中身が正しいか**を、`branch-flow.yml` は**どこから来たか**を見る。
混ぜると、枝の順番だけを守らせたい場面で検査一式が動く。

| CI-AC-03 | ワークフローが壊すものの重さで分かれている (検査 / 枝の順番 / 公開 / 構造変更 / 深い門 / AI 評価 / Actions 使用量の 7 本) | — |
| CI-AC-20 | `main` への PR は比較元が `dev` か `hotfix/*` でないとマージ前に落ちる | — |

#### 形を適用したあと、公開する前に確かめること (旧 qa-infra-web-schema-drift)

置き場所は**適用の後・公開の前**でなければならない。適用の前に置くと、
未適用の分がすべて「足りない」として出て、常に赤になる。
`deploy.yml` と `migrate.yml` の両方に置く。**片方だけ緩いと、ずれはその片方から入る。**

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 章にだけ在り、qa_log にも reopen_log にも対応 entry が無い 4 件 (post-deploy-smoke / deploy-steps / branch-flow / schema-drift)。compile が退避棚へ引き継ぐだけで正本から再生成されず、章がバイト一致の床を永久に割っていた。内容は docs/spec/11-CI-CD・品質ゲート仕様.md に対応する実質的な運用規範で、捨てられない。確定セルを巻き戻さず消えようのない場所へ移す。

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

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/infrastructure.md`](applied/infrastructure.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers | 2026-04-23 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/ | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |
| cloudflare-for-saas | 2026-04-29 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/ | 2026-09-03T12:55:14Z | 2026-09-03T12:55:14Z |
| cloudflare-r2-overview | 2026-08-07 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/ | 2026-09-03T12:55:14Z | 2026-09-03T12:55:14Z |
| cloudflare-r2 | 2026-08-22 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ | 2026-09-05T00:57:28Z | 2026-09-05T00:57:28Z |
