import type { ReactNode } from "react";
import { capabilitiesOf } from "@/domain/identity";
import { currentActor } from "@/presentation/composition";
import { AppShell, type Breadcrumb } from "@/presentation/ui";

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
 */
export async function AdminShell({
  currentPath,
  breadcrumbs,
  actions,
  children,
}: {
  readonly currentPath: string;
  readonly breadcrumbs: readonly Breadcrumb[];
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  const actor = await currentActor();
  const capabilities = [...capabilitiesOf(actor.roles)].map(String);

  return (
    <AppShell
      currentPath={currentPath}
      breadcrumbs={breadcrumbs}
      actions={actions}
      capabilities={capabilities}
    >
      {children}
    </AppShell>
  );
}
