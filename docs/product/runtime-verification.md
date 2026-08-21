# 本物のランタイムで動かしたかの台帳

最終更新: 2026-08-18

## 0. この台帳が答えること

検査（`pnpm run verify`）が全部緑でも、**そのコードが本物のランタイムで一度でも動いたか**は
別の話である。検査は Node の上で動く。本番は Cloudflare Workers の上で動く。
D1 も R2 も、検査の中では偽物に差し替わっている。

この台帳は「動かしていないもの」を名指しで並べる。

**「未確認」を、済みと同じ重さで書く。**
空欄にすると「書き忘れ」と「確かめていない」が区別できなくなる。
分からないときは空欄ではなく「未確認」と書く。

**この台帳の値打ちは、埋まった行ではなく、埋めている途中で落ちる行にある。**
実際、この台帳を最初に埋めたとき（2026-08-18）に次が分かった。

- 保存先は 17 表あるが、**行が入ったことがあるのは 3 表だけ**（§3）
- `/api/telemetry` は**同意の cookie が無いと、204 を返したうえで黙って捨てる**（§2）。
  HTTP の番号だけを見ていると「動いた」と誤って記録する
- `sessions` 表は 0 行。ログインの仕組みが無いという `ah-5lo` の話と一致する（§3）

---

## 1. 確かめる場所は 3 段ある。混ぜない

| 段 | 呼び方 | 何が本物になるか | 何がまだ本物でないか |
|---|---|---|---|
| **L** | 手元の preview（`pnpm run preview`） | Workers ランタイム、D1 / R2 の呼び出し口、ルーティング、ビルド後のコード | 中の**データ**（`.wrangler/state` の写し）、secret、外部への通信 |
| **D** | dev 環境（`affiliate-hub-dev`） | Cloudflare 上の D1 / R2、secret、マイグレーションの適用結果 | 本番のデータ量と本番の秘密 |
| **P** | 本番（`affiliate-hub`） | 全部 | — |

**L が緑でも D が緑とは限らない。** L のデータベースは手元の SQLite であり、
マイグレーションの適用漏れも、行数の桁も、本物とは違う。
実際 L の SQLite には `SELECT` を `UNION ALL` で 7 個以上つなぐと
`too many terms in compound SELECT` で落ちる制限があった（2026-08-18 実測）。
段が違えば落ち方も違う。

### preview の入口は `localhost:8788`

`pnpm run preview` は `opennextjs-cloudflare preview` を呼び、8788 で待つ（2026-08-18 実測）。
**8787 ではない。** 8787 を叩いて「つながらない＝壊れている」と読み違えないこと。

手元の D1 / R2 の中身は、preview を止めた状態でこう読む。

```
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite "SELECT count(*) FROM telemetry_events"
sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite  "SELECT key, size FROM _mf_objects"
```

`wrangler d1 execute DB --local --command "…"` でも読めるが、起動が遅い。

---

## 2. HTTP の入口（7 経路 10 メソッド）

`L` 列は手元の preview で実際に叩いた結果。`D` `P` は dev / 本番。

| 経路 | L | D | P | 見た数字と、次に見るべき数字 |
|---|---|---|---|---|
| `GET /go/{code}`（生きたコード） | 済 2026-08-18 | 未確認 | 未確認 | `302` と転送先。`/go/demo01` → `https://example.com/click?...`。**同時に `telemetry_events` の `affiliate_click` が 1 増える**ことまで見た |
| `GET /go/{code}`（停止中） | 済 2026-08-18 | 未確認 | 未確認 | `410`。`/go/stop01` |
| `GET /go/{code}`（無いコード） | 済 2026-08-18 | 未確認 | 未確認 | `404` と「このリンクは見つかりませんでした。」 |
| `POST /api/telemetry`（同意あり） | 済 2026-08-18 | 未確認 | 未確認 | `204`。**番号ではなく `telemetry_events` の行数を見る**（下の注意） |
| `POST /api/telemetry`（同意なし） | 済 2026-08-18 | 未確認 | 未確認 | `204` で、しかし**行は増えない**。仕様どおり |
| `GET /api/tools` | 済 2026-08-18 | 未確認 | 未確認 | `503` と「接続用のトークンが未登録です…」。**トークン登録後に `200` と道具一覧が出ることは未確認** |
| `POST /api/tools/{tool}` | 未確認 | 未確認 | 未確認 | `MCP_TOKEN` を付けて叩き、道具が実際に動いて結果が返るまで見る |
| `POST /api/mcp` | 済 2026-08-18 | 未確認 | 未確認 | `503`（トークン未登録）。**トークンありで JSON-RPC が通ることは未確認** |
| `GET /api/mcp` | 済 2026-08-18 | 未確認 | 未確認 | `503`（同上） |
| `GET /api/feedback/pending` | 済 2026-08-18 | 未確認 | 未確認 | `401` と「鍵がありません。Authorization ヘッダーに Bearer で付けてください。」。**鍵ありで `200` が返ることは未確認** |
| `GET /api/feedback-captures/{capture}` | 未確認 | 未確認 | 未確認 | `401` までは見た。**R2 から画像が実際に返ることは未確認**（§4） |

