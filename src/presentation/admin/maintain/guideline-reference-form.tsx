"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormResult, FormValue, Select, TextArea, ToolForm } from "@/presentation/ui";
import { manageGuidelineReferenceAction } from "./guideline-reference-action";
import { INITIAL_GUIDELINE_REFERENCE_STATE } from "./guideline-reference-state";

/**
 * SEO/AI 指針の出典の登録と再確認。
 *
 * `ToolForm` にしてある。出典の登録は公開・課金・削除のどれでもなく、
 * AI が調べた指針をそのまま台帳へ足せると、人は確認日を直すだけで済む。
 * 鍵のような秘密は通らないので、人に限る理由が無い。
 */

/** 端末の今日 (YYYY-MM-DD)。確認日の初期値にだけ使う。判定はサーバ側で行う。 */
function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type GuidelineReferencePrefill = {
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly region: string;
  readonly checkedAt: string;
  readonly note?: string;
};

/**
 * 出典を登録する。
 *
 * `prefill` があるときは初期候補の 1 行を写すだけなので、欄を出さずに
 * ボタン 1 つへ畳む。候補 4 件ぶんの入力欄を並べると、
 * 本来の「新しく登録する」欄がどれかが分からなくなる。
 */
export function RegisterGuidelineReferenceForm({
  prefill,
}: {
  readonly prefill?: GuidelineReferencePrefill;
}) {
  const [state, action, pending] = useActionState(
    manageGuidelineReferenceAction,
    INITIAL_GUIDELINE_REFERENCE_STATE,
  );
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [publisher, setPublisher] = useState("");
  const [region, setRegion] = useState("global");
  const [checkedAt, setCheckedAt] = useState(todayYmd());
  const [note, setNote] = useState("");

  if (prefill !== undefined) {
    return (
      <ToolForm
        action={action}
        toolName="register_guideline_reference"
        toolDescription="SEO/AI 検索ガイドラインの出典 (URL・発行元・確認日) を登録する"
      >
        <FormValue name="intent" value="add" />
        <FormValue name="title" value={prefill.title} />
        <FormValue name="url" value={prefill.url} />
        <FormValue name="publisher" value={prefill.publisher} />
        <FormValue name="region" value={prefill.region} />
        <FormValue name="checkedAt" value={prefill.checkedAt} />
        {prefill.note === undefined ? null : <FormValue name="note" value={prefill.note} />}
        <Button type="submit" tone="secondary" busy={pending} busyLabel="登録しています">
          「{prefill.title}」を登録する
        </Button>
        <FormResult state={state} />
      </ToolForm>
    );
  }

  return (
    <ToolForm
      action={action}
      toolName="register_guideline_reference"
      toolDescription="SEO/AI 検索ガイドラインの出典 (URL・発行元・確認日) を登録する"
    >
      <FormValue name="intent" value="add" />
      <Field
        name="title"
        label="タイトル"
        value={title}
        onValueChange={setTitle}
        error={state.field === "title" ? state.message : null}
        toolParamDescription="指針の名前。例: Google 検索の AI 機能で成功するためのガイド"
      />
      <Field
        name="url"
        type="url"
        label="URL"
        value={url}
        onValueChange={setUrl}
        hint="https:// で始まる原典の URL。要約記事ではなく原典を登録します。"
        error={state.field === "url" ? state.message : null}
        toolParamDescription="原典の URL。https:// で始まること。"
      />
      <Field
        name="publisher"
        label="発行元"
        value={publisher}
        onValueChange={setPublisher}
        error={state.field === "publisher" ? state.message : null}
        toolParamDescription="指針を出している発行元の名前。例: Google Search Central"
      />
      <Select
        name="region"
        label="対象"
        value={region}
        onValueChange={setRegion}
        options={[
          { value: "global", label: "海外 (global)" },
          { value: "jp", label: "日本 (jp)" },
        ]}
      />
      <Field
        name="checkedAt"
        type="date"
        label="内容を確認した日"
        value={checkedAt}
        onValueChange={setCheckedAt}
        hint="この日から 90 日を超えると「再確認」と表示されます。"
        error={state.field === "checkedAt" ? state.message : null}
        toolParamDescription="内容を確認した日。YYYY-MM-DD 形式。"
      />
      <Field
        name="note"
        label="但し書き"
        value={note}
        onValueChange={setNote}
        hint="要約しか読めていない・取得保留など、確認の程度をここに残します。"
        toolParamDescription="確認の程度の但し書き。無ければ空でよい。"
        optional
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="登録しています">
        この出典を登録する
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/** 確認日を今日 (または選んだ日) へ更新する。原典を読み直してから押す。 */
export function RecheckGuidelineReferenceForm({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}) {
  const [state, action, pending] = useActionState(
    manageGuidelineReferenceAction,
    INITIAL_GUIDELINE_REFERENCE_STATE,
  );
  const [checkedAt, setCheckedAt] = useState(todayYmd());

  return (
    <ToolForm
      action={action}
      toolName="recheck_guideline_reference"
      toolDescription="登録済みの指針の確認日を更新する (原典を読み直したときに使う)"
    >
      <FormValue name="intent" value="recheck" />
      <FormValue name="id" value={id} />
      <Field
        name="checkedAt"
        type="date"
        label={`「${title}」を確認した日`}
        value={checkedAt}
        onValueChange={setCheckedAt}
        hint="原典を読み直した日を入れます。登録内容 (URL・発行元) は変わりません。"
        error={state.field === "checkedAt" ? state.message : null}
        toolParamDescription="原典を読み直した日。YYYY-MM-DD 形式。"
      />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="更新しています">
        再確認した
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * 原典の本文を取り込んで、取得した事実を記録する。
 *
 * --- なぜ URL を渡してサーバに取りに行かせないか ---
 * 管理画面から任意の URL をサーバに取得させる口を作ると、それは
 * 「社内からしか見えない住所」へ到達できる踏み台になる (SSRF)。
 * 出典の鮮度のために、その口を常設する釣り合いではない。
 * 取ってくるのは人 (または AI) が行い、**取れた本文を貼る**。
 *
 * --- なぜ本文を保存しないか ---
 * 保存した写しは原典が更新された日から嘘になり、しかも正本の顔をする。
 * 残すのは指紋 (sha256) と取得時刻だけにして、中身は原典を読ませる。
 */
export function VerifyGuidelineSourceForm({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}) {
  const [state, action, pending] = useActionState(
    manageGuidelineReferenceAction,
    INITIAL_GUIDELINE_REFERENCE_STATE,
  );
  const [body, setBody] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="verify_guideline_source"
      toolDescription="指針の原典本文を取り込み、取得時刻と本文の指紋を記録する (本文は保存しない)"
    >
      <FormValue name="intent" value="verify_source" />
      <FormValue name="id" value={id} />
      <TextArea
        name="body"
        label={`「${title}」の原典本文`}
        value={body}
        onValueChange={setBody}
        rows={6}
        hint="原典を開いて本文を貼り付けます。保存されるのは指紋と取得時刻だけで、本文は残りません。"
        error={state.field === "body" ? state.message : null}
        toolParamDescription="原典 URL から取得した本文そのもの。要約ではなく取得できた本文を渡すこと。"
      />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="取り込んでいます">
        原典を取り込んだ
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * 画面で見ている本文版について、仕様章の再評価が完了したことを記録する。
 * 指紋を hidden で渡すだけで信頼はせず、Server Action と保存先が最新版との一致を
 * 改めて検査する。表示後に新しい版が取得されていれば、古い完了操作は断られる。
 */
export function AcknowledgeGuidelineReopenForm({
  id,
  expectedContentSha256,
}: {
  readonly id: string;
  readonly expectedContentSha256: string;
}) {
  const [state, action, pending] = useActionState(
    manageGuidelineReferenceAction,
    INITIAL_GUIDELINE_REFERENCE_STATE,
  );

  return (
    <ToolForm
      action={action}
      toolName="acknowledge_guideline_reopen"
      toolDescription="画面で確認した原典本文版について、根拠にしている仕様章の再評価完了を記録する"
    >
      <FormValue name="intent" value="acknowledge_reopen" />
      <FormValue name="id" value={id} />
      <FormValue name="expectedContentSha256" value={expectedContentSha256} />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="記録しています">
        仕様の再評価を完了した
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
