import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { appearanceOptions, readAppearance } from "@/presentation/appearance";
import {
  publicBlogAppearance,
  publicBlogEntry,
  readerWebMcpDescriptors,
} from "@/presentation/composition";
import type { PageKind } from "@/presentation/tools/webmcp-policy";
import {
  ErrorView,
  Callout,
  SitePage,
  SiteShell,
  WebMcpProvider,
  type SiteChrome,
} from "@/presentation/ui";
import { TelemetryCollector } from "@/presentation/telemetry/collector";
import { readConsentDecision, readConsentChoice } from "@/presentation/telemetry/consent-server";
import { blogSidebar } from "./blog-sidebar";
import { readPublicSiteProjection, type PublicSiteProjection } from "./public-site-projection";
import { breadcrumbsFor, siteBasePath, toChrome } from "./view-model";

/**
 * ブログ画面の共通の入り口。
 *
 * 18 本のルートすべてがこれを通る。**画面ごとに設計図の読み込みを書かない。**
 * 書くと、ヘッダーの作り方やブログが見つからないときの表示が画面ごとにずれる。
 *
 * 画面側がやるのは「本文を返す関数」を渡すことだけ。
 */

export type SiteContext = {
  readonly siteSlug: string;
  readonly blueprint: PublicSiteBlueprint;
  readonly chrome: SiteChrome;
  readonly projection: PublicSiteProjection;
};

/**
 * 設計図を読み、共通の骨格で包む。
 *
 * ブログが見つからないときは 404 を返し、理由と戻り先のある画面
 * (`src/app/s/[site]/not-found.tsx`) へ渡す。空白の画面は読者から故障と区別がつかず、
 * 200 のまま「見つかりません」と描くのは検索エンジンと見張りから壊れと区別がつかない。
 */
