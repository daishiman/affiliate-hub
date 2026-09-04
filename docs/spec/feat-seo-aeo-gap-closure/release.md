# リリース手順・確認項目・切り戻し

- 対象 feature: `feat-seo-aeo-gap-closure`
- 所有 phase: `SYS-SEO-AEO-GAP-CLOSURE-P13`
- 状態: 確定 (P13 成果物)
- 読んだもの: [final-review.md](./final-review.md) / [evidence.md](./evidence.md) / [operations.md](./operations.md) / [migration-compatibility.md](./migration-compatibility.md)
- 作成日: 2026-09-04

## 0. この文書の位置

**手順書であって、実行記録ではない。**

本 phase の時点で commit / push / PR 作成は行っていない（利用者から明示的に保留の指示がある）。
したがって以下は「まだ実行していない手順」である。実行した人が
6 節の記録欄を埋めることで、初めてリリース記録になる。

**出す先は `dev` である。`main` へ直接出さない。**
`main` への PR は比較元が `dev` か `hotfix/*` でないと `branch-flow.yml` が落とす
（[AGENTS.md](../../../AGENTS.md) 「枝の順番」）。

## 1. 出るもの

| 種別 | 中身 |
|---|---|
| スキーマ変更 | `drizzle/0044_ai_search_audit_history.sql`（CREATE TABLE 1 + CREATE INDEX 2） |
| 新しい定期処理 | 既存の毎日 Cron に 5 本目の `ctx.waitUntil` を追加 |
| 公開ページの変更 | JSON-LD に HowTo と Speakable が増える。**見た目は変わらない** |
| 管理画面の変更 | `/admin/content/published` に「AI 検索の点検で落ちている記事」の節が増える |
| 読者への影響 | **無い。**画面に見える変化は 1 つも無い |

**読者に見える変化が無いことが、この feature の危うさでもある。**
壊れていても順調に見えるので、3 節の確認を人がやらない限り誰も気づかない。

## 2. 出す手順

### 2-1. 出す前に手元で通す

```bash
pnpm run typecheck
pnpm vitest run --reporter=dot     # 約 6-7 分
pnpm run lint
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure
```

期待値は [evidence.md](./evidence.md) 2 節。**474 files / 10673 tests / 失敗 0**。

`--reporter=basic` は vitest v4 で削除されている。`dot` を使う。

### 2-2. `dev` へ PR を出す

```bash
git switch -c feat/seo-aeo-gap-closure          # dev から切る
git add -A && git commit                        # 変更内容は 1 節
gh pr create --base dev
```

宛先を省くと既定ブランチ（`dev`）になるが、**明示する。**
省略が効くのは既定が変わっていない間だけで、変わった日に気づけない。

### 2-3. マイグレーションが当たることを確認する

0044 は**表の追加だけ**で既存表を変更しない。
`drizzle/meta/_journal.json` の idx 44 は末尾追加で、既存 entry の `when` / `tag` は不変
（[migration-compatibility.md](./migration-compatibility.md) 2 節）。

したがって**適用順序に依存しない**。既存データの移行も無い。

### 2-4. cron が登録されたことを確認する

`wrangler.jsonc` の `crons` は `["0 17 * * *"]` が
**トップレベル・dev・production の 3 か所**にある（27 / 100 / 136 行）。

デプロイが通っていても Cron Triggers の登録だけ落ちることがある。
Cloudflare のダッシュボード（Workers → Settings → Trigger Events）で実物を見る。

**`0 17 * * *` は UTC 17:00 = 日本時間の翌 02:00 である。**
出した当日の日中には走らない。**最初のログは翌朝まで出ない。**

## 3. 出したあとに確認すること

### 3-1. その日のうちに（人がブラウザで見る）

これが `final-review.md` の **R4**（管理画面の一覧を人が見ていない）を消す作業である。
自動テストは「描いた DOM に文言が現れる」ところまでしか見ていない。
**その文言が運営者にとって行動可能かは、人が読まないと分からない。**

| # | やること | 見るもの |
|---|---|---|
| 1 | `/admin/content/published` を開く | 「AI 検索の点検で落ちている記事」の節が**在る**こと |
| 2 | 記事が 0 件でも節が消えていないこと | 「落ちている記事はありません」が出る |
| 3 | 記事を 1 本公開する | 公開直後に履歴へ 1 行入り、落ちていればその日のうちに一覧へ出る |
| 4 | 「直すところ」の列を読む | **読んだだけで次にやることが分かるか。**分からなければ文言の課題として起票する |

