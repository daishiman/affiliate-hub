import { RETENTION_DAYS, type ConsentChoice } from "@/domain/analytics/consent";
import { listTelemetryEvents, type ConsentRequirement, type TelemetryCategory } from "@/domain/analytics/telemetry-events";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 「何を記録しているか」を読者に説明するための一覧。
 *
 * **一覧を画面に書き起こさない。** 書き起こすと、計測を 1 つ足したときに
 * 説明ページだけ古いまま残る。それは説明していないのと同じで、
 * 記録している内容と説明が食い違っている状態になる。
 *
 * ここは domain の登録表 (`TELEMETRY_EVENTS`) をそのまま言葉に直すだけなので、
 * 計測を足せば説明ページにも自動で出る。
 */
export type ExplainTelemetryInput = { readonly consent?: ConsentChoice };

export type TelemetryExplainRow = {
  readonly label: string;
  readonly why: string;
  readonly category: TelemetryCategory;
  readonly categoryLabel: string;
  readonly needsConsent: boolean;
  readonly consentLabel: string;
  readonly retentionDays: number;
  /** 記録する項目の名前。中身の例は出さない（例が独り歩きする）。 */
  readonly fieldNames: readonly string[];
};

export type ExplainTelemetryOutput = {
  readonly rows: readonly TelemetryExplainRow[];
  readonly consent: ConsentChoice;
  readonly consentLabel: string;
  /** 記録しないと決めているもの。ここが説明の中心。 */
  readonly neverRecorded: readonly string[];
  readonly retentionSummary: readonly string[];
  readonly howToWithdraw: string;
};

const CATEGORY_LABEL: Readonly<Record<TelemetryCategory, string>> = {
  reader: "読まれ方",
  commerce: "紹介リンク",
  ai: "AI の利用",
  loop: "改善の試行",
};

const CONSENT_LABEL: Readonly<Record<ConsentRequirement, string>> = {
  none: "同意がなくても記録します（誰のものかは持ちません）",
  behaviour: "同意をいただいた場合だけ記録します",
};

const CHOICE_LABEL: Readonly<Record<ConsentChoice, string>> = {
  granted: "詳しい計測を許可いただいています。",
  denied: "詳しい計測は行っていません。回数だけ数えています。",
  unset: "まだ回答をいただいていません。いまは回数だけ数えています。",
};

export function createExplainTelemetryUseCase(): UseCase<
  ExplainTelemetryInput,
  ExplainTelemetryOutput
> {
  return {
    async execute(
      _actor: ActorContext,
      input: ExplainTelemetryInput,
    ): Promise<Result<ExplainTelemetryOutput, DomainError>> {
      // 読者が読むページなので権限は要らない。
      const rows = listTelemetryEvents()
        // AI の利用と改善の試行は運営側の記録。読者の説明ページには出さない。
        .filter((e) => e.category === "reader" || e.category === "commerce")
        .map(
          (e): TelemetryExplainRow => ({
            label: e.label,
            why: e.why,
            category: e.category,
            categoryLabel: CATEGORY_LABEL[e.category],
            needsConsent: e.consent === "behaviour",
            consentLabel: CONSENT_LABEL[e.consent],
            retentionDays: RETENTION_DAYS[e.consent],
            fieldNames: e.fieldNames,
          }),
        );

      return ok({
        rows,
        consent: input.consent ?? "unset",
        consentLabel: CHOICE_LABEL[input.consent ?? "unset"],
        neverRecorded: [
          "IP アドレスそのもの",
          "詳しい居場所",
          "お名前・連絡先などの個人を特定できる情報",
          "他のサイトでの行動",
        ],
        retentionSummary: [
          `回数だけの記録は ${RETENTION_DAYS.none} 日で消します。`,
          `読まれ方の詳しい記録は ${RETENTION_DAYS.behaviour} 日で消します。`,
          "期限を過ぎたものは自動で消えます。期限のない保管はしません。",
        ],
        howToWithdraw:
          "このページの下、またはどのページの足元からでも、いつでも取り消せます。取り消すと、それ以降は回数だけを数えます。ブラウザの「追跡しないで」の設定 (DNT / GPC) も尊重します。",
      });
    },
  };
}
