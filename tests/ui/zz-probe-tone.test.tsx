/**
 * @tier 2
 *
 * ボタンの「目立ち方」が、見て区別できる形で出ていること。
 *
 * これ自体は小さい確認だが、**同意バナーの検査がここに乗っている。**
 * `tests/ui/consent-banner.test.tsx` は「2 つのボタンの目立ち方が揃っている」
 * ことを class 名の一致で見ている。もし tone の違いが class に出なくなると、
 * あちらは「揃っている」と言ったまま何も見なくなる（片方だけ強調しても緑）。
 * 気づけないので、ここで先に止める。
 */
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/presentation/ui/primitives/button";

describe("ボタンの目立ち方", () => {
  it("役割が違えば、class も違う", () => {
    render(
      <>
        <Button tone="primary">強い</Button>
        <Button tone="secondary">並ぶ</Button>
      </>,
    );
    const strong = screen.getByRole("button", { name: "強い" }).className;
    const plain = screen.getByRole("button", { name: "並ぶ" }).className;
    expect(strong, "tone の違いが class に出ていません").not.toBe(plain);
  });

  it("役割が同じなら、class も同じ", () => {
    render(
      <>
        <Button tone="secondary">左</Button>
        <Button tone="secondary">右</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "左" }).className).toBe(
      screen.getByRole("button", { name: "右" }).className,
    );
  });
});
