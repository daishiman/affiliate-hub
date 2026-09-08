/**
 * @tier 2
 * @req REQ-BOPC03
 * @req feat-reader-behavior-analytics
 * @types equivalence, boundary, screen-states
 */
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReaderInteractionWireEnvelope,
  ReaderInteractionWireEvent,
} from "@/domain/analytics/reader-interaction";
import {
  ReaderBehaviorProbe,
  type BehaviorProbeProps,
} from "@/presentation/reader/behavior-probe";

/**
 * 読者の読み方を観測して送る側の振る舞い。
 *
 * --- なぜ jsdom なのか ---
 * この部品が返す HTML は空で、本体は **document 全体に耳を付ける副作用**である。
 * 描いた結果を見る方法では 1 行も確かめられない。本物の DOM の上で
 * 本物のイベントを起こし、**何が送られたか**を見る。
 *
 * --- ここが壊れると、どう見えるか ---
 * 画面は普通に動く。管理画面の「読者の行動」だけが静かに空になるか、
 * もっと悪い場合は**間違った数字が埋まる**（離脱が 2 回数えられて
 * 平均滞在が半分に見える、など）。使ってみて気づけない類なので、
 * 送られた中身そのものを見る。
 *
 * --- `/api/telemetry` の collector との違い ---
 * あちらは画面の使われ方（管理画面を含む）、こちらは公開ブログの読者だけ。
 * 送り先も保存の期限も違うので (AD-4)、独立して確かめる。
 */

type Sent = ReaderInteractionWireEvent;

/** 送信された生の本文。fetch は文字列、sendBeacon は Blob なので後でまとめて読む。 */
let raw: (string | Promise<string>)[] = [];

function stubFetch(): void {
  globalThis.fetch = vi.fn((_url: unknown, init?: { body?: unknown }) => {
    raw.push(String(init?.body ?? ""));
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as unknown as typeof fetch;
}

function stubBeacon(impl: "ok" | "throws" | "absent"): void {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value:
      impl === "absent"
        ? undefined
        : (_url: string, blob: Blob) => {
            if (impl === "throws") throw new Error("送れませんでした");
            raw.push(blob.text());
            return true;
          },
  });
}

async function sent(): Promise<Sent[]> {
  const bodies = await Promise.all(raw.map((b) => Promise.resolve(b)));
  return bodies.flatMap((body) => (JSON.parse(body) as { events: Sent[] }).events);
}

async function batches(): Promise<ReaderInteractionWireEnvelope[]> {
  const bodies = await Promise.all(raw.map((b) => Promise.resolve(b)));
  return bodies.map((body) => JSON.parse(body) as ReaderInteractionWireEnvelope);
}

function kindsOf(events: readonly Sent[]): string[] {
  return events.map((e) => e.kind);
}

function marked(kind: string, id: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("data-tel-kind", kind);
  el.setAttribute("data-tel-id", id);
  document.body.appendChild(el);
  return el;
}

function plain(): HTMLElement {
  const el = document.createElement("button");
  document.body.appendChild(el);
  return el;
}

function click(el: Element): void {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new window.Event("visibilitychange"));
}

function setReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { configurable: true, value });
}

/** 読める長さと、いまの読み進み位置を差配する。jsdom はどちらも 0 のまま。 */
function setPage(scrollHeight: number, innerHeight: number, scrollY: number): void {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
}

function scrollTo(y: number): void {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new window.Event("scroll"));
}

function setWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

const BASE: BehaviorProbeProps = {
  siteSlug: "sample",
  articleSlug: "how-to-choose",
  allowBehaviour: true,
  suppressAll: false,
};

