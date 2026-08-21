/** @tier 1 */
import { describe, expect, it } from "vitest";
import { READER_DISCLOSURE_TEXT } from "@/domain/compliance/disclosure";
import { UI_COPY } from "@/presentation/ui/copy";

/**
 * 広告表示の文が、画面と AI で同じであること。
 *
 * --- なぜ 2 か所に書いてあるのか ---
 * 共通 UI は業務層を読まない決まりになっている（`ui-layers.test.ts`）。
 * 部品が業務のきまりを持ち始めると、順位表を直したらボタンが壊れる、
 * という状態になるからで、その決まりは緩めない。
 * そのため文字そのものは画面側にも書く。**代わりにここで一致を固定する。**
 * `UI_COPY.factSource` と `FACT_LABELS` が同じ扱いで、先例に合わせている。
 *
 * --- 何を守っているか ---
 * §20.2 は広告表示を `article_top`（記事の冒頭）と
 * `ai_answer` / `webmcp_response`（AI の答え）の両方で求めている。
 * 片方だけ直すと、同じ記事について読者が読む断りと AI が言う断りが
 * 食い違う。**どちらが正しいか、後からは決められない。**
 * 特に順位の一文は法令の話ではなく「報酬を順位に使っていない」という
 * この仕組みの不変条件の宣言なので、2 通りの言い方があってはならない。
 */

describe("広告表示の文言は 1 つ", () => {
  it("記事の冒頭に出す文と、AI に返す文が同じ", () => {
    expect(UI_COPY.disclosure.bannerBody).toBe(READER_DISCLOSURE_TEXT.body);
  });

  it("順位の一文が同じ", () => {
    expect(UI_COPY.disclosure.rankingNote).toBe(READER_DISCLOSURE_TEXT.rankingNote);
  });

  it("見出しが同じ", () => {
    expect(UI_COPY.disclosure.bannerTitle).toBe(READER_DISCLOSURE_TEXT.title);
  });

  it("どれも空でない（空文字どうしで一致させて通さない）", () => {
    for (const [key, text] of Object.entries(READER_DISCLOSURE_TEXT)) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});
