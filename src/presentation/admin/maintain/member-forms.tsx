"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Callout,
  CheckboxGroup,
  Field,
  FormValue,
  HumanOnlyForm,
  TextArea,
} from "@/presentation/ui";
import { manageMemberAction } from "./member-action";
import { INITIAL_MEMBER_STATE } from "./member-state";

export type RoleOption = { readonly value: string; readonly label: string };

/**
 * 担当者を招く。
 *
 * --- 送ったあとに欄を空にする ---
 * アドレスと名前が残っていると、次に開いた人の目に入る。管理画面は共有の端末で
 * 開かれることがあるので、送信の成否にかかわらず消す。
 * 断りの文には、入力そのものではなく**何が起きたか**だけが出る。
 *
 * --- 招待しただけでは入れないことを、押す前に書く ---
 * 入口は 2 段（名簿と招待）で、ここで足すのは招待のほうだけである。
 * 押したあとに説明しても、そのときには相手へ「招待した」と伝えたあとになる。
 */
export function InviteMemberForm({ roleOptions }: { readonly roleOptions: readonly RoleOption[] }) {
  const [state, action, pending] = useActionState(manageMemberAction, INITIAL_MEMBER_STATE);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roles, setRoles] = useState<readonly string[]>([]);

  return (
    <HumanOnlyForm
      action={(formData: FormData) => {
        action(formData);
        setInvitedEmail("");
        setDisplayName("");
        setRoles([]);
      }}
      reason="担当者の招待は作業場所へのアクセスを増やす権限操作であり、AIが代理実行してはいけない。"
    >
      <FormValue name="intent" value="invite" />

      <Field
        name="invitedEmail"
        type="email"
        label="招待する人のメールアドレス"
        value={invitedEmail}
        onValueChange={setInvitedEmail}
        autoComplete="off"
        error={state.field === "invitedEmail" ? state.message : null}
        hint="Google でログインするときのアドレスを入れてください。大文字・小文字の違いは無視されます。この人が初めてログインしたときに参加が成立します。"
      />

      <Field
        name="displayName"
        label="画面に出す名前"
        value={displayName}
        onValueChange={setDisplayName}
        error={state.field === "displayName" ? state.message : null}
        hint="一覧と操作の記録に出ます。"
      />

      <CheckboxGroup
        name="roles"
        label="役割"
        options={roleOptions}
        selected={roles}
        onSelectedChange={setRoles}
        error={state.field === "roles" ? state.message : null}
        hint="できることは役割で決まります。あとから変えられます。運営者は 1 人だけです。"
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="招待しています">
        この人を招待する
      </Button>

      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
    </HumanOnlyForm>
  );
}

/**
 * 役割を変える。
 *
 * 現在の役割を初期値として入れてあるので、外したいものだけ外す形になる。
 * 空で送ると domain 側が断る（役割の無い担当者は、居るのに何もできない）。
 */
export function ChangeMemberRolesForm({
  membershipId,
  displayName,
  currentRoles,
  roleOptions,
}: {
  readonly membershipId: string;
  readonly displayName: string;
  readonly currentRoles: readonly string[];
  readonly roleOptions: readonly RoleOption[];
}) {
  const [state, action, pending] = useActionState(manageMemberAction, INITIAL_MEMBER_STATE);
  const [roles, setRoles] = useState<readonly string[]>([...currentRoles]);
  const [reason, setReason] = useState("");

  return (
    <HumanOnlyForm
      action={action}
      reason="担当者の権限変更は操作中の本人を含むアクセス制御を変えるため、AIが代理実行してはいけない。"
    >
      <FormValue name="intent" value="change_roles" />
      <FormValue name="membershipId" value={membershipId} />

      <CheckboxGroup
        name="roles"
        label={`${displayName} の役割`}
        options={roleOptions}
        selected={roles}
        onSelectedChange={setRoles}
        error={state.field === "roles" ? state.message : null}
      />

      <TextArea
        name="reason"
        label="理由"
        value={reason}
        onValueChange={setReason}
        optional
        rows={2}
        hint="操作の記録に残ります。空のままでも記録はされます（『担当者の役割を変えた』と入ります）。"
      />

      <Button type="submit" tone="secondary" busy={pending} busyLabel="変えています">
        役割を変える
      </Button>

      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
    </HumanOnlyForm>
  );
}

/**
 * 担当から外す。行は消さず、外した日が入る。
 *
 * 「消す」と書かないのは、実際に消えないからである。過去に承認した記録は
 * その人のものとして残り続ける。押す前にそう分かる言葉にする。
 */
export function RevokeMemberForm({
  membershipId,
  displayName,
}: {
  readonly membershipId: string;
  readonly displayName: string;
}) {
  const [state, action, pending] = useActionState(manageMemberAction, INITIAL_MEMBER_STATE);
  const [reason, setReason] = useState("");

  return (
    <HumanOnlyForm
      action={action}
      reason="担当解除は元に戻せないアクセス遮断であり、AIが担当者を締め出せないよう人だけに限定する。"
    >
      <FormValue name="intent" value="revoke" />
      <FormValue name="membershipId" value={membershipId} />

      <TextArea
        name="reason"
        label="外す理由"
        value={reason}
        onValueChange={setReason}
        optional
        rows={2}
        hint="操作の記録に残ります。"
      />

      <Button type="submit" tone="secondary" busy={pending} busyLabel="外しています">
        「{displayName}」を担当から外す
      </Button>

      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
    </HumanOnlyForm>
  );
}
