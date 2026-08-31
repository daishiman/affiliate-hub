#!/usr/bin/env node
/**
 * 公開する Worker の大きさを、配る前に測って見せる。
 *
 * --- なぜ要るのか（2026-08-30 に起きたこと） ---
 * Cloudflare Workers には **1 Worker あたり 3 MiB（gzip 後）** という上限がある。
 * この日の公開は gzip 3065 KiB で超過し、13 分ビルドしたあとの最後の一手で落ちた。
 *
 * 問題は落ちたことではなく、**落ちるまで誰も数字を知らなかった**ことである。
 * `wrangler` はアップロード時に "Total Upload: … / gzip: …" を出しているが、
 * 成功した回のログを読む人はいない。だから上限まで残り 6.5 KiB という状態が、
 * 何回もの緑の公開をまたいで気づかれずに続いた。
 *
 * ここでやるのは 1 つだけ:**毎回の公開で残りの余白を必ず目に入れる。**
 * 余白が細ったことは、超える前に分かっていなければ意味がない。
 *
 * --- なぜ落とす条件が上限そのものなのか ---
 * 余白が細いだけで公開を止めると、**直す手立てが無いまま止まる**（削る作業は
 * 大きく、その場ではできない）。止めても人は上限のほうを緩めるだけになる。
 * だからここは、超えたら落とし、細ったら鳴らす。鳴っても公開は通る。
 *
 * 落ちる条件を `wrangler` と重ねているのは無駄ではない。**先に落ちると
 * 出るのが Cloudflare の一般的な文言ではなく、どこを削るかの手掛かりになる。**
 *
 * --- なぜビルドし直さないのか ---
 * `opennextjs-cloudflare deploy` は「ビルド済みを配る」だけなので、
 * `build:worker` と `deploy` の間に挟める。ここで測るのに要るのは
 * `wrangler` の束ね直し（数十秒）だけで、13 分の Next ビルドは走らない。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md / REQ-CI16
 *
 * ```
 * node scripts/worker-size.mjs --env dev
 * ```
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 無料プランの上限（gzip 後）。有料プランは 10 MiB。 */
export const LIMIT_KIB = 3 * 1024;

/**
 * ここを割ったら鳴らす余白。
 *
 * 200 KiB は「画面を数枚足したくらいでは割らないが、割ったら次の数 PR で
 * 上限に当たる」量。2026-08-31 の実測で、cron の二重取り込みを外して
 * 得られた余白がちょうど 134 KiB だった——**つまり、いまは鳴っている状態**である。
 * 鳴り続けるのは正しい。余白がこの幅に戻るまで、削る話は終わっていない。
 */
export const WARN_MARGIN_KIB = 200;

/**
 * `wrangler` の "Total Upload: 15574.34 KiB / gzip: 2937.80 KiB" を読む。
 *
 * 読めなければ `null` を返し、呼ぶ側が落とす。出力の形が変わったのに黙って通すと、
 * **測っていないのに緑**になり、この見張りが在るせいで誰も見なくなる。
 */
export function parseUploadSize(output) {
  const matched = /Total Upload:\s*([\d.]+)\s*KiB\s*\/\s*gzip:\s*([\d.]+)\s*KiB/.exec(output);
  if (matched === null) return null;
  const rawKib = Number(matched[1]);
  const gzipKib = Number(matched[2]);
  if (!Number.isFinite(rawKib) || !Number.isFinite(gzipKib)) return null;
  return { rawKib, gzipKib };
}

/**
 * 測った値を「収まっている／細っている／超えている」の 3 つに分ける。
 *
 * 境目は上限**ちょうどで超過扱い**（`>=`）。Cloudflare 側が同じ数で弾くので、
 * ここだけ 1 KiB 甘くすると「手元は緑・本番は赤」という一番たちの悪い形になる。
 */
export function judgeSize({ gzipKib }, limitKib = LIMIT_KIB, warnMarginKib = WARN_MARGIN_KIB) {
  const marginKib = limitKib - gzipKib;
  if (gzipKib >= limitKib) return { verdict: "over", marginKib };
  if (marginKib < warnMarginKib) return { verdict: "thin", marginKib };
  return { verdict: "ok", marginKib };
}

