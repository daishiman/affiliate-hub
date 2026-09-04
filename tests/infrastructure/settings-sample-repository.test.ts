/**
 * @tier 1
 * @req REQ-P01
 * @types boundary, state-transition
 */
import { describe, expect, it } from "vitest";
import {
  SAMPLE_BRAND_ID,
  createSampleBrandRepository,
  createSampleDisclosureRepository,
  createSampleMembershipRepository,
  createSampleWorkspaceRepository,
} from "@/infrastructure/persistence/sample/settings-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { type DomainError, type Result, taggedString } from "@/domain/shared";

function valueOf<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

describe("設定の見本保存先", () => {
  it("作業場所は所有者にだけ返し、画面に出す件数を同じ見本から返す", async () => {
    const repository = createSampleWorkspaceRepository();

    expect(valueOf(await repository.findById(SAMPLE_WORKSPACE_ID))?.name).toBe("見本の作業場所");
    expect(
      valueOf(await repository.findById(taggedString<"WorkspaceId">("ws_missing"))),
    ).toBeNull();
    expect(valueOf(await repository.findByOwner(taggedString<"UserId">("u_owner")))).toHaveLength(
      1,
    );
    expect(valueOf(await repository.findByOwner(taggedString<"UserId">("u_other")))).toEqual([]);
    expect(valueOf(await repository.countBrands(SAMPLE_WORKSPACE_ID))).toBe(2);
    expect(valueOf(await repository.countSites(SAMPLE_WORKSPACE_ID))).toBe(2);
    expect(
      valueOf(
        await repository.countGenerationsThisMonth(
          SAMPLE_WORKSPACE_ID,
          new Date("2026-08-01T00:00:00Z"),
        ),
      ),
    ).toBe(37);
  });

  it("現担当だけを数え、大文字小文字を問わず招待先を探せる", async () => {
    const repository = createSampleMembershipRepository();

    expect(valueOf(await repository.countCurrent(SAMPLE_WORKSPACE_ID))).toBe(4);
    expect(
      valueOf(
        await repository.findByInvitedEmail(SAMPLE_WORKSPACE_ID, "EDITOR@EXAMPLE.COM"),
      )?.displayName,
    ).toContain("編集担当");
    expect(
      valueOf(
        await repository.findByUser(SAMPLE_WORKSPACE_ID, taggedString<"UserId">("u_sample")),
      )?.invitedEmail,
    ).toBe("editor@example.com");
    expect(
      valueOf(
        await repository.findById(
          SAMPLE_WORKSPACE_ID,
          taggedString<"MembershipId">("missing"),
        ),
      ),
    ).toBeNull();
    expect(
      valueOf(await repository.list(SAMPLE_WORKSPACE_ID, { cursor: null, limit: 2 })).items,
    ).toHaveLength(2);
    expect(valueOf(await repository.findOwner(SAMPLE_WORKSPACE_ID))?.roles).toContain("owner");
  });

  it("ブランドと広告表記の一覧はページ上限を守り、識別子で読み戻せる", async () => {
    const brands = createSampleBrandRepository();
    const disclosures = createSampleDisclosureRepository();

    expect(
      valueOf(await brands.findById(SAMPLE_WORKSPACE_ID, SAMPLE_BRAND_ID))?.displayName,
    ).toBe("見本ブランド");
    expect(valueOf(await brands.list(SAMPLE_WORKSPACE_ID, { cursor: null, limit: 1 })).items).toHaveLength(
      1,
    );
    const disclosurePage = valueOf(
      await disclosures.list(SAMPLE_WORKSPACE_ID, { cursor: null, limit: 1 }),
    );
    const disclosureId = disclosurePage.items[0]?.id;
    expect(disclosureId).toBeDefined();
    if (disclosureId === undefined) return;
    expect(
      valueOf(await disclosures.findById(SAMPLE_WORKSPACE_ID, disclosureId))?.visibleMessage,
    ).toBe(disclosurePage.items[0]?.visibleMessage);
  });
});
