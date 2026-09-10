# 品質報告（feat-blog-ops-crud / P09）

更新日: 2026-09-08  
execution status: **revalidated (2026-09-08)**

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`

**この文書は 2 つの計測回を持つ。**

| 回 | 位置 | 状態 |
|---|---|---|
| **2026-09-08**（現行） | [「## 0. 2026-09-08 の再計測」](#0-2026-09-08-の再計測) | P10 promotion の入力はこちら |
| 2026-08-26（履歴） | 本文 §1〜§10 | 監査履歴として保持。**判定には使わない** |

古い方を消していないのは、**数字が動いた事実そのものが証拠**だからである。
消すと「最初からこの数字だった」ように読める。

---

## 0. 2026-09-08 の再計測

計測日: 2026-09-08  
対象: 作業ツリー `ブログトップ画面変更`（HEAD = `875457f9` からの未コミット差分を含む）  
証跡: [`evidence/2026-09-08/`](./evidence/2026-09-08/)（8 ファイル）

| ゲート | コマンド | 結果 |
|---|---|---|
| 型検査 | `npx tsc --noEmit` | **エラー 0 件**（exit 0 / 無出力） |
| 静的解析 | `npx biome check src/ tests/ scripts/` | **指摘 0 件**（exit 0 / 無出力） |
| 回帰 | `npx vitest run` | **514 ファイル / 11392 件 すべて通過**、失敗 0（469 秒） |
| 読み上げ（A14 の 6 画面） | `npx vitest run tests/ui/blog-ops-a11y-floor.test.tsx` | **7 件通過 / 7**、重大違反 0 |
| **E2E（実ブラウザ）** | `npx playwright test` | **542 件通過 / 2 skip / 失敗 0**（2.8 分、exit 0） |
| 転用禁止（構造） | `node scripts/check-reference-site-reuse.mjs` | 検査 137 件、疑い 0（**名前で見る検査は依然として見送り**） |
| 計画妥当性 | `validate-system-plan.py --feature-package feature-package/feat-blog-ops-crud` | `"violations": []`（contract 1.3.0） |
| 要件対応 | `node scripts/traceability.mjs` | 507 ファイル / 由来不明 **2（上限 2）** |

### E2E を実際に走らせたこと — P06 が空けた欄をここで埋めた

[`test-run-report.md`](./test-run-report.md) の P06 では **e2e の欄を意図的に空けた**。
組み上げた成果物と起動した server を用意していなかったためで、前回の緑を書き写すのは
「走らせていないものを走らせたことにする」ことになる、というのがその理由だった。

**この回は実際に走らせた。** `playwright.config.ts` の `webServer` が
`pnpm test:e2e:prepare && pnpm preview` を起動し、ローカル D1 へ移行と見本データを
入れた上で desktop / mobile の 2 系統を通している。**空欄はこれで埋まった。**

### skip 2 件を「走っていない」と数えない理由

```
-  527 [mobile] › reference-blog-admin-ux.spec.ts:243 › 768pxと1600pxで…主要操作が欠けない
-  535 [mobile] › reference-blog-admin-ux.spec.ts:333 › 1280pxを200%で見た相当幅でも…
```

どちらも `test.skip(testInfo.project.name === "mobile", …)` による**意図的な二重実行回避**で、
同じ検査が desktop 側で通っている（ログの `✓ 267` と `✓ 271`）。
375px 幅の mobile プロジェクトで「768px と 1600px」を測り直しても同じ数字にしかならない。

**ただしこれは「skip は無害」という一般則ではない。** 上の 2 件が無害なのは
*同名の検査が別 project で緑になっていることをログで確かめた*からであって、
skip という表示だけでは何も分からない。次に skip が増えた日も、同じように
「どこで走ったか」を当て直すこと。

### 前回から動いた数字

| 項目 | 2026-08-26 | 2026-09-08 |
|---|---|---|
| 回帰ファイル | 288 | **514** |
| 回帰件数 | 7235 | **11392** |
| E2E | 364 | **542** |
| 転用禁止の検査対象 | 61 件 | **137 件**（+ 被覆の検査が新設） |
| 要件対応の母集団 | 288 | **507**（由来不明は 2 のまま） |

**由来不明が 2 のまま据え置かれている**のが要点である。母集団が 288 → 507 と
1.76 倍になっても上限を上げていない。上限を上げれば緑にはなるが、
上げられると分かった検査は次から必ず上げられる。

### この回も緩めた検査は 0 件

天井（`KNOWN_STALE_MAX` / `TEST_TYPES_MAX_*` / 由来不明の上限 / カバレッジ下限）を
上げた箇所は無い。P07 で新しい検査を 1 件足したとき
`tests/architecture/generated-doc-freshness.test.ts` が赤くなったが、
**`KNOWN_STALE_MAX` を上げずに `pnpm run generate` で生成物を作り直して緑にした**。
あの検査は自らの失敗文で「上げた時点で、この検査は何も見なくなります」と言っている。

### 依然として測っていないもの

§9「未計測」の 4 項目のうち **3 項目はこの回も未計測のまま**である。

| 項目 | この回の扱い |
|---|---|
| 実機（本番 Cloudflare Workers）での動作 | **未計測**。デプロイしていない（利用者の判断待ち） |
| Lighthouse / 実回線の表示速度 | **未計測**。ただし E2E 内の Core Web Vitals preflight は通っている（LCP ≤ 2500ms / CLS ≤ 0.1 / INP 上界 ≤ 200ms） |
| 転用禁止ゲートの「名前で見る検査」 | **未計測**。`.reference-ban.local` が無い環境では 2 段目が一度も照合されない（§6 のとおり） |
| 変異検査（Stryker） | **未計測**。task 仕様が要求していない |

### 条文の充足はここでは判定していない

**8 ゲート全緑は、受入 14 条文の充足を意味しない。**
1 件ずつ当て直した結果は [`acceptance-report.md` の「2026-09-08 の再確認」](./acceptance-report.md)
にあり、そこでは **A4 が実装未達**、**A12 は条文と機構が食い違っている**と記録している。
**A4 は検査を足しても緑にならない**（要求する符号 `AT-01..05` / `BP-01..06` が
`src/` にも `tests/` にも 1 件も無いため）。P10 の promotion 判定はこの 2 件を見て決めること。

---

## 以下は 2026-08-26 の記録（履歴。判定に使わない）

計測日: 2026-08-26
対象: 作業ツリー `ブラグ作成のCRUD`（HEAD = `4a1da54` からの未コミット差分を含む）

この文書は**実測値だけ**を載せる。測っていない項目は「未計測」と書き、
推定値で埋めない。埋めた瞬間に、この文書は測定の代わりに使われる。

全ログは [`evidence/`](./evidence/) に置いた。この文書の数字はそこから引いている。

---

## 1. 型検査

```
npx tsc --noEmit
```

**エラー 0 件。** → [`evidence/01-typecheck.txt`](./evidence/01-typecheck.txt)

**`vitest` は型を見ない。**この機能で足した `blog_delivery_snapshot` の
insert 一式は、テストが全部緑でも型が合っていない状態を作れる。
型検査を別に回すのは、緑と正しさを取り違えないため。

## 2. 静的解析

```
npx biome check src/ tests/ scripts/
```

**指摘 0 件。** → [`evidence/02-lint.txt`](./evidence/02-lint.txt)

## 3. 回帰（単体・結合・UI）

```
pnpm test
```

| | 件数 |
|---|---|
| テストファイル | **288 通過 / 288** |
| テスト | **7235 通過 / 7235** |
| 失敗 | **0** |

→ [`evidence/03-full-suite.txt`](./evidence/03-full-suite.txt)

この回で床（ハードコードされた期待値）を数え直したのは 5 か所ある。
**どれも緩めていない。**画面操作が 1 つ増えたぶんだけ、床を 1 つ上げた。

| 床 | 前 | 後 | 何を数えているか |
|---|---|---|---|
| `uiux-screen-single-purpose` 意味entry | 53 | 54 | 画面上の「意味のある操作」の総数 |
| 同 runtime entries | 54 | 55 | 実行時に配線されている操作 |
| 同 business-mutation | 42 | 43 | 状態を変える操作 |
| 同 edgeKey 集合 | 40 | 41 | 重複を除いた配線先 |
| `ci-config` migration 履歴 | 0025 まで | 0026 まで | 適用済みマイグレーションの並び |

増えた 1 件は `blog.check-delivery`（配信物の点検）である。
**保存 `blog.save-delivery-part` と別 entry にした。**同じ画面に居るが、
保存は「出す / 切る」の意思を書き、点検は「出せたか」の観測を積む。
1 件に畳むと、保存した人が自分で緑を作れてしまう。

## 4. 読み上げ（a11y）

```
npx vitest run tests/ui/blog-ops-a11y-floor.test.tsx
```

**7 件通過 / 7。重大（critical / serious）な違反 0 件。**
→ [`evidence/04-a11y-blog-ops.txt`](./evidence/04-a11y-blog-ops.txt)

受入 A14 が名指しした 6 画面を、名前で当てて axe-core にかけている。

| 画面 | 判定 |
|---|---|
| サイト網の一覧 | 重大 0 |
| トップ構成（帯） | 重大 0 |
| レイアウト（枠） | 重大 0 |
| 記事編集 | 重大 0 |
| 固定ページ | 重大 0 |
| 評価一覧 | 重大 0 |

7 件目は**画面そのものの検査ではない。**「条文の 6 つが総当たりの対象表から
落ちていないこと」を見ている。総当たりの a11y 検査は**消えたものを教えない** —
画面が減った日に、対象が 6 → 5 になっても総当たりは静かに緑のままになる。
名指しの床はそこを塞ぐためにある。

## 5. E2E（実ブラウザ）

```
npx playwright test
```

**364 件通過 / 364（4.3 分）。失敗 0 件。**
→ [`evidence/08-e2e.txt`](./evidence/08-e2e.txt)

内訳は 3 群。

| spec | 何を見ているか |
|---|---|
| `app-routes.spec.ts` | 宣言した全ルートが実際に 200 で返ること（床 87） |
| `blog-ops-crud.spec.ts` | 記事・固定ページ・タグ・枠の作成〜削除を画面から通す |
| `pending-hit-targets.spec.ts` | 「押せる大きさ」を宣言したリンクの**実寸**（mobile 実測、床 86） |

`pending-hit-targets` だけが**実寸**を測っている。CSS の宣言値を読む検査は
「宣言が正しいこと」しか言えず、継承や折り返しで実寸が縮んだ日に気づけない。

## 6. 転用禁止ゲート（独立再実行）

```
node scripts/check-reference-site-reuse.mjs
```

```
検査したファイル: 61 件
構造で見る検査: 実行
名前で見る検査: 見送り (.reference-ban.local がありません)

