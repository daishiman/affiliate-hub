import type { ReactNode } from "react";
import { capabilitiesOf } from "@/domain/identity";
import { currentActor } from "@/presentation/composition";
import {
  AppShell,
  Page,
  resolveAdminRoute,
  type AdminRouteId,
} from "@/presentation/ui";
import { submitFeedbackAction } from "./feedback-action";

/**
 * 管理画面の骨格。
 *
 * `AppShell`（見た目の骨格）に、**いま操作している人が何をできるか**を
 * 1 箇所で渡すためだけの薄い包み。
 *
 * なぜ画面ごとに書かないか:
 *   案内に載っているのに押すと必ず断られるリンクは、
 *   「壊れている」と受け取られる。見せる／見せないの判断を
 *   画面ごとに書くと、1 画面の書き忘れでその状態が生まれる。
 *
 * 判定そのものは domain の権限表 (`capabilitiesOf`) が持つ。
 * ここは受け渡しだけを行う。
 *
 * 「改善したいことを送る」ボタンもここから 1 回だけ渡す。
 * 画面ごとに置くと、置き忘れた画面の不満だけがどこにも届かない。
 * 画面の名前はパンくずの末尾をそのまま使う（人に書かせない）。
 *
 * ---
 *
 * **見出し（`Page`）を内側に持つ理由。**
 *
 * 以前は画面ごとに `<AdminShell>` の中へ `<Page title=…>` を書き、
 * さらにそれを包むローカルの `function Shell` を各ファイルの末尾に置いていた。
 * 同じ骨組みを 49 回書き写していたことになり、写した数だけ
 * **順番を間違える余地**があった（`Page` を忘れれば `h1` の無い画面になり、
 * `Page` を二重に置けば `h1` が 2 つある画面になる。どちらも黙って動く）。
 *
 * 骨組みをここへ畳んだので、画面が渡すのは題と 1 文だけになる。
 * 順番は選べない。
 */
export async function AdminShell({
  routeId,
  routeParams,
  breadcrumbLabels,
  title,
  lead,
  actions,
  children,
}: {
  /** 実URL・ナビ文脈・パンくずを引くroute metadataのキー。 */
  readonly routeId: AdminRouteId;
  /** `[product]` など、実URLへ埋める動的な値。 */
  readonly routeParams?: Readonly<Record<string, string>>;
  /** 動的な親routeだけが持つ、実データ由来の表示名。 */
  readonly breadcrumbLabels?: Readonly<Partial<Record<AdminRouteId, string>>>;
  /** 画面の題。`h1` になる。1 画面に 1 つだけ。 */
  readonly title: string;
  /** 題の下の 1 文。40 字以内（A8 が数える）。機能名の言い換えにしない。 */
  readonly lead: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  const actor = await currentActor();
  const capabilities = [...capabilitiesOf(actor.roles)].map(String);
  const route = resolveAdminRoute(routeId, routeParams);
  const breadcrumbs = route.breadcrumbs(title, breadcrumbLabels);

  return (
    <AppShell
      actualRoutePath={route.actualRoutePath}
      navContextPath={route.navContextPath}
      breadcrumbs={breadcrumbs}
      actions={actions}
      capabilities={capabilities}
      feedback={{
        screenName: title,
        canSubmit: capabilities.includes("feedback.submit"),
        onSubmit: submitFeedbackAction,
      }}
    >
      <Page title={title} lead={lead}>
        {children}
      </Page>
    </AppShell>
  );
}
