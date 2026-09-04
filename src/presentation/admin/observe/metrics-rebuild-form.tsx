"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormResult, FormValue, HumanOnlyForm } from "@/presentation/ui";
import { rebuildDailyMetricsAction } from "./metrics-rebuild-action";
import { INITIAL_METRICS_REBUILD_STATE } from "./metrics-rebuild-state";

/**
 * AI から呼べなくしている理由。`HumanOnlyForm` が要求する。
 *
 * これは「人の操作だから」ではない。集計のやり直しは足し込みではなく
 * **置き換え**で、走らせるたびに今ある行が上書きされる。数字が合わないときに
 * AI が自動でこれを呼ぶと、**原因を調べている最中に調査対象そのものが動く**。
 * 直ったのか、上書きで見えなくなったのかを、あとから誰も区別できない。
 * だからこの操作は「人が、いつ壊れたかを判断してから」呼ぶ形に閉じてある。
 */
const HUMAN_ONLY_REASON =
  "日次集計のやり直しは足し込みではなく置き換えで、走らせるたびに既存の行を上書きする。" +
  "数字の不一致を調べている最中に AI が自動で呼ぶと、調査対象そのものが動き、" +
  "実装の誤りだったのか上書きで消えたのかを区別できなくなる。" +
  "いつ壊れたかの判断を人が持つため、道具として名乗らせない。";

/**
 * 日次集計を、日付を指定してやり直す欄。
 *
 * --- なぜ普段は見せないところに置くか ---
 * 定期実行が当日と前日を毎日作り直しているので、この欄は普段いらない。
 * 目立つ場所に置くと「押せば数字が良くなる」ものに見えるが、実際は
 * 同じ観測から同じ値を作り直すだけで、**押しても何も変わらないのが正常**である。
 */
export function RebuildDailyMetricsForm({ siteSlug }: { readonly siteSlug: string }) {
  const [state, action, pending] = useActionState(
    rebuildDailyMetricsAction,
    INITIAL_METRICS_REBUILD_STATE,
  );
  const [day, setDay] = useState("");

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="siteSlug" value={siteSlug} />
      <Field
        name="day"
        label="やり直す日（YYYY-MM-DD）"
        value={day}
        onValueChange={setDay}
        placeholder="例: 2026-08-28"
        hint="この 1 日だけを作り直します。他の日は変わりません。元になる観測は 90 日で消えるため、それより前の日は指定できません。"
        error={state.field === "day" ? state.message : null}
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="作り直しています">
        この日の集計を作り直す
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}
