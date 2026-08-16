# ユビキタス言語辞書

**1 つの概念には 1 つの言葉。** ここに載っている言葉を、仕様書・コード・DB のテーブル名・
タスク名・画面の文言で同じ意味で使う。同義語を作らない。

言い換えたくなったら、この辞書を直してから全体を直す。辞書を直さずに別の言葉を使うと、
「同じものが 2 つある」状態になり、共通化が壊れる。

## 読み方

- **日本語表示**: 画面に出す言葉。利用者はこれしか見ない。
- **コード上の名前**: 型名・関数名。英語。
- **定義**: どこまでがその概念か。

---

## 1. 組織と権限（Identity & Tenancy）

| 日本語表示 | コード上の名前 | 定義 | 実装 |
| --- | --- | --- | --- |
| ワークスペース | `Workspace` | 契約と請求の単位。**データの境界はここ**。別ワークスペースのデータは存在しないものとして扱う | `domain/identity/workspace.ts` |
| ブランド | `Brand` | 発信主体。運営者情報・文体・免責文を持つ。1 ワークスペースに複数 | `domain/identity/brand.ts` |
| サイト | `Site` | 1 つのブログ。ブランドに属し、ブループリントと設定値でできている | `application/ports/authoring.ts` |
| メンバー | `Membership` | 人（または AI 用アカウント）とワークスペースの結びつき。役割を持つ | `domain/identity/membership.ts` |
| 役割 | `Role` | owner / admin / editor / writer / reviewer / analyst / viewer / ai_service_account ほか | `domain/identity/permissions.ts` |
| できること | `Capability` | 役割ではなく行為で権限を判定する単位（`content.publish` など） | 同上 |
| 実行者 | `ActorContext` | 「誰が、どのワークスペースで」を全ユースケースの第 1 引数として渡すもの | `domain/shared/tenancy.ts` |

> **注意**: 「アカウント」「テナント」「組織」は使わない。すべて **ワークスペース**。
> ただし `AffiliateAccount`（ASP のアカウント）は別概念なので、必ず「ASP アカウント」と書く。

## 2. 商品（Product Intelligence）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| 商品 | `Product` | 同定済みの製品そのもの。販売店をまたいで 1 つ |
| 商品の同定 | `ProductIdentity` | 型番・JAN・ASIN などで「同じ商品」と判断するための手がかり |
| 販売情報 | `MerchantOffer` | ある販売店における価格・在庫・URL。**確認日時が必ず付く** |
| 比較セット | `ComparisonSet` | 1 つの記事で比べる商品の集合 |
| 仕様 | `Product.specifications` | 商品の数値・区分。根拠は `Claim` と `Evidence` で持つ |
| 商品バリエーション | `ProductVariant` | 容量・色などの違い。同じ商品として扱う |

> 「価格」は `MerchantOffer.price`。商品そのものに価格は持たせない（店ごとに違うため）。

## 3. 主張と根拠（Evidence & Claim）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| 主張 | `Claim` | 記事に書く言い切り。「この機種は静か」など |
| 根拠 | `Evidence` | 主張を支える出典。公式仕様 / 自社検証 / 実測 / 一次情報 |
| 検証記録 | `TestRun` | 自分たちで測った結果。条件・機材・日付を含む |
| 由来 | `Provenance` | その情報をどこから、いつ取ったか。**重要な事実には必ず付ける** |
| 事実と推測の区別 | `factuality` | `fact`（根拠あり） / `inference`（推測） / `opinion`（意見）。文中でも書き分ける |

> 根拠のない主張は「推測」と明示する。**根拠がないことを黙って書かない。**

## 4. 順位（Ranking）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| 評価基準 | `RankingModel` | どの軸を、どの重みで見るか。バージョンを持つ |
| 評価軸 | `Criterion` | 「静音性」「価格性能比」など |
| 採点表 | `ScoreCard` | ある商品を、ある評価基準で採点した結果 |
| 順位 | `RankingResult` | 採点表から機械的に決まる並び。**人が手で並べ替えない** |
| 報酬は入力にしない | `affiliateCompensationIsInput: false` | 評価基準が必ず持つ宣言。型で `false` 以外を書けない |

