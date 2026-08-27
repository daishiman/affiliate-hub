import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogOpsRepositoryPort,
} from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  DELIVERY_PARTS,
  DELIVERY_PART_LABEL,
  type DeliveryPart,
  type DeliveryHealthRow,
  deliveryHealth,
  LAYOUT_REGIONS,
  LAYOUT_REGION_LABEL,
  type LayoutRegion,
  SLOT_KEYS_BY_REGION,
  TOP_BANDS,
  sanitizeSlotHtml,
  TOP_BAND_LABEL,
  type TopBand,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ブログの見た目の枠組みの管理。
 *
 * **部品の一覧はドメインが持ち、この層は「その部品に何を入れたか」だけを扱う。**
 * 画面側で部品名を並べ直すと、設計図（docs/spec/13）と画面が別々に育ち、
 * どちらが正しいか誰にも言えなくなる。
 *
 * 未設定の枠を消さずに返すのが要点。消すと「まだ触っていない枠」と
 * 「わざと切った枠」の区別が付かず、抜けに気付けない。
 */
export type ManageBlogLayoutDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageBlogLayoutDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `見た目の枠の管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を枠の並び順の入力にすることはできません。",
    );
  }
}

export type LayoutSlotView = {
  readonly slotKey: string;
  readonly region: LayoutRegion;
  readonly regionLabel: string;
  readonly title: string;
  readonly body: string;
  readonly position: number;
  readonly enabled: boolean;
  /** まだ一度も保存していない枠。「切った」ではなく「未整備」。 */
  readonly untouched: boolean;
};

export type LayoutBandView = {
  readonly band: TopBand;
  readonly label: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly itemLimit: number;
  readonly untouched: boolean;
};

export type DeliveryPartView = {
  readonly part: DeliveryPart;
  readonly label: string;
  readonly enabled: boolean;
  readonly note: string;
  readonly position: number;
  readonly untouched: boolean;
};

export type ReadBlogLayoutInput = { readonly siteSlug: string };

export type ReadBlogLayoutOutput = {
  readonly siteSlug: string;
  readonly slots: readonly LayoutSlotView[];
  readonly bands: readonly LayoutBandView[];
  readonly deliveryParts: readonly DeliveryPartView[];
  /**
   * 配信物を最後に点検した結果 (受入 A9)。
   *
   * `deliveryParts`（出す / 切るの設定）と**並べて返す**。片方だけ返すと、
   * 画面が「入になっている」ことを「出せている」と描いてしまう。
   */
  readonly deliveryHealth: readonly DeliveryHealthRow[];
  /** 一度も保存していない枠の数。画面の「未整備 n 件」に使う。 */
  readonly untouchedCount: number;
};

/** 設計図が数える部品を全部並べ、保存済みの値を重ねる。 */
function mergeSlots(saved: readonly BlogLayoutSlotRecord[]): readonly LayoutSlotView[] {
  const out: LayoutSlotView[] = [];
  for (const region of LAYOUT_REGIONS) {
    const keys = SLOT_KEYS_BY_REGION[region];
    keys.forEach((slotKey, index) => {
      const hit = saved.find((s) => s.region === region && s.slotKey === slotKey);
      out.push({
        slotKey,
        region,
        regionLabel: LAYOUT_REGION_LABEL[region],
        title: hit?.title ?? "",
        body: hit?.body ?? "",
        position: hit?.position ?? index,
        enabled: hit?.enabled ?? false,
        untouched: hit === undefined,
      });
    });
  }
  return out.sort((a, b) =>
    a.region === b.region
      ? a.position - b.position
      : LAYOUT_REGIONS.indexOf(a.region) - LAYOUT_REGIONS.indexOf(b.region),
  );
}

function mergeBands(saved: readonly BlogLayoutBandRecord[]): readonly LayoutBandView[] {
  return TOP_BANDS.map((band, index) => {
    const hit = saved.find((b) => b.band === band);
    return {
      band,
      label: TOP_BAND_LABEL[band],
      title: hit?.title ?? "",
      enabled: hit?.enabled ?? false,
      position: hit?.position ?? index,
      itemLimit: hit?.itemLimit ?? 3,
      untouched: hit === undefined,
    };
  }).sort((a, b) => a.position - b.position);
}

function mergeDelivery(saved: readonly BlogDeliveryPartRecord[]): readonly DeliveryPartView[] {
  return DELIVERY_PARTS.map((part, index) => {
    const hit = saved.find((d) => d.part === part);
    return {
      part,
      label: DELIVERY_PART_LABEL[part],
      enabled: hit?.enabled ?? false,
      note: hit?.note ?? "",
      position: hit?.position ?? index,
      untouched: hit === undefined,
    };
  }).sort((a, b) => a.position - b.position);
}

export function createReadBlogLayoutUseCase(
  deps: ManageBlogLayoutDeps,
): UseCase<ReadBlogLayoutInput, ReadBlogLayoutOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ReadBlogLayoutInput,
    ): Promise<Result<ReadBlogLayoutOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "ブログの見た目の設定の閲覧");
      if (!allowed.ok) return allowed;

      const slots = await deps.repository.listLayoutSlots(actor.workspaceId, input.siteSlug);
      if (!slots.ok) return slots;
      const bands = await deps.repository.listLayoutBands(actor.workspaceId, input.siteSlug);
      if (!bands.ok) return bands;
      const parts = await deps.repository.listDeliveryParts(actor.workspaceId, input.siteSlug);
      if (!parts.ok) return parts;
      const snapshots = await deps.repository.listDeliverySnapshots(
        actor.workspaceId,
        input.siteSlug,
      );
      if (!snapshots.ok) return snapshots;

      const slotViews = mergeSlots(slots.value);
      const bandViews = mergeBands(bands.value);
      const partViews = mergeDelivery(parts.value);

      return ok({
        siteSlug: input.siteSlug,
        slots: slotViews,
        bands: bandViews,
        deliveryParts: partViews,
        deliveryHealth: deliveryHealth(
          parts.value,
          snapshots.value.map((row) => ({
            part: row.part,
            ok: row.ok,
            checkedAt: row.checkedAt,
            detail: row.detail,
          })),
        ),
        untouchedCount:
          slotViews.filter((s) => s.untouched).length +
          bandViews.filter((b) => b.untouched).length +
          partViews.filter((p) => p.untouched).length,
      });
    },
  };
}

export type SaveBlogLayoutSlotInput = {
  readonly siteSlug: string;
  readonly region: LayoutRegion;
  readonly slotKey: string;
  readonly title: string;
  readonly body: string;
  readonly position: number;
  readonly enabled: boolean;
};

export type SaveBlogLayoutSlotOutput = { readonly slotKey: string };

export function createSaveBlogLayoutSlotUseCase(
  deps: ManageBlogLayoutDeps,
): UseCase<SaveBlogLayoutSlotInput, SaveBlogLayoutSlotOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveBlogLayoutSlotInput,
    ): Promise<Result<SaveBlogLayoutSlotOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "ブログの見た目の設定");
      if (!allowed.ok) return allowed;

      if (!SLOT_KEYS_BY_REGION[input.region].includes(input.slotKey)) {
        return err(
          validationError(
            `「${LAYOUT_REGION_LABEL[input.region]}」に置ける部品の一覧に「${input.slotKey}」がありません。部品を増やすなら設計図（docs/spec/13）の側から増やしてください。`,
            "slotKey",
          ),
        );
      }

      const saved = await deps.repository.listLayoutSlots(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const existing = saved.value.find(
        (s) => s.region === input.region && s.slotKey === input.slotKey,
      );

      const put = await deps.repository.saveLayoutSlot(actor.workspaceId, {
        id: existing?.id ?? `bls_${deps.ids.newId()}`,
        siteSlug: input.siteSlug,
        region: input.region,
        slotKey: input.slotKey,
        title: input.title.trim(),
        // **保存の時点で削る。**描く側で削ると、描く場所が増えるたびに削り忘れが
        // 1 か所ずつ増え、忘れても画面は正しく見えるので気づけない。
        // 枠の種類で分けていないのは、分けた瞬間に「新しく増えた枠を足し忘れる」
        // という抜け道ができるため。素の文はここを素通りする（削られない）。
        body: sanitizeSlotHtml(input.body),
        position: input.position,
        enabled: input.enabled,
      });
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_layout.changed",
        targetType: "blog_layout_slot",
        targetId: `${input.siteSlug}:${input.region}:${input.slotKey}`,
        before: existing ? { enabled: existing.enabled, position: existing.position } : null,
        after: { enabled: input.enabled, position: input.position },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("枠の設定を保存しました", { slotKey: input.slotKey }));
      }

      return ok({ slotKey: input.slotKey });
    },
  };
}

export type SaveBlogLayoutBandInput = {
  readonly siteSlug: string;
  readonly band: TopBand;
  readonly title: string;
  readonly enabled: boolean;
  readonly position: number;
  readonly itemLimit: number;
};

export type SaveBlogLayoutBandOutput = { readonly band: TopBand };

export function createSaveBlogLayoutBandUseCase(
  deps: ManageBlogLayoutDeps,
): UseCase<SaveBlogLayoutBandInput, SaveBlogLayoutBandOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveBlogLayoutBandInput,
    ): Promise<Result<SaveBlogLayoutBandOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "トップの帯の設定");
      if (!allowed.ok) return allowed;

      if (!Number.isInteger(input.itemLimit) || input.itemLimit < 0 || input.itemLimit > 24) {
        return err(
          validationError(
            "帯に並べる件数は 0〜24 の整数で入れてください。0 は『帯ごと出さない』の意味になります。",
            "itemLimit",
          ),
        );
      }

      const saved = await deps.repository.listLayoutBands(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const existing = saved.value.find((b) => b.band === input.band);

      const put = await deps.repository.saveLayoutBand(actor.workspaceId, {
        id: existing?.id ?? `blb_${deps.ids.newId()}`,
        siteSlug: input.siteSlug,
        band: input.band,
        title: input.title.trim(),
        enabled: input.enabled,
        position: input.position,
        itemLimit: input.itemLimit,
      });
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_layout.changed",
        targetType: "blog_layout_band",
        targetId: `${input.siteSlug}:${input.band}`,
        before: existing ? { enabled: existing.enabled, itemLimit: existing.itemLimit } : null,
        after: { enabled: input.enabled, itemLimit: input.itemLimit },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("帯の設定を保存しました", { band: input.band }));
      }

      return ok({ band: input.band });
    },
  };
}

export type SaveDeliveryPartInput = {
  readonly siteSlug: string;
  readonly part: DeliveryPart;
  readonly enabled: boolean;
  readonly note: string;
  readonly position: number;
};

export type SaveDeliveryPartOutput = { readonly part: DeliveryPart };

export function createSaveDeliveryPartUseCase(
  deps: ManageBlogLayoutDeps,
): UseCase<SaveDeliveryPartInput, SaveDeliveryPartOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveDeliveryPartInput,
    ): Promise<Result<SaveDeliveryPartOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "配信部品の設定");
      if (!allowed.ok) return allowed;

      const saved = await deps.repository.listDeliveryParts(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const existing = saved.value.find((d) => d.part === input.part);

      const put = await deps.repository.saveDeliveryPart(actor.workspaceId, {
        id: existing?.id ?? `bdp_${deps.ids.newId()}`,
        siteSlug: input.siteSlug,
        part: input.part,
        enabled: input.enabled,
        note: input.note.trim(),
        position: input.position,
      });
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_delivery.changed",
        targetType: "blog_delivery_part",
        targetId: `${input.siteSlug}:${input.part}`,
        before: existing ? { enabled: existing.enabled } : null,
        after: { enabled: input.enabled },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`「${DELIVERY_PART_LABEL[input.part]}」の設定を保存しました`, {
            part: input.part,
          }),
        );
      }

      return ok({ part: input.part });
    },
  };
}
