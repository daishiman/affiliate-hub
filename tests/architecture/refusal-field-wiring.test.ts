/**
 * @tier 1
 * @req REQ-FD06
 * @types code-boundary
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **断りが画面のどこにも出ない**、を機械で見る。
 *
 * きっかけ:
 *   2026-08-26、`tests/e2e/blog-ops-crud.spec.ts` を書いて実際にボタンを押したところ、
 *   ブログ運用の 6 つのフォーム**全部**が断りを飲み込んでいた。
 *   「同じ住所に 2 本目」「題名が空」「部品が足りないまま公開」「理由なしで削除」——
 *   どれも中では正しく断られていたのに、画面には何も出なかった。
 *
 * なぜそうなるか:
 *   `FormResult` は `state.field === undefined` のときだけ断りを出す約束になっている
 *   (`src/presentation/ui/patterns/form-result.tsx`)。欄に紐づく断り (`field` 付き) は
 *   **欄の側**が `error={state.field === "x" ? state.message : null}` で出すことになっている。
 *   つまり欄が配線されていないと、断りは正しく作られたまま、誰にも見えずに捨てられる。
 *
 *   型検査は通る。単体テストも通る (usecase は正しく断っている)。
 *   これを見つけられるのは、実際に画面を押す E2E か、この検査だけである。
 *
 * 何を見て、何を見ないか:
 *   見るのは `src/application/usecases/**` が返す `field` だけ。
 *   `src/domain/**` の `validationError` は不変条件の番人で、
 *   `storageKey` や `amountMinor` のように**画面の欄と対になっていない**ものが多い。
 *   層が違うものに同じ物差しを当てると、この検査は無視される検査になる。
 *
 *   逆向きの穴 (画面に無い欄の名前を `field` で返す) も同じ症状を出す。
 *   2026-08-26 の `readerKey` がそれで、`reader-rating-action.ts` の `shownField()` が
 *   画面に出せる欄だけを通すようにして塞いだ。**この検査はそこまでは見分けない。**
 *   見分けるには Server Action ごとの追跡が要るが、それは静的には辿れない。
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * `validationError(<文言>, "<欄の名前>")` の第 2 引数を集める。
 *
 * 文言は複数行の template literal になることがあるので `[^;]` で跨ぐ。
 * 文の区切り (`;`) は越えないので、**次の呼び出しへ食い込むことはない**。
 * `validationError("文言だけ")` (第 2 引数なし) はここに現れない。
 */
const DECLARED = /validationError\(\s*[^;]*?,\s*"([A-Za-z][A-Za-z0-9]*)"\s*,?\s*\)/g;
/** 画面の側で「この欄の断りだ」と受け取っている形。 */
const WIRED = /state\.field\s*===\s*"([A-Za-z][A-Za-z0-9]*)"/g;

const usecaseFiles = walk(join(ROOT, "src", "application", "usecases"));
const screenFiles = walk(join(ROOT, "src", "presentation"));

/** 欄の名前 → それを返しているファイル (repo からの相対)。 */
const declaredBy = new Map<string, Set<string>>();
for (const file of usecaseFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(DECLARED)) {
    // 非貪欲でも `field` なしの呼び出しを跨いだ場合は捨てる。
    if (match[0].slice(1).includes("validationError(")) continue;
    const set = declaredBy.get(match[1]) ?? new Set<string>();
    set.add(relative(ROOT, file));
    declaredBy.set(match[1], set);
  }
}

const wired = new Set<string>();
for (const file of screenFiles) {
  for (const match of readFileSync(file, "utf8").matchAll(WIRED)) wired.add(match[1]);
}

/** 断りは作られるが、画面のどこにも出ない欄の名前。 */
const unwired = [...declaredBy.keys()].filter((name) => !wired.has(name)).sort();

/** 落ちたときに「どこを直せばいいか」がそのまま読める形にする。 */
function report(names: readonly string[]): string {
  return names
    .map((name) => `  ${name} ← ${[...(declaredBy.get(name) ?? [])].join(", ")}`)
    .join("\n");
}

/**
 * 2026-08-26 の時点で**画面に出ない**と分かっている断り。
 *
 * 数ではなく名前で固定する。数だけを見ると「1 件直して 1 件足す」が素通りし、
 * 検査は緑のまま中身が入れ替わる。名前で見れば入れ替わりも落ちる。
 *
 * 直したら**この一覧から消す**。一覧は縮むことしかしない。
 * 増やすときは、増やす理由が diff に残る。
 *
 * どれもブログ運用の外側 (サイト構築・配信・生成・SEO・改善ループ) で、
 * 直すにはその feature の画面を触ることになる。ここで一緒に直さないのは、
 * 触っていない画面を壊さないため。
 */
const KNOWN_UNWIRED: readonly string[] = [
  "articleTypes",
  "authorName",
  "categoriesText",
  "categorySlug",
  "conclusion",
  "connectionId",
  "draftId",
  "id",
  "limit",
  "month",
  "pattern",
  "providerId",
  "region",
  "revenueModel",
  "runId",
  "step",
  "theme",
  "to",
];

describe("欄に紐づく断りの配線", () => {
  it("検査対象を実際に読めている", () => {
    // 母集団の床。走査が空になれば「違反 0 件」は常に成り立ってしまう。
    // 2026-08-26 の実測は usecase 側 34 件・画面側 55 件。実数ではなく
    // 「明らかに下回ったら走査が壊れている数」を床にする。
    expect(declaredBy.size, "usecase の validationError が見つかりません").toBeGreaterThan(25);
    expect(wired.size, "画面側の state.field 参照が見つかりません").toBeGreaterThan(30);
  });

  it("ブログ運用の断りは全て画面に出る", () => {
    const blogOps = unwired.filter((name) =>
      [...(declaredBy.get(name) ?? [])].some((f) => f.includes("usecases/blog-ops/")),
    );
    expect(
      blogOps,
      `ブログ運用の断りが画面に出ません。欄に error={state.field === "…"} を配線するか、\n` +
        `Server Action の側で画面に出せる欄だけを通してください:\n${report(blogOps)}`,
    ).toEqual([]);
  });

  it("画面に出ない断りを、これ以上増やしていない", () => {
    expect(
      unwired,
      "画面に出ない断りが増減しました。\n" +
        "  増えたなら: 欄に error={state.field === \"…\"} を配線するか、\n" +
        "            画面に無い欄なら usecase で欄の名前を付けるのをやめてください。\n" +
        "  減ったなら: 直した分だけ下の KNOWN_UNWIRED から消してください。\n" +
        `いま画面に出ない断り:\n${report(unwired)}`,
    ).toEqual(KNOWN_UNWIRED);
  });
});
