# 走査の効きを測るための、仮のワークフロー置き場

**ここは本物のワークフローではない。** `.github/workflows/` の中身は
「CI の設定変更は利用者の判断」という決まりで書き換えられないため、
`tests/architecture/ci-config.test.ts` の走査が**本当に効いているか**を、
本物に指 1 本触れずに測るために置いてある。

判定は「ディレクトリを受け取る関数」に割ってある。

```
scanDirectRuns(dir) / scanWrittenThresholds(dir)
  ├ 本番:  .github/workflows       → 違反 0 件であることを見る
  ├ 対照:  violating/              → 1 件ずつ赤になることを見る
  └ 対照:  clean/                  → 禁じていない書き方だけなら緑であることを見る
```

**`violating/` と `clean/` の差は、狙った 1 点だけ**にしてある。
差が 2 つ以上あると「赤が出た」理由が確定しない。

- `violating/sneaky.yml` — `pnpm exec vitest run`（検査の道具の直叩き）と
  `coverage-threshold: 75`（正本の閾値の書き写し）を持つ
- `clean/honest.yml` — 同じ形だが、`pnpm exec wrangler deploy` と
  閾値でない数字だけを持つ

**この 2 本は GitHub Actions からは読まれない。**`.github/` の外にあるため。
`scripts/tier-scan.mjs` も `*.test.ts(x)` しか拾わないので、段の印は要らない。
