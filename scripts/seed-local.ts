/**
 * ローカルの D1（miniflare）へ見本データを当てる。
 *
 * ```
 * pnpm db:migrate:local   # 先に表を作る
 * pnpm seed:local         # ここ
 * ```
 *
 * **開発機だけ。** `--local` を外す口をこのファイルに置いていないので、
 * 引数を間違えて本番へ当てることができない。当てる先は
 * `wrangler.jsonc` の `env.dev` の `DB`（miniflare のファイル）である。
 *
 * 値は `scripts/seed/local-seed-data.ts` が持つ。ここは手順だけ。
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSeedSql } from "./seed/local-seed-data";

const OUT = join(process.cwd(), ".wrangler", "tmp", "local-seed.generated.sql");

function main(): void {
  const now = Math.floor(Date.now() / 1000);
  const statements = buildSeedSql(now);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${statements.join("\n")}\n`, "utf8");

  process.stdout.write(`${statements.length} 文を当てます: ${OUT}\n`);
  const run = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", "--env", "dev", "--local", "--file", OUT],
    { stdio: "inherit" },
  );
  if (run.status !== 0) {
    process.stderr.write(
      "\n当てられませんでした。先に `pnpm db:migrate:local` で表を作ってください。\n",
    );
    process.exit(run.status ?? 1);
  }
  process.stdout.write("\n見本データを入れました。`pnpm dev` で画面から触れます。\n");
}

main();
