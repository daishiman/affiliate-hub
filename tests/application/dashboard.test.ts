/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGET_KEYS,
  type DashboardWidget,
  type DashboardWidgetKey,
  type ReadDashboardDeps,
  createGetDashboardUseCase,
} from "@/application/usecases/dashboard/read-dashboard";
import { ok } from "@/domain/shared";
import { ADMIN_NAV } from "@/presentation/ui";
import { currentActor, dashboardUseCases } from "@/presentation/composition";
import { aNobody, anAnalyst, anOwner, aWriter } from "../support/actors";
import {
  aChannelConnection,
  aConversion,
  aProduct,
  aProvenance,
  aPublication,
} from "../support/factories";
import { NOW, daysFrom } from "../support/clock";
import { failing, testDeps } from "../support/doubles";

/**
 * ホームに出す 11 個の数字。
 *
 * --- ここで固定したいこと ---
 * この画面の失敗の仕方は 2 つしかない。
 * ひとつは **0 と「取れなかった」を同じ見た目にする**こと。
 * もうひとつは **1 つ取れないと 11 個すべてが消える**こと。
 * どちらも「今日は手当てが要らない」と読み違えさせるので、
 * 数そのものより、この 2 点を数多く確かめる。
 *
 * 色（tone）も同じ理由で見る。良い知らせに色を付けると、
 * 本当に手当てが要る数字が埋もれて、結局この画面は見られなくなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 仕様書 §22.1
 */

/** 見本の実装を土台に、必要な口だけ差し替える。 */
function deps(over: Partial<ReadDashboardDeps> = {}): ReadDashboardDeps {
  const base = testDeps();
  return {
    contentVariants: base.contentVariants,
    products: base.products,
    publications: base.publications,
    channelConnections: base.channelConnections,
    linkInbox: base.linkInbox,
    affiliateLinks: base.affiliateLinks,
    conversions: base.conversions,
    ...over,
  };
}

function portOf<K extends keyof ReadDashboardDeps>(
  key: K,
  over: Record<string, unknown>,
): ReadDashboardDeps[K] {
  return { ...(testDeps()[key] as object), ...over } as ReadDashboardDeps[K];
}

const owner = anOwner();
const AT = new Date("2026-08-17T05:00:00Z");

async function widgetsFor(
  actor = owner,
  over: Partial<ReadDashboardDeps> = {},
): Promise<readonly DashboardWidget[]> {
  const got = await createGetDashboardUseCase(deps(over)).execute(actor, { at: AT });
  if (!got.ok) throw got.error;
  return got.value.widgets;
}

function pick(widgets: readonly DashboardWidget[], key: DashboardWidgetKey): DashboardWidget {
  const found = widgets.find((w) => w.key === key);
  if (found === undefined) throw new Error(`${key} の数字がありません。`);
  return found;
}

/** 何も無い状態。数え上げの土台にする。 */
function emptyWorld(): Partial<ReadDashboardDeps> {
  return {
    contentVariants: portOf("contentVariants", {
      listByState: async () => ok({ items: [], nextCursor: null }),
      listReviewOverdue: async () => ok([]),
    }),
    products: portOf("products", { search: async () => ok({ items: [], nextCursor: null }) }),
    publications: portOf("publications", { listRecent: async () => ok([]) }),
    channelConnections: portOf("channelConnections", {
      listByWorkspace: async () => ok({ items: [], nextCursor: null }),
    }),
    linkInbox: portOf("linkInbox", { list: async () => ok({ items: [], nextCursor: null }) }),
    affiliateLinks: portOf("affiliateLinks", { listNeedingAttention: async () => ok([]) }),
    conversions: portOf("conversions", { listByPeriod: async () => ok({ items: [], nextCursor: null }) }),
  };
}

