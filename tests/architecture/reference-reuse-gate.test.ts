/** @tier 1 */
/** @req REQ-BOPS13 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "../../quality-gates.config.mjs";

/**
 * 転用ゲート (`scripts/check-reference-site-reuse.mjs`) の**逆向きの検査**を見る。
 *
 * 元の検査は「見たファイルの中身」を見る。中身が綺麗なら緑になる。
 * だが走査対象そのものが痩せれば、中身を見ないまま緑になる。
 * **痩せたことが赤にならない検査は、痩せた日から飾りになる。**
 *
 * ここで確かめるのは 1 点だけ。母集団に居るのに走査もされず除外理由も無いファイルが
 * 現れたとき、ゲートが**そのファイル名を挙げて落ちる**こと。
 * 陽性対照を持たないと「漏れ 0 件」が「漏れが無い」なのか
 * 「数え方が壊れている」なのか区別できない。
 */

const GATE = "scripts/check-reference-site-reuse.mjs";
const REPO = join(__dirname, "..", "..");

/** ゲートを走らせ、終了コードと出力を返す。落ちても投げない。 */
function runGate(root: string): { code: number; out: string } {
  try {
    const out = execFileSync("node", [join(REPO, GATE), root], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * 検査用の小さな repo を作る。
 *
 * 本物の repo を相手にすると、この検査は「今日の repo が綺麗か」を見てしまう。
 * 見たいのは**ゲートの数え方**なので、母集団と除外だけを持つ最小の木を組む。
 */
function fixtureRoot(): string {
  // **書き込み先は必ず OS の一時ディレクトリで、repo の docs/ には 1 バイトも書かない。**
  // ゲートの glob が `docs/spec/...` という並びを要求するので、木の形だけを真似る。
  // パスを 1 本の文字列リテラルではなく分割して組むのは、
  // `generated-docs.test.ts` の「docs/ の生成物を直接書いていないか」検査が
  // リテラルで見分けており、この fixture を repo の生成物と取り違えるため。
  // 検査を避けたいのではなく、**見分けの対象ではないことを形で示している**。
  const root = mkdtempSync(join(tmpdir(), "reference-reuse-gate-"));
  const spec = join(root, "docs", "spec", "feat-reference-blog-admin-ux");
  const analysis = join(root, "scripts", "reference-site-analysis");
  mkdirSync(join(spec, "evidence"), { recursive: true });
  mkdirSync(join(analysis, "__pycache__"), { recursive: true });

  // 走査される側。1 件も無いとゲートは別の理由 (走査が壊れている) で落ちる。
  writeFileSync(join(spec, "notes.md"), "# 抽象仕様\n");
  writeFileSync(join(analysis, "collect.py"), "VALUE = 1\n");
  // 隔離先。実名を持っていても落ちてはいけない。
  writeFileSync(
    join(spec, "evidence/reference-url-inventory.raw.json"),
    '{"url": "https://quarantined-host.invalid.example/"}\n',
  );
  writeFileSync(join(analysis, "__pycache__/collect.pyc"), "generated\n");
  return root;
}

describe("参考サイト転用ゲートの被覆", () => {
  it("母集団が全部走査されていれば通る", () => {
    const result = runGate(fixtureRoot());
    expect(result.out, result.out).toContain("被覆の検査: 実行");
    expect(result.code, result.out).toBe(0);
  });

  it("隔離先と生成物は、理由つき除外として走査から外れる", () => {
    // 外れていることを件数で言い切る。raw.json と .pyc が混ざれば 2 件になる。
    const result = runGate(fixtureRoot());
    expect(result.out).toContain("検査したファイル: 2 件");
  });

  it("母集団に走査されないファイルが増えたら、名前を挙げて落ちる", () => {
    // これが赤にならないなら、走査対象は黙って痩せられる。
    const root = fixtureRoot();
    writeFileSync(join(root, "scripts/reference-site-analysis/helper.mjs"), "export {};\n");

    const result = runGate(root);
    expect(result.code, result.out).toBe(1);
    expect(result.out).toContain("走査から漏れているファイルが 1 件あります");
    expect(result.out).toContain("scripts/reference-site-analysis/helper.mjs");
  });

  it("品質ゲートの一覧に、止める検査として載っている", () => {
    // 手元で走らせるだけでは、走らせなかった日の混入が誰にも見えない。
    const check = CHECKS.find((c) => c.id === "reference-reuse");
    expect(check, "reference-reuse が CHECKS にありません").toBeDefined();
    expect(check?.blocking).toBe(true);
    expect(check?.tier).toBe(1);
  });
});
