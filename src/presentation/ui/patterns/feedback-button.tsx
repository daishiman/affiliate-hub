"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../primitives/button";
import { Callout } from "../primitives/callout";
import { Field } from "../primitives/field";
import { Select } from "../primitives/select";
import { TextArea } from "../primitives/textarea";
import { UI_COPY } from "../copy";
import { CaptureCanvas, type BurnedCapture } from "./capture-canvas";
import styles from "./patterns.module.css";

/**
 * 改善要望を送るボタン（右下固定）と、その中身。
 *
 * --- なぜ画面ごとに置かないのか ---
 *
 * 置き場所を画面に任せると、**置き忘れた画面の不満だけが誰にも届かない**。
 * 届かない不満は「言っても変わらない」という学習になり、その後は何も来なくなる。
 * だからここは `AdminShell` から 1 回だけ出す。画面側は何もしない。
 *
 * --- 送信経路をこの部品が持たない理由 ---
 *
 * 共有 UI は `fetch` を持たない。送り先を部品が知ると、
 * 「この画面だけ別の入口へ送る」ができてしまい、記録の抜けが起きる。
 * 送信は `onSubmit`（サーバー側の処理）として外から渡す。
 *
 * --- 画像は任意 ---
 *
 * 画面の写しが撮れない環境がある。撮れないことを理由に
 * 「送れません」にすると、そこで諦められる。**文章だけで必ず送れる。**
 */

/** サーバーへ渡す形。サーバー側の処理へそのまま渡せるよう、素の値だけで組む。 */
export type FeedbackSubmission = {
  readonly kind: "not_working" | "hard_to_use" | "want_feature";
  readonly body: string;
  readonly wish: string;
  readonly origin: {
    readonly screenName: string;
    readonly url: string;
    readonly route: string;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
  };
  readonly technical: {
    readonly jsErrors: readonly string[];
    readonly failedRequests: readonly string[];
    readonly userAgent: string;
    readonly recentActions: readonly string[];
    readonly redactedCount: number;
  };
  readonly capture: {
    readonly imageBase64: string;
    readonly redactionsBurnedIn: boolean;
    readonly retainsOriginal: boolean;
    readonly redactionCount: number;
    readonly maskedElementCount: number;
    readonly mimeType: string;
  } | null;
};

const KIND_OPTIONS = [
  { value: "not_working", label: UI_COPY.feedback.kindNotWorking },
  { value: "hard_to_use", label: UI_COPY.feedback.kindHardToUse },
  { value: "want_feature", label: UI_COPY.feedback.kindWantFeature },
] as const;

