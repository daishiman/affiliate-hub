import { describe, expect, it } from "vitest";
import {
  type LinkIngestion,
  createLinkIngestion,
  findDuplicate,
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
      "printer.local",
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
      existing: [first],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // 捨てずに残っていること。「送ったのに無い」を起こさない。
    expect(built.value.id).toBe("li_2");
    expect(built.value.duplicateOf).toBe("li_1");
    expect(built.value.state).toBe("received");
  });

  it("対象外にしたものは重複の相手にしない", () => {
    const first = received("https://example.invalid/p", "li_1");
    const rejected = rejectIngestion(first, "提携終了のため");
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(findDuplicate([rejected.value], first.normalizedUrl)).toBeNull();
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
