# 公開報告（feat-blog-ops-crud / P13）

更新日: 2026-08-27
execution status: **in_progress**
release: **未実施（PR は出ている / 配信はしていない）**

## いまどこまで進んだか

| P13 の受入条件 | 結果 | 確かめ方 |
|---|---|---|
| `pnpm run build` | **exit 0** | 2026-08-27 実行。差分なし |
| `pnpm run build:worker`（OpenNext 変換） | **exit 0** | `.open-next/worker.js` 生成（41M） |
| `pnpm run preview`（workerd 起動） | **起動・応答あり** | 下表 |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ops-crud` | **exit 0** | `violations: []` |
| `dev` への PR | **#33 OPEN / MERGEABLE / CI 緑** | base=`dev`, head=`daishiman/ブラグ作成のCRUD`。`gh pr view 33` で引ける |
| `pnpm run deploy:dev`（開発環境への配信） | **未実施** | 下記「残っていること」 |
| system-spec への書き戻し | **未実施** | 配信の結果を書くので、配信の後 |

### workerd 上での応答

`opennextjs-cloudflare preview` を起動し、`env.DB`（D1）と `env.BUCKET`（R2）が
local mode で解決された状態で確認した。

| 経路 | 応答 | 読み方 |
|---|---|---|
| `/` | 200 | |
| `/signin` | 200 | |
| `/admin` | **307** | 未ログインなので入口へ戻される。**ここが 200 なら異常**（Workers 上で認証の関所が効いていない） |

`next build` が通っても workerd で落ちることはある。Node 前提の API が混ざると
変換は成功して実行時に落ちるためで、受入条件が build と preview の 2 段に
分かれているのはそのためである。今回は両方通っている。

## 残っていること（この回では実施しない）

1. **PR #33 を `dev` へマージする** — 外向きの操作なので本人の判断で行う
2. **`pnpm run deploy:dev`** — Cloudflare Workers / D1 / R2 への実際の反映。
   取り消しの効かない外部への変更なので、明示の指示なしには実行しない
3. **system-spec への書き戻し** — 2 の結果を記録するものなので、2 の後

`dev` との差は 5 コミット（先頭 `f3a79b8`）。

## 配信した後に確かめること

**デプロイが「通った」ことと、出したものが「出ている」ことは別である。**
この feature で入れた点検画面がそこを見る。

1. `/admin/blog/delivery` を開く
2. 「点検する」を押す
3. 9 種の配信部品が `ok` になるか、`missing` が出るかを見る

**`unchecked`（まだ点検していません）を「問題なし」と読まないこと。**
押していないだけである。

## 枝の宛先

この repository では PR の既定の宛先は `dev` で、`main` へ直接出すと
`branch-flow.yml` が落とす（`AGENTS.md`）。PR #33 の base は `dev` である。

## 品質ゲートの結果

[`final-review.md`](./final-review.md) の判定は readiness = complete / promotion 可。

| ゲート | 結果 |
|---|---|
| `pnpm verify` 全 14 門 | 通過（2026-08-27） |
| 回帰 8280 件 / 334 ファイル | 0 失敗 |
| 型検査 / 静的解析 | 0 件 / 0 件 |
| E2E 364 件 | 0 失敗 |
| a11y（主要 6 画面） | 重大 0 件 |
| 転用禁止（構造） | 疑い 0 件 |
| 依存の脆弱性（high 以上） | 0 件 |

閾値・層別下限・`KNOWN_STALE_MAX` はいずれも変更していない。

## 過去の停止記録（2026-08-26 / 監査用）

> 当時は commit / push / PR 作成が禁止されており、判定は **blocked（未実施）** だった。
> その後 PR #33 が作成され CI が緑になったため、上の表が現行の判定である。
> この段は経緯の記録として残す。当時の「前提」判定を完了証明に使わない。
