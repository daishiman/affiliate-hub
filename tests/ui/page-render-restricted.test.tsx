/**
 * @tier 2
 * @req REQ-S09, REQ-S10
 * @types permission-matrix, screen-states
 *
 * **できてはいけない側**を見る。
 *
 * この検査ができるまで、`permission-matrix` という名前が付いていたのは
 * `page-render-privileged.test.tsx` だけだった。あちらが見ているのは
 * 「**持ち主の身元で断られないこと**」——つまり**できる側**である。
 * 名前は両側を主張し、中身は片側しか見ていなかった。
 *
 * **骨格と本文は、分けて見る。** 最初はまとめて見て緑になった。測ると
 * 32 枚すべてが「違う」に入っており、中身を出したら、違いは
 * **案内のリンク 3 本と、右下の「改善したいことを送る」1 個**だった。
 * まとめて見ているあいだ、本文の側は 1 枚も確かめられていない。
 * **全部が違えば、違うことは何も意味しない。**
 *
 * 骨格（案内・常時出ているボタン）から項目が消えるのは正しい。
 * それは「入口の提示」であって、探しに来た人が到達する場所ではない。
 * **本文が消えるときは違う。**「機能が無い」と「あなたには使えない」は、
 * 利用者にとって別のことである。前者なら諦めるが、後者なら頼めば済む。
 *
 * ここで見るのは 4 つ。
 *
 *   1. 骨格の入口が、読み手の側で**増えない**
 *   2. 骨格から消えた行き先も、**直接開けば本文が描かれる**
 *   3. 本文で押せるものが、読み手の側で**増えない**
 *   4. 本文が権限で変わる画面は、**黙って消えずに理由を出す**
 *
 * 2 が効くのは、リンクを消しても URL は打てるからである。
 * **案内から消えていることは、その画面が守られている理由にならない。**
 *
 * 文言そのものは固定しない。言い回しを直すたびに 30 本落ちる検査を作ると、
 * やがて「文言を直したくないから検査を消す」に行き着く。
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ADMIN_ROUTE_CASES, importPathOf, propsOf } from "./route-table";
import { renderRoute, textOf } from "../support/render";
import { SCREEN_SWEEP_BUDGET_MS } from "../../quality-gates.config.mjs";

/**
 * 身元の役を、検査の途中で差し替えられるようにする。
 *
 * `vi.mock` のファクトリは巻き上げられるため、外の変数をそのまま掴めない。
 * `vi.hoisted` で先に作った入れ物を経由させる。
 */
const identity = vi.hoisted(() => ({ roles: ["analyst"] as readonly string[] }));

vi.mock("@/infrastructure/identity/sample-actor", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const sample = actual.SAMPLE_ACTOR as Record<string, unknown>;
  return {
    ...actual,
    getCurrentActor: async () => ({ ...sample, roles: identity.roles }),
  };
});

/** 持ち主。すべての操作ができる側。 */
const OWNER = ["owner"] as const;
/** 読み手。見本の身元がいま実際に持っている役（読むだけ）。 */
const READER = ["analyst"] as const;

type Rendered = {
  /** `<main>` の中身。その画面が扱っていることそのもの。 */
  readonly body: string;
  /** `<main>` の外。案内・パンくず・常時出ているボタン。 */
  readonly shell: string;
};

/**
 * 骨格と本文を、`<main>` で切る。
 *
 * **除外の一覧を手で書かない。** 「この部品は見ない」を書き足していくと、
 * 書き足すたびに検査の穴が 1 つ増え、しかも穴は増えたようには見えない。
 * ここは実装がすでに持っている境界（`app-shell.tsx` の `<main>`）を
 * そのまま使う。案内も「改善したいことを送る」も `<main>` の外にある。
 */
function splitShell(html: string): Rendered {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  return { body: main, shell: html.replace(main, "") };
}

async function renderAs(roles: readonly string[], file: string): Promise<Rendered> {
  identity.roles = roles;
  const route = ADMIN_ROUTE_CASES.find((r) => r.file === file)!;
  return splitShell(await renderRoute(importPathOf(route.file), propsOf(route)));
}

/** 辿れる行き先。 */
function linksOf(html: string): readonly string[] {
  return html.match(/href="[^"]*"/g) ?? [];
}

/**
 * 「頼めば済む」と分かる言葉が出ているか。
 *
 * 文言そのものではなく、**誰に頼むかが書かれているか**を見る。
 * 実際の拒否文は「提携の管理を任されている担当者だけです」
 * 「ワークスペース管理者に依頼してください」の形をとる。
 *
 * これは補助の検査である。本命は下の「代わりの説明が増えている」で、
 * **そちらは文言に一切依存しない。**
 */
const HAS_WAY_OUT = /管理者|担当者|依頼|権限/;

