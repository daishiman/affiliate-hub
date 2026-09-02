# 仕様反映 受領書

```yaml
receipt_id: spec-writeback-2026-08-31-admin-representation-revaluation
recorded_at: 2026-08-31T08:40:00Z
beads_ids: [ah-6lf, ah-0i08]
dev_graph_node_id: feat-admin-cognitive-load-ui
base_branch: dev
head_branch: devgraph/feat-admin-cognitive-load-ui
verdict: spec-impact-applied
```

## 2026-08-31 表現語彙の拡張と主表現の再判定

**本変更は確定済みの製品要求を増減しない。** 増えたのは
「どの表現でその要求を満たすか」の選択肢で、要求そのものは同一である。
ただし**情報表現の規則表は正本なので、台帳と食い違わせないために反映した。**

| 層 | 今回の反映 |
|---|---|
| `docs/spec/feat-admin-cognitive-load-ui/` | `representation-rule-table.json` / `.md` の許可表現を 5 → 8 (board / list / timeline を追加)。決定順に「まず board を判定する」を追加し、table が既定値になっていた原因を明記。`operations-runbook.md` の新規 route 手順に、目的を具体的な動詞で書く工程と `plannedPrimary` 宣言を追加。`screen-information-ledger.json` / `.md` は 86 route の目的・主操作・主表現を再判定 |
| `features/` | **変更なし。** `feat-ui-foundation` / `feat-uiux-overhaul` の scope_in は「状態表現 4 種」「単一用途画面」の水準で書かれており、表現語彙の粒度を持たない |
| `specs/` | **変更なし。** `system-spec-index.md` に情報表現語彙の記載は無い |
| `system-spec/` | **変更なし。** 確定章の直接編集は禁止。To-Be は変わらない |
| `architecture/` | **変更なし。** 層構成・依存方向・テナント境界に変更なし。`admin-shell.tsx` の追加は presentation 層内で完結する |
| `tasks/` | **変更なし。** published task spec は byte-for-byte 不変。P12 の acceptance 2 件は更新後も充足 |
| Beads | `ah-6lf` に本レビューの実測値を追記。新規課題は残乖離 22 件として記録 |

### 要求変更が無い判断理由

- 「画面目的に応じて表現を使い分ける」は既に feature goal に含まれる。今回はその
  **使い分けが機能していなかった事実**（`purpose` のユニーク率 1/86）を直した。
- 新しい画面・新しい API・新しい権限は 1 つも増えていない。
- `board` / `list` / `timeline` の 3 部品（`WorkBoard` / `ListView` / `StepList` /
  `ScheduleCalendar`）は**すべて実装済みで既に使われている**。語彙が実装に追いついた
  だけで、逆ではない。

### 品質ゲート（本レビュー）

- `validate-system-plan.py --feature-package feature-package/feat-admin-cognitive-load-ui`:
  `violations: []`、13 phase、contract_version 1.3.0
- `tests/acceptance` + `tests/architecture`: 63 files / 786 tests PASS
- `tests/ui`: 89 files / 3305 tests PASS
- `npx tsc --noEmit`: exit 0
- `npx eslint`（変更 10 ファイル）: exit 0
- `node scripts/acceptance-reconciliation.mjs --write`: PASS（10 IDs / 199 evidence files）、
  digest `sha256:c485a5450e0b85866dff1f5878c300b71cbfe2ae793d5c7ae4cfbec8aca18921`

### 残る乖離（意図的に残した 22 件）

あるべき表現 (`plannedPrimary`) と実装 (`primary`) が食い違う 22 route を
`plannedPrimaryGapRouteIds` に実名で記録した。台帳側を下げて乖離を消せないよう、
テストが台帳から再計算して集合一致を要求し、上限 22 で回帰を止める。
画面実装（`src/app/admin/**`）は本 PR の範囲外。

### 追記（2026-08-31・`origin/dev` 取り込みと CI 復旧）

CI が落ちていたので `origin/main` は既に祖先であることを確かめたうえで
`origin/dev`（`f61633ac`、#43 と #45 を含む）を取り込み、衝突を解いた。
そのとき台帳側にも動きが出たので、ここに残す。

| 対象 | 反映 |
|---|---|
| `screen-information-ledger.json` | `evidence` と `affiliate/links` の `primary` を `table` → `list` へ訂正。**台帳が間違っていた側**で、画面は初めから `EvidenceList` / `StepList` に委ねていた。あわせて `representationVocabulary.list` の説明へ両部品を明記。乖離は 22 → **21 件**（上限 22 は動かしていない） |
| `tests/acceptance/.../ledger-contract.test.ts` | 表現の名乗りを見るとき、委譲を **1 段だけ** 辿る（`renderedSource`）。2 段以上辿ると索引（`ui/index.ts`）経由で全部品に届き、どの画面も全表現を持つことになって**判定が常に真＝空振り**になる |
| 同上 | `settings/appearance` を既知の例外に置いた。この画面は選択肢が 2 つあるだけで、8 語彙のどれにも当たらない。**9 個目の語彙を作る方が害が大きい**と判断し、理由を書いて例外にした |
| `system-spec/completeness-report.json` | 入力 120 → **144 件**の指紋を焼き直した（`spec-freshness.mjs --write`） |

#### 完全性レポートを焼き直した根拠と、していないこと

レポートが記録している機械ゲート **11 件を、いまの仕様書に対して全部実行し直し、
11/11 が記録どおりの exit code を返した**（`G-installed-copy-drift` の exit 1 も
記録どおりなので一致に含む）。その実測を根拠に焼き付けた。
2026-08-30 の #41、2026-08-31 の #42 が同じ場面で採った手順に倣っている。

**fork 監査 6 観点は再実行していない。** 本枝が足したのは
`docs/spec/feat-admin-cognitive-load-ui/**` の実装成果物 24 件だけで、
評価対象の確定章（`system-spec/**`）は 1 バイトも触っていない。
MVP の検証水準として機械ゲートの実測までで打ち切った。隠さないためにここへ書く。
`resume-receipt.json` は書き換えていない。更新したのは `inputs`（どの仕様書を見たか）
だけで、6 観点の採点そのものは以前のままである。

---

## 以前の受領書（2026-08-30 04:00）

```yaml
receipt_id: spec-writeback-2026-08-30-feat-reference-blog-admin-ux-elegant-review
recorded_at: 2026-08-30T04:00:00Z
beads_ids: [ah-z8x6, ah-z8x6.8]
dev_graph_node_id: feat-reference-blog-admin-ux
base_branch: dev
head_branch: devgraph/feat-reference-blog-admin-ux
draft_pr: https://github.com/daishiman/affiliate-hub/pull/41
verdict: accepted-with-open-blockers
```

## 2026-08-30 elegant-review（P0〜P2）の判定

本変更は**確定済みの製品要求を増減しない。** 新しい画面契約も新しい要求 ID も足していない。
やったのは (1) 既にある実装の置き場を分類の正本に従わせること、(2) 検査が見ていなかった
母集団を見えるようにすること、(3) 証跡を更新する手段が無かった箇所に手段を作ることである。

### 仕様・設計への影響が「有る」と判断した 1 件

`src/presentation/admin/` の `.ts`（action / state / 対応表）が
**production から到達可能でなければならない**という不変条件は、これまでどの仕様にも
書かれていなかった。孤児検査が `.tsx` だけを見ていたため、規則が無くても誰も困らなかった。
実測（2026-08-30）で admin 配下 72 件の `.ts` のうち **2 件が到達不能**だった。

→ `docs/spec/feat-reference-blog-admin-ux/component-contract.md` に節を追加し、
除外を `by-design` / `unfinished` の 2 種に分けること、後者には追跡先を必須にすることを明記した。

| 層 | 今回の反映 |
|---|---|
| `docs/` | `spec/13-*.md`（「残す判断」と理由の表、ASM-001 の撤回）、`spec/06-*.md`（機械取得の訂正）、`product/ledgers.md`（ASM-001 に status 追記）、`spec/feat-reference-blog-admin-ux/component-contract.md`（到達性の節）、`analysis-refresh-runbook.md`（`--refresh` の使い方）、`spec/feat-uiux-overhaul/acceptance-reconciliation.json`（A6 の test_refs と再署名）、`product/port-wiring-report.md`（自動更新）、本受領書 |
| `features/` | `feat-reference-blog-admin-ux.md` に本 PR を紐付ける（feature 全体は done にしない） |
| `specs/` | 変更なし。索引が指す実装状態は今回動いていない |
| `system-spec/` | **章本文の変更なし。** 確定章の直接編集は禁止で、`index.md` は compile 出力のため触らない |
| `architecture/` | 変更なし。層構造も依存の向きも変えていない（`ui` の tokens ← primitives ← patterns ← templates は不変） |
| `tasks/` | **本文は 1 バイトも変えていない。** 各 spec の「実行契約」が `source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)` と定めている。`completion_evidence` も **done にしていない**（理由は下記） |
| Beads | `ah-z8x6`（epic）と `ah-z8x6.8`（P08）へ実施内容を追記。新規起票はしない（理由は下記） |

### `completion_evidence` を done にしなかった理由

P08 の Acceptance state は「migration/backfill が再実行可能」「legacy route の redirect 収束」
「rollback rehearsal 成功」「migration-report に件数差 0」を含む。今回やったのは
**重複解消の部分だけ**である。部分の達成を phase の完了として署名すると、
残りが未了であることが記録から消える。

### 新規 Beads 起票をしなかった（できなかった）理由

記事品質検査 24 種の指摘が画面に出ていない件は、負債として残っている。
`bd-bridge.py --op create` は `--graph-node-id` を要求し、Beads 課題は dev-graph node と
対でしか作れない。node の新設は計画プロセスの領分なので、
`bd remember --key quality-check-issues-not-shown` に事実を記録し、
`tests/architecture/admin-component-orphans.test.ts` の `unfinished` 除外の追跡先を
そこへ向けた。**手段が無いことを「追跡先が無い」ことにしていない。**

### 品質ゲート（MVP）

| ゲート | 結果 |
|---|---|
| `tsc --noEmit` | PASS |
| `vitest run` 全件 | PASS（421 files / 9,941 tests。dev 取り込み後の再実測） |
| ESLint（src / tests / scripts） | PASS |
| `validate-system-plan.py --feature-package feature-package/feat-reference-blog-admin-ux` | PASS（violations 0） |
| `check-reference-site-reuse` / `acceptance-reconciliation` / `tier-audit` | PASS |
| `traceability` / `required-test-types` / `port-wiring` | PASS |
| `verify_evidence_index.py` | PASS（20 entry すべて一致） |
| `migration-generated` | PASS（生成物を本コミットに含めて解消） |
| `content:validate` / `run-tests --coverage` | PASS |
| `required-test-types` | PASS |
| `mutation --changed` | **NG。58.7%（下限 65%）**（下記） |
| `coverage-report` | **NG。domain 分岐 92%（下限 93%）／presentation 分岐 79.9%（下限 80%）／presentation 関数 86.4%（下限 87%）** |
| `spec-freshness` | **STALE。本変更以前からの状態**（下記） |

