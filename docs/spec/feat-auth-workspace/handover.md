# feat-auth-workspace 引き継ぎ

- graph_node_id: `SYS-AUTH-WORKSPACE-P12`
- 最終更新: 2026-08-24
- 位置づけ: **派生文書（非規範）**。規範は確定済み仕様章（auth / security / database）と
  `docs/spec/01-要求仕様書-v1.0.md` §25〜§26 にある。
- 対になる文書: [`runbook.md`](./runbook.md)（運用の手順そのもの）

## この文書が答えること

**「実装に関わっていない人が引き継いだとき、何を知らないと事故るか」**の 1 つだけ。

運用の手順（追従・Google の設定項目・切り分け・分離の確かめ方）は
[`runbook.md`](./runbook.md) が持つ。ここには書かない。
手順と「いま何が欠けているか」を同じ文書に混ぜると、
欠けが埋まったときにどちらを直せばよいか分からなくなる。

**空欄にしない。「確かめていない」と書く。** 空欄にすると、
書き忘れと確かめていないが区別できなくなる。

## 現在値の3軸

| 軸 | 現在値 | 正本/根拠 |
| --- | --- | --- |
| implementation acceptance | **完了**。P10 指摘の配線、拒否監査、tool catalog、登録 tool、diagnostics 保持を含めローカルゲートで再検証 | `final-review-log.md` 追補、`features/feat-auth-workspace.md` |
| release | **一部未確認**。preview smoke は最終レビューで確認するが、Google 実ログインと dev / production migration は未実施 | 本文「確かめていない」と `release-notes.md` |
| tracking | **done**。P01〜P13 と親 `ah-361` は closed | `features/feat-auth-workspace.md` の `completion_evidence` / Beads 正本 |

文書の役割は、規範=`system-spec`、機械の現在値=`features`/tracker、時点判定=P07/P10/P11、
生の実測=`evidence/`、人向け現在投影=本書、と分ける。時点判定や生の実測は
重複に見えても削除・上書きせず、ここから参照する。

---

## 1. まず押さえる 3 つ

1. **入口は 2 段ある。** 名簿（`AUTH_ALLOWED_EMAILS`）と担当者の行（`memberships`）の
   両方に載っていないと入れない。「登録したのに入れない」の大半はこれである。
2. **権限は通行証の中に無い。** `memberships` から都度引く。だから担当を外すと即座に効く。
3. **確かめられないときは通さない。** D1 へ届かないとき、入口は全員を断る。
   これは障害ではなく設計判断（D-02）であり、「障害時に一時的に開ける」運用も作らない。

詳しい地図は [`runbook.md`](./runbook.md) §1 にある。

---

## 2. 直っていない（記録して、塞いでいない）

塞いでいないものを、塞いだかのように書かない。**踏んだことを記録して残す**のが
このリポジトリの作法である。

| 何 | どうなるか | どこに記録があるか |
| --- | --- | --- |
| 「まだログインしていない」と「保存先が落ちていた」が、画面で同じ文になる | D1 障害のとき、利用者はログインし直し続ける。運用側は [`runbook.md`](./runbook.md) §5 で見分ける | 設計 D-02 の「残る穴」。塞ぐには画面の文言を 2 系統に分ける必要があり、この feature の範囲外 |
| `middleware.ts` は Next.js 16 では非推奨の置き場所 | いまはこれが**動く唯一の置き場所**。`proxy.ts` は OpenNext 側が受け取れずビルドが止まる | `src/middleware.ts` 冒頭。移せる合図は「`proxy.ts` でビルドが通ること」 |
| `@better-auth/cli` が本体に追いついていない（2026-08-24 実測: CLI 1.4.21 / 本体 1.7.0） | Better Auth が要る表の形を**手写し**で保っている。CLI を走らせると `account.issuer` が黙って消え、Google ログインが `internal_server_error` になる | [`runbook.md`](./runbook.md) §2、`src/auth.cli.ts` |
| ~~監査の記録に request ID の列が無い~~ **→ 塞いだ（2026-08-24, P13）** | `audit_logs.request_id`（`src/db/schema.ts:926`）と索引 `audit_logs_workspace_request_idx`（同 937）を追加。移行は `drizzle/0024_aromatic_flatman.sql`。値は `src/application/access-denial.ts:125` で、呼び出し側が持っていなければ `req_` + 採番で必ず入る。**本番 D1 へ 0024 を当てるまでは本番では塞がっていない**（dev 側の 0022 と番号が衝突したため 0023 → 0024 へずらした。中身は不変）（`release-notes.md` §0） | [`release-notes.md`](./release-notes.md) ②、[`runbook.md`](./runbook.md) §6 手順 5 |
| `brands` 表が無い | ブランドは見本データ経由で扱われている。`workspace_id` の backfill を含む移行は P08 が持つ | `architecture-design.md`「変更するファイル」 |
| ~~確定済み auth 章の実装状態が `not_started` のまま~~ **→ 書き戻し済み** | R4 `reopen` 後、`partial` とローカル PASS / 本番未検証を分けて反映し、同じ `qa-auth-web` で再確定 | `system-spec/auth.md`、`spec-state.json` の最新 `reopen_log`、`docs/spec-writeback-receipt.md` |

