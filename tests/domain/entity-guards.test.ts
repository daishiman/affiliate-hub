/**
 * @tier 1
 * @req REQ-E09, REQ-E10, REQ-E11, REQ-E15
 * @types equivalence, boundary, secrets
 */
import { describe, expect, it } from "vitest";
import { createChannelConnection, isConnectionUsable } from "@/domain/distribution";
import { createAffiliateAccount, createAffiliateProgram } from "@/domain/monetization";
import { createIdentityKey, createProduct } from "@/domain/product";
import { createProvenance } from "@/domain/shared";
import {
  type AffiliateAccountId,
  asAffiliateProgramId,
  asChannelConnectionId,
  asProductId,
  asWorkspaceId,
} from "@/domain/shared/ids";
import { taggedString } from "@/domain/shared/tagged";

const asAffiliateAccountId = (v: string): AffiliateAccountId =>
  taggedString<"AffiliateAccountId">(v);

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
