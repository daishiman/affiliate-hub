# テスト実行報告 — 住所層

## 該当試験だけの実行

```
npx vitest run tests/application/manage-custom-domains.test.ts \
                tests/domain/authoring/site-hostname.test.ts \
                tests/domain/authoring/site-public-url.test.ts \
                tests/infrastructure/resolve-custom-host.test.ts \
                tests/presentation/site-metadata.test.ts \
                tests/domain/entity-invariants.test.ts
```

A3 (独自ドメインでの配信) と A5 (canonical の切替) を解いた際に、
試験は 33 件から 91 件へ増えた。増えた分の内訳:

| 追加した試験 | 何を固定したか | 受入 |
|---|---|---|
| `routeResolvedSite` 4 件 | 住所が決まったあとの判断。管理画面と `/s/...` の重ね掛けを出さない | A3 |
| `isAlwaysPassPath` 2 件 | 画面の部品は住所表を引く前に落とす | A3 |
| `resolve-custom-host` 12 件 | 正規化 3・写しの規則 6・逆向き 4。**寿命 60 秒の境界を 59,999 と 60,001 で挟む** | A3 / A5 |
| `siteCanonicalUrl` 7 件 | 正本の優先順位 (独自ドメイン → 既定サブドメイン → path 形) | A5 |
| `site-metadata` 3 件 | どの住所で届いても canonical が 1 本に収まる | A5 |
| `d1-custom-domain` 1 件 | 正規の住所を逆向きに引ける。配信が止まれば正本も降りる | A5 |

`tests/integration/d1-custom-domain.test.ts` は `worker-runtime` プロジェクトとして
workerd の子プロセスを立てて走った (模造の保存先ではない)。11 件・exit 0。

## 全件の実行 (直したあと)

```
npx vitest run
```

```
Test Files  481 passed (481)
     Tests  10897 passed (10897)
exit=0
```

住所層の変更を入れる前は 479 ファイル / 10,865 件だった。増えた 2 ファイル・32 件が
上の表の内訳にあたる。

## 全件の実行で落ちた 4 件と、その直し方

A3・A5 の実装を入れた直後の全件実行で 4 件落ちた。**4 件とも私が足した変更が
原因**であり、上限を上げて緑にはしていない。

| 落ちた検査 | 何を指していたか | どう直したか |
|---|---|---|
| 段の印 (`quality-gates`) | 新しい試験ファイルに `@tier` が無い | frontmatter に `@tier 1` / `@req` / `@types` を書いた |
| 呼び出し回数だけ (`test-honesty`) | 7 件が「照会は 1 回」しか確かめていない扱いになっていた | 返り値を変数へ受けて `expect([first, second]).toEqual([...])` にした。**回数だけでは「写したが違う値を返す」実装を見逃す** |
| 作業場所で絞らない問い合わせ (`tenant-scoped-schema`) | `resolveCanonicalHostBySiteSlug` が `workspace_id` で絞らない | 理由付きで免除表へ登録した。読者に作業場所は無く、URL 名が結合キーである (AD-5) |
| 生成物の古さ (`generated-doc-freshness`) | `test-traceability.md` が 2 件古い | `pnpm run generate` で作り直した |

`test-honesty` の指摘は形式的に見えるが、実際に中身が薄かった。
「1 回しか照会していない」だけでは、写しが**別の値**を返していても緑になる。
返り値を並べて比べる形に直したことで、写しの一致まで見るようになった。

## `npm run generate` に残る赤 1 件 (**この feature の範囲外**)

```
書き込みなのに記録へ届いていない入口
  届いていない    1（上限 0）
  - createRecordReaderInteractionsUseCase  [ReaderInteractionIntakePort.record]
```

観測層 (`feat-reader-behavior-analytics`) で作った読者イベントの取り込み口が、
運営者の操作記録へ届いていない。同じ性質の `createRecordTelemetryUseCase` は
「自動の計測」として免除表に載っているが、**免除は 5 件で上限も 5 件**であり、
`docs/product/port-wiring.md` は「免除へ移した分だけ上限を下げる」ことを求めている。

**上限を上げて緑にはしない。** 正しい解き方は 2 つで、どちらも住所層の仕事ではない:

1. 読者イベントの取り込みを `createRecordTelemetryUseCase` と 1 本に統合する
   (観測層の重複解消 = `feat-reader-behavior-analytics` の P08)
2. 統合しないなら、免除を 1 件増やすと同時に別の 1 件を実装で塞ぐ

住所層の変更でこの赤を作ったわけではない (`git stash` せずに確かめられる形で、
`register` / `applySnapshot` / `request` を語彙表へ足した結果、**判定できない
14 件は 0 件になった**)。残る 1 件は観測層の負債として引き継ぐ。

### この作業で語彙表へ足したもの

`scripts/port-wiring.mjs` の「判定できない」14 件を 0 にした。分類の根拠:

| 手続き | 側 | 理由 |
|---|---|---|
| `siteDaily` / `articleDaily` / `breakdown` / `engagement` / `articleRanking` | 読み | 集計済みの行をそのまま返す。動詞で始まらないので完全名で並べた |
| `snapshot` | 読み | 外部の今の状態を写して返すだけ。**こちらには何も残さない** |
| `applySnapshot` | 書き | 写しをこちらの行へ当てる。**写す側と当てる側の境界がここ** |
| `register` / `request` | 書き | `request` はこちらの表を変えないが、**向こう側に状態が生まれる** |
| `assess` / `draftFix` / `dismiss` / `extract` | 書き | いずれも結果を残す。字面は読みに見える |

`apply` `draft` `extract` を前方一致に足すと効き過ぎるものは、完全名で書いた。

## lint

```
npm run lint   → exit 0
```

`stryker.config.mjs` に既存の警告が 1 件残る (この feature とは無関係)。

## 型検査

`src/app/layout.tsx(36,56) TS2304: Cannot find name 'LayoutProps'` と `tests/e2e/*` の
エラーはこの feature の着手前から存在する。住所層のファイルに型エラーは無い。
