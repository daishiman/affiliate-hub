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

/**
 * 黒塗りは色を選ばせない。薄い色で塗ると隠れないため。
 *
 * **すぐ上の `COLOR_CODE.black` とは別物である。**あちらは注釈の線の色で、読める黒。
 * こちらは下の画像を消すための黒で、透けないことが目的。値が近いので片方を
 * 使い回したくなるが、注釈の色を調整した日に塗り潰しが薄くなる。
 * （ここに実際の色を書くと、色の直書きを見張る検査が拾う。見張りはコードと
 * コメントを区別できないが、区別しないほうが安上がりで正しい。）
 *
 * `export` しているのは、検査 (`tests/ui/capture-canvas.test.tsx`) が塗り色を
 * 主張するためである。**名前が在っても届かなければ写しは消えない** — `export` が
 * 無かった間、検査は `"#000000"` と書き写すほかなく、ここを薄い色に変えても
 * 気づけなかった（塗り潰しが透ける＝実害のある側に倒れる）。
 */
export const REDACT_CODE = "#000000";

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

/**
 * 座標を扱わずに黒塗りを置くための区切り。
 *
 * --- なぜ「要素の一覧」ではないのか（2026-08-26 に測った事実）---
 *
 * 当初の案は「3 番目の見出しを隠す」のように**要素の名前で選ぶ**道だった
 * （`tasks/task-capture-element-selection.md`）。その仕様書の手順 1 は
 * 「撮る側が要素の一覧（名前と位置）を持てるかを確かめる。持てないなら、ここで止まる」
 * である。測った結果は **持てない**：
 *
 *   - 写しは `navigator.mediaDevices.getDisplayMedia` で撮った**映像の 1 枚**で、
 *     DOM を写したものではない（`feedback-button.tsx` の `captureScreen`）。
 *   - どの画面を渡すかは必ず本人が選ぶ。**別のウィンドウや別のアプリも選べる。**
 *     `preferCurrentTab` は Chromium だけが見るただの希望で、保証にならない。
 *   - よって、いま開いている DOM の位置を一覧にしても、**写った画像の座標と
 *     一致する保証が無い。** ずれたまま「3 番目の見出し」と名乗って塗ると、
 *     隠したはずのものが隠れていない写しが送られる。**この機能で最悪の壊れ方。**
 *   - 宣言による自動マスク（`data-capture="mask"`）も、宣言だけがあって
 *     付けている場所が 1 つも無い。撮る側は要素を 1 つも知らない。
 *
 * そこで**画像そのものを区切る**。写っているものが何であれ「上段の左」は嘘に
 * ならないし、DOM と一致している必要も無い。要素の名前で呼ぶ道は、撮り方が
 * DOM を写す形に変わった日に、この区切りの隣へ足せばよい。
 *
 * 82 で入れた座標の道は残す。要素になっていないもの（画像の中の文字、表の一部）は
 * 座標でしか指せない。**置き換えではなく、近道を足す。**
 */
export const CAPTURE_REGION_ROWS = [
  UI_COPY.feedback.captureRegionTop,
  UI_COPY.feedback.captureRegionMiddle,
  UI_COPY.feedback.captureRegionBottom,
] as const;

export const CAPTURE_REGION_COLUMNS = [
  UI_COPY.feedback.captureRegionLeft,
  UI_COPY.feedback.captureRegionCenter,
  UI_COPY.feedback.captureRegionRight,
] as const;

/** 「上段の左」。読み上げにはこの名前しか届かないので、名前だけで位置が分かる形にする。 */
export const captureRegionLabel = (row: number, col: number): string =>
  `${CAPTURE_REGION_ROWS[row]}の${CAPTURE_REGION_COLUMNS[col]}`;

