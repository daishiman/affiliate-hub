"use client";

import { useActionState, useState } from "react";
import {
  NETWORK_ROLES,
  NETWORK_ROLE_LABEL,
  NETWORK_STATUSES,
} from "@/domain/blogops";
import { Button, Field, FormResult, FormValue, Select, TextArea, ToolForm } from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { DeleteConfirm } from "./delete-confirm";
import { manageSiteNetworkAction } from "./site-network-action";

/**
 * ブログ同士のつながりを 1 本ぶん足す・直す・外す。
 *
 * `ToolForm` にしてあるのは、**つながりの登録は公開でも課金でもない**ため。
 * どのブログが親でどれが子か、という並べ替えは AI に任せられる。
 * ただし「外す」だけは理由を書かせる（公開 URL を取り下げた判断を残すため）。
 *
 * 足すときと直すときで同じ部品を使う。`node` があれば直す側になる。
 */
export type SiteNetworkPrefill = {
  readonly nodeId: string;
  readonly siteSlug: string;
  readonly role: string;
  readonly parentSlug: string | null;
  readonly name: string;
  readonly oneLine: string;
  readonly position: number;
  readonly status: string;
};

export function SiteNetworkForm({
  node,
  siteOptions,
}: {
  readonly node?: SiteNetworkPrefill;
  /** 親に選べるブログ。自分自身は呼び出し側で外しておく。 */
  readonly siteOptions: readonly { readonly value: string; readonly label: string }[];
}) {
  const [state, action, pending] = useActionState(
    manageSiteNetworkAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [siteSlug, setSiteSlug] = useState(node?.siteSlug ?? "");
  const [role, setRole] = useState(node?.role ?? "sub");
  const [parentSlug, setParentSlug] = useState(node?.parentSlug ?? "");
  const [name, setName] = useState(node?.name ?? "");
  const [oneLine, setOneLine] = useState(node?.oneLine ?? "");
  const [position, setPosition] = useState(String(node?.position ?? 0));
  const [status, setStatus] = useState(node?.status ?? "active");

  const editing = node !== undefined;

  return (
    <>
      <ToolForm
        action={action}
        toolName={editing ? "update_site_network_node" : "create_site_network_node"}
        toolDescription={
          editing
            ? "ブログのつながり 1 本の名前・親・並び順・公開状態を直す"
            : "ブログのつながりに 1 本足す（識別名・役割・親）"
        }
      >
        <FormValue name="intent" value={editing ? "update" : "create"} />
        {editing ? <FormValue name="nodeId" value={node.nodeId} /> : null}

        {editing ? null : (
          <Field
            label="ブログの識別名"
            name="siteSlug"
            value={siteSlug}
            onValueChange={setSiteSlug}
            error={state.field === "siteSlug" ? state.message : null}
            hint="小文字の英数字とハイフン。あとから変えられません。"
            toolParamDescription="ブログを一意に指す識別名 (slug)"
          />
        )}

        {editing ? null : (
          <Select
            label="役割"
            name="role"
            value={role}
            onValueChange={setRole}
            options={NETWORK_ROLES.map((value) => ({
              value,
              label: NETWORK_ROLE_LABEL[value],
            }))}
            hint="中心 (hub) は 1 つに絞ると、読者がどこに戻ればよいか迷いません。"
            toolParamDescription="つながりの中でのこのブログの役割"
          />
        )}

        <Select
          label="親のブログ"
          name="parentSlug"
          value={parentSlug}
          onValueChange={setParentSlug}
          error={state.field === "parentSlug" ? state.message : null}
          options={siteOptions}
          placeholder="（親を置かない）"
          optional
          hint="親を空にすると、このブログはどこからも辿れなくなります。"
          toolParamDescription="このブログの親にあたるブログの識別名"
        />

        <Field
          label="表に出す名前"
          name="name"
          value={name}
          onValueChange={setName}
          error={state.field === "name" ? state.message : null}
          toolParamDescription="読者に見せるブログ名"
        />

        <TextArea
          label="1 行の説明"
          name="oneLine"
          value={oneLine}
          onValueChange={setOneLine}
          rows={2}
          optional
          hint="姉妹サイトの一覧に、この文がそのまま並びます。"
          toolParamDescription="ブログを 1 行で説明する文"
        />

        {editing ? (
          <>
            <Field
              label="並び順"
              name="position"
              type="number"
              value={position}
              onValueChange={setPosition}
              hint="小さいほど先に出ます。"
              toolParamDescription="一覧での並び順 (小さいほど先)"
            />
            <Select
              label="公開状態"
              name="status"
              value={status}
              onValueChange={setStatus}
              options={NETWORK_STATUSES.map((value) => ({
                value,
                label: value === "active" ? "読者に見せる" : "隠す",
              }))}
              toolParamDescription="読者側の姉妹サイト一覧に出すかどうか"
            />
          </>
        ) : null}

        <Button type="submit" disabled={pending}>
          {editing ? "直す" : "つながりに足す"}
        </Button>
        <FormResult state={state} />
      </ToolForm>

      {editing ? (
        <DeleteConfirm
          action={manageSiteNetworkAction}
          toolName="delete_site_network_node"
          toolDescription="ブログのつながりから 1 本外す（理由が要ります）"
          idName="nodeId"
          idValue={node.nodeId}
          hiddenValues={[{ name: "intent", value: "delete" }]}
          label={`ブログ「${node.name}」`}
          verb="つながりから外す"
          consequence="通常一覧と読者側から外れます。配下がある場合は削除を拒否します。このブログは削除済み一覧から同じ URL へ戻せます。"
          acknowledgement="配下が無いことと、削除済み一覧から戻せることを確かめました"
        />
      ) : null}
    </>
  );
}

export function SiteNetworkRestoreForm({
  nodeId,
  name,
}: {
  readonly nodeId: string;
  readonly name: string;
}) {
  const [state, action, pending] = useActionState(
    manageSiteNetworkAction,
    INITIAL_BLOG_OPS_STATE,
  );
  return (
    <ToolForm
      action={action}
      toolName="restore_site_network_node"
      toolDescription="削除済みのブログを元の親・同じ URL でサイト網へ戻す"
    >
      <FormValue name="intent" value="restore" />
      <FormValue name="nodeId" value={nodeId} />
      <Button type="submit" disabled={pending}>
        {pending ? "戻しています…" : `「${name}」を同じ URL で戻す`}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
