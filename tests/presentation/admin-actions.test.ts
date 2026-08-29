/** @tier 1 @req REQ-P08 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { SITE_WIZARD_STEPS, authoredSectionsFor } from "@/domain/authoring";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

/**
 * 管理画面の「押したときに動くもの」（サーバーアクション）。
 *
 * --- なぜ画面ではなくここを見るのか ---
 * 画面の描画テストは「ボタンがある」ことしか確かめられない。
 * 押した先で**別のユースケースを呼んでいた**り、**失敗を黙って握りつぶして
 * 「完了しました」と出す**のは、描画からは見えない。
 * ここが薄いと、画面は正しく見えるのに操作だけが効かない状態を作れてしまう。
 *
 * --- 差し替えているもの ---
 *   1. `next/cache` … 画面の作り直しは「要求の中」でしか呼べない
 *   2. ログイン情報 … 役割ごとに何が断られるかを見たい
 *   3. 操作の記録先 … 「残せないなら通さない」の断り方を見たい回だけ
 * いずれも本物の判断（権限・状態遷移）はそのまま通る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / docs/architecture/testing-architecture.md §8
 */

/** 画面の作り直し。要求の外では呼べないので、ここでは何もしない形にする。 */
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/** いま操作している人。テストごとに役割を替える。 */
let signedIn: ActorContext = SAMPLE_ACTOR;
vi.mock("@/infrastructure/identity/sample-actor", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getCurrentActor: async () => signedIn };
});

/**
 * ログインできているかどうか。**誰であるか（`signedIn`）とは別の軸である。**
 *
 * `currentActor()` は身元を確かめられないとき見本の身元へ落ちる。
 * 落ちた先が誰かは `signedIn` が決め、そもそも落ちたのかどうかはここが決める。
 * 1 つの変数にまとめると、役を替える試験とログインを外す試験が同じ変数を奪い合い、
 * どちらかが**緑のまま何も確かめなくなる**。
 *
 * `false` は「ログインしていない」と「保存先に届かず確かめられない」の両方を指す。
 * 断る側から見ると同じもので、`signedInActor()` はどちらも `null` を返す。
 */
let loggedIn = true;
const executeDisclosure = vi.fn();
const executePolicyRule = vi.fn();
vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? signedIn : null),
    settingsUseCases: async () => ({
      editDisclosure: { execute: executeDisclosure },
      editPolicyRule: { execute: executePolicyRule },
    }),
  };
});

/**
 * 操作の記録が残せるかどうか。**既定は残せる側**（見本の控えと同じ）。
 *
 * 2026-08-18 に見本の記録先が「必ず断る」から
 * 「控えへ本当に書き足す」へ変わった。それまでこの画面の操作は
 * 記録の手前で全部断られていて、**その先で何が起きるかは誰も見ていなかった**。
 *
 * 断る側を消したわけではない。`auditWritable = false` にした回だけ
 * `createUnavailableAuditLog()`（呼ぶと必ず失敗する）へ差し替える。
 * ここを見本の実装へ戻すと、断り方を見る試験が**緑のまま何も確かめなくなる**。
 */
let auditWritable = true;
vi.mock("@/infrastructure/persistence/sample/settings-sample-repository", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createSampleAuditLog: () =>
      auditWritable
        ? (actual.createSampleAuditLog as () => unknown)()
        : (actual.createUnavailableAuditLog as () => unknown)(),
  };
});

const {
  advanceLinkIngestionAction,
  submitAffiliateUrlAction,
} = await import("@/presentation/admin/inbox-action");
const { checkFactBoundaryAction } = await import("@/presentation/admin/fact-boundary-action");
const { reschedulePublicationAction } = await import("@/presentation/admin/reschedule-action");
const {
  createSiteFromDraftAction,
  saveSiteDraftStepAction,
  startSiteDraftAction,
} = await import("@/presentation/admin/site-wizard-action");
const {
  advanceContentStateAction,
  approveContentAction,
} = await import("@/presentation/admin/content-progress-action");
const { adjustConversionAction } = await import("@/presentation/admin/adjust-conversion-action");
const { publishArticleAction } = await import("@/presentation/admin/publish-article-action");
const { editDisclosureAction, editPolicyRuleAction } = await import(
  "@/presentation/admin/compliance-action"
);
const { schedulePublicationAction } = await import(
  "@/presentation/admin/schedule-publication-action"
);
const { linkInboxUseCases, personaUseCases, siteUseCases } = await import(
  "@/presentation/composition"
);

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) for (const v of value) data.append(key, v);
    else data.set(key, value as string);
  }
  return data;
}

/** 提携まで扱える人。認証が入るまでの見本のログインには、この権限が無い。 */
function asAffiliateManager(): void {
  signedIn = { ...SAMPLE_ACTOR, roles: ["workspace_admin"] };
}

/**
 * 移動先を取り出す。
 *
 * `redirect()` は例外を投げて画面遷移を起こす。これを差し替えると
 * 「移動したつもり」で行き先を間違えていても緑になるので、本物のまま受け止める。
 */
async function movedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (thrown) {
    const digest = String((thrown as { digest?: unknown }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";").find((part) => part.startsWith("/")) ?? "";
    }
    throw thrown;
  }
  throw new Error("移動が起きませんでした。");
}

const IDLE = { status: "idle", message: "" } as const;

beforeEach(() => {
  signedIn = SAMPLE_ACTOR;
  loggedIn = true;
  auditWritable = true;
  executeDisclosure.mockReset();
  executePolicyRule.mockReset();
});

