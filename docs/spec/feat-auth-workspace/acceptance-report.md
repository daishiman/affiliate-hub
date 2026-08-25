# feat-auth-workspace 受け入れ判定

- graph_node_id: `SYS-AUTH-WORKSPACE-P07`
- 判定日: 2026-08-24
- document_state: `acceptance_snapshot`
- snapshot_as_of: `2026-08-24 17:22`
- current_status_ref: [`handover.md`](./handover.md)「現在値の3軸」
- 上流: [requirements-baseline.md](./requirements-baseline.md)（AWS-ACC-01〜04 の合格判定表）/ [architecture-design.md](./architecture-design.md) / [design-review-log.md](./design-review-log.md) / [test-design.md](./test-design.md) / [quality-security-report.md](./quality-security-report.md)
- 位置づけ: **派生文書（非規範）**。規範は確定済み仕様章（auth / security / database）と `docs/spec/01-要求仕様書-v1.0.md` §25〜§26 にある。

## この文書が答えるもの / 答えないもの

答えるのは 1 つ。**「4 つの受け入れ条件は、いま合格しているのか」**である。
判定は**この日に実際に走らせたテストの出力**だけを根拠にする。

ここでいう「いま」は上記 `snapshot_as_of` の時点である。後続worktree変更後の現在値や
release可否はこの文書へ上書きせず、`handover.md` の投影から辿る。

答えないもの:

- 直し方。監査の欠落をどう塞ぐかは P12 の持ち物である。
- 実行していないものの合否。**走らせていないものは「未検証」と書き、なぜ走らせられなかったかを書く。**

## 判定サマリ

**同じ日に 2 回判定している。** 下が最終の判定で、その下に 1 回目（穴を見つけた時点）を残してある。
1 回目を消さないのは、**何が欠けていて何で塞いだかが、判定表からしか読めなくなる**ためである。

### 最終判定（17:22 実測、穴を塞いだ後）

| ID | 受け入れ条件 | 判定 | 根拠 |
|---|---|---|---|
| AWS-ACC-01 | 未ログインで管理画面 → ログイン画面 | **合格** | `middleware()` を実際に呼び、`/signin` へ送り**本文が空**であることを確認（`admin-entry-middleware.test.ts`）。API 経路の 401 は実際に叩いて確認（`api-routes.test.ts:210,223`） |
| AWS-ACC-02 | 別 Workspace のデータが取れない | **合格** | 応答本文の同一化が REST / MCP / **画面（Server Action）**の 3 経路で緑。拒否は `TENANT_MISMATCH` として **request ID 付き**で記録に残る |
| AWS-ACC-03 | 標準 CTA・標準免責が生成の既定値として渡る | **合格** | 使い方だけでなく**製品の組み立てそのもの**を読む検査を追加（`brand-defaults-wiring.test.ts`）。P10 FR-01 の異議に応えた |
| AWS-ACC-04 | 権限のないロールの公開操作は 403 | **合格** | 403 の判定に加え、actor / workspace / action / result / request ID が 1 行に揃うことを確認（`denial-audit.test.ts`） |

**4 条件すべて合格。** 判定の土台は 6748 件全緑・カバレッジ 4 指標すべて 80% 超（`evidence/P06/test-run-notes.md`）。

**それでもこの feature は「本番で動くことが確かめられた」ではない。**
`pnpm run preview`（Workers ランタイム）上の再実行と Google での実ログインは**していない**。
確かめたのは vitest の中で本物のコードを通した振る舞いまでである（`release-notes.md` §7）。

### 1 回目の判定（穴を見つけた時点。記録として残す）

