/**
 * @tier 2
 * @req REQ-UX06
 * @types code-boundary
 *
 * A6: 同等 UI の重複実装が 0 件で、共通部品は共有コンポーネント経由で使われる。
 *
 * 「同等」を機械が数えられる形にする。**同じ役割の要素が 3 つ以上、同じ並びで、
 * 2 か所以上に現れたら重複**とする。属性の値は見ない。値が違っても、
 * 同じ形を 2 回書いていれば、片方を直したときにもう片方が古くなる。
 *
 * 共通部品だけで組み立てた並びは数えない。**それが共通化の結果**だからで、
 * ここを数えると「共通部品を使うほど赤くなる」逆向きの検査になる。
 *
 * 見るのは 3 つ。
 *   1. 検査そのものが空振りしていない（窓が 1 つも作れていないなら赤）
 *   2. 共通部品だけの並びが除外されている（除外の仕組みが効いている）
 *   3. 残った重複が 0 件
 *
 * 1 と 2 を見る理由は、3 だけだと**何も見つけない実装でも緑になる**ため。
 * 検査は、効いていることを自分で示せないと飾りになる。
 *
 * 規範: docs/spec/feat-uiux-overhaul/design-review.md (重大 6 の一次検査)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * 画面を組み立てている実装の在り処。
 *
 * 2026-08-22 まで `src/app` だけを見ていた（`ah-brd`）。P08 の移行では、
 * 未移行の生 `<form>` 14 件が**すべて `src/presentation/admin`** にあり、
 * 検査の外に落ちていた。重複でも同じ穴が空く。
 *
 * 「画面の置き場所」ではなく「画面を組み立てている実装の置き場所」で切る。
 * 範囲の取りこぼしは §1 の床が検出する（範囲を手で書く以上、
 * **手で書いた範囲が実体と合っているか**を別に測らないと、また同じ穴が空く）。
 */
const SCAN_DIRS = [
  "src/app",
  "src/presentation/admin",
  "src/presentation/site",
  // 本文の断片を描く層。`presentation/ui` と違って**定義ではなく組み立て**が入るので、
  // 除外せず数える側に置く（描く側と書く側で同じ並びが写りうる場所である）。
  "src/presentation/prose",
] as const;

/**
 * `.tsx` を持つが走査しない場所と、その理由。
 *
 * **理由を書けないものは除外できない。** 書けないなら、それは走査すべき場所である。
 */
const EXCLUDED_DIRS: Readonly<Record<string, string>> = {
  "src/presentation/ui":
    "共通部品の定義そのもの。ここの並びは『写し』ではなく『定義』で、" +
    "数えると共通化するほど赤くなる逆向きの検査になる",
  "src/presentation/telemetry": "計測の配線 1 件のみ。画面を組み立てていない",
};

/** 並びの長さ。3 未満だと偶然の一致が増え、4 以上だと写した塊を見逃す。 */
const WINDOW = 3;

/**
 * 並びを「写し」と呼ぶために要る生タグの数。
 *
 * 1 だと、共通部品 2 つに挟まれた `<p>` 1 個が写し扱いになる。共通部品の
 * 呼び出しは定義が 1 か所にあるので、写っているのは `<p>` 1 個だけであり、
 * それは構造ではない。**共通化を進めるほど赤くなる向き**になってしまう。
 */
const MIN_RAW_TAGS = 2;

/**
 * 共通部品の入口。ここから取った名前だけで組んだ並びは重複と数えない。
 *
 * `@/presentation/ui` だけでなく `@/presentation/` 配下すべてを入口とする。
 * 骨格 (`AdminShell`) と削除の確認欄 (`DeleteConfirm`) は**いま操作している人が
 * 誰か**を知っている必要があり、身元を読む部品は ui の 3 段（仕様も取得も
 * 持たない層）には置けない。置き場所が層の都合で分かれているだけで、
 * 「画面ごとに書き写していない」という点では ui のものと変わらない。
 *
 * 走査するのは画面を組み立てている .tsx だけなので、ここを広げても
 * **画面が自分の手で書いた並び**を見逃すことにはならない。
 */
const SHARED_IMPORT = /@\/presentation\//;

