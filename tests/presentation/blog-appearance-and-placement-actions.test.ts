/**
 * @tier 1
 * @req REQ-UX01, REQ-P07
 * @types decision-table, equivalence, boundary
 *
 * 配色（`manageBlogAppearanceAction`）と掲載（`manageBlogPlacementAction`）の
 * 2 つの口。どちらも **1 つの関数が 2〜4 の操作を引き受ける**。
 *
 * --- なぜ画面のテストでは足りないのか ---
 *
 * 画面は同じ欄の並びを使い回し、`intent` の hidden 欄だけで行き先を変える。
 * 振り分けを間違えても画面は動き、押した人には「保存しました」と出る。
 * 実測（2026-08-31）ではこの 2 ファイルの分岐が **どちらも 0%**——
 * 書いた日から一度も振り分けが確かめられていない。
 *
 * 保存そのものの正しさは `tests/application/manage-blog-appearance.test.ts` と
 * `tests/application/review-blog-placements.test.ts` が本物のユースケースで見ている。
 * ここで見るのは口の仕事だけである:
 *
 * 1. **断る所で断る。**ログインしていない・保存先が無い・知らない業務語・欄の欠落。
 * 2. **画面から届いた形をユースケースの入力へ正しく直す。**
 * 3. **押した操作に対応する行き先へ振り分ける。**
 * 4. **起きたことを言い分ける。**保存と「空だったので消えた」は同じ緑ではない。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/** 再描画の指示は、呼ばれた宛先だけを控える。 */
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
  revalidateTag: () => undefined,
}));

/** ログインできているか。誰であるかとは別の軸。 */
let loggedIn = true;
/** 保存先が用意できているか。自動テストに D1 は無いので、ここで作る。 */
let storageReady = true;

/** 差し替えたユースケースが受け取った入力。届いた形の直し方を、ここで読む。 */
const seen: Record<string, unknown> = {};
const results: Record<string, Result<unknown, DomainError>> = {};

function recording(name: string) {
  return {
    execute: async (_actor: unknown, input: unknown) => {
      seen[name] = input;
      return results[name] as Result<unknown, DomainError>;
    },
  };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    blogAppearanceEntry: async () =>
      storageReady
        ? { ready: true, manage: recording("appearance") }
        : { ready: false, reason: "保存先 (D1) が用意されていません。" },
    blogPlacementEntry: async () =>
      storageReady
        ? { ready: true, review: recording("placement") }
        : { ready: false, reason: "保存先 (D1) が用意されていません。" },
  };
});

const { manageBlogAppearanceAction } = await import(
  "@/presentation/admin/publish/blog-appearance-action"
);
const { manageBlogPlacementAction } = await import(
  "@/presentation/admin/publish/blog-placement-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "string") data.append(key, value);
    else for (const one of value) data.append(key, one);
  }
  return data;
}

beforeEach(() => {
  loggedIn = true;
  storageReady = true;
  revalidated.length = 0;
  for (const key of Object.keys(seen)) delete seen[key];

  results.appearance = ok({ overrides: [] });
  results.placement = ok({ kind: "by_site", missingCount: 0 });
});

describe("配色の口 — 断る所で断る", () => {
  it("ログインしていなければ、保存先を見に行かない", async () => {
    loggedIn = false;
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: "owned-blog" }),
    );
    expect(state.status).toBe("failed");
    expect(seen.appearance).toBeUndefined();
  });

  it("保存先が無ければ、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: "owned-blog" }),
    );
    expect(state).toEqual({
      status: "failed",
      message: "保存先 (D1) が用意されていません。",
    });
    expect(seen.appearance).toBeUndefined();
  });

  /**
   * 知らない業務語を、別の mutation へ寄せない。
   *
   * `save_theme` へ倒す実装にすると、`intent` を書き換えるだけで
   * 「上書きを消すつもりの操作」がブログ全体の配色を書き換える。
   */
  it.each(["", "save", "SAVE_THEME", "delete_site"])(
    "知らない intent %o は、どの操作へも寄せない",
    async (intent) => {
      const state = await manageBlogAppearanceAction(IDLE, form({ intent, siteSlug: "b" }));
      expect(state.status).toBe("failed");
      expect(seen.appearance).toBeUndefined();
    },
  );

  it("intent の欄そのものが無ければ断る", async () => {
    const state = await manageBlogAppearanceAction(IDLE, form({ siteSlug: "owned-blog" }));
    expect(state.status).toBe("failed");
    expect(seen.appearance).toBeUndefined();
  });

  it("対象のブログの欄が無ければ断る", async () => {
    const state = await manageBlogAppearanceAction(IDLE, form({ intent: "save_theme" }));
    expect(state.status).toBe("failed");
    expect(seen.appearance).toBeUndefined();
  });

  /**
   * 欄はあるが空、という形は「欄の欠落」と区別して断る。
   * 空の `siteSlug` で保存口を呼ぶと、どのブログの配色かが決まらないまま
   * 保管庫の所有判定へ落ちる。断る場所は手前のほうがよい。
   */
  it("対象のブログが空文字なら、保存口を呼ばない", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: "   " }),
    );
    expect(state).toEqual({ status: "failed", message: "対象のブログが正しくありません。" });
    expect(seen.appearance).toBeUndefined();
  });

  it("同じ名前の欄が 2 つ届いたら、どちらを採るか決めずに断る", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: ["owned-blog", "someone-else"] }),
    );
    expect(state.status).toBe("failed");
    expect(seen.appearance).toBeUndefined();
  });
});

