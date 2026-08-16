# まだ中身が無いもの（スタブ台帳）

このファイルは `tests/infrastructure/stub-ledger.test.ts` が作る。手で書き換えない。
更新は `UPDATE_STUB_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。

「スタブ」は、つなぎ目だけあって中身がまだ無いもの。呼ぶと必ず失敗を返す。
成功したふりをしないので、「つながっているのに結果が空」という分かりにくい壊れ方をしない。

件数: 28

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
| `channel:instagram` | Instagram への配信 | ChannelConnectorPort | Instagram Graph API はプロアカウントと Facebook ページ連携が必要 |
| `channel:newsletter` | メール配信 への配信 | ChannelConnectorPort | 配信基盤 (メール送信) の選定が必要 |
| `channel:own_site` | 自社サイト への配信 | ChannelConnectorPort | サイト公開の実装 (Workers 上のレンダリング) が必要 |
| `channel:threads` | Threads への配信 | ChannelConnectorPort | Threads API のアプリ登録が必要 |
| `channel:tiktok` | TikTok への配信 | ChannelConnectorPort | TikTok Content Posting API の審査が必要 |
| `channel:wordpress` | WordPress への配信 | ChannelConnectorPort | 接続先サイトの REST API とアプリケーションパスワードが必要 |
| `channel:x` | X への配信 | ChannelConnectorPort | X API の有料プラン契約とアプリ登録が必要 |
| `channel:youtube` | YouTube への配信 | ChannelConnectorPort | YouTube Data API のクォータ申請が必要 |
| `identity:sample-actor` | ログイン情報（見本） | 現在のログイン利用者の取得 | Better Auth と Google ログインの設定 |
| `llm:anthropic` | Anthropic での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `llm:openai` | OpenAI での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `llm:workers_ai` | Cloudflare Workers AI での文章生成 | LlmPort | 提供元の選定と、利用者ご自身による API キーの登録が必要 |
| `persistence:content-sample` | 公開記事の保存先（見本データ） | PublishedContentPort | content_packages / published_articles テーブルの追加とマイグレーション |
| `persistence:ranking-sample` | ランキングの保存先（見本データ） | EditorialRankingModelRepositoryPort / EditorialScoreCardRepositoryPort | ranking_models / score_cards テーブルの追加とマイグレーション |
| `persistence:site-sample` | ブログの設計図（見本データ） | SiteRepositoryPort | site_blueprints テーブルの追加とマイグレーション |
| `reader:contact-sink` | 問い合わせの受け取り（送信せず記録のみ） | ContactPort | Turnstile の鍵と送信元メールアドレスの登録（利用者本人が登録する） |
| `reader:shortlist-memory` | 気になる商品の保存（処理中のメモリ） | ShortlistPort | 読者ごとの保存先 (KV 名前空間) の作成 |
| `reader:tools-sample` | 診断・計算の道具（見本の定義のみ） | ReaderToolPort | 商品データの取込と、道具ごとの計算式の登録 |
| `storage:signed-url` | ファイルの一時公開URL発行 | StoragePort.getSignedUrl | R2 の署名付きURLは公開バケットまたは Worker 経由の配信方針を決めてから実装する。現状は公開バケットの固定URLで代替できる |
