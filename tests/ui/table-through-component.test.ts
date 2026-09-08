/** @tier 2 @req REQ-TS06, REQ-S09 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/presentation/ui/templates/screen-parts";

/**
 * 表が 1 つの体系を通っていること。
 *
 * **2 つを同じ回で見る。**片方だけでは何も言えないため。
 *
 *   - 「寄せが見出しと値の両方に当たる」だけがあると、
 *     部品を通っていない表では相変わらず片方だけになる。
 *   - 「生の `<table>` を書かない」だけがあると、
 *     部品を通ってさえいれば中で寄せがずれていても気づけない。
 *
 * 両方が揃って初めて「管理画面のすべての表で寄せが揃っている」と言える。
 * だから片方を先に置かず、この 1 ファイルにまとめてある。分けないこと。
 *
 * ---
 *
 * **なぜ寄せをここで見るのか。**2026-08-21 の実測では、数値列を持つ 18 ファイルの
 * うち見出しと値の両方に `.numeric` が付いていたのは 2 つだけだった。
 * 誰の不注意でもなく、`thead` と `tbody` の 2 箇所へ手で書く形が
 * そうなることを要求していた。`DataTable` は `align` を列の属性にして
 * 宣言する場所を 1 つにしたが、**型が守るのは「1 箇所で書ける」ことだけで、
 * 「書いたものが両方に届く」ことは型では守れない**。だから描画して見る。
 */

const ROOT = process.cwd();

/**
 * **なぜ `src/app` だけを見るのか。**
 *
 * 見ているのは画面の側である。表そのものを組み立てる**器**は
 * `src/presentation/ui/patterns/` にあり、そこに `<table>` が在るのは当然で、
 * 数えると常に違反として出てしまう。
 *
 * ただし「範囲を切ったので切った外は 0 件に見える」は、この作業で 2 度
 * 実際に起きた形である（表の数え上げが `src/app/admin/**` で切れていて
 * `signin` を落とした = UX-15、ルート表が枝を測っていなかった = 残課題 141）。
 * **だから範囲の外を「数えない」ではなく「数えて床に置く」。**
 * 器が 5 つ目に増えたら、その場で気づく。
 */
const APP_DIR = join(ROOT, "src/app");
const PATTERNS_DIR = join(ROOT, "src/presentation/ui/patterns");

/** 表を組み立ててよい器。**画面ではない。** */
const TABLE_COMPONENTS: readonly string[] = [
  "comparison-table.tsx",
  "ranking-table.tsx",
  // 暦は行が日付・列が曜日の表で、`DataTable` の「列の配列」に載らない。
  "schedule-calendar.tsx",
];

/**
 * 生の `<table>` を書いてよい画面。**いまは 1 つも無い**（下の it が空を見張っている）。
 *
 * ここへ足すのは「まだ通していない」ではなく、**外す判断をしたとき**に限る。
 * 通す先と、通さない判断の理由は `DataTable` の doc コメントにある
 * （`src/presentation/ui/templates/screen-parts.tsx`。以前ここには
 * `patterns/data-table.tsx` と書いてあったが、**そのファイルは存在しない**）。
 */
