# AIファースト・WebMCP対応アフィリエイトブログ構築仕様書

## 0. 文書管理

```yaml
project_id: affiliate-ai-webmcp
document_version: 1.0
reference_date: 2026-08-16
status: proposed
primary_market: Japan
architecture_style:
  - human_first
  - ai_first
  - agent_ready
  - evidence_first
  - progressive_enhancement
```

本仕様書における用語は次の強度を持つ。

- MUST：必須
- MUST NOT：禁止
- SHOULD：原則必須。外す場合は理由を記録
- MAY：任意

WebMCP は提案中の標準であり、現時点では実験的なブラウザー機能として扱う。したがって、通常の HTML、フォーム、JavaScript、HTTP API を主系統とし、WebMCP を追加インターフェースとして実装する。

## 1. プロダクトビジョン

### 1.1 最上位目的

ユーザーが大量の商品・サービス情報を読むことなく、次の状態へ到達できるサイトを作る。

> 自分の条件に合う選択肢を、根拠、弱点、代替案、最新性を確認したうえで決められる。

### 1.2 AIファーストの定義

AIファーストとは、単にチャット欄を設置することではない。次を満たす状態をいう。

1. コンテンツが構造化されている
2. 主張と根拠が機械的に関連付けられている
3. 人間とAIが同じ正規データを参照する
4. AI回答が根拠を提示できる
5. AIエージェントがWebMCP経由で安全に機能を利用できる
6. AIやWebMCPが使えなくても通常サイトが完全に動作する
7. 最終判断と重要操作を人間が制御できる

### 1.3 提供価値

| 対象 | 提供価値 |
| --- | --- |
| 初心者 | 質問に答えるだけで候補を絞れる |
| 比較検討者 | 同じ評価軸で商品を比較できる |
| 詳細調査者 | 実測値、写真、検証条件、出典を確認できる |
| AIエージェント利用者 | UIを推測せず構造化ツールを利用できる |
| 運営者 | 記事、比較、AI回答、WebMCPを一元管理できる |
| 広告主・販売店 | 適合性の高い利用者へ透明な導線を提供できる |

## 2. 非目標

本プロジェクトでは次を行わない。

- 他サイトの文章、画像、キャラクター、CSS の複製
- AI による大量の無検証記事生成
- アフィリエイト報酬額を基準とするランキング
- エージェントによる無断の商品購入
- エージェントによる無断の外部サイト遷移
- AI回答だけで完結し、根拠ページを隠す設計
- WebMCP対応ブラウザーでしか使えない機能
- 架空の体験、測定、専門家、利用者レビューの生成
- 更新日だけを変更して鮮度を装う運用
- ユーザーの同意なしの機微情報によるパーソナライズ

## 3. ユーザーと主要ジョブ

### 3.1 初心者

```text
「専門用語を理解しなくても、自分に合う商品を決めたい」
```

必要機能：

- 会話型条件整理
- 用途別おすすめ
- 初心者向け要約
- 向いている人・向いていない人
- 専門用語の説明

### 3.2 比較検討者

```text
「候補を同じ条件で比較し、決定的な違いを知りたい」
```

必要機能：

- 比較表
- 条件フィルター
- 差分だけの表示
- 評価理由
- 弱点・代替候補

### 3.3 根拠重視者

```text
「その評価が本当に妥当なのか確認したい」
```

必要機能：

- 検証方法
- 実測値
- 検証日
- 写真
- 原典
- 更新履歴
- 訂正履歴

### 3.4 ブラウザーエージェント利用者

```text
「自然言語で検索・比較し、結果を画面上でも確認したい」
```

必要機能：

- WebMCP検索
- WebMCP比較
- 根拠取得
- ランキング説明
- 表示状態の同期
- 明示的な確認

### 3.5 編集者

```text
「一つのデータ入力から記事、比較表、AI回答を安全に更新したい」
```

必要機能：

- 構造化CMS
- 主張・根拠管理
- 商品データ
- 検証データ
- AI下書き支援
- 人間による承認
- 更新期限
- 訂正フロー

## 4. 設計原則

### 4.1 Human-first / Agent-ready

人間向けUIを主とし、エージェント向けツールを同じ業務ロジックへ接続する。

### 4.2 Single Source of Truth

商品名、スペック、評価、検証結果、記事内の主張を重複入力しない。

### 4.3 Evidence-first

重要な事実には根拠を関連付ける。

