# 品質報告（feat-uiux-overhaul / P09）

計測日: 2026-08-22
対象: 作業ツリー `ui-ux調整` / 枝 `daishiman/ui-ux調整`
（HEAD = `43a12ce` からの未コミット差分 203 件を含む）

この文書は**実測値だけ**を載せる。測っていない項目は「未計測」と書き、
推定値で埋めない。埋めた瞬間に、この文書は測定の代わりに使われる。

---

## 1. 型検査

```
npx tsc --noEmit
```

**エラー 0 件。**

## 2. 静的解析

```
npx eslint
```

**0 errors / 1 warning。**

| 場所 | 内容 | 扱い |
|---|---|---|
| `stryker.config.mjs:31:1` | `import/no-anonymous-default-export` | 本機能の変更前から在る。Stryker の設定は無名 default export が慣例なので、直さず残す |

本作業で一度 2 件の warning（`no-unused-vars`）を作ったが、
`vi.fn` に関数型の型引数を渡す形へ書き換えて解消した。
未使用引数を `_` 接頭辞で黙らせる回避は採っていない。

## 3. テスト

```
npx vitest run --coverage --coverage.reportOnFailure
```

```
Test Files   6 failed | 222 passed (228)
Tests       52 failed | 5447 passed (5499)
```

`--coverage.reportOnFailure` は**外してはいけない**。
`coverage.reportOnFailure` の既定は false で、テストが 1 件でも落ちていると
`coverage/coverage-summary.json` を含むレポートが一切生成されない。
このリポジトリは既知の blocker で 52 件が赤いままなので、
この指定を外すとカバレッジが「測れない」ではなく「0 件」として読まれる。

### 失敗 52 件の内訳（すべて既知 blocker・本作業で増減なし）

| 検査 | 件数 | blocker |
|---|---|---|
| `chapter-regeneration-floor` | 42 | `ah-a0o` |
| `chapter-normative-body-unreproducible` | 3 | `ah-a0o` |
| `doctrine-citation-gap` | 3 | `ah-a0o` |
| `doc-source-version-gap` | 2 | `ah-a0o` |
| `generated-doc-freshness` | 1 | `ah-a0o` |
| `qa-scope-notes-coverage` | 1 | `ah-v6n` |

`ah-a0o` は `system-spec/*.md`（5 ファイル）の退行。取りうる道は
**A**（HEAD の内容へ戻す）か **B**（`compile-spec-doc.py` を直して再コンパイル）で、
どちらを採るかは人が決める。**C（床を下げて緑にする）は採らない。**

`ah-v6n` は `expected 2 to be less than or equal to 1` で、
まとめ節に紐付かない束が上限より 1 つ多い。**上限は上げない。**

## 4. カバレッジ（層別）

```
node scripts/coverage-report.mjs
```

| 対象 | 行 | 分岐 | 関数 | 文 |
|---|---|---|---|---|
| domain | 96.4 / 90 | 93.6 / 93 | 94 / 94 | 95.3 / 95 |
| application | 97 / 85 | 85.1 / 85 | 98.7 / 98 | 91.6 / 91 |
| presentation | 90.9 / 75 | 80.9 / 80 | 87 / 87 | 89.6 / 89 |
| app | 90.3 / 70 | 66.2 / 62 | 87 / 86 | 89.4 / 87 |
| infrastructure | 83.1 / 70 | 75.2 / 74 | 83.4 / 81 | 81.6 / 81 |
| 全体 | 91.6 / 80 | 81.6 / 80 | 89.1 / 80 | 89.3 / 80 |

（各セルは `実測 / 下限`）

**すべての層が下限を満たしている。下限は 1 つも下げていない。**
下限の正本は `quality-gates.config.mjs` で、`docs/product/coverage.md` は
`scripts/coverage-report.mjs` が自動更新する。
「下限を下げて緑にすることは禁止」は `docs/product/ci-cd-guide.md` ④ の規定。

実質（スタブ除く） 92 ／ スタブのみ 85.7。差 -6.3pt で、
スタブが実質を上回っていない（上回ると、動かない部分ほど厚く検査されていることになる）。

### 床を満たすために足した検査（本作業・45 件）

