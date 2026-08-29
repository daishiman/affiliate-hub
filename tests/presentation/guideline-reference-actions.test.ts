/**
 * @tier 1
 * @req REQ-SEO05
 * @types equivalence, boundary, permission-matrix
 *
 * SEO/AI 指針の出典を登録する・再確認する操作。
 *
 * --- 画面の描画では見えないこと ---
 * この操作は 1 つの関数で「登録」と「再確認」の 2 つを受ける
 * （ユースケース側が 1 つの口だから）。どちらへ振るかは `intent` 1 文字列で、
 * **取り違えても画面は同じように「できました」と出る**。
 * 何が手続きへ渡ったのかは、ここでしか確かめられない。
 *
 * --- 断る順序を見る ---
 * ログインを確かめられないときは `formData` を読む前に断る決まりになっている。
 * 順序が入れ替わっても緑になる書き方（結果の文だけを見る）にはしない。
 * **触れていないこと**まで見る。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { domainError, err, ok, validationError } from "@/domain/shared";
import { INITIAL_GUIDELINE_REFERENCE_STATE } from "@/presentation/admin/guideline-reference-state";

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
  revalidateTag: () => undefined,
}));

type Executed = { actor: unknown; input: unknown };
const executed: Executed[] = [];
let entry: unknown = null;
let result: unknown = null;
let signedIn: unknown = null;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    guidelineReferenceEntry: async () => entry,
    signedInActor: async () => signedIn,
  };
});

const { manageGuidelineReferenceAction } = await import(
  "@/presentation/admin/guideline-reference-action"
);

/** 見本の身元と別物にしてある（同じだと身元が渡っているかの試験が空振りする）。 */
const SIGNED_IN_ACTOR = {
  workspaceId: "ws_signed_in",
  userId: "u_signed_in",
  roles: ["owner"],
  isAiServiceAccount: false,
};