describe("並びと約束", () => {
  it("仕様の並びどおりに 11 個そろう", async () => {
    const widgets = await widgetsFor();
    expect(widgets.map((w) => w.key)).toEqual([...DASHBOARD_WIDGET_KEYS]);
  });

  it("どの数字にも、意味の一文と、解消しに行ける画面が付いている", async () => {
    for (const w of await widgetsFor()) {
      expect(w.reason.length, `${w.key} に意味の説明がありません`).toBeGreaterThan(0);
      expect(w.href.startsWith("/"), `${w.key} の行き先が経路になっていません`).toBe(true);
      expect(w.actionLabel.length, `${w.key} の行き先の呼び名がありません`).toBeGreaterThan(0);
    }
  });

  it("集計の基準時刻と期間が、渡した時刻から決まる", async () => {
    const got = await createGetDashboardUseCase(deps()).execute(owner, { at: AT });
    if (!got.ok) throw got.error;

    expect(got.value.asOf).toBe(AT);
    expect(got.value.period).toBe("2026-08");
  });

  it("時刻を渡さなくても、期間の形は YYYY-MM になる", async () => {
    const got = await createGetDashboardUseCase(deps()).execute(owner, {});
    if (!got.ok) throw got.error;

    expect(got.value.period).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it("年をまたぐ時刻でも、月が 0 埋めされる", async () => {
    const got = await createGetDashboardUseCase(deps()).execute(owner, {
      at: new Date("2026-01-01T00:00:00Z"),
    });
    if (!got.ok) throw got.error;

    expect(got.value.period).toBe("2026-01");
  });

  it("権限が無い人には出さない", async () => {
    const got = await createGetDashboardUseCase(deps()).execute(aNobody(), {});
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("お金の数字を見られない人", () => {
  const moneyKeys: readonly DashboardWidgetKey[] = [
    "link_inbox",
    "broken_links",
    "conversions",
    "revenue",
  ];

  it("金額と成果は、0 ではなく「見られない理由」になる", async () => {
    const widgets = await widgetsFor(aWriter());

    for (const key of moneyKeys) {
      const w = pick(widgets, key);
      expect(w.value, `${key} が 0 として出ています`).toBeNull();
      expect(w.valueLabel).toBe("—");
      expect(w.unavailableReason ?? "").toContain("権限がありません");
      // 誰に頼めばよいかが書いていないと、利用者はそこで止まる。
      expect(w.unavailableReason ?? "").toContain("管理者");
    }
  });

  it("編集側の数字は、権限が無くても普通に出る", async () => {
    const widgets = await widgetsFor(aWriter());
    expect(pick(widgets, "generation_queue").unavailableReason).toBeNull();
    expect(pick(widgets, "approval_queue").unavailableReason).toBeNull();
  });

  it("数字を見る人（お金の閲覧権あり）には、金額の欄が用意される", async () => {
    const widgets = await widgetsFor(anAnalyst());
    expect(pick(widgets, "revenue").unavailableReason ?? "").not.toContain("権限がありません");
  });
});

describe("取れなかったときの見せ方", () => {
  it("商品が取れなくても、他の 10 個は消えない", async () => {
    const widgets = await widgetsFor(owner, {
      products: portOf("products", { search: async () => failing("商品の保存先に繋がりません。") }),
    });

    const broken = pick(widgets, "product_verification");
    expect(broken.value).toBeNull();
    expect(broken.valueLabel).toBe("—");
    expect(broken.unavailableReason).toContain("商品の保存先");
    expect(widgets.filter((w) => w.unavailableReason === null).length).toBeGreaterThan(5);
  });

  it("取れなかった数字は、色を付けない（手当てが要る数と混ぜない）", async () => {
    const widgets = await widgetsFor(owner, {
      publications: portOf("publications", { listRecent: async () => failing("配信の記録が読めません。") }),
    });

    expect(pick(widgets, "publish_failed").tone).toBe("neutral");
  });

  it("取れなかった数を、別に数えて出す", async () => {
    const got = await createGetDashboardUseCase(
      deps({
        publications: portOf("publications", { listRecent: async () => failing("読めません。") }),
      }),
    ).execute(owner, { at: AT });
    if (!got.ok) throw got.error;

    // 本日の投稿と投稿の失敗が、同じ読み出しから来ている。
    expect(got.value.unavailableCount).toBeGreaterThanOrEqual(2);
  });

  it("事実確認の側が取れないときは、その理由をそのまま出す", async () => {
    const widgets = await widgetsFor(owner, {
      contentVariants: portOf("contentVariants", {
        listByState: async (_ws: unknown, state: string) =>
          state === "FACT_CHECK"
            ? failing("事実確認の一覧が読めません。")
            : ok({ items: [], nextCursor: null }),
      }),
    });

    expect(pick(widgets, "approval_queue").unavailableReason).toContain("事実確認の一覧");
  });

  it("表現確認の側だけが取れないときも、合計を出したことにしない", async () => {
    const widgets = await widgetsFor(owner, {
      contentVariants: portOf("contentVariants", {
        listByState: async (_ws: unknown, state: string) =>
          state === "COMPLIANCE_REVIEW"
            ? failing("表現確認の一覧が読めません。")
            : ok({ items: [], nextCursor: null }),
      }),
    });

    const w = pick(widgets, "approval_queue");
    expect(w.value).toBeNull();
    expect(w.unavailableReason).toContain("数えられませんでした");
  });

  it("成果リンクの点検が取れないときは、0 本ではなく理由を出す", async () => {
    const widgets = await widgetsFor(owner, {
      affiliateLinks: portOf("affiliateLinks", {
        listNeedingAttention: async () => failing("リンクの点検ができません。"),
      }),
    });

    const w = pick(widgets, "broken_links");
    expect(w.value).toBeNull();
    expect(w.unavailableReason).toContain("リンクの点検");
  });

  it("媒体のつながりが取れないときも、0 件と言わない", async () => {
    const widgets = await widgetsFor(owner, {
      channelConnections: portOf("channelConnections", {
        listByWorkspace: async () => failing("媒体の一覧が読めません。"),
      }),
    });

    expect(pick(widgets, "channel_health").value).toBeNull();
  });

  it("見直し期限の一覧が取れないときも、0 本と言わない", async () => {
    const widgets = await widgetsFor(owner, {
      contentVariants: portOf("contentVariants", {
        listReviewOverdue: async () => failing("見直しの一覧が読めません。"),
      }),
    });

    expect(pick(widgets, "refresh_due").value).toBeNull();
  });

  it("受信箱が取れないときは、権限の話にすり替えない", async () => {
    const widgets = await widgetsFor(owner, {
      linkInbox: portOf("linkInbox", { list: async () => failing("受信箱が読めません。") }),
    });

    const w = pick(widgets, "link_inbox");
    expect(w.unavailableReason).toContain("受信箱");
    expect(w.unavailableReason ?? "").not.toContain("権限");
  });

  it("成果の一覧が取れないときも、0 件と言わない", async () => {
    const widgets = await widgetsFor(owner, {
      conversions: portOf("conversions", { listByPeriod: async () => failing("成果が読めません。") }),
    });

    expect(pick(widgets, "conversions").value).toBeNull();
  });
});

describe("数え方", () => {
  it("何も無いときは 0 件として出て、手当てが要らないと言い切れる", async () => {
    const got = await createGetDashboardUseCase(deps(emptyWorld())).execute(owner, { at: AT });
    if (!got.ok) throw got.error;

    expect(got.value.attentionCount).toBe(0);
    expect(got.value.allClearReason).toContain("手当てが要るものはありません");
    expect(got.value.unavailableCount).toBe(0);
    expect(pick(got.value.widgets, "generation_queue").valueLabel).toBe("0本");
  });

  it("出どころが怪しい商品と、期限切れの商品を数える", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      products: portOf("products", {
        search: async () =>
          ok({
            items: [
              aProduct({ provenance: aProvenance({ confidence: 0.69 }) }),
              aProduct({ provenance: aProvenance({ validUntil: daysFrom(NOW, -1) }) }),
              aProduct({ provenance: aProvenance({ confidence: 0.7 }) }),
            ],
            nextCursor: null,
          }),
      }),
    });

    // 0.7 ちょうどは「確かめ済み」側。境界をどちらに倒したかを固定する。
    expect(pick(widgets, "product_verification").value).toBe(2);
  });

  it("今日の投稿だけを数える（時差で 1 日ずれない）", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      publications: portOf("publications", {
        listRecent: async () =>
          ok([
            aPublication({ publishedAt: new Date("2026-08-17T23:59:59Z") }),
            aPublication({ publishedAt: new Date("2026-08-17T00:00:00Z") }),
            aPublication({ publishedAt: new Date("2026-08-16T23:59:59Z") }),
            aPublication({ publishedAt: null }),
          ]),
      }),
    });

    expect(pick(widgets, "published_today").value).toBe(2);
  });

  it("止まっている投稿は、送信の失敗と検査の失敗の両方を数える", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      publications: portOf("publications", {
        listRecent: async () =>
          ok([
            aPublication({ state: "FAILED_SEND" }),
            aPublication({ state: "FAILED_VALIDATION" }),
            aPublication({ state: "PUBLISHED" }),
          ]),
      }),
    });

    const w = pick(widgets, "publish_failed");
    expect(w.value).toBe(2);
    // 止まっている投稿は「気にしておく」ではなく「手当てが要る」側。
    expect(w.tone).toBe("problem");
  });

  it("良い知らせには色を付けない", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      publications: portOf("publications", { listRecent: async () => ok([aPublication({ publishedAt: AT })]) }),
    });

    expect(pick(widgets, "published_today").value).toBe(1);
    expect(pick(widgets, "published_today").tone).toBe("neutral");
  });

  it("期限切れと解除済みの媒体を数え、どの媒体かを名前で出す", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      channelConnections: portOf("channelConnections", {
        listByWorkspace: async () =>
          ok({
            items: [
              aChannelConnection({ kind: "x", revokedAt: daysFrom(AT, -1) }),
              aChannelConnection({ kind: "note", expiresAt: AT }),
              aChannelConnection({ kind: "youtube", expiresAt: daysFrom(AT, 1) }),
            ],
            nextCursor: null,
          }),
      }),
    });

    const w = pick(widgets, "channel_health");
    // 期限ちょうどは「切れている」側。まだ使えると見せて投稿が落ちる方が困る。
    expect(w.value).toBe(2);
    expect(w.reason).toContain("X");
    expect(w.reason).toContain("note");
    expect(w.reason).not.toContain("YouTube");
  });

  it("承認待ちは、事実確認と表現確認を足した数になる", async () => {
    const widgets = await widgetsFor(owner, {
      ...emptyWorld(),
      contentVariants: portOf("contentVariants", {
        listByState: async (_ws: unknown, state: string) =>
          ok({
            items:
              state === "FACT_CHECK"
                ? [1, 2]
                : state === "COMPLIANCE_REVIEW"
                  ? [3]
                  : [],
            nextCursor: null,
          }),
        listReviewOverdue: async () => ok([]),
      }),
    });

    expect(pick(widgets, "approval_queue").value).toBe(3);
    expect(pick(widgets, "approval_queue").tone).toBe("attention");
  });
});

