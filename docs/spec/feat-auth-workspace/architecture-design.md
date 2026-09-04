# feat-auth-workspace 設計

- graph_node_id: `SYS-AUTH-WORKSPACE-P02`
- 前提: [`requirements-baseline.md`](./requirements-baseline.md)（AWS-ACC-01〜04）
- 位置づけ: 派生文書（非規範）。規範は確定済み仕様章と `docs/spec/01-要求仕様書-v1.0.md` §25〜§26。

## 先に書く: 現況の実測と、確定章との食い違い

確定済み auth 章は本 feature の実装状態を `not_started` と記録しているが、**コードを実測すると 4 条件のうち 3 つは既に骨格がある**。

| 領域 | 確定章の記録 | 実測（2026-08-24 時点のコード） |
|---|---|---|
| 入口の門 | 未実装 | `src/middleware.ts` + `src/infrastructure/identity/entry-gate.ts` が `/admin` 配下を守っている |
| ロール権限 | 未実装 | `src/domain/identity/permissions.ts` に 11 ロール × 30 capability の表と `requireCapability` がある |
| テナント分離 | 未実装 | `src/domain/shared/tenancy.ts` の `assertSameTenant` があり、`TENANT_MISMATCH` は「見つかりません」の語調で返る |
| ブランド既定値の受け渡し | 未実装 | **本当に無い。** `Brand.defaultCta` / `Brand.disclaimer` と `GenerationInput.cta` / `.disclosure` は両方あるが、**繋ぐ処理が 1 つも無い** |

この食い違いは章の誤りではない。章は「要求判断を収集済み」を意味する `confirmed` であって実装状態の報告ではなく、`not_started` の更新は P13 の writeback が持つ。**本設計はコードの実測を正とし、章の更新は P13 へ送る。**

したがって本 feature の設計上の主題は「1 から作る」ではなく、**残っている 1 本の配線を通し、既にあるものが 4 条件を実際に満たすことを検証可能にする**ことである。

## 4 条件それぞれの設計

### AWS-ACC-01 未ログインで管理画面 → ログイン画面

**設計方針: 既存のまま。作り直さない。**

```
リクエスト
  └─ src/middleware.ts        matcher = ["/admin", "/admin/:path*"]
       └─ isGuardedPath()      /admin 配下だけ。読者ページ・/signin・/api/auth は通す
       └─ decideEntry(token, sessionReader, now)
            ├─ 通行証なし        → /signin へ
            ├─ 通行証が無効      → /signin へ
            ├─ 確認できない      → /signin へ（保存先が落ちても通さない）
            └─ 通す              → NextResponse.next()
```

**設計判断 D-01: 入口の門は「ログインしているか」しか見ない。**

役（ロール）の判定を入口に置かない。同じ判定を 2 か所に置くと必ず食い違い、**食い違ったとき浅い方（入口）が先に古くなる**。役を 1 つ足したとき奥は直すが入口は忘れる、という向きにしか壊れないためである。役の判定は application 層のユースケース入口（`requireCapability`）に 1 か所だけ置く。

この判断は既に `entry-gate.ts` の設計として実装されている。本設計はそれを追認し、**P04 のテストで固定する**。

**設計判断 D-02: 「確認できない」を通さない。**

セッション保存先へ届かなかったとき、`decideEntry` は「たぶん本人だろう」で通さずログインへ戻す。通すと**保存先を落とせば門を外せる**ことになる。

**残る穴（塞がない。記録する）**: 「まだログインしていない」と「保存先が落ちていた」が利用者から見て同じ画面になるため、保存先障害時に利用者はログインし直し続ける。区別は `ActorResolution.unavailable` として 1 層下では付いているが、`signedInActor()` が `null` へ潰すため画面まで届かない。塞ぐには画面の文言を 2 系統に分ける必要があり、それは本 feature の scope_out（UI 拡張）に近いので P12 の runbook へ送る。

**API 経路**: `/api/tools` などは cookie を持たない鍵経路であり、middleware では見ない。各ルートが `authenticateApiRequest` を自分で持つ。ここを middleware で一律に断ると鍵経路まで止まる。

### AWS-ACC-02 別 Workspace のデータが取れない

**設計方針: 3 層で重ねる。1 層でも通ればよい設計にしない。**

```
① Port 層     … リポジトリの引数に workspaceId を必須にする（型で強制）
                 例: BrandRepositoryPort.findById(workspaceId, id)
② Domain 層   … assertSameTenant(actor, entity) で取り出した後にも照合
③ 応答の形    … TENANT_MISMATCH は「見つかりません」の語調で返す
```

