"use client";

import { useActionState, useState } from "react";
import type { LinkIngestionView } from "@/application/usecases/monetization/manage-link-inbox";
import { Button, Field, FormResult, FormValue, Select, ToolForm } from "@/presentation/ui";
import { type InboxFormState, advanceLinkIngestionAction, submitAffiliateUrlAction } from "./inbox-action";

const INITIAL: InboxFormState = { status: "idle", message: "" };

export type ProgramOption = { readonly value: string; readonly label: string };

/**
 * 成果リンクを受信箱に入れるフォーム。
 *
 * 送信中・成功・失敗の 3 つを必ず出す。押したあと何も変わらない状態を作らない。
 * 重複していたときは、成功のまま「同じものが既にあります」と添える。
 * 失敗にすると、受け取ってあるのに「入らなかった」と読めてしまう。
 */
export function SubmitAffiliateUrlForm() {
  const [state, action, pending] = useActionState(submitAffiliateUrlAction, INITIAL);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="submit_affiliate_url"
      toolDescription="成果リンクの URL を受信箱に入れる"
    >
      <Field
        name="url"
        label="成果リンクの URL"
        value={url}
        onValueChange={setUrl}
        error={state.field === "url" ? state.message : null}
        hint="ASP で発行された URL をそのまま貼り付けてください。短縮や書き換えはしないでください。"
        toolParamDescription="ASP が発行した成果リンクの URL"
      />
      <Field
        name="note"
        label="メモ"
        optional
        value={note}
        onValueChange={setNote}
        hint="どこで見つけたリンクかを書いておくと、後で広告主を調べるときに役立ちます。"
        toolParamDescription="このリンクについての覚え書き（任意）"
      />

      <Button type="submit" tone="primary" busy={pending} busyLabel="受け取っています">
        受信箱に入れる
      </Button>

      {/* 進めはしたが人が見るべきものが残ったとき、成功のまま warn にする。 */}
      <FormResult state={state} doneTone={state.warn ? "warn" : "success"} />
    </ToolForm>
  );
}

/**
 * 受信箱の 1 件を次へ進める操作。
 *
 * **その状態でできることだけを出す。** できない操作を薄く出して押させると、
 * 押してから断られることになる。何ができないかは一覧側の理由表示で伝える。
 */
export function AdvanceIngestionForm({
  item,
  programs,
}: {
  readonly item: LinkIngestionView;
  readonly programs: readonly ProgramOption[];
}) {
  const [state, action, pending] = useActionState(advanceLinkIngestionAction, INITIAL);
  const [programId, setProgramId] = useState("");
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("");

  const canResolve = item.nextStates.includes("resolved");
  const canMatch = item.nextStates.includes("matched");
  const canReject = item.nextStates.includes("rejected");

  if (item.nextStates.length === 0) {
    return (
      <p>
        対象外にしたリンクです。もう一度扱うときは、受信箱へ入れ直してください。
        {item.rejectedReason === null ? null : <>（理由: {item.rejectedReason}）</>}
      </p>
    );
  }

  /*
   * 3 つの進め方を **3 つの `ToolForm`** に分ける。
   *
   * 元は 1 つの素の `<form>` に intent を 3 つ詰めていた。動きは正しかったが、
   * 素の `<form>` は道具として名乗らないので、この 3 つは AI から呼べなかった。
   * それでいて中の `Select` / `Field` には `toolParamDescription`
   * （AI へ何の値かを説明する宣言）が書いてあった。**届かない説明**である。
   *
   * `ToolForm` の `toolName` は 1 つしか持てない。intent が 3 つあるなら
   * 道具も 3 つで、目録にも `resolve_link_ingestion` /
   * `match_link_ingestion_product` / `reject_link_ingestion` の 3 つがある。
   * 詰めていたほうが目録とずれていた。
   *
   * `name="intent"` を submit ボタンから隠し欄へ移したのは、
   * 1 form に 1 ボタンになったため。ボタンに値を載せる書き方は
   * 「どのボタンで送ったか」で分岐するときのもので、分岐が消えたら要らない。
   */
  return (
    <>
      {canResolve ? (
        <ToolForm
          action={action}
          toolName="resolve_link_ingestion"
          toolDescription="受信箱のリンクがどの提携プログラムのものかを決める"
        >
          <FormValue name="linkIngestionId" value={item.id} />
          <FormValue name="intent" value="resolve" />
          <Select
            name="programId"
            label="どの提携プログラムのリンクか"
            value={programId}
            onValueChange={setProgramId}
            options={programs}
            placeholder="選んでください"
            error={state.field === "programId" ? state.message : null}
            hint="リンク先をたどって確かめてから選んでください。"
            toolParamDescription="このリンクが属する提携プログラムの ID"
          />
          <Button type="submit" tone="primary" busy={pending}>
            広告主を決める
          </Button>
        </ToolForm>
      ) : null}

      {canMatch ? (
        <ToolForm
          action={action}
          toolName="match_link_ingestion_product"
          toolDescription="受信箱のリンクを商品に結びつける"
        >
          <FormValue name="linkIngestionId" value={item.id} />
          <FormValue name="intent" value="match" />
          <Field
            name="productId"
            label="結びつける商品の ID"
            value={productId}
            onValueChange={setProductId}
            error={state.field === "productId" ? state.message : null}
            hint="商品の画面で確認できます。広告主が決まっていないと結びつけられません。"
            toolParamDescription="このリンクが指す商品の ID"
          />
          <Button type="submit" tone="primary" busy={pending}>
            商品に結びつける
          </Button>
        </ToolForm>
      ) : null}

      {canReject ? (
        <ToolForm
          action={action}
          toolName="reject_link_ingestion"
          toolDescription="受信箱のリンクを理由付きで対象外にする"
        >
          <FormValue name="linkIngestionId" value={item.id} />
          <FormValue name="intent" value="reject" />
          <Field
            name="reason"
            label="対象外にする理由"
            value={reason}
            onValueChange={setReason}
            error={state.field === "reason" ? state.message : null}
            hint="後から見て分かるように書いてください。理由の無い除外は残せません。"
            toolParamDescription="このリンクを対象外にする理由"
          />
          <Button type="submit" tone="quiet" busy={pending}>
            対象外にする
          </Button>
        </ToolForm>
      ) : null}

      {/*
        結果は 3 つの外に 1 度だけ置く。`useActionState` の状態は 1 つしか無いので、
        中へ入れると、どれを押しても 3 つ全部に同じ結果が出る。
      */}
      <FormResult state={state} />
    </>
  );
}
