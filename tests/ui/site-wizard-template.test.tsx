/** @tier 1 @req REQ-A01 @types contract, scenario */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BLOG_TEMPLATES } from "@/domain/authoring/blog-template";
import type { SiteDraftView } from "@/application/usecases/site/build-site";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { CreateSiteForm } = await import("@/presentation/admin/publish/site-wizard-form");

describe("A1 ブログ作成時の見せ方選択", () => {
  it("6種を可視ラベルで選び、templateIdとして作成Actionへ送れる", () => {
    const draft = {
      draftId: "sd-a1",
      name: "A1",
      slug: "a1",
      steps: [],
      currentStep: "create",
      totalSteps: 13,
      doneCount: 12,
      incomplete: [],
      incompleteLabels: [],
      createdSiteSlug: null,
      answers: {},
      categoryCount: 0,
      articleTypes: [],
      fields: [],
    } satisfies SiteDraftView;

    const html = renderToStaticMarkup(<CreateSiteForm draft={draft} />);
    expect(html).toContain('name="templateId"');
    for (const template of BLOG_TEMPLATES) {
      expect(html).toContain(`value="${template.id}"`);
      expect(html).toContain(template.label);
    }
  });
});
