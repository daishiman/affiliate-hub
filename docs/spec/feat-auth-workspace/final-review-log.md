# feat-auth-workspace 最終レビュー記録

- graph_node_id: `SYS-AUTH-WORKSPACE-P10`
- document_state: `historical_snapshot`
- snapshot_as_of: `2026-08-24 P10 実測時点`
- superseded_by: [`acceptance-report.md`](./acceptance-report.md)（後続の受入再判定）/
  [`handover.md`](./handover.md)（現在値と未確認事項）
- 上流: [`requirements-baseline.md`](./requirements-baseline.md)（AWS-ACC-01〜04 の合格判定表）/ [`acceptance-report.md`](./acceptance-report.md)（P07）/ [`quality-security-report.md`](./quality-security-report.md)（P09）
- 位置づけ: 派生文書（非規範）。規範は確定済み仕様章（auth / security / database）と `docs/spec/01-要求仕様書-v1.0.md` §25〜§26。

この文書はP10時点の失敗と、その後に何を直す必要があったかを残す履歴である。
「完了できない」は現在のrelease判定ではなく、このsnapshot時点の結論として読む。

## この文書が答えるもの / 答えないもの

答えるのは 1 つ。**「P07 の受け入れ判定と P09 の品質・セキュリティ保証は、P01 の合格判定と食い違っていないか」**である。

答えないもの:

- 穴を塞ぐこと。本 task の write scope は本文書 1 本で、`src/` と `tests/` を 1 バイトも変えていない。
- 判定のやり直し。P07 の判定を独立に検算し、支持できる／できないを言う。作り直しはしない。

**追認の儀式にしないために、次の 3 つを実際に探した。**

1. P01 の合格判定と、実装・テストが食い違っている箇所
2. 「口はあるが誰も呼んでいない」形が残っていないか
3. 受け入れ条件を「隠すこと」で満たしている箇所（UI から消すだけでサーバー側が通る、など）

見つからなかったものは「見つからなかった」と、探した手口つきで下に書く。

### レビュー条件

| 項目 | 値 |
|---|---|
| レビュー日時 | 2026-08-24 12:20〜13:00 JST |
| ブランチ | `daishiman/task20-2` |
| HEAD | レビュー開始時 `4a1da54` → 終了時 `f34803a`。**レビュー中に他の作業者がコミットを進めた** |
| 作業ツリー | 未コミット変更あり。**他の作業者が並走しており、レビュー中にもファイルが動いている** |
| 参照した P07 文書 | `acceptance-report.md`（レビュー開始時点では未生成。12:40 頃に出現したものを読んだ） |

**この最終レビューも動いている的を撃っている。** P09 が同じ注意書きを残しているのと同じ状態が続いており、
下の実測はすべて上記時刻のファイル内容に紐づく。

## 結論を先に書く

**P07 の 4 判定のうち 3 件は支持する。1 件（AWS-ACC-03「合格」）は支持できない。**

| ID | P07 の判定 | P10 の判定 | 差 |
|---|---|---|---|
| AWS-ACC-01 | 未検証 | **未検証（支持）** | 追加で、唯一の実装 `src/middleware.ts` が**テストに 1 行も通されていない**ことを実測した（FR-02） |
| AWS-ACC-02 | 不合格 | **不合格（支持）** | P09 は同じ条件を「応答の形は対策済み」としており、両者が食い違う。実測では P07 が正しい（FR-03） |
| AWS-ACC-03 | 合格 | **合格と言えない** | 画面経路に配線が通っていない。合格判定は道具（MCP/REST）経路でしか成立していない（FR-01） |
| AWS-ACC-04 | 不合格 | **不合格（支持）** | 監査要件の未実装を独立に再現した |

したがって **feat-auth-workspace は完了できない。** 4 条件のうち、この日の実測で合格と言えるものは **0 件**である。

---

## FR-01（重大 / AWS-ACC-03）: 生成画面には配線が通っていない

