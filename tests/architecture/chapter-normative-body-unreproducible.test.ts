/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 *
 * `equivalence` を名乗る根拠: 規範定義本文を「章にある / 生成器出力にある」の 2 クラスへ分け、
 * **両方を見る**。片方（生成器出力が 0 件）だけを見ると、探し方が何にも当たらない日にも
 * 同じ 0 が出る。章側の床（65 件以上）と「章には 65/65 在る」対照を同居させて、
 * 判定側が動いていることを示す。
 * `boundary` の根拠: 交差が **ちょうど 0 件**という境目そのものを見ていること。
 *
 * ── 主張 ───────────────────────────────────────────────
 *
 * **生成器 (`compile-spec-doc.py`) の出力には、章にある要件
 * (`DB-*` / `BE-*` / `INF-*` / `*-REQ-*` / `*-ACC-*`) の**定義本文**が 1 件も含まれない。**
 * ID そのものは引用として 2 件現れるが、それは定義ではない（下の 2026-08-20 の節を見ること）。
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
 * ── 2026-08-20: 代理指標が壊れ、測る対象を 2 本に割った ─────────────
 *
 * この検査は元々「**素の ID** が生成器出力に 1 件も現れない」で測っていた。
 * 素の ID の出現は、規範定義が再現されていないことの**代理**に置いた目印である。
 *
 * ui-ux×web の確定で、正本の qa_log に「`system-spec/ui-ux.md` の `UIUX-REQ-001` は
 * …と書いている」という**章を出典として名指しした食い違い記録**が入った。
 * その瞬間、素の ID は生成器出力に現れるようになった——**規範定義は 1 文字も
 * 移っていないのに**である。代理が代理として成立しなくなった。
 *
 * そこで測る対象を 2 本に割った。**片方だけでは足りない。**
 *
 *   (1) **主張の本体**: 章の表の「1 列目が要件 ID である行」の 2 列目全文が、
 *       生成器出力に含まれないこと。**0 件。遊び無し。**
 *       素の ID より厳しい——ID が引用で出るだけでは赤くならないが、
 *       定義文が 1 文字違わず出たら赤くなる。
 *   (2) **引用のほう**: 出力に現れる素の ID の**異なり数**に上限 2（実測 2、遊び 0）、
 *       **かつ**各出現が属する `##` 節が章ファイルを名指ししていること。
 *
 * **(2) は 0 → 2 の緩和ではない。**0 のままなのは (1) の定義側で、上限 2 が乗るのは
 * 引用という別の対象である。**同じ数字でも対象が違う。**
 * （同じ対象の上限を 0 → 2 へ上げる形は緩和であり、それはしていない。）
 *
 * 2026-08-20 の実測（分母つき）:
 *   - 定義行が取れた ID: **65 / 65**（章の素の ID 総数 65 と一致。取りこぼし 0）
 *   - 定義全文が生成器出力にある: **0 / 65**。章にある: **65 / 65**（探し方が動いている対照）
 *   - 出力の素の ID: **8 行 / 異なり 2**（`UIUX-REQ-001`, `UIUX-REQ-003`）。
 *     8 行すべてが `## 既存記録との食い違い（均さずに両方残す）` 節の中にあり、
 *     その節は `system-spec/ui-ux.md` を名指ししている。
 *
 * ── 反転先（塞がった日にすること。先に書いておく）──────────────────
 *
 * **定義全文が出力に現れた日に (1) が赤くなる。そのとき削除せず
 * 「章の全 ID の定義全文が出力にもあること」へ反転させる。**
 * 消すと、移したものが後で失われても誰も気づかない状態へ帰る。
 * 反転後は `expect(missing).toHaveLength(0)` の向きになり、床（65 件以上）は
 * そのまま母集団の担保として残す。
 * **(2) の上限 2 は、定義が移った時点で役目が変わる**（引用と定義の区別が
 * 意味を失う）ので、(1) の反転と**同時に**見直すこと。片方だけ反転させると、
 * 「引用しか無い」前提のまま定義を通す穴になる。
 *
 * **予告が外れた事実を残す（2026-08-20）**: 旧版の反転先は「全 ID が出力に現れる」か
 * 「0 件のまま」かの二択で書いてあった。実際に来たのは**どちらでもない中間**
 * ——65 件中 2 件だけが、定義ではなく引用として現れる形だった。
 * 反転先を書くときは「全か無か」で書けると思わないこと。
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
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

/** 上と同じ形を、セル全体との一致に使う版（`g` を付けない。`lastIndex` を持ち回らないため）。 */
const REQUIREMENT_ID_EXACT =
  /^(?:[A-Z][A-Z0-9]*-(?:REQ|ACC)-\d+|(?:DB|BE|INF)-[A-Z]+-\d+)$/;

