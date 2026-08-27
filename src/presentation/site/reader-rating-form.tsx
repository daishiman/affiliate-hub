"use client";

import { useActionState, useState } from "react";
import { MAX_SCORE, MIN_SCORE } from "@/domain/blogops";
import {
  Button,
  Field,
  FormResult,
  FormValue,
  Select,
  type SelectOption,
  ToolForm,
} from "@/presentation/ui";
import { type ReaderRatingState, submitReaderRatingAction } from "./reader-rating-action";

const INITIAL: ReaderRatingState = { status: "idle", message: "" };

/**
 * 点数の選択肢。**1〜5 をここで手打ちしない。**
 * 上限・下限はドメイン (`MIN_SCORE` / `MAX_SCORE`) が正本で、
 * 幅が変わったときに画面だけ古いまま残らないようにしてある。
 */
const SCORE_OPTIONS: readonly SelectOption[] = Array.from(
  { length: MAX_SCORE - MIN_SCORE + 1 },
  (_, i) => {
    const score = MIN_SCORE + i;
    return { value: String(score), label: `${score}` };
  },
);

/**
 * 読者がこの記事に点を付けるところ。
 *
 * **押した結果を必ず画面に出す。** 送信中・成功・失敗の 3 つを出さないと、
 * 押しても何も変わらない画面になり、読者は同じ操作を繰り返す。
 *
 * 平均は「まだ 1 票も無い」と「全員が 1 を付けた」を分けて出す。
 * 0 と null を同じ「0.0」に潰すと、記事の良し悪しの判断を誤らせる。
 */
export function ReaderRatingForm({
  siteSlug,
  articleSlug,
  initialCount,
  initialAverage,
}: {
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly initialCount: number;
  readonly initialAverage: number | null;
}) {
  const [state, action, pending] = useActionState(submitReaderRatingAction, INITIAL);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");

  const count = state.summary?.count ?? initialCount;
  const average = state.summary === undefined ? initialAverage : state.summary.average;

  return (
    <ToolForm
      action={action}
      toolName="submitArticleRating"
      toolDescription="この記事に 1〜5 の点を付ける"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="articleSlug" value={articleSlug} />

      <p>
        {count === 0 || average === null
          ? "まだ評価はありません。"
          : `いまの評価: ${average}（${count} 件）`}
      </p>

      <Select
        name="score"
        label="この記事は役に立ちましたか"
        value={score}
        onValueChange={setScore}
        options={SCORE_OPTIONS}
        placeholder="選んでください"
        hint={`${MIN_SCORE} が「役に立たなかった」、${MAX_SCORE} が「とても役に立った」です。`}
        error={state.field === "score" ? state.message : null}
        toolParamDescription={`${MIN_SCORE} から ${MAX_SCORE} までの整数`}
      />
      <Field
        name="comment"
        label="ひとこと"
        optional
        value={comment}
        onValueChange={setComment}
        hint="空のままでも送れます。"
        toolParamDescription="記事への短い感想（任意）"
      />

      <Button type="submit" disabled={pending}>
        {pending ? "送信中…" : "送る"}
      </Button>

      <FormResult state={state} />
    </ToolForm>
  );
}
