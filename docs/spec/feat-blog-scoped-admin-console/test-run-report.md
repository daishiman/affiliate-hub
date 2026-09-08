# テスト実行の記録 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P06 の成果物。2026-09-04 実測。

## 実行環境

- vitest 4.1.10
- projects: `normal` / `a11y` / `worker-runtime`

## normal

```bash
npx vitest run --project normal \
  tests/ui/app-shell-nav.test.tsx \
  tests/ui/uiux-screen-single-purpose.test.ts \
  tests/ui/uiux-spacing-and-copy.test.ts \
  tests/ui/blog-ops-console-forms.test.tsx
```

```
Test Files  4 passed (4)
     Tests  325 passed (325)
  Duration  2.84s
```

| ファイル | 件数 |
|---|---|
| `app-shell-nav.test.tsx` | 10 |
| `uiux-screen-single-purpose.test.ts` | 99 |
| `uiux-spacing-and-copy.test.ts` | 203 |
| `blog-ops-console-forms.test.tsx` | 13 |
| **計** | **325** |

## a11y

```bash
npx vitest run --project a11y \
  tests/ui/blog-metrics-pages.test.tsx \
  tests/ui/blog-ops-a11y-floor.test.tsx
```

```
Test Files  2 passed (2)
     Tests  25 passed (25)
  Duration  8.60s
```

| ファイル | 件数 |
|---|---|
| `blog-metrics-pages.test.tsx` | 18 |
| `blog-ops-a11y-floor.test.tsx` | 7 |
| **計** | **25** |

## 合計

**350 件、全部通過。**

## `--project` を必ず書く理由

同じ 6 ファイルを両方の project に渡して実測した結果:

| ファイル | normal | a11y |
|---|---|---|
| `app-shell-nav.test.tsx` | 10 | **0** |
| `uiux-screen-single-purpose.test.ts` | 99 | **0** |
| `uiux-spacing-and-copy.test.ts` | 203 | **0** |
| `blog-ops-console-forms.test.tsx` | 13 | **0** |
| `blog-metrics-pages.test.tsx` | **0** | 18 |
| `blog-ops-a11y-floor.test.tsx` | **0** | 7 |

**0 件でも exit 0 になる。**

include に無いファイルは静かに無視され、
「Test Files 0 passed」で正常終了する。

`tests/ui/` の下という見た目では判断できない。
`blog-metrics-pages` と `app-shell-nav` は同じディレクトリで、
project が逆である。

### 実際に起きたこと

最初の実行で 5 ファイルを `--project normal` に渡し、
「Test Files 4 passed」が返った。

**5 つ渡して 4 つしか走っていない。**

件数（325）は緑なので、
出力の `4 passed` を見落とせば
「5 ファイル全部通った」と読める。

渡したファイル数と `Test Files` の数を突き合わせて気付いた。

### 対処

この文書に**project ごとの件数を分けて書く**。

合計だけを書くと、次に同じ間違いをしたとき
差が出ない（325 のままになる）。

## 8.60s と 2.84s の差

a11y は 25 件で 8.60s、normal は 325 件で 2.84s。

a11y は実際に DOM を描いて
読み上げの木を組み立てるため、1 件が重い。

**遅いことは問題ではない。**

これを normal に混ぜると、
normal 全体が a11y の速度に引きずられる。
project が分かれている理由がここにある。

## 落ちたケース

**無し。**

実装は既に入っており、
この feature は台帳・文書の整備が本体。

## 走らせていないもの

| 何 | 理由 |
|---|---|
| `worker-runtime` | この feature は D1 を触らない |
| ブラウザでの実描画 | `test-plan.md` の範囲外 |
| 画面の手動確認 | 別途 localhost で実施 |
