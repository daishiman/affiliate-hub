/** @tier 2 */
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryCollector, type CollectorProps } from "@/presentation/telemetry/collector";

/**
 * 計測を拾って送る側の振る舞い。
 *
 * --- なぜこのファイルだけ jsdom なのか ---
 * ほかの画面テストは Node のまま描いて、必要なときだけ `tests/support/render.tsx` の
 * 中で DOM を作る。ここだけは違う。拾う側は **document 全体に耳を付ける副作用**が
 * 本体で、出力する HTML は空である。描いた結果を見る方法では 1 行も確かめられない。
 * したがって「本物の DOM の上で、本物のイベントを起こして、何が送られたか」を見る。
 *
 * --- 何を確かめるか ---
 * ここが壊れても**画面は普通に動く**。数字だけが静かに間違う。数か月後に
 * 「この導線のデータが無い」と気づく類の壊れ方なので、送られた中身そのものを見る。
 *   - 同意が無いときに、詳しいイベントを**作っていない**こと
 *   - 同意が無くても、成果リンクの回数と表示回数は数えること
 *   - 送信に失敗しても、読者側で何も起きないこと
 *   - 位置・IP・端末の指紋にあたるものを持たないこと
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2（画面の単体テスト）
 */

type Sent = {
  readonly key: string;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
};

/** 送信された生の本文。fetch は文字列、sendBeacon は Blob なので後でまとめて読む。 */
let raw: (string | Promise<string>)[] = [];

function stubFetch(impl?: () => Promise<unknown>): void {
  globalThis.fetch = vi.fn((_url: unknown, init?: { body?: unknown }) => {
    raw.push(String(init?.body ?? ""));
    return impl === undefined ? Promise.resolve(new Response(null, { status: 204 })) : impl();
  }) as unknown as typeof fetch;
}

function stubBeacon(present: boolean): void {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: present
      ? (_url: string, blob: Blob) => {
          raw.push(blob.text());
          return true;
        }
      : undefined,
  });
}

/** 送られたイベントを、送信の順に並べて返す。 */
async function sent(): Promise<Sent[]> {
  const bodies = await Promise.all(raw.map((b) => Promise.resolve(b)));
  return bodies.flatMap((body) => (JSON.parse(body) as { events: Sent[] }).events);
}

/** 1 回の送信ごとの本文。まとめ方（何件を 1 通で送ったか）を見たいとき。 */
async function batches(): Promise<{ events: Sent[]; readerKey: string | null }[]> {
  const bodies = await Promise.all(raw.map((b) => Promise.resolve(b)));
  return bodies.map((body) => JSON.parse(body) as { events: Sent[]; readerKey: string | null });
}

function keysOf(events: readonly Sent[]): string[] {
  return events.map((e) => e.key);
}

/** 見えている節を作る。滞在時間はこの単位で測られる。 */
function section(id: string, kind?: string): Element {
  const el = document.createElement("section");
  el.setAttribute("data-tel-section", id);
  if (kind !== undefined) el.setAttribute("data-tel-section-kind", kind);
  document.body.appendChild(el);
  return el;
}

function marked(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement("button");
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

function click(el: Element): void {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new window.Event("visibilitychange"));
}

function setReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { configurable: true, value });
}

/** 見え方の変化を差配する偽の観測者。jsdom は本物を持たない。 */
class FakeObserver {
  static last: FakeObserver | null = null;
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void,
    readonly options: { threshold?: number } = {},
  ) {
    FakeObserver.last = this;
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): [] {
    return [];
  }
}

function seeing(el: Element, visible: boolean): void {
  FakeObserver.last?.callback([{ target: el, isIntersecting: visible }]);
}

const BASE: CollectorProps = {
  siteSlug: "sample",
  path: "/s/sample/reviews/a",
  allowBehaviour: true,
  suppressAll: false,
};

