import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
} from "@/application/ports/monetization";
import type { EditorialArticleOfferPort } from "@/application/ports/site";
import {
  type ArticleOffer,
  type ArticleOfferDisplay,
  toArticleOffer,
} from "@/application/read-models/article-offer";
import {
  type AffiliateAccount,
  type AffiliateLink,
  type AffiliateProgram,
  type Conversion,
  type ConversionStatus,
  type RewardModel,
  createAffiliateAccount,
  createAffiliateLink,
  createAffiliateProgram,
  createConversion,
  isLinkUsable,
  normalizeExternalId,
} from "@/domain/monetization";
import {
  type AffiliateAccountId,
  type AffiliateProgramId,
  type Money,
  type ProductId,
  type WorkspaceId,
  domainError,
  err,
  markCommercial,
  markEditorial,
  money,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 提携先の本物の数字は、各 ASP の API 申請と、
 * 利用者ご自身による接続情報の登録が済まないと取れない。
 * ここではその手前まで（画面・権限・締めの扱い）を確かめられるようにしている。
 *
 * **見本にも秘密の値は一切置かない。** 置いてあるのは保管先の名前だけ。
 * また、報酬額をここから順位づけへ渡せないことは、
 * このファイルが返すポートに商業の印を付けることで型として止めている。
 *
 * **成果の保存先はもうここではない。** 金額を手で直す入口が画面にできたので、
 * `src/infrastructure/persistence/d1/conversion-repository.ts` が実際に保存する。
 * ここの `sampleConversions()` はその重ね先（見本を消さないため）として残している。
 */
const stub = registerStub({
  id: "persistence:affiliate-sample",
  port: "提携リンクの保存先",
  label: "提携リンク（見本データ）",
  blockedBy:
    "affiliate_links テーブルの追加と、各 ASP の API 利用申請および接続情報の登録（利用者本人による）",
});

/**
 * 提携先と提携条件の控え。
 *
 * 2026-08-26 に `affiliate_accounts` / `affiliate_programs` を作り、
 * `/admin/affiliate/accounts/new` と `/admin/affiliate/programs/new` から
 * 実際に入れられるようにした。上のスタブへまとめたままにすると、
 * **本当に書けるものを「保存先が無い」と数え続ける**ことになる。
 *
 * それでも見本が残るのは、保存先が供給されない実行（`pnpm dev`・自動テスト）が
 * あるためである。そこでは `save` が失敗を返す——**保存できないのに成功を装わない。**
 */
const accountStub = registerStub({
  id: "persistence:affiliate-account-sample",
  port: "提携先・提携条件の保存先",
  label: "提携先と提携条件（見本データ。保存はできません）",
  blockedBy: "済み（保存先は D1 の affiliate_accounts / affiliate_programs）",
  fallbackFor: "src/infrastructure/persistence/d1/affiliate-program-repository.ts",
});

/**
 * 成果の控え。保存先は `../d1/conversion-repository.ts` にもうある。
 *
 * 上のスタブを指したままにすると、金額を直せなかったときの文が
 * 「提携リンク（見本データ）の 成果の保存」になり、リンクの側を調べ始めることになる。
 */
const conversionStub = registerStub({
  id: "persistence:affiliate-conversion-sample",
  port: "成果の保存先",
  label: "成果（見本データ。保存はできません）",
  blockedBy: "済み（保存先は D1 の affiliate_conversions）",
  fallbackFor: "src/infrastructure/persistence/d1/conversion-repository.ts",
});

export function sampleAffiliateNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const CONNECTED_AT = new Date("2026-04-01T00:00:00Z");

function jpy(amount: number): Money {
  const built = money(amount, "JPY");
  if (!built.ok) throw new Error(`見本の金額が不正です: ${built.error.message}`);
  return built.value;
}

function account(input: {
  id: string;
  asp: AffiliateAccount["asp"];
  label: string;
  publicTrackingId: string | null;
  credentialRegistered: boolean;
}): AffiliateAccount {
  const built = createAffiliateAccount({
    id: taggedString<"AffiliateAccountId">(input.id) as AffiliateAccountId,
    workspaceId: WS,
    asp: input.asp,
    label: input.label,
    publicTrackingId: input.publicTrackingId,
    // 値ではなく保管先の名前だけ。秘密はここに入らない。
    credentialRef: input.credentialRegistered ? `secret/${input.id}` : null,
    connectedAt: CONNECTED_AT,
  });
  if (!built.ok) throw new Error(`見本の提携先が不正です (${input.id}): ${built.error.message}`);
  return built.value;
}

const ACCOUNTS: readonly AffiliateAccount[] = [
  account({
    id: "aff_amazon",
    asp: "amazon_associates",
    label: "Amazonアソシエイト（本番用）",
    publicTrackingId: "sample-22",
    credentialRegistered: true,
  }),
  account({
    id: "aff_rakuten",
    asp: "rakuten_affiliate",
    label: "楽天アフィリエイト",
    publicTrackingId: "sample-rakuten",
    credentialRegistered: true,
  }),
  // わざと未登録にしている。「接続情報がまだです」が画面に出ることを確かめるため。
  account({
    id: "aff_a8",
    asp: "a8net",
    label: "A8.net（申請中）",
    publicTrackingId: null,
    credentialRegistered: false,
  }),
];

function program(input: {
  id: string;
  accountId: string;
  asp: AffiliateProgram["asp"];
  advertiserName: string;
  rewardModel: RewardModel;
  approvalRate: number | null;
  confirmationDays: number | null;
  cookieDurationDays: number | null;
  restrictions: readonly string[];
}): AffiliateProgram {
  const built = createAffiliateProgram({
    id: taggedString<"AffiliateProgramId">(input.id) as AffiliateProgramId,
    workspaceId: WS,
    accountId: taggedString<"AffiliateAccountId">(input.accountId) as AffiliateAccountId,
    asp: input.asp,
    advertiserName: input.advertiserName,
    rewardModel: input.rewardModel,
    approvalRate: input.approvalRate,
    confirmationDays: input.confirmationDays,
    cookieDurationDays: input.cookieDurationDays,
    restrictions: input.restrictions,
    joinedAt: CONNECTED_AT,
  });
  if (!built.ok) throw new Error(`見本の提携条件が不正です (${input.id}): ${built.error.message}`);
  return built.value;
}

const PROGRAMS: readonly AffiliateProgram[] = [
  program({
    id: "prg_amazon_pc",
    accountId: "aff_amazon",
    asp: "amazon_associates",
    advertiserName: "Amazon.co.jp（パソコン）",
    rewardModel: { kind: "rate", percent: 2 },
    approvalRate: 0.82,
    confirmationDays: 60,
    cookieDurationDays: 1,
    restrictions: [
      "価格をページに書き写して掲載しない（表示が古くなるため）。",
      "「最安」「No.1」といった断定の表現を使わない。",
    ],
  }),
  program({
    id: "prg_rakuten_pc",
    accountId: "aff_rakuten",
    asp: "rakuten_affiliate",
    advertiserName: "楽天市場（パソコン）",
    rewardModel: { kind: "rate", percent: 3 },
    approvalRate: null, // 未取得。0% と書くと「承認されない提携」に見えてしまう。
    confirmationDays: 45,
    cookieDurationDays: 30,
    restrictions: ["商品画像は指定の方法でのみ掲載する。"],
  }),
  program({
    id: "prg_direct_soft",
    accountId: "aff_amazon",
    asp: "direct",
    advertiserName: "動画編集ソフト（直接契約）",
    rewardModel: { kind: "fixed", amount: jpy(3000) },
    approvalRate: 0.95,
    confirmationDays: 30,
    cookieDurationDays: 60,
    restrictions: [
      "比較表への掲載は事前確認が必要。",
      "競合製品の名前を挙げた比較は不可。",
    ],
  }),
];

// 見本の商品と同じ ID を使う。ずらすと、商品の画面にリンクが出てこない。
const SAMPLE_PRODUCT_ID = taggedString<"ProductId">("p_alpha_15") as ProductId;

function link(input: {
  id: string;
  programId: string;
  url: string;
  expiresAt: Date | null;
}): AffiliateLink {
  const built = createAffiliateLink({
    id: taggedString<"AffiliateLinkId">(input.id),
    workspaceId: WS,
    programId: taggedString<"AffiliateProgramId">(input.programId) as AffiliateProgramId,
    productId: SAMPLE_PRODUCT_ID,
    originalUrl: input.url,
    trackingRef: `ref_${input.id}`,
    createdAt: CONNECTED_AT,
    expiresAt: input.expiresAt,
  });
  if (!built.ok) throw new Error(`見本のリンクが不正です (${input.id}): ${built.error.message}`);
  return built.value;
}

const LINKS: readonly AffiliateLink[] = [
  link({
    id: "lnk_amazon_pc",
    programId: "prg_amazon_pc",
    url: "https://example.invalid/asp/amazon/p_alpha_15",
    expiresAt: null,
  }),
  // わざと期限切れ。「作り直してください」が出ることを確かめるため。
  link({
    id: "lnk_direct_soft",
    programId: "prg_direct_soft",
    url: "https://example.invalid/asp/direct/p_alpha_15",
    expiresAt: new Date("2026-05-31T00:00:00Z"),
  }),
];

function conversion(input: {
  id: string;
  programId: string;
  asp: Conversion["asp"];
  status: ConversionStatus;
  occurredAt: string;
  rewardMinor: number | null;
  period: string;
  closed?: boolean;
  adjustedMinor?: number;
  adjustmentReason?: string;
}): Conversion {
  const built = createConversion({
    id: taggedString<"ConversionId">(input.id),
    workspaceId: WS,
    programId: taggedString<"AffiliateProgramId">(input.programId) as AffiliateProgramId,
    asp: input.asp,
    externalConversionId: normalizeExternalId(`EXT-${input.id}`),
    status: input.status,
    occurredAt: new Date(input.occurredAt),
    ingestedReward: input.rewardMinor === null ? null : jpy(input.rewardMinor),
    period: input.period,
  });
  if (!built.ok) throw new Error(`見本の成果が不正です (${input.id}): ${built.error.message}`);
  return {
    ...built.value,
    periodClosed: input.closed ?? false,
    adjustedReward: input.adjustedMinor === undefined ? null : jpy(input.adjustedMinor),
    adjustmentReason: input.adjustmentReason ?? null,
  };
}

const CONVERSIONS: readonly Conversion[] = [
  conversion({
    id: "cv_2026_08_a",
    programId: "prg_amazon_pc",
    asp: "amazon_associates",
    status: "approved",
    occurredAt: "2026-08-03T10:00:00Z",
    rewardMinor: 1200,
    period: "2026-08",
  }),
  conversion({
    id: "cv_2026_08_b",
    programId: "prg_rakuten_pc",
    asp: "rakuten_affiliate",
    status: "pending",
    occurredAt: "2026-08-09T12:00:00Z",
    rewardMinor: 2400,
    period: "2026-08",
  }),
  // 金額が未取得の成果。「未取得」と「0円」を混ぜないことを画面で確かめる。
  conversion({
    id: "cv_2026_08_c",
    programId: "prg_direct_soft",
    asp: "direct",
    status: "pending",
    occurredAt: "2026-08-12T08:00:00Z",
    rewardMinor: null,
    period: "2026-08",
  }),
  // 締め済みの期間。手で直せないことを画面で確かめる。
  conversion({
    id: "cv_2026_07_a",
    programId: "prg_amazon_pc",
    asp: "amazon_associates",
    status: "approved",
    occurredAt: "2026-07-20T10:00:00Z",
    rewardMinor: 1000,
    period: "2026-07",
    closed: true,
    adjustedMinor: 900,
    adjustmentReason: "ASP の再計算に合わせて訂正しました。",
  }),
];

/**
 * 見本の提携先。**保存先（D1）版もこれを重ねて返す。**
 *
 * 消すと、まだ 1 件も登録していない人の画面から提携先が消え、
 * 「登録していない」のか「読めていない」のかを見分けられなくなる。
 */
export function sampleAffiliateAccounts(): readonly AffiliateAccount[] {
  return ACCOUNTS;
}

/** 見本の提携条件。上と同じ理由で、保存先版もこれを重ねる。 */
export function sampleAffiliatePrograms(): readonly AffiliateProgram[] {
  return PROGRAMS;
}

export function createSampleAffiliateAccountRepository(): AffiliateAccountRepositoryPort {
  return {
    async findById(workspaceId, id) {
      return ok(ACCOUNTS.find((a) => a.workspaceId === workspaceId && a.id === id) ?? null);
    },
    async list(workspaceId, page) {
      return ok({
        items: ACCOUNTS.filter((a) => a.workspaceId === workspaceId).slice(0, page.limit),
        nextCursor: null,
      });
    },
    save: () => stubCall(accountStub, "提携先の保存"),
  };
}

export function createSampleAffiliateProgramRepository(): AffiliateProgramRepositoryPort {
  return {
    async findById(workspaceId, id) {
      return ok(PROGRAMS.find((p) => p.workspaceId === workspaceId && p.id === id) ?? null);
    },
    async list(workspaceId, page) {
      return ok({
        items: PROGRAMS.filter((p) => p.workspaceId === workspaceId).slice(0, page.limit),
        nextCursor: null,
      });
    },
    save: () => stubCall(accountStub, "提携条件の保存"),
  };
}

/**
 * 見本の成果リンク。**保存先（D1）版もこれを重ねて返す。**
 *
 * 消すと、1 件も登録していない状態で一覧が空になり、
 * 「まだ登録していない」のか「壊れている」のかを画面から見分けられなくなる。
 */
export function sampleAffiliateLinks(): readonly AffiliateLink[] {
  return LINKS;
}

/** 商業の印を付けて返す。印が無いものは、順位づけ側へ渡せてしまう。 */
export function createSampleAffiliateLinkRepository(): CommercialAffiliateLinkRepositoryPort {
  return markCommercial({
    async findById(workspaceId: WorkspaceId, id: AffiliateLink["id"]) {
      return ok(LINKS.find((l) => l.workspaceId === workspaceId && l.id === id) ?? null);
    },
    async findUsableByOriginalUrl(workspaceId: WorkspaceId, originalUrl: string, at: Date) {
      return ok(
        LINKS.find(
          (l) =>
            l.workspaceId === workspaceId &&
            l.originalUrl === originalUrl &&
            isLinkUsable(l, at),
        ) ?? null,
      );
    },
    async listByProduct(workspaceId: WorkspaceId, productId: ProductId) {
      return ok(LINKS.filter((l) => l.workspaceId === workspaceId && l.productId === productId));
    },
    async listNeedingAttention(workspaceId: WorkspaceId, at: Date, limit: number) {
      return ok(
        LINKS.filter(
          (l) =>
            l.workspaceId === workspaceId &&
            (l.disabledAt !== null || (l.expiresAt !== null && l.expiresAt.getTime() <= at.getTime())),
        ).slice(0, limit),
      );
    },
    save: () => stubCall(stub, "提携リンクの保存"),
    createIfNoUsableUrl: () => stubCall(stub, "提携リンクの保存"),

    /**
     * 一覧。見本は**読者に出ている表記つき**で並べる。
     * 表記が無い行は出さない。名前の無い行を並べると、
     * 「どれを止めるか」を ID だけで選ぶことになり、押し間違いが起きる。
     */
    async listWithSnapshot(workspaceId: WorkspaceId) {
      return ok(
        LINKS.filter((l) => l.workspaceId === workspaceId).flatMap((link) => {
          const display = OFFER_DISPLAY[String(link.id)];
          return display === undefined
            ? []
            : [
                {
                  link,
                  snapshot: {
                    productName: display.productName,
                    brand: display.brand,
                    oneLine: display.oneLine,
                  },
                },
              ];
        }),
      );
    },

    /**
     * 見本は止められない。
     *
     * **黙って成功にしない。** 見本はコードの中の定数なので、止めたことにしても
     * 次に画面を開けばまた「読者に出ています」に戻る。成功を返すと、
     * 押した人は止めたと思い、リンクは出続ける。断る文で理由まで返す。
     */
    async disable(_workspaceId: WorkspaceId, _id: AffiliateLink["id"], _at: Date) {
      return err(
        domainError(
          "CONFLICT",
          "これは見本として最初から入っているリンクなので止められません。保存先（D1）につないでから、自分で登録したリンクを止めてください。",
          { field: "affiliateLinkId" },
        ),
      );
    },
  });
}

/**
 * 記事に載せる写しの見本。
 *
 * **見本にも商品名を持たせる。** 名前が無いと、公開しても名前の無いカードが
 * 出るか、カードそのものが出ない。どちらも「成果リンクが出ている」ことを
 * 確かめられない状態になる。
 *
 * 期限切れのリンク（`lnk_direct_soft`）はわざと混ぜてある。
 * 「切れたリンクは URL を出さず、理由を出す」が見本のままでも確かめられる。
 */
const OFFER_DISPLAY: Readonly<Record<string, ArticleOfferDisplay>> = {
  lnk_amazon_pc: {
    productName: "Alpha Studio 15",
    brand: "Alpha",
    oneLine: "書き出しの速さと持ち運びやすさの釣り合いが取れた機種。",
  },
  lnk_direct_soft: {
    productName: "Delta Light 13",
    brand: "Delta",
    oneLine: "最も軽く電池が長持ちする。書き出しは時間がかかる。",
  },
};

/**
 * 成果リンクの ID から、記事に載せる写しを引く（見本）。
 *
 * 報酬を持たない形しか返さないので、記事の組み立てへ渡してよい
 * （Editorial の印を付ける理由は `d1/affiliate-link-repository.ts` 冒頭）。
 */
export function createSampleArticleOfferReader(): EditorialArticleOfferPort {
  return markEditorial({
    async listByIds(workspaceId: WorkspaceId, affiliateLinkIds: readonly string[], at: Date) {
      const offers: ArticleOffer[] = [];
      // 版が並べた順のまま返す。見本と D1 で並びが変わると、
      // 見本で確かめた並びが本番で再現しない。
      for (const id of affiliateLinkIds) {
        const link = LINKS.find((l) => l.workspaceId === workspaceId && String(l.id) === id);
        const display = OFFER_DISPLAY[id];
        if (link === undefined || display === undefined) continue;
        offers.push(toArticleOffer(link, display, at));
      }
      return ok(offers as readonly ArticleOffer[]);
    },
  });
}

/**
 * 見本の成果。**保存先（D1）版もこれを重ねて返す。**
 *
 * 消すと、ASP との接続が済むまで成果が 1 件も無い画面になり、
 * 金額を直す操作も締めの扱いも、誰も確かめられなくなる。
 * 見本であることは画面に出している。
 */
export function sampleConversions(): readonly Conversion[] {
  return CONVERSIONS;
}

export function createSampleConversionRepository(): CommercialConversionRepositoryPort {
  return markCommercial({
    async findById(workspaceId: WorkspaceId, id: Conversion["id"]) {
      return ok(CONVERSIONS.find((c) => c.workspaceId === workspaceId && c.id === id) ?? null);
    },
    async findByExternalId(
      workspaceId: WorkspaceId,
      asp: Conversion["asp"],
      normalizedExternalId: string,
    ) {
      return ok(
        CONVERSIONS.find(
          (c) =>
            c.workspaceId === workspaceId &&
            c.asp === asp &&
            c.externalConversionId === normalizedExternalId,
        ) ?? null,
      );
    },
    async listByPeriod(workspaceId: WorkspaceId, period: string, page: { limit: number }) {
      return ok({
        items: CONVERSIONS.filter(
          (c) => c.workspaceId === workspaceId && c.period === period,
        ).slice(0, page.limit),
        nextCursor: null,
      });
    },
    // 保存はできない。できたふりをすると「直したのに戻っている」が起きる。
    save: () => stubCall(conversionStub, "成果の保存"),
  });
}

/** 見本にある会計期間。画面の期間切り替えに使う。 */
export const SAMPLE_PERIODS: readonly string[] = ["2026-08", "2026-07"];
