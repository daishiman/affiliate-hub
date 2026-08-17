import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 改善要望の画面から押される操作。
 *
 * --- 下読みと払い出しを別物として見る ---
 *
 * 指示文を見ただけで「渡した」ことになると、渡した回数が実態より増える。
 * 逆に渡しても記録が増えないと、同じ要望を 2 人が同時に直す。
 * **同じ 1 つの押し方で両方をまかなわない**ことを、押した結果で固定する。
 *
 * --- 「戻せる」を口約束にしない ---
 *
 * 扱い（対応しない・重複・廃棄）は取り消せると画面に書いてある。
 * 書いてあるだけで戻せない状態は、書いていないより悪い。
 * 取り消しが実際に効くところまで見る。
 *
 * --- 差し替えているもの ---
 *   1. `next/cache` … 画面の作り直しは要求の中でしか呼べない
 *   2. ログイン情報 … 権限で断られる側も見たい
 * 判断そのもの（状態の遷移・理由の要否）は本物を通す。
 */

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

let signedIn: ActorContext = SAMPLE_ACTOR;
vi.mock("@/infrastructure/identity/sample-actor", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getCurrentActor: async () => signedIn };
});

const {
  changeFeedbackStatusAction,
  handOffFeedbackAction,
  manageIntegrationAccessAction,
} = await import("@/presentation/admin/feedback-action");
const {
  INITIAL_FEEDBACK_HANDOFF_STATE,
  INITIAL_FEEDBACK_STATUS_STATE,
  INITIAL_INTEGRATION_ACCESS_STATE,
} = await import("@/presentation/admin/feedback-state");
const { clearFeedbackStore } = await import(
  "@/infrastructure/persistence/sample/feedback-sample-repository"
);
const { feedbackUseCases } = await import("@/presentation/composition");

const REPORT = "fb_sample_sort";

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) for (const v of value) data.append(key, v);
    else data.set(key, value as string);
  }
  return data;
}

/** 1 件の中身をユースケース越しに読む（画面と同じ道を通す）。 */
async function read(id: string) {
  const result = await feedbackUseCases().read.execute(signedIn, { id });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

beforeEach(() => {
  clearFeedbackStore();
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
});

describe("対応状況を変える", () => {
  it("状態を進めると、その状態になったことが文で返る", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "status", status: "in_progress" }),
    );

    expect(state.status).toBe("done");
    expect(state.message).toContain("対応中");
    expect((await read(REPORT)).statusLabel).toBe("対応中");
  });

  it("知らない状態は、どの欄が悪いかを添えて断る", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "status", status: "とりあえず保留" }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("status");
  });

  it("見送りは理由が無いと通らない（判断か放置かが後から分からなくなる）", async () => {
    const withoutNote = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "status", status: "declined" }),
    );
    expect(withoutNote.status).toBe("failed");

    const withNote = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({
        id: REPORT,
        intent: "status",
        status: "declined",
        note: "並び替えは絞り込みで足りるため、いまは足しません。",
      }),
    );
    expect(withNote.status).toBe("done");
  });

  it("扱いを決めても、取り消せば決める前に戻る", async () => {
    const decided = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({
        id: REPORT,
        intent: "dispose",
        disposition: "will_not_fix",
        reason: "並び替えは絞り込みで代わりになるため。",
      }),
    );
    expect(decided.status).toBe("done");
    expect((await read(REPORT)).dispositionLabel).toBe("対応しない");

    const undone = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "undo" }),
    );
    expect(undone.status).toBe("done");
    expect((await read(REPORT)).dispositionLabel).toBeNull();
  });

  it("重複は、どれと同じかが無いと決められない", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({
        id: REPORT,
        intent: "dispose",
        disposition: "duplicate",
        reason: "同じ内容が別に届いています。",
      }),
    );
    expect(state.status).toBe("failed");
  });

  it("権限が無い人には、状態を変えさせない", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["writer"] };
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "status", status: "in_progress" }),
    );
    expect(state.status).toBe("failed");
  });
});

describe("まとめて渡す", () => {
  it("下読みでは、指示文が出るのに渡した回数が増えない", async () => {
    const state = await handOffFeedbackAction(
      INITIAL_FEEDBACK_HANDOFF_STATE,
      form({ ids: REPORT, intent: "preview" }),
    );

    expect(state.status).toBe("done");
    expect(state.previewOnly).toBe(true);
    expect(state.prompts).toHaveLength(1);
    expect((await read(REPORT)).handoffCount).toBe(0);
  });

  it("渡すと回数が増え、同じ指示文がもう一度出る（中身は変わらない）", async () => {
    const first = await handOffFeedbackAction(
      INITIAL_FEEDBACK_HANDOFF_STATE,
      form({ ids: REPORT, intent: "handoff" }),
    );
    expect(first.status).toBe("done");
    expect(first.previewOnly).toBe(false);
    expect((await read(REPORT)).handoffCount).toBe(1);

    const second = await handOffFeedbackAction(
      INITIAL_FEEDBACK_HANDOFF_STATE,
      form({ ids: REPORT, intent: "handoff" }),
    );
    expect(second.prompts[0]?.text).toBe(first.prompts[0]?.text);
    expect((await read(REPORT)).handoffCount).toBe(2);
  });

  it("何も選ばずに押したら、先に選ぶよう伝える", async () => {
    const state = await handOffFeedbackAction(
      INITIAL_FEEDBACK_HANDOFF_STATE,
      form({ intent: "handoff" }),
    );
    expect(state.status).toBe("failed");
    expect(state.message).toContain("選んで");
  });

  it("渡せなかったものは、理由つきで残る（黙って落とさない）", async () => {
    const state = await handOffFeedbackAction(
      INITIAL_FEEDBACK_HANDOFF_STATE,
      form({ ids: [REPORT, "fb_does_not_exist"], intent: "handoff" }),
    );

    expect(state.prompts).toHaveLength(1);
    expect(state.skipped).toHaveLength(1);
    expect(state.skipped[0]?.reportId).toBe("fb_does_not_exist");
    expect(state.skipped[0]?.reason).not.toBe("");
  });
});

describe("取りに来るときの鍵", () => {
  it("発行したときだけ値が返り、控えるよう伝える", async () => {
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "手元の Claude Code", scopes: "read" }),
    );

    expect(state.status).toBe("done");
    expect(state.issuedValue).not.toBeNull();
    expect(state.message).toContain("今回だけ");
  });

  it("一覧を出し直しても、値はもう返らない", async () => {
    await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "一覧の確認用", scopes: "read" }),
    );

    const listed = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "list" }),
    );
    expect(listed.status).toBe("done");
    expect(listed.issuedValue).toBeNull();
  });

  it("名前が無い鍵は発行しない（後から失効させてよいか判断できない）", async () => {
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "   ", scopes: "read" }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("label");
    expect(state.issuedValue).toBeNull();
  });

  it("鍵の管理は人の役割にだけ許す", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["ai_service_account"], isAiServiceAccount: true };
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "AI が自分で作った鍵", scopes: "read" }),
    );

    expect(state.status).toBe("failed");
    expect(state.issuedValue).toBeNull();
  });
});
