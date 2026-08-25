---
status: confirmed
category: requirements-definition
---

# 要件定義書 (上位概念)

> 本章は spec-state.json の requirements_foundation を正本とする、システム構築の憲法。
> 以降の各技術章は frontmatter の serves_goals でここ (ゴール) へトレース (anchor) する。
> 上位概念がブレなければ、仕様が整った後もブレない。

- 確定マーカー: `status: confirmed` (要求判断の収集済みを表す。実装完了・試験合格ではない)
- 状態の正本: `spec-state.json` の `lifecycle` と `review_runs`
- 実装の現在地: 単一D1、`asps/programs/conversions`、案件一覧、Remote MCP/WebMCPの3ツールによるPoC。Better Auth、Workspace、TrackingLink、イベント基盤、二D1、Resolver/Queue、Analytics画面は未実装

## U1 本質的目的 (essential_purpose)

発信者が、一つの信頼できる商品・サービス情報を起点に、複数のブログやSNSへ「誰が・誰に・何を・なぜ伝えるか」が一貫した高品質コンテンツを効率的に生成・公開・改善できる状態をつくり、読者の意思決定品質と発信者の継続的な収益性を同時に高める。

## U2 背景 (background)

アフィリエイトURL・ASP管理画面・商品情報・比較表・記事原稿・SNS投稿文・画像・ペルソナ・投稿スケジュール・クリック数・成果報酬・更新履歴が別々の場所で管理され、同じ商品名・価格・特徴を何度も入力し、修正時にも複数の投稿を個別に直す必要が生じている。

## U3 ゴール (goals)

| ID | ゴール |
|---|---|
| G1 | 一つのアフィリエイトURLを起点に、正しい商品情報・比較候補・根拠・書き手・読者・媒体・広告表示を統合し、目的の異なる高品質コンテンツを安全に作成・公開・改善できる |
| G2 | どういう情報・切り口・媒体・配置がクリック率とアフィリエイト成果に有効かを計測・分析し、一元管理できる |

## U4 目標 (objectives)

| ID | 目標 | 測定基準 |
|---|---|---|
| O1 | North Star Metric: 根拠確認と人間承認を完了し、複数媒体へ展開されたコンテンツパッケージ数を継続的に増やす | 承認済み・複数媒体展開済みコンテンツパッケージ数 (生成数・投稿数は中心指標にしない) |
| O2 | クリック・成果の要因分析が可能な計測カバレッジを確保する | 成果のアトリビューション突合率 (sub_id/クリックID一致の割合) |

目標値は根拠のない数値を確定しない。各指標は `current / target / measurement_window / event_or_query / owner / decision_due` を一組で持ち、初回実装では `current=未計測` として基準値を取得する。基準値取得後に target を決定するまで、能力要件の充足と成果目標の達成を混同しない。

## U5 成功基準 (success_criteria)

- 情報源↔商品↔主張↔コンテンツパッケージ↔媒体別文章↔投稿↔クリック↔成果の経路を双方向に追跡できる
- 第30章の受け入れ条件 (URL登録・比較・ペルソナ・AI生成・ブログ・配信・アフィリエイト・追跡可能性) をすべて満たす
- 配置・切り口・ペルソナ別のCTR/CVR/EPCを比較でき、根拠のない発見を表示しない

成功基準の判定には、少なくとも tenant 越境拒否、未同意イベント、同一成果の再取込、成果状態更新、計測D1障害中の既知リンク転送、KPI定義一致、n不足時の結論抑制を含む受入証拠が必要である。

## U6 ステークホルダー (stakeholders)

- 読者: 自分に合う商品かを根拠と弱点込みで判断でき、広告であることを認識できる
- 発信者 (個人〜小規模チームのアフィリエイト運営者): 商品調査を媒体ごとに繰り返さず、複数ブログ・SNSを一元運営し、何が成果につながったかを確認できる
- チームメンバー: Researcher/Writer/Reviewer/Publisher/Analyst のロールで分業する

## U7 スコープ (scope)

