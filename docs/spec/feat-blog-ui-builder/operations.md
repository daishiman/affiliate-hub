# 運用手順（feat-blog-ui-builder）

- 更新日: 2026-08-31（固定文書の現行契約へ同期）
- 規則の理由は [`ui-rules.md`](./ui-rules.md)。**ここには手順だけを書く。**

---

## 0. 手順を読む前に

| 記号 | 意味 |
| --- | --- |
| 🟢 | いま実行できる |
| ⚠️ | 実行できるが、先に確かめることがある |
| 🔴 | **いまは実行できない。** できない理由と、できるようにするために要ることを書いた |

**🔴 の手順を「たぶん動くはず」で実行しないこと。**
途中まで進んで止まると、中途半端な行が保存先に残る。

---

## 1. 🟢 新しいブログを作る

1. `/admin/sites/new` を開く
2. 設計図を書く（型・扱う分野・収益の形・10 個の観点）
3. **10 個の観点を空欄のまま進めない。**
   空欄のまま記事を作ると、ほかのブログの言い換えになる。
   詳細画面が空欄の数を数えて警告する
4. カテゴリーを 1 件以上作る（読者の入口が無いブログは公開できない）
5. `/admin/sites/[site]` で「出す画面」の一覧を確認する。
   **「どこから来るか」が空の画面があれば、そこは誰も辿り着けない**

### 開発機で見た目を確かめる

```bash
pnpm run dev              # http://localhost:3001
pnpm run preview:site     # 読者側の画面を静的に書き出す
pnpm run preview:blog     # ブログ面だけを書き出す
```

> 2026-08-30 時点で `pnpm run preview:site` は
> `gear-for-small-kitchen の投影を作れませんでした` で落ちる。
> `home-office-desk` は作れる。原因は未調査。

---

## 2. 🟢 テンプレートを切り替える

1. `/admin/sites/[site]` を開き、「見せ方と配色」へ進む
2. テンプレートを 6 種から選ぶ（選び方は `ui-rules.md` §1.2）
3. 保存する

**既存記事は壊れない。** テンプレートが決めるのは並び方だけで、
推奨順に無いブロックは末尾へ元の順のまま付く（1 つも落ちない）。

切り替えた後に確かめること:

- トップの区画の並びが変わったか
- サイドバーの有無が変わったか（`news` と `minimal` は出さない）
- **記事のブロックが 1 つも消えていないか**

---

## 3. ⚠️ 新しいテンプレートを足す

コードを直す作業である。管理画面からは足せない。

1. `src/domain/authoring/blog-template.ts` の `BLOG_TEMPLATES` に 1 件足す
2. `BLOG_TEMPLATE_IDS` にも ID を足す（型がここから作られる）
3. `articleBlockOrder` は必ず `AI_FIRST` で始め `AI_LAST` で終える
   （理由は `ui-rules.md` §1.3）
4. **「このテンプレートでは〜が使えない」を書かない**（既存記事が壊れる）
5. `pnpm test` を通す

```bash
pnpm test
pnpm run typecheck
```

部品の骨組みが要るなら:

```bash
pnpm run scaffold:blog
```

---

## 4. ⚠️ 新しい固定ページ種別を足す

正本は `SITE_ROUTES` から導く `SiteDocumentKey` 1 系統である。

1. `src/domain/authoring/site-routes.ts` の `SITE_ROUTES` に policy route を足す
2. `src/app/s/[site]/<path>/page.tsx` を作り、共通 `PolicyPage` へ
   `documentKey` と canonical `path` を渡す
3. `/admin/sites/[site]/documents` に新しい未記入行が現れ、保存後に同じ canonical URL で
   published 文書が読めることを確認する
4. owner workspace 以外、draft、`deleted_at` ありの行が読めない負試験を足す
5. 既存 key の**改名**なら、本文を捨てない backfill と衝突検出を migration に入れる

