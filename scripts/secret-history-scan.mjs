#!/usr/bin/env node
/**
 * 秘密の値が **過去の履歴** に入っていないかを 1 度走査する。
 *
 * --- なぜ検査ではなく手順なのか ---
 * `tests/architecture/secrets-not-in-repo.test.ts` は「これから入るのを止める」門で、
 * いま git が追跡しているものだけを見る。**過去の履歴は見ない。**
 * こちらは逆に、履歴に届いたことのある全オブジェクトを 1 度だけ読む。
 * 毎回の門にはしない——履歴は追記しかされないので、門にしても
 * 「昨日と同じものを毎回読み直す」だけになり、時間だけ増えて分かることは増えない。
 *
 * --- 判定の形を新しく考え直さない ---
 * 物差しは既存の検査ファイルから **そのまま読み出す**（`SECRET_PATTERNS` の
 * 配列リテラルを取り出して評価する）。写して持つと 2 つの物差しができ、
 * 片方だけ緩む。検査ファイルは読むだけで、書き換えない。
 *
 * --- 補助の掃き出し ---
 * 既存の物差しに無い発行元（`github_pat_` / `AIza` / `xai-` / Cloudflare の形）は
 * **判定を分けて** 出す。正本の物差しに混ぜると「入口の門と履歴の走査で
 * 当たる範囲が違う」状態を黙って作ることになる。こちらは参考値として数える。
 *
 * --- 出さないもの ---
 * 当たった値そのものは、画面にも記録にも出さない。出どころ（種別・オブジェクト・
 * 経路・行）と sha256 の先頭 16 桁だけを出す。記録が新しい漏れになるのを避ける。
 *
 * 使い方: node scripts/secret-history-scan.mjs
 * 規範: tasks/task-secret-history-scan.md
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CWD = process.cwd();
const git = (args, opts = {}) =>
  execFileSync("git", args, {
    cwd: CWD,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    ...opts,
  });

/**
 * 既存の検査から判定の形を取り出す。**写さずに読み出す。**
 * 型注釈だけ落として配列リテラルをそのまま評価する。
 * 取り出しに失敗したら **黙って自前の形へ落ちない** ——落ちた瞬間に
 * 「同じ物差し」という前提が崩れ、緩んだことが誰にも見えなくなる。
 */
const TEST_PATH = "tests/architecture/secrets-not-in-repo.test.ts";

/** 宣言の右辺の括弧を数えて切り出す。中の正規表現に括弧が入るので indexOf では切れない。 */
function sliceLiteral(src, declaration, openChar, closeChar) {
  const start = src.indexOf(declaration);
  if (start < 0) throw new Error(`${TEST_PATH} に ${declaration} がありません`);
  const open = src.indexOf(openChar, src.indexOf("=", start));
  let depth = 0;
  let end = -1;
  let inString = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (inString) {
      if (c === "\\") i += 1;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inString = c;
    else if (c === openChar) depth += 1;
    else if (c === closeChar) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`${TEST_PATH} の ${declaration} を切り出せません`);
  return new Function(`return ${src.slice(open, end + 1)};`)();
}

function loadPatternsFromTest() {
  const src = readFileSync(TEST_PATH, "utf8");
  const patterns = sliceLiteral(src, "const SECRET_PATTERNS", "[", "]");
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error(`${TEST_PATH} から取り出した判定の形が空です`);
  }
  for (const p of patterns) {
    if (typeof p?.name !== "string" || !(p?.re instanceof RegExp)) {
      throw new Error(`${TEST_PATH} から取り出した判定の形が想定と違います`);
    }
  }
  /*
   * 「形は秘密と同じだが秘密ではない」と確かめ済みの指紋も、同じファイルから読み出す。
   * こちらで作り直すと、**入口の門が許した値と履歴の走査が許す値がずれる。**
   */
  const known = sliceLiteral(src, "const KNOWN_NOT_SECRET", "{", "}");
  return {
    patterns: patterns.map(({ name, re }) => ({ name, re: new RegExp(re.source, "g") })),
    known,
  };
}

/**
 * 正本の物差しに無い発行元。**参考値として別に数える。**
 * 混ぜないのは、履歴側だけ広い物差しを使うと「入口では通るが履歴では当たる」形が
 * 生まれ、どちらが正しいのか誰も言えなくなるためである。
 */
const SUPPLEMENTARY = [
  { name: "[補助] GitHub の細粒度トークン", re: new RegExp("github" + "_pat_[A-Za-z0-9_]{50,}", "g") },
  { name: "[補助] Google API キー", re: new RegExp("AIza" + "[0-9A-Za-z_-]{35}", "g") },
  { name: "[補助] xAI の API キー", re: new RegExp("xai-" + "[A-Za-z0-9]{40,}", "g") },
  { name: "[補助] Anthropic 系の短い接頭辞", re: new RegExp("sk-" + "[A-Za-z0-9]{40,}", "g") },
  {
    name: "[補助] Cloudflare の API トークン",
    re: new RegExp(
      "\\b(CLOUDFLARE|CF)_[A-Z0-9_]*(TOKEN|KEY)\\s*[=:]\\s*[\"']?[A-Za-z0-9_-]{37,}",
      "g",
    ),
  },
];

const fingerprint = (v) => createHash("sha256").update(v).digest("hex").slice(0, 16);

/**
 * 高エントロピーの見張り。**当たりではなく「濃さ」を数えるだけ。**
 * 出どころの分からない長い羅列は、指紋・識別子・base64 の断片と形の上で区別できない。
 * 当たり扱いにすると一覧が育って誰も読まなくなるので、
 * **件数の分布だけ**を出し、判断は人に残す。
 */