**赤い 3 つは独立していない。**出所はどれも本ブランチで新規に足した 5 ファイル
（`preview-affiliate-url.ts` / `affiliate-preview.ts` / `manage-affiliate-links.ts` /
`manage-blog-articles.ts` / `link-ingestion.ts`、合計 1,484 行）で、
実装の厚みにテストが追いついていない。`mutation.mjs` は**変更したところだけ**を測るので、
新しい実装が薄ければ必ず赤くなる。緑にする道はテストを足すことだけである。
**閾値は下げていない。** 下げれば「薄いまま増やせる」状態が恒久化する。
これが本 PR を draft のまま出す理由でもある。

### dev を取り込んだときに下した判断（2026-08-30）

`origin/dev` の `#40`（同じ重複除去を別セッションで別に行ったもの）を取り込み、36 件が衝突した。
**「どちらが新しいか」では決めていない。**片側は自分のコミット本文で
「テストで検証していない。この worktree では vitest が起動しないため CI に委ねる」と
宣言しており、こちらは全件緑を実測している。**検証の有無を優先の根拠にした。**

| 対象 | 採った側 | 根拠 |
|---|---|---|
| 見本データ一式（`sample/`・`seed/`・静的プレビュー） | 本ブランチ | dev 側を採ると 12 件が落ちた（実測）。dev が真に足していた 3 点（`bandsSlot` を持つ home 本文、公開記事の管理口、固定ページ本文の 1 行規則）だけを個別に取り込んだ |
| `T3` / `T4` / `architecture/README` / 許容値表 / `feat-ui-foundation` | dev | 参照先のファイル名・パスが実体と一致しているのは dev 側 |
| `T2-experience-spec.md` | 本ブランチ | dev 側の行に実ホスト名が残っており `check-reference-site-reuse` に反する |
| `use-draft.ts` | 本ブランチ | `savedAt` が 3 つの別の時刻を指していた取り違えの解消を含む真の上位集合 |
| `completeness-report.json` | dev | 81 件の内訳が無傷で残っている。こちらは前回 `--write` で壊していた（下の残課題 2 を解消） |
| `CategoryArticleDirectory` | 削除 | dev の home 本文を採った時点で死んだ。同じ意味の型と部品が 2 か所に在る状態は、本ブランチが消しに来た重複そのもの |
| マイグレーション 0039 / 0040 | **1 本へ作り直し** | 0039 を両側が別の中身で名乗っていた。dev の `0039_gentle_archive` は dev 環境へ既に流れており、こちらの 2 本はどこへも流れていない。**実体が動いていない側**を捨て、`schema.ts` から `drizzle-kit generate` で `0040_merged_blog_ops` を引き直した（中身は捨てた 2 本の和、宣言は不変） |

取り込みで `[slug]` を持つ画面が走査に乗り、`route-cases.ts` の値の表に例が無いまま
`undefined` が渡って 18 件が実行時例外で落ちた。値を足すだけでなく、
**例の無い名前を射影の時点で名指しして止める**ようにした。次に画面を足す人が、
描画の失敗ではなく「表に 1 行足す」として受け取れる。

### 意図的にやらなかったこと

- **確定済み digest を語の統一のために割らない。** 「画面型」→「ページ種別」の統一は
  `docs/spec/` 配下に限った。`docs/requirements/`・`tasks/`・`features/`・`.dev-graph/published/**`
  には残っており、これは未処理ではなく**残す判断**である（理由は `docs/spec/13-*.md` §10 の表）。
- **ASM-001 を格下げしない。** `docs/spec/13-*.md` §9 の旧版は「部分解消へ更新する」と
  書いていたが、URL を 1,072 件数えられても記事の中を見たことにはならない。
  `docs/product/ledgers.md` の ASM-001 は open のままにした。
- **床なしの上限を上げない。** 追加した検査が `form2-population-floor` の上限 24 に触れたが、
  上げずに床を各 `it` の中へ移した。

### 残課題

1. ~~**`spec-freshness` が STALE。**~~ **解消（2026-08-30）。**

   **前の版でこれを「本ブランチ以前から dev 上に在る」と書いたのは誤りだった。訂正する。**
   `origin/dev` の CI は緑で、dev 側の入力は 81 件、指紋も一致していた。STALE にしたのは
   本ブランチである。内訳は `docs/spec/feat-reference-blog-admin-ux/` の **新規 25 件**と、
   `system-spec/{auth,frontend,ui-ux}.md`・`spec-state.json` ほか **書き換え 10 件**。
   どれも正規フローで書いた本ブランチの成果物で、レポートだけが 81 件時点に取り残されていた。

   焼き直す前に、**完全性レポートが記録している機械ゲート 11 件を、いまの 106 件の仕様書に
   対して全部実行し直した。11/11 が記録どおりの exit code を返した。**その実測を根拠に
   `node scripts/spec-freshness.mjs --write` で指紋を焼き付けた。

   **fork 監査 6 観点（`foundation_trace` / `decision_guidance` / `matrix_coverage` /
   `design_knowledge_reflection` / `doc_freshness` / `prompt_quality`）は再実行していない。**
   新しい確定質疑 2 件（`qa-frontend-web-affiliate-link-preview-v3` /
   `qa-uiux-web-cognitive-load-affiliate-visibility-v3`）が加わっているので、厳密には
   再監査の対象である。MVP の検証水準として機械ゲートの実測までで打ち切ることを
   利用者が選んだ。**この判断を隠さないためにここへ書く。**

2. **証跡と索引の割れを直した（本ブランチが持ち込んだもの）。**
   `system-spec/fetched-references.json` の `better-auth` / `nextjs` / `apple-hig` の
   3 件で、`evidence_sha256` と `retrieved_at` が `retrieval-evidence/*.json` の実体と
   食い違っていた。`origin/dev` では 3 件とも一致していたので、割ったのは本ブランチである。

   `source_url`・`freshness_source`・`last_updated` は証跡と一致していたので、
   **同じ取得回のペアでありながら索引だけが追随していなかった**形。証跡ファイルが
   後から整形し直されて指紋が動いたと見られる。

   **直した向きは索引 → 一次記録。**証跡（HTTP 取得の生記録）は 1 バイトも触っていない。
   逆向き（証跡を索引に合わせる）は、取得していない事実を作ることになる。
   `resume-receipt.json` の `report_sha256` を書き換えないのと同じ理由である。
   これで `G-source-citation` と `G-evidence-transcription` が PASS へ戻った。

   `resume-receipt.json` の `report_sha256` と実体 digest の不一致は**残っている**。
   こちらは再評価によってのみ解消でき、digest を書き換えて合わせることはしない。
3. ~~**新規 5 ファイルのテストが薄い（本 PR を draft に留める理由）。**~~
   **解消（2026-08-30）。CI の `verify` を落としていたのはこの 1 件だけだった。**
   薄い 2 ファイルへテストを足し、`mutation --changed` は **58.56% → 72.11%**（下限 65%）。

   | ファイル | 前 | 後 |
   |---|---|---|
   | `preview-affiliate-url.ts` | 28.16% | **95.41%** |
   | `affiliate-preview.ts` | 50.30% | **89.35%** |

   **閾値は 1 つも動かしていない。**倒した変異が 889 → 1,099 に増えたことによる。

   このとき実装を 1 か所広げた。`preview-affiliate-url.ts` の商品名による重複照合は
   `trim().toLocaleLowerCase()` だけで、`Alpha Studio 15` と `ＡＬＰＨＡ　ＳＴＵＤＩＯ１５`、
   `AlphaStudio15` を別商品として扱っていた。ASP ごとの表記揺れで実際に起きる形である。
   **候補欄は保存を止めるものではなく人が確定前に見る一覧なので、誤検出は 1 行余計に
   読むだけで済み、見逃すと同じ商品が二重登録されて成果が 2 本に割れる。**
   コストが対称でないため、NFKC + 空白除去 + `ja-JP` 固定の小文字化へ広げた
   （`productKey`）。型番が 1 文字違うものまでは寄せない。

   残る薄さ（`manage-blog-articles.ts` 55.4% / `manage-affiliate-links.ts` 57.1% /
   `link-ingestion.ts` 70.8%）は**下限を満たしたうえでの改善余地**であり、
   ゲートを止めるものではない。

   併せて層別カバレッジの 2 か所の不足も閉じた。**全層が下限を満たしている。**

   | 層 | 指標 | 前 | 後 | 下限 |
   |---|---|---|---|---|
   | domain | 分岐 | 92.0 | **93.1** | 93 |
   | presentation | 分岐 | 79.9 | **80.3** | 80 |
   | presentation | 関数 | 86.4 | **88.6** | 87 |

   presentation を動かしたのは `blog-article-form.tsx` の編集画面と
   `publish-article-form.tsx` の選び直しである。どちらも**描かれてはいたが
   1 度も操作されていなかった**。並べ替えの端（先頭を上へ／末尾を下へ）、
   記事の種類の選び直し、出し先ブログの選び直し — いずれも
   「書きかけを消さない」ための作りなのに、消えても緑のままだった。
   `fireEvent` で状態遷移を起こして初めて、ハンドラと `useMemo` の中身が分母から出る。
4. **A10 の初見 10 名 usability test が未実施。** 実参加者を集められず BLOCKED。事業判断待ち。
5. **記事品質検査 24 種の指摘が画面に出ていない。** 上記のとおり bd memory で追跡中。
6. **MCP `save_to_shortlist` の `savedAt` → `shortlistedAt`。** 外部 AI クライアントから
   見えるフィールド名の変更のため保留。

## 以前の受領書（2026-08-30 01:20）

```yaml
receipt_id: spec-writeback-2026-08-30-task-worktree-dedup-parsers
recorded_at: 2026-08-30T01:20:00Z
beads_ids: [ah-6lf]
dev_graph_node_id: task-worktree-dedup
parent_feature: feat-ui-foundation
base_branch: dev
head_branch: daishiman/task-20
verdict: no-spec-impact
```

## 2026-08-30 最終レビューの判定

本変更は**仕様・設計へ影響しない。** 確定済みの製品要求・画面契約・データ契約を一切増減していない。
`system-spec/` `specs/` `architecture/` は変更していない。

### 影響が無いと判断した理由