**P01 が挙げた不合格の形「入力変数の口はあるが誰も渡していない（`port-wiring` が見る形の穴）」が、画面経路にそのまま残っている。**

### 実測

`createDraftContentVariantUseCase` の呼び出しは `src/` に 2 か所ある。**片方だけがブランドを渡している。**

```
$ grep -n -A4 "createDraftContentVariantUseCase({" src/presentation/composition.ts src/presentation/tools/generation-tools.ts
src/presentation/composition.ts:1184:    draft: createDraftContentVariantUseCase({ llm: deps.llm, costs: deps.llmCosts }),
src/presentation/tools/generation-tools.ts:36:  const draft = createDraftContentVariantUseCase({
src/presentation/tools/generation-tools.ts-37-    llm: deps.llm,
src/presentation/tools/generation-tools.ts-38-    costs: deps.llmCosts,
src/presentation/tools/generation-tools.ts-39-    brands: deps.brands,
src/presentation/tools/generation-tools.ts-40-  });
```

`composition.ts:1184` は `generationUseCases()` の中身で、これを呼ぶのは管理画面である
（`src/app/admin/generation/page.tsx:52`、`inputs/page.tsx:35`、`prompt/page.tsx:28`）。**`brands` が無い。**

受け側は、`brands` が無ければ**何もせずに素通りする**。

```
src/application/usecases/generation/draft-content-variant.ts:289
  if (brands === undefined || brandId === undefined) return ok(provided);
```

さらに、渡す側の画面は `brandId` も渡していない。

```
$ grep -n -A4 "uc.draft.execute" src/app/admin/generation/page.tsx
70:      : uc.draft.execute(actor, {
71-          provided: trial === "ready" ? sampleGenerationInputForTrial() : {},
72-          model,
73-        }),

$ grep -rn 'brandId' src/app/admin/generation/
(該当 0 件)
```

`sampleGenerationInputForTrial()` は、P04 のテスト設計が
「生成側は見本データの固定文言（`generation-sample-input.ts`）を使っていた」と名指しした、まさにその固定文言である。

### つまり何が成立していないか

| 経路 | ブランドの標準 CTA・標準免責が届くか |
|---|---|
| 道具経路（`/api/tools` / `/api/mcp` → `generationTools`） | **届く**（`brands` も `brandId` も渡っている） |
| 画面経路（`/admin/generation` → `generationUseCases`） | **届かない**。`brands` が無く `brandId` も渡らないので、`applyBrandDefaults` は 1 行目で戻る |

AWS-ACC-03 の合格判定は
「Brand に設定した標準 CTA・標準免責が、記事生成の入力変数へ**呼び出し側が明示しなくても**既定値として入る」であり、
**経路を限定していない。** 利用者が設定画面に書いた文字が、利用者が使う生成画面には届かない。

### なぜテストで捕まらなかったのか

`tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` の「生成ユースケースまで届いているか」3 件は、
**テスト自身が `brands:` を組み立てて渡している**（同ファイル `ブランド保存先(brand)`）。
だから「ユースケースは受け取れる」までしか言っていない。
本物の組み立て場所（`composition.ts:1184`）が渡していないことは、この形のテストでは原理的に見えない。

P07 は不合格の形の表で「入力変数の口はあるが誰も渡していない」を「**検出できる**」と書いている。
**この記述は支持できない。** 検出しているのはテストが自分で作った配線であって、製品の配線ではない。

`node scripts/port-wiring.mjs --check` も検出しない。実行結果は `EXIT=0` だが、
判定は「呼ばれていない 69（上限 79）」という**閾値**であり、1 本の欠落は閾値の内側に沈む。

### P10 の判定

AWS-ACC-03 は **合格と言えない**。判定を覆すのではなく、**P07 が見た範囲が「ユースケース以降」に限られていた**ことを記録する。
塞ぐなら `composition.ts:1184` に `brands: deps.brands` を足し、画面から `brandId` を渡す 2 点で、
それを固定する検査は「本物の組み立て場所から取り出した `draft` を叩く」形でなければ効かない。

---

