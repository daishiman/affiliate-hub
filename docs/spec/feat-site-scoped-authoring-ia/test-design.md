# テスト設計 (P04)

feature: `feat-site-scoped-authoring-ia` / phase: P04 / graph node: `SYS-SITE-SCOPED-AUTHORING-IA-P04`

受入 A1–A10 のそれぞれを、**実装前に落ちて、実装後に通る**形へ落とす。

## 0. 何を見て、何を見ないか

保守性制約 (task spec) が禁じているのは、画素の位置と DOM の構造に依存する検査である。
見るのは次の 4 つだけ。

- 画面に見える文言
- 支援技術に読み上げられる名前 (`aria-label` / 見出し / role)
- 応答の状態コード
- 行き先の URL

### 描画結果ではなく正本の表を見る場面がある

一段目の分類も画面の住所も、正本は
`src/presentation/ui/admin-route-metadata.ts` の **1 つの表**である。
サイドバーの描画結果だけを見ると、**表を直さずに描画側へ分岐を足しても緑になる**。
それは分類が 2 か所に散った状態そのもので、本 feature が無くそうとしている形である。

そこで A1 / A5 / A8 は表の側を直に見る。描画へ届いているか
(読み上げに分類が出るか) は既存の `tests/ui/app-shell-nav.test.tsx` が別に見ている。
二重に見るのではなく、**見る対象を分けている**。

## 1. 受入とテストの対応

| 受入 | テスト | 見る対象 | 現状 |
|---|---|---|---|
| A1 | `tests/ui/site-scoped-authoring-ia.test.tsx` | route 表に 5 つの id があり、親を辿って `sites/[site]` へ戻れる | 赤 |
| A2 | `tests/acceptance/site-scoped-redirect-map.test.ts` | 転送表 7 件の旧 URL に殻の `page.tsx` があり、行き先の `page.tsx` が実在する | 赤 |
| A3 | 同上 | 解決できないときの行き先が `/admin/sites` であること | 赤 (P05 で純粋関数と同時) |
| A4 | 同上 + P05 で追加 | 未知 slug の応答に他ブログの slug が 0 件 | 赤 (P05 で同時) |
| A5 | `tests/ui/site-scoped-authoring-ia.test.tsx` | 分類がちょうど 5 つで、補助 4 入口が分類の外にある | 赤 |
| A6 | 同上 (機械の部分) | ラベルが名詞 1 語で、社内語を含まない | 赤 |
| A6 | — (人の部分) | 正答率 90% | **BLOCKED (外部参加者が必要)** |
| A7 | P05 で `tests/application/` に追加 | 雛形から 1 ブログ分を作る純粋関数の出力 | 未着手 (P05 で同時) |
| A8 | `tests/acceptance/site-scoped-redirect-map.test.ts` | 全ルートの到達クリック数が 後 ≤ 前 | 赤 |
| A9 | 同上 | 新設画面が危険操作を 0 件しか持たない | 赤 |
| A10 | 同上 | `drizzle/` の migration 追加が 0 件、新しい集計表の参照が 0 件 | 緑 (回帰の見張り) |

## 2. 新しいモジュールのテストを P04 で書かない理由 (逸脱の記録)

P04 の受入は `pnpm run typecheck` と plan validation の 2 つで、
**`pnpm test` は含まれない**。テストが赤のまま typecheck が緑であることが求められている。

ここで `src/presentation/admin/site-scoped-redirect.ts` (未作成) や
`cloneWritingMethodForSite` (未作成) を `import` するテストを書くと、
**typecheck が落ちる**。P04 の受入そのものを壊す。

したがって:

- **既存の正本を見るテストは P04 で書く** — 表は今も typecheck を通り、値だけが古い。
  だから赤くできる。
- **新設モジュールを import するテストは P05 で、モジュールと同じ周回に書く。**

これは逸脱なので、ここと最終報告の両方に記録する。
「P04 でテストを全部書いた」と言えない代わりに、
**P04 の受入を壊さずに赤を作れた**ことは機械で示せる。

## 3. 既存テストへの波及

| ファイル | 箇所 | 変更 |
|---|---|---|
| `tests/ui/app-shell-nav.test.tsx` | `toHaveLength(93)` | 新設ルートを足した数へ |
| 同上 | `toHaveLength(6)` | 分類 6 → **5** |

この 2 つは P05 で実装と同時に直す。先に直すと、実装前から緑になり見張りの意味を失う。

## 4. アーキテクチャの見張りに合わせること

- `tests/architecture/required-test-types-registry-scope.test.ts` — 未宣言の `@req` の
  件数に上限がある。**既存の REQ id を使い回す** (新規に増やさない)。
- `tests/architecture/screen-budget-single-source.test.ts` — `tests/ui/` に裸の数値の
  待ち時間を書かない。`quality-gates.config.mjs` の `*_BUDGET_MS` を import する。
- `tests/architecture/test-foundation.test.ts` — `LEAST_TEST_FILES = 150`。
  テストファイルを減らさない。

## 5. A6 の人の部分の扱い

外部参加者を集められないので、P07 は FAIL ではなく
`BLOCKED (外部参加者が必要)` として記録する。
`feat-reference-blog-admin-ux` が同じ理由で停止しているので扱いを揃える。
機械で確かめられる部分 (ラベルが規則に従っているか) だけを PASS にする。

**FAIL と BLOCKED を分ける理由**: FAIL は「測って落ちた」、
BLOCKED は「測っていない」である。混ぜると、後から見た人が
「一度落ちたラベル」だと読む。
