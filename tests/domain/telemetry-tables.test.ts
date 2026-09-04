/**
 * @tier 1
 * @req REQ-TM01, REQ-TM04, REQ-TM07, REQ-TM09
 * @types decision-table, equivalence, boundary, tenant-isolation
 *
 * 計測の 2 つの一覧を、**全行に**当てる。
 *   1. 計測できることの一覧（12 件）
 *   2. 記録してはいけない項目の一覧（17 語）
 *
 * ここを足した理由。どちらの一覧も、名指しされていた行がごく一部だった。
 * `search_performed` と `filter_changed` は**テストのどこにも出てこず**、
 * 表から丸ごと消しても 3810 件すべてが緑のまま通った（実測）。
 * 禁止語 17 のうち、実際に送って落ちることを確かめてあったのは 3 語だけで、
 * 残りは消しても誰も気づかなかった。
 *
 * 期待値は**手で書き写す**。表を回して当てるだけだと、行を 1 つ消したときに
 * 繰り返しが 1 周短くなるだけで緑になる（回している数と、当てている中身は別）。
 */
import { describe, expect, it } from "vitest";
import {
  TELEMETRY_EVENT_KEYS,
  type TelemetryEventKey,
  assertNoForbiddenField,
  buildTelemetryEvent,
  isRetentionExpired,
  readerKeyScope,
  requiresConsent,
} from "@/domain/analytics";

const AT = new Date("2026-08-19T00:00:00.000Z");

type Spec = {
  /** 同意が要らないか。要らない側を増やすときは、ここも直させる。 */
  readonly consentFree: boolean;
  /** 欠けたら落ちる項目。省略できる欄は書かない。 */
  readonly required: readonly string[];
  /** 数字で渡す欄（文字を入れると落ちる側）。 */
  readonly numbers?: readonly string[];
  readonly booleans?: readonly string[];
};

/**
 * 計測できることの全一覧（仕様 §計測）。並び順まで含めて手で書き写した。
 *
 * `siteSlug` はどのイベントにもあるが、**省略せずに 1 行ずつ書く**。
 * 「共通のものは別で当てる」にすると、その別の検査が消えた日に
 * どのイベントからも見られなくなる。
 */
const EXPECTED: Readonly<Record<TelemetryEventKey, Spec>> = {
  page_view: { consentFree: true, required: ["path", "siteSlug", "referrerKind"] },
  scroll_depth: {
    consentFree: false,
    required: ["path", "siteSlug", "percent"],
    numbers: ["percent"],
  },
  section_dwell: {
    consentFree: false,
    required: ["path", "siteSlug", "sectionId", "sectionKind", "seconds"],
    numbers: ["seconds"],
  },
  element_click: {
    consentFree: false,
    required: ["path", "siteSlug", "elementKind", "elementId"],
  },
  ranking_row_click: {
    consentFree: false,
    required: ["path", "siteSlug", "productId", "rank"],
    numbers: ["rank"],
  },
  affiliate_click: {
    consentFree: true,
    required: ["path", "siteSlug", "linkId", "placement", "recordedVia"],
  },
  internal_link_click: {
    consentFree: false,
    required: ["path", "siteSlug", "toPath", "placement"],
  },
  search_performed: {
    consentFree: false,
    required: ["siteSlug", "query", "resultCount"],
    numbers: ["resultCount"],
  },
  filter_changed: { consentFree: false, required: ["path", "siteSlug", "axis", "value"] },
  page_exit: {
    consentFree: false,
    required: ["path", "siteSlug", "percent", "seconds"],
    numbers: ["percent", "seconds"],
  },
  ai_model_usage: {
    consentFree: true,
    required: [
      "workspaceId",
      "actorId",
      "modelId",
      "provider",
      "usecase",
      "inputTokens",
      "outputTokens",
      "durationMs",
      "success",
      "estimatedCostJpy",
    ],
    numbers: ["inputTokens", "outputTokens", "durationMs", "estimatedCostJpy"],
    booleans: ["success"],
  },
  variant_exposure: { consentFree: true, required: ["path", "siteSlug", "variantSpecId"] },
};

/** 一覧の並び。実装から作らない。 */
const EXPECTED_KEYS: readonly TelemetryEventKey[] = [
  "page_view",
  "scroll_depth",
  "section_dwell",
  "element_click",
  "ranking_row_click",
  "affiliate_click",
  "internal_link_click",
  "search_performed",
  "filter_changed",
  "page_exit",
  "ai_model_usage",
  "variant_exposure",
];