describe("金額の合計", () => {
  function withConversions(items: readonly unknown[]): Partial<ReadDashboardDeps> {
    return {
      ...emptyWorld(),
      conversions: portOf("conversions", {
        listByPeriod: async () => ok({ items, nextCursor: null }),
      }),
    };
  }

  it("同じ通貨だけなら足して、単位つきで出す", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([
        aConversion({ ingestedReward: { amountMinor: 120_000, currency: "JPY" } }),
        aConversion({ ingestedReward: { amountMinor: 80_000, currency: "JPY" } }),
      ]),
    );

    const w = pick(widgets, "revenue");
    expect(w.value).toBe(200_000);
    // 桁区切りと通貨の印が要る。裸の数字だと、円なのかドルなのか読めない。
    expect(w.valueLabel).toContain("200,000");
    expect(w.valueLabel).not.toBe("200000");
    expect(w.unavailableReason).toBeNull();
  });

  it("人が直した金額があれば、そちらを使う（取込値は足さない）", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([
        aConversion({
          ingestedReward: { amountMinor: 120_000, currency: "JPY" },
          adjustedReward: { amountMinor: 90_000, currency: "JPY" },
          adjustmentReason: "返品ぶんを引いた",
        }),
      ]),
    );

    expect(pick(widgets, "revenue").value).toBe(90_000);
  });

  it("通貨が混ざっているときは、合計を出さずに理由を出す", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([
        aConversion({ ingestedReward: { amountMinor: 100_000, currency: "JPY" } }),
        aConversion({ ingestedReward: { amountMinor: 1_000, currency: "USD" } }),
      ]),
    );

    const w = pick(widgets, "revenue");
    expect(w.value).toBeNull();
    expect(w.valueLabel).toBe("—");
    expect(w.unavailableReason).toContain("通貨が混ざっている");
  });

  it("金額が未取得の成果しか無いときは、0 円として出す", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([aConversion({ ingestedReward: null }), aConversion({ ingestedReward: null })]),
    );

    const w = pick(widgets, "revenue");
    expect(w.value).toBe(0);
    // 0 のときだけ「0円」、金額があるときは「￥…」と、書き方が揃っていない。
    // 表示の統一は残課題（docs/product/backlog.md）。ここでは現状を固定して、
    // 直したときに気づけるようにしておく。
    expect(w.valueLabel).toBe("0円");
    expect(w.unavailableReason).toBeNull();
  });

  it("成果が 1 件も無い月は、0 円として出す", async () => {
    const widgets = await widgetsFor(owner, withConversions([]));
    expect(pick(widgets, "revenue").value).toBe(0);
  });

  it("金額の説明に、未取得を 0 円として足していないことが書いてある", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([aConversion({ ingestedReward: { amountMinor: 1, currency: "JPY" } })]),
    );

    expect(pick(widgets, "revenue").reason).toContain("未取得の金額は 0 円として足していません");
  });

  it("金額は、良し悪しの色を付けない", async () => {
    const widgets = await widgetsFor(
      owner,
      withConversions([aConversion({ ingestedReward: { amountMinor: 1_000_000, currency: "JPY" } })]),
    );

    expect(pick(widgets, "revenue").tone).toBe("neutral");
    expect(pick(widgets, "conversions").tone).toBe("neutral");
  });
});