/**
 * markdown の表を列へ割る。
 *
 * **`\|` で退避したパイプを区切りと読まないこと。**素朴に `split("|")` すると
 * `DB-STATE-01`（`approval_status = pending \| approved \| …`）が 10 列に割れ、
 * 定義本文が途中で切れる。切れた文字列は生成器出力に当たらないので、
 * **交差 0 件が「本当に無い」ではなく「探し方が短すぎた」で出る。**
 * 2026-08-20 に実際にそれで 65 件中 2 件を取りこぼした。
 */
function cellsOf(line: string): string[] {
  return line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((s) => s.trim());
}

/**
 * 章の表から「要件 ID → 定義本文（その行の 2 列目全文）」を取る。
 *
 * `## To-Be` だけを見ないこと。To-Be 表を持つのは 11 節の形の 5 章だけで、
 * `*-ACC-*` と `DB/BE/INF-*` は Acceptance evidence 表や 6 節の形の章にある。
 * **表の見出しではなく「1 列目が要件 ID である行」で拾う**と 65 件すべて取れる
 * （2026-08-20 実測: 2 列 24 件 + 3 列 41 件 = 65 件、床 65 と一致）。
 */
function definitionsInChapters(): Map<string, { def: string; file: string }> {
  const defs = new Map<string, { def: string; file: string }>();
  for (const name of markdownIn(SPEC_DIR)) {
    for (const line of readFileSync(join(SPEC_DIR, name), "utf8").split("\n")) {
      if (!line.startsWith("|")) continue;
      const cells = cellsOf(line);
      if (cells.length < 2 || !REQUIREMENT_ID_EXACT.test(cells[0])) continue;
      if (!defs.has(cells[0])) defs.set(cells[0], { def: cells[1], file: name });
    }
  }
  return defs;
}

/** 素の ID の出現 1 件ぶん。`namesChapter` は「その `##` 節が章ファイルを名指ししているか」。 */
type Occurrence = { file: string; line: number; ids: string[]; namesChapter: boolean };

/**
 * ディレクトリ内の .md から素の ID の出現を拾い、**その出現が属する `##` 節**が
 * 章ファイル（`system-spec/….md`）を名指ししているかを併せて返す。
 *
 * 節の粒度を `##` にしてある。`###` まで細かくすると、同じ 1 つの食い違い記録が
 * 小見出しで分割され、**名指しの無い小見出しの側だけが違反に見える。**
 * 名指しは記録の単位で 1 回あればよく、段落ごとに繰り返すものではない。
 */
