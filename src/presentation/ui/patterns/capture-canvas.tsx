"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../primitives/button";
import { Callout } from "../primitives/callout";
import { UI_COPY } from "../copy";
import styles from "./patterns.module.css";

/**
 * 画面の写しに印を付ける台紙。
 *
 * --- なぜ「重ねる」ではなく「焼き込む」のか ---
 *
 * 黒塗りを div や svg で上に重ねると、下の画像はそのまま残る。
 * 保存したものを開けば隠したはずの中身が読める。**隠したことにならない。**
 * ここでは印も黒塗りも canvas の画素そのものへ描き、`toBlob` で出た 1 枚だけを
 * 外へ渡す。元の画像はこの部品の中から出さない。
 *
 * 決まりの側（焼き込み必須・png のみ・元画像を残さない）は
 * `domain/feedback/capture-policy.ts` が持ち、送られた画像をもう一度検査する。
 * ここが正しく動かなくても、決まりに反する画像は保存されない。
 *
 * --- 道具と色をここで持っている理由 ---
 *
 * 共有 UI は domain を読まない（読むと画面部品が業務の都合で壊れる）。
 * そのため道具名と色は下に書き写してある。**書き写しがずれると困る**ので、
 * `tests/ui/capture-canvas.test.tsx` が domain 側の一覧と一致することを見ている。
 */

/** 注釈の道具。domain の `ANNOTATION_TOOLS` と同じ並び。 */
export const CANVAS_TOOLS = ["pen", "rect", "arrow", "text", "redact"] as const;
export type CanvasTool = (typeof CANVAS_TOOLS)[number];

/** 注釈の色。domain の `ANNOTATION_COLORS` と同じ並び。 */
export const CANVAS_COLORS = ["red", "brown", "blue", "black"] as const;
export type CanvasColor = (typeof CANVAS_COLORS)[number];

const TOOL_LABEL: Readonly<Record<CanvasTool, string>> = {
  pen: UI_COPY.feedback.toolPen,
  rect: UI_COPY.feedback.toolRect,
  arrow: UI_COPY.feedback.toolArrow,
  text: UI_COPY.feedback.toolText,
  redact: UI_COPY.feedback.toolRedact,
};

const COLOR_LABEL: Readonly<Record<CanvasColor, string>> = {
  red: UI_COPY.feedback.colorRed,
  brown: UI_COPY.feedback.colorBrown,
  blue: UI_COPY.feedback.colorBlue,
  black: UI_COPY.feedback.colorBlack,
};

const COLOR_CODE: Readonly<Record<CanvasColor, string>> = {
  red: "#d92d20",
  brown: "#8a5a2b",
  blue: "#1d6fd0",
  black: "#101010",
};

/** 黒塗りは色を選ばせない。薄い色で塗ると隠れないため。 */
const REDACT_CODE = "#000000";

/**
 * 位置の目印の 2 色。下の画像が何色か分からないので、明暗を重ねる。
 *
 * 上の `COLOR_CODE` と同じく、ここだけは CSS の変数を使えない
 * （canvas は画素へ直に書くので、テーマの切り替えが届かない）。
 */
const CARET_CODE = { light: "#ffffff", dark: "#101010" } as const;

/**
 * 矢印キー 1 回で動く画素数。**Shift を添えると 1 画素ずつ動く。**
 *
 * 大きい刻みだけだと、隠したい範囲の縁が合わない（黒塗りは縁が合わないと
 * はみ出すか、隠しきれないかのどちらかになる）。細かい刻みだけだと、
 * 端から端まで押し続けることになる。両方要る。
 */
export const CANVAS_KEY_STEP = 16;
export const CANVAS_KEY_FINE_STEP = 1;

const ARROW_DELTA: Readonly<Record<string, Point>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** キーボードで操作しているときの、いまの段。読み上げる文はここから引く。 */
type KeyStage = "idle" | "anchored" | "placed" | "cancelled";