**設計判断 D-03: ① だけに頼らない。**

「読み出し時に where を書き忘れる」が最も起きやすい漏洩経路である。型で強制しても、`workspaceId` を渡す側が actor のものではなく引数から来た値を渡せば抜ける。② が「取り出したものが本当に自分のテナントのものか」を後段で見る。

**設計判断 D-04: 他テナントは `403` ではなく「見つかりません」。**

`403` は「在るが見せない」を意味し、**他所の Workspace にその ID が存在すること自体が漏れる**。`assertSameTenant` は `TENANT_MISMATCH` を返すが、利用者へ見せる文は未存在と同一の「見つかりません」にする。これは確定章 AUTH-ACC-002 の「未存在 ID と同一の `404` 応答・本文で」の実装形である。

**設計判断 D-05: 権限（AWS-ACC-04）の `403` とは分ける。**

自分の Workspace 内の操作は対象の存在が既に本人に見えているので、隠すものが無く `403` でよい。`requireCapability` は `FORBIDDEN` を返し、必要な権限名を文面に含める。「権限がありません」だけだと利用者が誰に頼めばよいか分からない。

**この設計が保証しないもの**: `tenant-scoped-ports.test.ts` が見るのは port の**署名**であって、実装の中の SQL に `where workspace_id` が実際に付いているかではない。実装側の抜けは P06 の結合テスト（実 D1）でしか捕まらない。

### AWS-ACC-03 ブランドの標準 CTA・標準免責が生成の既定値になる

**ここが本 feature で唯一、新しく作る部分である。**

現況（実測）:

```
Brand.defaultCta      : string          ← ある（既定 "価格を見る"）
Brand.disclaimer      : string | null   ← ある
        ‖
        ‖  ← 繋ぐものが無い（これが穴）
        ‖
GenerationInput.cta        : {kind, phrase} | null   ← ある（必須欄）
GenerationInput.disclosure : string                  ← ある（必須欄）
```

`sampleGenerationInput()` は `cta` と `disclosure` を**その場に直書き**している。ブランドを切り替えても変わらない。これは `port-wiring` が探している「口はあるが誰も呼んでいない」形そのものである。

**設計判断 D-06: 変換はドメインに置き、純関数にする。**

`src/domain/identity/brand.ts` に `brandGenerationDefaults(brand)` を置く。

```
brandGenerationDefaults(brand) → {
  cta:        { kind: "brand_default", phrase: brand.defaultCta },
  disclosure: brand.disclaimer,     // null のときは null のまま返す
}
```

ドメインに置く理由は 2 つ。

1. **単体で確かめられる。** application 層のユースケースの中に `if` として埋めると、ユースケースを丸ごと動かさない限りこの変換は実行されない。
2. **ブランドの意味を知っている場所に置く。** 「標準 CTA が何を意味するか」は Brand 集約の知識で、生成側の知識ではない。

**設計判断 D-07: 免責が未設定なら `null` を返し、既定文で埋めない。**

`Brand.disclaimer` が `null` のとき、ここで「この記事には広告が含まれます」のような既定文を返さない。返すと**設定漏れが設定済みに化ける**。`GenerationInput.disclosure` は必須欄なので、`null` のまま渡せば `checkGenerationInput` が「広告表示が未入力」として止める。**止まるほうが、勝手に埋まって公開まで進むより安全である。**

これは `Brand` 型のコメント「空でもよいが、設定漏れと区別する」と同じ方針であり、REQ-QC09（広告表記が空でも公開できてしまう、を防ぐ）に接続する。

**設計判断 D-08: 呼び出し側が明示した値を上書きしない。**

既定値は「呼び出し側が何も言わなかったときに入るもの」である。記事ごとに CTA を変えたい場合があるので、明示された値が勝つ。合成の向きは `{...brandDefaults, ...provided}` とする。

### AWS-ACC-04 権限のないロールが公開操作 → 403

**設計方針: 既存のまま。作り直さない。**

```
ユースケース入口
  └─ requireCapability(actor, "content.publish", "記事の公開")
       ├─ can(actor, cap)
       │    ├─ actor.isAiServiceAccount && HUMAN_ONLY_CAPABILITIES.has(cap) → false
       │    └─ capabilitiesOf(actor.roles).has(cap)
       └─ false なら DomainError("FORBIDDEN", "… を行う権限がありません。必要な権限: content.publish")
```

**設計判断 D-09: ロールではなく capability で判定する。**

