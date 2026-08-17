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
  submitFeedbackAction,
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

/** 送る側から来る 1 件分。画像だけを差し替えたい試験があるので関数にしてある。 */
function submission(capture: Record<string, unknown> | null) {
  return {
    kind: "hard_to_use" as const,
    body: "絞り込みを外すボタンが、どこにあるのか分かりませんでした。",
    wish: "絞り込みの近くに置いてほしいです。",
    origin: {
      screenName: "改善要望の一覧",
      url: "https://hub.test/admin/feedback?status=open",
      route: "/admin/feedback",
      viewportWidth: 1280,
      viewportHeight: 900,
    },
    technical: {
      jsErrors: [],
      failedRequests: [],
      userAgent: "test-agent",
      recentActions: ["絞り込みを開いた"],
      redactedCount: 0,
    },
    capture: capture as never,
  };
}

/** 1x1 の PNG。中身は問わないが、実際に復号できる値を渡す。 */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("改善したいことを送る", () => {
  it("画像なし（文章だけ）でも送れて、礼を返す", async () => {
    const result = await submitFeedbackAction(submission(null));
    expect(result.message).toContain("送りました");
  });

  it("画像つきで送ると、写しが 1 件分の記録に残る", async () => {
    const result = await submitFeedbackAction(
      submission({
        imageBase64: TINY_PNG,
        redactionsBurnedIn: true,
        retainsOriginal: false,
        redactionCount: 2,
        maskedElementCount: 1,
        mimeType: "image/png",
      }),
    );
    // 画像が落ちたときは、その旨が文に出る。ここでは出ないことを見る。
    expect(result.message).toContain("送りました");
    expect(result.message).not.toContain("付けられませんでした");

    const listed = await feedbackUseCases().list.execute(signedIn, {});
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.rows.some((r) => r.screenName === "改善要望の一覧")).toBe(true);
  });

  it("元の画像を残す作りの写しは、要望だけ受け取って画像を捨てる", async () => {
    // 黒塗りを重ねただけの画像は、剥がせば元が見える。受け取らない。
    const result = await submitFeedbackAction(
      submission({
        imageBase64: TINY_PNG,
        redactionsBurnedIn: false,
        retainsOriginal: true,
        redactionCount: 1,
        maskedElementCount: 0,
        mimeType: "image/png",
      }),
    );

    expect(result.message).toContain("付けられませんでした");
  });

  it("本文が空なら、次にどうすればよいかを返す", async () => {
    const result = await submitFeedbackAction({ ...submission(null), body: "   " });
    expect(result.message).not.toBe("");
    expect(result.message).not.toContain("送りました");
  });
});

describe("対応状況を変える", () => {
  it("どの要望かが無いときは、その欄を指して断る", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ intent: "status", status: "in_progress" }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("id");
  });

  it("知らない操作は、黙って何もしないのではなく断る", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "とりあえず保存" }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("intent");
  });

  it("扱いを選ばずに決めようとしたら、扱いの欄を指す", async () => {
    const state = await changeFeedbackStatusAction(
      INITIAL_FEEDBACK_STATUS_STATE,
      form({ id: REPORT, intent: "dispose", reason: "理由だけ書きました。" }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("disposition");
  });

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

  it("失効させると、記録は残ると伝える", async () => {
    const issued = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "失効させる鍵", scopes: ["read", "update_status"] }),
    );
    expect(issued.status).toBe("done");

    const { createDeps } = await import("@/infrastructure/composition");
    const listed = await createDeps().integrationKeys.list(signedIn.workspaceId);
    if (!listed.ok) throw new Error("鍵の一覧が読めませんでした");
    const target = listed.value.find((k) => k.label === "失効させる鍵");
    if (target === undefined) throw new Error("いま発行した鍵が見つかりませんでした");

    const revoked = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "revoke", id: String(target.id) }),
    );
    expect(revoked.status).toBe("done");
    expect(revoked.message).toContain("記録は残ります");
    // 失効させても値は返さない（失効の操作で鍵を知れてはいけない）
    expect(revoked.issuedValue).toBeNull();
  });

  it("知らない鍵を失効させようとしたら、断る", async () => {
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "revoke", id: "ik_does_not_exist" }),
    );
    expect(state.status).toBe("failed");
  });

  it("できることを 1 つも選ばない鍵は発行しない", async () => {
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "何もできない鍵" }),
    );
    expect(state.status).toBe("failed");
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
