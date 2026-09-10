/**
 * @tier 2
 * @req REQ-BOPS01
 * @types screen-states, equivalence
 *
 * ブログ作成ウィザードの画面（`/admin/sites/new`）。
 *
 * --- なぜここを見るのか ---
 *
 * この画面は 1 つの住所で 2 つの姿を持つ。`draftId` が無ければ
 * 「作りかけの一覧」、あれば「13 段階のうちの 1 段階」。まとめて描く検査は
 * 実行環境の外で走るので、**下書きが実在する側の姿は一度も描かれない**。
 *
 * 見るのは 3 つ。
 *
 * 1. **いまどこにいるかを常に出す。**「あと何回答えるのか」が読めないと、
 *    途中でやめる理由になる。
 * 2. **どの段階からも戻れる。**13 段階ぶんのリンクが並び、入力済みかどうかが
 *    文字で分かる（色だけにしない）。
 * 3. **開けない下書きを空の一覧として見せない。**「無い」と「読めない」は
 *    運用者が次に取る行動が違う。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteDraftView } from "@/application/usecases/site/build-site";
import { SITE_WIZARD_STEPS } from "@/domain/authoring/site-draft";
import { renderMarkup } from "../support/render";

let draftResult: unknown = null;
let listResult: unknown = null;
/** 保存先の告知。既定は「保存されます」側。 */
function storage(persisted: boolean) {
  return {
    persisted,
    what: "ブログ作成の下書きの保存先",
    blockedBy: "site_drafts テーブルの追加と D1 への接続",
    stubId: "persistence:site-draft-memory",
    message: persisted
      ? "作りかけの下書きも、作ったブログも保存されます。"
      : "いまは保存されません（この場限りの見本です）。",
  };
}

let notice: unknown = storage(true);

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    siteDraftNotice: async () => notice,
    currentActor: async () => ({
      workspaceId: "ws_sample",
      userId: "u_sample",
      roles: ["owner"],
      isAiServiceAccount: false,
    }),
    siteBuilderUseCases: async () => ({
      getDraft: { execute: async () => draftResult },
      listDrafts: { execute: async () => listResult },
    }),
  };
});

const Page = (await import("@/app/admin/sites/new/page")).default;

function draft(over: Partial<SiteDraftView> = {}): SiteDraftView {
  const steps = SITE_WIZARD_STEPS.map((step, index) => ({
    step,
    label: `段階${index + 1}`,
    question: `質問${index + 1}`,
    done: index < 2,
    position: index + 1,
  }));
  return {
    draftId: "draft-1",
    name: "旅ブログ",
    slug: "tabi",
    steps,
    currentStep: SITE_WIZARD_STEPS[2],
    totalSteps: steps.length,
    doneCount: 2,
    incomplete: [],
    incompleteLabels: [],
    createdSiteSlug: null,
    answers: {},
    categoryCount: 0,
    articleTypes: [],
    fields: [],
    ...over,
  };
}

function render(params: Record<string, string> = {}) {
  return renderMarkup(Page({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  notice = storage(true);
  draftResult = { ok: true, value: draft() };
  listResult = { ok: true, value: { items: [], total: 0, emptyReason: null } };
});

describe("作りかけの一覧（draftId なし）", () => {
  it("0 件でも「始める」だけの画面にせず、何が起きるかを先に書く", async () => {
    const html = await render();
    expect(html).toContain("13 の質問を始める");
    expect(html).toContain("作るまで公開されません");
    expect(html).toContain("作りかけはありません");
  });

  it("作りかけは、続きから開ける住所つきで並ぶ", async () => {
    listResult = {
      ok: true,
      value: {
        total: 2,
        emptyReason: null,
        items: [
          draft({ draftId: "d-1", name: "旅ブログ", doneCount: 5 }),
          // 名前を答える前の下書き。空文字をそのまま出すと押せない行になる。
          draft({ draftId: "d-2", name: "", doneCount: 0, createdSiteSlug: "done" }),
        ],
      },
    };
    const html = await render();
    expect(html).toContain("旅ブログ");
    expect(html).toContain("名前がまだ決まっていない下書き");
    expect(html).toContain("/admin/sites/new?draftId=d-1");
    expect(html).toContain("（まだ公開されていません）");
    expect(html).toContain("（作成済み）");
  });

  it("一覧を出せないときは、空ではなく理由を出す", async () => {
    listResult = {
      ok: false,
      error: { message: "保存先を読めません。", suggestedAction: "しばらく待ってからお試しください。" },
    };
    const html = await render();
    expect(html).toContain("作りかけの一覧を出せませんでした");
    expect(html).toContain("保存先を読めません。");
    // 「0 件」と読み違えられる文言を同時に出さない。
    expect(html).not.toContain("作りかけはありません");
  });

  it("直前の操作の断りは、一覧の手前に残す", async () => {
    const html = await render({ error: "この下書きは作成済みです。" });
    expect(html).toContain("この下書きは作成済みです。");
  });
});

describe("13 段階のうちの 1 段階（draftId あり）", () => {
  it("現在地と、埋まった段階数を同じ画面に出す", async () => {
    const html = await render({ draftId: "draft-1" });
    expect(html).toContain("3 / 13 段階目");
    expect(html).toContain("2 段階まで入力済み");
    expect(html).toContain("質問3");
  });

  it("13 段階ぶんの戻り先が並び、入力済みかどうかが文字で分かる", async () => {
    const html = await render({ draftId: "draft-1" });
    for (const step of SITE_WIZARD_STEPS) {
      // HTML 上では & が &amp; になるので、末尾の断片だけを見る。
      expect(html).toContain(`step=${step}`);
    }
    expect(html).toContain("入力済み");
    expect(html).toContain("まだ入力していません");
    expect(html).toContain("（いま開いています）");
  });

  it("住所の step が知らない値でも、下書きは開く（既定の段階へ倒す）", async () => {
    const html = await render({ draftId: "draft-1", step: "unknown-step" });
    expect(html).toContain("13 段階の進み具合");
  });

  it("開けない下書きは、作りかけの一覧へ戻る道と一緒に断る", async () => {
    draftResult = {
      ok: false,
      error: { message: "この下書きは見つかりません。", suggestedAction: null },
    };
    const html = await render({ draftId: "no-such" });
    expect(html).toContain("この下書きを開けませんでした");
    expect(html).toContain("この下書きは見つかりません。");
    expect(html).toContain("作りかけの一覧へ戻る");
  });
});

describe("保存先が無いとき", () => {
  it("理由を出したうえで、画面そのものは描く", async () => {
    notice = storage(false);
    const html = await render();
    expect(html).toContain("いまは保存されません（この場限りの見本です）。");
    expect(html).toContain("新しいブログを始める");
  });
});