/**
 * ここから下は、見本データを積んだ**実際の組み立て**を通した確認。
 *
 * 上の一群が「口を差し替えて 1 つずつ確かめる」のに対し、
 * こちらは**画面が実際に呼ぶ経路**をそのまま通す。
 * 口の差し替えでは、組み立て（composition）の配線間違いが素通りするため、
 * 両方を残す。
 */

/** 見本データの時刻。ここを固定しないと「本日の投稿」が日によって変わる。 */
const SAMPLE_AT = new Date("2026-08-16T09:00:00Z");

async function board() {
  const actor = await currentActor();
  const result = await (await dashboardUseCases()).getDashboard.execute(actor, { at: SAMPLE_AT });
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("見本データを積んだ実際の画面", () => {
  it("見出しが空の数字がない", async () => {
    for (const w of (await board()).widgets) {
      expect(w.label.trim(), `${w.key} に見出しがありません`).not.toBe("");
    }
  });

  it("行き先がすべて、実在する管理画面である", async () => {
    const view = await board();
    const known = new Set(ADMIN_NAV.map((n) => n.href));
    for (const w of view.widgets) {
      expect(known.has(w.href), `${w.key} の行き先 ${w.href} は管理画面の一覧にありません`).toBe(
        true,
      );
    }
  });

  it("数えられなかったものを 0 件と書かない", async () => {
    const view = await board();
    for (const w of view.widgets) {
      if (w.unavailableReason !== null) {
        expect(w.value, `${w.key} は数えられていないのに値が入っています`).toBeNull();
        expect(w.valueLabel).toBe("—");
        // 「出せません」だけで終わらせない。なぜ出せないかを書く。
        expect(w.unavailableReason.trim()).not.toBe("");
      } else {
        expect(w.value, `${w.key} の値がありません`).not.toBeNull();
        expect(w.valueLabel.trim()).not.toBe("");
      }
    }
  });

  it("値が 0 のものに色を付けない（手当ての要る数字が埋もれないようにする）", async () => {
    const view = await board();
    for (const w of view.widgets) {
      if (w.value === 0 && w.unavailableReason === null && w.key !== "revenue") {
        expect(w.tone, `${w.key} は 0 件なのに色が付いています`).toBe("neutral");
      }
    }
  });

  it("手当てが不要なときだけ、その旨の説明が出る", async () => {
    const view = await board();
    if (view.attentionCount === 0) {
      expect(view.allClearReason).not.toBeNull();
    } else {
      expect(view.allClearReason).toBeNull();
    }
  });

  it("収益は、未取得の金額を 0 円として足さない", async () => {
    const view = await board();
    const revenue = view.widgets.find((w) => w.key === "revenue");
    expect(revenue).toBeDefined();
    if (revenue === undefined) return;
    if (revenue.unavailableReason === null) {
      // 見本には金額が未取得の成果が 1 件混ざっている。
      // それを 0 円として足していないことを、説明文で明示している。
      expect(revenue.reason).toContain("未取得");
    }
  });
});

describe("画面と AI の一致", () => {
  it("get_dashboard が、画面と同じユースケースで登録されている", async () => {
    const { createToolCatalog } = await import("@/presentation/composition");
    const tool = (await createToolCatalog()).find((t) => t.name === "get_dashboard");
    expect(tool, "get_dashboard が道具の一覧にありません").toBeDefined();
    // ホーム画面の数字は読むだけ。ページ内の AI にも渡してよい。
    expect(tool?.readOnly).toBe(true);
  });
});
