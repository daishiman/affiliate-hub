"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { AffiliatePreview } from "@/domain/monetization";
import type { LinkIngestionView } from "@/application/usecases/monetization/manage-link-inbox";
import { Button, Field, FormResult, FormValue, Select, ToolForm } from "@/presentation/ui";
import { AffiliatePreviewCard } from "./affiliate-preview-card";
import {
  type InboxFormState,
  advanceLinkIngestionAction,
  previewAffiliateUrlAction,
  submitAffiliateUrlAction,
} from "./inbox-action";

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
  const [preview, setPreview] = useState<AffiliatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreviewTransition] = useTransition();
  const requestSequence = useRef(0);

  useEffect(() => {
    const trimmed = url.trim();
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    if (trimmed === "") {
      return;
    }
    const timer = window.setTimeout(() => {
      setPreview(null);
      setPreviewError(null);
      startPreviewTransition(async () => {
        const result = await previewAffiliateUrlAction(trimmed);
        if (requestSequence.current !== sequence) return;
        if (result.status === "failed") {
          setPreviewError(result.message);
          return;
        }
        setPreview(result.preview);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [url]);

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
      <div aria-live="polite" aria-atomic="true">
        {previewPending ? <p>リンク先を安全に確認しています…</p> : null}
        {url.trim() === "" || previewError === null ? null : <p role="alert">{previewError}</p>}
      </div>
      {url.trim() === "" || preview === null ? null : <AffiliatePreviewCard preview={preview} />}
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
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [oneLine, setOneLine] = useState("");

  const canResolve = item.nextStates.includes("resolved");
  const canMatch = item.nextStates.includes("matched");
  const canReject = item.nextStates.includes("rejected");
  /*
   * 登録は状態の遷移ではないので `nextStates` には出てこない。
   * 受信箱の状態は「商品まで決まった（`matched`）」で終わりで、
   * その先の登録は `affiliate_links` 側の話になる。
   *
   * 重複の印が付いているものは出さない。押しても断られるだけで、
   * 直す場所（どちらを本体にするか）はここではなく受信箱の一覧側にある。
   */
  const canRegister = item.state === "matched" && item.duplicateOf === null;

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
   * 登録（`register_affiliate_link`）を 4 つ目として同じ形で足してある。
   * 詰め直すと、その瞬間にまた AI から呼べない操作が 1 つ増える。
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

      {canRegister ? (
        <ToolForm
          action={action}
          toolName="register_affiliate_link"
          toolDescription="商品まで決まった受信箱のリンクを、記事に出せる成果リンクとして登録する"
        >
          <FormValue name="linkIngestionId" value={item.id} />
          <FormValue name="intent" value="register" />
          {/*
            商品名をここで受け取るのは、**この欄が写しの正本**だからである。
            商品の表はまだ空で、リンク先を取りに行くのは別の危うさを増やす。
            ASP の管理画面に出ている表記を、そのまま写してもらう。
          */}
          <Field
            name="productName"
            label="商品名（読者のカードに出ます）"
            value={productName}
            onValueChange={setProductName}
            error={state.field === "productName" ? state.message : null}
            hint="上の自動取得は参考です。読者に出るのはこの欄です。ASP の管理画面に出ている表記をそのまま入れてください。"
            toolParamDescription="読者のカードに出す商品名（ASP の表記のまま）"
          />
          <Field
            name="brand"
            label="ブランド"
            optional
            value={brand}
            onValueChange={setBrand}
            hint="分からないときは空のままにしてください。当てて書かないでください。"
            toolParamDescription="商品の作り手・ブランド名（任意）"
          />
          <Field
            name="oneLine"
            label="1 文の説明"
            optional
            value={oneLine}
            onValueChange={setOneLine}
            hint="カードの見出しの下に出ます。空でも登録できます。"
            toolParamDescription="カードに出す 1 文の説明（任意）"
          />
          <Button type="submit" tone="primary" busy={pending}>
            成果リンクとして登録する
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