### 4.4 Explainable Recommendation

おすすめ理由、適合条件、不適合条件、弱点を必ず説明する。

### 4.5 Progressive Enhancement

次の順で成立させる。

```text
HTML
→ CSS
→ JavaScript
→ 埋め込みAI
→ WebMCP
→ 任意の外部MCP
```

上位層が失敗しても、下位層で主要タスクを完了できなければならない。

### 4.6 Human Control

状態変更、個人情報送信、購読、外部遷移は、ユーザーが認識できる画面状態を経由する。

### 4.7 Commercial Independence

アフィリエイト報酬、広告契約、在庫は、評価点の入力に使用しない。

## 5. 全体アーキテクチャ

```text
┌─────────────────────────────────────┐
│ 利用者                               │
│ 人間 / ブラウザーエージェント / 外部AI │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│ プレゼンテーション層                 │
│ SSR/SSG Web UI                      │
│ 埋め込みAIアシスタント               │
│ WebMCP Adapter                      │
│ 任意のBackend MCP Server            │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│ ドメインサービス層                   │
│ Content Service                     │
│ Product Service                     │
│ Comparison Service                  │
│ Recommendation Service              │
│ Evidence Service                    │
│ Offer Service                       │
│ Disclosure Service                  │
│ Search Service                      │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│ データ層                             │
│ CMS / Relational DB                 │
│ Search Index / Vector Index         │
│ Object Storage                      │
│ Analytics / Audit Log               │
└─────────────────────────────────────┘
```

WebMCP はブラウザー上の既存 UI とクライアントロジックをエージェントへ公開するフロントエンド技術であり、バックエンド MCP の代替ではない。外部 AI がサイトを開いていない状態でもデータへアクセスする必要がある場合だけ、別途 MCP サーバーを提供する。

## 6. 推奨技術構成

特定ベンダーへ固定せず、次の能力を満たす構成とする。

### フロントエンド

- TypeScript
- SSR または SSG 対応フレームワーク
- セマンティックHTML
- コンポーネント単位の WebMCP Adapter
- JavaScript 無効時でも読める本文
- ルート単位のコード分割

### バックエンド

- 型付き HTTP API
- リレーショナルデータベース
- 全文検索
- ベクトル検索
- キャッシュ
- 非同期ジョブ
- 監査ログ
- モデルプロバイダー抽象化

### CMS

ブロック型自由入力だけに依存せず、次の構造フィールドを持つ。

- 記事
- 商品
- 主張
- 根拠
- 検証
- 評価
- 販売店
- 広告表記
- 会話ブロック
- FAQ
- 更新履歴

## 7. 情報アーキテクチャ

```text
/
├─ /categories/{category}
├─ /best/{topic}
├─ /reviews/{product}
├─ /compare/{comparison}
├─ /guides/{topic}
├─ /tools/{tool}
├─ /search
├─ /shortlist
├─ /authors/{author}
├─ /experts/{expert}
├─ /methodology
├─ /editorial-policy
├─ /advertising-policy
├─ /ai-policy
├─ /corrections
├─ /privacy
├─ /terms
└─ /contact
```

### トップページ

1. サイトの価値提案
2. 自然言語検索
3. 主要カテゴリー
4. 初心者向け導線
5. 人気の比較
6. 最新の検証
7. 診断・ツール
8. 方法論
9. 著者・専門家
10. 広告方針

### カテゴリーページ

1. カテゴリーの一文説明
2. 条件フィルター
3. 最初に読む記事
4. ランキング
5. 個別レビュー
6. 比較記事
7. 初心者ガイド
8. FAQ
9. 更新情報

## 8. 記事共通構成

```text
パンくず
広告・アフィリエイト表記
タイトル
一文の結論
公開日・更新日・検証日
著者・編集者・監修者
対象読者
向いている人
向いていない人
主要なメリット
主要なデメリット
簡易比較
目次
選び方または評価方法
根拠付き本文
実測・体験・引用
会話ブロック
代替候補
FAQ
最終結論
販売店の選択肢
出典
更新履歴
訂正報告
著者情報
```

## 9. 記事タイプ

### 9.1 ランキング記事

```text
H1
広告表記
一文結論
用途別ベスト
比較表
評価基準
検証条件
ランキング
各商品カード
選外商品
FAQ
最終結論
方法論
```

### 9.2 個別レビュー

