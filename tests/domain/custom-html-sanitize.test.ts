/**
 * @tier 1
 * @req REQ-BLOG04
 * 受入条件 A6（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types boundary, equivalence
 *
 * `custom-html-slot` に貼られた HTML を削る決まりを当てる。
 *
 * **ここは「許可した一覧」に依存しない形で書いてある。** 一覧は運営の判断で
 * 増減するので、一覧の中身をテストへ写すと、増やすたびに 2 か所を直す羽目になり、
 * **片方だけ直した日に、テストは緑のまま守るものが減る。**
 * だから当てるのは「一覧に無いものは必ず落ちる」「一覧に在るものは必ず残る」という
 * **一覧との関係**であって、一覧そのものではない。
 */
import { describe, expect, it } from "vitest";
import { ALLOWED_HTML, sanitizeSlotHtml } from "@/domain/blogops";

/** 一覧に無いタグ名を 1 つ選ぶ。一覧が増えても壊れないように、実際に見て選ぶ。 */
function someDisallowedTag(): string {
  const candidates = ["marquee", "blink", "xyzzy", "custom-thing"];
  const found = candidates.find((tag) => ALLOWED_HTML[tag] === undefined);
  if (found === undefined) throw new Error("一覧に無いタグ名が見つかりません");
  return found;
}

describe("貼られた HTML を、描いてよい形だけに削る", () => {
  it("`<script>` は中身ごと消える", () => {
    const out = sanitizeSlotHtml('前<script>alert("x")</script>後');
    expect(out).not.toContain("alert");
    expect(out).not.toContain("<script");
    // **文は残す。**命令だけを消す。
    expect(out).toContain("前");
    expect(out).toContain("後");
  });

  it("閉じられていない `<script>` は、そこから末尾まで消える", () => {
    // 閉じ忘れを「タグではない」と見なすと、ブラウザ側は script として解釈する。
    const out = sanitizeSlotHtml("前<script>alert(1)");
    expect(out).not.toContain("alert");
  });

  it("`<style>` `<iframe>` `<object>` `<embed>` も中身ごと消える", () => {
    for (const tag of ["style", "iframe", "object", "embed"]) {
      const out = sanitizeSlotHtml(`<${tag}>あぶない</${tag}>`);
      expect(out, `${tag} が残っています`).not.toContain(`<${tag}`);
      expect(out, `${tag} の中身が残っています`).not.toContain("あぶない");
    }
  });

  it("HTML コメントは消える", () => {
    expect(sanitizeSlotHtml("前<!-- かくれた -->後")).toBe("前後");
  });

  it("一覧に無いタグは、タグとしては消え、書かれていた文字は残る", () => {
    const tag = someDisallowedTag();
    const out = sanitizeSlotHtml(`<${tag}>中の文</${tag}>`);
    // タグとしては働かない（`<` が生で残らない）。
    expect(out).not.toContain(`<${tag}`);
    // でも運営者が「何かが消えた」と気づけるよう、文字は残す。
    expect(out).toContain("中の文");
    expect(out).toContain(`&lt;${tag}`);
  });

  it("一覧に在るタグは残り、一覧に無い属性は落ちる", () => {
    const entries = Object.entries(ALLOWED_HTML);
    // 床をこの `it` の中に置く（`form2-population-floor`）。
    // 一覧が空のまま「違反 0 件」で緑になるのを防ぐ。
    expect(entries.length, "許可タグの一覧が空です。実装側の表を埋めてください").toBeGreaterThan(0);

    for (const [tag] of entries) {
      const out = sanitizeSlotHtml(`<${tag} data-not-allowed="1">本文</${tag}>`);
      expect(out, `${tag} が落ちています`).toContain(`<${tag}`);
      expect(out, `${tag} に一覧外の属性が残っています`).not.toContain("data-not-allowed");
      expect(out).toContain("本文");
    }
  });

  it("`on...` で始まる属性は、どのタグでも落ちる", () => {
    const entries = Object.entries(ALLOWED_HTML);
    expect(entries.length, "許可タグの一覧が空です。実装側の表を埋めてください").toBeGreaterThan(0);

    for (const [tag] of entries) {
      const out = sanitizeSlotHtml(`<${tag} onclick="steal()" onerror="steal()">本文</${tag}>`);
      expect(out, `${tag} に onclick が残っています`).not.toContain("onclick");
      expect(out, `${tag} に onerror が残っています`).not.toContain("onerror");
      expect(out).not.toContain("steal");
    }
  });

  it("`href` / `src` は http・https・mailto と相対の道だけ通る", () => {
    const carriers = Object.entries(ALLOWED_HTML).flatMap(([tag, attrs]) =>
      attrs.filter((a) => a === "href" || a === "src").map((a) => ({ tag, attr: a })),
    );
    // 行き先を持つタグを 1 つも許していないなら、この検査は当てるものが無い。
    // **その事実を黙って緑にしない**ため、件数を先に見て分岐する。
    if (carriers.length === 0) {
      expect(carriers, "行き先を持つタグが許可されていないので、この検査は空振りです").toEqual([]);
      return;
    }
    for (const { tag, attr } of carriers) {
      for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>"]) {
        const out = sanitizeSlotHtml(`<${tag} ${attr}="${bad}">本文</${tag}>`);
        expect(out, `${tag}[${attr}] が ${bad} を通しました`).not.toContain(attr);
      }
      // 空白・制御文字で割った書き方でも通さない。
      const split = sanitizeSlotHtml(`<${tag} ${attr}="java\tscript:alert(1)">本文</${tag}>`);
      expect(split, `${tag}[${attr}] が分割された javascript: を通しました`).not.toContain(attr);

      const good = sanitizeSlotHtml(`<${tag} ${attr}="https://example.test/a">本文</${tag}>`);
      expect(good, `${tag}[${attr}] が https を落としました`).toContain("https://example.test/a");
    }
  });

  it("素の文は削られない", () => {
    const plain = "これはただの文です。記号 & も < のように書けば残ります。";
    // `<` の直後が英字でないので、タグとしては解釈されない。
    expect(sanitizeSlotHtml("これはただの文です。")).toBe("これはただの文です。");
    expect(sanitizeSlotHtml(plain)).toContain("これはただの文です。");
  });

  it("二度削っても結果が変わらない", () => {
    // 削った結果を保存するので、**保存し直すたびに文が変わってはいけない。**
    const raw = '<b onclick="x()">太字</b><script>alert(1)</script><marquee>流れる</marquee>';
    const once = sanitizeSlotHtml(raw);
    expect(sanitizeSlotHtml(once)).toBe(once);
  });
});