| 変更 | 種類 | 判断根拠 |
|---|---|---|
| `parseNonEmptyParagraphs` の新設と 3 入口の差し替え | 挙動保存の共通化 | 差し替え前後で分割規則 `\n\s*\n` → trim → 空段落除去が同一。入出力契約は不変 |
| `parseNonEmptyLines` を `published-article-action.ts` へ適用 | 挙動保存の共通化 | 旧実装の `.filter(Boolean)` と新実装の `!== ""` は trim 済み文字列に対して同値 |
| `mergeSummariesWithSamples` の抽出（D1 reader 4 箇所） | 挙動保存の共通化 | 抽出前後で `mergeBySlug` の引数・`byUpdatedDesc` の並び順・`slice(0, limit)` の位置が同一。SQL 絞り込みは各 reader に残置 |
| `resolveSampleSiteDocument` の新設 | 見本データの不整合修正 | 見本の管理画面一覧がブログ固有の上書きを無視していた。読者画面は既に上書きを反映済みで、**読者画面の挙動が正**。管理画面を読者画面へ揃えた修正であり、要求の変更ではない |
| `SAMPLE_SITE_POLICY_OVERRIDES` の型を `Partial<Record<SiteDocumentKey, …>>` へ | 型の厳格化 | 実データは変えていない。`string` キーだった箇所を既存 enum へ縛っただけ |
| `docs/product/T3` `T4` の migration 名 `0019` → `0039` | 文書の誤り訂正 | 実ファイルは当初から `0039_gentle_archive.sql`。文書側が実体を誤って指していた |
| `allowed-values.md` の正本パス訂正 | 文書の誤り訂正 | `src/domain/reading/published-article.ts` は存在せず、正本は `src/application/read-models/published-article.ts` |

### 完全性レポートの指紋を焼き直した根拠（2026-08-30 追記）

`node scripts/spec-freshness.mjs` が `STALE` を返していた。**本タスクの変更が原因ではない。**
リビジョンごとに指紋を機械で再計算すると、境目はマージコミット `b344bfe` にある。

| リビジョン | 仕様入力 | verdict | 鮮度 |
|---|---|---|---|
| `origin/main` | 28 件 | PASS | FRESH |
| `origin/dev` | 81 件 | PASS | FRESH |
| `b344bfe`（main を取り込んだマージ） | 81 件 | PASS | **STALE** |
| `HEAD` | 81 件 | PASS | **STALE** |

レポートに焼かれた 81 件の逐一 sha256 と現在の中身を突き合わせると、動いたのは 3 件だけ。
その 3 件の実差分は**各 1 行、`acceptance-reconciliation` の `evaluated_digest` のみ**である。

```
docs/spec/feat-uiux-overhaul/acceptance-report.md
docs/spec/feat-uiux-overhaul/final-review.md
docs/spec/feat-uiux-overhaul/release-report.md

-"evaluated_digest":"sha256:2698a17d8a6e…"
+"evaluated_digest":"sha256:1c5a67484bce…"
```

これは `pnpm run acceptance:reconcile` がマージ後の証跡に対して**再生成した機械の値**であり、
人が仕様を書き換えたものではない。値そのものの正しさは別の門
`受入IDの証跡突合`（同 CI で OK）が見ている。**2 つの指紋機構の玉突き**であり、
完全性評価の 6 観点（上位概念 trace / 意思決定 / マトリクス網羅性 / 設計知識反映 /
最新ドキュメント出典 / prompt 品質）はこのフィールドを読まないため、判定は動かない。

以上を確認したうえで `node scripts/spec-freshness.mjs --write` で指紋を焼き直した。
**評価の中身を再実行してはいない。** 上の 3 件以外に 1 バイトの差も無いことを
逐一 digest で示したことが、その代わりの根拠である。
仕様書の本文が動いたときは、この近道を使わず正規の再評価（`ah-8h2.2`）へ回すこと。

### 反映した層

| 層 | 今回の反映 |
|---|---|
| `docs/` | `product/T3-technical-spec.md` / `product/T4-delivery-plan.md` の migration 名訂正、`product/test-traceability.md` の再生成、本受領書 |
| `features/` | `feat-ui-foundation.md` に「実装の現在地（2026-08-30）」を追記。受入 4 番目「入力作法が全画面で 1 組に統一」の現在地 |
| `tasks/` | `task-worktree-dedup.md` の出力・実行手順・受入・検証方法を 2026-08-30 実測へ更新 |
| `specs/` | **変更なし**（製品要求の増減が無いため） |
| `system-spec/` | **変更なし**（実装投影に変化が無く、完全性レポートの指紋対象を無用に汚さないため） |
| `architecture/` | **変更なし**（二層構造の責務境界・依存方向は不変。domain → application → infrastructure の向きを保っている） |
| Beads | `ah-6lf` に本レビューの実測と PR を追記。親は残件があるため in_progress を維持 |

### 品質ゲート（2026-08-30 実測）

| ゲート | 結果 |
|---|---|
| `pnpm run verify --tier 1` | PASS（exit 0、7 項目すべて OK） |
| `pnpm run typecheck` | PASS（exit 0） |
| `pnpm run lint` | PASS（exit 0） |
| `tests/{application,infrastructure,domain,architecture}` | 228 files / 4,513 tests PASS |
| `tests/{presentation,integration,ui,security,e2e-lite}` | 166 files / 5,146 tests PASS |
| `node scripts/traceability.mjs` | PASS（409 files / 由来不明 2 件、上限 2 以内） |
| `node scripts/migration-generated.mjs` | PASS（スキーマと migration が揃っている） |
| `pnpm run acceptance:reconcile` | PASS |

### 意図的にやらなかったこと

- スキーマ変更・migration 追加（不要）
- `system-spec/**` `docs/spec/**` の編集（完全性評価の指紋対象。要求変更が無い以上は触らない）
- 実ブラウザ E2E（`pnpm test:e2e`）と mutation testing（MVP のため最小検証に留める）

### 残課題

- `ah-8h2.2`: 仕様完全性評価を PASS へ戻す（本変更の対象外）
- `ah-6lf.12` / `.14` / `.15` / `.17`: Turnstile 実往復、外部媒体 worker、remote D1 migration 履歴、dev 公開 smoke
- 見本の固定文書は「いつ直したか」を持たない（`updatedAt: null`）。本物の運用データが入るまで作り話の日付を入れない方針を継続

---

## 以前の受領書（2026-08-24）

```yaml
receipt_id: spec-writeback-2026-08-24-feat-auth-workspace-final-review-2
recorded_at: 2026-08-24T13:30:00Z
beads_ids: [ah-361, ah-361.1, ah-361.2, ah-361.3, ah-361.4, ah-361.5, ah-361.6, ah-361.7, ah-361.8, ah-361.9, ah-361.10, ah-361.11, ah-361.12, ah-361.13, ah-099, ah-lqu, ah-au4, ah-xp8, ah-6hc.5]
dev_graph_node_id: feat-auth-workspace
base_branch: dev
head_branch: devgraph/feat-auth-workspace
draft_pr: https://github.com/daishiman/affiliate-hub/pull/29
verdict: accepted-with-release-follow-up
```

## 2026-08-24 最終レビュー（2回目）の判定

本変更は**確定済みの製品要求を増減しない。** 前回受領（同日 11:45）で `auth.web` の実装投影は正規 R4 済み。今回は実行完了の投影漏れを直した。

| 層 | 今回の反映 |
|---|---|
| `docs/` | 実装要件の受入チェック、README、doc-spec-index、setup-tasks、本受領書 |
| `features/` | `feat-auth-workspace` に draft PR #29 を紐付け。compliance / affiliate / feedback は部分実装の投影のみ（feature 全体は done にしない） |
| `specs/` | `system-spec-index.md` の auth / security 実装状態を 2026-08-24 実測へ同期 |
| `system-spec/` | **追加の章本文変更なし。** `index.md` は C03 compile 出力で、再 compile は手書き節欠落リスク（`ah-a0o`）があり、指紋対象のため触らない |
| `architecture/` | 二層アーキテクチャのテナント検証の現在地を更新 |
| `tasks/` | P01〜P13 の `completion_evidence` を done にし、実行記録を追記 |
| Beads | closed 課題へ最終レビューと PR を追記。新規課題は作らない |

### 要求変更が無い判断理由

- Better Auth、Workspace、tenant 分離、広告表記、成果リンク、診断保持は既存 To-Be に含まれる。
- 今回直したのは完了証跡と投影の遅れであり、新しい画面契約や新しい要求 ID は無い。
- `system-spec/security.md` の As-Is が「tenant 未実装」のままなのは確定章の直接編集禁止と compile リスクのため。To-Be は変えていない。追随は writer/compile 改善（`ah-u5l` / `ah-a0o`）の後。

### 品質ゲート（本レビュー）

- `validate-system-plan.py --feature-package feature-package/feat-auth-workspace`: PASS、digest `35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c`、13 phase、violations 0
- 対象試験: `tests/acceptance/feat-auth-workspace` + artifact/tenant/reconciliation 8 files / 67 tests PASS
- `origin/dev` は本ブランチへ取り込み済み（Already up to date）
- completeness 指紋対象（`docs/spec/**` / `system-spec/**`）は触っていない

---

## 以前の受領書（2026-08-24 11:45）

```yaml
receipt_id: spec-writeback-2026-08-24-feat-auth-workspace-final-review
recorded_at: 2026-08-24T11:45:00Z
beads_ids: [ah-361, ah-361.1, ah-361.2, ah-361.3, ah-361.4, ah-361.5, ah-361.6, ah-361.7, ah-361.8, ah-361.9, ah-361.10, ah-361.11, ah-361.12, ah-361.13, ah-099, ah-lqu, ah-au4, ah-xp8, ah-6hc.5]
dev_graph_node_id: feat-auth-workspace
base_branch: dev
head_branch: devgraph/feat-auth-workspace
verdict: accepted-with-release-follow-up
```

## 2026-08-24 最終レビューの判定

本変更は**確定済みの製品要求を増減しない**。一方で、実装状態、データ境界、運用設計、派生タスク文書には影響があるため書き戻しが必要と判断した。

system-spec は `auth.web` を正規 writer で R4 `reopen` し、`system-spec/auth.md` の As-Is / Delta / 実装証跡を更新した後、要求判断を変えず同じ `qa-auth-web`、`serves_goals: [G1]`、`auth-model` で再確定した。`spec-state.json` の `reopen_log` が機械可読の受領履歴である。

### 反映先