function mount(props: Partial<CollectorProps> = {}): { unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<TelemetryCollector {...BASE} {...props} />);
  });
  return {
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  raw = [];
  document.body.innerHTML = "";
  sessionStorage.clear();
  FakeObserver.last = null;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver;
  setReferrer("");
  setVisibility("visible");
  stubFetch();
  stubBeacon(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("同意の有無で、作るものが変わる", () => {
  it("停止指定のときは、開いたことすら作らない", async () => {
    const { unmount } = mount({ suppressAll: true });
    click(marked({ "data-tel-kind": "affiliate_link", "data-tel-id": "lk_1" }));
    unmount();
    // 「作ってからサーバーで捨てる」にしない。捨てるつもりでも通信は起きている。
    expect(await sent()).toEqual([]);
  });

  it("同意が無くても、開いたことは数える（人が特定できる情報は持たない）", async () => {
    const { unmount } = mount({ allowBehaviour: false });
    unmount();

    const events = await sent();
    expect(keysOf(events)).toEqual(["page_view"]);
    expect(events[0].payload).toMatchObject({ siteSlug: "sample", path: BASE.path });
    // 目印は同意があるときだけ。無いときは付けない（後から結び付けられないようにする）。
    expect((await batches())[0].readerKey).toBeNull();
  });

  it("同意が無いと、押した内容は残さない", async () => {
    const { unmount } = mount({ allowBehaviour: false });
    click(marked({ "data-tel-kind": "cta_button", "data-tel-id": "cta_1" }));
    click(marked({ "data-tel-kind": "internal_link", "data-tel-id": "/s/sample/faq" }));
    unmount();
    expect(keysOf(await sent())).toEqual(["page_view"]);
  });

  it("同意が無くても、成果リンクの回数だけは数える", async () => {
    stubBeacon(true);
    const { unmount } = mount({ allowBehaviour: false });
    click(
      marked({
        "data-tel-kind": "affiliate_link",
        "data-tel-id": "lk_9",
        "data-tel-placement": "結論",
      }),
    );
    unmount();

    const events = await sent();
    expect(keysOf(events)).toEqual(["page_view", "affiliate_click"]);
    expect(events[1].payload).toEqual({
      siteSlug: "sample",
      path: BASE.path,
      linkId: "lk_9",
      placement: "結論",
    });
    // 誰が押したかは持たない。件数として数えるだけ。
    expect(events[1].payload).not.toHaveProperty("readerKey");
  });

  it("同意があるときの目印は、同じ読者のあいだ使い回される", async () => {
    const first = mount();
    first.unmount();
    const keyA = (await batches())[0].readerKey;
    expect(keyA).toMatch(/[0-9a-f-]{16,}/);

    raw = [];
    const second = mount();
    second.unmount();
    // 開き直すたびに別人になると、同じ読者の動きが追えず改善の判定ができない。
    expect((await batches())[0].readerKey).toBe(keyA);
  });

  it("保存が使えない設定でも、目印なしで数え続ける", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is disabled");
    });
    const { unmount } = mount();
    unmount();

    const all = await batches();
    expect(all[0].readerKey).toBeNull();
    expect(keysOf(all[0].events)).toEqual(["page_view"]);
  });
});

describe("押されたものの見分け", () => {
  it("順位表の行は、順位を数値で残す", async () => {
    const { unmount } = mount();
    click(
      marked({
        "data-tel-kind": "ranking_row",
        "data-tel-id": "pr_1",
        "data-tel-rank": "3",
      }),
    );
    unmount();

    const [, row] = await sent();
    expect(row.key).toBe("ranking_row_click");
    expect(row.payload).toMatchObject({ productId: "pr_1", rank: 3 });
  });

  it("順位が付いていない行は、順位表の行として扱わない", async () => {
    const { unmount } = mount();
    click(marked({ "data-tel-kind": "ranking_row", "data-tel-id": "pr_2" }));
    unmount();

    const [, row] = await sent();
    // 順位の無い `rank: null` を作ると、集計側で「0 位」として混ざる。
    expect(row.key).toBe("element_click");
    expect(row.payload).toMatchObject({ elementKind: "ranking_row", elementId: "pr_2" });
  });

  it("記事内の移動は、行き先だけを残す", async () => {
    const { unmount } = mount();
    click(marked({ "data-tel-kind": "internal_link", "data-tel-id": "/s/sample/faq" }));
    unmount();

    const [, link] = await sent();
    expect(link.key).toBe("internal_link_click");
    // 置き場所を書いていない部品は「本文」として数える。
    expect(link.payload).toMatchObject({ toPath: "/s/sample/faq", placement: "本文" });
  });

  it("短い名前が付いていれば添える。無ければ持たない", async () => {
    const { unmount } = mount();
    click(
      marked({
        "data-tel-kind": "cta_button",
        "data-tel-id": "cta_1",
        "data-tel-label": "価格を見る",
      }),
    );
    click(marked({ "data-tel-kind": "nav_item", "data-tel-id": "nav_home" }));
    unmount();

    const [, withLabel, without] = await sent();
    expect(withLabel.payload).toMatchObject({ elementKind: "cta_button", label: "価格を見る" });
    // 本文をそのまま入れないため、名乗っていないものを勝手に埋めない。
    expect(without.payload.label).toBeUndefined();
  });

  it("印の付いていない場所を押しても、何も作らない", async () => {
    const { unmount } = mount();
    const plain = document.createElement("p");
    plain.textContent = "ただの本文";
    document.body.appendChild(plain);
    click(plain);
    unmount();
    expect(keysOf(await sent())).toEqual(["page_view"]);
  });

  it("印の付いた部品の内側を押しても、外側の印として数える", async () => {
    const { unmount } = mount();
    const card = marked({ "data-tel-kind": "product_card", "data-tel-id": "pr_5" });
    const inner = document.createElement("span");
    inner.textContent = "詳しく";
    card.appendChild(inner);
    click(inner);
    unmount();

    const [, ev] = await sent();
    expect(ev.payload).toMatchObject({ elementKind: "product_card", elementId: "pr_5" });
  });
});

