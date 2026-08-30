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
 *
 * --- 塞げていないこと（塞いだつもりで残さないために書く）---
 *
 * **指紋そのものを、中身と一緒に手で書き換えれば通る。**
 * 中身を直したあと `sha256` を取り直して末尾へ書けば、この検査は INTACT と読む。
 * 塞ぐには中身から独立した鍵が要り、鍵は AI が読める場所に置けないので、
 * **ここでは塞げない。**塞げないものを塞いだことにしないため、明記しておく。
 *
 * ただし、この検査が捕まえようとしているのは**うっかり書いた人**である。
 * 指紋を取り直してまで通す人は、自分が何をしているか分かっている。
 * そして分かっている人の手書きは、変更の差分（`git diff`）に**生成元を
 * 一切触らずに生成物だけが変わった**形で残るので、読む人には見える。
 * 消えて見えなくなるのとは、残り方が違う。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PREFIX = "<!-- 生成物の指紋 sha256:";
const SUFFIX = " -->";

/** 指紋の行かどうか。 */
export function isStampLine(line) {
  return line.startsWith(PREFIX) && line.endsWith(SUFFIX);
}

/**
 * その文書が生成物か（指紋が焼いてあるか）を、**語の出現ではなく構造**で決める。
 *
 * 「`生成物の指紋` という語を含むか」で数えると、判定が**文書の言い回し**に乗る。
 * 別の言い回しをした生成物は静かに漏れ、生成物について説明しただけの文書は
 * 巻き込まれる。**誤検出は打った本人がその場で気づくが、見落としは誰も気づかない。**
 *
 * ここで見るのは「指紋として妥当な行が 1 本でもあるか」だけである。
 * 語を含む散文は行の形が違うので当たらない（誤検出も同時に消える）。
 *
 * 囲み（``` / ~~~）の中は数えない。**指紋の書き方を説明する文書は、
 * 本物と同じ行を例として引く。**引いた例で生成物に化けると、
 * 「説明を書くと赤くなる」が復活して、また文言のほうを曲げることになる。
 */
export function hasStampLine(text) {
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && isStampLine(line)) return true;
  }
  return false;
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
 * `trailing` は**指紋の行より後ろ**に書かれた行。ここも手書きなので、
 * 消えるところだった行として数える（`body` に混ぜると指紋の照合が狂う）。
 *
 * @returns {{ state: "INTACT" | "TAMPERED" | "UNPINNED", body: string, trailing: string[], pinned?: string, actual?: string }}
 */
export function inspectStamped(text) {
  const lines = text.replace(/\s+$/, "").split("\n");
  // **末尾の行だけを見ない。** 指紋の行の「後ろ」に書き足す人が必ず出る。
  // 末尾しか見ないと、その場合は「指紋が無い」に化けて、
  // 書き足した本人には身に覚えのない理由（指紋を外した）が返る。
  const at = lines.findLastIndex((l) => isStampLine(l));
  if (at === -1) return { state: "UNPINNED", body: lines.join("\n"), trailing: [] };
  const body = lines.slice(0, at).join("\n");
  const after = lines.slice(at + 1).filter((l) => l.trim() !== "");
  const line = lines[at];
  const pinned = line.slice(PREFIX.length, line.length - SUFFIX.length);
  const actual = digestOf(body);
  if (after.length === 0 && pinned === actual) return { state: "INTACT", body, trailing: [] };
  return { state: "TAMPERED", body, trailing: after, pinned, actual };
}

/**
 * **消えるところだった行**を拾う。
 *
 * いまディスクにあって、これから書く中身には無い行が、上書きしていたら
 * 消えていたものである。「一致しません」だけを出すと、打った人は
 * 再生成して先へ進む。**消えかけた中身そのものを見せて初めて、
 * 書いた本人がそこで気づける。**
 */
export function wouldBeLost(diskBody, nextBody) {
  const next = new Set(nextBody.split("\n").map((l) => l.trim()));
  return diskBody
    .split("\n")
    .filter((l) => l.trim() !== "" && !next.has(l.trim()))
    .slice(0, 20);
}

/** 止めるときの言い分。**何が起きたか**と**どう戻すか**を必ず両方書く。 */
export function tamperMessage(path, found, nextBody = "") {
  // 指紋の後ろに書かれた行も、上書きすれば同じように消える。
  const lost = wouldBeLost([found.body, ...(found.trailing ?? [])].join("\n"), nextBody);
  const lostBlock =
    lost.length === 0
      ? ["  （消えるところだった行は見つかりませんでした。並び順だけの違いかもしれません）"]
      : [
          "  **上書きしていたら、この行が消えていました:**",
          ...lost.map((l) => `    ${l}`),
          lost.length === 20 ? "    …（20 行まで）" : "",
        ].filter((l) => l !== "");

  if (found.state === "TAMPERED") {
    return [
      `${path} は、機械が作ったあとに手で書き換えられています。`,
      // 指紋の**後ろ**に書き足された場合は、2 つの指紋が一致する。
      // そこで同じ 16 桁を 2 行並べると、読んだ人は「合っているのに落ちた」と
      // 受け取って、理由を探すのをやめてしまう。何が起きたかを言葉で書く。
      ...(found.pinned === found.actual
        ? ["  指紋そのものは合っていますが、**指紋の行より後ろに行が足されています。**"]
        : [
            `  焼いてある指紋: ${found.pinned.slice(0, 16)}…`,
            `  いまの中身から: ${found.actual.slice(0, 16)}…`,
          ]),
      "",
      ...lostBlock,
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
    ...lostBlock,
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
      throw new Error(tamperMessage(path, found, body));
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
      throw new Error(tamperMessage(path, found, block));
    }
  }
  const stamped = stamp(block);
  writeFileSync(
    path,
    current !== undefined ? doc.replace(marker, stamped) : `${doc.trimEnd()}\n\n${stamped}\n`,
    "utf8",
  );
}
