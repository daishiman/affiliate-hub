"use client";

import { useState } from "react";
import { Button } from "../primitives/button";
import { CONSENT_COOKIE, CONSENT_COOKIE_MAX_AGE, type ConsentAnswer } from "../consent";
import styles from "./patterns.module.css";

/**
 * 計測についてのお願い。
 *
 * --- 断っても壊れない ---
 * 断った場合も記事は普通に読める。数えるのは「回数」だけになり、
 * 誰が読んだかは持たない。**断ると使えなくなる機能は作らない。**
 * 断りにくくするために選択肢の見た目を変えることもしない
 * （「許可」だけ目立たせるのはダークパターン）。
 *
 * --- 出すのは 1 箇所 ---
 * 読者向けの画面の骨格 (`SiteShell`) から出す。
 * 画面ごとに置くと、どこかの画面だけ聞かずに測る状態になる。
 *
 * この部品は表示と保存だけを行う。何を測ってよいかの判断は
 * サーバー側 (`domain/analytics/consent.ts`) がもう一度やり直す。
 */
export function ConsentBanner({
  current,
  detailHref,
  title = "計測についてのお願い",
  body = "記事の読まれ方（どこまで読まれたか、どこが押されたか）を記録して、記事の直しどころを探しています。断っても記事はそのまま読めます。",
}: {
  readonly current: ConsentAnswer;
  /** 詳しい説明のページ。**必ず用意する。** */
  readonly detailHref: string;
  readonly title?: string;
  readonly body?: string;
}) {
  const [answer, setAnswer] = useState<ConsentAnswer>(current);

  const choose = (value: Exclude<ConsentAnswer, "unset">): void => {
    document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax`;
    setAnswer(value);
    // 選び直したあとの計測は次の読み込みから変わる。
    // いま開いているページで測り方を切り替えると、
    // 1 ページの中に 2 通りの数え方が混ざる。
  };

  if (answer !== "unset") {
    return (
      <p className={styles.consentSettled}>
        {answer === "granted"
          ? "詳しい計測を許可いただいています。"
          : "詳しい計測は行っていません（回数だけ数えています）。"}{" "}
        <a href={detailHref}>計測について</a>
        {" ／ "}
        <button
          type="button"
          className={styles.consentUndo}
          onClick={() => choose(answer === "granted" ? "denied" : "granted")}
        >
          {answer === "granted" ? "取り消す" : "許可する"}
        </button>
      </p>
    );
  }

  return (
    <aside className={styles.consentBanner} aria-label={title}>
      <div>
        <p className={styles.consentTitle}>{title}</p>
        <p className={styles.consentBody}>
          {body} <a href={detailHref}>何を記録するか</a>
        </p>
      </div>
      <div className={styles.consentActions}>
        {/* 2 つのボタンの目立ち方を揃える。片方だけ強くしない。 */}
        <Button tone="secondary" onClick={() => choose("denied")}>
          記録しない
        </Button>
        <Button tone="secondary" onClick={() => choose("granted")}>
          記録してよい
        </Button>
      </div>
    </aside>
  );
}
