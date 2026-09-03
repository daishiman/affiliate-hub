/**
 * @tier 1
 * @req REQ-UX06
 * @types code-boundary
 *
 * REQ-UX06 の後半「共通部品は共有コンポーネント経由で使われる」の、
 * 管理画面側の受け持ち。`tests/ui/uiux-duplicate-implementation.test.ts` が
 * 前半（同等 UI の重複が 0 件）を見るのに対し、こちらは
 * 「部品が実際に画面から使われているか」を見る。重複は
 * 「部品はあるが誰も使っていない → 次の人が無いと思って作り直す」で
 * 生まれるので、使われていない部品を先に落とすのが重複を防ぐ側の手当てになる。
 *
 * `src/presentation/admin/` の部品の**網羅検査**。
 *
 * --- なぜ要るのか ---
 *
 * `src/presentation/ui/` は tokens ← primitives ← patterns ← templates の
 * 3 段構成で、`tests/ui/ui-layers.test.ts` が守っている。ただしあの層の
 * 秩序を実際に作っているのは**階層の宣言ではなく網羅検査のほう**である。
 * 「定義されているのにどこからも使われていない部品を落とす」検査
 * （同ファイルの「すべてのパターンがどこかの画面から使われている」）が
 * 効いているから、部品を足したのに誰も使っていない状態が残らない。
 *
 * `src/presentation/admin/` は 100 ファイル超のフラット構成で、これに
 * 相当する検査が無かった。結果、管理画面の部品を足しても「export は
 * されているが、どの画面からも辿り着けない」状態が黙って通る。
 * これは API はあるが画面が無いのと同じ壊れ方で、
 * 一覧の上では実装済みに見えるのに運営者には何も届いていない。
 *
 * この検査が見るのは 1 点だけである。
 *   `src/presentation/admin/` で export されている React 部品が、
 *   `src/app/` の実画面から（`src/presentation/` を経由して）辿り着けること。
 *
 * 見た目・props・振る舞いは見ない。それらは `tests/ui/` の仕事。
 * 契約表の行と実装の対応は `component-contract-identity.test.ts` が持つ。
 * あちらは「契約に書いた名前が実在するか」、こちらは「実在する名前が
 * 使われているか」で、向きが逆の対になっている。
 *
 * --- 見本帳（`/admin/ui-catalog`）の網羅を課さない理由 ---
 *
 * `ui-layers.test.ts` は `primitives` / `patterns` の全 export が
 * `src/app/admin/ui-catalog/` に並んでいることを要求する。同じものを
 * `admin/` へ課すかを検討し、**課さない**と判断した。理由は 3 つ。
 *
 * 1. 見本帳の値打ちは「次に画面を作る人が、ここに無いから作る、で
 *    二重に作るのを防ぐ」ことにある。これは**使い回す部品**にだけ効く。
 *    `admin/` の部品はほぼ全部が 1 画面 1 用途の業務フォーム
 *    （`BlueskyConnectionForm`、`SchedulePublicationForm` 等）で、
 *    二重に作られる余地がそもそも無い。載せても防げるものが無い。
 * 2. `admin/` の部品は Server Action と `useActionState` に束ねられていて、
 *    見本帳に並べるには実在しない workspace / site / article の
 *    状態を捏造する必要がある。捏造した状態で描いた見た目は、
 *    実画面の見た目を何も保証しない。網羅の数だけが増えて、
 *    確かめられることは増えない（Goodhart 化する）。
 * 3. 実測（2026-08-30）で見本帳に載っている `admin/` の部品は
 *    80 個中 2 個（`AdminShell` は見本帳自身の外枠、
 *    `AffiliatePreviewCard` は掲載枠の見た目を持つ数少ない純表示部品）。
 *    残り 78 個を機械が要求すれば、上の 2 の捏造を 78 回書くことになる。
 *
 * 代わりにここが課すのは「実画面から辿り着けること」で、
 * `admin/` にとってはこちらが見本帳の役割を果たす。運営者しか見ない
 * 画面なので、部品が実際に運営者へ届いているかは実画面経由でしか測れない。
 *
 * 注意: `admin-screen-task-manifest.ts` は部品レジストリではなく
 * **Server Action の実行地点のマニフェスト**である。純表示部品は
 * そこに載らないので、母集団の出どころには使えない。母集団は
 * `src/presentation/admin/*.tsx` の export 宣言そのものから取る。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ADMIN = join(ROOT, "src/presentation/admin");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const code = (f: string): boolean => f.endsWith(".ts") || f.endsWith(".tsx");
const nameOf = (f: string): string => (f.split("/").pop() ?? "").replace(/\.tsx?$/, "");

/** React 部品の export 宣言。`export async function` を書く Server Component も拾う。 */
const EXPORTED_FUNCTION = /export\s+(?:async\s+)?function\s+(\w+)/g;

