/**
 * @tier 1
 * @req REQ-BOPC01, REQ-BOPC04
 * @req feat-blog-custom-domain, feat-seo-assessment-reflection, feat-aeo-answer-optimization
 * @types equivalence, decision-table, boundary
 *
 * 住所（`manageBlogDomainAction`）・SEO 診断（`manageBlogSeoAction`）・
 * AEO（`manageBlogAeoAction`）の 3 つの口。
 *
 * --- なぜ画面のテストでは足りないのか ---
 *
 * どの口も **1 つの関数が 2〜4 の操作を引き受ける**。画面は同じ欄の並びを
 * 使い回し、`intent` の hidden 欄だけで行き先を変える。振り分けを間違えても
 * 画面は動き、押した人には「保存しました」と出る。住所の口では、それが
 * 「切り替えたつもりが取り下げだった」という形で読者に出る。
 *
 * 保存そのものの正しさはユースケース側のテストが見ている。ここで見るのは 4 つ:
 *
 * 1. **断る所で断る。** ログインしていない・保存先が無い・知らない業務語。
 * 2. **画面から届いた形をユースケースの入力へ正しく直す。**
 * 3. **押した操作に対応する行き先へ振り分ける。**
 * 4. **作り直す面が操作の実態と合っている。** 住所は読者側まで、改善層は
 *    管理画面だけ（AD-3: 診断は指摘を作るだけで読者に出ているものを変えない）。
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

function entryOf(name: string) {
  return async () =>
    storageReady
      ? { ready: true, manage: recording(name) }
      : { ready: false, reason: "保存先 (D1) が用意されていません。" };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    blogDomainsEntry: entryOf("domain"),
    blogSeoEntry: entryOf("seo"),
    blogAeoEntry: entryOf("aeo"),
  };
});

const { manageBlogDomainAction } = await import("@/presentation/admin/publish/blog-domain-action");
const { manageBlogSeoAction, manageBlogAeoAction } = await import(
  "@/presentation/admin/publish/blog-improvement-action"
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

  results["domain"] = ok({ notice: undefined });
  results["seo"] = ok({ assessedArticles: 3, openFindings: [{ id: "f1" }, { id: "f2" }] });
  results["aeo"] = ok({ extractedCount: 4 });
});

describe("住所の口", () => {
  const REGISTER = {
    intent: "register",
    siteSlug: "owned-blog",
    hostname: " blog.example.com ",
  } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogDomainAction(IDLE, form(REGISTER));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("住所");
    expect(seen["domain"]).toBeUndefined();
  });

  it("保存先が無いときは、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageBlogDomainAction(IDLE, form(REGISTER));

    expect(state).toEqual({ status: "failed", message: "保存先 (D1) が用意されていません。" });
    expect(seen["domain"]).toBeUndefined();
  });

  it("知らない操作語は、別の操作へ寄せずに断る", async () => {
    const state = await manageBlogDomainAction(IDLE, form({ ...REGISTER, intent: "delete_all" }));

    expect(state.status).toBe("failed");
    expect(seen["domain"]).toBeUndefined();
  });

  it("ブログの欄そのものが無ければ断る", async () => {
    const state = await manageBlogDomainAction(IDLE, form({ intent: "register" }));

    expect(state.status).toBe("failed");
    expect(seen["domain"]).toBeUndefined();
  });

  it("ブログの欄が空文字なら断る（欄はあるが宛先が無い）", async () => {
    const state = await manageBlogDomainAction(IDLE, form({ ...REGISTER, siteSlug: "  " }));

    expect(state).toMatchObject({ status: "failed", message: "対象のブログが正しくありません。" });
    expect(seen["domain"]).toBeUndefined();
  });

  it("ブログの欄が 2 つ来たら断る（改変された形を通さない）", async () => {
    const state = await manageBlogDomainAction(
      IDLE,
      form({ ...REGISTER, siteSlug: ["owned-blog", "someone-else"] }),
    );

    expect(state.status).toBe("failed");
    expect(seen["domain"]).toBeUndefined();
  });

  it("登録は住所を渡し、まだ読者は開けないことを伝える", async () => {
    const state = await manageBlogDomainAction(IDLE, form(REGISTER));

    expect(seen["domain"]).toEqual({
      action: "register",
      siteSlug: "owned-blog",
      hostname: "blog.example.com",
    });
    expect(state.status).toBe("done");
    expect(state.message).toContain("DNS");
    // 読者側まで作り直す。管理画面だけだと、古い正規 URL が出続ける。
    expect(revalidated).toEqual(["/admin/sites/owned-blog/domains", "/s/owned-blog"]);
  });

  it("ユースケースが言葉を返してきたら、こちらの定型文より優先する", async () => {
    results["domain"] = ok({ notice: "この住所は既に登録済みです。" });

    const state = await manageBlogDomainAction(IDLE, form(REGISTER));

    expect(state.message).toBe("この住所は既に登録済みです。");
  });

  it("登録が断られたら、その理由を画面へ運ぶ", async () => {
    results["domain"] = err(domainError("VALIDATION_FAILED", "住所の形が正しくありません。"));

    const state = await manageBlogDomainAction(IDLE, form(REGISTER));

    expect(state).toMatchObject({ status: "failed", message: "住所の形が正しくありません。" });
    expect(revalidated).toEqual([]);
  });

  it.each([["sync"], ["set_canonical"], ["revoke"]])(
    "%s は住所の指定が無ければ断る",
    async (intent) => {
      const state = await manageBlogDomainAction(
        IDLE,
        form({ intent, siteSlug: "owned-blog" }),
      );

      expect(state.status).toBe("failed");
      expect(seen["domain"]).toBeUndefined();
    },
  );

  it("住所の欄が空文字でも断る", async () => {
    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "sync", siteSlug: "owned-blog", domainId: " " }),
    );

    expect(state).toMatchObject({ status: "failed", message: "対象の住所が正しくありません。" });
  });

  it("取り直しは、外部の状態を見に行かせる", async () => {
    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "sync", siteSlug: "owned-blog", domainId: "dom_1" }),
    );

    expect(seen["domain"]).toEqual({ action: "sync", siteSlug: "owned-blog", domainId: "dom_1" });
    expect(state.status).toBe("done");
    expect(revalidated).toHaveLength(2);
  });

  it("取り直しの結果に言葉があれば、それを見せる", async () => {
    results["domain"] = ok({ notice: "まだ所有権の確認中です。" });

    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "sync", siteSlug: "owned-blog", domainId: "dom_1" }),
    );

    expect(state.message).toBe("まだ所有権の確認中です。");
  });

  it("取り直しが断られたら、作り直さずに理由を返す", async () => {
    results["domain"] = err(domainError("UPSTREAM_UNAVAILABLE", "外部が応答しません。"));

    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "sync", siteSlug: "owned-blog", domainId: "dom_1" }),
    );

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });

  it("正規の住所の切り替えは、読者側まで作り直す", async () => {
    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "set_canonical", siteSlug: "owned-blog", domainId: "dom_1" }),
    );

    expect(seen["domain"]).toEqual({
      action: "set_canonical",
      siteSlug: "owned-blog",
      domainId: "dom_1",
    });
    expect(state.message).toContain("切り替え");
    expect(revalidated).toEqual(["/admin/sites/owned-blog/domains", "/s/owned-blog"]);
  });

  it("切り替えが断られたら理由を返す", async () => {
    results["domain"] = err(domainError("CONFLICT", "証明書がまだ発行されていません。"));

    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "set_canonical", siteSlug: "owned-blog", domainId: "dom_1" }),
    );

    expect(state).toMatchObject({ status: "failed", message: "証明書がまだ発行されていません。" });
  });

  it("取り下げは理由を添えて渡し、既定の住所では読めることを伝える", async () => {
    const state = await manageBlogDomainAction(
      IDLE,
      form({
        intent: "revoke",
        siteSlug: "owned-blog",
        domainId: "dom_1",
        reason: " 契約が切れたため ",
      }),
    );

    expect(seen["domain"]).toEqual({
      action: "revoke",
      siteSlug: "owned-blog",
      domainId: "dom_1",
      reason: "契約が切れたため",
    });
    expect(state.message).toContain("/s/");
  });

  it("取り下げが断られたら理由を返す", async () => {
    results["domain"] = err(domainError("VALIDATION_FAILED", "なぜ止めたのかを書いてください。"));

    const state = await manageBlogDomainAction(
      IDLE,
      form({ intent: "revoke", siteSlug: "owned-blog", domainId: "dom_1", reason: "" }),
    );

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });

  it("ブログ名は URL へそのままつなげない", async () => {
    await manageBlogDomainAction(IDLE, form({ ...REGISTER, siteSlug: "a/b" }));

    expect(revalidated[0]).toBe("/admin/sites/a%2Fb/domains");
  });
});

describe("SEO 診断の口", () => {
  const ASSESS = { intent: "assess", siteSlug: "owned-blog", articleSlug: "" } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogSeoAction(IDLE, form(ASSESS));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("SEO");
    expect(seen["seo"]).toBeUndefined();
  });

  it("保存先が無いときは、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageBlogSeoAction(IDLE, form(ASSESS));

    expect(state).toEqual({ status: "failed", message: "保存先 (D1) が用意されていません。" });
  });

  it("知らない操作語は断る", async () => {
    const state = await manageBlogSeoAction(IDLE, form({ ...ASSESS, intent: "publish" }));

    expect(state.status).toBe("failed");
    expect(seen["seo"]).toBeUndefined();
  });

  it("ブログの欄が無ければ断る", async () => {
    const state = await manageBlogSeoAction(IDLE, form({ intent: "assess" }));

    expect(state.status).toBe("failed");
  });

  it("ブログの欄が空文字なら、どの欄が悪いかを添えて断る", async () => {
    const state = await manageBlogSeoAction(IDLE, form({ ...ASSESS, siteSlug: "" }));

    expect(state).toMatchObject({
      status: "failed",
      message: "対象のブログが正しくありません。",
      field: "siteSlug",
    });
  });

  it("記事名が空ならブログ全体の診断として渡す（記事どうしの重複はこのときだけ出る）", async () => {
    const state = await manageBlogSeoAction(IDLE, form(ASSESS));

    expect(seen["seo"]).toEqual({ action: "assess", siteSlug: "owned-blog" });
    expect(state.status).toBe("done");
    expect(state.message).toBe("3 本を診断し、直す価値のある指摘が 2 件あります。");
    // 読者に出ているものは 1 つも変わらない (AD-3)。管理画面だけを作り直す。
    expect(revalidated).toEqual(["/admin/sites/owned-blog/seo"]);
  });

  it("記事名があれば 1 本だけの診断として渡す", async () => {
    await manageBlogSeoAction(IDLE, form({ ...ASSESS, articleSlug: " note " }));

    expect(seen["seo"]).toEqual({ action: "assess", siteSlug: "owned-blog", articleSlug: "note" });
  });

  it("診断した本数が返らなくても 0 として数える", async () => {
    results["seo"] = ok({ openFindings: [] });

    const state = await manageBlogSeoAction(IDLE, form(ASSESS));

    expect(state.message).toBe("0 本を診断し、直す価値のある指摘が 0 件あります。");
  });

  it("診断が断られたら、作り直さずに理由を返す", async () => {
    results["seo"] = err(domainError("FORBIDDEN", "このブログを触る権限がありません。"));

    const state = await manageBlogSeoAction(IDLE, form(ASSESS));

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });

  it.each([["draft_fix"], ["dismiss"]])("%s は指摘の指定が無ければ断る", async (intent) => {
    const state = await manageBlogSeoAction(IDLE, form({ intent, siteSlug: "owned-blog" }));

    expect(state.status).toBe("failed");
    expect(seen["seo"]).toBeUndefined();
  });

  it("指摘の欄が空文字でも断る", async () => {
    const state = await manageBlogSeoAction(
      IDLE,
      form({ intent: "draft_fix", siteSlug: "owned-blog", findingId: " " }),
    );

    expect(state).toMatchObject({ status: "failed", field: "findingId" });
  });

  it("直しの下書きは「文章ができた」と言わない。できたのは道である", async () => {
    const state = await manageBlogSeoAction(
      IDLE,
      form({ intent: "draft_fix", siteSlug: "owned-blog", findingId: "f1" }),
    );

    expect(seen["seo"]).toEqual({ action: "draft_fix", siteSlug: "owned-blog", findingId: "f1" });
    expect(state.message).toContain("直す場所");
    expect(state.message).not.toContain("下書きを作りました");
    expect(revalidated).toEqual(["/admin/sites/owned-blog/seo"]);
  });

  it("直しの下書きが断られたら理由を返す", async () => {
    results["seo"] = err(domainError("NOT_FOUND", "その指摘は見つかりません。"));

    const state = await manageBlogSeoAction(
      IDLE,
      form({ intent: "draft_fix", siteSlug: "owned-blog", findingId: "f1" }),
    );

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });

  it("見送りは理由を添えて渡し、次から出ないことを伝える", async () => {
    const state = await manageBlogSeoAction(
      IDLE,
      form({
        intent: "dismiss",
        siteSlug: "owned-blog",
        findingId: "f1",
        reason: " 意図してこの書き方にしている ",
      }),
    );

    expect(seen["seo"]).toEqual({
      action: "dismiss",
      siteSlug: "owned-blog",
      findingId: "f1",
      reason: "意図してこの書き方にしている",
    });
    expect(state.message).toContain("次の診断でも出てきません");
  });

  it("見送りが断られたら理由を返す", async () => {
    results["seo"] = err(domainError("VALIDATION_FAILED", "理由を書いてください。"));

    const state = await manageBlogSeoAction(
      IDLE,
      form({ intent: "dismiss", siteSlug: "owned-blog", findingId: "f1", reason: "" }),
    );

    expect(state.status).toBe("failed");
  });
});

describe("AEO の口", () => {
  const PROFILE = {
    intent: "save_profile",
    siteSlug: "owned-blog",
    topicScope: " 掃除機 ",
    audience: " 一人暮らし ",
    publisherName: " 見本ブログ ",
    structuredDataEnabled: "on",
  } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogAeoAction(IDLE, form(PROFILE));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("AEO");
  });

  it("保存先が無いときは、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageBlogAeoAction(IDLE, form(PROFILE));

    expect(state).toEqual({ status: "failed", message: "保存先 (D1) が用意されていません。" });
  });

  it("知らない操作語は断る", async () => {
    const state = await manageBlogAeoAction(IDLE, form({ ...PROFILE, intent: "delete" }));

    expect(state.status).toBe("failed");
    expect(seen["aeo"]).toBeUndefined();
  });

  it("ブログの欄が無ければ断る", async () => {
    const state = await manageBlogAeoAction(IDLE, form({ intent: "save_profile" }));

    expect(state.status).toBe("failed");
  });

  it("ブログの欄が空文字なら断る", async () => {
    const state = await manageBlogAeoAction(IDLE, form({ ...PROFILE, siteSlug: " " }));

    expect(state).toMatchObject({ status: "failed", field: "siteSlug" });
  });

  it("構えの保存は、前後の空白を落として渡す", async () => {
    const state = await manageBlogAeoAction(IDLE, form(PROFILE));

    expect(seen["aeo"]).toEqual({
      action: "save_profile",
      siteSlug: "owned-blog",
      topicScope: "掃除機",
      audience: "一人暮らし",
      publisherName: "見本ブログ",
      structuredDataEnabled: true,
    });
    expect(state.status).toBe("done");
    expect(revalidated).toEqual(["/admin/sites/owned-blog/aeo"]);
  });

  it("印が外れていれば「入っていない」として渡す", async () => {
    await manageBlogAeoAction(IDLE, form({ ...PROFILE, structuredDataEnabled: "" }));

    expect(seen["aeo"]).toMatchObject({ structuredDataEnabled: false });
  });

  it("構えの保存が断られたら、作り直さずに理由を返す", async () => {
    results["aeo"] = err(domainError("VALIDATION_FAILED", "扱う話題を書いてください。"));

    const state = await manageBlogAeoAction(IDLE, form(PROFILE));

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });

  it("取り直しは記事の指定が無ければ断る", async () => {
    const state = await manageBlogAeoAction(IDLE, form({ intent: "extract", siteSlug: "owned-blog" }));

    expect(state.status).toBe("failed");
    expect(seen["aeo"]).toBeUndefined();
  });

  it("記事の欄が空文字でも断る", async () => {
    const state = await manageBlogAeoAction(
      IDLE,
      form({ intent: "extract", siteSlug: "owned-blog", articleSlug: "  " }),
    );

    expect(state).toMatchObject({ status: "failed", field: "articleSlug" });
  });

  it("取り直せた件数を伝える", async () => {
    const state = await manageBlogAeoAction(
      IDLE,
      form({ intent: "extract", siteSlug: "owned-blog", articleSlug: "note" }),
    );

    expect(seen["aeo"]).toEqual({ action: "extract", siteSlug: "owned-blog", articleSlug: "note" });
    expect(state.message).toBe("4 件の引用単位を取り直しました。");
  });

  it("1 件も取れなかったときは、失敗ではなく「その形がまだ無い」と伝える", async () => {
    results["aeo"] = ok({ extractedCount: 0 });

    const state = await manageBlogAeoAction(
      IDLE,
      form({ intent: "extract", siteSlug: "owned-blog", articleSlug: "note" }),
    );

    expect(state.status).toBe("done");
    expect(state.message).toContain("問いと答えの対");
  });

  it("件数が返らなくても 0 として扱う", async () => {
    results["aeo"] = ok({});

    const state = await manageBlogAeoAction(
      IDLE,
      form({ intent: "extract", siteSlug: "owned-blog", articleSlug: "note" }),
    );

    expect(state.status).toBe("done");
    expect(state.message).toContain("1 つも取れませんでした");
  });

  it("取り直しが断られたら理由を返す", async () => {
    results["aeo"] = err(domainError("NOT_FOUND", "その記事は公開されていません。"));

    const state = await manageBlogAeoAction(
      IDLE,
      form({ intent: "extract", siteSlug: "owned-blog", articleSlug: "note" }),
    );

    expect(state.status).toBe("failed");
    expect(revalidated).toEqual([]);
  });
});