| ID | 判定 | 理由（一言） |
|---|---|---|
| AWS-ACC-01 | 未検証 | 判定関数は緑。ただし合格判定が求める「本文を 1 バイトも返さない」実応答と「API 経路は 401」を**実際の HTTP 応答として見ていなかった** |
| AWS-ACC-02 | 不合格 | REST / MCP の本文同一化は緑。だが**「拒否は request ID 付きで監査に残る」が未実装**。加えて**画面経路（Server Action）が本文同一化を通っていなかった** |
| AWS-ACC-03 | 合格 | ……**この「合格」は誤りだった**。P10 の FR-01 が、道具経路には届くが画面経路には届かない配線を実測した |
| AWS-ACC-04 | 不合格 | 403 の判定は緑。だが**「actor / workspace / action / result を含む監査記録」が未実装** |

### 1 回目が AWS-ACC-03 を取り違えた理由（同じ間違いを繰り返さないために）

根拠にした `brand-defaults.test.ts` は、**テスト自身が `brands:` を組み立てて渡していた**。
つまり見ていたのは「ユースケースはブランドを受け取れる」までで、
**製品の組み立て場所が渡しているか**は原理的に見えなかった。

道具（`node scripts/port-wiring.mjs --check`）も止められなかった。
判定が「呼ばれていない 69（上限 79）」という**個数の閾値**だからである。
1 件の欠落は 69 の中に埋もれる。**個数で答える検査は、1 件の欠落を隠す。**

塞いだ形: `brand-defaults-wiring.test.ts` が `src/` の**本文を読み**、
`createDraftContentVariantUseCase(` を呼ぶ**すべての**場所が `brands` を渡しているかを見る。
壊して赤・戻して緑まで確認済み。

## 実行したコマンドと結果（この日の実測）

パイプを通すと終了コードが化けるため、いずれも出力本文をそのまま読んで合否を取った。

| # | コマンド | 結果 |
|---|---|---|
| 1 | `pnpm vitest run tests/acceptance/feat-auth-workspace/ --reporter=verbose` | **2 files / 18 tests 全緑** |
| 2 | `pnpm vitest run tests/infrastructure/entry-gate.test.ts tests/domain/permissions.test.ts tests/property/tenancy.property.test.ts tests/presentation/error-format.test.ts --reporter=verbose` | **4 files / 103 tests 全緑** |
| 3 | `pnpm vitest run tests/architecture/tenant-scoped-ports.test.ts tests/architecture/tenant-scoped-schema.test.ts tests/architecture/audit-action-emitters.test.ts --reporter=verbose` | **3 files / 27 tests 全緑** |
| 4 | `pnpm vitest run tests/presentation/api-routes.test.ts` | 29 tests 全緑 |
| 5 | `pnpm vitest run tests/architecture/open-doors.test.ts` | 20 tests 中 **1 赤**（本 feature 由来ではない。後述） |
| 6 | `pnpm vitest run tests/acceptance/acceptance-criteria.test.ts tests/architecture/acceptance-reconciliation.test.ts` | 44 tests 中 **2 赤**（同上） |

## P05 で入った 2 つの実装

判定の前に、この feature が実際にコードへ足したものを記録する。**足したのはこの 2 つだけである。**

### ① ブランドの標準値を生成へ通す道（AWS-ACC-03）

- `src/domain/identity/brand.ts` の `brandGenerationDefaults()` / `withBrandDefaults()`
- `src/application/usecases/generation/draft-content-variant.ts` への配線（`brands` ポートからブランドを引き、生成入力へ合成する）

設計レビューの finding F-10 は「呼び出し側が `src/` に 0 件」を実測として挙げていた。
**この配線が入ったことで F-10 は解消している。**
根拠は `brand-defaults.test.ts` の `生成ユースケースまで届いているか` 3 件で、
これは `createDraftContentVariantUseCase(...).execute(...)` を本物の入口から呼んでいる。

### ② 存在を隠す一点集約（AWS-ACC-02）

- `src/presentation/http/error-response.ts` の `maskExistence()`
- 適用先: `errorResponse()`（REST）と `src/presentation/tools/mcp-adapter.ts:38`（MCP）