/**
 * 母集団。`admin/` の `.tsx` から export されている**大文字始まり**の関数。
 *
 * 大文字始まりに絞るのは、React が部品と見なす名前がそれだけだからである。
 * 同じファイルに同居する小文字始まりの export（`articleBlockLabel` など）は
 * ただの補助関数で、「画面から使われる部品」ではない。
 * `.ts` を外すのも同じ理由で、あちらは action / state / labels の置き場。
 */
const adminComponentFiles = walk(ADMIN).filter((f) => f.endsWith(".tsx"));
const adminComponents = adminComponentFiles.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(EXPORTED_FUNCTION)]
    .map((m) => m[1])
    .filter((name) => /^[A-Z]/.test(name))
    .map((name) => ({ file, name })),
);

/**
 * 到達の起点。`src/app/` の実画面。
 *
 * **見本帳（`/admin/ui-catalog`）を外す。** 見本帳は「部品を並べる画面」なので、
 * ここを起点に入れると「見本帳に載せた」だけで「使われている」ことになり、
 * この検査が何も見なくなる。`ui-layers.test.ts` が同じ理由で外しているのに揃える。
 */
const screens = walk(join(ROOT, "src/app"))
  .filter(code)
  .filter((f) => !f.includes("/ui-catalog/"));

/**
 * 伝播の候補。`src/presentation/` の全ファイル。
 *
 * 起点には入れない。ここ自身も「画面から使われているか」を問われる側で、
 * 起点に入れると自分で自分を正当化できてしまう。
 *
 * `admin/` だけでなく `presentation/` 全体を候補にするのは、管理画面の部品が
 * `presentation/ui` の骨格や `presentation/site` を挟んで呼ばれる経路が
 * 実在するからで、`admin/` だけ見ていると経路の途中で伝播が止まり、
 * 正しく使われている部品が「孤立」と誤判定される。
 * これは `ui-layers.test.ts` が 2026-08-22 に `middle` を足して直したのと同じ穴。
 */
const presentationFiles = walk(join(ROOT, "src/presentation")).filter(code);

/**
 * 画面から**辿り着ける**ファイルの集合。
 *
 * 「画面が直接 import しているか」だけを見る形にはしない。その形だと、
 * 部品が部品を組み立てている正しい作り（`AffiliateLedger` が内側で
 * `PlacementList` を使う、など）が「孤立」と判定される。判定を避けるために
 * 画面へ引き出すと、組み立てが画面へ漏れ出して共通化そのものが崩れる。
 *
 * 逆に、互いに呼び合うだけで画面から辿り着けない部品の塊は、
 * 到達できないままなのでこれまでどおり見つかる。
 */
function computeReachable(): ReadonlySet<string> {
  const reachable = new Set(screens);
  for (let grew = true; grew; ) {
    grew = false;
    const source = [...reachable].map((f) => readFileSync(f, "utf8")).join("\n");
    for (const file of presentationFiles) {
      if (reachable.has(file)) continue;
      const exported = [...readFileSync(file, "utf8").matchAll(EXPORTED_FUNCTION)].map((m) => m[1]);
      const used =
        source.includes(`/${nameOf(file)}"`) ||
        exported.some((n) => new RegExp(`<${n}[\\s/>]`).test(source));
      if (used) {
        reachable.add(file);
        grew = true;
      }
    }
  }
  return reachable;
}

