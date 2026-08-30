/**
 * CSS の文面を規則ごとに切り出す。**複数の見張りが同じ切り出し方を使うための 1 箇所。**
 *
 * ここを共有にしてあるのは行数を惜しんだからではない。`surface-outline-count.test.ts`
 * で分かったとおり、**この検査の種類で間違うのは判定ではなく切り出し方のほう**である。
 * 切り出し方が見張りごとに別々だと、片方だけが `@media` の中を見落とす、片方だけが
 * 擬似クラスを別の規則として数える、という**見張りごとに違う母集団**が生まれる。
 * そのとき数は食い違うが、どちらも自分の中では整合しているので検算では見分けられない。
 *
 * **この module 自身は何も判定しない。**何を良しとするかは各見張りが持つ。
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const CSS_ROOT = process.cwd();

export type Rule = {
  /** リポジトリからの相対パス。 */
  readonly file: string;
  /** 空白を 1 つに畳んだセレクタ。例: `.table td > a, .table th > a` */
  readonly selector: string;
  /** 波括弧の中身（入れ子の規則は含まない）。 */
  readonly body: string;
  /** `@media` などの枠の中に在るか。**枠の外と同じ高さで拾ったうえで、印だけ残す。** */
  readonly inAtRule: boolean;
};

/** `dir` の下の `.css` を全部集める。 */
export function cssFilesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFilesUnder(full, out);
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

/**
 * 規則を切り出す。**`@media` の中も外と同じ高さで拾う。**
 *
 * 正規表現の `([^{}]+)\{([^{}]*)\}` では入れ子の外側が selector に化けるので、
 * 波括弧の深さを自分で数える。`@` で始まる枠そのものは規則として拾わず、
 * **中の規則だけを外と同じ列に並べる。**
 */
export function rulesOf(file: string): readonly Rule[] {
  const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const stack: string[] = [];
  let buffer = "";
  for (const ch of source) {
    if (ch === "{") {
      stack.push(buffer.trim());
      buffer = "";
    } else if (ch === "}") {
      const selector = stack.pop() ?? "";
      if (selector !== "" && !selector.startsWith("@")) {
        out.push({
          file: relative(CSS_ROOT, file),
          selector: selector.replace(/\s+/g, " "),
          body: buffer,
          inAtRule: stack.some((s) => s.startsWith("@")),
        });
      }
      buffer = "";
    } else buffer += ch;
  }
  return out;
}

/** `.button:hover:not(:disabled)` → `.button`。擬似クラス・擬似要素を落とす。 */
export function baseSelector(selector: string): string {
  return selector.replace(/::?[a-z-]+(\([^)]*\))?/g, "").trim();
}

/** 一覧や表示のための鍵。`ファイル :: セレクタ` の形で揃える。 */
export function keyOf(rule: Rule): string {
  return `${rule.file} :: ${rule.selector}`;
}

/**
 * 宣言の値を読む。**同じ属性が 2 回書いてあれば後ろが勝つ**（CSS と同じ）。
 * 無ければ `null`。
 *
 * **`-` で始まる派生を拾わない。**`min-width` を探して `min-width` だけを返し、
 * `border` を探して `border-radius` を返さない——`surface-outline-count.test.ts` の
 * ②「部分一致」がここで再発しないようにするための境界指定である。
 */
export function declarationOf(body: string, property: string): string | null {
  const re = new RegExp(String.raw`(?:^|[\s;])${property}\s*:\s*([^;}]*)`, "g");
  let value: string | null = null;
  for (const m of body.matchAll(re)) value = (m[1] ?? "").trim();
  return value;
}
