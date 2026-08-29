# 画面構成の設計: feat-uiux-overhaul

- graph node: `SYS-UIUX-OVERHAUL-P02`
- 入力: [`requirements-baseline.md`](./requirements-baseline.md), [`screen-inventory.md`](./screen-inventory.md), [`information-priority-map.json`](./information-priority-map.json)
- 併産: [`component-contract.md`](./component-contract.md), [`sns-provider-contract.md`](./sns-provider-contract.md), [`blog-scaffold-contract.md`](./blog-scaffold-contract.md), [`admin-api-contract.md`](./admin-api-contract.md)

## 決めること

1. 32 画面を単一用途へ分割した後の route 一覧 (A1)
2. 管理対象 4 種の作成・編集・削除がどの画面に載るか (A2)
3. サイドバーの構造 — アイコン・分類・開閉 (A9)
4. 画面間の遷移 (どこから来てどこへ帰るか)

実装手段は決めない。「どの route が何の用途を持つか」までが本書の責務で、部品の作り方は `component-contract.md` が持つ。

## 分割の判断基準

画面を分けるのは、**1 画面に主要タスクが 2 つ以上あるとき**に限る。主要タスク = 完了すると業務状態が変わる操作、または利用者の関心が別の対象へ移る閲覧。

分けない場合が 2 つある。

- **折りたたみで足りるとき**: 参照専用の節が並んでいるだけなら、分割ではなく初期非表示にする。`/admin/writing` の 7 節がこれにあたる。分けると「どの画面にあったか」を覚える負担が増え、認知負荷は下がらない。
- **見本帳**: `/admin/ui-catalog` は全件が同時に見えることが用途そのもの。

## 分割後の route 一覧

新設は **17 route**、分割による移動は 6 画面。既存 32 と合わせて **49 route** になる。

### 素材 (material)

| route | 主要タスク | 変更 |
|---|---|---|
| `/admin/products` | 商品をさがして詳細へ進む | 新規作成の入口を追加 |
| `/admin/products/new` | 商品を 1 件作る | **新設** |
| `/admin/products/[product]` | 1 商品の仕様・根拠・検証記録を確かめる | 順位理由と提携リンクを移出 |
| `/admin/products/[product]/edit` | 1 商品を直す | **新設** |
| `/admin/products/compare` | 複数商品を同じ項目で比べる | 変更なし |
| `/admin/evidence` | 出所のない内容を見つける | 全件表示を絞り込み結果へ |
| `/admin/rankings` | 決めた基準での順位と理由を確かめる | 決め方の説明を移出 |
| `/admin/rankings/criteria` | 評価基準を決める | **新設** (移出先) |

### 書く (write)

| route | 主要タスク | 変更 |
|---|---|---|
| `/admin/content` | 次に手を付ける記事を決める | 新規作成の入口・配信状態列を追加 |
| `/admin/content/new` | 記事を 1 本作る | **新設** |
| `/admin/content/[variant]` | 本文を読んで判断する | 進行操作を移出 |
| `/admin/content/[variant]/edit` | 本文を直す | **新設** |
| `/admin/content/[variant]/progress` | 承認・公開を進める | **新設** (移出先) |
| `/admin/content/matrix` | 企画 × 読者 × 媒体の組み合わせを決める | 商品からの起動導線を追加 |
| `/admin/personas` | 書き手を決める | 読者像を移出。一覧・作成・編集・削除を追加 |
| `/admin/personas/audiences` | 読者像を決める | **新設** (移出先) |
| `/admin/writing` | 書き方の決めごとを調べる | 7 節を折りたたみへ (分割しない) |
| `/admin/generation` | AI に渡すものと人の判断境界を調べる | 3 子へ分割 |
| `/admin/generation/inputs` | 渡す項目を調べる | **新設** (移出先) |
| `/admin/generation/prompt` | 指示文の組み立てを調べる | **新設** (移出先) |

### 出す (publish)