function readyEntry() {
  return {
    ready: true as const,
    manage: {
      execute: async (actor: unknown, input: unknown) => {
        executed.push({ actor, input });
        return result;
      },
    },
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const ADD = {
  intent: "add",
  title: "Google 検索の AI 機能で成功するためのガイド",
  url: "https://developers.google.com/search/docs/ai",
  publisher: "Google Search Central",
  region: "global",
  checkedAt: "2026-08-24",
};

const run = (fields: Record<string, string>) =>
  manageGuidelineReferenceAction(INITIAL_GUIDELINE_REFERENCE_STATE, form(fields));

beforeEach(() => {
  executed.length = 0;
  revalidated.length = 0;
  entry = readyEntry();
  result = ok({ rows: [] });
  signedIn = SIGNED_IN_ACTOR;
});

describe("届く前に断る", () => {
  it("ログインを確かめられないときは、手続きへ触れずに断る", async () => {
    signedIn = null;
    const state = await run(ADD);
    expect(state.status).toBe("failed");
    expect(state.message).toContain("ログインしていないため");
    expect(state.message).toContain("指針の出典の登録・再確認");
    expect(executed).toHaveLength(0);
    expect(revalidated).toHaveLength(0);
  });

  it("ログイン済みでも site.manage が無ければ、入力や保存手続きへ進めない", async () => {
    signedIn = { ...SIGNED_IN_ACTOR, roles: ["analyst"] };
    const state = await run(ADD);
    expect(state.status).toBe("failed");
    expect(state.message).toContain("site.manage");
    expect(executed).toHaveLength(0);
    expect(revalidated).toHaveLength(0);
  });

  it("入口が使えないときは、その理由をそのまま返す（「登録できませんでした」で終わらせない）", async () => {
    entry = { ready: false, reason: "保存先（D1）が設定されていません。" };
    const state = await run(ADD);
    expect(state.status).toBe("failed");
    expect(state.message).toBe("保存先（D1）が設定されていません。");
    expect(executed).toHaveLength(0);
  });
});

describe("登録", () => {
  it("入力した欄が、そのまま登録として手続きへ渡る", async () => {
    await run(ADD);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.actor).toBe(SIGNED_IN_ACTOR);
    expect(executed[0]?.input).toEqual({
      action: "add",
      title: ADD.title,
      url: ADD.url,
      publisher: ADD.publisher,
      region: "global",
      checkedAt: "2026-08-24",
    });
  });

  it("intent が空なら境界で断り、登録へ暗黙変換しない", async () => {
    const state = await run({ ...ADD, intent: "" });
    expect(state).toMatchObject({ status: "failed", field: "intent" });
    expect(executed).toHaveLength(0);
  });

  it("知らない intent は境界で断り、別の操作へ暗黙変換しない", async () => {
    const state = await run({ ...ADD, intent: "delete" });
    expect(state).toMatchObject({ status: "failed", field: "intent" });
    expect(executed).toHaveLength(0);
  });

  it("必須欄が丸ごと無いときは境界で断り、undefined を手続きへ流さない", async () => {
    const state = await run({ intent: "add" });
    expect(state.status).toBe("failed");
    expect(executed).toHaveLength(0);
  });

  it("但し書きは前後の空白を落として渡る", async () => {
    await run({ ...ADD, note: "  要約しか読めていない  " });
    expect(executed[0]?.input).toMatchObject({ note: "要約しか読めていない" });
  });

  it("但し書きが空白だけのときは、欄ごと渡さない", async () => {
    await run({ ...ADD, note: "   " });
    expect("note" in (executed[0]?.input as object)).toBe(false);
  });

  it("できたら一覧を作り直し、次にどうなるかまで伝える", async () => {
    const state = await run(ADD);
    expect(state.status).toBe("done");
    expect(state.message).toContain("登録しました");
    // 登録しただけでは原典を確かめたことにならない。次に何が要るかまで言う。
    expect(state.message).toContain("原典未取得");
    expect(revalidated).toEqual(["/admin/settings/seo"]);
  });
});

describe("原典の取り込み", () => {
  it("intent=verify_source のときは、id と本文だけが渡る", async () => {
    await run({
      intent: "verify_source",
      id: "gr_google",
      body: "原典の本文",
      checkedAt: "2026-08-24",
      title: "無視される",
    });
    expect(executed[0]?.input).toEqual({
      action: "verify_source",
      id: "gr_google",
      body: "原典の本文",
    });
  });

  it("できたら、登録・再確認のどちらとも違う文を返す", async () => {
    const state = await run({ intent: "verify_source", id: "gr_google", body: "原典の本文" });
    expect(state.status).toBe("done");
    expect(state.message).toContain("指紋");
    // 本文を保存したと誤解させない。何を残したのかを言い切る。
    expect(state.message).toContain("本文そのものは保存していません");
    expect(state.message).not.toContain("登録しました");
    expect(state.message).not.toContain("確認日を更新しました");
    expect(revalidated).toEqual(["/admin/settings/seo"]);
  });
});

describe("再確認", () => {
  it("intent=recheck のときは、id と確認日だけが渡る", async () => {
    await run({ intent: "recheck", id: "gr_google", checkedAt: "2026-08-24", title: "無視される" });
    expect(executed[0]?.input).toEqual({
      action: "recheck",
      id: "gr_google",
      checkedAt: "2026-08-24",
    });
  });

  it("できたら、登録とは違う文を返す（何が起きたのかが区別できる）", async () => {
    const state = await run({ intent: "recheck", id: "gr_google", checkedAt: "2026-08-24" });
    expect(state.status).toBe("done");
    expect(state.message).toContain("確認日を更新しました");
    expect(state.message).not.toContain("登録しました");
    expect(revalidated).toEqual(["/admin/settings/seo"]);
  });
});

describe("仕様の再評価完了", () => {
  it("画面で確認した本文指紋だけを、再評価完了として渡す", async () => {
    const sha = "b".repeat(64);
    await run({ intent: "acknowledge_reopen", id: "gr_google", expectedContentSha256: sha });
    expect(executed[0]?.input).toEqual({
      action: "acknowledge_reopen",
      id: "gr_google",
      expectedContentSha256: sha,
    });
  });

  it("本文指紋が64桁の16進でなければ手続きへ渡さない", async () => {
    const state = await run({
      intent: "acknowledge_reopen",
      id: "gr_google",
      expectedContentSha256: "not-a-sha",
    });
    expect(state).toMatchObject({ status: "failed", field: "expectedContentSha256" });
    expect(executed).toHaveLength(0);
  });
});

describe("断られたとき", () => {
  it("どの欄が原因かを画面へ返す（欄の脇に出せるようにする）", async () => {
    result = err(validationError("URL は https:// で始まる必要があります。", "url"));
    const state = await run({ ...ADD, url: "http://example.com" });
    expect(state.status).toBe("failed");
    expect(state.field).toBe("url");
    expect(state.message).toContain("https://");
    // 断られたのに一覧を作り直さない。
    expect(revalidated).toHaveLength(0);
  });

  it("欄の分からない不調は field を付けずに返し、次にすることまで出す", async () => {
    result = err(
      domainError("UPSTREAM_UNAVAILABLE", "指針の出典一覧の取得に失敗しました。", {
        retryable: true,
        suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      }),
    );
    const state = await run(ADD);
    expect(state.status).toBe("failed");
    expect(state.field).toBeUndefined();
    expect(state.message).toContain("失敗しました");
    expect(state.message).toContain("保存先の状態を確認");
  });
});
