import type { FeedbackKind, FeedbackOrigin, TechnicalContext } from "@/domain/feedback";

/** ブラウザからserver actionへ渡す、presentation境界の素の値。 */
export type FeedbackSubmission = {
  readonly kind: FeedbackKind;
  readonly body: string;
  readonly wish: string;
  readonly origin: FeedbackOrigin;
  readonly technical: TechnicalContext;
  readonly capture: {
    readonly imageBase64: string;
    readonly redactionsBurnedIn: boolean;
    readonly retainsOriginal: boolean;
    readonly redactionCount: number;
    readonly maskedElementCount: number;
    readonly mimeType: string;
  } | null;
};
