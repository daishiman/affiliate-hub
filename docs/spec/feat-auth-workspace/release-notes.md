# feat-auth-workspace リリースノート

- graph_node_id: `SYS-AUTH-WORKSPACE-P13`
- 作成日: 2026-08-24
- 位置づけ: 派生文書（非規範）。規範は確定済み仕様章（`system-spec/auth.md` / `security.md` / `database.md`）。

## 0. 実デプロイは行っていない（N/A の理由）

**この feature は Cloudflare の本番へ出していない。** たたき台（プロトタイプ）構築段階であり、
task spec の Workstream applicability が Infrastructure を `N/A` と宣言しているためである。

出していないので、以下は**すべて未検証**である。書いていないのではなく、確かめていない。

- 本番 Workers 上での Google ログインの実通し
- 本番 D1 に対する `drizzle/0023_aromatic_flatman.sql` の適用
- 本番の `wrangler secret` に `BETTER_AUTH_*` / `GOOGLE_*` が入っているか

### ただし、手元の Workers ランタイムでは起動まで確かめた

「本番へ出していない」と「Workers で動くか分からない」は別のことなので、分けて書く。

| 何 | 結果 |
|---|---|
| `pnpm run build`（`tsc` を含む） | 終了コード **0** |
| `pnpm run build:worker`（OpenNext） | `.open-next/worker.js` を出力。「OpenNext build complete.」 |
| `opennextjs-cloudflare preview` の起動 | `workerd` が `127.0.0.1:8787` / `[::1]:8787` で LISTEN |
| 結び付け | `env.DB`（D1 local）/ `env.BUCKET`（R2 local）/ `env.ASSETS` / `env.LLM_PROVIDER_CATALOG` |

**この過程で 1 件バグが出た。** `next build` が
`tests/acceptance/feat-auth-workspace/brand-defaults-wiring.test.ts(136,7): TS2741 Property 'embed' is missing in type ... but required in type 'LlmPort'`
で落ちた。テストは 6726 件すべて緑だった。**vitest は型を見ないので、テストファイルの型の誤りは
テストを何度走らせても出てこない。** worker を組み立てて初めて出る種類の誤りである。

最終レビューでは起動した 8787 へ最小の HTTP smoke を実行した。結果は §7 に記録する。

## 1. この版で何が変わったか

### ① 画面からの生成にも、ブランドの既定値が届くようになった

**症状（P10 の FR-01 が実測）**: 標準 CTA と標準免責は道具経路（`/api/tools`, `/api/mcp`）では
指示文へ載るのに、画面経路（`/admin/generation`）では載らなかった。
`src/presentation/composition.ts` の組み立てが `brands` を渡していなかったためである。

**直したこと**:

| ファイル | 変更 |
|---|---|
| `src/presentation/composition.ts` | `generationUseCases()` の `draft:` に `brands: deps.brands` を渡す |
| `src/application/usecases/generation/draft-content-variant.ts` | `brandId` 未指定でも、作業場所にブランドが **1 つだけ**なら既定値を入れる |

**2 つ以上あるときは選ばない。** 別のブランドの免責が載った記事が出るほうが、
免責が入らずに入力の門で止まるより害が大きい（景表法・ステマ規制の側で効く）。
複数ブランドの作業場所では `brandId` を明示するまで届かない。塞ぐには画面へブランド選択欄を足すことになる。

### ② 断ったことが、request ID 付きで記録に残るようになった

**症状（P07 の AWS-ACC-02 / AWS-ACC-04 が不合格とした理由）**: 403 の判定も他テナントの
「見つかりません」も緑だったが、**断ったこと自体がどこにも残っていなかった**。
行が無いと「誰も試していない」と「試して止めた」が同じ顔になる。
前者と後者では次にすることが違う（役の付け直しか、侵入の調査か）。

| ファイル | 変更 |
|---|---|
| `src/domain/compliance/audit-log.ts` | 記録に `requestId` を持たせ、**断りの語では `requestId` 無しの記録を作れなくした** |
| `src/application/access-denial.ts` | 断りをユースケースの外側で拾って記録へ落とす |
| `src/db/schema.ts` / `drizzle/0023_aromatic_flatman.sql` | `audit_logs.request_id` 列と `(workspace_id, request_id)` の索引 |

「入れ忘れたら空欄で通る」ではなく「入れ忘れたら記録を作れない」にしてある。

### ③ 入口の門そのものが動かされるようになった

`src/middleware.ts` は **3611 件のテストで 1 行も実行されていなかった**（P10 の FR-02、lines 0%）。
判定部品（`entry-gate.ts`）は 100% だったが、配線が違う部品を呼んでいれば門は開いたままになる。

`tests/acceptance/feat-auth-workspace/admin-entry-middleware.test.ts` が `middleware()` を実際に呼び、
返ってきた `Response` を見る。差し替えているのは**保存先（D1）だけ**で、判定も応答の組み立ても本物を通す。

### ④ 新しい部品: `Checkbox`

はい/いいえを 1 つだけ聞く欄。素の `<input type="checkbox">` は押しどころが下限（`--tap-target-min`）に
届かないため、`.choiceItem` を持つ `<label>` で包む。`CheckboxGroup`（複数から選ぶ欄）と分けたのは、
1 つしか無いときに `fieldset` + `legend` を使うと読み上げで空回りの入れ子が読まれるためである。

