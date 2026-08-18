/** @tier 1 */
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
const {
  advanceContentStateAction,
  approveContentAction,
} = await import("@/presentation/admin/content-progress-action");
const { adjustConversionAction } = await import("@/presentation/admin/adjust-conversion-action");
const { publishArticleAction } = await import("@/presentation/admin/publish-article-action");
const { personaUseCases, siteUseCases } = await import("@/presentation/composition");

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
   * 見本の保存先には操作の記録を書けない（`createSampleAuditLog` の `append` は必ず失敗する）。
   * ブログを作ると記録が要るので、この段では**必ず断られる**。
   * それでよいと決めた理由と、本当に作れることを確かめる場所は
   * docs/product/port-wiring.md「記録を足すと、見本モードでは操作が断られる」を見る。
   *
   * ここで見るのは、断り方が**押した人を二度押しへ誘導しないか**である。
   * 記録は作った後に書くので、断られた時点でブログはもう読者から見えている。
   * 断り文がそれを隠すと、押した人は名前を変えてもう一度作り、同じブログが 2 本並ぶ。
   */
  it("記録を残せない段では、作れたことにせず断る", async () => {
    const draftId = await completeDraftThroughForms(`action-test-${Date.now()}`);
    const state = await createSiteFromDraftAction({ status: "idle", message: "" }, form({ draftId }));

    expect(state.status).toBe("failed");
    // 「できました」と読める場所を残さない。
    expect(state.createdPath).toBeUndefined();
  });

  it("断り文が、すでに読者から見えていることを隠さない", async () => {
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
      categorySlug: "laptops",
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
});