describe("コンプライアンス設定の操作", () => {
  it("ログインしていない人は、保存先へ届く前に2操作とも止める", async () => {
    loggedIn = false;

    const disclosure = await editDisclosureAction(IDLE, form({}));
    const policy = await editPolicyRuleAction(IDLE, form({}));

    expect(disclosure).toMatchObject({ status: "failed" });
    expect(policy).toMatchObject({ status: "failed" });
    expect(executeDisclosure).not.toHaveBeenCalled();
    expect(executePolicyRule).not.toHaveBeenCalled();
  });

  it("広告表記の全入力をユースケースへ渡し、読者に出る文まで成功結果へ載せる", async () => {
    executeDisclosure.mockResolvedValue({
      ok: true,
      value: {
        message: "広告表記を変更しました。",
        visibleMessage: "スポンサーから商品の提供を受けています。",
      },
    });

    const state = await editDisclosureAction(
      IDLE,
      form({
        disclosureId: "dc_existing",
        relationshipType: "sponsored",
        advertiserOrSupplier: "見本商事",
        editorialInfluence: "limited",
        aiAssisted: "on",
        reason: "提供条件が変わったため。",
      }),
    );

    expect(executeDisclosure).toHaveBeenCalledWith(SAMPLE_ACTOR, {
      disclosureId: "dc_existing",
      relationshipType: "sponsored",
      advertiserOrSupplier: "見本商事",
      editorialInfluence: "limited",
      aiAssisted: true,
      reason: "提供条件が変わったため。",
    });
    expect(state).toEqual({
      status: "done",
      message:
        "広告表記を変更しました。 読者にはこう出ます:「スポンサーから商品の提供を受けています。」",
    });
  });

  it("省略入力を勝手に補わず、業務エラーの欄と理由を画面へ返す", async () => {
    executeDisclosure.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "関係の種類を選んでください。", field: "relationshipType" },
    });

    const state = await editDisclosureAction(IDLE, form({ advertiserOrSupplier: "   " }));

    expect(executeDisclosure).toHaveBeenCalledWith(SAMPLE_ACTOR, {
      relationshipType: "",
      advertiserOrSupplier: null,
      editorialInfluence: "",
      aiAssisted: false,
      reason: "",
    });
    expect(state).toMatchObject({
      status: "failed",
      field: "relationshipType",
    });
  });

  it("きまりの有効・無効を専用の指示へ変換する", async () => {
    executePolicyRule.mockResolvedValue({
      ok: true,
      value: { message: "表記のきまりを有効にしました。" },
    });

    const state = await editPolicyRuleAction(
      IDLE,
      form({
        intent: "set_enabled",
        ruleId: "rule_1",
        enabled: "true",
        reason: "公開前検査へ戻すため。",
      }),
    );

    expect(executePolicyRule).toHaveBeenCalledWith(SAMPLE_ACTOR, {
      action: "set_enabled",
      ruleId: "rule_1",
      enabled: true,
      reason: "公開前検査へ戻すため。",
    });
    expect(state).toEqual({ status: "done", message: "表記のきまりを有効にしました。" });
  });

  it("false の無効化と保存指示を区別し、失敗も共通状態へ変換する", async () => {
    executePolicyRule
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "NOT_FOUND", message: "表記のきまりが見つかりません。" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { message: "表記のきまりを保存しました。" },
      });

    const disabled = await editPolicyRuleAction(
      IDLE,
      form({ intent: "set_enabled", ruleId: "rule_missing", enabled: "false", reason: "終了" }),
    );
    const saved = await editPolicyRuleAction(
      IDLE,
      form({
        intent: "save",
        name: "誇大表現",
        domainScope: "general",
        channelScope: "any",
        severity: "warn",
        pattern: "世界一",
        basis: "景品表示法 第5条",
        suggestion: "比較条件を明示する",
        reason: "検査項目を追加するため。",
      }),
    );

    expect(executePolicyRule).toHaveBeenNthCalledWith(1, SAMPLE_ACTOR, {
      action: "set_enabled",
      ruleId: "rule_missing",
      enabled: false,
      reason: "終了",
    });
    expect(executePolicyRule).toHaveBeenNthCalledWith(2, SAMPLE_ACTOR, {
      action: "save",
      name: "誇大表現",
      domainScope: "general",
      channelScope: "any",
      severity: "warn",
      pattern: "世界一",
      basis: "景品表示法 第5条",
      suggestion: "比較条件を明示する",
      reason: "検査項目を追加するため。",
    });
    expect(disabled).toMatchObject({ status: "failed" });
    expect(saved).toEqual({ status: "done", message: "表記のきまりを保存しました。" });
  });
});

