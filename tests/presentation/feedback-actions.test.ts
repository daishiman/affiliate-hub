/** @tier 1 */
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
 *   3. 操作の記録の置き場 … 既定は**書ける**側にする（下記）
 * 判断そのもの（状態の遷移・理由の要否）は本物を通す。
 *
 * --- なぜ記録の置き場を差し替えるのか ---
 *
 * 見本の組み合わせ（`pnpm dev` と同じもの）は 2026-08-18 から
 * 控え（この実行中だけ覚える置き場）へ本当に書き足す。
 * それ以前は必ず断っていたため、要望を送る・扱いを変える・払い出すの
 * どれもが「断り」で返り、この画面で見たいこと（礼を返すか・状態が進むか・
 * 回数が増えるか）へ届かなかった。
 *
 * ただし「記録が残せないときに断る」ことも、この画面でしか見られない。
 * そこで `auditWritable` で向きを切り替えられるようにし、
 * **既定は書ける側**、断りを見たいところだけ書けない側にする。
 * 書けない側は `createUnavailableAuditLog()`（呼ぶと必ず失敗する）を指す。
 * 見本の既定が書ける側へ移ったので、ここを見本の実装へ戻すと
 * **断りの検査が黙って通らなくなる**（緑のまま、何も確かめない）。
 * 断りの検査を消していないことは「取りに来るときの鍵」の項で確かめられる。
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

/**
 * ログインできているかどうか。**誰であるか（`signedIn`）とは別の軸である。**
 *
 * 2 つの変数に分けているのは、`currentActor()` が
 * 「確かめられないときは見本の身元へ落ちる」ためである。落ちた先の人が誰かは
 * `signedIn` が決め、そもそも落ちたのかどうかはここが決める。
 * 1 つにまとめると、役を変える試験（下の「人の役割にだけ許す」）と
 * ログインを外す試験が同じ変数を奪い合い、どちらかが黙って効かなくなる。
 *
 * `false` は「ログインしていない」と「保存先に届かず確かめられない」の両方を指す。
 * 断る側から見ると同じもので、`signedInActor()` はどちらも `null` を返す。
 */
let loggedIn = true;
vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, signedInActor: async () => (loggedIn ? signedIn : null) };
});