/**
 * 外から取ってきた部品のうち、`@/presentation/` の外にあるもの。
 *
 * 2026-08-22 まで `next/link` の `Link` が「共通部品でない」側に落ちていた（`ah-brd`）。
 * その結果 `Callout>p>Link` のような並びが 6 通り重複として出ていたが、
 * **`Link` の定義は Next.js に 1 つしか無い。** 画面が書いているのは
 * `<Link href=…>` の 1 行で、そこに写された構造は無い。
 *
 * 重複とは「**同じ構造が 2 か所で定義されている**」ことである。
 * import は参照であって定義ではない。定義が生まれるのは、画面が生タグ
 * （`div` / `p` / `input` …）を自分の手で組み立てたときだけ。
 *
 * ただし「import すれば逃げられる」ようにはしない。§1 に
 *   - 生タグを含む並びが十分に残っている（除外が効きすぎていない）
 *   - 同じ名前の部品が 2 か所でローカル定義されていない
 * の 2 つの床を置く。後者が無いと、`FormResult` が 2 ファイルで別々に
 * 定義されていた 2026-08-22 の状態を、この検査は次からも見逃す。
 */
const EXTERNAL_COMPONENT_IMPORT = /^(next\/|react$|react\/)/;

/**
 * コメントと文字列リテラルを落とした本文。
 *
 * `tagSequence` の正規表現は、タグの開始と、コメントの中に書かれた
 * `` `<form>` `` を見分けられない。2026-08-22 の時点で
 * 「素の `<form>` を書かない」と説明したコメントが 4 ファイルにあり、
 * それが「同じ並びが 2 か所にある」として重複に数えられていた。
 *
 * **説明を書くほど赤くなる検査は、説明を消す方向へ働く。**
 * ここで落としているのは JSX ではないので、落として測れなくなるものは無い。
 */
function stripNonCode(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    " ",
  );
}

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** そのファイルが共通部品から取っている名前。 */
function sharedNames(source: string): Set<string> {
  const names = new Set<string>();
  const importRe = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    if (!SHARED_IMPORT.test(m[2]) && !EXTERNAL_COMPONENT_IMPORT.test(m[2])) continue;
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  // 既定 import (`import Link from "next/link"`) も名前を 1 つ持ち込む。
  const defaultRe = /import\s+([A-Z][A-Za-z0-9]*)\s*(?:,\s*\{[^}]*\}\s*)?from\s*["']([^"']+)["']/g;
  while ((m = defaultRe.exec(source)) !== null) {
    if (!SHARED_IMPORT.test(m[2]) && !EXTERNAL_COMPONENT_IMPORT.test(m[2])) continue;
    names.add(m[1]);
  }
  return names;
}

/** そのファイルが自分で定義している部品の名前。写しはここに生まれる。 */
function locallyDefinedComponents(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/^\s*(?:export\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*\(/gm)) {
    names.add(m[1]);
  }
  return names;
}

/**
 * JSX の要素名になり得ない語。
 *
 * `ReturnType<typeof fn>` や `Extract<T, U>` の型引数を開く `<` は、
 * 正規表現ではタグの開始と見分けが付かない。ここに挙げた語は
 * TypeScript の予約語で識別子にできないため、JSX の要素名にもなり得ない。
 * 落としておかないと、型を書いた画面だけが「並びが違う」ことになり、
 * 重複の判定が型注釈の書き方に左右される。
 */
const NOT_A_TAG = new Set(["typeof", "keyof", "infer", "readonly", "new", "extends", "in"]);

/**
 * 役割を持たない包みタグ。**これだけは名前だけでは同じ形かどうか言えない。**
 *
 * `ul` や `table` や `input` はタグ自体が役割を持つので、名前が一致すれば
 * 同じ役割である。`div` と `span` は違う。**どの画面にも出る**ので、
 * 名前だけで数えると「3 つ続けて包んだ」というだけの並びが重複になる。
 *
 * 2026-08-26 に実際そうなった。`div>div>div` が
 * `ui-catalog/density-samples.tsx`（余白の見本を 3 段に包む）と
 * `prose/prose-editor.tsx`（断片の帯を 3 段に包む）で一致したが、
 * この 2 つに共有できる構造は無い。**引き上げ先の無い赤**である。
 *
 * そこで包みタグに限り、当てている CSS クラス名を役割として足す。
 * `div.proseEditorBar` と `div.densitySample` は別の形として数え、
 * **同じクラスを 2 か所で組み立てていれば今までどおり赤くなる。**
 */
const WRAPPER_TAGS = new Set(["div", "span"]);

