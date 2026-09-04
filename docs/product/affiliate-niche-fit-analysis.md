# 高単価アフィリエイト適合性調査・ブログ仮説

## 0. 文書情報

```yaml
project_id: affiliate-content-os
document_type: Research / Product Strategy / Niche Hypothesis
version: 0.1
reference_date: 2026-09-01
primary_market: Japan
requirement_status: draft
document_status: draft
implementation_status: not_started
verification_status: unverified
owner: daishiman
```

本書は、発信者本人の過去ジャーナル、X関連原稿、職歴・活動実績と、2026年9月1日時点で確認できた公式ASP・広告主情報をもとに、高単価アフィリエイトとの適合性を整理した判断資料である。

本書は `docs/spec/01-要求仕様書-v1.0.md` などの承認済み仕様を上書きしない。後半の「プロダクトへの示唆」は、今後の要求変更を検討するための入力であり、承認済み要件ではない。

---

## 1. 結論

### 1.1 全分野を含めた第一候補

最も相性が良いブログ仮説は、単なるAIツール紹介ではなく、次のテーマである。

> 非エンジニアの中小企業・個人事業主が、AIとSaaSを安全に業務へ組み込むための実践検証ブログ

本人には、プロンプト支援、AI導入、Notion、Claude Code、業務フロー改善、研修、開発、QAに関する継続的な実務経験がある。現在の発信内容や読者との連続性も高く、Make、HubSpot、Notta、freee予約、ConoHa等の継続報酬・高LTV案件を、一次情報を伴って扱いやすい。

### 1.2 AI・インターネット・ツールを除いた第一候補

非テック分野では、次のテーマが最も強い。

> 空調・衛生設備の施工管理者が、後悔しない働き方と転職先を選ぶためのブログ

本人には、約10年間の空調・衛生設備施工管理、現場監督・現場代理人、100人規模のチームマネジメント、8億円規模の案件、工程・品質・資金管理、設計者や施工関係者との調整経験がある。さらに、建設業から別業界へ移った経験があり、施工管理専門の転職、資格講座、キャリア支援と高い適合性がある。

### 1.3 一つのブログに混在させない

次の二つは、書き手が同じでも読者、検索意図、悩み、CTAが異なる。

```text
ブログA：中小企業・個人事業主のAI業務改善
ブログB：施工管理・設備職のキャリア再設計
```

したがって、一つの雑記ブログへ混在させず、別サイトまたは明確に分離されたブランドとして検証する。これは本プロダクトの `multi_brand` / `multi_site` 方針とも整合する。

---

## 2. 調査範囲と制約

### 2.1 使用した本人情報

機密性の高い本文や第三者情報は本書へ複製せず、次の事実だけを判断材料とした。

- プロンプト作成支援50件以上
- 生成結果の再現性・安定性改善
- AI導入、業務改善、研修、Notion、Claude Code支援
- バックエンド開発、API、TDD、QA経験
- 建設業で約10年間、空調・衛生設備の施工管理
- 現場代理人、100人規模の関係者調整、8億円規模案件
- 建設業から異業種への転職と、その後の独立
- 地域企業、商工会議所、勉強会、研修との接点
- 大学時代を中心とした約6年間のジャズドラム経験
- 完璧主義、学習、試行錯誤、成果物を出すことへの継続的な内省

主な参照元は、非公開Obsidianボールト内の次の資料である。

- `Xアカウントプロフィール.md`
- `自己紹介_先方共有用.md`
- `2025-09-12.md`
- `やりたいことリスト.md`
- `UBM - 2-月報（１ヶ月） - 2026-06-01〜2026-06-28.md`
- `2026-08-26_claude code 勉強会.md`
- 2026年4月2日の非公開近況共有会議事録

### 2.2 X分析の制約

公開X投稿の過去1年分は完全取得できていない。Xアカウントプロフィール、ボールト内のX関連原稿、Xから派生したnote・ジャーナルを中心に評価した。