- **対象 (in)**: マルチテナント, 複数ブランド・複数ブログ構築, アフィリエイトURL登録・商品情報抽出・商品データベース, 比較候補抽出, 書き手・読者ペルソナ, AI文章生成・投稿パターン生成, SNS連携・投稿カレンダー, アフィリエイトリンク管理, クリック・成果分析, 更新管理・広告法令確認, WebMCP・バックエンドMCP・API, チーム権限・承認フロー
- **対象外 (out)**: 他サイトの無断複製・規約違反スクレイピング, CAPTCHA等の回避, 架空の体験・資格, 無確認の大量自動投稿・スパム, 報酬額基準のランキング, アフィリエイトリンクの無断改変, 非公式note APIへの依存, 投稿先ポリシーを無視した自動化

## U8 制約 (constraints)

- 媒体ごとに公式APIの認証・権限・投稿形式・利用料金・審査条件が異なる (X APIは従量課金)
- noteは一般公開の公式投稿APIがなく、出力・手動連携のみで設計する
- ASPのリンク・広告コード改変禁止 (original_urlを無改変で保持)
- 景品表示法ステルスマーケティング規制への適合 (広告表記必須)
- 外部公開・予約投稿等の重要操作は人間の承認を必須とする

## U9 具体的にやりたいこと (concrete_intents)

| ID | やりたいこと | 資するゴール |
|---|---|---|
| I1 | アフィリエイトURL登録から商品識別・情報収集・比較候補抽出・根拠付きデータ作成までを一元化する | G1 |
| I2 | 書き手・読者ペルソナと媒体ルールを入力に、ブログ・X・Instagram・Threads・note等の媒体別コンテンツを生成し人間承認を経て公開する | G1 |
| I3 | どういう情報がクリック率が高いか・アフィリエイトに有効かを管理できる分析・解析の仕組みを整える (クリック計測・成果突合・ディメンション分析・Insight Engine) | G2 |
| I4 | 分析結果を次のコンテンツ生成 (Brief提案・配信戦略) へ反映する。ただし商品評価・ランキングへは自動反映しない | G2, G1 |

## 意思決定支援 (decisions)

