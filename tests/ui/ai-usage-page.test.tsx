/**
 * @tier 2
 * @req REQ-TM02, REQ-TM03
 * @types screen-states, a11y
 *
 * AI の利用と費用の画面。
 *
 * --- ここでしか描けない状態 ---
 * 画面をまとめて描く検査（page-render）は保存先の無い環境で走るので、
 * この画面は必ず「空」か「エラー」の側になる。**数字が並んだ状態**は、
 * 差し替えを入れたここでしか通らない。
 *
 * --- 見るのは「数字」ではなく「数字の限界」 ---
 * 2026-08-19 に測ったところ、次の 3 つはどれを壊しても 4090 件すべて緑だった。
 *   - 価格未登録のモデルを、ただの金額として出す（限界が消える）
 *   - 行の見出し (`<th scope="row">`) を、ただのマスにする
 *   - 列の見出しから `scope` を全部落とす
 * 追跡表はこの 3 つを「対応」と書いていた。**書いてあるだけだった。**
 *
 * a11y の総当たり (axe) はこの画面も回しているが、
 * **表の見出しの向きは見ていない**。届いているのに測る側が見ていない形なので、
 * 道具を替えるのではなく、ここで自分で見る。
 */
import { describe, expect, it, vi } from "vitest";
import { describeViolations, findA11yViolations } from "../support/a11y";
import { renderMarkup } from "../support/render";

type Row = {
  siteSlug: string;
  modelId: string;
  modelLabel: string;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  avgDurationMs: number;
  costLabel: string;
  priced: boolean;
};

let report: unknown = null;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    telemetryNotice: async () => ({ kind: "sample", reason: "見本の保存先です。" }),
    telemetryUseCases: async () => ({
      aiUsage: { execute: async () => ({ ok: true, value: report }) },
    }),
  };
});

const Page = (await import("@/app/admin/ai-usage/page")).default;

function row(over: Partial<Row> = {}): Row {
  return {
    siteSlug: "video-editing-gear",
    modelId: "claude-sonnet-5",
    modelLabel: "Claude Sonnet 5",
    calls: 12,
    failures: 1,
    inputTokens: 1200,
    outputTokens: 340,
    avgDurationMs: 2100,
    costLabel: "1,200 円",
    priced: true,
    ...over,
  };
}

async function draw(rows: readonly Row[], caveats: readonly string[] = []): Promise<string> {
  report = {
    rows,
    caveats,
    totalCalls: rows.reduce((a, r) => a + r.calls, 0),
    totalFailures: rows.reduce((a, r) => a + r.failures, 0),
    totalCostLabel: "1,200 円",
    emptyReason: null,
  };
  return renderMarkup(Page({ searchParams: Promise.resolve({}) }));
}

describe("数字と一緒に、その数字の限界を出す", () => {
  it("価格の分からないモデルは、金額ではなく「価格未登録」と出る", async () => {
    // 0 円や空欄で出すと、**安く使えたように読める**。
    // 合計が小さく見えるだけなので、目視では誤りに気づけない。
    const html = await draw([row({ priced: false, costLabel: "0 円" })]);
    expect(html).toContain("価格未登録");
  });

  it("価格の分かるモデルは、そのまま金額で出る", async () => {
    const html = await draw([row({ priced: true, costLabel: "1,200 円" })]);
    expect(html).toContain("1,200 円");
    expect(html).not.toContain("価格未登録");
  });

  it("この数字の読み方（概算であること）が、数字と同じ画面に出る", async () => {
    const html = await draw([row()], ["費用は概算です。実際の請求額とは一致しません。"]);
    expect(html).toContain("請求額とは一致しません");
  });

  it("プロンプトの本文を持っていないことを、画面上で明言する", async () => {
    const html = await draw([row()]);
    expect(html).toContain("参照");
  });
});

describe("表の見出しが、どちらの向きの見出しかを名乗る", () => {
  it("列の見出しは列の見出しとして出る", async () => {
    // `scope` が無いと、読み上げが「どの列の数字か」を言えない。
    // 数字だけが 8 個読み上げられる表になる。
    const html = await draw([row()]);
    expect(html).toContain('scope="col"');
    expect((html.match(/scope="col"/g) ?? []).length).toBe(8);
  });

  it("行の見出し（ブログ名）は、ただのマスではなく行の見出しとして出る", async () => {
    const html = await draw([row()]);
    expect(html).toContain('scope="row"');
  });

  it("数字が並んだ状態を、読み上げの自動検査にかける", async () => {
    // 画面をまとめて回す検査 (page-render) は保存先が無いので、
    // この画面を**空の状態でしか**axe に通していない。
    // 表が出ている状態は、行が増えたここでしか見られない。
    // ただし axe は見出しの向き（上の 2 件）を見ない。**これは重ねる検査であって、
    // 上の 2 件の代わりではない。**
    const violations = await findA11yViolations(await draw([row(), row({ modelId: "x" })]));
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});

describe("1 件も無いとき", () => {
  it("空白ではなく、なぜ無いのかが出る", async () => {
    report = {
      rows: [],
      caveats: [],
      totalCalls: 0,
      totalFailures: 0,
      totalCostLabel: "0 円",
      emptyReason: "この期間に AI を使った記録がありません。",
    };
    const html = await renderMarkup(Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("この期間に AI を使った記録がありません。");
  });
});
