import type {
  ChannelConnectionRepositoryPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import type {
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "@/application/ports/monetization";
import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution";
import { can, requireWorkspaceWideCapability } from "@/domain/identity";
import { effectiveReward } from "@/domain/monetization";
import {
  type DomainError,
  type Money,
  type Result,
  formatMoney,
  isExpired,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 管理画面のホームに出す 11 個の数字 (§22.1)。
 *
 * ここは仕様書で唯一「編集の情報」と「お金の情報」を同じ画面に並べる場所。
 * そのため、このユースケースだけは Editorial と Commercial の両方のポートを受け取る。
 * **代わりに 2 つの規律を置く。**
 *   1. 受け取るのは読み取りだけ。ここから何かを保存・公開することはない。
 *   2. 順位づけのユースケースへは、このまとまりを渡さない。
 *      渡そうとすると、順位づけ側が `affiliateLinks?: never` を宣言しているため
 *      コンパイルが通らない (要求 B の不変条件)。
 *
 * もう 1 つの規律は「数字だけを出さない」こと。
 * 件数の隣に必ず **何を意味するか** と **どこへ行けば解消できるか** を付ける。
 * 数だけ並べたホーム画面は、見ても次の操作が決まらないので誰も見なくなる。
 */
export type ReadDashboardDeps = {
  readonly contentVariants: EditorialContentVariantRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  readonly publications: PublicationRepositoryPort;
  readonly channelConnections: ChannelConnectionRepositoryPort;
  readonly linkInbox: CommercialLinkIngestionRepositoryPort;
  readonly affiliateLinks: CommercialAffiliateLinkRepositoryPort;
  readonly conversions: CommercialConversionRepositoryPort;
};

/** 数字の並び順。仕様書 §22.1 の並びをそのまま使う。 */
export const DASHBOARD_WIDGET_KEYS = [
  "link_inbox",
  "product_verification",
  "generation_queue",
  "approval_queue",
  "published_today",
  "publish_failed",
  "broken_links",
  "refresh_due",
  "conversions",
  "revenue",
  "channel_health",
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

/** 色分けの意味。「赤いから悪い」ではなく「手当てが要る」を表す。 */
export type WidgetTone = "neutral" | "attention" | "problem";

export type DashboardWidget = {
  readonly key: DashboardWidgetKey;
  readonly label: string;
  /** 表示する値。取れなかったときは null。**0 と混ぜない。** */
  readonly value: number | null;
  /** 画面に出す文字列。単位や通貨をここで確定させ、画面では組み立てない。 */
  readonly valueLabel: string;
  /** その数が何を意味するか。1 文。 */
  readonly reason: string;
  readonly tone: WidgetTone;
  /** 解消できる画面。**導線の無い数字は置かない。** */
  readonly href: string;
  readonly actionLabel: string;
  /**
   * 値が出せない理由。権限が無い・保存先がまだ無い、など。
   * null 以外のときは値の代わりにこの文を出す。
   */
  readonly unavailableReason: string | null;
};

export type DashboardView = {
  readonly widgets: readonly DashboardWidget[];
  /** 手当てが要る数字の数。ここが 0 なら「今日は見るところがない」と言える。 */
  readonly attentionCount: number;
  /** 全部が 0 件だったときの説明。空の画面を無言にしない。 */
  readonly allClearReason: string | null;
  /** 値が出せなかった数字の数。スタブの範囲を隠さないために出す。 */
  readonly unavailableCount: number;
  /** 集計の基準時刻。「いつの数字か」の分からない数字は判断に使えない。 */
  readonly asOf: Date;
  /** 成果と収益の集計期間 (YYYY-MM)。 */
  readonly period: string;
};

export type ReadDashboardInput = {
  /** 試験用の基準時刻。省略すると現在時刻。 */
  readonly at?: Date;
};

const PAGE = { limit: 100, cursor: null } as const;

/** 情報源の信頼度がこれ未満なら、人が確かめてから使う。 */
const VERIFY_CONFIDENCE_THRESHOLD = 0.7;

function periodOf(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * 1 つの数字を組み立てる。
 *
 * 取得に失敗しても画面全体を落とさない。
 * 1 つの保存先が未接続なだけで 11 個すべてが見えなくなるのは割に合わない。
 */
function widget(input: {
  key: DashboardWidgetKey;
  label: string;
  value: number | null;
  unit: string;
  reasonWhenZero: string;
  reasonWhenSome: (value: number) => string;
  href: string;
  actionLabel: string;
  unavailableReason: string | null;
  problemWhenPositive?: boolean;
  /**
   * 知らせるだけの数字。件数が増えても色を付けない。
   * 「今日の投稿」「今月の成果」のような良い知らせに色を付けると、
   * 本当に手当てが要る数字が埋もれる。
   */
  informational?: boolean;
}): DashboardWidget {
  if (input.unavailableReason !== null || input.value === null) {
    return {
      key: input.key,
      label: input.label,
      value: null,
      valueLabel: "—",
      reason: input.unavailableReason ?? "いまは数えられませんでした。",
      tone: "neutral",
      href: input.href,
      actionLabel: input.actionLabel,
      unavailableReason: input.unavailableReason ?? "いまは数えられませんでした。",
    };
  }

  const value = input.value;
  const positive = value > 0;
  return {
    key: input.key,
    label: input.label,
    value,
    valueLabel: `${value.toLocaleString("ja-JP")}${input.unit}`,
    reason: positive ? input.reasonWhenSome(value) : input.reasonWhenZero,
    tone:
      !positive || input.informational === true
        ? "neutral"
        : input.problemWhenPositive === true
          ? "problem"
          : "attention",
    href: input.href,
    actionLabel: input.actionLabel,
    unavailableReason: null,
  };
}

/** 権限が無いときの断り文。数字を隠すだけにせず、誰に頼めばよいかを書く。 */
const NO_REVENUE_PERMISSION =
  "お金に関わる数字を見る権限がありません。ワークスペース管理者に依頼してください。";

export function createGetDashboardUseCase(
  deps: ReadDashboardDeps,
): UseCase<ReadDashboardInput, DashboardView> {
  return {
    async execute(actor, input): Promise<Result<DashboardView, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "ホーム画面の参照");
      if (!allowed.ok) return allowed;

      const at = input.at ?? new Date();
      const period = periodOf(at);
      const ws = actor.workspaceId;
      const seesRevenue = can(actor, "affiliate.read_revenue");

      // 11 個の数字は互いに依存しない。ひとまとめに取りに行く。
      const [
        inbox,
        products,
        briefReady,
        factCheck,
        complianceReview,
        recent,
        brokenLinks,
        refreshDue,
        conversions,
        connections,
      ] = await Promise.all([
        seesRevenue ? deps.linkInbox.list(ws, { state: "received" }, PAGE) : null,
        deps.products.search(ws, {}, PAGE),
        deps.contentVariants.listByState(ws, "BRIEF_READY", PAGE),
        deps.contentVariants.listByState(ws, "FACT_CHECK", PAGE),
        deps.contentVariants.listByState(ws, "COMPLIANCE_REVIEW", PAGE),
        deps.publications.listRecent(ws, 100),
        seesRevenue ? deps.affiliateLinks.listNeedingAttention(ws, at, 100) : null,
        deps.contentVariants.listReviewOverdue(ws, at, 100),
        seesRevenue ? deps.conversions.listByPeriod(ws, period, PAGE) : null,
        deps.channelConnections.listByWorkspace(ws, PAGE),
      ]);

      // --- 編集側 ---------------------------------------------------------
      const unverified = products.ok
        ? products.value.items.filter(
            (p) =>
              p.provenance.confidence < VERIFY_CONFIDENCE_THRESHOLD ||
              isExpired(p.provenance, at),
          ).length
        : null;

      const approvalWaiting =
        factCheck.ok && complianceReview.ok
          ? factCheck.value.items.length + complianceReview.value.items.length
          : null;

      const publishedToday = recent.ok
        ? recent.value.filter((p) => p.publishedAt !== null && sameUtcDay(p.publishedAt, at)).length
        : null;

      const failed = recent.ok
        ? recent.value.filter(
            (p) => p.state === "FAILED_SEND" || p.state === "FAILED_VALIDATION",
          ).length
        : null;

      const staleConnections = connections.ok
        ? connections.value.items.filter(
            (c) =>
              c.revokedAt !== null || (c.expiresAt !== null && c.expiresAt.getTime() <= at.getTime()),
          )
        : null;

      // --- お金の側 -------------------------------------------------------
      let revenueLabel = "—";
      let revenueValue: number | null = null;
      if (conversions !== null && conversions.ok) {
        const rewards = conversions.value.items
          .map((c) => effectiveReward(c))
          .filter((m): m is Money => m !== null);
        // 通貨が混ざったら足さない。混ぜて足した金額は、後から検算できない。
        const currencies = new Set(rewards.map((m) => m.currency));
        if (currencies.size <= 1 && rewards.length > 0) {
          const total = rewards.reduce(
            (acc, m) => ({ amountMinor: acc.amountMinor + m.amountMinor, currency: m.currency }),
            { amountMinor: 0, currency: rewards[0].currency },
          );
          revenueValue = total.amountMinor;
          revenueLabel = formatMoney(total);
        } else if (rewards.length === 0) {
          revenueValue = 0;
          revenueLabel = "0円";
        }
      }

      const widgets: readonly DashboardWidget[] = [
        widget({
          key: "link_inbox",
          label: "未処理の成果リンク",
          value: inbox === null ? null : inbox.ok ? inbox.value.items.length : null,
          unit: "件",
          reasonWhenZero: "貼り付けられた成果リンクは、すべて商品と結び付いています。",
          reasonWhenSome: (n) => `${n}件の成果リンクが、まだどの商品のものか決まっていません。`,
          href: "/admin/inbox",
          actionLabel: "受信箱を開く",
          unavailableReason: inbox === null ? NO_REVENUE_PERMISSION : inbox.ok ? null : inbox.error.message,
        }),
        widget({
          key: "product_verification",
          label: "確認待ちの商品",
          value: unverified,
          unit: "件",
          reasonWhenZero: "商品情報の出どころは、すべて確かめ済みです。",
          reasonWhenSome: (n) =>
            `${n}件の商品が、出どころの確からしさが低いか、情報の有効期限を過ぎています。`,
          href: "/admin/products",
          actionLabel: "商品を確認する",
          unavailableReason: products.ok ? null : products.error.message,
        }),
        widget({
          key: "generation_queue",
          label: "生成待ちの記事",
          value: briefReady.ok ? briefReady.value.items.length : null,
          unit: "本",
          reasonWhenZero: "構成ができていて下書き待ちの記事はありません。",
          reasonWhenSome: (n) => `${n}本の記事が、構成までできていて下書き待ちです。`,
          href: "/admin/content",
          actionLabel: "記事の進み具合を見る",
          unavailableReason: briefReady.ok ? null : briefReady.error.message,
        }),
        widget({
          key: "approval_queue",
          label: "承認待ちの記事",
          value: approvalWaiting,
          unit: "本",
          reasonWhenZero: "人の確認を待っている記事はありません。",
          reasonWhenSome: (n) => `${n}本の記事が、事実の確認か表現の確認で止まっています。`,
          href: "/admin/content",
          actionLabel: "確認する記事を見る",
          unavailableReason:
            factCheck.ok && complianceReview.ok
              ? null
              : !factCheck.ok
                ? factCheck.error.message
                : "確認待ちの記事を数えられませんでした。",
        }),
        widget({
          key: "published_today",
          label: "本日の投稿",
          value: publishedToday,
          unit: "件",
          reasonWhenZero: "今日はまだ投稿していません。",
          reasonWhenSome: (n) => `今日は${n}件を各媒体へ投稿しました。`,
          href: "/admin/distribution",
          actionLabel: "配信の状況を見る",
          unavailableReason: recent.ok ? null : recent.error.message,
          informational: true,
        }),
        widget({
          key: "publish_failed",
          label: "投稿の失敗",
          value: failed,
          unit: "件",
          reasonWhenZero: "止まっている投稿はありません。",
          reasonWhenSome: (n) => `${n}件の投稿が失敗したまま止まっています。再送の判断が要ります。`,
          href: "/admin/distribution",
          actionLabel: "失敗した投稿を見る",
          unavailableReason: recent.ok ? null : recent.error.message,
          problemWhenPositive: true,
        }),
        widget({
          key: "broken_links",
          label: "切れている成果リンク",
          value:
            brokenLinks === null ? null : brokenLinks.ok ? brokenLinks.value.length : null,
          unit: "本",
          reasonWhenZero: "期限切れや停止済みの成果リンクはありません。",
          reasonWhenSome: (n) =>
            `${n}本の成果リンクが期限切れか停止済みです。読者が押しても商品ページへ行けません。`,
          href: "/admin/affiliate",
          actionLabel: "成果リンクを見る",
          unavailableReason:
            brokenLinks === null
              ? NO_REVENUE_PERMISSION
              : brokenLinks.ok
                ? null
                : brokenLinks.error.message,
          problemWhenPositive: true,
        }),
        widget({
          key: "refresh_due",
          label: "更新期限を過ぎた記事",
          value: refreshDue.ok ? refreshDue.value.length : null,
          unit: "本",
          reasonWhenZero: "次回確認日を過ぎた公開記事はありません。",
          reasonWhenSome: (n) => `${n}本の公開記事が、決めた次回確認日を過ぎています。`,
          href: "/admin/content",
          actionLabel: "見直す記事を見る",
          unavailableReason: refreshDue.ok ? null : refreshDue.error.message,
        }),
        widget({
          key: "conversions",
          label: `今月の成果（${period}）`,
          value:
            conversions === null ? null : conversions.ok ? conversions.value.items.length : null,
          unit: "件",
          reasonWhenZero: `${period} に記録された成果はまだありません。`,
          reasonWhenSome: (n) => `${period} に${n}件の成果が記録されています。`,
          href: "/admin/affiliate",
          actionLabel: "成果の一覧を見る",
          unavailableReason:
            conversions === null
              ? NO_REVENUE_PERMISSION
              : conversions.ok
                ? null
                : conversions.error.message,
          informational: true,
        }),
        {
          // 収益だけは件数ではなく金額なので、共通の組み立てを通さない。
          key: "revenue",
          label: `今月の収益（${period}）`,
          value: revenueValue,
          valueLabel: revenueValue === null ? "—" : revenueLabel,
          reason:
            conversions === null
              ? NO_REVENUE_PERMISSION
              : revenueValue === null
                ? "金額の通貨が揃っていないため、合計を出していません。"
                : "確定した金額と、人が訂正した金額を反映した合計です。未取得の金額は 0 円として足していません。",
          tone: "neutral",
          href: "/admin/affiliate",
          actionLabel: "収益の内訳を見る",
          unavailableReason:
            conversions === null
              ? NO_REVENUE_PERMISSION
              : revenueValue === null
                ? "通貨が混ざっているため合計を出せません。"
                : null,
        },
        widget({
          key: "channel_health",
          label: "つながっていない媒体",
          value: staleConnections === null ? null : staleConnections.length,
          unit: "件",
          reasonWhenZero: "登録済みの媒体は、すべてつながっています。",
          reasonWhenSome: (n) =>
            `${n}件の媒体が、認証の期限切れか解除済みです（${(staleConnections ?? [])
              .map((c) => CHANNEL_CAPABILITIES[c.kind].label)
              .join("・")}）。つなぎ直すまで投稿できません。`,
          href: "/admin/settings",
          actionLabel: "媒体のつなぎ直しへ",
          unavailableReason: connections.ok ? null : connections.error.message,
          problemWhenPositive: true,
        }),
      ];

      const attentionCount = widgets.filter((w) => w.tone !== "neutral").length;
      const unavailableCount = widgets.filter((w) => w.unavailableReason !== null).length;

      return ok({
        widgets,
        attentionCount,
        unavailableCount,
        allClearReason:
          attentionCount === 0
            ? "いま手当てが要るものはありません。新しい記事を書き始めるか、商品の情報を足してください。"
            : null,
        asOf: at,
        period,
      });
    },
  };
}