const reachable = computeReachable();

/**
 * 部品 1 個が参照されている箇所。JSX での使用（`<Name`）と
 * 名前つき import / export（`{ Name }`）の両方を数える。
 *
 * **自分のファイルの中での使用も数える**が、条件が 2 つ付く。
 *   - そのファイル自体が画面から到達済みであること。
 *     到達していないファイルの中で互いに呼び合っているだけなら、
 *     運営者には何も届いていないので使用と見なさない。
 *   - `export function Name` という宣言そのものは数から外すこと。
 *     外さないと、定義があるだけで「使われている」ことになる。
 */
function referencesTo(component: { readonly file: string; readonly name: string }): string[] {
  const hits: string[] = [];
  for (const file of reachable) {
    if (file === component.file && !reachable.has(component.file)) continue;
    const raw = readFileSync(file, "utf8");
    const body = file === component.file ? raw.replace(EXPORTED_FUNCTION, "") : raw;
    const usedAsElement = new RegExp(`<${component.name}[\\s/>]`).test(body);
    const usedAsBinding = new RegExp(`[{,]\\s*${component.name}\\s*[},]`).test(body);
    if (usedAsElement || usedAsBinding) hits.push(relative(ROOT, file));
  }
  return hits;
}

const referenceCount = adminComponents.reduce((n, c) => n + referencesTo(c).length, 0);

describe("管理画面の部品の網羅", () => {
  /**
   * **母集団の床。**
   *
   * `ui-layers.test.ts` が `toBeGreaterThan(N)` を置いているのと同じ理由で置く。
   * 走査の対象が 0 件になれば「違反 0 件」は常に成り立ち、下の検査は
   * 何も見ないまま緑になる。`walk` の対象がずれる・export の書き方が変わって
   * 正規表現が拾えなくなる、といった壊れ方をここで赤くする。
   *
   * 実測（2026-08-30）: ファイル 52 / 部品 80 / 画面 131。
   * 床はその半分強に置く。部品を消す作業で自然に割ることは無く、
   * 走査が壊れたときだけ割る水準である。
   */
  it("検査対象を実際に読めている", () => {
    expect(adminComponentFiles.length, "admin の .tsx が見えていません").toBeGreaterThan(30);
    expect(adminComponents.length, "admin の部品が見えていません").toBeGreaterThan(50);
    expect(screens.length, "画面が見えていません").toBeGreaterThan(80);
  });

  /**
   * **参照関係の床。**
   *
   * 上の床は「部品を集められたか」しか見ない。伝播（`computeReachable`）が
   * 途中で止まると、部品は 80 個見えているのに参照が 1 件も見つからず、
   * そのときは「全部が孤児」で赤くなる……のではなく、除外リストを
   * 太らせて緑にする圧力がかかる。そうさせないために、
   * **参照が十分に見つかっていること自体**を別に測る。
   *
   * 実測（2026-08-30）: 部品 80 個に対して参照 183 件、
   * 到達した admin の .tsx は 52 / 52（孤立ファイルは 0）。
   * 床は 100 に置く。伝播が壊れれば必ずここを割る。
   */
  it("参照関係を実際に辿れている", () => {
    expect(
      referenceCount,
      "部品の参照が辿れていません。伝播（computeReachable）か参照の数え方が壊れています",
    ).toBeGreaterThan(100);

    const reachedAdminFiles = adminComponentFiles.filter((f) => reachable.has(f)).length;
    expect(
      reachedAdminFiles,
      "admin の .tsx に 1 つも辿り着けていません。起点の集め方か伝播が壊れています",
    ).toBeGreaterThan(30);
  });

  /**
   * 使われていない管理画面の部品を残さない。
   *
   * 除外を入れるときは、**1 件ずつ理由を書くこと。**
   * 理由の無い除外は入れない（いまは 1 件も無い）。
   */
  it("すべての管理画面の部品がどこかの実画面から使われている", () => {
    const orphans = adminComponents
      .filter((c) => referencesTo(c).length === 0)
      .map((c) => `${relative(ROOT, c.file)} の ${c.name}`);

    expect(
      orphans,
      "どの実画面からも辿り着けない管理画面の部品です。画面から使うか、消してください。一覧の上では実装済みに見えて、運営者には何も届いていません。",
    ).toEqual([]);
  });
});