describe("配色の口 — 押した操作の行き先", () => {
  it("テンプレートを選ぶ", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "select_template", siteSlug: "owned-blog", templateId: " T2 " }),
    );
    expect(seen.appearance).toEqual({
      action: "select_template",
      siteSlug: "owned-blog",
      templateId: "T2",
    });
    expect(state).toEqual({ status: "done", message: "ブログの見せ方を切り替えました。" });
  });

  it("ブログ全体の配色を保存する", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({
        intent: "save_theme",
        siteSlug: "owned-blog",
        brandTheme: "sunrise",
        colorMode: "dark",
      }),
    );
    expect(seen.appearance).toEqual({
      action: "save_theme",
      siteSlug: "owned-blog",
      brandTheme: "sunrise",
      colorMode: "dark",
    });
    expect(state.status).toBe("done");
  });

  /**
   * 全体の配色では `pagePath` を読まない。
   *
   * 読む実装にすると、ページ上書きの画面から流用したフォームで
   * 「全体を変えたつもりが 1 ページだけ変わっていた」が起きる。
   */
  it("全体の配色では、ページの欄が無くても通る", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: "owned-blog" }),
    );
    expect(state.status).toBe("done");
  });

  it("ページの上書きを解除する", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "clear_override", siteSlug: "owned-blog", pagePath: "/about" }),
    );
    expect(seen.appearance).toEqual({
      action: "clear_override",
      siteSlug: "owned-blog",
      pagePath: "/about",
    });
    expect(state).toEqual({
      status: "done",
      message: "このページの上書きを解除し、全体の配色に戻しました。",
    });
  });

  it("ページだけの配色を保存する", async () => {
    results.appearance = ok({ overrides: [{ pagePath: "/about" }] });
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({
        intent: "save_override",
        siteSlug: "owned-blog",
        pagePath: "/about",
        brandTheme: "sunrise",
        colorMode: "",
      }),
    );
    expect(seen.appearance).toEqual({
      action: "save_override",
      siteSlug: "owned-blog",
      pagePath: "/about",
      brandTheme: "sunrise",
      colorMode: "",
    });
    expect(state).toEqual({
      status: "done",
      message: "このページだけの配色を保存しました。",
    });
  });

  it.each(["clear_override", "save_override"])(
    "%s では、ページの欄が無ければ断る",
    async (intent) => {
      const state = await manageBlogAppearanceAction(
        IDLE,
        form({ intent, siteSlug: "owned-blog" }),
      );
      expect(state.status).toBe("failed");
      expect(seen.appearance).toBeUndefined();
    },
  );

  it("ページが空文字なら、保存口を呼ばない", async () => {
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_override", siteSlug: "owned-blog", pagePath: "  " }),
    );
    expect(state).toEqual({ status: "failed", message: "対象のページが正しくありません。" });
    expect(seen.appearance).toBeUndefined();
  });
});