const HIGH_ENTROPY = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{32,}(?![A-Za-z0-9+/_-])/g;
function shannon(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** cat-file --batch の出力を切り分ける。中身は文字とは限らないので Buffer で読む。 */
function* parseBatch(buf) {
  let at = 0;
  while (at < buf.length) {
    const nl = buf.indexOf(0x0a, at);
    if (nl < 0) return;
    const header = buf.subarray(at, nl).toString("utf8");
    const [sha, type, sizeText] = header.split(" ");
    if (type === "missing" || sizeText === undefined) return;
    const size = Number(sizeText);
    const body = buf.subarray(nl + 1, nl + 1 + size);
    yield { sha, type, body };
    at = nl + 1 + size + 1; // 本文の後ろの改行を飛ばす
  }
}

/**
 * **0 件は、探す側が壊れていても出る。** 合成した見本に当たることを、走査の前に見る。
 * 見本は文字種を並べただけのもので、どこかの値の写しではない。
 * ここで当たらないなら走査そのものを始めない——0 件を「無かった」と読ませないため。
 */
function proveDetectorAlive(patterns) {
  const synthetic = `gh${"p"}_${"A1b2C3d4E5".repeat(4)}`;
  const alive = patterns.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(synthetic);
  });
  for (const { re } of patterns) re.lastIndex = 0;
  if (!alive) throw new Error("合成した見本に 1 つも当たりません（探す側が死んでいます）");
}

function main() {
  const { patterns, known } = loadPatternsFromTest();
  proveDetectorAlive(patterns);
  const revCount = Number(git(["rev-list", "--all", "--count"]).trim());

  // 履歴に届いたことのある全オブジェクト。**差分ではなく実体を読む。**
  // 差分（`log -p`）はマージの本文を既定で出さないので、マージだけで入った内容を落とす。
  const listing = git(["rev-list", "--objects", "--all"]).split("\n").filter(Boolean);
  const pathOf = new Map();
  const shas = [];
  for (const line of listing) {
    const sp = line.indexOf(" ");
    const sha = sp < 0 ? line : line.slice(0, sp);
    if (sp > 0) pathOf.set(sha, line.slice(sp + 1));
    shas.push(sha);
  }

  const hits = [];
  /** 形は当たったが、既に「秘密ではない」と確かめ済みのもの。**数は必ず出す。** */
  const knownHits = [];
  const supplementaryHits = [];
  const entropy = { candidates: 0, dense: 0 };
  const seen = { commit: 0, blob: 0, tag: 0, binary: 0, text: 0, bytes: 0 };

  const CHUNK = 500;
  for (let i = 0; i < shas.length; i += CHUNK) {
    const slice = shas.slice(i, i + CHUNK);
    const out = execFileSync("git", ["cat-file", "--batch"], {
      cwd: CWD,
      input: `${slice.join("\n")}\n`,
      maxBuffer: 512 * 1024 * 1024,
    });
    for (const { sha, type, body } of parseBatch(out)) {
      if (type === "tree") continue;
      if (type === "commit") seen.commit += 1;
      else if (type === "blob") seen.blob += 1;
      else if (type === "tag") seen.tag += 1;

      if (body.includes(0)) {
        seen.binary += 1;
        continue;
      }
      seen.text += 1;
      seen.bytes += body.length;
      const text = new TextDecoder("utf-8").decode(body);
      const where =
        type === "commit"
          ? `コミット ${sha.slice(0, 12)} の本体`
          : `${type} ${sha.slice(0, 12)}（経路 ${pathOf.get(sha) ?? "不明"}）`;

      for (const [bucket, list] of [
        [hits, patterns],
        [supplementaryHits, SUPPLEMENTARY],
      ]) {
        for (const { name, re } of list) {
          re.lastIndex = 0;
          for (const m of text.matchAll(re)) {
            const line = text.slice(0, m.index).split("\n").length;
            const print = fingerprint(m[0]);
            const target = print in known ? knownHits : bucket;
            const note = print in known ? `既知: ${known[print]}` : name;
            target.push(`${where}:${line} ${note}（指紋 ${print}）`);
          }
        }
      }

      for (const m of text.matchAll(HIGH_ENTROPY)) {
        entropy.candidates += 1;
        if (shannon(m[0]) >= 4.4) entropy.dense += 1;
      }
    }
  }

  const report = {
    実施日: new Date().toISOString().slice(0, 10),
    使った物差し: patterns.map((p) => p.name),
    走査したリビジョン数: revCount,
    列挙したオブジェクト数: shas.length,
    読んだオブジェクト: seen,
    正本の物差しでの当たり: hits.length,
    "既知（秘密ではないと確かめ済み）の当たり": knownHits.length,
    補助の物差しでの当たり: supplementaryHits.length,
    高エントロピー候補: entropy,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (hits.length > 0) {
    process.stdout.write(`\n--- 正本の物差しでの当たり（値は出しません） ---\n${hits.join("\n")}\n`);
  }
  if (knownHits.length > 0) {
    process.stdout.write(`\n--- 既知の当たり（秘密ではないと確かめ済み） ---\n${knownHits.join("\n")}\n`);
  }
  if (supplementaryHits.length > 0) {
    process.stdout.write(
      `\n--- 補助の物差しでの当たり（値は出しません） ---\n${supplementaryHits.join("\n")}\n`,
    );
  }
  // 当たりが有っても異常終了しない。**門ではない**ので、赤で止めるのではなく
  // 「何が当たったか」を人へ渡すのがこの手順の仕事である。
}

main();
