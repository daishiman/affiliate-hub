# feat-auth-workspace 移行判断（`workspace_id` とスキーマ整備）

- graph_node_id: `SYS-AUTH-WORKSPACE-P08`
- document_state: `historical_snapshot_with_current_correction`
- snapshot_as_of: `2026-08-24 P08 初回判定時点`
- current_status_ref: [`handover.md`](./handover.md)「現在値の3軸」
- 前提: [`requirements-baseline.md`](./requirements-baseline.md)（AWS-ACC-02）/ [`architecture-design.md`](./architecture-design.md)（D-03, D-04）
- 位置づけ: 派生文書（非規範）。規範は `docs/spec/01-要求仕様書-v1.0.md` §26.4 と確定済み仕様章（auth / security / database）。

## 現在の訂正（worktree 再検証）

P08 初回判定後、このworktreeには `drizzle/0022_orange_mystique.sql` が追加され、
実際に使う `disclosures` 表へ `workspace_id` を追加する変更が入った。
したがって、下の「migration追加0」「使用中の表はすべて既にworkspace_idを持つ」は
**現在値ではなく、P08初回判定時点の履歴**である。

旧 `disclosures` 行には所属workspaceを復元できる列が無い。空文字や任意のworkspaceを
自動で割り当てると、既存行が不可視になるか別tenantの行として読まれる。このため0022は、
旧行が1件でもある環境では列追加前に停止し、所有者mappingを人が決めるfail-closed方式とした。
空テーブル環境ではmigrationが通ることをD1結合テストで確認している。

## 当初判断（P08 初回判定の履歴。現在の判断には使わない）

**当初は、マイグレーションを1本も追加していないと判定した。**

P08 の役目は「全テーブルへの `workspace_id` 付与が既存データを壊さず適用できることを確定する」ことだった。
実測すると、**保存先として実際に使われている表は全部すでに `workspace_id` を持っていた**。
足すものが無い以上、マイグレーションを書けば「何も変えない SQL」が 1 本増えるだけになる。

代わりにやったのは、**この状態が明日も成り立っていることを機械が確かめ続ける仕掛け**を置くことである。
移行そのものより、移行後に崩れないことのほうが AWS-ACC-02 にとって重い。
`workspace_id` を持つ表がいま 26 本あることは、次に表を 1 本足す人には伝わらない。

## 実測（2026-08-24）

対象は `src/db/schema.ts`（40 表）と `src/db/auth-schema.ts`（5 表）の計 45 表。
最新のマイグレーション記録（`drizzle/meta/0022_snapshot.json`）も 45 表で、**スキーマと移行の間にずれは無い**。

| 区分 | 本数 | 内訳 |
|---|---|---|
| `workspace_id` を持つ | 26 | いま保存先として使われている表すべて |
| 昔の設計の名残（使われていない） | 12 | `asps` `programs` `conversions` `categories` `people` `products` `articles` `article_people` `article_products` `conversation_blocks` `faqs` `update_logs` |
| 作業場所より外側 | 7 | `workspaces` `signin_denials` と Better Auth の 5 表（`user` `session` `account` `verification` `rate_limit`） |

「使われていない」は記憶ではなく実測である。`src/db/` を除いた `src/` の全ファイルの `import` を構文として読み、
上記 12 表を名前で取り込んでいるファイルは **0 件**だった。

## 判断 M-01: 使われていない 12 表に `workspace_id` を足さない

足す案は自然に見えるが、得るものが無い。

- 列を足しても、読み書きする口が無いので**分離の実効は 1 ミリも増えない**。
- 既存行への `NOT NULL` 追加には既定値が要る。`"ws_unknown"` のような値を入れると、
  **中身の無い行に、正しそうな作業場所の印が付く**。後から本物と見分けられない。
- D1 の `ALTER TABLE` は本番でも走る。**何も得ずに本番の表を触る**のは、失敗の側にだけ確率を積む。

代わりに置いたのは、**使い始めた瞬間に赤くなる検査**である
（`tests/architecture/tenant-scoped-schema.test.ts`「作業場所を持たない古い表は、どこからも触られていない」）。
`articles` を 1 行 `import` した時点でテストが落ち、「使うなら先に `workspace_id` を足してください」と言う。

「使われていないから安全」を人の記憶で保たせない、というのがこの判断の中身である。

## 判断 M-02: 使われていない 12 表を消さない

消せば検査も要らなくなるが、**消すのは本番の D1 に対して不可逆**である。
`DROP TABLE` は既存のマイグレーションに 1 本も無く、この feature の 4 受け入れ条件のどれにも必要ない。
削除は移行の判断ではなく片付けの判断なので、AWS-ACC-02 の担保とは別に扱う（残課題へ送る）。

## 判断 M-03: 索引の水準でも作業場所で切る

`workspace_id` の列があっても、絞る索引が無ければ 1 件を読むために全作業場所の行を走る。
行数が増えた日に、**他所のデータの量が自分の応答時間として漏れる**。

実測すると、`workspace_id` を持つ 26 表のうち 24 表が
「`workspace_id` で始まる索引」か「`workspace_id` で始まる複合主キー」を持っていた。残り 2 表は次の理由で免除する。

