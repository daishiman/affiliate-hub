/**
 * @tier 2
 * @req REQ-SEO05
 * @types screen-states, equivalence
 *
 * SEO/AI 検索の指針の画面。
 *
 * --- 使える状態を、ここでしか描けない ---
 * 画面をまとめて描く検査（page-render）は実行環境の外で走るので、
 * この画面は必ず「いま登録できません」側になる。**登録済みの表・再確認の口・
 * 初期候補の登録ボタン**が出ている状態は、差し替えを入れたここでしか通らない。
 * 通していないと、その 3 つは一度も描かれないまま公開される。
 *
 * --- 見るのは並びと、候補の扱い ---
 * 「再確認」が要る行が先に来ること（この画面へ来る理由の大半がそれ）と、
 * 初期候補が**登録済みに混ざらない**ことの 2 つ。どちらも型は通る壊れ方で、
 * 混ざったほうは「登録した覚えのない出典が登録済みに並ぶ」という形で出る。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderDom, renderMarkup } from "../support/render";

let entry: unknown = null;
let listed: unknown = null;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    guidelineReferenceEntry: async () => entry,
    currentActor: async () => ({
      workspaceId: "ws_sample",
      userId: "u_sample",
      roles: ["owner"],
      isAiServiceAccount: false,
    }),
  };
});

const Page = (await import("@/app/admin/settings/seo/page")).default;

function reference(over: Record<string, unknown> = {}) {
  return {
    id: "gr_google",
    title: "Google 検索の AI 機能で成功するためのガイド",
    url: "https://developers.google.com/search/docs/ai",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-06-01",
    ...over,
  };
}

function readyWith(rows: readonly unknown[]) {
  return {
    ready: true as const,
    manage: { execute: async () => listed ?? { ok: true, value: { rows } } },
  };
}

beforeEach(() => {
  listed = null;
  entry = readyWith([{ reference: reference(), status: "fresh", registered: true }]);
});

describe("保存先がまだ無いとき", () => {
  it("理由を出したうえで、追うべき指針の候補は消さない", async () => {
    entry = { ready: false, reason: "保存先（D1）が設定されていません。" };
    const html = await renderMarkup(Page());
    expect(html).toContain("保存先（D1）が設定されていません。");
    expect(html).toContain("追うべき指針の候補");
    // 登録の口は出さない。押せない口を出すと、押した人は壊れたと受け取る。
    expect(html).toContain("登録はまだできません");
  });
});

describe("使える状態", () => {
  it("登録済みの出典が、状態の列つきで並ぶ", async () => {
    const html = await renderMarkup(Page());
    expect(html).toContain("登録済みの出典");
    expect(html).toContain("Google Search Central");
    expect(html).toContain("確認済み");
    expect(html).toContain("海外");
  });

  it("日本の指針は「日本」と出る（値の global/jp をそのまま出さない）", async () => {
    entry = readyWith([
      { reference: reference({ region: "jp", publisher: "消費者庁" }), status: "fresh", registered: true },
    ]);
    const html = await renderMarkup(Page());
    expect(html).toContain("日本");
    expect(html).not.toContain(">jp<");
  });

  it("90 日を超えた出典は「再確認」と出て、確認日を更新する口が付く", async () => {
    entry = readyWith([{ reference: reference(), status: "review_due", registered: true }]);
    const html = await renderMarkup(Page());
    expect(html).toContain("再確認");
    expect(html).toContain("確認日を更新する");
  });

  it("再確認が要る行が先に並ぶ（この画面へ来る理由の大半がそれ）", async () => {
    entry = readyWith([
      { reference: reference({ id: "gr_fresh", title: "新しいほう" }), status: "fresh", registered: true },
      { reference: reference({ id: "gr_due", title: "古いほう" }), status: "review_due", registered: true },
    ]);
    const { document, cleanup } = await renderDom(Page());
    const titles = [...document.querySelectorAll("tbody tr")].map((tr) => tr.textContent ?? "");
    expect(titles[0]).toContain("古いほう");
    expect(titles[1]).toContain("新しいほう");
    cleanup();
  });

  it("1 件も登録していないときは、空であることと次にすることを出す", async () => {
    entry = readyWith([]);
    const html = await renderMarkup(Page());
    expect(html).toContain("まだ出典を登録していません");
    // 空でも「新しい出典を登録する」の口は残る。
    expect(html).toContain("新しい出典を登録する");
    // 更新する口は出さない（更新できる行が無い）。
    expect(html).not.toContain("確認日を更新する");
  });

  it("初期候補は別の節に出て、登録済みへ混ざらない", async () => {
    entry = readyWith([
      { reference: reference(), status: "fresh", registered: true },
      {
        reference: reference({ id: "gr_cand", title: "未登録の候補", note: "要約しか読めていない" }),
        status: "fresh",
        registered: false,
      },
    ]);
    const html = await renderMarkup(Page());
    expect(html).toContain("初期候補 (未登録)");
    expect(html).toContain("登録するまで保存先には入りません");
    expect(html).toContain("未登録の候補");
  });

  it("一覧が出せなかったときは、理由と戻り道を出す（画面を白くしない）", async () => {
    listed = {
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "指針の出典一覧の取得に失敗しました。",
        suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      },
    };
    const html = await renderMarkup(Page());
    expect(html).toContain("指針の出典を出せませんでした");
    expect(html).toContain("指針の出典一覧の取得に失敗しました。");
    expect(html).toContain("保存先の状態を確認");
    expect(html).toContain("設定へ戻る");
  });
});
