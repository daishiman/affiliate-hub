# feat-auth-workspace 運用手順（runbook）

- graph_node_id: `SYS-AUTH-WORKSPACE-P12`
- 最終更新: 2026-08-24
- 位置づけ: **派生文書（非規範）**。規範は確定済み仕様章（auth / security / database）と
  `docs/spec/01-要求仕様書-v1.0.md` §25〜§26 にある。値が食い違ったら上流を正とする。
- 対になる文書: [`handover.md`](./handover.md)（引き継ぎ・直っていないもの・確かめていないもの）

対象は `feat-auth-workspace`（Google でログインし、作業場所（Workspace）とブランドを持ち、
すべてのデータが `workspace_id` で分かれ、役に応じて操作が止まる、の 4 つ）。

## 0. この文書が答えること／答えないこと

答えるのは 4 つ。

1. **Better Auth の追従を、誰が・いつ・何を見て・何をするか**（§2）
2. Google 側の設定に要る**項目の名前**（§3。**値は書かない**）
3. **ログインできない／セッションが壊れた**ときの切り分け（§4・§5）
4. **他の作業場所のデータが見えている疑い**が出たときの確かめ方（§6）

**引き継ぎ（直っていないもの・確かめていないもの・次に着手すべきもの）は
[`handover.md`](./handover.md) が持つ。** ここには書かない。
運用の手順と「いま何が欠けているか」を同じ文書に混ぜると、
欠けが埋まったときにどちらを直せばよいかが分からなくなる。

答えないもの（先に書く）。

- **鍵の値そのもの**。この文書にも、この文書が指示するコマンドの引数にも、
  秘密の値は 1 つも現れない。値はご本人がブラウザか、ご自身のターミナルで
  「聞かれてから」入れる（§3）。
- **初回の登録手順**。それは `docs/product/setup-tasks.md` の S-01〜S-04 と
  `docs/product/credential-registration.md` の C 節が持つ。ここはその**後**の話である。
- **最初の運営者 1 行の入れ方**。`docs/product/first-owner-row.md` が持つ。
- **設計の理由**。`docs/spec/feat-auth-workspace/architecture-design.md`（D-01〜D-10）が持つ。

### 読む順番（初めてこの担当を引き継いだ人へ）

| 知りたいこと | 開く場所 |
| --- | --- |
| なぜこの作りなのか | `docs/spec/feat-auth-workspace/architecture-design.md` |
| 何が満たされたら合格なのか | `docs/spec/feat-auth-workspace/requirements-baseline.md` |
| まだ登録が済んでいない設定はどれか | `docs/product/setup-tasks.md`（S-01〜S-19 の表） |
| いま管理画面がどれだけ開いているか | `docs/product/open-doors.md` |
| 本物のランタイムで何を確かめ済みか | `docs/product/runtime-verification.md` |

---

## 1. 仕組みの地図（引き継ぐ人が最初に持つべき像）

**入口は 2 段ある。片方だけでは入れない。**

```
Google でログイン
   │
   ├─① 名簿          AUTH_ALLOWED_EMAILS に、そのアドレスが載っているか
   │                  （載っていなければ、通行証を作らずに断る）
   │
   └─② 担当者の行     memberships に、そのアドレスの行があるか
                      （無ければ、Better Auth 側のセッションも消して断る）
        │
        ↓
   この製品の通行証（cookie `ah_session`／`sessions` 表）が出る。有効期限 12 時間
        │
        ↓
   /admin 配下は src/middleware.ts が「通行証があるか」だけを見る（役は見ない）
        │
        ↓
   役の判定は各ユースケース入口の requireCapability が 1 か所で行う
```

覚えておく点を 3 つだけ。

- **Better Auth のセッションは、この製品の通行証ではない。** 前者は Google と往復する
  ための足場で、権限の判断には使わない。画面が見るのは `ah_session` の方である。
- **権限は `memberships` から都度引く。** 通行証の中に役は入っていない。
  だから担当を外した瞬間に効く（トークンの期限切れを待たない）。