/**
 * 上の検査が見ない `.ts` の側。
 *
 * 上は「`.tsx` の React 部品が画面から辿れるか」だけを見て、`.ts`
 * （action / state / labels の置き場）を母集団から外している。その除外が
 * 実際に穴を開けた。2026-08-30 に `quality-check-labels.ts` が
 * **production のどこからも import されていない**状態で見つかった。
 * 記事品質検査 17 種の識別子を編集者に読める日本語へ直す対応表で、
 * 2026-08-21 に「英語の識別子が画面へ出ていた」不具合を直したときの成果物である。
 * それが今、画面へ繋がっていない。テストだけが呼んでいるので緑のまま通っていた。
 *
 * 部品の孤立と壊れ方が同じである。**一覧の上では実装済みに見えて、
 * 運営者には何も届いていない。** 違うのは、`.ts` は JSX に現れないので
 * 上の「`<Name`」を数える方法では見つけられないことだけ。
 * だからここは名前の一致ではなく、**import 指定子を実際に解決**して数える。
 */

/** `from "..."` と `import("...")` の指定子。型だけの import も含める（依存は依存）。 */
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const srcFiles = walk(join(ROOT, "src")).filter(code);

/**
 * `src/` 全体の import 先を、拡張子まで解決した実パスの集合にする。
 *
 * 名前の一致で数えないのは、`non-empty-lines` のような一般的な語が
 * 別の文脈のコメントや文字列にも現れ、使われていないものを
 * 使われていることにしてしまうためである。
 */
function importedPaths(): ReadonlySet<string> {
  const resolved = new Set<string>();
  for (const file of srcFiles) {
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(IMPORT_SPECIFIER)) {
      const base = specifier.startsWith("@/")
        ? join(ROOT, "src", specifier.slice(2))
        : specifier.startsWith(".")
          ? join(file, "..", specifier)
          : null;
      if (base === null) continue;
      for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
        if (srcFiles.includes(candidate)) resolved.add(candidate);
      }
    }
  }
  return resolved;
}

const imported = importedPaths();
const adminModules = walk(ADMIN).filter((f) => f.endsWith(".ts"));

/**
 * 理由つきの除外。**1 件ずつ書くこと。**
 *
 * 「テストが読んでいるから良い」は理由にならない。それを認めると、
 * この検査が見つけたい壊れ方（画面に繋がっていない実装）が
 * 全部そのまま通ってしまう。
 *
 * `kind` を必ず書かせるのが要点である。除外には**性質の違う 2 種類**があり、
 * 同じ袋に入れると片方が消えるべきものだと分からなくなる。
 *
 *   - `by-design`: import されないこと自体が正しい。永久に残ってよい。
 *   - `unfinished`: 今は繋がっていないだけで、繋ぐか消すかが未決。
 *     **これは負債であって設計ではない。** 追える先（`issue`）を必ず書く。
 *
 * 下の「除外は実在するファイルだけを指す」に加えて、`unfinished` に
 * 追跡先が書かれていることも機械が見る。理由を書けば何でも通る形にすると、
 * 除外リストが「検査を黙らせる場所」に変わるからである。
 */
type ImportExemption = {
  readonly kind: "by-design" | "unfinished";
  readonly why: string;
  /** `unfinished` のときの追跡先。`by-design` では空でよい。 */
  readonly issue?: string;
};