## 2. データベースの変更

| 移行 | 内容 | 後方互換 |
|---|---|---|
| `drizzle/0022_orange_mystique.sql` | `policy_rules`、`disclosures.workspace_id` / `ai_assisted` / `updated_at` と索引 | **条件付き**。旧 `disclosures` が 0 行の環境だけ適用可。1 行以上なら guard が停止する |
| `drizzle/0023_aromatic_flatman.sql` | `audit_logs.request_id`（`text`, NULL 可）追加 + 索引 | **あり**。既存行は `NULL` のまま読める |

NULL 可にしてあるので、**移行を先に当てても古いコードは動く**。
逆順（コードを先に出して移行が後）は、断りの記録で `no such column: request_id` になる。
順序は「移行 → 公開」を守ること（`runbook.md` §2 の 7 手順と同じ理由）。

## 3. 受け入れ条件の状態

判定は P07（`acceptance-report.md`）が持つ。ここには**この版で動いた分**だけを書く。

| ID | 1 回目 | この版で足したもの | 最終 |
|---|---|---|---|
| AWS-ACC-01 | 未検証 | `middleware()` の実応答を見る試験（本文が空であること）+ API の 401 実測 | **合格** |
| AWS-ACC-02 | 不合格 | 断りの request ID 付き記録 + 画面経路（Server Action）の本文同一化 | **合格** |
| AWS-ACC-03 | 合格（P10 が異議） | 画面経路への配線を実装し、**製品の配線そのものを読む**試験を追加 | **合格** |
| AWS-ACC-04 | 不合格 | 同上（AWS-ACC-02 と同じ記録の仕組み） | **合格** |

判定の土台: **6748 件全緑**、カバレッジ Lines 91.53% / Statements 89.25% / Functions 89.56% /
Branches 81.56%（4 指標すべて下限 80% 超）。証跡は `evidence/P06/`。

**それでも「本番で動くことが確かめられた」ではない。** §0 と §7 のとおり、
Workers ランタイム上の再実行と Google での実ログインはしていない。

## 4. 戻し方（ロールバック）

実デプロイしていないので「本番を戻す」手順は無い。作業ツリーを戻す手順だけを書く。

```
# ① コードを戻す（この feature の変更だけ）
git checkout -- src/presentation/composition.ts \
                src/application/usecases/generation/draft-content-variant.ts \
                src/domain/compliance/audit-log.ts \
                src/db/schema.ts

# ② 移行を戻す
#    0023 は列の追加なので、当てた D1 からは ALTER TABLE ... DROP COLUMN で外せる。
#    ただし SQLite の DROP COLUMN は索引を先に消す必要がある。
#    DROP INDEX audit_logs_workspace_request_idx;
#    ALTER TABLE audit_logs DROP COLUMN request_id;
```

**当てた移行をファイルの削除だけで無かったことにしない。** `_journal.json` から行を消しても、
既に当たった D1 の列は残る。次に `drizzle-kit generate` を打つと差分が食い違う。

## 5. 積み残し（この版に入っていないもの）

`handover.md` §「直っていない」と重複するものは、そちらを正とする。ここには P13 で新たに分かった分を書く。

| 何 | なぜ残っているか |
|---|---|
| `system-spec/spec-state.json` top-level `implementation_snapshot` | 現行 writer に更新 action が無い。直接編集せず Beads `ah-u5l` で追跡 |
| 複数ブランドの作業場所で既定値が届かない | 画面にブランド選択欄が無い。塞ぐには画面側の変更が要る（この feature の write scope 外） |

## 6. 仕様書への正規書き戻し

最終レビューで、repo-local system-spec harness の R4 writer を使い、`auth.web` を
`reopen` → 実装状態の本文反映 → 同じ `qa-auth-web` / `G1` / `auth-model` で再確定した。
要求判断は変更していない。`reopen_log` と `docs/spec-writeback-receipt.md` が受領証跡である。

残る不一致は `system-spec/spec-state.json` top-level `implementation_snapshot` だけである。
現行 `apply-spec-transition.py` にこの欄の更新 action が無いため、正本を直接編集していない。
writer 拡張は Beads `ah-u5l` で追跡する。

## 7. 最終 preview smoke と未検証範囲

| 何 | なぜ |
|---|---|
| `GET /admin` | **確認済み**。未ログインでは `/signin` へ 307 |
| `GET /admin/settings/compliance` | **確認済み**。未ログインでは `/signin` へ 307 |
| `GET /signin` | **確認済み**。200 |
| `GET /api/tools`（`MCP_TOKEN` 未設定） | **確認済み**。秘密値を表示せず `wrangler secret put MCP_TOKEN` の案内を返して 503（fail-closed） |
| `pnpm run preview`（:8787）上での全件再実行 | 実行していない。「たぶん通る」とは書かない |
| Google での実ログイン | 未実施（`handover.md` §3 と同じ） |
| dev / 本番 D1 への 0022 / 0023 適用 | §0 のとおり実デプロイしていない。0022 は旧 disclosures が 0 行か先に確認する |