/** 記録を残せる状態かどうか。`beforeEach` で毎回「残せる」へ戻す。 */
let auditWritable = true;
vi.mock("@/infrastructure/persistence/sample/settings-sample-repository", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  /*
   * 置き場はここに直接書く（`tests/support/doubles.ts` は使わない）。
   * 差し替えの中から別の試験用ファイルを読みに行くと、
   * そのファイルが辿る先にこの差し替え自身が入って読み込みが止まる。
   */
  const written: unknown[] = [];
  const writable = {
    append: async (entry: { id: unknown }) => {
      written.push(entry);
      return { ok: true as const, value: entry.id };
    },
    listByTarget: async () => ({ ok: true as const, value: [] }),
    search: async () => ({ ok: true as const, value: { items: [], nextCursor: null } }),
  };
  return {
    ...actual,
    createSampleAuditLog: () =>
      auditWritable ? writable : (actual.createUnavailableAuditLog as () => unknown)(),
  };
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
  const result = await (await feedbackUseCases()).read.execute(signedIn, { id });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

beforeEach(() => {
  clearFeedbackStore();
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  loggedIn = true;
  auditWritable = true;
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

    const listed = await (await feedbackUseCases()).list.execute(signedIn, {});
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
  /**
   * ここだけ**記録を残せない側**へ倒して動かす（`auditWritable = false`）。
   * 鍵は外から中身を取りに来る入口なので、記録が残らないまま渡すと、
   * 漏れたときにどこまで疑えばよいかが決められない。
   *
   * 値が一度だけ返ることや、道具の口を通しても同じであることは、
   * 記録を残せる組み合わせで `tests/application/feedback.test.ts` と
   * `tests/presentation/feedback-tools.test.ts` が見ている。
   */
  it("誰が出したかを残せないときは、鍵を渡さない", async () => {
    auditWritable = false;
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "手元の Claude Code", scopes: "read" }),
    );

    expect(state.status).toBe("failed");
    // 平文は一度しか出せない。断るときは必ず null で返す。
    expect(state.issuedValue).toBeNull();
    // 「一覧には並ぶが使えない鍵」が残る。それを隠さない。
    expect(state.message).toContain("使えません");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
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

  it("失効も、誰が止めたかを残せないときは実行しない", async () => {
    auditWritable = false;
    // 発行そのものが断られるので、鍵は 1 つも作られていない。
    // それでも「知らない鍵」ではなく、記録の話で断ることを見る。
    const { createDeps } = await import("@/infrastructure/composition");
    const listed = await createDeps().integrationKeys.list(signedIn.workspaceId);
    if (!listed.ok) throw new Error("鍵の一覧が読めませんでした");
    const target = listed.value[0];
    if (target === undefined) return;

    const revoked = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "revoke", id: String(target.id) }),
    );
    expect(revoked.status).toBe("failed");
    // いつ止めたかは、事故のときにいちばん要る。残せないなら止めたことにしない。
    expect(revoked.message).toContain("記録");
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

  /**
   * --- ログインしていない人を、役で断らない ---
   *
   * `currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
   * ログインしていない人の操作が預かり所まで届く。
   * いま実際に断られているのは、見本の身元が持つ役（`analyst`）が
   * `integration_key.manage` を持たないからで、**塞いでいるのは入口ではなく役の一覧である。**
   * 役の一覧は人が編集する表で、1 行足せば戻る。
   *
   * だからここでは `signedIn` を **owner**（役では断られない人）にしたまま
   * `loggedIn` だけを外す。役で断られないようにしておかないと、
   * 入口が開いていても役が塞いでくれて緑になり、この試験は何も見ていないことになる。
   *
   * `ah-5lo`（生成 AI の鍵）と直し方は同じだが、**危ないものの向きが逆である。**
   * あちらは鍵の値が `formData` から入ってくる側で、こちらは
   * `issuedValue` に平文が入って**出ていく**側である。
   */
  it("ログインしていない人には、鍵を発行しない", async () => {
    loggedIn = false;
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "ログインしていない人の鍵", scopes: "read" }),
    );

    expect(state.status, "ログインを見ずに鍵が発行されています").toBe("failed");
  });

  it("ログインしていない人への戻り値に、鍵の値は入らない", async () => {
    loggedIn = false;
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "戻り値の確認用", scopes: "read" }),
    );

    expect(state.issuedValue, "平文の鍵が画面へ返っています").toBeNull();
  });

  it("ログインしていない人の発行は、預かり所へ届かない", async () => {
    // 鍵の置き場は `clearFeedbackStore()` で消えない（要望とは別の置き場である）。
    // 「0 件であること」で見ると、他の試験が先に発行した鍵の有無で結果が変わり、
    // **並び順を変えただけで色が変わる試験**になる。だから前後の差で見る。
    const { createDeps } = await import("@/infrastructure/composition");
    const count = async () => {
      const listed = await createDeps().integrationKeys.list(signedIn.workspaceId);
      if (!listed.ok) throw new Error("鍵の一覧が読めませんでした");
      return listed.value.length;
    };
    const before = await count();

    loggedIn = false;
    await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "預かり所に残ってはいけない鍵", scopes: "read" }),
    );

    // 戻り値が「断り」でも、預かり所に鍵が増えていれば塞げていない。
    // 断りの**形**ではなく、**保存されたかどうか**を見る。
    expect(await count(), "断ったはずの鍵が預かり所に増えています").toBe(before);
  });

  it("ログインしていない人には、失効も実行させない", async () => {
    // 存在しない id を渡すと、ログインを見ていなくても「知らない鍵」で断られる。
    // それでは穴の証拠にならないので、**本当に使える鍵を先に 1 つ作って**から狙う。
    const issued = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "issue", label: "失効を試す的の鍵", scopes: "read" }),
    );
    if (issued.status !== "done") throw new Error("的の鍵を発行できませんでした");

    const { createDeps } = await import("@/infrastructure/composition");
    const find = async () => {
      const listed = await createDeps().integrationKeys.list(signedIn.workspaceId);
      if (!listed.ok) throw new Error("鍵の一覧が読めませんでした");
      const hit = listed.value.find((k) => k.label === "失効を試す的の鍵");
      if (hit === undefined) throw new Error("的の鍵が一覧に見つかりませんでした");
      return hit;
    };
    const target = await find();

    loggedIn = false;
    await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "revoke", id: String(target.id) }),
    );

    // 断りの文言ではなく、**鍵が生きたままであること**を見る。
    expect((await find()).revokedAt, "ログインを見ずに鍵が失効させられています").toBeNull();
  });

  it("ログインしていない人には、鍵の一覧も返さない", async () => {
    loggedIn = false;
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "list" }),
    );

    expect(state.status, "ログインを見ずに鍵の一覧が返っています").toBe("failed");
  });

  it("ログインしていない断りは、理由が画面に出る", async () => {
    loggedIn = false;
    const state = await manageIntegrationAccessAction(
      INITIAL_INTEGRATION_ACCESS_STATE,
      form({ intent: "list" }),
    );

    // 無言で失敗すると、使う人は「壊れている」と受け取って問い合わせに来る。
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});
