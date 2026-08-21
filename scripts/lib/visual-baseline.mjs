/**
 * 見本（baseline）の上書きに門を掛ける。
 *
 * ## この門が無いと何が起きるか
 *
 * 画像比較は**見本を書き換えれば必ず緑にできる**。赤が出たとき、
 * 直すより上書きするほうが速いので、締切のある日には必ず上書きが選ばれる。
 * 数回続くと、見本は「いまの見た目」の写しになり、**崩れた見た目が見本**になる。
 * そのとき検査は緑のまま、崩れだけが残る。**画像比較でいちばん多い壊れ方はこれ**で、
 * 比較そのものが動かないことより起こりやすい。
 *
 * ## 掛けている門は 3 つ
 *
 * 1. **理由の無い上書きを 0 件で固定する。** 見本の中身（sha256）は、
 *    かならず台帳（`baseline-updates.jsonl`）のどれかの行に理由つきで載っている。
 *    手で PNG を差し替えると中身が変わり、台帳のどこにも載らないので赤くなる。
 * 2. **1 回に上書きできる枚数に上限を張る。** 張る先は**「上書きした枚数」**であって
 *    「見本の総枚数」ではない。総枚数は画面が増えれば増えるので上限に向かない
 *    （上限が反射的に引き上げられる的になり、数回で誰も守らなくなる）。
 *    上書き枚数は**増えてよい場面が無い**ので、上限に向く。
 * 3. **上限は下げる方向にしか動かせない。** 記録（`accept-limit-history.jsonl`）は
 *    追記だけで、値が前の行より大きい行を足すと赤くなる。上げるには前の行を
 *    消すしかなく、それは差分にはっきり出る。
 *
 * ここは**ファイルを読むだけ**にしてある。撮る側（Chrome）と切り離しておくと、
 * ブラウザが無い機械でもこの 3 つの門は検査できる。
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 見本と台帳の置き場所（リポジトリの根からの相対）。 */
export const VISUAL_DIR = "tests/visual";
/** 見本の PNG。環境の名札ごとに分ける（書体が端末で変わるため）。 */
export const BASELINE_DIR = `${VISUAL_DIR}/baseline`;
/** 上書きの台帳。1 行 1 回。**追記だけ。** */
export const UPDATES_LEDGER = `${VISUAL_DIR}/baseline-updates.jsonl`;
/** 上限の記録。1 行 1 回。**追記だけ。値は前の行以下でなければならない。** */
export const LIMIT_HISTORY = `${VISUAL_DIR}/accept-limit-history.jsonl`;

/**
 * 上書きの理由に求める最短の長さ。
 *
 * 「更新」「fix」で通ると、欄はあるが何も書いていないのと同じになる。
 * 20 文字は「どの画面の何が、なぜ変わってよいのか」を 1 文で書ける下限。
 * **下げないこと。**下げると、この門は形だけになる。
 */
export const MIN_REASON_LENGTH = 20;

/**
 * @param {Buffer | Uint8Array} bytes
 * @returns {string}
 */
export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * 追記だけの台帳を読む。空行は飛ばす。壊れた行は**投げる**（飛ばさない）。
 *
 * 読めない行を黙って飛ばすと、台帳を壊すだけで門が通せてしまう。
 *
 * @param {string} root
 * @param {string} relative
 * @returns {object[]}
 */