function bareIdOccurrences(dir: string): Occurrence[] {
  // **【2026-08-25 追記】名指しを「その文字列が在るか」で見ていた。**
  //
  // 2026-08-25 に生成器が `## 章の注記 (chapter_notes)` を描くようになり、
  // `## 確定内容 (質疑録)` の中で `system-spec/ui-ux.md` を名指ししていた同じ
  // 食い違い記録が、名指しの無い節へもう 1 部現れた。`## 適用された設計知識` の
  // トレードオフ本文も `UIUX-REQ-001` に触れる。どちらも **ui-ux.md の中の
  // ui-ux の ID** で、出所は 1 つも曖昧になっていない。
  //
  // 名指しが要るのは「**どの章の ID か読み手に分からない**」場合である。
  // 自分の章の ID が自分の章のファイルに出るとき、名指しは同語反復になる。
  // 逆に**他章の ID** が名指し無しで出るのは、いまも違反のまま——むしろ
  // 定義の所在で判定するぶん、文字列検索より狭くなる（`system-spec/….md`
  // という綴りをどこかへ書けば通っていた穴が閉じる）。
  const owner = new Map([...definitionsInChapters()].map(([id, d]) => [id, d.file]));
  const out: Occurrence[] = [];
  for (const name of markdownIn(dir)) {
    const lines = readFileSync(join(dir, name), "utf8").split("\n");
    const heads = lines.flatMap((l, i) => (/^##\s/.test(l) ? [i] : []));
    lines.forEach((line, i) => {
      const ids = line.match(REQUIREMENT_ID);
      if (!ids) return;
      const start = heads.filter((h) => h <= i).pop() ?? 0;
      const end = heads.find((h) => h > i) ?? lines.length;
      const section = lines.slice(start, end).join("\n");
      // 定義の所在が分からない ID は「自分の章」と名乗れない（未定義の ID を
      // 撒くと素通りする、という抜け道を残さない）。
      const ownHome = ids.every((id) => owner.get(id) === name);
      out.push({
        file: name,
        line: i + 1,
        ids,
        namesChapter: ownHome || /`?system-spec\/[a-z-]+\.md`?/.test(section),
      });
    });
  }
  return out;
}

/**
 * 生成器出力に現れてよい**素の ID の異なり数**の上限。2026-08-20 実測 2、遊び 0。
 *
 * **これは「0 件」を 2 へ緩めたものではない。**0 のままなのは定義本文のほう
 * （`definitionsInChapters()` との交差）で、この 2 が乗っているのは
 * **引用という別の対象**である。同じ数字でも対象が違う。
 * 上限だけを単独で置くと、引用文から章名を消せば「引用に見えない素の ID」が
 * 2 件まで通るので、**必ず名指し条件と対で**張ること。
 */
const QUOTED_ID_CAP = 2;

/** 定義本文の最短の長さの床。2026-08-20 実測 10 字。短い定義に痩せると偶然一致しやすくなる。 */
const SHORTEST_DEFINITION_FLOOR = 10;

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

  it("生成器出力に章の規範定義本文は 1 件も現れない（塞げない穴。塞がった日に赤くなる）", () => {
    const out = compileToTemp();
    const defs = definitionsInChapters();
    const outText = markdownIn(out)
      .map((n) => readFileSync(join(out, n), "utf8"))
      .join("\n");

    // 母集団の床を同じ it() の中に置く。定義が 1 件も取れなくても 0 件は出るため。
    expect(defs.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);
    // 定義が痩せて数文字になると、偶然一致で 0 件が崩れる／逆に当たらなくなる。
    expect(Math.min(...[...defs.values()].map((d) => d.def.length))).toBeGreaterThanOrEqual(
      SHORTEST_DEFINITION_FLOOR,
    );
    // 対照: 探し方が動いていること。定義本文は章側には必ず在る（そこから取ったので）。
    const specText = markdownIn(SPEC_DIR)
      .map((n) => readFileSync(join(SPEC_DIR, n), "utf8"))
      .join("\n");
    expect([...defs.values()].filter((d) => specText.includes(d.def))).toHaveLength(defs.size);

    const reproduced = [...defs]
      .filter(([, d]) => outText.includes(d.def))
      .map(([id]) => id)
      .sort();
    expect(reproduced).toEqual([]);
  });

  it("素の ID が出力に現れるのは、章を名指しした記録の中だけ（異なり数 上限 2）", () => {
    const out = compileToTemp();
    const occurrences = bareIdOccurrences(out);

    // **母集団の床。**出現 0 件でも下の 2 つは緑になる。0 になった日は
    // 「引用が消えた」ので、この検査は削除ではなく反転（上限の役目の見直し）へ回すこと。
    expect(occurrences.length).toBeGreaterThan(0);

    const distinct = [...new Set(occurrences.flatMap((o) => o.ids))].sort();
    expect(distinct.length).toBeLessThanOrEqual(QUOTED_ID_CAP);

    // 上限と対。名指しの無い素の出現は 1 件でも不可。
    const unnamed = occurrences
      .filter((o) => !o.namesChapter)
      .map((o) => `${o.file}:${o.line} ${o.ids.join(",")}`);
    expect(unnamed).toEqual([]);

    // 対照: **他章の ID を名指し無しで書いたら赤くなる**こと。0 件は、良くなった
    // ときと、判定を緩めすぎたときの両方で出る（2026-08-25 に「自分の章なら
    // 名指し不要」を足したので、なおさら要る）。
    const probe = mkdtempSync(join(tmpdir(), "bare-id-probe-"));
    const foreign = [...definitionsInChapters()].find(([, d]) => d.file !== "ui-ux.md")![0];
    writeFileSync(join(probe, "ui-ux.md"), `## 節\n\n${foreign} に従う。\n`, "utf8");
    expect(bareIdOccurrences(probe).filter((o) => !o.namesChapter)).toHaveLength(1);
    // 同じ形でも、自分の章の ID なら通る。
    const own = [...definitionsInChapters()].find(([, d]) => d.file === "ui-ux.md")![0];
    writeFileSync(join(probe, "ui-ux.md"), `## 節\n\n${own} に従う。\n`, "utf8");
    expect(bareIdOccurrences(probe).filter((o) => !o.namesChapter)).toHaveLength(0);
  });

  it("生成器は章の枚数ぶんを出す（出力が痩せて 0 件になっていない）", () => {
    const out = compileToTemp();
    expect(markdownIn(out).length).toBe(markdownIn(SPEC_DIR).length);
  });

  it("規範定義本文は正本にも生成器ソースにも無い（『塞げない理由』の裏取り）", () => {
    const defs = definitionsInChapters();
    expect(defs.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);

    const state = readFileSync(join(SPEC_DIR, "spec-state.json"), "utf8");
    const libDir = join(ROOT, ".claude/plugins/system-spec-harness/lib");
    const libSource = readdirSync(libDir)
      .filter((n) => n.endsWith(".py"))
      .map((n) => readFileSync(join(libDir, n), "utf8"))
      .join("\n");

    // 対照: 正本を読めていることを、確かに在る ID で示す。
    expect(state).toContain(POSITIVE_CONTROL);
    expect(libSource.length).toBeGreaterThan(0);

    // 見るのは ID ではなく**定義本文**である。ID の素の出現は 2026-08-20 以降、
    // 正本の食い違い記録に 2 件ある（上の「素の ID が出力に現れるのは…」が別枠で見ている）。
    // ここが見張るのは「規範を描く材料が正本／生成器側に無い」ことのほうで、
    // **ID が引用されていることはその材料にならない。**
    const reachable = [...defs]
      .filter(([, d]) => state.includes(d.def) || libSource.includes(d.def))
      .map(([id]) => id)
      .sort();
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