/** 文の単位に割る。増えた説明を拾うため。 */
function sentencesOf(text: string): readonly string[] {
  return text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}

/** 押せるもの・辿れるものの数。権限で減るのはここである。 */
function actionCount(html: string): number {
  return (html.match(/<button|<form|role="button"/g) ?? []).length;
}

describe("できてはいけない側", () => {
  /**
   * 全画面を両方の身元で描いて、先に集める。
   *
   * 対象の一覧を手で持たない。手で持つと、権限の分岐を 1 つ足した日に
   * **その画面だけ検査されないまま残る**（抜けるのはいつも新しい画面である）。
   */
  const seen: { file: string; owner: Rendered; reader: Rendered }[] = [];

  beforeAll(async () => {
    for (const route of ADMIN_ROUTE_CASES) {
      const owner = await renderAs(OWNER, route.file);
      const reader = await renderAs(READER, route.file);
      seen.push({ file: route.file, owner, reader });
    }
  }, SCREEN_SWEEP_BUDGET_MS);

  it("骨格の入口が、読み手の側で増えない", () => {
    for (const s of seen) {
      expect(
        linksOf(s.reader.shell).length,
        `${s.file}: 読み手のほうが案内の項目が多くなっています`,
      ).toBeLessThanOrEqual(linksOf(s.owner.shell).length);
      expect(
        actionCount(s.reader.shell),
        `${s.file}: 読み手のほうが骨格の押せるものが多くなっています`,
      ).toBeLessThanOrEqual(actionCount(s.owner.shell));
    }
    // 1 つも減らないなら、骨格は権限を見ていない。
    const shrunk = seen.filter(
      (s) => linksOf(s.reader.shell).length < linksOf(s.owner.shell).length,
    );
    expect(shrunk.length, "案内が権限で絞られている画面が 1 枚もありません").toBeGreaterThan(0);
  });

  it("骨格から消えた行き先も、直接開けば本文が描かれる", () => {
    // **隠すことを守りの代わりにしない。** リンクが消えても URL は打てる。
    // ここで見ているのは「消えた先が、開いたときに空にならないこと」である。
    const hidden = new Set(
      seen.flatMap((s) => {
        const shown = new Set(linksOf(s.reader.shell));
        return linksOf(s.owner.shell).filter((l) => !shown.has(l));
      }),
    );
    expect(hidden.size, "案内から消える行き先が 1 つもありません").toBeGreaterThan(0);

    for (const href of hidden) {
      const path = href.slice(6, -1).replace(/^\//, "");
      const target = seen.find((s) => s.file === `${path}/page.tsx`);
      // 経路の表に無い行き先は、ここでは見ない（別の画面の検査が持つ）。
      if (target === undefined) continue;
      expect(
        textOf(target.reader.body).trim(),
        `${path}: 案内から消えているうえ、直接開いても本文が空です`,
      ).not.toBe("");
    }
  });

  it("本文で押せるものが、読み手の側で増えない", () => {
    for (const s of seen) {
      expect(
        actionCount(s.reader.body),
        `${s.file}: 読み手のほうが押せるものが多くなっています`,
      ).toBeLessThanOrEqual(actionCount(s.owner.body));
    }
  });

  it("本文が権限で変わる画面は、黙って消えずに理由を出す", () => {
    const differing = seen.filter((s) => s.owner.body !== s.reader.body);
    // ここが 0 なら、権限で変わっているのは案内だけということになる。
    // そのときは名前（`permission-matrix`）が主張しすぎているので、この行が知らせる。
    expect(
      differing.length,
      "本文が権限で変わる画面が 1 枚もありません。出し分けが案内だけで終わっている可能性があります",
    ).toBeGreaterThan(0);

    for (const s of differing) {
      const ownerText = textOf(s.owner.body);
      const readerText = textOf(s.reader.body);
      expect(readerText.trim(), `${s.file}: 読み手の側の本文が空です`).not.toBe("");

      /*
       * **本命。** 読み手の側にだけある文が 1 つ以上あること。
       *
       * 何かができなくなったなら、代わりに**何かが増えていなければならない**。
       * 増えていなければ、それは黙って消えたということである。
       * 文言そのものは見ないので、言い回しを直しても落ちない。
       */
      const ownerSentences = new Set(sentencesOf(ownerText));
      const added = sentencesOf(readerText).filter((line) => !ownerSentences.has(line));
      expect(
        added,
        `${s.file}: 本文が権限で変わっているのに、代わりの説明が 1 文も増えていません（黙って消えています）`,
      ).not.toEqual([]);

      // 補助。増えた説明が「誰に頼めばよいか」に触れていること。
      expect(
        added.join(" "),
        `${s.file}: 説明は増えていますが、誰に頼めばよいかが書かれていません`,
      ).toMatch(HAS_WAY_OUT);
    }
  });
});
