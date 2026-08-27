# feat-auth-workspace 独立設計レビュー

- graph_node_id: `SYS-AUTH-WORKSPACE-P03`
- 対象: [`architecture-design.md`](./architecture-design.md)（P02）
- 照合先: [`requirements-baseline.md`](./requirements-baseline.md)（AWS-ACC-01〜04）
- 位置づけ: 派生文書（非規範）。**設計者から独立**したレビューであり、設計書の主張は追認せず、コードを読んで反証を試みた結果だけを根拠に置く。
- 実測日: 2026-08-24 / 対象ブランチ `daishiman/task20-2`

## レビュー中に並行して入った変更（重要）

本レビューは `architecture-design.md`（設計文書）を対象とするが、**読んでいるあいだに別の作業者がコードを動かした**。
verdict と finding は**測った時点の実測**であり、以下の 3 件は本レビューの測定後に実装が入っている。**取り消さず、状態を明記して残す。**

| finding | 測定時 | 再確認時（同日） | 現在の扱い |
|---|---|---|---|
| F-07 `TENANT_MISMATCH` の本文漏れ | 漏れていた | `error-response.ts` に `maskExistence()` が入り、REST（`errorResponse`）と MCP（`mcp-adapter.ts:38`）で潰されるようになった | **画面経路が未対応のため縮小して存続**（下記 F-07 参照） |
| F-09 型が入らない / F-11 スプレッドが既定値を消す | 該当 | `BrandGenerationDefaults` を独立の型として定義し、`withBrandDefaults()` がキー単位の `??` で合成する形になった | **解消。記録のみ残す** |
| F-10 呼び出し側が無い | 予測 | `withBrandDefaults` の呼び出しは `tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` のみ。`src/` からの呼び出しは **0 件** | **存続（予測ではなく実測になった）** |

設計文書 `architecture-design.md` は 2026-08-24 のレビュー時点で**いずれも反映していない**ため、上表の左列に対する verdict は文書へのものとして有効である。

## このレビューの立て方

設計書の 10 件の判断（D-01〜D-10）とテスト配置の逸脱について、**「この主張が偽になる経路を 1 本でも見つける」**ことを目標に読んだ。
空振りした反証も、手口と実測を残す。空振りを書かない承認は、読んだことの証拠にならない。

判定は 3 段階。

- **承認**: 反証を試みて見つからなかった。手口を明記する。
- **条件付き承認**: 判断そのものは妥当だが、設計書が書いていない前提・穴があり、後続 phase がそれを知らずに進むと受け入れ条件が緑にならない。
- **差し戻し**: 設計書の主張が実測と食い違う、または受け入れ条件を満たさない。

## verdict 一覧

| ID | 主題 | verdict | 一言 |
|---|---|---|---|
| D-01 | 入口の門は「ログインしているか」だけ | 条件付き承認 | matcher の被覆は実測で穴なし。ただし門の**奥の落ち先**が見本の身元で、設計書はそれを書いていない |
| D-02 | 「確認できない」を通さない | 条件付き承認 | `decideEntry` は 3 経路すべて閉じる側。ただし 1 層上の `currentActor()` がその硬さを打ち消す |
| D-03 | Port ①・Domain ②・応答③ の 3 層 | **差し戻し** | ② は 44 ユースケース中 7 ファイルにしか無い。① は `*RepositoryPort` 以外を 1 件も見ていない（§26.4 のキャッシュ／ファイル分離が丸ごと外） |
| D-04 | 他テナントは 403 ではなく「見つかりません」 | **差し戻し** | **番号は同じだが本文が違う。** 測定後に REST / MCP は `maskExistence()` で潰されたが、**画面経路が残る**。設計書は入口を 3 つと数え、画面を数え落としている |
| D-05 | 権限の 403 とは分ける | 承認 | `TENANT_MISMATCH` を 403 で出す経路は全 grep で 0 件 |
| D-06 | 変換はドメインに置き純関数にする | **差し戻し** | 置き場所は妥当。だが**変更ファイル表に呼び出し側が 1 つも無く**、実装後の実測でも `src/` からの呼び出しは 0 件。AC の不合格の形「口はあるが誰も渡していない」がそのまま残る |
| D-07 | 免責が未設定なら null を返す | 条件付き承認 | 挙動は実測で噛み合う。ただし根拠に挙げた関数 `checkGenerationInput` が**存在しない**。型の不整合（F-09）は測定後に解消 |
| D-08 | 明示値が既定値に勝つ | 条件付き承認 | スプレッドの穴（F-11）は測定後に解消。`cta` が `isEmpty` を素通りする点（F-12）は存続し、実装コメントが誤った前提を明文化した |
| D-09 | ロールでなく capability で判定 | 承認 | `analyst` に `content.publish` 無し・`analytics.read` 有りを実測。並行する role 判定路（`requireRole`）は呼び出し 0 件 |
| D-10 | 権限は membership から都度引く | 承認 | セッション行に roles は載っておらず、`revokedAt` も見ている |
| — | テスト配置 `src/lib/` → `tests/acceptance/` | 承認 | 判定関数を直接叩いて再現。設計書の根拠は正しく、しかも**過小に書かれている** |

差し戻し 3 件（D-03 / D-04 / D-06）。D-04 は受け入れ条件 AWS-ACC-02 の合格判定そのものと食い違い、D-06 は AWS-ACC-03 を緑にできない。

---

## D-01 / D-02: 入口の門

### 反証の手口 1 — matcher から漏れる管理画面パスを探す

`src/app/admin/` 配下のルートを列挙し、matcher `["/admin", "/admin/:path*"]` と突き合わせた。

