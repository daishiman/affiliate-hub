# 管理画面 情報台帳

- feature: `feat-admin-cognitive-load-ui`
- 対象: 86 画面（`ADMIN_ROUTE_METADATA` と `src/app/admin/**/page.tsx` の一致を機械照合）
- 未決: 0 件
- 方針: 各画面は「目的 → 主操作 → 必要情報 → 補足」の順で読み、内部識別子・API・endpoint・ツール名は通常画面に常時露出しない。

| route | 画面 | 目的 / 主操作 | 主表現（補助）→ あるべき主表現 | 権限 |
|---|---|---|---|---|
| `/admin` | ホーム | 次に手を付ける仕事へ移動する / **板に出た最優先の 1 件へ移動する** | board (card) | `authenticated` |
| `/admin/products` | 商品 | 商品をさがして詳細へ進む / **条件で絞り込み、目的の商品の詳細へ進む** | table (summary) | `product.read` |
| `/admin/products/[product]` | 対象の詳細 | 1 商品の内容を確かめ、素材として残すか判断する / **評価項目ごとの測り方と点数を読み、素材として残すか決める** | card (summary) | `product.read` |
| `/admin/products/[product]/edit` | 編集 | 登録済みの商品の値を直す / **直した商品の値を保存する** | card (summary) | `product.read` |
| `/admin/products/compare` | 商品を比べる | 複数商品を同じ項目で比べる / **同じ項目で並べた結果から採る商品を決める** | comparison (table) | `product.read` |
| `/admin/products/new` | 商品を追加 | 商品を 1 つ登録する / **入力した商品を登録する** | card (summary) | `product.read` |
| `/admin/evidence` | 根拠 | 出所のない内容を見つける / **出所の欠けた主張を見つけて根拠を足す** | table (summary) → **board 予定** | `content.read` |
| `/admin/evidence/new` | 根拠を登録する | 根拠を 1 つ登録する / **入力した根拠を登録する** | card (summary) | `content.read` |
| `/admin/evidence/claims/new` | 言えることを登録する | 商品について言えることを 1 つ登録する / **入力した主張を登録する** | card (summary) | `content.read` |
| `/admin/evidence/test-runs/new` | 検証記録を登録する | 実際に測った記録を 1 つ登録する / **入力した検証記録を登録する** | card (summary) | `content.read` |
| `/admin/rankings` | 評価基準と順位 | 決めた基準での順位と、その理由を確かめる / **順位とその理由を読み、掲載する並びを確かめる** | table (summary) | `content.read` |
| `/admin/rankings/criteria` | 評価基準 | 何をどう測って並べているかを読む / **測り方と重みを読み、対象の順位へ進む** | table (summary) | `content.read` |
| `/admin/rankings/models` | 評価基準を管理する | 保存されている評価基準を並べ、次に使う版を選ぶ / **保存された版から次に使う評価基準を選ぶ** | table (summary) → **board 予定** | `content.read` |
| `/admin/rankings/models/new` | 評価基準を作る | 評価基準を 1 つ作る / **項目と重みを入れて評価基準の版を作る** | card (summary) | `content.read` |
| `/admin/rankings/scores` | 点を入れる | 決めた基準で、商品 1 つの点を記録する / **評価項目ごとに点を入れて記録する** | table (summary) | `content.read` |
| `/admin/content` | 記事 | 次に手を付ける記事を決める / **段階の止まった記事を見つけて次へ進める** | table (summary) → **board 予定** | `content.read` |
| `/admin/content/[variant]` | 対象の詳細 | 本文を読み、残すか次へ進めるか判断する / **本文を読み、進行と配信の操作へ進む** | card (summary) | `content.read` |
| `/admin/content/[variant]/edit` | 文章を直す | 記事の文章を直す / **直した本文を保存する** | card (summary) | `content.read` |
| `/admin/content/[variant]/progress` | 公開までの進み具合 | この記事を公開へ向けて次の段階へ進める / **いまの段階を確かめ、次の段階へ進める** | table (summary) → **list 予定** | `content.read` |
| `/admin/content/matrix` | 記事案をまとめて作る | 誰に・どの切り口で・どの媒体へ出すかを決め、記事案を作る / **読者像と切り口と媒体の組から記事案を作る** | table (summary) → **board 予定** | `content.read` |
| `/admin/content/packages` | 企画 | 何のために記事を書くかを決める / **企画の並びから次に進める企画を決める** | table (summary) → **board 予定** | `content.read` |
| `/admin/content/packages/new` | 企画を立てる | 企画を 1 つ立てる / **入力した企画を立てる** | card (summary) | `content.read` |
| `/admin/content/new` | 記事を作る | 記事案から原稿を 1 本作る / **選んだ企画から原稿を作る** | card (summary) | `content.read` |
| `/admin/content/published` | 公開済み記事 | 公開済み記事から訂正または非表示にする記事を選ぶ / **公開済みから訂正または非表示にする記事を選ぶ** | table (summary) → **board 予定** | `content.read` |
| `/admin/content/published/[site]/[slug]/edit` | 編集 | 公開済み記事を訂正し、変更理由を記録する / **訂正した本文と変更理由を保存する** | card (summary) | `content.read` |
| `/admin/personas` | 書き手と読者像 | 書き手と読者像を決める / **書き手が扱える範囲を調べ、担当を決める** | table (summary) → **board 予定** | `content.read` |
| `/admin/personas/new` | 書き手を作る | 書き手を 1 人作る / **入力した書き手を登録する** | card (summary) | `content.read` |
| `/admin/personas/audiences` | 読者像 | 誰に向けて書くかを決める / **読者像ごとの目的と知識量を読み、向ける相手を決める** | table (summary) → **board 予定** | `content.read` |
| `/admin/personas/audiences/new` | 読者像を作る | 読者像を 1 つ作る / **入力した読者像を登録する** | card (summary) | `content.read` |
| `/admin/writing` | 書き方の決めごと | 書き方の決めごとを調べる（参照専用） / **決めごとの一覧から該当箇所を引く** | table (summary) | `content.read` |
| `/admin/generation` | 生成の仕組み | AI に何を渡し、どこから人が決めるかを調べる（参照専用） / **渡す項目と人が決める範囲を引く** | table (summary) | `content.read` |
| `/admin/generation/inputs` | 生成に使う情報 | AI に渡す素材の過不足を見る / **渡す素材の欠けを確かめる** | table (summary) | `content.read` |
| `/admin/generation/prompt` | 生成指示 | 指示文の組み立て方を読む / **指示文の組み立て順を読み、渡す項目へ進む** | table (summary) | `content.read` |
| `/admin/site-network` | ブログのつながり | ブログ同士のつながりを見て、行き止まりを見つける / **行き止まりになっているつながりを見つける** | table (summary) → **board 予定** | `content.read` |
| `/admin/site-network/[node]` | 対象の詳細 | 1 本のつながりを直す / 外す / **このつながりを直すか外す** | card (summary) | `content.read` |
| `/admin/site-network/deleted` | 削除済み | 削除済みのつながりを確かめ、必要なら戻す / **削除済みのつながりを確かめ、戻す** | table (summary) | `content.read` |
| `/admin/site-network/new` | つながりに 1 本足す | つながりに 1 本足す / **入力したつながりを足す** | card (summary) | `content.read` |
| `/admin/blog` | ブログの版面 | ブログの見た目と中身のどこを直すか決める（索引） / **直す対象の画面へ移動する** | table (summary) → **list 予定** | `content.read` |
| `/admin/blog/articles` | 記事 | ブログに載せる記事のうち、次に手を入れるものを決める / **絞り込んで次に手を入れる記事を決める** | table (summary) → **board 予定** | `content.read` |
| `/admin/blog/articles/[article]` | 対象の詳細 | 記事の中身を直し、公開まで進める / **直した記事を保存し、公開まで進める** | card (summary) | `content.read` |
| `/admin/blog/articles/deleted` | 削除済み | 削除済みの記事を確かめ、必要なら戻す / **削除済みの記事を確かめ、戻す** | table (summary) | `content.read` |
| `/admin/blog/articles/new` | 記事を 1 本作る | ブログの記事を 1 本作る / **下書きを作る** | card (summary) | `content.read` |
| `/admin/blog/delivery` | 配信の部品 | 読者へ届く経路 (feed・sitemap など) の出し入れを決める / **配信経路の出し入れを保存する** | table (summary) | `content.read` |
| `/admin/blog/evaluate` | 読者の評価 | 読者の評価から、手を入れる記事を選ぶ / **評価と鮮度から手を入れる記事を選ぶ** | table (summary) → **board 予定** | `content.read` |
| `/admin/blog/evaluate/[article]` | 対象の詳細 | この記事に付いた票を 1 件ずつ見て、伏せるかどうかを決める / **票を 1 件ずつ見て伏せるかどうかを決める** | card (summary) | `content.read` |
| `/admin/blog/layout` | 版面の枠と帯 | ヘッダー・サイドバー・帯に何を出すか決める / **帯と枠に出す内容を保存する** | table (summary) | `content.read` |
| `/admin/blog/pages` | 固定ページ | 運営が示す固定ページの不足を埋める / **足りない固定ページを見つけて書く** | table (summary) → **board 予定** | `content.read` |
| `/admin/blog/tags` | タグ | 記事をまとめるタグを整える / **タグの名前と結び付きを直す** | table (summary) | `content.read` |
| `/admin/sites` | サイト | 運用中のブログを選ぶ / 新しく作る / **運用するブログを選ぶか、新しく作る** | table (summary) → **list 予定** | `content.read` |
| `/admin/sites/[site]` | 対象の詳細 | 1 ブログの設計図を確かめ、運用を続けるか判断する / **設計図を読み、運用を続けるか判断する** | card (summary) | `content.read` |
| `/admin/sites/[site]/edit` | サイトを直す | ブログの設計図を直す / **直した設計図を保存する** | card (summary) | `content.read` |
| `/admin/sites/[site]/documents` | 固定ページ | 運営者情報・各方針・規約・特定商取引法に基づく表記を書き、未記入を無くす / **未記入の法定ページを見つけて書く** | table (summary) → **board 予定** | `content.read` |
| `/admin/sites/new` | サイトを作る | ブログを 1 本作る / **13 の質問に答えてブログを作る** | card (summary) | `content.read` |
| `/admin/distribution` | 配信 | 止まっている配信を見つけて対処する / **止まっている配信を見つけて接続を確かめる** | table (summary) → **board 予定** | `content.read` |
| `/admin/distribution/[publication]` | 対象の詳細 | 1 配信の進行を確かめ、次の操作をする / **この配信の進行を確かめ、次の操作をする** | card (summary) | `content.read` |
| `/admin/distribution/[publication]/edit` | 配信を直す | 予定した配信の出し先と日時を直す / **直した出し先と日時を保存する** | card (summary) | `content.read` |
| `/admin/distribution/calendar` | 配信カレンダー | 予定の偏りと承認漏れを確かめ、必要なら日時を直す / **日付の並びから偏りを見つけ、予定日を変える** | timeline (summary, table) | `content.read` |
| `/admin/distribution/new` | 配信を作る | 承認済みの記事を出し先へ登録する / **出す記事と出し先を選んで登録する** | card (summary) | `content.read` |
| `/admin/affiliate` | 提携と成果 | 提携先ごとの成果金額を見る / **期間ごとの成果金額を読み、1 件ずつの内訳へ進む** | table (summary) | `affiliate.read_revenue` |
| `/admin/affiliate/[conversion]` | 対象の詳細 | 1 成果の内訳を確かめ、必要なら金額を直す / **内訳を確かめ、直した金額を保存する** | card (summary) | `affiliate.read_revenue` |
| `/admin/affiliate/accounts/new` | 提携先を登録する | 提携先（ASP アカウント）を 1 つ登録する / **入力した提携先を登録する** | card (summary) | `affiliate.read_revenue` |
| `/admin/affiliate/programs/new` | 提携条件を登録する | 提携条件（広告主と報酬の決め方）を 1 つ登録する / **入力した提携条件を登録する** | card (summary) | `affiliate.read_revenue` |
| `/admin/affiliate/links` | 登録したリンク | 読者に出ているリンクのうち、表記が古くなったものを止める / **表記が古くなったリンクを見つけて止める** | table (summary) → **board 予定** | `affiliate.read_revenue` |
| `/admin/inbox` | 成果リンクの受信箱 | 成果リンクを受け取り、広告主と商品を決める / **受け取ったリンクに広告主と商品を割り当てる** | table (summary) → **board 予定** | `affiliate.read_revenue` |
| `/admin/analytics` | 数字 | どこに手を入れるべきかを決める / **数字の伸び縮みから手を入れる先を決める** | graph (summary, table) | `analytics.read` |
| `/admin/ai-usage` | AI の利用と費用 | AI の利用量と費用を確かめる / **期間ごとの利用量と費用を確かめる** | graph (summary, table) | `analytics.read` |
| `/admin/improvement` | 改善の状況 | 試している比較の結果を見て、次の試作を決める / **比較の結果を読み、次の試作を決める** | graph (summary, table) | `analytics.read` |
| `/admin/improvement/dimensions` | 改善の観点 | 試してよいもの / 変えないものを調べる（参照専用） / **試してよい範囲を引き、改善の状況へ進む** | table (summary) | `analytics.read` |
| `/admin/contact` | 読者からの問い合わせ | 読者から届いた問い合わせを読み、対応の済んだものに印を付ける / **未対応の問い合わせを読み、対応済みの印を付ける** | table (summary) → **board 予定** | `feedback.read` |
| `/admin/feedback` | 使い勝手を直す | 届いた改善要望から次に扱うものを選び、実装へ渡す / **次に扱う要望を選び、実装へ払い出す** | table (summary) → **board 予定** | `feedback.read` |
| `/admin/feedback/[report]` | 対象の詳細 | 1 件の要望を扱うか決め、必要なら実装へ渡す / **この要望の扱いを決めて保存する** | card (summary) | `feedback.read` |
| `/admin/tools` | AI から使える道具 | AI から使える道具を調べる（参照専用） / **使える道具とその範囲を引く** | table (summary) | `content.read` |
| `/admin/ui-catalog` | 画面部品の見本 | 使える部品を探す（参照専用・見本帳） / **部品の見本を出して使えるか確かめる** | list (summary) | `content.read` |
| `/admin/settings` | 設定 | 設定したい対象へ移動する（索引） / **設定したい対象の画面へ移動する** | list (summary) | `content.read` |
| `/admin/settings/appearance` | 見た目 | この端末での見た目を選ぶ / **配色と文字の大きさを選ぶ** | table (summary) | `content.read` |
| `/admin/settings/audit` | 操作の記録 | 誰がいつ何をしたかを辿る / **直近の操作記録を辿る** | table (summary) | `content.read` |
| `/admin/settings/compliance` | 広告表記ときまり | 広告であることの表示と、表現を止めるきまりを直す / **止める表現のきまりを足す** | table (summary) | `content.read` |
| `/admin/settings/integration-access` | 外部連携の権限 | 取得用の鍵を発行・失効する / **取得用の鍵を発行する** | table (summary) | `content.read` |
| `/admin/settings/llm` | AI 接続 | 生成 AI の API キーを登録・確認・失効する / **生成 AI の鍵を発行元で作り、登録する** | table (summary) | `content.read` |
| `/admin/settings/members` | メンバー | 誰が何を担当しているかを見る / **担当を確かめ、必要な人を招く** | table (summary) | `content.read` |
| `/admin/settings/roles` | 役割 | 役割で許される操作を確かめる / **役割ごとに許される操作を確かめる** | table (summary) | `content.read` |
| `/admin/settings/seo` | SEO/AI 検索の指針 | SEO/AI 指針の出典を登録し、90 日超を再確認する / **90 日を超えた出典を見つけて登録し直す** | table (summary) → **board 予定** | `content.read` |
| `/admin/settings/workspaces` | 作業場所 | この作業場所の契約と表示を確かめる / **契約と表示を確かめ、ブランドを直す画面へ進む** | table (summary) | `content.read` |
| `/admin/settings/workspaces/edit` | 設定を直す | 作業場所の名前・契約の区分・時間帯・通貨を直す / **直した作業場所の設定を保存する** | card (summary) | `content.read` |
| `/admin/settings/brands/new` | ブランドを作る | ブランドを 1 つ作る / **入力したブランドを作る** | card (summary) | `content.read` |
| `/admin/settings/brands/[brand]` | ブランドを直す | ブランドの名前・問い合わせ先・文体を直す / **直したブランドの内容を保存する** | card (summary) | `content.read` |