- **確かめられないときは通さない。** 保存先（D1）へ届かないとき、入口は
  「たぶん本人だろう」で通さずログイン画面へ戻す。これは仕様であって障害ではない
  （§5 でこの 2 つを見分ける）。

### 関わるファイル

| 役目 | 場所 |
| --- | --- |
| 画面の入口（守る範囲の指定） | `src/middleware.ts` |
| 入口の判定（通す／戻す） | `src/infrastructure/identity/entry-gate.ts` |
| Google との接続と、断る関門 | `src/infrastructure/identity/better-auth.ts` |
| 通行証の発行・失効 | `src/infrastructure/identity/session-issuer.ts` |
| Better Auth が要る表の形 | `src/db/auth-schema.ts`（**手で書き写した写し。§2 参照**） |
| 形を出すためだけの設定 | `src/auth.cli.ts`（実行時には誰も読まない） |
| 役と操作の対応表 | `src/domain/identity/permissions.ts` |
| 作業場所の照合 | `src/domain/shared/tenancy.ts` |
| 表（`sessions` / `memberships` / `signin_denials` / `workspaces`） | `src/db/schema.ts` |

---

## 2. Better Auth の追従

### なぜ止められないのか

Better Auth を選んだ理由は「費用ゼロ・ロックインなし」である
（確定済み仕様章の `decision-auth-method`。要求ベースラインにも写してある）。
**追従を止めた時点で、この採用理由が消える。**
古い版に留まった認証基盤は、費用ゼロでもロックインなしでもなく、
ただ「直せない場所」になる。だから追従は機能追加ではなく、**採用条件の維持**である。

### 追従を怠ると実際にどう壊れたか（2026-08-21 の実測）

Better Auth 1.7.0 は「誰が発行したか（`issuer`）」と「相手の識別子（`account_id`）」の
組で持ち主を引く。`account` 表にその列が無く、SQL が `no such column: issuer` で落ちた。

落ち方が悪い。

- 画面に出るのは `internal_server_error` だけ。**列名はどこにも出ない**
- トークンの交換自体は成功しているので、「鍵が違う」ようにも見えない
- 当時 Better Auth 自身の記録は 1 行も出ていなかった（`logger.log` を実装していなかった）

直したのが `drizzle/0018_lean_valkyrie.sql`（`account.issuer` の追加）である。
**版を上げるとは、コードだけでなく表の形を合わせることを含む。**

### 誰が

`daishiman`（この製品の運営者は 1 人）。代わりに走る自動の仕組みは**無い**。
Dependabot も Renovate も設定していない（2026-08-24 時点で `.github/dependabot.yml` は存在しない）。
**誰も打たなければ、この手順は一度も走らない。**

### いつ（3 つの場面。日付では決めない）

| # | 打つ場面 | なぜその場面か |
| --- | --- | --- |
| **T1** | **本番へ公開すると判断する日**（必須） | `docs/product/open-doors.md` と深い門を見る回と**同じ回**に含める。公開の判断に要るものを 1 回で揃えるため。別の日に分けると「今日はどっちを見る日だったか」を覚えている人が要る |
| **T2** | **ログインが通らなくなったとき**（§4 の切り分けで原因が分からなかったとき） | 上の障害はこの形で出た。§4 を一巡して原因が挙がらなかったら、次は版の差を疑う |
| **T3** | `@better-auth/cli` が **1.7 以上に追いついた**と分かったとき | 下記「いま塞がっている道」が開く。開いたら手写しをやめて CLI へ戻す |

「定期的に確認する」とは書かない。日付で決めた確認は、忙しい週に 1 回飛ばした時点で
飛ばしたことすら残らない。上の 3 つは**必ず誰かが立ち会う場面**である。

### 何を見るか（4 か所。この順に）

```
# ① いま入っている版と、公開されている最新版
pnpm list better-auth
pnpm view better-auth version

# ② 変更点（表の形が変わったかを最初に読む）
#    https://github.com/better-auth/better-auth/releases

# ③ 要る表の形の「唯一の正解」
#    node_modules/@better-auth/core/dist/db/get-tables.mjs の buildAuthTables
#    → src/db/auth-schema.ts と読み比べる（列名・NOT NULL・一意索引まで）

# ④ 生成の道が開いたか
pnpm view @better-auth/cli version      # 1.7 以上になっていれば T3
```

