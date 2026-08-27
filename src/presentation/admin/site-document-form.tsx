"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormResult, FormValue, HumanOnlyForm, TextArea } from "@/presentation/ui";
import { saveSiteDocumentAction } from "./site-document-action";
import { INITIAL_SITE_DOCUMENT_STATE } from "./site-document-state";

/**
 * 固定文書を 1 枚書き換える欄。
 *
 * 一覧の各行に 1 つずつ置く。別画面へ飛ばさないのは、
 * 「未整備がいくつあるか」を見ながら埋めていく画面だからで、
 * 1 枚ごとに往復させると、どれが残っているかが毎回見えなくなる。
 */
export function SiteDocumentForm({
  siteSlug,
  documentKey,
  label,
  title: initialTitle,
  body: initialBody,
}: {
  readonly siteSlug: string;
  readonly documentKey: string;
  readonly label: string;
  readonly title: string;
  readonly body: readonly string[];
}) {
  const [state, action, pending] = useActionState(
    saveSiteDocumentAction,
    INITIAL_SITE_DOCUMENT_STATE,
  );
  const [title, setTitle] = useState(initialTitle);
  // 段落の配列を、書く人が扱える 1 つの文へ戻す。区切りは空行。
  const [body, setBody] = useState(initialBody.join("\n\n"));

  return (
    <HumanOnlyForm
      action={action}
      reason={
        "運営者情報と特定商取引法に基づく表記は、書いた内容がそのまま事業者の法的な表示になる。" +
        "生成した文をここへ入れると、実在しない住所や連絡先が「事業者の表示」として読者に出る。" +
        "誰が書いたかを人に帰着させるため、AI からは呼べる形にしない。"
      }
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="key" value={documentKey} />
      <Field
        name="title"
        label={`${label}の見出し`}
        value={title}
        onValueChange={setTitle}
        error={state.field === "title" ? state.message : null}
      />
      <TextArea
        name="body"
        label="本文"
        value={body}
        onValueChange={setBody}
        rows={10}
        hint="空行で段落に分かれます。改行 1 つは段落の区切りになりません。"
        error={state.field === "body" ? state.message : null}
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
        この内容で保存する
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}
