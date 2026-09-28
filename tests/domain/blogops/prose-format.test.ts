/**
 * @tier 1
 * @req REQ-BLOG05
 * @types boundary, equivalence
 *
 * 種別は**カンマで区切る。**空白区切りは 1 つの名前として読まれ、
 * `TEST_TYPES` のどれにも当たらないまま「種別を宣言していない」に化ける。
 * 印は書いてあるので、落ちた側からは検査のほうが壊れて見える。
 *
 * **当てるのは往復である。**
 *
 * 「読める」「書ける」を別々に確かめても、保存のたびに本文が変わる不具合は
 * 捕まらない。運営者が 1 回押しただけでは気づかず、10 回目に
 * 「書いた覚えのない形」になっている。往復が一致することだけが、
 * それを止められる。
 */

import { describe, expect, it } from "vitest";
import {
  type ProseNode,
  emptyProseNode,
  isEmptyProseNode,
  PROSE_MENU_GROUPS,
  PROSE_MENU_ORDER,
  PROSE_NODE_KINDS,
  PROSE_NODE_METADATA,
  parseProse,
  serializeProse,
} from "@/domain/blogops";
import { PROSE_NODE_FIXTURE_BY_KIND } from "./prose-node-fixture";

/** 往復して同じであること。期待値を手で書かないのは、表を直した日に古い表を守らないため。 */
function roundTrip(nodes: readonly ProseNode[]): readonly ProseNode[] {
  return parseProse(serializeProse(nodes));
}

describe("本文の断片 — 保存の往復", () => {
  for (const kind of PROSE_NODE_KINDS) {
    it(`${kind} は往復しても変わらない`, () => {
      const node = PROSE_NODE_FIXTURE_BY_KIND[kind];
      expect(roundTrip([node])).toStrictEqual([node]);
    });
  }

  const additionalCases: Readonly<Record<string, readonly ProseNode[]>> = {
    複数行の段落: [{ kind: "paragraph", text: "1 行目\n2 行目" }],
    小見出し4: [{ kind: "heading", level: 4, text: "細かい話" }],
    複数行のプログラム: [{ kind: "code", language: "ts", text: "const a = 1;\n\nconsole.log(a);" }],
    言語を決めていないプログラム: [{ kind: "code", language: "", text: "そのまま" }],
  };

  for (const [name, nodes] of Object.entries(additionalCases)) {
    it(`${name} は往復しても変わらない`, () => {
      expect(roundTrip(nodes)).toStrictEqual(nodes);
    });
  }

  it("全種類を 1 本に並べても、境目を取り違えない", () => {
    const all = PROSE_NODE_KINDS.map((kind) => PROSE_NODE_FIXTURE_BY_KIND[kind]);
    expect(roundTrip(all)).toStrictEqual(all);
  });

  for (const kind of ["comparison-table", "table"] as const) {
    it(`${kind} の見出しとセルは | と \\ の組み合わせを保つ`, () => {
      const node: ProseNode = {
        kind,
        headers: ["A | B", String.raw`C\D`, String.raw`E\|F`],
        rows: [["\\", "G | H", String.raw`I\|J`]],
      };

      expect(roundTrip([node])).toStrictEqual([node]);
    });
  }

  it("画像の alt/src は、区切り記号と入れ子括弧の全組み合わせを保つ", () => {
    const alts = ["]", String.raw`図]\左`, "\\]\\"] as const;
    const sources = [
      "https://example.com/image(size).png",
      "https://example.com/image(size(compact)).png",
      String.raw`https://example.com/image\(escaped\)\file.png`,
    ] as const;

    for (const alt of alts) {
      for (const src of sources) {
        const image = { alt, src, width: null, height: null };
        expect(roundTrip([{ kind: "image", ...image }]), `${alt} / ${src}`).toStrictEqual([
          { kind: "image", ...image },
        ]);
        expect(
          roundTrip([{ kind: "image-row", images: [image] }]),
          `image-row: ${alt} / ${src}`,
        ).toStrictEqual([{ kind: "image-row", images: [image] }]);
      }
    }
  });

  it("空の断片も往復する（`/` で選んだ直後に保存されても壊れない）", () => {
    /*
      `divider` 以外の空の断片は保存側で落とす想定だが、
      **落とす前に往復が壊れないこと**を先に確かめる。
      壊れる形を「落としているから大丈夫」と説明し始めると、
      落とす条件が変わった日に静かに壊れる。
    */
    for (const kind of PROSE_NODE_KINDS) {
      const node = emptyProseNode(kind);
      if (kind === "paragraph" || kind === "heading") continue; // 空文字は行として残らない
      expect(roundTrip([node]), kind).toStrictEqual([node]);
    }
  });
});

