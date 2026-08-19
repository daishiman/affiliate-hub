/**
 * ログインの要らない「静止した写し」を 1 枚の HTML に焼く。
 *
 * ```
 * pnpm run preview:static
 * ```
 *
 * ## これは何ではないか
 *
 * **動いているアプリを認証なしで見せる仕掛けではない。**入口の門
 * （`src/middleware.ts`）にも `matcher` にも触っていない。ここがしているのは、
 * 画面の部品を Node の上で静かに描いて、本物の CSS と一緒に 1 枚へ焼くことだけである。
 * 焼いた HTML はサーバーに繋がっておらず、押しても何も起きない。
 * 門を緩めずに見た目だけを渡すための、**別のもの**である。
 *
 * ## 本物であることをどう保つか
 *
 * 1. **部品は本物を描く。** 見本帳の 22 節は `DensitySamples`、案内は `AppShell`。
 *    どちらもアプリが描いているのと同じものを、同じ引数で描いている。
 * 2. **CSS は本物を通す。** トークンは `src/app/globals.css` を
 *    `@tailwindcss/postcss`（アプリが使っている道具そのもの）に通した結果、
 *    部品の見た目は `.module.css` の本文そのまま。**どこにも書き写しが無い。**
 * 3. **空なら止まる。** 読めていないまま焼くと、見た目の無い写しが
 *    「これが実物です」という顔で残る。判定は `scripts/lib/static-preview.mjs`。
 *
 * 名前の扱いだけ本番と違う。本番の束ね役は `.module.css` の名前を隠して衝突を防ぐが、
 * ここでは `scripts/lib/css-module-hook.cjs` が名前をそのまま通す。
 * そうすると CSS の本文をそのまま貼れば当たるので、貼る側に書き換えが要らない。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { Card, Page } from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";
import { DensitySamples } from "@/app/admin/ui-catalog/density-samples";
import styles from "@/app/admin/admin.module.css";
import { buildDocument, findModuleCss } from "./lib/static-preview.mjs";

const ROOT = process.cwd();
const ENTRY_CSS = "src/app/globals.css";
const OUT = "docs/product/preview/nav-and-density.html";

async function tailwindCss(): Promise<string> {
  const from = join(ROOT, ENTRY_CSS);
  const result = await postcss([tailwind()]).process(readFileSync(from, "utf8"), { from });
  return result.css;
}

function body(): string {
  return renderToStaticMarkup(
    <AppShell
      currentPath="/admin/ui-catalog"
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
  const html = buildDocument({
    tailwindCss: await tailwindCss(),
    moduleCss: findModuleCss(ROOT).map((path) => ({
      path,
      text: readFileSync(join(ROOT, path), "utf8"),
    })),
    bodyHtml: body(),
    htmlAttributes: { lang: "ja", ...appearanceAttributes(DEFAULT_APPEARANCE) },
    generatedAt: new Date().toISOString().slice(0, 10),
  });

  mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
  writeFileSync(join(ROOT, OUT), html);
  console.log(`書き出しました: ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