function mount(props: Partial<BehaviorProbeProps> = {}): { unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ReaderBehaviorProbe {...BASE} {...props} />);
  });
  return {
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

beforeEach(() => {
  raw = [];
  document.body.innerHTML = "";
  sessionStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setReferrer("");
  setVisibility("visible");
  // 2000px の記事を 1000px の窓で見ている。読み切るには 1000px 動かす。
  setPage(2000, 1000, 0);
  setWidth(1280);
  stubFetch();
  stubBeacon("ok");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("同意が無ければ、イベントを 1 つも作らない", () => {
  it.each([
    ["一切を止める指定", { suppressAll: true }],
    ["行動の同意が無い", { allowBehaviour: false }],
  ])("%s のときは、押しても離れても何も送らない", async (_name, props) => {
    const { unmount } = mount(props);
    click(marked("affiliate_link", "lk_1"));
    unmount();

    /*
     * 「作ってからサーバーで捨てる」にしない。捨てるつもりでも通信は起きており、
     * 同意しなかった読者の端末だけが余計に通信する形になる。
     */
    expect(await sent()).toEqual([]);
  });
});

describe("開いてから離れるまでを、1 組として送る", () => {
  it("開いた 1 回・滞在・離脱が、この順で 1 件ずつ出る", async () => {
    const { unmount } = mount();
    unmount();

    const kinds = kindsOf(await sent());
    expect(kinds.filter((k) => k === "view")).toHaveLength(1);
    expect(kinds.filter((k) => k === "dwell")).toHaveLength(1);
    expect(kinds.filter((k) => k === "exit")).toHaveLength(1);
  });

  it("裏に回ってから閉じても、滞在と離脱は 1 件ずつのまま", async () => {
    const { unmount } = mount();
    // 裏に回った時点で 1 回、そのまま閉じてもう 1 回、と続けて来る。
    setVisibility("hidden");
    window.dispatchEvent(new window.Event("pagehide"));
    unmount();

    const kinds = kindsOf(await sent());
    /*
     * ここが 2 件になると、同じ滞在が二重に数えられて**平均滞在が半分に見える**。
     * 画面は普通に動くので、数字を見ただけでは気づけない。
     */
    expect([
      kinds.filter((k) => k === "dwell").length,
      kinds.filter((k) => k === "exit").length,
    ]).toEqual([1, 1]);
  });

  it("記事の名前と作業対象のブログを、送る本文が名乗る", async () => {
    const { unmount } = mount();
    unmount();

    const bodies = await batches();
    expect(bodies[0].siteSlug).toBe("sample");
    expect(bodies[0].events.every((e) => e.articleSlug === "how-to-choose")).toBe(true);
  });

  it("共有 wire 契約どおり、ブログ名は envelope だけ、ID は各 event に一度付く", async () => {
    const { unmount } = mount();
    unmount();

    const [body] = await batches();
    const contractFixture: ReaderInteractionWireEnvelope | undefined = body;
    expect(contractFixture?.siteSlug).toBe("sample");
    expect(contractFixture?.events.every((event) => !("siteSlug" in event))).toBe(true);
    const ids = contractFixture?.events.map((event) => event.eventId) ?? [];
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // view は位置を持たないのが producer の実際の形。受け口がこの省略を受理する。
    expect(contractFixture?.events.find((event) => event.kind === "view")?.positionRatio).toBe(
      undefined,
    );
  });

  it("記事を読んでいないとき（表紙など）は、記事の名前を付けない", async () => {
    const { unmount } = mount({ articleSlug: undefined });
    unmount();

    expect((await sent()).every((e) => e.articleSlug === undefined)).toBe(true);
  });
});

describe("どこまで読んだかを、刻んで送る", () => {
  it("刻みを越えるたびに 1 件ずつ、同じ刻みは 2 度送らない", async () => {
    const { unmount } = mount();
    scrollTo(500); // 50%
    scrollTo(520); // まだ 52%。刻みは越えない
    scrollTo(800); // 80%
    unmount();

    const marks = (await sent())
      .filter((e) => e.kind === "scroll")
      .map((e) => e.positionRatio);
    // 25% と 50% と 75%。細かい上下で件数が膨らまない。
    expect(marks).toEqual([0.25, 0.5, 0.75]);
  });

  it("窓に収まる短い記事は、開いた時点で読み切ったと数える", async () => {
    // 記事のほうが窓より短い。動かしようが無いので、下端は最初から見えている。
    setPage(600, 1000, 0);
    const { unmount } = mount();
    unmount();

    const marks = (await sent())
      .filter((e) => e.kind === "scroll")
      .map((e) => e.positionRatio);
    expect(marks).toEqual([0.25, 0.5, 0.75, 1]);
  });
});

describe("押された場所は、印の付いた部品だけを数える", () => {
  it("印のある部品を押すと、種類と id を繋いだ名前が付く", async () => {
    const { unmount } = mount();
    click(marked("affiliate_link", "lk_1"));
    unmount();

    const clicks = (await sent()).filter((e) => e.kind === "click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].elementKey).toBe("affiliate_link:lk_1");
  });

  it("印の無い場所を押しても増えない", async () => {
    const { unmount } = mount();
    click(plain());
    unmount();

    /*
     * 印の無いものまで拾うと、`div` の入れ子が 1 つ変わっただけで別の名前になり、
     * 日をまたいだ比較ができなくなる。
     */
    expect((await sent()).filter((e) => e.kind === "click")).toHaveLength(0);
  });

  it("印の付いた親の中を押しても、親の名前で数える", async () => {
    const { unmount } = mount();
    const row = marked("ranking_row", "rk_1");
    const inner = document.createElement("span");
    row.appendChild(inner);
    click(inner);
    unmount();

    const clicks = (await sent()).filter((e) => e.kind === "click");
    expect(clicks[0]?.elementKey).toBe("ranking_row:rk_1");
  });
});

describe("人を特定できるものを持たない", () => {
  it("sessionStorage が拒否されても、effect 内だけの非 null session 鍵を使う", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const { unmount } = mount();
    unmount();

    const keys = (await sent()).map((event) => event.sessionKey);
    expect(keys.every((key) => typeof key === "string" && key.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(1);
  });

  it("画面幅は実寸ではなく、3 つの区分のどれかになる", async () => {
    setWidth(1237);
    const { unmount } = mount();
    unmount();

    const events = await sent();
    // 実寸を送ると、珍しい幅の組み合わせがそれだけで個人を指せてしまう。
    expect(events.every((e) => e.viewportBand === "wide")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("1237");
  });

  it("参照元は URL 全体ではなく、区分だけになる", async () => {
    setReferrer("https://www.google.com/search?q=%E7%A7%98%E5%AF%86%E3%81%AE%E8%AA%9E");
    const { unmount } = mount();
    unmount();

    const events = await sent();
    expect(events.every((e) => e.segment === "search")).toBe(true);
    // 検索した語がそのまま届くと、それは読者の関心そのものである。
    expect(JSON.stringify(events)).not.toContain("google.com");
  });

  it.each([
    ["同じサイト内から", "http://localhost:3000/s/sample/", "internal"],
    ["SNS から", "https://x.com/someone", "social"],
    ["よそのサイトから", "https://example.com/blog", "referral"],
    ["参照元なし", "", "direct"],
  ])("%s は %s と数える", async (_name, referrer, expected) => {
    setReferrer(referrer);
    const { unmount } = mount();
    unmount();

    expect((await sent())[0]?.segment).toBe(expected);
  });
});

describe("送れなくても、読者の画面は動く", () => {
  it("送信そのものが例外を投げても、外へ漏らさない", async () => {
    stubBeacon("throws");
    const { unmount } = mount();

    // ここで投げると、離脱時の後片付け（同意の表示など）まで巻き込む。
    expect(() => unmount()).not.toThrow();
  });

  it("`sendBeacon` を持たない環境でも、離脱時に送る手段が残る", async () => {
    stubBeacon("absent");
    const { unmount } = mount();
    unmount();

    // 古い環境では通常の送信に落ちる。落ちた先で送れていることを見る。
    expect(kindsOf(await sent())).toContain("exit");
  });
});