const ALLOWED_RAW_TABLES: readonly string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** コメントの中の `<table` は数えない（直したときの経緯が書いてあるため）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("表は 1 つの体系を通る", () => {
  it("画面に生の <table> が残っていない", () => {
    const found = walk(APP_DIR)
      .filter((file) => stripComments(readFileSync(file, "utf8")).includes("<table"))
      .map((file) => relative(APP_DIR, file));

    expect([...found].sort()).toEqual([...ALLOWED_RAW_TABLES].sort());
  });

  it("生の表の例外一覧も空である", () => {
    expect(ALLOWED_RAW_TABLES).toEqual([]);
  });

  it("patterns 内の特殊な表は3つで、共通表は screen-parts に1つだけある", () => {
    // 画面の側だけを数えていると、器が 5 つ目に増えたことに永久に気づけない。
    // 「範囲の外は 0 件」と「範囲の外を見ていない」は、数の上では同じに見える。
    const found = walk(PATTERNS_DIR)
      .filter((file) => stripComments(readFileSync(file, "utf8")).includes("<table"))
      .map((file) => relative(PATTERNS_DIR, file));

    expect([...found].sort()).toEqual([...TABLE_COMPONENTS].sort());
    const common = readFileSync(
      join(ROOT, "src/presentation/ui/templates/screen-parts.tsx"),
      "utf8",
    );
    expect((stripComments(common).match(/<table/g) ?? []).length).toBe(1);
  });

  /**
   * **走査が `admin/` の外へ届いていること。**
   *
   * **かつては「範囲を縮めると他の it も道連れで赤くなる」という保険があった。**
   * `ALLOWED_RAW_TABLES` に `APP_DIR` からの相対で `"admin/..."` と 2 件書いてあり、
   * 範囲を縮めると相対パスが変わって一致が崩れたためである。
   * **その保険はもう無い。**一覧は空になり（生の `<table>` は 0 件）、
   * 空と空の比較は範囲を縮めても一致したままになる。
   * 当時から「偶然そうなっているだけで、狙って置かれた歯止めではない」と
   * 書いてあったとおりのことが起きた。
   *
   * **だからこの床は、いまや範囲を見張る唯一の口である。**縮めたときに
   * 「`signin/page.tsx` が走査に入っていません」と**原因の名前で**落ちるのは
   * ここだけになった。**赤が出ることと、赤が原因を指すことは別である。**
   *
   * 実測（**2026-08-31 に取り直した**）— `src/app` の `.tsx` をコメントを落として
   * 全走査した内訳。括弧内は 2026-08-21 の前回値:
   *
   * | | 全体 | `admin/` の下 | 外 |
   * |---|---:|---:|---:|
   * | 画面ファイル（`.tsx`） | 125 (62) | 95 (37) | **30 (25)** |
   * | 生の `<table>` | 0 (2) | 0 (2) | **0 (0)** |
   * | `caption=` | 76 (41) | 76 (41) | **0 (0)** |
   *
   * 参考: `page.tsx` だけなら全体 113 / `admin/` の下 86。
   * **前回値の 62 と 37 は `.tsx` 全体の数で、`page.tsx` の数ではない。**
   * 数え方を変えると増減が実態と食い違うので、上の表は `.tsx` 全体で揃えてある。
   *
   * **この検査が観測しているものは、1 つ残らず `admin/` の下にある。**
   * 外の 30 ファイルは、どの数にも 0 しか寄与していない。`caption=` の床（25 以上）も
   * 76 のまま満たされ、実際に縮めても緑のままだった。
   *
   * **つまり「範囲を広げた」ことの中身は、いまのところ空である。**
   * 広げた判断は上のコメントに書いてあるが、広げた先には観測対象が 1 つも無い。
   * それでも広げておくのが正しい——次に `signin` へ表が戻ったとき
   * （UX-15 で実際に起きたこと）、**そのときだけ効く**からである。
   * **効いていない期間が長いほど、縮めても誰も困らないように見える。**
   *
   * --- 床の置き方について ---
   *
   * **実数（2026-08-31 時点で 30）に張らない。**画面を 1 枚消しただけで赤くなり、
   * 「範囲が縮んだ」と「画面が減った」が区別できなくなる。**逆に 1 以上では薄すぎる**——
   * `src/app/layout.tsx` の 1 枚だけでも満たしてしまい、`s/[site]/**` が
   * まるごと範囲から落ちても気づけない。
   *
   * だから **2 つを併せて置く。**
   *   - **名指し**: UX-15 の現場そのもの（`signin/page.tsx`）が走査に入っていること。
   *     ここに表が戻ったとき赤が出る、という関係を直に見る。
   *   - **数の床**: 外が 20 件以上。実測 30 に対して 10 枚ぶんの余裕がある
   *     （置いた当時の実測は 25 で余裕 5。実測が増えても床は動かしていない——
   *     床を実数に追随させると、追随した日に「縮んだ」が捕まえられなくなる）。
   *     画面の増減では動かず、`admin` へ縮めれば 0 になって必ず落ちる。
   *
   * **名指しのほうが本体である。**数は「まとめて落ちた」を捕まえる補助にすぎない。
   */
  it("走査が admin/ の外へ届いている", () => {
    const outside = walk(APP_DIR)
      .map((file) => relative(APP_DIR, file))
      .filter((rel) => !rel.startsWith("admin/"));

    // UX-15 の現場。ここが走査から外れた瞬間、生の <table> が戻っても緑になる。
    expect(outside, "signin/page.tsx が走査に入っていません").toContain("signin/page.tsx");

    // まとめて落ちたときの床。実測 30（2026-08-31）に対して 20（画面の増減では動かない幅）。
    expect(outside.length, "admin/ の外の画面が走査から落ちています").toBeGreaterThanOrEqual(20);
  });

});