| 層 | 反映内容 |
|---|---|
| `docs/` | auth release / final review、CI、診断保持、商品スナップショット、本受領書 |
| `features/` | `feat-auth-workspace` のローカル MVP 受入完了とリリース未検証の分離 |
| `specs/` | プロダクト要求の To-Be は維持し、2026-08-24 の実装投影を更新 |
| `system-spec/` | auth 確定章の古い `not_started` を `partial` とローカル検証証跡へ更新 |
| `architecture/` | Workspace / capability / tenant / request ID 監査の境界と正規 writeback 経路 |
| `tasks/` | Actions 使用量監視を現行 GitHub Billing API 契約と完了証跡へ更新 |
| Beads | auth P01〜P13 と関連タスクの最終レビュー、検証、PR を追記 |

### 要求変更が無い判断理由

- Better Auth、Google OAuth、Workspace role、tenant 分離、広告表示、監査、成果リンク、診断保持は既存 `docs/spec/01` と auth / security / database 章の To-Be に既に存在する。
- 今回追加したのは、それらを動く縦切りへ接続する application / persistence / presentation / scheduled job と検査である。
- Actions 使用量監視は製品機能ではなく CI 運用。GitHub の現行 API と照合したがプロダクト要求は変わらない。

### 未反映としたもの

- `system-spec/spec-state.json` top-level `implementation_snapshot` は writer に更新 action が無い。正本を直接編集せず Beads `ah-u5l` で追跡する。
- 本番 Google OAuth、dev / production D1 migration、複数ブランド選択 UI は未検証・未実装として残す。
- migration `0022` は既存 `disclosures` が 0 行であることを remote D1 で確認してから適用する（Beads `ah-6lf.7`）。

### 品質ゲート

- task package validator: digest `35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c`、13 phase すべて PASS。
- system-spec: matrix 48/48 判定済み、ヒアリング完全性 PASS、C13 公式出典 15/15 PASS。独立鮮度監査で検出した Vitest の古い日付は、公式 registry の現行版 `4.1.11` と公式 repository 履歴を正規 C02 フローで記録し直した。
- 構造ゲート: traceability / required test types / port wiring / `git diff --check` は PASS。
- テスト: 最終安定化 run は 279/279 ファイル、6,754/6,754 件 PASS。ホスト高負荷時の既定 run では a11y 2件が30秒 timeout したが、該当2ファイルの単独 242/242 件と低並列・手動 timeout 上限300秒の全体 run で再現せず、失敗 assertion は無い。
- coverage: 全体 Lines 91.78% / Branches 82.00% / Functions 89.72% / Statements 89.47%。層別も presentation の Lines 91.1% / Branches 80.4% / Functions 87.7% / Statements 89.7% を含め全層で設定下限以上。
- build / preview: `pnpm run build` と OpenNext worker build は PASS。`/admin` と `/admin/settings/compliance` は未ログイン時 `/signin` へ 307、`/signin` は 200。`MCP_TOKEN` 未設定の `/api/tools` は秘密値を表示せず登録手順を返して 503（fail-closed）。
- commit 後の `pnpm run verify` は typecheck / lint / tier audit / migration / acceptance / 6,749件回帰まで PASS。層別 coverage の不足を検出したため Server Action 5ケースを追加し、最終全体 6,754件と層別 coverage を PASS にした。変更21ファイル・1,710変異の mutation は初期2,281テスト PASS 後、推定1時間超のため MVP 方針で中断。coverage-report / traceability / required-test-types / port-wiring / spec-freshness / dependency audit は個別に PASS（脆弱性0）。

---

## 以前の受領書（2026-08-22）

```yaml
receipt_id: spec-writeback-2026-08-22-task-worktree-dedup
recorded_at: 2026-08-22T01:00:00Z
beads_ids: [ah-8h2]
dev_graph_node_id: task-worktree-dedup
parent_feature: feat-ui-foundation
related_features: [feat-improvement-feedback]
base_branch: dev
head_branch: devgraph/task-worktree-dedup
verdict: accepted-with-follow-up
```

## 判定

本変更は **製品要求の To-Be（確定セル）を変えない。** 変えたのは実装契約と、既存受け入れ条件の守り方である。

`docs/spec/12` の FB-AC-12 / FB-AC-13 は既に「技術情報を集める」「秘密を集めない」と定めている。今回は収集項目を増やさず、**保存する語彙を固定する**実装契約を `docs/architecture/feedback-loop.md` へ書いた。`docs/spec/12` 本文は指紋対象のため書き換えていない（現行 completeness-report の入力 hash を崩さない）。

UI の部品化（`InlineNav`、未使用 CSS 削除、押しどころ）は `docs/spec/09` / 共通 UI 要求の実装であり、新しい画面契約ではない。

担当者数の正本を membership へ移したことは、既存の Workspace 容量表示の実装修正であり、認証仕様の To-Be 変更ではない。

## 影響がある理由（実装契約・検査）

- 同格リンクを縦一覧の生クラスで横に並べていた役の食い違いを、部品として固定した
- 技術診断の生 URL / 例外 / 操作名が保存され、画像の黒塗り数と伏せ件数が混ざっていた
- 担当者数が workspace 見本の固定件数で、一覧と食い違っていた
- E2E の実ブラウザ入口が仕様表では「未着手」のままだった（`docs/spec/10` の該当行のみ更新。completeness-report はこの入力で再評価済み）

## 反映した正本と投影

| 関心 | 正本 | 投影 |
| --- | --- | --- |
| 共通 UI の部品 | `docs/architecture/ui-system.md` | `features/feat-ui-foundation.md` |
| 改善要望の診断 | `docs/spec/12` FB-AC-12/13（本文維持） | `docs/architecture/feedback-loop.md` §2-1 / `features/feat-improvement-feedback.md` |
| テストの置き場所 | `docs/spec/10`（E2E / 見た目の回帰の行） | `docs/architecture/testing-architecture.md` |
| 担当者の書き込み | `docs/product/first-owner-row.md` | `docs/product/setup-tasks.md` S-03A / `tasks/task-membership-write-repository.md` |
| 作業単位 | Beads `ah-8h2` | `tasks/task-worktree-dedup.md` |
| 二層アーキテクチャ | `architecture/arch-two-layer-platform.md`（To-Be 非変更、実装の現在地のみ） | — |
| 仕様完全性 | 確定章本文は非変更 | `system-spec/completeness-report.json`（FRESH / **FAIL**。旧 PASS は流用していない） |

## 確定章を書き換えなかった理由

`system-spec/*.md` と `docs/spec/*.md` は completeness の入力指紋である。確定章の To-Be を触ると、現行 FAIL レポートが STALE になり「いつの判定か」が消える。今回の差分は確定セルの要求判断を変えないため、実装契約（`docs/architecture/`）と feature / task へ投影した。C02 への再 import は evaluator PASS が前提なので行わない（`ah-8h2.2`）。

## 品質ゲート（MVP）

| ゲート | 結果 |
| --- | --- |
| `pnpm run verify --tier 1` | PASS。型検査・lint・段指定・マイグレーション・1 段テスト 166 ファイル / 3674 件 |
| spec inventory Python 契約 | PASS（2 件） |
| Playwright E2E / 全体ミューテーション | 本 PR では再実行しない（preview 起動と全体変異が重い。入口と見本は追加済み） |
| completeness evaluator 再 fork | 実施済みの FRESH/FAIL を採用。2 段の `spec-freshness` は FAIL レポートで赤になる。旧 PASS は流用しない。PASS 化は `ah-8h2.2` |

## 意図的にやらなかったこと

- `docs/spec/12` 本文の改稿（指紋維持。実装契約へ落とした）
- 確定 system-spec 章の To-Be 書き換えと C02 upsert
- `ah-au4`（成果リンクの商品スナップショット）と `ah-lqu`（診断の保持期限）の業務判断

## 残課題

- `ah-8h2.2`: 完全性評価を PASS へ戻す
- `ah-lqu`: 技術診断の保持期限と削除ジョブ
- `ah-au4`: affiliate_links の登録経路と商品スナップショット
- Playwright E2E は既定の `pnpm verify` に入れない（preview が重い）

---

## 以前の受領書（2026-08-16）

```yaml
receipt_id: spec-writeback-2026-08-16-task-spec-writeback

recorded_at: 2026-08-16T11:21:00Z
beads_ids: [ah-bvu, ah-bgp]
dev_graph_node_id: task-spec-writeback
parent_feature: feat-spec-canonicalization
base_branch: dev
head_branch: devgraph/task-spec-writeback
verdict: accepted-with-follow-up
```

## 判定

本変更は仕様・設計へ影響がある。アプリの実行コードは追加していない。影響範囲は正本の優先順位、Phase 0 文書の位置づけ、system-spec の As-Is、dev-graph と Beads の初期化である。正規フロー（docs/spec 正本 → system-spec 投影 → C02 upsert → Beads）で反映した。

## 影響がある理由

- `docs/spec/01`〜`03` が未登録のまま追加されており、Phase 0 の読者面契約と並立していた
- `origin/main` の Phase 1 で読者テーブルと公開ゲートが入り、`system-spec/database.md` の As-Is（運営者 3 テーブルのみ）が古くなっていた
- Analytics 詳細の正本が `03` であることと、読者面の正本が `ai-first-webmcp.md` であることを文書間で固定する必要があった

## 反映した正本と投影

| 関心 | 正本 | 投影 |
| --- | --- | --- |
| 優先順位と状態軸 | `docs/spec/00-README.md` | `docs/doc-spec-index.md` |
| 製品要求 | `docs/spec/01-要求仕様書-v1.0.md` | `specs/spec-product-requirements.md` |
| ギャップ・未決 | `docs/spec/02-補充仕様-ギャップと追加要件.md` | `specs/spec-gap-ledger.md` |
| Analytics | `docs/spec/03-分析・解析基盤仕様.md` | `specs/spec-analytics-foundation.md` |
| 読者面 | `docs/spec/ai-first-webmcp.md` | `specs/spec-reader-surface.md` |
| ドメイン分離 | 上記 + Phase 1 スキーマ | `architecture/arch-spec-governance.md` |
| 実装投影 | system-spec 各章 | `system-spec/index.md` / `database.md` / `spec-state.json` |

## 品質ゲート（MVP・機械層）

| ゲート | 結果 |
| --- | --- |
| validate-coverage-matrix.py --require-complete --require-foundation | PASS |
| validate-source-citation.py | PASS |
| validate-knowledge-graph.py knowledge / required-info / doctrine / cross | PASS |
| validate-graph-schema.py | PASS |
| task / specification / architecture 必須見出しと placeholder | PASS |
| assign-system-spec-completeness-evaluator の再 fork | 未実施。既存レポートは STALE のまま。後続 Beads で再評価する |

## 意図的にやらなかったこと

- アプリコード、スキーマ、公開ゲートの変更
- exact-13 の新規実装 package（仕様整理であり実装 feature ではない）
- completeness evaluator の独立 fork（MVP では機械層のみ）
- 公式サイトへの鮮度再照合

## 残課題

