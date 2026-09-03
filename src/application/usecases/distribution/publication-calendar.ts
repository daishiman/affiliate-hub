import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { EditorialContentPackageRepositoryPort } from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  ChannelConnectionRepositoryPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import {
  CHANNEL_CAPABILITIES,
  type ChannelKind,
  type Publication,
  type PublicationState,
  RESCHEDULABLE_PUBLICATION_STATES,
  changePublicationSchedule,
  publicationMutationConflict,
} from "@/domain/distribution";
import { can, requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type BrandId,
  type DomainError,
  type PublicationId,
  type Result,
  assertSameTenant,
  buildEvent,
  coversBrandScope,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { EventPublisherPort } from "@/application/ports/common";
import type { UseCase } from "../usecase";
import {
  PUBLICATION_STATE_LABEL,
  listAllChannelConnections,
} from "./manage-distribution";
import {
  ensurePublicationBrandAccess,
  publicationListScopeOf,
  type PublicationBrandAccessDeps,
} from "./publication-brand-access";

/**
 * 投稿カレンダー (§22.7)。
 *
 * 一覧ではなく日付で並べる理由は 1 つだけ ——
 * **「同じ日に同じ媒体へ寄せてしまった」を出す前に見つけるため。**
 * 表で見ると気づけない偏りが、日付で並べると一目で分かる。
 *
 * 仕様の「ドラッグによる日時変更」は、日付の入力欄による変更として作った。
 * 掴んで動かす操作はキーボードだけでは行えず、
 * 予約日をずらせる人が限られてしまう。掴む操作を後から足すことはできるが、
 * その場合も**この入力欄を残したまま**足す（どちらでも同じユースケースを呼ぶ）。
 */
export type PublicationCalendarDeps = {
  readonly publications: PublicationRepositoryPort;
  readonly connections: ChannelConnectionRepositoryPort;
  readonly contentVariants: EditorialContentVariantRepositoryPort;
  readonly contentPackages: EditorialContentPackageRepositoryPort;
  /**
   * 起きたことを他の文脈へ伝える口。
   * 配信の文脈から記事の文脈の保存処理を直接呼ばないため、ここを通す。
   */
  readonly events: EventPublisherPort;
  /** 操作の記録。予定日を動かすと、前倒しにすれば今日出せてしまう。 */
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
};

function brandAccessDeps(deps: PublicationCalendarDeps): PublicationBrandAccessDeps {
  return {
    contentVariants: deps.contentVariants,
    contentPackages: deps.contentPackages,
  };
}

/**
 * 予定日を動かしたことを記録する。
 *
 * 一覧の上では小さな操作に見えるが、**前倒しにすればその日に外へ出る**。
 * 出たあとで「誰がその日に変えたか」を辿れないと、範囲を確定できない。
 *
 * 語は配信の予約・取りやめと同じ `publication.schedule_changed` を使う。
 * 予定日を外した場合は `after` が null になり、それが「指定なし」を表す。
 */
async function recordScheduleChange(
  deps: PublicationCalendarDeps,
  actor: ActorContext,
  input: {
    readonly publicationId: string;
    readonly before: Date | null;
    readonly after: Date | null;
  },
): Promise<Result<void, DomainError>> {
  const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
    action: "publication.schedule_changed",
    targetType: "publication",
    targetId: input.publicationId,
    before: { scheduledAt: input.before?.toISOString() ?? null },
    after: { scheduledAt: input.after?.toISOString() ?? null },
  });
  if (!entry.ok) return entry;
  const appended = await deps.auditLog.append(entry.value);
  if (!appended.ok) {
    return err(auditWriteFailure("予定日は変わっています", appended.error.details));
  }
  return ok(undefined);
}

/** 承認の進み具合。記事側の状態を、配信の言葉に言い換えたもの。 */
export const APPROVAL_LABEL: Readonly<Record<string, string>> = {
  generated: "下書きのまま（承認前）",
  review: "確認中（承認前）",
  approved: "承認済み",
  rejected: "差し戻し",
  published: "公開済み",
};

