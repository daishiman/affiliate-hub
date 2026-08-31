/**
 * @tier 2
 * @req REQ-P02, REQ-A07
 * @types permission-matrix, idempotency, equivalence, boundary
 *
 * 保存する前に、その URL が何かを見せる。**書かない。**
 *
 * --- ここで固定すること ---
 *
 *   1. 取得に行く前に権限を見る（外へ出てから断らない）。
 *   2. 取得できなかったときも 9 項目の形は崩さない。画面が空にならない。
 *   3. 既に持っている候補（受信箱・登録済み）を、URL・正規URL・商品名の
 *      3 つの手がかりで挙げる。**どれか 1 つでも当たれば挙げる。**
 *   4. 候補が無ければ、取得した内容をそのまま返す（勝手に印を付けない）。
 *   5. 保存先が読めなければ、成功にしない。
 *
 * --- なぜテストを足したか（2026-08-30）---
 *
 * ミューテーション 28.2%。生き残り 61 件のうち 27 件が `ConditionalExpression` で、
 * `NoCoverage` 13 件は全部 `failurePreview` の中だった。テストは 2 本あったが
 * **どちらも「重複あり」の道しか歩いていなかった。**
 * 分岐の反対側と、取得失敗時の見た目が、誰にも見られていなかった。
 */