- `page.tsx` / `layout.tsx`: **50 件**。すべて `src/app/admin/` の下（`find src/app/admin -name "page.tsx" -o -name "layout.tsx"`）。
- `src/app/admin/` 配下に `route.ts` は **0 件**。
- ルートグループ（`(admin)` のような括弧つきディレクトリ）は `src/app` 全体で **0 件**。よって「URL は `/admin` だが物理配置が別」という漏れは無い。
- `src/app/` 直下は `admin / api / go / s / signin` の 5 つ。管理画面に相当するものは `admin` だけ。

**反証は空振り。** 管理画面のパスで matcher から漏れているものは実在しない。

### 反証の手口 2 — cookie 認証が要るのに門が無い `/api/` を探す

`src/app/api/` の `route.ts` 全 7 本を 1 本ずつ開いた。

| ルート | 門 | 判定 |
|---|---|---|
| `api/auth/[...all]` | Better Auth 本体（ログインの往復） | 門を置いてはいけない側 |
| `api/feedback-captures/[capture]` | `signedInActor()` | cookie。門あり |
| `api/feedback/pending` | `resolveIntegrationAccess(request, "read")` | 鍵。門あり |
| `api/mcp` | `authenticateRequest(request)` | 鍵。門あり |
| `api/telemetry` | `readerActorForSite(siteSlug)` | 読者向け。cookie 認証を要さない |
| `api/tools` | `authenticateRequest(request)` | 鍵。門あり |
| `api/tools/[tool]` | `authenticateRequest` + `actorForScope` | 鍵。門あり |

**反証は空振り。** cookie 認証が要るのに門が無いルートは無い。D-01 の「API 経路は middleware で見ない。各ルートが自分で持つ」は実測どおり。

### 反証の手口 3 — `decideEntry` を通してしまう入力を探す

`entry-gate.ts` の分岐は 4 本で、通すのは `found.ok && found.value !== null` の 1 本だけ。`middleware.ts` の `tryGetSessionReader()` は `try/catch` で全例外を握り、`tryGetDb()` が `null` を返せばそのまま `null` を返す。`null` は `decideEntry` で「確認できない」→ ログインへ。

**反証は空振り。** 保存先が落ちている・binding が無い・例外が飛んだ、のいずれも通さない側へ倒れる。D-02 の主張は正しい。

### finding F-01（重大 / D-01・D-02 の両方に掛かる）: 門の奥の落ち先が「見本の身元」である

設計書は D-01 を「入口は認証だけ・役は奥」と説明し、`middleware.ts` のコメントは「matcher を変えると守りは黙って外れる」と書く。**どちらも、外れたときに何が起きるかを書いていない。** 実測すると、外れたときに出るのは白紙ではなく**本物のデータ**である。

- `src/app/admin/` 配下の 50 ルートのうち **45 ファイルが `currentActor()` を呼ぶ**（`grep -rl currentActor src/app/admin | wc -l` → 45）。
- `src/presentation/composition.ts:396` — `currentActor()` は `resolveActor()` が `actor` 以外を返したとき `getCurrentActor()`（= `SAMPLE_ACTOR`）へ落ちる。
- `src/infrastructure/identity/sample-actor.ts:63` — `SAMPLE_ACTOR` は `roles: ["analyst"]`, `workspaceId: SAMPLE_WORKSPACE_ID`（`"ws_sample"`）。`analyst` は `content.read` / `analytics.read` / `affiliate.read_revenue` を持つ。

つまり門を 1 枚外した先にあるのは、**`ws_sample` の記事本文・分析数値・収益額を読める身元**である。AWS-ACC-01 の合格判定「本文を 1 バイトも返さずに」は、middleware **1 枚だけ**が支えている。設計書 D-01 は「同じ判定を 2 か所に置くと食い違う」を理由に多重化を退けているが、ここで多重化を退けた対象は**役の判定**であって**認証の有無**ではない。認証の有無について奥に何も無いことは、設計判断として記録されていない。

**求めること**: D-01 に「入口の門は認証について単一障害点である」ことと、その障害時の露出内容（`ws_sample` の読み取り）を明記する。塞ぐか記録に留めるかは設計者の判断でよいが、**書かないままにはできない**。

### finding F-02（重大 / D-02・D-10・AWS-ACC-02 に掛かる）: 担当を外された利用者が「見本の作業場所」へ落ちる

`src/infrastructure/identity/session-actor.ts:56-61` — 合言葉が有効でも、membership が引けない／`revokedAt !== null` のとき `{ kind: "not_member" }` を返す。
一方 `entry-gate.ts` の `decideEntry` は**合言葉の有効性しか見ない**ので、この利用者は門を通る。
そして `currentActor()` は `not_member` を `actor` ではないとして **`SAMPLE_ACTOR` へ落とす**。

結果、次が成立する。

> 作業場所 B の担当を外された（または一度も担当でない）利用者が、有効な合言葉で `/admin/analytics` を開くと、**作業場所 `ws_sample` の分析数値が表示される。**

これは AWS-ACC-02 の合格判定「別 Workspace のデータが一覧・詳細・API のいずれからも取得できない」に正面から反する。しかも `assertSameTenant` は発火しない — 落ちた先の actor の `workspaceId` が `ws_sample` に**書き換わっている**ため、取り出したデータと actor のテナントは一致してしまう。**D-03 の ② は、この経路に対して構造的に無力である。**

設計書は「`assertSameTenant` があるのでテナント分離は骨格がある」と現況表に書いているが、この経路はその骨格の外側を通る。

**求めること**: D-02 の「残る穴（塞がない。記録する）」節は保存先障害時の画面文言だけを扱っている。`not_member` → 見本への落下は文言の問題ではなくデータ露出なので、別の finding として P05/P06 の scope に入れるか、明示的に P12 へ送るかを設計側で決めること。

