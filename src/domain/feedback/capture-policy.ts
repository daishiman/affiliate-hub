import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * Product Feedback コンテキスト / 画像の扱いの決まり（仕様 §11 FB-AC-24）。
 *
 * ここが持つのは**決まりだけ**で、描画（canvas での塗りつぶし）は presentation 側にある。
 * domain に描画を持たせると、画面の都合で決まりの側が動く。
 *
 * --- 一番大事な 1 行 ---
 *
 * **黒塗りは画像そのものに焼き込む。** 元画像を残して上に重ねる作りにしない。
 * 重ねる作りは元画像を取り出せてしまうので、隠したことにならない。
 * これは「見た目の話」ではなく「隠れているかどうか」の話なので、
 * 実装の都合で崩せないように domain 側の検査にしてある（`assertCaptureIsStorable`）。
 */

/** 撮影時に自動で塗りつぶす要素の宣言名。宣言し忘れは手作業の黒塗りで補える。 */
export const MASK_ATTRIBUTE = "data-capture";
export const MASK_ATTRIBUTE_VALUE = "mask";

/** 注釈の道具（仕様 §7）。 */
export const ANNOTATION_TOOLS = ["pen", "rect", "arrow", "text", "redact"] as const;
export type AnnotationTool = (typeof ANNOTATION_TOOLS)[number];

export const ANNOTATION_TOOL_LABELS: Readonly<Record<AnnotationTool, string>> = {
  pen: "手書き",
  rect: "四角",
  arrow: "矢印",
  text: "文字",
  redact: "黒塗り",
};

/** 注釈の色。黒塗りだけは色を選べない（薄い色で塗ると隠れていないため）。 */
export const ANNOTATION_COLORS = ["red", "brown", "blue", "black"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const ANNOTATION_COLOR_LABELS: Readonly<Record<AnnotationColor, string>> = {
  red: "赤",
  brown: "茶",
  blue: "青",
  black: "黒",
};

/** 黒塗りの色は固定。選ばせない。 */
export const REDACT_COLOR: AnnotationColor = "black";

export function colorFor(tool: AnnotationTool, chosen: AnnotationColor): AnnotationColor {
  return tool === "redact" ? REDACT_COLOR : chosen;
}

/** 色を選べる道具かどうか（道具箱の出し分けをここで一元化する）。 */
export function canChooseColor(tool: AnnotationTool): boolean {
  return tool !== "redact";
}

/**
 * 保存期間。過ぎたものは消す。
 *
 * 画像は「そのとき画面に出ていた全部」が写るので、持ち続けるほど危ない。
 * 要望の文章は残り、画像だけ消えても、要望そのものは読める作りにしてある
 * （`report.ts` の `captureId` が `null` でも成立する）。
 */
export const CAPTURE_RETENTION_DAYS = 180;

export function captureExpiresAt(storedAt: Date): Date {
  return new Date(storedAt.getTime() + CAPTURE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function isCaptureExpired(storedAt: Date, now: Date): boolean {
  return now.getTime() >= captureExpiresAt(storedAt).getTime();
}

/** 保存しようとしている画像の申告。 */
export type CaptureSubmission = {
  /** 黒塗りを画像に焼き込んだか。**false を保存しない。** */
  readonly redactionsBurnedIn: boolean;
  /** 元画像（黒塗り前）を一緒に持っていないか。**持っていたら保存しない。** */
  readonly retainsOriginal: boolean;
  /** 塗った箇所の数。0 でもよい（塗る必要が無い画面もある）。 */
  readonly redactionCount: number;
  /** 宣言で自動的に隠した要素の数。 */
  readonly maskedElementCount: number;
  readonly byteLength: number;
  readonly mimeType: string;
};

/** 受け付ける形式。png だけにする（jpeg は塗りの境目がにじみ、文字が読めることがある）。 */
export const ALLOWED_CAPTURE_MIME = "image/png";
export const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

/**
 * 保存してよい画像かを確かめる。
 *
 * ここを通らないものは保存先へ渡さない。「あとで消す」ではなく「入れない」。
 */
export function assertCaptureIsStorable(
  submission: CaptureSubmission,
): Result<CaptureSubmission, DomainError> {
  if (!submission.redactionsBurnedIn) {
    return err(
      domainError("INVARIANT_VIOLATED", "黒塗りが画像に焼き込まれていません。", {
        suggestedAction:
          "上に重ねただけでは元の画像を取り出せてしまいます。塗った状態の 1 枚を作ってから保存してください。",
      }),
    );
  }
  if (submission.retainsOriginal) {
    return err(
      domainError("INVARIANT_VIOLATED", "黒塗り前の画像が一緒に残っています。", {
        suggestedAction: "残すのは塗ったあとの 1 枚だけです。",
      }),
    );
  }
  if (submission.mimeType !== ALLOWED_CAPTURE_MIME) {
    return err(
      domainError("VALIDATION_FAILED", "画像の形式が違います（png のみ）。", {
        field: "mimeType",
      }),
    );
  }
  if (submission.byteLength <= 0) {
    return err(domainError("VALIDATION_FAILED", "画像が空です。", { field: "byteLength" }));
  }
  if (submission.byteLength > MAX_CAPTURE_BYTES) {
    return err(
      domainError("VALIDATION_FAILED", "画像が大きすぎます。", {
        field: "byteLength",
        suggestedAction: "困っている場所だけを写すと軽くなります。",
      }),
    );
  }
  return ok(submission);
}

/** 送る前に画面へ出す文。何が一緒に送られるかを先に伝える（仕様 §6）。 */
export const CAPTURE_DISCLOSURE_TEXT =
  "画面の写し・画面名・URL・エラーの記録が一緒に送られます。写したくないものは黒塗りで隠せます。";

/** 画像を外すときの文言。「送らない」を常に選べるようにする。 */
export const CAPTURE_OPT_OUT_LABEL = "画像を外す（文章だけで送る）";

/** 撮影が途中で失敗したときの断り。黙って空の画像を付けない。 */
export const CAPTURE_INCOMPLETE_TEXT =
  "画面の写しがうまく取れませんでした。文章だけで送るか、画像を貼り付けてください。";

/** 指示文に画像を含めるか。**含めない。** 定数にして、呼ぶ側が判断しないようにする。 */
export const INCLUDE_CAPTURE_IN_PROMPT = false;
