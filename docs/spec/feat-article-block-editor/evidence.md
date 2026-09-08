# 証跡と再現コマンド (P11)

- feature: `feat-article-block-editor`
- phase: P11

## 1. 一括再現

```bash
pnpm run typecheck    # next typegen && tsc --noEmit
pnpm test             # vitest run (全量)
```

## 2. 受入ごとの再現コマンド

| 受入 | コマンド | 見るもの |
| --- | --- | --- |
| A1 | `npx vitest run tests/ui/prose-editor.test.tsx` | 「プログラムの欄は装飾を通さない」「比較表は列と行を足せ」 |
| A2 | `npx vitest run tests/ui/prose-editor.test.tsx tests/ui/prose-body.test.tsx` | 「選べるのは 3 と 4 だけ」「上下に動かしても深さは持ち回る」「あいだの断片を消しても深さは変わらない」「見出しは段の深さを保って出る」 |
| A3 | `npx vitest run tests/domain/blogops/prose-format.test.ts tests/ui/prose-editor.test.tsx` | 「19 種すべてが出る」+ 19 種の往復 |
| A4 | `grep -rn 'placeholder="pc_' src/` → 出力なし<br>`npx vitest run tests/ui/prose-editor.test.tsx` | 「探して選ぶと、本文には id だけが乗る」「探せない画面では、id を打つ欄を出さずに挿せないと言う」 |
| A5 | `npx vitest run tests/domain/blogops/article-image-policy.test.ts tests/ui/prose-editor.test.tsx` | 「ファイルを選ぶと、返ってきた場所が本文に乗る」「送れない画面では、URL を打つ欄を出さずに挿せないと言う」 |
| A6 | `npx vitest run tests/domain/blogops/prose-allowlist.test.ts tests/domain/blogops/prose-inline.test.ts` | 許可外が出力されない |
| A7 | `npx vitest run tests/domain/blogops/prose-format.test.ts` | 往復不変性 |

## 3. 非機能・構造の再現

```bash
npx vitest run tests/architecture/tenant-scoped-schema.test.ts
npx vitest run tests/architecture/dependency-direction.test.ts
npx vitest run tests/architecture/open-doors.test.ts
npx vitest run tests/architecture/ci-config.test.ts
npx vitest run tests/architecture/quality-gates.test.ts
npx vitest run tests/architecture/worker-entry-weight.test.ts
npx vitest run tests/infrastructure/scheduled-maintenance.test.ts
```

公開する口の台帳を作り直すとき:

```bash
UPDATE_OPEN_DOORS=1 npx vitest run tests/architecture/open-doors.test.ts
```

## 4. 実測値 (2026-09-06)

| 対象 | 結果 |
| --- | --- |
| 全量 | 506 files / 11309 tests。9 files・47 tests 失敗 |
| `tests/ui` + `tests/domain` | 175 files / 5233 tests **全通過** |
| `tests/application` `infrastructure` `presentation` `integration` `property` `acceptance` | 252 files / 5085 tests **全通過** |
| `tsc --noEmit` | 1 件 (`LayoutProps`。`next typegen` 前のため。既存事象) |

失敗 9 files の内訳と、それが本 feature 由来でないことの根拠は
[`test-run.md` §4](./test-run.md)。

## 5. 本 feature が触ったファイル

### 新規

| ファイル | 役割 |
| --- | --- |
| `src/domain/blogops/article-image-policy.ts` | 受け入れ規則・鍵の組み立て・回収の判断 |
| `src/infrastructure/persistence/d1/article-image-repository.ts` | 台帳の読み書き |
| `src/infrastructure/platform/article-image-r2.ts` | R2 の出し入れ |
| `src/infrastructure/platform/article-image-reclaim.ts` | 日次回収 |
| `src/app/api/article-images/route.ts` | 画像を預かる口 |
| `src/app/api/article-images/[image]/route.ts` | 画像を返す口 |
| `src/app/api/article-products/route.ts` | 商品を探す口 |
| `src/presentation/admin/publish/article-asset-client.ts` | ブラウザ側の呼び出し |
| `drizzle/0047_article_image.sql` | 台帳テーブル |
| `drizzle/0048_article_image_sweep_index.sql` | 回収索引の張り直し |
| `tests/domain/blogops/article-image-policy.test.ts` | 上記規則の検証 (9 件) |

### 変更

| ファイル | 変更点 |
| --- | --- |
| `src/domain/blogops/prose-node.ts` | 19 種へ拡張 |
| `src/domain/blogops/prose-format.ts` | 追加 9 種の記法 |
| `src/domain/blogops/prose-allowlist.ts` | 許可リスト |
| `src/domain/blogops/index.ts` | 画像規則の公開 |
| `src/presentation/prose/*` | WYSIWYG 化・`/` メニュー・検索選択・アップロード |
| `src/presentation/admin/publish/blog-article-form.tsx` | エディターへの配線 |
| `src/db/schema.ts` | `articleImages` 追加 |
| `src/infrastructure/platform/bucket-connection.ts` | `tryGetArticleImageBucket()` |
| `src/infrastructure/platform/scheduled-maintenance.ts` | 8 本目の仕事 |

### 台帳 (検査を実態へ合わせた分)

| ファイル | 追加 |
| --- | --- |
| `tests/architecture/tenant-scoped-schema.test.ts` | `QUERY_EXEMPT` ×5 |
| `tests/architecture/dependency-direction.test.ts` | `FETCH_EXEMPT` ×1 |
| `tests/architecture/ci-config.test.ts` | 適用済み ×2 |
| `tests/architecture/open-doors.test.ts` | `ROUTE_INTENT` ×3 + 台帳再生成 |
| `quality-gates.config.mjs` | 公開上限 42→43 (理由つき) |
| `tests/infrastructure/scheduled-maintenance.test.ts` | 8 本目の独立性検証 |