**2026-08-24 の実測値**（この日に上のコマンドを実際に打った結果）:

| 見たもの | 値 |
| --- | --- |
| `package.json` の指定 | `better-auth: ^1.7.0` |
| `node_modules` に入っている版 | `1.7.0` |
| レジストリの最新版 | `1.7.1`（**未追従。差分の中身は未確認**） |
| `@better-auth/cli` の最新版 | `1.4.21`（**本体 1.7 に追いついていない**） |

### いま塞がっている道（これを知らずに走らせると壊す）

本来、表の形は Better Auth の CLI に出させるべきものである。

```
pnpm dlx @better-auth/cli@latest generate --config src/auth.cli.ts \
  --output src/db/auth-schema.ts --yes
pnpm drizzle-kit generate
```

**この 2 行を、いま走らせてはいけない。** CLI は 1.4 系で止まっており、
走らせると 1.4 の形が出る。1.7 で必須の `account.issuer` が**黙って消え**、
上の障害がそのまま再発する。`src/auth.cli.ts` の冒頭にも同じ注意が書いてある。

**CLI が 1.7 以上になるまで、正解の出どころは `buildAuthTables` だけ**であり、
`src/db/auth-schema.ts` はそれに手で合わせてある。

### 版を上げる手順

1. 上の ①〜④ を見る。**表の形が変わっていないなら 2 へ、変わっていたら 3 へ**
2. `pnpm add better-auth@<版>` → `pnpm run verify` → 4 へ
3. `node_modules/@better-auth/core/dist/db/get-tables.mjs` の `buildAuthTables` と
   `src/db/auth-schema.ts` を読み比べ、**足りない列・索引を手で足す**。
   そのうえで `pnpm run db:generate`（drizzle のマイグレーションを作る）
4. `pnpm vitest run tests/infrastructure/better-auth-gate.test.ts` が緑
5. `pnpm run db:migrate:dev` で dev の D1 へ形を当てる
6. **dev で実際に 1 回ログインする。**（4 と 5 が緑でも、ここが本番）
   `pnpm exec wrangler tail --env dev` を別のターミナルで開いたまま行い、
   `[auth]` で始まる行が出ていないことを見る
7. 本番へは、dev で 6 が通ってから（`pnpm run db:migrate:prod` → 公開）

**5 を飛ばして公開してはいけない。** 形の変更が本番の D1 に届く前にコードが出ると、
ログインが全面的に落ちる。`deploy.yml` は移行が追いつく前の公開を止めるようになっているが、
**それに頼らず手順の側でも順序を守る**（機械の門は、条件が合わない日に外される）。

### 追従の記録

**やった日を書き残す。** 書かないと「前回いつ見たか」を覚えている人が要る。

| 日付 | 見た版 → 上げた版 | 表の形の変更 | dev で実ログインまで確認したか | 打った場面 |
| --- | --- | --- | --- | --- |
| 2026-08-21 | 1.7.0（据え置き） | `account.issuer` を追加（`drizzle/0018`） | 済（この障害の修正そのもの） | T2 |
| 2026-08-24 | 1.7.0 → 上げていない | 未確認（1.7.1 の差分を見ていない） | 実施していない | 本文書の作成時 |

---

## 3. Google 側の設定に要る項目

**この節に値は 1 つも書かない。書ける場所でもない。**
値の登録はご本人がブラウザとご自身のターミナルで行う。手順は
`docs/product/setup-tasks.md` の S-02・S-03（dev）と S-17（本番）にある。
ここに置くのは**名前の一覧**だけである。名前が分かれば、何が抜けているかを言える。

### Google Cloud の画面で作るもの