`SITE_DOCUMENT_KEYS` は route catalog から導かれるため別の配列へ追記しない。
`FixedPageKind` は旧URLの redirect adapter 専用であり、新しい固定文書を足すたびに
広げない。過去のURLも受ける明示要件がある場合だけ redirect 対応を追加する。

> **歴史 snapshot（2026-08-30）:** 統合前は語彙が2系統に割れ、
> workspace・published・削除状態の条件も揃わず、18経路中12件が404だった。
> `evidence/11-a4-a13-http-status.txt` はその失敗証跡であり、現行残件ではない。

---

## 5. ⚠️ アフィリエイト配置を更新する

1. `/admin/sites/[site]` から「掲載の台帳」を開く
2. 掲載を足す・消す
3. 逆引き（この広告がどの記事に出ているか）で 3 面が一致することを確認する

**⚠️ 2026-08-30 時点で、掲載の増減が操作の記録に残らない**
（`createReviewBlogPlacementsUseCase` が記録に届いていない。
`evidence/README.md` §4.4）。

**金銭に直結する変更なので、記録が入るまでは変更内容を人手で控えること。**
いつ・誰が・何を消したかを、後から機械で追えない。

同じ理由で、配色の保存（`createManageBlogAppearanceUseCase`）も記録に残らない。

---

## 6. 🟢 IndexNow の鍵を回す（ローテーション）

### 6.1 鍵の置き場所

**鍵はリポジトリ・管理画面・D1 のいずれにも置かない。**
Worker の環境変数 `INDEXNOW_KEY` だけに置く。

鍵ファイルは `https://<origin>/indexnow.txt` で公開される。
**このファイルの中身が鍵そのもので、所有権の証明である。**
だからこそリポジトリに入れてはいけない。

### 6.2 回す手順

```
1. 新しい鍵を作る（32〜128 文字の英数字）
2. 本番の Worker 環境変数 INDEXNOW_KEY を新しい鍵に置き換える
3. https://<origin>/indexnow.txt を開き、新しい鍵が返ることを確かめる
4. 記事を 1 本更新し、通知が通ることを確かめる
```

> **鍵の値をこの端末のファイルやコマンド履歴に残さないこと。**
> Cloudflare のダッシュボード、または別のターミナルから登録する。
> 一度でもファイルに書くと、そこを読める全員が鍵を持つことになる。

### 6.3 確かめ方

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<origin>/indexnow.txt
```

| 返り値 | 意味 |
| --- | --- |
| `200` + 鍵の文字列 | 正常（本番） |
| `404` | 鍵が設定されていない。**開発機ではこれが正しい** |

**鍵が無いときは、記事の公開は通り、通知だけが飛ばない。**
公開が止まらないのは意図した挙動である。
通知は届けば早くなるだけのもので、届かなくても記事は出る。

### 6.4 知っておくこと

- **Google は IndexNow に対応していない。** 効くのは Bing 系
  （ChatGPT search の基盤）である
- 鍵を回した直後、古い鍵での通知は拒否される。**回すのは記事の更新が少ない時間帯に**

---

## 7. 🟢 出典（`guideline_references`）を登録する

### 7.1 登録

1. `/admin/settings` から「SEO/AI 検索の指針」を開く（`/admin/settings/seo`）
2. コードに書かれた初期候補が「未登録」として並んでいる
3. 出典 URL・発行元・確認日を入れて登録する
4. **候補のまま放置しない。** 登録するまで保存先には入らない

2026-08-30 時点の初期候補（すべて未登録・原典未取得）:

| タイトル | 発行元 |
| --- | --- |
| Google 検索の AI 機能で成功するためのガイド | Google Search Central |
| AI features and your website | Google Search Central |
| llms.txt の提案（/llms.txt） | Answer.AI |
| IndexNow プロトコルの文書 | IndexNow (indexnow.org) |

### 7.2 90 日サイクル

```
登録（確認日 = 今日）
   ↓ 90 日
画面に「再確認」と出る（自動では消えない）
   ↓ 原典を読み直す