### finding F-03（中 / AWS-ACC-01 の「API 経路は 401」）

AWS-ACC-01 の合格判定は「API 経路は `401`」と書いているが、設計書 D-01 はこれに触れていない。実測すると `actorForScope` は鍵が通らないとき**断らずに読者へ落とす**（`composition.ts` の注記に理由が書いてある）。したがって `/api/tools` への無効な鍵つき呼び出しは `401` ではなく、読者の権限で処理が進み `FORBIDDEN`(403) になる。
これは意図された設計（読者ページの WebMCP を黙って壊さないため）だが、**AWS-ACC-01 の合格判定と食い違ったまま**である。P04 が合格判定どおり `401` を期待するテストを書けば赤になる。どちらを正とするかを設計側で決める必要がある。

---

## D-03: テナント分離の 3 層

### 反証の手口 1 — `tenant-scoped-ports.test.ts` が実際に何を見ているか読む

`tests/architecture/tenant-scoped-ports.test.ts` を読んだ。走査条件は 2 つ。

1. `src/application/ports/*.ts` の `export type X = { ... }` のうち、**名前が `RepositoryPort` で終わるものだけ**（`if (!portName.endsWith("RepositoryPort")) return;`）
2. その中の**メソッド署名の引数だけ**。合格条件は「`workspaceId: WorkspaceId` を取る」か「`workspaceId` を持つ domain 型を取る」

設計書の「見るのは port の**署名**であって実装の SQL ではない」は正しい。**しかし設計書が書いていない、より広い穴がある。**

### finding F-04（重大）: `*RepositoryPort` 以外の Port は 1 件も見られていない

同じ AST 走査を `Port` で終わる全型に広げて再実行した（`node` から `typescript` を直接使い、テスト内と同一の判定式 `takesWorkspaceId || carriesWorkspaceId` を再現）。作業場所を伴わないメソッドは **64 件**あり、そのうち検査が見ているのは `REPO` 印の **9 件**（すべて `EXEMPT` 済み）だけ。残る **55 件は検査の視野の外**にある。

視野外のうち、§26.4「キャッシュ／検索／ファイルの分離を含む全データ分離」に直接ぶつかるもの:

```
common.ts: CachePort.get(key: string)
common.ts: CachePort.set(key: string, value: T, ttlSeconds: number)
common.ts: CachePort.delete(key: string)
common.ts: StoragePort.put(key, body, contentType)
common.ts: StoragePort.getSignedUrl(key, expiresInSeconds)
common.ts: StoragePort.delete(key: string)
common.ts: TaskQueuePort.enqueue(task: T, options)
common.ts: EventPublisherPort.publish(event: DomainEvent)
llm.ts:    LlmPort.generateStructured(request: LlmRequest)
llm.ts:    LlmPort.embed(texts: readonly string[])
feedback.ts: FeedbackCaptureStoragePort（画面の写しの置き場）
```

`CachePort` と `StoragePort` は鍵が素の `string` で、作業場所の接頭辞を付ける決まりがどこにも型として無い。**キャッシュ鍵の衝突は、そのまま他テナントのデータの返却になる。** 要求ベースラインが継承した §26.4 は「キャッシュ/検索/ファイルの分離を含む」と明示しているのに、設計書 D-03 はリポジトリ層しか扱っていない。

**求めること**: D-03 に「① が覆うのは `*RepositoryPort` だけであり、キャッシュ・ファイル・キューは覆われていない」ことを明記し、AWS-ACC-02 の scope に含めるか除外するかを判断すること。除外するなら理由を書くこと（例: 現時点で `CachePort` の実装が無い、など。ただしそれは実測して書くこと）。

### finding F-05（重大）: ② の `assertSameTenant` は 44 ユースケース中 7 ファイルにしかない

```
grep -rl assertSameTenant src/application/usecases/ | wc -l  →  7
ls src/application/usecases/*/*.ts | wc -l                   →  44
grep -rl requireCapability src/application/usecases/ | wc -l →  38
```

`requireCapability`（権限）は 38/44 に入っているのに、`assertSameTenant`（テナント）は 7/44 である。設計書 D-03 の「1 層でも通ればよい設計にしない」「② が後段で見る」は、**現況の実測としては成立していない**。② を強制する仕組みも無い（`tenant-scoped-ports.test.ts` は自分のコメントで「ユースケースが `assertSameTenant()` を呼んでいるかは別の検査が見る」と書いているが、その「別の検査」は `tests/architecture/` に見当たらない）。

設計書は現況表で「テナント分離: `assertSameTenant` があり…骨格がある」と書いたが、**「ある」と「効いている」の距離が 7/44 である**ことは書かれていない。

**求めること**: ② の被覆率を設計書に実測値として書き、P06 が「実 D1 の結合テストで捕まえる」対象の量を後続に正しく伝えること。あわせて ② を強制する architecture テスト（`requireCapability` を呼ぶユースケースのうち、テナント付きの実体を読み出すものは `assertSameTenant` も呼ぶ）の要否を判断すること。

### finding F-06（中）: 拒否の監査が要求から落ちている

AWS-ACC-02 の合格判定は「拒否は **request ID 付きで**監査に残る」、AWS-ACC-04 は「actor / workspace / action / result を含む監査記録が残る」と書いている。**設計書 D-03〜D-05・D-09・D-10 のいずれも監査に一切触れていない。**

実測:

