/** @tier 1 */
import { describe, expect, it } from "vitest";
import { type Capability, capabilitiesOf } from "@/domain/identity";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { ADMIN_NAV, visibleNav } from "@/presentation/ui";

/**
 * 案内に「押しても必ず断られるリンク」を残さない。
 *
 * 権限で弾く仕組みだけを入れて案内を絞り忘れると、
 * 使う人には「壊れている画面がある」ようにしか見えない。
 * 絞り込みが 1 箇所（共通の骨格）で効いていることを固定する。
 */

const ALL_CAPABILITIES: readonly Capability[] = [...capabilitiesOf(["owner"])];

function capsOfRole(role: Parameters<typeof capabilitiesOf>[0][number]): string[] {
  return [...capabilitiesOf([role])].map(String);
}

describe("案内の絞り込み", () => {
  it("案内の項目が必要な権限の名前を持っている（null は誰にでも見せる）", () => {
    const names = new Set<string>(ALL_CAPABILITIES.map(String));
    for (const item of ADMIN_NAV) {
      if (item.requires === null) continue;
      expect(names.has(item.requires), `${item.href} の ${item.requires} は権限表に無い名前です`).toBe(
        true,
      );
    }
  });

  it("持ち主（owner）には全部見える", () => {
    expect(visibleNav(ADMIN_NAV, capsOfRole("owner"))).toHaveLength(ADMIN_NAV.length);
  });

  it("書き手には報酬の画面を見せない", () => {
    const shown = visibleNav(ADMIN_NAV, capsOfRole("writer")).map((i) => i.href);
    expect(shown).not.toContain("/admin/affiliate");
    expect(shown).not.toContain("/admin/inbox");
    // 記事の仕事に必要なものは残る
    expect(shown).toContain("/admin/content");
    expect(shown).toContain("/admin/products");
  });

  it("分析担当には数字と報酬が見え、記事も読める", () => {
    const shown = visibleNav(ADMIN_NAV, capsOfRole("analyst")).map((i) => i.href);
    expect(shown).toContain("/admin/analytics");
    expect(shown).toContain("/admin/affiliate");
    expect(shown).toContain("/admin/content");
  });

  it("何も権限が無くてもホームだけは残る（行き先ゼロの画面を作らない）", () => {
    const shown = visibleNav(ADMIN_NAV, []);
    expect(shown).toHaveLength(1);
    expect(shown[0].href).toBe("/admin");
  });

  it("権限を渡さないときは全部見せる（権限の概念が無い場面で使えるようにする）", () => {
    expect(visibleNav(ADMIN_NAV, undefined)).toHaveLength(ADMIN_NAV.length);
  });

  /**
   * いま実際に動かせるログインは見本の 1 つだけである。
   * その 1 つで開けない画面は、**作った本人以外には存在しないのと同じ**になる。
   *
   * 2026-08-18 まで、この検査は「見本ですべての画面に行ける」を固定していた。
   * その形は「確かめやすさ」と「開いたまま」を同じ 1 本の縄で縛っていて、
   * 見本に権限を足すことでしか緑にできない（＝誰でもできることが増える）。
   *
   * 見本から書き込みの役を外した（`sample-actor.ts`）ので、
   * ここは**開けない画面の一覧**を人が宣言し、実測と突き合わせる形へ変えた。
   * 一覧に載っている画面は、認証が入るまで誰も動かして確かめられない。
   * **この一覧は増えてはならず、認証が入った日に空になる。**
   */
  const UNVERIFIABLE_UNTIL_AUTH: readonly string[] = [
    "/admin/products（product.read が要る）",
    "/admin/feedback（feedback.read が要る）",
  ];

  it("見本で開けない画面は、宣言した分だけである（増やさない）", () => {
    const held = [...capabilitiesOf(SAMPLE_ACTOR.roles)].map(String);
    const hidden = ADMIN_NAV.filter((i) => i.requires !== null && !held.includes(i.requires));
    expect(
      hidden.map((i) => `${i.href}（${i.requires} が要る）`),
      "見本で開けない画面が増えました。認証を入れるまで、誰もこの画面を確かめられません",
    ).toEqual(UNVERIFIABLE_UNTIL_AUTH);
  });
});
