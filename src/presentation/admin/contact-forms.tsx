"use client";

import { useActionState } from "react";
import { Button, FormResult, FormValue, ToolForm } from "@/presentation/ui";
import { markContactHandledAction } from "./contact-action";
import { INITIAL_CONTACT_HANDLED_STATE } from "./contact-state";

/**
 * 1 件を対応済みにする / 未対応へ戻す。
 *
 * 付ける側と外す側を**同じ場所**に置いてある。戻し方が離れていると、
 * 「戻せます」と書いてあっても戻し方が見つからず、押すのが怖くなる。
 * 怖い印は押されなくなり、押されない印は状況を表さなくなる。
 */
export function ContactHandledForm({
  id,
  handled,
}: {
  readonly id: string;
  readonly handled: boolean;
}) {
  const [state, action, pending] = useActionState(
    markContactHandledAction,
    INITIAL_CONTACT_HANDLED_STATE,
  );

  return (
    <ToolForm
      action={action}
      toolName="mark_contact_handled"
      toolDescription="読者からの問い合わせ 1 件に、対応済みの印を付ける / 外す"
    >
      <FormValue name="id" value={id} />
      <FormValue name="handled" value={handled ? "no" : "yes"} />
      <Button
        type="submit"
        tone={handled ? "secondary" : "primary"}
        busy={pending}
        busyLabel="変えています"
      >
        {handled ? "未対応へ戻す" : "対応済みにする"}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