---

## 3. 確かめていない（2026-08-24 時点）

- **Google で実際にログインが通ることを、この作業では確かめていない。**
  打ったのは vitest の 3 ファイル（`tests/infrastructure/better-auth-gate.test.ts` と
  `tests/acceptance/feat-auth-workspace/` の 2 ファイル、計 44 件）だけで、
  すべて緑だった。**これはコードの中の判定が緑という意味しかない。**
  本物のランタイム（Workers / D1）で動いたかどうかは、この結果からは何も言えない。
- **[`runbook.md`](./runbook.md) §3〜§6 に並べた `wrangler` のコマンドを、
  dev や本番に対して実行していない。** 形は既存文書
  （`docs/product/first-owner-row.md` / `docs/product/runtime-verification.md`）で
  使われているものに揃えてあるが、この作業で出力を見たわけではない。
  **初めて打つ人は、結果が想定と違ってもコマンドの側を疑ってよい。**
- **Better Auth 1.7.1 の変更点を読んでいない。** 表の形が変わっているかは未確認。
  入っているのは 1.7.0 で、レジストリの最新は 1.7.1（2026-08-24 実測）。
- `sessions` 表に行が入ったことがあるかは、2026-08-18 時点の実測では **0 行**だった
  （`docs/product/runtime-verification.md`）。それ以降の実測はしていない。
  つまり**この製品で誰かが Google ログインに成功した記録は、まだ 1 件も無い。**
  （手元 D1 には画面確認用の作り物の行が `pnpm run test:e2e:prepare` で入るが、
  これは Better Auth を通っていない。`user` / `account` 表は 0 行のままである。）
- **手元の Workers ランタイムは、起動までは確かめた**（`evidence/P06/test-run-notes.md` ③）。
  `pnpm run build` と `pnpm run build:worker` がいずれも終了コード 0、
  `workerd` が 8787 で LISTEN し、D1 / R2 / ASSETS が local として結び付いている。
  **そこへ HTTP 要求は 1 本も出していない。** 画面が Workers 上で正しく出るかは未確認。

---

## 4. 次に着手すべきもの（この順に）

1. `docs/product/setup-tasks.md` の **S-02 → S-03 → S-03A → S-04**
   （Google の登録 → 値の登録 → 最初の運営者 1 行 → 閉じたことを目で見る）。
   **ここが済むまで、管理画面はアドレスを知っている人なら誰でも開ける。**
   開いている入口の数は `docs/product/open-doors.md` にある。
2. S-04 が通った直後に、[`runbook.md`](./runbook.md) §2 の **T1** を 1 回打ち、
   同 §2 の「追従の記録」の表へ 1 行足す。
3. その時点で初めて、§3 の「確かめていない」のうち上 2 つが埋まる。
   埋まったらこの文書からその行を消す。**消えない行は、消えていない問題である。**

---

## 5. 引き継ぐ相手が別の phase のとき

| 引き継ぐもの | 受け取る phase |
| --- | --- |
| `spec-state.json` top-level `implementation_snapshot` の writer action 追加 | Beads `ah-u5l` |
| リリースと公開の手順 | P13 |
| `brands` 表の追加要否と `workspace_id` の backfill | P08 |
| 「確認できない」の画面文言を 2 系統に分ける | この feature の範囲外（別途起票が要る） |