export type CalendarEntry = {
  readonly publicationId: string;
  /** 媒体 (§22.7 その1)。 */
  readonly channelKind: ChannelKind;
  readonly channelLabel: string;
  /** アカウント (§22.7 その2)。未接続なら理由を入れる。 */
  readonly accountLabel: string;
  /** 投稿予定 (§22.7 その3)。 */
  readonly scheduledAt: Date | null;
  readonly scheduledLabel: string;
  /** 承認状態 (§22.7 その4)。 */
  readonly approvalLabel: string;
  /** 承認前かどうか。承認前のまま予約されているものは出る前に気づきたい。 */
  readonly awaitingApproval: boolean;
  /** キャンペーン (§22.7 その5)。ひも付いていなければ null。 */
  readonly campaignId: string | null;
  /** コンテンツパッケージ (§22.7 その6)。 */
  readonly packageId: string | null;
  readonly title: string;
  readonly state: PublicationState;
  readonly stateLabel: string;
  /** エラー (§22.7 その7)。 */
  readonly errorMessage: string | null;
  /** 日時を変えられるか。公開済み・取りやめ済みは変えられない。 */
  readonly reschedulable: boolean;
  readonly notReschedulableReason: string | null;
  readonly href: string;
};

export type CalendarDay = {
  /** YYYY-MM-DD。 */
  readonly date: string;
  readonly dayOfMonth: number;
  /** 0=日曜。週の並びを画面で数え直さないために持たせる。 */
  readonly weekday: number;
  readonly isToday: boolean;
  readonly entries: readonly CalendarEntry[];
  /**
   * その日に気をつけることの説明。
   * 同じ媒体に寄っている・承認前が混ざっている、を言葉で出す。
   */
  readonly warnings: readonly string[];
};

export type PublicationCalendarView = {
  /** YYYY-MM。 */
  readonly month: string;
  readonly monthLabel: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly days: readonly CalendarDay[];
  /** 予定日が入っていない配信。カレンダーに置き場所が無いので別に出す。 */
  readonly undated: readonly CalendarEntry[];
  readonly totalEntries: number;
  readonly errorCount: number;
  readonly awaitingApprovalCount: number;
  /** 予定日を動かせる人か。false なら画面は変更の欄を出さず、理由を出す。 */
  readonly canReschedule: boolean;
  readonly cannotRescheduleReason: string | null;
  readonly emptyReason: string | null;
};

