"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_CITATION_MONTHLY_SEARCH_LIMIT } from "@/application/ports/seo-measurement";
import { Button, Callout, Field, FormResult, FormValue, HumanOnlyForm } from "@/presentation/ui";
import {
  revertSeoAutoApplyAction,
  applySeoRevisionAction,
  setSeoAutoApplyPausedAction,
  setSeoCitationMonthlyLimitAction,
} from "./seo-aeo-action";
import { INITIAL_SEO_AEO_STATE, type SeoAeoFormState } from "./seo-aeo-state";

/**
 * 検索と AI からの見え方を、画面から動かす欄。
 *
 * ==========================================================================
 * なぜ AI から呼べる道具にしないのか
 * ==========================================================================
 *
 * 「画面でできることは AI からもできる」は原則だが、**この 4 つは人の操作**である。
 * 反映は読者に見える文章を書き換えることで、取り消しは間違いを戻すこと、
 * 停止は「機械に任せるのをやめる」判断そのものである。
 * AI が自分で止めたり再開したりできると、止めた意味が無くなる。
 */

const HUMAN_ONLY_REASON =
  "読者に見える記事の差分を、運営者が内容を確認して承認するための操作。" +
  "取消・停止・再開も運営者が決める。AI自身が差分を承認したり停止を解除したりする口にはしない。";

type ApplySeoRevisionProps = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly approvalToken: string | null;
  readonly disabledReason: string | null;
};

/** 対象が変わったら前の記事の成功・失敗表示も切り替える。 */
export function ApplySeoRevisionForm(props: ApplySeoRevisionProps) {
  return <ApplySeoRevisionFields key={`${props.siteSlug}:${props.articleSlug}`} {...props} />;
}

function ApplySeoRevisionFields({ siteSlug, articleSlug, approvalToken, disabledReason }: ApplySeoRevisionProps) {
  const [state, action, pending] = useActionState(applySeoRevisionAction, INITIAL_SEO_AEO_STATE);
  const router = useRouter();
  return (
    <>
      {disabledReason !== null ? <Callout tone="warn" title="いまは反映できません" reason={disabledReason} /> : null}
      <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
        <FormValue name="siteSlug" value={siteSlug} />
        <FormValue name="articleSlug" value={articleSlug} />
        <FormValue name="approvalToken" value={approvalToken ?? ""} />
        {disabledReason === null && approvalToken !== null ? (
          <Button type="submit" tone="primary" busy={pending} busyLabel="差分を反映しています">この差分を反映</Button>
        ) : null}
        <FormResult state={state} />
      </HumanOnlyForm>
      {state.status === "failed" ? (
        <Button type="button" tone="secondary" onClick={() => router.refresh()}>最新の差分を確認</Button>
      ) : null}
    </>
  );
}

/**
 * 反映を 1 つ取り消す。
 *
 * 確認を挟まない。取り消しそのものが戻り道なので、
 * 戻り道に段を足すと、慌てている人ほど戻れなくなる。
 */
export function RevertSeoAutoApplyForm({ logId }: { readonly logId: string }) {
  const [state, action, pending] = useActionState(revertSeoAutoApplyAction, INITIAL_SEO_AEO_STATE);

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="logId" value={logId} />
      <Button type="submit" tone="quiet" busy={pending} busyLabel="戻しています">
        この反映を取り消す
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/** 自動反映を止める・再開する。**観測は止まらない。** */
export function SeoAutoApplyPauseForm({ paused }: { readonly paused: boolean }) {
  const [state, action, pending] = useActionState(
    setSeoAutoApplyPausedAction,
    INITIAL_SEO_AEO_STATE,
  );

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="paused" value={paused ? "false" : "true"} />
      <Button
        type="submit"
        tone={paused ? "primary" : "quiet"}
        busy={pending}
        busyLabel={paused ? "再開しています" : "止めています"}
      >
        {paused ? "記事の差分反映を再開する" : "記事の差分反映を止める"}
      </Button>
      <p>
        {paused
          ? "いまは差分の反映を止めています。観測の状態はこの画面で確認できます。"
          : "止めても観測は続きます。止まるのは書き換えだけです。"}
      </p>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/** APIの1回上限とは別の、作業場所全体の月次検索枠。 */
export function SeoCitationMonthlyLimitForm({ limit }: { readonly limit: number | null }) {
  const [state, action, pending] = useActionState(setSeoCitationMonthlyLimitAction, INITIAL_SEO_AEO_STATE);
  return (
    <HumanOnlyForm action={action} reason="外部の有料検索を全ブログで何回まで使うかを、運営者が決める操作。">
      <SeoCitationMonthlyLimitFields key={String(limit)} limit={limit} state={state} pending={pending} />
    </HumanOnlyForm>
  );
}

function SeoCitationMonthlyLimitFields({ limit, state, pending }: {
  readonly limit: number | null;
  readonly state: SeoAeoFormState;
  readonly pending: boolean;
}) {
  const [value, setValue] = useState(limit === null ? "" : String(limit));
  return (
    <>
      <Field
        name="limit"
        label="月次上限"
        type="number"
        min={0}
        max={MAX_CITATION_MONTHLY_SEARCH_LIMIT}
        step={1}
        inputMode="numeric"
        value={value}
        onValueChange={setValue}
        unit="回／月"
        hint="0にすると新しいAI被引用チェックだけを止めます。実行中の処理は確定し、サイト内解析とSearch Consoleは続きます。"
        error={state.status === "failed" && state.field === "limit" ? state.message : null}
      />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="保存しています">月次上限を保存</Button>
      <FormResult state={state} />
    </>
  );
}