| ファイル | 件数 | 埋めた対象 |
|---|---|---|
| `tests/ui/admin-edit-forms.test.tsx` | 18 | `presentation/admin` の 3 フォーム（押した後の枝） |
| `tests/infrastructure/product-sample-repository.test.ts` | 16 | 見本の保管庫（読み取り・断り・0 件） |
| `tests/ui/catalog-and-signin-clients.test.tsx` | 11 | 見本帳の入力部品と Google ログイン入口 |

いずれも母集団の床を**同じ `it` の中**に置いてある。
「0 件だった」と主張する検査に、0 でないはずの母集団の下限が同居していないと、
対象が消えた日に空振りで緑のまま残る。

`useActionState` の中の状態は外から押せないので、`admin-edit-forms` では
`vi.mock("react", …)` でそのフックだけ差し替え、「押した後の姿」を直接作っている。
打ち込みへの反応が要る `catalog-and-signin-clients` は
`// @vitest-environment jsdom` + `@testing-library/react` の `fireEvent`
（vitest の既定 environment は `node` なので、この指定が無いと DOM が無い）。

## 5. 本作業で見つけた欠陥と、その修正

| 場所 | 症状 | 修正 |
|---|---|---|
| `src/presentation/admin/product-form.tsx` の `UpdateProductForm` | 「仕様の出どころ」の欄に `error` が繋がっておらず、`edit-product.ts:169` が `field: "officialUrl"` で断っても**どこにも表示されなかった**（押しても無反応に見える） | 欄へ `error={state.field === "officialUrl" ? state.message : null}` を接続 |

`FormResult` は `state.field === undefined` のときだけまとめ枠へ出す作りなので、
欄に紐付いた断りが欄側へ繋がっていないと、断りが完全に消える。
検査を弱めるのではなく実装を直した。

## 6. A4（出し先を増やすときの改修範囲）の実測

「登録表に 1 行足すだけで画面が広がる」が本当かを、実際に足して測った。

手順: `src/domain/distribution/channel.ts` の `CHANNEL_CAPABILITIES` へ
`mastodon` を 1 件追加 → 型検査と UI 系テストを実行 → バックアップから復元。

| 測ったこと | 結果 |
|---|---|
| `src/app/admin/**`, `src/presentation/**` の要編集行数 | **0 行** |
| UI 系テスト（80 ファイル 2514 件） | 全通過。新しい出し先が選択肢へ自動で並んだ |
| 型エラー | **1 件だけ** — `src/infrastructure/channels/channel-registry.ts(78,7)`：`Property 'mastodon' is missing in type … but required in type 'Readonly<Record<ChannelKind, ConnectorFactory>>'` |

結論: **「記述を足すだけ」が成り立つのは画面まで。** 接続実装（コネクタ）は
自動では生えず、`channel-registry.ts` が型で要求する。
これは正しい設計で、投稿手段が無いのに画面から選べたら、選んでから失敗する。
`ChannelKind = keyof typeof CHANNEL_CAPABILITIES` にしてあることで、
表が唯一の正本になり、画面側の書き起こしが存在しない。

復元後の `npx tsc --noEmit` はエラー 0 件（追加分が残っていないことを確認済み）。

## 7. 仕様書と実装のずれ

| 仕様書の記述 | 実際 |
|---|---|
| `src/app/api/admin` に API を置く | その階層は実在しない。実体は `src/app/api` 配下 |

仕様書の側が古い。実装を仕様書へ合わせて `admin` 階層を作ると、
既存の経路が二重になるので、**仕様書の記述を実装へ合わせる**のが正しい向き。

## 8. 未計測（この作業では測っていない）

| 項目 | 状態 |
|---|---|
| アクセシビリティの自動検査（axe 等） | 未実施。自動検査の配線そのものが無い |
| 表示崩れの目視・視覚回帰 | `tests/visual/__baseline__/` に基準画像を 5 枚置いた段階。差分検出の常時実行はしていない |
| 応答性能（描画時間・API 応答） | 未計測 |

いずれも「問題なし」ではなく「測っていない」。
測っていないものを緑として報告しないために、ここへ明示して残す。
