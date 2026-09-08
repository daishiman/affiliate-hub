# 品質報告（feat-blog-ops-crud / P09）

更新日: 2026-08-27  
execution status: **revalidation_pending**

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`

以下の実測は 2026-08-26 の historical snapshot。現行 worktree の P08 統合後に再実行するまで P10 promotion の入力に使用しない。

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