/**
 * **行き先の書き方と、属性の囲み方。**
 *
 * どちらも「運営者がどう書くか」であって、こちらが決められない。
 * 引用符は二重・一重・無しの 3 通りが実際に来るし、行き先は絶対と相対の
 * 両方が来る。**削る側が知っているのは 1 通りだけ、では守れない。**
 *
 * ここが抜けていると、危ないほうではなく**安全なほうが落ちる**。
 * `href='/about'` が消えて、運営者から見ると「リンクが勝手に外れた」になる。
 * 落ちたことは画面に出ないので、気づくのは読者がクリックできないと言ってきた日である。
 */
describe("貼られた HTML を削る — 行き先と引用符の書き分け", () => {
  it("同じサイトの中を指す相対の道は、そのまま通す", () => {
    // `:` を含まない値は scheme を持たない＝同じサイトの中。落とす理由が無い。
    expect(sanitizeSlotHtml('<a href="/about">会社案内</a>')).toContain('href="/about"');
    expect(sanitizeSlotHtml('<a href="../記事">前の記事</a>')).toContain("href=");
  });

  it("一重引用符でも引用符なしでも、同じように読み取る", () => {
    // 引用符の付け方は書く人の癖で決まる。**癖で結果が変わらないこと。**
    for (const written of ["<a href='/about'>案内</a>", "<a href=/about>案内</a>"]) {
      expect(sanitizeSlotHtml(written), written).toContain('href="/about"');
    }
  });

  it("引用符の書き方を変えても、危ないものは同じように落ちる", () => {
    // **抜け道は必ず「別の書き方」で来る。**二重引用符のときだけ塞がっている、
    // という状態が最も危ない（塞いだつもりになる）。
    for (const written of [
      '<a href="javascript:alert(1)">押して</a>',
      "<a href='javascript:alert(1)'>押して</a>",
      "<a href=javascript:alert(1)>押して</a>",
    ]) {
      expect(sanitizeSlotHtml(written), written).not.toContain("javascript:");
    }
  });
});