```text
H1
一文結論
総合評価
向いている人・向いていない人
メリット・デメリット
基本情報
入手方法
検証条件
外観
操作
性能実測
長期使用
競合比較
注意点
まとめ
```

### 9.3 比較記事

```text
H1
冒頭結論
Aが向く人
Bが向く人
差分表
価格差
性能差
使いやすさ
弱点
用途別結論
代替案
```

### 9.4 ハウツー記事

```text
H1
完了後の状態
必要時間
必要費用
事前準備
全手順
各ステップ成功状態
エラー対処
FAQ
次の行動
```

## 10. 文章仕様

### 10.1 基本順序

```text
結論
→ 理由
→ 根拠
→ 具体例
→ 例外
→ 読者にとっての意味
→ 次の行動
```

### 10.2 事実の分類

本文中の情報を次の種類に分ける。

| 種類 | 表示例 |
| --- | --- |
| 公式情報 | 「メーカー公称値」 |
| 実測 | 「当サイトの測定」 |
| 使用感 | 「テスターの主観」 |
| 推論 | 「以上から当サイトでは〜と判断」 |
| 外部評価 | 「利用者レビュー」 |
| 広告情報 | 「販売店提供情報」 |

事実と推論を同一文で混同しない。

### 10.3 スタイル

- 一段落一論点
- 原則1〜3文
- 見出しだけで結論が分かる
- 専門用語は初回に説明
- 数字には単位と条件を付ける
- 相対日付だけでなく具体的な日付を示す
- 「絶対」「完全」「最強」などの無根拠表現を禁止
- デメリットには影響対象と回避策を付ける
- CTA前に判断材料を提示する

## 11. 会話・吹き出し仕様

### 11.1 話者

| 種別 | 役割 |
| --- | --- |
| ReaderQuestion | 初心者の疑問、不安、反論 |
| GuideAnswer | 要約、安心、次の行動 |
| ReviewerNote | 実際に使用した人の感想 |
| ExpertCaution | 資格・専門性に基づく注意 |

### 11.2 使用ルール

- 一つの吹き出しは一つの役割に限定
- 重要な事実は本文にも記載
- 吹き出しだけに根拠を置かない
- 連続は最大2個
- 一つ40〜120文字程度
- 架空の専門家を作らない
- 話者名を文字で表示
- 色だけで役割を区別しない
- モバイルで横幅を圧迫しない

### 11.3 基本パターン

```text
本文：事実
ReaderQuestion：読者の疑問
本文：根拠と説明
GuideAnswer：一文要約
注意枠：例外
```

## 12. 正規データモデル

### Article

```yaml
id: string
slug: string
type: ranking | review | comparison | guide | tool
title: string
summary: string
status: draft | review | published | archived
author_ids: []
editor_ids: []
expert_ids: []
published_at: datetime
updated_at: datetime
tested_at: datetime
target_audience: []
suitable_for: []
not_suitable_for: []
claim_ids: []
product_ids: []
disclosure_id: string
conversation_block_ids: []
faq_ids: []
update_log_ids: []
```

### Product

```yaml
id: string
brand: string
name: string
model_number: string
category_id: string
release_date: date
discontinued_at: date | null
specifications: object
official_source_ids: []
image_asset_ids: []
review_article_id: string | null
```

### Claim

```yaml
id: string
article_id: string
statement: string
claim_type: official | measured | experiential | inferred | external
evidence_ids: []
confidence: 0.0
valid_from: datetime
valid_until: datetime | null
review_status: pending | verified | rejected | expired
```

### Evidence

```yaml
id: string
type: official_source | test_result | photo | video | dataset | expert_review
title: string
source_owner: string
captured_at: datetime
url_or_asset_id: string
excerpt_or_summary: string
license_or_permission: string
integrity_hash: string
```

### TestRun

```yaml
id: string
product_id: string
method_version: string
environment: object
equipment: []
tester_ids: []
started_at: datetime
completed_at: datetime
raw_results: object
normalized_scores: object
evidence_ids: []
```

### RankingModel

```yaml
id: string
category_id: string
version: string
audience: string
criteria:
  - key: string
    weight: number
    measurement: string
    pass_threshold: number
effective_from: datetime
affiliate_compensation_is_input: false
```

### Offer

```yaml
id: string
product_id: string
merchant_id: string
display_price: number | null
currency: string
availability: string
affiliate_url: string
checked_at: datetime
expires_at: datetime | null
```

### Disclosure