転用の疑いは 0 件です。
```

→ [`evidence/05-reference-reuse-gate.txt`](./evidence/05-reference-reuse-gate.txt)

**「名前で見る検査」が見送りになっている点は、緑として数えない。**
このゲートは 2 段ある。

1. **構造で見る検査**（実行済み）— 参考サイト由来の固有名・色値・テーマ名が
   仕様・コード・seed・docs に混ざっていないかを、リポジトリ内の規則だけで見る。
2. **名前で見る検査**（見送り）— 禁止語の実リストを `.reference-ban.local` から
   読む。このファイルは**リポジトリに入れない。**入れた瞬間に、
   禁止したかった固有名がリポジトリの中に文字列として残るからである。

つまり 2 段目は、手元に `.reference-ban.local` を置いた人だけが回せる。
**回していないので「通った」とは書かない。**1 段目が 0 件、というのが実測の全部である。

## 7. 計画妥当性（独立再実行）

```
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-blog-ops-crud
```

**`"violations": []`。** contract_version 1.3.0 / P01..P13 exact 13。
→ [`evidence/06-plan-validation.txt`](./evidence/06-plan-validation.txt)

## 8. テストと要件の対応

```
node scripts/traceability.mjs
```

```
テストファイル  288
由来が分かる    286
由来不明        2（上限 2）
OK 由来不明は上限以内です。
```

→ [`evidence/07-traceability.txt`](./evidence/07-traceability.txt)

この回で 4 件まで増えた由来不明を、**上限を上げずに** 2 件へ戻した。
新しく足した 2 つのテストのヘッダが受入 ID（`A5` / `A14`）を `@req` に書いており、
このスクリプトは**要件表に実在する ID しか拾わない**ためである。
`REQ-BLOG03` / `REQ-BLOG04` へ結び直し、受入 ID は本文の文章として残した。

上限を 4 へ上げれば緑にはなる。やっていない。上限はこの検査の唯一の歯止めで、
上げられると分かった検査は次から必ず上げられる。

---

## 9. 未計測

| 項目 | なぜ測っていないか |
|---|---|
| 実機（本番 Cloudflare Workers）での動作 | `pnpm run deploy:dev` を伴う。この回は push 禁止で、デプロイしていない |
| Lighthouse / 実回線の表示速度 | 本 feature の受入条文（A1〜A14）に速度の述語が無い |
| 転用禁止ゲートの「名前で見る検査」 | §6 のとおり。リストがリポジトリに無く、手元にしか置けない |
| 変異検査（Stryker） | 本 feature の task 仕様が要求していない |

## 10. まとめ

| ゲート | 結果 |
|---|---|
| 型検査 | 0 件 |
| 静的解析 | 0 件 |
| 回帰 7235 件 | 0 失敗 |
| a11y（A14 の 6 画面） | 重大 0 件 |
| E2E 364 件 | 0 失敗 |
| 転用禁止（構造） | 疑い 0 件 |
| 計画妥当性 | violations 0 件 |
| 要件対応 | 由来不明 2（上限 2） |

**この回で緩めた検査は無い。** 床は 5 か所とも「増えたぶんだけ上げた」。
