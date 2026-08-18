/**
 * @tier 1
 * @req REQ-E09, REQ-E10, REQ-E11, REQ-E15, REQ-E16
 * @types equivalence, boundary, secrets
 */
import { describe, expect, it } from "vitest";
import { createChannelConnection, isConnectionUsable } from "@/domain/distribution";
import { createAffiliateAccount, createAffiliateProgram } from "@/domain/monetization";
import { createIdentityKey, createProduct, createProductVariant } from "@/domain/product";
import { createProvenance } from "@/domain/shared";
import {
  type AffiliateAccountId,
  type ProductVariantId,
  asAffiliateProgramId,
  asChannelConnectionId,
  asProductId,
  asWorkspaceId,
} from "@/domain/shared/ids";
import { taggedString } from "@/domain/shared/tagged";

const asAffiliateAccountId = (v: string): AffiliateAccountId =>
  taggedString<"AffiliateAccountId">(v);
const asProductVariantId = (v: string): ProductVariantId => taggedString<"ProductVariantId">(v);

/**
 * 4 つのエンティティ（E09 接続先 / E10 ASP アカウント / E11 提携プログラム /
 * E15 商品）の**断る側**を見る。
 *
 * このファイルを書いた理由。4 つとも「実装済」だが、作る関数を直接呼ぶテストは
 * 1 つも無かった。見本データのリポジトリ（`*-sample-repository.ts`）が
 * 正しい値で 1 回ずつ呼ぶだけで、**断る道は一度も通っていなかった**。
 * 実測: 4 つの関数の中の断り 11 か所を `if (false)` に変えて全部走らせたところ、
 * 3875 件すべてが緑だった（2026-08-19）。
 *
 * 「使われている」と「確かめられている」は別である。通っている道が
 * 正常系だけなら、断る側は消しても誰も気づかない。
 */

const WS = asWorkspaceId("ws-1");
const NOW = new Date("2026-08-19T00:00:00Z");