```yaml
id: string
relationship_type: affiliate | sponsored | supplied | loaned | purchased
advertiser_or_supplier: string | null
editorial_influence: none | limited | declared
visible_message: string
```

## 13. AI機能

### 13.1 サイト内AIアシスタント

提供機能：

- 自然言語検索
- 記事要約
- 商品比較
- 条件整理
- 用途別候補
- ランキング理由説明
- 専門用語説明
- 根拠への移動

### 13.2 AI回答契約

```yaml
answer: string
citations:
  - claim_id: string
    evidence_ids: []
    article_url: string
facts_used: []
assumptions: []
uncertainty:
  level: low | medium | high
  reason: string
not_answered: []
next_actions: []
generated_at: datetime
```

### 13.3 AI回答ルール

- 承認済みコンテンツを優先して参照
- 重要な事実に引用元を付ける
- 根拠がない場合は不明と答える
- 商品の実使用を AI 自身の体験として語らない
- 最新価格は取得日時を示す
- 医療、法律、金融など高リスク分野は個別助言を避ける
- 広告報酬を推薦スコアへ入力しない
- 推薦理由と除外理由を表示する
- ユーザー条件を推測した場合は仮定として表示する
- 会話履歴を学習利用する場合は別途明示的同意を得る

### 13.4 編集AI

AIが行ってよい作業：

- 構成案
- 要約案
- 誤字確認
- 比較表の下書き
- 欠落項目検出
- 更新候補検出
- 出典との不一致候補検出

AIが単独で確定してはならないもの：

- 実体験
- 測定結果
- 商品順位
- 専門家コメント
- 法的判断
- 提供品・広告関係
- 公開
- 訂正の最終判断

## 14. WebMCP設計

### 14.1 基本方針

- WebMCP は機能フラグ配下に置く
- `document.modelContext` を使用する
- 非対応環境では通常UIへフォールバックする
- ページごとの有効ツール数は原則6個以下
- 一ツール一機能
- 類似目的のツールを重複させない
- ページ状態に応じて登録・解除する
- ツール実行後は画面状態も更新する
- エラーは修正可能な説明を返す
- 読み取り専用から導入する

現在の WebMCP は、宣言型 API と命令型 API の二つを提供する。宣言型では HTML フォームに `toolname`、`tooldescription`、必要に応じて `toolparamdescription` を付け、命令型では `document.modelContext.registerTool()` を使用する。

### 14.2 ツールカタログ

| ツール | 有効ページ | 変更 | 目的 |
| --- | --- | ---: | --- |
| `search_content` | 全ページ | なし | 記事・商品・ガイドを検索して画面へ表示 |
| `summarize_current_article` | 記事 | なし | 現在の記事を指定読者向けに要約 |
| `get_current_article_evidence` | 記事 | なし | 記事の主張と根拠を返す |
| `compare_products` | 比較・ランキング | なし | 商品を指定軸で比較して画面へ表示 |
| `recommend_products` | カテゴリー・ランキング | なし | 条件に合う候補と理由を返す |
| `explain_ranking` | ランキング | なし | 評価基準、点数、順位理由を説明 |
| `prepare_merchant_options` | 商品・レビュー | なし | 販売店候補と広告表記を画面へ提示 |
| `preview_shortlist_change` | 商品・比較 | なし | 保存候補をプレビュー。確定はユーザー操作 |
| `newsletter_signup` | 購読フォーム | 手動確定 | フォームを入力し、送信はユーザーが実行 |
| `submit_correction` | 訂正フォーム | 手動確定 | 訂正内容を入力し、送信はユーザーが実行 |

### 14.3 命令型API例

```javascript
export async function registerComparisonTool({
  comparisonService,
  renderComparison,
}) {
  if (!("modelContext" in document) || !document.modelContext) {
    return () => {};
  }

  const controller = new AbortController();

  await document.modelContext.registerTool(
    {
      name: "compare_products",
      description:
        "Compares two to four products using selected criteria and displays the comparison in the current page.",
      inputSchema: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
            description: "Product identifiers to compare.",
          },
          criteria: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional criteria such as price, weight, performance, comfort, or warranty.",
          },
          use_case: {
            type: "string",
            description: "The user's intended use in natural language.",
          },
        },
        required: ["product_ids"],
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      execute: async ({ product_ids, criteria = [], use_case = "" }) => {
        const result = await comparisonService.compare({
          productIds: product_ids,
          criteria,
          useCase: use_case,
        });

        renderComparison(result);

        return {
          ok: true,
          compared_product_ids: product_ids,
          summary: result.summary,
          differences: result.differences,
          evidence_references: result.evidenceReferences,
          displayed_in_page: true,
        };
      },
    },
    { signal: controller.signal },
  );

  return () => controller.abort();
}
```

