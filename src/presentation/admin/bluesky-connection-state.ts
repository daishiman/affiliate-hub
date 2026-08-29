import type { AdminActionState } from "./use-case-result";

/** Bluesky接続確認の結果。秘密値や参照名はこの状態へ載せない。 */
export type BlueskyConnectionState = AdminActionState;

export const INITIAL_BLUESKY_CONNECTION_STATE: BlueskyConnectionState = {
  status: "idle",
  message: "",
};