| 作るもの | 種類 | 備考 |
| --- | --- | --- |
| OAuth クライアント | **ウェブ アプリケーション** | https://console.cloud.google.com/auth/clients |
| 承認済みのリダイレクト URI | 4 本（下記） | Google は完全一致しか見ない。末尾のスラッシュ 1 文字でも弾かれる |

```
https://affiliate-hub.daishimanju.workers.dev/api/auth/callback/google
https://affiliate-hub-dev.daishimanju.workers.dev/api/auth/callback/google
http://localhost:8788/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

（これらは秘密ではない。公開の URL である。）

### アプリ側に要る設定の名前（5 つ）

`src/infrastructure/identity/better-auth.ts` の `readAuthConfig` が読む名前と、
1 つでも欠けたときに返る名前は同じである。**画面に「使えません」とだけ出す作りにしていない。**

| 名前 | 何を入れるか | 秘密か | 誰が入れるか |
| --- | --- | --- | --- |
| `BETTER_AUTH_URL` | この環境の住所（環境ごとに決まっている） | いいえ | `setup-secrets.mjs` が自動で入れる |
| `BETTER_AUTH_SECRET` | 署名に使う値 | **はい** | `setup-secrets.mjs` が**自動で作る**（人は見ない・用意しない） |
| `GOOGLE_CLIENT_ID` | Google の画面の値（`.apps.googleusercontent.com` で終わる） | 実質、扱いは秘密に寄せる | **ご本人**（聞かれてから貼る。画面に文字は出ない） |
| `GOOGLE_CLIENT_SECRET` | Google の画面の値 | **はい** | **ご本人**（同上） |
| `AUTH_ALLOWED_EMAILS` | 入ってよい人のアドレス。カンマ・読点・空白のどれで区切ってもよい | いいえ | **ご本人**（画面に出る） |

**登録に使う道具**（値はコマンドの引数に置かず、標準入力から渡す作りになっている）:

```
node .better-auth-google/setup-secrets.mjs           # 手元 + dev
node .better-auth-google/setup-secrets.mjs --prod    # 手元 + 本番
node .better-auth-google/setup-secrets.mjs --local-only   # 手元だけ
```

**やってはいけないこと**（どれも、消したつもりでも残る）:

- 値をチャットや issue や PR の本文へ貼る
- `wrangler secret put NAME 値` のように、コマンドの後ろに値を書く
  （`secret put NAME` だけを打ち、「Enter a secret value:」と聞かれてから貼る）
- 値をファイルに書いて `git add` する（`.dev.vars` は追跡から外れているが、
  外れていることを毎回確かめるより、そもそも別のファイルを作らない方が安全）

登録できたかを確かめるのに**値を見る必要はない**。名前が揃っているかだけを見る。

```
pnpm exec wrangler secret list --env dev
pnpm exec wrangler secret list --env production
```

（この出力に値は出ない。名前と更新日時だけである。）

### 名簿を直しても、それだけでは入れない

`AUTH_ALLOWED_EMAILS` は「Google の確認を通してよいか」しか決めない。
**役は `memberships` の行が決める。** 片方だけ直して「登録したのに入れない」に
なる形が、断りの理由 `no_membership` である（§4）。

---

## 4. ログインできないときの切り分け

**症状はほぼ 1 種類しかない。「押しても `/signin` へ戻る」である。**
原因を画面から読み取れないのは仕様である（どの設定が抜けているかを、
入ろうとした人へ教えないため）。だから**運用する側は記録を見る**。

### 見る順番

**手順 1: 断った記録を見る。** ここに行があれば、壊れているのではなく**断っている**。

```
pnpm exec wrangler d1 execute DB --env dev --remote --command \
  "SELECT at, email, reason FROM signin_denials ORDER BY at DESC LIMIT 10"
