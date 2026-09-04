/**
 * @tier 2
 * @req REQ-SEO07
 * @types screen-states, a11y, keyboard
 *
 * 公開済み記事の画面に出る「AI 検索の点検で落ちている記事」（受入 A5）。
 *
 * --- ここでしか描けない ---
 * 画面をまとめて描く検査は保存先の外で走るので、この節は必ず 0 件側になる。
 * **落ちた記事が並んでいる状態**は、usecase を差し替えたここでしか通らない。
 * 通していないと、その表は一度も描かれないまま公開される。
 *
 * --- 見るのは「読める文字」 ---
 * A5 の反例は「出るが理由が読めず、`check` の内部名だけが出る」。
 * だから属性やクラス名ではなく、**運営者の目に入る文字**で取る。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeViolations, findA11yViolations } from "../support/a11y";
import { NOW } from "../support/clock";
import { renderDom } from "../support/render";

let failingRows: readonly unknown[] = [];
let truncated = false;
let coverage = { publishedCount: 1, auditedCount: 1, uncheckedCount: 0 };
let auditReadFails = false;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    currentActor: async () => ({
      workspaceId: "ws_sample",
      userId: "u_sample",
      roles: ["owner"],
      isAiServiceAccount: false,
      identified: true,
    }),
    publishedArticleAdminUseCases: async () => ({
      // 公開済み記事の本体は空。ここで見たいのは点検の節だけなので、
      // 一覧側に行を置くと、どちらの表の文字を読んだのか分からなくなる。
      list: { execute: async () => ({ ok: true, value: [] }) },
      listFailingAudits: {
        execute: async () =>
          auditReadFails
            ? {
                ok: false,
                error: {
                  code: "UPSTREAM_UNAVAILABLE",
                  message: "点検履歴を読み取れませんでした。",
                  suggestedAction: "時間をおいて開き直してください。",
                },
              }
            : { ok: true, value: { rows: failingRows, truncated, coverage } },
      },
      getLatestReauditRun: { execute: async () => ({ ok: true, value: null }) },
    }),
  };
});

const Page = (await import("@/app/admin/content/published/page")).default;

beforeEach(() => {
  failingRows = [];
  truncated = false;
  coverage = { publishedCount: 1, auditedCount: 1, uncheckedCount: 0 };
  auditReadFails = false;
});

function aRow(over: Record<string, unknown> = {}) {
  return {
    siteSlug: "home-office-desk",
    slug: "quiet-laptop",
    title: "静かなノートパソコンの選び方",
    type: "guide",
    checkedAt: NOW.toISOString(),
    trigger: "scheduled",
    passedCount: 5,
    totalCount: 7,
    failed: [
      { check: "要点が箇条で読める", hint: "要点を 3〜5 個の箇条書きにする。" },
      { check: "書き手が名乗っている", hint: "書き手の名前と経歴を入れる。" },
    ],
    ...over,
  };
}

async function render() {
  return await renderDom(await Page({ searchParams: Promise.resolve({}) }));
}

async function renderHtml(): Promise<string> {
  const { html, cleanup } = await render();
  cleanup();
  return html;
}

describe("落ちている記事があるとき", () => {
  it("記事の題と、落ちた理由の文言がそのまま読める", async () => {
    failingRows = [aRow()];
    truncated = false;
    const { document, cleanup } = await render();
    try {
      const text = document.body.textContent ?? "";
      expect(text).toContain("静かなノートパソコンの選び方");
      /*
        `check` の識別子ではなく `hint` の文言を出す。
        運営者は「何が落ちたか」ではなく「何をすればよいか」を読む。
      */
      expect(text).toContain("要点を 3〜5 個の箇条書きにする。");
      expect(text).toContain("書き手の名前と経歴を入れる。");
      expect(text).toContain("要修正");
      expect(text).not.toContain("直すとこの一覧から消えます");
      // 直しに行く口が必ず付いている。読めても行けないと、気づいた人が止まる。
      const edit = [...document.querySelectorAll("a")].find(
        (a) => a.textContent?.trim() === "直す",
      );
      expect(edit?.getAttribute("href")).toBe(
        "/admin/content/published/home-office-desk/quiet-laptop/edit",
      );
    } finally {
      cleanup();
    }
  });

  it("落ちた項目の一覧は、表の行の見出しで記事を指している", async () => {
    /*
      keyboard/読み上げの側から見た検査。落ちた記事の表は、どの行がどの記事の話かが
      **セルの位置ではなく名前で**分かる必要がある。目で見る人は左端の列だから記事名だと
      分かるが、読み上げは列の位置を持たない。`scope="row"` があると、
      各セルを読むたびに「どの記事の」が添えられる。
    */
    failingRows = [aRow()];
    truncated = false;
    expect(await renderHtml()).toContain('scope="row"');
  });

  it("「直す」は Tab で到達できる link で、押せない要素になっていない", async () => {
    /*
      実際に Tab を押してはいない。`href` を持つ `<a>` であることから
      **到達順と押下の効きを推定している**（`tests/ui/keyboard-operation.test.tsx` と同じ前提）。
      `<span onClick>` で作ると、目で見てクリックできる人だけが直しに行ける画面になる。
    */
    failingRows = [aRow()];
    truncated = false;
    const { document, cleanup } = await render();
    try {
      const edit = [...document.querySelectorAll("a")].find(
        (a) => a.textContent?.trim() === "直す",
      );
      expect(edit, "「直す」への口がありません").toBeDefined();
      // href の無い `<a>` は Tab の順路に入らない。見た目だけの link になる。
      expect(edit?.getAttribute("href") ?? "").not.toBe("");
      // tabindex="-1" を足すと、読み上げには出るのに Tab では触れなくなる。
      expect(edit?.getAttribute("tabindex")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("落ちた記事が並んだ状態を、読み上げの自動検査にかける", async () => {
    /*
      画面をまとめて回す検査 (page-render) は保存先が無いので、この画面は必ず 0 件側になる。
      **表が出ている状態**は差し替えを入れたここでしか axe に通らない。
      ただし axe は上の 2 件（行の見出しの向き・到達可能性の意図）を見ない。
      **重ねる検査であって、上の 2 件の代わりではない。**
    */
    failingRows = [aRow(), aRow({ slug: "cool-monitor", title: "冷えるモニタの選び方" })];
    truncated = true;
    const violations = await findA11yViolations(await renderHtml());
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it("上限で切ったときは、続きがあることを言う", async () => {
    failingRows = [aRow()];
    truncated = true;
    const { document, cleanup } = await render();
    try {
      // 黙って切ると「落ちているのはこの 50 件で全部」と読まれる。
      expect(document.body.textContent ?? "").toContain("上限まで表示しています");
    } finally {
      cleanup();
    }
  });
});

describe("落ちている記事が無いとき", () => {
  it("全記事が点検済みのときだけ「全合格」と言い、列名だけの空表を出さない", async () => {
    failingRows = [];
    truncated = false;
    const { document, cleanup } = await render();
    try {
      const text = document.body.textContent ?? "";
      expect(text).toContain("全合格");
      expect(text).toContain("点検済みの公開中の記事は、すべて通っています");
      /*
        節ごと消すと、点検が壊れて 0 件になった日と見分けが付かない。
        逆に列名だけの表を出すと「読み込み中かもしれない」と読まれる。
        だから題は出し、表は出さない。
      */
      expect(text).not.toContain("直すところ");
    } finally {
      cleanup();
    }
  });

  it("履歴の無い公開記事があるときは「未点検」と言い、全合格とは言わない", async () => {
    coverage = { publishedCount: 3, auditedCount: 1, uncheckedCount: 2 };

    const { document, cleanup } = await render();
    try {
      const text = document.body.textContent ?? "";
      expect(text).toContain("未点検");
      expect(text).toContain("2 件");
      expect(text).not.toContain("全合格");
    } finally {
      cleanup();
    }
  });

  it("点検結果を読めないときは節を消さず「取得不能」と知らせる", async () => {
    auditReadFails = true;

    const { document, cleanup } = await render();
    try {
      const text = document.body.textContent ?? "";
      expect(text).toContain("取得不能");
      expect(text).toContain("点検履歴を読み取れませんでした");
      expect(text).not.toContain("全合格");
    } finally {
      cleanup();
    }
  });
});