- `ah-7lo`: `system-spec/completeness-report.json` が STALE。入力 hash 付きで再評価する
- `ah-ez9`: 読者面と発信者面の接続境界は 02 §9 項 5 が open
- Auth / Workspace / 2 D1 / Redirect / Insight は未実装（本 PR の対象外）

---

# 仕様反映 受領書（2026-08-31・見本データと読者側の入口）

```yaml
receipt_id: spec-writeback-2026-08-31-task-seed-satisfies-public-entry
recorded_at: 2026-08-31T06:10:00Z
beads_ids: [ah-ghmb]
dev_graph_node_id: task-seed-satisfies-public-entry
base_branch: dev
head_branch: devgraph/task-seed-satisfies-public-entry
verdict: no-spec-impact
```

## 判定

本変更は **仕様・設計へ影響しない。** 確定済みの製品要求・画面契約・データ契約を
一切増減していない。`system-spec/` `specs/` `architecture/` は変更していない。

変えたのは **開発機に入れる見本データ**と、それを見張る回帰検査だけである。

## 影響が無いと判断した理由

| 変更 | 種類 | 判断根拠 |
|---|---|---|
| `site_blueprints` への `DELETE` + `INSERT` を追加 | 見本データの欠落補填 | 公開の条件は `resolvePublicSiteIdentity` が既に定めており、そこは変えていない。**条件を満たすデータを入れていなかった側**を直した |
| `SEED_SUB_SLUG` を `SECOND_SITE_SLUG` の import へ | 見本データの不整合修正 | 手書きの `gear-for-small-kitchen` は見本のどこにも存在しない URL 名だった。正本（`sampleSites()`）を指し直しただけ |
| `legal_page` の `DELETE` を id 接頭辞へ | 冪等性の修正 | 同じ行を 2 度当てても増えない、という既存の性質を保つための修正。表の定義は不変 |
| `seed-covers-cases.test.ts` の id 抽出を列名基準へ | 検査の誤報修正 | 「1 番目の値が id」の決め打ちが、列を足した日に別の値を id と誤認していた。判定の意味は不変 |
| 新規検査 3 本 | 回帰の固定 | 検査の追加は仕様を増やさない。既に正本にある条件を機械で確かめるだけ |

## 仕様側に反映したこと（文書のみ）

`README.md` のセットアップに `pnpm seed:local` と、読者側の公開が
**`site_blueprints` と `site_network_node` の組**で決まることの明記を足した。

これは要求の追加ではなく、**既にコードが要求していた条件を人が読める場所に書いた**ものである。
手順を飛ばすと `/s/` 以下が 404 になることが、いままでどこにも書かれていなかった。

## 品質ゲート

| ゲート | 結果 |
| --- | --- |
| `npx tsc --noEmit --incremental false` | PASS（出力なし） |
| `npx eslint`（対象 5 ファイル） | PASS（出力なし） |
| `npx vitest run tests/architecture` | PASS（69 files / 837 tests） |
| `npx vitest run`（全体） | PASS（434 files / 10101 tests） |
| `pytest test_compile_heading_demotion_real_data.py` | PASS（7 passed） |
| `upsert-node.py`（dev-graph node 登録） | PASS（revision 305 → 306） |
| `bd-bridge.py --op create` | PASS（ah-ghmb） |

## 意図的にやらなかったこと

- **網に載せるブログの本数を増やすこと。** 3〜5 本目（`first-camera` /
  `run-and-recover` / `mobile-plan-navi`）は設計図は在るが `site_network_node` に
  載っておらず 404 になる。これは `resolvePublicSiteIdentity` の定めどおりであり、
  本数を変えるのは仕様判断なので触っていない。
- `docs/product/test-traceability.md` の再生成分のコミット。生成物であり、
  他セッションの未コミットテストを大量に含むため、含めると docs が実在しない
  ファイルを指すことになる。

## 残課題

- 網に載せる本数を 2 本のままにするかの仕様判断 → **`ah-vctm`** で起票済み
  （`task-network-reach-decision`。`ah-ghmb` に依存）
- `docs/product/test-traceability.md` は本 PR のマージ結果で再生成済み（427 件）。
  他セッションの未コミットテストが出そろったら、そちらでもう一度生成し直す

---

# 仕様反映 受領書（2026-08-31・公開する本数を決める）

```yaml
receipt_id: spec-writeback-2026-08-31-task-network-reach-decision
graph_node_id: task-network-reach-decision
beads_ids: [ah-vctm]
verdict: no-spec-impact
decided_by: daishiman
decided_at: 2026-08-31
```

## 何を決めたか

**見本の 5 本すべてを読者側で公開する。** 中心（`home-office-desk`）は 1 本のまま、
残る 4 本をその下に並べる。

直前の受領書で「本数を変えるのは仕様判断なので触っていない」と書いた項目である。
**その判断をここで行い、結果を反映した。**

## なぜ 5 本か

| 論点 | 判断 |
| --- | --- |
| 見本 5 本は何のために在るか | `sampleSites()` の但し書きが「まだ 1 本も作っていない状態で読者側の画面が全部空になり、『作っていない』のか『壊れている』のかを見分けられなくなる」のを防ぐためと明記している |
| いまの 404 はその狙いに沿うか | **沿わない。** 3 本が 404 では、見分けが付かない状態を自分で作っている |
| 全部をハブにしてよいか | **だめ。** `SiteNetworkNode` の但し書きが「ハブが 1 つ、その下にサブサイト」と決めている。森にすると姉妹サイトの帯とパンくずが入口を決められない |
| 本数を数字で固定するか | **しない。** `seedNetwork()` を `sampleSites()` から作り、「網と設計図が 1 対 1」を検査で見張る |

## なぜ仕様への反映が要らないか

| 確かめたこと | 結果 |
| --- | --- |
| 公開条件そのものを変えたか | 変えていない。`resolvePublicSiteIdentity` は無改変で、満たす行を増やしただけ |
| ドメインの型・不変条件を変えたか | 変えていない。木が 1 つであることは維持し、むしろ検査で明示した |
| 読者側・管理側の画面仕様を変えたか | 変えていない。見本データの内容だけが変わる |
| 本番データへの影響 | 無い。`scripts/seed/` は開発機の D1 専用 |

確定済み仕様章（`system-spec/*.md`）への反映は不要と判断した。
変わったのは**見本データが何本のブログを持つか**であり、製品の決まりではない。
判断の記録は `tasks/task-network-reach-decision.md` の「決定」節と、
`seedNetwork()` の但し書きに置いた。

## 品質ゲート

| ゲート | 結果 |
| --- | --- |
| `tsc --noEmit` | PASS（本変更分にエラーなし。`src/app/layout.tsx` の `LayoutProps` は Next.js 生成型が未作成なための既存事象） |
| `vitest run tests/architecture` | PASS（71 files / **816** tests。前回 815 → 新検査 1 件） |
| `vitest run`（全体） | PASS（427 files / **10080** tests。前回 10079 → +1） |

## 変えたもの

| ファイル | 変更 |
| --- | --- |
| `scripts/seed/local-seed-data.ts` | `seedNetwork()` を `sampleSites()` からの生成に変更。名前と一行説明も設計図から借りる |
| `tests/architecture/seed-satisfies-public-entry.test.ts` | 「設計図を持つブログは 1 本残らず網にも載っている」を追加。親子関係の主張を強化 |
| `README.md` | 確認手順を 5 本すべてに。公開する本数とその理由を明記 |
| `tasks/task-network-reach-decision.md` | 「決定」節を追加。`status: draft → done` |

## 残課題

無し。`ah-ghmb` から引き継いだ残課題はこれで閉じた。

---

# 仕様反映 受領書（2026-08-31・ブログ UI ビルダーの開発環境リリース）

```yaml
receipt_id: spec-writeback-2026-08-31-feat-blog-ui-builder-p13
recorded_at: 2026-08-31T03:20:00Z
beads_ids: [ah-45ba, ah-45ba.13]
dev_graph_node_id: SYS-BLOG-UI-BUILDER-P13
parent_feature: feat-blog-ui-builder
base_branch: dev
head_branch: devgraph/SYS-BLOG-UI-BUILDER-P13
verdict: spec-impact-written-back
```

## 判定

本変更は**仕様・設計へ影響する。反映済みである。**

`feat-blog-ui-builder`（P01〜P12）の実装で確定した契約を、正本 `system-spec/spec-state.json` の
`chapter_notes` へ `set-chapter-note` で記録し、章 `.md` を `compile-spec-doc.py` で再生成した。
**章を直接編集していない。**確定済みセルの直接 Edit は `guard-confirmed-chapter-overwrite` が拒否する。
章は正本の純関数であり、正本に無い散文は compile のたび消えるためでもある。

## 反映した正本と投影

| 正本（`chapter_notes` の章） | 記録した内容 | 投影先 |
|---|---|---|
| `ui-ux` | 規則の 3 層（不変／契約／運用）、テンプレートの不変条件、配色 2 層の適用範囲、アクセシビリティの床、design token 制約、受入 4 件の保留 | `system-spec/ui-ux.md` |
| `frontend` | テーマ実装契約（2 層 + 単一読み取り口）、コンポーネント契約、SEO/AI 検索実装契約（JSON-LD / sitemap / IndexNow / guideline_references） | `system-spec/frontend.md` |
| `database` | 6 表のデータモデル、`workspace_id` を列として持つ理由、索引の 1 段目、行の不在で状態を表す設計、未解決の欠陥 3 件 | `system-spec/database.md` |
| `database`（本リリースで追加） | §4.1 の 🔴「migration が未コミット」を本 commit で解消した記録と、0040 の停止条件 | `system-spec/database.md` |

`infrastructure.md` / `maintenance-ops.md` は生成の副次差分（4 行）のみで、契約は増減していない。

## 方針を上書きせず差分として足した理由

書き戻しはすべて `## 章の注記 (chapter_notes)` という**別の節**へ入れてある。
上の「確定内容（質疑録）」は利用者の逐語であり、そこへ実装の都合を混ぜると
**利用者が言っていないことが利用者の声の顔で残る。**

方針と実装がずれた点も、ずれを消して片方だけを残さず並べてある。
上書きで消すと、なぜその形になったかが後から読めなくなる。

## 品質ゲート（MVP）

| ゲート | 結果 |
|---|---|
| `npx vitest run`（全体） | **PASS** — 434 files / 10101 tests |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | **PASS** — `"violations": []` |
| `pnpm run build` | 本リリース commit 前に実行 |
| `pnpm run preview`（Workers ランタイム） | PASS — 証跡 `docs/spec/feat-blog-ui-builder/evidence/13-preview-workers-runtime.txt` |
| 受入 A1〜A14 | 証跡 `docs/spec/feat-blog-ui-builder/evidence/` 配下、判定は同 `final-review.md` |

