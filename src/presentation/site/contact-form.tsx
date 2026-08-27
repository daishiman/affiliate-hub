"use client";

import { useActionState, useState } from "react";
import Script from "next/script";
import { Button, Field, FormResult, FormValue, ToolForm, UI_COPY } from "@/presentation/ui";
import { type ContactFormState, submitContactAction } from "./contact-action";
import { TURNSTILE_CONTACT_ACTION } from "@/application/ports/reader-interaction";

const INITIAL: ContactFormState = { status: "idle", message: "" };

/**
 * 問い合わせのフォーム。
 *
 * 送信中・成功・失敗の 3 つを必ず出す。押したあと何も変わらない状態を作らない。
 * 失敗の文言はユースケースが返したものをそのまま出す（画面で言い換えない）。
 */
export function ContactForm({
  siteSlug,
  turnstileSiteKey,
}: {
  readonly siteSlug: string;
  readonly turnstileSiteKey?: string | null;
}) {
  const [state, action, pending] = useActionState(submitContactAction, INITIAL);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState("");

  return (
    <ToolForm action={action} toolName="submitContact" toolDescription="このブログの運営者へ問い合わせを送る">
      <FormValue name="siteSlug" value={siteSlug} />

      <Field
        name="body"
        label={UI_COPY.reader.contactLabel}
        value={body}
        onValueChange={setBody}
        error={state.field === "body" ? state.message : null}
        toolParamDescription="問い合わせの本文"
      />
      <Field
        name="replyTo"
        type="email"
        label={UI_COPY.reader.contactEmailLabel}
        optional
        value={replyTo}
        onValueChange={setReplyTo}
        hint="返信が要らない場合は空のままで構いません。"
        toolParamDescription="返信先のメールアドレス（任意）"
      />

      {turnstileSiteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div
            className="cf-turnstile"
            data-sitekey={turnstileSiteKey}
            data-action={TURNSTILE_CONTACT_ACTION}
            data-response-field-name="cf-turnstile-response"
          />
        </>
      ) : (
        <FormResult
          state={{
            status: "failed",
            message: "自動送信よけの設定が未完了のため、現在このフォームからは送れません。",
          }}
        />
      )}

      <Button type="submit" disabled={pending || !turnstileSiteKey}>
        {pending ? UI_COPY.reader.contactSending : UI_COPY.reader.contactSubmit}
      </Button>

      <FormResult state={state} />
    </ToolForm>
  );
}