describe("配色の口 — 起きたことを言い分ける", () => {
  /**
   * 両軸とも空だと、下層が上書きの行を消す（不変条件 I2）。
   * ここで「保存しました」とだけ返すと、上書きが消えたことに気づかない。
   */
  it("上書きが空で消えたときは、消えたと言う", async () => {
    results.appearance = ok({ overrides: [] });
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({
        intent: "save_override",
        siteSlug: "owned-blog",
        pagePath: "/about",
        brandTheme: "",
        colorMode: "",
      }),
    );
    expect(state).toEqual({
      status: "done",
      message: "上書きが空だったので、このページは全体の配色に戻りました。",
    });
  });

  /**
   * 残ったかどうかは、**正規化した道**で見る。
   *
   * 生の入力と比べる実装にすると、`about` や `/about/` で保存した人には
   * 必ず「消えました」と出る。保存はできているので、直すまで誰も気づかない。
   */
  it.each(["about", "/about/", "  /about  "])(
    "%o で保存しても、残ったことを見落とさない",
    async (pagePath) => {
      results.appearance = ok({ overrides: [{ pagePath: "/about" }] });
      const state = await manageBlogAppearanceAction(
        IDLE,
        form({ intent: "save_override", siteSlug: "owned-blog", pagePath, brandTheme: "sunrise" }),
      );
      expect(state.message).toBe("このページだけの配色を保存しました。");
    },
  );

  it("別のページの上書きが残っているだけでは、保存したとは言わない", async () => {
    results.appearance = ok({ overrides: [{ pagePath: "/contact" }] });
    const state = await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_override", siteSlug: "owned-blog", pagePath: "/about" }),
    );
    expect(state.message).toBe("上書きが空だったので、このページは全体の配色に戻りました。");
  });
});

describe("配色の口 — 作り直す先", () => {
  /**
   * 配色は読者に出るページの見た目そのものなので、公開面も作り直す。
   * 管理画面だけ新しくすると「保存したのに反映されない」に見える。
   */
  it("成功したときだけ、管理画面と公開面の両方を作り直す", async () => {
    await manageBlogAppearanceAction(
      IDLE,
      form({ intent: "save_theme", siteSlug: "owned blog" }),
    );
    expect(revalidated).toEqual(["/admin/sites/owned%20blog/appearance", "/s/owned blog"]);
  });

  it.each(["select_template", "save_theme", "clear_override", "save_override"])(
    "%s が失敗したら、何も作り直さない",
    async (intent) => {
      results.appearance = err(domainError("FORBIDDEN", "権限がありません。"));
      const state = await manageBlogAppearanceAction(
        IDLE,
        form({ intent, siteSlug: "owned-blog", pagePath: "/about" }),
      );
      expect(state.status).toBe("failed");
      expect(revalidated).toEqual([]);
    },
  );
});

describe("掲載の口 — 断る所で断る", () => {
  it("ログインしていなければ、保存先を見に行かない", async () => {
    loggedIn = false;
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a" }),
    );
    expect(state.status).toBe("failed");
    expect(seen.placement).toBeUndefined();
  });

  it("保存先が無ければ、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a" }),
    );
    expect(state.status).toBe("failed");
    expect(seen.placement).toBeUndefined();
  });

  it.each(["", "remove_all", "SAVE", "delete"])(
    "知らない intent %o は、どの操作へも寄せない",
    async (intent) => {
      const state = await manageBlogPlacementAction(
        IDLE,
        form({ intent, siteSlug: "b", articleSlug: "a" }),
      );
      expect(state.status).toBe("failed");
      expect(seen.placement).toBeUndefined();
    },
  );

  it.each([
    ["siteSlug", { intent: "save", articleSlug: "a" }],
    ["articleSlug", { intent: "save", siteSlug: "b" }],
  ])("%s の欄が無ければ断る", async (_field, entries) => {
    const state = await manageBlogPlacementAction(IDLE, form(entries));
    expect(state.status).toBe("failed");
    expect(seen.placement).toBeUndefined();
  });

  it.each([
    ["対象のブログ", { intent: "save", siteSlug: " ", articleSlug: "a" }],
    ["対象の記事", { intent: "save", siteSlug: "b", articleSlug: "" }],
  ])("%s が空文字なら、台帳を触らない", async (label, entries) => {
    const state = await manageBlogPlacementAction(IDLE, form(entries));
    expect(state).toEqual({ status: "failed", message: `${label}が正しくありません。` });
    expect(seen.placement).toBeUndefined();
  });
});

