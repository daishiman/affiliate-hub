/**
 * @tier 1
 * @req REQ-A01, REQ-P02
 * @types equivalence, boundary, state-transition, ssrf
 *
 * 受け入れ条件 §30.1（URL 登録）の中身は、ここで確かめている。
 *
 * `tests/acceptance/acceptance-criteria.test.ts` §30.1 は、同じことを
 * **入口（ツールカタログ）から 1 本通す**ための検査で、
 * 入力の分かれ目を網羅する場所ではない。あちらは 5 個の悪い URL を通すだけで、
 * 172.16.0.1 と 172.31.255.255 のような**端**は見ていない。
 * 受け入れ条件が本当に守られているかは、入口の 1 本ではなく
 * この分かれ目の一覧で決まる。
 *
 * `ssrf` の印を付けたのは「内部ネットワーク宛は受け取らない」の節があるため。
 * 2026-08-18 に性質 `has-user-supplied-url` を語彙へ足したので、この印は
 * REQ-A01 と REQ-P02 の両方から**要求されるようになった**（外すと落ちる）。
 *
 * REQ-P02（URL 受信箱）をここへ足したのは、受信箱の実装がこのファイルが
 * 見ている `link-ingestion.ts` そのもので、内部宛先の拒否・正規化・重複検出・
 * 4 状態の遷移がすべてここにあるためである。印だけが欠けていた。
 */
import { describe, expect, it } from "vitest";
import {
  type LinkIngestion,
  createLinkIngestion,
  isInternalHost,
  matchProduct,
  nextActionsFor,
  normalizeAffiliateUrl,
  rejectIngestion,
  resolveProgram,
} from "@/domain/monetization";
import {
  type AffiliateProgramId,
  type LinkIngestionId,
  type ProductId,
  type WorkspaceId,
  taggedString,
} from "@/domain/shared";

const WS = taggedString<"WorkspaceId">("ws_test") as WorkspaceId;
const PRG = taggedString<"AffiliateProgramId">("prg_a") as AffiliateProgramId;
const PRD = taggedString<"ProductId">("p_a") as ProductId;

