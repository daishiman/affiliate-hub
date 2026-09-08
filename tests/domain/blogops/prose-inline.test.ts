/**
 * @tier 1
 * @req REQ-BLOG05
 * @types boundary, equivalence
 *
 * **当てるのは「文字が 1 つも消えないこと」である。**
 *
 * 装飾は行の中で閉じる。閉じ忘れた `**` や、綴りを間違えた属性は必ず来る
 * ——本文を AI に書かせる作りだからである。そのとき記法として読めなくても、
 * 打った文字がそのまま残っていれば運営者は直せる。消えると直せない。
 */

import { describe, expect, it } from "vitest";
import {
  PROSE_COLOR_LABEL,
  PROSE_COLOR_TOKENS,
  type ProseInline,
  type ProseMark,
  isProseColorToken,
  parseInline,
  plainInline,
  serializeInline,
} from "@/domain/blogops";

function roundTrip(runs: readonly ProseInline[]): readonly ProseInline[] {
  return parseInline(serializeInline(runs));
}

describe("行の中の装飾 — 保存の往復", () => {
  const allMarks: readonly ProseMark[] = [
    { kind: "link", href: "/guide" },
    { kind: "bg", token: "warn" },
    { kind: "color", token: "accent" },
    { kind: "bold" },
    { kind: "italic" },
    { kind: "strike" },
    { kind: "code" },
  ];

  for (let combination = 0; combination < 2 ** allMarks.length; combination += 1) {
    const marks = allMarks.filter((_, index) => combination & (1 << index));
    const label = marks.map((mark) => mark.kind).join(" + ") || "装飾なし";
    it(`${label} を同時に選んでも再読込で本文と装飾が変わらない`, () => {
      for (const text of ["本文", "a`b", "[", "]", "**", "*", String.raw`x\y`]) {
        const runs = [{ text, marks }];
        expect(roundTrip(runs), text).toStrictEqual(runs);
      }
    });
  }

  it("既存の1文字コード囲みに書かれた空白は保存・再読込で保つ", () => {
    const source = "` a `";
    expect(parseInline(source)).toStrictEqual([{ text: " a ", marks: [{ kind: "code" }] }]);
    expect(serializeInline(parseInline(source))).toBe(source);
  });

  for (const text of ["a`b", "`code`", "a``b", " a ", "**記号**", "[記号](url)"]) {
    it(`記号入りの行内コード「${text}」を装飾と組み合わせても保つ`, () => {
      const runs: readonly ProseInline[] = [{ text, marks: [{ kind: "bold" }, { kind: "code" }] }];
      const restored = roundTrip(runs);
      expect(restored.map((run) => run.text).join("")).toBe(text);
      expect(restored.filter((run) => run.text.trim() !== "")).toStrictEqual([
        { text: text.trim(), marks: [{ kind: "bold" }, { kind: "code" }] },
      ]);
    });
  }

  it("隣り合う太字・斜体・併用箇所を別の装飾として読み直せる", () => {
    const runs: readonly ProseInline[] = [
      { text: "A", marks: [{ kind: "bold" }] },
      { text: "B", marks: [{ kind: "italic" }] },
      { text: "C", marks: [{ kind: "bold" }] },
      { text: "D", marks: [{ kind: "bold" }, { kind: "italic" }] },
      { text: "E", marks: [] },
    ];
    expect(roundTrip(runs)).toStrictEqual(runs);
  });

  it("DOMで分かれた同じ行内コードは1つの内容として保存する", () => {
    const runs: readonly ProseInline[] = [
      { text: "A", marks: [{ kind: "code" }] },
      { text: "B", marks: [{ kind: "code" }] },
    ];
    expect(roundTrip(runs)).toStrictEqual([{ text: "AB", marks: [{ kind: "code" }] }]);
  });

  it("手書きMarkdownの部分的な太字・斜体の入れ子も保つ", () => {
    expect(parseInline("**A*B***")).toStrictEqual([
      { text: "A", marks: [{ kind: "bold" }] },
      { text: "B", marks: [{ kind: "bold" }, { kind: "italic" }] },
    ]);
    expect(parseInline("*A**B**C*")).toStrictEqual([
      { text: "A", marks: [{ kind: "italic" }] },
      { text: "B", marks: [{ kind: "bold" }, { kind: "italic" }] },
      { text: "C", marks: [{ kind: "italic" }] },
    ]);
  });

  const samples: Readonly<Record<string, readonly ProseInline[]>> = {
    素の文字: [{ text: "ふつうの文章です。", marks: [] }],
    太字: [{ text: "ここが大事", marks: [{ kind: "bold" }] }],
    斜体: [{ text: "そっと強調", marks: [{ kind: "italic" }] }],
    打ち消し: [{ text: "やめた話", marks: [{ kind: "strike" }] }],
    行内コード: [{ text: "pnpm dev", marks: [{ kind: "code" }] }],
    リンク: [{ text: "案内", marks: [{ kind: "link", href: "https://example.com/a" }] }],
    文字色: [{ text: "強調したい", marks: [{ kind: "color", token: "accent" }] }],
    背景色: [{ text: "目立たせたい", marks: [{ kind: "bg", token: "warn" }] }],
    文字色と背景色: [
      {
        text: "両方",
        marks: [
          { kind: "bg", token: "muted" },
          { kind: "color", token: "danger" },
        ],
      },
    ],
    太字のリンク: [
      {
        text: "押すところ",
        marks: [{ kind: "link", href: "/s/a/b" }, { kind: "bold" }],
      },
    ],
    混ざった行: [
      { text: "まず ", marks: [] },
      { text: "ここ", marks: [{ kind: "bold" }] },
      { text: " を見て、次に ", marks: [] },
      { text: "こちら", marks: [{ kind: "link", href: "https://example.com/b" }] },
      { text: " へ。", marks: [] },
    ],
  };

  for (const [name, runs] of Object.entries(samples)) {
    it(`${name} は往復しても変わらない`, () => {
      expect(roundTrip(runs)).toStrictEqual(runs);
    });
  }

  it("包む順が違っても、読み込んだ時点で同じ形に揃う", () => {
    /*
      `**[a](x)**` と `[**a**](x)` は読者には同じもの。順が入力ごとに違うと、
      本文を触っていないのに保存のたび差分が出る。
    */
    const a = serializeInline(parseInline("**[案内](https://example.com)**"));
    const b = serializeInline(parseInline("[**案内**](https://example.com)"));
    expect(a).toBe(b);
  });

  it("端に空白の紛れた装飾でも、記号が読者へ出ない", () => {
    /*
      範囲を選んで太字にすると、選択の端に空白が紛れる。
      `** 大事 **` は装飾として読まれないので、そのまま書くと
      読者の画面に `**` が出る。空白は囲みの外へ出す。
    */
    const written = serializeInline([{ text: " 大事 ", marks: [{ kind: "bold" }] }]);
    expect(written).toBe(" **大事** ");
    expect(plainInline(written)).toBe(" 大事 ");
  });

  it("読み込んで書き戻す操作は 2 回目以降で形を変えない", () => {
    const source = "**[案内](https://example.com)** と `code` と ~~消し~~";
    const once = serializeInline(parseInline(source));
    expect(serializeInline(parseInline(once))).toBe(once);
  });

  for (const href of [
    "https://example.com/products(size)",
    "https://example.com/products(size(compact))",
    String.raw`https://example.com/products\(escaped\)`,
  ]) {
    it(`リンク先「${href}」の括弧とバックスラッシュを往復して保つ`, () => {
      const runs: readonly ProseInline[] = [
        { text: "案内", marks: [{ kind: "link", href }] },
      ];

      expect(roundTrip(runs)).toStrictEqual(runs);
    });
  }

  it("手書きのリンク先にある入れ子の丸括弧を 1 つの行き先として読む", () => {
    expect(parseInline("[案内](https://example.com/products(size(compact)))")).toStrictEqual([
      {
        text: "案内",
        marks: [{ kind: "link", href: "https://example.com/products(size(compact))" }],
      },
    ]);
  });
});