## FR-02（重大 / AWS-ACC-01）: 門の実装が、テストに 1 行も通されていない

AWS-ACC-01 を支えているのは `src/middleware.ts` 1 枚である（P03 finding F-01 が「単一障害点」と呼んだもの）。
**その 1 枚のカバレッジを実測すると 0% だった。**

2 通りの範囲で測った。**狭い方**は受け入れ関連 8 ファイルだけ、**広い方**は
`tests/acceptance` `tests/domain` `tests/infrastructure` `tests/application` `tests/presentation` `tests/property`
の **145 ファイル 3611 件**である（コマンドと全文は `evidence/P11/` にある）。

| ファイル | 狭い範囲 lines | 広い範囲 lines | 広い範囲 branches |
|---|---|---|---|
| `src/middleware.ts` | **0%（14 行中 0 行）** | **0%（14 行中 0 行）** | **0%** |
| `src/infrastructure/identity/entry-gate.ts` | 100% | 100% | 100% |
| `src/domain/identity/permissions.ts` | 100% | 100% | 100% |
| `src/domain/shared/tenancy.ts` | 50% | 100% | 100% |
| `src/domain/identity/brand.ts` | 64.7% | 100% | 100% |
| `src/presentation/http/error-response.ts` | 87.5% | 100% | 90.9% |
| `src/infrastructure/identity/session-actor.ts` | 100% | 100%（functions 66.66%） | 81.25% |

**範囲を広げると、`middleware.ts` 以外はすべて 100% まで上がる。`middleware.ts` だけが 0% のまま動かない。**
3611 件のテストを 1 件残らず通しても、この 14 行は一度も実行されない。

P09 は未確認 #1 として「`/admin` へ GET したら 302 が返り本文が 1 バイトも出ないことを確かめた記録は無い」と書き、
P07 は同じ理由で「未検証」とした。**両者とも正しい。** P10 はそこへ数値を足す——
**判定関数（`entry-gate.ts`）は 100% で、配線（`middleware.ts`）は 0% である。**
「関数は緑だが配線は見ていない」が、比喩ではなく計測値として出ている。
しかも狭い範囲では他ファイルの数値も低いので 0% が埋もれるが、広い範囲では**この 1 枚だけが取り残される**ことがはっきり見える。

`session-actor.ts` の functions 66.66% は、`resolveActor` の中の関数のうち 1 つが呼ばれていないことを指す。
FR-07（`not_member` → 見本の作業場所への落下）の経路が、実行としては確かめられていないことと符合する。

---

## FR-03（重大 / AWS-ACC-02）: P07 と P09 が、同じ条件について食い違っている

| 文書 | AWS-ACC-02 の記述 |
|---|---|
| P09 `quality-security-report.md`（11:33） | 状態欄「**応答の形は対策済み。**SQL の実体と監査は未確認」。未確認一覧に画面経路は無い |
| P07 `acceptance-report.md`（12:4x） | 判定「**不合格**」。理由に「画面経路（Server Action）が本文同一化を通っていない」を挙げる |

**実測すると P07 が正しい。**

```
$ grep -n maskExistence src/presentation/refusal-text.ts src/presentation/admin/use-case-result.ts
(該当 0 件)

$ grep -rn "maskExistence" src/ --include=*.ts --include=*.tsx
src/presentation/http/error-response.ts:66:export function maskExistence(...)
src/presentation/http/error-response.ts:78:  const error = maskExistence(input);   ← REST
src/presentation/tools/mcp-adapter.ts:6, 38                                        ← MCP
```

`src/presentation/admin/use-case-result.ts` の `failureFromDomainError()` は
`DomainError` をそのまま `refusalText()` へ渡す。`refusalText()` は `message + "\n" + suggestedAction` を返すので、
他所の Workspace の ID を指したときだけ「ワークスペースを切り替えているか確認してください。」が画面に出る。
存在しない ID のときは「一覧から選び直すか、ID を確認してください。」で、**文が違う**。
この経路は 17 ファイルが使っている（`grep -rln refusalText src/`）。