- `grep -rn requestId src/domain/ src/application/audit.ts src/db/schema.ts` → **0 件**。`AuditLogEntry` に request ID の列そのものが無い。
- `requireCapability` を呼ぶ 38 ファイルのうち、`auditLog` / `recordAudit` をまったく持たないものが 19 ファイル以上（読み取り系ユースケースが中心。`read-metrics.ts` / `read-dashboard.ts` / `ai-usage-report.ts` など）。

したがって、いま `analyst` が公開操作を叩いて 403 になっても、その拒否は監査に残らない。AWS-ACC-04 の合格判定の後半（監査記録）は現状では満たせない。

**求めること**: 監査を 4 条件の scope に含めるか、明示的に他 phase（P08 など）へ送るかを設計書に書くこと。いま設計書は**沈黙**しており、沈黙は後続に「済んでいる」と読まれる。

---

## D-04: 他テナントは 403 ではなく「見つかりません」

### 反証の手口 — `TENANT_MISMATCH` の全出現を追い、応答の**本文**まで見る

```
src/domain/shared/errors.ts:19          コードの定義
src/domain/shared/tenancy.ts:107        生成箇所（メッセージは "… が見つかりません。"）
src/presentation/http/error-response.ts:24   TENANT_MISMATCH: 404
tests/presentation/error-format.test.ts:56   404 == NOT_FOUND を固定
```

**403 で出る経路は 1 件も無い。番号については設計書の主張は正しい。**

### finding F-07（重大 / 差し戻しの根拠）: 本文が同一でない。しかもテストがその差を固定している

要求ベースライン AWS-ACC-02 の合格判定は「存在しない ID と**同一の `404`（本文も同一）**を返す。存在の有無が応答差から読めないこと」である。設計書 D-04 はこれを「実装形である」と断言している。実測すると偽である。

`src/presentation/http/error-response.ts:43-58` の `errorResponse()` は本文に **`code` をそのまま入れる**。

| | 存在しない ID | 他テナントの ID |
|---|---|---|
| status | 404 | 404 |
| `error.code` | `"NOT_FOUND"` | **`"TENANT_MISMATCH"`** |
| `error.message` | 「… が見つかりません。」 | 「… が見つかりません。」 |
| `error.suggestedAction` | 呼び出し元ごと | **「ワークスペースを切り替えているか確認してください。」** |

`error.code` の 1 語で「その ID は他所に実在する」が読める。**403 を 404 に直した目的が、本文で打ち消されている。**

さらに悪いことに、この差は**テストで固定されている**。`tests/presentation/error-format.test.ts:69`:

```ts
expect(body.error.code).toBe(code);   // 全 15 コードに対して
```

つまり D-04 を要求どおりに直すには、既存の通っているテストを変える必要がある。設計書の「変更するファイル」表には `error-response.ts` も `error-format.test.ts` も無い。

同じ漏れは他の 2 経路にもある。

- MCP: `tests/presentation/error-format.test.ts:76-80` が固定しているとおり、`errorToMcpResult()` の本文に `code: TENANT_MISMATCH` と `status: 404` が文字列で入る。
- 画面: `src/presentation/refusal-text.ts:28` の `refusalText()` は `message + "\n" + suggestedAction` を返すので、管理画面上でも「ワークスペースを切り替えているか確認してください。」が出る。未存在の場合とは違う文である。

**verdict: 差し戻し。** D-04 は「番号を揃える」までしか設計しておらず、要求は「本文まで揃える」を求めている。設計書は後者を満たしていると書いているが、実測は満たしていない。

**求めること**: 次のいずれかを設計として選び、書くこと。

1. `TENANT_MISMATCH` を presentation の境界で `NOT_FOUND` へ**写し替えて**から本文を組む（ドメインは区別を保ち、外へ出る形だけ潰す）。`error-format.test.ts` の意図（コードの写し漏れを見る）とは、写し替えを 1 か所に閉じれば両立できる。
2. 要求ベースライン AWS-ACC-02 の「本文も同一」を緩める。ただしそれは確定章 AUTH-ACC-002 の文言を変えることになるので、P03 の権限外であり上流へ差し戻す必要がある。

**1 を推す。** 2 は「守れないので基準を下げる」形になり、`403` を `404` にした理由そのものが消える。

### 再確認（同日・並行変更後）: 1 が実装されたが、画面経路が残っている

再測すると `src/presentation/http/error-response.ts:57-74` に `maskExistence()` が入っており、`NOT_FOUND` と `TENANT_MISMATCH` を `{ code: "NOT_FOUND", message: "対象が見つかりません。", suggestedAction: "一覧から選び直すか、ID を確認してください。" }` の 1 種類へ潰している。適用箇所は 2 つ。

- `errorResponse()`（REST）— `error-response.ts:78`
- `errorToMcpResult()`（MCP）— `mcp-adapter.ts:38`

**しかし `src/presentation/refusal-text.ts` は `maskExistence` を import していない**（`grep -n maskExistence src/presentation/refusal-text.ts` → 0 件）。`refusalText()` は `message + "\n" + suggestedAction` をそのまま返すので、**管理画面上では従来どおり「ワークスペースを切り替えているか確認してください。」が出る。**

AWS-ACC-02 の受け入れ条件は「**一覧・詳細・API のいずれからも**取得できない」であり、画面（一覧・詳細）は明示的に対象である。**F-07 は縮小して存続する。** 潰す場所を「1 箇所」にした狙いどおりにするなら、3 つ目の入口である画面もそこを通す必要がある。設計書 D-04 は入口を「REST / WebMCP / backend MCP の 3 つ」と数えているが、**画面（server component / server action）が数から漏れている。**

---

## D-05: 権限の 403 とは分ける

### 反証の手口