現在の WebMCP では `readOnlyHint` と `untrustedContentHint` がセキュリティ判断の補助として案内されている。ユーザー生成情報や外部由来情報を返す場合は、信頼できない内容として扱う。

### 14.4 宣言型フォーム例

状態変更を伴う訂正報告では `toolautosubmit` を使用しない。

```html
<form
  toolname="submit_correction"
  tooldescription="Prepares a correction report for the current article. The user reviews and manually submits the visible form.">
  <input type="hidden" name="article_id" value="ARTICLE_ID">

  <label for="correction-section">該当箇所</label>
  <input
    id="correction-section"
    name="section"
    type="text"
    required
    toolparamdescription="The heading or passage that may contain an error."
  >

  <label for="correction-detail">訂正内容</label>
  <textarea
    id="correction-detail"
    name="detail"
    required
    toolparamdescription="A factual description of the possible error and suggested correction."
  ></textarea>

  <label for="correction-source">根拠資料</label>
  <input
    id="correction-source"
    name="source"
    type="url"
    toolparamdescription="Optional supporting source URL."
  >

  <button type="submit">内容を確認して送信</button>
</form>
```

### 14.5 人間による確認

現行の WebMCP 提案は人間参加型のブラウザーワークフローを主対象としており、完全自律動作やバックエンド連携の置き換えを目的としていない。次の操作はエージェント呼び出しだけで確定させない。

- メール購読
- 問い合わせ送信
- 訂正報告
- 個人情報送信
- 外部販売店への遷移
- 支払い
- アカウント変更
- 公開・削除

処理順序：

```text
エージェントが入力
→ 可視フォームまたはプレビューを表示
→ ユーザーが確認
→ ユーザーが確定
→ 実行
→ 結果表示
→ 監査ログ
```

### 14.6 オリジンと権限

- 原則として同一オリジンのみ
- `exposedTo` は既定で使用しない
- クロスオリジン公開は明示的な許可リスト制
- `document.domain` を使用しない
- クロスオリジン iframe へ `allow="tools"` を付けるのは必要時のみ
- ユーザー情報を返すツールを第三者オリジンへ公開しない
- ページ離脱時に AbortSignal でツールを解除する

WebMCP は既定でクロスオリジンからツールを利用できず、明示的なオリジン許可と権限委譲が必要である。

## 15. バックエンドMCP

外部 AI がブラウザーを開かずに記事や商品データを利用する必要がある場合に限り、任意で MCP サーバーを提供する。

### 提供候補

```text
resources:
  article://{id}
  product://{id}
  methodology://{category}
  evidence://{id}

tools:
  search_content
  compare_products
  get_article_evidence
  explain_ranking
```

### ルール

- WebMCP と同じドメインサービスを呼び出す
- WebMCP と MCP でランキング計算を複製しない
- 読み取り専用から開始
- 認証、認可、レート制限、監査ログを実装
- MCP のプロトコルバージョンを明示
- 外部公開前に脅威モデルを作成

MCP の現行最新仕様は 2026 年 7 月 28 日版であり、外部データ、リソース、ツールを AI アプリケーションへ接続するバックエンド側の標準として利用できる。

## 16. セキュリティ

### 16.1 プロンプトインジェクション

- 記事本文、コメント、外部データを命令として扱わない
- ツール定義とコンテンツデータを分離
- UGC を `untrustedContentHint` 付きで扱う
- モデル出力を HTML として直接挿入しない
- 許可リスト方式でリンク、HTML、Markdown を処理
- AI が生成したツール引数をサーバー側で再検証
- 「記事に書かれた指示」で権限を変更しない
- モデルに秘密情報を渡さない

### 16.2 Webセキュリティ

- CSP
- CSRF対策
- XSS対策
- SQLインジェクション対策
- SSRF対策
- レート制限
- 入力長制限
- ファイル種別・容量制限
- 管理画面MFA
- 最小権限
- 秘密情報のサーバー管理
- 依存パッケージ監査
- 監査ログ改ざん防止

### 16.3 ツール実行