type Shape =
  | { readonly tool: "pen"; readonly color: CanvasColor; readonly points: readonly Point[] }
  | { readonly tool: "rect" | "arrow"; readonly color: CanvasColor; readonly from: Point; readonly to: Point }
  | { readonly tool: "text"; readonly color: CanvasColor; readonly at: Point; readonly text: string }
  | { readonly tool: "redact"; readonly from: Point; readonly to: Point }
  /*
    区画の黒塗りは**画素の座標を持たない**。持たせると、押したあとに画像が
    読み込まれて台紙の寸法が変わった日に、塗った場所だけが元の寸法のまま残る。
    行と列だけを覚えておき、描く直前にそのときの寸法から割り出す。
  */
  | { readonly tool: "region"; readonly row: number; readonly col: number };

/**
 * 引きずって描いている最中のもの。**区画はここへ入らない。**
 *
 * 区画は押した瞬間に決まるので「描きかけ」の状態を持たない。
 * それを中で弾く形ではなく**型から外す形**で書いてある。中で弾くと、
 * 区画を描きかけに入れる書き方が通ってしまい、黙って無視されるだけになる
 * （すぐ上の `beginAt` が `"text"` を引数から外しているのと同じ理由）。
 */
type DrawingShape = Exclude<Shape, { readonly tool: "region" }>;

type Point = { readonly x: number; readonly y: number };