export type GetPublicationCalendarInput = {
  /** YYYY-MM。省略すると今月。 */
  readonly month?: string;
  /** 試験用の基準時刻。 */
  readonly at?: Date;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthOf(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthOf(d);
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * 日時を変えてよい状態はdomainの正本を参照する。
 *
 * 状態の戻し先とretryAtの設定も `changePublicationSchedule` が持つ。
 * 画面側で写経すると、FAILED_SENDを再試行へ戻してもworkerが拾う時刻だけ
 * nullのまま、という到達不能を作れるためである。
 *
 * 取りやめ済み (CANCELLED) と公開済み (PUBLISHED) はどちらも行き止まり。
 * 日時を入れ直しても出ないので、変えられる側に入れない。
 */
/** 権限が無い人に見せる理由。押せないボタンだけを置かないための文。 */
const NO_PUBLISH_PERMISSION =
  "予定日を変える権限がありません。公開の担当者に日時の変更を依頼してください。";

function reschedulableReason(state: PublicationState): string | null {
  if (RESCHEDULABLE_PUBLICATION_STATES.includes(state)) return null;
  if (state === "PUBLISHED") return "すでに公開されているため、予定日は変えられません。";
  if (state === "CANCELLED") {
    return "取りやめた配信です。出し直す場合は、記事の進行から配信をやり直してください。";
  }
  if (state === "SENDING" || state === "RENDERING" || state === "VALIDATING") {
    return "いま送信の処理中です。終わるまで予定日は変えられません。";
  }
  return `「${PUBLICATION_STATE_LABEL[state]}」の状態では予定日を変えられません。`;
}

export function createGetPublicationCalendarUseCase(
  deps: PublicationCalendarDeps,
): UseCase<GetPublicationCalendarInput, PublicationCalendarView> {
  return {
    async execute(
      actor: ActorContext,
      input: GetPublicationCalendarInput,
    ): Promise<Result<PublicationCalendarView, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "投稿カレンダーの参照");
      if (!allowed.ok) return allowed;

      const at = input.at ?? new Date();
      const month = input.month ?? monthOf(at);
      if (!MONTH_PATTERN.test(month)) {
        return err(validationError("月は 2026-08 の形で指定してください。", "month"));
      }

      const [year, monthNumber] = month.split("-").map(Number);
      const fromInclusive = new Date(Date.UTC(year, monthNumber - 1, 1));
      const toExclusive = new Date(Date.UTC(year, monthNumber, 1));
      const mayRevealConnectionDetails = (actor.scopedBrandIds?.length ?? 0) === 0;
      const listed = await deps.publications.listForCalendar(
        actor.workspaceId,
        fromInclusive,
        toExclusive,
        publicationListScopeOf(actor),
      );
      if (!listed.ok) return listed;

      // ChannelConnection は brandId を持たない workspace 共通資源。限定担当者の
      // カレンダーでは保存先自体を読まず、許可ブランドの配信にも名称を出さない。
      const connections = mayRevealConnectionDetails
        ? await listAllChannelConnections(deps.connections, actor.workspaceId)
        : null;

      // 媒体ごとの接続名。1 件ずつ問い合わせると配信の数だけ往復する。
      const accountOf = new Map<string, string>();
      if (connections?.ok === true) {
        for (const c of connections.value) {
          if (!accountOf.has(String(c.id))) accountOf.set(String(c.id), c.accountLabel);
        }
      }

      /**
       * 予定日を動かせる人かどうかを、ここで 1 度だけ見る。
       * 画面に「変える」欄を出してから断るのではなく、
       * 出せない理由を先に返す。押せない操作を並べても、次の一手が決まらない。
       */
      const mayReschedule = can(actor, "content.publish");

      const resolvedEntries = await Promise.all(
        listed.value.map((p) =>
          toEntry(
            deps,
            actor,
            p,
            accountOf,
            mayReschedule,
            mayRevealConnectionDetails,
          ),
        ),
      );
      const entries = resolvedEntries.filter(
        (entry): entry is CalendarEntry => entry !== null,
      );

      const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      const todayKey = dateKey(at);

      const inMonth = entries.filter(
        (e) => e.scheduledAt !== null && dateKey(e.scheduledAt).startsWith(month),
      );

      const days: CalendarDay[] = [];
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(Date.UTC(year, monthNumber - 1, day));
        const key = dateKey(date);
        const dayEntries = inMonth.filter(
          (e) => e.scheduledAt !== null && dateKey(e.scheduledAt) === key,
        );

        const warnings: string[] = [];
        const byChannel = new Map<ChannelKind, number>();
        for (const e of dayEntries) byChannel.set(e.channelKind, (byChannel.get(e.channelKind) ?? 0) + 1);
        for (const [kind, count] of byChannel) {
          if (count >= 3) {
            warnings.push(
              `${CHANNEL_CAPABILITIES[kind].label}へ同じ日に${count}件出す予定です。読者には連投に見えます。`,
            );
          }
        }
        const awaiting = dayEntries.filter((e) => e.awaitingApproval).length;
        if (awaiting > 0) {
          warnings.push(`${awaiting}件が、まだ承認されていないまま予約されています。`);
        }
        const failed = dayEntries.filter((e) => e.errorMessage !== null).length;
        if (failed > 0) warnings.push(`${failed}件が失敗したまま止まっています。`);

        days.push({
          date: key,
          dayOfMonth: day,
          weekday: date.getUTCDay(),
          isToday: key === todayKey,
          entries: dayEntries,
          warnings,
        });
      }

      const undated = entries.filter((e) => e.scheduledAt === null);

      return ok({
        month,
        monthLabel: `${year}年${monthNumber}月`,
        previousMonth: shiftMonth(month, -1),
        nextMonth: shiftMonth(month, 1),
        days,
        undated,
        totalEntries: inMonth.length + undated.length,
        errorCount: inMonth.filter((e) => e.errorMessage !== null).length,
        awaitingApprovalCount: inMonth.filter((e) => e.awaitingApproval).length,
        canReschedule: mayReschedule,
        cannotRescheduleReason: mayReschedule ? null : NO_PUBLISH_PERMISSION,
        emptyReason:
          inMonth.length === 0 && undated.length === 0
            ? `${year}年${monthNumber}月に予定されている投稿はありません。記事を承認すると、ここに並びます。`
            : null,
      });
    },
  };
}