export async function SiteFrame({
  siteSlug,
  currentPath,
  trail = [],
  pageKind = "article",
  sidebar = false,
  asideSlot,
  children,
}: {
  readonly siteSlug: string;
  /** 現在地。ヘッダーの現在地表示に使う。 */
  readonly currentPath: string;
  /** パンくずの続き。ブログ名は自動で先頭に付く。 */
  readonly trail?: readonly { readonly label: string; readonly path?: string }[];
  /**
   * このページの種類。ページ内 AI へ渡す道具を選ぶのに使う。
   * 比較のページに順位の説明の道具を渡しても、押す先が無い。
   */
  readonly pageKind?: PageKind;
  /**
   * 本文の脇に枠を出すか（§3.4）。
   *
   * **画面ごとに真偽値 1 つで決める。**どの枠を出すかは管理画面が正本なので、
   * ここで選ぶのは「この画面は脇を持つ種類か」だけ。持たせるのは記事まわり
   * （トップ・記事一覧・記事・カテゴリー）で、**説明のページには持たせない**。
   * 問い合わせや計測の説明は、読者が 1 つのことをしに来る画面で、
   * 脇に別の入口を並べると本題から目を離させる。
   */
  readonly sidebar?: boolean;
  /**
   * 記事目次など、**その画面にだけ要る**補助導線。
   *
   * `sidebar` と分けているのは、あちらが「管理画面で組んだ枠を出すか」で、
   * こちらは「この画面が自前で持ち込む中身」だから。同じ名前にすると、
   * 管理画面で枠を全部消した日に目次まで消える。
   */
  readonly asideSlot?: ReactNode;
  readonly children: (ctx: SiteContext) => ReactNode | Promise<ReactNode>;
}) {
  const publicEntry = await publicBlogEntry();
  const projected = await readPublicSiteProjection(siteSlug, publicEntry);
  if (!projected.ok) {
    throw new Error("公開サイトの保存値を読み込めませんでした。");
  }
  if (projected.value === null) notFound();
  const projection = projected.value;
  const blueprint = projection.reader.blueprint;
  const baseChrome = toChrome(siteSlug, blueprint, projection);

  /*
    読者の明るさの選択を読む。**18 本のルートで別々に読まない。**
    配色（brandTheme）はブログ側が決めるので、ここでは基準として渡し、
    読者の個人設定で上書きさせない。

    基準は**保存された 2 層**（`blog_theme` → `page_theme_override`）から取る。
    設計図（`site_blueprints.theme`）はブログ既定が未登録のときの土台へ降格した
    （`data-model.md` §0 の V3、受入 A2-4）。設計図を正本のままにすると、
    管理画面で選んだ色が保存されるのに読者には一生出ない。
  */
  const siteDefault = await publicBlogAppearance({
    siteSlug,
    pagePath: currentPath.startsWith(siteBasePath(siteSlug))
      ? currentPath.slice(siteBasePath(siteSlug).length)
      : currentPath,
    fallback: {
      brandTheme: blueprint.theme.brandTheme,
      colorMode: blueprint.theme.colorScheme,
    },
  });
  const appearance = await readAppearance(siteDefault.appearance);

  /*
    解き終えた見た目を枠へ渡す。**枠が自分でもう一度解かない。**
    `toChrome` は設計図から作るので、ここで配色と明暗だけを差し替える。
    差し替えずに `toChrome` へ 2 層を渡す形にすると、
    「どのブログか」を組み立てる仕事と「何色で出すか」を決める仕事が混ざる。
  */
  const chrome = {
    ...baseChrome,
    brandTheme: appearance.brandTheme,
    colorMode: appearance.colorMode,
  };

  /*
    計測してよいかを 1 箇所で決める。**18 本のルートで別々に判断しない。**
    判定そのものは domain (`decideConsent`) が持ち、ここは結論を受け取るだけ。
    端末の拒否表示 (DNT / GPC) と自動巡回の除外もここを通る。
  */
  const [decision, consentChoice] = await Promise.all([
    readConsentDecision(),
    readConsentChoice(),
  ]);

  /*
    脇の枠を**先に作って、空かどうかを見てから**渡す。
    `<BlogSidebar />` と JSX で置くと、中身が空でも「要素はある」ので
    `SiteShell` が段組みを出し、空の脇のぶんだけ本文が狭くなる。
    関数として呼べば `null` がここに返り、段組みを出さない判断ができる。

    カテゴリーは設計図から渡す。**保存先へもう一度引きに行かない**
    (`blueprint.categories` がこの時点で手元にある)。
  */
  const [projectedAside, asideSticky] = sidebar
    ? [
        blogSidebar({ siteSlug, region: "sidebar", categories: blueprint.categories, projection }),
        blogSidebar({
          siteSlug,
          region: "sidebar_sticky",
          categories: blueprint.categories,
          projection,
        }),
      ]
    : [null, null];
  /*
    画面が自前で持ち込む中身（記事目次）は、保存された枠より**前**に置く。
    いま読んでいる記事の中の移動が、他の記事への入口より先に来る。
  */
  const asideNormal =
    asideSlot === undefined ? (
      projectedAside
    ) : (
      <>
        {asideSlot}
        {projectedAside}
      </>
    );

  return (
    <SiteShell
      chrome={chrome}
      sidebar={asideNormal ?? undefined}
      sidebarSticky={asideSticky ?? undefined}
      currentPath={currentPath}
      breadcrumbs={breadcrumbsFor(siteSlug, blueprint, trail)}
      appearance={{ current: appearance, modeOptions: appearanceOptions().modeOptions }}
      consent={{ current: consentChoice, detailHref: `${siteBasePath(siteSlug)}/measurement` }}
      telemetry={
        <TelemetryCollector
          siteSlug={siteSlug}
          path={currentPath}
          allowBehaviour={decision.allowBehaviour}
          suppressAll={decision.suppressAll}
        />
      }
    >
      {projection.source === "sample" ? (
        <Callout
          tone="info"
          title="見本データを表示中です"
          reason="この表示は保存先の live データではありません。"
        />
      ) : null}
      {await children({ siteSlug, blueprint, chrome, projection })}
      {/*
        ページを開いている AI に、この画面でできることを知らせる（WebMCP）。
        読み取りだけ・6 件までで、すべて通常の画面操作でも同じことができる。
        機能フラグが切れていれば空になり、画面はそのまま使える。
      */}
      <WebMcpProvider descriptors={readerWebMcpDescriptors(pageKind)} />
    </SiteShell>
  );
}