- 読み取りと状態変更を区別
- 冪等性キーを付与
- タイムアウト
- AbortSignal
- 構造化エラー
- 実行前後の状態確認
- 同一操作の重複実行防止
- 可能な操作には取り消しを用意

### 16.4 エラー形式

```yaml
ok: false
error:
  code: PRODUCT_NOT_FOUND
  message: "指定した商品が見つかりません。商品名またはIDを確認してください。"
  retryable: true
  suggested_action: "search_contentを使って候補を検索してください。"
```

## 17. アフィリエイト・法令・広告表示

### 17.1 広告表記

- 記事冒頭に広告・アフィリエイト関係を表示
- 提供品、貸与品、購入品を区別
- スポンサーが編集へ関与した範囲を明示
- CTA 付近でも広告関係を確認できるようにする
- AI 回答内で販売店を提示する場合も広告関係を表示
- WebMCP の販売店提示結果にも広告属性を含める

日本では、広告であるにもかかわらず広告であると判別しにくい表示がステルスマーケティング規制の対象となるため、広告関係を利用者が認識できる位置と表現で示す。

### 17.2 リンク属性

アフィリエイトリンクには原則として次を付ける。

```html
<a href="AFFILIATE_URL" rel="sponsored">
  販売店で価格を確認
</a>
```

Google も広告または有料掲載のリンクに `rel="sponsored"` を使用するよう案内している。

### 17.3 販売店表示

- 複数販売店を可能な範囲で提示
- 価格確認日時を表示
- 送料、在庫、ポイントの条件を分ける
- 価格不明時は「価格を確認」と表示
- 古い価格を現在価格として断定しない
- エージェントが自動で販売店へ遷移しない
- ユーザーが販売店を選択する

### 17.4 ランキング独立性

```yaml
ranking_inputs:
  allowed:
    - measured_performance
    - specification
    - usability
    - durability
    - support
    - price_value
  prohibited:
    - affiliate_commission
    - advertiser_budget
    - campaign_priority
    - sales_quota
```

## 18. SEO・AI検索・機械可読性

### 18.1 基本

- SSR または SSG
- セマンティックHTML
- 一意な title と H1
- canonical
- XMLサイトマップ
- RSS または Atom
- パンくず
- 内部リンク
- クロール可能なアンカー
- 画像代替テキスト
- 404・リダイレクト管理
- 公開・非公開状態の明示
- 更新履歴

### 18.2 構造化データ

ページ内容に応じて使用する。

- `Article` / `BlogPosting`
- `Product`
- `Review`
- `BreadcrumbList`
- `ItemList`
- `Person`
- `Organization`

構造化データは画面上に実際に表示している内容と一致させる。Google も、構造化データを可視コンテンツの正確な表現とするよう求めている。

### 18.3 AI検索

特別な「AI SEO」用マークアップを作ることを主目的にしない。Google は AI Overviews や AI Mode への掲載について、通常の SEO 基礎、クロール可能性、テキストコンテンツ、内部リンク、ページ体験、可視内容と一致する構造化データを重視し、専用の AI ファイルや特殊な schema.org マークアップを必須としていない。

### 18.4 llms.txt

`/llms.txt` は任意で生成する。

内容：

```text
サイトの目的
主要カテゴリー
方法論
重要記事
API・WebMCPの説明
広告方針
AI利用方針
問い合わせ・訂正
```

ただし、以下を守る。

- robots.txt やサイトマップの代替にしない
- SEO 順位向上を保証する機能として扱わない
- CMS から自動生成する
- 主要ページと内容を一致させる
- 更新漏れを監視する

Chrome の Lighthouse では `llms.txt` は現在任意の新興慣行として扱われ、404 でも不適用判定となる。

## 19. コンテンツ品質

Google のレビュー向けガイダンスでも、独自の使用証拠、定量測定、競合との差、メリット・デメリット、用途別適合性、複数販売店などが推奨されている。

必須項目：

- 誰が作成したか
- どのように調査・検証したか
- なぜこの記事を作ったか
- 使用期間
- 比較対象
- 検証条件
- 実測値
- メリット
- デメリット
- 適合対象
- 非適合対象
- 代替候補
- 出典
- 更新日
- 訂正方法

AI を大きく利用した記事では、AI をどの工程で使ったか、何を人間が確認したか、なぜ AI を使ったかを AI ポリシーまたは記事内で説明する。Google も、制作方法が読者にとって重要な場合、AI や自動化の利用方法を説明することが有用としている。

