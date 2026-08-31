"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Field,
  FormResult,
  FormValue,
  HumanOnlyForm,
  Select,
  type SelectOption,
} from "@/presentation/ui";
import {
  advanceLoopRunAction,
  approveVariantSpecAction,
  draftVariantSpecAction,
  startLoopRunAction,
} from "./improvement-action";
import { INITIAL_IMPROVEMENT_STATE } from "./improvement-state";

/**
 * 改善ループを画面から 1 周まわす欄。
 *
 * --- ここが `ToolForm` ではない理由 ---
 *
 * 「画面でできることは AI からもできる」は原則だが、**この 4 つは人の操作**である。
 * 比較を始めるのは読者に見えるものを変えることで、承認は仕様 §14.5 で
 * 人に限られている。だから `improvement.run` / `improvement.approve` を
 * AI サービスアカウントに配っておらず、道具として名乗る名前も無い。
 * 名乗ってから断ると、AI の側は「あるのに使えない道具」を見ることになる。
 *
 * --- 出し方の決まり ---
 *
 * できない操作を薄く出して押させない。実施中でないものに観測の欄は出さず、
 * 承認済みでない試作は比較の選択肢に出さない。
 */

/**
 * この 4 つを AI から呼べなくしている理由。`HumanOnlyForm` が要求する。
 *
 * 元はこのファイルの冒頭コメントにだけ書いてあった。**コメントは `<form>` の
 * 行からは見えない。** 4 つの素の `<form>` を見た人には、決めた結果なのか
 * `ToolForm` への移し忘れなのかが分からない。理由を引数として持たせると、
 * 消せば型が通らなくなる。
 */
const HUMAN_ONLY_REASON =
  "比較を始めることは読者に見えるものを変えることであり、承認は仕様 §14.5 で人に限られている。" +
  "improvement.run / improvement.approve を AI サービスアカウントへ配っておらず、" +
  "道具として名乗る名前も目録に無い。名乗ってから断ると、AI 側は「あるのに使えない道具」を見る。";

