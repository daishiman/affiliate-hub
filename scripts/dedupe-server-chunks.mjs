#!/usr/bin/env node
/**
 * Turbopack が同じ中身を何度も吐いたサーバ側のかたまりを、1 つに寄せる。
 *
 * --- なぜ要るのか ---
 * Cloudflare Workers には **1 つの Worker が 3 MiB（gzip 後）** という上限がある。
 * このアプリは 2026-08-21 に 3431 KiB でその上限に当たり、公開が止まった。
 *
 * 中を割ってみると、`.next/.../server/chunks/` の **46%（3.84 MiB）が完全な重複**だった。
 * Turbopack は同じかたまりを違うハッシュ名で何度も書き出す。中身は
 * 末尾の `//# sourceMappingURL=` の 1 行を除いて**バイト単位で同一**である。
 * OpenNext はそれらを別々のファイルとして esbuild に渡すため、束ねる側からは
 * 同じものだと分からず、3 つとも Worker に詰め込まれる。
 *
 * ここで重複を `module.exports=require("./正本.js")` に置き換えると、
 * esbuild が解決した時点で 1 つに畳まれる。実測 3431 KiB → 2196 KiB（36% 減）。
 *
 * --- なぜ standalone の側なのか ---
 * ビルドは同じかたまりを **2 か所** に吐く:
 *
 *   .next/server/chunks/                      ← Node で動かすときに使う方
 *   .next/standalone/.next/server/chunks/     ← **OpenNext が読む方**
 *
 * 手前の方を削っても Worker のサイズは 1 バイトも動かない。しかも
 * エラーにはならないので、**効いていないことに気づけない**。ここを取り違えないこと。
 *
 * --- 走らせる場所 ---
 * `opennextjs-cloudflare build` の後、`--skipNextBuild` を付けた 2 回目の前。
 * package.json の `build:worker` に組んである。
 *
 * **`next build` の後ではない。** `.next/standalone/` を作るのは Next 単体ではなく
 * OpenNext（ビルド時に `output: "standalone"` を注ぎ込む）で、素の `next build` だけでは
 * 置き場そのものが存在しない。だから束ねる工程を 1 回目・2 回目に分け、その間に挟む。
 * 2 回目に `--skipNextBuild` が要るのは、付け忘れると 1 回目からやり直して
 * **寄せた結果が上書きされる**ため。
 *
 * --- 効かなくなったときに何が起きるか ---
 * Next や OpenNext の更新でかたまりの形が変わると、このスクリプトは
 * 何も見つけられなくなる。そのときは Worker が上限に当たり、`wrangler deploy` が
 * `exceeded the size limit of 3 MiB` で落ちる。**黙って通ることはない。**
 *
 * ```
 * node scripts/dedupe-server-chunks.mjs
 * ```
 */