/**
 * 1 件を、カレンダーに置ける形に直す。
 *
 * 記事とパッケージの取得に失敗しても、その 1 件を消さない。
 * 消すと「予約したはずの投稿がカレンダーに無い」という最悪の見え方になる。
 */
async function toEntry(
  deps: PublicationCalendarDeps,
  actor: ActorContext,
  p: Publication,
  accountOf: ReadonlyMap<string, string>,
  mayReschedule: boolean,
  mayRevealConnectionDetails: boolean,
): Promise<CalendarEntry | null> {
  const variant = await deps.contentVariants.findById(actor.workspaceId, p.variantId);
  const found = variant.ok ? variant.value : null;

  let campaignId: string | null = null;
  let packageId: string | null = null;
  let packageBrandId: BrandId | null = null;
  if (found !== null) {
    packageId = String(found.contentPackageId);
    const pkg = await deps.contentPackages.findById(actor.workspaceId, found.contentPackageId);
    if (pkg.ok && pkg.value !== null && assertSameTenant(actor, pkg.value, "この企画").ok) {
      packageBrandId = taggedString<"BrandId">(pkg.value.brandId) as BrandId;
      if (pkg.value.campaignId !== null) campaignId = String(pkg.value.campaignId);
    }
  }

  // 限定担当者にだけは、表示用の欠損補完より所有確認を優先する。記事・親企画・
  // brandId のどこかを辿れない配信は、題名なしの行として存在を知らせず隠す。
  if ((actor.scopedBrandIds?.length ?? 0) > 0) {
    if (found === null || !assertSameTenant(actor, found, "この記事").ok) return null;
    if (packageBrandId === null || !coversBrandScope(actor, packageBrandId)) return null;
  }

  const approvalKey = found?.status ?? "unknown";
  // 権限を先に見る。状態の説明より前に出さないと、
  //「今なら変えられます」と読めてしまう。
  const blockedReason = mayReschedule ? reschedulableReason(p.state) : NO_PUBLISH_PERMISSION;
  return {
    publicationId: String(p.id),
    channelKind: p.channelKind,
    channelLabel: CHANNEL_CAPABILITIES[p.channelKind].label,
    accountLabel:
      p.connectionId === null
        ? "接続先のアカウントの指定なし"
        : !mayRevealConnectionDetails
          ? "接続先の詳細は、ブランド限定担当者には表示されません"
          : (accountOf.get(String(p.connectionId)) ?? "接続が見つかりません"),
    scheduledAt: p.scheduledAt,
    scheduledLabel:
      p.scheduledAt === null
        ? "日時の指定なし（承認され次第すぐに出ます）"
        : p.scheduledAt.toLocaleString("ja-JP"),
    approvalLabel: APPROVAL_LABEL[approvalKey] ?? "記事の状態を取得できませんでした",
    awaitingApproval: approvalKey === "generated" || approvalKey === "review",
    campaignId,
    packageId,
    title: found?.title ?? found?.summary ?? "題名のない記事",
    state: p.state,
    stateLabel: PUBLICATION_STATE_LABEL[p.state],
    errorMessage: p.lastError,
    reschedulable: blockedReason === null,
    notReschedulableReason: blockedReason,
    href: `/admin/distribution/${encodeURIComponent(String(p.id))}`,
  };
}

