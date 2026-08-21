# ご本人にお願いする設定作業の一覧（上から順に実行してください）

このファイルは、**AI が代行できない設定作業**だけを、実行順に並べたものです。
1 つのタスクは「開く → 押す → 入れる → 確かめる」で完結し、
**終わったら次のタスクへそのまま移れる粒度**にしてあります。

- 迷ったときの詳しい背景は `docs/product/credential-registration.md`（なぜそうするか）
- 公開と検査の運用は `docs/product/ci-cd-guide.md`

**このファイルの中に、鍵の値そのものは決して書かないでください。**
値を書いた瞬間に git の履歴へ残り、あとから消しても復元できます。

---

## 進め方

上から順に実行します。**順番には理由があります。**

- S-02〜S-04（ログインを閉じる）が先です。管理画面がいま誰でも開ける状態なので、
先に鍵を貼る画面を作ると、守られていない画面へ鍵を貼ることになります。
- S-05（金庫の合言葉）は S-13（各社の鍵）より先です。これが無いと鍵を貼る欄が出ません。
- S-10（データの形の変更）は S-11（公開）より先です。逆にすると本番が全面エラーになります。

各タスクの見出しの右にある `bd: ah-xxx` は、対応する課題の番号です。
終わったら「S-05 まで終わりました」のように**番号だけ**お知らせください。

### 全体の進捗表


| 番号   | やること                                      | 所要   | 対応課題   | 状態  |
| ---- | ----------------------------------------- | ---- | ------ | --- |
| S-01 | Cloudflare へターミナルからログインする                 | 2 分  | 前提     | ☐   |
| S-02 | Google で OAuth クライアントを作り、戻り先を 4 つ貼る       | 10 分 | ah-361 | ☐   |
| S-03 | `setup-secrets.mjs` で Google の値を登録する（dev） | 3 分  | ah-361 | ☐   |
| S-04 | 管理画面が閉じたことを目で見る                           | 5 分  | ah-361 | ☐   |
| S-05 | 金庫の合言葉 `LLM_KEY_ENCRYPTION_SECRET` を登録する  | 5 分  | ah-ag8 | ☐   |
| S-06 | Cloudflare の API トークンを発行する                | 5 分  | ah-08q | ☐   |
| S-07 | Cloudflare のアカウント ID を控える                 | 2 分  | ah-08q | ☐   |
| S-08 | GitHub の Secrets に 2 つ登録する                | 3 分  | ah-08q | ☐   |
| S-09 | GitHub の Environments を 2 つ作る（承認者・URL）    | 8 分  | ah-08q | ☐   |
| S-10 | `migrate.yml` を手で 1 回走らせる（dev）            | 5 分  | ah-08q | ☐   |
| S-11 | main へのマージで公開が最後まで通ることを見る                 | 10 分 | ah-08q | ☐   |
| S-12 | `MCP_TOKEN` を登録する                         | 5 分  | ah-p9e | ☐   |
| S-13 | 生成 AI の API キーを発行し、各社で支出上限を掛ける            | 15 分 | ah-ag8 | ☐   |
| S-14 | 管理画面から鍵を貼り、接続を確認する                        | 5 分  | ah-ag8 | ☐   |
| S-15 | 未ログインで鍵の登録画面の断りを目で見る                      | 5 分  | ah-f7v | ☐   |
| S-16 | `/admin/generation` にモデルが並ぶのを目で見る         | 5 分  | ah-1j5 | ☐   |
| S-17 | 本番用の Google 設定を追加する（`--prod`）             | 3 分  | ah-361 | ☐   |
| S-18 | リポジトリを非公開にする（任意）＋使用量監視のトークン               | 10 分 | ah-xp8 | ☐   |
| S-19 | ASP 各社の API 利用申請を出す                       | 社ごと  | ah-dtq | ☐   |


---

## S-01. Cloudflare へターミナルからログインする 〔前提〕

**目的**: 以降のターミナル作業（`wrangler secret put`）を通るようにする。

**開く場所**: ご自身のターミナル。プロジェクトのフォルダへ移動してから。

**手順**

1. プロジェクトのフォルダで次を実行する。
  ```
   pnpm exec wrangler login
  ```
