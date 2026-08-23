"use client";

import { useState } from "react";
import { Button, CaptureCanvas, FeedbackButton, UI_COPY } from "@/presentation/ui";

/**
 * 改善要望の見本。
 *
 * 見本帳では**送らない**。送ってしまうと、見本を開いただけで
 * 一覧に中身の無い要望が並び、本物の要望が埋もれる。
 * ここでの `onSubmit` は受け取った内容をその場で返すだけで、記録しない。
 *
 * 印を付ける台紙は、写真ではなく**その場で作った 1 枚**を土台にしている。
 * 見本のために画像ファイルを置くと、それが本番にも同梱される。
 */
export function FeedbackSamples() {
  const [source, setSource] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const makeSource = (): void => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setResult(UI_COPY.feedback.captureUnavailable);
      return;
    }
    // 見本の土台。色を決め打ちしないよう、既定の描画色のまま枠と文字だけを置く。
    ctx.strokeRect(8, 8, 624, 344);
    ctx.font = "24px sans-serif";
    ctx.fillText("見本の画面（実際の画面ではありません）", 40, 80);
    setSource(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <FeedbackButton
        screenName="部品の見本帳"
        route="/admin/ui-catalog"
        canSubmit
        placement="inline"
        onSubmit={async (submission) => ({
          message: `見本のため記録していません（受け取った種類: ${submission.kind}）`,
        })}
      />

      {source ? (
        <CaptureCanvas
          source={source}
          maskedElementCount={2}
          onExport={(capture) =>
            setResult(
              `焼き込んだ 1 枚を受け取りました（${capture.blob.size} バイト / 黒塗り ${capture.redactionCount} 箇所）`,
            )
          }
          onRetake={makeSource}
          onDrop={() => setSource(null)}
        />
      ) : (
        <Button tone="secondary" onClick={makeSource}>
          見本の画面で印付けを試す
        </Button>
      )}

      {result ? <p>{result}</p> : null}
    </div>
  );
}