describe("行の中の装飾 — 読めなかったとき", () => {
  it("既存本文のパスや未定義のエスケープを消さない", () => {
    for (const source of [String.raw`C:\Users\Alice`, String.raw`\q`, String.raw`\日本語`]) {
      expect(plainInline(source)).toBe(source);
    }
  });

  const unreadable = [
    "閉じ忘れた **太字",
    "閉じ忘れた `コード",
    "掛け算 2 * 3 * 4 の話",
    "角かっこ [だけ] の文",
    "知らない属性 [文字]{id=x}",
    "許していない色 [文字]{color=#ff0000}",
    "許していない名前 [文字]{color=beniiro}",
    "空の囲み **** の話",
  ];

  for (const source of unreadable) {
    it(`「${source}」の文字が 1 つも消えない`, () => {
      expect(plainInline(source)).toBe(source);
    });
  }

  it("行内コードの中の記号は装飾として読まれない", () => {
    const runs = parseInline("`**これは太字ではない**`");
    expect(runs).toStrictEqual([
      { text: "**これは太字ではない**", marks: [{ kind: "code" }] },
    ]);
  });

  it("逃がした記号は文字として戻る", () => {
    const runs: readonly ProseInline[] = [{ text: "**そのままの記号**", marks: [] }];
    expect(roundTrip(runs)).toStrictEqual(runs);
  });

  for (const source of [
    "[案内](https://example.com/products(size)",
    "[案内](https://example.com/products(size(compact))",
    "[危険](javascript:alert(1",
  ]) {
    it(`閉じていないリンク「${source}」は、行き先にせず文字のまま残す`, () => {
      const runs = parseInline(source);

      expect(plainInline(source)).toBe(source);
      expect(runs.flatMap((run) => run.marks).some((mark) => mark.kind === "link")).toBe(false);
    });
  }
});

describe("行の中の装飾 — 色の名前", () => {
  it("色は名前でしか指定できない（任意の値を受け取らない）", () => {
    expect(isProseColorToken("#ff0000")).toBe(false);
    expect(isProseColorToken("red")).toBe(false);
    expect(isProseColorToken("accent")).toBe(true);
  });

  it("名前ごとに運営者向けの言い方がある", () => {
    for (const token of PROSE_COLOR_TOKENS) {
      expect(PROSE_COLOR_LABEL[token], token).not.toBe("");
    }
  });

  it("装飾を落とすと素の文字だけが残る（目次や要約で記法を見せない）", () => {
    expect(plainInline("**大事**な `話` と [案内](https://example.com)")).toBe(
      "大事な 話 と 案内",
    );
  });
});