/**
 * 読めなかったときの、読者向けの言い方。**1 つだけ決めて全画面で使う。**
 *
 * 画面ごとに言い回しを変えると、読者は「これは自分のせいか、向こうの都合か」を
 * 毎回読み解くことになる。ここを固定してあるので、検査も文言 1 つで足りる。
 */
export const UNAVAILABLE_NOTICE = "いま表示できません";

/**
 * 「無い」と分かった時点で 404 にする。**画面を描き始める前に呼ぶ。**
 *
 * 呼ぶ場所が結果を変える。Next.js の `notFound()` は投げた時点で応答が
 * まだ流れ出していなければ 404 を返すが、流し込みが始まったあとに投げると
 * 状態コードは 200 のまま `noindex` だけが付く（`notFound` の公式ドキュメント
 * "Calling `notFound()` after streaming has started"）。
 * つまり **JSX を返したあとに気づいても遅い**。だから各画面は、ユースケースを
 * `await` した直後・`<SiteFrame>` を組み立てる前にこれを呼ぶ。
 *
 * 「無い」と「取れなかった」を分けるのはここ 1 箇所。分けないと、保存先が
 * 落ちているだけの状態で読者に「その記事は存在しません」と言い、さらに
 * 404 を返して検索結果から実在する記事を消してしまう。
 * 分かれ目は `NOT_FOUND` かどうかの 1 点だけで、それ以外（保存先に繋がらない・
 * 上流が落ちている・まだ実装が無い）はすべて「いま表示できません」に寄せる。
 *
 * 規範: 残課題リスト 項目 36 / docs/product/traceability.md REQ-B01
 */
export function stopIfMissing(error: { readonly code: string } | undefined): void {
  if (error?.code === "NOT_FOUND") notFound();
}

/**
 * 読めなかったときの表示。**ここに来るのは「取れなかった」だけ。**
 *
 * 「無い」は呼び出し側の `stopIfMissing` が先に 404 として打ち切る。
 * ここでも保険として `notFound()` を投げたくなるが、**投げない。**
 * 投げると、呼び出し側が呼び忘れても画面上は正しく 404 になり、
 * 「JSX を返す前に打ち切る」という肝心の設計が守られているかを
 * 検査から見分けられなくなる（実装を壊しても緑のままになる）。
 * 呼び忘れはこの関数が「いま表示できません」を描くことで表に出て、
 * `tests/ui/resource-not-found.test.tsx` が 200 として赤くする。
 *
 * 失敗の中身（`DomainError`）を受け取らないのはそのため。受け取ると
 * 「ここでも `NOT_FOUND` を見よう」に必ず戻り、上の理由が崩れる。
 * 読者に見せる文言も、保存先が落ちた理由で変えるべきものではない。
 */
export function ReadFailureBody({
  what,
  siteSlug,
}: {
  /** 「記事」「カテゴリー」など、読もうとしたもの。 */
  readonly what: string;
  readonly siteSlug: string;
}) {
  const title = `${what}を${UNAVAILABLE_NOTICE}`;
  return (
    <SitePage title={title}>
      <ErrorView
        title={title}
        body="こちらの都合で読み込めませんでした。しばらくしてから、もう一度お試しください。"
        action={<Link href={siteBasePath(siteSlug)}>トップへ戻る</Link>}
      />
    </SitePage>
  );
}
