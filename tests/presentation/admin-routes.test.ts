/** @tier 1 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/presentation/ui";

/**
 * 管理画面の案内に「押しても何も無いリンク」を作らせない検査。
 *
 * 案内だけ先に足して画面を作り忘れる、という壊れ方が最も起きやすい。
 * 人の目視では見落とすので、機械で止める。
 *
 * 逆向き（画面はあるが案内に無い＝どこからも辿り着けない画面）も同時に見る。
 */
const ROOT = resolve(import.meta.dirname, "../..");

function pageFileFor(href: string): string {
  const segment = href.replace(/^\//, "");
  return resolve(ROOT, "src/app", segment, "page.tsx");
}

/**
 * まだ画面が無いことを承知しているリンク。
 *
 * **この一覧は減らすためだけにある。増やしてはいけない。**
 * 空にならないうちは「案内はあるが画面が無い」状態が残っているということ。
 * ここに書いていないリンクが壊れたら、下のテストが即座に落ちる。
 */
const KNOWN_MISSING: readonly string[] = [];

describe("管理画面の案内", () => {
  it("案内にあるリンクには必ず画面がある（未着手の一覧を除く）", () => {
    const missing = ADMIN_NAV.filter(
      (item) => !existsSync(pageFileFor(item.href)) && !KNOWN_MISSING.includes(item.href),
    ).map((item) => `${item.label} (${item.href})`);
    expect(missing, "案内に出ているのに画面が無いリンクがあります").toEqual([]);
  });

  it("未着手の一覧に、もう作り終えたものが残っていない", () => {
    // 画面ができたら一覧から消す。消し忘れると、この一覧が
    // 「壊れたリンクを見逃す穴」として残り続ける。
    const stale = KNOWN_MISSING.filter((href) => existsSync(pageFileFor(href)));
    expect(stale, "画面ができているのに未着手の一覧に残っています").toEqual([]);
  });

  it("画面があるのに案内に無い（どこからも辿り着けない）ものが無い", () => {
    // 逆向きの壊れ方。画面を作ったが案内に足し忘れると、
    // URL を知っている人しか使えない画面になる。
    const adminDir = resolve(ROOT, "src/app/admin");
    const orphans: string[] = [];
    for (const name of readdirSync(adminDir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      // 動的な区切り（[variant] など）は親の一覧から辿るので、案内には出さない。
      if (name.name.startsWith("[")) continue;
      if (!existsSync(resolve(adminDir, name.name, "page.tsx"))) continue;
      const href = `/admin/${name.name}`;
      if (!ADMIN_NAV.some((item) => item.href === href)) orphans.push(href);
    }
    expect(orphans, "画面はあるが案内に載っていません").toEqual([]);
  });

  /**
   * **上の「案内に無い」は、`src/app/admin` の 1 段目しか歩いていない。**
   *
   * `readdirSync(adminDir)` は直下の入れ物しか返さないので、
   * `admin/settings/integration-access/page.tsx` のような**入れ子の画面**は
   * 一度も見られていなかった。実測（2026-08-21）: 入れ子の画面は 7 枚あり、
   * そのどれを案内からも参照からも外しても、上の 3 件は緑のまま通る。
   *
   * 判定欄（`docs/product/traceability.md` R 節 REQ-TS05・T 節 REQ-FB07）は
   * 「孤立ページ禁止」を守っていると書いていたが、**守られていたのは 1 段目だけ**
   * だった。入れ子の画面は案内に出さないのが正しい（親から辿る）ので、
   * 案内ではなく**どこかから指されていること**で見る。
   *
   * **この検査が見ていないもの（先に書く）**:
   * 数えるのは「文字列リテラルの先頭に置かれた `/admin/…`」だけで、
   * それがリンクなのか `revalidatePath()` の引数なのかは見分けていない。
   * 参照している側の画面自身が孤立していれば、連鎖も追えない。
   * 見ているのは「**誰もリテラルとして書いていない画面が無い**」ことである。
   *
   * **注釈は数えない。ここは実測で 1 度外した。**
   * 最初は「`src` のどこかに文字列として出てくる」で書いた。
   * `src/app/admin/content/page.tsx` から `/admin/content/matrix` への
   * 唯一のリンクを外して測ったところ、**緑のまま通った**。
   * `src/application/usecases/authoring/plan-generation-matrix.ts` の
   * JSDoc に `app/admin/content/matrix/page.tsx` と書いてあり、
   * それを参照として数えていたためである。
   * **リンクを消しても、注釈に名前が残っていれば緑になる形だった。**
   * そこで注釈を落とし、`"` / `'` / `` ` `` の直後に来る出現だけを数える。
   *
   * 文字列リテラルで見て `href=` の行に絞らないのは、
   * `/admin/products/compare` が `` `${…}?ids=…` `` の組み立てで
   * 指されており、`href="…"` の形では書かれていないため
   * （`href` の行だけを見る形にすると、この 1 枚を孤立と誤判定する）。
   */
  const SRC = resolve(ROOT, "src");

  /** `src` 配下の `.ts` / `.tsx` を全部集める。 */
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });

  /** `src/app/admin` 配下の `page.tsx` を、動的な区切りを除いて集める。 */
  const nestedAdminPages = (): { href: string; dir: string }[] => {
    const found: { href: string; dir: string }[] = [];
    const walk = (dir: string, segments: string[]) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith("[")) continue; // 親の一覧から辿る
        const next = [...segments, e.name];
        const full = join(dir, e.name);
        if (existsSync(join(full, "page.tsx")) && next.length >= 2) {
          found.push({ href: `/admin/${next.join("/")}`, dir: full });
        }
        walk(full, next);
      }
    };
    walk(resolve(ROOT, "src/app/admin"), []);
    return found;
  };

  /** 注釈を落とす。名前が注釈に残っているだけで「指されている」と数えないため。 */
  const withoutComments = (body: string): string =>
    body.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  /** 文字列リテラルの先頭に `href` が置かれているか。 */
  const linksTo = (body: string, href: string): boolean =>
    new RegExp(`["'\`]${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(body);

  it("注釈に名前が残っているだけでは、指されているとは数えない（陽性対照）", () => {
    // ここが緩むと、リンクを消しても注釈が残っているかぎり上の検査は緑になる。
    // 2026-08-21 に実際にその形で 1 度緑を出したので、対照として固定する。
    const inComment = "/** 画面（`app/admin/content/matrix/page.tsx`）が…… */\nconst x = 1;";
    expect(linksTo(withoutComments(inComment), "/admin/content/matrix")).toBe(false);
    // 逆向き。素の字のリンクと組み立ての両方が「指されている」と数えられること。
    expect(linksTo('<Link href="/admin/content/matrix">', "/admin/content/matrix")).toBe(true);
    expect(linksTo("`/admin/products/compare?ids=${ids}`", "/admin/products/compare")).toBe(true);
    // 前方一致では通さない。別の画面の名前の一部を借りられないこと。
    expect(linksTo('"/admin/content/matrix-old"', "/admin/content/matrix")).toBe(false);
  });

  it("入れ子の画面も、どこかから指されている（孤立ページを作らない）", () => {
    const pages = nestedAdminPages();
    // **母集団の床**。歩けていなくても孤立 0 件は出る。実測 7 枚。
    expect(pages.length, "入れ子の画面を歩けていません").toBeGreaterThanOrEqual(5);

    const files = sourceFiles(SRC).map((path) => ({
      path,
      body: withoutComments(readFileSync(path, "utf8")),
    }));
    expect(files.length, "src を歩けていません").toBeGreaterThan(100);

    const orphans = pages
      .filter((page) => {
        if (ADMIN_NAV.some((item) => item.href === page.href)) return false;
        // 画面自身の入れ物の中の言及は数えない（自分で自分を指しても辿れない）。
        return !files.some((f) => !f.path.startsWith(page.dir) && linksTo(f.body, page.href));
      })
      .map((p) => p.href);

    expect(
      orphans,
      "どこからも指されていない入れ子の画面です。URL を知っている人しか使えません",
    ).toEqual([]);
  });

  it("案内のリンク先はすべて /admin の下にある", () => {
    // 管理画面の案内から読者向けページへ飛ばすと、
    // 権限の要る画面と要らない画面の境目が利用者に分からなくなる。
    for (const item of ADMIN_NAV) {
      expect(item.href.startsWith("/admin"), `${item.href} が /admin の外を指しています`).toBe(true);
    }
  });
});
