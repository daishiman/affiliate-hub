import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import { CONTENT_ANGLES, FUNNEL_STAGES, canStartGeneration, selectRepresentativeCells, type ContentAngle, type ContentPackage, type FunnelStage, type MatrixCell } from "@/domain/authoring/content-package";
import type { ContentVariant } from "@/domain/authoring/content-variant";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution/channel";
import { requireCapability } from "@/domain/identity";
import {
  type ContentPackageId,
  type DomainError,
  type Result,
  err,
  notFound,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import {
  assertContentPackageBrandScope,
  filterContentVariantsByBrandScope,
} from "../content/content-brand-access";

/**
 * 生成マトリクス（プラットフォーム層 §15.4・§22.5）。
 *
 * **同じ事実から、届け先ごとに書き分けるための表。**
 * 行は「誰に / どの切り口で / 購買のどの段階で」、列は媒体。
 * 全部の組み合わせを作ると 100 を優に超えるので、
 * 代表だけを選び、利用者が上限を決める（§15.4）。
 *
 * ここは Editorial 区分。**報酬のつなぎ目は受け取らない。**
 * どのセルを作るかを報酬額で決めると、記事の並びが広告の並びになる。
 */
export type PlanGenerationMatrixDeps = {
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly variants: EditorialContentVariantRepositoryPort;
  readonly personas: EditorialPersonaRepositoryPort;
  readonly affiliateLinks?: never;
};

/** 表の行に使う軸 (§22.5)。列は常に媒体。 */
export const MATRIX_ROW_AXES = ["audience", "angle", "funnel"] as const;
export type MatrixRowAxis = (typeof MATRIX_ROW_AXES)[number];

/**
 * 指定が無いときの行の軸と生成数の上限。
 *
 * 画面（`app/admin/content/matrix/page.tsx`）が同じ 2 つを素の字で書き写していた。
 * 画面は値を明示して渡すので、いまは**画面の側の既定だけが効いている**。
 * 名前を付けて両方から読ませると、片方だけ動かしたときに食い違いが表に出る。
 */
export const DEFAULT_MATRIX_ROW_AXIS: MatrixRowAxis = "audience";
export const DEFAULT_MATRIX_LIMIT = 12;

export const MATRIX_ROW_AXIS_LABEL: Readonly<Record<MatrixRowAxis, string>> = {
  audience: "読者",
  angle: "切り口",
  funnel: "購買段階",
};

/**
 * 列に出す媒体 (§22.5)。
 *
 * 順序も仕様どおりに固定する。画面ごとに並べ替えると、
 * 「いつも同じ位置にある列」という手がかりが失われる。
 */
export const MATRIX_CHANNELS: readonly ChannelKind[] = [
  "own_site",
  "x",
  "instagram",
  "threads",
  "note",
  "tiktok",
  "youtube",
];

export const ANGLE_LABEL: Readonly<Record<ContentAngle, string>> = {
  conclusion_first: "結論先出し",
  problem_first: "悩み起点",
  experience_first: "体験起点",
  data_first: "データ起点",
  comparison_first: "比較起点",
  beginner: "初心者向け",
  expert: "専門家向け",
  budget: "予算重視",
  drawback: "デメリット重視",
  surprise: "意外性",
  story: "ストーリー",
  seasonal: "季節",
  use_case: "用途",
  faq: "FAQ",
  paradox: "逆説",
  checklist: "チェックリスト",
};

export const FUNNEL_LABEL: Readonly<Record<FunnelStage, string>> = {
  awareness: "困りごとに気づく",
  consideration: "候補を比べる",
  decision: "決める",
  retention: "使い続ける",
};

/**
 * セルの状態。
 *
 * **「無い」を 1 種類にしない。** 作っていないのか、作れないのかで
 * 次にやることが全く違う。同じ空欄に見せると利用者は待ってしまう。
 */
export type MatrixCellState =
  | "generated" // すでに文章がある
  | "planned" // 今回の代表に選ばれた（これから作る）
  | "not_planned" // 組み合わせとしては有効だが、今回は作らない
  | "unavailable"; // その媒体では作れない

export const MATRIX_CELL_STATE_LABEL: Readonly<Record<MatrixCellState, string>> = {
  generated: "作成済み",
  planned: "今回作る",
  not_planned: "今回は作らない",
  unavailable: "この媒体では作れません",
};

export type MatrixCellView = {
  readonly rowId: string;
  readonly channel: ChannelKind;
  readonly channelLabel: string;
  readonly state: MatrixCellState;
  readonly stateLabel: string;
  /** その状態である理由。空欄のまま出さない。 */
  readonly reason: string;
  /** 作成済みのときだけ入る。画面から記事へ跳ぶための値。 */
  readonly variantId: string | null;
  readonly variantStatusLabel: string | null;
};

export type MatrixRowView = {
  readonly rowId: string;
  readonly label: string;
  /** その行が何を意味するかの補足。読者名だけでは意図が伝わらない。 */
  readonly note: string;
  readonly cells: readonly MatrixCellView[];
};

export type MatrixChannelView = {
  readonly channel: ChannelKind;
  readonly label: string;
  readonly publishNote: string;
  readonly maxBodyLength: number | null;
  readonly allowsBodyLinks: boolean;
  readonly allowsAffiliateLinks: boolean;
};

export type GetGenerationMatrixInput = {
  readonly packageId: string;
  readonly rowAxis?: MatrixRowAxis;
  /** 生成数の上限 (§15.4「利用者が生成数の上限を指定する」)。 */
  readonly limit?: number;
};

export type GetGenerationMatrixOutput = {
  readonly packageId: string;
  /**
   * この企画が主題にしている商品。
   *
   * 画面が「1 商品を複数ブログ向けに書き分ける」導線 (A5) を出すのに要る。
   * 画面側で企画をもう一度引かせない——引かせると、企画を引く条件が
   * 2 か所に分かれ、片方だけが会社の絞り込みを忘れられる。
   */
  readonly primarySubjectId: string;
  readonly objective: string;
  readonly rowAxis: MatrixRowAxis;
  readonly rowAxisLabel: string;
  readonly limit: number;
  readonly channels: readonly MatrixChannelView[];
  readonly rows: readonly MatrixRowView[];
  /** 全組み合わせ数。上限との差が「作らない分」。 */
  readonly totalCombinations: number;
  readonly plannedCount: number;
  readonly generatedCount: number;
  /**
   * 生成に進めないときの理由 (§15.1)。
   * null なら進める。空配列と null を混同させないため null を使う。
   */
  readonly blockedReason: string | null;
  readonly missingInputs: readonly string[];
};

const VARIANT_STATUS_LABEL: Readonly<Record<ContentVariant["status"], string>> = {
  generated: "下書き",
  review: "確認中",
  approved: "承認済み",
  rejected: "差し戻し",
  published: "公開済み",
};

/** その行の識別子。軸によって意味が変わるので、作る場所を 1 つにする。 */
function rowIdsFor(axis: MatrixRowAxis, pkg: ContentPackage): readonly string[] {
  switch (axis) {
    case "audience":
      return pkg.audiencePersonaIds.map(String);
    case "angle":
      // 企画で選んだ切り口を先に、残りは「今回は作らない」行として後ろに出す。
      // 選ばなかった切り口を隠すと、選び直せることに気づけない。
      return [
        ...pkg.contentAngles.map(String),
        ...CONTENT_ANGLES.filter((a) => !pkg.contentAngles.includes(a)),
      ];
    case "funnel":
      return [...FUNNEL_STAGES];
  }
}

export function createGetGenerationMatrixUseCase(
  deps: PlanGenerationMatrixDeps,
): UseCase<GetGenerationMatrixInput, GetGenerationMatrixOutput> {
  return {
    async execute(actor, input): Promise<Result<GetGenerationMatrixOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "生成マトリクス");
      if (!allowed.ok) return allowed;

      const axis: MatrixRowAxis = input.rowAxis ?? DEFAULT_MATRIX_ROW_AXIS;
      const limit = input.limit ?? DEFAULT_MATRIX_LIMIT;
      if (limit <= 0) {
        return err(validationError("生成数の上限は 1 以上で指定してください。", "limit"));
      }

      const found = await deps.packages.findById(
        actor.workspaceId,
        taggedString<"ContentPackageId">(input.packageId) as ContentPackageId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("企画", input.packageId));
      const pkg = found.value;
      const scoped = assertContentPackageBrandScope(actor, pkg, "企画");
      if (!scoped.ok) return err(scoped.error);

      const existing = await deps.variants.listByPackage(actor.workspaceId, pkg.id);
      if (!existing.ok) return existing;
      const visibleExisting = await filterContentVariantsByBrandScope(
        deps.packages,
        actor,
        existing.value,
      );
      if (!visibleExisting.ok) return visibleExisting;

      // 代表の選び方は domain の関数に任せる。画面ごとに選び直さない。
      const channelNames = MATRIX_CHANNELS.map(String);
      const selected = selectRepresentativeCells(pkg, channelNames, limit);
      const plannedCells: readonly MatrixCell[] = selected.ok ? selected.value : [];

      const readiness = canStartGeneration(pkg);
      const missingInputs = readiness.ok
        ? []
        : readiness.error.message.split(": ")[1]?.split(" / ") ?? [];

      // 読者名を引く。ID のまま表に出すと、誰向けの行か分からない。
      const audienceNames = new Map<string, string>();
      if (axis === "audience") {
        for (const id of pkg.audiencePersonaIds) {
          const persona = await deps.personas.findAudience(actor.workspaceId, id);
          audienceNames.set(String(id), persona.ok && persona.value ? persona.value.name : String(id));
        }
      }

      const rows: MatrixRowView[] = rowIdsFor(axis, pkg).map((rowId) => {
        const cells: MatrixCellView[] = MATRIX_CHANNELS.map((channel) => {
          const capability = CHANNEL_CAPABILITIES[channel];

          const variant = visibleExisting.value.find(
            (v) => v.channel === String(channel) && matchesRow(v, axis, rowId, pkg),
          );
          if (variant !== undefined) {
            return {
              rowId,
              channel,
              channelLabel: capability.label,
              state: "generated" as const,
              stateLabel: MATRIX_CELL_STATE_LABEL.generated,
              reason: `${VARIANT_STATUS_LABEL[variant.status]}の文章があります。`,
              variantId: String(variant.id),
              variantStatusLabel: VARIANT_STATUS_LABEL[variant.status],
            };
          }

          const planned = plannedCells.some(
            (cell) => cell.channel === String(channel) && matchesPlannedRow(cell, axis, rowId, pkg),
          );
          if (planned) {
            return {
              rowId,
              channel,
              channelLabel: capability.label,
              state: "planned" as const,
              stateLabel: MATRIX_CELL_STATE_LABEL.planned,
              reason: "目的が重ならない代表の組み合わせとして選ばれています。",
              variantId: null,
              variantStatusLabel: null,
            };
          }

          return {
            rowId,
            channel,
            channelLabel: capability.label,
            state: "not_planned" as const,
            stateLabel: MATRIX_CELL_STATE_LABEL.not_planned,
            reason: `上限 ${limit} 本に収めるため、今回は選ばれていません。上限を上げると対象になります。`,
            variantId: null,
            variantStatusLabel: null,
          };
        });

        return { rowId, label: rowLabel(axis, rowId, audienceNames), note: rowNote(axis, rowId, pkg), cells };
      });

      const flat = rows.flatMap((r) => r.cells);
      return ok({
        packageId: String(pkg.id),
        primarySubjectId: String(pkg.primarySubjectId),
        objective: pkg.objective,
        rowAxis: axis,
        rowAxisLabel: MATRIX_ROW_AXIS_LABEL[axis],
        limit,
        channels: MATRIX_CHANNELS.map((channel) => {
          const c = CHANNEL_CAPABILITIES[channel];
          return {
            channel,
            label: c.label,
            // note には公開された投稿用 API が無い。「直接公開」と書かない (§17)。
            publishNote:
              c.publishMode === "manual_export"
                ? "下書きを書き出して、人が貼り付けます。"
                : c.publishMode === "api_schedule"
                  ? "予約して自動で出せます。"
                  : "自動で出せます。",
            maxBodyLength: c.maxBodyLength,
            allowsBodyLinks: c.allowsBodyLinks,
            allowsAffiliateLinks: c.allowsAffiliateLinks,
          };
        }),
        rows,
        totalCombinations:
          pkg.audiencePersonaIds.length * pkg.contentAngles.length * MATRIX_CHANNELS.length,
        plannedCount: flat.filter((c) => c.state === "planned").length,
        generatedCount: flat.filter((c) => c.state === "generated").length,
        blockedReason: readiness.ok
          ? null
          : (readiness.error.suggestedAction ?? readiness.error.message),
        missingInputs,
      });
    },
  };
}