`TENANT_MISMATCH` を 403 で返す経路、および `FORBIDDEN` を 404 で返す経路の両方向を grep した（上表のとおり `ERROR_STATUS` は 1 か所しかなく、`statusOf()` を迂回して数字を直書きしている箇所も `src/app/api/` に無い — `Response.json(..., { status: access.status })` は `resolveIntegrationAccess` が返す 401/403 のみ）。

**反証は空振り。** `FORBIDDEN` = 403、`TENANT_MISMATCH` = 404 の分離は保たれている。

`requireCapability` が `suggestedAction` に「必要な権限: ${capability}。ワークスペース管理者に依頼してください。」を入れていることも実測で確認した（`permissions.ts` 末尾）。設計書の「権限名を文面に含める」は実装済み。

**verdict: 承認。** ただし F-07 のとおり、D-05 が正しく分かれていることが、D-04 側の本文差をより読みやすくしている（`code` を見れば 403 系か 404 系かだけでなく、404 の中の 2 種類まで分かる）。

---

## D-06 / D-07 / D-08: ブランド既定値

### 反測の手口 1 — `isEmpty()` を読み、null の免責が本当に止まるか確かめる

`src/domain/generation/generation-input.ts` の実装:

```ts
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;      // ← 配列・オブジェクトは常に「埋まっている」
}
```

`REQUIRED_INPUT_KEYS` は `rankingModel` 以外の全 17 件。`disclosure` は含まれる。
よって `disclosure: null` → `isEmpty(null) === true` → `missingInputFields` に「広告表示」が積まれ → `validateGenerationInput` が `VALIDATION_FAILED` を返す。

**D-07 の主張どおり、null は止まる。反証は空振り。**
`settings-sample-repository.ts:173` に `disclaimer: null` のブランド（`br_second`）が実在するので、P04 はこれをそのまま素材に使える。

### finding F-08（中 / D-07）: 根拠に挙げた関数が存在しない

設計書 D-07 は「`null` のまま渡せば `checkGenerationInput` が『広告表示が未入力』として止める」と書く。

```
grep -rn "checkGenerationInput" . --include=*.ts --include=*.tsx
→ ヒットは architecture-design.md:114 の 1 行のみ。コードには存在しない。
```

実在するのは `validateGenerationInput()` と `missingInputFields()` である。**設計書が、実測したと称して実在しない関数名を根拠に置いている。** 挙動の結論は正しいので差し戻しはしないが、名前は直すこと。P04 がこの名前で import を書けば即座にコンパイルが落ちる。

### finding F-09（中 / D-06・D-07）: 提案されている返り値の型が `GenerationInput` に入らない

D-06 の提案:

```
brandGenerationDefaults(brand) → { cta: {...}, disclosure: brand.disclaimer }
```

`brand.disclaimer` は `string | null`。一方 `GenerationInput.disclosure` は `string`（非 null）で、`Partial<GenerationInput>` にしても `string | undefined` にしかならない。**`null` は代入できない。**
D-08 が指定する合成 `{...brandDefaults, ...provided}` は、この時点で型エラーになる。

実行時は `isEmpty(null)` が拾うので**振る舞いとしては D-07 の意図どおり**だが、型としては通らない。設計として次のどれかを決める必要がある。

- `brandGenerationDefaults` の返り値を `GenerationInput` 由来ではない独立の型（`{ cta: ...; disclosure: string | null }`）とし、合成側で `Partial<GenerationInput>` へ落とす関数を別に書く
- `GenerationInput.disclosure` を `string | null` に広げる（**推さない**。必須欄であることを型で言えなくなる）

### finding F-10（重大 / D-06・AWS-ACC-03）: 呼び出し側が変更ファイル表に 1 つも無い

設計書「変更するファイル（P05 の予定範囲）」は次の 2 行しかない。

| ファイル | 変更 |
|---|---|
| `src/domain/identity/brand.ts` | `brandGenerationDefaults()` を追加 |
| `tests/acceptance/feat-auth-workspace/*.test.ts` | 受け入れテスト |

**呼び出し側がどこにも無い。** これで P05 が終わると、成果物は「誰も呼んでいない純関数 1 本」になる。
AWS-ACC-03 の**不合格の形**として要求ベースラインが挙げているのは、まさに「入力変数の口はあるが誰も渡していない（`port-wiring` が見る形の穴）」である。設計書自身が現況を「口はあるが誰も呼んでいない形そのもの」と診断しておきながら、**その形をもう 1 段深くして終わる設計になっている。**

実測した配線先の候補:

- `src/infrastructure/persistence/sample/generation-sample-input.ts:36-37` — `cta` と `disclosure` を直書きしている唯一の組み立て地点。設計書もここを名指ししているのに、変更表に無い。
- `src/presentation/composition.ts:1223` `sampleGenerationInputForTrial()` → `src/app/admin/generation/page.tsx:71` の `provided:` — 生成入力が実際に流れる 1 本の経路。
- Brand を引く口: `BrandRepositoryPort`（`src/application/ports/identity.ts:15`）。ただし現状 Brand を読んでいるのは `manage-workspace.ts` の一覧表示だけで、生成側から Brand を引く経路は**存在しない**。

AWS-ACC-03 の合格判定「**ブランドを切り替えると渡る値も切り替わる**」を満たすには、生成入力の組み立てが Brand を引ける必要がある。その配線（どのユースケースが `brandId` を受け取り、どの Port で Brand を引くか）が設計されていない。

**求めること**: D-06 に「どこが `brandGenerationDefaults` を呼ぶか」「Brand をどこから引くか」を書き、変更ファイル表に加えること。これが無いと P05 は受け入れ条件を緑にできない。

### 再確認（同日・並行変更後）: 予測が実測になった