AWS-ACC-02 の合格判定は「一覧・詳細・API の**いずれからも**取得できない」であり、画面は明示的に対象である。
P03 finding F-07 は測定後の再確認でこれを「縮小して存続」と記録しており、**その記録が P09 へ伝わっていない**。

**この食い違い自体が指摘である。** P09 の表だけを読んだ人は AWS-ACC-02 を「応答の形は済んだ」と読む。
P09 は「未確認と書いていないものには根拠が付いている」という約束で書かれているので、
この 1 行は約束の外側にある。

---

## FR-04（中）: P03 の差し戻し 3 件が、設計文書へ反映されないまま後続が進んだ

P03 は D-03 / D-04 / D-06 の 3 件を **差し戻し**と判定し、引き継ぎ表で「**P02 へ差し戻し**」と書いている。

実測（更新時刻）:

```
10:39  requirements-baseline.md    (P01)
10:45  architecture-design.md      (P02)
11:07  design-review-log.md        (P03)   ← 差し戻しはここで出た
11:20  test-design.md              (P04)
11:33  quality-security-report.md  (P09)
11:35  migration-decision.md       (P08)
12:4x  acceptance-report.md        (P07)
```

**`architecture-design.md` は P03 のレビューより古いまま一度も更新されていない。**
差し戻された 3 件に対する再設計の記録は、`docs/spec/feat-auth-workspace/` のどの文書にも無い。

このうち D-04（本文同一化の入口の数え落とし）は FR-03 として、
D-06（呼び出し側が変更ファイル表に無い）は FR-01 として、**いま実際に現物として残っている**。
**差し戻しを文書へ戻さなかったことと、穴が残ったことは同じ 1 つのことである。**

---

## FR-05（中 / AWS-ACC-01）: 「API 経路は 401」が、誰にも決められないまま 3 phase を通過した

P01 の合格判定は「API 経路は `401`」と書いている。
P03 は finding F-03 で「実測すると `actorForScope` は鍵が通らないとき断らずに読者へ落とすので `403` になる。
どちらを正とするか設計側で決める必要がある」と指摘し、引き継ぎ表で **P04** へ送った。

```
$ grep -n '401' docs/spec/feat-auth-workspace/test-design.md
(該当 0 件)
```

**P04 は 401 に触れていない。** P07 も未検証として残した。
つまり「合格判定と実装が食い違っている」という指摘が、P03 → P04 → P07 と 3 つの phase を通り抜けて、
**どこでも決着していない**。

実装の現況は 3 通りに分かれている（実測）:

| 入口 | 未認証時 |
|---|---|
| `/api/feedback-captures/[capture]` | **401**（`signedInActor()` が `null` なら 401。合格判定どおり） |
| `/api/tools` / `/api/mcp`（鍵あり・通らない） | `resolveIntegrationAccess` が **401**（`composition.ts:296,306`） |
| `/api/tools` / `/api/mcp`（鍵なし・同一サイト） | `readerActor()` へ落ち、以降の権限判定で **403** |

3 番目だけが合格判定と違う。しかもそれは意図された設計（読者ページの WebMCP を黙って壊さないため）で、
理由も `composition.ts` に書いてある。**塞ぐべき穴ではなく、決めるべき判断である。** 決まっていないことが問題である。

---

## FR-06（記録 / AWS-ACC-02・AWS-ACC-04）: 拒否の監査は、独立に確かめても無い

P07・P09 の記述を鵜呑みにせず、同じ grep を独立に実行した。**両者の記述は正しい。**

```
$ grep -rn 'requestId\|request_id' src/domain/ src/db/schema.ts
(該当 0 件)

$ grep -in 'denied\|deny\|forbidden' src/domain/compliance/audit-log.ts
(該当 0 件)
```

