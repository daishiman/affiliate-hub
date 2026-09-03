/**
 * @tier 2
 * @req REQ-UX05
 * @types equivalence, boundary
 *
 * A5: 1 商品から複数ブログへコンセプト別の文章を作成する導線が動作する。
 *
 * 要点は「**切り口を人が毎回入力しない**」こと。ブログの設計図は既に 10 軸の違いを
 * 持っている（誰に・どんな検索意図で・何を目的に・何を評価軸に・どんな場面で・
 * どんな独自体験から・どこまで比べて・どんな立場で結論し・どう内部リンクし・
 * どう行動を促すか）。同じ切り口を画面でもう一度入力させるのは、
 * 既に答えてある質問を毎回聞き直すのと同じ。
 *
 * 見るのは 4 つ。
 *   1. 導線の部品がある
 *   2. ブログを 2 つ以上選ぶと、選んだ数だけ対象が並ぶ
 *   3. 各対象の切り口が、そのブログの設計図から入っている
 *   4. 上書きできる（既定は設計図のまま。変えたい人だけが触る）
 *
 * 3 が本題で、1 と 2 はその前提。ここが入力欄になっていたら、
 * 導線があっても「認知負荷を下げる」は達成していない。
 *
 * 規範: docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md,
 *       docs/spec/feat-uiux-overhaul/component-contract.md
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/** 部品はまだ無い。読み込めないことを 1 件の失敗として出す。 */
async function loadPattern(name: string): Promise<unknown> {
  try {
    const mod: Record<string, unknown> = await import("@/presentation/ui");
    return mod[name] ?? null;
  } catch {
    return null;
  }
}

/** 検査用のブログ 2 本。切り口が違うことが前提（似すぎたブログは作れない決まり）。 */
const SITES = [
  {
    id: "site-morning",
    name: "朝の道具",
    differentiation: {
      audience: "一人暮らしを始めた人",
      searchIntent: "最初の 1 台を選びたい",
      stance: "安いほうを勧める",
    },
  },
  {
    id: "site-pro",
    name: "仕事の道具",
    differentiation: {
      audience: "毎日使う職業の人",
      searchIntent: "買い替えの判断をしたい",
      stance: "長く使えるほうを勧める",
    },
  },
] as const;

const PRODUCT = { id: "prod-1", name: "検査用の商品" } as const;

async function render(extra: Record<string, unknown> = {}): Promise<string> {
  const Part = (await loadPattern("ConceptMatrixLauncher")) as React.ComponentType<Record<string, unknown>> | null;
  if (!Part) return "";
  const props = { product: PRODUCT, sites: SITES, ...extra } as Record<string, unknown>;
  return renderToStaticMarkup(<Part {...props} />);
}

describe("A5 §1 導線がある", () => {
  it("ConceptMatrixLauncher がある", async () => {
    const part = await loadPattern("ConceptMatrixLauncher");
    expect(part, "ConceptMatrixLauncher がまだありません").not.toBeNull();
  });
});

describe("A5 §2 選んだブログの数だけ対象が並ぶ", () => {
  it("2 本選ぶと 2 本分の対象が出る", async () => {
    const html = await render({ selectedSiteIds: SITES.map((s) => s.id) });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    for (const site of SITES) {
      expect(html, `${site.name} の対象が出ていません`).toContain(site.name);
    }
  });

  it("1 本も選んでいないときは、生成を始められない", async () => {
    // 0 本のまま押せると、何も起きないボタンを押させることになる。
    const html = await render({ selectedSiteIds: [] });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    expect(html, "何も選んでいないのに始められます").toMatch(/disabled/);
  });

  it("1 本だけ選べば始められる", async () => {
    // **0 と 2 だけを見ても、切り替わる点は当たらない。**
    // 「0 の次から始められる」が仕様なので、境目は 0 と 1 のあいだにある。
    // ここが無いと「2 本以上でなければ始められない」実装が緑のまま通る。
    const html = await render({ selectedSiteIds: [SITES[0].id] });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    expect(html, "1 本選んでいるのに始められません").not.toMatch(/disabled/);
    expect(html, `${SITES[0].name} の対象が出ていません`).toContain(SITES[0].name);
    // 選んでいないほうが混ざっていれば、選択が効いていない。
    expect(html, `選んでいない ${SITES[1].name} が出ています`).not.toContain(SITES[1].name);
  });
});

describe("A5 §3 切り口が設計図から入る", () => {
  it("選んだブログの切り口が、入力させずに出る", async () => {
    // ここが空欄だったら、設計図が持っている答えをもう一度聞いていることになる。
    const html = await render({ selectedSiteIds: SITES.map((s) => s.id) });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    for (const site of SITES) {
      expect(html, `${site.name} の読者像が出ていません`).toContain(site.differentiation.audience);
      expect(html, `${site.name} の結論の立場が出ていません`).toContain(site.differentiation.stance);
    }
  });

  it("切り口が必須の入力欄になっていない", async () => {
    const html = await render({ selectedSiteIds: SITES.map((s) => s.id) });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    // 必須の入力欄があると、設計図に答えがあるのに毎回入力させることになる。
    expect(html, "切り口が必須入力になっています").not.toMatch(/required[^>]*name="[^"]*stance/);
  });
});

describe("A5 §4 上書きできる", () => {
  it("渡した上書きが、設計図の既定より優先される", async () => {
    const html = await render({
      selectedSiteIds: [SITES[0].id],
      overrides: { [SITES[0].id]: { stance: "今回は高いほうを勧める" } },
    });
    if (!html) {
      expect.fail("ConceptMatrixLauncher がまだありません");
      return;
    }
    expect(html).toContain("今回は高いほうを勧める");
    expect(html, "上書きしたのに既定が残っています").not.toContain(SITES[0].differentiation.stance);
  });
});