describe("ChannelConnection（E09）: 認証情報そのものを持たせない", () => {
  const base = {
    id: asChannelConnectionId("ch-1"),
    workspaceId: WS,
    kind: "x" as const,
    accountLabel: "@video_edit_note",
    connectedAt: NOW,
    credentialRef: "kv:channel/x/ws-1",
  };

  it("保管先の参照キーなら作れる", () => {
    const r = createChannelConnection(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.credentialRef).toBe("kv:channel/x/ws-1");
    expect(r.value.revokedAt).toBeNull();
    expect(isConnectionUsable(r.value, NOW)).toBe(true);
  });

  /*
   * 秘密の「形」は 5 通り書いてある。1 つだけ試すと、残り 4 つを
   * 消しても緑のままになる。実装の正規表現を期待値に使わず、
   * 実際の鍵が取りうる見た目を手で並べている。
   */
  it.each([
    ["Bearer ya29.a0AfH6SMB", "OAuth の持参人トークン"],
    ["sk-proj-abcdefghijklmnop", "OpenAI 形式の鍵"],
    ["ghp_abcdefghijklmnopqrst", "GitHub の個人トークン"],
    ["xoxb-1234-5678-abcdefg", "Slack のボットトークン"],
    ["xoxp-1234-5678-abcdefg", "Slack の利用者トークン"],
    ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "JWT"],
  ])("%s（%s）は保管先ではなく値そのものなので断る", (credentialRef) => {
    expect(createChannelConnection({ ...base, credentialRef }).ok).toBe(false);
  });

  it("長さの端: 200 文字までは通り、201 文字から断る", () => {
    // 実装の定数を読まずに 200 を書く。定数から作ると、
    // 200 が 20000 に変わっても同じ側に居続けて気づけない。
    const at200 = "k".repeat(200);
    const at201 = "k".repeat(201);
    expect(createChannelConnection({ ...base, credentialRef: at200 }).ok).toBe(true);
    expect(createChannelConnection({ ...base, credentialRef: at201 }).ok).toBe(false);
  });

  it("空欄は断る（アカウント名・保管先のどちらも）", () => {
    expect(createChannelConnection({ ...base, accountLabel: "   " }).ok).toBe(false);
    expect(createChannelConnection({ ...base, credentialRef: "   " }).ok).toBe(false);
  });

  it("断られた理由には、何を渡せばよいかが書いてある", () => {
    const r = createChannelConnection({ ...base, credentialRef: "sk-abcdefghijklmnop" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("参照キー");
  });

  it("期限と失効はどちらも「その時刻ちょうど」から使えない", () => {
    const r = createChannelConnection({ ...base, expiresAt: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isConnectionUsable(r.value, new Date(NOW.getTime() - 1))).toBe(true);
    expect(isConnectionUsable(r.value, NOW)).toBe(false);
  });
});

describe("AffiliateAccount（E10）: ASP の鍵を型に入れさせない", () => {
  const base = {
    id: asAffiliateAccountId("acc-1"),
    workspaceId: WS,
    asp: "a8net" as const,
    label: "A8 本アカウント",
    connectedAt: NOW,
  };

  it("識別名があれば作れる。渡さなかったものは null になる", () => {
    const r = createAffiliateAccount(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.publicTrackingId).toBeNull();
    expect(r.value.credentialRef).toBeNull();
    expect(r.value.disabledAt).toBeNull();
  });

  it("識別名が空欄だと作れない", () => {
    expect(createAffiliateAccount({ ...base, label: "   " }).ok).toBe(false);
  });

  it("長さの端: 200 文字までは通り、201 文字から断る", () => {
    expect(createAffiliateAccount({ ...base, credentialRef: "k".repeat(200) }).ok).toBe(true);
    expect(createAffiliateAccount({ ...base, credentialRef: "k".repeat(201) }).ok).toBe(false);
  });

  it("断られた理由には、何を渡せばよいかが書いてある", () => {
    const r = createAffiliateAccount({ ...base, credentialRef: "k".repeat(201) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("保管先の参照キー");
  });
});

describe("AffiliateProgram（E11）: 割合の端を決めておく", () => {
  const base = {
    id: asAffiliateProgramId("prog-1"),
    workspaceId: WS,
    accountId: asAffiliateAccountId("acc-1"),
    asp: "a8net" as const,
    advertiserName: "サンプル電機",
    joinedAt: NOW,
  };

  it("広告主名があれば作れる。報酬の決め方は「不明」から始まる", () => {
    const r = createAffiliateProgram(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.rewardModel).toEqual({ kind: "unknown" });
  });

  it("広告主名が空欄だと作れない", () => {
    expect(createAffiliateProgram({ ...base, advertiserName: "  " }).ok).toBe(false);
  });

  /*
   * 承認率は 0〜1、報酬率は 0〜100。単位が違う 2 つが隣に並んでいるので、
   * 片方の端だけを見ると、もう片方が 0〜1 に狭まっても気づけない。
   * 両方の内側と外側を書く。
   */
  it.each([
    [-0.0001, false],
    [0, true],
    [0.5, true],
    [1, true],
    [1.0001, false],
  ])("承認率 %s は %s", (approvalRate, expected) => {
    expect(createAffiliateProgram({ ...base, approvalRate }).ok).toBe(expected);
  });

  it("承認率は未指定（null / undefined）でも作れる", () => {
    expect(createAffiliateProgram({ ...base, approvalRate: null }).ok).toBe(true);
    expect(createAffiliateProgram({ ...base, approvalRate: undefined }).ok).toBe(true);
  });

  it.each([
    [-0.0001, false],
    [0, true],
    [50, true],
    [100, true],
    [100.0001, false],
  ])("報酬率 %s%% は %s", (percent, expected) => {
    expect(
      createAffiliateProgram({ ...base, rewardModel: { kind: "rate", percent } }).ok,
    ).toBe(expected);
  });

  it("報酬率の上限は 1 ではなく 100 である（承認率と取り違えない）", () => {
    // 2 つの上限が同じ値になった瞬間に、この行が落ちる。
    expect(createAffiliateProgram({ ...base, rewardModel: { kind: "rate", percent: 100 } }).ok).toBe(
      true,
    );
    expect(createAffiliateProgram({ ...base, approvalRate: 100 }).ok).toBe(false);
  });
});

describe("Product（E15）: 識別子の無い商品を作らせない", () => {
  const provenance = createProvenance({
    sourceType: "manufacturer",
    sourceName: "メーカー公式",
    sourceUrl: "https://example.com/spec",
    retrievedAt: NOW,
    confidence: 0.9,
    permittedUsage: "仕様の引用のみ",
  });

  function product(over: Partial<Parameters<typeof createProduct>[0]> = {}) {
    if (!provenance.ok) throw new Error(provenance.error.message);
    const jan = createIdentityKey("gtin", "4901234567894");
    if (!jan.ok) throw new Error(jan.error.message);
    return createProduct({
      id: asProductId("pr-1"),
      workspaceId: WS,
      brand: "サンプル電機",
      name: "サンプル 14 インチ ノートPC",
      identityKeys: [jan.value],
      provenance: provenance.value,
      ...over,
    });
  }

  it("識別子が 1 つあれば作れる", () => {
    const r = product();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.identityKeys).toHaveLength(1);
    expect(r.value.specifications).toEqual({});
  });

  it("商品名が空欄だと作れない", () => {
    expect(product({ name: "   " }).ok).toBe(false);
  });

  it("件数の端: 識別子 0 個は断り、1 個から通る", () => {
    expect(product({ identityKeys: [] }).ok).toBe(false);
    const r = product({ identityKeys: [] });
    if (r.ok) return;
    expect(r.error.message).toContain("同一商品の判定");
  });

  it("日付の端: 販売終了日が発売日と同じ日なら通り、1 ミリ秒でも前なら断る", () => {
    const release = new Date("2026-05-01T00:00:00Z");
    expect(product({ releaseDate: release, discontinuedAt: release }).ok).toBe(true);
    expect(
      product({ releaseDate: release, discontinuedAt: new Date(release.getTime() - 1) }).ok,
    ).toBe(false);
  });

  it("発売日が無ければ、販売終了日だけでは断らない", () => {
    // 片方しか分かっていない商品を登録できなくすると、
    // 取り込みの途中で止まる。順序が見えるときだけ見る。
    expect(product({ discontinuedAt: new Date("2020-01-01T00:00:00Z") }).ok).toBe(true);
  });

  it("識別子そのものの形も確かめる（JAN は 8 桁または 12〜14 桁）", () => {
    expect(createIdentityKey("gtin", "4901234").ok).toBe(false);
    expect(createIdentityKey("gtin", "49012345").ok).toBe(true);
    expect(createIdentityKey("gtin", "490123456789").ok).toBe(true);
    expect(createIdentityKey("gtin", "49012345678901").ok).toBe(true);
    expect(createIdentityKey("gtin", "490123456789012").ok).toBe(false);
    expect(createIdentityKey("asin", "B0ABCDEFGH").ok).toBe(true);
    expect(createIdentityKey("asin", "B0ABCDEFG").ok).toBe(false);
  });
});

/**
 * ProductVariant（E16）。
 *
 * ここは「検査が別のことを見ていた」でも「断りが消せた」でもなく、
 * **作る関数そのものが無かった**。型は 2026-08-19 まで `src` と `tests` を通して
 * 1 か所も組み立てられておらず（`ProductVariantId` の宣言を除いて参照 0 件）、
 * 追跡表の「見本データ」も事実ではなかった。断る場所が 0 か所なので、
 * 必須種別（`boundary`）を宣言できない状態が正しく残っていた。
 *
 * 直し方は「宣言を足す」ではなく「**当てどころを作る**」である。
 * 先に断る場所を作り、それが本当に断ることを壊して測ってから宣言する。
 */
describe("ProductVariant（E16）: 別に買えないものを枝ちがいにしない", () => {
  function variant(over: Partial<Parameters<typeof createProductVariant>[0]> = {}) {
    const jan = createIdentityKey("gtin", "4901234567900");
    if (!jan.ok) throw new Error(jan.error.message);
    return createProductVariant({
      id: asProductVariantId("pv-1"),
      workspaceId: WS,
      productId: asProductId("pr-1"),
      axis: "色",
      value: "スペースグレイ",
      identityKeys: [jan.value],
      ...over,
    });
  }

  it("何がどう違うかと識別子が揃っていれば作れる", () => {
    const r = variant();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.axis).toBe("色");
    expect(r.value.specifications).toEqual({});
  });

  it.each([
    ["軸", { axis: "   " }],
    ["値", { value: "   " }],
  ])("%s が空欄だと作れない", (_label, over) => {
    expect(variant(over).ok).toBe(false);
  });

  it("件数の端: 識別子 0 個は断り、1 個から通る", () => {
    // 親商品（E15）と同じ端だが、断る理由が違う。親は「同一商品の判定」、
    // こちらは「別に買えるものかどうか」。理由が違うので、文面も見る。
    const zero = variant({ identityKeys: [] });
    expect(zero.ok).toBe(false);
    if (zero.ok) return;
    expect(zero.error.message).toContain("別に買える");
    expect(variant().ok).toBe(true);
  });

  it("仕様の見出しと枝ちがいの値が食い違っていたら断る", () => {
    // 型は通る組み合わせである。通ったまま比較表に載ると、
    // 「色: 赤」の列に青が並ぶ。黙って間違うので、作る時点で断る。
    expect(variant({ axis: "色", value: "青", specifications: { 色: "赤" } }).ok).toBe(false);
    expect(variant({ axis: "色", value: "赤", specifications: { 色: "赤" } }).ok).toBe(true);
  });

  it("軸に載っていない仕様は、食い違いとして扱わない", () => {
    // 枝の軸と関係ない欄まで突き合わせると、仕様を 1 行足すたびに作れなくなる。
    expect(variant({ axis: "色", value: "赤", specifications: { 重さ: 1200 } }).ok).toBe(true);
  });

  it("数字で書かれた仕様も、文字列の値と突き合わせる", () => {
    // 容量のように、仕様欄が数値で枝の値が文字列になることがある。
    // 型が違うだけで素通りすると、この断りは容量の枝には効かない。
    expect(variant({ axis: "容量", value: "512", specifications: { 容量: 512 } }).ok).toBe(true);
    expect(variant({ axis: "容量", value: "256", specifications: { 容量: 512 } }).ok).toBe(false);
  });
});
