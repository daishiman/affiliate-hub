# feat-auth-workspace テスト設計

- graph_node_id: `SYS-AUTH-WORKSPACE-P04`
- 上流: [requirements-baseline.md](./requirements-baseline.md) の受け入れ条件表（AWS-ACC-01〜04）
- 位置づけ: **派生文書（非規範）**

## この文書が答えるもの

「4 つの受け入れ条件を、**どのテストが**、**どの壊れ方に対して**守るのか」だけ。

## 先に書く: 何を足さなかったか

調べた結果、4 条件のうち 3 つは**既にテストが存在した**。

| 条件 | 既存のテスト | 見ている内容 |
|---|---|---|
| AWS-ACC-01 | `tests/infrastructure/entry-gate.test.ts`（13 件） | 守る道／守らない道、通行証の有無、保存先が落ちた場合、役を見ないこと |
| AWS-ACC-02 | `tests/property/tenancy.property.test.ts`、`tests/architecture/tenant-scoped-ports.test.ts` | 他所のものが `TENANT_MISMATCH` になること、口が workspace を要求すること |
| AWS-ACC-04 | `tests/domain/permissions.test.ts` | 役と権限の対応表 |

**同じことを受け入れテストで書き直さなかった。** 書き直せばテスト件数は増えるが、
検出できる壊れ方は 1 つも増えない。増えるのは、実装を変えたときに直す場所だけである。

代わりに足したのは 2 つ。

## 足したもの ①: 許可側を同時に見る

`tests/acceptance/feat-auth-workspace/access-boundary.test.ts`

要求ベースラインの「検証不能な形にしないための制約」を、テストの形で効かせる。

**拒否だけを並べたテストは、全部を拒否する壊れ方に対して緑になる。**
入口を丸ごと閉じても、`can()` を常に `false` にしても、
「断られること」を確かめているテストは全部通る。
だから同じ `describe` の中に、必ず通る側を置く。

| テスト | 断る側 | 同時に見る通す側 |
|---|---|---|
| AWS-ACC-01 | 通行証が無ければ戻す | 有効な通行証なら通す |
| AWS-ACC-02 | 他所のものは `TENANT_MISMATCH` | 自分のものは取れる |
| AWS-ACC-04 | Analyst は `content.publish` を断られる | 同じ Analyst が `analytics.read` は通る |

## 足したもの ②: 本文まで見る（実際に穴が空いていた）

同ファイル「他所の ID と、そもそも無い ID が、応答も本文も区別できない」。

既存の `tests/presentation/error-format.test.ts` は
`ERROR_STATUS.TENANT_MISMATCH === ERROR_STATUS.NOT_FOUND` までしか見ていなかった。
**番号だけ揃えても存在は漏れる。** 実測した応答:

| | 他所の Workspace の ID | 存在しない ID |
|---|---|---|
| status | 404 | 404 |
| code | `TENANT_MISMATCH` | `NOT_FOUND` |
| message | `記事 が見つかりません。` | `記事 が見つかりません (id: obj-9999)。` |
| suggestedAction | `ワークスペースを切り替えているか確認してください。` | `一覧から選び直すか、IDを確認してください。` |

3 項目すべてが違う。ID を 1 つずつ試して本文の違いを見るだけで、
他所の Workspace に何があるかが列挙できる状態だった。

これは確定済み auth 章 AUTH-ACC-002（「未存在 ID と同一の 404 応答・本文で」）に反する。
P05 で `maskExistence()` を入れて塞いだ。

## 足したもの ③: AWS-ACC-03（唯一の実装欠落）

`tests/acceptance/feat-auth-workspace/brand-defaults.test.ts`

ブランドにも生成入力にも CTA と免責の欄は前からあったが、**間を通す道が無かった**。
生成側は見本データの固定文言（`generation-sample-input.ts`）を使っていた。

だから「既定値が入る」だけを確かめても足りない。固定文言がたまたま一致していても緑になる。
**ブランドを切り替えたら値も変わること**を同じテストで見る。

| 見る形 | 理由 |
|---|---|
| 標準 CTA がそのまま呼びかけ文になる | 道が通っていること |
| ブランドを切り替えると値も切り替わる | 固定文言でないこと |
| 免責が未設定なら埋めない | 埋めると「書いていないのに広告表記が付いた記事」が公開まで通る |
| 明示した値が勝つ | 記事ごとに変えたい場面を潰さないこと |
| ブランドが無いときは何も足さない | 設定していないのに動く状態を作らないこと |

## 置き場所の逸脱

タスク仕様書は `src/lib/**` と `*.spec.ts` を指定しているが、いずれも採らなかった。

| 仕様書の指定 | 実際 | 理由（実測） |
|---|---|---|
| `src/lib/**` | `tests/acceptance/feat-auth-workspace/` | `src/` は `quality-gates.config.mjs` の `LAYER_COVERAGE` にある 5 層ちょうどで構成されている。`src/lib/` を作ると床のない層が増え、`tests/architecture/quality-gates.test.ts` が落ちる |
| `src/lib/brand/` | `src/domain/identity/brand.ts` | ブランドは身元の文脈の持ち物。既に `Brand` 型がここにある |
| `*.spec.ts` | `*.test.ts` | `scripts/traceability.mjs` は `.test.ts` / `.test.tsx` しか集めない。`.spec.ts` で書くと `@req` の追跡から外れ、**由来不明のテストになる** |

## 保守性の制約

pixel 位置依存・DOM 構造依存のテストは 1 つも書いていない。
上表の「見る形」がすべて**応答とデータの形**だけで書かれているのは、この制約を効かせるため。