### `POST /api/telemetry` の落とし穴（実測）

`/api/telemetry` は **どんな本文でも必ず `204` を返す**。読者の画面に記録の成否を伝えない設計で、
これは正しい。ただし**確認する側がここで騙される**。

2026-08-18 に実測した順序は次のとおり。

1. `{"jsonrpc":"2.0",...}`（`events` が無い本文）を送る → `204`。行は増えない
2. 正しい形の `events` を送る → `204`。**それでも行は増えない**
3. `Cookie: ah_consent=granted` を足して送る → `204`。**ここで初めて 1 行増えた**

2 で止めていたら「動いた」と書いていた。**`204` は何も保証しない。行数を数える。**

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/api/telemetry \
  -H "Content-Type: application/json" -H "Cookie: ah_consent=granted" \
  --data-binary '{"readerKey":"rk_check","events":[{"key":"scroll_depth","payload":{"path":"/s/x","siteSlug":"x","percent":50}}]}'
```

---

## 3. 保存先（D1・17 表）

「行あり」= 手元の preview で実際に書かれた行が残っている。
「0 行」= **本物のランタイムでは一度も書かれていない**。検査の中では書けていても、ここでは書けていない。

| 表 | 書く場所 | L | D | P | 埋めるには |
|---|---|---|---|---|---|
| `telemetry_events` | `telemetry-repository.ts` | 済 8 行 2026-08-18 | 未確認 | 未確認 | §2 の curl |
| `redirect_resolutions` | `redirect-repository.ts` | 済 2 行 | 未確認 | 未確認 | 読み出しは `/go/demo01` で確認済。**書き込み（リンクの発行）は未確認** |
| `feedback_reports` | `feedback-repository.ts` | 済 1 行 | 未確認 | 未確認 | `/admin/feedback` から 1 件送って行が増えることを見る |
| `audit_logs` | `audit-log-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 監査対象の操作を 1 つ実行し、行が増えることを見る。いま監査記録を残す経路自体が 20 ほど未接続（残課題） |
| `content_variants` | `content-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/generation` で下書きを 1 本作る。**生成 AI の鍵が要る**（`credential-registration.md`） |
| `llm_usages` | `llm-usage-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 同上。1 回の生成で入力/出力トークンが記録されることを見る |
| `llm_credentials` | `llm-credential-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/settings/llm` で鍵を 1 件登録。**`ah-5lo` が閉じるまで本番では試さない** |
| `affiliate_conversions` | `conversion-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/affiliate` から成果を 1 件取り込む |
| `publications` | `distribution-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/distribution` で配信を 1 件予約する |
| `channel_connections` | `distribution-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 配信先を 1 つつなぐ |
| `integration_keys` | `feedback-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/settings/integration-access` で鍵を 1 本発行する |
| `integration_key_usages` | `feedback-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 発行した鍵で `/api/feedback/pending` を叩き、使用が記録されることを見る |
| `link_ingestions` | `link-inbox-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/inbox` にリンクを 1 本投げ込む |
| `published_articles` | `published-article-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 記事を 1 本公開する |
| `site_drafts` | `site-draft-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | `/admin/sites/new` でブログを 1 本作る |
| `site_blueprints` | `site-draft-repository.ts` | **0 行・未確認** | 未確認 | 未確認 | 同上（下書きを公開した時点で入る） |
| `sessions` | 書く実装が無い | **0 行** | — | — | **これは埋まらない。** セッションを作る実装がリポジトリに無い（`ah-5lo` / `ah-361`）。ログインを入れるまで 0 のまま |

読むだけの場所（`site-repository.ts` / `connection.ts` / `storage-failure.ts`）は表を持たないのでこの一覧に無い。

### 17 のうち 3 という数字の意味

**保存先の 8 割は、本番と同じランタイムで一度も書かれていない。**
「検査は通っている」は「書ける」を意味しない。列名の食い違い、NOT NULL の抜け、
日時の型、どれも検査の中の偽物では出ない種類の壊れ方をする。

---

## 4. 置き場（R2）

| 物 | L | D | P | 埋めるには |
|---|---|---|---|---|
| 書き込み（`feedback-capture-r2.ts`） | 済 2026-08-17 | 未確認 | 未確認 | `feedback-captures/ws_sample/cap_preview_check.png`（70 バイト）が残っている |
| 読み出し（`GET /api/feedback-captures/{id}`） | **未確認** | 未確認 | 未確認 | 鍵を付けて叩き、`200` と画像が返ることを見る。いまは鍵なしで `401` までしか確認していない |

置いた物の一覧は `sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite "SELECT key,size FROM _mf_objects"`。

---

## 5. 画面

54 枚ある。**1 枚ずつは並べない**（並べても誰も維持しない）。開いた実績のあるものだけ書く。

| 画面 | L | D | P |
|---|---|---|---|
| `/`（入口） | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/admin`（管理の入口） | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/admin/settings/llm`（鍵の登録） | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/admin/ai-usage` | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/admin/analytics` | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/signin` | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/s/video-editing-gear`（読者向け） | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/s/video-editing-gear/best/laptops` | 済 2026-08-18 `200` | 未確認 | 未確認 |
| `/s/video-editing-gear/methodology` | 済 2026-08-18 `200` | 未確認 | 未確認 |
| 上記以外の 45 枚 | **未確認** | 未確認 | 未確認 |

