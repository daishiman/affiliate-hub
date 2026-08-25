import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { appearanceOptions, readAppearance } from "@/presentation/appearance";
import { readerActor, readerWebMcpDescriptors, siteUseCases } from "@/presentation/composition";
import type { PageKind } from "@/presentation/tools/webmcp-policy";
import {
  ErrorView,
  SitePage,
  SiteShell,
  WebMcpProvider,
  type SiteChrome,
} from "@/presentation/ui";
import { TelemetryCollector } from "@/presentation/telemetry/collector";
import { readConsentDecision, readConsentChoice } from "@/presentation/telemetry/consent-server";
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
  readonly children: (ctx: SiteContext) => ReactNode;
}) {
  const result = await (await siteUseCases()).getSite.execute(readerActor(), { siteSlug });

  if (!result.ok) {
    /*
      見つからないときは **404 として返す**。
      以前はここで直接「見つかりませんでした」の画面を返していたが、
      それでは通信の答えが 200 のままで、無いブログが検索結果に載りうるし、
      公開後の見張りからも壊れと区別が付かなかった（残課題リスト 項目 32）。

      画面の中身は `src/app/s/[site]/not-found.tsx` へ移した。
      見出し・戻り先・言い直しの案内はそのまま。素っ気なくして解決していない。
    */
    notFound();
  }

  const blueprint = result.value.blueprint;
  const chrome = toChrome(siteSlug, blueprint);

  /*
    読者の明るさの選択を読む。**18 本のルートで別々に読まない。**
    配色（brandTheme）はブログの設計図が正本なので、ここでは基準として渡し、
    読者の個人設定で上書きさせない。
  */
  const appearance = await readAppearance({
    brandTheme: blueprint.theme.brandTheme,
    colorMode: blueprint.theme.colorScheme,
  });

  /*
    計測してよいかを 1 箇所で決める。**18 本のルートで別々に判断しない。**
    判定そのものは domain (`decideConsent`) が持ち、ここは結論を受け取るだけ。
    端末の拒否表示 (DNT / GPC) と自動巡回の除外もここを通る。
  */
  const [decision, consentChoice] = await Promise.all([
    readConsentDecision(),
    readConsentChoice(),
  ]);

  return (
    <SiteShell
      chrome={chrome}
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
      {children({ siteSlug, blueprint, chrome })}
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
