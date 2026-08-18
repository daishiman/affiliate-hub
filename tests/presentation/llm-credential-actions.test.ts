/** @tier 1 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainError } from "@/domain/shared";
import { validationError } from "@/domain/shared";
import { INITIAL_LLM_CREDENTIAL_STATE } from "@/presentation/admin/llm-credential-state";

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

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, llmCredentialEntry: async () => entry };
});

const { manageLlmCredentialAction } = await import("@/presentation/admin/llm-credential-action");

const SECRET = "sk-test-do-not-echo-0123456789";

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
