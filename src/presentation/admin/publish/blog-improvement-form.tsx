"use client";

import { useActionState, useState } from "react";
import { type SiteAeoProfile } from "@/domain/aeo";
import { SEO_CHECK_LABEL, SEO_SEVERITY_LABEL, type SeoFinding } from "@/domain/seo";
import {
  Button,
  Checkbox,
  Field,
  FormResult,
  FormValue,
  RowSummary,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { manageBlogAeoAction, manageBlogSeoAction } from "./blog-improvement-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * SEO 診断と AEO の欄。
 *
 * --- ここで押しても読者側は変わらない ---
 * 診断は指摘を作るだけ、下書きは直す場所を指すだけである (AD-3)。
 * どの押しボタンの文言も「反映しました」と読めないようにしてある。
 * 読者へ出すのは、編集画面を通した公開だけ。
 */

export function SeoAssessForm({ siteSlug }: { readonly siteSlug: string }) {
  const [state, action, pending] = useActionState(manageBlogSeoAction, INITIAL_BLOG_OPS_STATE);
  const [articleSlug, setArticleSlug] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="assess_blog_seo"
      toolDescription="このブログの記事を診断し、検索から届かない原因の指摘を作る。読者に見えるものは変わらない。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="intent" value="assess" />
      <Field
        name="articleSlug"
        label="記事（1 本だけ診断するとき）"
        value={articleSlug}
        onValueChange={setArticleSlug}
        optional
        placeholder="例: how-to-choose-a-router"
        /*
          空欄がブログ全体の診断になる。全体のときだけタイトル重複の
          ような「記事どうしを見ないと出ない指摘」が出るので、
          そこを書いておかないと 1 本ずつ回した人が「重複が無い」と
          読み違える。
        */
        hint="空のままにするとブログ全体を診断します。記事どうしのタイトル重複は、全体で回したときだけ出ます。"
        error={state.field === "articleSlug" ? state.message : null}
        toolParamDescription="診断する記事の slug。省略するとブログ全体を診断する。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="診断しています">
        診断する
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/** 指摘 1 件に対する操作。直しに行くか、直さないと決めるか。 */
export function SeoFindingRow({
  siteSlug,
  finding,
}: {
  readonly siteSlug: string;
  readonly finding: SeoFinding;
}) {
  const [state, action, pending] = useActionState(manageBlogSeoAction, INITIAL_BLOG_OPS_STATE);
  const [reason, setReason] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="handle_seo_finding"
      toolDescription="SEO の指摘 1 件について、直しに行くか、直さないと決める。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="findingId" value={finding.id} />
      <RowSummary
        heading={`${SEO_CHECK_LABEL[finding.checkKind]}（${SEO_SEVERITY_LABEL[finding.severity]}）`}
        aside={`：${finding.articleSlug}`}
        lines={[
          finding.detail,
          `根拠: ${finding.evidence}`,
          ...(finding.suggestion === null ? [] : [`直し方の案: ${finding.suggestion}`]),
        ]}
      />
      <Button type="submit" name="intent" value="draft_fix" tone="primary" busy={pending}>
        直しに行く
      </Button>
      {/*
        「直さない」は診断より強い判断で、次の診断でも復活しない。
        理由を欄で要るようにしてあるのは、あとで一覧を読む人が
        「見落とし」と「意図して見送った」を区別できるようにするため。
      */}
      <Field
        name="reason"
        label="直さないと決める理由"
        value={reason}
        onValueChange={setReason}
        optional
        placeholder="例: この記事は近く畳むため"
        hint="この理由を書いて押すと、次の診断でもこの指摘は出てきません。"
        error={state.field === "reason" ? state.message : null}
        toolParamDescription="この指摘に対応しないと判断した理由。"
      />
      <Button type="submit" name="intent" value="dismiss" busy={pending}>
        この指摘は直さない
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * ブログ全体の AEO の構え。
 *
 * まだ決めていないブログでは `profile` が `null` で来る。空欄で描くのは、
 * 既定値を入れると「誰かが決めた値」と見分けが付かなくなるためである。
 */
export function AeoProfileForm({
  siteSlug,
  profile,
}: {
  readonly siteSlug: string;
  readonly profile: SiteAeoProfile | null;
}) {
  const [state, action, pending] = useActionState(manageBlogAeoAction, INITIAL_BLOG_OPS_STATE);
  const [topicScope, setTopicScope] = useState(profile?.topicScope ?? "");
  const [audience, setAudience] = useState(profile?.audience ?? "");
  const [publisherName, setPublisherName] = useState(profile?.publisherName ?? "");

  return (
    <ToolForm
      action={action}
      toolName="save_blog_aeo_profile"
      toolDescription="このブログが何について誰に答えるかを決め、回答エンジン向けの構造化データを出すか選ぶ。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="intent" value="save_profile" />
      <TextArea
        name="topicScope"
        label="このブログが答える領域"
        value={topicScope}
        onValueChange={setTopicScope}
        placeholder="例: 一人暮らし向けの通信機器の選び方"
        hint="広く書くほど、どの問いにも中途半端に当たる形になります。答えられる範囲だけを書いてください。"
        error={state.field === "topicScope" ? state.message : null}
        toolParamDescription="このブログが答えると宣言する領域。"
      />
      <TextArea
        name="audience"
        label="誰の問いに答えるか"
        value={audience}
        onValueChange={setAudience}
        placeholder="例: 初めて自分で回線を選ぶ人"
        error={state.field === "audience" ? state.message : null}
        toolParamDescription="想定する読者。誰の問いに答えるか。"
      />
      <Field
        name="publisherName"
        label="出典として名乗る名前"
        value={publisherName}
        onValueChange={setPublisherName}
        placeholder="例: 〇〇編集部"
        hint="回答エンジンが引用元として表示する名前です。構造化データの発行元にもなります。"
        error={state.field === "publisherName" ? state.message : null}
        toolParamDescription="構造化データの発行元として名乗る主体の名前。"
      />
      <Checkbox
        name="structuredDataEnabled"
        label="回答エンジン向けの構造化データを出す"
        defaultChecked={profile?.structuredDataEnabled ?? false}
        toolParamDescription="問答の構造化データを公開ページへ出すかどうか。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
        この構えを保存する
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/** 記事 1 本から引用単位を取り直す。 */
export function AeoExtractForm({ siteSlug }: { readonly siteSlug: string }) {
  const [state, action, pending] = useActionState(manageBlogAeoAction, INITIAL_BLOG_OPS_STATE);
  const [articleSlug, setArticleSlug] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="extract_answer_units"
      toolDescription="記事から、そのまま引用されうる問いと答えの対を取り直す。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="intent" value="extract" />
      <Field
        name="articleSlug"
        label="対象の記事"
        value={articleSlug}
        onValueChange={setArticleSlug}
        placeholder="例: how-to-choose-a-router"
        hint="記事を書き直したあとに回してください。前回の結果は置き換わります。"
        error={state.field === "articleSlug" ? state.message : null}
        toolParamDescription="引用単位を取り直す記事の slug。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="取り直しています">
        引用単位を取り直す
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