describe("caption は、何の表かを言う", () => {
  /**
   * **測れるのは「指示の形をしていないこと」だけである。**
   *
   * 「何の表かを 1 文で言えているか」は機械では測れない。ここで見ているのは
   * 実際に見つかった 1 つの壊れ方だけ——`admin/writing:79` の `<caption>` は
   * 「上から順に並べます。順番を入れ替えないでください」という**指示**だった。
   * 読み上げたとき、表の名前の代わりに指示が出る。
   *
   * この 1 件が示したのは、**`caption` を持つ表の数（当時 13/34）は
   * 中身の質を何も言っていない**ということである。必須にしたことで数は
   * 揃ったが、揃ったのは口の数であって中身ではない。
   */
  const INSTRUCTION_ENDINGS = ["ください", "しましょう", "すること。", "禁止"];

  it("指示を caption に置いていない", () => {
    const offenders: string[] = [];
    for (const file of walk(APP_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/caption=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const text = m[1] ?? m[2] ?? "";
        if (INSTRUCTION_ENDINGS.some((e) => text.includes(e))) {
          offenders.push(`${relative(APP_DIR, file)}: ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("そもそも caption を集められている（正規表現が空振りしていない）", () => {
    // 上の検査は、1 件も拾えていなくても緑になる。
    // 「違反 0 件」と「1 つも見ていない」を区別するための床。
    const count = walk(APP_DIR)
      .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/caption=/g)])
      .length;
    expect(count).toBeGreaterThanOrEqual(25);
  });
});

describe("寄せは列の性質である", () => {
  const markup = renderToStaticMarkup(
    createElement(DataTable, {
      caption: "検査のための表",
      columns: [
        { key: "name", label: "名前" },
        { key: "count", label: "件数", numeric: true },
        { key: "note", label: "備考" },
      ],
      rows: [{ key: "a", cells: ["あ", "1", "—"] }],
    }),
  );

  /** `<th scope="col">件数</th>` などから、そのセルの class を取り出す。 */
  function classOf(tag: "th" | "td", text: string): string | null {
    const re = new RegExp(`<${tag}\\b([^>]*)>${text}</${tag}>`);
    const attrs = re.exec(markup)?.[1] ?? null;
    if (attrs === null) return null;
    return /class="([^"]*)"/.exec(attrs)?.[1] ?? "";
  }

  it("numeric の列は、見出しと値の両方に同じ寄せが当たる", () => {
    const header = classOf("th", "件数");
    const value = classOf("td", "1");

    // 「両方に付いている」だけでなく「同じものが付いている」ことを見る。
    // 別々のクラスに分かれた瞬間、片方だけ直す事故がまた起きる。
    expect(header).not.toBeNull();
    expect(header).not.toBe("");
    expect(value).toBe(header);
  });

  it("寄せを指定しない列は、見出しにも値にも寄せが当たらない", () => {
    // 既定が numeric 側へ倒れていないこと。倒れていると上の検査が
    // 「常に一致する」で通ってしまい、何も見ていないのと同じになる。
    // `""` はセルが在って class 属性が無いこと、`null` はセルが見つからないこと。
    // ここで見たいのは前者なので、`null` を通してはいけない。
    expect(classOf("th", "備考")).toBe("");
    expect(classOf("td", "—")).toBe("");
  });

  it("呼び出し側から寄せのクラスを触る道が開いていない", () => {
    const source = readFileSync(
      join(ROOT, "src/presentation/ui/templates/screen-parts.tsx"),
      "utf8",
    );
    // `className` を受け取る口が開くと、`align` を列の属性にした意味が消える。
    // セルへ直に `.numeric` を付けられる裏口が復活するため。
    expect(source).not.toMatch(/readonly\s+className\??\s*:/);
  });
});

describe("横へ流す器に、キーボードで届く", () => {
  const markup = renderToStaticMarkup(
    createElement(DataTable, {
      caption: "何の表かを言う 1 文",
      columns: [{ key: "a", label: "列" }],
      rows: [{ key: "a", cells: ["値"] }],
    }),
  );

  it("器が焦点を受け取り、名前を持つ", () => {
    // `overflow-x: auto` の器は tabindex が無いとキーボードで動かせない。
    // 狭い画面で積むのをやめた（横へ流す）以上、これが無いと
    // マウスの無い人が隠れた列へ永久に届かない。
    expect(markup).toMatch(/<div[^>]*\btabindex="0"/i);
    expect(markup).toContain('aria-label="何の表かを言う 1 文"');

    // **`region` に戻さないこと。**目印（landmark）になってしまい、
    // 繰り返しの中に表が並ぶ画面で同名の目印が行の数だけ増える
    // （`admin/personas` で axe の `landmark-unique` が実際に出た）。
    expect(markup).toMatch(/<div[^>]*\brole="group"/i);
    expect(markup).not.toContain('role="region"');
  });

  it("器の名前は caption と同じものである", () => {
    // 別々に書ける形にすると、片方だけ直されて食い違う。
    expect(markup).toMatch(/<caption[^>]*>何の表かを言う 1 文<\/caption>/);
  });
});
