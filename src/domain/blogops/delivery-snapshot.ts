/**
 * 配信物の点検記録 (受入 A9)。
 *
 * ==========================================================================
 * 「設定」と「実際に出たもの」は別である
 * ==========================================================================
 *
 * `blog_delivery_part` は**出す / 切るの設定**を持っている。設定が「出す」でも、
 * 実際に sitemap が空だったり llms.txt が 404 だったりすることはある。
 * 設定を見ているかぎり、その食い違いには**永遠に気づけない**。
 *
 * ここが持つのは**生成してみた結果**である。いつ確かめたか、出たか、
 * 出たものが何だったか。設定と結果を別の表にしてあるのは、
 * **片方を見て他方を推し量らせない**ためである。
 */

import { DELIVERY_PART_LABEL, DELIVERY_PARTS, type DeliveryPart } from "./blueprint-parts";

/** 点検 1 回ぶんの結果。 */
export type DeliverySnapshot = {
  readonly part: DeliveryPart;
  /** 生成できたか。できなかった理由は `detail` に書く。 */
  readonly ok: boolean;
  readonly checkedAt: Date;
  /** 出たものの要約 (件数・長さ・断られた理由)。空文字は禁じない。 */
  readonly detail: string;
};

/**
 * 一覧の 1 行。**9 行は必ず出る。**記録が無くても行が消えない。
 *
 * 行が消える作りにすると、「まだ点検していない部品」は一覧から見えなくなり、
 * **一覧が短いほど健全に見える**という逆さまの読み方が生まれる。
 */
export type DeliveryHealthRow = {
  readonly part: DeliveryPart;
  readonly label: string;
  /** 設定側。切ってあるなら結果を問わない。 */
  readonly enabled: boolean;
  readonly state: DeliveryHealthState;
  readonly checkedAt: Date | null;
  readonly detail: string;
};

/**
 * 行の状態。**`unchecked` を `ok` に畳まない。**
 *
 * 「確かめていない」と「確かめて大丈夫だった」を同じ緑にすると、
 * 一度も点検していないブログが満点に見える。欠落を数えるときも
 * `unchecked` は欠落側に入れる — 確かめていないものを健全と呼ばない。
 *
 * `off` は運営者が切った部品。**欠落に数えない。**切ったのは判断であって
 * 故障ではなく、ここで赤くすると「赤を消すために設定を戻す」ことになる。
 */
export type DeliveryHealthState = "ok" | "missing" | "unchecked" | "off";

/**
 * 状態の言い方。**画面側で書かない。**
 *
 * 画面が独自に言い換えると、`unchecked`（まだ見ていない）が
 * 「問題なし」と読める言葉になりやすい。見ていないことは、
 * 良いことでも悪いことでもなく、**見ていない**としか言えない。
 */
export const DELIVERY_HEALTH_LABEL: Readonly<Record<DeliveryHealthState, string>> = {
  ok: "出せています",
  missing: "材料が足りません",
  unchecked: "まだ点検していません",
  off: "出さない設定です",
};

/**
 * 設定と点検記録を突き合わせて、9 行を作る。
 *
 * 並びは `DELIVERY_PARTS` の順に固定する。記録の到着順や保存順に任せると、
 * 同じ状態のブログを 2 回開いたときに行の並びが変わり、
 * **前回と見比べる**という一覧の唯一の使い方ができなくなる。
 *
 * 同じ部品の記録が複数あるときは**いちばん新しいもの**を採る。
 * 履歴を残す設計にしてあるので、一覧は最新だけを見せる。
 */
export function deliveryHealth(
  parts: readonly { readonly part: DeliveryPart; readonly enabled: boolean }[],
  snapshots: readonly DeliverySnapshot[],
): readonly DeliveryHealthRow[] {
  const latest = new Map<DeliveryPart, DeliverySnapshot>();
  for (const snapshot of snapshots) {
    const held = latest.get(snapshot.part);
    if (held === undefined || held.checkedAt.getTime() <= snapshot.checkedAt.getTime()) {
      latest.set(snapshot.part, snapshot);
    }
  }

  return DELIVERY_PARTS.map((part) => {
    // 設定行が無い部品は「まだ触られていない」= 既定で出す側。
    // 既定を「切ってある」と読むと、設定を作る前のブログが全部 `off` になり、
    // 点検すべきものが 1 つも無いという答えが返る。
    const configured = parts.find((row) => row.part === part);
    const enabled = configured === undefined ? true : configured.enabled;
    const snapshot = latest.get(part);

    const state: DeliveryHealthState =
      !enabled ? "off" : snapshot === undefined ? "unchecked" : snapshot.ok ? "ok" : "missing";

    return {
      part,
      label: DELIVERY_PART_LABEL[part],
      enabled,
      state,
      checkedAt: snapshot?.checkedAt ?? null,
      detail: snapshot?.detail ?? "",
    };
  });
}

/**
 * 欠落している部品。**空配列が「欠落 0 件」の証拠**になる。
 *
 * `missing` (出すはずが出なかった) と `unchecked` (確かめていない) の
 * 両方を入れる。理由は `DeliveryHealthState` に書いた。
 */
export function missingDeliveryParts(
  rows: readonly DeliveryHealthRow[],
): readonly DeliveryPart[] {
  return rows.filter((row) => row.state === "missing" || row.state === "unchecked").map((row) => row.part);
}