読み方の詳細は [operations.md](./operations.md) 2 節。

### 3-2. 翌朝（cron が 1 回走ったあと）

| # | 見るもの | 期待 |
|---|---|---|
| 1 | Workers → Logs | `[ai-search-reaudit] 記事を再点検しました { scanned, recorded, failed }` が 1 行 |
| 2 | `scanned` と `recorded` | **一致していること。**ずれたら記事ごとの書き込みが個別に失敗している |
| 3 | `failed` | 0 であること |
| 4 | 一覧の「点検日」の列 | 前日から動いていること |

**この 1 行のログを見る作業が、`final-review.md` の R3（実 D1 での所要時間）を初めて測れる機会である。**
リリース前には測れない。ログに出た時刻差を 6 節へ書き残すこと。

### 3-3. 1 週間後

初回投入直後は既存の公開記事がすべて履歴 0 件から始まる。
1 日 50 件ずつ埋まるので、**その間の一覧の 0 件を「全部問題ない」と読むと誤る**
（[operations.md](./operations.md) 3-1、`final-review.md` の R8）。

記事が 50 本以下なら翌日には埋まる。現規模（サイト 2 件・記事数本）は当日で埋まる。

## 4. 切り戻し

**切り戻しの単位を 2 つに分ける。**まとめて戻すと、無関係な部分まで巻き添えになる。

### 4-1. 定期再点検だけを止める（軽い）

`wrangler.jsonc` の `crons` から該当エントリを外して再デプロイする。

- 履歴テーブルは残る。公開時の追記も残る。
- 管理画面の一覧も残る（点検日が古いまま止まる）。
- **データは 1 行も失わない。**

「再点検が重い」「ログが荒れる」だけならこれで足りる。

### 4-2. 丸ごと戻す（重い）

```bash
git revert <merge-commit>   # dev 上で
```

そのうえで D1 の表を落とす:

```sql
DROP TABLE ai_search_audit_history;
```

**表の追加だけなので 0043 時点と同一になる**（[migration-compatibility.md](./migration-compatibility.md) 2 節）。
外部キーを張っていないので、他の表に連鎖しない。

**ただし点検履歴は失われる。**取り下げた記事の理由を辿るために残していたものなので、
戻す前に必要かを確かめること。必要なら `SELECT` して控えを取ってから落とす。

### 4-3. 切り戻さない方がよい場合

**「一覧に落ちている記事が大量に出た」は障害ではない。**
それは仕組みが正しく働いて、これまで見えていなかった欠落が見えた状態である。
上から順に直せばよい（[operations.md](./operations.md) 4 節ケース D）。

ここで切り戻すと、**見えるようになったものを見えなくするだけ**になる。

## 5. `main` へ出すとき

`dev` で 3 節の確認が済んでから、`dev` → `main` の PR を出す。

急ぎの `hotfix/*` を `main` へ直接出した場合は、
マージ後に `git push origin origin/main:dev` で `dev` へ戻すこと。
戻し忘れると `dev` だけが古いまま取り残される（[AGENTS.md](../../../AGENTS.md)）。

## 6. 実行記録（実行した人が埋める）

| 項目 | 値 |
|---|---|
| dev への PR | 未実施 |
| dev へのマージ日時 | 未実施 |
| 0044 適用の確認 | 未実施 |
| cron 登録の確認 | 未実施 |
| 3-1 の手動確認（R4） | 未実施 |
| 3-2 の初回ログ / `scanned` / `recorded` / 所要（R3） | 未測定 |
| main への PR | 未実施 |

**未実施を空欄にしない。**空欄は「やった」と「やっていない」の区別が付かない。

## 7. この文書が扱わないこと

- 日々の運用（[operations.md](./operations.md) が持つ）
- 決定の理由（各仕様書が持つ。[documentation.md](./documentation.md) が索引）
- `system-spec/backend.md` への書き戻し（同じ P13 が持つが、経路は
  `spec-state.json` の R4-reopen → 再確定 → C03 compile であり、本文書の手順ではない）