/** 試作（見せ方の設定）を登録する。 */
export function DraftVariantSpecForm({
  siteSlug,
  dimensions,
  maxSimultaneous,
}: {
  readonly siteSlug: string;
  readonly dimensions: readonly SelectOption[];
  readonly maxSimultaneous: number;
}) {
  const [state, action, pending] = useActionState(draftVariantSpecAction, INITIAL_IMPROVEMENT_STATE);
  const [label, setLabel] = useState("");
  // 欄の数を上限に合わせる。上限より多く出しておいて後から断ると、
  // 書いてから「多すぎます」と言われることになる。
  const [rows, setRows] = useState<readonly { key: string; value: string }[]>(
    Array.from({ length: maxSimultaneous }, () => ({ key: "", value: "" })),
  );

  function updateRow(index: number, patch: Partial<{ key: string; value: string }>) {
    setRows(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  }

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="siteSlug" value={siteSlug} />
      <Field
        name="label"
        label="この試作の呼び名"
        value={label}
        onValueChange={setLabel}
        error={state.field === "label" ? state.message : null}
        hint="後から見て何を試したのか分かる名前にしてください（例: 比較表を先に出す）。"
      />

      {rows.map((row, index) => (
        // 欄の数は上限で決まっていて、並べ替えも削除もしない。
        // biome-ignore lint/suspicious/noArrayIndexKey: 位置そのものが欄の識別子
        <div key={`setting-${index}`}>
          <Select
            name="dimensionKey"
            label={`変えるもの ${index + 1}`}
            optional={index > 0}
            value={row.key}
            onValueChange={(key) => updateRow(index, { key })}
            options={dimensions}
            placeholder="選んでください"
            error={state.field === row.key ? state.message : null}
            hint="ここに出ないものは、数字が良くなっても変えないと決めたものです。"
          />
          <Field
            name="dimensionValue"
            label={`その値 ${index + 1}`}
            optional={index > 0}
            value={row.value}
            onValueChange={(value) => updateRow(index, { value })}
            hint="数値の軸には数字を入れてください。空欄にすると、その行は登録しません。"
          />
        </div>
      ))}

      <Button type="submit" tone="primary" busy={pending} busyLabel="登録しています">
        試作を登録する
      </Button>

      <p>登録しただけでは比較に使えません。次に承認が要ります（見た目だけの変更でも同じです）。</p>

      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/** 試作を承認する。人だけができる。 */
export function ApproveVariantSpecForm({
  siteSlug,
  pendingSpecs,
}: {
  readonly siteSlug: string;
  readonly pendingSpecs: readonly SelectOption[];
}) {
  const [state, action, pending] = useActionState(approveVariantSpecAction, INITIAL_IMPROVEMENT_STATE);
  const [specId, setSpecId] = useState("");

  if (pendingSpecs.length === 0) {
    return <p>承認を待っている試作はありません。</p>;
  }

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="siteSlug" value={siteSlug} />
      <Select
        name="specId"
        label="承認する試作"
        value={specId}
        onValueChange={setSpecId}
        options={pendingSpecs}
        placeholder="選んでください"
        error={state.field === "specId" ? state.message : null}
        hint="承認した人と日時が記録に残ります。見た目だけの変更も同じ扱いです。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="承認しています">
        承認する
      </Button>

      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/** 比較を始める。 */
export function StartLoopRunForm({
  siteSlug,
  approvedSpecs,
  metrics,
  defaultMinimumSamples,
}: {
  readonly siteSlug: string;
  readonly approvedSpecs: readonly SelectOption[];
  readonly metrics: readonly SelectOption[];
  readonly defaultMinimumSamples: number;
}) {
  const [state, action, pending] = useActionState(startLoopRunAction, INITIAL_IMPROVEMENT_STATE);
  const [baselineSpecId, setBaseline] = useState("");
  const [candidateSpecId, setCandidate] = useState("");
  const [primaryMetric, setMetric] = useState("");
  const [minimumSamples, setMinimum] = useState("");

  if (approvedSpecs.length < 2) {
    return <p>比べるには承認済みの試作が 2 つ要ります。いまは {approvedSpecs.length} つです。</p>;
  }

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="siteSlug" value={siteSlug} />
      <Select
        name="baselineSpecId"
        label="比べるもと"
        value={baselineSpecId}
        onValueChange={setBaseline}
        options={approvedSpecs}
        placeholder="選んでください"
        error={state.field === "baselineSpecId" ? state.message : null}
        hint="いま使っている設定を選びます。"
      />
      <Select
        name="candidateSpecId"
        label="試すほう"
        value={candidateSpecId}
        onValueChange={setCandidate}
        options={approvedSpecs}
        placeholder="選んでください"
        error={state.field === "candidateSpecId" ? state.message : null}
        hint="もとと違うところが多すぎると、何が効いたのか分からないため始められません。"
      />
      <Select
        name="primaryMetric"
        label="見る指標"
        value={primaryMetric}
        onValueChange={setMetric}
        options={metrics}
        placeholder="選んでください"
        error={state.field === "primaryMetric" ? state.message : null}
        hint="始めてから選び直すことはできません。後から選べると、必ず都合のよい方が選ばれます。"
      />
      <Field
        name="minimumSamples"
        label="判定に必要な件数"
        optional
        value={minimumSamples}
        onValueChange={setMinimum}
        error={state.field === "minimumSamples" ? state.message : null}
        autoValue={String(defaultMinimumSamples)}
        autoValueSource="既定値（これだけ集まるまで差があるとは言いません）"
        overridden={minimumSamples !== ""}
        onResetToAuto={() => setMinimum("")}
        hint="そのままで構いません。減らすと、少ない件数で出た差を「決まったこと」にしてしまいます。"
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="始めています">
        この比較を始める
      </Button>

      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/**
 * 実施中の 1 件に対する操作。
 *
 * 観測値・判定・打ち切りを 1 つの欄にまとめる。
 * 「観測を書いたら判定できる」という順番が、同じ場所で見えるようにする。
 */
export function AdvanceLoopRunForm({
  runId,
  running,
  hasObservation,
}: {
  readonly runId: string;
  readonly running: boolean;
  readonly hasObservation: boolean;
}) {
  const [state, action, pending] = useActionState(advanceLoopRunAction, INITIAL_IMPROVEMENT_STATE);
  const [baselineValue, setBaselineValue] = useState("");
  const [baselineSamples, setBaselineSamples] = useState("");
  const [candidateValue, setCandidateValue] = useState("");
  const [candidateSamples, setCandidateSamples] = useState("");
  const [reason, setReason] = useState("");

  if (!running) {
    return <p>この比較はもう終わっています。観測値の追加も判定もできません。</p>;
  }

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="runId" value={runId} />

      <Field
        name="baselineValue"
        label="もとの側の数字"
        value={baselineValue}
        onValueChange={setBaselineValue}
        error={state.field === "baselineValue" ? state.message : null}
        hint="割合は 0.42 のように小数で入れてください。"
      />
      <Field
        name="baselineSamples"
        label="もとの側の件数"
        value={baselineSamples}
        onValueChange={setBaselineSamples}
        error={state.field === "baselineSamples" ? state.message : null}
      />
      <Field
        name="candidateValue"
        label="試した側の数字"
        value={candidateValue}
        onValueChange={setCandidateValue}
        error={state.field === "candidateValue" ? state.message : null}
      />
      <Field
        name="candidateSamples"
        label="試した側の件数"
        value={candidateSamples}
        onValueChange={setCandidateSamples}
        error={state.field === "candidateSamples" ? state.message : null}
      />
      <Button type="submit" name="intent" value="observe" tone="primary" busy={pending}>
        観測値を書く
      </Button>

      {hasObservation ? (
        <Button type="submit" name="intent" value="conclude" tone="primary" busy={pending}>
          判定する
        </Button>
      ) : (
        <p>観測値を書くと判定できます。件数が足りなければ「まだ分からない」と出ます。</p>
      )}

      <Field
        name="reason"
        label="打ち切る理由"
        optional
        value={reason}
        onValueChange={setReason}
        error={state.field === "reason" ? state.message : null}
        hint="後から見て分かるように書いてください。理由の無い打ち切りは残せません。"
      />
      <Button type="submit" name="intent" value="stop" tone="quiet" busy={pending}>
        この比較を打ち切る
      </Button>

      <FormResult state={state} />
    </HumanOnlyForm>
  );
}
