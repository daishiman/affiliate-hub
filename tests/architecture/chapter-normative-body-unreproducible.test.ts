/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 *
 * `equivalence` を名乗る根拠: 要件 ID を「章にある / 生成器出力にある」の 2 クラスへ分け、
 * **両方を見る**。片方（生成器出力が 0 件）だけを見ると、正規表現が何にも当たらない日にも
 * 同じ 0 が出る。章側の床（65 件以上）を同居させて、判定側が動いていることを示す。
 * `boundary` の根拠: 交差が **ちょうど 0 件**という境目そのものを見ていること。
 *
 * ── 主張 ───────────────────────────────────────────────
 *
 * **生成器 (`compile-spec-doc.py`) の出力には、章にある要件 ID
 * (`DB-*` / `BE-*` / `INF-*` / `*-REQ-*` / `*-ACC-*`) が 1 件も含まれない。**
 *
 * つまり `system-spec/*.md` は生成器の出力ではない。生成器で作り直すと、
 * いま章にある規範本文が消える。`chapter-regeneration-floor.test.ts`
 * (同じ REQ-TS15) は「再生成しても痩せないこと」の床を置いているが、
 * **床を置いた先が、そもそも再生成では届かない場所だった**というのがこの検査である。
 *
 * ── なぜ塞げないか ─────────────────────────────────────
 *
 * 難しいからではない。**章の規範本文が、正本 (`spec-state.json`) にも
 * 生成器のソースにも存在しないから**である。生成器は自分の持っていないものを
 * 描けない。塞ぐには規範本文を正本へ移す作業が要り、それは章の書き直しであって
 * 検査の書き直しではない。
 *
 * ── 反転先（塞がった日にすること。先に書いておく）──────────────────
 *
 * **規範本文が正本へ移り、生成器が描けるようになった日に、この検査は赤くなる。
 * そのとき削除せず「章の要件 ID がすべて生成器出力にも現れること」へ反転させる。**
 * 消すと、移したものが後で失われても誰も気づかない状態へ帰る。
 * 反転後は `expect(missing).toHaveLength(0)` の向きになり、床（65 件以上）は
 * そのまま母集団の担保として残す。
 *
 * ── 陽性対照 ──────────────────────────────────────────
 *
 * 「生成器出力に 0 件」は、生成器が壊れて空を吐いても同じ 0 になる。
 * そこで `decision-auth-method`（正本 `decisions[]` にあり、生成器が
 * `00-requirements-definition.md` へ確かに載せる ID）が出力に現れることを
 * 同じ検査に入れてある。**対照が落ちたら 0 の意味は無い。**
 *
 * ── 消える行の全文の在処 ────────────────────────────────
 *
 * 本文には貼らない（貼ると数の正本が 2 つできる。`chapter-regeneration-floor.test.ts`
 * が同じ理由で数を 1 箇所に置いている）。**決定論的に再現できるので、手順を置く:**
 *
 *   python3 .claude/plugins/system-spec-harness/skills/run-system-spec-compile/scripts/compile-spec-doc.py \
 *     compile --spec system-spec/spec-state.json \
 *             --references system-spec/fetched-references.json --out-dir <一時ディレクトリ>
 *   # そのうえで system-spec/*.md の各行が <一時ディレクトリ>/同名 に在るかを引く
 *
 * 2026-08-20 の実測値（**3 つとも正しく、対象が違う**）:
 *   - **374** = 消失行の**出現回数**（分母 = `system-spec/*.md` 10 枚の空行を除く全行）
 *   - **366** = **ファイルごとに重複を畳んだ**合計（同一ファイル内の同じ行を 1 と数える）
 *   - **316** = **10 枚を横断して重複を畳んだ**数（別ファイルの同じ行も 1 と数える）
 * ファイル別（出現回数）: database 58 / infrastructure 54 / maintenance-ops 44 /
 * backend 39 / security 37 / ui-ux 36 / auth 31 / index 35 / 00-requirements 5。
 * 中身は To-Be 規範契約表・Acceptance evidence 表・故障モード・初期 SLO・
 * index の状態軸と収集マトリクス・各章の最新ドキュメント出典行である。
 *
 * ── 数え方の注意（この検査を直す人へ）────────────────────────
 *
 * `git diff | grep -c '^-[^-]'` で数えないこと。**markdown の箇条書き削除
 * (`- foo` は `-- foo` として出る) と空行削除を取りこぼし、少ない側に外れる。**
 * 少なく出る向きの誤りは、多く出る向きより危険である（正しく見えるため）。
 * ここでは行集合の包含で測っている。
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const SPEC_DIR = join(ROOT, "system-spec");
const COMPILER = join(
  ROOT,
  ".claude/plugins/system-spec-harness/skills/run-system-spec-compile/scripts/compile-spec-doc.py",
);