## 5. 記事（Content Authoring）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| コンテンツパッケージ | `ContentPackage` | 1 つの記事の企画・素材・状態のまとまり |
| コンテンツ版 | `ContentVariant` | 出力先ごとの版（本文 / AI 回答用 / SNS 用 / 構造化データ） |
| サイトブループリント | `SiteBlueprint` | ブログの構成の型。**新しいブログはコードを書かず、これと設定値で作る** |
| 記事種別 | `ArticleType` | ranking / review / comparison / guide / tool |
| 記事の節 | `SectionSpec` | 見出し 1 つ分の型。共通 25 節 + 種別ごとの節 |
| 読者ペルソナ | `AudiencePersona` | 誰に向けて書くか |
| 書き手ペルソナ | `AuthorPersona` | 誰として書くか。文体と一人称を決める |
| 文体規則 | `STYLE_RULES` | 敬体 / 語彙 / 禁止表現。`domain/authoring/writing-style.ts` |
| 事実の言い回し | `FACT_TONE_RULES` | 主張の種類ごとに、断定してよい / 推測と書く の対応 |
| 会話ブロック | `ConversationBlock` | 記事内の一問一答。AI 回答用の版と同じ内容から作る |
| 品質チェック | `QualityCheck` | 公開前の自動確認 17 項目 |
| 状態 | `ContentState` | draft → review → approved → scheduled → published → archived |

> 「記事」と言うときは `ContentPackage` を指す。出力された 1 本の文章は `ContentVariant`。

## 6. 公開（Distribution）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| チャネル | `ChannelKind` | 出し先の種類（自社サイト / X / Instagram / note ほか） |
| 接続 | `ChannelConnection` | チャネルへの接続設定。**鍵そのものは持たず、鍵の置き場所の名前だけ持つ** |
| 出し方 | `PublishMode` | `direct_api` / `scheduled_api` / `manual_export` |
| 書き出し | `manual_export` | 公式 API がない先（note など）。下書きを書き出し、投稿は人が行う |
| 公開ジョブ | `Publication` | 1 回の公開の進行状況。状態遷移表で管理する |
| 公開ゲート | `evaluatePublishGate` | 公開してよいかの判定。未確認の項目は「見送り」に積み、通過扱いにしない |

> **note へ「直接公開」とは表示しない。** 公式の公開 API が存在しないため。

## 7. 収益（Affiliate & Monetization）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| ASP | `AspKind` | 成果報酬型広告の提供元 |
| ASP アカウント | `AffiliateAccount` | ASP における自分のアカウント |
| 提携プログラム | `AffiliateProgram` | 広告主ごとの条件（報酬・確定日数・禁止事項） |
| 成果リンク | `AffiliateLink` | ASP が発行した URL。**改変しない** |
| 成果 | `Conversion` | 発生した成果。取込値と手修正値を別の欄で持つ |
| 締め | `periodClosed` | 確定した月。以後の変更は据え置き、差分として通知する |

> このコンテキストは **Commercial 区分**。Ranking / Evidence / Product から参照できない。

## 8. 法令・表示（Compliance）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| 広告表示 | `Disclosure` | ステマ規制対応の表示。記事の冒頭に出す |
| 表現ルール | `PolicyRule` | 薬機法・景表法などに基づく禁止表現。根拠と代替案を必ず持つ |
| 監査ログ | `AuditLog` | 誰が何をしたかの追記専用の記録。秘密は自動で伏せる |
| 人が承認した | `wasApprovedByHuman` | AI アカウントの操作は承認とみなさない |

## 9. 数字（Analytics）

| 日本語表示 | コード上の名前 | 定義 |
| --- | --- | --- |
| 指標 | `MetricKey` | 測る対象。読者 / AI / 品質 / 収益の 4 区分 |
| 編集判断に使える | `usableForEditorialJudgement` | 収益区分の指標は `false`。記事の内容を決める材料にしない |
| 計測点 | `MetricSample` | ある期間の 1 件の観測値。割合には必ず分母が付く |

---

## 使ってはいけない言い換え

| 使わない | 使う |
| --- | --- |
| テナント / 組織 / アカウント（組織の意味で） | ワークスペース |
| 記事データ / コンテンツ / ポスト | コンテンツパッケージ、コンテンツ版 |
| テンプレート（ブログ全体の意味で） | サイトブループリント |
| 証拠 / ソース / 参照元 | 根拠（Evidence）、由来（Provenance） |
| スコア / 評価点（順位の意味で） | 採点表（ScoreCard）と順位（RankingResult）を区別する |
| アフィリリンク / 広告リンク | 成果リンク |
| ステマ表記 / PR 表記 | 広告表示（Disclosure） |

### 機械チェックの例外

上の表は `tests/ui/copy-dictionary.test.ts` が画面の文言に対して機械的に確認する。
ただし、同じ字面でも別概念を指す言い方があるため、次の複合語だけは使ってよい。
**この行が例外の正本。** 例外を増やすときは、ここに足してからコードを直す。

- 許可する複合語: ASP アカウント / AI サービスアカウント / サービスアカウント / プロアカウント / 接続先のアカウント

「アカウント」を単独で、ワークスペースの意味で使うことは引き続き禁止する。