## 20. アクセシビリティ・表示品質

目標は WCAG 2.2 AA とする。WCAG 2.2 は W3C 勧告であり、テスト可能な達成基準を提供している。

必須要件：

- キーボードだけで操作可能
- フォーカスが見える
- フォーカスが固定要素に隠れない
- フォームに label を付ける
- エラーを文字で説明
- 色だけに意味を持たせない
- 適切な見出し階層
- 表に見出しセル
- 比較表はモバイルで利用可能
- 画像に寸法を指定
- レイアウトシフトを抑える
- AI 応答をライブリージョンで通知
- 会話話者を文字で示す
- 動画に字幕
- 自動再生を避ける
- 文字拡大で内容が欠けない

WebMCP を使わないエージェントもアクセシビリティツリーや画面位置を利用する可能性があるため、セマンティック HTML、完全なラベル、安定したレイアウトを維持する。

## 21. 編集ワークフロー

```text
企画
→ 検索意図・ユーザージョブ
→ 比較対象決定
→ 評価方法決定
→ 商品入手
→ 検証
→ 証拠登録
→ 構成
→ AI補助下書き
→ 人間執筆・確認
→ 編集
→ ファクトチェック
→ 広告・法令確認
→ アクセシビリティ確認
→ WebMCP確認
→ 公開
→ インデックス更新
→ AI検索インデックス更新
→ 監視
→ 再検証・更新
```

### 公開ゲート

次のいずれかが欠ける場合は公開しない。

- 著者
- 広告表記
- 根拠
- 更新責任者
- CTA の販売店情報
- 必須画像権利
- 構造化データ検証
- モバイル確認
- リンク確認
- AI 回答評価
- WebMCP スキーマ評価

## 22. 更新・訂正

### 更新トリガー

- 新商品
- 販売終了
- 価格変動
- 仕様変更
- サービス規約変更
- 法令変更
- 検証方法変更
- 誤り報告
- リンク切れ
- ランキング候補変更
- AI 回答の誤答
- WebMCP の仕様変更

### 更新履歴

```yaml
id: string
article_id: string
changed_at: datetime
changed_by: string
change_type: factual | price | ranking | editorial | correction
summary: string
affected_claim_ids: []
reviewer_id: string
```

訂正は元の誤りを隠さず、重要な誤りでは訂正内容と日時を表示する。

## 23. 分析・計測

### 人間向け指標

- 検索成功率
- 検索結果ゼロ率
- 比較開始率
- 比較完了率
- 根拠表示率
- デメリット閲覧率
- 販売店選択率
- 訂正報告率
- 再訪率
- アクセシビリティエラー

### AI指標

- 引用付き回答率
- 根拠適合率
- 未根拠主張率
- 不明時の適切な拒否率
- 推薦理由の完全性
- 条件反映率
- 回答遅延
- モデル障害時フォールバック率

### WebMCP指標

- ツール発見率
- 正しいツール選択率
- 引数妥当率
- タスク完了率
- 再試行率
- ツール別エラー率
- キャンセル率
- 未承認状態変更件数
- UI 同期失敗件数
- 非対応環境のフォールバック成功率

### 商業指標

- 販売店クリック率
- 販売店別クリック
- 比較後クリック
- 記事タイプ別成果
- 収益

商業指標は記事評価やランキングスコアへ自動的に還流させない。

## 24. AI・WebMCP評価

### 評価セット

最低 50 件の代表プロンプトを作成する。

分類：

- 単純検索
- 条件付き検索
- 2商品比較
- 4商品比較
- 予算制約
- 除外条件
- 曖昧な質問
- 存在しない商品
- 古い情報
- 矛盾条件
- 根拠要求
- ランキング理由
- プロンプトインジェクション
- 外部遷移要求
- 状態変更要求
- キャンセル

### ローンチ基準

```yaml
webmcp_eval:
  correct_tool_selection: ">= 95%"
  successful_read_only_completion: ">= 95%"
  invalid_argument_recovery: ">= 90%"
  unauthorized_state_changes: 0
  silent_affiliate_navigation: 0
  cross_origin_data_leaks: 0
  ui_state_sync: "100% in release test set"

ai_eval:
  citation_presence_for_factual_answers: "100%"
  citation_support_rate: ">= 98%"
  critical_hallucinations: 0
  fabricated_firsthand_experience: 0
  commission_influenced_ranking: 0
  appropriate_unknown_response: ">= 95%"
```