/**
 * 出現順のタグ名。閉じタグと自己終端は数えない（同じ要素を 2 回数えるため）。
 *
 * `case` の境目で並びを切る。**switch の別の枝は、同時には描かれない。**
 * 枝をまたいだ窓は画面のどこにも存在しない形で、写しようがない。
 * 2026-08-26 に `prose-body.tsx` の `SectionHeading>ul>li` がこれで出た —
 * 見出しの枝と箇条書きの枝は排他で、並んで描かれることは無い。
 */
function tagSequence(source: string): readonly (readonly string[])[] {
  return source.split(/\bcase\s/).map((branch) =>
    /*
      タグ名の後ろは `[\s/>]` で終端を確かめる。ここを緩めると
      `Record<string, string>` の型引数がタグとして数えられる
      （2026-08-26 に実際そうなった）。第 2 群は属性のかたまりで、
      `{...}` の中に `<` が来ても外へはみ出さないようにしてある。
    */
    [...branch.matchAll(/<([A-Za-z][A-Za-z0-9.]*)([\s/>][^<>{}]*(?:\{[^{}]*\}[^<>{}]*)*)/g)]
      .filter((m) => !NOT_A_TAG.has(m[1] as string))
      .map((m) => {
        const tag = m[1] as string;
        if (!WRAPPER_TAGS.has(tag)) return tag;
        const cls = /className=\{styles\.(\w+)\}/.exec(m[2] ?? "");
        return cls === null ? tag : `${tag}.${cls[1]}`;
      }),
  );
}

/** 窓を数えるときのタグ名。役割つきの `div.foo` から `div` に戻す。 */
function bareTag(token: string): string {
  return token.split(".")[0] as string;
}

type Window = { readonly key: string; readonly tags: readonly string[]; readonly file: string };

const files = SCAN_DIRS.flatMap((d) => tsxFiles(join(ROOT, d)));
const windows: Window[] = [];

/** 生タグ（画面が自分の手で書いた素材）を 1 つ以上含む窓の数。§1 の床が使う。 */
let windowsWithRawTag = 0;
/** 生タグを `MIN_RAW_TAGS` 個以上含む窓の数＝写しを探す母集団。§1 の床が使う。 */
let windowsWithRawPair = 0;
/** ローカル定義された部品名 → それを定義しているファイル。 */
const localDefs = new Map<string, string[]>();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  // タグを数えるときだけコメント・文字列を落とす。import 文の取り出しには生の本文が要る
  // （from の後ろは文字列リテラルなので、落とすと入口が全部消える）。
  const branches = tagSequence(stripNonCode(source));
  const shared = sharedNames(source);
  const rel = relative(ROOT, file);

  for (const name of locallyDefinedComponents(source)) {
    localDefs.set(name, [...(localDefs.get(name) ?? []), rel]);
  }

  for (const tags of branches) {
  for (let i = 0; i + WINDOW <= tags.length; i += 1) {
    const slice = tags.slice(i, i + WINDOW);
    // 共通部品だけの並びは、共通化が効いている証拠なので数えない。
    if (slice.every((t) => shared.has(bareTag(t)))) continue;
    const raw = slice.filter((t) => !shared.has(bareTag(t)) && /^[a-z]/.test(t)).length;
    if (raw >= 1) windowsWithRawTag += 1;
    if (raw >= MIN_RAW_TAGS) windowsWithRawPair += 1;
    /*
     * **生タグが 1 個だけの窓は写しではない**（2026-08-22 / ah-brd）。
     *
     * 窓は 3 タグ。うち 2 つが共通部品の呼び出しなら、この画面が自分の手で
     * 書いたのは残る 1 つ（多くは `<p>`）だけである。`<p>` 1 個を
     * 「同じ構造が 2 か所で定義されている」とは言えない。
     *
     * 実例: 共通化を進めた結果、`Button>FormResult>p` と
     * `p>HumanOnlyForm>FormValue` が 2 ファイルずつで一致した。どちらも
     * **共通部品を使ったからこそ生まれた並び**で、写しの逆である。
     * この規則のままだと、共通化するほど赤くなる。
     *
     * ここは検出を狭める向きの変更なので、狭めすぎていないことを §1 の
     * 「写しの母集団が空でない」で測る。生タグ 2 つ以上の窓が消えたら赤くなる。
     */
    if (raw < MIN_RAW_TAGS) continue;
    windows.push({ key: slice.join(">"), tags: slice, file: rel });
  }
  }
}