describe("本文の断片 — 記法とぶつかる文章", () => {
  for (const text of ["before\n```\nafter", "```\n````\n`````", "before\n  ```  \nafter"]) {
    it(`コード本文に囲みと同じ記号があっても分裂しない: ${JSON.stringify(text)}`, () => {
      const node: ProseNode = { kind: "code", language: "md", text };
      expect(roundTrip([node])).toStrictEqual([node]);
    });
  }

  for (const text of ["before\n:::\nafter", "before\n  :::  \nafter", "before\n\\:::\nafter", "before\n:::split\nafter"]) {
    it(`囲みの本文に閉じ・区切り・エスケープがあっても保つ: ${JSON.stringify(text)}`, () => {
      const nodes: readonly ProseNode[] = [
        { kind: "callout", tone: "info", title: "題", text },
        { kind: "toggle", title: "題", text },
        { kind: "columns", left: text, right: text },
      ];
      expect(roundTrip(nodes)).toStrictEqual(nodes);
    });
  }

  it("衝突がない既存のコードと囲みは保存記法を変えない", () => {
    for (const source of [
      "```ts\nconst n = 1;\n```",
      ':::callout tone=info title="題"\n本文\n:::',
      ':::toggle title="題"\n本文\n:::',
      ":::columns\n左\n:::split\n右\n:::",
    ]) {
      expect(serializeProse(parseProse(source))).toBe(source);
    }
  });

  it("旧形式の囲みで文字として書かれたバックスラッシュを消さない", () => {
    const source = ':::callout tone=info title="題"\n\\:::\n本文\n:::';
    expect(parseProse(source)).toStrictEqual([
      { kind: "callout", tone: "info", title: "題", text: "\\:::\n本文" },
    ]);
    expect(serializeProse(parseProse(source))).toBe(source);
  });

  for (const header of [
    ':::product-card id="x"',
    ':::embed url="https://www.youtube.com/embed/x"',
    ':::cta-button href="/guide"',
    ':::link-card url="/guide"',
  ]) {
    it(`${header} の定義にない本文を消さず囲みごと残す`, () => {
      const source = `${header}\n残すべき文章\n:::`;
      expect(parseProse(source)).toStrictEqual([{ kind: "paragraph", text: source }]);
    });
  }

  it("囲まれた表の後ろにある未解釈の文章を捨てない", () => {
    const source = ":::table\n| H |\n| --- |\n| A |\n残すべき文章\n:::";
    expect(parseProse(source)).toStrictEqual([{ kind: "paragraph", text: source }]);
  });

  it("記号で始まる段落を、別の断片として読み直さない", () => {
    const tricky: readonly ProseNode[] = [
      { kind: "paragraph", text: "- これは箇条書きではなく本文です" },
      { kind: "paragraph", text: "### これも見出しではありません" },
      { kind: "paragraph", text: "> 引用のつもりはありません" },
      { kind: "paragraph", text: "::: 囲みでもありません" },
      { kind: "paragraph", text: "| 表でもありません |" },
      { kind: "paragraph", text: "1. 番号付きでもありません" },
    ];
    expect(roundTrip(tricky)).toStrictEqual(tricky);
  });

  it("画像記法と同じ文字列の段落を、画像に変えない", () => {
    const node: ProseNode = { kind: "paragraph", text: "![not image](/x)" };

    expect(roundTrip([node])).toStrictEqual([node]);
  });

  it("手書き画像の逃がした ] と入れ子括弧を、1 つの画像として読む", () => {
    const source = String.raw`![図\]左](https://example.com/image(size(compact)).png)`;

    expect(parseProse(source)).toStrictEqual([
      {
        kind: "image",
        alt: "図]左",
        src: "https://example.com/image(size(compact)).png",
        width: null,
        height: null,
      },
    ]);
  });

  for (const source of [
    "![alt](https://example.com/image(size)",
    "![alt](https://example.com/image.png) trailing",
    String.raw`![alt\](https://example.com/image.png)`,
    "![alt]{https://example.com/image.png}",
  ]) {
    it(`読み切れない画像らしい文字列「${source}」は、段落のまま残す`, () => {
      expect(parseProse(source)).toStrictEqual([{ kind: "paragraph", text: source }]);
    });
  }

  it("壊れた横並び画像の囲みは、全体を文字のまま残す", () => {
    const source = ":::image-row\n![alt](https://example.com/image(size)\n:::";

    expect(parseProse(source)).toStrictEqual([{ kind: "paragraph", text: source }]);
  });

  it("引用符を含む題名が、注意書きの属性を壊さない", () => {
    const node: ProseNode = {
      kind: "callout",
      tone: "warn",
      title: 'ここに " と \\ が入る',
      text: "本文",
    };
    expect(roundTrip([node])).toStrictEqual([node]);
  });

  it("閉じ忘れた囲みは、本文を飲み込まず段落として残る", () => {
    /*
      **消えないことを当てている。**閉じを探して見つからないとき、
      残り全部を囲みの中身として飲み込む実装もありうる。そちらだと
      運営者から見て「保存したら文章が消えた」ことになる。
    */
    const parsed = parseProse(":::callout tone=info title=\"題\"\n本文が続く");
    expect(parsed.some((n) => n.kind === "callout")).toBe(false);
    expect(serializeProse(parsed)).toContain("本文が続く");
  });

  it("寸法を持たない古い画像は、書き出しても寸法が付かない", () => {
    /*
      **既に保存されている記事が 1 文字も動かないことを当てている。**
      ここが崩れると、運営者が触っていない記事まで保存のたびに差分を出す。
    */
    const parsed = parseProse("![机](/media/a.png)");
    expect(parsed).toStrictEqual([
      { kind: "image", src: "/media/a.png", alt: "机", width: null, height: null },
    ]);
    expect(serializeProse(parsed)).toBe("![机](/media/a.png)");
  });

  it("寸法として読むのは `640x360` の形だけで、ほかの題名は場所ごと残す", () => {
    /*
      **知らない書き方を落とさない。**題名を捨てる実装だと、保存を押しただけで
      運営者の書いたものが消える。読めないものは、読めないまま残すほうが直せる。
    */
    const parsed = parseProse('![机](/media/a.png "撮影 2026 年")');
    expect(parsed).toStrictEqual([
      {
        kind: "image",
        src: '/media/a.png "撮影 2026 年"',
        alt: "机",
        width: null,
        height: null,
      },
    ]);
  });

  it("知らない種類の囲みを捨てず、見える形で残す", () => {
    const parsed = parseProse(":::future-thing id=\"x\"\n中身\n:::");
    expect(parsed.every((n) => n.kind === "paragraph")).toBe(true);
    expect(serializeProse(parsed)).toContain("future-thing");
  });
});

