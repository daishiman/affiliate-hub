import type { TechnicalContext } from "./report";

/**
 * 技術診断（そのとき記録されたこと）の保持期限（REQ-FB08 / REQ-TM09）。
 *
 * --- なぜ画像とは別に決めるのか ---
 *
 * 画面の写しは 180 日（`capture-policy.ts` の `CAPTURE_RETENTION_DAYS`）である。
 * あちらは**送る人が中身を見て、黒塗りまでして、意図して付けた 1 枚**で、
 * 何が入っているかを本人が知っている。こちらは違う。技術診断は
 * ブラウザから**自動で付く**もので、送った本人は中身を一度も見ていない。
 * 「本人が知らないまま貯まるもの」を、本人が選んだものより長く持たない。
 *
 * だから 2 つの期限は**別の数**である。片方を直したときにもう片方が
 * 一緒に動かないよう、定数も判定もここに分けて置く。
 *
 * --- なぜ 90 日なのか ---
 *
 * 計測の詳しい記録（`domain/analytics/consent.ts` の `RETENTION_DAYS.detailed`）
 * と同じ 90 日に揃える。どちらも「ブラウザ由来で、本人が中身を見ていない、
 * 個々の行に意味があるのは直近だけ」という同じ性質のものである。
 * 別の数にすると、説明する側が 2 つの数を覚えることになり、
 * 画面のどちらかが必ず古くなる。
 *
 * --- 何を消して、何を残すのか ---
 *
 * 消すのは `technical_json` の中身だけである。
 *
 *   消す : エラー・通信の失敗・直前の操作・使っていた環境
 *   残す : 要望の本文・どうなってほしいか・どの画面から届いたか・履歴・
 *          操作の記録（監査ログ）・伏せた件数（`redactedCount`）・消した時刻
 *
 * **要望そのものは消さない。** 改善要望は「1 件で 1 件」の声であり、
 * 90 日経ったからといって、その声が届かなかったことにはならない。
 * 消すのは、声を裏付けるために自動で付いてきた診断の側だけである。
 *
 * `redactedCount` を残すのは、これが**数値 1 つ**で、
 * 「収集の時点で何件伏せたか」しか語らないためである（FB-AC-13）。
 * ここまで消すと、「伏せた記録があったこと」自体が消え、
 * 後から「本当に伏せていたのか」を問われたときに答えられない。
 */
export const DIAGNOSTICS_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** いつ消えるか。届いた時刻から数える（読んだ時刻から数えると、開くたびに延びる）。 */
export function diagnosticsExpireAt(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + DIAGNOSTICS_RETENTION_DAYS * DAY_MS);
}

/**
 * 定期削除が探す「この時刻以前」の境界。
 *
 * 保存先が日数をもう一度ミリ秒へ直すと、期限変更時に読み出しと削除で
 * 別の境界を持ててしまう。足す側と引く側をこのファイルへ揃える。
 */
export function diagnosticsPurgeCutoff(now: Date): Date {
  return new Date(now.getTime() - DIAGNOSTICS_RETENTION_DAYS * DAY_MS);
}

/**
 * 期限が来ているか。
 *
 * 境目は**ちょうどで来ている**とする（`>=`）。画像の判定
 * （`isCaptureExpired`）と同じ向きに揃える。2 か所で境目の向きが違うと、
 * 「90 日ちょうど」の 1 日だけ説明と実物がずれる。
 */
export function isDiagnosticsExpired(submittedAt: Date, now: Date): boolean {
  return now.getTime() >= diagnosticsExpireAt(submittedAt).getTime();
}

/** もう消してあるか。**再実行の安全はこの 1 行で決まる。** */
export function isDiagnosticsPurged(technical: TechnicalContext): boolean {
  return technical.purgedAt !== null;
}

/**
 * 中身を消す。**何度呼んでも同じ結果になる。**
 *
 * すでに消してあるものは、消した時刻を書き換えずにそのまま返す。
 * 書き換えると、削除ジョブを 2 回流しただけで
 * 「いつ消えたか」が今日の日付に化け、証跡として使えなくなる。
 */
export function purgeDiagnostics(
  technical: TechnicalContext,
  purgedAt: Date,
): TechnicalContext {
  if (isDiagnosticsPurged(technical)) return technical;
  return {
    jsErrors: [],
    failedRequests: [],
    recentActions: [],
    // 空文字にする。「不明」と書くと、記録が無いのか消したのか区別が付かない。
    // 消したことは `purgedAt` が語り、画面の文言もそちらを見る。
    userAgent: "",
    redactedCount: technical.redactedCount,
    purgedAt,
  };
}

/** 詳細画面に出す保持の説明。**画面が文言を組み立てない。** */
export const DIAGNOSTICS_RETENTION_NOTICE =
  `エラー・通信の失敗・直前の操作・使っていた環境は、届いてから ${DIAGNOSTICS_RETENTION_DAYS} 日で消えます。` +
  "要望の本文・どの画面から届いたか・履歴・操作の記録は消えません。";

/** 消えたあとに、その欄へ出す文。空欄にも「記録されていません」にもしない。 */
export const DIAGNOSTICS_PURGED_TEXT =
  `保存期間（${DIAGNOSTICS_RETENTION_DAYS} 日）を過ぎたため、この記録は消えています。`;