describe("受信箱の操作", () => {
  it("見本のログインでは動かせないことが、理由つきで画面に返る", async () => {
    const state = await submitAffiliateUrlAction(IDLE, form({ url: "https://example.invalid/a" }));

    // 黙って何も起きないのが最悪。断られたことと理由が、必ず画面まで届く。
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  /*
   * 記録が残せない置き場（`createUnavailableAuditLog`）へ差し替えて動かす。
   * 受信箱を進める 4 操作は、残せない記録を「残した」ことにしないため、
   * その置き場では断られる。記事の公開・配信予定・鍵の発行も同じ。
   *
   * 通ることを確かめる場所は `tests/integration/d1-link-inbox.test.ts` と、
   * この下の「記録が残せる置き場では、受け取ったうえで通る」。
   * ここで見るのは、**断られても操作そのものは効いていること**と、
   * それが画面の文面に出ていること。ここを取り違えると、
   * 押した人は入っていないと思ってもう一度貼り、受信箱に同じ URL が並ぶ。
   */
  it("提携を扱える人なら受け取る（記録が残せないことは隠さない）", async () => {
    auditWritable = false;
    asAffiliateManager();
    const url = `https://example.invalid/asp/act-${Date.now()}`;
    const state = await submitAffiliateUrlAction(IDLE, form({ url, note: "画面から貼り付け" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("リンクは受信箱に入っています");

    // 文面のとおり、本当に入っている。入っていなければ断り文の方が嘘になる。
    const inbox = await (await linkInboxUseCases()).list.execute(SAMPLE_ACTOR, { state: "all" });
    expect(inbox.ok).toBe(true);
    if (inbox.ok) expect(inbox.value.items.some((i) => i.submittedUrl === url)).toBe(true);
  });

  it("同じリンクを 2 回入れても、どちらも消さずに受信箱へ残る", async () => {
    asAffiliateManager();
    const url = `https://example.invalid/asp/dup-${Date.now()}`;
    await submitAffiliateUrlAction(IDLE, form({ url }));
    await submitAffiliateUrlAction(IDLE, form({ url }));

    // 2 本目を捨てると、貼った人には「入れられなかった」ように見える。
    const inbox = await (await linkInboxUseCases()).list.execute(SAMPLE_ACTOR, { state: "all" });
    expect(inbox.ok).toBe(true);
    if (inbox.ok) {
      expect(inbox.value.items.filter((i) => i.submittedUrl === url)).toHaveLength(2);
    }
  });

  it("読めない URL は、どの欄が原因かまで返す", async () => {
    asAffiliateManager();
    const state = await submitAffiliateUrlAction(IDLE, form({ url: "これはURLではない" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("url");
  });

  it("できること以外を指定されたら、できることを並べて返す", async () => {
    asAffiliateManager();
    const state = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_1", intent: "delete" }),
    );

    // 入口を 1 つにまとめている以上、知らない指示は必ずここで止める。
    expect(state.status).toBe("failed");
    expect(state.message).toContain("対象外");
  });

  it("知らない指示は、受け取ったリンクがあっても止める", async () => {
    asAffiliateManager();
    await submitAffiliateUrlAction(IDLE, form({ url: `https://example.invalid/asp/flow-${Date.now()}` }));

    // 入口を 1 つにまとめている以上、知らない指示を素通りさせない。
    const listed = await advanceLinkIngestionAction(IDLE, form({ intent: "unknown" }));
    expect(listed.status).toBe("failed");
  });

  it("居ないリンクを進めようとすると、直し方が返る", async () => {
    asAffiliateManager();
    const resolved = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_missing", intent: "resolve", programId: "prg_rakuten_pc" }),
    );
    const matched = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_missing", intent: "match", productId: "p_alpha_15" }),
    );
    const rejected = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_missing", intent: "reject", reason: "重複のため。" }),
    );

    for (const state of [resolved, matched, rejected]) {
      expect(state.status).toBe("failed");
      expect(state.message.trim()).not.toBe("");
    }
  });

  it("3 つの操作は、どれも済んだことを画面に出したうえで断る", async () => {
    auditWritable = false;
    asAffiliateManager();
    const resolved = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_1", intent: "resolve", programId: "prg_rakuten_pc" }),
    );
    expect(resolved.status).toBe("failed");
    expect(resolved.message).toContain("広告主は決まっています");

    const matched = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_1", intent: "match", productId: "p_alpha_15" }),
    );
    expect(matched.status).toBe("failed");
    expect(matched.message).toContain("商品との結びつけは済んでいます");

    const rejected = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_2", intent: "reject", reason: "提携が終了しているため。" }),
    );
    expect(rejected.status).toBe("failed");
    expect(rejected.message).toContain("対象外になっています");

    // 3 つとも、次に何をすればよいかまで書いてある（済んだことだけで終えない）。
    for (const state of [resolved, matched, rejected]) {
      expect(state.message.trim().split("\n").length).toBeGreaterThan(1);
    }
  });

  /*
   * 記録先が控えになったことで初めて通るようになった側。
   * 断られ続けているあいだ、貼った URL が受信箱へ入ったあと
   * **画面に何が返るかは一度も確かめられていなかった**。
   */
  it("記録が残せる置き場では、受け取ったうえで通る", async () => {
    asAffiliateManager();
    const url = `https://example.invalid/asp/ok-${Date.now()}`;
    const state = await submitAffiliateUrlAction(IDLE, form({ url, note: "画面から貼り付け" }));

    expect(state.status).toBe("done");
    const inbox = await (await linkInboxUseCases()).list.execute(SAMPLE_ACTOR, { state: "all" });
    expect(inbox.ok).toBe(true);
    if (inbox.ok) expect(inbox.value.items.some((i) => i.submittedUrl === url)).toBe(true);
  });

  it("対象外にする理由が空なら、その欄を指して断る", async () => {
    asAffiliateManager();
    const state = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_matched_1", intent: "reject", reason: "  " }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("reason");
  });

  /**
   * ログインしていない人に、受信箱を触らせない。
   *
   * `currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
   * ログインしていない人の操作が預かり所まで届く。届いた先の砦は
   * **役の一覧**（`src/domain/identity/permissions.ts`）で、あれは人が編集する表である。
   *
   * `asAffiliateManager()`（役では断られない人）のまま `loggedIn` だけを外す。
   * 役で断られる人で測ると、入口が開いていても役が塞いでくれて緑になり、
   * ここは**何も見ていないまま緑**になる（`ah-dao`）。
   */
  it("ログインしていない人は、リンクを登録できない", async () => {
    asAffiliateManager();
    loggedIn = false;
    const state = await submitAffiliateUrlAction(
      IDLE,
      form({ url: `https://example.invalid/asp/no-login-${Date.now()}`, note: "画面から貼り付け" }),
    );
    expect(state.status, "ログインを見ずにリンクが登録できています").toBe("failed");
  });

  it("ログインしていない人が押しても、受信箱には入らない", async () => {
    // 断りの**形**ではなく、**入ったかどうか**を見る。
    // 形だけを見ていると、断り文を出しながら裏で入れる形が緑のまま通る。
    asAffiliateManager();
    const url = `https://example.invalid/asp/no-login-store-${Date.now()}`;
    loggedIn = false;
    await submitAffiliateUrlAction(IDLE, form({ url }));

    const inbox = await (await linkInboxUseCases()).list.execute(SAMPLE_ACTOR, { state: "all" });
    if (!inbox.ok) throw new Error("受信箱が読めませんでした");
    expect(
      inbox.value.items.some((i) => i.submittedUrl === url),
      "断ったはずのリンクが受信箱に入っています",
    ).toBe(false);
  });

  it("ログインしていない人は、取り込みを進められない", async () => {
    asAffiliateManager();
    loggedIn = false;
    const state = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_matched_1", intent: "reject", reason: "対象外にします。" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });

  /*
   * --- 成果リンクとして登録する（受信箱の最後の一歩） ---
   * ここまでの 3 操作は受信箱の中で状態を進めるだけで、`affiliate_links` には
   * 1 行も入らなかった。入る口が無いので、記事を公開しても成果リンクが
   * 1 件も出ない状態が続いていた（残課題 58 / REQ-E13）。
   *
   * 見本の置き場では保存そのものが断られる（`stubCall`）。通る側を見るのは
   * `tests/integration/d1-affiliate-link.test.ts`。ここで見るのは
   * **保存へ届く前に止まるもの**、つまり入口の閉じ方だけである。
   */
  it("ログインしていない人は、成果リンクを登録できない", async () => {
    // 役では断られない人のまま、ログインだけ外す。役で断られる人で測ると、
    // 入口が開いていても役が塞いでくれて緑になる（`ah-dao` と同じ形）。
    asAffiliateManager();
    loggedIn = false;
    const state = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_matched_1", intent: "register", productName: "Alpha Studio 15" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });

  it("商品名が空のまま登録しようとすると、その欄を指して断る", async () => {
    // ここで画面側が「—」などを補うと、その文字列がそのまま読者のカードに
    // 商品名として出る。補わずにユースケースへ断らせる。
    asAffiliateManager();
    const state = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_matched_1", intent: "register", productName: "   " }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("productName");
  });

  it("できることの並びに、成果リンクとしての登録が入っている", async () => {
    asAffiliateManager();
    const state = await advanceLinkIngestionAction(IDLE, form({ intent: "unknown" }));

    // 入口を 1 つにまとめている以上、増えた操作が案内に出ていないと、
    // 画面からしか呼べない操作になる（AI からは名前が分からない）。
    expect(state.message).toContain("成果リンクとして登録する");
  });
});

describe("ブログ作成ウィザードの操作", () => {
  /**
   * ブログの器を作るには `site.draft` が要る。
   *
   * 2026-08-18 まではここで見本の身元（既定）のまま通っていた。
   * 見本から書き込みの役を外したので、**要る役をこの検査が名乗る**形にした。
   * 見本へ役を戻して緑にしない（`src/infrastructure/identity/sample-actor.ts`）。
   */
  beforeEach(() => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["writer"] };
  });

  const ANSWERS: Record<string, Record<string, string>> = {
    purpose: { purpose: "はじめて一眼カメラを買う人が、レンズ選びで迷わないようにする" },
    genre: { genre: "カメラ・交換レンズ" },
    audience: {
      targetReader: "一眼カメラを買って半年以内の人",
      searchIntent: "次に買う 1 本をどう選べばよいか知りたい",
    },
    author: {
      uniqueExperience: "同じ被写体を全レンズで撮り比べた作例",
      conclusionStance: "用途ごとに 1 本ずつ挙げる",
    },
    revenue: { revenueModel: "affiliate" },
    pattern: { pattern: "beginner_guide" },
    design: { theme: "indigo-clay" },
    policy: {
      articlePurpose: "用途から候補を 3 本に絞らせる",
      ctaStrategy: "在庫と価格が確認できる販売ページのみ",
    },
    content_plan: {
      evaluationAxis: "焦点距離と最短撮影距離",
      usageScene: "屋内で子どもを撮る",
      comparisonScope: "実売 10 万円以下の交換レンズ",
      internalLinkStrategy: "用途別の案内から個別レビューへ落とす",
    },
  };

  async function completeDraftThroughForms(slug: string): Promise<string> {
    const started = await movedTo(() => startSiteDraftAction());
    const draftId = new URL(started, "https://example.invalid").searchParams.get("draftId") ?? "";
    expect(draftId).not.toBe("");

    for (const step of SITE_WIZARD_STEPS) {
      if (step === "create") continue;
      const fields: Record<string, string | readonly string[]> = {
        draftId,
        step,
        ...(ANSWERS[step] ?? {}),
      };
      if (step === "domain") {
        fields.name = "はじめてのレンズ";
        fields.slug = slug;
      }
      if (step === "categories") {
        fields.categoriesText =
          "prime-lenses / 単焦点レンズ / 明るさで選ぶ 1 本目\nzoom-lenses / ズームレンズ / 交換せずに済ませたい人向け";
      }
      if (step === "article_types") fields.articleTypes = ["guide", "comparison"];

      const moved = await movedTo(() => saveSiteDraftStepAction({ status: "idle", message: "" }, form(fields)));
      expect(moved, `${step} の保存後に移動しませんでした`).toContain(draftId);
    }
    return draftId;
  }

  it("始めると、その下書きの画面へ移る", async () => {
    const moved = await movedTo(() => startSiteDraftAction());
    // 始めた直後に一覧へ戻すと、いま作っているものが分からなくなる。
    expect(moved).toContain("/admin/sites/new?draftId=");
  });

  it("1 段階ずつ保存すると、次の段階へ進む", async () => {
    const started = await movedTo(() => startSiteDraftAction());
    const draftId = new URL(started, "https://example.invalid").searchParams.get("draftId") ?? "";

    const moved = await movedTo(() =>
      saveSiteDraftStepAction(
        { status: "idle", message: "" },
        form({ draftId, step: "purpose", ...ANSWERS.purpose }),
      ),
    );
    // 同じ画面に留めると、押した結果が変わらないように見えてもう一度押される。
    expect(moved).toContain("step=");
  });

  it("答えが足りない段階は、直す欄を指して同じ画面に留まる", async () => {
    const started = await movedTo(() => startSiteDraftAction());
    const draftId = new URL(started, "https://example.invalid").searchParams.get("draftId") ?? "";

    const state = await saveSiteDraftStepAction(
      { status: "idle", message: "" },
      form({ draftId, step: "purpose", purpose: "  " }),
    );
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("居ない下書きは作れない", async () => {
    const state = await createSiteFromDraftAction(
      { status: "idle", message: "" },
      form({ draftId: "sd_missing" }),
    );
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  /*
   * 記録が残せない置き場（`createUnavailableAuditLog`）へ差し替えて動かす。
   * ブログを作ると記録が要るので、その置き場では**必ず断られる**。
   * それでよいと決めた理由は
   * docs/product/port-wiring.md「記録を足すと、見本モードでは操作が断られる」。
   *
   * ここで見るのは、断り方が**押した人を二度押しへ誘導しないか**である。
   * 記録は作った後に書くので、断られた時点でブログはもう読者から見えている。
   * 断り文がそれを隠すと、押した人は名前を変えてもう一度作り、同じブログが 2 本並ぶ。
   */
  it("記録を残せない段では、作れたことにせず断る", async () => {
    auditWritable = false;
    const draftId = await completeDraftThroughForms(`action-test-${Date.now()}`);
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    expect(state.status).toBe("failed");
    // 「できました」と読める場所を残さない。
    expect(state.createdPath).toBeUndefined();
  });

  it("断り文が、すでに読者から見えていることを隠さない", async () => {
    auditWritable = false;
    const slug = `action-test-${Date.now()}`;
    const draftId = await completeDraftThroughForms(slug);
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    // 済んだこと（もう見えている）と、次にすること（記録の直し方）の両方が要る。
    expect(state.message).toContain("読む人からも見えます");
    expect(state.message.trim().split("\n").length).toBeGreaterThan(1);

    // 実際に読者側の一覧へ増えている。増えていないなら断り文の方が嘘になる。
    const listed = await (await siteUseCases()).listSites.execute(SAMPLE_ACTOR, {});
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.some((s) => s.slug === slug)).toBe(true);
  });

  /*
   * 記録先が控えになったことで初めて通るようになった側。
   * 断られ続けているあいだ、ここから先（作った先への案内が返るか）は
   * **一度も確かめられていなかった**。
   */
  it("記録が残せる置き場では、作れて、作った先への道が返る", async () => {
    const slug = `action-test-${Date.now()}`;
    const draftId = await completeDraftThroughForms(slug);
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    expect(state.status).toBe("done");
    // 「できました」で終えない。次に開く場所が無いと、押した人はそこで止まる。
    expect(state.createdPath ?? "").toContain(slug);
  });

  /**
   * ログインしていない人に、ブログを作らせない。
   *
   * --- なぜ役ではなく入口で断るのか ---
   * `currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
   * ログインしていない人の操作が預かり所まで届く。断られる回もあるが、
   * 断っているのは**役の一覧**（`src/domain/identity/permissions.ts`）で、
   * あれは人が編集する表である。**1 行足せば戻る。**
   *
   * --- なぜ下書きを先に完成させるのか ---
   * 居ない下書き（`sd_missing`）で測ると、ログインを見なくても
   * 「その下書きが無い」で断られる。それでは塞ぐ前から緑になり、
   * 穴の証拠にならない。**本来なら本当に作れる下書き**を先に用意し、
   * その状態でログインだけを外す（`ah-dao`）。
   *
   * 下書きを作る側（`startSiteDraftAction` / `saveSiteDraftStepAction`）は
   * **ログインしたまま通す**。あちらも塞いであるので、先にログインを外すと
   * 下書きが用意できず、ここが「下書きが無いから断られた」に化けて、
   * また何も見なくなる。`loggedIn = false` は下書きが揃ってから外すこと。
   */
  it("ログインしていない人は、ブログを作れない", async () => {
    const draftId = await completeDraftThroughForms(`action-test-${Date.now()}`);
    loggedIn = false;
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));
    expect(state.status, "ログインを見ずにブログが作れています").toBe("failed");
  });

  it("ログインしていない人が押しても、ブログは 1 本も増えない", async () => {
    // 断りの**形**ではなく、**増えたかどうか**を見る。
    // ブログを消す口はどこにも無いので、1 本増えたら戻せない。
    // 形だけを見ていると、断り文を出しながら裏で作る形が緑のまま通る。
    const slug = `action-test-${Date.now()}`;
    const draftId = await completeDraftThroughForms(slug);

    const before = await (await siteUseCases()).listSites.execute(SAMPLE_ACTOR, {});
    if (!before.ok) throw new Error("ブログの一覧が読めませんでした");

    loggedIn = false;
    await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    const after = await (await siteUseCases()).listSites.execute(SAMPLE_ACTOR, {});
    if (!after.ok) throw new Error("ブログの一覧が読めませんでした");
    expect(after.value.length, "断ったはずのブログが増えています").toBe(before.value.length);
  });

  it("ログインしていない断りは、理由が画面に出る", async () => {
    const draftId = await completeDraftThroughForms(`action-test-${Date.now()}`);
    loggedIn = false;
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });

  /**
   * 下書きを作る側・保存する側も、ログインしていない人には触らせない。
   *
   * 下書きは作り直せるので「取り返しがつく」側だが、開いたままだと
   * **中身が読める**（保存すると、次に開いたとき前の答えが見える）。
   * 誰でも下書きを増やせる状態も、預かり所を無料の置き場として使わせる。
   *
   * `startSiteDraftAction` は状態を返さず `redirect()` を投げるので、
   * 断りは行き先の `?error=` に載る。`movedTo()` で行き先を受け取り、
   * `decodeURIComponent` してから読む（`encodeURIComponent` で包まれるため）。
   */
  it("ログインしていない人は、下書きを始められない", async () => {
    loggedIn = false;
    const moved = await movedTo(() => startSiteDraftAction());
    expect(decodeURIComponent(moved), "断る理由が行き先に載っていません").toContain("ログイン");
  });

  it("ログインしていない人は、下書きを保存できない", async () => {
    // 有効な下書きを先に作ってからログインだけを外す。
    // 居ない下書きで測ると「その下書きが無い」で断られ、塞ぐ前から緑になる。
    const started = await movedTo(() => startSiteDraftAction());
    const draftId = new URL(started, "https://example.invalid").searchParams.get("draftId") ?? "";
    loggedIn = false;
    const state = await saveSiteDraftStepAction(
      { status: "idle", message: "" },
      form({ draftId, step: "purpose", ...ANSWERS.purpose }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});

describe("事実の範囲の確認", () => {
  async function anAuthorId(): Promise<string> {
    const list = await (await personaUseCases()).listAuthors.execute(SAMPLE_ACTOR, {});
    if (!list.ok) throw new Error("見本の書き手を取得できませんでした");
    const withoutTestRun = list.value.items.find((a) => a.verifiedExperienceCount === 0);
    return (withoutTestRun ?? list.value.items[0]).personaId;
  }

  it("文章が空なら、調べにいかずにその場で断る", async () => {
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({ personaId: "ap_anything", body: "   " }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("body");
    expect(state.findings).toEqual([]);
  });

  it("居ない書き手を指すと、指摘ではなく誤りとして返る", async () => {
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({ personaId: "ap_missing", body: "公式の仕様では対応しています。" }),
    );

    // 「指摘 0 件」で返すと、確認できていないのに合格したように見える。
    expect(state.status).toBe("failed");
    expect(state.findings).toEqual([]);
  });

  it("公表値に基づく書き方は通る", async () => {
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({
        personaId: await anAuthorId(),
        body: "メーカーの公表値では、書き出し時間は前の型より短くなっています。",
      }),
    );

    expect(state.status).toBe("passed");
    expect(state.message.trim()).not.toBe("");
  });

  it("試した記録の無い体験談は、本文の抜粋つきで止まる", async () => {
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({
        personaId: await anAuthorId(),
        body: "実際に使ってみたところ、書き出しがとても速くなりました。",
      }),
    );

    expect(state.status).toBe("flagged");
    expect(state.findings.length).toBeGreaterThan(0);
    for (const finding of state.findings) {
      // どこが問題かが分からないと直しようが無い。
      expect(finding.excerpt.trim()).not.toBe("");
      expect(finding.message.trim()).not.toBe("");
    }
  });

  /**
   * ログインしていない人に、判定を回させない。
   *
   * 書き換えは起きないので「取り返しがつく」側だが、通ると
   * **書き手の記録（何を試したか）が外から引ける**。誰の体験が記録済みかは、
   * 記事を書いた人の行動そのものである。
   *
   * 上の「公表値に基づく書き方は通る」と同じ入力で測る。**本来なら通る指示**を
   * 渡して初めて、通ってしまうことが見える（`ah-dao`）。
   */
  it("ログインしていない人には、判定を返さない", async () => {
    const personaId = await anAuthorId();
    loggedIn = false;
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({ personaId, body: "メーカーの公表値では、書き出し時間は前の型より短くなっています。" }),
    );
    expect(state.status, "ログインを見ずに判定が通っています").toBe("failed");
  });

  it("ログインしていない断りは、理由が画面に出る", async () => {
    const personaId = await anAuthorId();
    loggedIn = false;
    const state = await checkFactBoundaryAction(
      { status: "idle", message: "", findings: [] },
      form({ personaId, body: "メーカーの公表値では、書き出し時間は前の型より短くなっています。" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});

describe("投稿予定日の変更", () => {
  it("居ない予定は動かせない", async () => {
    const state = await reschedulePublicationAction(
      { status: "idle", message: "" },
      form({ publicationId: "pub_missing", scheduledAt: "2026-09-01T10:00" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("日時が空なら、直し方が分かる言葉で返る", async () => {
    const state = await reschedulePublicationAction(
      { status: "idle", message: "" },
      form({ publicationId: "pub_missing", scheduledAt: "" }),
    );

    expect(state.status).toBe("failed");
    // 原因の説明だけでは次の操作が決まらない。
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  /**
   * ログインしていない人に、予定日を動かさせない。
   *
   * `currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
   * ログインしていない人の操作が預かり所まで届く（`ah-dao`）。
   * 予定日を**前へ**動かすと、まだ確認していない記事が先に外へ出ていく。
   * 出た後に引き戻す口は無い。
   *
   * ここで見るのは断りの**文**である。`status: "failed"` だけを見ると、
   * ログインを見なくても「その配信が見つかりません」で断られてしまい、
   * 塞ぐ前から緑になる。文が「ログイン」を指しているかどうかだけが、
   * **どちらの理由で断ったか**を分ける。
   */
  it("ログインしていない断りは、理由が画面に出る", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
    loggedIn = false;
    const state = await reschedulePublicationAction(
      { status: "idle", message: "" },
      form({ publicationId: "pub_own_site_ready", scheduledAt: "2026-09-01T10:00" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});

describe("記事の進行の操作", () => {
  /**
   * ここは D1 につながっていない状態で動かしている（見本の保存先）。
   * つまり**進めた結果を残せない**。それでも「進めました」と返るなら、
   * 画面だけが先に進み、開き直すと戻っているという最悪の見え方になる。
   */
  it("進めた段階を残せないときは、進んだと返さない", async () => {
    const state = await advanceContentStateAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_alpha_review", from: "FACT_CHECK", to: "COMPLIANCE_REVIEW" }),
    );

    expect(state.status).toBe("failed");
    // 断り文句が符号のままだと、押した人には何をすればいいか分からない。
    expect(state.message.trim()).not.toBe("");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("画面を開いたままの人が古い段階から押しても、進んだと返さない", async () => {
    const state = await advanceContentStateAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_alpha_review", from: "GENERATED", to: "FACT_CHECK" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("欄が空のまま送られても、進んだと返さない", async () => {
    // 画面の作り替えや古いタブから、欄が欠けた要求が来ることがある。
    // 既定値で埋めて進めると、どの記事が動いたのか誰にも分からなくなる。
    const state = await advanceContentStateAction({ status: "idle", message: "" }, form({}));

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("記事の指定が無い承認は、成功と返さない", async () => {
    const state = await approveContentAction({ status: "idle", message: "" }, form({}));

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("居ない記事は承認できない", async () => {
    const state = await approveContentAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_missing" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("確認の段階まで来ていない記事は、段階の言葉で断られる", async () => {
    const state = await approveContentAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_alpha_review" }),
    );

    expect(state.status).toBe("failed");
    // 遷移表の符号（FACT_CHECK など）を画面に出さない。
    expect(state.message).not.toContain("FACT_CHECK");
  });

  /**
   * ログインしていない人に、記事の段階を動かさせない。
   *
   * 段階は戻せるので「取り返しがつく」側だが、承認まで進むと
   * **配信の予約が通るようになる**。配信は取り返しがつかない。
   * つまりここは、取り返しがつかない扉の 1 つ手前の踏み台である。
   */
  it("ログインしていない人は、段階を進められない", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
    loggedIn = false;
    const state = await advanceContentStateAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_alpha_review", from: "FACT_CHECK", to: "COMPLIANCE_REVIEW" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });

  it("ログインしていない人は、記事を承認できない", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
    loggedIn = false;
    const state = await approveContentAction(
      { status: "idle", message: "" },
      form({ variantId: "cv_alpha_review" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});

describe("成果の金額を直す操作", () => {
  /**
   * ここは D1 につながっていない状態で動かしている（見本の保存先）。
   * つまり**直した額を残せない**。それでも「直しました」と返るなら、
   * 画面の数字だけが変わり、開き直すと元へ戻っている。
   * 文章と違って数字は戻りに気づけず、そのまま締めの報告に使われる。
   */
  it("直した額を残せないときは、直したと返さない", async () => {
    asAffiliateManager();
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_08_a", amount: "1500", currency: "JPY", reason: "確定通知に合わせました。" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("金額が空のまま送られたら、何を入れればよいかを欄の下に返す", async () => {
    asAffiliateManager();
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_08_a", amount: "", currency: "JPY", reason: "理由。" }),
    );

    expect(state.status).toBe("failed");
    // 欄に紐づく断りは、欄の下に出せるよう `field` を返す。
    expect(state.field).toBe("amount");
    expect(state.message).toContain("金額");

  });

  it("理由が空のまま送られたら、直したことにしない", async () => {
    // 金額だけ直せると、あとから見た人に「なぜこの額なのか」が残らない。
    asAffiliateManager();
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_08_a", amount: "1500", currency: "JPY", reason: "   " }),
    );

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("締め済みの期間は直せず、次にすることが返る", async () => {
    asAffiliateManager();
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_07_a", amount: "1500", currency: "JPY", reason: "訂正。" }),
    );

    expect(state.status).toBe("failed");
    // 「できません」で終わらせない。次の期間で調整する道を示す。
    expect(state.message).toContain("次の期間");
  });

  it("提携を任されていない人には、権限の話として断られる", async () => {
    // 見本のログインは数字を読む権限しか持たない。
    signedIn = SAMPLE_ACTOR;
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_08_a", amount: "1500", currency: "JPY", reason: "確認。" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("成果の指定が無いまま送られても、成功と返さない", async () => {
    asAffiliateManager();
    const state = await adjustConversionAction(IDLE, form({ amount: "1500", reason: "理由。" }));

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  /**
   * ログインしていない人に、金額を直させない。
   *
   * 直した額は履歴に残るので「取り返しがつく」側だが、
   * **締めの報告に使われる数字**である。文章と違って数字は、
   * 変わっていても読んだ人が気づけない。
   *
   * `asAffiliateManager()`（役では断られない人）のまま `loggedIn` だけを外す。
   */
  it("ログインしていない断りは、理由が画面に出る", async () => {
    asAffiliateManager();
    loggedIn = false;
    const state = await adjustConversionAction(
      IDLE,
      form({ conversionId: "cv_2026_08_a", amount: "1500", currency: "JPY", reason: "確定通知に合わせました。" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});

describe("自分のブログへ記事を出す操作", () => {
  /**
   * その記事タイプで必要な節を、全部埋めた形。
   *
   * 節の一覧を手で並べない。並べると、必要な節が増えたときに
   * ここだけ古いままになり、**「出せるはずの入力」が実は出せない**状態で
   * 検査が緑になる（断られた応答を見て通ったと数える）。
   */
  function filledSections(articleType: string): Record<string, string> {
    const bodies: Record<string, string> = {};
    for (const section of authoredSectionsFor(articleType as never)) {
      bodies[`section:${section.id}`] =
        `${section.label}について、実際に確かめた内容をここに書いています。`;
    }
    return bodies;
  }

  /** 出せる条件を全部そろえた入力。ここから 1 つずつ欠かして試す。 */
  function fullForm(overrides: Record<string, string | readonly string[]> = {}): FormData {
    return form({
      ...filledSections(String(overrides.articleType ?? "guide")),
      // まだ出していない配信を指す。公開済みの `pub_own_site` を指すと
      // 状態の判定で先に断られ、その先（保存できるか）を一度も通らない。
      publicationId: "pub_own_site_ready",
      siteSlug: SAMPLE_SITE_SLUG,
      categorySlug: "chairs",
      articleType: "guide",
      slug: "quiet-laptop",
      title: "静かなノートパソコンの選び方",
      conclusion: "書き出しの速さで選ぶ。",
      authorName: "三輪 みわ",
      authorBio: "家電量販店で 8 年、パソコン売り場を担当。",
      authorCredentials: "家電量販店で 8 年勤務",
      relationshipType: "affiliate",
      disclosureMessage: "アフィリエイト広告を利用しています。",
      nextReviewOn: "2026-12-01",
      claimStatement: "書き出し時間は 4 分 12 秒でした。",
      claimSourceLabel: "編集部の実測",
      claimSourceUrl: "",
      claimCheckedOn: "2026-08-01",
      ...overrides,
    });
  }

  function asPublisher(): void {
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  }

  /**
   * ここは D1 につながっていない状態で動かしている（見本の保存先）。
   * つまり**出した記事を残せない**。それでも「出しました」と返るなら、
   * 画面には公開済みと出るのに、読者のページには何も無い状態になる。
   */
  it("出した記事を残せないときは、出したと返さない", async () => {
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm());

    expect(state.status).toBe("failed");
    expect(state.url).toBeUndefined();
    // 断る理由が**保存できないこと**であることまで見る。
    // ここを「何か失敗した」で済ませると、状態の判定で先に落ちていても通ってしまう。
    expect(state.message).toContain("保存");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("すでに出した配信からは、もう一度出せない", async () => {
    // 同じ記事が 2 度出るのを防ぐ。断り文に内部の符号を出さない。
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm({ publicationId: "pub_own_site" }));

    expect(state.status).toBe("failed");
    expect(state.message).not.toContain("PUBLISHED");
    expect(state.message).not.toContain("SENDING");
    expect(state.message).toContain("公開済み");
  });

  it("欄が 1 つも届かなくても、落ちずに断る", async () => {
    // 途中で通信が切れた送信や、古い画面からの送信では欄が欠ける。
    // ここで落ちると、利用者には真っ白な画面しか残らない。
    asPublisher();
    const state = await publishArticleAction(IDLE, new FormData());

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("出典の URL を書いた行は、URL を落とさずに渡す", async () => {
    // 出典名だけ残して URL を落とすと、読者は確かめに行けない。
    // ここが落ちていれば、断りの理由は根拠の話になる。
    asPublisher();
    const state = await publishArticleAction(
      IDLE,
      fullForm({ claimSourceUrl: "https://example.invalid/spec" }),
    );

    expect(state.field).not.toBe("claims");
    expect(state.message).toContain("保存");
  });

  it("URL の名前が使えない形なら、欄の下に直し方を返す", async () => {
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm({ slug: "静かなノート" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("slug");
    // 「不正です」で終わらせない。何が使えるかを書く。
    expect(state.message).toContain("ハイフン");
  });

  it("タイトルが空なら、欄の下に断りを返す", async () => {
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm({ title: "  " }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("title");
  });

  it("書き手の名前が空なら、出さない", async () => {
    // 誰が書いたか分からない記事を読者に出さない。
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm({ authorName: "  " }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("authorName");
  });

  it("言い切りが空の行は、丸ごと捨てる（出典だけの根拠を作らない）", async () => {
    // 空の行を捨てないと、中身の無い根拠が記事に並ぶ。
    // 捨てられていれば、断りの理由は根拠の話にはならない。
    asPublisher();
    const state = await publishArticleAction(
      IDLE,
      fullForm({
        claimStatement: ["書き出し時間は 4 分 12 秒でした。", "   "],
        claimSourceLabel: ["編集部の実測", "どこかの記事"],
        claimSourceUrl: ["", ""],
        claimCheckedOn: ["2026-08-01", ""],
      }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).not.toBe("claims");
  });

  it("公開を任されていない人には、権限の話として断られる", async () => {
    signedIn = SAMPLE_ACTOR;
    const state = await publishArticleAction(IDLE, fullForm());

    expect(state.status).toBe("failed");
    expect(state.message).not.toMatch(/^[A-Z_]+$/);
    expect(state.message.trim()).not.toBe("");
  });

  it("自社サイト以外の配信では使えないことを、次にすることつきで返す", async () => {
    // note のように公式の投稿の仕組みが無い先を、この操作で出したことにしない。
    asPublisher();
    const state = await publishArticleAction(
      IDLE,
      fullForm({ publicationId: "pub_note_manual" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  /**
   * ログインしていない人に、記事を出させない。
   *
   * --- なぜ役ではなく入口で断るのか ---
   * `currentActor()` は身元を確かめられないとき**見本の身元へ落ちる**ので、
   * ログインしていない人の操作が預かり所まで届く。届いた先で断られる回もあるが、
   * 断っているのは**役の一覧**（`src/domain/identity/permissions.ts`）で、
   * あれは人が編集する表である。**1 行足せば戻る。**
   *
   * だから `asPublisher()`（役では断られない人）のまま `loggedIn` だけを外す。
   * 役で断られる人で測ると、入口が開いていても役が塞いでくれて緑になり、
   * ここは**何も見ていないまま緑**になる。
   *
   * --- なぜ断りの「文」だけを見るのか ---
   * `status: "failed"` は塞ぐ前から出る。この操作は見本の保存先が
   * 「まだ実装されていません」で先に止めるためで、**ログインを見なくても
   * 失敗する**。だから `status` を見る検査は、塞いでも壊しても色が変わらない。
   * 色が変わらない検査は、在るだけで見張っていない。
   *
   * 文が「ログイン」を指しているかどうかだけが、**どちらの理由で断ったか**を
   * 分ける。2026-08-19 の実測でここは赤（`ah-dao`）。
   */
  it("ログインしていない断りは、理由が画面に出る", async () => {
    asPublisher();
    loggedIn = false;
    const state = await publishArticleAction(IDLE, fullForm());
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });

  /**
   * 公開前の点検（REQ-SEO03）。
   *
   * ここは見本の保存先なので**出そうとすると必ず落ちる**。その差がそのまま
   * 検査になる。点検が保存まで進んでいれば、同じ理由で落ちるはずである。
   */
  it("点検は何も出さずに結果だけ返す（出す道は同じ入力で落ちる）", async () => {
    asPublisher();
    const checked = await publishArticleAction(IDLE, fullForm({ intent: "check" }));

    expect(checked.status).toBe("done");
    expect(checked.phase).toBe("checked");
    // **読者ページへの導線を付けない。** まだ何も出ていない。
    expect(checked.url).toBeUndefined();
    expect(checked.message).toContain("まだ公開していません");
    expect(checked.aiSearch?.length ?? 0).toBeGreaterThan(0);

    // 同じ入力で出そうとすると保存で落ちる = 点検は保存へ進んでいない。
    expect((await publishArticleAction(IDLE, fullForm())).status).toBe("failed");
  });

  it("点検でも、公開と同じ理由で断られる（点検だけ通る抜け道を作らない）", async () => {
    asPublisher();
    const state = await publishArticleAction(IDLE, fullForm({ intent: "check", slug: "静かなノート" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("slug");
  });

  it("ログインしていない人は、点検もできない", async () => {
    asPublisher();
    loggedIn = false;
    const state = await publishArticleAction(IDLE, fullForm({ intent: "check" }));
    expect(state.status).toBe("failed");
    expect(state.message).toContain("ログイン");
  });
});

/**
 * 記事の画面から配信を予約する操作。
 *
 * ログインの有無だけを見る。ここには元から `describe` が無く、
 * この操作は `docs/product/open-doors.md` の
 * 「誰でも実行できて取り返しがつかない操作」に入っていた（`ah-dao`）。
 *
 * 予約が入ると、決めた時刻に外へ出ていく。押した後に止める口が無い。
 */
describe("配信を予約する操作", () => {
  beforeEach(() => {
    // 役では断られない人にしておく。役に頼った緑を作らないため。
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  });

  /**
   * 見るのは断りの**文**だけである。`status: "failed"` は塞ぐ前から出る。
   * 見本の記事が「承認が済んでいない」で先に止まるためで、
   * **ログインを見なくても失敗する**。色が変わらない検査を置いても、
   * 在るだけで見張っていない。
   *
   * 文が「ログイン」を指しているかどうかだけが、どちらの理由で断ったかを分ける。
   */
  it("ログインしていない断りは、理由が画面に出る", async () => {
    loggedIn = false;
    const state = await schedulePublicationAction(
      IDLE,
      form({ variantId: "cv_alpha_review", channelKind: "own_site", scheduledAt: "2026-09-01T10:00" }),
    );
    expect(state.message, "断る理由が画面に出ていません").toContain("ログイン");
  });
});
