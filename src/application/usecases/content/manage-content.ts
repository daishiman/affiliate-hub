import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { EventPublisherPort } from "@/application/ports/common";
import {
  CONTENT_STATES,
  type ContentPackage,
  type ContentState,
  type ContentVariant,
  type ContentVariantStatus,
  type QualityReport,
  allowedNextStates,
  approveVariant,
  runQualityChecks,
  transition,
} from "@/domain/authoring";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution";
import { can, requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type ContentVariantId,
  type DomainError,
  type Result,
  assertSameTenant,
  buildEvent,
  containsCommercial,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { DomainEventName } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 記事（媒体別の文章）を運ぶユースケース。
 *
 * 仕様の中心は「承認を飛ばして公開できないこと」。
 * 状態の進み方は domain の `transition` が唯一の判断者で、
 * ここでも画面でも if 文を書き足さない。書き足した瞬間に抜け道ができる。
 *
 * 依存は Editorial 印のポートだけ。報酬のポートは型でも実行時でも入らない。
 */
export type ManageContentDeps = {
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly variants: EditorialContentVariantRepositoryPort;
  readonly personas: EditorialPersonaRepositoryPort;
  /**
   * 起きたことの発行先。
   *
   * 記事の文脈から配信や通知の関数を直接呼ばないために置いている。
   * 受け手が増えても、この行より上のコードは変わらない。
   */
  readonly events: EventPublisherPort;
};

/**
 * 起きたことを流す。
 *
 * **流せなかったことを理由に、済んだ操作を失敗にしない。**
 * 承認は保存された時点で成立している。伝達の失敗で承認が消えると、
 * 利用者は「押したのに承認されていない」という最も分かりにくい壊れ方に出会う。
 */
async function emit(
  deps: ManageContentDeps,
  actor: ActorContext,
  name: DomainEventName,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  const event = buildEvent(name, String(actor.workspaceId), new Date(), payload);
  if (!event.ok) return;
  await deps.events.publish(event.value);
}

function guardEditorial(deps: Record<string, unknown>, where: string): void {
  const commercial = containsCommercial(deps);
  if (commercial.length > 0) {
    throw new Error(
      `${where}に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "記事の並びや承認の判断に報酬を入れることはできません。",
    );
  }
}

/** 内部の状態名を、そのまま画面に出さないための対応表。 */
export const CONTENT_STATE_LABEL: Readonly<Record<ContentState, string>> = {
  IDEA: "着想",
  RESEARCHING: "調査中",
  BRIEF_READY: "構成ができた",
  GENERATED: "下書きができた",
  FACT_CHECK: "事実確認中",
  COMPLIANCE_REVIEW: "表示のきまりを確認中",
  APPROVED: "承認済み",
  SCHEDULED: "公開予約済み",
  PUBLISHED: "公開中",
  MONITORING: "様子を見ている",
  REFRESH_DUE: "見直しの時期",
  ARCHIVED: "取り下げ済み",
};

// --- 進行の一覧（かんばん） -------------------------------------------------

export type ContentCard = {
  readonly variantId: string;
  readonly title: string;
  readonly channel: string;
  readonly summary: string;
  readonly complianceStatus: ContentVariant["complianceStatus"];
  readonly factualityScore: number;
};

export type ContentColumn = {
  readonly state: ContentState;
  readonly label: string;
  readonly items: readonly ContentCard[];
  /** この列から進める先。画面はここを見てボタンを出す。 */
  readonly nextStates: readonly { readonly state: ContentState; readonly label: string }[];
  /** 人の操作が要る移動先かどうか。 */
  readonly humanOnlyNext: readonly ContentState[];
};

export type ContentBoard = {
  readonly columns: readonly ContentColumn[];
  readonly total: number;
  /** 1 本も無いときに、無言の空白ではなく理由を出すための一文。 */
  readonly emptyReason: string | null;
};

export type ListContentBoardInput = { readonly limitPerState?: number };

export function createListContentBoardUseCase(
  deps: ManageContentDeps,
): UseCase<ListContentBoardInput, ContentBoard> {
  guardEditorial(deps, "記事の一覧");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const limit = input.limitPerState ?? 20;
      const columns: ContentColumn[] = [];
      let total = 0;

      for (const state of CONTENT_STATES) {
        const listed = await deps.variants.listByState(actor.workspaceId, state, {
          limit,
          cursor: null,
        });
        if (!listed.ok) return listed;

        total += listed.value.items.length;
        const next = allowedNextStates(state);
        columns.push({
          state,
          label: CONTENT_STATE_LABEL[state],
          items: listed.value.items.map(toCard),
          nextStates: next.map((s) => ({ state: s, label: CONTENT_STATE_LABEL[s] })),
          // AI だけでは進められない先。画面で灰色にするのではなく、理由を出すために渡す。
          humanOnlyNext: next.filter((s) => s === "APPROVED" || s === "SCHEDULED" || s === "PUBLISHED"),
        });
      }

      return ok({
        columns,
        total,
        emptyReason:
          total === 0
            ? "まだ記事がありません。商品と根拠を選んで企画を作るところから始めます。"
            : null,
      });
    },
  };
}

function toCard(v: ContentVariant): ContentCard {
  return {
    variantId: String(v.id),
    title: v.title ?? "（見出し未設定）",
    channel: v.channel,
    summary: v.summary,
    complianceStatus: v.complianceStatus,
    factualityScore: v.factualityScore,
  };
}

// --- 記事 1 本 -------------------------------------------------------------

export type GetContentInput = { readonly variantId: string };

export type ContentDetail = {
  readonly variant: ContentVariant;
  readonly package: ContentPackage | null;
  readonly authorName: string | null;
  /** 17 項目の自動確認の結果。実行しなかった項目も理由つきで含む。 */
  readonly quality: QualityReport;
  /** 承認に進めるか。進めない場合は理由。 */
  readonly approvalBlockedReason: string | null;
  /**
   * 配信を作れるか。作れない場合は理由。
   *
   * **画面で判定しない。** 判定を画面へ写すと、REST や AI から呼んだときに
   * 同じ理由が返らず、「画面では出せないのに AI からは出せる」が生まれる。
   * 断る本体は配信のユースケース側にあり、ここは**押す前に伝えるため**の写し。
   */
  readonly publishBlockedReason: string | null;
};

export function createGetContentUseCase(
  deps: ManageContentDeps,
): UseCase<GetContentInput, ContentDetail> {
  guardEditorial(deps, "記事の参照");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;
      const variant = loaded.value;

      const pkg = await deps.packages.findById(actor.workspaceId, variant.contentPackageId);
      if (!pkg.ok) return pkg;

      const persona = await deps.personas.findAuthor(actor.workspaceId, variant.authorPersonaId);
      if (!persona.ok) return persona;
      if (persona.value === null) {
        // 書き手が分からないと「書いてよい範囲」を判定できない。
        // 判定できないまま合格を返さない。
        return err(
          domainError("NOT_FOUND", "この記事の書き手の設定が見つかりません。", {
            suggestedAction: "書き手を選び直してから確認してください。",
          }),
        );
      }

      const capability = CHANNEL_CAPABILITIES[variant.channel as ChannelKind];
      const quality = runQualityChecks({
        variant,
        persona: persona.value,
        constraints: {
          channel: capability?.label ?? variant.channel,
          maxBodyLength: capability?.maxBodyLength ?? null,
          // ハッシュタグの上限は能力表に持っていない。
          // 「上限なし」と偽らず、確認しない項目として扱わせる。
          maxHashtags: null,
          allowsAffiliateLink: capability?.allowsAffiliateLinks ?? false,
          requiresInlineDisclosure: capability?.disclosurePlacement !== "platform_tag",
        },
        hasVerifiedTestRun: persona.value.verifiedExperienceIds.length > 0,
        knownFeatureNames: [],
        existingBodies: [],
        priceCheckedAt: null,
        now: new Date(),
      });

      return ok({
        variant,
        package: pkg.value,
        authorName: persona.value.displayName,
        quality,
        approvalBlockedReason:
          quality.status === "fail"
            ? "自動確認で直すべき指摘が出ています。指摘を解消するまで承認できません。"
            : variant.status === "approved" || variant.status === "published"
              ? "すでに承認済みです。"
              : null,
        publishBlockedReason: publishBlockedReasonFor(actor, variant.status),
      });
    },
  };
}

/**
 * 配信を作れない理由。作れるなら null。
 *
 * 順番は「権限 → 承認」。権限が無い人に「承認してください」と出すと、
 * 承認しても状況が変わらず、直しようのない案内になる。
 */
function publishBlockedReasonFor(actor: ActorContext, status: ContentVariantStatus): string | null {
  if (!can(actor, "content.publish")) {
    return "この記事を出す権限がありません。配信を始められるのは公開の担当だけです。設定の担当者管理で権限を付けてもらってください。";
  }
  if (status !== "approved" && status !== "published") {
    return "承認が済んでいない記事は配信できません。上の自動確認の結果を見て内容を直し、人の目で承認すると、この欄で出し先を選べるようになります。";
  }
  return null;
}

async function loadVariant(
  deps: ManageContentDeps,
  actor: ActorContext,
  variantId: string,
): Promise<Result<ContentVariant, DomainError>> {
  const found = await deps.variants.findById(
    actor.workspaceId,
    taggedString<"ContentVariantId">(variantId) as ContentVariantId,
  );
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "その記事は見つかりませんでした。", {
        suggestedAction: "記事の一覧から選び直してください。",
      }),
    );
  }
  return assertSameTenant(actor, found.value, "記事");
}

// --- 見直しの時期が来たもの -------------------------------------------------

export type ListReviewOverdueInput = { readonly limit?: number };

export type ReviewOverdueOutput = {
  readonly items: readonly ContentCard[];
  readonly emptyReason: string | null;
};

export function createListReviewOverdueUseCase(
  deps: ManageContentDeps,
): UseCase<ListReviewOverdueInput, ReviewOverdueOutput> {
  guardEditorial(deps, "見直し対象の一覧");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.variants.listReviewOverdue(
        actor.workspaceId,
        new Date(),
        input.limit ?? 20,
      );
      if (!listed.ok) return listed;

      return ok({
        items: listed.value.map(toCard),
        emptyReason:
          listed.value.length === 0
            ? "見直しの期日を過ぎた記事はありません。公開済みの記事はすべて期日内です。"
            : null,
      });
    },
  };
}

// --- 状態を進める -----------------------------------------------------------

export type AdvanceContentInput = {
  readonly variantId: string;
  readonly from: ContentState;
  readonly to: ContentState;
};

export type AdvanceContentOutput = {
  readonly variantId: string;
  readonly state: ContentState;
  readonly label: string;
};

/**
 * 状態を進める。
 *
 * 進めてよいかの判断は domain の `transition` だけが持つ。
 * AI サービスアカウントは承認・予約・公開へ進められない（そこで弾かれる）。
 */
export function createAdvanceContentStateUseCase(
  deps: ManageContentDeps,
): UseCase<AdvanceContentInput, AdvanceContentOutput> {
  guardEditorial(deps, "記事の状態変更");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "記事の編集");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;

      const moved = transition(input.from, input.to, actor);
      if (!moved.ok) return moved;

      // 進んだ先そのものが、他の文脈にとっての「起きたこと」になる。
      if (moved.value === "GENERATED") {
        await emit(deps, actor, "content_variant.generated", { variantId: input.variantId });
      }
      if (moved.value === "REFRESH_DUE") {
        await emit(deps, actor, "content.refresh_due", { variantId: input.variantId });
      }

      return ok({
        variantId: input.variantId,
        state: moved.value,
        label: CONTENT_STATE_LABEL[moved.value],
      });
    },
  };
}

// --- 承認 -------------------------------------------------------------------

export type ApproveContentInput = { readonly variantId: string };

export type ApproveContentOutput = {
  readonly variantId: string;
  readonly status: ContentVariant["status"];
};

/**
 * 承認する。
 *
 * `approveVariant` に「人が承認したか」を必ず渡す。
 * ここで `true` を決め打ちにすると AI が単独で承認できてしまうため、
 * 実行している主体が AI サービスアカウントでないことを条件にしている。
 */
export function createApproveContentUseCase(
  deps: ManageContentDeps,
): UseCase<ApproveContentInput, ApproveContentOutput> {
  guardEditorial(deps, "記事の承認");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.approve", "記事の承認");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;

      const approved = approveVariant(loaded.value, !actor.isAiServiceAccount);
      if (!approved.ok) return approved;

      const saved = await deps.variants.save(approved.value);
      if (!saved.ok) return saved;

      await emit(deps, actor, "content_variant.approved", {
        variantId: input.variantId,
        approvedBy: String(actor.userId ?? "unknown"),
      });

      return ok({ variantId: input.variantId, status: saved.value.status });
    },
  };
}