したがって、本書の候補順位は一次評価である。X全件アーカイブを取得できた場合は、投稿テーマ、反応、質問、保存・クリック傾向を用いて再評価する。

### 2.3 報酬情報の制約

- 公開ページの報酬は、国、通貨、契約プラン、キャンペーン、承認条件で変わる。
- ASP案件は、ログイン後のプログラム詳細画面に表示される条件を正とする。
- 公開情報がない案件について、金額を推測しない。
- 「最大」「最大級」といった表示は、標準報酬と分けて記録する。
- 報酬額はブログテーマの事業性評価には使用できるが、商品のおすすめ順位には使用しない。

---

## 3. 適合性の評価方法

案件やジャンルは、報酬単価だけではなく、次の5軸で評価する。


| 軸            | 重み  | 確認する問い                           |
| ------------ | ---: | -------------------------------- |
| 本人の検証済み経験    | 30  | 実際に使った、担当した、比較した、失敗した経験があるか      |
| 独自の一次情報      | 25  | 他のサイトが簡単に模倣できない測定、工程、判断材料を出せるか   |
| 商業性          | 20  | 報酬、継続性、承認条件、広告主の安定性は妥当か          |
| 読者需要・検索意図    | 15  | 比較、申込、相談に近い具体的な悩みがあるか            |
| 継続性・コンプライアンス | 10  | 30記事以上を無理なく作れ、法令・規約・心理的負担を管理できるか |


### 3.1 編集評価と商業評価を分離する

```text
Editorial Fit
  ├─ 読者との適合性
  ├─ 実体験・検証
  ├─ 商品品質
  └─ デメリット・不適合条件

Commercial Fit
  ├─ 成果報酬
  ├─ 承認率
  ├─ 継続報酬
  ├─ 契約終了リスク
  └─ コンテンツ更新コスト
```

Commercial Fitは、調査対象や配信順を決める材料にはできる。しかし、ランキング点数やおすすめ順位へ混入させてはならない。

---

## 4. 日本で高単価になりやすいアフィリエイト領域

国内ASPの公式案内では、次の分野が高単価になりやすい。

- 就職、転職、人材紹介、フリーランス
- 金融、保険、投資
- 不動産、住宅、リフォーム
- レンタルサーバー、通信
- 学校、資格、スクール
- 法人向けSaaS、業務サービス
- 結婚相談、エステ、美容医療
- 資料請求、査定、無料相談等のリード獲得型サービス

ただし、高単価であることと、本人との適合性は別である。金融、不動産投資、美容医療等は高単価になりやすい一方、現時点では本人の検証済み経験が不足し、YMYL・法令・誤認リスクも高いため、第一候補にはしない。

参考：

