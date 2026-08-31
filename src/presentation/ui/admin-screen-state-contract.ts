import { ADMIN_ROUTE_METADATA, type AdminRouteId } from "./admin-route-metadata";

export const ADMIN_SCREEN_STATES = [
  "ideal",
  "empty",
  "loading",
  "partial",
  "error",
  "slow",
] as const;

export type OperationalScreenState = (typeof ADMIN_SCREEN_STATES)[number];

export type ScreenStateInstruction = {
  /** 監視・調査で用いる、routeごとに一意なevent名。 */
  readonly event: string;
  /** 失敗や遅延の最中でも、利用者が判断に使ってよい情報。 */
  readonly safeData: string;
  /** 状態を見た人が次に取れる1手。 */
  readonly nextAction: string;
};

export type AdminScreenStateContract = {
  readonly routeId: AdminRouteId;
  readonly states: Readonly<Record<OperationalScreenState, ScreenStateInstruction>>;
};

const screenName = (id: AdminRouteId, label: string | null): string =>
  label ?? (id === "" ? "ホーム" : id.split("/").at(-1)?.replaceAll(/\[|\]/g, "") ?? "対象");

/**
 * 全管理routeの理想・部分・低速・失敗を、同じ型で運用へ結ぶ。
 * eventにはroute IDを含め、似た画面でも監視上は別の出来事として追えるようにする。
 */
export const ADMIN_SCREEN_STATE_CONTRACTS: readonly AdminScreenStateContract[] =
  ADMIN_ROUTE_METADATA.map((route) => {
    const name = screenName(route.id, route.label);
    const eventScope = route.id === "" ? "home" : route.id.replaceAll(/[\[\]]/g, "").replaceAll("/", ".");
    const displayed = "画面に表示済みの確定情報";
    return {
      routeId: route.id,
      states: {
        ideal: {
          event: `admin.${eventScope}.load.ready`,
          safeData: displayed,
          nextAction: "本文から必要な操作を選ぶ",
        },
        empty: {
          event: `admin.${eventScope}.load.empty`,
          safeData: "0件であることと、空の理由",
          nextAction: `${name}に最初の1件を追加するか、解決先へ進む`,
        },
        loading: {
          event: `admin.${eventScope}.load.loading`,
          safeData: "現在地とこの画面へ来た経路",
          nextAction: "読み込み完了を待つか、パンくずから親画面へ戻る",
        },
        partial: {
          event: `admin.${eventScope}.load.partial`,
          safeData: displayed,
          nextAction: "表示済み情報を保ったまま、欠けた区分だけ再読み込みする",
        },
        slow: {
          event: `admin.${eventScope}.load.slow`,
          safeData: displayed,
          nextAction: "現在地を保って待つか、パンくずから親画面へ戻る",
        },
        error: {
          event: `admin.${eventScope}.load.error`,
          safeData: "入力済みの内容と現在地（サーバー未確定の値は判断に使わない）",
          nextAction: "再試行するか、パンくずから親画面へ戻る",
        },
      },
    };
  });

const STATE_CONTRACT_BY_ROUTE = new Map(
  ADMIN_SCREEN_STATE_CONTRACTS.map((contract) => [contract.routeId, contract]),
);

export function adminScreenStateContract(routeId: AdminRouteId): AdminScreenStateContract {
  const contract = STATE_CONTRACT_BY_ROUTE.get(routeId);
  if (contract === undefined) throw new Error(`Unknown admin state contract: ${routeId}`);
  return contract;
}