/** すでにある文章が、その行に当てはまるか。 */
function matchesRow(
  variant: ContentVariant,
  axis: MatrixRowAxis,
  rowId: string,
  pkg: ContentPackage,
): boolean {
  switch (axis) {
    case "audience":
      return String(variant.audiencePersonaId) === rowId;
    case "angle":
      return String(variant.angle) === rowId;
    case "funnel":
      // 購買段階は企画が持つ。文章側には無いので、企画の段階の行にだけ置く。
      return String(pkg.funnelStage) === rowId;
  }
}

/** これから作る代表が、その行に当てはまるか。 */
function matchesPlannedRow(
  cell: MatrixCell,
  axis: MatrixRowAxis,
  rowId: string,
  pkg: ContentPackage,
): boolean {
  switch (axis) {
    case "audience":
      return String(cell.audiencePersonaId) === rowId;
    case "angle":
      return String(cell.angle) === rowId;
    case "funnel":
      return String(pkg.funnelStage) === rowId;
  }
}

function rowLabel(axis: MatrixRowAxis, rowId: string, audienceNames: Map<string, string>): string {
  switch (axis) {
    case "audience":
      return audienceNames.get(rowId) ?? rowId;
    case "angle":
      return ANGLE_LABEL[rowId as ContentAngle] ?? rowId;
    case "funnel":
      return FUNNEL_LABEL[rowId as FunnelStage] ?? rowId;
  }
}

function rowNote(axis: MatrixRowAxis, rowId: string, pkg: ContentPackage): string {
  switch (axis) {
    case "audience":
      return "この読者に向けて書き分けます。";
    case "angle":
      return pkg.contentAngles.map(String).includes(rowId)
        ? "この企画で選んだ切り口です。"
        : "この企画では選んでいない切り口です。使うなら企画に足してください。";
    case "funnel":
      return String(pkg.funnelStage) === rowId
        ? "この企画が狙っている段階です。"
        : "この企画では狙っていない段階です。別の企画として立てます。";
  }
}
