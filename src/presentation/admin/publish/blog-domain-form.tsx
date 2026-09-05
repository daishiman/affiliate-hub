"use client";

import { useActionState, useState } from "react";
import {
  CERTIFICATE_STATUS_LABEL,
  CUSTOM_DOMAIN_STATUS_LABEL,
  type CustomDomain,
} from "@/domain/domains/custom-domain";
import { Button, Field, FormResult, FormValue, RowSummary, ToolForm } from "@/presentation/ui";
import { manageBlogDomainAction } from "./blog-domain-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * ブログの住所（独自ドメイン）を登録する欄と、登録済み 1 件を操作する行。
 *
 * --- 登録と行の操作を別フォームにしてある ---
 * 登録は 1 操作なので `intent` を隠し欄で固定できる。行のほうは
 * 「取り直す・これを見せる・取り下げる」の 3 つが同じ行に並ぶので、
 * 押した押しボタン自身に `name="intent"` で名乗らせる。隠し欄に置くと
 * `FormData.get("intent")` が先頭の隠し欄を拾い、取り下げのつもりで
 * 押した操作が別のものになる。
 */

export function RegisterBlogDomainForm({ siteSlug }: { readonly siteSlug: string }) {
  const [state, action, pending] = useActionState(manageBlogDomainAction, INITIAL_BLOG_OPS_STATE);
  const [hostname, setHostname] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="register_blog_custom_domain"
      toolDescription="このブログに独自ドメインを登録する。登録した時点ではまだ読者は開けない。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="intent" value="register" />
      <Field
        name="hostname"
        label="住所（ホスト名）"
        value={hostname}
        onValueChange={setHostname}
        placeholder="例: blog.example.com"
        hint="`https://` や末尾の / は要りません。登録しても、DNS 設定を置くまで読者は開けません。"
        error={state.field === "hostname" ? state.message : null}
        toolParamDescription="このブログへ割り当てる独自ドメインのホスト名。スキームやパスを含めない。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="登録しています">
        この住所を登録する
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * 登録済みの住所 1 件に対する操作。
 *
 * 取り下げに理由を要る形にしてあるのは、取り下げた住所を踏んだ読者が
 * どこにも着かなくなるためで、「なぜ止めたか」が残っていないと、
 * あとで同じ住所を再登録してよいのかを誰も判断できない。
 */
export function BlogDomainRow({
  siteSlug,
  domain,
  canonical,
}: {
  readonly siteSlug: string;
  readonly domain: CustomDomain;
  /** この行が今まさに読者へ見せている住所か。 */
  readonly canonical: boolean;
}) {
  const [state, action, pending] = useActionState(manageBlogDomainAction, INITIAL_BLOG_OPS_STATE);
  const [reason, setReason] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="operate_blog_custom_domain"
      toolDescription="登録済みの住所の状態を取り直す、読者へ見せる住所にする、または取り下げる。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="domainId" value={domain.id} />
      <RowSummary
        heading={domain.hostname}
        aside={canonical ? "（いま読者へ見せている住所）" : null}
        lines={[
          `所有権: ${CUSTOM_DOMAIN_STATUS_LABEL[domain.status]} / 証明書: ${
            CERTIFICATE_STATUS_LABEL[domain.certificateStatus]
          }`,
          ...(domain.lastError === null ? [] : [`直近の失敗: ${domain.lastError}`]),
        ]}
      />
      <Button type="submit" name="intent" value="sync" busy={pending} busyLabel="取り直しています">
        いまの状態を取り直す
      </Button>
      {/*
        「配信中」でない住所は読者が開けない。開けない住所を正規に選べると、
        切り替えた瞬間に全記事がどこにも着かなくなる。押せる条件を状態で
        絞ってあるのはそのためで、見た目の整理ではない。
      */}
      {canonical || domain.status !== "active" ? null : (
        <Button type="submit" name="intent" value="set_canonical" tone="primary" busy={pending}>
          この住所を読者へ見せる
        </Button>
      )}
      {domain.status === "revoked" ? null : (
        <>
          <Field
            name="reason"
            label="取り下げる理由"
            value={reason}
            onValueChange={setReason}
            optional
            placeholder="例: 契約を更新しないため"
            hint="取り下げると、この住所を踏んだ読者はどこにも着きません。理由は行に残ります。"
            error={state.field === "reason" ? state.message : null}
            toolParamDescription="この住所の利用をやめる理由。あとで再登録の可否を判断するために残す。"
          />
          <Button type="submit" name="intent" value="revoke" tone="danger" busy={pending}>
            この住所を取り下げる
          </Button>
        </>
      )}
      <FormResult state={state} />
    </ToolForm>
  );
}
