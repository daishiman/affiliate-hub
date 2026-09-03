import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * 閲覧者の評価 (§3.3 の評価部品)。
 *
 * 読者が付ける点だけを持つ。**報酬に関わる値は 1 つも入れない。**
 * 入れると「よく売れている記事の評価を上げる」実装が書ける形になる。
 */

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export type ArticleRating = {
  readonly id: string;
  readonly articleId: string;
  /** 閲覧者の識別。個人を特定する値は入れない (cookie 由来の不透明な鍵)。 */
  readonly readerKey: string;
  readonly score: number;
  readonly comment: string | null;
  /** 運営者が伏せたか。**消さずに伏せる**（伏せた判断を後から確かめられるように）。 */
  readonly hidden: boolean;
  readonly createdAt: Date;
};

export function validateScore(raw: number): Result<number, DomainError> {
  if (!Number.isInteger(raw)) {
    return err(validationError("評価は 1 から 5 の整数で入れてください。", "score"));
  }
  if (raw < MIN_SCORE || raw > MAX_SCORE) {
    return err(
      validationError(`評価は ${MIN_SCORE} から ${MAX_SCORE} までです。`, "score"),
    );
  }
  return ok(raw);
}

export type RatingSummary = {
  readonly count: number;
  /**
   * 平均。**0 件のときは 0 ではなく null。**
   *
   * 0 と書くと「最低評価が付いている」と読める。
   * 「まだ誰も付けていない」と「みんな 1 を付けた」は別のことである。
   */
  readonly average: number | null;
};

/**
 * 集計に入れる 1 票。
 *
 * **点だけでなく「伏せてあるか」も一緒に受け取る。**
 *
 * 前は点の配列だけを受けていた。すると「伏せた票を除く」の判断が
 * 呼ぶ側 (D1 の where 句・見本データの filter) に散らばり、**同じ判断が
 * 2 か所に写る。** 写しがあると、片方を書き忘れた日に、
 * 管理画面の平均と読者に見える平均が静かに食い違う。**どちらも緑のまま。**
 *
 * だから入口の型をここに寄せた。呼ぶ側は点だけを渡せなくなり、
 * **除くのを忘れる書き方が型として通らない。**
 */
export type ReaderVote = {
  readonly score: number;
  /** 運営者が伏せたか。伏せた票は平均にも件数にも入らない。 */
  readonly hidden: boolean;
};

export function summarizeRatings(votes: readonly ReaderVote[]): RatingSummary {
  const live = votes.filter((v) => !v.hidden).map((v) => v.score);
  if (live.length === 0) return { count: 0, average: null };
  const total = live.reduce((a, b) => a + b, 0);
  // 小数第 1 位まで。桁を増やしても読者の判断は変わらない。
  return { count: live.length, average: Math.round((total / live.length) * 10) / 10 };
}