describe("本文の断片 — 素の文章の互換", () => {
  it("段落先頭の未定義エスケープは文字として残す", () => {
    const source = String.raw`\日本語と\path`;
    expect(parseProse(source)).toStrictEqual([{ kind: "paragraph", text: source }]);
  });
  it("記法を 1 つも使っていない本文は、段落だけとして読める", () => {
    /*
      これが崩れると、既に保存されている記事の本文が読み直された瞬間に形を変える。
      移行を書かずに済んでいるのは、この 1 件が成り立っているからである。
    */
    const legacy = "むかしからある本文です。\n\n2 つめの段落。";
    expect(parseProse(legacy)).toStrictEqual([
      { kind: "paragraph", text: "むかしからある本文です。" },
      { kind: "paragraph", text: "2 つめの段落。" },
    ]);
  });

  it("空の本文は断片 0 件になる（空の箱を作らない）", () => {
    expect(parseProse("")).toStrictEqual([]);
    expect(parseProse("   \n\n  ")).toStrictEqual([]);
  });
});

describe("本文の断片 — メニューの表", () => {
  it("種類ごとに名前と読みが 1 つずつある（増やしたときの付け忘れを止める）", () => {
    for (const kind of PROSE_NODE_KINDS) {
      expect(PROSE_NODE_METADATA[kind].label, kind).not.toBe("");
      expect(PROSE_NODE_METADATA[kind].keywords.length, kind).toBeGreaterThan(0);
    }
  });

  it("既存の 5 群に、全 19 種を正確な順で分ける", () => {
    expect(PROSE_MENU_GROUPS).toStrictEqual([
      {
        id: "text",
        label: "文章",
        kinds: ["paragraph", "heading", "quote", "callout", "code"],
      },
      {
        id: "list",
        label: "一覧",
        kinds: ["bullet-list", "ordered-list", "checklist", "toggle"],
      },
      {
        id: "look",
        label: "見せ方",
        kinds: ["image", "image-row", "columns", "divider"],
      },
      {
        id: "data",
        label: "データ",
        kinds: ["comparison-table", "table"],
      },
      {
        id: "insert",
        label: "差し込み",
        kinds: ["product-card", "link-card", "cta-button", "embed"],
      },
    ]);
    expect(PROSE_MENU_ORDER).toStrictEqual(PROSE_MENU_GROUPS.flatMap((group) => group.kinds));
  });

  it("メニューは全 19 種をちょうど 1 回ずつ並べる", () => {
    expect([...PROSE_MENU_ORDER].sort()).toStrictEqual([...PROSE_NODE_KINDS].sort());
    expect(new Set(PROSE_MENU_ORDER).size).toBe(PROSE_MENU_ORDER.length);
    expect(PROSE_MENU_ORDER).toHaveLength(19);
  });

  it("空かどうかの判定は、区切り線だけを例外にする", () => {
    for (const kind of PROSE_NODE_KINDS) {
      expect(isEmptyProseNode(emptyProseNode(kind)), kind).toBe(kind !== "divider");
    }
  });
});

