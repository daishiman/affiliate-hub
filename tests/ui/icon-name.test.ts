/**
 * @tier 1
 * @req REQ-B02, REQ-B08
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_ICON,
  ICON_NAMES,
  pickCategoryIcon,
} from "@/presentation/ui/primitives/icon-name";

/**
 * カテゴリーの名前から記号を選ぶところ。
 *
 * --- ここで固定したいこと ---
 * 1. **どんな名前でも必ず記号が返ること。** 運営はカテゴリー名を自由に決める。
 *    表に無い言葉で `undefined` が返ると、その行だけ文字の始まる位置がずれ、
 *    一覧が崩れる。しかも見本データでは起きないので、公開後に初めて出る。
 * 2. **語が重なるカテゴリーの優先順位。** 「モバイルバッテリー」と「充電器」は
 *    どちらも充電の話で、順序を入れ替えると片方の区別が消える。
 *    表の並び順が決まりごとなので、機械で押さえる。
 * 3. **英語の手がかりを部分一致で当てないこと。** `car` が `card` に当たると、
 *    鞄のカテゴリーに車の絵が付く。**間違った記号は、記号が無いより悪い。**
 *    読者は絵を先に見るので、文字を読み直すまで違う場所だと思う。
 */

describe("カテゴリーの記号を選ぶ", () => {
  it.each([
    ["モバイルバッテリー", "power-bank", "battery"],
    ["充電器", "chargers", "plug"],
    ["ワイヤレスイヤホン", "earphones", "headphones"],
    ["ノートPC", "laptops", "laptop"],
    ["光回線", "hikari", "wifi"],
    ["VPN", "vpn", "shield"],
    ["ゲーミングチェア", "gaming-chairs", "gamepad"],
    ["椅子", "chairs", "chair"],
    ["机", "desks", "desk"],
    ["照明", "lighting", "lamp"],
  ])("「%s」(%s) には %s を選ぶ", (label, slug, expected) => {
    expect(pickCategoryIcon(label, slug)).toBe(expected);
  });

  it("表に無い言葉でも、必ず既定の記号を返す", () => {
    // 「印が無い」状態を作らせない。ここが undefined を返すと一覧の行が崩れる。
    for (const [label, slug] of [
      ["", ""],
      ["季節のたより", "seasonal-letters"],
      ["🍵", "tea-time"],
    ]) {
      const picked = pickCategoryIcon(label, slug);
      expect(ICON_NAMES).toContain(picked);
      expect(picked).toBe(DEFAULT_CATEGORY_ICON);
    }
  });

  it("英語の手がかりは、語のまとまりとしてだけ当てる", () => {
    // card / carpet に car が当たると、鞄や敷物に車の絵が付く。
    expect(pickCategoryIcon("カード", "cards")).toBe(DEFAULT_CATEGORY_ICON);
    expect(pickCategoryIcon("カーペット", "carpets")).toBe(DEFAULT_CATEGORY_ICON);
    // 一方、語として立っていれば当てる。
    expect(pickCategoryIcon("Car goods", "car-goods")).toBe("car");
  });

  it("選ばれる記号は、必ず形を持っている名前である", () => {
    // 形の表に無い名前を返すと、その行だけ絵が消える（描画は落ちない）。
    const labels = ["椅子", "モバイルバッテリー", "何かべつのもの", "Gaming", "照明"];
    for (const label of labels) {
      expect(ICON_NAMES).toContain(pickCategoryIcon(label, label));
    }
  });
});