/** 出し先。`--env` が無ければ `null`（測る対象は環境ごとに違うので既定値を置かない）。 */
export function environmentFrom(argv) {
  const index = argv.indexOf("--env");
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

export function formatHeadline({ rawKib, gzipKib }, marginKib, limitKib = LIMIT_KIB) {
  const percent = ((gzipKib / limitKib) * 100).toFixed(1);
  return (
    `Worker の大きさ: gzip ${gzipKib.toFixed(0)} KiB / 上限 ${limitKib} KiB` +
    `（${percent}%、残り ${marginKib.toFixed(0)} KiB。束ねる前は ${rawKib.toFixed(0)} KiB）`
  );
}

const OVER_HINT =
  "上限を超えているので、この先の公開は Cloudflare 側で必ず落ちます。削る手掛かり:\n" +
  "  1. Worker の入口が引く TypeScript が増えていないか\n" +
  "     （`tests/architecture/worker-entry-weight.test.ts` が数えます。画面と API は\n" +
  "       別に束ねられているので、入口が引いた分は Worker の中にもう 1 部増えます）\n" +
  "  2. かたまりの重複が寄っているか（`scripts/dedupe-server-chunks.mjs` の出力）\n" +
  "  3. 画面（ルート）が増えていないか。127 ルートが 1 つの Worker に入っています\n" +
  "  4. どうしても削れないなら Workers の有料プラン（上限 10 MiB）\n";

function main(argv) {
  const targetEnv = environmentFrom(argv);
  if (targetEnv === null) {
    process.stderr.write(
      "NG 出し先を指定してください: node scripts/worker-size.mjs --env <dev|production>\n" +
        "測る対象は環境ごとに違います（`wrangler.jsonc` の env が別々に配線されているため）。\n",
    );
    return 1;
  }

  const out = join(process.cwd(), ".open-next/.size-check");
  rmSync(out, { recursive: true, force: true });

  let output = "";
  try {
    output = execFileSync(
      "pnpm",
      ["exec", "wrangler", "deploy", "--env", targetEnv, "--dry-run", "--outdir", out],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    process.stderr.write(
      "NG 束ね直しに失敗したので、大きさを測れませんでした。\n" +
        "**測れなかったことを、収まっていることと同じ緑にしない。**\n\n" +
        `${error.stdout ?? ""}${error.stderr ?? ""}\n`,
    );
    return 1;
  }

  const size = parseUploadSize(output);
  if (size === null) {
    process.stderr.write(
      "NG wrangler の出力から大きさを読めませんでした（出力の形が変わった可能性）。\n" +
        "`parseUploadSize` を直してください。読めないまま通すと、\n" +
        "測っていないのに緑になります。\n\n" +
        `${output}\n`,
    );
    return 1;
  }

  const { verdict, marginKib } = judgeSize(size);
  const headline = formatHeadline(size, marginKib);

  /* CI の実行結果の見出しにも残す。ログの奥は読まれない。 */
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined && summaryPath !== "") {
    appendFileSync(summaryPath, `### ${headline}\n`);
  }

  if (verdict === "over") {
    process.stderr.write(`NG ${headline}\n\n${OVER_HINT}`);
    return 1;
  }

  process.stdout.write(`${headline}\n`);

  /*
    測り終えた成果物は、収まっているときだけ消す。
    細っている／超えているときは**次に見る場所**なので残す（source map が要る）。
    配るのは `deploy` が別に作るものなので、残っていても取り違えは起きない。
  */
  if (verdict === "thin") {
    process.stdout.write(
      `注意 余白が ${marginKib.toFixed(0)} KiB しかありません（目安 ${WARN_MARGIN_KIB} KiB）。\n` +
        "**公開は通りますが、次の数回で上限に当たります。** 削る話を先送りにしないでください。\n" +
        "何が入っているかは、束ねた結果の source map から出せます（この回のぶんは残してあります）:\n" +
        `  ${join(".open-next/.size-check", "worker-entry.js.map")}\n`,
    );
  } else if (existsSync(out)) {
    rmSync(out, { recursive: true, force: true });
  }

  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv));
}
