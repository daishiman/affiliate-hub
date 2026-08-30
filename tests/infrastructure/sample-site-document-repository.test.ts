/**
 * @tier 1
 * @req REQ-P07
 * @types equivalence
 *
 * 見本の固定文書は、管理画面と読者画面で同じ site/key の文書を返す。
 * 片方だけがブログ固有の上書きを忘れると、運営者が確認した文面と
 * 読者に公開される文面が食い違うため、両方の入口を突き合わせる。
 */
import { describe, expect, it } from "vitest";
import { SITE_DOCUMENT_KEYS } from "@/domain/authoring";
import {
  createSampleContentRepository,
  createSampleSiteDocumentRepository,
} from "@/infrastructure/persistence/sample/content-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/sample-identity";
import {
  FOURTH_SITE_SLUG,
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";

async function listedDocuments(siteSlug: string) {
  const result = await createSampleSiteDocumentRepository().listBySite(
    SAMPLE_WORKSPACE_ID,
    siteSlug,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("見本の固定文書", () => {
  it("全ブログ・全種類で、管理画面と読者画面が同じ文書を返す", async () => {
    const reader = createSampleContentRepository();

    for (const site of sampleSites()) {
      const managed = await listedDocuments(site.slug);

      for (const key of SITE_DOCUMENT_KEYS) {
        const published = await reader.findPolicyDocument(site.slug, key);
        if (!published.ok) throw new Error(published.error.message);
        const managedDocument = managed.find((document) => document.key === key);

        expect(published.value, `${site.slug}/${key}`).toEqual(
          managedDocument === undefined
            ? null
            : { title: managedDocument.title, body: managedDocument.body },
        );
      }
    }
  });

  it("ブログ固有の上書きを、管理画面でも基底文書と区別する", async () => {
    const base = await listedDocuments(SAMPLE_SITE_SLUG);
    const overridden = await listedDocuments(FOURTH_SITE_SLUG);

    expect(overridden.find((document) => document.key === "advertising-policy")?.body).not.toEqual(
      base.find((document) => document.key === "advertising-policy")?.body,
    );
  });
});