describe("どこから来て、どこまで読んだか", () => {
  it("参照元は粗い区分だけにする（URL そのものは持たない）", async () => {
    const cases: readonly [string, string][] = [
      ["", "直接"],
      [`${window.location.origin}/s/sample`, "サイト内"],
      ["https://www.google.com/search?q=x", "検索"],
      ["https://x.com/someone/status/1", "SNS"],
      ["https://example.org/blog", "その他サイト"],
      ["これはURLではない", "不明"],
    ];
    for (const [referrer, expected] of cases) {
      raw = [];
      setReferrer(referrer);
      const { unmount } = mount();
      unmount();
      const [view] = await sent();
      expect(view.payload.referrerKind, `参照元「${referrer}」`).toBe(expected);
      // 検索語や記事のURLは、区分に丸めた時点で捨てる。
      expect(JSON.stringify(view.payload)).not.toContain("search?q=");
    }
  });

  it("読んだ深さは、いちばん深く進んだところを残す", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });

    const { unmount } = mount();
    window.scrollY = 500;
    window.dispatchEvent(new window.Event("scroll"));
    // 戻ってきても、到達点は下がらない。
    window.scrollY = 100;
    window.dispatchEvent(new window.Event("scroll"));

    setVisibility("hidden");
    unmount();

    const depth = (await sent()).find((e) => e.key === "scroll_depth");
    expect(depth?.payload.percent).toBe(50);
  });

  it("画面より短い記事では、深さを測らない（常に 100% になるため）", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });

    const { unmount } = mount();
    window.scrollY = 0;
    window.dispatchEvent(new window.Event("scroll"));
    setVisibility("hidden");
    unmount();

    const depth = (await sent()).find((e) => e.key === "scroll_depth");
    expect(depth?.payload.percent).toBe(0);
  });

  it("離れるときに、深さと滞在の合計を送る", async () => {
    const { unmount } = mount();
    vi.advanceTimersByTime(42_000);
    setVisibility("hidden");
    unmount();

    const exit = (await sent()).find((e) => e.key === "page_exit");
    expect(exit?.payload).toMatchObject({ seconds: 42, percent: 0 });
  });

  it("見えなくなっただけ（別タブへ移っていない）では送らない", async () => {
    const { unmount } = mount();
    setVisibility("visible");
    expect(keysOf(await sent())).toEqual([]);
    unmount();
    expect(keysOf(await sent())).toEqual(["page_view"]);
  });
});