export function FeedbackButton({
  screenName,
  route,
  canSubmit,
  onSubmit,
}: {
  /** いま開いている画面の名前。送る人に書かせない（書かせると表記がばらつく）。 */
  readonly screenName: string;
  readonly route: string;
  /** 権限を持つ人にだけ出す。持たない人には何も描かない。 */
  readonly canSubmit: boolean;
  readonly onSubmit: (submission: FeedbackSubmission) => Promise<{ readonly message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const errorsRef = useRef<string[]>([]);

  // 画面で起きたエラーを控えておく。送る人は再現手順を書けないことが多く、
  // これが無いと「なんとなく動かない」だけが残る。中身は開発者向けの文字列で、
  // 送信前に「一緒に送るもの」として本人へ見せる。
  useEffect(() => {
    if (!canSubmit) return;
    const onError = (event: ErrorEvent): void => {
      errorsRef.current = [...errorsRef.current.slice(-4), event.message];
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, [canSubmit]);

  if (!canSubmit) return null;

  return (
    <>
      <button
        type="button"
        className={styles.feedbackLauncher}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {UI_COPY.feedback.openButton}
      </button>
      {open ? (
        <FeedbackDialog
          screenName={screenName}
          route={route}
          readJsErrors={() => errorsRef.current}
          onClose={() => setOpen(false)}
          onSubmit={onSubmit}
        />
      ) : null}
    </>
  );
}

/**
 * 送るための入力一式。
 *
 * `export` しないのは、外から単体で置けるようにすると
 * 「ボタン無しでこの画面だけ別の出し方」が生まれるため。入口はボタン 1 つに保つ。
 */
function FeedbackDialog({
  screenName,
  route,
  readJsErrors,
  onClose,
  onSubmit,
}: {
  readonly screenName: string;
  readonly route: string;
  /**
   * 控えてあるエラーを、**送る瞬間に**読む。
   * 開いた時点の写しを渡すと、開いてから送るまでに起きたエラーが落ちる。
   */
  readonly readJsErrors: () => readonly string[];
  readonly onClose: () => void;
  readonly onSubmit: (submission: FeedbackSubmission) => Promise<{ readonly message: string }>;
}) {
  const [kind, setKind] = useState<FeedbackSubmission["kind"]>("hard_to_use");
  const [body, setBody] = useState("");
  const [wish, setWish] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [burned, setBurned] = useState<{ base64: string; redactionCount: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /** 画面の写しを撮る。撮れない環境では、貼り付けとファイル選択に案内する。 */
  const take = async (): Promise<void> => {
    const media = navigator.mediaDevices as { getDisplayMedia?: (c: unknown) => Promise<MediaStream> };
    if (typeof media?.getDisplayMedia !== "function") {
      setNotice(UI_COPY.feedback.captureUnavailable);
      return;
    }
    try {
      const stream = await media.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      setSource(canvas.toDataURL("image/png"));
      setNotice(null);
    } catch {
      // 断られた場合も含む。撮れないことは失敗ではない。
      setNotice(UI_COPY.feedback.captureUnavailable);
    }
  };

  const readFile = (file: File | null | undefined): void => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  };

  const send = async (): Promise<void> => {
    if (body.trim() === "") {
      setNotice("「改善したいこと」を書いてください。");
      return;
    }
    setSending(true);
    const result = await onSubmit({
      kind,
      body,
      wish,
      origin: {
        screenName,
        url: typeof window === "undefined" ? route : window.location.href,
        route,
        viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
        viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      },
      technical: {
        jsErrors: [...readJsErrors()],
        failedRequests: [],
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        recentActions: [`${screenName} を開いた`],
        redactedCount: burned?.redactionCount ?? 0,
      },
      capture: burned
        ? {
            imageBase64: burned.base64,
            // 台紙が焼き込んだ 1 枚しか受け取っていない。元画像は持っていない。
            redactionsBurnedIn: true,
            retainsOriginal: false,
            redactionCount: burned.redactionCount,
            maskedElementCount: 0,
            mimeType: "image/png",
          }
        : null,
    });
    setSending(false);
    setDone(result.message);
  };

  const keep = (capture: BurnedCapture): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setBurned({ base64: url.slice(url.indexOf(",") + 1), redactionCount: capture.redactionCount });
      // 焼き込み後は元の画像を手元から捨てる。残すと「隠したはず」が残る。
      setSource(null);
    };
    reader.readAsDataURL(capture.blob);
  };

  return (
    <div className={styles.feedbackDialog} role="dialog" aria-modal="true" aria-label={UI_COPY.feedback.modalTitle}>
      <div className={styles.feedbackPanel}>
        <h2>{UI_COPY.feedback.modalTitle}</h2>
        <p className={styles.feedbackScreen}>
          {UI_COPY.feedback.screenLabel}: {screenName}
        </p>

        {done ? (
          <>
            <Callout tone="success" reason={done} />
            <Button onClick={onClose}>閉じる</Button>
          </>
        ) : (
          <>
            <Select
              label={UI_COPY.feedback.kindLabel}
              value={kind}
              onValueChange={(v) => setKind(v as FeedbackSubmission["kind"])}
              options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <TextArea
              label={UI_COPY.feedback.bodyLabel}
              value={body}
              onValueChange={setBody}
              hint={UI_COPY.feedback.bodyHint}
            />
            <Field
              label={UI_COPY.feedback.wishLabel}
              value={wish}
              onValueChange={setWish}
              hint={UI_COPY.feedback.wishHint}
              optional
            />

            <Callout
              tone="info"
              title={UI_COPY.feedback.disclosureTitle}
              reason={UI_COPY.feedback.disclosureBody}
            />
            {notice ? <Callout tone="warn" reason={notice} /> : null}

            {source ? (
              <CaptureCanvas
                source={source}
                maskedElementCount={0}
                onExport={keep}
                onRetake={() => setSource(null)}
                onDrop={() => {
                  setSource(null);
                  setBurned(null);
                }}
              />
            ) : (
              <div className={styles.captureActions}>
                <Button tone="secondary" onClick={take}>
                  {burned ? UI_COPY.feedback.captureRetake : UI_COPY.feedback.captureTake}
                </Button>
                {burned ? (
                  <Button tone="secondary" onClick={() => setBurned(null)}>
                    {UI_COPY.feedback.captureDrop}
                  </Button>
                ) : null}
                <label className={styles.captureTextInput}>
                  {UI_COPY.feedback.capturePasteHint}
                  <input
                    type="file"
                    accept="image/png"
                    onChange={(e) => readFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            )}

            <div className={styles.captureActions}>
              <Button tone="secondary" onClick={onClose}>
                やめる
              </Button>
              <Button onClick={send} busy={sending} busyLabel={UI_COPY.feedback.sending}>
                {UI_COPY.feedback.submit}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