function received(url: string, id = "li_1"): LinkIngestion {
  const built = createLinkIngestion({
    id: taggedString<"LinkIngestionId">(id) as LinkIngestionId,
    workspaceId: WS,
    submittedUrl: url,
    source: "paste",
    submittedAt: new Date("2026-08-16T00:00:00Z"),
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("受け取ってよい URL かの判定", () => {
  it("http と https だけを受け取る", () => {
    expect(normalizeAffiliateUrl("https://example.invalid/a").ok).toBe(true);
    expect(normalizeAffiliateUrl("http://example.invalid/a").ok).toBe(true);
  });

  it("javascript: や file: は受け取らない", () => {
    for (const raw of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x"]) {
      const result = normalizeAffiliateUrl(raw);
      expect(result.ok, raw).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("内部ネットワーク宛は受け取らない（後で取得しに行くため）", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254", // クラウドのメタデータ
      "0.0.0.0",
      "::",
      "::1",
      "::ffff:127.0.0.1",
      "fe80::1",
      "ff02::1",
      "224.0.0.1",
      "printer.local",
      "localhost.",
      "metadata.google.internal.",
    ]) {
      expect(isInternalHost(host), host).toBe(true);
      expect(normalizeAffiliateUrl(`http://${host}/x`).ok, host).toBe(false);
    }
  });

  it("外部の似た名前は受け取る（判定を広げすぎない）", () => {
    for (const host of ["example.invalid", "172.32.0.1", "11.0.0.1", "notlocalhost.example"]) {
      expect(isInternalHost(host), host).toBe(false);
    }
  });

  it("空欄は理由つきで断る", () => {
    const result = normalizeAffiliateUrl("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("url");
  });

  it("計測用の付加情報と断片だけを落とし、並びをそろえる", () => {
    const a = normalizeAffiliateUrl("https://Example.invalid/p?b=2&a=1&utm_source=x#top");
    const b = normalizeAffiliateUrl("https://example.invalid/p?a=1&b=2&gclid=y");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value).toBe(b.value);
  });

  it("値の中の & は区切りに化けない（別のリンクを重複にしない）", () => {
    /*
      性質テスト（tests/property/normalization.property.test.ts）が見つけた反例を、
      最小の形で例として固定したもの。

      `?x=b%26y=z` は「x という 1 つの値が b&y=z」で、
      `?x=b&y=z`   は「x=b と y=z の 2 つ」。**別の URL である。**
      組み立て直すときに符号化していなかったため、両方が同じ形になり、
      片方が他方の重複として印を付けられていた。
    */
    const single = normalizeAffiliateUrl("https://example.invalid/p?x=b%26y%3Dz");
    const pair = normalizeAffiliateUrl("https://example.invalid/p?x=b&y=z");
    expect(single.ok && pair.ok).toBe(true);
    if (single.ok && pair.ok) expect(single.value).not.toBe(pair.value);
  });

  it("受け取った URL は改変せずそのまま持つ", () => {
    const item = received("https://example.invalid/p?utm_source=slack#top");
    expect(item.submittedUrl).toBe("https://example.invalid/p?utm_source=slack#top");
    expect(item.normalizedUrl).not.toBe(item.submittedUrl);
  });
});

describe("重複", () => {
  it("同じ形の URL は重複として印を付ける（捨てない）", () => {
    const first = received("https://example.invalid/p?utm_source=a", "li_1");
    const built = createLinkIngestion({
      id: taggedString<"LinkIngestionId">("li_2") as LinkIngestionId,
      workspaceId: WS,
      submittedUrl: "https://example.invalid/p?utm_source=b",
      source: "csv",
      submittedAt: new Date("2026-08-16T01:00:00Z"),
      duplicateOf: first.id,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // 捨てずに残っていること。「送ったのに無い」を起こさない。
    expect(built.value.id).toBe("li_2");
    expect(built.value.duplicateOf).toBe("li_1");
    expect(built.value.state).toBe("received");
  });
});

describe("受信箱の 4 状態", () => {
  it("received → resolved → matched と進む", () => {
    const item = received("https://example.invalid/p");
    expect(item.state).toBe("received");

    const resolved = resolveProgram(item, PRG);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.state).toBe("resolved");
    expect(resolved.value.programId).toBe(PRG);

    const matched = matchProduct(resolved.value, PRD);
    expect(matched.ok).toBe(true);
    if (!matched.ok) return;
    expect(matched.value.state).toBe("matched");
    expect(matched.value.productId).toBe(PRD);
  });

  it("広告主が分からないまま商品へ結びつけられない", () => {
    const result = matchProduct(received("https://example.invalid/p"), PRD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVARIANT_VIOLATED");
    expect(result.error.suggestedAction).not.toBe(undefined);
  });

  it("対象外にした後は、そのままでは進められない", () => {
    const rejected = rejectIngestion(received("https://example.invalid/p"), "提携終了");
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(resolveProgram(rejected.value, PRG).ok).toBe(false);
    expect(matchProduct(rejected.value, PRD).ok).toBe(false);
  });

  it("対象外にする理由は空欄にできない", () => {
    const result = rejectIngestion(received("https://example.invalid/p"), "  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("reason");
  });

  it("次にできることが状態ごとに決まっている", () => {
    const item = received("https://example.invalid/p");
    expect(nextActionsFor(item)).toEqual(["resolved", "rejected"]);

    const resolved = resolveProgram(item, PRG);
    if (!resolved.ok) throw new Error("前提が崩れています");
    expect(nextActionsFor(resolved.value)).toEqual(["matched", "rejected"]);

    const matched = matchProduct(resolved.value, PRD);
    if (!matched.ok) throw new Error("前提が崩れています");
    expect(nextActionsFor(matched.value)).toEqual(["rejected"]);

    const rejected = rejectIngestion(item, "提携終了");
    if (!rejected.ok) throw new Error("前提が崩れています");
    expect(nextActionsFor(rejected.value)).toEqual([]);
  });
});