| ID | 論点 | 状態 | 選択肢 (費用・適合・注意点) | AI推奨 | ユーザー決定 | 資するゴール |
|---|---|---|---|---|---|---|
| decision-auth-method | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | confirmed | opt-better-auth:Better Auth + Google OAuth (自己ホスト) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': 'ライブラリ無料。運用コストは自前ホスティング (既存 Workers 内) のみで追加費用なし'} / free=OSS のため利用数制限なし / fit=マルチテナントSaaSの一般ユーザー認証に適合。Drizzle/D1 アダプタで現行スタックと同居し、§25 のロール権限と組み合わせやすい / pros=無料・OSS, D1/Drizzle アダプタで現行構成に統合, Google ログインに加えメール/パスワード・パスキーを後付け可能, ベンダーロックインなし / cons=認証基盤の運用 (アップデート・監視) が自前, 組織管理UIは自作が必要 / risks=OSS のメンテナンス状況に依存するためバージョン追従を保守運用に組み込む / lock-in=なし (自己ホスト・標準プロトコル) / ops=中 (ライブラリ更新とセッションストア運用) / evidence=https://www.better-auth.com/docs/introduction<br>opt-idaas:IDaaS (Clerk / Auth0) / cost={'category': 'low-cost', 'amount': 3500, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '無料枠超過後は月間アクティブユーザー数課金。ユーザー増で費用が逓増'} / free=Clerk: 10,000 MAU まで無料 (2026-08 時点) / fit=認証機能自体は充足するが、Workspace 単位のテナント分離は自前実装が残る / pros=運用負荷が最小, 組織管理・MFA が既製 / cons=ユーザー数課金, 外部サービス依存 / risks=ベンダーロックイン, 料金体系変更の影響を受ける / lock-in=高 (ユーザーデータ移行が必要) / ops=低 / evidence=https://clerk.com/pricing<br>opt-cf-access:Cloudflare Access (Zero Trust) / cost={'category': 'free', 'amount': 0, 'currency': 'JPY', 'billing_period': 'monthly', 'tco': '50ユーザーまで無料。超過はシート課金'} / free=50 ユーザーまで無料 / fit=社内ツールのアクセス制御向き。一般公開SaaSの会員登録・セルフサインアップには不適合 / pros=インフラと同一ベンダーで設定が容易 / cons=セルフサインアップに不向き, テナント概念がない / risks=利用者数拡大時にシート課金が急増する / lock-in=中 (Cloudflare 依存) / ops=低 / evidence=https://developers.cloudflare.com/cloudflare-one/policies/access/ | opt-better-auth — 費用ゼロ・ロックインなしで現行の D1/Drizzle/Workers 構成に統合でき、一般公開SaaSのセルフサインアップと §25 ロール権限の要件を満たす (注意: ライブラリ更新の追従を保守運用 (maintenance-ops) に組み込むこと, 組織 (Workspace) 管理UIは自作となる; confidence=high; checked=2026-08-16T00:00:00Z) | opt-better-auth @ 2026-08-16T00:00:00Z | G1 |
| decision-editorial-commercial-split | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | confirmed | opt-single-db-schema-split:D1 は 1 本のまま、テーブル名前空間と型で分ける / pros=いまの構成から何も変えない, 集計クエリが 1 本で書ける, マイグレーションの管理先が 1 つ / cons=§19.4 の禁止（報酬を推薦スコアの入力にしない）をコードの外から確かめられない, 禁止依存 FD-2 の担保が型だけになり型を外せば通る / risks=境界を越える SQL が 1 本混ざっても画面からは何も変わって見えない（残課題 51 と同じ形） / lock-in=なし<br>opt-two-databases:D1 を 2 本に分け、バインディングを分ける（DB_EDITORIAL / DB_COMMERCIAL） / pros=§19.4 と FD-2 をコードではなく構成で担保できる, 越境が git の差分に出る（wrangler.jsonc の変更として見える）, Commercial 側だけを別の保管期間・別の権限で扱える / cons=DB をまたぐ JOIN が書けない（突合はアプリ側で ID を突き合わせる）, マイグレーションが 2 系統になる, 既存テーブルの引っ越しが 1 回必要 / risks=アプリ側の突合を書き間違えると集計がずれる（SQL の JOIN より落ちにくいので気づきにくい）, 2 本の間で整合が必要な操作はトランザクションで守れない / lock-in=なし（どちらも D1） | opt-two-databases — 禁止（報酬額をランキングの入力にしない）は仕様の中でいちばん強い制約で、二層のどの経路からも迂回できない位置で担保すると 04 §2-4 が書いている。1 本のままだとその位置がコードの中にしかない。2 本にすると越えるには設定を書き換えるしかなくなり、越えたことが差分に残る (注意: 既存テーブルの引っ越しが 1 回必要でその回だけは本番データを触る, DB をまたぐ集計はアプリ側の突合になるため突合のテストを先に書く, 分けたあとも Commercial の値を関数の引数として渡せば混ざる——バインディングの分離は「うっかり」を防ぐが「意図」は防がない; confidence=high) | opt-two-databases @ 2026-08-19T00:00:00Z (利用者本人。推奨への一任) | G1, G2 |
| decision-redirect-measurement-async | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | confirmed | opt-waituntil-direct:ctx.waitUntil で D1 へ直接書く / pros=部品が増えない, 書いた瞬間に集計へ反映される, 実装がいちばん短い / cons=D1 が落ちている間のクリックは記録が消える（退避先が無い） / risks=障害の時間帯だけ成果が欠測し、あとから埋められない / lock-in=なし<br>opt-queues:Cloudflare Queues へ積み、consumer が D1 へ書く / pros=再試行が仕組みとして付く, D1 の一時的な障害を吸収できる, 書き込みをまとめられる / cons=有料プランが前提, 部品が 1 つ増え詰まったときの見張りが要る / risks=契約が無料プランのままだとそもそも動かない（実装してから気づくと痛い） / lock-in=中（Cloudflare 固有。他所へ移すと書き直し）<br>opt-waituntil-fallback-cron:ctx.waitUntil で D1 へ書き、失敗ぶんだけ R2 へ退避して Cron で回収する / pros=無料枠のまま欠測を減らせる, 既に Cron Triggers を使っている（画面の写しの掃除、日本時間 2:00）ので置き場が既にある, 契約状態に依存しない / cons=回収までに時差がある（最大 1 日）, 退避と回収のコードを自分で持つ / risks=回収の失敗が静かに起きうる——回収の結果を記録し溜まったら気づける形にしないと退避先が墓場になる / lock-in=低（Cron と R2 は置き換えやすい） | opt-waituntil-fallback-cron — 02 §7 と既存の qa は「転送は必達、計測はベストエフォート」と書いている。3 案とも転送は止めないので、差は欠測をどこまで減らすかとその値段である。Queues がいちばん堅いが有料プランが前提で、いまその契約が有効かは確かめられない。退避＋Cron は無料枠のままで欠測をほぼ同じだけ減らせ、Cron の置き場は既にある (注意: 回収が静かに失敗すると退避先が墓場になる——回収した件数と残件数を記録し残件が増え続けたら赤くする, 有料プランが既に有効なら Queues のほうが素直だが契約状態は本人しか確かめられない, 最大 1 日の時差があるため当日の速報値は「まだ確定していない」と画面に出す（03 §8）; confidence=medium) | opt-waituntil-fallback-cron @ 2026-08-19T00:00:00Z (利用者本人。推奨への一任) | G2, G1 |
| decision-llm-provider | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | confirmed | opt-single-anthropic:Anthropic 1 社に固定する / pros=実装が最も短い, プロンプトを 1 社の癖に合わせて詰められる, 鍵の管理先が 1 つ / cons=値上げ・提供停止・品質変化のときに逃げ場が無い, 用途ごとに安いモデルを選べない / risks=1 社の障害が生成機能そのものの停止になる / lock-in=高（プロンプトが 1 社の形に寄る）<br>opt-catalog-multi:単価表（config/llm-provider-catalog.json）を正本に、複数社を差し替え可能にする（現行） / pros=既に実装されている（wrangler の LLM_PROVIDER_CATALOG と同期の検査つき）, 単価が vars にあるので値上げに気づける（secret にすると読めなくなる）, 1 社が落ちても他社へ回せる / cons=鍵が増える, プロバイダごとの出力差を吸収する層が要る / risks=どの社をどの用途に当てるかが決まっていないと、いちばん高い社が既定になりがち / lock-in=低<br>opt-workers-ai:Workers AI（Cloudflare のモデル）を主にする / pros=鍵を持たなくてよい, 同じプラットフォーム内で完結し遅延が小さい, 無料枠がある / cons=長文・根拠つきの生成では選べるモデルが限られる, 有料プランが前提 / risks=品質が足りずに結局よそへ出すことになり両方の実装を抱える / lock-in=高（Cloudflare 固有） | opt-catalog-multi — 既に実装があり、単価表を vars に置いて値上げに気づけるようにしてある。07 §0 の GC-5（レビュー系は執筆系と分離し、自作自演の検証にしない）は、書き手と検査役に別のモデルを当てられるほうが素直に満たせる (注意: 鍵が社数ぶん増える——登録は本人がブラウザで行いこちらでは受け取らない（11 §5）, どの用途にどの社を当てるかが未定のままだといちばん高い社が既定になる, 単価表の pricedOn は 2026-08-18 のままで実費の見積りは llm-cost-simulator で別途取る; confidence=medium) | opt-catalog-multi @ 2026-08-19T00:00:00Z (利用者本人。推奨への一任) | G1 |
| decision-ui-theme-implementation | 配色と明暗の 2 軸を、どの技術で実装するか | confirmed | opt-css-light-dark:CSS の light-dark() と data 属性（配色は属性、明暗は color-scheme） / pros=配色を 1 つ増やしても設定値は 1 つしか増えない, 部品ごとに明暗の分岐を書かなくてよい（09 §5）, 依存を増やさない / cons=light-dark() を解さない古いブラウザでは既定色になる / risks=色の定義が CSS に散ると、コントラストの下限を測る場所が分かりにくくなる / lock-in=なし（標準）<br>opt-tailwind-dark-class:Tailwind の dark: クラスと、配色ごとのクラス群 / pros=既に Tailwind を使っている, 書いた場所で色が読める / cons=配色を 1 つ増やすたびに全部品のクラスが増える, 部品の中に明暗の分岐が書かれる（09 §5 が禁じている） / risks=増やすのが面倒になり配色を増やさない方向へ運用が寄る / lock-in=中（Tailwind の書き方に寄る） | opt-css-light-dark — 09 §2 は「掛け合わせを設定として持たない」と書いており、light-dark() は掛け合わせを CSS 側で解く仕組みそのものである。Tailwind のクラス方式は禁じられている掛け合わせがクラス名として現れる。Tailwind は配置と余白に使い、色だけこの方式にすれば両方使える (注意: 色の定義を 1 か所へ集めないとコントラストの下限（09 §4）を測る対象が散る, cookie と URL から来る名前は必ず解析関数を通す（09 §2-2）——素通しにすると壊れて見えない画面になる, light-dark() を解さない環境では既定色になるのでそれが読める色であることを確かめる; confidence=high) | opt-css-light-dark @ 2026-08-19T00:00:00Z (利用者本人。推奨への一任) | G1 |
| decision-test-ci-tooling | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | confirmed | opt-keep-current:現行のまま（Vitest / Stryker / fast-check / axe-core / GitHub Actions） / pros=既に多数のテストファイルが動いている, 3 段の置き場が既にあり重いものを移せる（11 §8-2）, 道具を増やさないぶん守るものが増えない / cons=見た目の回帰（ビジュアルリグレッション）を測る道具が無い / risks=見た目の崩れは画面のテストでは捕まらないまま残る / lock-in=低<br>opt-add-playwright:Playwright を足し、3 段で見た目の回帰と実ブラウザの通しを測る / pros=配色を増やしたときに全組み合わせのコントラストを実描画で測れる, 3 段（手動・止めない）に置けるので速い門は重くならない / cons=画像の基準を持つことになり基準の更新が新しい仕事として増える, 3 段は誰かが打たないと走らない（11 §8-2）——打つ場面を書かないと存在しない検査になる / risks=基準画像の更新が面倒になり落ちたら基準を上書きする運用に流れる（それは閾値を下げるのと同じ） / lock-in=低 | opt-keep-current — 結論は現行のままだが、これは「Playwright は不要」という判断ではない。10 の 7 種のうち見た目の回帰だけは現行で測れておらず、その穴は実在する。足さない理由は必要性ではなく走らせ方にある (注意: 保留のあいだ見た目の回帰は測れず、穴は ah-h57 の検査として固定してある, 見直しの引き金は 2 つ——3 段を打つ場面が決まったとき / 配色を 1 つ増やす作業が決まったとき, 足すと決めたときは同じ回に「いつ打つか」を文書へ書く——場面を書かずに足すと名前だけの検査になる; confidence=medium) | opt-keep-current @ 2026-08-20T00:00:00Z (利用者本人が 2 択から直接選択。逐語「現行のままで確定」。AI 推奨の昇格でも代理決定でもない) | G1, G2 |
| decision-screen-priority | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | confirmed | opt-performance-first:記事の成績比較を先頭に置き、回復すべき業務状態はその下の常設帯に置く / pros=利用者本人の逐語回答と一致, 毎日見る情報へ操作 0 回で到達 / cons=回復作業が必要な日は要対応が 2 番目になる / risks=要対応帯が弱いと放置される<br>opt-recovery-first:回復すべき業務状態を先頭に置く / pros=要対応が確実に目に入る / cons=要対応 0 件の日も空の枠が先頭を占め、利用者本人の回答とも食い違う / risks=先頭領域が読み飛ばされる | opt-performance-first — 毎日見る成績比較を先頭にし、要対応は未対応時だけ色と件数が出る帯として直下に置く (注意: UIUX-REQ-001 の本文をこの決定に合わせる, 帯の高さは保つ, 比較軸は別課題; confidence=high) | opt-performance-first @ 2026-08-22T00:00:00Z (利用者本人) | G1, G2 |

- **7 件すべて `status: confirmed`**（分母 = 正本 `spec-state.json` の `decisions[]` 全件）。うち 6 件は `decision-auth-method` に遅れて 2026-08-19〜22 に確定した。
- **`decision-auth-method` の行だけ書式が違う**のは、その 1 行が生成器の出力そのままだからである。`cost={'category': 'free', 'amount': 0, ...}` は **Python の dict を文字列にした形**が残ったもので、真似すべき書式ではない。残り 6 行は手で書いた。**書式を揃えるために 1 行目の dict 形へ寄せないこと**（読めない形が 7 行に増えるだけになる）。
- **`decision-test-ci-tooling` の確定について**: `system-spec/completeness-report.json` の gaps[3] は本件を「利用者確定待ち」としているが、これは **2026-08-16 時点の評価**である。正本ではすでに確定済み。C05 を再評価すれば消える。
