import { UI_COPY, fill } from "../copy";
import styles from "./patterns.module.css";

/**
 * 見本（スタブ）であることの表示。
 *
 * **中身の無い画面を、動いているように見せない。**
 * たたき台では実装が追いついていない箇所が必ず出る。
 * それ自体は問題ないが、見た目だけ本物にすると
 * 「できているつもり」で判断が進んでしまう。
 *
 * `blockedBy`（何が揃えば動くか）を必須にしてある。
 * 「時間が無いから」は理由にならないので、前提条件を書かせる。
 * 台帳との対応は src/infrastructure/stubs.ts と
 * tests/infrastructure/stub-ledger.test.ts を参照。
 */

export function StubNotice({
  what,
  blockedBy,
  stubId,
  children,
}: {
  /** 何がまだ無いか。例:「A8.net との接続」 */
  readonly what: string;
  /** 使えるようになる条件。例:「A8.net のパートナー審査の通過」 */
  readonly blockedBy: string;
  /** 台帳の見出し。報告と突き合わせるための識別子。 */
  readonly stubId?: string;
  /** 見本として出す中身（あれば）。 */
  readonly children?: React.ReactNode;
}) {
  return (
    <div className={styles.stub} data-stub="true" data-stub-id={stubId}>
      <span className={styles.stubLabel}>{UI_COPY.stub.label}</span>
      <span>{UI_COPY.stub.title}</span>
      <span>{fill(UI_COPY.stub.bodyFormat, { what })}</span>
      <span className={styles.stubBlocked}>
        {UI_COPY.stub.blockedByPrefix}
        {blockedBy}
      </span>
      {children}
    </div>
  );
}

/**
 * いま何で動いているかの表示（保存先つき）。
 *
 * **画面に条件を書かせない。** これまでは画面側に
 * 「使えるようになる条件」を文字で書いていたため、
 * 実際に保存先をつないだあとも「まだつながっていません」と出続けた
 * （2026-08-17、Workers 上の確認で判明）。
 *
 * 判断する側（`src/presentation/composition.ts` の各 `〜Notice()`）が
 * この形で返し、画面はそれを出すだけにする。**言えることが 1 箇所になる。**
 */
export type StorageStatus = {
  /** 本当に保存されるか。false のときだけ見本の枠で出す。 */
  readonly persisted: boolean;
  /** 何の保存先か。例:「改善要望の記録先」 */
  readonly what: string;
  /** 保存されないときに、何が済めば使えるようになるか。 */
  readonly blockedBy: string;
  /** 台帳の見出し。 */
  readonly stubId: string;
  /** 利用者に見せる 1 文。保存される場合も出す（黙らない）。 */
  readonly message: string;
};

export function StorageNotice({ status }: { readonly status: StorageStatus }) {
  if (!status.persisted) {
    return (
      <StubNotice what={status.what} blockedBy={status.blockedBy} stubId={status.stubId}>
        <span>{status.message}</span>
      </StubNotice>
    );
  }
  return (
    <p className={styles.storageNotice} data-storage="persisted" data-stub-id={status.stubId}>
      {status.message}
    </p>
  );
}

/**
 * 一覧の行や表のセルなど、狭い場所に付ける小さな見本ラベル。
 * 大きな枠を出せない場所でも、見本であることは隠さない。
 */
export function StubLabel({ stubId }: { readonly stubId?: string }) {
  return (
    <span className={styles.stubLabel} data-stub="true" data-stub-id={stubId}>
      {UI_COPY.stub.label}
    </span>
  );
}