`if (role === "writer")` を画面や API に書くと、ロールを 1 つ足すたびに全部を直すことになり、必ず直し漏れる。「公開できるのは誰か」を 1 か所で読めるようにする。

**設計判断 D-10: 権限は membership から引く。セッショントークンに埋めない。**

トークンへ埋めると、権限を剥奪してもトークンの期限が切れるまで効かない。`ActorContext.roles` は membership 表から都度引いた値とする。

現行の capability 表では `analyst` は `["content.read", "analytics.read", "affiliate.read_revenue"]` を持ち、`content.publish` を持たない。つまり AWS-ACC-04 の「Analyst が公開すると 403、分析閲覧は成功」は**表の上では既に成立している**。P04 はこれを**表の読み替えではなく実行で**固定する。

## テスト配置の逸脱（記録）

P04 / P05 の task spec は `src/lib/auth/`, `src/lib/workspace/`, `src/lib/brand/`, `src/lib/rbac/` を write scope に挙げているが、**このリポジトリに `src/lib/` は存在しない**。

`src/` の直下は `app / application / db / domain / infrastructure / presentation / types` で、`quality-gates.config.mjs` の `LAYER_COVERAGE` はちょうど 5 層（`src/domain` 90 / `src/application` 85 / `src/presentation` 75 / `src/app` 70 / `src/infrastructure` 70）を宣言している。`tests/architecture/quality-gates.test.ts` は「層の一覧が `src` の実際の作りと一致する」ことを見ており、除外は名前の一覧ではなく規則（`.d.ts` だけの置き場 / `__tests__` のような二重下線の囲み）で書かれている。

**`src/lib/` を新設すると、床を持たない層が 1 つ増えてこの検査が落ちる。** よって:

| task spec の指定 | 実際の配置 | 理由 |
|---|---|---|
| `src/lib/auth/__tests__/login-redirect.spec.ts` | `tests/acceptance/feat-auth-workspace/login-redirect.test.ts` | 上記。テストは `tests/` 配下に集約されている |
| `src/lib/workspace/__tests__/workspace-isolation.spec.ts` | `tests/acceptance/feat-auth-workspace/workspace-isolation.test.ts` | 同上 |
| `src/lib/brand/__tests__/brand-defaults.spec.ts` | `tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` | 同上 |
| `src/lib/rbac/__tests__/role-403.spec.ts` | `tests/acceptance/feat-auth-workspace/role-403.test.ts` | 同上 |
| `src/lib/brand/`（実装） | `src/domain/identity/brand.ts` へ追記 | Brand 集約は既にここにある。二重定義を作らない（REQ-FD05 / `single-definition` 検査） |
| `drizzle/schema/` | `src/db/schema.ts` | スキーマの入口は 1 つに保つ（REQ-FD05） |

拡張子も `.spec.ts` ではなく `.test.ts` にする。`scripts/traceability.mjs` が集めるのは `.test.ts` / `.test.tsx` だけで、`.spec.ts` は**要件の紐付けを数える対象から外れる**（`tests/e2e/*.spec.ts` は Playwright 用で vitest の対象外）。`.spec.ts` で置くと、テストは存在するのにトレーサビリティ上は「どの要件にも紐づいていない」ですらなく**見えない**状態になる。

## 変更するファイル（P05 の予定範囲）

| ファイル | 変更 |
|---|---|
| `src/domain/identity/brand.ts` | `brandGenerationDefaults()` を追加（新規関数のみ。既存の型・関数は変えない） |
| `tests/acceptance/feat-auth-workspace/*.test.ts` | 4 条件の受け入れテストを新規追加 |

**スキーマ変更は行わない。** `brands` 表は現状 `src/db/schema.ts` に無く、Brand は見本データ経由で扱われている。表の追加は本 feature の 4 条件のどれにも必要ではなく（AWS-ACC-03 は Brand オブジェクトから生成入力への変換であって永続化ではない）、`workspace_id` の backfill を含むデータ移行は **P08 が所有する**と task spec が定めている。ここで先に表を足すと P08 の移行判断を奪う。

## 後続 phase への引き継ぎ

| 引き継ぐもの | 受け取る phase |
|---|---|
| 設計判断 D-01〜D-10 の独立レビュー | P03 |
| 4 条件のテスト実装 | P04 |
| `brandGenerationDefaults` の実装と配線 | P05 |
| `brands` 表の追加要否とテナント backfill | P08 |
| 「確認できない」の画面文言分離 | P12 |
| 確定 auth 章の実装状態 `not_started` → 更新 | P13 |
