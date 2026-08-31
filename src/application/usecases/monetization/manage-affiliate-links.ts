import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
} from "@/application/ports/monetization";
import { requireCapability } from "@/domain/identity";
import { ASP_LABEL, disableAffiliateLink, isLinkUsable } from "@/domain/monetization";
import {
  type ActorContext,
  type AffiliateLinkId,
  type DomainError,
  type Result,
  err,
  notFound,
  ok,
  readDataClass,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 登録済みの成果リンクを見て、古くなったものを止める。
 *
 * --- なぜこの 2 つが要るのか ---
 *
 * 登録の口（`register-affiliate-link.ts`）はあるのに、**止める口が無かった。**
 * 商品名も URL も写しで、上書きしない決まりにしてある
 * （`docs/product/design-decisions.md` §2）ので、
 * 表記が古くなったら「止めて登録し直す」しか道が無い。
 * その 1 手目が無いということは、**実際には直す手段が 1 つも無かった**。
 *
 * ASP 側で商品名が変わっても、読者のカードには登録した日の名前が出続ける。
 * 気付いても消せない。消せないので、間違った名前のまま公開が続く。
 *
 * --- 一覧に商品名を出す理由 ---
 *
 * 止める判断は「ASP の管理画面に出ている名前」と
 * 「読者に出ている名前」を見比べて行う。読者に出ている名前が一覧に無いと、
 * ID を頼りに ASP 側と往復することになり、**別のリンクを止める**事故が起きる。
 *
 * 規範: docs/product/design-decisions.md §2 / REQ-E13 / Beads ah-1y7
 */

export type AffiliateLinkDeps = {
  readonly links: CommercialAffiliateLinkRepositoryPort;
  readonly programs: AffiliateProgramRepositoryPort;
  readonly ids: IdGeneratorPort;
  /** 誰がいつ止めたか。**残せなければ成功にしない。** */
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/** 一覧に出す 1 行。読者に出ている表記と、いまの状態。 */
export type AffiliateLinkRow = {
  readonly affiliateLinkId: string;
  /** 読者のカードに出ている名前。登録した日の写し。 */
  readonly productName: string;
  readonly brand: string | null;
  readonly oneLine: string | null;
  /** ASP が発行した URL の**接続先だけ**。全体は出さない（成果の割り当て先が入っている）。 */
  readonly host: string;
  readonly registeredAt: string;
  readonly providerId: string;
  readonly providerLabel: string;
  readonly lastCheckedAt: string | null;
  readonly placementCount: number;
  readonly placements: readonly {
    readonly placementId: string;
    readonly siteSlug: string;
    readonly articleSlug: string;
    readonly blockId: string | null;
    readonly placement: string;
    readonly position: number;
    readonly status: "active" | "removed";
    readonly lastRenderedAt: string | null;
  }[];
  readonly needsAttention: boolean;
  readonly attentionReasons: readonly string[];
  readonly state: "usable" | "disabled" | "expired";
  readonly stateLabel: string;
  /** 止められるか。止まっているものは押せる形にしない。 */
  readonly canDisable: boolean;
};

export type ListAffiliateLinksOutput = {
  readonly rows: readonly AffiliateLinkRow[];
  /** いま読者に出ている本数。0 なら記事に成果リンクが 1 件も出ない。 */
  readonly usableCount: number;
  readonly totalCount: number;
  readonly providerOptions: readonly { readonly value: string; readonly label: string }[];
};

export type ListAffiliateLinksInput = {
  readonly state?: AffiliateLinkRow["state"] | null;
  readonly provider?: string | null;
  readonly attention?: boolean | null;
};

function guardCommercial(deps: AffiliateLinkDeps): void {
  if (readDataClass(deps.links) !== "commercial") {
    throw new Error(
      "成果リンクのつなぎ目に商業データの印が付いていません。印が無いと順位づけ側へ渡せてしまいます。",
    );
  }
}

/** 記録にも一覧にも URL 全体を残さない。成果の割り当て先が URL に入っているため。 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "—";
  }
}

const STATE_LABEL: Readonly<Record<AffiliateLinkRow["state"], string>> = {
  usable: "読者に出ています",
  disabled: "止めました",
  expired: "期限が切れています",
};

export function createListAffiliateLinksUseCase(
  deps: AffiliateLinkDeps,
): UseCase<ListAffiliateLinksInput, ListAffiliateLinksOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input,
    ): Promise<Result<ListAffiliateLinksOutput, DomainError>> {
      /*
        一覧は**読むだけなので `read_revenue` で足りる。** `manage` を求めると、
        数字を見る役（analyst）が「いま読者に何が出ているか」を確かめられない。
        止める操作の側だけが `manage` を求める。
      */
      const allowed = requireCapability(actor, "affiliate.read_revenue", "成果リンクの一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.links.listWithSnapshot(actor.workspaceId);
      if (!found.ok) return found;

      const programIds = [...new Set(found.value.map(({ link }) => String(link.programId)))];
      const programResults = await Promise.all(
        programIds.map(async (programId) => ({
          programId,
          result: await deps.programs.findById(
            actor.workspaceId,
            taggedString<"AffiliateProgramId">(programId),
          ),
        })),
      );
      const failedProgram = programResults.find(({ result }) => !result.ok);
      if (failedProgram !== undefined && !failedProgram.result.ok) return failedProgram.result;
      const providerByProgram = new Map(
        programResults.flatMap(({ programId, result }) =>
          result.ok && result.value !== null
            ? [[programId, { id: result.value.asp, label: ASP_LABEL[result.value.asp] }] as const]
            : [],
        ),
      );

      const at = deps.now();
      const allRows = found.value.map(({ link, snapshot, lastCheckedAt, placements = [] }) => {
        /*
          止めたのか、期限が来たのかを分けて出す。
          まとめて「使えません」にすると、押して止めたのか ASP 側の都合なのかが
          読み取れず、期限切れを止めた扱いで放置する運用が生まれる。
        */
        const state: AffiliateLinkRow["state"] =
          link.disabledAt !== null && link.disabledAt <= at
            ? "disabled"
            : isLinkUsable(link, at)
              ? "usable"
              : "expired";
        const provider = providerByProgram.get(String(link.programId)) ?? {
          id: "unknown",
          label: "提携先未確認",
        };
        const activePlacements = placements.filter((placement) => placement.status === "active");
        const checkedAt = lastCheckedAt ?? null;
        const attentionReasons = [
          ...(state === "usable" ? [] : [STATE_LABEL[state]]),
          ...(checkedAt === null
            ? ["最終確認日がありません"]
            : at.getTime() - checkedAt.getTime() > 30 * 24 * 60 * 60 * 1000
              ? ["最終確認から30日を超えています"]
              : []),
          ...(activePlacements.length === 0 ? ["掲載先がありません"] : []),
        ];
        return {
          affiliateLinkId: String(link.id),
          productName: snapshot.productName,
          brand: snapshot.brand,
          oneLine: snapshot.oneLine,
          host: hostOf(link.originalUrl),
          registeredAt: link.createdAt.toISOString().slice(0, 10),
          providerId: provider.id,
          providerLabel: provider.label,
          lastCheckedAt: checkedAt?.toISOString() ?? null,
          placementCount: activePlacements.length,
          placements: placements.map((placement) => ({
            placementId: placement.placementId,
            siteSlug: placement.siteSlug,
            articleSlug: placement.articleSlug,
            blockId: placement.blockId,
            placement: placement.placement,
            position: placement.position,
            status: placement.status,
            lastRenderedAt: placement.lastRenderedAt?.toISOString() ?? null,
          })),
          needsAttention: attentionReasons.length > 0,
          attentionReasons,
          state,
          stateLabel: STATE_LABEL[state],
          // 期限切れも止められる。ASP 側で復活したときに、
          // 「止めていない期限切れ」と「止めた」を後から見分けられるようにする。
          canDisable: state !== "disabled",
        };
      });

      const rows = allRows.filter(
        (row) =>
          (input.state === undefined || input.state === null || row.state === input.state) &&
          (input.provider === undefined ||
            input.provider === null ||
            row.providerId === input.provider) &&
          (input.attention !== true || row.needsAttention),
      );
      const providerOptions = [...new Map(
        allRows.map((row) => [
          row.providerId,
          { value: row.providerId, label: row.providerLabel },
        ]),
      ).values()].sort((left, right) => left.label.localeCompare(right.label, "ja"));

      return ok({
        rows,
        usableCount: allRows.filter((row) => row.state === "usable").length,
        totalCount: allRows.length,
        providerOptions,
      });
    },
  };
}

