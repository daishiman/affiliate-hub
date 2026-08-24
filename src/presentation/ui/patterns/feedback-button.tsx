"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedbackSubmission } from "@/presentation/feedback-contract";
import { Button } from "../primitives/button";
import { Callout } from "../primitives/callout";
import { Field } from "../primitives/field";
import { SectionHeading } from "../primitives/heading";
import { Select } from "../primitives/select";
import { TextArea } from "../primitives/textarea";
import { UI_COPY } from "../copy";
import { CaptureCanvas, type BurnedCapture } from "./capture-canvas";
import { safeUrl, startPageDiagnostics, type PageDiagnostics } from "./page-diagnostics";
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

export type { FeedbackSubmission } from "@/presentation/feedback-contract";

/**
 * 画面の写しを 1 枚撮る。撮れなければ `null`（**失敗ではない**）。
 *
 * --- なぜ部品の外に居るのか ---
 *
 * ブラウザは画面の共有を「押した勢いが残っているあいだ」しか許さない
 * （transient activation）。開いてから `useEffect` で呼ぶと、その頃には勢いが
 * 切れていて、**利用者には何も起きなかったように見える**。だから押した本人の
 * `onClick` の中から呼べる形にしてある。中の状態には触らない。
 *
 * --- 許可の窓は消せない ---
 *
 * 「押した瞬間に撮る」と言っても、ページが自分自身を無断で撮ることはできない。
 * どの画面を渡すかは必ず本人が選ぶ。**これは実装の手抜きではなく安全の側の決まりで、
 * 迂回する手立ては用意しない。**押すと同時に窓が出て、選べば即座に台紙へ載る。
 */
async function captureScreen(): Promise<string | null> {
  const media = navigator.mediaDevices as {
    getDisplayMedia?: (c: unknown) => Promise<MediaStream>;
  };
  if (typeof media?.getDisplayMedia !== "function") return null;
  try {
    // `preferCurrentTab` は Chromium だけが見る。他は黙って無視するので、
    // 付けても壊れない。**効く所では、選ぶ手間が 1 つ減る。**
    const stream = await media.getDisplayMedia({ video: true, preferCurrentTab: true });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    return canvas.toDataURL("image/png");
  } catch {
    // 断られた場合も含む。撮れないことは失敗ではない。
    return null;
  }
}

const KIND_OPTIONS = [
  { value: "not_working", label: UI_COPY.feedback.kindNotWorking },
  { value: "hard_to_use", label: UI_COPY.feedback.kindHardToUse },
  { value: "want_feature", label: UI_COPY.feedback.kindWantFeature },
] as const;

