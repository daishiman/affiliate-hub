"use client";

import { useActionState, useState } from "react";
import {
  ARTICLE_BLOCK_LABEL,
  type LayoutRegion,
  LAYOUT_REGION_LABEL,
  LAYOUT_SLOT_LABEL,
  type TopBand,
  TOP_BAND_LABEL,
} from "@/domain/blogops";
import {
  Button,
  Callout,
  Checkbox,
  Field,
  FormResult,
  FormValue,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { manageBlogLayoutAction } from "./blog-layout-action";

/**
 * 枠 1 つぶんの設定。
 *
 * **枠は増やせない。出すか出さないかと、中身だけを決める。**
 * 置き場所 (`region`) と枠の名前 (`slotKey`) はブループリントが決めた一覧で、
 * 画面から新しい枠を作れないようにしてある。
 * 枠を自由に増やせると、どのブログにも同じ形がある、という前提が崩れる。
 */
export function BlogLayoutSlotForm({
  siteSlug,
  region,
  slotKey,
  title,
  body,
  position,
  enabled,
}: {
  readonly siteSlug: string;
  readonly region: LayoutRegion;
  readonly slotKey: string;
  readonly title: string;
  readonly body: string;
  readonly position: number;
  readonly enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogLayoutAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [titleValue, setTitleValue] = useState(title);
  const [bodyValue, setBodyValue] = useState(body);
  const [positionValue, setPositionValue] = useState(String(position));

  return (
    <ToolForm
      action={action}
      toolName={`save_layout_slot_${region}_${slotKey.replace(/-/g, "_")}`}
      /*
        **運営者に見せる言葉は `slotKey` そのものではない。**
        `brand-tag-cloud` と出しても、それがどの枠かは画面を見比べないと分からない。
        読者側と同じ言い換え表 (`LAYOUT_SLOT_LABEL`) を通すので、
        管理画面と公開面で同じ枠が同じ名前で出る。
      */
      toolDescription={`${LAYOUT_REGION_LABEL[region]}の「${LAYOUT_SLOT_LABEL[slotKey] ?? slotKey}」の表示・見出し・並び順を決める`}
    >
      <FormValue name="intent" value="slot" />
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="region" value={region} />
      <FormValue name="slotKey" value={slotKey} />
      <FormValue name="enabledPresent" value="1" />

      <Field
        label="見出し"
        name="title"
        value={titleValue}
        onValueChange={setTitleValue}
        optional
        hint={`空にすると「${LAYOUT_SLOT_LABEL[slotKey] ?? slotKey}」が見出しになります。`}
        toolParamDescription="枠の上に出す見出し"
      />
      <TextArea
        label="中身"
        name="body"
        value={bodyValue}
        onValueChange={setBodyValue}
        rows={3}
        optional
        toolParamDescription="枠に出す本文 (一覧系の枠では空でよい)"
      />
      <Field
        label="並び順"
        name="position"
        type="number"
        value={positionValue}
        onValueChange={setPositionValue}
        hint="小さいほど上に出ます。"
        toolParamDescription="同じ置き場所の中での並び順"
      />
      <Checkbox
        name="enabled"
        label="読者に見せる"
        defaultChecked={enabled}
        toolParamDescription="この部品を読者の画面に出すかどうか"
      />

      {state.field === "slotKey" ? (
        /*
         * `slotKey` は隠し欄なので、断りを受け取る入力欄が無い。
         * `FormResult` は欄に紐づく断りを出さない約束なので、ここで出す。
         * 出さないと、押しても何も起きない画面になる。
         */
        <Callout tone="warn" reason={state.message} />
      ) : null}

      <Button type="submit" disabled={pending}>
        この枠を保存
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * トップの帯 1 本ぶんの設定。
 *
 * `itemLimit` は「この帯に何本まで並べるか」。
 * 0 のままだと帯が空で出るので、出すと決めたら本数も決めてもらう。
 */
export function BlogLayoutBandForm({
  siteSlug,
  band,
  title,
  position,
  itemLimit,
  enabled,
}: {
  readonly siteSlug: string;
  readonly band: TopBand;
  readonly title: string;
  readonly position: number;
  readonly itemLimit: number;
  readonly enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogLayoutAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [titleValue, setTitleValue] = useState(title);
  const [positionValue, setPositionValue] = useState(String(position));
  const [itemLimitValue, setItemLimitValue] = useState(String(itemLimit));

  return (
    <ToolForm
      action={action}
      toolName={`save_top_band_${band.replace(/-/g, "_")}`}
      toolDescription={`トップの帯「${TOP_BAND_LABEL[band]}」の表示・見出し・本数を決める`}
    >
      <FormValue name="intent" value="band" />
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="band" value={band} />
      <FormValue name="enabledPresent" value="1" />

      <Field
        label="見出し"
        name="title"
        value={titleValue}
        onValueChange={setTitleValue}
        toolParamDescription="帯の見出し"
      />
      <Field
        label="並べる本数"
        name="itemLimit"
        type="number"
        value={itemLimitValue}
        onValueChange={setItemLimitValue}
        error={state.field === "itemLimit" ? state.message : null}
        unit="本"
        hint="0 だと帯が空のまま出ます。"
        toolParamDescription="この帯に並べる記事の最大件数"
      />
      <Field
        label="並び順"
        name="position"
        type="number"
        value={positionValue}
        onValueChange={setPositionValue}
        toolParamDescription="トップページでの帯の並び順"
      />
      <Checkbox
        name="enabled"
        label="読者に見せる"
        defaultChecked={enabled}
        toolParamDescription="この部品を読者の画面に出すかどうか"
      />

      <Button type="submit" disabled={pending}>
        この帯を保存
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

/** 記事の部品名を人が読む言葉へ。版面画面の説明文で使う。 */
export const articleBlockLabel = ARTICLE_BLOCK_LABEL;
