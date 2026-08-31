import { Children, isValidElement, type ReactNode } from "react";
import { capabilitiesOf } from "@/domain/identity";
import { currentActor } from "@/presentation/composition";
import {
  AppShell,
  EmptyView,
  ErrorView,
  LoadingView,
  Page,
  PartialView,
  resolveAdminRoute,
  type AdminRouteId,
  type OperationalScreenState,
  SlowView,
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
  screenState,
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
  /**
   * 画面が自分で決めた運用状態。渡さなければ `children` から推し量る。
   *
   * なぜ明示できるようにしたか:
   *   下の `adminScreenStateOf` は React 要素を歩いて状態部品を探すが、
   *   歩けるのは `children` prop だけで、**部分コンポーネントの中は見えない**。
   *   `<ProductDetail result={…} />` のように本体を関数へ括り出すと、
   *   その中の `ErrorView` が 1 枚も見つからず `ideal` に落ちる。
   *   画面には失敗が 5 枚出ているのに、監視上は正常完了になる。
   *
   *   推し量りを直すのではなく、**画面が既に持っている `Result` から
   *   直接決められる道**を足した。`screenStateOfResults` を使う。
   */
  readonly screenState?: OperationalScreenState;
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
      routeId={routeId}
      screenState={screenState ?? adminScreenStateOf(children)}
    >
      <Page title={title} lead={lead}>
        {children}
      </Page>
    </AppShell>
  );
}

const STATE_COMPONENTS = new Map<unknown, OperationalScreenState>([
  [EmptyView, "empty"],
  [LoadingView, "loading"],
  [PartialView, "partial"],
  [ErrorView, "error"],
  [SlowView, "slow"],
]);
const STATE_PRIORITY: Readonly<Record<OperationalScreenState, number>> = {
  ideal: 0,
  empty: 1,
  slow: 2,
  partial: 3,
  loading: 4,
  error: 5,
};

/**
 * 実renderする状態部品から、routeの運用状態を推し量る。
 *
 * **見えない範囲がある。** 歩けるのは `children` prop だけなので、
 * 本体を部分コンポーネントへ括り出した画面では、その中の
 * `ErrorView` / `EmptyView` が 1 枚も見つからず `ideal` を返す。
 * `props.children` 以外の prop で渡した要素も同じく見えない。
 *
 * 失敗を取りこぼすと監視が黙るので、**分岐を関数へ括り出す画面は
 * `AdminShell` に `screenState` を明示で渡すこと**。
 * `screenStateOfResults` がその値を作る。
 */
export function adminScreenStateOf(children: ReactNode): OperationalScreenState {
  let selected: OperationalScreenState = "ideal";
  const inspect = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ readonly children?: ReactNode }>(child)) return;
      const state = STATE_COMPONENTS.get(child.type);
      if (state !== undefined && STATE_PRIORITY[state] > STATE_PRIORITY[selected]) selected = state;
      if (child.props.children !== undefined) inspect(child.props.children);
    });
  };
  inspect(children);
  return selected;
}

/**
 * 画面が取得した結果の束を、1 つの運用状態へ畳む。
 *
 * 画面はたいてい複数の `Result` を並べて受け取る。
 * 商品の詳細なら本体・根拠・検証記録・順位・提携リンクで 5 つ。
 * その 5 つがどうなっていたら画面全体として何と呼ぶのか、を決める。
 *
 * `partial`（一部だけ取れた）はこの関数からしか出せない。
 * 要素ツリーを歩く側は `PartialView` を実画面で誰も使っていないため、
 * 一度も `partial` を返したことがない。
 */
export function screenStateOfResults(
  results: readonly ScreenResult[],
): OperationalScreenState {
  // 呼んだのに結果が 0 個なのは、渡し忘れ以外に起こらない。
  // `ideal` を返すと渡し忘れた画面が「正常」として集計され、
  // いま直したばかりの取りこぼしと同じ形の穴になる。
  // `empty` なら運用の数字に現れる。
  if (results.length === 0) return "empty";

  const failed = results.filter((result) => !result.ok).length;
  if (failed === results.length) return "error";
  if (failed > 0) return "partial";

  // ここから先は全件成功。空は「取れたが中身が無い」であって失敗ではない。
  // 1 つでも失敗があれば上で返しているので、`empty` が失敗を覆い隠すことはない。
  return results.some((result) => result.empty === true) ? "empty" : "ideal";
}

/** 画面が 1 つ取得したものの、状態だけを見た姿。 */
export type ScreenResult = {
  /** 取得に成功したか。`Result.ok` をそのまま渡す。 */
  readonly ok: boolean;
  /** 成功したが中身が 0 件か。件数を持たない結果では省略する。 */
  readonly empty?: boolean;
};