export type DisableAffiliateLinkInput = {
  readonly affiliateLinkId: string;
  /**
   * なぜ止めるのか。**記録に残るので受け取る。**
   *
   * 固定文（「表記が古くなったため」）で埋めない。止める理由は
   * 「ASP 側で名前が変わった」「提携が切れた」「商品が売り切れた」と別物で、
   * 後から「なぜ読者に出なくなったか」を問われたときに答えが変わる。
   */
  readonly reason: string;
};
export type DisableAffiliateLinkOutput = {
  readonly affiliateLinkId: string;
  readonly message: string;
};

export function createDisableAffiliateLinkUseCase(
  deps: AffiliateLinkDeps,
): UseCase<DisableAffiliateLinkInput, DisableAffiliateLinkOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: DisableAffiliateLinkInput,
    ): Promise<Result<DisableAffiliateLinkOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "成果リンクを止める");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError(
            "止める理由を書いてください。記録に残り、後から「なぜ読者に出なくなったのか」を聞かれたときの答えになります。",
            "reason",
          ),
        );
      }

      const id = taggedString<"AffiliateLinkId">(input.affiliateLinkId) as AffiliateLinkId;
      /*
        `actor.workspaceId` で引く。入力の作業場所を信じる形にしない。
        信じた時点で、ID を知っているだけで他社のリンクを止められる。
      */
      const found = await deps.links.findById(actor.workspaceId, id);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("成果リンク", input.affiliateLinkId));

      const at = deps.now();
      // 二度押しをここで断る。押すたびに止めた日時が後ろへずれると、
      // 「いつ読者に出なくなったか」が言えなくなる。
      const stopped = disableAffiliateLink(found.value, at);
      if (!stopped.ok) return stopped;

      const saved = await deps.links.disable(actor.workspaceId, id, at);
      if (!saved.ok) return saved;

      /*
        記録は保存の後。**止める前の状態を `before` に残す。**
        止めたあとで「いつまで読者に出ていたか」を問われるのはこの記録だけで、
        リンクの行には最後の状態しか残らない。
      */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.changed",
        targetType: "affiliate_link",
        targetId: input.affiliateLinkId,
        before: { disabledAt: null, host: hostOf(found.value.originalUrl) },
        after: { disabledAt: at.toISOString(), reason },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("リンクは止まっています", appended.error.details));
      }

      /*
        商品名は返さない。**この口は名前を持っていない**（持たせると
        順位づけ側から名前が見える）ので、返すには別の口を引くことになる。
        引いた名前を「止めた対象」として出すと、引き当てを間違えた日に
        「別の商品を止めた」と読める文が画面に出る。ID だけを返す。
      */
      return ok({
        affiliateLinkId: input.affiliateLinkId,
        message:
          "止めました。記事に付けたままでも、公開のときに読者へは出ません。表記を直すときは、受信箱から新しいリンクとして登録し直してください。",
      });
    },
  };
}
