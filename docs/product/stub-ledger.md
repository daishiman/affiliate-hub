# まだ中身が無いもの（スタブ台帳）

このファイルは `tests/infrastructure/stub-ledger.test.ts` が作る。手で書き換えない。
更新は `UPDATE_STUB_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。

「スタブ」は、つなぎ目だけあって中身がまだ無いもの。呼ぶと必ず失敗を返す。
成功したふりをしないので、「つながっているのに結果が空」という分かりにくい壊れ方をしない。

**2 つに分けて数える。** 下の「控え」は本物ができたあとも残るもので、
まだ作っていないものと一緒に数えると、進んだのに件数が減らないという読み方になる。

## まだ中身が無いもの

件数: 36

| 識別子 | 何のスタブか | つなぎ目 | 何が済めば実装できるか |
|---|---|---|---|
| `asp:a8net` | A8.net との連携 | AspAdapterPort | A8.net は公開APIが限定的。成果データはCSV取込で代替する方針を決める |
| `asp:accesstrade` | アクセストレード との連携 | AspAdapterPort | アクセストレードのAPI利用申請が必要 |
| `asp:afb` | afb（アフィリエイトB） との連携 | AspAdapterPort | afb のパートナー審査通過とAPI利用申請が必要 |
| `asp:amazon_associates` | Amazonアソシエイト との連携 | AspAdapterPort | PA-API 5.0 の利用資格 (売上実績) と申請が必要 |
| `asp:direct` | 直接契約 との連携 | AspAdapterPort | 直接契約は広告主ごとに連携方法が異なる。手動登録で運用する |
| `asp:moshimo` | もしもアフィリエイト との連携 | AspAdapterPort | もしもアフィリエイトのAPI提供条件の確認が必要 |
| `asp:rakuten_affiliate` | 楽天アフィリエイト との連携 | AspAdapterPort | 楽天ウェブサービスのアプリID発行が必要 |
| `asp:value_commerce` | バリューコマース との連携 | AspAdapterPort | バリューコマースのAPI利用申請と提携承認が必要 |
| `asp:yahoo_shopping` | Yahoo!ショッピング との連携 | AspAdapterPort | Yahoo!デベロッパーネットワークのアプリケーションID発行が必要 |
| `channel:bluesky` | Bluesky への配信 | ChannelConnectorPort | Bluesky (AT Protocol) のアプリパスワード発行が必要 |
| `channel:instagram` | Instagram への配信 | ChannelConnectorPort | Instagram Graph API はプロアカウントと Facebook ページ連携が必要 |
| `channel:newsletter` | メール配信 への配信 | ChannelConnectorPort | 配信基盤 (メール送信) の選定が必要 |
| `channel:own_site` | 自社サイト への配信 | ChannelConnectorPort | 記事の保存先 (content:*) を D1 につなぐことが必要 |
| `channel:threads` | Threads への配信 | ChannelConnectorPort | Threads API のアプリ登録が必要 |
| `channel:tiktok` | TikTok への配信 | ChannelConnectorPort | TikTok Content Posting API の審査が必要 |
| `channel:wordpress` | WordPress への配信 | ChannelConnectorPort | 接続先サイトの REST API とアプリケーションパスワードが必要 |
| `channel:x` | X への配信 | ChannelConnectorPort | X API の有料プラン契約とアプリ登録が必要 |
| `channel:youtube` | YouTube への配信 | ChannelConnectorPort | YouTube Data API のクォータ申請が必要 |
| `identity:sample-actor` | ログイン情報（見本） | 現在のログイン利用者の取得 | Better Auth と Google ログインの設定 |
| `llm:anthropic` | Anthropic での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `llm:google_gemini` | Google Gemini での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `llm:openai` | OpenAI での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `llm:workers_ai` | Cloudflare Workers AI での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `persistence:affiliate-sample` | 提携と成果（見本データ） | 提携先・提携条件・提携リンクの保存先 | affiliate_accounts / affiliate_programs / affiliate_links テーブルの追加と、各 ASP の API 利用申請および接続情報の登録（利用者本人による）。成果そのものの保存先は解除済み（affiliate_conversions） |
| `persistence:click-tracking-sample` | クリックの記録（未実装） | クリック計測 | click_events テーブルと、リンクの計測識別子を発行する仕組み |
| `persistence:content-editorial-sample` | 記事と書き手（見本データ） | 記事・企画・書き手の保存先 | content_packages / personas テーブルの追加と、企画・書き手を作る入口 |
| `persistence:content-sample` | 公開記事の保存先（見本データ） | PublishedContentPort | content_packages / published_articles テーブルの追加とマイグレーション |
| `persistence:distribution-sample` | 配信（見本データ） | 配信先の接続と配信記録の保存先 | 各サービスの接続設定（利用者本人による認証） |
| `persistence:improvement-sample` | 改善ループの記録（見本データ。保存はできません） | 改善ループの記録先 | 改善ループを回す入口（画面と操作）の追加。そのうえで variant_specs / loop_runs / loop_observations テーブルの追加 |
| `persistence:product-sample` | 商品と根拠（見本データ） | 商品・主張・根拠・検証記録の保存先 | 商品・主張・根拠を登録する入口（画面と操作）の追加。そのうえで products / claims / evidence / test_runs テーブルの追加とマイグレーション |
| `persistence:ranking-sample` | ランキングの保存先（見本データ） | EditorialRankingModelRepositoryPort / EditorialScoreCardRepositoryPort | 順位づけの基準と採点表を作る入口（画面と操作）の追加。そのうえで ranking_models / score_cards テーブルの追加とマイグレーション |
| `persistence:settings-sample` | 設定（見本データ） | 作業場所・担当者・ブランド・広告表記・操作の記録の保存先 | workspaces / memberships / brands / disclosures / audit_logs テーブルの追加と、Better Auth と Google ログインの設定 |
| `reader:contact-sink` | 問い合わせの受け取り（送信せず記録のみ） | ContactPort | Turnstile の鍵と送信元メールアドレスの登録（利用者本人が登録する） |
| `reader:shortlist-memory` | 気になる商品の保存（処理中のメモリ） | ShortlistPort | 読者ごとの保存先 (KV 名前空間) の作成 |
| `reader:tools-sample` | 診断・計算の道具（見本の定義のみ） | ReaderToolPort | 商品データの取込と、道具ごとの計算式の登録 |
| `storage:signed-url` | ファイルの一時公開URL発行 | StoragePort.getSignedUrl | 画像・書き出しファイルの保存が本物になること（この置き場は現在どこからも使われていない）。配り方は写しと同じ Worker 経由に決定済み |

## 本物ができたあとの控え

本物はあるが、保存先が供給されない環境（`pnpm dev`・自動テスト）では
こちらへ回る。**消す予定は無いので、この件数は減らない。**
何で動いているかは、必ず画面に文字で出す（黙って控えへ落ちない）。

件数: 7

| 識別子 | 何の控えか | つなぎ目 | 本物の置き場所 |
|---|---|---|---|
| `persistence:analytics-sample` | 数字（見本データ） | 指標の読み口 | `src/infrastructure/persistence/d1/telemetry-repository.ts` |
| `persistence:feedback-memory` | 改善要望の記録（この実行中だけ覚える仮置き） | 改善要望の記録先 | `src/infrastructure/persistence/d1/feedback-repository.ts` |
| `persistence:link-inbox-sample` | 受信箱（見本データ・この場限り） | 成果リンク受信箱の保存先 | `src/infrastructure/persistence/d1/link-inbox-repository.ts` |
| `persistence:site-draft-memory` | ブログ作成の下書き（プロセス内のみ） | SiteDraftRepositoryPort | `src/infrastructure/persistence/d1/site-draft-repository.ts` |
| `persistence:site-sample` | ブログの設計図（見本データ） | SiteRepositoryPort | `src/infrastructure/persistence/d1/site-repository.ts` |
| `persistence:telemetry-memory` | 計測の記録（この実行中だけ覚える仮置き） | 計測の記録先 | `src/infrastructure/persistence/d1/telemetry-repository.ts` |
| `storage:feedback-capture-memory` | 画面の写し（この実行中だけ覚える仮置き） | 画面の写しの置き場 | `src/infrastructure/platform/feedback-capture-r2.ts` |
