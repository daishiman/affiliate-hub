/**
 * @tier 2
 * @req REQ-TM10
 * @types screen-states
 *
 * 読者向けの開示ページ（`/s/{site}/measurement`）。
 *
 * --- ここでしか描けない状態 ---
 * 画面をまとめて描く検査（page-render）は cookie もヘッダも無い場所で走るので、
 * この画面は必ず「未回答」の側になる。**許可した人・断った人が見る画面**は、
 * 差し替えを入れたここでしか通らない。
 *
 * --- なぜ足したか ---
 * 2026-08-19 に測ったところ、先頭の「いまの状態: …」の行を丸ごと落としても
 * 4090 件すべてが緑だった。追跡表はこの行を「未回答／許可／拒否のいまの状態を
 * 先頭に表示」と書いていたが、**書いてあるだけだった。**
 *
 * 消えても画面は普通に読める。読者は「自分がどちらを選んだか」だけが
 * 分からなくなる。取り消しの案内だけが残り、何を取り消すのかが読めなくなる。
 */
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { renderMarkup, textOf } from "../support/render";

let choice: "unset" | "granted" | "denied" = "unset";

vi.mock("@/presentation/telemetry/consent-server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, readConsentChoice: async () => choice };
});

const Page = (await import("@/app/s/[site]/measurement/page")).default;

async function draw(as: typeof choice): Promise<string> {
  choice = as;
  return textOf(
    await renderMarkup(Page({ params: Promise.resolve({ site: SAMPLE_SITE_SLUG }) })),
  );
}

describe("いまの状態が、説明の先頭に出る", () => {
  it("未回答・許可・拒否で、出る言葉が 3 通りに分かれる", async () => {
    // 3 つを同時に描かない。差し替えた答えを 1 つの変数で持っているので、
    // 並べて走らせると全部が最後の値を読む（**3 つとも同じ画面になって緑になる**）。
    const unset = await draw("unset");
    const granted = await draw("granted");
    const denied = await draw("denied");
    const heads = [unset, granted, denied].map((t) => {
      const at = t.indexOf("いまの状態");
      expect(at, "「いまの状態」が画面に出ていません").toBeGreaterThanOrEqual(0);
      return t.slice(at, at + 40);
    });
    // 同じ言葉が 2 つ以上あると、選んだ結果が画面に映っていないことになる。
    expect(new Set(heads).size).toBe(3);
  });

  it("何も選んでいない人に、許可した扱いの言葉を見せない", async () => {
    const text = await draw("unset");
    const head = text.slice(text.indexOf("いまの状態"), text.indexOf("いまの状態") + 40);
    expect(head).not.toContain("許可");
  });
});

describe("どの状態でも、説明の中身は同じだけ出る", () => {
  // 断った人に説明を減らすと、「断ると情報が減る」形になり、
  // 断りにくさを作ってしまう。中身は同意の有無で変えない。
  for (const as of ["unset", "granted", "denied"] as const) {
    it(`${as}: 4 つの見出しがそろう`, async () => {
      const text = await draw(as);
      for (const heading of [
        "【記録していること】",
        "【記録しないこと】",
        "【保存する期間】",
        "【取り消す方法】",
      ]) {
        expect(text, `${heading} が出ていません`).toContain(heading);
      }
    });
  }

  it("記録している項目が、1 行も無い状態にならない", async () => {
    // 登録表から作っているので、作り方を間違えると**静かに 0 行**になる。
    // 見出しだけが残り、画面は成立してしまう。
    const text = await draw("granted");
    const body = text.slice(text.indexOf("【記録していること】"), text.indexOf("【記録しないこと】"));
    expect((body.match(/・/g) ?? []).length).toBeGreaterThan(3);
    expect(body).toContain("日で消します");
  });
});