export function readJsonl(root, relative) {
  const path = join(root, relative);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line !== "")
    .map(({ line, index }) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${relative} の ${index + 1} 行目が読めません: ${line.slice(0, 60)}`);
      }
    });
}

/**
 * いま置いてある見本を、環境の名札ごとに数え上げる。
 *
 * @param {string} root
 * @returns {{ environment: string, name: string, relative: string, sha256: string }[]}
 */
export function listBaselines(root) {
  const dir = join(root, BASELINE_DIR);
  if (!existsSync(dir)) return [];
  /** @type {{ environment: string, name: string, relative: string, sha256: string }[]} */
  const found = [];
  for (const environment of readdirSync(dir).sort()) {
    const envDir = join(dir, environment);
    for (const file of readdirSync(envDir).sort()) {
      if (!file.endsWith(".png")) continue;
      found.push({
        environment,
        name: file.slice(0, -4),
        relative: `${BASELINE_DIR}/${environment}/${file}`,
        sha256: sha256(readFileSync(join(envDir, file))),
      });
    }
  }
  return found;
}

/**
 * 上限の記録を読み、いま効いている上限を返す。
 *
 * @param {string} root
 * @returns {{ limit: number, history: { at: string, limit: number, why: string }[], problems: string[] }}
 */
export function readAcceptLimit(root) {
  const history = /** @type {{ at: string, limit: number, why: string }[]} */ (
    readJsonl(root, LIMIT_HISTORY)
  );
  /** @type {string[]} */
  const problems = [];

  if (history.length === 0) {
    problems.push(`${LIMIT_HISTORY} が空です。上限が決まっていないので、上書きは通しません。`);
    return { limit: 0, history, problems };
  }

  history.forEach((entry, index) => {
    if (!Number.isInteger(entry.limit) || entry.limit < 0) {
      problems.push(`${LIMIT_HISTORY} の ${index + 1} 行目の limit が整数ではありません`);
    }
    if (typeof entry.why !== "string" || entry.why.trim().length < MIN_REASON_LENGTH) {
      problems.push(
        `${LIMIT_HISTORY} の ${index + 1} 行目に、なぜその上限なのかが ${MIN_REASON_LENGTH} 文字以上で書かれていません`,
      );
    }
    if (index > 0 && entry.limit > history[index - 1].limit) {
      /*
        ここが「下げる方向にしか動かさない」の本体。
        上げたい人は前の行を消すことになるが、消した跡は差分に出る。
        追記だけなら、上げる道はここで塞がる。
      */
      problems.push(
        `${LIMIT_HISTORY} の ${index + 1} 行目で上限が上がっています（${history[index - 1].limit} → ${entry.limit}）。上限は下げる方向にしか動かしません。`,
      );
    }
  });

  return { limit: history[history.length - 1].limit, history, problems };
}

/**
 * 3 つの門をまとめて見る。**赤くする理由の一覧**を返す（例外は投げない）。
 *
 * @param {string} root
 * @param {number} configuredMax `quality-gates.config.mjs` が言っている上限
 * @returns {string[]} 空なら通過
 */
export function auditBaselineLedger(root, configuredMax) {
  /** @type {string[]} */
  const problems = [];

  const { limit, problems: limitProblems } = readAcceptLimit(root);
  problems.push(...limitProblems);

  if (configuredMax > limit) {
    problems.push(
      `設定の上限 ${configuredMax} が、記録の上限 ${limit} を超えています。一度 ${limit} まで下げた上限は戻せません。`,
    );
  }

  const updates = /** @type {{ at: string, why: string, shots: { name: string, environment: string, sha256: string }[] }[]} */ (
    readJsonl(root, UPDATES_LEDGER)
  );

  /** 台帳に理由つきで載っている見本の中身。 */
  const blessed = new Set();

  updates.forEach((entry, index) => {
    const where = `${UPDATES_LEDGER} の ${index + 1} 行目`;
    const why = typeof entry.why === "string" ? entry.why.trim() : "";
    if (why.length < MIN_REASON_LENGTH) {
      problems.push(`${where}: 上書きの理由が ${MIN_REASON_LENGTH} 文字以上ありません（いま ${why.length} 文字）`);
    }
    if (!Array.isArray(entry.shots) || entry.shots.length === 0) {
      problems.push(`${where}: 上書きした見本が 1 枚も書かれていません`);
      return;
    }
    if (entry.shots.length > limit) {
      problems.push(
        `${where}: 1 回で ${entry.shots.length} 枚を上書きしています（上限 ${limit} 枚）。まとめて上書きすると、1 枚ずつなら気づけた崩れが理由 1 行に紛れます。`,
      );
    }
    for (const shot of entry.shots) {
      if (typeof shot?.sha256 !== "string" || shot.sha256.length !== 64) {
        problems.push(`${where}: 見本の中身の指紋が書かれていません（${shot?.name ?? "名前不明"}）`);
        continue;
      }
      // 理由が短い行は上で赤くしてある。ここで許すと理由なしの上書きが通る。
      if (why.length >= MIN_REASON_LENGTH) blessed.add(shot.sha256);
    }
  });

  for (const baseline of listBaselines(root)) {
    if (!blessed.has(baseline.sha256)) {
      problems.push(
        [
          `${baseline.relative} は、理由つきの上書きとして台帳に載っていません。`,
          "手で差し替えたか、台帳に書かずに上書きした可能性があります。",
          "見本を変えるときは `pnpm run visual -- --accept --why \"…\"` を通してください。",
        ].join(" "),
      );
    }
  }

  return problems;
}