AWS-ACC-02 の「拒否は request ID 付きで監査に残る」と
AWS-ACC-04 の「actor / workspace / action / result を含む監査記録が残る」は、いずれも満たしていない。
P03 finding F-06 が「設計書 D-03〜D-05・D-09・D-10 のいずれも監査に一切触れていない」と指摘したものが、
設計に足されないまま P09・P07 の不合格理由になっている。**FR-04 と同じ経路の話である。**

---

## FR-07（記録 / AWS-ACC-02）: `not_member` が見本の作業場所へ落ちる経路が、誰にも扱われていない

P03 finding F-02 の経路が、いまも同じ形で残っている。

```
src/infrastructure/identity/session-actor.ts:57  membership が引けなければ not_member
src/infrastructure/identity/session-actor.ts:60  revokedAt !== null でも not_member
src/presentation/composition.ts:402-404
  export async function currentActor(): Promise<ActorContext> {
    const resolved = await resolveActor();
    return resolved.kind === "actor" ? resolved.actor : getCurrentActor();   ← SAMPLE_ACTOR
  }
```

管理画面の 46 ファイルが `currentActor()` を呼ぶ（`grep -rl currentActor src/app/admin | wc -l` → 46）。
`SAMPLE_ACTOR` は `workspaceId: "ws_sample"` / `roles: ["analyst"]` なので、
**担当を取り消された利用者が、期限内の通行証で管理画面を開くと `ws_sample` の読み取りが通る。**

P09 が「担当者の登録が無い人には通行証を作らない」と書いているのは**発行時**の話で、
**発行後に担当を外された場合**（通行証の有効期間は 12 時間）は塞がっていない。

P03 はこれを「P05・P06、または P12」へ送ったが、
`architecture-design.md` にも `quality-security-report.md`（残存リスク R-1〜R-7）にも
`acceptance-report.md` にも記載が無い。**送り先が決まらないまま消えている。**

なお P03 自身が「F-02 の再現をしていない」と書いており、**本レビューも再現していない**（コードの読み取りだけである）。
`assertSameTenant` が発火しないのは、落ちた先の actor の `workspaceId` が `ws_sample` に書き換わっているためで、
これはコード上明らかだが、実際にセッションを作って画面を開いた記録は無い。

---

## 探して、見つからなかったもの

**空振りを書かない承認は、読んだことの証拠にならない。** 手口と実測を残す。

### ① 「UI から消すだけでサーバー側が通る」形

P01 が AWS-ACC-04 の不合格の形として名指ししているもの。次の手口で探し、**見つからなかった**。

- 管理画面の変更操作は Server Action（`src/presentation/admin/*-action.ts`）を通り、
  そこから useCase へ入る。useCase の入口は `requireCapability(actor, ...)` で始まる
  （`draft-content-variant.ts:127` など、`content.publish` を扱う 5 ファイルすべてを確認）。
- 見本の身元 `SAMPLE_ACTOR` は `roles: ["analyst"]` の 1 つだけで、書き込みの役を持たない
  （`src/infrastructure/identity/sample-actor.ts:63`。2026-08-18 に書き込みの役を外した記録がコメントにある）。
- 並行する役ベースの判定路 `requireRole` は呼び出し 0 件で、判定は capability に一本化されている。

**ただし「画面に出ているボタンとサーバー側の判定が一致しているか」は見ていない。** 逆向き
（サーバーが断るのに画面にボタンが出ている）は本条件の対象外なので、探していない。

### ② 「全部拒否して緑に見せる」形

P01 が「全部 403 にして『落ちているから安全』に見せる」と名指ししているもの。**見つからなかった。**

`tests/acceptance/feat-auth-workspace/access-boundary.test.ts` は 3 条件それぞれで許可側を同じ `describe` に置いており
（`自分のものは取れる（全部 404 に倒していないこと）` / `同じ役でも、許された操作は通る（全部 403 に倒していないこと）` /
`通行証が無ければ戻し、有効なら通す（通す側が消えていないこと）`）、
判定を一律 `false` にする壊れ方では緑にならない。実行して 141 件緑を確認した（`evidence/P11/test-results.json`）。

### ③ `port-wiring` が見る形の穴

