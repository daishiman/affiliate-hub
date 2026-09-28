/** 差分提案の対象条件。実行には運営者の承認と保存時の版照合が別途必要。 */

import { type Finding, isArticleAutoFixable } from "./finding";
import { MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY } from "./measurement-source";
import type { PageKey } from "./page-key";

/**
 * 同じ記事へ次に反映してよくなるまでの間隔（NFR7）。
 *
 * 14 日にしているのは、反映が効いたかを見る材料（系統②）が
 * 数日遅れて届くためである。それより短い間隔で重ねて書き換えると、
 * 届いた数字がどの反映のものか分からなくなる。
 */
export const AUTO_APPLY_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * 反映の効果を判定してよくなるまでの保留期間（NFR7）。
 *
 * 28 日。順位は反映の翌日には動かない。動いていないことを
 * 「効果が無かった」と読むと、**効いている反映を取り消す**ことになる。
 */
export const EFFECT_JUDGEMENT_HOLD_MS = 28 * 24 * 60 * 60 * 1000;

/** 反映を止めた理由。「できない」の一語に潰さず、運営者に見せる。 */
export type AutoApplyBlock =
  | "paused"
  | "creation_time_unknown"
  | "created_before_introduction"
  | "no_reproducible_evidence"
  | "cooldown_not_elapsed"
  | "nothing_auto_fixable";

export const AUTO_APPLY_BLOCK_LABEL: Record<AutoApplyBlock, string> = {
  paused: "記事への反映を停止しています",
  creation_time_unknown: "記事の実際の作成日時を確認できません",
  created_before_introduction: "この仕組みを入れる前に作成された記事です",
  no_reproducible_evidence: "根拠が再現する系統（サイト内静的解析）から来ていません",
  cooldown_not_elapsed: "前回の反映からまだ間隔が空いていません",
  nothing_auto_fixable: "記事を書き換えれば消える所見がありません（残りは画面の作りの問題です）",
};

export type AutoApplyDecision =
  | {
      readonly allowed: true;
      /** 反映の根拠にした所見。**ここに無い所見を根拠に書き換えてはならない。** */
      readonly justifiedBy: readonly Finding[];
    }
  | {
      readonly allowed: false;
      readonly block: AutoApplyBlock;
      /** 所見として運営者に見せる分。反映しないだけで、黙らない（A6 後段）。 */
      readonly reportOnly: readonly Finding[];
    };

export type AutoApplyInput = {
  readonly now: string;
  /** 運営画面のトグル（NFR4）。止めていても収集と提示は続く。 */
  readonly paused: boolean;
  /** この仕組みを入れた時刻。これより前に作られた記事は自動反映しない。 */
  readonly loopIntroducedAt: string;
  /** 記事の作成時刻。**公開時刻ではない**（下の註を読むこと）。 */
  readonly articleCreatedAt: string | null;
  /** 同じ記事への前回の反映時刻。まだ無ければ null。 */
  readonly lastAppliedAt: string | null;
  readonly findings: readonly Finding[];
};

/**
 * 反映してよいかを決める。
 *
 * ==========================================================================
 * なぜ「作成時刻」で線を引くのか（NFR2）
 * ==========================================================================
 *
 * 公開時刻や更新時刻では線を引かない。どちらも後から動くからである。
 * 古い記事を 1 文字直せば更新時刻は今になり、**導入前の記事が
 * 自動反映の対象へ入ってくる。** 運営者から見れば「触っていない記事が
 * 勝手に書き換わった」に見える。作成時刻は動かない。
 *
 * 判定の順番にも意味がある。止まっているかを最初に見るのは、
 * 止めているのに他の理由が表示されると「止めたつもりが止まっていない」
 * と読めるからである。
 */
export function decideAutoApply(input: AutoApplyInput): AutoApplyDecision {
  const all = input.findings;

  if (input.paused) return { allowed: false, block: "paused", reportOnly: all };

  const created = input.articleCreatedAt === null ? NaN : Date.parse(input.articleCreatedAt);
  const introduced = Date.parse(input.loopIntroducedAt);
  if (!Number.isFinite(created) || !Number.isFinite(introduced) || created > Date.parse(input.now)) {
    return { allowed: false, block: "creation_time_unknown", reportOnly: all };
  }
  if (created < introduced) {
    return { allowed: false, block: "created_before_introduction", reportOnly: all };
  }

  const reproducible = all.filter(
    (finding) => MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY[finding.source],
  );
  if (reproducible.length === 0) {
    return { allowed: false, block: "no_reproducible_evidence", reportOnly: all };
  }

  if (input.lastAppliedAt !== null) {
    const elapsed = Date.parse(input.now) - Date.parse(input.lastAppliedAt);
    if (elapsed < AUTO_APPLY_COOLDOWN_MS) {
      return { allowed: false, block: "cooldown_not_elapsed", reportOnly: all };
    }
  }

  /*
    機械が正しい値を決められ、**かつ記事を直せば消える**所見だけを根拠にする。

    2 つ目の条件を落とすと、canonical や JSON-LD のようなテンプレートの
    欠陥を「記事を書き換えて直した」ことにしてしまう。実際には何も直らず、
    次の収集で同じ所見がまた出て、また反映の記録が積まれる。

    ここで絞った結果が空なら反映しない。「直せない所見しか無いのに
    反映の記録だけが残る」状態を作らないためで、記録があるのに
    差分が空だと、後から見た人が「何が変わったのか」を追えなくなる。

    同じ記事の所見は**まとめて 1 回で返す**（NFR7）。1 件ずつ反映すると
    間隔の決まりに引っかかって 2 件目以降が 14 日待ちになる。
  */
  const justifiedBy = reproducible.filter((finding) => isArticleAutoFixable(finding.code));
  if (justifiedBy.length === 0) {
    return { allowed: false, block: "nothing_auto_fixable", reportOnly: all };
  }

  return { allowed: true, justifiedBy };
}

/**
 * 反映の前に取る、変更前の姿（NFR1）。
 *
 * `articleJson` に記事まるごとを入れる。欄ごとの差分ではなく全体を持つのは、
 * 戻すときに**組み立て直さなくてよい**ようにするためである。
 * 差分から戻す実装は、差分の作り方を直した日に過去の記録が戻せなくなる。
 */
export type RevisionSnapshot = {
  readonly pageKey: PageKey;
  readonly takenAt: string;
  readonly articleJson: string;
};

/**
 * 実行できる形になった反映 1 回分。
 *
 * 変更前の記録を必須にし、保存先が記事・履歴・所見を同じtransactionで確定する。
 */
export type AutoApplyPlan = {
  readonly snapshot: RevisionSnapshot;
  readonly justifiedBy: readonly Finding[];
  readonly appliedAt: string;
};

/** 反映の効果を、まだ判定してはいけない期間か（NFR7）。 */
export function effectJudgementPending(appliedAt: string, now: string): boolean {
  return Date.parse(now) - Date.parse(appliedAt) < EFFECT_JUDGEMENT_HOLD_MS;
}