2. ブラウザが自動で開き、Cloudflare の確認画面が出る。
3. `**Allow**` を押す。
4. ターミナルに `Successfully logged in.` と出れば完了。

**確かめ方**

```
pnpm exec wrangler whoami
```

ご自身のメールアドレスとアカウント名が表示されれば OK です。

---

## S-02. Google で OAuth クライアントを作り、戻り先を 4 つ貼る 〔bd: ah-361〕

**目的**: 「この Google アカウントの人だけが管理画面に入れる」札を作る。

**開く URL**: [https://console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients)

**手順**

1. 上の URL を開く。初回はプロジェクトの作成を求められるので、
 プロジェクト名に `affiliate-hub` と入れて `**作成**` を押す。
2. 「Google 認証プラットフォーム」の設定を求められたら、次を入れる。
  
  | 項目           | 入れる値                                    |
  | ------------ | --------------------------------------- |
  | アプリ名         | `Affiliate Hub`                         |
  | ユーザーサポートメール  | ご自身のアドレス（`manju.manju.03.28@gmail.com`） |
  | 対象ユーザー       | **外部**（個人の Gmail で使うため）                 |
  | デベロッパーの連絡先情報 | ご自身のアドレス                                |
  
3. `**クライアントを作成**`（または `+ クライアントを作成`）を押す。
4. **アプリケーションの種類** で `**ウェブ アプリケーション**` を選ぶ。
5. 名前は `Affiliate Hub Web` など任意。
6. **「承認済みのリダイレクト URI」** の `**+ URI を追加**` を 4 回押し、
 次の 4 行を**1 文字も変えずに**、1 行ずつ入れる。
  ```
   https://affiliate-hub.daishimanju.workers.dev/api/auth/callback/google
   https://affiliate-hub-dev.daishimanju.workers.dev/api/auth/callback/google
   http://localhost:8788/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
  ```
  > 末尾のスラッシュを足す・消す、`http` と `https` を取り違える、
  > いずれもその場で弾かれます（Google は完全一致しか見ません）。
7. `**作成**` を押す。
8. **「クライアント ID」と「クライアント シークレット」** が表示される。
 この画面を開いたまま S-03 へ進む（あとからでも同じ画面で再表示できます）。

**やらないこと**: この 2 つの値をチャットに貼らない。ファイルに書かない。

---

## S-03. `setup-secrets.mjs` で Google の値を登録する（dev） 〔bd: ah-361〕

**目的**: S-02 で得た 2 つの値を、手元と Cloudflare（dev）へ、履歴に残さず登録する。

**前提**: S-01 と S-02 が済んでいること。

**手順**

1. プロジェクトのフォルダで次を実行する。
  ```
   node .better-auth-google/setup-secrets.mjs
  ```
2. 3 つ聞かれるので、聞かれてから貼り付ける。
  
  | 聞かれるもの        | 入れる値                                           | 画面への表示 |
  | ------------- | ---------------------------------------------- | ------ |
  | Client ID     | S-02 の画面の値（`.apps.googleusercontent.com` で終わる） | 出ません   |
  | Client Secret | S-02 の画面の値                                     | 出ません   |
  | 許可するアドレス      | `manju.manju.03.28@gmail.com`（複数ならカンマ区切り）      | 出ます    |
  

   上 2 つは**打っても画面に文字が出ません**。入っていないように見えますが入っています。
   貼り付けたら Enter。やめたいときは Ctrl+C。
3. 完了メッセージが出れば終わりです。署名用の値（`BETTER_AUTH_SECRET`）は
 このコマンドが自動で作るので、ご自身で用意するものはありません。

**確かめ方**

```
pnpm exec wrangler secret list --env dev
```

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` が並べば OK です
（**値は表示されません。名前だけ出るのが正しい状態です**）。

> 手元だけ先に試すなら `node .better-auth-google/setup-secrets.mjs --local-only`。
> Cloudflare へは触れず、`.dev.vars` だけ作ります。

---

## S-04. 管理画面が閉じたことを目で見る 〔bd: ah-361〕

**目的**: ログインが実際に掛かったことを、テストではなく**画面で**確かめる。

**手順**

1. ターミナルで `pnpm run preview` を実行する（`localhost:8787` が立ち上がります）。
2. ブラウザで [http://localhost:8787/admin](http://localhost:8787/admin) を開く。
3. **ログイン画面が出ること**を見る。出ずに管理画面が開いたら、そこで止めて連絡してください。
4. `**Google でログイン**` を押し、S-03 で許可したアドレスで入る。
5. 管理画面が開くことを見る。

**確かめ方**: 3 と 5 の両方が起きたら OK。

**うまくいかないとき**


| 画面に出るもの                 | 原因                     | 直し方                  |
| ----------------------- | ---------------------- | -------------------- |
| `redirect_uri_mismatch` | S-02 の 4 行のどれかが 1 文字違う | S-02 の 4 行をコピーし直して貼る |
| ログインは通るのに弾かれる           | 許可していないアドレスで入った        | 使ったアドレスを連絡（値は不要）     |


---

## S-05. 金庫の合言葉を登録する 〔bd: ah-ag8〕

**目的**: 各社の API キーを暗号化して預かるための「金庫の合言葉」を置く。
これが無いあいだ、**鍵を貼る欄そのものが画面に出ません**。

**入れる値**: ご自身で作った **32 文字以上**の長い文字列。意味のある言葉である必要はありません。
控えは不要です（忘れたら作り直せます。ただし作り直すと登録済みの各社の鍵は開けなくなり、貼り直しになります）。

**手順**

1. 次を 1 行ずつ実行し、**「Enter a secret value:」と聞かれてから**貼り付ける。
  ```
   pnpm exec wrangler secret put LLM_KEY_ENCRYPTION_SECRET --env dev
   pnpm exec wrangler secret put LLM_KEY_ENCRYPTION_SECRET --env production
  ```

   dev と production は**同じ値で構いません**。
2. **コマンドの後ろに値を書かないでください。**
 `secret put NAME 値` の形にすると、そのまま端末の履歴ファイルに残ります。

**確かめ方**

```
pnpm exec wrangler secret list --env production
```

`LLM_KEY_ENCRYPTION_SECRET` が名前だけ並べば OK です。

---

## S-06. Cloudflare の API トークンを発行する 〔bd: ah-08q〕

**目的**: GitHub から自動で公開できるようにする。

**開く URL**: [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

**手順**

1. 上の URL を開く（右上のアイコン → `**My Profile**` → `**API Tokens**` でも同じ画面です）。
2. `**Create Token**` を押す。
3. テンプレート一覧から `**Edit Cloudflare Workers**` の行の `**Use template**` を押す。
  > `**Global API Key` は絶対に使わないでください。** あれは口座の全権を持つ鍵で、
  > 用途を絞れません。漏れたら口座ごと作り直しになります。
4. 権限欄が既定で入ります。次の 2 つがあることを確認する（足りなければ追加）。
  
  | 種別      | 対象              | 権限       |
  | ------- | --------------- | -------- |
  | Account | Workers Scripts | **Edit** |
  | Account | D1              | **Edit** |
  
5. **Account Resources** は **ご自身のアカウント 1 つ**に絞る（`All accounts` にしない）。
6. `**Continue to summary**` → `**Create Token**` を押す。
7. **表示された鍵をコピーする。この画面を閉じると二度と表示されません。**
 コピーしたまま S-08 へ進んでください（S-07 は別タブで開けます）。

---

## S-07. Cloudflare のアカウント ID を控える 〔bd: ah-08q〕

**開く URL**: [https://dash.cloudflare.com/](https://dash.cloudflare.com/)

**手順**

1. 左メニューの `**Compute (Workers)**`（旧称 `Workers & Pages`）を開く。
2. 画面**右側**の `Account details` に `**Account ID**` が出ています。コピーボタンを押す。
  > ブラウザのアドレス欄にも出ています。`https://dash.cloudflare.com/<ここがアカウントID>/...` の部分です。

**確かめ方**: ターミナルで `pnpm exec wrangler whoami` を実行すると、
同じ ID が `Account ID` 列に出ます。一致すれば OK です。

---

## S-08. GitHub の Secrets に 2 つ登録する 〔bd: ah-08q〕

**開く URL**: [https://github.com/daishiman/affiliate-hub/settings/secrets/actions](https://github.com/daishiman/affiliate-hub/settings/secrets/actions)

**手順**

1. 上の URL を開く（`Settings` → `Secrets and variables` → `Actions` でも同じ）。
2. `**New repository secret**` を押し、次を登録する。名前は**1 文字も変えずに**。
  
  | Name                    | Secret（値）      |
  | ----------------------- | -------------- |
  | `CLOUDFLARE_API_TOKEN`  | S-06 でコピーした鍵   |
  | `CLOUDFLARE_ACCOUNT_ID` | S-07 でコピーした ID |
  
3. それぞれ `**Add secret**` を押す。

**確かめ方**: `Repository secrets` の一覧に上の 2 つが並ぶこと
（値は `***` としか出ません。それが正しい状態です）。

> ターミナル派の方は `gh secret set CLOUDFLARE_API_TOKEN` と打つと、
> **あとから値の入力を求められます**。`gh secret set NAME 値` の形にしないでください（履歴に残ります）。

---

## S-09. GitHub の Environments を 2 つ作る 〔bd: ah-08q〕

**目的**: 本番へは**承認するまで出ない**ようにし、動作確認先の URL を渡す。

**開く URL**: [https://github.com/daishiman/affiliate-hub/settings/environments](https://github.com/daishiman/affiliate-hub/settings/environments)

**手順（production）**

1. `**New environment**` を押し、名前に `**production**` と入力 → `**Configure environment**`。
2. `**Required reviewers**` にチェックを入れ、**ご自身（daishiman）を選ぶ**。
3. `**Save protection rules**` を押す。
4. 同じ画面を下へスクロールし、`**Environment variables**` の `**Add variable**` を押して次を登録。
  
  | Name      | Value                                           |
  | --------- | ----------------------------------------------- |
  | `APP_URL` | `https://affiliate-hub.daishimanju.workers.dev` |
  |           |                                                 |
  

**手順（dev）**

5. 一覧へ戻り、もう一度 `**New environment**` → 名前に `**dev**` → `**Configure environment**`。
6. **承認者は付けません**（試し場は気軽に出せる場所にしておくため）。
7. `**Environment variables**` → `**Add variable**` で次を登録。
  
  | Name          | Value                                               |
  | ------------- | --------------------------------------------------- |
  | `PREVIEW_URL` | `https://affiliate-hub-dev.daishimanju.workers.dev` |
  

**確かめ方**: 環境一覧に `production`（`1 protection rule`）と `dev` の 2 つが並ぶこと。

> `APP_URL` / `PREVIEW_URL` は秘密ではありません。`Secrets` ではなく
> `**Variables**` 側に入れてください。公開後の動作確認（`smoke.sh`）がこの URL を開きます。

---

## S-10. `migrate.yml` を手で 1 回走らせる（dev） 〔bd: ah-08q〕

**目的**: S-08 の鍵が実際に効いていることを、公開より先に**壊れない方**で確かめる。

**開く URL**: [https://github.com/daishiman/affiliate-hub/actions/workflows/migrate.yml](https://github.com/daishiman/affiliate-hub/actions/workflows/migrate.yml)

**手順**

1. 上の URL を開く。
2. 右上の `**Run workflow**` を押す。
3. 入力欄が 2 つ出るので、次のとおり入れる。
  
  | 欄                      | 入れる値                                 |
  | ---------------------- | ------------------------------------ |
  | どの環境に適用しますか            | `**dev**`（まず dev。production はまだ選ばない） |
  | 実行するには APPLY と入力してください | `**APPLY**`（大文字 4 文字）                |
  
4. 緑の `**Run workflow**` を押す。

**確かめ方**

- 全ステップが緑になること。
- 最後の「未適用の一覧（適用後）」が **0 件**になっていること。
- 成果物に `d1-backup-dev-<番号>` が残っていること（30 日保管）。

**落ちたとき**: 画面に出ているメッセージ**だけ**を連絡してください（鍵の値は貼らないでください）。

> 本番（`production`）への適用は、dev で通ってから同じ手順で行います。
> **順番は常に「データの形の変更 → 公開」です。** 逆にすると、新しいコードが
> まだ存在しない列を読んで本番が全面エラーになります。

---

## S-11. main へのマージで公開が通ることを見る 〔bd: ah-08q〕

**目的**: 「手元から公開する」状態を終わらせる。ここまで来ると、
未コミットの書きかけが本番へ出る余地が構造的に消えます。

**手順**

1. `main` へ何か 1 つマージする（内容は何でも構いません）。
2. [https://github.com/daishiman/affiliate-hub/actions](https://github.com/daishiman/affiliate-hub/actions) を開く。
3. 「公開」の実行が始まり、`production` 環境で**承認待ちで止まる**（S-09 の設定が効いている証拠）。
4. `**Review deployments**` を押し、`production` にチェック → `**Approve and deploy**`。
5. 最後まで緑になることを見る。

**確かめ方**

- Actions が最後まで緑。
- `v<番号>` のタグが打たれている。
- [https://affiliate-hub.daishimanju.workers.dev](https://affiliate-hub.daishimanju.workers.dev) を、**時間を空けて 2 回**開く。
  > 1 回で判定しないでください。Cloudflare Workers は古い実行環境を
  > 数十秒〜2 分ほど残すため、1 回目は「直っているのに直っていない」ように見えます。

**この時点で ah-08q は完了です。**

---

## S-12. `MCP_TOKEN` を登録する 〔bd: ah-p9e〕

**目的**: AI から操作するときの合言葉を置く。未登録のあいだ、その口だけ閉じており
（fail-closed）、公開後の動作確認が **503** で赤くなります。壊れているのではありません。

**入れる値**: ご自身で決めた長い文字列（32 文字以上を推奨）。

**手順**

```
pnpm exec wrangler secret put MCP_TOKEN --env production
pnpm exec wrangler secret put MCP_TOKEN --env dev
```

**聞かれてから**貼り付けてください。コマンドの後ろに値を書かないこと。

**確かめ方**: `pnpm exec wrangler secret list --env production` に `MCP_TOKEN` が並ぶこと。

---

## S-13. 生成 AI の API キーを発行し、支出上限を掛ける 〔bd: ah-ag8〕

**目的**: 記事の下書きを作れるようにする。

**4 社そろえる必要はありません。1 社登録すれば、その社で下書きが作れます。**
迷ったら **Anthropic（Claude）** から始めてください。

**鍵を発行する場所**


| 提供元               | 鍵の発行                                                                                       | 支出上限の設定                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Anthropic（Claude） | [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | [https://console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits)                       |
| Google（Gemini）    | [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)                   | Google Cloud の請求先 → **予算とアラート**                                                                                      |
| OpenAI            | [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)               | [https://platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits) |
| xAI（Grok）         | [https://console.x.ai/](https://console.x.ai/)                                             | 同画面内の課金設定                                                                                                            |


**手順（Anthropic の例）**

1. [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) を開く。
2. `**Create Key**` を押す。名前は `affiliate-hub` など任意。
3. 表示された鍵をコピーする（**この画面を閉じると二度と表示されません**）。
4. [https://console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits) を開き、**月あたりの上限**を設定する。
  > **提供元側の上限を必ず掛けてください。** アプリ側にも上限はありますが、
  > 不具合ですり抜けることがあります。提供元側の上限はすり抜けません。
5. コピーした鍵を持ったまま S-14 へ進む。

**やらないこと**: 鍵をチャットに貼る／ファイルに書く／コマンドの引数に書く。

---

## S-14. 管理画面から鍵を貼り、接続を確認する 〔bd: ah-ag8〕

**前提**: S-05（金庫の合言葉）が済んでいること。済んでいないと**貼る欄が出ません**。

**手順**

1. `pnpm run preview` を実行し、[http://localhost:8787/admin/settings/llm](http://localhost:8787/admin/settings/llm) を開く
 （本番で行う場合は [https://affiliate-hub.daishimanju.workers.dev/admin/settings/llm](https://affiliate-hub.daishimanju.workers.dev/admin/settings/llm)）。
2. ログインする。
3. 提供元（例: `Anthropic`）の欄に、S-13 でコピーした鍵を貼り付ける。
4. `**保存**` を押す。
5. その場に出る `**接続を確認する**` を押す（ごく短い問い合わせを 1 回だけ送ります）。

**確かめ方**

- 「確認できました」の表示が出ること。
- 一覧に**末尾 4 文字だけ**が表示されること（全体が見えたらそれは不具合です。連絡してください）。

**登録した鍵がどうなるか**（すべて検査で毎回確かめています）

- 暗号化して保管し、そのままの形ではどこにも保存しません
- 保存後は二度と表示しません（再表示する口を作っていません）
- 操作の記録にも、AI へ渡す文にも、提供元のエラー本文にも混ざりません
- 失効させると、保管していた値もその場で消えます

---

## S-15. 未ログインで鍵の登録画面の断りを目で見る 〔bd: ah-f7v〕

**目的**: 断りの文が「画面の読める場所に、読める大きさで」出ているかを人の目で確かめる。
文字列が返ることはテストで固定済みですが、**どこにどう出るかは誰も見ていません**。

**この作業でコードは書きません。本物の鍵も要りません**（断られる側を見るので、値は先へ届きません）。

**手順**

1. `pnpm run preview` を実行する。
2. **ログインしていない状態**で [http://localhost:8787/admin/settings/llm](http://localhost:8787/admin/settings/llm) を開く
 （既にログイン済みならプライベートウィンドウで開く）。
3. **鍵の登録**を試す（欄は空のままで構いません）。
4. **鍵の失効**を試す。
5. **接続の確認**を試す。

**確かめ方**: 3 つとも断られ、**断る理由が画面で読める場所に出ている**こと。

**記録**: 見た結果を 1 行で書き残してください（読めた／読めなかった、どこに出たか）。
書く場所は `docs/product/backlog.md`。読めなかった場合は、その画面の名前を連絡してください。

---

## S-16. `/admin/generation` にモデルが並ぶのを目で見る 〔bd: ah-1j5〕

**目的**: 設定した目録が**画面まで届いている**ことを 1 度だけ実測する。
テストが緑なことと、実物が正しいことは別です。

**前提**: S-13・S-14 で 1 社以上の鍵が登録されていること
（鍵が無いと、下の 1 と 3 の区別が付きません）。

**手順**

1. `pnpm run preview` を実行する。
2. サインインする（**ログインを迂回しないでください**。迂回した経路で見えたことは、
 利用者が通る経路で見えることの証拠になりません）。
3. [http://localhost:8787/admin/generation](http://localhost:8787/admin/generation) を開き、次の 3 点を見る。
  
  | #   | 見るもの                     | 期待                          |
  | --- | ------------------------ | --------------------------- |
  | 1   | 鍵を登録した提供元のモデル            | 並ぶこと（「選べるモデルがありません」にならない）   |
  | 2   | 単価の通貨                    | **USD のまま**出ていること（円に化けていない） |
  | 3   | `workers_ai`（Workers AI） | **理由つきで**選べないと言うこと          |
  

   参考（`config/llm-provider-catalog.json` の現在の中身・全 6 モデル）:
   `claude-opus-5` / `claude-sonnet-5` / `gemini-3.5-flash` /
   `gpt-5.6-sol` / `gpt-5.6-luna` / `grok-4.6`

**確かめ方**: 3 点それぞれの結果を、**実施日つきで** `docs/product/backlog.md` の項目 67 に書く。
食い違いがあったら、そこで別の課題として起票します（連絡してください）。

**注意**: 画面の写しを共有するときは、**鍵の値が写り込んでいないこと**を確かめてください。

---

## S-17. 本番用の Google 設定を追加する 〔bd: ah-361〕

**前提**: S-04 で dev 側のログインが確認できていること。

**手順**

```
node .better-auth-google/setup-secrets.mjs --prod
```

S-03 と同じ 3 つを聞かれます。**同じ値**を貼り付けてください
（S-02 の画面から何度でも見られます）。

**確かめ方**

```
pnpm exec wrangler secret list --env production
```

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` が名前だけ並ぶこと。
そのあと [https://affiliate-hub.daishimanju.workers.dev/admin](https://affiliate-hub.daishimanju.workers.dev/admin) を開き、
ログイン画面が出ることを見てください。

---

## S-18. リポジトリを非公開にする（任意）＋使用量監視のトークン 〔bd: ah-xp8〕

**この作業は「非公開にする」と決めたときだけ行います。** 公開のあいだは着手しません。
公開リポジトリでは GitHub Actions が**無料・無制限**で、見張る対象そのものが存在しないためです
（無理に入れると、常に 0% を報告し続ける落ちない見張りになります）。

**手順（非公開化）**

1. [https://github.com/daishiman/affiliate-hub/settings](https://github.com/daishiman/affiliate-hub/settings) を開く。
2. 最下部の `**Danger Zone**` → `**Change repository visibility**` → `**Change visibility**`。
3. `**Make private**` を選び、確認欄にリポジトリ名 `daishiman/affiliate-hub` を入力して実行。
  > 非公開にすると、S-09 で設定した `**Required reviewers`（承認して本番へ出す）が
  > 無料プランでは使えなくなります。** 承認の門を残したい場合は、公開のままにするか、
  > 有料プランを検討してください。ここは失って気づきやすい設定です。

**手順（使用量監視のトークン）**

4. [https://github.com/settings/tokens](https://github.com/settings/tokens) を開く。
5. `**Generate new token**` → `**Generate new token (classic)**` を選ぶ。
6. 次のとおり設定する。
  
  | 項目            | 値                             |
  | ------------- | ----------------------------- |
  | Note          | `affiliate-hub actions usage` |
  | Expiration    | 90 日（期限なしにしない）                |
  | Select scopes | `**read:user**` のみ            |
  
7. `**Generate token**` を押し、表示された値をコピーする（**再表示されません**）。
8. [https://github.com/daishiman/affiliate-hub/settings/secrets/actions](https://github.com/daishiman/affiliate-hub/settings/secrets/actions) で
 `**New repository secret**` を押し、次を登録する。
  
  | Name                  | Secret    |
  | --------------------- | --------- |
  | `ACTIONS_USAGE_TOKEN` | 7 でコピーした値 |
  
9. 登録が済んだら連絡してください。**使用量を見るワークフローはこちらで作ります**
 （月 2,000 分の 70% で警告、90% で失敗。しきい値は `quality-gates.config.mjs` に 1 箇所だけ置きます）。

---

## S-19. ASP 各社の API 利用申請を出す 〔bd: ah-dtq〕

**目的**: 成果（発生した報酬）を自動で取り込めるようにする。

**この作業は待ち時間が長く（社によって数日〜数週間）、こちらでは短縮できません。**
早めに出しておくと、実装が終わったときに待たずに繋げます。

**手順**

1. 各社の管理画面にログインし、API 利用の申請ページを開く。
2. 申請フォームを提出する。用途は「自社サイトの成果集計」と書けば通常は足ります。
3. **審査の結果、発行された ID とキーの値はここへ書かないでください。**
 発行されたら「◯◯社の発行が済みました」とだけ連絡してください。
 登録先（環境変数の名前）はこちらから個別にご案内します。

**注意**: 各社の管理画面の URL と申請の導線は変わりやすいため、
このファイルには固定の URL を書いていません。ログイン後の
「API」「開発者」「外部連携」といった名前のメニューを探してください。

---

## 全体を通してやらないでいただきたいこと

- 鍵をチャットに貼る（AI に渡す）
- 鍵をリポジトリの中のファイルに書く
- 鍵をコマンドの**引数**として打つ（`wrangler secret put NAME 値` の形。履歴に残ります）
- スクリーンショットに鍵が写った状態で共有する
- S-16 でログイン画面を迂回して確かめる

**うっかり渡してしまった場合は、その鍵を失効させて作り直してください。**
「消したので大丈夫」とは考えないでください。作り直すのが唯一の確実な対処です。
責めるつもりはまったくありません。

---

## 対応表（このファイルと課題・正本の対応）


| 番号               | 課題     | 正本                                              |
| ---------------- | ------ | ----------------------------------------------- |
| S-02〜S-04, S-17  | ah-361 | `tasks/feat-auth-workspace/`                    |
| S-05, S-13, S-14 | ah-ag8 | `tasks/task-llm-provider-connection.md`         |
| S-06〜S-11        | ah-08q | `tasks/task-deploy-credentials-registration.md` |
| S-12             | ah-p9e | `tasks/task-mcp-bearer-identity.md`             |
| S-15             | ah-f7v | `tasks/task-llm-settings-auth-gate-eyes.md`     |
| S-16             | ah-1j5 | `tasks/task-model-catalog-screen-check.md`      |
| S-18             | ah-xp8 | `tasks/task-actions-usage-monitor.md`           |
| S-19             | ah-dtq | `tasks/task-integration-key-action-gate.md`     |


