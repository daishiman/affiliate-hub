/** @tier 1 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainError } from "@/domain/shared";
import { validationError } from "@/domain/shared";
import { INITIAL_LLM_CREDENTIAL_STATE } from "@/presentation/admin/maintain/llm-credential-state";

/**
 * 鍵を登録・失効・確認する操作。
 *
 * --- 画面の描画では見えないこと ---
 * 「登録できました」と出ているのに、実は疎通確認が失敗していた、は
 * 描画テストからは見えない。押した先で**失敗を握り潰していないか**は、
 * ここでしか確かめられない。
 *
 * --- 入力した鍵が戻ってこないことを見る ---
 * 戻り値に鍵の値が混ざる壊れ方は、画面を見ても分からない
 * （入力欄に元々出ているので、同じ文字が出ていても気づかない）。
 * だから戻り値そのものを見る。
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC01
 * @types secrets
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/** 差し替えた入口が返すもの。試験ごとに書き換える。 */
type Executed = { actor: unknown; input: unknown };
const executed: Executed[] = [];
let entry: unknown = null;
let result: unknown = null;
/** ログインしている人。`null` は「ログインしていない／確かめられない」。 */
let signedIn: unknown = null;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, llmCredentialEntry: async () => entry, signedInActor: async () => signedIn };
});

const { manageLlmCredentialAction } = await import("@/presentation/admin/maintain/llm-credential-action");

const SECRET = "sk-test-do-not-echo-0123456789";

/**
 * ログインできている人。**見本の身元 (`SAMPLE_ACTOR`) と別物にしてある。**
 *
 * 同じにすると、ログインを見ずに見本へ落ちる作りでも
 * 「身元が渡っている」の試験が緑になり、陽性対照として働かない。
 */
const SIGNED_IN_ACTOR = {
  workspaceId: "ws_signed_in",
  userId: "u_signed_in",
  roles: ["owner"],
  isAiServiceAccount: false,
};

/** 使える状態の入口。呼ばれた内容を控えて、決めた結果を返す。 */
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

function ok(verifyFailure: DomainError | null = null) {
  return { ok: true as const, value: { rows: [], verifyFailure, emptyReason: null } };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  executed.length = 0;
  entry = readyEntry();
  result = ok();
  signedIn = SIGNED_IN_ACTOR;
});

describe("生成 AI の鍵の操作", () => {
  it("提供元が分からないときは、預かり所に触れずに断る", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", apiKey: SECRET }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("providerId");
    // **触れていないこと**まで見る。断り方だけ直して、先に呼んでしまう形が残るため。
    expect(executed).toHaveLength(0);
  });

  it("預かれない状態のときは、その理由をそのまま返す", async () => {
    entry = { ready: false, reason: "元締めの鍵が未登録です。", providers: [] };
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(state.status).toBe("failed");
    // 「登録できませんでした」で終わらせない。やることが違うので理由が要る。
    expect(state.message).toBe("元締めの鍵が未登録です。");
  });

  it("登録は、入力した鍵をそのまま手続きへ渡す", async () => {
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(executed).toHaveLength(1);
    expect(executed[0]?.input).toEqual({
      action: "register",
      providerId: "anthropic",
      apiKey: SECRET,
    });
  });

  it("登録の結果に、入力した鍵が混ざらない", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(state.status).toBe("done");
    expect(JSON.stringify(state)).not.toContain(SECRET);
    expect(state.message).toContain("表示されません");
  });

  it("失効は、失効として手続きへ渡り、やり直し方を返す", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "revoke", providerId: "anthropic" }),
    );
    expect(executed[0]?.input).toEqual({ action: "revoke", providerId: "anthropic" });
    expect(state.status).toBe("done");
    expect(state.message).toContain("登録し直して");
  });

  it("疎通確認は、選んだモデルつきで渡る", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "verify", providerId: "anthropic", modelId: "m-1" }),
    );
    expect(executed[0]?.input).toEqual({
      action: "verify",
      providerId: "anthropic",
      modelId: "m-1",
    });
    expect(state.status).toBe("done");
  });

  it("疎通確認の失敗を、成功として片づけない", async () => {
    // 手続きは「一覧は返すが確認は失敗」を **ok の中の値**として返す。
    // ここで見落とすと、画面には「確かめました」とだけ出る。
    result = ok(validationError("鍵が拒否されました。", "apiKey"));
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "verify", providerId: "anthropic", modelId: "m-1" }),
    );
    expect(state.status).toBe("failed");
    expect(state.message).toContain("鍵が拒否されました");
  });

  it("手続きが断ったときは、直せる言葉と欄の名前を返す", async () => {
    result = { ok: false, error: validationError("API キーが短すぎます。", "apiKey") };
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: "short" }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("apiKey");
    expect(state.message).toContain("短すぎます");
  });
});