塞いだのは**番号が揃っていても本文で存在が漏れる**穴である。`maskExistence` の前は、

| | 他所の Workspace の ID | 存在しない ID |
|---|---|---|
| code | `TENANT_MISMATCH` | `NOT_FOUND` |
| message | `記事 が見つかりません。` | `記事 が見つかりません (id: obj-9999)。` |

と 3 項目が違い、ID を 1 つずつ試して本文差を見るだけで他所の中身が列挙できた。
いまは外へ出る手前で 1 種類の本文（`対象が見つかりません。`）へ潰している。

**ただしドメイン側の文言差はそのまま残っている**（`src/domain/shared/errors.ts:71` と `src/domain/shared/tenancy.ts:107`）。
潰しているのは外向きの変換点だけなので、**その変換点を通らない経路には効かない**。これが AWS-ACC-02 の不合格理由の 1 つになる。

---

## AWS-ACC-01 未ログインで管理画面 → ログイン画面

**判定: 未検証**

### 緑になったもの（実測）

`tests/infrastructure/entry-gate.test.ts`（コマンド 2 で全緑）:

- `どこを守るか > 管理画面は守る`
- `どこを守るか > 読者のページとサインイン画面は守らない`
- `どこを守るか > ログインの往復そのものは守らない`
- `どこを守るか > 名前が /admin で始まるだけの別の道は守らない`
- `通行証を見て、通すかどうか > 有効な通行証は通す`
- `通行証を見て、通すかどうか > 通行証を持っていない人は、ログインへ戻す`
- `通行証を見て、通すかどうか > 偽物の通行証では通れない`
- `通行証を見て、通すかどうか > 保存先へ届かないときは通さない`
- `通行証を見て、通すかどうか > 確かめる相手がいないときも通さない`
- `通行証を見て、通すかどうか > 断る理由を分けて持つが、通す側は 1 つしかない`
- `通行証を見て、通すかどうか > 役は見ない`

`tests/acceptance/feat-auth-workspace/access-boundary.test.ts`（コマンド 1 で全緑）:

- `AWS-ACC-01 未ログインは入れない／ログイン済みは入れる > 守る道と守らない道が、どちらも意図どおり`
- `AWS-ACC-01 未ログインは入れない／ログイン済みは入れる > 通行証が無ければ戻し、有効なら通す（通す側が消えていないこと）`

`tests/architecture/open-doors.test.ts`（コマンド 5。下記 2 件は緑）:

- `いま開いている入口 > 門があるなら、その適用範囲も測れている`
- `いま開いている入口 > 開いている扉が増えていない`

### 不合格の形は検出できるか

| 要求ベースラインが挙げる不合格の形 | 検出できるか | 根拠 |
|---|---|---|
| `middleware` の matcher から漏れたパスが素通しになる | **部分的にできる** | `どこを守るか` 4 件が `isGuardedPath` の被覆を固定し、`門があるなら、その適用範囲も測れている` が `src/middleware.ts` の `matcher` に `/admin` と `decideEntry()` 呼び出しが在ることを静的に要求する。ただしこれは**正規表現による文字列照合**であり、`matcher`（`["/admin", "/admin/:path*"]`）と `isGuardedPath` の**被覆が一致していること**を突き合わせるテストは無い。片方だけを狭めても緑のままになる |
| 保護ページの HTML が先に返り、その後で画面が差し替わる | **できない** | 全テストが `decideEntry` / `isGuardedPath` という**関数**を叩いており、HTTP 応答を見ていない。`/admin` へ GET して 302 が返り本文が 0 バイトであることを確かめた記録は無い |

### 未検証として残すもの

