/** @tier 2 @req REQ-TS06, REQ-S09 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/presentation/ui/patterns/data-table";

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
  "data-table.tsx",
  "ranking-table.tsx",
  // 暦は行が日付・列が曜日の表で、`DataTable` の「列の配列」に載らない。
  "schedule-calendar.tsx",
];

/**
 * 生の `<table>` を書いてよい 2 箇所。
 *
 * **「まだ通していない」ではなく、外す判断をしたもの**。理由は
 * `src/presentation/ui/patterns/data-table.tsx` の doc コメントにある。
 * ここへ 3 つ目を足したくなったら、まず向こうを読むこと。
 */
const ALLOWED_RAW_TABLES: readonly string[] = [
  // 列が実行時に決まる交差表（出し先の媒体の数だけ列が増える）。
  "admin/content/matrix/page.tsx",
  // 表そのものが `<form>` の一部で、選択列が送信の入力になっている。
  "admin/feedback/page.tsx",
];

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
  it("生の <table> は、外す判断をした 2 箇所にしかない", () => {
    const found = walk(APP_DIR)
      .filter((file) => stripComments(readFileSync(file, "utf8")).includes("<table"))
      .map((file) => relative(APP_DIR, file));

    expect([...found].sort()).toEqual([...ALLOWED_RAW_TABLES].sort());
  });

  it("許した 2 件も、横へ流す器で包まれている", () => {
    // 積む規則（`thead { display: none }`）を消したので、器が無いと
    // 狭い画面で表が画面幅を突き破る。`.rankTable` に `display: block` を
    // 当てて逃げると、支援技術から行列の関係が失われる——
    // **積むのをやめた理由（名前を失わせない）と同じ害になる。**
    for (const rel of ALLOWED_RAW_TABLES) {
      const source = readFileSync(join(APP_DIR, rel), "utf8");
      expect(source, `${rel} の表が器で包まれていない`).toContain("rankTableWrap");
      expect(source, `${rel} の器がキーボードで届かない`).toMatch(/tabIndex=\{0\}/);
    }
  });

  it("表を組み立てる器は 4 つで、増えても減っても気づく", () => {
    // 画面の側だけを数えていると、器が 5 つ目に増えたことに永久に気づけない。
    // 「範囲の外は 0 件」と「範囲の外を見ていない」は、数の上では同じに見える。
    const found = walk(PATTERNS_DIR)
      .filter((file) => stripComments(readFileSync(file, "utf8")).includes("<table"))
      .map((file) => relative(PATTERNS_DIR, file));

    expect([...found].sort()).toEqual([...TABLE_COMPONENTS].sort());
  });

  /**
   * **走査が `admin/` の外へ届いていること。**
   *
   * **この床は「他が全部緑のまま通る」から在るのではない。実測すると赤が 2 つ出る。**
   * `ALLOWED_RAW_TABLES` が `APP_DIR` からの相対で `"admin/..."` と書いてあるため、
   * 範囲を縮めると相対パスが `"content/matrix/page.tsx"` へ変わって一致が崩れる。
   * **偶然そうなっているだけで、狙って置かれた歯止めではない**
   * （一覧の中身を `admin/` の外のファイルに書き換えた日に、この効果は消える）。
   *
   * **在る理由は、落ち方のほうにある。**縮めたときに出る赤はこう言う:
   *
   *     生の <table> は、外す判断をした 2 箇所にしかない
   *     → expected [ "content/matrix/page.tsx", … ] to equal [ "admin/content/…" ]
   *
   * 読んだ人は**表が増えたか消えたかを疑う。**原因は表ではなく範囲なので、
   * そこを探しても何も無い。この床だけが「`signin/page.tsx` が走査に入っていません」と
   * **原因の名前で**落ちる。**赤が出ることと、赤が原因を指すことは別である。**
   *
   * 実測（2026-08-21）— `src/app` の `.tsx` をコメントを落として全走査した内訳:
   *
   * | | 全体 | `admin/` の下 | 外 |
   * |---|---:|---:|---:|
   * | 画面ファイル | 62 | 37 | **25** |
   * | 生の `<table>` | 2 | 2 | **0** |
   * | `caption=` | 41 | 41 | **0** |
   *
   * **この検査が観測しているものは、1 つ残らず `admin/` の下にある。**
   * 外の 25 ファイルは、どの数にも 0 しか寄与していない。`caption=` の床（25 以上）も
   * 41 のまま満たされ、実際に縮めても緑のままだった。
   *
   * **つまり「範囲を広げた」ことの中身は、いまのところ空である。**
   * 広げた判断は上のコメントに書いてあるが、広げた先には観測対象が 1 つも無い。
   * それでも広げておくのが正しい——次に `signin` へ表が戻ったとき
   * （UX-15 で実際に起きたこと）、**そのときだけ効く**からである。
   * **効いていない期間が長いほど、縮めても誰も困らないように見える。**
   *
   * --- 床の置き方について ---
   *
   * **実数の 25 に張らない。**画面を 1 枚消しただけで赤くなり、
   * 「範囲が縮んだ」と「画面が減った」が区別できなくなる。**逆に 1 以上では薄すぎる**——
   * `src/app/layout.tsx` の 1 枚だけでも満たしてしまい、`s/[site]/**` が
   * まるごと範囲から落ちても気づけない。
   *
   * だから **2 つを併せて置く。**
   *   - **名指し**: UX-15 の現場そのもの（`signin/page.tsx`）が走査に入っていること。
   *     ここに表が戻ったとき赤が出る、という関係を直に見る。
   *   - **数の床**: 外が 20 件以上。25 から 5 枚ぶんの余裕を持たせてある。
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

    // まとめて落ちたときの床。実測 25 に対して 20（画面の増減では動かない幅）。
    expect(outside.length, "admin/ の外の画面が走査から落ちています").toBeGreaterThanOrEqual(20);
  });

  it("外した理由は、部品の側に書いてある", () => {
    const doc = readFileSync(
      join(ROOT, "src/presentation/ui/patterns/data-table.tsx"),
      "utf8",
    );
    // 理由が消えると、この一覧は「まだ手が回っていない 2 件」に見えてしまう。
    expect(doc).toContain("外す判断をした");
    expect(doc).toContain("content/matrix");
    expect(doc).toContain("feedback");
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
    createElement(DataTable<{ readonly name: string; readonly count: number }>, {
      caption: "検査のための表",
      columns: [
        { key: "name", header: "名前", rowHeader: true, cell: (r) => r.name },
        { key: "count", header: "件数", align: "numeric", cell: (r) => String(r.count) },
        { key: "note", header: "備考", cell: () => "—" },
      ],
      rows: [{ name: "あ", count: 1 }],
      rowKey: (r) => r.name,
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
      join(ROOT, "src/presentation/ui/patterns/data-table.tsx"),
      "utf8",
    );
    // `className` を受け取る口が開くと、`align` を列の属性にした意味が消える。
    // セルへ直に `.numeric` を付けられる裏口が復活するため。
    expect(source).not.toMatch(/readonly\s+className\??\s*:/);
  });
});

describe("横へ流す器に、キーボードで届く", () => {
  const markup = renderToStaticMarkup(
    createElement(DataTable<{ readonly a: string }>, {
      caption: "何の表かを言う 1 文",
      columns: [{ key: "a", header: "列", cell: (r) => r.a }],
      rows: [{ a: "値" }],
      rowKey: (r) => r.a,
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
    expect(markup).toContain("<caption>何の表かを言う 1 文</caption>");
  });
});