| 表 | 理由 |
|---|---|
| `sessions` | 主キーが合言葉の潰した値。作業場所は結果として読む列で、絞る列ではない |
| `integration_key_usages` | 鍵 id で数える。鍵そのものが 1 つの作業場所に属するので、鍵 id が既に作業場所を含んでいる |

使われない索引を足すのは、速くならないうえに書き込みだけ遅くする。**理由を書いて免除するほうを選ぶ。**

## 判断 M-04: 宣言ではなく、実際の問い合わせを読む

ここが P08 で実際に塞いだ穴である。

`tests/architecture/tenant-scoped-ports.test.ts` は入口（Repository ポート）の**宣言**だけを読む。
あの検査の説明にも、設計文書の「この設計が保証しないもの」にも、同じことが書いてある——
**実際の SQL に `where workspace_id` が付いているかは見ていない**。引数に `workspaceId` を受け取っておいて
`where` に書き忘れれば、**型は通り、ポートの検査も緑で、データだけが混ざる**。

設計文書はこれを結合テストへ送っていた。しかし結合テストは**書いた経路しか通らない**。
新しい読み口を 1 本足して、そこだけ絞りを書き忘れたとき、対応する結合テストも同時に書き忘れていれば、全部緑のまま漏れる。

そこで、`src/` 全体の `db.select().from(表)` / `.update(表)` / `.delete(表)` を構文として読み、
その 1 本が `表.workspaceId` を条件に含むかを見る検査を足した。実測 **72 本中 56 本が作業場所で絞っており、16 本が絞っていない**。
16 本はすべて理由が立つもので、`QUERY_EXEMPT` に**理由と件数**を書いた。

| 免除の群 | 本数 | 理由 |
|---|---|---|
| 読者向けの公開ページ（`published_articles` / `site_blueprints` / `redirect_resolutions`） | 9 | 読者にセッションは無く、手がかりは URL の名前か合言葉だけ |
| 作業場所を**決める**処理（`sessions` の引き当て、鍵の認証） | 3 | 作業場所はここの出力であって入力ではない |
| 作業場所が既に確定している id で引くもの（鍵 id、転送の主キー） | 3 | 直前の問い合わせが作業場所つきで絞っている |
| 時計が呼ぶ配信（`publications.listDue`） | 1 | 呼び出し元に身元が無い（ポート側の免除と同じ理由） |

免除に**件数**まで書いてあるのは、理由だけだと同じメソッドに 2 本目の絞らない問い合わせを足したときに
既存の免除へ黙って吸われるからである。件数が合わなくなれば落ちる。

## この検査が保証しないもの（先に書く）

- **`where` の中身が正しいか**は見ない。`eq(t.workspaceId, "ws_public")` のように定数を書いても、条件としては通る。
  そちらは `tenant-scoped-ports.test.ts` の「読者の身元は 1 か所でしか作らない」と
  `tests/integration/d1-tracking-issuance.test.ts` の「作業場所の往復」が受け持つ。
- **呼び出し元が渡す `workspaceId` が正しいか**は見ない。文字列としては同じ形なので静的には見分けられない。
  そちらは `assertSameTenant()`（D-03 の ② 層）と受け入れテストが受け持つ。
- **生の SQL**（`db.prepare(...)`）は読まない。いまは 1 本も無いが、書かれれば素通しになる。

3 つとも「見ていない」と書いておく。判定欄に「見ている」と書いて実際は見ていない、が
このリポジトリで何度か起きているためである。

## 壊して確かめた（2026-08-24 実測）

置いた検査が本当に落ちることを、5 通りの壊し方で実測した（実測後はすべて元に戻した）。

| 壊し方 | 落ちたテスト |
|---|---|
| `disclosure-repository.ts` の `findById` から `eq(disclosures.workspaceId, ...)` を外す | 「絞らない問い合わせは、理由つきで免除されたものだけ」 |
| `workspace_id` の無い表 `brand_notes` を `schema.ts` へ足す | 「すべての表に workspace_id がある」 |
| `disclosures_workspace_idx` を `id` の索引へ差し替える | 「作業場所を持つ表は、作業場所で始まる索引か主キーを持つ」 |
| `audit-log-repository.ts` で `articles` を `import` する | 「使い始めたものが 1 つも無い」 |
| `redirect-repository.ts` に 2 本目の絞らない `update` を足す | 「免除した件数と、実際に絞っていない件数が一致する」 |

## 将来テーブルを足す人への手順

1. 表に `workspace_id`（`text("workspace_id").notNull()`）を入れる。
2. `workspace_id` で始まる索引か複合主キーを 1 つ入れる。
3. 読み書きするとき `where` に `workspace_id` を入れる。
4. どれかを外すなら、`tests/architecture/tenant-scoped-schema.test.ts` の免除表へ**理由を書いて**載せる。
   理由が書けないものは載せられない。

## 残課題

- 使われていない 12 表の削除。移行の判断ではなく片付けの判断なので、本 task では扱わない（M-02）。
  消すときは `DROP TABLE` を新しいマイグレーションで足し、上記の検査の `legacy_unused` の項も同時に消す。
- 生の SQL（`db.prepare`）が書かれた場合の検出。いまは 1 本も無いため検査を足していない。
- `docs/spec/**` の指紋（`scripts/spec-freshness.mjs`）は、本文書を足す**前から** STALE である。
  本文書は派生・非規範で、評価対象の規範文書を 1 バイトも変えていない。焼き直しは本 task の持ち物ではない。
