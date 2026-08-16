"use client";

import { useState } from "react";
import { Button, Field, ToolForm, UI_COPY } from "@/presentation/ui";

/**
 * 診断・計算の入力欄。
 *
 * 入力欄の並びは保存されている道具の定義から作る。
 * **道具ごとに画面を書かない。** 書くと、道具を 1 つ増やすたびに画面が増える。
 *
 * 送信は `method="get"`。結果はサーバー側が同じユースケース (`runReaderTool`) で出す。
 * `ToolForm` を通すので、同じ操作をそのまま AI からも呼べる。
 */
export function ReaderToolForm({
  action,
  toolSlug,
  toolPurpose,
  inputs,
  initialValues = {},
}: {
  readonly action: string;
  readonly toolSlug: string;
  readonly toolPurpose: string;
  readonly inputs: readonly {
    readonly key: string;
    readonly label: string;
    readonly hint?: string;
    readonly unit?: string;
  }[];
  readonly initialValues?: Readonly<Record<string, string>>;
}) {
  const [values, setValues] = useState<Record<string, string>>({ ...initialValues });

  return (
    <ToolForm action={action} method="get" toolName={toolSlug} toolDescription={toolPurpose}>
      {inputs.map((input) => (
        <Field
          key={input.key}
          name={input.key}
          label={input.label}
          hint={input.hint}
          unit={input.unit}
          value={values[input.key] ?? ""}
          onValueChange={(v) => setValues((prev) => ({ ...prev, [input.key]: v }))}
          toolParamDescription={`${input.label}${input.unit === undefined ? "" : `（単位: ${input.unit}）`}`}
        />
      ))}
      <Button type="submit">{UI_COPY.action.run}</Button>
    </ToolForm>
  );
}
