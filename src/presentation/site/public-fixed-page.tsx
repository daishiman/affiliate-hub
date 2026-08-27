import type { FixedPageRecord } from "@/application/ports/blog-ops";
import type { ReactNode } from "react";
import { Prose, SitePage, proseParagraphs } from "@/presentation/ui";

/** 保存した固定ページの本文を、全 8 種で同じ作法で描く。 */
export function PublicFixedPageContent({
  page,
  children,
}: {
  readonly page: FixedPageRecord;
  readonly children?: ReactNode;
}) {
  return (
    <SitePage title={page.title}>
      {proseParagraphs(page.body).map((paragraph) => (
        <Prose key={paragraph}>{paragraph}</Prose>
      ))}
      {children}
    </SitePage>
  );
}
