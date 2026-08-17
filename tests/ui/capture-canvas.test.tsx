// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ANNOTATION_COLORS,
  ANNOTATION_TOOLS,
  ANNOTATION_TOOL_LABELS,
  ANNOTATION_COLOR_LABELS,
} from "@/domain/feedback/capture-policy";
import { UI_COPY } from "@/presentation/ui/copy";
import { CANVAS_COLORS, CANVAS_TOOLS, CaptureCanvas } from "@/presentation/ui/patterns/capture-canvas";

/**
 * 印を付ける台紙。
 *
 * --- 書き写しがずれないことを見る ---
 *
 * 共有 UI は domain を読まない決まりなので、道具と色の一覧は台紙側に書き写してある。
 * 書き写しは必ずずれる。**ずれた瞬間に落ちる**ようにここで突き合わせておく。
 * 検査は両方を読めるので、ここが突き合わせの置き場所として正しい。
 *
 * --- 黒塗りの色を選ばせない ---
 *
 * 薄い色で塗ると隠れない。選べるように見せること自体が誤りなので、
 * 「選ばせていない」ことを画面の出力で見る。
 */

afterEach(cleanup);

function mount() {
  const exported: { count: number } = { count: 0 };
  render(
    <CaptureCanvas
      source="data:image/png;base64,iVBORw0KGgo="
      maskedElementCount={2}
      onExport={() => {
        exported.count += 1;
      }}
      onRetake={() => {}}
      onDrop={() => {}}
    />,
  );
  return exported;
}

describe("domain の決まりとの一致", () => {
  it("道具の一覧と並びが domain と同じ", () => {
    expect(CANVAS_TOOLS).toEqual(ANNOTATION_TOOLS);
  });

  it("色の一覧と並びが domain と同じ", () => {
    expect(CANVAS_COLORS).toEqual(ANNOTATION_COLORS);
  });

  it("画面に出す道具名・色名が domain の言い方と同じ", () => {
    for (const tool of ANNOTATION_TOOLS) {
      expect(Object.values(UI_COPY.feedback)).toContain(ANNOTATION_TOOL_LABELS[tool]);
    }
    for (const color of ANNOTATION_COLORS) {
      expect(Object.values(UI_COPY.feedback)).toContain(ANNOTATION_COLOR_LABELS[color]);
    }
  });
});

describe("黒塗り", () => {
  it("黒塗りを選ぶと、色の選択そのものが消える", () => {
    mount();
    // 最初は色を選べる（手書き）。
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.colorRed })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.toolRedact }));
    // 薄い色で塗れると誤解させないため、選択肢ごと出さない。
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.colorRed })).toBeNull();
  });

  it("焼き込むことと、写るのは開いている部分だけであることを先に伝える", () => {
    mount();
    expect(screen.getByText(UI_COPY.feedback.captureRedactHint)).not.toBeNull();
    expect(screen.getByText(new RegExp(UI_COPY.feedback.captureIncomplete))).not.toBeNull();
  });
});

describe("逃げ道", () => {
  it("元に戻す・撮り直す・画像を外す が常にある", () => {
    mount();
    for (const label of [
      UI_COPY.feedback.captureUndo,
      UI_COPY.feedback.captureRetake,
      UI_COPY.feedback.captureDrop,
    ]) {
      expect(screen.getByRole("button", { name: label }), `${label} がありません`).not.toBeNull();
    }
  });

  it("何も描いていないときは「元に戻す」を押せない", () => {
    mount();
    // 押せるのに何も起きないボタンは、故障と見分けが付かない。
    expect(
      screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("描画機能の無い環境では、断ったうえで写しを付けさせない", () => {
    mount();
    // jsdom は canvas の描画面を持たない。黙って空の画像を作らないこと。
    expect(screen.getByText(UI_COPY.feedback.captureUnavailable)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "この写しを付ける" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