describe("掲載の口 — 位置は数として読めなければ 0 に倒す", () => {
  /**
   * 位置は「並びの目安」であって鍵ではない。不備として突き返すと、
   * 位置を気にしていない人の保存が止まる。**保存を止めないことが仕様である。**
   */
  it.each([
    ["", 0],
    ["   ", 0],
    ["abc", 0],
    ["-1", 0],
    ["0", 0],
    ["3", 3],
    ["12.7", 12],
  ])("位置 %o は %i として渡す", async (position, expected) => {
    await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a", placement: "top", position }),
    );
    expect(seen.placement).toMatchObject({ position: expected });
  });

  it("位置の欄そのものが無くても 0 で保存する", async () => {
    await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a", placement: "top" }),
    );
    expect(seen.placement).toMatchObject({ position: 0 });
  });
});

describe("掲載の口 — 押した操作の行き先", () => {
  it("記録する", async () => {
    await manageBlogPlacementAction(
      IDLE,
      form({
        intent: "save",
        siteSlug: "owned-blog",
        articleSlug: "note",
        placement: " intro ",
        trackingCode: " tc-1 ",
        position: "2",
      }),
    );
    expect(seen.placement).toEqual({
      action: "save",
      siteSlug: "owned-blog",
      articleSlug: "note",
      placement: "intro",
      trackingCode: "tc-1",
      position: 2,
    });
  });

  /**
   * 追跡符号が空欄なら、鍵ごと渡さない。
   * 空文字を渡すと「符号として空文字を指定した」になり、
   * 符号ありの掲載を空へ書き換える形になる。
   */
  it("追跡符号が空欄なら、鍵ごと渡さない", async () => {
    await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a", placement: "intro", trackingCode: "" }),
    );
    expect(seen.placement).not.toHaveProperty("trackingCode");
  });

  /** 取り消しに位置は要らない。渡すと「位置が合う行だけ消す」に読めてしまう。 */
  it("取り消しでは位置を渡さない", async () => {
    await manageBlogPlacementAction(
      IDLE,
      form({
        intent: "remove",
        siteSlug: "owned-blog",
        articleSlug: "note",
        placement: "intro",
        position: "5",
      }),
    );
    expect(seen.placement).toEqual({
      action: "remove",
      siteSlug: "owned-blog",
      articleSlug: "note",
      placement: "intro",
    });
  });
});

describe("掲載の口 — 掲載漏れの数を答えに載せる", () => {
  /**
   * 保存した 1 件の成否だけを返すと、「1 件足したのに、まだ 5 本が空のまま」が
   * 画面を読み直すまで分からない。掲載の増減は金銭に直結する。
   */
  it("漏れが残っていれば、その本数を言う", async () => {
    results.placement = ok({ kind: "by_site", missingCount: 5 });
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a", placement: "intro" }),
    );
    expect(state.message).toBe("掲載を記録し、読者の記事へ反映しました。掲載のない記事があと 5 本あります。");
  });

  it("漏れが無ければ、無いと言う", async () => {
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent: "remove", siteSlug: "b", articleSlug: "a", placement: "intro" }),
    );
    expect(state.message).toBe("掲載を外し、読者の記事へ反映しました。掲載漏れはありません。");
  });

  /**
   * ブログ 1 つぶんの一覧ではない答えが返ったときに漏れの数を名乗らない。
   * 別の切り口の答えから拾った数を「このブログの漏れ」と言うと、
   * 数が合わないまま金銭の判断に使われる。
   */
  it("ブログ単位でない答えからは、漏れの数を名乗らない", async () => {
    results.placement = ok({ kind: "by_affiliate", rows: [] });
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "b", articleSlug: "a", placement: "intro" }),
    );
    expect(state.message).toContain("掲載漏れはありません。");
  });
});

describe("掲載の口 — 作り直す先", () => {
  it("成功したら、管理画面と読者の記事の両方を作り直す", async () => {
    await manageBlogPlacementAction(
      IDLE,
      form({ intent: "save", siteSlug: "owned-blog", articleSlug: "note", placement: "intro" }),
    );
    expect(revalidated).toEqual([
      "/admin/sites/owned-blog/placements",
      "/s/owned-blog/blog/note",
    ]);
  });

  it.each(["save", "remove"])("%s が失敗したら、何も作り直さない", async (intent) => {
    results.placement = err(domainError("FORBIDDEN", "権限がありません。"));
    const state = await manageBlogPlacementAction(
      IDLE,
      form({ intent, siteSlug: "b", articleSlug: "a", placement: "intro" }),
    );
    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });
});