import { describe, expect, it, vi } from "vitest";
import type {
  AffiliateLinkWithSnapshot,
  AffiliatePreviewFetcherPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "@/application/ports/monetization";
import { createPreviewAffiliateUrlUseCase } from "@/application/usecases/monetization/preview-affiliate-url";
import type { AffiliateLink, AffiliatePreview, LinkIngestion } from "@/domain/monetization";
import type { AffiliateLinkId, LinkIngestionId, WorkspaceId } from "@/domain/shared";
import { domainError, err, markCommercial, ok, taggedString } from "@/domain/shared";
import { WORKSPACE, aNobody, anOwner } from "../support/actors";

const WS = WORKSPACE;
const RAW = "https://example.invalid/asp/amazon/p_alpha_15";
/** `RAW` の正規化後。`normalizeAffiliateUrl` は末尾スラッシュと計測用の値を落とす。 */
const RAW_NORMALIZED = "https://example.invalid/asp/amazon/p_alpha_15";
const CANONICAL = "https://example.invalid/p/alpha-studio-15";

const PREVIEW: AffiliatePreview = {
  rawUrl: RAW,
  canonicalUrl: CANONICAL,
  productName: "Alpha Studio 15",
  merchantName: "Alpha",
  oneLine: null,
  imageUrl: null,
  price: null,
  currency: null,
  retrievedAt: "2026-08-29T12:00:00.000Z",
  sourceHost: "example.invalid",
  method: "open-graph",
  status: "partial",
  reason: null,
  duplicateCandidates: [],
  providerId: "fixture",
  providerLabel: "Fixture",
};

/**
 * 受信箱の 1 行。**`normalizedUrl` だけが重複判定に使われる**ので、
 * 表示用の `submittedUrl` はわざと別の形にしてある。
 * 片方を取り違えたら候補が挙がらなくなることを、この形が見張る。
 */
function anIngestion(id: string, normalizedUrl: string): LinkIngestion {
  return {
    id: taggedString<"LinkIngestionId">(id) as LinkIngestionId,
    workspaceId: WS,
    submittedUrl: `${normalizedUrl}?utm_source=mail`,
    normalizedUrl,
    source: "paste",
    submittedAt: new Date("2026-08-01T00:00:00Z"),
    state: "received",
    programId: null,
    productId: null,
    duplicateOf: null,
    note: null,
    rejectedReason: null,
  };
}

function aLinkRow(id: string, originalUrl: string, productName: string): AffiliateLinkWithSnapshot {
  const link = {
    id: taggedString<"AffiliateLinkId">(id) as AffiliateLinkId,
    workspaceId: WS,
    programId: taggedString<"AffiliateProgramId">("prg_amazon_pc"),
    originalUrl,
    trackingRef: `ref_${id}`,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    expiresAt: null,
    disabledAt: null,
  } as unknown as AffiliateLink;
  return { link, snapshot: { productName, brand: "Alpha", oneLine: null } };
}

type Fail = { readonly inbox?: boolean; readonly links?: boolean };

/** 覚えているだけの保存先。**書き込みの口は呼ばれたら落とす。** */
function ports(
  inboxRows: readonly LinkIngestion[],
  linkRows: readonly AffiliateLinkWithSnapshot[],
  fail: Fail = {},
) {
  const listCalls: unknown[][] = [];
  const inbox = markCommercial({
    async list(workspaceId: WorkspaceId, filter: unknown, page: unknown) {
      listCalls.push([workspaceId, filter, page]);
      if (fail.inbox === true) {
        return err(domainError("CONFLICT", "受信箱が読めません。", { field: "inbox" }));
      }
      return ok({ items: inboxRows, nextCursor: null });
    },
    async findById() {
      return ok(null);
    },
    async claimNormalizedUrl() {
      throw new Error("プレビューは書かない。");
    },
    async save() {
      throw new Error("プレビューは書かない。");
    },
  }) as unknown as CommercialLinkIngestionRepositoryPort;

  const links = markCommercial({
    async listWithSnapshot() {
      if (fail.links === true) {
        return err(domainError("CONFLICT", "リンクが読めません。", { field: "links" }));
      }
      return ok(linkRows);
    },
    async findById() {
      return ok(null);
    },
    async findUsableByOriginalUrl() {
      return ok(null);
    },
    async listByProduct() {
      return ok([]);
    },
    async listNeedingAttention() {
      return ok([]);
    },
    async save() {
      throw new Error("プレビューは書かない。");
    },
    async disable() {
      throw new Error("プレビューは書かない。");
    },
  }) as unknown as CommercialAffiliateLinkRepositoryPort;

  return { inbox, links, listCalls };
}

function subject(
  fetcher: AffiliatePreviewFetcherPort,
  inboxRows: readonly LinkIngestion[] = [],
  linkRows: readonly AffiliateLinkWithSnapshot[] = [],
  fail: Fail = {},
) {
  const p = ports(inboxRows, linkRows, fail);
  return { use: createPreviewAffiliateUrlUseCase({ fetcher, inbox: p.inbox, links: p.links }), ...p };
}

const okFetcher = (preview: AffiliatePreview = PREVIEW): AffiliatePreviewFetcherPort => ({
  retrieve: async () => ({ kind: "ok", preview }),
});

async function run(
  fetcher: AffiliatePreviewFetcherPort,
  inboxRows: readonly LinkIngestion[] = [],
  linkRows: readonly AffiliateLinkWithSnapshot[] = [],
  fail: Fail = {},
) {
  const s = subject(fetcher, inboxRows, linkRows, fail);
  const result = await s.use.execute(anOwner({ workspaceId: WS }), { rawUrl: RAW });
  return { result, ...s };
}

describe("取得の前に権限を見る", () => {
  it("権限が無いとき、外へ 1 度も出ない", async () => {
    const retrieve = vi.fn(async () => ({ kind: "ok" as const, preview: PREVIEW }));
    const s = subject({ retrieve });
    const result = await s.use.execute(aNobody({ workspaceId: WS }), { rawUrl: RAW });

    expect(result.ok).toBe(false);
    /*
      断ってから出るのではなく、出る前に断る。順序が逆だと、権限の無い相手が
      こちらのサーバー経由で任意の URL を叩ける踏み台になる。
    */
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("取得できなかったとき", () => {
  it.each([
    ["rejected" as const, "この ASP は許可していません。"],
    ["failed" as const, "相手のサーバーが応答しません。"],
  ])("%s でも 9 項目の形は崩れない", async (kind, reason) => {
    const { result } = await run({ retrieve: async () => ({ kind, reason }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.value.preview;

    expect(p.status).toBe(kind);
    expect(p.reason).toBe(reason);
    /*
      **空にせず、埋めもしない。** 画面は「取れなかった」と言えなければならず、
      同時に、取れていない値を取れたことにしてもいけない。
    */
    expect(p.rawUrl).toBe(RAW);
    expect(p.canonicalUrl).toBeNull();
    expect(p.productName).toBeNull();
    expect(p.merchantName).toBeNull();
    expect(p.oneLine).toBeNull();
    expect(p.imageUrl).toBeNull();
    expect(p.price).toBeNull();
    expect(p.currency).toBeNull();
    expect(p.duplicateCandidates).toEqual([]);
    expect(p.method).toBe("manual");
    expect(p.providerId).toBe("manual");
    expect(p.providerLabel).toBe("手入力");
    // 取得できていないので「いつ取ったか」は名乗れない。
    expect(p.retrievedAt).toBe(new Date(0).toISOString());
  });

  it("読み取れた URL からは、どこ宛だったかを残す", async () => {
    const { result } = await run({ retrieve: async () => ({ kind: "failed", reason: "時間切れ" }) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.sourceHost).toBe("example.invalid");
  });

  it("URL として読み取れないときは、宛先を名乗らない", async () => {
    const s = subject({ retrieve: async () => ({ kind: "rejected", reason: "形式が違います。" }) });
    const result = await s.use.execute(anOwner({ workspaceId: WS }), { rawUrl: "これはURLではない" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      壊れた文字列から host を作り話にしない。`—` は「無い」であって
      「空文字の host」ではない。画面がそこをリンクにできないようにするため。
    */
    expect(result.value.preview.sourceHost).toBe("—");
    expect(result.value.preview.rawUrl).toBe("これはURLではない");
  });

  it("取得に失敗したら、保存先を見に行かない", async () => {
    const { listCalls } = await run({ retrieve: async () => ({ kind: "failed", reason: "時間切れ" }) });
    expect(listCalls).toHaveLength(0);
  });
});

describe("重複が無いとき", () => {
  it("取得した内容に手を入れず、そのまま返す", async () => {
    const { result } = await run(okFetcher());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      **同一物であること**を見る。項目ごとに比べると、
      「印だけ付けて中身は同じ」を素通しできてしまう。
    */
    expect(result.value.preview).toBe(PREVIEW);
    expect(result.value.preview.status).toBe("partial");
    expect(result.value.preview.reason).toBeNull();
  });

  it("受信箱は、状態で絞らず先頭 100 件を見る", async () => {
    const { listCalls } = await run(okFetcher());
    expect(listCalls).toEqual([[WS, { state: null }, { limit: 100, cursor: null }]]);
  });

  it("似ているだけの URL は候補にしない", async () => {
    const { result } = await run(okFetcher(), [anIngestion("lin_other", `${RAW_NORMALIZED}-pro`)], [
      aLinkRow("lnk_other", `${RAW}/accessories`, "Beta Studio 13"),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual([]);
  });
});

describe("重複を挙げる 3 つの手がかり", () => {
  it("受信箱の URL が同じとき", async () => {
    const { result } = await run(okFetcher(), [anIngestion("lin_same", RAW_NORMALIZED)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["inbox:lin_same"]);
    expect(result.value.preview.status).toBe("duplicate");
    /*
      文面を固定する。**この一文が「なぜ止まっているか」の説明の全部**なので、
      空にしても検査が通る状態だと、画面から理由が消えたことに誰も気づけない。
    */
    expect(result.value.preview.reason).toBe(
      "同じURL、正規URL、または商品名の登録候補があります。新規登録前に確認してください。",
    );
  });

  it("受信箱の URL が、正規 URL と同じとき", async () => {
    const { result } = await run(okFetcher(), [anIngestion("lin_canon", CANONICAL)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["inbox:lin_canon"]);
  });

  it("登録済みリンクの URL が同じとき", async () => {
    const { result } = await run(okFetcher(), [], [aLinkRow("lnk_same", RAW, "全く違う名前")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["link:lnk_same"]);
  });

  it("登録済みリンクの URL が、正規 URL と同じとき", async () => {
    const { result } = await run(okFetcher(), [], [aLinkRow("lnk_canon", CANONICAL, "全く違う名前")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["link:lnk_canon"]);
  });

  it("正規 URL が無いとき、正規 URL 側の照合で拾わない", async () => {
    const { result } = await run(
      okFetcher({ ...PREVIEW, canonicalUrl: null, productName: null }),
      [anIngestion("lin_canon", CANONICAL)],
      [aLinkRow("lnk_canon", CANONICAL, "Alpha Studio 15")],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      `null` を手がかりとして使わない。使うと「正規 URL が取れなかった相手」同士が
      全部お互いの重複になり、候補欄が意味を失う。
    */
    expect(result.value.preview.duplicateCandidates).toEqual([]);
  });

  it("同じ相手を、2 つの手がかりが当たっても 1 度しか挙げない", async () => {
    const { result } = await run(okFetcher(), [], [aLinkRow("lnk_both", RAW, "Alpha Studio 15")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["link:lnk_both"]);
  });

  it("受信箱と登録済みの両方から挙げる", async () => {
    const { result } = await run(
      okFetcher(),
      [anIngestion("lin_a", RAW_NORMALIZED)],
      [aLinkRow("lnk_b", CANONICAL, "全く違う名前")],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.value.preview.duplicateCandidates)).toEqual(
      new Set(["inbox:lin_a", "link:lnk_b"]),
    );
  });

});

/**
 * **ここが 3 つ目の手がかりで、唯一「判断」が入る場所。**
 *
 * URL の一致は機械的だが、商品名の一致は範囲を決めなければならない。
 * 決めた方針: **多く挙げる側に倒す。** 候補欄は保存を止めるものではなく
 * 人が確定前に見る一覧なので、誤検出は 1 行余計に読むだけで済む。
 * 見逃すと同じ商品が二重登録され、成果が 2 本に割れて誰も気づかない。
 *
 * URL はどのテストでも一致しない値にしてある。**商品名だけで挙がった**ことを
 * 見るため。URL が当たっていると、名前の規則を壊しても緑のままになる。
 */
describe("商品名で挙げる範囲", () => {
  const OTHER_URL = "https://example.invalid/asp/rakuten/zzz";

  it.each([
    ["前後の空白", "  Alpha Studio 15  "],
    ["大文字小文字", "ALPHA STUDIO 15"],
    ["全角英数と全角スペース", "Ａｌｐｈａ　Ｓｔｕｄｉｏ１５"],
    ["語中の空白の有無", "AlphaStudio15"],
    ["組み合わせ", " ＡＬＰＨＡstudio　１５ "],
  ])("%s が違うだけなら、同じ商品として挙げる", async (_name, saved) => {
    const { result } = await run(okFetcher(), [], [aLinkRow("lnk_variant", OTHER_URL, saved)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual(["link:lnk_variant"]);
  });

  it("文字そのものが違えば、別の商品として扱う", async () => {
    const { result } = await run(okFetcher(), [], [aLinkRow("lnk_other", OTHER_URL, "Alpha Studio 14")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      広げるのは表記の揺れまで。**型番が 1 文字違うものを同じにはしない。**
      ここまで寄せると「全部が全部の重複」になり、候補欄が読まれなくなる。
    */
    expect(result.value.preview.duplicateCandidates).toEqual([]);
  });

  it.each([
    ["取得できなかったとき", null],
    ["空文字だったとき", ""],
    ["空白しか無かったとき", "　 "],
  ])("こちらの商品名が %s は、名前を手がかりにしない", async (_name, productName) => {
    const { result } = await run(
      okFetcher({ ...PREVIEW, canonicalUrl: null, productName }),
      [],
      [aLinkRow("lnk_a", OTHER_URL, ""), aLinkRow("lnk_b", `${OTHER_URL}/2`, "  ")],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
      **名前が分からない者同士を結ばない。** 結ぶと、名前を取れなかった相手が
      全部お互いの重複として並び、一覧が「毎回全部出る欄」になって読まれなくなる。
    */
    expect(result.value.preview.duplicateCandidates).toEqual([]);
  });

  it("相手の商品名が空でも、こちらの名前と結びつけない", async () => {
    const { result } = await run(
      okFetcher({ ...PREVIEW, canonicalUrl: null }),
      [],
      [aLinkRow("lnk_blank", OTHER_URL, "   ")],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.duplicateCandidates).toEqual([]);
  });
});

describe("保存先が読めないとき", () => {
  it.each([
    ["受信箱", { inbox: true }],
    ["登録済みリンク", { links: true }],
  ])("%s が読めなければ、成功にしない", async (_name, fail) => {
    const { result } = await run(okFetcher(), [], [], fail);
    /*
      **読めなかったことを「重複なし」にしない。** 0 件と「数えられなかった」を
      同じ返事にすると、既にある商品をもう 1 本登録してしまう。
    */
    expect(result.ok).toBe(false);
  });
});

describe("繋ぎ先の取り違えを、作る時点で止める", () => {
  it.each([
    ["受信箱", "inbox" as const],
    ["登録済みリンク", "links" as const],
  ])("%s が Commercial の保存先でなければ作らせない", (_name, key) => {
    const p = ports([], []);
    /*
      `markCommercial` の印は enumerable: false なので、展開すると落ちる。
      **印だけ剥がした同じ形**を渡すのが、取り違えの実際の起き方に一番近い。
    */
    const plain = { ...p[key] } as never;

    expect(() =>
      createPreviewAffiliateUrlUseCase({ fetcher: okFetcher(), inbox: p.inbox, links: p.links, [key]: plain }),
    ).toThrow("プレビューの重複照合は Commercial の保存先に限定します。");
  });
});