const IMPORT_EXEMPTIONS: Readonly<Record<string, ImportExemption>> = {
  "src/presentation/admin/admin-screen-task-manifest.ts": {
    kind: "by-design",
    why:
      "画面が読む部品ではなく、画面の一覧そのものを宣言する正本。" +
      "検査とスクリプトが仕様（information-priority-map.json）との一致を測るために読む。" +
      "production から import されないのは意図で、import されたらむしろ役割が壊れている",
  },
  "src/presentation/admin/quality-check-labels.ts": {
    kind: "unfinished",
    why:
      "記事品質検査 24 種のうち 17 種を編集者に読める日本語へ直す対応表。" +
      "domain の runQualityChecks は application まで結果を返しているが、" +
      "画面はそれを『承認できない理由』の判定にしか使わず、指摘の中身を出していない。" +
      "つまり足りないのは対応表ではなく、指摘を出す画面のほうである。" +
      "2026-08-30 にこの検査が見つけた。消すと 17 件のラベル文言と" +
      "『全域型にして書き漏れを型で止める』設計判断（2026-08-21 の不具合の教訓）が失われるため残す",
    // `bd memories quality-check-issues-not-shown` で読める。
    // Beads の issue にしていないのは、この harness では issue が dev-graph node と
    // 対でしか作れず（bd-bridge.py の create は --graph-node-id を要求する）、
    // node の新設が計画プロセスの領分だからである。手段が無いことを
    // 「追跡先が無い」ことにしないため、実在する記録を指す。
    issue: "bd memory: quality-check-issues-not-shown",
  },
};

/**
 * **床は、それを使う `it` の中に書く。**別の `it` へ切り出さない。
 *
 * 一度そう書いて `tests/architecture/form2-population-floor.test.ts` に落とされた
 * （2026-08-30）。あちらの doc comment が同じ誤りを先回りして書いている:
 * 床を別の `it` にすると、**0 を主張する `it` と、母集団が空でないことを言う `it` が
 * 別々に緑になれる。**片方だけ壊れても、もう片方は緑のまま黙る。
 * 読みやすさのために分けたくなるが、**分けたい気持ちのほうが違反である。**
 *
 * 実測（2026-08-30）: admin の .ts 72 件 / 解決できた import 先は src 全体で数百件。
 */
describe("管理画面の .ts の網羅", () => {
  it("除外は実在するファイルだけを指す", () => {
    expect(adminModules.length, "admin の .ts が見えていません").toBeGreaterThan(40);

    const stale = Object.keys(IMPORT_EXEMPTIONS).filter(
      (path) => !adminModules.includes(join(ROOT, path)),
    );
    expect(stale, "除外の宛先が実在しません。移動か削除に追随していません").toEqual([]);
  });

  /**
   * 除外がまだ「除外に値するか」を見る。
   *
   * すでに import されるようになったものが除外に残っていると、次に本当に
   * 壊れたときも黙って通る。負債（`unfinished`）に追跡先を要求するのも同じ理由で、
   * 追える先の無い負債は「理由を書いた」だけで永久に残る。
   */
  it("除外は今も必要で、負債には追跡先がある", () => {
    expect(
      imported.size,
      "import 先を 1 つも解決できていません。指定子の解決が壊れています",
    ).toBeGreaterThan(100);

    const needless = Object.keys(IMPORT_EXEMPTIONS).filter((path) =>
      imported.has(join(ROOT, path)),
    );
    expect(needless, "もう import されています。除外から外してください").toEqual([]);

    const untracked = Object.entries(IMPORT_EXEMPTIONS)
      .filter(([, e]) => e.kind === "unfinished" && (e.issue ?? "").trim() === "")
      .map(([path]) => path);
    expect(untracked, "未完了の除外に追跡先がありません").toEqual([]);
  });

  it("すべての管理画面の .ts が production のどこかから import されている", () => {
    expect(adminModules.length, "admin の .ts が見えていません").toBeGreaterThan(40);
    expect(
      imported.size,
      "import 先を 1 つも解決できていません。指定子の解決が壊れています",
    ).toBeGreaterThan(100);

    const unreached = adminModules
      .map((f) => relative(ROOT, f))
      .filter((path) => !imported.has(join(ROOT, path)))
      .filter((path) => IMPORT_EXEMPTIONS[path] === undefined);

    expect(
      unreached,
      "production のどこからも import されない管理画面の .ts です。画面へ繋ぐか、消すか、理由つきで IMPORT_EXEMPTIONS へ入れてください。テストだけが呼んでいる実装は、運営者には届いていません。",
    ).toEqual([]);
  });
});