export function FeedbackButton({
  screenName,
  route,
  canSubmit,
  placement = "fixed",
  onSubmit,
}: {
  /** いま開いている画面の名前。送る人に書かせない（書かせると表記がばらつく）。 */
  readonly screenName: string;
  readonly route: string;
  /** 権限を持つ人にだけ出す。持たない人には何も描かない。 */
  readonly canSubmit: boolean;
  /** 通常は右下固定。見本帳で実物を重ねず見せるときだけ本文内へ置く。 */
  readonly placement?: "fixed" | "inline";
  readonly onSubmit: (submission: FeedbackSubmission) => Promise<{ readonly message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const diagnosticsRef = useRef<(() => PageDiagnostics) | null>(null);
  const [, setDiagnosticsVersion] = useState(0);
  /*
   * 押した瞬間に始めた撮影。中身が届くのは開いた後になる。
   *
   * **`useRef` ではなく `useState` である。**ref を描画の中で読むと、書き換えても
   * 描き直しが起きない——**押した回と、渡る値がずれる形**になる。いまは
   * `setOpen(true)` が同じイベントで描き直しを起こすので動くが、それは
   * 「別の理由で偶然そろっている」だけで、`open` の扱いが変わった日に静かに壊れる。
   *
   * `setState` に約束（Promise）を渡すのは安全である。React が特別扱いするのは
   * **関数**だけで、それは更新関数と解釈される。約束は関数ではない。
   */
  const [pendingShot, setPendingShot] = useState<Promise<string | null> | null>(null);

  /*
   * 画面で起きたことを控えておく。送る人は再現手順を書けないことが多く、
   * これが無いと「なんとなく動かない」だけが残る。中身は開発者向けの文字列で、
   * 送信前に「一緒に送るもの」として本人へ見せる。
   *
   * **控えるのはボタンを出す時点から。**開いてから控え始めると、開く前に起きた
   * ことが 1 つも入らない——**要望を書き始めるのは、たいてい何かが起きた後である。**
   */
  useEffect(() => {
    if (!canSubmit) return;
    const collector = startPageDiagnostics({
      onChange: () => setDiagnosticsVersion((version) => version + 1),
    });
    diagnosticsRef.current = collector.read;
    return () => {
      diagnosticsRef.current = null;
      collector.stop();
    };
  }, [canSubmit]);

  if (!canSubmit) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.feedbackLauncher} ${placement === "inline" ? styles.feedbackLauncherInline : ""}`.trim()}
        onClick={() => {
          // **撮影を先に始める。**`setOpen` を待つと押した勢いが切れ、
          // 許可の窓が出ないまま「撮れませんでした」になる。
          // 待たないので、開くのは写しの有無にかかわらず即座である。
          setPendingShot(captureScreen());
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        {UI_COPY.feedback.openButton}
      </button>
      {open ? (
        <FeedbackDialog
          screenName={screenName}
          route={route}
          readDiagnostics={() =>
            diagnosticsRef.current?.() ?? {
              jsErrors: [],
              failedRequests: [],
              recentActions: [],
              redactedCount: 0,
            }
          }
          pendingShot={pendingShot}
          onClose={() => {
            setOpen(false);
            // 閉じたら手放す。持ち続けると、次に開いたとき前回の写しが一瞬入る。
            setPendingShot(null);
          }}
          onSubmit={onSubmit}
        />
      ) : null}
    </>
  );
}

/**
 * いま何件控えているか。
 *
 * **`export` しない。**単体で置けるようにすると「送る画面の外で控えの数だけ見る」が
 * でき、控えが働いていることと、それが送られることが切り離される。
 * 数が出ている場所と、送るボタンは同じ画面に居なければならない。
 */
function DiagnosticsSummary({ read }: { readonly read: () => PageDiagnostics }) {
  const seen = read();
  const parts = [
    `エラー ${seen.jsErrors.length} 件`,
    `うまくいかなかった通信 ${seen.failedRequests.length} 件`,
    `直前に押したもの ${seen.recentActions.length} 件`,
  ];
  return (
    <p className={styles.feedbackScreen}>
      {UI_COPY.feedback.disclosureCounts}: {parts.join("・")}
    </p>
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
  readDiagnostics,
  pendingShot,
  onClose,
  onSubmit,
}: {
  readonly screenName: string;
  readonly route: string;
  /**
   * 押した瞬間に始まっている撮影。**始めるのは外側の仕事**で、
   * ここは届くのを待つだけ（押した勢いはここまで残らない）。
   */
  readonly pendingShot: Promise<string | null> | null;
  /**
   * 控えてあるものを、**送る瞬間に**読む。
   * 開いた時点の写しを渡すと、開いてから送るまでに起きたことが落ちる。
   */
  readonly readDiagnostics: () => PageDiagnostics;
  readonly onClose: () => void;
  readonly onSubmit: (submission: FeedbackSubmission) => Promise<{ readonly message: string }>;
}) {
  const [kind, setKind] = useState<FeedbackSubmission["kind"]>("hard_to_use");
  const [body, setBody] = useState("");
  const [wish, setWish] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [burned, setBurned] = useState<{
    base64: string;
    redactionCount: number;
    maskedElementCount: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * 重ねて出したものを、キーボードだけの人が閉じられるようにする。
   *
   * 重ねて出す部品は、マウスなら外側を押せば閉じられる。
   * **キーボードには「外側」が無い。** Esc を受けないと、開いた時点で
   * Tab が後ろの画面へ抜けていき、閉じるボタンへ戻る道が本人には見えない。
   * 見えないまま画面の裏側を操作できるので、送るのをやめる以外の逃げ道が消える。
   *
   * だから 2 つを対で置く。片方だけだと逃げ道が閉じるか、閉じ込めるだけになる。
   *   Esc  … いつでも降りられる
   *   Tab  … 端まで来たら反対の端へ回す（後ろの画面へ抜けない）
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = (): HTMLElement[] =>
      [...panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea")].filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1",
      );
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // 端に居るときだけ手を出す。途中は素の移動に任せる（順番を手で決めない）。
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /**
   * 開いた瞬間の居場所を、重ねた中へ移す。
   *
   * 分けてあるのは、上の効果に混ぜると**画面を描き直すたびに先頭へ飛ぶ**ため。
   * 書いている途中で入力欄から連れ戻されるのは、閉じ込め以上に操作を壊す。
   */
  useEffect(() => {
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a[href], button, input, select, textarea")?.focus();
  }, []);

  /**
   * 押した瞬間に始まっていた撮影を受け取る。
   *
   * **撮れなかったときに案内を出さない。**押しただけで断りの文が出ると、
   * 写しを付けるつもりの無い人にまで「失敗した」と読める。撮り直しのボタンは
   * 下に出ているので、要る人はそこから撮る——**そのときは案内を出す**（`take`）。
   *
   * 閉じた後に届いた写しを捨てるのは `cancelled` で見ている。捨てないと、
   * 閉じたはずの画面が state を触って React が警告を出す。
   */
  useEffect(() => {
    if (!pendingShot) return;
    let cancelled = false;
    void pendingShot.then((shot) => {
      if (!cancelled && shot !== null) setSource(shot);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingShot]);

  /** 撮り直す。ここは本人が明示的に押しているので、撮れないことを伝える。 */
  const take = async (): Promise<void> => {
    const shot = await captureScreen();
    if (shot === null) {
      setNotice(UI_COPY.feedback.captureUnavailable);
      return;
    }
    setSource(shot);
    setNotice(null);
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
    // **送る瞬間に読む。**書いている最中に起きた失敗も、これで入る。
    const seen = readDiagnostics();
    const result = await onSubmit({
      kind,
      body,
      wish,
      origin: {
        screenName,
        url: typeof window === "undefined" ? route : safeUrl(window.location.href),
        route,
        viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
        viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      },
      technical: {
        jsErrors: [...seen.jsErrors],
        failedRequests: [...seen.failedRequests],
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        // **画面を開いたことは、控えの先頭に置く。**押した操作だけだと、
        // 「どこで」が本文頼みになる。控えが空でも 1 行は残る。
        recentActions: [`${screenName} を開いた`, ...seen.recentActions],
        redactedCount: seen.redactedCount,
      },
      capture: burned
        ? {
            imageBase64: burned.base64,
            // 台紙が焼き込んだ 1 枚しか受け取っていない。元画像は持っていない。
            redactionsBurnedIn: true,
            retainsOriginal: false,
            redactionCount: burned.redactionCount,
            maskedElementCount: burned.maskedElementCount,
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
      setBurned({
        base64: url.slice(url.indexOf(",") + 1),
        redactionCount: capture.redactionCount,
        maskedElementCount: capture.maskedElementCount,
      });
      // 焼き込み後は元の画像を手元から捨てる。残すと「隠したはず」が残る。
      setSource(null);
    };
    reader.readAsDataURL(capture.blob);
  };

  return (
    <div className={styles.feedbackDialog} role="dialog" aria-modal="true" aria-label={UI_COPY.feedback.modalTitle}>
      <div className={styles.feedbackPanel} ref={panelRef}>
        {/*
          この見出しは `aria-label` と同じ文言を出している。**支援技術には
          届いていたが、目で見る側だけが落ちていた**——`className` が無いので
          Preflight で大きさも太さも失い、下の `.feedbackScreen` と並ぶと
          どちらが題か分からなかった（残課題 145）。
        */}
        <SectionHeading level={2}>{UI_COPY.feedback.modalTitle}</SectionHeading>
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
            {/*
              **数を出す。**上の文は「送ります」と言うだけで、いま何件あるかを
              言わない。0 件のときも 12 件のときも同じ文が出ていると、
              本人には**控えが働いているのかどうかが分からない**。
              中身は開発者向けの文字列なので出さない——読めないものを見せると、
              読めないことのほうが不安になる。

              描くたびに読み直している。開いた瞬間の数で止めると、
              書いている最中に起きた失敗が数に出ず、**「送ります」と言った件数と
              実際に送る件数が食い違う。**
            */}
            <DiagnosticsSummary read={readDiagnostics} />
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
