/**
 * @tier 1
 * @req REQ-TS12
 * @types equivalence, boundary
 *
 * ログイン不要の「静止した写し」を焼く道具を固定する。
 *
 * --- なぜ検査が要るのか ---
 *
 * 写しは、見た目を見て判断してもらうために渡す。だから写しが実物からずれると、
 * ずれた見た目のほうで判断が決まる。しかも**ずれは見た目から分からない**。
 * トークンの CSS が読めていなければ、素の見た目の 1 枚が
 * 「これが実物です」という顔で出てくるだけで、開いた人には区別がつかない。
 *
 * ここで止めるのは 1 点である。
 *
 *   **本物の CSS を読まずに書き出せてしまう経路が無いこと。**
 *
 * --- 通る例と止まる例を両方入れてある ---
 *
 * 空を渡すと投げること（止まる例）だけを見ていると、判定が
 * 「常に投げる」に化けた日も緑のままになる。逆に、そろった入力で
 * 焼けること（通る例）だけを見ていると、判定が「常に通す」に化けた日に
 * 気づけない。両方を同じ検査に入れて、どちらへ化けても赤になるようにしてある。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_DIFFERENCES,
  STATIC_NOTE,
  buildDocument,
  findModuleCss,
} from "../../scripts/lib/static-preview.mjs";

const ROOT = process.cwd();

/** そろっている入力。ここから 1 つずつ欠けさせて「止まる例」を作る。 */
const COMPLETE = {
  tailwindCss: ":root{--color-surface-default:#fff}",
  moduleCss: [{ path: "src/x.module.css", text: ".navLink{padding:8px}" }],
  bodyHtml: '<div class="navLink">商品</div>',
  htmlAttributes: { lang: "ja" },
  generatedAt: "2026-08-19",
} as const;

type Input = Parameters<typeof buildDocument>[0];

describe("静止した写しの組み立て（通る例）", () => {
  it("そろった入力なら 1 枚に焼ける", () => {
    const html = buildDocument(COMPLETE as unknown as Input);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ja">');
  });

  it("渡した CSS を、字を変えずにそのまま埋める", () => {
    const html = buildDocument(COMPLETE as unknown as Input);

    // 写し直すと、写した側だけ直したときに黙ってずれる。そのままであることを見る。
    expect(html).toContain(COMPLETE.tailwindCss);
    expect(html).toContain(COMPLETE.moduleCss[0].text);
    expect(html).toContain(COMPLETE.bodyHtml);
  });

  it("押しても動かないことが、開いた人の読める場所と、ふるまいの両方にある", () => {
    const html = buildDocument(COMPLETE as unknown as Input);

    expect(html).toContain(STATIC_NOTE);
    for (const line of KNOWN_DIFFERENCES) {
      expect(html).toContain(line);
    }
    // 文だけだと、案内を押した人にはブラウザの「ファイルがありません」が出る。
    // それは「動かない」ではなく「壊れている」と読まれるので、中身ごと止めてある。
    expect(html).toContain("<div inert>");
  });
});

describe("静止した写しの組み立て（止まる例）", () => {
  const missing: readonly (readonly [string, Partial<Input>])[] = [
    ["トークンの CSS が空", { tailwindCss: "" }],
    ["トークンの CSS が空白だけ", { tailwindCss: "  \n " }],
    ["部品の CSS が 1 つも無い", { moduleCss: [] }],
    ["部品の CSS の中身が空", { moduleCss: [{ path: "src/x.module.css", text: "" }] }],
    ["中身が空", { bodyHtml: "" }],
  ];

  for (const [name, hole] of missing) {
    it(`${name}なら焼かずに投げる`, () => {
      expect(() => buildDocument({ ...(COMPLETE as unknown as Input), ...hole })).toThrow();
    });
  }
});

describe("本物の CSS を読まずに書き出せる経路が無い", () => {
  it("部品の CSS の一覧は、手で書かずに src からさがして作る", () => {
    const found = findModuleCss(ROOT);

    // 手で並べた一覧だと、新しく足した `.module.css` は書き足すまで写しに入らず、
    // 入っていないことが見た目から分からない（その部品だけ素の見た目で焼かれる）。
    expect(found.length).toBeGreaterThan(0);
    // さがす先を狭めても「0 件ではない」は通ってしまうので、
    // 別々の枝にある 2 枚が両方入っていることを見る。片枝に狭めた時点で赤になる。
    expect(found).toContain("src/app/admin/admin.module.css");
    expect(found).toContain("src/presentation/ui/primitives/ui.module.css");
    for (const path of found) {
      expect(path.startsWith("src/")).toBe(true);
      expect(path.endsWith(".module.css")).toBe(true);
      expect(readFileSync(join(ROOT, path), "utf8").trim()).not.toBe("");
    }
  });

  it("焼く側にトークンの写しが置かれていない", () => {
    // トークンの定義がここに現れたら、それは本物を読まずに書ける経路である。
    for (const path of ["scripts/lib/static-preview.mjs", "scripts/write-static-preview.tsx"]) {
      expect(readFileSync(join(ROOT, path), "utf8")).not.toContain("--color-");
    }
  });

  it("焼く側は、本物の入口 CSS と本物の道具を通している", () => {
    const writer = readFileSync(join(ROOT, "scripts/write-static-preview.tsx"), "utf8");

    expect(writer).toContain("src/app/globals.css");
    expect(readFileSync(join(ROOT, "src/app/globals.css"), "utf8").trim()).not.toBe("");
    // アプリが使っている道具そのもの。別の道具に差し替わると出る CSS が変わる。
    expect(writer).toContain("@tailwindcss/postcss");
    expect(writer).toContain("buildDocument");
  });

  it("焼いた写しは、どれもアプリが配る場所へは置かない", () => {
    const writer = readFileSync(join(ROOT, "scripts/write-static-preview.tsx"), "utf8");
    const outputs = [...writer.matchAll(/const \w*OUT = "([^"]+)"/g)].map((match) => match[1]);

    // `public/` へ置くと、門を通さずにアプリ自身が配ってしまう。
    // それは「別に作った静止画」ではなく、入口に開けた穴になる。
    // （門そのものは `tests/architecture/open-doors.test.ts` が測っている。）
    expect(outputs.length).toBeGreaterThan(0);
    for (const out of outputs) {
      expect(out.startsWith("docs/")).toBe(true);
      expect(out.startsWith("public/")).toBe(false);
      expect(out.startsWith("src/")).toBe(false);
    }
  });
});