/**
 * **記法として読めない書き方をされたとき、何が残るか。**
 *
 * ここに並ぶのは、どれも「運営者が保存を押した結果」である。AI に本文を
 * 書かせる作りなので、記法を半分だけ守った文字列は必ず来る。
 * そのとき **捨てずに段落として残す**のがこの層の約束で、
 * 約束が守られていることを型ではなく実際の入力で確かめる。
 *
 * 捨ててしまうと、運営者から見た出来事は「保存したら文章が消えた」になる。
 * 記法が生のまま見えていれば、少なくとも直せる。
 */
describe("本文の断片 — 記法として読めなかったとき", () => {
  it("表のつもりでも区切り行が無ければ、表にせず段落として残す", () => {
    // `| 見出し |` の次の行に `| --- |` が要る。書き忘れは頻繁に起きる。
    const nodes = parseProse("| 商品 | 値段 |\n| A | 100 円 |");

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.kind).toBe("paragraph");
    // **中身が残っていること。**表として読めなかった行が消えるのがいちばん困る。
    expect(nodes[0]).toMatchObject({ text: "| 商品 | 値段 |\n| A | 100 円 |" });
  });

  it("囲みの名前が読めなければ、囲みごと段落として残す", () => {
    const nodes = parseProse("::: \n中身\n:::");

    expect(nodes[0]?.kind).toBe("paragraph");
    expect(nodes.map((n) => ("text" in n ? n.text : "")).join("")).toContain("中身");
  });

  it("注意書きの調子が知らない名前なら info として読む", () => {
    // 調子は見た目の色だけを決める。知らない名前で本文ごと落とす理由が無い。
    const [node] = parseProse(':::callout tone=いちごおれ title="題"\n本文\n:::');

    expect(node).toMatchObject({ kind: "callout", tone: "info", title: "題", text: "本文" });
  });

  it("注意書きに題が無くても読める（題は空になる）", () => {
    const [node] = parseProse(":::callout tone=warn\n本文\n:::");

    expect(node).toMatchObject({ kind: "callout", tone: "warn", title: "", text: "本文" });
  });

  it("区切りの無い 2 段組は、どこまでが左か決まらないので段落として残す", () => {
    const nodes = parseProse(":::columns\n左だけ書いた\n:::");

    expect(nodes.every((n) => n.kind === "paragraph")).toBe(true);
    expect(serializeProse(nodes)).toContain("左だけ書いた");
  });

  it("表の形をしていない `:::table` は表にせず段落として残す", () => {
    const nodes = parseProse(":::table\nただの文\n:::");

    expect(nodes.every((n) => n.kind === "paragraph")).toBe(true);
    expect(serializeProse(nodes)).toContain("ただの文");
  });

  it("行き先の無い押しボタンは読まない（押せて何も起きないボタンを作らない）", () => {
    const nodes = parseProse(':::cta-button label="押す"\n:::');

    expect(nodes.every((n) => n.kind === "paragraph")).toBe(true);
  });

  it("閉じ忘れたプログラムの囲みは、本文を飲み込まず段落として残る", () => {
    const nodes = parseProse("```ts\nconst a = 1;");

    expect(nodes.every((n) => n.kind === "paragraph")).toBe(true);
    expect(serializeProse(nodes)).toContain("const a = 1;");
  });

  it("チェックリストの印を箇条書きとして読み落とさない", () => {
    /*
      `- [ ] ` は `- ` にも当たる。読む順を逆にすると印が消え、
      運営者から見て「保存したらチェックが全部外れた」ことになる。
    */
    const [node] = parseProse("- [x] 済んだ\n- [ ] まだ");

    expect(node).toStrictEqual({
      kind: "checklist",
      items: [
        { text: "済んだ", checked: true },
        { text: "まだ", checked: false },
      ],
    });
  });

  it("角かっこで始まる箇条書きの項目が、チェックリストに化けない", () => {
    const nodes: readonly ProseNode[] = [
      { kind: "bullet-list", items: ["[ ] これは箇条書きの文字です", "ふつうの項目"] },
    ];
    expect(roundTrip(nodes)).toStrictEqual(nodes);
  });

  it("商品カードに商品の指定が無くても読める（指定は空になる）", () => {
    // 空の商品カードは、画面側が「商品を選んでください」と出すための状態である。
    // ここで null を返すと、その空カードが段落の文字列に化けて選び直せなくなる。
    const [node] = parseProse(":::product-card\n:::");

    expect(node).toMatchObject({ kind: "product-card", productId: "" });
  });
});