## 意図的にやらなかったこと

- **受入 A4（固定ページ 18 経路中 12 経路が 404）を本リリースで直すこと。**
  原因は `legal_page` を `SiteDocumentKey`（9 種）と `FixedPageKind`（8 種）の
  2 系統の語彙が触っていることで、語彙の統合は本 feature の scope の外にある。
  正本 `database` §4.2 に 🔴 として記録済みで、隠していない。
- **視覚回帰の見本の撮り直し（`pnpm run visual --accept`）。**
  差分の原因は本 feature が変えていない部品（`0ed9e2b` / `e97e5bc`、すでに main）である。
  撮り直しは「この変化は正しい」と宣言する取り消しにくい操作であり、
  **変えていない側の担当が署名するのは筋が通らない。**

## 残課題

- 🔴 `legal_page` の語彙 2 系統統合（受入 A4／正本 `database` §4.2）
- 🔴 公開記事の本文が HTML に出ていない（受入 A5 / A12／正本 `frontend` §4）
- ⚠️ 配色の保存と掲載の増減が操作の記録に届かない（正本 `database` §4.3）。
  **本番（`main`）へ進める前にこれを閉じること。**掲載の増減は金銭に直結する
- 🟡 受入 A3「sticky 常時表示」の受入文言が未定義
- 🟡 `guideline_references` の登録が 0 件（判定は動くが対象が無い）

---

# 仕様反映 受領書（2026-08-31・`dev` 取り込み時の設計判断）

```yaml
receipt_id: spec-writeback-2026-08-31-feat-blog-ui-builder-p13-dev-merge
recorded_at: 2026-08-31T03:40:00Z
beads_ids: [ah-45ba, ah-45ba.13]
dev_graph_node_id: SYS-BLOG-UI-BUILDER-P13
parent_feature: feat-blog-ui-builder
base_branch: dev
head_branch: devgraph/SYS-BLOG-UI-BUILDER-P13
pull_request: https://github.com/daishiman/affiliate-hub/pull/46
verdict: spec-impact-written-back
```

## 判定

`dev` の取り込みで**設計が動いた点が 3 つあり、うち 2 つを設計文書へ反映した。**
残り 1 つは正本 `spec-state.json` 側が既に `dev` の値を持っており、追加の書き戻しは不要である。

## 1. 掲載表の部分 UNIQUE 索引を戻した（設計の取り消し）

取り込みの途中で「掲載の一意制約は repository の DELETE→INSERT が守るから索引は要らない」と
いったん判断し、索引を落とした。**これは誤りで、取り消した。**

`blog-affiliate-placement-repository.ts` の `save` は `onConflictDoUpdate` で自然identityを指す。
SQLite は ON CONFLICT の対象に**一致する UNIQUE 制約が無いと INSERT ごと拒む**ので、
索引を落とすと保存が全部失敗する。型検査は通り、`d1-blog-affiliate-placement.test.ts` の
16 件が実行時に落ちてはじめて見えた。

`tracking_code` は NULL を取り、SQL では `NULL = NULL` が真にならない。索引を 1 本にすると
「コード無しの掲載」が何件でも作れてしまうので、`WHERE tracking_code IS NULL` と
`IS NOT NULL` の 2 本に分けている。索引を置く前に既存の重複を `max(rowid)` で
決定的に 1 件へ寄せる（寄せないと索引作成そのものが既存行で落ちる）。

反映先: `drizzle/0041_blog_appearance_workspace.sql`（意図をコメントで併記）、
`tests/integration/d1-migration-0041.test.ts`。

## 2. `legal_page.kind` の語彙移行を落とした（移行が要らなくなった）

旧 `0040` は `legal_page.kind` の値そのものを書き換える移行を持っていた。
`dev` が同じ問題へ別の解を先に出しており、`SITE_DOCUMENT_KIND_BY_KEY` が
**経路の鍵（`operator`）と保管上の名前（`profile`）を 1 か所で対応づける。**
保管されている値を書き換える必要がそもそも無くなったため、移行を落とした。
**移行を消して問題を隠したのではなく、問題の形が変わった。**

正本 `database` の 🔴「`legal_page` の語彙 2 系統統合」は、この対応表の導入で解の道筋が
定まった。対応そのものの検査は `tests/integration/d1-published-article.test.ts` が持つ。

反映先: `docs/spec/feat-blog-ops-crud/component-contract.md`（`SiteDocumentForm` の行）、
`docs/spec/feat-blog-ui-builder/component-contract.md`（§5 実装の割り当て）。

## 3. presentation 部品を `publish/` へ寄せた（置き場所の統一）

`dev` が管理画面の presentation モジュール約 49 個を
`src/presentation/admin/publish/` へ移していた。本 feature が新設した 6 つだけ
`admin/` 直下に残ると、同じ役割の部品が 2 か所に散る。`git mv` で寄せ、
契約表のファイル列を実在するパスへ更新した。

反映先: 上記 2 つの `component-contract.md`、`admin-screen-task-manifest.ts`。

## 4. 確定済み章の転記ずれ 7 件を R4-reopen で追随させた

**確定済み章 `system-spec/*.md` の転記節と出典表が、正本 `spec-state.json` /
`fetched-references.json` に追随していなかった（7 件）。**章の
`## 確定セルの記録 (正本 spec-state.json)` は**人が書く節**で compile が生成しないため、
`dev` が先に進めた値を正本は正しく持つのに、章だけが古いまま残っていた。

- `frontend` / `infrastructure` / `maintenance-ops` / `ui-ux` の `qa_ref`・`serves_goals`
  6 セル
- `ui-ux.md` の出典表 `apple-hig` の更新日: 章は `2026-08-27`（HTTP `Last-Modified` 由来）、
  `fetched-references.json` は `2026-06-08`（ページ自身の表明）。**後者のほうが根拠が強い**ので、
  章を `2026-06-08` へ寄せた。

いずれも `dev` 側に元からあった食い違いで、`chapter-confirmed-cell-transcript.test.ts` と
`doc-source-version-gap.test.ts` が本ブランチで**新しく検出した**ものである（前者は `dev` に存在しない）。

章の直接編集は `guard-confirmed-chapter-overwrite` が遮断する。**遮断を迂回していない。**
唯一の正規経路である **R4-reopen → `reaffirm: true` を名乗った再確定 →
`record-required-info-check`** を、`auth` / `frontend` / `infrastructure` /
`maintenance-ops` / `ui-ux` の web セルに対して踏んだ（`ui-ux` は 2 回）。
`reopen_log` に 6 件が残っている。
`matrix` の値は `required_info_checks` を除き**完全保存**であることを機械で確認した
（差分照合の結果: `checks 以外の差分: []`）。

**正直に書いておく副作用が 1 つある。** `confirm` は `required_info_checks` を
復元しないため、過去の計測日（08-24 / 08-25 / 08-30）が失われ、`record-required-info-check`
で数え直した 08-31 の 1 件だけが残った。**必須情報が満たされている事実は変わらないが、
いつ数えたかの履歴は消えている。**これは harness 側の欠落で、迂回して手で書き戻すことは
していない（正本の手編集は `guard-graph-schema` が遮断する対象でもある）。

加えて `ui-ux.md` / `auth.md` の散文にあった「出典が `user-dialogue` なのは本章だけ」という
記述が実態と反転していたので、実測に合わせて
「**web セル 8 件のうち 6 件が `user-dialogue`。書面由来は backend と security の 2 件だけ**」
「**2026-08-31 時点で少数派は書面由来のほうである**」へ書き換えた。
ブログ構築 UI 以降の確定が対話で積み上がった結果で、**穴は広がる向きに動いている。**

## 反映しなかったもの（理由つき）

無し。上記 4 で全件を追随させた。

## 品質ゲート（MVP）

| ゲート | 結果 |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `verify --tier 1` | **全門 OK**（333 files / 6445 passed） |
| `npx vitest run tests/ui/` | **PASS**（95 files / 3367 passed） |
| `npx vitest run`（全体） | **PASS**（452 files / 10297 passed、赤 0 件） |
| 変更したところのミューテーション | **PASS**（61.21% → **68.7%**、下限 65%） |
| 層別の記録（カバレッジ） | **PASS**（presentation 分岐 78% → **80.3%**、下限 80%） |
| `npx vitest run`（追加後） | **PASS**（457 files / 10447 passed、赤 0 件） |
| つなぎ目の呼び出し | **PASS**（届いていない 2 → **0**、判定できない 4 → **0**、上限はどちらも 0 のまま） |
| 受入 reconciliation | **PASS**（10 IDs / 205 evidence files） |
| テストと要件の対応 | **PASS**（由来不明 0、上限 2） |
| 要件ごとの必須テスト種別 | **PASS**（未宣言 5、上限 5） |

### ミューテーションの下限割れは仕様反映ではなくテスト不足だった

検査が全緑になったあとも CI の広い門は落ちていた。落としていたのは
`usecases/authoring/manage-blog-appearance.ts`（126 mutants）と
`review-blog-placements.ts`（131 mutants）が **coverage 0.00%** だったことである。
本 feature が足したユースケースに、テストが 1 本も当たっていなかった。

**これは仕様への影響ではない。**確定章にも `spec-state.json` にも触れていない。
ユースケースの振る舞いは既に確定章の記述どおりで、それを検査が確かめていなかった
だけである。よって R4-reopen は使わず、`tests/application/` へ 62 件を足した
（`manage-blog-appearance` 30 件で 88.10%、`review-blog-placements` 32 件で 72.52%）。

同じことが、その次の門（層別の記録）でも起きた。ミューテーションで止まって
いたので、それまで一度も実行されていなかった門である。presentation の分岐が
78%（下限 80%）で、穴は本 feature の server action 3 本（`blog-appearance-action` /
`blog-placement-action` / `blog-rating-form`、いずれも **0%**）と
`site-metadata.ts` の `blogArticleMetadata`（31%）に集中していた。
これも仕様への影響ではなくテスト不足なので、`tests/presentation/` と
`tests/ui/` へ 75 件を足して 80.3% にした。詳細はリリースレポート §D.2。

**赤は 1 件も残していない。**閾値を下げて緑にしたものも無い
（ミューテーションの下限 65% も動かしていない）。
床を動かした 4 か所（63→65 / 81→83 / 61→62 / 82→84）はいずれも**上げ**で、
manifest の実数に検査側の床が追いついていなかった分の修正である。

## 残課題

- 直前の受領書 `spec-writeback-2026-08-31-feat-blog-ui-builder-p13` の残課題はそのまま有効
- 🟡 `confirm` が `required_info_checks` を復元しない harness の欠落（上記 4 の副作用）。
  再確定のたびに計測日の履歴が消える。harness 側で直すべきもので、章や正本を手で
  書き戻して隠すべきものではない
