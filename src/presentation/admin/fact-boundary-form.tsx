"use client";

import { useActionState, useState } from "react";
import { Button, Callout, Select, TextArea, ToolForm } from "@/presentation/ui";
import { checkFactBoundaryAction } from "./fact-boundary-action";
import { INITIAL_FACT_BOUNDARY_STATE } from "./fact-boundary-state";

export type AuthorOption = { readonly value: string; readonly label: string };

/**
 * 書いた文章が、その書き手の書ける範囲に収まっているかを確かめる。
 *
 * **結果は 3 通りある**（収まっている / 直すところがある / 調べられなかった）。
 * 「直すところがある」を失敗として赤く出さない。文章を直せば通るので、
 * これは失敗ではなく途中経過。赤くすると利用者は操作を間違えたと思う。
 */
export function FactBoundaryCheckForm({ authors }: { readonly authors: readonly AuthorOption[] }) {
  const [state, action, pending] = useActionState(
    checkFactBoundaryAction,
    INITIAL_FACT_BOUNDARY_STATE,
  );
  const [personaId, setPersonaId] = useState(authors[0]?.value ?? "");
  const [body, setBody] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="check_fact_boundary"
      toolDescription="文章が書き手の書ける事実の範囲に収まっているか調べる"
    >
      <Select
        name="personaId"
        label="誰として書いた文章か"
        value={personaId}
        onValueChange={setPersonaId}
        options={authors}
        placeholder="選んでください"
        error={state.field === "personaId" ? state.message : null}
        hint="書き手によって、書いてよい事実の範囲が違います。"
        toolParamDescription="この文章を書いた書き手の ID"
      />

      <TextArea
        name="body"
        label="調べる文章"
        value={body}
        onValueChange={setBody}
        error={state.field === "body" ? state.message : null}
        hint="記事の下書きをそのまま貼り付けてください。改行はそのまま残ります。"
        toolParamDescription="判定したい記事本文"
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="調べています">
        書ける範囲か調べる
      </Button>

      {state.status === "passed" ? <Callout tone="success" reason={state.message} /> : null}

      {state.status === "flagged" ? (
        <>
          <Callout tone="warn" reason={state.message} />
          <ul>
            {state.findings.map((finding) => (
              <li key={`${finding.excerpt}:${finding.message}`}>
                <q>{finding.excerpt}</q>
                <br />
                {finding.message}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
    </ToolForm>
  );
}
