/** @tier 1 */
/**
 * @req REQ-FD04
 * @types equivalence
 *
 * **WebMCP でしか到達できない機能を作らない。**
 *
 * 既に在る検査（`one-usecase-three-adapters` ほか）は、1 つのカタログが 4 入口へ
 * 同じ形で写っていることを見ている。それは**入口ごとに実装が分かれていない**ことで、
 * **各機能が画面からも到達できる**こととは別である。写しは一致したまま、WebMCP に
 * だけ載って画面に無い道具を足せる——そのとき落ちる検査が 1 つも無かった（TM04 型:
 * 検査は実在するが、要件とは別のことを見ている）。
 *
 * これが破れると **AI からしか使えない機能ができる**。AI の側が止まった日に、
 * その業務だけが人の手で回せなくなる。落とすのはそこである。
 *
 * 対応表は `webmcp-reachable-screens.ts` に手で書く。実装から作らないことが
 * この検査の効き目そのものなので、§4 でその性質自体を見る。
 */
import { describe, expect, it } from "vitest";
import { createDeps } from "@/infrastructure/composition";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { ROUTE_CASES } from "../ui/route-table";
import { REACHABILITY_EXCEPTIONS, REACHABLE_SCREENS } from "./webmcp-reachable-screens";

const catalog = buildToolCatalog(createDeps());
const toolNames = catalog.map((t) => t.name);
const screenFiles = new Set(ROUTE_CASES.map((r) => r.file));

describe("REQ-FD04 §1 表そのものが空でない", () => {
  // 空振り防止。表が空だと、以下の突き合わせは全部「該当なし」で緑になる。
  it("道具が並んでいて、対応表にも行がある", () => {
    expect(toolNames.length).toBeGreaterThan(50);
    expect(Object.keys(REACHABLE_SCREENS).length).toBeGreaterThan(50);
  });

  it("画面の一覧も空でない", () => {
    expect(screenFiles.size).toBeGreaterThan(20);
  });
});

describe("REQ-FD04 §2 道具はすべて、人が画面から到達できる", () => {
  it("対応表に載っていない道具が無い", () => {
    const missing = toolNames.filter(
      (n) => !(n in REACHABLE_SCREENS) && !(n in REACHABILITY_EXCEPTIONS),
    );
    // 足りないときは名前を全部出す。件数だけだと、どれを考えればよいか分からない。
    expect(
      missing,
      `画面から到達できるかを誰も言っていない道具が ${missing.length} 件あります: ${missing.join(", ")}\n` +
        "tests/architecture/webmcp-reachable-screens.ts に、人が同じことをできる画面を書いてください。\n" +
        "画面が無いなら、それは AI からしか使えない機能です。画面を足すか、道具を落としてください。",
    ).toEqual([]);
  });

  it("対応表が指す画面は実在する", () => {
    const dangling = Object.entries(REACHABLE_SCREENS)
      .filter(([, e]) => "screen" in e && !screenFiles.has(e.screen))
      .map(([name, e]) => `${name} → ${"screen" in e ? e.screen : ""}`);
    // 画面が消えた日にここが落ちる。表だけが古いまま残らない。
    expect(dangling, `実在しない画面を指しています: ${dangling.join(" / ")}`).toEqual([]);
  });

  it("別名の指し先は、表にある本体である", () => {
    const broken = Object.entries(REACHABLE_SCREENS)
      .filter(([, e]) => "alias" in e)
      .filter(([, e]) => {
        const body = "alias" in e ? REACHABLE_SCREENS[e.alias] : undefined;
        // 別名の別名は認めない。1 段で本体へ着かないと、辿る先が消えても気づけない。
        return body === undefined || "alias" in body;
      })
      .map(([name]) => name);
    expect(broken, `別名の指し先が本体になっていません: ${broken.join(", ")}`).toEqual([]);
  });
});

describe("REQ-FD04 §3 表が、実装より先に古くならない", () => {
  it("カタログに無い道具が対応表に残っていない", () => {
    const known = new Set(toolNames);
    const stale = Object.keys(REACHABLE_SCREENS).filter((n) => !known.has(n));
    // これが無いと、道具を落としても表は減らず、次に読む人が在ると思い込む。
    // 「一覧を実装と共有している検査は、一覧が減ったことを言えない」の裏返しで、
    // 別々に持つからこそ**増えたときも減ったときも**言える。
    expect(stale, `カタログに無い道具が表に残っています: ${stale.join(", ")}`).toEqual([]);
  });

  it("例外は理由つきで、そもそも空である", () => {
    for (const [name, reason] of Object.entries(REACHABILITY_EXCEPTIONS)) {
      expect(reason.length, `${name} の例外に理由が書かれていません`).toBeGreaterThan(10);
    }
    // 1 件でも入っていれば、その道具は AI からしか使えない。
    // 落とすのではなく残したい場合は、ここを緩めずに backlog へ 1 件立てること。
    expect(Object.keys(REACHABILITY_EXCEPTIONS)).toEqual([]);
  });
});

describe("REQ-FD04 §4 対応表が実装から作られていない", () => {
  /**
   * **この検査がいちばん効く。**
   *
   * 表を `buildToolCatalog` から作ると、道具を足したぶんだけ行も増え、§2 は永久に
   * 緑になる。「やった形」だけが残って何も守らない状態で、しかも見た目は最も健全に見える。
   */
  it("対応表のファイルが、カタログや実装を読み込んでいない", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./webmcp-reachable-screens.ts", import.meta.url),
      "utf8",
    );
    const imports = source.match(/^\s*import .*$/gm) ?? [];
    expect(
      imports,
      `対応表が何かを読み込んでいます: ${imports.join(" / ")}\n` +
        "手で書くことがこの表の仕事です。実装から作ると、道具を足しても緑のままになります。",
    ).toEqual([]);
  });

  it("行が、道具ごとに別々の画面を指している（群ごとに 1 つへ潰していない）", () => {
    const screens = Object.values(REACHABLE_SCREENS)
      .filter((e): e is { screen: string } => "screen" in e)
      .map((e) => e.screen);
    // 全部が同じ画面を指していたら、表は「管理画面にある」としか言っていない。
    expect(new Set(screens).size).toBeGreaterThan(15);
  });
});