```

| `reason` | 意味 | 直し方 |
| --- | --- | --- |
| `not_allowed` | 名簿（`AUTH_ALLOWED_EMAILS`）にそのアドレスが無い | 名簿へ足す（§3）。**足したら Worker を再デプロイするまで効かない** |
| `email_unverified` | Google 側でメールが確認済みになっていない | Google アカウント側の問題。こちらでは直せない |
| `no_membership` | 名簿は通ったが、`memberships` に行が無い | 招待の行を入れる（`docs/product/first-owner-row.md`） |

**手順 2: 断りの記録が 0 行なら、Google との往復の手前で落ちている。**

```
pnpm exec wrangler tail --env dev --format pretty
```

その状態でログインを 1 回試し、`[auth] ログインの往復が失敗しました:` の行を探す。
**`message` だけでなく、そのあとに続く値まで読む。** 2026-08-21 の障害では
`message` は「データベースに問い合わせられませんでした」までしか言わず、
原因（`no such column: issuer`）は後続の値の側にあった。

`no such column` / `no such table` が出たら → **§2 の版の差**を疑う。
`redirect_uri_mismatch` が出たら → §3 の URI 4 本を 1 文字ずつ見比べる。

**手順 3: 設定名の欠け。** `readAuthConfig` は欠けた名前を必ず返す。
`wrangler secret list`（§3）で 5 つの名前が揃っているかを見る。
**dev と本番は別々に登録する。** 片方だけ登録した状態は普通に起こる。

**手順 4: 通行証は出たが、すぐ切れる。** 有効期限は 12 時間である
（`APP_SESSION_TTL_MS`）。それより早く切れるなら `revoked_at` を見る。

```
pnpm exec wrangler d1 execute DB --env dev --remote --command \
  "SELECT user_id, workspace_id, created_at, expires_at, revoked_at FROM sessions ORDER BY created_at DESC LIMIT 5"
```

**`token_hash` は SHA-256 で潰した値である。** ここに出るものから、
その人になりすますことはできない。逆に「この人の通行証はどれか」を
利用者から聞いた文字列で引くこともできない。

---

## 5. D1 へ届かないときの見分け

**「まだログインしていない」と「保存先が落ちていた」は、画面で見分けられない。**
どちらも同じログイン画面になる。これは既知の穴であって、直っていない
（[`handover.md`](./handover.md)）。

見分けるのは運用する側の仕事になる。

| 確かめること | 打つもの | 読み方 |
| --- | --- | --- |
| D1 に届くか | `pnpm exec wrangler d1 execute DB --env dev --remote --command "SELECT 1"` | 落ちれば、入口が全員を断っているのは仕様どおりの動作 |
| 表の形が当たっているか | `pnpm exec wrangler d1 migrations list DB --env dev --remote` | 未適用が残っていれば `pnpm run db:migrate:dev` |
| 手元（preview）で見るとき | `sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite "SELECT count(*) FROM sessions"` | preview を**止めてから**読む |

**手元の preview の入口は `localhost:8788` である。8787 ではない。**
8787 を叩いて「つながらない＝壊れている」と読み違えないこと
（`docs/product/runtime-verification.md` の実測）。

**入口が全員を断ることは、故障ではなく設計判断である**（D-02）。
ここを「届かないなら通す」に変えると、**保存先を落とすだけで門を外せる**ことになる。
障害のときに一時的に開ける、という運用も作らない。

---

## 6. 作業場所の分離が疑われるとき

「他の人のデータが見えている」という申告が来たときの確かめ方。
**画面のスクリーンショットで判断しない。** 見えているものが本当に他所のものか、
同じ作業場所の別ブランドかは、見た目では区別が付かない。

### 手順 0: その表が `workspace_id` を持っているかを、先に見る

**すべての表が `workspace_id` を持っているわけではない。**
2026-08-24 に `src/db/schema.ts` を数えたところ、持っているのは **26 表**である
（`published_articles` / `audit_logs` / `telemetry_events` / `memberships` /
`sessions` / `feedback_reports` / `affiliate_links` ほか）。

一方 `articles` `products` `programs` `asps` `categories` は**持っていない**。
これらを「分離が漏れている」と読まないこと。分離の単位がそこに無いだけで、
公開された姿（`published_articles`）の側に `workspace_id` が付いている。

```
grep -n 'workspace_id"' src/db/schema.ts
```

### 手順 1: どの作業場所のものかを、データの側で確かめる

```
pnpm exec wrangler d1 execute DB --env dev --remote --command \
  "SELECT site_slug, slug, workspace_id FROM published_articles WHERE slug = '<申告された slug>'"

