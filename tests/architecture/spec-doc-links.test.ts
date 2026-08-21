/** @tier 1 @req REQ-CI08 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 仕様の入口（`docs/spec/00-README.md`）から挙げられている文書が、実在することを見る。
 *
 * **なぜ足したか。**
 * `docs/product/traceability.md` S 節 REQ-CI08 の判定欄は、運用説明
 * （`docs/product/ci-cd-guide.md`）を自動検査の対象外とする理由として
 * 「`docs/spec/00-README.md` からの参照切れは**既存の文書検査で見る**」と書いていた。
 * 2026-08-21 に探したところ、**その検査は存在しなかった**。
 * `tests/` と `scripts/` のどこにも `00-README` を読む処理は無く、
 * `scripts/spec-freshness.mjs` は `docs/spec/**.md` の**指紋を取るだけ**で、
 * 文書の中のリンクは 1 度も辿っていない。
 * つまり、運用説明のファイル名を変えても改名しても、何も止めない状態だった。
 * 判定欄に書かれた「見ている」は、見ていないことの言い換えだった。
 *
 * **この検査が見ていないもの（先に書く）**:
 * 見るのは**ファイルが在るか**だけで、中身が説明として役に立つかは見ない。
 * 節見出しへの錨（`#…`）が実在するかも見ない。
 * また、入口に**書かれていない**文書があること（挙げ漏れ）も見ない。
 * 見ているのは「入口が指した先が空を指していない」ことである。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md（REQ-CI08）
 */
const ROOT = resolve(import.meta.dirname, "../..");
const INDEX = resolve(ROOT, "docs/spec/00-README.md");

/**
 * 文書から、相対で指された `.md` を拾う。
 *
 * 拾うのは 2 つの形だけ。
 *   - markdown のリンク `[名前](パス.md)`
 *   - 逆引用符で囲んだパス `` `パス.md` ``
 * 外部（`http:` / `https:`）と、`*` を含む書き方（複数を指すため 1 つに解けない）は外す。
 * 錨（`#…`）は落としてからファイル名だけを見る。
 */
const referencedDocs = (body: string): string[] => {
  const found = new Set<string>();
  const add = (raw: string) => {
    const path = raw.split("#")[0].trim();
    if (path === "" || path.includes("*")) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return; // http: など
    if (!path.endsWith(".md")) return;
    found.add(path);
  };
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) add(m[1]);
  for (const m of body.matchAll(/`([^`\n]+?\.md(?:#[^`\n]*)?)`/g)) add(m[1]);
  return [...found].sort();
};

describe("仕様の入口からの参照", () => {
  it("拾い方が、拾うべきものと拾ってはいけないものを見分ける（対照）", () => {
    // ここが緩むと、下の検査は「拾えていないから 0 件」で緑になる。
    expect(referencedDocs("[運用](../product/ci-cd-guide.md) を読む")).toEqual([
      "../product/ci-cd-guide.md",
    ]);
    expect(referencedDocs("`10-テスト戦略仕様.md` を見る")).toEqual(["10-テスト戦略仕様.md"]);
    // 錨は落として、ファイルの側だけを見る。
    expect(referencedDocs("`../product/ci-cd-guide.md#8-秘密情報`")).toEqual([
      "../product/ci-cd-guide.md",
    ]);
    // 外に出るものと、1 つに解けないものは拾わない。
    expect(referencedDocs("[外](https://example.com/a.md)")).toEqual([]);
    expect(referencedDocs("`../../system-spec/*.md`")).toEqual([]);
    // `.md` でないものは拾わない（コード片を文書として数えない）。
    expect(referencedDocs("`quality-gates.config.mjs`")).toEqual([]);
  });

  it("入口が挙げた文書はすべて実在する", () => {
    const refs = referencedDocs(readFileSync(INDEX, "utf8"));

    // **母集団の床**。拾えていなくても「参照切れ 0 件」は出る。実測（2026-08-21）24 件。
    expect(refs.length, "入口から参照を拾えていません").toBeGreaterThanOrEqual(20);

    const broken = refs.filter((rel) => !existsSync(resolve(dirname(INDEX), rel)));
    expect(broken, "入口が指している先に文書がありません").toEqual([]);
  });

  it("運用説明（REQ-CI08 の成果物）が、入口から実際に指されている", () => {
    // 上の検査は「指された先が在る」ことしか見ない。
    // 入口から**外された**場合は参照が 0 件になり、切れも 0 件のまま緑で通る。
    // REQ-CI08 が自動検査を省く理由に入口を挙げている以上、ここは名指しで留める。
    const refs = referencedDocs(readFileSync(INDEX, "utf8"));
    expect(refs, "運用説明が仕様の入口から辿れなくなっています").toContain(
      "../product/ci-cd-guide.md",
    );
    expect(existsSync(resolve(ROOT, "docs/product/ci-cd-guide.md"))).toBe(true);
  });
});