```
$ node scripts/port-wiring.mjs --check
EXIT=0
つなぎ目の呼び出し   ポート 64 / 手続き 196 / 呼ばれていない 69（上限 79） / 理由つき除外 0（上限 0）
書き込みなのに記録へ届いていない入口   届いていない 0（上限 0） / 理由つき除外 4（上限 4） / 判定できない 0（上限 0）
記録が残せなくても進む入口   2（上限 2）
```

**門としては緑だが、FR-01 は検出していない。** 判定が閾値（69 ≤ 79）である以上、
1 本の配線欠落は数の中に沈む。この門の緑を「配線に穴が無い」と読んではいけない。

### ④ 型検査

親から「`src/app/admin/settings/compliance/page.tsx` に別作業由来の型エラーが 1 件ある」と伝えられていたが、
**本レビューの実測では再現しなかった。**

```
$ pnpm run typecheck        # next typegen && tsc --noEmit --incremental false
Generating route types...
✓ Types generated successfully
EXIT=0
```

当該ファイルは未追跡（`?? src/app/admin/settings/compliance/page.tsx`）で、
並走する作業者がレビュー中に直した可能性が高い。**直っていることを確認した、とまでは言えない**
（直る前の状態を自分で見ていないため）。事実として「12:5x 時点で型検査は緑」だけを記録する。

---

## P07 判定の検算

P07 の 4 判定を、根拠として挙げられたテストを自分で走らせて確認した。

```
$ pnpm vitest run \
    tests/acceptance/feat-auth-workspace/access-boundary.test.ts \
    tests/acceptance/feat-auth-workspace/brand-defaults.test.ts \
    tests/presentation/error-format.test.ts \
    tests/infrastructure/entry-gate.test.ts \
    tests/infrastructure/session-actor.test.ts \
    tests/domain/permissions.test.ts \
    tests/architecture/tenant-scoped-ports.test.ts \
    tests/architecture/tenant-scoped-schema.test.ts \
    --reporter=verbose

 Test Files  8 passed (8)
      Tests  141 passed (141)
EXIT=0
```

P07 が挙げたテスト名はすべてこの出力に含まれる。**テスト結果としての記述に誤りは無い。**
食い違いは、テストが緑であることと条件が満たされていることの距離（FR-01・FR-02）にある。

### 回帰は 6 ディレクトリ分だけ取れた。全テストは取れていない

P09 が未確認 #9 として P11 へ送った「全テスト回帰 0 件」は、**半分だけ取れた**。

**取れた分**（`tests/acceptance` `tests/domain` `tests/infrastructure` `tests/application` `tests/presentation` `tests/property`）:

```
 Test Files  145 passed (145)
      Tests  3611 passed (3611)
   Duration  67.44s
EXIT=0
```

**取れなかった分**: `pnpm vitest run --coverage`（全ディレクトリ）は完走せず、終了コード `144` で停止した。
落ちた 50 件超はいずれも 20〜60 秒／件の実行時間で、**並走する他の作業者による CPU 不足のタイムアウト**である
（`tests/ui/route-branch-reached.test.ts` 単体で 1494 秒）。
上の 145 ファイルが 67 秒で完走していることが、これがコードの問題ではないことを示している。

したがって `tests/ui` `tests/architecture` `tests/integration` `tests/e2e` の回帰は**未測定**である。
**「落ちた」とも「通った」とも書かない。測れなかった、と書く。**
作業ツリーが静かになってから測り直す手順を `evidence/P11/reproduction-steps.md` に残した。

---

## 完了可否

**完了できない。**

| 条件 | 状態 | 残っているもの |
|---|---|---|
| AWS-ACC-01 | 未検証 | 実 HTTP 応答での確認（`middleware.ts` は 0% カバレッジ）。API の 401/403 の判断（FR-05） |
| AWS-ACC-02 | 不合格 | 画面経路の本文同一化（FR-03）。拒否の監査と request ID（FR-06）。`not_member` の落下（FR-07） |
| AWS-ACC-03 | 合格と言えない | 画面経路の配線（FR-01） |
| AWS-ACC-04 | 不合格 | 拒否の監査（FR-06） |