const STAGE_TEXT: Readonly<Record<KeyStage, string>> = {
  idle: UI_COPY.feedback.captureKeyboardIdle,
  anchored: UI_COPY.feedback.captureKeyboardAnchored,
  placed: UI_COPY.feedback.captureKeyboardPlaced,
  cancelled: UI_COPY.feedback.captureKeyboardCancelled,
};

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

type Shape =
  | { readonly tool: "pen"; readonly color: CanvasColor; readonly points: readonly Point[] }
  | { readonly tool: "rect" | "arrow"; readonly color: CanvasColor; readonly from: Point; readonly to: Point }
  | { readonly tool: "text"; readonly color: CanvasColor; readonly at: Point; readonly text: string }
  | { readonly tool: "redact"; readonly from: Point; readonly to: Point };

type Point = { readonly x: number; readonly y: number };

/** 外へ渡す 1 枚と、その申告。申告は domain 側でもう一度検査される。 */
export type BurnedCapture = {
  readonly blob: Blob;
  readonly redactionCount: number;
};

export function CaptureCanvas({
  source,
  maskedElementCount,
  onExport,
  onRetake,
  onDrop,
}: {
  /** 撮ったばかりの画像（data URL）。この部品の外へは出さない。 */
  readonly source: string;
  /** 宣言で自動的に隠した要素の数。撮る側が数えてここへ渡す。 */
  readonly maskedElementCount: number;
  readonly onExport: (capture: BurnedCapture) => void;
  readonly onRetake: () => void;
  readonly onDrop: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<readonly Shape[]>([]);
  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState<CanvasColor>("red");
  const [text, setText] = useState("");
  const [drawing, setDrawing] = useState<Shape | null>(null);
  /**
   * キーボードで動かしている位置。**触るまでは null。**
   * null のあいだは画素へ何も描かないし、読み上げも黙っている
   * （ポインタで作った写しに、十字が焼き込まれて出ていかないように）。
   */
  const [caret, setCaret] = useState<Point | null>(null);
  const [stage, setStage] = useState<KeyStage>("idle");
  /** canvas を使えない環境（描画機能のない実行環境など）。黙って空の画像を作らない。 */
  const [unavailable, setUnavailable] = useState(false);

  /**
   * 1 枚ぶんを描く。`withCaret` は**外へ出す 1 枚では false** にする。
   * 位置の印はキーボードの人のための目印であって、写しの中身ではない。
   * 焼き込んだまま出すと、送られた側には消せない丸が乗る。
   */
  const paintFrame = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, withCaret: boolean) => {
      const image = imageRef.current;
      if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const shape of [...shapes, ...(drawing ? [drawing] : [])]) {
        paint(ctx, shape);
      }
      if (withCaret && caret) paintCaret(ctx, caret);
    },
    [shapes, drawing, caret],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) {
      setUnavailable(true);
      return;
    }
    paintFrame(ctx, canvas, true);
  }, [paintFrame]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = image.naturalWidth || 1280;
        canvas.height = image.naturalHeight || 720;
      }
      imageRef.current = image;
      redraw();
    };
    image.src = source;
    // 読み込みに失敗しても、文章だけで送る道は塞がない。
    image.onerror = () => setUnavailable(true);
  }, [source, redraw]);

  useEffect(redraw, [redraw]);

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    const scaleX = box.width === 0 ? 1 : canvas.width / box.width;
    const scaleY = box.height === 0 ? 1 : canvas.height / box.height;
    return { x: (event.clientX - box.left) * scaleX, y: (event.clientY - box.top) * scaleY };
  };

  /**
   * ここから下の 3 つは**座標だけを受け取る**。
   * ポインタとキーボードで別々の描き方を持つと、片方だけ直る日が来る
   * （実際、長らくポインタの経路しか無かった。`docs/product/backlog.md` 項目 82）。
   */

  /** 文字を 1 つ置く。置けたかどうかを返す（空のままなら置かない）。 */
  const placeText = (at: Point): boolean => {
    // 文字は「入れる文字」が空なら置かない。空の印は誰にも読めない。
    if (text.trim() === "") return false;
    setShapes((prev) => [...prev, { tool: "text", color, at, text }]);
    return true;
  };

  const beginAt = (at: Point): void => {
    setDrawing(
      tool === "pen"
        ? { tool: "pen", color, points: [at] }
        : tool === "redact"
          ? { tool: "redact", from: at, to: at }
          : { tool, color, from: at, to: at },
    );
  };

  const extendTo = (at: Point): void => {
    if (!drawing) return;
    if (drawing.tool === "pen") {
      setDrawing({ ...drawing, points: [...drawing.points, at] });
      return;
    }
    // 文字は押した時点で置き終わっているので、引きずっている最中には入らない。
    if (drawing.tool === "text") return;
    setDrawing({ ...drawing, to: at });
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const at = pointOf(event);
    if (tool === "text") {
      placeText(at);
      return;
    }
    beginAt(at);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!drawing) return;
    extendTo(pointOf(event));
  };

  const end = (): void => {
    if (!drawing) return;
    setShapes((prev) => [...prev, drawing]);
    setDrawing(null);
  };

  /**
   * キーボードだけで印を 1 つ置く経路。
   *
   * 矢印キーで位置を動かし、Enter で始点、もう一度 Enter で確定する。
   * ポインタの「押す → 引きずる → 離す」を、そのまま 3 つのキーへ写している。
   *
   * **位置を読み上げるところまでが経路である。**画素の座標は画面のどこにも
   * 出ていないので、数で言わないと「置いたが、どこに置いたか分からない」で終わる。
   */
  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
    const canvas = event.currentTarget;
    // 初めて触ったときは真ん中から。端から始めると、画面の中身まで押し続けることになる。
    const at = caret ?? { x: Math.round(canvas.width / 2), y: Math.round(canvas.height / 2) };
    const delta = ARROW_DELTA[event.key];

    if (delta) {
      event.preventDefault();
      const step = event.shiftKey ? CANVAS_KEY_FINE_STEP : CANVAS_KEY_STEP;
      const next = {
        x: clamp(at.x + delta.x * step, canvas.width),
        y: clamp(at.y + delta.y * step, canvas.height),
      };
      setCaret(next);
      if (drawing) extendTo(next);
      setStage(drawing ? "anchored" : "idle");
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setCaret(at);
      if (tool === "text") {
        setStage(placeText(at) ? "placed" : "idle");
        return;
      }
      if (drawing) {
        end();
        setStage("placed");
        return;
      }
      beginAt(at);
      setStage("anchored");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      // やめたものが残ると、消し方が分からないまま送ることになる。
      setDrawing(null);
      setStage("cancelled");
    }
  };

  const undo = (): void => setShapes((prev) => prev.slice(0, -1));

  const exportImage = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx || unavailable) return;
    // 位置の印を外した 1 枚を作ってから写す。目印は送るものではない。
    paintFrame(ctx, canvas, false);
    const redactionCount = shapes.filter((s) => s.tool === "redact").length;
    canvas.toBlob((blob) => {
      // ここで出るのは印を焼き込んだあとの 1 枚だけ。元画像は渡さない。
      if (blob) onExport({ blob, redactionCount });
    }, "image/png");
    // 画面のほうは目印を戻す。消えると、次にどこから広げるのか分からなくなる。
    redraw();
  };

  return (
    <div className={styles.captureCanvas}>
      <p className={styles.captureHint}>{UI_COPY.feedback.captureRedactHint}</p>
      {unavailable ? <Callout tone="warn" reason={UI_COPY.feedback.captureUnavailable} /> : null}

      <div className={styles.captureTools} role="group" aria-label={UI_COPY.feedback.captureTitle}>
        {CANVAS_TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tool === t}
            className={styles.captureTool}
            onClick={() => setTool(t)}
          >
            {TOOL_LABEL[t]}
          </button>
        ))}
      </div>

      {/* 黒塗りのときは色を出さない。選べるように見せると「薄い色で塗れる」と誤解される。 */}
      {tool === "redact" ? null : (
        <div className={styles.captureTools} role="group" aria-label="色">
          {CANVAS_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={color === c}
              className={styles.captureTool}
              onClick={() => setColor(c)}
            >
              {COLOR_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      {tool === "text" ? (
        <label className={styles.captureTextInput}>
          {UI_COPY.feedback.textToPlace}
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      ) : null}

      <p className={styles.captureHint} id="capture-keyboard-hint">
        {UI_COPY.feedback.captureKeyboardHint}
      </p>

      <canvas
        ref={canvasRef}
        className={styles.captureSurface}
        aria-label={UI_COPY.feedback.captureTitle}
        aria-describedby="capture-keyboard-hint"
        // 台紙そのものへ Tab で届かないと、道具を選ぶところまでしか進めない。
        tabIndex={0}
        onKeyDown={onCanvasKeyDown}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />

      {/* 画素の座標は画面のどこにも出ていない。数で言わないと、置いた場所が分からない。 */}
      <p className={styles.captureHint} aria-live="polite">
        {caret === null
          ? ""
          : `${UI_COPY.feedback.captureKeyboardPosition} 横 ${Math.round(caret.x)}・縦 ${Math.round(caret.y)}。${STAGE_TEXT[stage]}`}
      </p>

      <p className={styles.captureHint}>
        {UI_COPY.feedback.captureIncomplete}
        {maskedElementCount > 0 ? `（自動で隠した箇所: ${maskedElementCount}）` : ""}
      </p>

      <div className={styles.captureActions}>
        <Button tone="secondary" onClick={undo} disabled={shapes.length === 0}>
          {UI_COPY.feedback.captureUndo}
        </Button>
        <Button tone="secondary" onClick={onRetake}>
          {UI_COPY.feedback.captureRetake}
        </Button>
        <Button tone="secondary" onClick={onDrop}>
          {UI_COPY.feedback.captureDrop}
        </Button>
        <Button onClick={exportImage} disabled={unavailable}>
          この写しを付ける
        </Button>
      </div>
    </div>
  );
}

/**
 * キーボードで動かしている位置の目印。
 *
 * 二重の輪にしてあるのは、**下の画像の色が分からない**ため。
 * 1 色で描くと、同じ色の場所では見えなくなる。
 */
function paintCaret(ctx: CanvasRenderingContext2D, at: Point): void {
  ctx.lineWidth = 2;
  ctx.strokeStyle = CARET_CODE.light;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = CARET_CODE.dark;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 6, 0, Math.PI * 2);
  ctx.stroke();
}

/** 1 つの印を画素へ描く。**重ねるのではなく描く**のが要点。 */
function paint(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.tool === "redact") {
    ctx.fillStyle = REDACT_CODE;
    ctx.fillRect(shape.from.x, shape.from.y, shape.to.x - shape.from.x, shape.to.y - shape.from.y);
    return;
  }
  ctx.strokeStyle = COLOR_CODE[shape.color];
  ctx.fillStyle = COLOR_CODE[shape.color];
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  if (shape.tool === "pen") {
    ctx.beginPath();
    shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    return;
  }
  if (shape.tool === "rect") {
    ctx.strokeRect(shape.from.x, shape.from.y, shape.to.x - shape.from.x, shape.to.y - shape.from.y);
    return;
  }
  if (shape.tool === "text") {
    ctx.font = "20px sans-serif";
    ctx.fillText(shape.text, shape.at.x, shape.at.y);
    return;
  }
  // 矢印。頭を付けないと「線」と区別が付かない。
  const angle = Math.atan2(shape.to.y - shape.from.y, shape.to.x - shape.from.x);
  ctx.beginPath();
  ctx.moveTo(shape.from.x, shape.from.y);
  ctx.lineTo(shape.to.x, shape.to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(shape.to.x, shape.to.y);
  ctx.lineTo(shape.to.x - 14 * Math.cos(angle - Math.PI / 7), shape.to.y - 14 * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(shape.to.x - 14 * Math.cos(angle + Math.PI / 7), shape.to.y - 14 * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}