| route | 主要タスク | 変更 |
|---|---|---|
| `/admin/sites` | ブログを選ぶ / 新しく作る | 構成方針を折りたたみへ |
| `/admin/sites/new` | ブログを 1 本作る | 変更なし (作成フォームの手本) |
| `/admin/sites/[site]` | 1 ブログの設計図を確かめる | 編集・削除を追加 |
| `/admin/sites/[site]/edit` | 1 ブログの設計図を直す | **新設** |
| `/admin/distribution` | 止まっている配信を見つけて対処する | 全記録を絞り込み結果へ |
| `/admin/distribution/new` | 配信を 1 件予約する | **新設** |
| `/admin/distribution/calendar` | 予定の偏りと承認漏れを確かめ、必要なら日時を直す | 変更なし |
| `/admin/distribution/[publication]` | 1 配信の進行を確かめる | 編集・取り下げを追加 |
| `/admin/distribution/[publication]/edit` | 配信の予定を直す | **新設** |

### 稼ぐ (earn)

`/admin/affiliate`, `/admin/affiliate/[conversion]`, `/admin/inbox` — route 追加なし。表示情報の整理のみ。

### 見る (observe)

`/admin/analytics`, `/admin/ai-usage`, `/admin/improvement`, `/admin/improvement/dimensions` — route 追加なし。

### 整える (maintain)

| route | 主要タスク | 変更 |
|---|---|---|
| `/admin/settings` | 設定したい対象へ移動する | **索引だけにする** (459 行 → 索引) |
| `/admin/settings/appearance` | 見た目を決める | **新設** (移出先) |
| `/admin/settings/workspaces` | 作業場所を決める | **新設** (移出先) |
| `/admin/settings/members` | 担当者を決める | **新設** (移出先) |
| `/admin/settings/roles` | 役割ごとにできることを決める | **新設** (移出先) |
| `/admin/settings/audit` | 操作の記録を調べる | **新設** (移出先) |
| `/admin/settings/compliance` | 広告表記と表現のきまりを直す | **追加** (P01 後 / 2026-08-24。上の 49 route の数はこの日の計画の固定点なので動かさない) |
| `/admin/settings/llm` | 生成 AI の鍵を登録する | 変更なし |
| `/admin/settings/integration-access` | 取得用の鍵を発行・失効する | 説明文を 40 字以下へ |
| `/admin/feedback`, `/admin/feedback/[report]` | 改善要望を扱う | 表示情報の整理のみ |
| `/admin/tools`, `/admin/ui-catalog` | 参照専用 | 変更なし (ui-catalog は数値目標から除外) |

## 作成・編集・削除の載せ方 (A2)

**削除は画面を作らない。** 一覧・詳細から確認を挟んで実行する。理由は、削除専用画面は「削除するために移動する」という余分な手順を作るだけで、誤操作の防止には確認そのものが効くため。

| 対象 | 一覧 | 作成 | 編集 | 削除 |
|---|---|---|---|---|
| ブログ | `/admin/sites` | `/admin/sites/new` | `/admin/sites/[site]/edit` | 詳細から確認付き |
| 記事 | `/admin/content` | `/admin/content/new` | `/admin/content/[variant]/edit` | 詳細から確認付き |
| 商品 | `/admin/products` | `/admin/products/new` | `/admin/products/[product]/edit` | 詳細から確認付き |
| SNS 投稿 | `/admin/distribution` | `/admin/distribution/new` | `/admin/distribution/[publication]/edit` | 詳細から取り下げ |

削除の意味は対象ごとに違う。**画面には「消える」か「取り下げる」かを言葉で書き分ける。**

- ブログ・記事・商品: 復元できない削除。関連する記事・配信が残っている場合は、件数を示して止める
- SNS 投稿: 予約の取り下げ。送信済みは取り下げられない (理由を出す)

## 遷移の設計

**戻り先を推測させない。** 作成・編集を終えたら、開始した一覧または詳細へ戻す。

```
一覧 ──[新規]──▶ 作成 ──[保存]──▶ 作成された詳細
  │                  └─[やめる]──▶ 一覧
  └─[行を選ぶ]──▶ 詳細 ──[編集]──▶ 編集 ──[保存/やめる]──▶ 同じ詳細
                    └─[削除]──▶ 確認 ──[実行]──▶ 一覧
```