/** 章の規範本文が使っている要件 ID の形。 */
const REQUIREMENT_ID = /\b[A-Z][A-Z0-9]*-(?:REQ|ACC)-\d+\b|\b(?:DB|BE|INF)-[A-Z]+-\d+\b/g;

/** 正本 decisions[] 由来で、生成器が確かに描く ID（陽性対照）。 */
const POSITIVE_CONTROL = "decision-auth-method";

/** 章側の要件 ID の床。2026-08-20 実測 65 件。下回ったら規範が失われている。 */
const CHAPTER_ID_FLOOR = 65;

function markdownIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort();
}

function idsIn(dir: string): Set<string> {
  const found = new Set<string>();
  for (const name of markdownIn(dir)) {
    for (const id of readFileSync(join(dir, name), "utf8").matchAll(REQUIREMENT_ID)) {
      found.add(id[0]);
    }
  }
  return found;
}

/** 生成器を一時ディレクトリへ走らせる。本番の system-spec/ には 1 バイトも書かない。 */
function compileToTemp(): string {
  const out = mkdtempSync(join(tmpdir(), "spec-compile-"));
  const proc = spawnSync(
    "python3",
    [
      COMPILER,
      "compile",
      "--spec",
      join(SPEC_DIR, "spec-state.json"),
      "--references",
      join(SPEC_DIR, "fetched-references.json"),
      "--out-dir",
      out,
    ],
    { encoding: "utf8" },
  );
  expect(proc.status, `生成器が失敗した: ${proc.stderr}`).toBe(0);
  return out;
}

describe("章の規範本文は生成器で再現できない (REQ-TS15 / 塞げない穴の固定)", () => {
  it("生成器の実体がある — 無ければ以下の 0 件は測れていないだけになる", () => {
    expect(existsSync(COMPILER)).toBe(true);
  });

  it("章側に要件 ID が 65 件以上ある（母集団の床。ここが空だと 0 件に意味が無い）", () => {
    const chapter = idsIn(SPEC_DIR);
    expect(chapter.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);
  });

  it("陽性対照: 生成器出力に decision-auth-method が現れる（測る側が動いている）", () => {
    const out = compileToTemp();
    const names = markdownIn(out);
    expect(names.length).toBeGreaterThan(0);
    const hits = names.filter((n) =>
      readFileSync(join(out, n), "utf8").includes(POSITIVE_CONTROL),
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("生成器出力に章の要件 ID は 1 件も現れない（塞げない穴。塞がった日に赤くなる）", () => {
    const out = compileToTemp();
    const chapter = idsIn(SPEC_DIR);
    const generated = idsIn(out);

    // 母集団の床を同じ it() の中に置く。章側が空でも 0 件は出るため。
    expect(chapter.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);

    const shared = [...chapter].filter((id) => generated.has(id)).sort();
    expect(shared).toEqual([]);

    // 反転先: 規範本文が正本へ移ったら、上を toEqual([...chapter].sort()) へ書き換える。
  });

  it("生成器は章の枚数ぶんを出す（出力が痩せて 0 件になっていない）", () => {
    const out = compileToTemp();
    expect(markdownIn(out).length).toBe(markdownIn(SPEC_DIR).length);
  });

  it("要件 ID は正本にも生成器ソースにも無い（『塞げない理由』の裏取り）", () => {
    const chapter = [...idsIn(SPEC_DIR)];
    expect(chapter.length).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);

    const state = readFileSync(join(SPEC_DIR, "spec-state.json"), "utf8");
    const libDir = join(ROOT, ".claude/plugins/system-spec-harness/lib");
    const libSource = readdirSync(libDir)
      .filter((n) => n.endsWith(".py"))
      .map((n) => readFileSync(join(libDir, n), "utf8"))
      .join("\n");

    // 対照: 正本を読めていることを、確かに在る ID で示す。
    expect(state).toContain(POSITIVE_CONTROL);
    expect(libSource.length).toBeGreaterThan(0);

    const reachable = chapter.filter((id) => state.includes(id) || libSource.includes(id));
    expect(reachable).toEqual([]);
  });

  // 2026-08-20 夕: 7 → 8。ui-ux.md にも『条項引用の可否』を載せたため、
  // 8 章すべてが対象になった。**見る章が増える向きの変更である。**
  // 減らす向き（8 → 7）は、節を落とした章を見逃すことになるので不可。
  it("2026-08-20 に追記した『条項引用の可否』節は 8 章とも生成器を往復する", () => {
    const out = compileToTemp();
    const withSection = markdownIn(SPEC_DIR).filter((n) =>
      readFileSync(join(SPEC_DIR, n), "utf8").includes("条項引用の可否"),
    );
    expect(withSection).toHaveLength(8);
    for (const name of withSection) {
      expect(
        readFileSync(join(out, name), "utf8"),
        `${name}: 節が生成器出力に無い`,
      ).toContain("条項引用の可否");
    }
  });
});
