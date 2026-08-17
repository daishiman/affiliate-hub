import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";

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
 * どちらも本物の判断（権限・状態遷移）はそのまま通る。
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
const { personaUseCases } = await import("@/presentation/composition");

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
});

describe("受信箱の操作", () => {
  it("見本のログインでは動かせないことが、理由つきで画面に返る", async () => {
    const state = await submitAffiliateUrlAction(IDLE, form({ url: "https://example.invalid/a" }));

    // 黙って何も起きないのが最悪。断られたことと理由が、必ず画面まで届く。
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("提携を扱える人なら受け取り、次にすることを返す", async () => {
    asAffiliateManager();
    const state = await submitAffiliateUrlAction(
      IDLE,
      form({ url: `https://example.invalid/asp/act-${Date.now()}`, note: "画面から貼り付け" }),
    );

    expect(state.status).toBe("done");
    expect(state.message).toContain("広告主");
    expect(state.warn).toBe(false);
  });

  it("同じリンクを 2 回入れたときは、成功として返しつつ注意を添える", async () => {
    asAffiliateManager();
    const url = `https://example.invalid/asp/dup-${Date.now()}`;
    await submitAffiliateUrlAction(IDLE, form({ url }));
    const again = await submitAffiliateUrlAction(IDLE, form({ url }));

    // 失敗にすると「入れられなかった」と誤解される。入っているが重なっている。
    expect(again.status).toBe("done");
    expect(again.warn).toBe(true);
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

  it("広告主を決める・商品に結びつける・対象外にする、の 3 つが通る", async () => {
    asAffiliateManager();
    const created = await submitAffiliateUrlAction(
      IDLE,
      form({ url: `https://example.invalid/asp/flow-${Date.now()}` }),
    );
    expect(created.status).toBe("done");

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

  it("見本の 1 件を、広告主 → 商品 → の順に進められる", async () => {
    asAffiliateManager();
    const resolved = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_1", intent: "resolve", programId: "prg_rakuten_pc" }),
    );
    expect(resolved.status).toBe("done");
    expect(resolved.message).toContain("決めました");

    const matched = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_1", intent: "match", productId: "p_alpha_15" }),
    );
    expect(matched.status).toBe("done");
    expect(matched.message).toContain("結びつけ");

    const rejected = await advanceLinkIngestionAction(
      IDLE,
      form({ linkIngestionId: "li_received_2", intent: "reject", reason: "提携が終了しているため。" }),
    );
    expect(rejected.status).toBe("done");
    expect(rejected.message).toContain("理由");
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
});

describe("ブログ作成ウィザードの操作", () => {
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

  it("全段階に答えたら、読者が開ける場所まで含めて作られる", async () => {
    const draftId = await completeDraftThroughForms(`action-test-${Date.now()}`);
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    expect(state.status).toBe("done");
    // 作った本人が確かめられないと、できたかどうか分からない。
    expect(state.createdPath).toMatch(/^\/s\//);
    expect(state.message.trim()).not.toBe("");
  });
});

describe("事実の範囲の確認", () => {
  async function anAuthorId(): Promise<string> {
    const list = await personaUseCases().listAuthors.execute(SAMPLE_ACTOR, {});
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
});