判定を「合格」に寄せられる材料は無い。
一方、**この feature が何も進んでいないわけではない**ことも記録しておく。
P05 が入れた 2 つ（ブランド既定値の道と `maskExistence` による存在の一点集約）は実測で効いており、
P09 の計測 C は `maskExistence` を外すと 3 件が赤くなることを示している。
残っているのは**その 2 つを最後まで配線すること**と、**要求に書いてあって設計に降りなかった監査**である。

## 後続 phase への引き継ぎ

| 引き継ぐもの | 受け取る phase |
|---|---|
| FR-01（生成画面への `brands` / `brandId` の配線と、本物の組み立て場所を叩く検査） | P05・P06 への差し戻し |
| FR-02（`middleware.ts` を実 HTTP 応答で通す検証。`pnpm run preview` 上） | P11 |
| FR-03（画面経路の本文同一化。`refusalText` を `maskExistence` の後段にする） | P05 への差し戻し、または P12 |
| FR-04（P03 の差し戻し 3 件の設計への反映） | **P02 へ差し戻し（P03 の引き継ぎが未消化のまま）** |
| FR-05（API 経路が 401 か 403 かの確定。P01 の合格判定を直すか実装を直すか） | P01 との突き合わせが要るため上流判断 |
| FR-06（拒否の監査と request ID。語と出す場所を同時に） | P12 |
| FR-07（`not_member` → 見本の作業場所への落下の扱いの決定） | P12（P03 が「P05・P06 または P12」としたまま未決） |
| 全テスト回帰 0 件とカバレッジ 80% の再計測（作業ツリーが静かになってから） | P11 |
| 確定済み仕様章の実装状態の更新（P09 の残存リスク R-1） | P13 |

---

## 2026-08-24 最終追補（上記時点判定の解消確認）

この追補は上記レビュー履歴を消さず、同日後続で入った修正を現在の worktree に対して再確認した記録である。

| 指摘 | 最終状態 | 根拠 |
|---|---|---|
| FR-01 画面のブランド既定値配線 | 解消 | `brands: deps.brands` と 1 ブランド時の補完、`brand-defaults-wiring.test.ts` |
| FR-02 middleware 未実行 | 解消 | `admin-entry-middleware.test.ts` が本物の `middleware()` 応答を検証 |
| FR-03 画面と API の拒否文差 | 解消 | `refusal-text.ts` / `error-response.ts` と presentation 回帰 |
| FR-04 設計への差し戻し未反映 | 解消 | architecture / handover / release notes と本追補へ反映 |
| FR-05 API 401 / 403 の未決 | 設計を明記 | API 認証失敗は 401、公開 same-origin 読み取りが capability で断られる場合は 403 |
| FR-06 拒否監査なし | 解消 | `access-denial.ts`、`audit_logs.request_id`、`denial-audit.test.ts` |
| FR-07 `not_member` の sample fallback | 解消 | `currentActor()` は識別済み actor 以外を未識別の最小権限へ落とし、拒否監査で追跡 |

最終ゲートを本追補後に再実行した。279/279 ファイル、6,754/6,754 件 PASS。全体 coverage は Lines 91.78% / Branches 82.00% / Functions 89.72% / Statements 89.47%、層別も全下限を満たした。ホスト高負荷時に a11y 2件が30秒 timeout したが、単独242件と低並列・手動 timeout 上限300秒の全体 run では再現せず、assertion failure は0件だった。

変更21ファイル・1,710変異の mutation は初期2,281テスト PASS 後、推定1時間超のため MVP 方針で中断した。未実施を合格とは記録しない。typecheck / lint / migration / acceptance / coverage-report / traceability / required-test-types / port-wiring / spec-freshness / dependency audit は PASS。本番 Google OAuth、remote D1 migration、複数ブランド選択 UI は MVP のリリース後続であり、ローカル受入の合否には混ぜない。