`src/domain/identity/brand.ts` に `brandGenerationDefaults()` と `withBrandDefaults()` が実装された。呼び出し元を数え直すと:

```
grep -rn "withBrandDefaults" src/ tests/ | grep -v domain/identity/brand.ts
→ tests/acceptance/feat-auth-workspace/brand-defaults.test.ts の 5 行のみ。src/ からは 0 件。
```

`generation-sample-input.ts:36-37` の直書きは**そのまま残っている**。したがって現時点でも:

- ブランドを切り替えても、生成へ渡る `cta` / `disclosure` は変わらない
- 受け入れテストは通るが、それは**テストが自分で呼んだから**であって、製品の経路が変わったからではない

これは AWS-ACC-03 の不合格の形「口はあるが誰も渡していない」に**新しい層が 1 つ増えた**状態である。**F-10 は存続。** 受け入れテストが緑であることを AWS-ACC-03 の達成と読まないこと。

### finding F-11（中 / D-08）: `{...defaults, ...provided}` は明示的 `undefined` で既定値を消す

D-08 は合成の向きを `{...brandDefaults, ...provided}` と定めている。JavaScript のスプレッドは**キーの存在**で上書きするので、`provided` が `{ disclosure: undefined }` のように**キーはあるが値が undefined** の形だと、既定値が `undefined` で潰される。

```
{...{disclosure: "既定文"}, ...{disclosure: undefined}}  →  {disclosure: undefined}
```

`provided` の型は `Partial<GenerationInput>` で、フォーム状態や `Object.fromEntries` 由来の値は「キーがあって undefined」になりやすい。この形になると `missingInputFields` が「広告表示が未入力」で止めるので**安全側には倒れる**が、D-08 が約束した「呼び出し側が何も言わなかったときに既定値が入る」は成立しない。ブランドに免責を設定してあるのに未入力扱いで止まる、という利用者から見て不可解な失敗になる。

**求めること**: 合成の規則を「キーが存在し、かつ値が `undefined` でないときだけ `provided` が勝つ」と明記すること。スプレッド 1 行では書けないので、実装形も設計書に書くこと。

### finding F-12（低 / D-08）: `cta` は `isEmpty` を素通りする

`isEmpty` はオブジェクトを常に「埋まっている」と判定する（上記実装の最終行）。したがって `cta: { kind: "brand_default", phrase: "" }` は**未入力として検出されない**。空文字の呼びかけがそのまま生成へ流れる。

設計書はこれを `createBrand()` の既定値フォールバック（`input.defaultCta?.trim() || DEFAULT_CTA`）が防ぐ前提で書いているように読めるが、実測すると:

```
grep -rn "createBrand" src/  →  定義の 1 行のみ。呼び出し 0 件。
```

`src/infrastructure/persistence/sample/settings-sample-repository.ts:150-180` は `Brand` のオブジェクトリテラルを**直接**組み立てており、`createBrand()` を通らない。つまり `defaultCta` が非空である保証は、現状どこにも無い。

**求めること**: `brandGenerationDefaults` 側で `phrase` の空を扱うか（例: 空なら `cta` を返さず既定値なしとする）、`createBrand()` を唯一の入口にすることを別 phase へ送るか、判断して書くこと。

**再確認（同日・並行変更後）: 実装されたコードのコメントが、この誤った前提を明文化してしまった。**
`src/domain/identity/brand.ts:153` に「呼びかけ文のほうは `createBrand` が必ず既定を入れるので、常に埋まる」と書かれた。`createBrand()` の呼び出しは `src/` 全体で **0 件**であり、実在する `Brand` は `settings-sample-repository.ts:150-180` のオブジェクトリテラルで作られている。**この前提は今日の時点で偽である。** F-12 は存続し、優先度を上げる（誤った前提が根拠として文書化されると、次に読む人が検証せずに信じる）。

---

## D-09 / D-10: 権限

### 反証の手口 1 — capability 表を実測

`src/domain/identity/permissions.ts` の `ROLE_CAPABILITIES`:

```ts
analyst: ["content.read", "analytics.read", "affiliate.read_revenue"],
```

- `content.publish` を**持たない** ✓
- `analytics.read` を**持つ** ✓

`requireCapability(actor, "content.publish", ...)` → `can()` → `capabilitiesOf(["analyst"]).has("content.publish")` → `false` → `FORBIDDEN` → 403（`ERROR_STATUS.FORBIDDEN`）。
`analytics.read` は `true` を返す。

**設計書 D-09 の「表の上では既に成立している」は実測どおり。反証は空振り。**

### 反証の手口 2 — 並行する「ロールで判定する」経路を探す

`src/domain/shared/tenancy.ts` に `hasRole()` と `requireRole()` が実在する。`requireRole` は **`owner` に無条件の通行を与える**（`if (hasRole(actor, "owner") || ...)`）。これは D-09 が退けたはずの「ロールで判定する」形そのものであり、しかも capability 表とは独立に動く。

```
grep -rn "requireRole(" src/ | grep -v tenancy.ts  →  0 件
grep -rn "hasRole("    src/ | grep -v tenancy.ts  →  0 件
```

**呼び出しは 0 件。反証は空振り**（現時点では判定を反転させられない）。ただし**削除もされていない**ため、次に書く人が `requireCapability` の代わりにこちらを掴む余地は残っている。`tests/architecture/single-definition.test.ts` はこの二重の判定路を見ていない。**低リスクの finding として記録する。**

### finding F-13（中 / D-09・AWS-ACC-04 の「組合せで反転」）: 組合せは和集合しかなく、拒否を表現できない

`capabilitiesOf` は素直な和集合である。

```ts
for (const role of roles) for (const cap of ROLE_CAPABILITIES[role]) set.add(cap);
```