/** 記録してはいけない項目（仕様 §計測に入れないもの）。17 語を手で書き写した。 */
const FORBIDDEN: readonly string[] = [
  "ip",
  "ipAddress",
  "remoteAddr",
  "latitude",
  "longitude",
  "geo",
  "email",
  "phone",
  "password",
  "token",
  "apiKey",
  "prompt",
  "promptText",
  "completion",
  "generatedText",
  "content",
  "body",
];

function payloadFor(key: TelemetryEventKey): Record<string, unknown> {
  const spec = EXPECTED[key];
  const out: Record<string, unknown> = {};
  for (const name of spec.required) {
    if (spec.numbers?.includes(name)) out[name] = 1;
    else if (spec.booleans?.includes(name)) out[name] = true;
    else out[name] = "x";
  }
  return out;
}

describe("計測できることの一覧", () => {
  it("数を先に見る（12 件、並び順まで表と合う）", () => {
    expect(TELEMETRY_EVENT_KEYS).toEqual(EXPECTED_KEYS);
    expect(TELEMETRY_EVENT_KEYS).toHaveLength(12);
  });

  it.each(EXPECTED_KEYS)("%s は、必須が揃っていれば通る", (key) => {
    const r = buildTelemetryEvent({
      key,
      occurredAt: AT,
      readerKey: null,
      payload: payloadFor(key),
    });
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });

  it.each(EXPECTED_KEYS)("%s は、必須の欄を 1 つ落とすと、その欄の名前で落ちる", (key) => {
    /*
     * **1 欄ずつ落とす。**まとめて 1 回だけ落とすと、
     * 「どれか 1 つでも必須なら緑」になり、残りを任意へ緩めても気づけない。
     */
    for (const drop of EXPECTED[key].required) {
      const payload = payloadFor(key);
      delete payload[drop];
      const r = buildTelemetryEvent({ key, occurredAt: AT, readerKey: null, payload });
      expect(r.ok, `${key} から ${drop} を落としても通りました`).toBe(false);
      if (!r.ok) expect(r.error.message).toContain(drop);
    }
  });

  it.each(EXPECTED_KEYS)("%s は、数字の欄に文字を入れると落ちる", (key) => {
    const numbers = EXPECTED[key].numbers ?? [];
    for (const name of numbers) {
      const r = buildTelemetryEvent({
        key,
        occurredAt: AT,
        readerKey: null,
        payload: { ...payloadFor(key), [name]: "1" },
      });
      expect(r.ok, `${key} の ${name} に文字を入れても通りました`).toBe(false);
    }
  });

  it("同意が要らないイベントは、この 4 つだけ", () => {
    /*
     * **増える側を見張る。**同意なしで測れるものが 1 つ増えると、
     * 断った読者からも取れるものが 1 つ増える。
     * ここを一覧から作ると、増やしたときに黙って通る。
     */
    const free = EXPECTED_KEYS.filter((k) => !requiresConsent(k));
    expect(free).toEqual(["page_view", "affiliate_click", "ai_model_usage", "variant_exposure"]);
    // 表の側の宣言とも一致していること（片方だけ直して緑にできないように）。
    for (const key of EXPECTED_KEYS) {
      expect(requiresConsent(key), `${key} の同意区分が表と違います`).toBe(
        !EXPECTED[key].consentFree,
      );
    }
  });
});

