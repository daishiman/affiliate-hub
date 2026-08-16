import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { EditorialContentPackageRepositoryPort } from "@/application/ports/authoring";
import type {
  ChannelConnectionRepositoryPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import {
  CHANNEL_CAPABILITIES,
  type ChannelKind,
  type Publication,
  type PublicationState,
  advance,
} from "@/domain/distribution";
import { can, requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type PublicationId,
  type Result,
  assertSameTenant,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { PUBLICATION_STATE_LABEL } from "./manage-distribution";

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
};

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
 * 日時を変えてよい状態と、変えたあとに戻す先。
 *
 * `null` は「状態は変えない」。日時だけを動かす。
 * ここを domain の遷移表と食い違わせないために、**戻す先も一緒に持つ**。
 * 「変えられる状態」だけを並べると、変えた直後に遷移が拒まれて
 * 保存されない、という無言の失敗が起きる。
 *
 * 取りやめ済み (CANCELLED) と公開済み (PUBLISHED) はどちらも行き止まり。
 * 日時を入れ直しても出ないので、変えられる側に入れない。
 */
const RESCHEDULE_TARGET: Partial<Record<PublicationState, PublicationState | null>> = {
  QUEUED: null,
  // 検査で止まったものは、直したうえで順番待ちへ戻す。
  FAILED_VALIDATION: "QUEUED",
  // 送信に失敗したものは、時間をずらして送り直す枠へ移す。
  FAILED_SEND: "RETRY_SCHEDULED",
  RETRY_SCHEDULED: null,
  // 手で貼り付ける先は、日時が「いつ貼るか」の覚え書きなので状態は動かさない。
  MANUAL_EXPORT_READY: null,
};

const RESCHEDULABLE: readonly PublicationState[] = Object.keys(
  RESCHEDULE_TARGET,
) as PublicationState[];

/** 権限が無い人に見せる理由。押せないボタンだけを置かないための文。 */
const NO_PUBLISH_PERMISSION =
  "予定日を変える権限がありません。公開の担当者に日時の変更を依頼してください。";

function reschedulableReason(state: PublicationState): string | null {
  if (RESCHEDULABLE.includes(state)) return null;
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

      const [listed, connections] = await Promise.all([
        deps.publications.listRecent(actor.workspaceId, 200),
        deps.connections.listByWorkspace(actor.workspaceId, { limit: 100, cursor: null }),
      ]);
      if (!listed.ok) return listed;

      // 媒体ごとの接続名。1 件ずつ問い合わせると配信の数だけ往復する。
      const accountOf = new Map<string, string>();
      if (connections.ok) {
        for (const c of connections.value.items) {
          if (!accountOf.has(String(c.id))) accountOf.set(String(c.id), c.accountLabel);
        }
      }

      /**
       * 予定日を動かせる人かどうかを、ここで 1 度だけ見る。
       * 画面に「変える」欄を出してから断るのではなく、
       * 出せない理由を先に返す。押せない操作を並べても、次の一手が決まらない。
       */
      const mayReschedule = can(actor, "content.publish");

      const entries = await Promise.all(
        listed.value.map((p) => toEntry(deps, actor, p, accountOf, mayReschedule)),
      );

      const [year, monthNumber] = month.split("-").map(Number);
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
): Promise<CalendarEntry> {
  const variant = await deps.contentVariants.findById(actor.workspaceId, p.variantId);
  const found = variant.ok ? variant.value : null;

  let campaignId: string | null = null;
  let packageId: string | null = null;
  if (found !== null) {
    packageId = String(found.contentPackageId);
    const pkg = await deps.contentPackages.findById(actor.workspaceId, found.contentPackageId);
    if (pkg.ok && pkg.value !== null && pkg.value.campaignId !== null) {
      campaignId = String(pkg.value.campaignId);
    }
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

      const blocked = reschedulableReason(found.value.state);
      if (blocked !== null) {
        return err(domainError("CONFLICT", blocked, { field: "scheduledAt" }));
      }

      if (input.scheduledAt.trim() === "") {
        const cleared = { ...found.value, scheduledAt: null };
        const saved = await deps.publications.save(cleared);
        if (!saved.ok) return saved;
        return ok({
          publicationId: String(saved.value.id),
          scheduledLabel: "日時の指定なし",
          message: "予定日を外しました。承認され次第すぐに出ます。",
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

      // 状態を戻す先は、いまの状態ごとに決まっている（domain の遷移表に合わせる）。
      const target = RESCHEDULE_TARGET[found.value.state] ?? null;
      const moved =
        target === null ? ok(found.value) : advance(found.value, target, { at: now });
      if (!moved.ok) return moved;

      const saved = await deps.publications.save({ ...moved.value, scheduledAt: parsed });
      if (!saved.ok) return saved;

      return ok({
        publicationId: String(saved.value.id),
        scheduledLabel: parsed.toLocaleString("ja-JP"),
        message: `${parsed.toLocaleString("ja-JP")} に出す予定へ変えました。`,
      });
    },
  };
}
