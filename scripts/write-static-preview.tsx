/**
 * `AppShell` と `DensitySamples` の実物を描き、案内と密度の写しを焼く。
 * 共通の CSS 取得・安全判定・書き出しは `scripts/lib/static-preview.mjs` が担う。
 *
 * ```
 * pnpm run preview:static
 * ```
 */

import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { Card, Page } from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";
import { DensitySamples } from "@/app/admin/ui-catalog/density-samples";
import styles from "@/app/admin/admin.module.css";
import { writeStaticPreview } from "./lib/static-preview.mjs";

const OUT = "docs/product/preview/nav-and-density.html";

function body(): string {
  return renderToStaticMarkup(
    <AppShell
      actualRoutePath="/admin/ui-catalog"
      navContextPath="/admin/ui-catalog"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "画面部品の見本" }]}
    >
      <Page
        title="画面部品の見本"
        lead="実物の部品を、実物の見た目のまま並べています。ここで見えている間隔と行の長さが、アプリでもそのまま出ます。"
      >
        <Card>
          <h2 className={styles.sectionTitle}>22. 詰まり具合の見比べ</h2>
          <DensitySamples />
        </Card>
      </Page>
    </AppShell>,
  );
}

async function main(): Promise<void> {
  await writeStaticPreview({
    out: OUT,
    bodyHtml: body(),
    htmlAttributes: { lang: "ja", ...appearanceAttributes(DEFAULT_APPEARANCE) },
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "scripts/write-static-preview.tsx",
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