/**
 * ログインしていない人がこの操作を押したとき。
 *
 * --- なぜ「断られること」ではなく「届かないこと」を見るのか ---
 * 断りは 2 か所で起こりうる。ログインを見て断る（画面側）と、
 * 役を見て断る（ユースケース側の `integration_key.manage`）である。
 * いま見本の身元は `analyst` だけを持つので、後者でも断られる。
 * つまり**断りだけを見ると、ログインを一切見ていない作りでも緑になる。**
 *
 * 役の一覧は人が編集する表であり、1 行足せば戻る。
 * ログインを見ていないことのほうが原因なので、原因の側を固定する。
 * そのために見るのは「**預かり所へ届いたかどうか**」——
 * 届いていたら、鍵の値は既に画面の外へ出ている。
 *
 * 要件と種別の印はファイルの先頭に 1 度だけ書く（先頭 40 行しか読まれない）。
 * ここに書き足すと、印はあるのに数えられないものが増える。
 */
describe("ログインしていない人からの操作", () => {
  beforeEach(() => {
    signedIn = null;
  });

  it("登録は預かり所へ届かない", async () => {
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(executed).toHaveLength(0);
  });

  it("登録は失敗として返る", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(state.status).toBe("failed");
  });

  it("断る理由が画面に出る", async () => {
    // 無言で失敗させない。押した人には、鍵が悪いのか自分が誰か分からないのかが要る。
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(state.message).toContain("ログイン");
  });

  it("断ったときの戻り値に、入力した鍵が混ざらない", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(JSON.stringify(state)).not.toContain(SECRET);
  });

  it("失効は預かり所へ届かない", async () => {
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "revoke", providerId: "anthropic" }),
    );
    expect(executed).toHaveLength(0);
  });

  it("失効は失敗として返る", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "revoke", providerId: "anthropic" }),
    );
    expect(state.status).toBe("failed");
  });

  it("疎通確認は預かり所へ届かない", async () => {
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "verify", providerId: "anthropic", modelId: "m-1" }),
    );
    expect(executed).toHaveLength(0);
  });

  it("疎通確認は失敗として返る", async () => {
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "verify", providerId: "anthropic", modelId: "m-1" }),
    );
    expect(state.status).toBe("failed");
  });

  it("預かり所が使える状態かどうかを尋ねる前に断る", async () => {
    // 使えない状態のときの理由（「元締めの鍵が未登録です」）を、
    // ログインしていない人へ返さない。**在庫の有無は店の中の話である。**
    entry = { ready: false, reason: "元締めの鍵が未登録です。", providers: [] };
    const state = await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(state.message).not.toContain("元締め");
  });
});

/**
 * 陽性対照。**「全部断る」で直したときに、ここが赤くなる。**
 *
 * ログインを見る作りへ替えるとき、いちばん静かな壊し方は
 * 「常に断る」である。上の 9 件はそれでも全部緑になる。
 */
describe("ログインしている人からの操作", () => {
  it("登録は預かり所へ届く", async () => {
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(executed).toHaveLength(1);
  });

  it("ログインできている人の身元が、そのまま手続きへ渡る", async () => {
    // 見本の身元へ落ちる作りだと、ここが `SAMPLE_ACTOR` になって赤くなる。
    await manageLlmCredentialAction(
      INITIAL_LLM_CREDENTIAL_STATE,
      form({ intent: "register", providerId: "anthropic", apiKey: SECRET }),
    );
    expect(executed[0]?.actor).toBe(SIGNED_IN_ACTOR);
  });
});