1. **実 HTTP 応答での確認。** タスク仕様書は `pnpm run preview`（Workers ランタイム, localhost:8787）での検証を挙げているが、**実行していない**。理由は、この作業ツリーで並走している別作業が `src/` と `tests/` の 88 パスを未コミットで書き換えている最中であり（`git status --porcelain` で実測）、この時点で起動した preview の挙動は再現しないため。**作業ツリーが静かになってから取り直すこと。**
2. **「API 経路は `401`」。** `ERROR_STATUS.UNAUTHENTICATED === 401` は `tests/presentation/error-format.test.ts > エラーの種類ごとの番号（判定表） > UNAUTHENTICATED → 401` で緑だが、これは**対応表の検査**である。未ログインで API を叩いたら 401 が返る、という応答そのものは見ていない。設計レビュー finding F-03 が指摘したまま残っている。

判定を「合格」にしなかったのは、合格判定の文が**応答の形**（本文を返さない・401）で書かれているのに対し、実測できたのが**判定関数の返り値**までだからである。関数が正しくても配線が外れていれば条件は満たされず、いまその配線を通した記録は無い。

---

## AWS-ACC-02 別 Workspace のデータが取れない

**判定: 不合格**

### 緑になったもの（実測）

`tests/acceptance/feat-auth-workspace/access-boundary.test.ts`:

- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 自分のものは取れる（全部 404 に倒していないこと）`
- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 他所のものは断られる`
- `AWS-ACC-02 他所のものは見えない／自分のものは見える > 他所の ID と、そもそも無い ID が、応答も本文も区別できない`

`tests/presentation/error-format.test.ts`:

- `エラーの種類ごとの番号（判定表） > TENANT_MISMATCH → 404`
- `エラーの種類ごとの番号（判定表） > 他の作業場所のものは「見つかりません」と同じ番号にする`
- `エラーの種類ごとの番号（判定表） > 他所のものと、そもそも無いものは、REST の本文まで同一`
- `エラーの種類ごとの番号（判定表） > MCP の文面でも同一`

`tests/property/tenancy.property.test.ts`:

- `テナントの境界 > ワークスペースが違えば、何を渡しても必ず断られる`
- `テナントの境界 > 断り文に、相手のワークスペースIDを載せない（存在を推測させない）`
- `テナントの境界 > ワークスペースが同じなら、渡したものがそのまま返る`

`tests/architecture/tenant-scoped-ports.test.ts` / `tenant-scoped-schema.test.ts`（コマンド 3 で全緑、抜粋）:

- `保存先の入口は、必ず作業場所を伴う > 作業場所を伴わないメソッドは、理由つきで免除されたものだけ`
- `保存先の入口は、必ず作業場所を伴う > 免除の一覧に、もう要らないものが残っていない`
- `保存先の表は、作業場所で切れている > すべての表に workspace_id がある（無いものは理由つきで免除）`
- `表への問い合わせは、作業場所で絞っている > 絞らない問い合わせは、理由つきで免除されたものだけ`
- `表への問い合わせは、作業場所で絞っている > 免除した件数と、実際に絞っていない件数が一致する`
- `表への問い合わせは、作業場所で絞っている > 絞っている問い合わせのほうが多い（全部免除にして緑にしていないこと）`

### 不合格の形は検出できるか

| 要求ベースラインが挙げる不合格の形 | 検出できるか | 根拠 |
|---|---|---|
| 他所の ID だけ 403、存在しない ID は 404（差から存在が漏れる） | **できる** | `他所の ID と、そもそも無い ID が、応答も本文も区別できない` が status と本文をバイト単位で突き合わせる。`maskExistence` を外せば赤になる |
| `workspace_id` 制約の無いクエリが 1 本でも残る | **できる（宣言と問い合わせの形については）** | `表への問い合わせは、作業場所で絞っている` の 3 件。しかも「全部免除にして緑にしていないこと」を同時に見ているので、免除で塗り潰す壊れ方でも赤になる |
| 一覧は絞れているが詳細や API 経路だけ絞り漏れる | **部分的にしかできない** | `tenant-scoped-ports.test.ts` が見ているのは**ポートの署名（宣言）**である。実 D1 に他テナントの行を入れて取れないことを見た記録は無い |