確認日を今日に更新 → 振り出しへ
```

1. 90 日を超えた行を**消さない**。消すと、古い指針に基づいた記事が
   残っていることに気付けなくなる
2. 読み直したら、**内容が変わっていなくても確認日を更新する**
   （「読み直した」という事実に意味がある）
3. **ガイドラインの中身が変わったときは、仕様セルを R4-reopen する。**
   アプリのレジストリを直しただけでは仕様は動かない

### 7.3 やってはいけないこと

- 画面側で日数を数え直す（判定は `referenceReviewStatus` だけが行う）
- `/admin/settings/seo` に他の設定を混ぜる
- 記事公開後の AI 検索点検を**公開の条件にする**
  （条件にすると、点検を通すために内容を歪める力が働く）

---

## 8. 🟢 llms.txt

- `/s/{site}/llms.txt` は設計図の任意項目
- 出さない設定なら **404**（空ファイルを返さない）
- 効果は未確認。**Google は使わないと明言している**

出すかどうかは `/admin/sites/[site]` の「AI 向けの案内ファイル」で確認できる。

---

## 9. ⚠️ データベースを移行する

```bash
pnpm run db:generate          # schema.ts の変更から migration を作る
pnpm run db:migrate:local     # 開発機の D1 へ適用
pnpm run db:migrate:remote    # 本番の D1 へ適用
pnpm run db:drift             # schema と実物のずれを見る
```

**`pnpm run db:generate` で作った 3 ファイルを必ずコミットに含めること。**

```
drizzle/NNNN_*.sql
drizzle/meta/NNNN_snapshot.json
drizzle/meta/_journal.json
```

含めないと `pnpm run verify` の「マイグレーションの作り忘れ」が赤のままになる。
**この門は「生成できるか」ではなく「コミットに入っているか」を見ている。**
生成だけで緑になると、CI は通るのにデプロイで落ちる状態が作れてしまう。

> **歴史 snapshot（2026-08-30 時点の未処理）**: `blog_theme` と `page_theme_override` へ
> `workspace_id` を足す migration（`drizzle/0040_serious_madelyne_pryor.sql`）が
> 生成済み・未コミットである。**これを入れずに本番へ出すと、
> 列が無いのにコードは列があるつもりで問い合わせ、配色の読み書きが落ちる。**
> 詳細は `evidence/README.md` §4.2。

---

## 10. 出す前に通す門

```bash
pnpm run verify
```

17 門を順に通す。**最初の赤で止まる**ので、赤が複数あるときは
直しては回すを繰り返すことになる。

主な門:

| 門 | 何を見るか |
| --- | --- |
| 型検査 / 書き方の検査 | — |
| マイグレーションの作り忘れ | 生成物がコミットに入っているか（§9） |
| 受入 ID の証跡突合 | 判定と証跡がずれていないか |
| テストとカバレッジ | — |
| つなぎ目の呼び出し | 書き込みが操作の記録に届いているか |
| 要件ごとの必須テスト種別 | 種別名が `TEST_TYPES` の語彙か |
| 見た目の回帰 | 見本との差 |

**閾値を上げて緑にすることは禁止である。**
上限は「ここまでは許す」の線であって、越えたら線を動かすものではない。

2026-08-30 時点で 4 門が赤い。内訳と直し方は `evidence/README.md` §4.1。

---

## 11. 出す先

```
作業ブランチ ──PR──▶ dev ──PR──▶ main
                      │            │
                   開発環境       本番
```

- **PR の宛先は既定で `dev`。`main` へ直接出さない**
- 本番だけが壊れて急ぐときは `hotfix/...` と名付けて `main` へ。
  **マージしたら `git push origin origin/main:dev` で `dev` へ戻すこと**

戻し忘れると `dev` だけが古いまま取り残される。
2026-08-21 に実際そうなり、`dev` が `main` から 451 コミット遅れて、
開発環境では `/admin` も `/s` も 404 だった。
