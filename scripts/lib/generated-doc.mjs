/**
 * 「機械が作る。手で書き換えない」と書いてある文書が、**本当に生成物であること**を
 * 機械で保証する。
 *
 * --- 何を直しているか ---
 *
 * `docs/product/` の 4 枚（`port-wiring-report.md` / `required-test-types-report.md` /
 * `test-traceability.md` / `coverage.md` の囲み）は、スクリプトが毎回**上書き**していた。
 * 上書きは修復ではなく**消去**である。手で 1 行書いた人は `pnpm run verify` が
 * 緑なのを見て、書いたものが残っていると思う。**消えたことは緑として現れる。**
 *
 * ここでやることは 2 つだけ。
 *
 *   1. 生成した中身の指紋を、末尾に焼く
 *   2. **上書きする前に**、いまディスクにあるものの指紋と中身を突き合わせる
 *
 * 2 の「前に」が要点である。書いてから直すのでは、消えたことは見えないままになる。
 * 合わなければ**書かずに止める**ので、手で書いた行はディスクに残ったまま赤になる。
 *
 * --- なぜ「内容が合っていれば通る」では駄目だったのか ---
 *
 * 既存の 4 枚（A 群）はテストが生成結果と比較しており、答えている問いは
 * 「**この文書は古くないか**」である。文書の頭に書いてあるのは
 * 「**手で書かれていないか**」で、読む人はこの 2 つを同じものとして受け取る。
 * 先に正本を直してから同じ内容を手で書けば、内容は一致するので通ってしまう。
 * 指紋は中身そのものから作るので、**1 文字でも手で書けば合わなくなる**。
 *
 * --- 指紋の行を消したらどうなるか ---
 *
 * 指紋が無い状態（UNPINNED）は、いまから書こうとしている中身と
 * ディスクの中身が**完全に一致するときだけ**通す。一致するなら手で書かれた行は
 * 無いということなので、失われるものが無い（指紋を焼き直して先へ進む）。
 * 一致しなければ、指紋を消したうえで書き換えたということなので止まる。
 * この作りにしてあるので、**「初回だけ通す抜け道」を用意しなくてよい。**
 * 抜け道は、用意した回ではなく、次に誰かが使う回に効いてくる。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PREFIX = "<!-- 生成物の指紋 sha256:";
const SUFFIX = " -->";

/** 指紋の行かどうか。 */
export function isStampLine(line) {
  return line.startsWith(PREFIX) && line.endsWith(SUFFIX);
}

/** 中身から指紋を作る。改行の揺れで変わらないよう、末尾の空白は落としてから取る。 */
export function digestOf(content) {
  return createHash("sha256").update(content.replace(/\s+$/, ""), "utf8").digest("hex");
}

/** 焼く行。 */
export function stampLine(content) {
  return `${PREFIX}${digestOf(content)}${SUFFIX}`;
}

/** 中身の末尾に指紋を焼く。 */
export function stamp(content) {
  const body = content.replace(/\s+$/, "");
  return `${body}\n${stampLine(body)}`;
}

/**
 * 焼いてあるものを見る。
 *
 * @returns {{ state: "INTACT" | "TAMPERED" | "UNPINNED", body: string, pinned?: string, actual?: string }}
 */
export function inspectStamped(text) {
  const lines = text.replace(/\s+$/, "").split("\n");
  // **末尾の行だけを見ない。** 指紋の行の「後ろ」に書き足す人が必ず出る。
  // 末尾しか見ないと、その場合は「指紋が無い」に化けて、
  // 書き足した本人には身に覚えのない理由（指紋を外した）が返る。
  const at = lines.findLastIndex((l) => isStampLine(l));
  if (at === -1) return { state: "UNPINNED", body: lines.join("\n") };
  const body = lines.slice(0, at).join("\n");
  const after = lines.slice(at + 1).filter((l) => l.trim() !== "");
  const line = lines[at];
  const pinned = line.slice(PREFIX.length, line.length - SUFFIX.length);
  const actual = digestOf(body);
  if (after.length === 0 && pinned === actual) return { state: "INTACT", body };
  return { state: "TAMPERED", body, pinned, actual };
}

/** 止めるときの言い分。**何が起きたか**と**どう戻すか**を必ず両方書く。 */
export function tamperMessage(path, found) {
  if (found.state === "TAMPERED") {
    return [
      `${path} は、機械が作ったあとに手で書き換えられています。`,
      `  焼いてある指紋: ${found.pinned.slice(0, 16)}…`,
      `  いまの中身から: ${found.actual.slice(0, 16)}…`,
      "",
      "  **書き換えずに止めました。**手で書いた行はまだそこにあります。",
      "  上書きしてしまうと、書いた本人には緑に見えたまま消えます。",
      "",
      `  戻すには: git checkout -- ${path}`,
      "  そのうえで、書きたかったことは生成元（この文書を作っているスクリプトかテスト）へ書いてください。",
    ].join("\n");
  }
  return [
    `${path} は、指紋の行が外されたうえで中身も変わっています。`,
    "  指紋を消せば通るようにはしていません。",
    "",
    `  戻すには: git checkout -- ${path}`,
  ].join("\n");
}

/**
 * ファイル全体が生成物のとき。
 *
 * 書く前に見る。合わなければ**書かずに投げる**。
 */
export function writeGeneratedDoc(path, body) {
  if (existsSync(path)) {
    const found = inspectStamped(readFileSync(path, "utf8"));
    // UNPINNED でも、中身がこれから書くものと同じなら失われるものは無い。
    // 違うなら、指紋を外したうえで書き換えたということなので止める。
    const same = found.body.replace(/\s+$/, "") === body.replace(/\s+$/, "");
    if (found.state === "TAMPERED" || (found.state === "UNPINNED" && !same)) {
      throw new Error(tamperMessage(path, found));
    }
  }
  writeFileSync(path, `${stamp(body)}\n`, "utf8");
}

/**
 * ファイルの一部だけが生成物のとき（`coverage.md`）。
 *
 * 囲みの外は人が書く場所なので、指紋は**囲みの中身にだけ**かける。
 * 外まで含めると、人が本文を直すたびに赤くなり、
 * やがて「どうせ毎回赤い」と扱われて誰も見なくなる。
 *
 * @param {RegExp} marker 囲みを丸ごと拾う式（指紋の行まで含めて拾えること）
 */
export function writeGeneratedBlock(path, marker, block) {
  const doc = existsSync(path) ? readFileSync(path, "utf8") : "";
  const current = doc.match(marker)?.[0];
  if (current !== undefined) {
    const found = inspectStamped(current);
    const same = found.body.replace(/\s+$/, "") === block.replace(/\s+$/, "");
    if (found.state === "TAMPERED" || (found.state === "UNPINNED" && !same)) {
      throw new Error(tamperMessage(path, found));
    }
  }
  const stamped = stamp(block);
  writeFileSync(
    path,
    current !== undefined ? doc.replace(marker, stamped) : `${doc.trimEnd()}\n\n${stamped}\n`,
    "utf8",
  );
}