- 🔴 リリースレポート §E の 2 件のうち、**前者（配色の保存と掲載の増減が操作の記録に
  届かない）は閉じた**（下記）。後者（公開記事の本文が HTML に出ていない）は手つかず
- 🟡 完全性の再評価（2026-08-31）が出した gaps 4 件。**いずれも総合 PASS を妨げない**
  - medium: `nextjs` の取得証跡が上流に追い越された（記録 16.3.3 / 現行 16.3.4）。
    層0 が逐語一致を返すので記録誤りではなく、宛先は C02 再取得
  - medium: `system-spec/maintenance-ops.md` の frontmatter `serves_goals: [G1]` が
    正本セル `[G1, G2]` より狭い。宛先は C03 compile だが、同章は compile が
    規範本文 366 行を消した実測が reopen_log にあるため frontmatter のみ手編集も選択肢
  - low: `system-spec/ui-ux.md` の接地根拠 2 件が `unrecorded` のまま
  - low: `decisions[]` 4 件が「`schema_version` を検査しない writer で書いた」と自己申告。
    宛先は harness 側

## 6. 書き込みが操作の記録に届かない状態を解消（§4.3 / リリースレポート §D.4）

「つなぎ目の呼び出し」（`node scripts/port-wiring.mjs`）が
**届いていない 2 件・判定できない 4 件**で赤だった。閾値を上げずに閉じた。

**判定できない 4 件は名前の側を直した。**`clear` を `WRITE_VERBS` へ、
`templateOf` / `themeOf` を `NON_WRITE_EXACT` へ足し、`selectTemplate` は
`saveTemplate` へ**改名した**。語彙表へ `select` を足せば黙らせられたが、
それをすると将来の読み取り手続きが黙って書き込み扱いになる（SQL の `SELECT` は読みの語）。

**届いていない 2 件は `audit_log` へ 1 行残すようにした。**
`createManageBlogAppearanceUseCase`（4 操作）と `createReviewBlogPlacementsUseCase`
（掲載の足し引き）から `deps.auditLog.append()` を同じファイルの中で呼ぶ。
語は `blog_appearance.changed` / `blog_placement.changed` / `blog_placement.removed` の 3 つ。

### これは仕様への影響である（テスト不足ではない）

上の 4・5 と違い、こちらは**確定章の記述そのものが現状と食い違う**。
`system-spec/database.md` §4.3 は「操作の記録に届いていない」と書いており、
それが解消された以上、正本を現状に一致させないと章が嘘になる。

`apply-spec-transition.py set-chapter-note` の正規経路で
`chapter_notes.database` へ「書き込みが操作の記録に届かない状態を解消 —
feat-blog-ui-builder リリース (P13、2026-08-31)」を足し、
`compile-spec-doc.py compile --only database.md --on-handwritten preserve` で章を作り直した。
**前の §4.3 の記録は消していない**（消すと「一度この状態で出そうとしていた」事実が引けなくなる）。
確定セルの reopen は要らなかった——matrix の値は 1 つも動いていないためである。

`guard-confirmed-chapter-overwrite` は迂回していない。

### 品質ゲート（2026-08-31 実測・§6 の変更後）

| ゲート | 結果 |
| --- | --- |
| `pnpm run typecheck` | PASS |
| `pnpm run lint` | PASS（既存 warning 2 件のみ。エラー 0） |
| `pnpm run test:coverage` | **PASS**（457 files / 10447 passed、赤 0 件） |
| `node scripts/port-wiring.mjs` | **PASS**（届いていない **0**／判定できない **0**。上限はどちらも 0） |
| `node scripts/coverage-report.mjs` | PASS（全層が下限を満たす。最も薄いのは presentation 分岐 80.3%／下限 80） |
| `node scripts/traceability.mjs` | PASS（由来不明 0／上限 2） |
| `node scripts/required-test-types.mjs` | PASS（未宣言 5／上限 5） |
| `node scripts/acceptance-reconciliation.mjs --write` | PASS（10 ID / 205 evidence file） |
| `MUTATION_BASE=origin/dev node scripts/mutation.mjs --changed` | **PASS。68.84%（下限 65%）** |

ミューテーションは前回 `--changed` を付け忘れて全体走査（226 files / 25,855 mutant）へ
落ちていた。`MUTATION_BASE` は `--changed` の分岐の中でしか読まれない。
環境変数ではなく引数で対象を宣言させる作りで、**意図しない全体走査が黙って走らない**側に倒してある。

倒した 1974 / 生き残った 737 / テストが無い 157 / 対象外 392（分母外）。
`テストが無い` は分母に入るので、テストの当たっていないコードを足すと必ずスコアが下がる。
カバレッジ門をすり抜けた穴をここが拾う。**閾値は 1 つも動かしていない。**

### 章の行数の天井を、余裕 15 行のまま置き直した

`tests/architecture/chapter-regeneration-floor.test.ts` が
「`database.md` の行数が 219 以上 528 以下」で赤くなった（実測 578 行）。

この門が守っているのは**床と余裕**であって天井の絶対値ではない。
設計意図に「増えるのは通す。減るところだけを止める」と明記があり、
この章はこれまで 2 回（470→485、513→528）同じ形で置き直している。
今回が 3 度目で、**床 219 も余裕 15 行も動かしていない**（578 + 15 = 593）。

増えた 50 行は §4.3 を「解消した」という追記で、痩せた結果ではない。
緩めたのか置き直したのかの見分けが後から付くよう、
**余裕そのものを広げた日が来たらそれは緩めたのだ**という判定基準を宣言のそばに書いた。

### 完全性レポートは近道を使わず正規に再評価した

`node scripts/spec-freshness.mjs` が `STALE` を返していた。

2026-08-30 の追記（上記）では「動いたのは機械が再生成した `evaluated_digest` 1 行だけ」
と逐一 digest で示したうえで `--write` の近道を使い、そのとき
**「仕様書の本文が動いたときは、この近道を使わず正規の再評価へ回すこと」**と条件を書き残した。

今回は `system-spec/database.md` の本文が動いている。近道の適用範囲外である。
ブランチ全体では仕様入力 33 件が動いており、前回の 81 入力に対し今回は 160 入力で、
指紋も `bddbe24e…` → `51bb3e1a…` と一致しない。**前回の PASS は再利用できない。**

そこで `assign-system-spec-completeness-evaluator` を fork で起動し、6 観点を再評価した。

| 観点 | 判定 | 担当 |
| --- | --- | --- |
| foundation_trace | PASS | C05 自己評価 |
| decision_guidance | PASS | C05 自己評価 |
| matrix_coverage | PASS | C07（primary）+ C06（sub_input） |
| design_knowledge_reflection | PASS | C05 自己評価 |
| doc_freshness | PASS | C08（primary） |
| prompt_quality | PASS | C05 自己評価 |

**総合 PASS・high finding 0 件。**独立監査 3 件はいずれも本 session の実 fork で、
台帳の pending 残 0（手による補正はしていない）。決定論ゲート 13 本すべて exit 0。
評価は read-only で、**仕様書本文への書き込みは 0 件**である。

そのうえで `--write` により指紋を焼き付けた。再判定は `FRESH` / `PASS`。

再評価が出した gaps 4 件（総合 PASS は妨げない）は下の残課題へ送った。

---

# 仕様反映 受領書（2026-09-02・公開が時間切れで畳まれた件の本質対処）

```yaml
receipt_id: spec-writeback-2026-09-02-deploy-timeout-guard
recorded_at: 2026-09-02T08:55:00Z
beads_ids: [ah-45ba, ah-45ba.13]
dev_graph_node_id: SYS-BLOG-UI-BUILDER-P13
parent_feature: feat-blog-ui-builder
base_branch: dev
head_branch: devgraph/SYS-BLOG-UI-BUILDER-P13
verdict: spec-impact-written-back
```

## 判定

本変更は**仕様・設計へ影響する。反映済みである。**

## 何が起きたか

PR #46 の `公開` ワークフローが **30 分 16 秒で `cancelled`** になった。
末尾は `Error: The operation was canceled.`、直前まではミューテーション検査が
2804 / 2869 まで進んでいた。つまり**検査の途中で job の持ち時間を使い切った**。

## 根本原因

1 つの job が、性質の違う 2 つの仕事を同じ 30 分で賄っていた。

| 仕事 | 繰り返せるか | 途中で止まってよいか | 時間の伸び方 |
| --- | --- | --- | --- |
| 検査（型・lint・テスト・ミューテーション） | 何度でも | 止まってよい | **変更の大きさで伸びる** |
| 公開（控え→D1 適用→デプロイ→動作確認） | 戻さないと繰り返せない | **止まってはいけない** | ほぼ一定 |

伸びる側と止まってはいけない側が同じ器に入っていたので、
**変更が大きい回ほど、止まってはいけない側が時間切れに近づく**。
今回はその一歩手前（適用の前）で切れたので実害は出ていない。

## 直したこと

### 1. 器を分けた（`.github/workflows/deploy.yml`）

| job | 持ち時間 | 中身 |
| --- | --- | --- |
| `inspect` | 45 分 | 検査だけ。`ci.yml` と同じ集合なので同じ 45 分 |
| `release` | 30 分 | 控え→適用→デプロイ→動作確認だけ。`needs: inspect` |

`environment: production`（人の承認）を `release` 側へ移した。
**人は検査が緑になったのを見てから押す。**
1 つの job だった頃は、押してから 30 分測ってその先で落ちることがあった。

### 2. 途中で止まったことが、次の回に分かるようにした

器を分けても、適用の最中に切れる可能性が消えるわけではない。
利用者が置いた条件は「控えが取れて、**かつ途中で止まったことが次の回に分かる**なら自動でよい」だった。

> 控えは「戻れる」ことしか言わない。
> 「戻るべきか」を判断するには、途中で止まったことが見えていなければならない。

そこで**上限を階層で置いた**。

- 適用ステップ `データの形を合わせる` に **step 上限 10 分**（job 上限 30 分より先に切れる）
- job 上限が発火するとステップは道半ばのまま run ごと畳まれて「どこで終わったか」が残らない
- step 上限で切れれば、**そのステップが `cancelled` として run に確定して残る**
- 次の run は `release` の先頭で前回の run を読み、`cancelled` か結論なしなら**自動で進まない**
  （`.github/scripts/require-previous-apply-complete.sh`・新規）

**うまくいった回には記録が残らないので、印を消す操作を誰にも要求しない。**
「置いて消す」印は、消し忘れがそのまま偽の停止になる。残らないものを印にした。

### 3. 印を D1 の表として持たなかった理由

