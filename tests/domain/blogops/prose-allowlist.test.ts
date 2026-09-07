/**
 * @tier 1
 * @req REQ-BLOG05
 * @types boundary, equivalence, error
 *
 * **当てるのは「通らないこと」である。**
 *
 * 通ることの確認は画面を見れば分かる。通ってはいけないものが通ったことは、
 * 読者の画面で起きるので運営者からは見えない。だから危ない側を列挙する。
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWED_EMBED_HOSTS,
  safeEmbedUrl,
  safeHref,
  safeImageSrc,
} from "@/domain/blogops";

describe("本文の許可リスト — 行き先", () => {
  const allowed = [
    "https://example.com/a",
    "http://example.com/a",
    "/s/site/article",
    "/media/a.png",
  ];
  for (const url of allowed) {
    it(`${url} は通す`, () => {
      expect(safeHref(url)).toBe(url);
    });
  }

  const blocked = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\tscript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//example.com/よそのホスト",
    "",
    "   ",
  ];
  for (const url of blocked) {
    it(`${JSON.stringify(url)} は通さない`, () => {
      expect(safeHref(url)).toBeNull();
    });
  }

  it("画像の場所もリンクと同じ規則で絞る", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("/media/a.png")).toBe("/media/a.png");
  });
});

describe("本文の許可リスト — 埋め込みの宛先", () => {
  it("一覧にあるホストだけを通す", () => {
    for (const host of ALLOWED_EMBED_HOSTS) {
      expect(safeEmbedUrl(`https://${host}/x`), host).toBe(`https://${host}/x`);
    }
  });

  const blocked = [
    "https://evil.example.com/x",
    "https://www.youtube.com.evil.example/x",
    "https://evil.example/www.youtube.com",
    "http://",
    "javascript:alert(1)",
    "/s/site/article",
  ];
  for (const url of blocked) {
    it(`${JSON.stringify(url)} は埋め込みにしない`, () => {
      expect(safeEmbedUrl(url)).toBeNull();
    });
  }

  it("サイトの中の相対の場所は埋め込みにしない（ホストが決まらないため）", () => {
    /*
      リンクなら相対を通すが、埋め込みは違う。宛先が決まらないものへ
      読者の画面の一区画を渡すと、決めた人がいないまま渡ることになる。
    */
    expect(safeEmbedUrl("/anything")).toBeNull();
  });
});
