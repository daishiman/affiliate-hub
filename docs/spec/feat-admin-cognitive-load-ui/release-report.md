# P13 ローカル反映・差し戻し報告

## 判定

**ローカル開発環境・Cloudflare Workers dev 環境ともに反映 PASS**。利用者の明示確認後、dev 環境だけへ反映した。production、commit、push、PR は変更していない。

- dev URL: `https://affiliate-hub-dev.daishimanju.workers.dev`
- Worker version: `e5d96696-b166-4091-8a1b-daefa4cf934d`
- Worker startup: 40 ms
- deploy bundle: gzip 2,637.46 KiB
- deployed at: 2026-08-30（JST）

`pnpm deploy:dev` は Next.js build、TypeScript、OpenNext bundle、assets 48件の upload まで成功したが、最終 Wrangler bundle に minify が渡らず無料枠3 MiBを超え、version作成前に Cloudflare code 10027 で拒否された。同じ生成物に公式 `--minify` を付けた dry-run（gzip 2,637.46 KiB）を確認し、`pnpm exec opennextjs-cloudflare deploy -- --env dev --minify` で再送して成功した。最初の試行は version を作らず、既存dev環境とproductionを変更していない。

## ローカル反映

```bash
pnpm db:migrate:local
pnpm seed:local
pnpm preview
pnpm dev
```

- URL: `http://localhost:3002`
- signin: `http://localhost:3002/signin`
- account: `owner@local.test`
- password: なし（ローカル専用 signin button）
- seed: user 1、memberships 2、articles 6、blocks 24、tags 5、site nodes 4、legal pages 10
- seed result: `pnpm seed:local` で106 commands成功。remote D1には書き込まず、`.wrangler/state/v3/d1` のlocal DBだけを更新
- local process: PID `13897`、`next-server (v16.3.1)`、HTTP 200

## dev 反映後の smoke

| 対象 | 結果 |
| --- | --- |
| `/` | HTTP 200、`x-opennext: 1` |
| `/signin` | HTTP 200、ログイン画面を表示 |
| 未認証 `/admin` | HTTP 307、`/signin` へ遷移。follow後200 |
| root 内部情報 | `/api/tools`、`/api/mcp`、「AI から使える操作」の一致0 |
| build | Next.js 16.3.1 production build / TypeScript / OpenNext bundle PASS |
| 全体E2E | 492 passed / 2 intentional skip / 0 failed |
| visual | darwin-arm64-chrome151、5 / 5 PASS、陽性対照作動 |

## 反映後の smoke

1. signin から owner として `/admin` へ入れる。
2. home に内部 API / tool / endpoint 列挙がない。
3. AI usage が summary → graph → exact table の順で読める。
4. UI catalog の表見出し / primary key が scroll 後も残る。
5. mobile / 200% / keyboard で現在地と focus を失わない。
6. 認証、API response、書込 test の結果が改修前契約と同じ。

## 差し戻し判断

次のいずれかで差し戻す: signin 不可、主要 action 不可、情報欠落、2 次元 scroll 強制、focus 喪失、権限 / API / 書込 contract の変化、feature test failure。

## 安全な差し戻し

現在は commit 前で共有 worktree に既存の未コミット差分があるため、広い `git checkout` / `reset` は使わない。

1. localhost process を停止する。
2. `git diff -- src/app/admin src/presentation/ui src/presentation/admin/admin-shell.tsx 'src/presentation/admin/*-form.tsx' 'src/presentation/admin/*-forms.tsx' src/presentation/admin/delete-confirm.tsx scripts/seed/local-seed-data.ts scripts/visual-regression.tsx scripts/write-static-preview.tsx tests docs/spec/feat-admin-cognitive-load-ui system-spec features/feat-admin-cognitive-load-ui.context.json` を patch として退避する。`src/presentation/admin` は P05/P08 の明示許可ファイルだけを含め、既存の `docs/product/**` とそれ以外の共有dirty差分は本featureへ帰属させない。
3. 本報告の feature 変更ファイル一覧と照合し、feature hunk だけを選択的に戻す。他担当 hunk は触らない。
4. seed はローカル D1 のみ。必要なら `pnpm db:migrate:local && pnpm seed:local` で既知状態へ再収束する。
5. dev 環境で差し戻す場合は、Cloudflare の直前の正常 version を選んでdevへrollbackし、上記 smoke と同じquality gateを再実行する。productionは対象にしない。
6. 将来 commit 後に反映する場合は、その feature commit だけを新しい revert commit で戻し、同じ quality gate を再実行する。