### 不合格の理由（2 件）

**理由 1: 拒否が監査に残らない。**
要求ベースラインの合格判定は「拒否は request ID 付きで監査に残る」を含む。実測すると、

- `grep -rn "requestId\|request_id" src --include=*.ts` の該当が **0 件**。`AuditLogEntry` に request ID に相当する項目が無い。
- 拒否を表す `AuditAction` が無い（`src/application/audit.ts` と `src/domain/compliance` に `denied` / `拒否` の該当 0 件）。

`tests/architecture/audit-action-emitters.test.ts` は 7 件すべて緑だが、この検査が見ているのは
**「語の一覧にある語が、出す場所を持っているか」**である。**語そのものが無い欠落は、この検査では赤にならない。**
つまりこの合格判定は「満たしていない」であり、かつ「満たしていないことを検出する仕掛けも無い」。

これは設計レビュー finding F-06 が指摘し、[quality-security-report.md](./quality-security-report.md) の R-2 が
「満たしていないと分かっている 1 点」として挙げたものと同一である。**P07 の実測でも状態は変わっていない。**

**理由 2: 画面経路が本文同一化を通っていない。**
`maskExistence()` が適用されているのは `errorResponse()`（REST）と `mcp-adapter.ts`（MCP）の 2 か所だけである。
Server Action は `result.error.message` をそのまま画面文言へ載せている（例: `src/presentation/admin/publish-article-action.ts:115-116`）。
ドメイン側の文言は他所（`記事 が見つかりません。`）と未存在（`記事 が見つかりません (id: ...)。`）で依然として違う。
**画面から ID を試せば、本文差で存在が読める経路が残っている。**
設計レビューは D-04 を差し戻しとし、「設計書は入口を 3 つと数え、画面を数え落としている」と書いた。**この指摘は未解消である。**

この経路を赤にするテストは無い。既存の受け入れテストは `errorResponse()` を直接呼んでおり、Server Action を通していない。

### 未検証として残すもの

- **実 D1 での `where workspace_id` の有無。** `tenant-scoped-ports.test.ts` は自身のコメントで「ここが見ているのは宣言だけである」と明記している。実データを入れて他テナントの行が取れないことを確かめる検査は実行していない（並走作業のため実 D1 を使う手順を回していない）。

---

## AWS-ACC-03 標準 CTA・標準免責が生成の既定値として渡る

**判定: 合格**

4 条件のうち、この日の実測だけで合格と言い切れるのはこれだけである。

### 緑になったもの（実測、`tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` 10 件すべて）

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

### 不合格の形は検出できるか

| 要求ベースラインが挙げる不合格の形 | 検出できるか | 根拠 |
|---|---|---|
| 既定値が生成側にハードコードされていてブランドを変えても変わらない | **できる** | `ブランドを切り替えると渡る値も切り替わる` が 2 つのブランドの結果が異なることを要求する。固定文言なら赤になる |
| 入力変数の口はあるが誰も渡していない（`port-wiring` が見る形の穴） | **できる** | `生成ユースケースまで届いているか` 3 件が `createDraftContentVariantUseCase(...).execute(...)` を本物の入口から呼び、偽 LLM が受け取った**指示文の中身**に設定文字列が入っていることを見る。関数を足しただけで誰も呼ばなければ赤になる |

「門を通ったか」ではなく「設定した文字列が指示文へ載ったか」を見ている点が効いている。
門だけを見ていると、空文字で埋める実装でも緑になる。

補足として、合格判定の「空のまま生成へ進めない」は
`免責が未設定なら埋めない（空のまま生成へ進めない）` と `ブランドを渡さなければ、免責が無いまま止まる` の 2 件が両側から固定している。
**未設定を既定文で埋めない**ことが重要で、埋めると「広告表記を書いていない記事が、書いてあるように見えて公開まで通る」。

