# feat-auth-workspace 品質・セキュリティ報告

- graph_node_id: `SYS-AUTH-WORKSPACE-P09`
- 前提: [`requirements-baseline.md`](./requirements-baseline.md)（AWS-ACC-01〜04）／[`architecture-design.md`](./architecture-design.md)（D-01〜D-10）
- 位置づけ: 派生文書（非規範）。規範は確定済み仕様章（auth / security / database）と `docs/spec/01-要求仕様書-v1.0.md` §25〜§26。

## この文書の読み方（先に書く）

**「対策済み」と書いてある行には、必ずそれを確かめたコマンドと出力の該当行が付いている。**
付いていない行は「未確認」と書いてある。ここを混ぜると、報告書そのものが嘘になる。

「未確認」は「危ない」という意味ではない。**この報告書を書いた時点では、確かめていない**という意味である。
危ないかどうかは確かめないと分からず、確かめていないことを「たぶん大丈夫」と書くのが最も危ない。

### 計測条件

| 項目 | 値 |
|---|---|
| 計測日時 | 2026-08-24 11:20〜11:27 JST |
| ブランチ | `daishiman/task20-2` |
| HEAD | `f34803a` |
| 作業ツリー | 未コミット変更あり（`git status --porcelain` で 44 件の変更 + 未追跡）|

**この計測は動いている的を撃っている。** 同じ作業ツリー上で他の作業が並走しており、
計測の最中に `src/presentation/http/error-response.ts` と
`tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` が実際に書き換わった。
よって以下の結果は**計測時点のファイルの指紋に紐づく**。指紋が変わっていたら測り直しが要る。

```
5bf50e0574fd395618e48d283569ff60f5d306ca163f181709a537987f0ca8e7  src/presentation/http/error-response.ts
ad9554c33707a3640ba69b4e5d376c1aba0fd2eb66633e4066cd47f32320d8eb  tests/acceptance/feat-auth-workspace/access-boundary.test.ts
edc84422ce0ec7b8fca82a8a861219f7afdfe6098e303518e3ab603c99ce61c0  tests/acceptance/feat-auth-workspace/brand-defaults.test.ts
11b5053bc8fe9cf9c0d597dd4f1eac01a011cd9620f85b39099da8c032a91c86  tests/presentation/error-format.test.ts
386b5cac00c8f75c2e8c4a6e307acafbce6b00961a70508c1a79228019f7d621  src/domain/identity/brand.ts
```

## 実測に使ったコマンドと結果

### 計測 A: 受け入れ条件に関わるテスト一式

```
pnpm vitest run \
  tests/acceptance/feat-auth-workspace/access-boundary.test.ts \
  tests/presentation/error-format.test.ts \
  tests/infrastructure/entry-gate.test.ts \
  tests/infrastructure/session-actor.test.ts \
  tests/domain/permissions.test.ts \
  tests/architecture/tenant-scoped-ports.test.ts \
  --reporter=verbose
```

出力の該当行:

```
 Test Files  6 passed (6)
      Tests  121 passed (121)
```

終了コード `0`。

> **パイプに通していない。** `| tail` などを挟むと終了コードがパイプ最後段のものに化けるため、
> 出力はファイルへ落として本文を読み、`echo "EXIT=$?"` を別に取った。

### 計測 B: AWS-ACC-03（ブランド既定値の配線）

```
pnpm vitest run tests/acceptance/feat-auth-workspace/brand-defaults.test.ts --reporter=verbose
```

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

終了コード `0`。

**11:22 の時点ではこのファイルは 1 件赤だった**（`ブランドを渡すと、設定した免責と呼びかけが入って生成まで進む`）。
並走している実装作業が 11:26 までに配線を通し、11:27 の再計測で緑になった。
赤→緑の遷移を見ているので、「もともと緑だった」のではなく**この作業で通った**ことが分かる。

### 計測 D: ログインの門（Better Auth + Google OAuth）

```
pnpm vitest run tests/infrastructure/better-auth-gate.test.ts --reporter=verbose
```

```
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

終了コード `0`。11:31:03 開始。

### 計測 C: 存在漏れを塞いだ処理への変異注入

計測 A の最中に、`maskExistence` が第三者の手で
`if (!EXISTENCE_HIDING_CODES.includes(error.code)) return error;` から
`if (true) return error;`（＝潰しを無効化）へ書き換わった状態が発生した。
**意図した変異注入ではないが、結果として最良の証拠になった**ので記録する。

```
pnpm vitest run tests/acceptance tests/presentation/error-format.test.ts tests/infrastructure tests/domain
```

```
 Test Files  2 failed | 64 passed (66)
      Tests  3 failed | 1468 passed (1471)