「適用の直前に行を書き、終わったら消す」を D1 の表でやると、
その表が `db:drift` に **`extra` として出る**。
アプリのスキーマへ運用用の表を混ぜるか、余っている側の検査を緩めるかの二択になり、
後者は 0035 のトリガー消失を見えなくする。
GitHub の run 履歴はすでに残っているので、**増やすものが無い**。

### 4. 測れなかったときは止める側へ倒した

前回の run を読めない・公開の job が見当たらない・適用ステップの名前が見つからない。
いずれも「安全と確かめられなかった」であって「安全」ではない。**すべて fail で止める。**

権限（`actions: read`）を落とすと、この見張りは止まり続ける。
**権限の欠落が、公開の停止として目に見える。**

## 反映した正本と投影

| 種別 | ファイル | 内容 |
| --- | --- | --- |
| 正本 | `system-spec/spec-state.json` | `qa-infra-web-migration-guard-v2` / `qa-ops-web-migration-guard-v2` を追加（`design_applications` 付き）。両セルを R4-reopen → 手編集 → 再確定 |
| 章 | `system-spec/infrastructure.md` | 確定質疑を `-v2` へ。質疑録に 2 job 分割・45/30 分・step 上限 10 分・次回ガード・印を D1 に置かない理由・承認の位置を記録 |
| 章 | `system-spec/maintenance-ops.md` | 確定質疑を `-v2` へ。止められたときの 4 手順を記録。控えの空判定・30 日保管・`if-no-files-found: error` は**変えていない** |
| 設計 | `docs/spec/11-CI-CD・品質ゲート仕様.md` | §4-1 の原則を「戻る先がある」1 点から**2 点**へ。§4-1-3「途中で止まったことが、次の回に分かる」を新設 |
| 手引き | `docs/product/ci-cd-guide.md` | §6 に手順 0、10 分の意味、トラブル表 1 行、「途中で止まった回のあとに進めない」節 |
| 実装 | `.github/workflows/deploy.yml` | job 分割・持ち時間・`actions: read`・前回確認ステップ・step 上限 |
| 実装 | `.github/scripts/require-previous-apply-complete.sh` | 新規。前回 run の適用ステップの結論を読む |
| 設計 | `docs/architecture/testing-architecture.md` | ワークフロー図を 2 job 構成へ。器を分けた理由（速さではない）を追記 |
| 章 | `system-spec/backend.md` | 出典側の現行モデルが `claude-fable-5-1` へ動いたことに追随（1 行） |
| 出典 | `system-spec/fetched-references.json` ほか | `anthropic-claude`（`claude-fable-5-1`）と `nextjs`（16.3.3 → **16.3.4**）を再取得。`apple-hig` の証跡を更新 |

`nextjs` は独立監査（C08）が上流追い越しを指摘したものである。
公式 Docs の `Latest Version` と Vercel が発行する npm registry の `latest` が
**ともに 16.3.4** であることを実取得で突合した。**記録の誤りではなく、上流が動いていた。**
記録する `version` は**その出典が説明している対象の版**であって、このリポジトリの依存版ではない。

## 意図的にやらなかったこと

- **`${{ github.token }}` を使わなかった。** REQ-CI07 は「秘密は `secrets.` から来ること」で
  平文の直書きを見分けている。同義でも別の綴りを通し始めると、その見分けが鈍る。
  `${{ secrets.GITHUB_TOKEN }}` と書いた。**検査側は 1 文字も緩めていない。**
- **`system-spec/*.md` を compile で作り直さなかった。** 試したところ 43 行の
  接地根拠が落ち、行数の門も破った（472 > 天井 460）。
  **HEAD の章は HEAD 自身の `spec-state.json` から再現できない（293 行差）。**
  これは今回より前からある乖離で、この PR に混ぜると原因が見えなくなる。章は手編集で保った。
- **閾値を 1 つも下げていない。**

## 品質ゲート

| ゲート | 判定 |
| --- | --- |
| `npx vitest run tests/architecture/` | **PASS**（75 files / 872 passed、赤 0 件） |
| `bash -n .github/scripts/require-previous-apply-complete.sh` | PASS |
| `validate-coverage-matrix.py`（4 本すべて） | PASS |
| `validate-source-citation.py` / `validate-evidence-transcription.py` | PASS（exit 0） |
| 完全性評価（6 観点・独立監査 3 fork） | 下記 |

### 完全性評価は近道を使わず 2 度回した

入力指紋は `482dddb7…` → `a6afd8435d11e936…` へ移った（差分 5 件）。
**前回の判定は再利用していない。**監査 fork（C06 / C07 / C08）は本 run で起動し直し、
台帳の起動行（pending）と解決行（resolved）が `agent_id` 一致で畳み込めている。

| 観点 | 1 回目 | 是正後 | 担当 |
| --- | --- | --- | --- |
| foundation_trace | PASS | PASS | C05 |
| decision_guidance | PASS | PASS | C05 |
| matrix_coverage | PASS | PASS | C07（primary）+ C06（sub_input） |
| design_knowledge_reflection | **FAIL** | **PASS** | C05 |
| doc_freshness | **FAIL** | **PASS** | C08（primary） |
| prompt_quality | PASS | PASS | C05 |

**最終: 総合 PASS / high finding 0 件 / `spec-freshness` = FRESH**
（指紋 `40636e1e9455c8c9…`、160 入力。`resume-receipt.json` まで生成済み）。
評価は 3 度回した。1 度目 FAIL → 2 度目 PASS → 出典表 1 行の是正で STALE → 3 度目 PASS。
**近道（`--write` 単独）は 1 度も使っていない。**本文が動いた回に近道を使わないのは、
2026-08-30 の受領書で自分に課した条件である。

1 回目の FAIL は 2 つで、どちらもこの PR の中で解消した。

- `design_knowledge_reflection`: §4-1 の改訂が確定章へ届いていなかった。
  1 回目は該当語 0 件。転記後の再測定で、2 job 分割・45/30 分・`needs: inspect`・
  10 分 step 上限・`cancelled` の印・承認の移動が**具体適用として届いている**ことを実測。
- `doc_freshness`: `anthropic-claude`（解消済み）と `nextjs`（16.3.3 → 16.3.4、上記のとおり再取得）。

**決定論ゲートは 13 本すべて exit 0。**総合判定が割れたのは意味層だけである。
評価は read-only で、仕様書本文への書き込みは 0 件。

### 出典表の 1 行は、compile ではなく再オープン窓で揃えた

`nextjs` を 16.3.4 へ取り直したことで、`frontend.md` の「最新ドキュメント出典」表が
正本より古くなり、`doc-source-version-gap` が**赤になった**（`章=16.3.3 / 参照=16.3.4`）。

`compile-spec-doc.py --only frontend.md` で作り直すと直るが、**同時に 85 行が動いた。**
天井 546 行を破り（564 行）、節構成も変わる。これは今回より前からある章と正本の乖離を
1 つの PR で一気に吸収することになり、**時間切れ対策の変更が何だったか読めなくなる。**

そこで `frontend×web` を R4-reopen（理由: 出典表 1 行を現行 `fetched-references.json` へ
揃えるだけ、収集内容は変えない）してガードの窓を開け、**当該 1 行だけ**を書き換え、
同じ `qa_ref`（`qa-frontend-web-capture-self-occlusion`）で再確定した。
`restore-qa-refs` で裏付け質疑 8 件も戻っている。

**赤を消すために天井を上げる、という手は取っていない。**

## 残課題

1. **章と正本の乖離（既存・今回より前から）。** `system-spec/infrastructure.md` は
   HEAD の `spec-state.json` から再現できない（293 行差）。
   全章を対象にした再現性の一斉確認は、**未計測**（実行しようとしたコマンドが
   `rm -rf` を含み承認されなかったため。迂回はしていない）。
2. **`maintenance-ops.md` の frontmatter `serves_goals` が `[G1]`、正本は `[G1, G2]`。**
   8 章のうちこの 1 章だけ。決定論ゲートには映らない。
   直す経路は今回 `frontend.md` で実証できた（再オープン窓で 1 行だけ書き換える）。
   ただしこの章は**今日すでに `required_info_checks` を記録している**ため、
   もう一度再オープンすると `record-required-info-check` が同日同数を拒否して復元できない。
   **同じセルを 1 日に 2 度直せない**という制約で、日を改めれば閉じられる。
3. **各章の「カテゴリ別収集状態」表と「最新ドキュメント出典」表が、正本より古い。**
   確定質疑は `infrastructure` が `qa-infra-web-post-deploy-smoke`、
   `maintenance-ops` が `qa-ops-web-rollback` のまま（正本はいずれも `…-migration-guard-v2`）。
   出典表も `ui-ux` の `apple-hig` などが古い（`frontend` の `nextjs` は上記のとおり揃えた）。
   1 と同じ既存乖離で、どちらも compile が描くべき箇所である（Beads `ah-lwmf`）。
4. **`apply-spec-transition.py chunk` の `max_loops` が黙って切る。**
   既定 5 を超えた turn は**適用されないまま exit 0** になる。
   今回 6 turn を投げて 5 しか当たらず、`maintenance-ops` が `qa_refs` 無しで残った。
   `--max-loops 10` で回避したが、**切ったことが出力に現れない**のは危うい。
5. **入力インベントリの視野が狭い。** 走査範囲が `docs/spec` と `system-spec` の
   `.md` に限られており、次の 2 つが**指紋に一切寄与しない**。
   - `docs/product` 配下の利用者向け文書（今回は `docs/spec/11-…` と同時に動いたので気づけた）
   - `system-spec/fetched-references.json` と `retrieval-evidence/`（本 run の新規指摘）。
     **出典を取り直しただけの回は、受領書が「入力は変わっていない」と答えてしまう。**

   直すには `spec_input_inventory.py` と `scripts/spec-freshness.mjs` を**同時に**変える
   必要がある（テストが同一定義を縛っているため、片方だけ変えると指紋が食い違う）。
6. **ui-ux 章の接地根拠 2 件**（`qa-foundation-u1` / `qa-platform-scope`）が
   「設計解釈の記録経路: unrecorded」のまま。前回 run から未解消。
7. **`spec-state.json` の writer が `schema_version` を検査しない**旨の自己申告が 5 箇所。
   前回 run から未解消。
8. **`openai-platform` の鮮度が裏取りできなかった**（medium・1 件）。
   到達不能ではなく確認手段の限界による。上限 1 件以内なので単独では判定を左右しないが、
   次回へ持ち越すと未確認が積み上がる。
9. **`tests/integration/local-seed-idempotency.test.ts` に `TODO(human)` が残っている。**
   見本の記事本文を、画面が実際に使う口（`createD1PublicBlogPort`）から読み直して
   照合する部分である。**このファイルは本 PR に含めていない**（未完成のまま入れない）。