const byKey = new Map<string, Set<string>>();
for (const w of windows) {
  const set = byKey.get(w.key) ?? new Set<string>();
  set.add(w.file);
  byKey.set(w.key, set);
}

const duplicates = [...byKey.entries()]
  .filter(([, filesWithIt]) => filesWithIt.size >= 2)
  .map(([key, filesWithIt]) => ({ key, files: [...filesWithIt].sort() }))
  .sort((a, b) => b.files.length - a.files.length);

describe("A6 §1 検査そのものが効いている", () => {
  it("画面ファイルを読めている", () => {
    expect(files.length, "走査対象の .tsx が 1 件も読めていません").toBeGreaterThan(0);
  });

  it.each(SCAN_DIRS)("%s から 1 件以上読めている", (dir) => {
    // 範囲を足しても、そこが空なら足していないのと同じ。範囲ごとに床を張る。
    const found = files.filter((f) => relative(ROOT, f).startsWith(dir));
    expect(found.length, `${dir} の .tsx が 1 件も読めていません`).toBeGreaterThan(0);
  });

  it("走査範囲が実体を取りこぼしていない", () => {
    /*
     * **これが `ah-brd` の再発防止そのもの。**
     *
     * A2・A10・A6 は同じ形で 3 回間違えた —「0 件だ」と言う検査に、
     * 母集団の作られ方の床が無かった。範囲を手で書く以上、書いた範囲が
     * 実体と合っているかを機械が測らないと、新しい置き場所ができた日に
     * その場所は静かに検査の外へ落ちる。
     *
     * ここでは `src/presentation` 配下の直下ディレクトリを実体として数え、
     * 走査対象でも明示除外でもないのに .tsx を持つものが出たら赤くする。
     */
    const presentation = join(ROOT, "src/presentation");
    const unaccounted: string[] = [];
    for (const name of readdirSync(presentation)) {
      const full = join(presentation, name);
      if (!statSync(full).isDirectory()) continue;
      const rel = relative(ROOT, full);
      if (SCAN_DIRS.some((d) => d === rel)) continue;
      if (rel in EXCLUDED_DIRS) continue;
      if (tsxFiles(full).length > 0) unaccounted.push(rel);
    }
    expect(
      unaccounted,
      `走査対象でも明示除外でもないのに .tsx を持つ場所があります:\n  ${unaccounted.join("\n  ")}\n` +
        `SCAN_DIRS へ足すか、EXCLUDED_DIRS へ理由つきで足してください`,
    ).toStrictEqual([]);
  });

  it("除外の理由が空でない", () => {
    // 理由を空文字で埋めれば、どこでも除外できてしまう。
    const empty = Object.entries(EXCLUDED_DIRS)
      .filter(([, why]) => why.trim().length < 10)
      .map(([dir]) => dir);
    expect(empty, `理由の書かれていない除外: ${empty.join(", ")}`).toStrictEqual([]);
    expect(Object.keys(EXCLUDED_DIRS).length, "除外表が空です").toBeGreaterThan(0);
  });

  it("並びを作れている", () => {
    // 窓が 0 だと、以下の判定は「何も無いので重複も無い」で緑になる。
    expect(windows.length, "並びが 1 つも作れていません").toBeGreaterThan(0);
  });

  it("生タグを含む並びが残っている", () => {
    /*
     * **除外を広げすぎていないことの床。**
     *
     * 2026-08-22 に「import した名前は定義ではない」へ規則を正確化した
     * （`EXTERNAL_COMPONENT_IMPORT`）。この向きの変更は正しいが、
     * 際限なく広げると最後は「全部が import 由来」になって窓が消え、
     * §2 は何も見つけないまま緑になる。
     *
     * 生タグ（小文字で始まるタグ）は import では持ち込めない。
     * **画面が自分の手で書いた素材はここにしか無い。** それが十分に
     * 残っていることを測れば、除外が効きすぎたときに赤くなる。
     */
    expect(
      windowsWithRawTag,
      "生タグを含む並びが 1 つも残っていません。除外が効きすぎています",
    ).toBeGreaterThan(50);
  });

  it("写しを探す母集団が空でない", () => {
    /*
     * **`MIN_RAW_TAGS` を広げすぎていないことの床。**
     *
     * 2026-08-22 に「生タグ 1 個の並びは写しではない」へ規則を狭めた。
     * この向きも正しいが、`MIN_RAW_TAGS` を 3、4 と上げていけば
     * 最後は窓が消え、§2 は何も見つけないまま緑になる。
     *
     * 実測 56（`MIN_RAW_TAGS=2`）。3 にすると 26 まで落ちる。床を 30 に
     * 置いてあるので、**次に閾値を上げた人はここで赤くなる**。
     * 床を下げて通すのは、規則を緩めたのを隠すのと同じこと。
     */
    expect(
      windowsWithRawPair,
      `生タグ ${MIN_RAW_TAGS} 個以上の並びが足りません。写しを探す母集団が痩せています`,
    ).toBeGreaterThan(30);
  });

  it("コメントを数えていない", () => {
    /*
     * コメントの中の `` `<form>` `` をタグとして数えていた（`ah-brd`）。
     * 説明を書くほど赤くなる検査は、説明を消す方向へ働く。
     *
     * 「落としている」ことを測る。実際にコメント内へタグらしき記述を持つ
     * ファイルがあり、落とす前後でタグ数が減ることを確かめる。
     * 減らなければ `stripNonCode` が働いていない。
     */
    const withTagInComment = files.filter((f) => {
      const raw = readFileSync(f, "utf8");
      // 並びは `case` ごとに分かれているので、数えるときは平らにする。
      return tagSequence(raw).flat().length > tagSequence(stripNonCode(raw)).flat().length;
    });
    expect(
      withTagInComment.length,
      "コメント・文字列の中にタグらしき記述を持つファイルが 1 つもありません。" +
        "落とす仕組み (stripNonCode) が働いているかを確かめられていません",
    ).toBeGreaterThan(0);
  });

  it("同じ名前の部品を 2 か所で定義していない", () => {
    /*
     * **`EXTERNAL_COMPONENT_IMPORT` を広げたことで開く穴を塞ぐ床。**
     *
     * import 由来の名前を除外すると、「同じ部品を 2 ファイルが各々
     * ローカル定義している」形の写しが並びの検査からは見えにくくなる。
     * 2026-08-22 の実例: `content-form.tsx` と `product-form.tsx` が
     * **同じ名前・同じ引数**の `FormResult` を別々に持っていた。
     * 中身は片方だけ見出しが付き、完了後のリンクの置き場所も違っていた。
     *
     * 名前が同じものが 2 か所にあれば、それは同じ役目を意図している。
     * 役目が同じなら定義は 1 つでよい。
     */
    const duplicated = [...localDefs.entries()]
      .filter(([, where]) => where.length >= 2)
      .map(([name, where]) => `  ${name}\n    ${where.join("\n    ")}`);
    expect(
      duplicated,
      `同じ名前の部品が 2 か所以上で定義されています。\n` +
        `共通部品へ引き上げるか、役目が違うなら名前を変えてください。\n${duplicated.join("\n")}`,
    ).toStrictEqual([]);
  });

  it("共通部品だけの並びが除外されている", () => {
    // 除外が効いていないと、共通部品を使うほど赤くなる逆向きの検査になる。
    const sample = files.find((f) => SHARED_IMPORT.test(readFileSync(f, "utf8")));
    expect(sample, "共通部品を使っている画面が 1 つもありません").toBeDefined();
    if (!sample) return;
    const source = readFileSync(sample, "utf8");
    const shared = sharedNames(source);
    expect(shared.size, `${relative(ROOT, sample)} から共通部品の名前を取り出せていません`)
      .toBeGreaterThan(0);
    const all = tagSequence(source);
    const kept = windows.filter((w) => w.file === relative(ROOT, sample)).length;
    expect(kept, "除外が 1 件も働いていません").toBeLessThan(Math.max(all.length - WINDOW + 1, 1));
  });
});

describe("A6 §2 重複が 0 件", () => {
  it("同じ並びを 2 か所以上で書いていない", () => {
    // 0 は「重複が無い」でも「窓が 1 つも作れていない」でも出る。
    // §1 に同じ床があるが、**別の it の緑はこの it の 0 を保証しない**ので、ここにも張る。
    expect(windows.length, "並びが 1 つも作れていません").toBeGreaterThan(0);
    const report = duplicates
      .slice(0, 20)
      .map((d) => `  ${d.key}\n    ${d.files.join("\n    ")}`)
      .join("\n");
    expect(
      duplicates.length,
      `同じ並びが ${duplicates.length} 通り、2 か所以上に写っています。\n` +
        `共通部品へ引き上げてください（引き上げ先は「仕様を知っているか」で決める）。\n${report}`,
    ).toBe(0);
  });
});