describe("節ごとの滞在時間", () => {
  it("1 秒以上見えた節だけ残す。通り過ぎた節は残さない", async () => {
    const read = section("sec_conclusion", "conclusion");
    const passed = section("sec_faq", "faq");

    const { unmount } = mount();
    seeing(read, true);
    seeing(passed, true);
    vi.advanceTimersByTime(999);
    seeing(passed, false);
    vi.advanceTimersByTime(1);
    seeing(read, false);

    setVisibility("hidden");
    unmount();

    const dwells = (await sent()).filter((e) => e.key === "section_dwell");
    // ちょうど 1 秒は残す側に倒す。境界をどちらに倒すかを固定しておく。
    expect(dwells.map((d) => d.payload.sectionId)).toEqual(["sec_conclusion"]);
    expect(dwells[0].payload).toMatchObject({ sectionKind: "conclusion", seconds: 1 });
  });

  it("見えたまま離れた節も、そこまでの時間を数える", async () => {
    const open = section("sec_lead");
    const { unmount } = mount();
    seeing(open, true);
    vi.advanceTimersByTime(3_400);
    setVisibility("hidden");
    unmount();

    const dwell = (await sent()).find((e) => e.key === "section_dwell");
    // 種類を名乗っていない節は導入として数える。
    expect(dwell?.payload).toMatchObject({ sectionId: "sec_lead", sectionKind: "lead", seconds: 3 });
  });

  it("見え終わりだけが来た節は、時間を作らない", async () => {
    const el = section("sec_related", "related");
    const { unmount } = mount();
    // 見え始めを受け取っていないのに時間を足すと、開いた瞬間から見ていたことになる。
    seeing(el, false);
    vi.advanceTimersByTime(5_000);
    setVisibility("hidden");
    unmount();

    expect((await sent()).filter((e) => e.key === "section_dwell")).toEqual([]);
  });

  it("節と名乗っていない要素は、観測の通知が来ても無視する", async () => {
    section("sec_lead", "lead");
    const stranger = document.createElement("div");
    document.body.appendChild(stranger);

    const { unmount } = mount();
    seeing(stranger, true);
    vi.advanceTimersByTime(2_000);
    seeing(stranger, false);
    setVisibility("hidden");
    unmount();

    expect((await sent()).filter((e) => e.key === "section_dwell")).toEqual([]);
  });

  it("節が 1 つも無い記事では、観測そのものを始めない", async () => {
    const { unmount } = mount();
    expect(FakeObserver.last).toBeNull();
    unmount();
    expect(keysOf(await sent())).toEqual(["page_view"]);
  });

  it("観測の仕組みが無い環境でも、ほかの計測は動き続ける", async () => {
    section("sec_lead", "lead");
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;

    const { unmount } = mount();
    click(marked({ "data-tel-kind": "cta_button", "data-tel-id": "cta_1" }));
    unmount();

    expect(keysOf(await sent())).toEqual(["page_view", "element_click"]);
  });

  it("画面を離れたら観測をやめる", async () => {
    section("sec_lead", "lead");
    const { unmount } = mount();
    const observer = FakeObserver.last;
    expect(observer?.observed).toHaveLength(1);
    unmount();
    // 付けっぱなしにすると、別の記事へ移った後も前の記事の時間が積もる。
    expect(observer?.disconnected).toBe(true);
  });
});

describe("送り方", () => {
  it("読む体験を止めないよう、たまってから送る", async () => {
    const { unmount } = mount();
    for (let i = 0; i < 18; i += 1) {
      click(marked({ "data-tel-kind": "cta_button", "data-tel-id": `cta_${i}` }));
    }
    // 19 件では、まだ 1 通も出ていない。
    expect(await batches()).toEqual([]);

    click(marked({ "data-tel-kind": "cta_button", "data-tel-id": "cta_18" }));
    const all = await batches();
    expect(all).toHaveLength(1);
    expect(all[0].events).toHaveLength(20);
    unmount();
  });

  it("たまっていなくても、一定時間で送る", async () => {
    const { unmount } = mount();
    expect(await batches()).toEqual([]);
    vi.advanceTimersByTime(15_000);
    expect(keysOf(await sent())).toEqual(["page_view"]);

    // 空のまま時間が来ても、空の通信は起こさない。
    vi.advanceTimersByTime(15_000);
    expect(await batches()).toHaveLength(1);
    unmount();
  });

  it("離れるときは、離脱を妨げない送り方を使う", async () => {
    stubBeacon(true);
    const { unmount } = mount();
    click(marked({ "data-tel-kind": "affiliate_link", "data-tel-id": "lk_1" }));

    const beacon = navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>;
    expect(keysOf(await sent())).toEqual(["page_view", "affiliate_click"]);
    // 成果リンクは押した直後に離脱する。待たせる送り方にすると、そのぶん取りこぼす。
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(typeof beacon).toBe("function");
    unmount();
  });

  it("送り先を指定できる（既定は共通の受け口）", async () => {
    const { unmount } = mount({ endpoint: "/api/telemetry/preview" });
    unmount();
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0][0]).toBe("/api/telemetry/preview");
  });

  it("送信が失敗しても、読者側では何も起きない", async () => {
    stubFetch(() => Promise.reject(new Error("network down")));
    const { unmount } = mount();
    expect(() => unmount()).not.toThrow();
    // 失敗したこと自体は記録に残らない。記事の表示はこの成否と関係ない。
    expect(keysOf(await sent())).toEqual(["page_view"]);
  });

  it("送信の仕組みごと使えなくても、画面は壊れない", async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error("fetch is blocked");
    }) as unknown as typeof fetch;
    const { unmount } = mount();
    expect(() => unmount()).not.toThrow();
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
