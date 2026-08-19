/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 詰まり具合を固定する。
 *
 * 「詰まっている」と言われて直したことのうち、放っておくと元に戻るものだけを見る。
 * 見た目の崩れそのものを見つける手段はまだ無い（画像で比べる仕組みが無い）ので、
 * ここで見ているのは崩れではなく、**崩れを生んだ書き方が戻ってきたこと**である。
 * 崩れ全般を捕まえていると読み違えないよう、この区別を消さないこと。
 *
 * 見ているのは 5 点:
 *   1. 指の当たり判定の値を行送りに使わない（1 行が不要に 16px 高くなる）
 *   2. 押せるものの高さの下限は残っている（1 を直すときに一緒に消しやすい）
 *   3. 画面の器が縦の間隔を持つ（無いとカードどうしが線で接する）
 *   4. 読ませる文に行の長さの上限がある（無いと画面幅ぶん 1 行が伸びる）
 *   5. 見本帳の「直す前」が、直す前の値を保っている（消えると見比べが無意味になる）
 */

const ROOT = process.cwd();
const UI_DIR = join(ROOT, "src/presentation/ui");
const SHELL_CSS = join(UI_DIR, "primitives/ui.module.css");
const ADMIN_CSS = join(ROOT, "src/app/admin/admin.module.css");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 単一のセレクタ規則の中身だけを取り出す。入れ子は使っていない前提。 */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `${selector} が見つかりません`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", at);
  return css.slice(at, end);
}

describe("詰まり具合", () => {
  it("部品の CSS は、指の当たり判定の値を行送りに使わない", () => {
    // 高さの下限と行送りは別のもの。同じ値を両方に置くと、
    // 下限で足りている高さに行送りぶんが積み増され、上下の余白と二重になる。
    const offenders: string[] = [];
    for (const file of walk(UI_DIR).filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(file, "utf8");
      for (const m of css.matchAll(/line-height:\s*var\(\s*(--[a-z0-9-]+)/gi)) {
        if (m[1].includes("tap-target") || m[1].includes("hit-")) {
          offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toStrictEqual([]);
  });

  it("案内の 1 行は、詰めたあとも押せる大きさの下限を持っている", () => {
    // 行送りを詰めるときに、高さの下限まで一緒に消すと、
    // 見た目は詰まるが指では押せなくなる。詰める側の直しが越えてはいけない線。
    expect(ruleBody(readFileSync(SHELL_CSS, "utf8"), ".navLink")).toContain(
      "min-height: var(--tap-target-min)",
    );
  });

  it("画面の器が、縦の間隔を 1 箇所で持っている", () => {
    // カードにも注意書きにも外余白は無い。器が間隔を持たないと、
    // 中身を 2 つ以上置いた画面でだけ線どうしが接する。
    expect(ruleBody(readFileSync(SHELL_CSS, "utf8"), ".page")).toMatch(/\n\s*gap:\s*var\(--space-/);
  });

  it("読ませる文に、行の長さの上限がある", () => {
    // 上限が無いと、画面を広げたぶんだけ 1 行が伸びて戻り先を見失う。
    // 表やカードは広く使ってよいので、器ではなく文の側に置く。
    const shell = readFileSync(SHELL_CSS, "utf8");
    const admin = readFileSync(ADMIN_CSS, "utf8");
    expect(ruleBody(shell, ".pageLead")).toContain("max-width: var(--readable-max-width)");
    expect(ruleBody(admin, ".sectionLead")).toContain("max-width: var(--readable-max-width)");
  });

  it("見本帳の「直す前」は、直す前の値を保っている", () => {
    // ここだけは、直す前の書き方をわざと残している（上の 1 の対象外なのはそのため）。
    // 片付けられると、見比べが「同じものが 2 つ並ぶだけ」になり、
    // しかも見た目は成立してしまうので誰も気づかない。
    const admin = readFileSync(ADMIN_CSS, "utf8");
    expect(ruleBody(admin, ".densityNavRow")).toContain("line-height: var(--tap-target-min)");
    expect(ruleBody(admin, ".densityCards")).toContain("gap: 0");
    expect(ruleBody(admin, ".densityProse")).not.toContain("max-width");
  });
});