import { createHash } from "node:crypto";
import { existsSync, globSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = process.cwd();
/** OpenNext が読む側。手前の `.next/server/chunks/` ではない（上の説明を参照）。 */
const CHUNKS = join(ROOT, ".next/standalone/.next/server/chunks");

/** 末尾のこの 1 行だけが違う写しを「同じ」と見なす。 */
const SOURCE_MAP_LINE = /\n?\/\/# sourceMappingURL=.*\n?$/;

/**
 * かたまりは `module.exports=[…]` という素の CommonJS で、
 * 中身は「登録するモジュールの並び」でしかない。だから写しを
 * 正本への `require` に差し替えても、登録される中身は変わらない。
 *
 * この形でないものは**触らない**。形が変わったということは、
 * 差し替えて安全だという前提そのものが崩れているからである。
 */
const EXPECTED_SHAPE = "module.exports=";

if (!existsSync(CHUNKS)) {
  process.stderr.write(
    `NG かたまりの置き場が見つかりません: ${relative(ROOT, CHUNKS)}\n` +
      "先に `opennextjs-cloudflare build` を済ませてください（素の `next build` では\n" +
      "standalone の置き場そのものが作られません）。\n" +
      "置き場ごと変わったのなら、このスクリプトの CHUNKS を直してください\n" +
      "（`.next/server/chunks/` の方を指しても、Worker のサイズは動きません）。\n",
  );
  process.exit(1);
}

/** 中身（sourceMappingURL の行を除く）が同じものどうしを束ねる。 */
const groups = new Map();
for (const name of globSync("**/*.js", { cwd: CHUNKS })) {
  const file = join(CHUNKS, name);
  const body = readFileSync(file, "utf8");
  const key = createHash("sha256").update(body.replace(SOURCE_MAP_LINE, "")).digest("hex");
  const group = groups.get(key);
  if (group === undefined) groups.set(key, [file]);
  else group.push(file);
}

const duplicated = [...groups.values()].filter((group) => group.length > 1);

/*
  重複が 0 件のとき、それが「Turbopack が直った」なのか
  「置き場を取り違えて何も読めていない」なのかは、削減量からは区別できない。
  そこで**読めた数の方**で切り分ける。

  この床は「量が減っていないか」を見るためのものではなく、
  **そもそも読めているか**だけを見るためのものなので、わざと緩くしてある。
  実測 235 個に対する 50 個は 4 倍以上の余裕がある。ルートを減らせば
  かたまりも減るので、ここをきつく張ると普通の削除で誤って鳴る。
*/
const READ_FLOOR = 50;

if (groups.size < READ_FLOOR) {
  process.stderr.write(
    `NG かたまりを ${groups.size} 個しか読めていません（床 ${READ_FLOOR} 個）。\n` +
      `見に行った先: ${relative(ROOT, CHUNKS)}\n` +
      "置き場か命名が変わった可能性があります。`.next/standalone/.next/server/` の\n" +
      "下に何があるかを先に見てください。ここで見落とすと Worker が上限に当たり、\n" +
      "`wrangler deploy` が `exceeded the size limit of 3 MiB` で落ちます。\n",
  );
  process.exit(1);
}

if (duplicated.length === 0) {
  /*
    読めてはいるが重複が無い。Turbopack 側が直った可能性が高いので、ここは通す。
    **通しても無言にはならない。** 仮に判断を誤っていて実は削り損ねていたなら、
    その分だけ Worker が太ったまま `wrangler deploy` まで進み、そこで
    サイズ超過として落ちる。落ちる場所が遅れるだけで、緑にはならない。
    逆にここで止めると、本当に直った日に正しいビルドが落ちる。
  */
  process.stdout.write(
    `かたまりの重複はありませんでした（${groups.size} 個を読んで 0 件）。\n` +
      "Turbopack が同じ中身を重ねて吐かなくなったのなら、このスクリプトは役目を終えています。\n" +
      "Worker のサイズが上限に近いままなら、削り損ねを疑ってください。\n",
  );
  process.exit(0);
}

let rewritten = 0;
let saved = 0;
let skipped = 0;

for (const group of duplicated) {
  // 名前順で先頭を正本にする。**並びを固定しないと、走らせるたびに
  // 正本が入れ替わり、生成物が毎回違うものになる。**
  const [canonical, ...copies] = group.sort();

  if (!readFileSync(canonical, "utf8").startsWith(EXPECTED_SHAPE)) {
    skipped += group.length;
    continue;
  }

  for (const copy of copies) {
    const before = statSync(copy).size;
    const path = relative(dirname(copy), canonical);
    writeFileSync(copy, `module.exports=require(${JSON.stringify(`./${path}`)});\n`);
    saved += before - statSync(copy).size;
    rewritten += 1;
  }
}

process.stdout.write(
  `かたまりの重複をまとめました: ${rewritten} 件を正本へ寄せて ` +
    `${(saved / 1048576).toFixed(2)} MiB 減らしました` +
    (skipped > 0 ? `（形が違うので触らなかったもの: ${skipped} 件）` : "") +
    "\n",
);