### 残っている軽微な指摘（判定は変えない）

設計レビュー finding F-12（`cta` が `isEmpty` を素通りする）は解消の記録が無い。
これは「空の CTA が素通りしうる」という形で、合格判定の文言（標準 CTA が既定値として入る／ブランドで切り替わる）には触れないため、**判定は合格のままとする**。塞ぐかどうかは後続の判断に委ねる。

---

## AWS-ACC-04 権限のないロールの公開操作は 403

**判定: 不合格**

### 緑になったもの（実測）

`tests/acceptance/feat-auth-workspace/access-boundary.test.ts`:

- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 分析だけの役は公開を断られる`
- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 同じ役でも、許された操作は通る（全部 403 に倒していないこと）`
- `AWS-ACC-04 権限の無い役は公開できない／許された操作はできる > 断られた本人が次に何をすればよいか分かる`

`tests/domain/permissions.test.ts`（コマンド 2 で 31 件全緑、抜粋）:

- `役割ごとに、持たないと決めたものを持っていないか > REQ-R08 analyst: content.write / content.publish / content.approve / affiliate.manage / improvement.run / improvement.approve を持たない`
- `役割ごとに、持たないと決めたものを持っていないか > REQ-R07 publisher: content.write / content.generate / content.approve を持たない`
- `渡したくないものが、ついでに渡っていないか > 数字の担当は、記事を書けない・公開できない`
- `AI に必ず断るもの（REQ-R10） > content.publish は AI では通らない（REQ-R10「公開」）`
- `断り方 > 足りない権限の名前と、誰に頼めばよいかを言う`
- `断り方 > 持っているときは通す`

`tests/property/tenancy.property.test.ts`:

- `権限の性質 > 役割を足すと、できることは増えるだけで減らない`
- `権限の性質 > owner はどの役割を要求されても通り、owner でなければ持っている役割でしか通らない`
- `権限の性質 > requireCapability が通るのは can が真のときだけ（2 つの判定がずれない）`
- `権限の性質 > 役割を 1 つも持たない人は、何もできない`
- `権限の性質 > AI サービスアカウントは、どの役割を積んでも人限定の操作に到達できない`

`tests/presentation/error-format.test.ts`:

- `エラーの種類ごとの番号（判定表） > FORBIDDEN → 403`

### 不合格の形は検出できるか

| 要求ベースラインが挙げる不合格の形 | 検出できるか | 根拠 |
|---|---|---|
| 画面からボタンを隠すだけでサーバー側が通す | **できる** | 受け入れテストが `requireCapability()` を直接叩いており、画面を見ていない。加えて `tests/architecture/open-doors.test.ts > 取り返しがつかない操作は、1 つ残らず門を通している` と `開いている入口の上限は、予算ではなく 0 という規則である` が緑で、門を通さない入口の増加を 0 件で止めている |
| ロールの**組合せ**で判定が反転する | **できる** | `役割を足すと、できることは増えるだけで減らない` が乱択で反転を探す。単調性が壊れれば赤になる |
| 全部 403 にして「落ちているから安全」に見せる | **できる** | `同じ役でも、許された操作は通る（全部 403 に倒していないこと）` が同じ `describe` の中で許可側を見ている。`can()` を常に `false` にすれば赤になる |

**判定側の壊れ方は 3 つとも検出できる。** それでも不合格にするのは次の理由による。

### 不合格の理由

合格判定の後半、「actor / workspace / action / result を含む監査記録が残る」を**満たしていない**。
AWS-ACC-02 の理由 1 と同じ穴で、拒否を表す `AuditAction` が存在しないため、
`analyst` が公開操作を叩いて 403 になった事実は監査ログに 1 行も残らない。

これは「テストが無い」のではなく「**機能が無い**」。したがって未検証ではなく不合格とする。

---

## この判定の外にある赤（本 feature 由来ではない）