describe("記録してはいけない項目", () => {
  it("数を先に見る（17 語）", () => {
    expect(FORBIDDEN).toHaveLength(17);
    expect(new Set(FORBIDDEN).size).toBe(17);
  });

  /*
   * この 3 件は `buildTelemetryEvent` ごしに見ていたが、2026-08-21 に
   * **禁止語の判定そのもの（`assertNoForbiddenField`）へ直に当てる形へ移した。**
   *
   * 同日、入口が「登録表に無い項目」も落とすようになった
   * （`editorNote` のような名前で生成文を持ち込めた穴を塞いだ。
   * `tests/domain/zz-probe-forbidden.test.ts`）。入口ごしのままだと、
   * 禁止語はどれも**表に無い項目としても落ちる**ので、
   * 上の 2 件は名前が何であれ赤にならず、**禁止の一覧が飾りになっても緑**になる。
   * 3 件目に至っては、落ちる理由が変わったせいで赤くなっていた。
   * 見たいのは入口の総合判定ではなく**禁止語の一覧の精度**なので、そこへ直に当てる。
   */
  it.each(FORBIDDEN)("%s が混ざっていたら、イベントごと落ちる", (word) => {
    const r = assertNoForbiddenField({ ...payloadFor("page_view"), [word]: "値" });
    expect(r.ok, `${word} が通ってしまいました`).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(word);
  });

  it("大文字小文字を変えても抜けられない", () => {
    // `IP` や `Email` で通ると、禁止の一覧が飾りになる。
    for (const word of ["IP", "Email", "ApiKey", "PROMPT"]) {
      const r = assertNoForbiddenField({ ...payloadFor("page_view"), [word]: "値" });
      expect(r.ok, `${word} が通ってしまいました`).toBe(false);
    }
  });

  it("似ているだけの欄は通る（何でも落とすのでは使えない）", () => {
    // `bodyText` を落とすと、記事の欄が 1 つも送れなくなる。
    // 完全一致でだけ落ちることを固定しておく。
    const r = assertNoForbiddenField({
      ...payloadFor("page_view"),
      bodyLength: 120,
      tokenCount: 3,
    });
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });
});

describe("消えるまでの日数の端", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const AT2 = new Date("2026-01-01T00:00:00.000Z");

  /*
   * **日数を輸入せず、実数で書く。**
   * 既存の「期限を過ぎたものは期限切れと判定される」は `retentionDeadline()` から
   * 端を作っているので、90 日を 9000 日に変えても同じ側に居続ける。
   * 赤くならないのに、テストの名前だけが「期限切れ」を主張し続ける。
   * ここは 90 と 400 を直に書く。値を変えるときは 2 か所直させる。
   */
  it("詳しい記録は 90 日ちょうどで消える（その 1 ミリ秒手前は残る）", () => {
    expect(isRetentionExpired("scroll_depth", AT2, new Date(AT2.getTime() + 90 * DAY - 1))).toBe(
      false,
    );
    expect(isRetentionExpired("scroll_depth", AT2, new Date(AT2.getTime() + 90 * DAY))).toBe(true);
  });

  it("回数だけの記録は 400 日ちょうどで消える（その 1 ミリ秒手前は残る）", () => {
    expect(isRetentionExpired("page_view", AT2, new Date(AT2.getTime() + 400 * DAY - 1))).toBe(
      false,
    );
    expect(isRetentionExpired("page_view", AT2, new Date(AT2.getTime() + 400 * DAY))).toBe(true);
  });

  it("89 日目に詳しい記録を消さない（短くしすぎていない）", () => {
    expect(isRetentionExpired("scroll_depth", AT2, new Date(AT2.getTime() + 89 * DAY))).toBe(false);
  });

  it("詳しい記録のほうが先に消える", () => {
    // 逆転すると、個人に近い記録のほうが長く残る。
    const t = new Date(AT2.getTime() + 100 * DAY);
    expect(isRetentionExpired("scroll_depth", AT2, t)).toBe(true);
    expect(isRetentionExpired("page_view", AT2, t)).toBe(false);
  });
});

describe("読者の仮の目印は、ブログをまたがない", () => {
  const AT3 = new Date("2026-08-17T10:00:00.000Z");

  it("同じ日でも、ブログが違えば別のものになる", () => {
    expect(readerKeyScope("blog-a", AT3)).not.toBe(readerKeyScope("blog-b", AT3));
  });

  it("ブログの名前が目印に残っている（取り違えたら気づける）", () => {
    expect(readerKeyScope("blog-a", AT3)).toContain("blog-a");
    expect(readerKeyScope("blog-a", AT3)).not.toContain("blog-b");
  });

  it("日をまたぐと別のものになる（消せない目印を配らない）", () => {
    const before = readerKeyScope("demo", new Date("2026-08-17T23:59:59.999Z"));
    const after = readerKeyScope("demo", new Date("2026-08-18T00:00:00.000Z"));
    expect(before).not.toBe(after);
    // 同じ日のうちは変わらない（毎回変わると、回数すら数えられない）。
    expect(readerKeyScope("demo", new Date("2026-08-17T00:00:00.000Z"))).toBe(
      readerKeyScope("demo", new Date("2026-08-17T23:59:59.999Z")),
    );
  });
});