pnpm exec wrangler d1 execute DB --env dev --remote --command \
  "SELECT workspace_id, roles, revoked_at FROM memberships WHERE invited_email = '<申告者のアドレス>'"
```

2 つの `workspace_id` が**一致していれば、漏れていない**。
一致していなければ、そこから先が本題である。

### 手順 2: 応答の形を見る（漏れの向きを決める）

他所の作業場所の ID を指したとき、**存在しない ID と同じ「見つかりません」**が返るのが
正しい姿である（AWS-ACC-02）。`403` が返っていたら、それ自体が漏れである
（「在るが見せない」は、**在ることを教えている**）。

自分の作業場所の中で権限が足りないときの `403` は、これとは別物であり正しい（D-05）。
**2 つを混ぜて「全部 404 にする」方向へ直さない。** 全部を断る壊れ方は、
拒否だけを見るテストに対して緑になる。

### 手順 3: 検査を打つ

```
pnpm vitest run tests/architecture/tenant-scoped-ports.test.ts
pnpm vitest run tests/acceptance/feat-auth-workspace
pnpm vitest run tests/application/manage-workspace.test.ts
```

**これらが緑でも、漏れていないことの証明にはならない。**
`tenant-scoped-ports.test.ts` が見るのは port の**署名**であって、
実装の SQL に `where workspace_id` が実際に付いているかではない
（設計文書がこの限界を明記している）。署名は正しいまま、
`workspaceId` に「実行者のもの」ではなく「引数から来た値」を渡せば抜ける。

### 手順 4: 疑わしい読み出しを名指しで見る

```
grep -rn "workspaceId" src/infrastructure/persistence/d1/ | grep -v "eq(" | head -40
```

`workspaceId` を受け取っているのに `where` の条件に使っていない箇所を探す。
**これは目視であって検査ではない。** 見落とす。見落とすことを前提に、
見つけた 1 件ごとに結合テスト（実 D1）を足す。

### 手順 5: 記録を見る

受け入れ条件（AWS-ACC-02）は「拒否は request ID 付きで監査に残る」ことを求めているが、
**`audit_logs` に request ID の列は無い**（2026-08-24 に `src/db/schema.ts` を確認）。
つまりこの条件はまだ満たされていない。いま引けるのは下の範囲までである。

```
pnpm exec wrangler d1 execute DB --env dev --remote --command \
  "SELECT occurred_at, workspace_id, action, actor_user_id, actor_is_ai, actor_identified,
          target_type, target_id FROM audit_logs ORDER BY occurred_at DESC LIMIT 20"
```

**`audit_logs` に「成功／失敗」の列は無い。** 残るのは「何が起きたか」であって、
断りの回数を数える表ではない。断ったログインは `signin_denials`（§4）の側にある。

**`actor_identified` が `false` の行に注意する。** それは「確かめていない身元による操作」で、
人の承認として数えてはいけない行である（過去に、未ログインの承認が
「anonymous という人が承認した」として人の承認に数えられていた実測がある）。

---

## 7. 引き継いだあとも、定期に緑を保つもの

| 見るもの | 打つもの | 目標 |
| --- | --- | --- |
| ひととおりの検査 | `pnpm run verify` | 全部緑 |
| 覆い（カバレッジ） | `pnpm run test:coverage` | 既定 **80%**（層別は `quality-gates.config.mjs` が持つ） |
| 深い門（3 段） | GitHub Actions の `nightly.yml` を手で起動 | 打つ場面は `nightly.yml` の冒頭が持つ（**定例は無い**） |
| 開いている入口の数 | `docs/product/open-doors.md` | 公開の判断と同じ回に見る |

カバレッジの数値目標を、この文書で変えない。変えるなら `quality-gates.config.mjs` を変える。

引き継ぎ事項（直っていないもの・確かめていないもの・次に着手すべきもの）は
[`handover.md`](./handover.md) にある。