したがって:

- `["analyst"]` → 公開不可
- `["analyst", "publisher"]` → **公開可**（`publisher` が `content.publish` を持つ）

これは和集合の当然の帰結だが、要求ベースライン AWS-ACC-04 は**不合格の形**として「ロールの組合せで判定が反転する」を名指ししている。設計書 D-09 は組合せに一切触れていない。

問題は「和集合が悪い」ことではなく、**和集合しか無いために「このロールを持つ人には公開させない」を表現する手段が無い**ことである。`HUMAN_ONLY_CAPABILITIES` は `isAiServiceAccount` という**ロールとは別のフラグ**でしか効かないので、拒否側の唯一の仕組みが人／AI の 1 軸に固定されている。

**求めること**: D-09 に「組合せは和集合であり、拒否は表現しない」を明記し、P04 が固定すべき組合せ（少なくとも `["analyst"]` 単独と `["analyst","publisher"]` の 2 件）を指定すること。**書かないと、P04 は `analyst` 単独しか試さず、和集合の意味が誰にも固定されないまま残る。**

### finding F-14（中 / D-09・D-10）: `isAiServiceAccount` と `roles` の整合が誰にも保証されていない

`can()` の AI 制限は `actor.isAiServiceAccount` という**boolean 1 個**に依存する。この値と `roles` の内容を突き合わせる場所は無い。

- `session-actor.ts:70` — 人の経路は無条件に `isAiServiceAccount: false`
- `composition.ts:337` — 鍵の経路は無条件に `true`
- `roles` は `membership-reader.ts` の `row.roles as readonly Role[]` — **D1 の値を検証なしでキャスト**

したがって membership 行の `roles` に `"ai_service_account"` が入っていれば、人の経路で入った利用者が `isAiServiceAccount: false` のまま AI 用ロールの capability を得る。逆向き（AI ロールを人が持つことで公開が通る）は `ai_service_account` が `content.publish` を持たないので今日は起きないが、これは**表の中身に依存した偶然**であり、D-09 が言う「1 か所で読める」性質からは導けない。

さらに、`roles` が未知の文字列を含むと `capabilitiesOf` は `for (const cap of ROLE_CAPABILITIES[role])` で `undefined` を反復し **TypeError で落ちる**。D1 の 1 行の打ち間違いが、権限判定の例外になる。

**求めること**: membership から読んだ `roles` を `Role` として検証する場所（またはしないと決めた理由）を D-10 に書くこと。

### 反証の手口 3 — セッショントークンに権限が埋まっていないか確かめる（D-10）

`session-repository.ts` の `findValid` が返すのは `{ userId, workspaceId }` のみで、`roles` は含まれない（`grep -n "roles" src/infrastructure/identity/session-repository.ts` → 0 件）。
`session-actor.ts:55` が毎回 `memberships.findByUser()` を呼び、`revokedAt !== null` を `not_member` に落とす。

**反証は空振り。D-10 の主張は実測どおり成立している。**（ただし `not_member` の落ち先は F-02 のとおり。）

---

## テスト配置の逸脱（`src/lib/` → `tests/acceptance/`）

### 反証の手口 — 判定関数を直接叩いて再現する

`src/lib/` を実際に作って `pnpm vitest run tests/architecture/quality-gates.test.ts` を走らせる予定だったが、**後片付けの `rm -rf src/lib` を含むコマンドが権限で拒否された**ため、作業ツリーに何も作らずに済ませた（拒否されたコマンドを別の書き方で通すことはしていない）。代わりに、テストが呼んでいる判定関数 `judgeLayerInventory` を `quality-gates.config.mjs` から直接 import し、実際の `src` 直下の一覧に合成の `lib` を足して評価した。**副作用は無い。**

```
現状:                     unfloored = ["db"]         MAX_UNFLOORED_LAYERS = 1  → 緑
src/lib（.spec.ts のみ）: unfloored = ["db", "lib"]                          → 赤
src/lib（空）:            unfloored = ["db", "lib"]                          → 赤
isMeasuredSource("a.spec.ts") = true
```

- `LAYER_EXEMPTION_RULES` の「二重下線で囲まれた道具の置き場」は `entry.name` を見るが、`entry` は **`src` 直下のディレクトリ**である。`src/lib/auth/__tests__/` は `entry.name === "lib"` なので**この免除に当たらない**。
- 「測られる中身を持たない」免除も、`isMeasuredSource` が `.d.ts` 以外の全 `.ts` を真とするので `.spec.ts` は測られる側。当たらない。
- 空ディレクトリでも赤になる（`files.length > 0 &&` の条件により免除に当たらない。config のコメントが意図的にそう書いている）。

**設計書の根拠は正しい。反証は空振り。**

### 設計書が**過小に**書いている点（承認の範囲内の補足）

設計書は `.spec.ts` の害を「トレーサビリティから見えない」と説明しているが、実測するともっと重い。

- `vitest.config` の `include` は `["tests/**/*.test.ts", "tests/**/*.test.tsx"]`。`src/lib/**/*.spec.ts` は**そもそも実行されない**。トレーサビリティ以前に、テストとして一度も走らない。
- 同 config の coverage `include` は `["src/**/*.ts", "src/**/*.tsx"]`、`exclude` は `.d.ts` と `.css` のみ。したがって置いた `.spec.ts` は**カバレッジ対象の本番コードとして数えられ**、一度も実行されないまま 0% として計上される。
- `scripts/traceability.mjs:52` が拾うのは `.test.ts` / `.test.tsx` だけ、というのは設計書のとおり。

結論は変わらないが、理由は「見えなくなる」ではなく「**走らない・かつカバレッジを下げる**」である。設計書の該当節にこの 2 点を足すことを勧める。

