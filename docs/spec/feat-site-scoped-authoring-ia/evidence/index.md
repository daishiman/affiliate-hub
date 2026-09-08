# 証跡（feat-site-scoped-authoring-ia / P11）

- machine index: [`index.json`](./index.json)
- 集約日: 2026-09-08
- 対象 phase: P06（テスト全量）/ P07（受入判定）/ P08（旧実装の一本化）/ P09（品質検査）/ P10（通しレビュー）

## 1. ここに何が置いてあるか

**判定の文書**（`../*-report.md`）と、**その判定を出した実行の出力**（このディレクトリの `*.raw.*`）を
分けて持っている。片方だけでは足りない。

| | 置き場 | 持っているもの |
|---|---|---|
| 判定 | `../acceptance-report.md` ほか | A1–A10 の PASS/FAIL と、その理由 |
| 生証跡 | このディレクトリの `*.raw.txt` | build の route 表、preview の実応答、vitest の実出力 |

判定だけを置くと、「PASS と書いてあるが、本当に実行したのか」を誰も確かめられない。
生証跡だけを置くと、その出力が**どの受入条件のどこを支えているのか**が読めない。
`index.json` の各 entry が `requirements`（A番号）と `phases`（P番号）を持つのはそのためで、
生の出力から受入条文へ戻る線をここで張っている。

## 2. ファイル一覧

| ファイル | 内容 | これが支える受入 |
|---|---|---|
| [`build-route-table.raw.txt`](./build-route-table.raw.txt) | `pnpm run build` が出した route 表。新設 6 route が実際に配られることの証跡 | A1 |
| [`preview-route-responses.raw.txt`](./preview-route-responses.raw.txt) | `pnpm run preview` 上で 13 route を叩いた HTTP status / Location / 応答時間 | A1, A2, A3, A4 |
| [`vitest-full.raw.txt`](./vitest-full.raw.txt) | `npx vitest run` の全量実行結果（末尾要約と失敗ファイル名） | A2–A5, A7–A10 |
| [`verify-index.raw.txt`](./verify-index.raw.txt) | `verify_evidence_index.py` を本 index に当てた出力（§4 参照） | — |

`index.json` の entry は **9 件**で、判定の文書 5 件（P06–P10 の各 report）と
生証跡 3 件、対応表 `redirect-map-draft.json` 1 件からなる。

`verify-index.raw.txt` **だけは entry に入れていない。**
これは index 自身を検算した出力なので、entry にすると
「index を更新 → digest が変わる → 検算出力が古くなる → index を更新」と
自分で自分を古くし続ける輪になる。検算の出力は index の外に置く。

## 3. 再現手順（第三者が同じ結論に至るための最短経路）

```bash
# 1. 型と静的検査
pnpm run typecheck            # 出力なし = エラー 0
pnpm run lint                 # 出力なし = 指摘 0

# 2. テスト全量
npx vitest run                # 530 files / 527 pass / 3 fail（失敗は §5 の既存分）

# 3. 本 feature の 4 スイートだけ（回帰の有無を見るならここ）
npx vitest run tests/ui tests/presentation tests/acceptance tests/application

# 4. 実物
pnpm run build                # exit 0。route 表に新設 6 route が載る
pnpm run preview              # Ready on http://localhost:8787

# 5. 計画の決定論検証
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-site-scoped-authoring-ia
```

**ログイン後の画面を見る場合**（P07 の live 確認）:

```
pnpm dev                                  # http://localhost:3000
http://localhost:3000/signin
  → 「owner@local.test として入る」を押す（合言葉なし。DEV_SIGNIN_ENABLED=1 のときだけ出る）
```

## 4. `verify_evidence_index.py` を当てたときの注意

digest の検算には `scripts/reference-site-analysis/verify_evidence_index.py` を使える。
ただしこの script は **`feat-reference-blog-admin-ux` 専用の期待値を定数で持っている**。

```python
EXPECTED_REQUIREMENTS = {f"A{number}" for number in range(1, 13)}   # A1..A12
EXPECTED_PHASES = {"P01", "P06", "P07", "P09", "P10"}
```

本 feature の受入は A1–A10、phase は P06–P10 なので、この script を当てると
`missing` に `requirement:A11` / `requirement:A12` / `phase:P01` が並ぶ。
**これは本 index の欠落ではなく、script が feature 横断になっていないことの現れ**である。

したがってここで意味があるのは `stale` / `duplicates` / `invalid` の 3 つで、
そこが空であれば **各 entry の sha256 が現物と一致している**と言える。
`missing` の 3 件は上記の理由で読み替える。`verify-index.raw.txt` に生の出力を置いた。

> 申し送り: 期待値を定数で持たず引数で受け取る形にすれば、この script は feature 横断で使える。
> 本 feature の write scope 外なので直していない。

## 5. 残っている失敗 3 ファイルについて

`vitest-full.raw.txt` に 3 ファイル / 5 件の失敗が残る。**本 feature の回帰ではない。**
`HEAD`（`ed98785a`）の一時 worktree で同じファイルを走らせて同じ失敗を確認した記録は
[`../test-run-report.md`](../test-run-report.md) §3、切り出しは
[`../final-review.md`](../final-review.md) §6 にある。