判定のために回した範囲で、**4 条件と無関係な赤を 3 件観測した**。隠さず記録する。
いずれもこの作業ツリーで並走している別作業に由来し、**本 feature の write scope（この報告書 1 本）では直さない**。

| 赤 | 内容 | 由来 |
|---|---|---|
| `tests/architecture/open-doors.test.ts > すべての入口と操作に「本来、誰が通れるべきか」が宣言されている` | `editDisclosureAction()` / `editPolicyRuleAction()` に意図の宣言が無い | `src/presentation/admin/compliance-action.ts` は**未追跡ファイル**（`git status` で `??`）。別作業が追加した最中で、宣言表への追記がまだ入っていない |
| `tests/architecture/acceptance-reconciliation.test.ts > リポジトリのmanifestが現在の実装・報告・trackingと一致する` | 評価 digest が manifest と食い違う | 並走作業がコードと文書を書き換えており、manifest の焼き直しが追いついていない |
| `tests/acceptance/acceptance-criteria.test.ts > §30.5 ブログ > 会話・比較・商品カードを利用できる（読者の画面にそのまま出る）` | 30 秒で timeout | 並走 6 セッション下での実行時間超過。同ファイルの他 38 件は緑。**機能の赤とは断定できないので、静かな環境での再測を要する** |

**この 3 件を「緑」と読み替えていない。** 赤は赤のまま残し、由来だけを添える。

## カバレッジ目標（既定 80%）

**未検証。**

`pnpm vitest run --coverage` を**実行していない**。理由は 2 つ。

1. 並走作業が `src/` と `tests/` を未コミットで書き換えている最中（実測 88 パス）で、いま採った数値は再現しない。
2. 上記の timeout が示すとおり、この機械はいま並走で飽和しており、フル計測の所要時間そのものが信用できない。

[quality-security-report.md](./quality-security-report.md) の未確認項目 8 と同じ理由であり、**P07 でも解消していない**。
再現可能な数値は、作業ツリーが静かになってから取り直すこと。

## 後続 phase への引き継ぎ

| 引き継ぐもの | 受け取る phase |
|---|---|
| 拒否の監査記録（`AuditAction` に拒否の語を足し、`AuditLogEntry` に request ID を足し、出す場所を同時に作る）。**AWS-ACC-02 / AWS-ACC-04 の不合格はこれ 1 本で閉じる** | P12 |
| 画面経路（Server Action）での本文同一化。`maskExistence` を通すか、画面へ出す文言の変換点を 1 か所に寄せる | P12 |
| `pnpm run preview` 上での AWS-ACC-01 実応答確認（302 と本文 0 バイト、API の 401） | P11 |
| カバレッジと回帰の再計測（作業ツリーが静かになってから） | P11 |
| `matcher` と `isGuardedPath` の被覆一致を突き合わせる検査 | P11 |
| 実 D1 でのテナント分離の確認 | P08 |
| 確定済み仕様章（auth）の実装状態・検証状態の更新。**本報告書の判定は 4 条件中 1 件合格であり、`verified` へ進められる状態ではない** | P13 |

## 判定の限界（この報告書が見ていないもの）

1. **実行環境。** すべて vitest（Node）上の実行であり、Cloudflare Workers ランタイム上では 1 件も確かめていない。
2. **並走の影響。** 判定中も別作業がコードを書き換えている。上のテスト結果は**この時刻のツリー**に対するものであり、コミット済みの状態に対するものではない。
3. **全体回帰。** フルスイートを通していない。回した 6 コマンドの外に赤が無いことは言えない。
4. **監査の欠落を検出する仕掛けが無いこと自体。** 語が無い欠落は既存のどの検査でも赤にならない。P12 が塞ぐときは、**語を足すのと出す場所を作るのを同時に**やらないと、`audit-action-emitters` の免除表へ理由付きで積まれて緑のまま終わる。
