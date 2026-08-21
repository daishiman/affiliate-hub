import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * Product Feedback コンテキスト / 払い出し（仕様 §8 FB-AC-18〜20）。
 *
 * 「払い出し」= 作業する側へ指示文を渡すこと。経路は 2 つだけ。
 *   1. 人が画面でコピーする
 *   2. Claude Code が鍵つきの API で取りに来る
 *
 * **同じ要望からは同じ指示文が出る**（冪等）。ここが崩れると、
 * 「さっき渡したものと同じか」を人が読み比べる必要が出てくる。
 * したがって払い出しは**回数と履歴を増やすだけ**で、指示文の中身には触れない。
 */
export const HANDOFF_ROUTES = ["copied_by_human", "pulled_by_agent"] as const;
export type HandoffRoute = (typeof HANDOFF_ROUTES)[number];

export const HANDOFF_ROUTE_LABELS: Readonly<Record<HandoffRoute, string>> = {
  copied_by_human: "画面からコピー",
  pulled_by_agent: "Claude Code が取得",
};

export type HandoffEntry = {
  readonly at: Date;
  readonly route: HandoffRoute;
  /** 誰が。人がコピーしたときは利用者、取りに来たときは鍵の名前。 */
  readonly actor: string;
  /**
   * どの鍵で（取りに来たときだけ）。**鍵の値そのものは持たない。**
   * 履歴に平文の鍵が残ると、履歴を見られる人が全員その鍵を使えることになる。
   */
  readonly keyId: string | null;
  /**
   * 渡した指示文の指紋。同じ内容が出ていることを後から確かめるために持つ。
   * 指示文そのものは持たない（本文が履歴の分だけ増える）。
   */
  readonly promptFingerprint: string;
};

export type HandoffState = {
  readonly count: number;
  readonly lastAt: Date | null;
  readonly entries: readonly HandoffEntry[];
};

export function emptyHandoffState(): HandoffState {
  return { count: 0, lastAt: null, entries: [] };
}

/** 一度でも払い出したか。詳細画面のバッジと一覧の列に使う。 */
export function hasBeenHandedOff(state: HandoffState): boolean {
  return state.count > 0;
}

/**
 * 払い出しを記録する。
 *
 * 指紋が前回と違う場合は**記録を拒む**。同じ要望から違う指示文が出たということは、
 * 組み立ての規則が変わったか、要望が書き換わったかのどちらかであり、
 * どちらも黙って積んではいけない。
 */
export function recordHandoff(
  state: HandoffState,
  entry: HandoffEntry,
): Result<HandoffState, DomainError> {
  if (entry.promptFingerprint.trim() === "") {
    return err(
      domainError("VALIDATION_FAILED", "渡した指示文の指紋がありません。", {
        field: "promptFingerprint",
      }),
    );
  }
  if (entry.route === "pulled_by_agent" && entry.keyId === null) {
    return err(
      domainError("VALIDATION_FAILED", "どの鍵で取得したのかが記録されていません。", {
        field: "keyId",
        suggestedAction: "取りに来た経路では、どの鍵を使ったかを必ず残します。",
      }),
    );
  }
  if (entry.route === "copied_by_human" && entry.keyId !== null) {
    return err(
      domainError("VALIDATION_FAILED", "画面からのコピーに鍵は使いません。", { field: "keyId" }),
    );
  }
  const previous = state.entries[state.entries.length - 1];
  if (previous !== undefined && previous.promptFingerprint !== entry.promptFingerprint) {
    return err(
      domainError("INVARIANT_VIOLATED", "前に渡した指示文と中身が変わっています。", {
        suggestedAction:
          "同じ要望からは同じ指示文が出るはずです。組み立ての規則か要望の中身が変わっていないか確かめてください。",
      }),
    );
  }
  return ok({
    count: state.count + 1,
    lastAt: entry.at,
    entries: [...state.entries, entry],
  });
}

/** 画面に出す一文（FB-AC-18）。渡す前に「また同じものが出る」と分かるようにする。 */
export const HANDOFF_IDEMPOTENCY_TEXT =
  "渡した内容のままです。もう一度渡しても中身は同じです。";

/** 履歴が空のときに出す文。空欄のまま置かない。 */
export const HANDOFF_HISTORY_EMPTY_TEXT = "まだ渡した記録はありません。";