分割で移出した画面は、**親から入る**。`/admin/settings/appearance` はサイドバーに載せず、`/admin/settings` の索引からだけ入る。理由は A9 の「1 分類あたりの項目数上限」を保つため。

1 商品から複数ブログへの導線 (A5) だけは例外で、素材から書くへ横断する。

```
/admin/products/[product] ──[この商品で記事を作る]──▶ /admin/content/matrix?product=<id>
                                                        │ ブログ × 読者 × 切り口を選ぶ
                                                        ▼
                                                     /admin/content (生成物がブログ別に並ぶ)
```

## サイドバーの構造 (A9)

### 項目数を増やさない

分割で route は 32 → 49 になるが、**サイドバーは 19 項目のまま**とする。新設 17 route のうちサイドバーに載るものは 0 件で、全て親の索引・一覧・詳細から入る。

理由: サイドバーは「どこへ行けるか」ではなく「いま何の仕事をしているか」を示すもの。作成・編集画面は仕事の途中の状態であって、行き先ではない。

### 分類と上限

現行の 6 分類を維持する。上限は **1 分類あたり 6 項目**とし、超えたら分類を割る。現行の最大は `maintain` の 6 項目で、上限ちょうど。

| 分類 | 項目数 | 意味 |
|---|---|---|
| (未分類) | 1 | ホーム |
| material | 4 | 素材 — 商品・根拠・順位 |
| write | 5 | 書く — 記事・組み合わせ・書き手・書き方・生成 |
| publish | 3 | 出す — ブログ・配信・予定 |
| earn | 3 | 稼ぐ — 提携・成果・受信箱 |
| observe | 3 | 見る — 数字・AI 利用・改善 |
| maintain | 6 | 整える — 設定・要望・道具・見本帳 ほか |

### アイコン

**全項目がアイコンを持つ。型で強制する** — `ADMIN_NAV` の要素型に `icon` を必須フィールドとして持たせ、未設定をコンパイルエラーにする。

アイコンは**分類ごとに意味の系統を揃える**。素材は物、書くは筆記、出すは送信、稼ぐは金銭、見るは計測、整えるは道具。系統が揃っていると、初見でも「この辺が書く仕事」と当たりが付く。

アイコンだけで名前を置き換えない (A9 の境界)。折りたたみ時もホバー・フォーカスで名前が出る。

### 開閉

- 折りたたみの操作点はサイドバー上部に置く。**各項目のアイコンを押すと遷移する** — 開閉と遷移を同じ場所に載せると、行きたいだけの人が閉じてしまう
- 折りたたみ状態は再訪時にも保つ。保存先はブラウザ側 (サーバへ送らない)
- 折りたたみ時、分類は区切り線で表す。見出し文字は出さない
- 読み上げには項目名が残る。折りたたみは見た目だけの変化とする

### 現在地

`aria-current` は現行どおり維持する。加えて、**分割で生まれた子画面にいるときは親項目を現在地として示す**。`/admin/settings/appearance` にいるとき、サイドバーの「設定」が現在地になる。そうしないと、サイドバーに載っていない画面では現在地が消える。

## 情報量の適用 (A10)

全画面に次を適用する。例外は `/admin/ui-catalog` のみ。

- 画面説明文は 40 字以下 (現状 21 画面が超過)
- 常時表示の注意書きは 2 個以下 (現状 14 画面が超過)
- 落とす対象と方法は `information-priority-map.json` の `drop[].method` に従う
- 金銭・鍵・公開に関する注意は落とさない (`keep` 固定)

## この文書が決めていないこと

- 部品の作り方・共通化の粒度 — `component-contract.md`
- 各アイコンの具体的な絵柄 — 実装時に選ぶ。本書は「分類ごとに系統を揃える」までを決める
- 画面から呼ぶ操作の名前と入出力 — `admin-api-contract.md`
- 既存画面を共通部品へ寄せる移行手順 — P08 が所有する
