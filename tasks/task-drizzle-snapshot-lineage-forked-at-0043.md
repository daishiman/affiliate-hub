---
graph_node_id: "task-drizzle-snapshot-lineage-forked-at-0043"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "database"
tags: ["database","migration"]
priority: "high"
start_date: "2026-09-08"
target_date: null
iteration: null
title: "drizzle の snapshot 系譜が 0043 で分岐していて、次の generate が 0044-0050 を見落とす"
owners: ["daishiman"]
created_at: "2026-09-08T00:00:00Z"
updated_at: "2026-09-08T12:52:05Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"drizzle/meta/ の snapshot が 0035,0036,0051-0056 の 8 件欠けている。残った 0057_snapshot.json の prevId が 0043_snapshot を指しており、0044_snapshot と同じ親を持つ fork になっている。drizzle-kit check は「[0044_snapshot.json, 0057_snapshot.json] are pointing to a parent snapshot: 0043 which is a collision」を報告する (exit は 0 だが警告として出る)","mvp_fit":"enabling","purpose":"次に drizzle-kit generate したとき、既に在るテーブルを作り直す/落とす SQL が出るのを防ぐ","rationale":"journal は 62 エントリ・sql も 0000-0061 が全て在るので、既に適用済みの環境は壊れていない。壊れるのは次に generate したときで、0061_snapshot を親にした差分は 0044-0050 で入れた ai_search_audit_history / blog_operations_console / article_image 系を「無い」ものとして扱う"}
scope_in: []
scope_out: []
acceptance: ["drizzle-kit check が collision を報告しない (Everything's fine)","drizzle-kit generate が空の差分を返す (No schema changes)","適用済みの *.sql を 1 本も書き換えず、_journal.json は末尾追記のみである","tests/architecture/ と tests/integration/ が全緑である"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-drizzle-snapshot-lineage-forked-at-0043.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"c174b75ed0b6296d171b3796d80d4cda2edf506ed4b59fb5ac6db0902fdf898a","evaluator":"final-review","evidence_ref":"docs/spec/feat-blog-top-page-composition/final-review.md"}
source_lineage: {"imported_at":"2026-09-08T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"drizzle/meta/_journal.json","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "dev 合流でリネームされた snapshot の親ポインタが繋ぎ変わらず、drizzle-kit check が collision を報告している"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-drizzle-snapshot-lineage-forked-at-0043.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-9tx5","github_mirror":null,"linked_at":"2026-09-08T12:12:42Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-08T12:52:05Z","evidence_refs":["drizzle/meta/0062_snapshot.json","drizzle/0062_realign_snapshot_lineage.sql","tests/architecture/ci-config.test.ts","docs/spec/feat-blog-top-page-composition/final-review.md"],"policy":"manual","reconciled_at":"2026-09-08T12:52:05Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-08T09:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

`drizzle-kit generate` が collision で止まる状態を解き、**次に誰かが
マイグレーションを作れる**ようにする。

## 背景

`drizzle/meta/` の snapshot が 8 件欠けている: `0035`, `0036`, `0051`〜`0056`。
`_journal.json` は 62 エントリ、`drizzle/*.sql` も `0000`〜`0061` が全て在るので、
**欠けているのは snapshot だけ**である。

問題は欠落そのものではなく、残った鎖が**分岐している**ことだった。
`0057_snapshot.json` の `prevId` も `0044_snapshot.json` の `prevId` も
`0043_snapshot` を指していた。つまり `0043` を親とする 2 本の枝があった:

```
0043 ─┬─ 0044 → 0045 → … → 0050              (12 表を足す枝)
      └─ 0057 → 0058 → 0059 → 0060 → 0061    ( 9 表を足す枝)
```

**なぜこうなったかは `tests/architecture/ci-config.test.ts` に書かれていた。**
2026-09-08 に、この枝と dev が同じ `0044`〜`0050` の番号を別々の中身で使って
いたのを解くため、こちら側を `0051`〜`0061` へ振り直している。動いたのは
`*.sql` だけで、`meta/*_snapshot.json` の `prevId` は元のままだった。
`0051`〜`0056` の snapshot が git 履歴に一度も存在しないのはそのためである
(`git log --all -- drizzle/meta/0051_snapshot.json` が 0 コミット)。

## 実害の形 (当初の記述を訂正)

起票時は「壊れた SQL が出る」と書いたが、**実測は違った**。

```
$ npx drizzle-kit generate
Error: [drizzle/meta/0044_snapshot.json, drizzle/meta/0057_snapshot.json] are
pointing to a parent snapshot: drizzle/meta/0044_snapshot.json/snapshot.json
which is a collision.
```

`generate` は **Error で停止する** (`check` は同じことを警告として出し exit 0)。
壊れた SQL は出ない。止まってくれていたおかげで、誰も破壊的な移行を作れずに
済んでいた。実害は「新しいマイグレーションを誰も作れない」ことである。

## なぜ実 DB は無事なのか

実 DB への適用は `_journal.json` の順に `*.sql` を流すだけで、snapshot を見ない。
62 本を空の SQLite へ順に流すと**全部きれいに通り、113 表になる**。

一方 `0061_snapshot.json` が知っているのは 95 表で、**18 表を見落としている**。
逆向きの差 (snapshot にあって実体に無い) は 0 件で、snapshot は実体の真部分集合
だった。

## 直し方 (実施済み)

`prevId` を繋ぎ直すだけでは足りない。`0057` の中身は 0043 時点の姿で、
`0044`〜`0050` が足した 12 表を知らないままだからで、次の `generate` が
その 12 表を「まだ無い」と読んで作り直そうとする。**末尾に「いまの
`schema.ts` そのまま」の snapshot を 1 枚積む**のが本体の修復で、
`prevId` の付け替えは「積むために鎖を一本にする」前処理でしかない。

1. `0057_snapshot.json` の `prevId` を `0043` の id から `0050` の id へ付け替えた。
   変わったキーは `prevId` ただ 1 つで、`tables` は 88 のまま動いていない。
2. `drizzle-kit generate` に `schema.ts` から snapshot を作らせ、`prevId` を
   `0061` の id にして `0062_snapshot.json` として据えた。**手書きしていない。**
3. `0062_realign_snapshot_lineage.sql` は**中身がコメント 1 行だけ**。実体には
   もう全部あるので流すものが無い。進めるのは snapshot の側だけである。
4. `_journal.json` へ `idx: 62` を 1 件追記した。**先頭 62 件は完全に一致**する
   (機械比較で確認済み)。適用済みの時刻も名前も変えていない。

### 生成された snapshot が実体と合っていることの確認

`schema.ts` 由来の新 snapshot は 107 表。62 本を流した実体は 113 表。差の 6 件は

```
published_article_search / _config / _content / _data / _docsize / _idx
```

で、FTS5 の仮想表とその shadow 表である。drizzle schema では表現できず生 SQL
(`0051`) が作っているので、**drizzle が知らないことが仕様どおり**である。
ここを「欠落」と読んで schema へ足すと逆に壊れる。逆向きの差は 0 件だった。

## 巻き添えで見つかった写し

`0062` の SQL が「コメントだけ」であるため、D1 が
`SQL code did not contain a statement.` で拒み、integration test 39 ファイルが
落ちた。`tests/support/migrations.ts` の `splitStatements` が空文しか捨てて
いなかったためで、**「D1 が 1 度に受け取れる単位」と名乗る関数が、D1 が
受け取れない断片を返していた**。実行される字が 1 つも無い断片を落とすよう直した。

正本を直しても 2 ファイルが落ち続けた。`d1-public-article-backfill.test.ts` と
`local-seed-idempotency.test.ts` が同じ分割を**自前で写していた**ためである。
`migrations.ts` の頭書きが「17 ファイルに写されていた」と言っていた問題の残りで、
両方とも正本の import へ寄せた。

## 入力と前提条件

- `drizzle/meta/_journal.json` (62 エントリ・全て在る)
- `drizzle/*.sql` (0000〜0061・全て在る)
- `drizzle/meta/*_snapshot.json` (0035, 0036, 0051〜0056 が欠落)
- `src/db/schema.ts` (`drizzle.config.ts` が指すスキーマ定義の正本)

## 出力と成果物

- `drizzle/meta/0057_snapshot.json` (`prevId` 1 行のみ変更)
- `drizzle/meta/0062_snapshot.json` (新規・drizzle-kit 生成)
- `drizzle/0062_realign_snapshot_lineage.sql` (新規・コメントのみ)
- `drizzle/meta/_journal.json` (末尾へ 1 件追記)
- `tests/support/migrations.ts` (コメントのみの断片を落とす)
- `tests/integration/d1-public-article-backfill.test.ts` / `local-seed-idempotency.test.ts` (写しを正本へ)
- `tests/architecture/ci-config.test.ts` (適用済み履歴の床へ `0062` を追記)

## 依存関係

なし。ただし**新しいマイグレーションを作る前に**片付ける必要があった。

## 実装対象

`drizzle/` と、移行 SQL の読み方を持つテスト側のヘルパー。

## Write scope と競合制約

`drizzle/meta/`、`drizzle/0062_*.sql`、`tests/support/migrations.ts`、
`tests/integration/` の 2 ファイル、`tests/architecture/ci-config.test.ts`。

**適用済みの `*.sql` は 1 本も触っていない。** `_journal.json` も末尾追記のみで、
既存 62 件は変えていない。

## 実行手順

すべて隔離コピー (`scratchpad`) で先に検証してから本体へ適用した。

1. 62 本を in-memory SQLite へ流し、実体スキーマ (113 表) を得る。
2. 衝突枝を退避した隔離環境で `generate` させ、`schema.ts` 由来の snapshot を得る。
3. その snapshot のテーブル集合を実体と突き合わせ、差が FTS5 の 6 件だけである
   ことを確かめる。
4. `prevId` の付け替えと `0062` の追加を隔離環境で組み、`check` と `generate` の
   両方が緑になることを確かめる。
5. 本体へ適用し、同じ 2 つを本体で確かめる。

## 受入条件

- [x] `drizzle-kit check` が collision を報告しない → `Everything's fine 🐶🔥`
- [x] snapshot の `prevId` 鎖が一本に繋がっている → `check` が通ることで担保
- [x] `drizzle-kit generate` が空の差分を返す → `No schema changes, nothing to migrate 😴`
- [x] 既に適用済みの D1 に対して破壊的な SQL を出さない → 追加した SQL はコメント 1 行のみ
- [x] `tests/architecture/` 全緑 → 77 files / 1007 tests
- [x] `tests/integration/` 全緑 → 46 files / 685 tests
- [x] `tsc --noEmit` と `biome check` が無出力

## 検証方法

`check` が collision の語を出さないこと、`generate` が新しい `*.sql` を作らない
ことの 2 つが直接の判定になる。`generate` は副作用のあるコマンドなので、緑を
確かめる目的で走らせてよいのは「差分が無い」ことが期待される状態のときだけである。
テストは移行を実際に流す `integration` を必ず含める —— `architecture` は
ファイル名の並びしか見ておらず、SQL が D1 に受け取られるかを測っていない。

```
npx drizzle-kit check      # collision の語が出ないこと
npx drizzle-kit generate   # 新しい *.sql を作らないこと
npx vitest run tests/architecture/ tests/integration/
```

## リスクとロールバック

変更したファイルは全て git 追跡下にあるので `git checkout` で戻せる。実 DB は
触っていない。`0062` の SQL は空なので、本番へ流しても記録が 1 行増えるだけで
スキーマは動かない。

## GitHub publication

`local_only`。

## Handoff

判断の記録: **git 履歴からの復元は取れなかった。** `0051`〜`0056` の snapshot は
`origin/dev` にも `origin/main` にも、どのコミットにも存在しない (実測)。
振り直しのときに作られなかったからである。よって「末尾に正しい snapshot を
1 枚積む」経路を選んだ。既存の履歴を 1 件も書き換えずに済み、実 DB の適用記録と
も衝突しないためである。

## 規範

- snapshot を手書きしない。中身は drizzle-kit に作らせる。
- 適用済みの `*.sql` を書き換えない。`_journal.json` は末尾追記だけにする。
- 実 DB のスキーマを推測で語らない。62 本を流して確かめてから書く。

## やらないこと

- 実 DB への直接の DDL 適用
- `_journal.json` の既存エントリの削除や番号の振り直し
- 欠落している `0035` / `0036` / `0051`〜`0056` の snapshot を後から捏造すること
  (中身が分からない以上、書けば嘘になる。鎖は `0062` で繋がっているので要らない)
