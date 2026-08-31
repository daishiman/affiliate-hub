# リリース記録（feat-blog-ui-builder / P13）

> **歴史 snapshot:** 以下は 2026-08-30 のP13記録で、当時のbuild/previewと未実施項目を保存する。
> 2026-08-31 の受入現在値は [`acceptance-report.md`](./acceptance-report.md#2026-08-31-現行判定a1a14-の唯一の正本) のみを参照する。
> 今回も利用者指示によりcommit/push/PR/deployは行わず、外部反映はコード品質判定から分離する。

- 実施日: 2026-08-30
- ブランチ: `daishiman/task-20`（基点 `235558d`）
- 前段: P12（[`ui-rules.md`](./ui-rules.md) / [`operations.md`](./operations.md)）

> **総合: 5 判定項目のうち 3 件を実施、2 件は未実施。**
> 未実施の 2 件（PR マージ・開発環境への反映）は
> **利用者の明示指示によりコミット・プッシュ・PR 作成を行っていない**ためである。
> できなかったのではなく、**行わないと決まっている**。

---

## 1. 判定項目の状態

| # | 判定項目 | 状態 | 根拠 |
| --- | --- | --- | --- |
| 1 | dev ブランチへの PR がマージされている | ⬜ 未実施 | §5。利用者指示により commit/push/PR を行わない |
| 2 | `pnpm run build` が成功する | 🟢 | §2.1（exit 0） |
| 3 | `pnpm run preview` でリリース前確認が完了する | 🟢 | §2.2 |
| 4 | `system-spec/frontend.md` に A10-A14 相当の実装確定内容が書き戻されている | 🟢 | §3 |
| 5 | `release-report.md` が存在する | 🟢 | 本ファイル |

---

## 2. リリース前確認

### 2.1 `pnpm run build` — exit 0

Next.js 16.3.1 + Turbopack のビルドが通り、ルート表が出力された。
本 feature が足したルートを含む。

```
ƒ /s/[site]/terms
ƒ /s/[site]/tokushoho
ƒ /s/[site]/tools/[tool]
ƒ /signin
ƒ Proxy (Middleware)
ƒ (Dynamic) server-rendered on demand
```

### 2.2 `pnpm run preview` — Workers ランタイム

`opennextjs-cloudflare preview --port 8790` で起動し、8 経路を実測した。
証跡: [`evidence/13-preview-workers-runtime.txt`](./evidence/13-preview-workers-runtime.txt)

```
/                                          200
/s/home-office-desk                        200
/s/home-office-desk/sitemap.xml            200
/s/home-office-desk/feed.xml               200
/s/home-office-desk/llms.txt               200
/s/home-office-desk/robots.txt             200
/indexnow.txt                              404
/admin                                     307
```

**SEO / AI 検索の機械向け出力 4 本が Workers ランタイム上でも組み立つ。**
`pnpm run build`（Node 上）で通ることと、Workers ランタイムで動くことは別である。
OpenNext は Node API の一部を使えないので、ここで初めて落ちる経路がありうる。

- `/indexnow.txt` の **404 は正しい**。`INDEXNOW_KEY` 未設定であり、
  §3.3 の契約どおり「鍵が無くても公開は通り、通知だけが飛ばない」が成立している
- `/admin` の **307 も正しい**。未ログインからのリダイレクトで、認証境界が効いている

> **ポートを既定（8787）から動かしている。**
> 同じマシンの他 worktree が 8787 / 8788 / 3000 を占有しており、
> 既定のまま起動すると他のセッションの作業を壊す。
> 本 worktree は dev=3001 / preview=8790 を使う。

---

## 3. system-spec への書き戻し

### 3.1 経路 — 章の直接編集ではなく正本への `set-chapter-note`

`system-spec/*.md` は正本 `spec-state.json` の**純関数**である。
章に直接書いた散文は compile のたびに消える。
実際、`system-spec/frontend.md` への直接 Edit は hook が遮断した。

```
[guard-confirmed-chapter-overwrite] BLOCKED: 確定済み仕様章 'system-spec/frontend.md'
への Edit を遮断 (再オープン経由でのみ変更可)。
```

**この遮断は編集を守るためではなく、消える場所に書かせないためである。**
守れない場所への書き込みを許すほうが危険である。

使った経路:

```bash
python3 .claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/apply-spec-transition.py \
  set-chapter-note --state system-spec/spec-state.json \
  --category <frontend|database|ui-ux> \
  --heading "実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)" \
  --body-file <本文> --reason <なぜ正本へ入れるか>
```

`--body-file` が必須なのは、引数へ直書きさせると写し間違いが正本に入るためである。
正本に入った誤字は全章へ伝播する。

**R4-reopen（確定セルの再オープン）は使っていない。**
本 phase の目的は「実装で確定した契約の記録」であって、
利用者の確定判断を覆すことではない。再オープンすると確定状態が崩れる。

### 3.2 compile — 追加 368 行・削除 0 行

```bash
python3 .../compile-spec-doc.py compile \
  --spec system-spec/spec-state.json --references system-spec/fetched-references.json \
  --out-dir system-spec --on-handwritten preserve \
  --only frontend.md --only database.md --only ui-ux.md
```

| ファイル | 差分 |
| --- | --- |
| `system-spec/frontend.md` | +141 |
| `system-spec/database.md` | +116 |
| `system-spec/ui-ux.md` | +89 |
| `system-spec/spec-state.json` | +22 |
| **合計** | **+368 / -0** |

初回は既定の `refuse` で中止した。
`## As-Is` `## To-Be` `## 意思決定` など**人が後から書いた 19 節**が
生成物に無いため、消える対象として報告された。
`--on-handwritten preserve` で引き継ぎ、**1 行も失っていない**。

> `preserve` は `##` 単位でしか効かない。生成節の内側（`###` 以下）の
> 手書きは原理上守れないので、そちらは正本へ移すしかない。

### 3.3 書き戻した内容

#### `system-spec/frontend.md`（A10〜A14 の実装確定契約）

| 節 | 確定した契約 |
| --- | --- |
| 1 テーマ実装 | 3 段解決 / 読む口は `publicBlogAppearance()` の 1 本 / 2 層が触るのは色と明暗だけ / dark を light の単純反転にしない |
| 2 コンポーネント | テンプレートは並び方だけを決め、記事の中身を知らない / 推奨順に無いブロックを 1 つも落とさない |
| 3.1 JSON-LD | 画面と機械向け出力は同じ読み取りモデル / `<` を `<` に逃がす / `dateModified` と `<time>` は同じ値 |
| 3.2 sitemap ほか | origin はリクエストの Host から / `llms.txt` は出さないなら 404（空ファイルにしない） |
| 3.3 IndexNow | 鍵は環境変数 `INDEXNOW_KEY` 1 本 / 鍵が無くても公開は通り通知だけ飛ばない |
| 3.4 guideline_references | 90 日判定は `referenceReviewStatus` だけ / 超過行を自動削除しない / 公開の条件にしない |
| 4 | 方針どおりにならなかった 2 点（固定ページ 2 系統・記事本文が空） |

**方針（質疑録）を書き換えず、差分として足してある。**
ずれを上書きで消すと、なぜその形になったかが読めなくなる。

#### `system-spec/database.md`（データモデル）

6 表の一意性・索引・`workspace_id` を列として持つ理由を記録した。

**`site_slug` から辿れば所有は分かるが、それでは足りない。**
経由の確認は書き手が正しく書いた場合しか効かない。
列は、誰が次の問い合わせを書いても外せない床になる。

未解決の欠陥 3 件（§4.1 migration 未コミット / §4.2 語彙 2 系統 / §4.3 記録に届かない書き込み）も併記した。

#### `system-spec/ui-ux.md`（UI/UX 契約）

規則の 3 層（不変・契約・運用）、テンプレートの不変条件、
配色 2 層の適用範囲、アクセシビリティの床、design token 制約、
受入で保留になった 4 件、視覚回帰の見本が古い件を記録した。

---

## 4. 🔴 出す前に直すもの

| # | 内容 | 影響 |
| --- | --- | --- |
| 1 | `drizzle/0040_serious_madelyne_pryor.sql` + `meta/0040_snapshot.json` + `meta/_journal.json` が未コミット | **本番 D1 に `workspace_id` 列が無いのにコードは列があるつもりで問い合わせ、配色の読み書きが実行時に落ちる** |
| 2 | 配色の保存・掲載の増減が操作の記録に届かない | 金銭に直結する変更を、いつ誰が何を消したか機械で追えない |
| 3 | 固定ページ 18 経路のうち 12 経路が 404 | 読者が信頼ページへ辿り着けない |
| 4 | 公開記事の本文が 1 文字も出ていない | JSON-LD の元になるブロックが載る場所が空 |
| 5 | **P13 の書き戻しと `source_lineage` が原理的に両立しない**（§4.1） | 書き戻すたび lineage が割れる。人の判断が要る |

1 は **`pnpm run verify` が赤いままになる直接原因**でもある。
検査は `git status --porcelain drizzle` を見るので、生成しただけでは緑にならない。

### 4.1 🔴 P13 の書き戻しと `source_lineage` が原理的に両立しない

**P13 を実行すると必ず 1 件テストが落ちる。** 実測:

```
tests/architecture/blog-ui-spec-governance.test.ts
  > pins the feature node lineage to the bytes of its source chapter
AssertionError: expected 'e95019…' to be 'b67e9b…'
```

- `features/feat-blog-ui-builder.md` の `source_lineage.source_digest` は
  `system-spec/ui-ux.md` の**バイト列**に固定されている
- P13 の仕事はその `ui-ux.md` へ実装確定を書き戻すことである

**書き戻せば必ず digest が変わる。** 手順と検査が同じ章を挟んで正面から対立している。

#### これは本 feature 固有ではない

4 feature の `source_lineage` を実測した。

| feature | 参照する章 | 宣言 | 本作業前（HEAD） | 現在 |
| --- | --- | --- | --- | --- |
| `feat-blog-ui-builder` | `system-spec/ui-ux.md` | `e95019…` | `e95019…` **一致** | `b67e9b…` ずれ |
| `feat-blog-ops-crud` | `system-spec/frontend.md` | `7b0291…` | `708427…` **ずれ** | `9044686…` ずれ |
| `feat-uiux-overhaul` | `system-spec/ui-ux.md` | `5cab94…` | `e95019…` **ずれ** | `b67e9b…` ずれ |
| `feat-spec-canonicalization` | `system-spec/index.md` | `409add…` | `d3be72…` **ずれ** | `d3be72…` ずれ |

**本作業を始める前から 4 件中 3 件が割れていた。**
`feat-blog-ops-crud` は P13 を実行済みで、そのとき同じことが起きている。
`feat-spec-canonicalization` に至っては**章が 1 バイトも変わっていないのに宣言とずれている。**

割れていることに誰も気付かなかったのは、
**この検査が `feat-blog-ui-builder` にしか存在しないため**である。
唯一検査のある feature が唯一一致していた、というだけの話だった。

#### digest を書き換えて緑にしていない

`source_lineage` は `imported_at` と `origin_kind: "generated"` を伴う。
**「この feature node がどの版の章から生成されたか」の記録である。**

本作業の書き戻しは feature node の生成（2026-08-24）より**後**の出来事なので、
digest を現在値へ更新すると「2026-08-30 版の章から生成された」と読める。
**それは事実に反する。**

緑にする道はいずれも「lineage の意味を読み替える」ことを伴い、
（生成元の記録 → 最後に追従した版の記録）
これは実装側が単独で決められる範囲を超える。**赤のまま残す。**

#### 判断が要ること（利用者へ）

1. `source_lineage` は「生成元」か「追従済みの版」か。
   後者にするなら P13 の手順へ digest 更新を組み込む
2. この検査を残り 3 feature へ広げるか。
   広げれば既存の 3 件が即座に赤くなる（**それは本当のことを言っている**）

---

## 5. 未実施と、その理由

### 5.1 PR 作成・マージ・デプロイ

**利用者から「まだコミット・プッシュ・PR 作成をしない」との明示指示があり、
本 phase ではいずれも行っていない。**

行うときの手順は次のとおりである（AGENTS.md「枝の順番」）。

```bash
gh pr create --base dev   # 宛先は既定で dev。main へ直接出さない
# マージ後
pnpm run deploy:dev       # opennextjs-cloudflare deploy -- --env dev
```

**PR の宛先を `main` にしてはならない。** `branch-flow.yml` が落とす。

**ただし §4 の 4 件が未処理のまま出すべきではない。**
特に 1 を入れずにデプロイすると、開発環境で配色機能が実行時に落ちる。

### 5.2 `pnpm run verify` の 17 門

本 phase では通していない。2026-08-30 時点で 4 門が赤い。
内訳と直し方は [`evidence/README.md`](./evidence/README.md) §4.1。

---

## 6. 変更ファイル（94 件）

| 区分 | 件数 | 主なもの |
| --- | --- | --- |
| `system-spec/` | 4 | `frontend.md` `database.md` `ui-ux.md` `spec-state.json` |
| `docs/spec/feat-blog-ui-builder/` | 14 | 本 feature の成果物一式 |
| `src/` 追加 | 13 | 配色・掲載のポート／ユースケース／永続層／画面 |
| `src/` 変更 | 14 | SEO ルート・記事表示・テンプレート |
| `tests/` | 多数 | 受入 6 ファイル・結合 2 ファイルほか |
| `drizzle/` | 3 | **0040（未コミット・§4 の 1）** |

### 本 feature に属さない残置

参照が 0 件だった計測用一時ファイル `measure-tmp.mjs` / `measure2-tmp.mjs` は、
2026-08-31 の最終整合確認で削除した。アプリと検査からの参照が無いことを `rg` で確認済み。

---

## 7. 検証

| 検査 | 結果 |
| --- | --- |
| `pnpm run build` | 🟢 exit 0 |
| `pnpm run preview -- --port 8790` | 🟢 起動確認 |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | 🟢 `"violations": []` |
| compile の消失行 | 🟢 0 行 |
| `npx tsc --noEmit` | 🟢 0 件 |
| `npx biome check .` | 🟢 0 件 |
| `pnpm test` | 🟡 **1 failed / 10022 passed**（§4.1 の lineage 1 件のみ） |

### 7.1 書き戻しが割った検査と、その扱い

書き戻し（+368 行）は 2 つの検査に触れた。**扱いを分けている。**

| 検査 | 扱い | 理由 |
| --- | --- | --- |
| `chapter-regeneration-floor.test.ts`（章の膨張） | 🟢 **天井を置き直して緑にした** | この検査は増加を通す設計で、天井は「余裕の量を変えずに平行移動する」先例が確立している |
| `blog-ui-spec-governance.test.ts`（lineage） | 🔴 **赤のまま残した** | 緑にするには lineage の意味の読み替えが要る（§4.1） |

床の検査は 3 章とも天井に当たった。先例（`backend` 2026-08-26 /
`frontend` 2026-08-25 / `ui-ux` 2026-08-23・08-25）に倣い、
**床は 1 つも動かさず、各章がその時点で持っていた余裕を増えた本文の上へ置き直した。**

```
frontend  ceiling 378 → 518   (496 + 余裕 22)
database  既定 369  → 485   (470 + 余裕 15)  ※初めての明示
ui-ux     ceiling 612 → 700   (678 + 余裕 22)
```

**余裕の量は 1 行も増やしていない。** 床を上げれば既定の天井（床 + 150）も一緒に
上がって余裕が広がるので、床は動かさない。

`ui-ux` は 3 度目の当たりで、**検査自身がコメントで
「3 度目にここへ来たら、天井を動かす前に『この章だけが何を増やし続けているのか』を
先に見ること」と宿題を残していた。** その場で答えを書いた（今回は 3 章同時に
当たっており「この章だけ」ではない。ただし `章の注記` が 2 度続けて主因である旨）。