**見本ブログの URL 名は `video-editing-gear`。** `/s/sample` は `404` になる（2026-08-18 実測）。
保存先の中では `workspace_id` が `ws_sample` なので、これを URL 名だと思って叩くと空振りする。

---

## 6. 見張りが空振りしていた例（検査があること ≠ 効いていること）

この台帳は「検査が緑でも動いたとは限らない」を扱う。**その一段手前に、
「検査が緑なのは、その検査が何も見ていなかったから」という形がある。**
実際に 2 件出た。どちらも別の作業のついでに偶然見つかっている。

| いつ | 何が空振りしていたか | なぜ気づけなかったか |
|---|---|---|
| 2026-08-18（項目 55） | 総ざらいの門が、差分を取る処理を書き出しの**後ろ**に置いていた。**いま自分が書いた一覧を「前回」として読んでいた** | 差は常に 0 になる。落ちること自体は上限で分かるので、**案内の側だけが黙って効かなくなっていた** |
| 2026-08-18（②の作業中） | 実行環境（`env`）の受け渡しを見る検査が、**新しく足した接続を対象に入れていなかった** | 対象の一覧に名前を足すのは足した側の仕事で、足さなくても検査は緑のまま通る |

**共通しているのは、どちらも「落ちない」ことである。** 検査が落ちれば直す。
空振りは落ちないので、直す機会が来ない。

対処は 1 つしかない。**検査を足したら、その検査が落ちるところを実際に見る**（赤の実測）。
落ちない検査は、書いた本人にも空振りと見分けが付かない。

### 赤の実測を始める前の条件

**未コミットの変更がある状態で赤の実測を始めない。**
2026-08-18 に、赤を見るため `git checkout` で実装を戻したところ、
**未コミットの実装を消した**。戻し方を工夫するより、戻す対象を絞るほうが確実である。
（いまはパッチを当てて戻す形にしている。それでも前提は変わらない）

### 日付をまたいだだけで落ちる形（探索の結果）

2026-08-18、`tests/integration/r2-feedback-capture.test.ts` が
**コードを 1 行も変えずに日付をまたいだだけ**で落ちた（`b3c8679` で修正）。
固定日から期限を数えていて、比べる相手が本物の時計だったためである。

**同じ形が他にないか、一度だけ探した。結果は「無かった」。**

- 実装が実時計を直接読む箇所は 48 件ある（`Date.now()` / `new Date()`）
- 固定日を使うテストは 34 ファイルある
- **その組み合わせで危ないのは「テストが固定日でデータを作り、実装が実時計と比べる」形だけ**
- 期限を扱うテストを 1 つずつ見たところ、いずれも**時計を注入している**
  （`d1-feedback.test.ts` は `now: () => new Date(…)`、`go-route.test.ts` は `expiresAt: null`、
  `full-loop.test.ts` は `nextReviewAt` と `now` の両方が固定）

全部潰す作業はしていない。**探して無かった**、という記録である。

## 7. 埋めるときの決まり

1. **段を書く。** 「動いた」ではなく「L で動いた」と書く。段を書かない行は無効とみなす
2. **日付を書く。** 日付の無い「済」は信じない。コードは変わる
3. **番号ではなく数字を見る。** `200` や `204` は「受け取った」であって「保存した」ではない。
   保存先の行数、R2 の物の一覧、転送先の URL——**変わったものを数える**
4. **落ちたら、その場で残課題へ起票する。** 台帳を緑にするために行を書き換えない。
   埋めている途中で落ちた行がこの台帳の本体である
5. **本番（P）で試せないものがある。** 鍵の登録は `ah-5lo`（未ログインで登録・失効が通る）が
   閉じるまで本番で触らない。生成 AI の呼び出しは実費が出る

---

## 8. 規範

- `tasks/task-real-machine-verification-ledger.md`（この台帳を作った作業・`ah-smh`）
- `docs/product/credential-registration.md`（生成 AI の鍵。§3 の `llm_*` を埋める前提）
- `tasks/task-llm-settings-auth-gate.md`（`ah-5lo`。本番で試せない理由）