WebMCP の評価では、ツール単体テストと自然言語によるエンドツーエンド評価の両方を行う。公式ガイダンスも、ベースラインと理想結果を定義し、ツール単体およびエージェント経由の評価を行う方式を案内している。

## 25. テスト

### 自動テスト

- ドメインロジック単体テスト
- API契約テスト
- ランキング再現性
- 重み合計
- WebMCP入力スキーマ
- ツール登録・解除
- エラー形式
- 構造化データ
- リンク切れ
- アクセシビリティ
- セキュリティ
- AI評価セット
- コンテンツ鮮度

### 手動テスト

- スマートフォン
- キーボード
- スクリーンリーダー
- JavaScript無効
- AI無効
- WebMCP非対応ブラウザー
- 低速通信
- 広告ブロッカー
- Cookie拒否
- 外部API停止
- 価格欠損
- 長い商品名
- 日本語・英語混在
- エージェントキャンセル

### WebMCP監査

- 登録ツール一覧
- 名前と説明
- JSON Schema妥当性
- 必須フォームフィールドの name
- `toolparamdescription`
- ツール重複
- 状態別登録
- クロスオリジン露出
- エラー応答
- UI更新

Chrome の Lighthouse には、登録済み WebMCP ツール、スキーマ妥当性、エージェント向けアクセシビリティ、レイアウト安定性などの監査項目が用意されている。

## 26. 実装フェーズ

### Phase 0：ガバナンス

成果物：

- 用語集
- データモデル
- 編集方針
- 広告方針
- AI方針
- 評価方法

### Phase 1：Human-first MVP

成果物：

- トップ
- カテゴリー
- 記事
- 比較表
- 検索
- 著者
- 方法論
- 広告表記
- SEO
- アクセシビリティ

### Phase 2：比較データ基盤

成果物：

- 商品DB
- 主張・根拠DB
- 検証DB
- 比較エンジン
- ランキングモデル
- 販売店データ

### Phase 3：AIアシスタント

成果物：

- RAG
- 引用
- 自然言語検索
- 比較
- 推薦説明
- 評価セット
- モデルフォールバック

### Phase 4：WebMCP Read-only

成果物：

- 検索
- 要約
- 根拠取得
- 比較
- ランキング説明
- 販売店候補プレビュー
- Lighthouse監査
- エージェント評価

### Phase 5：限定状態変更

成果物：

- ショートリストプレビュー
- 購読フォーム入力
- 訂正フォーム入力
- 人間確認
- 監査ログ
- 取り消し

### Phase 6：任意のBackend MCP

外部エージェント需要が確認できた場合のみ実施する。

## 27. 依存関係

```text
用語・価値提案
  ↓
正規データモデル
  ├─→ CMS
  ├─→ Web UI
  ├─→ 構造化データ
  ├─→ 検索
  └─→ AIインデックス

商品・主張・根拠
  ↓
比較エンジン
  ├─→ ランキング記事
  ├─→ AI比較
  ├─→ WebMCP比較
  └─→ Backend MCP比較

認証・同意・監査
  ↓
状態変更系

WebMCP評価データ
  ↓
AI・WebMCP改善
```

禁止する依存：

- UI からランキング式を直接実装
- WebMCP 内に独自のランキング式を実装
- AI プロンプト内だけに商品評価ルールを保持
- アフィリエイト成果から評価点を更新
- ベクトル DB を正規データ源として扱う

## 28. 完了条件

### 機能

- 通常 UI だけで主要タスクを完了できる
- AI だけでなく記事本文から同じ根拠を確認できる
- WebMCP 非対応環境で機能低下が限定的
- 商品比較結果が UI、AI、WebMCP で一致する
- 広告関係が記事、AI、WebMCP で一貫する

### 品質

- 必須要件追跡率 100%
- 未解決 P0・P1 ゼロ
- 依存循環ゼロ
- 正規定義重複ゼロ
- 目的重複ツールゼロ
- 重大なセキュリティ問題ゼロ
- 重大なアクセシビリティ問題ゼロ
- 検証セット上の重大な AI 誤情報ゼロ

### 運用

- 更新責任者が存在
- 訂正受付が存在
- 記事ごとの次回確認日が存在
- AI・WebMCP 評価を再実行できる
- モデル、評価基準、記事変更を追跡できる
- WebMCP 仕様変更時に Adapter だけを交換できる