/** 外へ渡す 1 枚と、その申告。申告は domain 側でもう一度検査される。 */
export type BurnedCapture = {
  readonly blob: Blob;
  readonly redactionCount: number;
  readonly maskedElementCount: number;
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
  const [drawing, setDrawing] = useState<DrawingShape | null>(null);
  /**
   * キーボードで動かしている位置。**触るまでは null。**
   * null のあいだは画素へ何も描かないし、読み上げも黙っている
   * （ポインタで作った写しに、十字が焼き込まれて出ていかないように）。
   */
  const [caret, setCaret] = useState<Point | null>(null);
  const [stage, setStage] = useState<KeyStage>("idle");
  /** 区画を押した結果。読み上げへ渡すためだけに持つ（画素には出ない）。 */
  const [regionMessage, setRegionMessage] = useState("");
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
        paint(ctx, shape, canvas);
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
   * ここから下の 3 つは**出来事（ポインタ／キー）を受け取らない**。受け取るのは
   * 座標と、描くものの種類だけである。ポインタとキーボードで別々の描き方を持つと、
   * 片方だけ直る日が来る（実際、長らくポインタの経路しか無かった。
   * `docs/product/backlog.md` 項目 82）。
   */

  /** 文字を 1 つ置く。置けたかどうかを返す（空のままなら置かない）。 */
  const placeText = (at: Point): boolean => {
    // 文字は「入れる文字」が空なら置かない。空の印は誰にも読めない。
    if (text.trim() === "") return false;
    setShapes((prev) => [...prev, { tool: "text", color, at, text }]);
    return true;
  };

  /**
   * 引きずって描くものを 1 つ始める。
   *
   * **`drawTool` を引数で受け、そこから `"text"` を外してあるのが本体である。**
   * 文字は押した時点で `placeText` が置き終えるので、ここへは来ない。
   * その「来ない」を、中で早期に弾く形ではなく**呼ぶ側に証明させる形**で書いた。
   * 中で弾くと、`"text"` で呼んでも何も起きないまま通ってしまい、
   * 型が言うのは「来ない」ではなく「来ても黙って無視する」になる。
   * 引数で外しておけば、`"text"` を弾き忘れた呼び出しはその場で型検査に当たる。
   */
  const beginAt = (at: Point, drawTool: Exclude<CanvasTool, "text">): void => {
    setDrawing(
      drawTool === "pen"
        ? { tool: "pen", color, points: [at] }
        : drawTool === "redact"
          ? { tool: "redact", from: at, to: at }
          : { tool: drawTool, color, from: at, to: at },
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
    beginAt(at, tool);
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
      beginAt(at, tool);
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

  /**
   * 区画を 1 つ塗る／外す。**座標を 1 度も動かさずに黒塗りが 1 つ決まる経路。**
   *
   * 押した結果を読み上げへ渡すところまでが経路である。画素は見えないので、
   * 言葉にしないと「押したが、塗れたのか外れたのか分からない」で終わる。
   */
  const toggleRegion = (row: number, col: number): void => {
    const already = shapes.some((s) => s.tool === "region" && s.row === row && s.col === col);
    const label = captureRegionLabel(row, col);
    if (already) {
      setShapes((prev) => prev.filter((s) => !(s.tool === "region" && s.row === row && s.col === col)));
      setRegionMessage(`${label}${UI_COPY.feedback.captureRegionRemoved}`);
      return;
    }
    setShapes((prev) => [...prev, { tool: "region", row, col }]);
    setRegionMessage(`${label}${UI_COPY.feedback.captureRegionAdded}`);
  };

  /**
   * 1 つ戻す。**読み上げの文も一緒に消す。**
   * 残すと、外したはずの区画について「黒塗りにしました」が読まれたままになる。
   */
  const undo = (): void => {
    setShapes((prev) => prev.slice(0, -1));
    setRegionMessage("");
  };

  const exportImage = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx || unavailable) return;
    // 位置の印を外した 1 枚を作ってから写す。目印は送るものではない。
    paintFrame(ctx, canvas, false);
    /*
      区画で塗ったものも黒塗りとして数える。**塗り方が違うだけで、
      隠れている面積は同じ。**ここで数え落とすと、domain 側は
      「黒塗りの無い写し」として扱い、確認の手順が 1 つ飛ぶ。
    */
    const redactionCount = shapes.filter((s) => s.tool === "redact" || s.tool === "region").length;
    canvas.toBlob((blob) => {
      // ここで出るのは印を焼き込んだあとの 1 枚だけ。元画像は渡さない。
      if (blob) onExport({ blob, redactionCount, maskedElementCount });
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

      {/*
        黒塗りのときは色を出さない。選べるように見せると「薄い色で塗れる」と誤解される。
        代わりに、その場所へ**区画で隠す道**を出す。色の選択が消えて空くのは
        ちょうどこの位置で、黒塗りの選択肢が並ぶ場所として意味も揃っている。
      */}
      {tool === "redact" ? (
        <>
          <p className={styles.captureHint} id="capture-region-hint">
            {UI_COPY.feedback.captureRegionHint}
          </p>
          <div
            className={styles.captureRegionGrid}
            role="group"
            aria-label={UI_COPY.feedback.captureRegionTitle}
            aria-describedby="capture-region-hint"
          >
            {CAPTURE_REGION_ROWS.map((_, row) =>
              CAPTURE_REGION_COLUMNS.map((_col, col) => {
                const filled = shapes.some((s) => s.tool === "region" && s.row === row && s.col === col);
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    // 塗ってあるかどうかを色だけで示さない。見分けの付かない人には届かない。
                    aria-pressed={filled}
                    className={styles.captureTool}
                    onClick={() => toggleRegion(row, col)}
                  >
                    {captureRegionLabel(row, col)}
                  </button>
                );
              }),
            )}
          </div>
        </>
      ) : (
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

      {/*
        画素の座標は画面のどこにも出ていない。数で言わないと、置いた場所が分からない。

        **読み上げの出口はここ 1 つにする。**区画を押した結果も同じ欄へ入れる。
        欄を 2 つに分けると、読み上げの側は近いほうから読むので、
        操作と読み上げの順番が入れ替わる（実際、分けた形では
        「位置」を見ていた既存の検査が空の欄を拾った）。
      */}
      <p className={styles.captureHint} aria-live="polite">
        {[
          caret === null
            ? ""
            : `${UI_COPY.feedback.captureKeyboardPosition} 横 ${Math.round(caret.x)}・縦 ${Math.round(caret.y)}。${STAGE_TEXT[stage]}`,
          regionMessage,
        ]
          .filter((line) => line !== "")
          .join(" ")}
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
function paint(ctx: CanvasRenderingContext2D, shape: Shape, canvas: HTMLCanvasElement): void {
  if (shape.tool === "region") {
    // 区画は行と列しか覚えていない。**そのときの寸法から割り出す。**
    const width = canvas.width / CAPTURE_REGION_COLUMNS.length;
    const height = canvas.height / CAPTURE_REGION_ROWS.length;
    ctx.fillStyle = REDACT_CODE;
    ctx.fillRect(shape.col * width, shape.row * height, width, height);
    return;
  }
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