### finding F-15（低）: `acceptance-reconciliation.json` の要否が書かれていない

隣接 feature の `docs/spec/feat-uiux-overhaul/` には `acceptance-reconciliation.json` があり、`tests/architecture/acceptance-reconciliation.test.ts` がそれを読んでいる。`docs/spec/feat-auth-workspace/` には無い。この feature でも要るのか、要らないならなぜかが設計書の引き継ぎ表に無い。P04 が受け入れテストを書いた後に必要になる可能性があるので、設計側で確認しておくこと。

---

## このレビューが見ていないもの

**確かめられなかったことを、確かめたことと同じ節に混ぜない。** 以下はすべて未検証である。

1. **テストを 1 本も実行していない。** `pnpm vitest` は一度も走らせていない。`quality-gates.test.ts` の再現は、テストではなく判定関数 `judgeLayerInventory` を直接呼んだもの。テスト本体の走査部分（`readdirSync` で `src` を読む側）が実際に同じ結果を出すかは見ていない。
2. **`src/lib/` をファイルシステム上に作っていない。** 後片付けのコマンドが拒否されたため、実物での赤は見ていない。判定関数の入力を合成した推論である。
3. **実 D1 での検証をしていない。** リポジトリ実装の SQL に `where workspace_id` が付いているかは 1 本も読んでいない。設計書自身が「P06 の結合テストでしか捕まらない」と書いている領域であり、本レビューもそこには踏み込んでいない。F-04（`CachePort` / `StoragePort`）についても、**実装が存在するかどうかを確かめていない**。署名だけを見た指摘である。
4. **middleware が Cloudflare Workers 上で実際に実行されるかを確認していない。** `@opennextjs/cloudflare` のビルド出力も、デプロイ後の挙動も見ていない。F-01 が「単一障害点」であるという指摘の重さは、この点が確かめられて初めて確定する。
5. **Better Auth 本体（`/api/auth/[...all]`）の中身を読んでいない。** セッション発行側の挙動、cookie の属性（`HttpOnly` / `SameSite` / `Secure`）、CSRF の扱いは対象外とした。AWS-ACC-01 は「未ログインで管理画面」の条件なので直接は掛からないが、入口の門の前提ではある。
6. **`tests/e2e/` を読んでいない。** Playwright 側に既存の認証テストがあるかどうかを確認していない。P04 と重複する可能性は排除できていない。
7. **要求ベースラインの上流（確定済み auth 章、`docs/spec/01-要求仕様書-v1.0.md` §25〜§26）を読んでいない。** 本レビューは要求ベースラインの記述を正として設計書と突き合わせた。要求ベースライン自身が上流を正しく写しているかは P01 のレビュー対象であり、ここでは検証していない。**F-07 の差し戻しは「要求ベースラインが正しい」ことに依存している。**
8. **性能・可用性を見ていない。** `resolveActor()` は画面 1 枚ごとに D1 へ 2 往復（session + membership）する。45 の管理画面ページすべてがこれを呼ぶが、その妥当性は評価していない。
9. **F-02 の再現をしていない。** `not_member` → `SAMPLE_ACTOR` の経路はコードを読んで導いたもので、実際にセッションを作って `/admin/analytics` を開いてはいない。
10. **並行変更の全体を追えていない。** レビュー中に別の作業者が `src/` と `tests/` の 50 ファイル以上を動かしている（`git status` で確認）。再確認したのは `brand.ts` / `error-response.ts` / `mcp-adapter.ts` の 3 本だけで、`src/application/ports/feedback.ts`・`monetization.ts`・`src/db/schema.ts`・`quality-gates.config.mjs` などの変更が本レビューの実測（とくに F-04 の port 走査結果と、層一覧の再現）を無効化していないかは**見ていない**。F-04 の 64 件という数は、変更前の `src/application/ports/` に対する数である。
11. **新規に置かれた `tests/acceptance/feat-auth-workspace/` を読んでいない。** `brand-defaults.test.ts` は呼び出し元を数えるために grep しただけで、テストの中身が受け入れ条件を正しく写しているかは評価していない（それは P04 のレビュー対象である）。
12. **`docs/product/open-doors.md` の現況記述を読んでいない。** `sample-actor.ts` のコメントが「管理画面の入口 49 か所は誰でも開ける」と書いているが、これが middleware 導入前の記述として古いのかどうかは確認していない。

## 後続 phase への引き継ぎ

| 引き継ぐもの | 受け取る phase |
|---|---|
| F-07（TENANT_MISMATCH の本文が漏れる）の設計判断のやり直し | **P02 へ差し戻し** |
| F-04 / F-05（分離 3 層の実被覆）の設計判断のやり直し | **P02 へ差し戻し** |
| F-10（`brandGenerationDefaults` の呼び出し側と Brand の引き口）の設計追記 | **P02 へ差し戻し** |
| F-08（`checkGenerationInput` → `validateGenerationInput`）、F-09（型）、F-11（合成規則）の訂正 | P02 |
| F-13 の組合せ 2 件を含む受け入れテストの設計 | P04 |
| F-03（`/api/` が 401 か 403 か）の合格判定の確定 | P04（要 P01 との突き合わせ） |
| F-01 / F-02（見本の身元への落下）の扱いの決定 | P05・P06、または P12 |
| F-06（拒否の監査と request ID）の scope 判断 | P02 → P08 |
| F-12（`defaultCta` が空でも通る）、F-14（`roles` の未検証キャスト）、`requireRole` の死んだ判定路 | P06 または follow-up issue |
| F-15（`acceptance-reconciliation.json` の要否） | P04 |