```

終了コード `1`。落ちた 3 件は以下で、**すべて存在漏れを見ている検査**である。

```
FAIL tests/presentation/error-format.test.ts > 他所のものと、そもそも無いものは、REST の本文まで同一
FAIL tests/presentation/error-format.test.ts > MCP の文面でも同一
FAIL tests/acceptance/feat-auth-workspace/access-boundary.test.ts > 他所の ID と、そもそも無い ID が、応答も本文も区別できない
```

差分の実物:

```
Expected: {"error":{"code":"NOT_FOUND","message":"記事 が見つかりません (id: obj-9999)。",...}}
Received: {"error":{"code":"TENANT_MISMATCH","message":"記事 が見つかりません。",...}}
```

**潰しを外すと 3 件が落ちる。** つまりこの 3 件は、飾りではなく実際に噛んでいる。
`maskExistence` を「うっかり戻す」ことはできない。

### 計測 E: この文書を足したことの副作用

`requirements-baseline.md` は「`docs/spec/**.md` を新設すると完全性レポートが STALE になる」という
副作用を踏んだことを記録している。**本文書も同じ位置に増えるので、実際に確かめた。**

```
pnpm vitest run tests/architecture/spec-doc-links.test.ts \
                tests/architecture/spec-freshness.test.ts \
                tests/architecture/qa-scope-notes-coverage.test.ts
```

```
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

終了コード `0`。**本文書の追加で落ちる門は無い。**

## 受け入れ条件ごとの現況

### AWS-ACC-01 未ログインで管理画面 → ログイン画面

| 項目 | 内容 |
|---|---|
| 状態 | **対策済み（ただし層は限定）** |
| 実装 | `src/middleware.ts`（配線）+ `src/infrastructure/identity/entry-gate.ts`（判定） |
| 根拠 | 計測 A。`tests/infrastructure/entry-gate.test.ts` 11 件緑 + `tests/acceptance/feat-auth-workspace/access-boundary.test.ts` の AWS-ACC-01 2 件緑 |

緑になったテスト名（出力から転記）:

- `どこを守るか > 管理画面は守る`
- `どこを守るか > 読者のページとサインイン画面は守らない`
- `どこを守るか > ログインの往復そのものは守らない`
- `どこを守るか > 名前が /admin で始まるだけの別の道は守らない`
- `通行証を見て、通すかどうか > 保存先へ届かないときは通さない`
- `通行証を見て、通すかどうか > 確かめる相手がいないときも通さない`
- `通行証を見て、通すかどうか > 役は見ない`
- `AWS-ACC-01 未ログインは入れない／ログイン済みは入れる > 守る道と守らない道が、どちらも意図どおり`
- `AWS-ACC-01 未ログインは入れない／ログイン済みは入れる > 通行証が無ければ戻し、有効なら通す（通す側が消えていないこと）`

「通す側が消えていないこと」を同じテストの中で見ているので、**入口を丸ごと閉じた壊れ方では緑にならない**。

**未確認**: これらが見ているのは `decideEntry` / `isGuardedPath` という**関数**であって、
`middleware.ts` を実際の HTTP 要求で通した結果ではない。
`grep -rln "middleware" tests/` の該当は `tests/architecture/open-doors.test.ts` の 1 件だけで、
これは静的検査である。**「`/admin` へ GET したら 302 が返り、本文が 1 バイトも出ない」を
実際の応答として確かめた記録は無い。** `pnpm run preview`（Workers ランタイム）上での確認は行っていない。

### AWS-ACC-02 別 Workspace のデータが取れない

| 項目 | 内容 |
|---|---|
| 状態 | **応答の形は対策済み。SQL の実体と監査は未確認** |
| 実装 | `src/domain/shared/tenancy.ts` の `assertSameTenant` / `src/presentation/http/error-response.ts` の `maskExistence` / `src/application/ports/**` の署名 |
| 根拠 | 計測 A（緑）+ 計測 C（変異で赤） |

緑になったテスト名:

- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 自分のものは取れる（全部 404 に倒していないこと）`
- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 他所のものは断られる`
- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 他所の ID と、そもそも無い ID が、応答も本文も区別できない`
- `エラーの種類ごとの番号（判定表） > TENANT_MISMATCH → 404`
- `エラーの種類ごとの番号（判定表） > 他の作業場所のものは「見つかりません」と同じ番号にする`
- `エラーの種類ごとの番号（判定表） > 他所のものと、そもそも無いものは、REST の本文まで同一`
- `エラーの種類ごとの番号（判定表） > MCP の文面でも同一`
- `保存先の入口は、必ず作業場所を伴う > 作業場所を伴わないメソッドは、理由つきで免除されたものだけ`
- `保存先の入口は、必ず作業場所を伴う > 免除の一覧に、もう要らないものが残っていない`
- `読者の身元は 1 か所でしか作らない > 読者の作業場所を名乗れるのは、身元を組み立てる 1 か所だけ`

**未確認（2 件、どちらも重い）**:

1. **実 D1 での `where workspace_id` の有無。** `tenant-scoped-ports.test.ts` は自身のコメントで
   「ここが見ているのは**宣言だけ**である。実際の SQL に workspace_id が付いているかは別の検査が見る。
   この検査が緑でも『テナント分離が済んだ』ことにはならない」と明記している。**その別の検査を実行していない。**
   実 D1 に他テナントの行を入れて取れないことを見た記録は、この報告書には無い。
2. **拒否の監査記録。** 要求ベースラインは AWS-ACC-02 の合格判定に
   「拒否は request ID 付きで監査に残る」を含めている。実測すると
   `src/domain/compliance/audit-log.ts` の `AuditLogEntry` に **`requestId` に相当する項目が無く**
   （`grep -n "requestId\|request_id"` の該当 0 件）、`AuditAction` の一覧に
   **アクセス拒否を表す語も無い**（`deny` / `denied` / `forbidden` の該当 0 件、
   `affiliate_link.rejected` は別件）。**つまりこの合格判定は現時点で満たしていない。**

### AWS-ACC-03 ブランドの標準 CTA・標準免責が生成の既定値になる

| 項目 | 内容 |
|---|---|
| 状態 | **対策済み（この作業で新規に通した）** |
| 実装 | `src/domain/identity/brand.ts` の `brandGenerationDefaults` / `withBrandDefaults` |
| 根拠 | 計測 B。10 件緑（11:22 時点は 1 件赤 → 11:27 緑） |

緑になったテスト名:

- `ブランドの標準値を生成の既定値に写す > 標準 CTA がそのまま呼びかけ文になる`
- `ブランドの標準値を生成の既定値に写す > 標準免責がそのまま広告表記になる`
- `ブランドの標準値を生成の既定値に写す > ブランドを切り替えると渡る値も切り替わる`
- `ブランドの標準値を生成の既定値に写す > 免責が未設定なら埋めない（空のまま生成へ進めない）`
- `呼び出し側が明示しなくても入る／明示したら勝つ > 何も渡さなくても呼びかけと広告表記が埋まる`
- `呼び出し側が明示しなくても入る／明示したら勝つ > 明示した値はブランドの標準値より優先される`
- `呼び出し側が明示しなくても入る／明示したら勝つ > ブランドが無いときは何も足さない`
- `生成ユースケースまで届いているか > ブランドを渡さなければ、免責が無いまま止まる`
- `生成ユースケースまで届いているか > ブランドを渡すと、設定した免責と呼びかけがそのまま指示文へ載る`
- `生成ユースケースまで届いているか > 指したブランドが無ければ、埋まらないまま止まる`

セキュリティ上の意味は「漏れない」ではなく**「設定漏れが設定済みに化けない」**である。
`disclaimer` が `null` のときに既定文で埋めていたら、
**広告表記を書いていない記事が、書いてあるように見えて公開まで通る**。
`免責が未設定なら埋めない` がこれを固定している。

### AWS-ACC-04 権限のないロールが公開操作 → 403

| 項目 | 内容 |
|---|---|
| 状態 | **判定は対策済み。監査は未確認** |
| 実装 | `src/domain/identity/permissions.ts` の `requireCapability` / `can` |
| 根拠 | 計測 A。`tests/domain/permissions.test.ts` 31 件緑 + 受け入れ 3 件緑 |

緑になったテスト名（抜粋）:

- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 分析だけの役は公開を断られる`
- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 同じ役でも、許された操作は通る（全部 403 に倒していないこと）`
- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 断られた本人が次に何をすればよいか分かる`
- `役割ごとに、持たないと決めたものを持っていないか > REQ-R08 analyst: content.write / content.publish / content.approve / affiliate.manage / improvement.run / improvement.approve を持たない`
- `AI に必ず断るもの（REQ-R10） > content.publish は AI では通らない（REQ-R10「公開」）`
- `渡したくないものが、ついでに渡っていないか > 公開担当は、本文を書き換えられない`
- `断り方 > 足りない権限の名前と、誰に頼めばよいかを言う`
- `断り方 > 持っているときは通す`
- `エラーの種類ごとの番号（判定表） > FORBIDDEN → 403`

「全部 403 に倒していないこと」を同じテストの中で見ているので、
**判定を全部 `false` にした壊れ方では緑にならない**。

権限の出どころが membership であること（設計判断 D-10）は
`tests/infrastructure/session-actor.test.ts` の以下 3 件で固定されている（計測 A で緑）:

- `合言葉から「いま操作している人」を決める > 権限は合言葉ではなく、担当者の登録から引く`
- `合言葉から「いま操作している人」を決める > 担当を外された人は、合言葉が生きていても操作できない`
- `合言葉から「いま操作している人」を決める > 担当者として登録が無ければ、権限を与えない`

**未確認**: 要求ベースラインが求める
「actor / workspace / action / result を含む監査記録が残る」は、**AWS-ACC-02 と同じ理由で満たしていない**。
拒否を表す `AuditAction` が存在しないため、403 になった事実そのものは監査ログに 1 行も残らない。

## 認証まわりで実測できた範囲

### 実測できたこと

| 対象 | 実測内容 | 根拠 |
|---|---|---|
| 通行証の照合 | 合言葉は平文ではなく潰した値で引く | 計測 A `合言葉の確かめ方 > 合言葉そのものではなく、潰した値で引いている` |
| 同上 | 同じ合言葉は同じ値、違う合言葉は違う値 | 同 `潰した値は毎回同じで、違う合言葉では違う値になる` |
| 期限 | 期限切れは行が残っていても無効 | 同 `期限が切れていれば、行が残っていても無効にする` |
| 失効 | 取り消した合言葉は期限内でも無効 | 同 `取り消された合言葉は、期限内でも無効にする` |
| 障害時 | 保存先が落ちたとき「未ログイン」に化けさせない | 同 `保存先が落ちたときは「ログインしていない」に化けさせない` |
| 入口 | 確かめられないときは通さない | 同 `保存先へ届かないときは通さない` / `確かめる相手がいないときも通さない` |

計測 D で緑になったもの（29 件。抜粋して意味を書く）:

| テスト名 | 固定していること |
|---|---|
| `許可の判定は閉じる側へ倒す > 名簿が空なら、誰も通さない` | 設定を消すことが認証を外す操作にならない |
| `許可の判定は閉じる側へ倒す > アドレスが無い・空のときも通さない` | 空値で素通りしない |
| `許可の判定は閉じる側へ倒す > 似ているだけのアドレスは通さない` | 部分一致で通らない |
| `通してよいかの門 > Google 側で確認できていないアドレスは通さない` | `emailVerified` を見ている |
| `通してよいかの門 > 相手が分からないときは通さない` | 「分からない＝たぶん本人」で通さない |
| `通してよいかの門 > 記録できなくても、断る判断は変えない` | 記録の失敗が門を開けない |
| `通してよいかの門 > 保存先が無いときも、断る判断は変えない` | 保存先を落として門を外せない |
| `通してよいかの門 > 2 回目以降でも、名簿から外れた人はそこで止まる` | 一度通った人が名簿から消えても止まる |
| `往復のあとに通行証を出す > 担当者でなければ、認証基盤側のログイン状態も残さない` | 断るときにセッションを作らない |
| `往復のあとに通行証を出す > 保存先が落ちたときは「担当ではない」として記録しない` | 障害を「担当ではない」に化けさせない |
| `往復のあとに通行証を出す > ログアウトでは、保存先の通行証を無効にして cookie も消す` | 片方だけ消える形にならない |
| `往復のあとに通行証を出す > 通行証が無い状態のログアウトでも、cookie は必ず消す` | 消し忘れの経路が無い |
| `設定の読み取り > 読み取った設定に秘密の値そのものを混ぜて返さない（足りない側の返り値）` | 設定不備の返り値から秘密が漏れない |
| `設定の読み取り > 名簿だけ空でも「使える」にしない` | 名簿の欠落を「準備完了」と言わない |

コード読取りで確認した設計（テストによる固定は別途）:

- `ah_session` の名前は `src/infrastructure/identity/session-actor.ts` の `SESSION_COOKIE_NAME` 1 箇所だけで定義され、`src/middleware.ts` がそれを参照している（`grep -rn "ah_session" src/` の該当 3 件はすべて定義かコメント）。
- Better Auth のセッションを通行証に流用していない。`src/infrastructure/identity/session-issuer.ts` が D1 の `sessions` へ潰した値だけを入れる。Better Auth 側は `token` を平文の unique 列で持つため、そのまま使うと表を読めた人がなりすませる。
- 通行証の有効期間は `APP_SESSION_TTL_MS = 12 * 60 * 60 * 1000`（12 時間）。
- 許可はドメインではなくアドレスの名指し（`AUTH_ALLOWED_EMAILS`）。**名簿が空のときは全員を断る**（`src/infrastructure/identity/better-auth.ts` の記述）。設定を消すことが認証を外す操作にならない向きになっている。
- 断った試みは `signin_denials` へ日時・アドレス・理由だけを残す。合言葉・トークン・Google の返り値は残さない。
- 担当者の登録が無い人には通行証を作らない（`SessionIssueOutcome` の `not_member`）。作ってから画面で断る形にしていない。

### 認証まわりで未確認のこと

- **Google との実際の往復を一度も通していない。** 計測 D が見ているのは、Better Auth が渡す文脈を偽物に差し替えた状態での判定である。実際の OAuth の応答、リダイレクト URI の一致、`BETTER_AUTH_SECRET` の実効性は、いずれも触れていない。
- **`ah_session` クッキーの属性は、値としては実装にあるが、その組み立てを見ている検査が無い。** `src/infrastructure/identity/better-auth.ts:304` の `passAttributes` は `httpOnly: true` / `secure: config.baseUrl.startsWith("https://")` / `sameSite: "lax"` / `path: "/"` である。ところが `tests/infrastructure/better-auth-gate.test.ts:187` の `COOKIE_ATTRS` は**テスト側が自分で組み立てた値を `applyAppSession` へ渡している**。つまり検査が見ているのは「渡された属性がそのまま `setCookie` へ届くこと」までで、**`createAuth` が組み立てる本物の属性は 1 件も見ていない**。`httpOnly: true` を `false` に書き換えても、テストは 29 件すべて緑のままである。**ここは残存リスクとして下に再掲する。**
  - `sameSite: "lax"` である理由は「Google からの戻りが別サイトからの画面遷移で、`strict` だと cookie が付かない」（同ファイルのコメント）。`lax` の妥当性そのものは評価していない。
  - `secure` が `baseUrl` の scheme から決まるため、`BETTER_AUTH_URL` を http で設定すると本番でも `secure` が落ちる。**この経路を塞ぐ検査は無い。**
- **12 時間という有効期間の妥当性を評価していない。** 短くも長くもできるが、判断材料（利用者が 1 日に何回ログインし直すことになるか）を取っていない。

## 今回の作業で塞いだ穴

### 番号は同じでも、本文が違って存在が漏れていた

**穴の形。** `ERROR_STATUS` は最初から `TENANT_MISMATCH: 404` を持っており、
「他所のものも未存在も 404」は既に成立していた。`tests/presentation/error-format.test.ts` の
`他の作業場所のものは「見つかりません」と同じ番号にする` も緑だった。

**それでも漏れていた。** 番号までしか見ていなかったためである。実際に返っていた本文は:

```
他所にある:   {"code":"TENANT_MISMATCH","message":"記事 が見つかりません。",
               "suggestedAction":"ワークスペースを切り替えているか確認してください。"}
そもそも無い: {"code":"NOT_FOUND","message":"記事 が見つかりません (id: obj-9999)。",
               "suggestedAction":"一覧から選び直すか、IDを確認してください。"}
```

`code` が違う。`(id: xxx)` の有無が違う。`suggestedAction` が違う。
**攻撃側は ID を総当たりして本文の違いだけを見ればよい。**
「`TENANT_MISMATCH` が返るほうは他所の Workspace に実在する」と読めるので、
他テナントの中身が列挙できる。403 を返さないようにした意味が、本文で丸ごと打ち消されていた。

**塞いだ形。** `src/presentation/http/error-response.ts` に `maskExistence` を追加した。

```ts
const EXISTENCE_HIDING_CODES: readonly DomainErrorCode[] = ["NOT_FOUND", "TENANT_MISMATCH"];

export function maskExistence(error: DomainError): DomainError {
  if (!EXISTENCE_HIDING_CODES.includes(error.code)) return error;
  return {
    code: "NOT_FOUND",
    message: "対象が見つかりません。",
    suggestedAction: "一覧から選び直すか、ID を確認してください。",
    retryable: false,
  };
}
```

潰す場所を 1 箇所にしてある。入口が 3 つ（REST / WebMCP / バックエンド MCP）あるので、
各入口で潰すと 1 つ足したときに漏れる。実測すると、外へ出る 2 経路がどちらもここを通っている:

```
src/presentation/tools/mcp-adapter.ts:38:  const error = maskExistence(input);
src/presentation/http/error-response.ts:78:  const error = maskExistence(input);   // errorResponse の中
```

`grep -rn "errorResponse" src/app/api/` の該当は
`src/app/api/tools/[tool]/route.ts`（2 箇所）と `src/app/api/feedback/pending/route.ts`（2 箇所）で、
いずれも `errorResponse` 経由なので潰しを通る。

**引き換えに失ったもの（記録する）。** ID を落とすので、
本人が自分のものを取り違えたときの説明が弱くなる。それでも落としたのは、
弱い説明は本人が一覧を見れば補えるが、**漏れた存在は取り消せない**ため。

### これを検証している箇所（3 件、すべて実測で噛むことを確認済み）

| 検証している場所 | テスト名 | 見ているもの |
|---|---|---|
| `tests/acceptance/feat-auth-workspace/access-boundary.test.ts` | `AWS-ACC-02 … > 他所の ID と、そもそも無い ID が、応答も本文も区別できない` | REST 応答のステータスと**本文のバイト列**の同一性 |
| `tests/presentation/error-format.test.ts` | `エラーの種類ごとの番号（判定表） > 他所のものと、そもそも無いものは、REST の本文まで同一` | 同上（種類の網羅側から） |
| `tests/presentation/error-format.test.ts` | `エラーの種類ごとの番号（判定表） > MCP の文面でも同一` | MCP の文面の同一性 |

加えて `tests/presentation/error-format.test.ts` の
`どの種類でも、返す形は 1 つ > {種類}: REST の本文の形が同じ`（15 種類）は、
期待値を `maskExistence(...)` の結果から取っている。**期待値をベタ書きしていない**ので、
潰しを外すと期待値も一緒に動いてしまう……という抜けは無い。
潰しを外したときに落ちることは、計測 C で実際に確かめた（3 件が赤）。

## 迂回経路について実測できたこと

P09 の目的は「既知の迂回経路（直接 API 呼び出し・クエリパラメータ改ざん等）でも破られないこと」の検証である。

| 迂回経路 | 実測できたこと | 判定 |
|---|---|---|
| 直接 API 呼び出し（cookie 無し） | `/api/tools/[tool]` は middleware では守られない設計で、代わりに `authenticateRequest`（`src/infrastructure/platform/api-token.ts`）を各ルートが自分で持つ。入口を通ったことは身元の根拠にせず、`actorForScope` が鍵の照合結果から身元を決める | **コード読取りのみ。HTTP での実行は未確認** |
| 身元のなりすまし | `actorForScope(scope, request)` は要求本文から `workspaceId` を受け取らない。鍵が通らないときは見本の身元ではなく**読者の身元**へ落ちる（コメントに `ah-2ro` / `ah-p9e` の再発防止として記録あり） | **コード読取りのみ。実行は未確認** |
| 他の入口だけ緩い | 「誰に何を許すか」は `isToolAllowedForScope` の 1 箇所で、REST（`/api/tools`）と MCP（`/api/mcp`）が同じ関数を使う | **コード読取りのみ** |
| クエリ・本文の改ざんで他テナントを指す | `assertSameTenant` が取り出した後に照合する（設計判断 D-03 の 2 層目） | **関数単体では緑。実 D1 経由の経路は未確認** |
| Server Actions 経由 | `"use server"` は独立した URL を持たず middleware の matcher の外側で動きうる。だから奥の `requireCapability` が要る、という設計になっている | **未確認。Server Action を直接叩いた検証はしていない** |

**要するに、迂回経路の検証は「そう作ってある」ところまでしか確かめていない。**
実際に叩いて破れないことを見た記録は、この報告書には 1 件も無い。
P09 の task spec が挙げている `pnpm run preview`（Workers ランタイム, localhost:8787）上での検証は**実行していない**。

## 残存リスク（正直に書く）

### R-1: 確定済み仕様章（auth）の実装状態が `not_started` のまま【最も重い】

確定済み auth 章は本 feature の実装状態を `not_started`、検証状態を `unverified` と記録している。
**一方でコードを実測すると 4 条件すべてに実装があり、この報告書のとおり大半が緑である。**

これは章の誤りではない。章の `confirmed` は「要求判断を収集済み」の意味で実装状態の報告ではなく、
実装状態の更新は P13 の writeback が所有する（`architecture-design.md` に同じ記述がある）。
本 P09 の write scope はこの報告書 1 本なので、**ここでは章を触らない。**

**それでも残存リスクである理由**: 章だけを読んだ人は「認証は未着手」と判断する。
未着手だと思っている機能に対して、人は攻撃面の見直しもレビューもしない。
**書いていないことは、書いていないようには見えない。**
P13 が writeback を実行するまで、この食い違いは残り続ける。

### R-2: 拒否が監査に残らない

AWS-ACC-02 と AWS-ACC-04 の合格判定に含まれる監査要件を、現時点で満たしていない（上述）。
`AuditLogEntry` に request ID の項目が無く、アクセス拒否を表す `AuditAction` も無い。

影響は「攻撃を検知できない」ことである。ID の総当たりが走っていても、
拒否は 404 を返すだけで**どこにも記録されない**。
`maskExistence` が「詳しい理由は記録側（監査ログ）に残す」と書いているが、
**その記録側がまだ無い。** 潰した情報の行き先が現状どこにも無い。

### R-3: `ah_session` クッキーの属性が、検査に守られていない

値そのものは正しい（`httpOnly: true` / `sameSite: "lax"` / `path: "/"` / `secure` は https のとき）。
**守られていないのは、それが変わったときに気づく手段のほうである。**

`createAuth` が組み立てる `passAttributes` を見ている検査が 1 件も無く、
テストは自前の `COOKIE_ATTRS` を渡している（上述）。
`httpOnly` を落としても、`secure` の判定を壊しても、**29 件は緑のまま**である。

D1 側で潰した値しか持たない設計は、クッキーそのものを取られる経路には効かない。
`/api/tools` には `checkOrigin` によるオリジン検査があるが、
これと cookie の `SameSite` の関係は確認していない。

### R-4: テストが見ているのは「宣言」で、SQL ではない

`tenant-scoped-ports.test.ts` は自身のコメントで
「この検査が緑でも『テナント分離が済んだ』ことにはならない」と明記している。
port の署名に `workspaceId` があっても、**実装の中の SQL に `where workspace_id` が付いているか**は別問題である。
`architecture-design.md` の設計判断 D-03 も「① だけに頼らない」としてこれを予期している。
実 D1 での結合検証は P06 が持つとされているが、**この報告書はその結果を持っていない**。

### R-5: 保存先障害と未ログインが利用者から区別できない

`decideEntry` は「確認できない」を通さない（安全側）が、
`signedInActor()` が `ActorResolution.unavailable` を `null` へ潰すため、画面には同じ「ログインしてください」が出る。
D1 が落ちている間、利用者はログインし直し続ける。
**安全側には倒れているので穴ではないが、障害時の運用が読めなくなる。**
`architecture-design.md` はこれを P12 の runbook へ送ると記録している。

### R-6: Better Auth の追従が止まると採用根拠が消える

確定済み auth 章の `decision-auth-method` に付いた caveat。
採用理由が「費用ゼロ・ロックインなし」なので、追従を止めた時点で根拠が消える。
追従は maintenance-ops の持ち物とする、と要求ベースラインが記録している。**この作業では何も確かめていない。**

### R-7: `middleware.ts` は非推奨 API の上に立っている

Next.js 16 はこの仕組みを `proxy.ts` へ改名したが、
`@opennextjs/cloudflare` 1.20.2 が Node.js middleware を受け取れずビルドが止まる。
よって現状 `middleware.ts` が**動く唯一の置き場所**である（`src/middleware.ts` のコメントに実測記録あり）。
両者が揃った日に移す必要があり、**移行時に AWS-ACC-01 の門が黙って外れうる**。
移せる合図は当該ビルドが通ることで、その時点で計測 A を回し直す必要がある。

## 運用時の異常検知（P09 の Operations 観点）

### 403 多発時のアラートは、現状**出せない**

理由は R-2。拒否そのものが記録されないため、
「403 が急に増えた」という事実を取り出す先が無い。
アラートの要否を議論する前に、**記録が先に要る。**

ログインの拒否だけは `signin_denials`（日時・アドレス・理由）に残るので、
**ログイン試行の異常だけは後から見られる**。ただし:

- これはログインの門であって、ログイン後の権限拒否（403）やテナント越え（404）は含まない。
- アラートとして自動で拾う仕組みは確認していない（**未確認**）。手で表を見に行く前提である。

### 提案（この作業の範囲外。後続 phase へ送る）

1. `AuditAction` に拒否を表す語を 1 つ足し、`requireCapability` / `assertSameTenant` の失敗を記録側へ流す。
   ただし `tests/architecture/audit-action-emitters.test.ts` が
   「語だけがあって出す場所が無い」を落とす検査なので、**語と出す場所を同時に入れる必要がある**。
2. `AuditLogEntry` に request ID を足す。`maskExistence` が落とした ID の行き先がここになる。
3. その上で「同一 actor から短時間に 404 / 403 が N 件」を異常として拾う。

## 未確認として残した項目の一覧

**この報告書で「確かめた」と言えないものを、すべてここに集める。**

| # | 未確認の内容 | なぜ確かめなかったか |
|---|---|---|
| 1 | `/admin` への実 HTTP 要求で 302 が返り本文が出ないこと | `pnpm run preview`（Workers ランタイム）を起動していない |
| 2 | 実 D1 に他テナントの行を入れて取れないこと | 同上。結合検証は P06 の持ち物とされている |
| 3 | Google OAuth の実際の往復 | 秘密情報を要するため。ローカルの計測では触れない。計測 D は偽の文脈での判定までしか見ていない |
| 4 | （解消済み）`tests/infrastructure/better-auth-gate.test.ts` | 計測 D で 29 件緑を実測した |
| 5 | `createAuth` が組み立てる cookie 属性が正しいこと | 実装の値は読んだが、それを見ている検査が無い（R-3）。`BETTER_AUTH_URL` が http のとき `secure` が落ちる経路も塞がれていない |
| 6 | Server Action を直接叩いたときの権限判定 | 実測していない |
| 7 | `/api/tools` を鍵無し・鍵改ざんで叩いた結果 | 実測していない（コードは読んだ） |
| 8 | カバレッジ 80% の達成状況 | `pnpm vitest run --coverage` を**実行していない**。並走作業が計測中に `src/` と `tests/` を書き換えており、この時点の数値は再現しないため。**再現可能な数値は、作業ツリーが静かになってから取り直すこと** |
| 9 | 全テスト回帰 0 件 | 同上。計測 C の 1471 件は変異が入った状態のもので、回帰の基準線にはできない |
| 10 | 403 多発の自動検知の有無 | 実測していない |

**8 と 9 は P09 の task spec が Required evidence として挙げているものである。**
取れていないことを、取れたように書かない。取り直しは P11（証跡取得）へ送る。

## 総括

**4 条件のうち、応答の形として検証できたのは 4 条件すべて。**
計測 A・B・D を合わせて 160 件（121 + 10 + 29）のテストが緑で、
うち存在漏れを見ている 3 件は、変異注入で実際に赤くなることを確かめた（計測 C）。

**満たしていないと分かっているのは 1 点**: 拒否の監査記録（AWS-ACC-02 / AWS-ACC-04 の合格判定に含まれる）。

**確かめていないのは 9 点**（上表。#4 は計測 D で解消した）。中でも重いのは、
**実行時（Workers ランタイム・実 D1）での検証を 1 件も行っていない**ことである。
この報告書が言えるのは「関数と型の層では 4 条件が成立している」までであって、
**「動いているシステムが破られない」ではない。**

## 後続 phase への引き継ぎ

| 引き継ぐもの | 受け取る phase |
|---|---|
| 未確認 8 / 9（カバレッジと回帰の再計測） | P11 |
| 未確認 1 / 2 / 7（Workers ランタイムと実 D1 での検証） | P11 |
| R-2（拒否の監査記録。語と出す場所を同時に） | P12 |
| R-3（cookie 属性の確認） | P12 |
| R-5（保存先障害時の画面文言の分離） | P12 |
| R-1（確定済み auth 章の実装状態の更新） | P13 |
| R-6（Better Auth 追従の運用手順） | P12・P13 |
| R-7（`proxy.ts` へ移せるようになった日の再計測） | P13 |