## 全画面共通の保持・削減判断

- 保持: 対象を識別する名前、判断に必要な現在状態、次の操作。
- 削除または明示開示へ移す: 内部 ID、API・endpoint・ツール名、重複説明、通常判断に不要な詳細。
- 状態: ideal / empty / loading / partial / error / slow の 6 状態を共通契約で扱う。
- すべて `decision: decided`。未決の表現方式・情報要否はない。
- 目的と主操作は 86 件すべて別の文にする。同じ文なら画面ごとに表現を選ぶ余地が無くなり、実際に「{画面名}について、現在地と次に行うことを迷わず判断する」で揃えていたときは主表現の 44/86 が table に寄っていた。
- `plannedPrimary` は `src/presentation/admin/admin-screen-task-manifest.ts` の primary task から導いたあるべき主表現。`primary`（実装に結線されている現在の主表現）と食い違う 22 件は JSON の `plannedPrimaryGapRouteIds` に列挙し、画面実装が追いつくまで乖離として数える。
- `keyboardAction` は384px CSS viewport（768pxの200%相当）で完了する主要操作を `role` / `accessibleName` / 同名時の `occurrence` / `completion` で固定する。`viewportCondition` はこの測定条件そのもので、route ごとの観測日時ではない（実測は tests/e2e/app-routes.spec.ts が 384x450 で毎回行う）。全86 routeで実Tab照合後にEnter・入力・scrollの結果まで確認し、対象への到達だけを成功扱いにしない。

JSON 正本: [`screen-information-ledger.json`](./screen-information-ledger.json)
