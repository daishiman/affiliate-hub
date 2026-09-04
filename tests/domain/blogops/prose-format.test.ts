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
  PROSE_MENU_ORDER,
  PROSE_NODE_KINDS,
  PROSE_NODE_KEYWORDS,
  PROSE_NODE_LABEL,
  parseProse,
  serializeProse,
} from "@/domain/blogops";

/** 往復して同じであること。期待値を手で書かないのは、表を直した日に古い表を守らないため。 */
function roundTrip(nodes: readonly ProseNode[]): readonly ProseNode[] {
  return parseProse(serializeProse(nodes));
}

describe("本文の断片 — 保存の往復", () => {
  const samples: Readonly<Record<string, readonly ProseNode[]>> = {
    段落: [{ kind: "paragraph", text: "はじめての人に向けてまとめました。" }],
    複数行の段落: [{ kind: "paragraph", text: "1 行目\n2 行目" }],
    小見出し3: [{ kind: "heading", level: 3, text: "必要な条件" }],
    小見出し4: [{ kind: "heading", level: 4, text: "細かい話" }],
    箇条書き: [{ kind: "bullet-list", items: ["ひとつ", "ふたつ"] }],
    番号付き: [{ kind: "ordered-list", items: ["最初", "次", "最後"] }],
    引用: [{ kind: "quote", text: "引用した文\n続き" }],
    区切り線: [{ kind: "divider" }],
    画像: [{ kind: "image", src: "/media/a.png", alt: "机の上の様子" }],
    注意書き: [
      { kind: "callout", tone: "tip", title: "はじめての人へ", text: "まずここを読む。" },
    ],
    商品カード: [{ kind: "product-card", productId: "pc_abc123" }],
    比較表: [
      {
        kind: "comparison-table",
        headers: ["名前", "重さ", "値段"],
        rows: [
          ["見本 A", "1.2kg", "1 万円台"],
          ["見本 B", "0.9kg", "2 万円台"],
        ],
      },
    ],
  };

  for (const [name, nodes] of Object.entries(samples)) {
    it(`${name} は往復しても変わらない`, () => {
      expect(roundTrip(nodes)).toStrictEqual(nodes);
    });
  }

  it("全種類を 1 本に並べても、境目を取り違えない", () => {
    const all = Object.values(samples).flat();
    expect(roundTrip(all)).toStrictEqual(all);
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

  it("知らない種類の囲みを捨てず、見える形で残す", () => {
    const parsed = parseProse(":::future-thing id=\"x\"\n中身\n:::");
    expect(parsed.every((n) => n.kind === "paragraph")).toBe(true);
    expect(serializeProse(parsed)).toContain("future-thing");
  });
});

describe("本文の断片 — 素の文章の互換", () => {
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
      expect(PROSE_NODE_LABEL[kind], kind).not.toBe("");
      expect(PROSE_NODE_KEYWORDS[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it("メニューは段落を除く全種類をちょうど 1 回ずつ並べる", () => {
    const expected = PROSE_NODE_KINDS.filter((k) => k !== "paragraph");
    expect([...PROSE_MENU_ORDER].sort()).toStrictEqual([...expected].sort());
    expect(new Set(PROSE_MENU_ORDER).size).toBe(PROSE_MENU_ORDER.length);
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

  it("商品カードに商品の指定が無くても読める（指定は空になる）", () => {
    // 空の商品カードは、画面側が「商品を選んでください」と出すための状態である。
    // ここで null を返すと、その空カードが段落の文字列に化けて選び直せなくなる。
    const [node] = parseProse(":::product-card\n:::");

    expect(node).toMatchObject({ kind: "product-card", productId: "" });
  });
});
