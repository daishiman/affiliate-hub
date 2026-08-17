import { describe, expect, it } from "vitest";
import { type Capability, capabilitiesOf } from "@/domain/identity";
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
});
