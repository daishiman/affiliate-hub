"use client";

import { useState } from "react";
import {
  Button,
  CheckboxGroup,
  Field,
  Select,
  TextArea,
  ToolForm,
  UI_COPY,
} from "@/presentation/ui";

/**
 * 入力欄の見本。
 *
 * ここだけ「手元で動く側」（クライアント）にしてあるのは、
 * 入力欄が**打ち込みに反応する様子まで確かめられないと意味がない**から。
 * 静止画のような見本だと、単位の出方・自動計算値の戻し方・
 * 間違いの伝え方といった、一番揃えたい部分が確かめられない。
 *
 * 見本帳の他の部分は表示だけなので、そちらは手元で動かす必要がない。
 */
export function InputSamples() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("129800");
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [category, setCategory] = useState("");
  const [uses, setUses] = useState<readonly string[]>(["video"]);
  const [memo, setMemo] = useState("");

  return (
    <ToolForm
      toolName="register_product_sample"
      toolDescription="商品を1件登録する（見本帳の中の例。実際には送信されません）"
      onSubmit={(e) => e.preventDefault()}
    >
      <Field
        label="商品名"
        value={name}
        onValueChange={setName}
        hint="販売ページに出ている表記のまま入れてください。"
        error={name.length > 0 && name.length < 3 ? "3文字以上で入力してください" : null}
        toolParamDescription="商品の正式名称"
      />

      <Field
        label="実売価格"
        value={price}
        onValueChange={(v) => {
          setPrice(v);
          setPriceOverridden(true);
        }}
        unit="円"
        autoValue="129800"
        autoValueSource="販売ページから取り込んだ値（2026-03-01 時点）"
        overridden={priceOverridden}
        onResetToAuto={() => {
          setPrice("129800");
          setPriceOverridden(false);
        }}
        hint="半角数字。取り込んだ値を手で直すと、直したことが分かる印が付きます。"
        toolParamDescription="税込の実売価格（円）"
      />

      <Select
        label="カテゴリ"
        value={category}
        onValueChange={setCategory}
        placeholder="選んでください"
        options={[
          { value: "laptop", label: "ノートパソコン" },
          { value: "monitor", label: "モニター" },
          { value: "ssd", label: "外付けSSD" },
          { value: "printer", label: "プリンター（いまは登録できません）", disabled: true },
        ]}
        hint="選べないものには理由が要ります。ここでは取り扱い前のため選べません。"
        toolParamDescription="商品カテゴリ"
      />

      <CheckboxGroup
        name="uses"
        label="想定する使い方"
        options={[
          { value: "video", label: "動画編集" },
          { value: "photo", label: "写真編集" },
          { value: "office", label: "書類作成" },
        ]}
        selected={uses}
        onSelectedChange={setUses}
        hint="複数選べます。押した順ではなく、元の並び順のままになります。"
        toolParamDescription="想定用途（複数可）"
      />

      <TextArea
        label="社内メモ"
        value={memo}
        onValueChange={setMemo}
        optional
        rows={3}
        hint="記事には出ません。"
        toolParamDescription="社内向けの補足メモ"
      />

      <Button tone="primary" type="submit">
        {UI_COPY.action.save}
      </Button>
    </ToolForm>
  );
}