- [バリューコマース：高単価になりやすい分野](https://www.valuecommerce.ne.jp/stepup/ec_hints/)
- [A8.net：転職アフィリエイト](https://www.a8.net/campus/campus-blog/6435-job-change-affiliate.html)
- [A8.net：案件選定ガイド](https://www.a8.net/campus/listing/7785.html)

---

## 5. テック・AI・インターネット系の候補20件

順位は、公開報酬額の大小ではなく、本人適合性を優先した一次評価である。


| 順位  | 候補                                                                                              | 公開されている報酬の目安                 | 適合理由                            | 初期判定   |
| ---: | ----------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------- | ------ |
| 1   | [Make](https://www.make.com/en/affiliate)                                                       | 紹介者の支払額の35%を12か月             | AIエージェント、Notion、業務自動化の実践と直接一致する | 最優先    |
| 2   | [HubSpot](https://www.hubspot.com/partners/affiliates)                                          | 30%を最大1年。公式例では1件1,000ドル超の可能性 | 中小企業の営業・顧客管理・コンテンツ運用を統合して扱える    | 最優先    |
| 3   | [Notta](https://www.notta.ai/affiliate/)                                                        | 新規有料顧客の注文額30%                | 会議録、研修、ヒアリング、プロンプト作成の実務で検証できる   | 最優先    |
| 4   | [freee予約](https://www.freee.co.jp/reservation/partner/)                                         | 月払い5,000円、年払い20,000円         | 地域企業、講師、コンサル、サロンの予約業務改善と相性が良い   | 最優先    |
| 5   | [monday.com](https://monday.com/affiliate-program)                                              | 初年度売上の最大100%                 | 案件管理、研修管理、制作工程をテンプレート化できる       | 優先     |
| 6   | [Pipedrive](https://www.pipedrive.com/en/affiliate-partnership)                                 | 初年度売上の20〜30%                 | 小規模事業者の商談・相談・フォロー工程を検証できる       | 優先     |
| 7   | [ActiveCampaign](https://www.activecampaign.com/partners/affiliate)                             | 最大12か月間30%                   | メール、顧客育成、自動化、コンテンツ導線を扱える        | 優先     |
| 8   | [ConoHa WING](https://www.conoha.jp/wing/partner/)                                              | 公式例で初年度9,552円                | 特化ブログ構築そのものを実践記事にできる            | 優先     |
| 9   | [Kinsta](https://kinsta.com/jp/affiliates/)                                                     | 最大500ドルと継続10%                | 開発、QA、性能、安全性の経験を使って比較できる        | 優先     |
| 10  | [Webflow](https://webflow.com/solutions/affiliates)                                             | 最初の12か月間50%                  | AI、ノーコード、企業サイト構築を業務成果で示せる       | 優先     |
| 11  | [GetResponse](https://www.getresponse.com/affiliate-programs)                                   | 12か月間40%。実績により最大60%          | メルマガ、セミナー集客、コンテンツ再利用を検証できる      | 候補     |
| 12  | [ElevenLabs](https://elevenlabs.io/affiliates)                                                  | 対象プランで最大12か月間22%             | ブログから音声・動画への変換や音声エージェントを扱える     | 候補     |
| 13  | [Semrush](https://www.semrush.com/lp/affiliate-program/en/)                                     | 有料契約1件100〜300ドル等             | 検索、競合、記事改善を数値で検証できる             | 候補     |
| 14  | IT転職エージェント                                                                                      | 公開例で約8,900〜14,285円           | 建設業から開発・QA・AI支援へ移った経験を使える       | 別サイト候補 |
| 15  | フリーランスエージェント                                                                                    | 公開例で約10,000〜13,187円          | 独立、案件獲得、業務委託の実経験を使える            | 別サイト候補 |
| 16  | プログラミング・AIスクール                                                                                  | 公開例で約8,817〜18,000円           | エンジニア経験と研修経験から具体的に評価できる         | 別サイト候補 |
| 17  | [freee会計・人事労務](https://www.freee.co.jp/affiliate/)                                              | ASP内で案件別に確認                  | 個人事業、請求、経理業務の実務に接続できる           | 候補     |
| 18  | [Adobe Creative Cloud](https://blog.adobe.com/jp/publish/2024/04/01/cc-adobe-affiliate-program) | 月額版は初月料金の85%                 | スライド、図解、SNS画像の制作工程を示せる          | 補完     |
| 19  | [Shopify](https://help.shopify.com/en/affiliates/about)                                         | 紹介方式・地域・契約形態で変動              | 小規模事業者の販売・発信・運営を統合できる           | 将来候補   |
| 20  | [1Password](https://1password.com/affiliate)                                                    | 初年度または初月料金の25%と登録報酬          | APIキー・認証情報管理というAI導入の安全面を扱える     | 補完     |


### 5.1 監視候補

[Notionアフィリエイト](https://www.notion.com/affiliates)は本人適合性が非常に高いが、調査時点では新規募集を停止している。現在の収益計画へ入れず、募集再開を監視する。

### 5.2 最初に検証する5案件

1. Make
2. Notta
3. HubSpotまたはPipedrive
4. freee予約
5. ConoHa WING

---

## 6. 非テック系の候補

### 6.1 候補一覧


| 優先  | 分野              | 単価傾向 | 本人適合性 | 判断                   |
| ---: | --------------- | ---- | ----- | -------------------- |
| 1   | 施工管理・建築職専門の転職   | 高い   | 非常に高い | 非テック最有力              |
| 2   | 建設・設備系資格講座      | 中〜高  | 高い    | 転職テーマの補完             |
| 3   | 異業種転職・キャリアコーチング | 高い   | 高い    | 実体験を出しやすい            |
| 4   | 住宅リフォーム・設備更新    | 高い   | 中〜高   | 業務用設備と住宅実務を混同しない     |
| 5   | 空調交換・クリーニング     | 中    | 高い    | 専門性は強いが案件単価は要確認      |
| 6   | 太陽光・蓄電池・省エネ設備   | 高い   | 中     | 追加調査と制度更新が必要         |
| 7   | 外壁塗装・屋根修理       | 高い   | 中     | 本人の専門領域外を断定しない       |
| 8   | シロアリ・水回り修理      | 中〜高  | 中     | 衛生設備経験を限定的に使える       |
| 9   | フランチャイズ・独立支援    | 高い   | 中     | 独立経験はあるが案件精査が必要      |
| 10  | 退職支援・退職代行       | 高い   | 中     | 困窮した読者への過剰訴求を禁止する    |
| 11  | 不動産査定・売却相談      | 高い   | 低〜中   | 不動産実務経験がなくYMYLリスクがある |
| 12  | 引越し・不用品回収       | 中    | 低〜中   | 検索需要はあるが独自性が弱い       |
| 13  | 大人の学び・資格取得      | 中〜高  | 中〜高   | 学習と試行錯誤の発信に接続できる     |
| 14  | ドラム・音楽教室・楽器     | 低〜中  | 中〜高   | 6年間の経験はあるが高単価化しにくい   |
| 15  | 自動車買取・カーリース     | 高い   | 低い    | 検証済み経験が不足する          |
| 16  | 結婚相談所・婚活        | 高い   | 低い    | 現在の発信との接点が弱い         |
| 17  | 保険・ローン・投資       | 高い   | 低い    | 専門性と法令対応が不足する        |
| 18  | 美容医療・エステ        | 高い   | 低い    | 経験との接点が薄く薬機法等の負担が大きい |


### 6.2 現在確認できた施工管理専門案件

AccessTradeの2026年7月公開情報では、建築設計・施工管理者専門転職エージェント「ガウディキャリア」は、面談完了1件につき税抜14,652円と案内されている。

- [AccessTrade：2026年7月更新 新着・注目プログラム](https://www.accesstrade.ne.jp/campaign/new_at2607)

個別案件の掲載可否、成果条件、対象年齢、対象職種、否認条件は、提携時に管理画面で再確認する。

### 6.3 資格・学習案件の公開例

A8.netの2026年8月10日更新ランキングには、次の公開例がある。

- 無料体験完了：10,000円
- 講座受講開始：50,000円
- 合宿免許参加：12,000円

これらは建設資格案件そのものの報酬を示すものではない。学習・資格分野で、成果地点によって高い報酬が成立する例として扱う。

- [A8.net：学び・資格ランキング](https://support.a8.net/as/HintOfProgram/ranking/learn.php)
- [バリューコマース：学び・教育・学校](https://www.valuecommerce.ne.jp/client/learn.html)

### 6.4 住宅・リフォーム案件

バリューコマースは、賃貸、リノベーション、住宅セキュリティ等の住まい分野で、資料請求や会員登録を成果地点とする高額報酬案件が多いと案内している。

- [バリューコマース：住まい・暮らし](https://www.valuecommerce.ne.jp/client/lifestyle.html)

ただし、本人の主な経験は大型物件の空調・衛生設備施工管理である。住宅の施主経験、住宅営業、外壁塗装、屋根修理、不動産売買等を経験したかのように書いてはならない。

安全な立場は、次のとおりである。

> 設備施工管理経験者が、見積書、工程説明、工事範囲、業者との確認事項を分かりやすく解説する

---

## 7. 推奨する非テック特化ブログ

### 7.1 ポジショニング

> 元・空調衛生設備の現場代理人が、施工管理者の転職、資格、働き方を一次経験と公式情報から検証する

### 7.2 主な読者

```yaml
audience_persona:
  age_range: 25-40
  occupation:
    - サブコンの施工管理
    - 設備会社の現場監督
    - 空調・衛生設備の施工管理
  current_situation:
    - 長時間労働や休日の少なさに悩んでいる
    - 辞めたいが、施工管理以外に何ができるか分からない
    - 年収を大きく下げたくない
    - 転職エージェントの説明をそのまま信用してよいか不安
  desired_outcome:
    - 続ける、同業転職、職種変更、異業種転職を比較して選びたい
  next_action:
    - 自分の経験を棚卸しする
    - 求人を比較する
    - 必要な場合だけ転職エージェントへ相談する
```

### 7.3 記事クラスター

#### A. 施工管理の実態

- 空調・衛生設備の施工管理は何をする仕事か
- 現場監督と現場代理人の違い
- ゼネコン、サブコン、設備会社の違い
- 100人規模の現場で必要になる段取り
- 設計変更や工期遅延が起きたときの実務

#### B. 続けるか辞めるか

- 施工管理に向いている人、向いていない人
- 辞める前に確認すべきこと
- 同業他社へ移る場合と異業種へ移る場合の違い
- 年収、休日、責任、働き方の比較軸
- つらい状態で重大な判断をするときの相談先

医療・法律に関わる説明は、個人の体験と一般的助言を分け、専門機関の一次情報を参照する。

#### C. スキルの棚卸し

- 工程管理を別業界のプロジェクト管理へ翻訳する
- 職人・設計者・発注者との調整経験を職務経歴書へ書く
- 原価・品質・安全管理をどう説明するか
- 施工図、見積、打合せ経験の転用先

#### D. 転職サービス比較

- 施工管理専門エージェントの比較基準
- 面談で聞くべき質問
- 求人票の休日、残業、勤務地、資格手当の見方
- 総合型と建設専門型の違い
- 向いていない読者と利用しないほうがよい場合

#### E. 資格と学習

- 施工管理技士等の資格講座比較
- 通学、通信、独学の違い
- 実務経験要件、試験制度、費用の確認方法
- 資格取得が必要な転職と不要な転職

試験制度、受験資格、合格率、給付制度は毎年更新されるため、必ず公式情報と確認日を付ける。

### 7.4 収益導線

```text
施工管理の仕事内容・悩み
↓
続ける／同業転職／異業種転職を比較
↓
本人の経験・条件を棚卸し
↓
建設専門転職エージェント
├─ 資格講座
├─ キャリア相談
└─ 関連する低単価の書籍・現場用品
```

転職を不必要に促さない。「転職しない」「社内異動」「職場環境の改善」「資格取得後に再検討」も正式な結論として扱う。

---

## 8. 事実境界と禁止事項

### 8.1 書いてよい一次経験

- 空調・衛生設備施工管理の仕事内容
- 現場監督・現場代理人として担当した範囲
- 工程、品質、資金、関係者調整で経験したこと
- 建設業から別業界へ移った本人の体験
- 実際に面談・登録・比較したサービス
- 実際に受講・使用・測定した商品やサービス

### 8.2 根拠がなければ書いてはならないこと

- 取得していない資格の合格体験
- 使っていない転職エージェントの面談体験
- 住宅施主、住宅営業、外壁塗装職人としての体験
- 不動産投資、保険販売、医療、美容医療の専門家としての助言
- 「必ず転職できる」「最も年収が高い」「絶対に辞めるべき」等の断定
- 報酬額を根拠としたおすすめ順位
- 不調や困窮を過剰に煽るCTA

### 8.3 Experienceの登録単位

```yaml
author_experience:
  domain: construction_management
  subject: hvac_and_plumbing_equipment
  role: site_manager
  period: 2011-04/2020-10
  verified_scope:
    - schedule_management
    - quality_management
    - cost_management
    - stakeholder_coordination
    - construction_drawing
  excluded_scope:
    - residential_sales
    - real_estate_brokerage
    - roof_construction
    - medical_advice
```

---

## 9. 検証計画

### 9.1 全体方針

最初から20案件、複数サイト、大量記事を作らない。検索需要、クリック、継続して書けるかを、小さなコンテンツ実験で確認する。

### 9.2 テック系ブログの初期実験

対象案件：Make、Notta、HubSpotまたはPipedrive、freee予約、ConoHa WING。

各案件について、次の3記事を作る。

1. 導入手順と実際に詰まった点
2. 競合との比較、向いている人、向いていない人
3. 導入前後の時間、工程、品質、費用の変化

合計15記事を6〜8週間観測する。

### 9.3 非テック系ブログの初期実験

最初に次の5記事だけを作る。

1. 空調・衛生設備の施工管理を約10年経験して分かった仕事内容
2. 施工管理を辞める前に整理したいスキルと判断条件
3. 施工管理経験を異業種の職務経歴書へ翻訳する方法
4. 建設専門転職エージェントの面談で確認する質問
5. 施工管理を続ける人、同業転職する人、異業種へ移る人の比較

サービス比較記事は、実際に提携、登録、面談、条件確認を行った後に公開する。

### 9.4 共通測定項目

- インデックスされた記事数
- 記事当たりの検索表示回数
- 検索クエリと想定読者の一致率
- 検索結果から記事へのCTR
- 記事から広告主へのクリック率
- 無料登録、相談、面談、契約等の成果
- 読者から届いた具体的な質問
- 一次情報を追加できた回数
- 1記事の作成・更新時間
- 本人が無理なく継続できるか
- 古い条件を修正するための運用負荷

### 9.5 継続判断

初回実験では、根拠のない一律の数値目標を先に固定しない。各サイトの初期ベースラインを取得した後、次の条件で判断する。

```text
継続候補：
・検索意図と読者像が一致している
・一次情報を継続して追加できる
・広告主へのクリックまたは具体的な質問が発生する
・少なくとも3つの代替案件があり、1社終了でサイト全体が止まらない
・本人が30記事規模まで無理なく深掘りできる

停止・再設計候補：
・報酬以外の理由で商品を説明できない
・体験を捏造しないと記事が成立しない
・読者の困窮や不安を煽らないと成約しない
・1社の案件終了でサイト価値がほぼ消える
・更新負荷や心理的負担が継続できない
```

---

## 10. Affiliate Content OSへの示唆

以下は本調査から導いた要求候補であり、承認済み仕様ではない。

### 10.1 URL起点だけでなく、ジャンル仮説起点を追加する

現行構想は「アフィリエイトURLを登録する」ジャーニーが中心である。しかし、新しいブログを作る前には、URLがまだ存在せず、次の順序になる。

```text
本人の経験・発信・読者を分析
↓
解決できる悩みを抽出
↓
ジャンル仮説を作る
↓
案件を複数ASPから探索
↓
提携可否と成果条件を確認
↓
小さく記事を作って検証
↓
継続するジャンルだけサイト化
```

したがって、`Affiliate Inbox` とは別に、`Niche Discovery` または `Opportunity Studio` が必要になる可能性がある。

### 10.2 物販以外の成果地点を正式に扱う

高単価案件では、購入だけでなく次が成果地点になる。

- 無料登録
- 資料請求
- 面談完了
- 無料相談
- 来店・体験完了
- 査定依頼
- 講座受講開始
- 初回決済
- 月額継続
- 紹介先の初年度売上

```yaml
conversion_contract:
  action_type: purchase | signup | document_request | consultation | interview | visit | assessment | course_start | first_payment | recurring_payment
  amount_type: fixed | percentage | recurring | tiered | confidential
  validation_requirements: []
  rejection_conditions: []
  confirmation_window_days: number | null
```

### 10.3 本人適合性を独立オブジェクトにする

```yaml
niche_hypothesis:
  id: string
  workspace_id: string
  author_persona_id: string
  audience_persona_id: string
  problem_statement: string
  domain: string
  verified_experience_ids: []
  experience_boundary_ids: []
  opportunity_ids: []
  primary_information_plan: []
  editorial_fit_score: number
  commercial_fit_score: number
  compliance_risk: low | medium | high
  experiment_id: string | null
  status: draft | researching | testing | validated | rejected | paused
```

`editorial_fit_score` と `commercial_fit_score` は分離し、商品のランキングサービスへ `commercial_fit_score` を渡さない。

### 10.4 案件候補と提携済みリンクを分ける

URLがまだなくても市場調査を保存できるようにする。

```yaml
affiliate_opportunity:
  id: string
  provider: string
  advertiser: string
  program_name: string
  category: string
  public_program_url: string | null
  management_console_verified_at: datetime | null
  conversion_contract_id: string
  permitted_channels: []
  application_status: unknown | planned | applied | approved | rejected | closed
  terms_confidence: public_only | dashboard_verified | advertiser_verified
  terms_valid_until: datetime | null
  affiliate_link_id: string | null
```

`AffiliateOpportunity` は市場候補であり、`AffiliateLink` は提携後に受け取った原文リンクである。両者を同一にしない。

### 10.5 本人の資料を安全に分析する

- ジャーナルやSNS原稿は、明示的に許可された範囲だけ読む。
- 第三者の氏名、連絡先、契約条件、健康情報を候補抽出結果へコピーしない。
- AIは経験を推測で補完せず、`verified / inferred / unknown` を区別する。
- 公開コンテンツへ使える経験と、分析だけに使える非公開情報を分ける。
- X全件を取得できない場合は、完全分析と表示しない。

### 10.6 マルチサイトの作成前ゲート

新しいサイトを生成する前に、最低限次を確認する。

- 読者の悩みが既存サイトと異なる
- 検索意図が既存サイトと異なる
- 10件以上の独自記事仮説がある
- 3件以上の案件候補または収益手段がある
- 本人の事実境界が登録されている
- 広告案件がなくても読者価値が成立する
- 1社終了時の代替策がある

### 10.7 案件の鮮度管理

公開ページだけで報酬を確定しない。次の状態を持つ。

```text
PUBLIC_INFORMATION_ONLY
→ DASHBOARD_VERIFICATION_REQUIRED
→ VERIFIED
→ TERMS_REFRESH_DUE
→ CHANGED / CLOSED
```

報酬、成果地点、否認条件、掲載可能媒体、広告表記、申込期間が変わった場合、影響を受ける比較記事、CTA、商品カード、SNS投稿を特定する。

---

## 11. 実装へ進める前の未決事項

1. 本人が建設業の経験を継続的に公開したいか。経験があることと、今後書きたいことは同じではない。
2. 施工管理専門エージェントを、ASP管理画面で何件提携できるか。
3. 建設・設備資格講座の現行案件と成果条件は何か。
4. 現在のX読者へ施工管理テーマを混在させるか、検索流入専用の別ブランドにするか。
5. X全件アーカイブ取得後に、現在の反応テーマと候補順位が変わるか。
6. B2B SaaS案件の海外送金、税務、通貨、承認条件をどう管理するか。
7. 本人の非公開ジャーナルを分析する際の保存期間、マスキング、公開利用許可をどう表現するか。

---

## 12. 推奨する次の行動

1. ASP管理画面で、施工管理、建設転職、設備、資格、リフォームの現行案件を検索する。
2. 候補ごとに成果地点、報酬、否認条件、掲載媒体、提携審査を記録する。
3. 非テック系の試験記事5本について、タイトルと一次情報を先に設計する。
4. テック系15記事と非テック系5記事を別サイト仮説として比較する。
5. 6〜8週間の結果から、最初に本格構築するブログを一つ選ぶ。
6. 検証後、必要であれば本書 §10 を正式な要求変更として仕様正本へ反映する。

---

## 13. 公開情報源

### 国内ASP・市場

- [バリューコマース：高報酬分野](https://www.valuecommerce.ne.jp/stepup/ec_hints/)
- [バリューコマース：住まい・暮らし](https://www.valuecommerce.ne.jp/client/lifestyle.html)
- [バリューコマース：学び・教育・学校](https://www.valuecommerce.ne.jp/client/learn.html)
- [A8.net：転職アフィリエイト](https://www.a8.net/campus/campus-blog/6435-job-change-affiliate.html)
- [A8.net：案件選定ガイド](https://www.a8.net/campus/listing/7785.html)
- [A8.net：学び・資格ランキング](https://support.a8.net/as/HintOfProgram/ranking/learn.php)
- [AccessTrade：2026年7月更新 新着・注目プログラム](https://www.accesstrade.ne.jp/campaign/new_at2607)
- [AccessTrade：人材案件公開例](https://www.accesstrade.ne.jp/campaign/jinzai24)
- [AccessTrade：IT・フリーランス案件公開例](https://www.accesstrade.ne.jp/cp/jinzai22/)
- [AccessTrade：スクール案件公開例](https://www.accesstrade.ne.jp/cp/study23/)

### 広告主公式

- [Make Affiliate Program](https://www.make.com/en/affiliate)
- [HubSpot Affiliate Program](https://www.hubspot.com/partners/affiliates)
- [Notta Affiliate Program](https://www.notta.ai/affiliate/)
- [freee予約 紹介パートナー](https://www.freee.co.jp/reservation/partner/)
- [monday.com Affiliate Program](https://monday.com/affiliate-program)
- [Pipedrive Affiliate Partnership](https://www.pipedrive.com/en/affiliate-partnership)
- [ActiveCampaign Affiliate Program](https://www.activecampaign.com/partners/affiliate)
- [ConoHa WING 紹介パートナー](https://www.conoha.jp/wing/partner/)
- [Kinsta Affiliate Program](https://kinsta.com/jp/affiliates/)
- [Webflow Affiliate Program](https://webflow.com/solutions/affiliates)
- [GetResponse Affiliate Program](https://www.getresponse.com/affiliate-programs)
- [ElevenLabs Affiliate Program](https://elevenlabs.io/affiliates)
- [Semrush Affiliate Program](https://www.semrush.com/lp/affiliate-program/en/)
- [Adobe Affiliate Program](https://blog.adobe.com/jp/publish/2024/04/01/cc-adobe-affiliate-program)
- [Shopify Affiliate Program](https://help.shopify.com/en/affiliates/about)
- [1Password Affiliate Program](https://1password.com/affiliate)
- [Notion Affiliate Program](https://www.notion.com/affiliates)

---

## 14. 変更履歴


| 日付         | 版   | 変更内容                                                  |
| ---------- | --- | ----------------------------------------------------- |
| 2026-09-01 | 0.1 | 本人適合性、テック系20候補、非テック系18分野、ブログ仮説、検証計画、プロダクトへの示唆を初版として記録 |


