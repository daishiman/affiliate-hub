import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/presentation/ui";

/**
 * 管理画面の案内に「押しても何も無いリンク」を作らせない検査。
 *
 * 案内だけ先に足して画面を作り忘れる、という壊れ方が最も起きやすい。
 * 人の目視では見落とすので、機械で止める。
 *
 * 逆向き（画面はあるが案内に無い＝どこからも辿り着けない画面）も同時に見る。
 */
const ROOT = resolve(import.meta.dirname, "../..");

function pageFileFor(href: string): string {
  const segment = href.replace(/^\//, "");
  return resolve(ROOT, "src/app", segment, "page.tsx");
}

/**
 * まだ画面が無いことを承知しているリンク。
 *
 * **この一覧は減らすためだけにある。増やしてはいけない。**
 * 空にならないうちは「案内はあるが画面が無い」状態が残っているということ。
 * ここに書いていないリンクが壊れたら、下のテストが即座に落ちる。
 */
const KNOWN_MISSING: readonly string[] = ["/admin/settings"];

describe("管理画面の案内", () => {
  it("案内にあるリンクには必ず画面がある（未着手の一覧を除く）", () => {
    const missing = ADMIN_NAV.filter(
      (item) => !existsSync(pageFileFor(item.href)) && !KNOWN_MISSING.includes(item.href),
    ).map((item) => `${item.label} (${item.href})`);
    expect(missing, "案内に出ているのに画面が無いリンクがあります").toEqual([]);
  });

  it("未着手の一覧に、もう作り終えたものが残っていない", () => {
    // 画面ができたら一覧から消す。消し忘れると、この一覧が
    // 「壊れたリンクを見逃す穴」として残り続ける。
    const stale = KNOWN_MISSING.filter((href) => existsSync(pageFileFor(href)));
    expect(stale, "画面ができているのに未着手の一覧に残っています").toEqual([]);
  });

  it("案内のリンク先はすべて /admin の下にある", () => {
    // 管理画面の案内から読者向けページへ飛ばすと、
    // 権限の要る画面と要らない画面の境目が利用者に分からなくなる。
    for (const item of ADMIN_NAV) {
      expect(item.href.startsWith("/admin"), `${item.href} が /admin の外を指しています`).toBe(true);
    }
  });
});