// --- 予定日の変更 -----------------------------------------------------------

export type ReschedulePublicationInput = {
  readonly publicationId: string;
  /** YYYY-MM-DDTHH:mm 形式。空にすると「日時の指定なし」に戻す。 */
  readonly scheduledAt: string;
};

export type ReschedulePublicationOutput = {
  readonly publicationId: string;
  readonly scheduledLabel: string;
  readonly message: string;
};

/**
 * 予定日を変える。
 *
 * 過去の日時は受け付けない。過去に置くと「出るはずなのに出ない」ものが
 * カレンダーの後ろへ埋もれ、誰も気づかないまま止まる。
 */
export function createReschedulePublicationUseCase(
  deps: PublicationCalendarDeps,
): UseCase<ReschedulePublicationInput, ReschedulePublicationOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ReschedulePublicationInput,
    ): Promise<Result<ReschedulePublicationOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "投稿予定日の変更");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "その配信が見つかりません。", {
            suggestedAction: "配信の一覧から選び直してください。",
          }),
        );
      }

      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;
      const scoped = await ensurePublicationBrandAccess(
        brandAccessDeps(deps),
        actor,
        found.value,
      );
      if (!scoped.ok) return scoped;

      const blocked = reschedulableReason(found.value.state);
      if (blocked !== null) {
        return err(domainError("CONFLICT", blocked, { field: "scheduledAt" }));
      }

      if (input.scheduledAt.trim() === "") {
        const cleared = changePublicationSchedule(found.value, null, new Date());
        if (!cleared.ok) return cleared;
        const saved = await deps.publications.compareAndSwap(found.value, cleared.value);
        if (!saved.ok) return saved;
        if (saved.value === null) return err(publicationMutationConflict());

        const recordedClear = await recordScheduleChange(deps, actor, {
          publicationId: String(saved.value.id),
          before: found.value.scheduledAt,
          after: null,
        });
        if (!recordedClear.ok) return recordedClear;

        return ok({
          publicationId: String(saved.value.id),
          scheduledLabel: "日時の指定なし",
          message:
            saved.value.state === "RETRY_SCHEDULED"
              ? "予定日を外しました。次の配信処理で再試行します。"
              : "予定日を外しました。承認され次第すぐに出ます。",
        });
      }

      const parsed = new Date(input.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return err(
          validationError("日時の形が読み取れませんでした。日付と時刻を選び直してください。", "scheduledAt"),
        );
      }
      const now = new Date();
      if (parsed.getTime() <= now.getTime()) {
        return err(
          validationError(
            "過去の日時は指定できません。過去に置くと、出ないまま気づかれずに残ります。",
            "scheduledAt",
          ),
        );
      }

      const moved = changePublicationSchedule(found.value, parsed, now);
      if (!moved.ok) return moved;

      const saved = await deps.publications.compareAndSwap(found.value, moved.value);
      if (!saved.ok) return saved;
      if (saved.value === null) return err(publicationMutationConflict());

      const recorded = await recordScheduleChange(deps, actor, {
        publicationId: String(saved.value.id),
        before: found.value.scheduledAt,
        after: parsed,
      });
      if (!recorded.ok) return recorded;

      // 出し先と日時が決まった、を伝える（§23.2）。
      // 伝達に失敗しても予定の変更は済んでいるので、ここで失敗にはしない。
      // 失敗にすると「押したのに日時が変わっていない」という最も分かりにくい壊れ方になる。
      const event = buildEvent("publication.scheduled", String(actor.workspaceId), now, {
        publicationId: String(saved.value.id),
        scheduledAt: parsed.toISOString(),
      });
      if (event.ok) await deps.events.publish(event.value);

      return ok({
        publicationId: String(saved.value.id),
        scheduledLabel: parsed.toLocaleString("ja-JP"),
        message: `${parsed.toLocaleString("ja-JP")} に出す予定へ変えました。`,
      });
    },
  };
}
