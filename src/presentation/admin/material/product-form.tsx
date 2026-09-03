"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IDENTITY_KEY_PRIORITY } from "@/domain/product";
import {
  Button,
  Callout,
  CheckboxGroup,
  Field,
  FormResult,
  FormValue,
  Select,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { createProductAction, updateProductAction } from "./product-form-action";
import { INITIAL_PRODUCT_FORM_STATE, type ProductFormState } from "./product-form-state";
import { adminOperation } from "../admin-operation-manifest";

/** 同一性の鍵の呼び名。内部のキーをそのまま出しても、何を入れる欄か分からない。 */
const IDENTITY_LABEL: Readonly<Record<string, string>> = {
  gtin: "JAN / EAN（商品バーコードの番号）",
  asin: "ASIN（Amazon の商品番号）",
  model_number: "型番",
  brand_and_name: "ブランド名と商品名",
  merchant_sku: "販売店の商品番号",
  name_similarity: "商品名が似ていること",
};

const IDENTITY_OPTIONS = IDENTITY_KEY_PRIORITY.map((kind) => ({
  value: kind,
  label: IDENTITY_LABEL[kind] ?? kind,
}));

const SPEC_HINT =
  "1 行に 1 項目、「項目名: 値」の形で書きます。数だけの値は数として扱い、比較表で大小を並べます。";

/**
 * 商品を登録する欄。
 *
 * **仕様と出どころを同じ画面で求める。** 片方だけ先に入れられるようにすると、
 * もう片方は足されないまま記事になる。断るのは業務側だが、
 * 画面が別々に受け取れる形にしていると、断られる操作を作らせることになる。
 */
export function CreateProductForm() {
  const operation = adminOperation("product.create");
  const [state, action, pending] = useActionState(createProductAction, INITIAL_PRODUCT_FORM_STATE);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [identityKind, setIdentityKind] = useState("");
  const [identityValue, setIdentityValue] = useState("");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="商品を登録する。比較表の列になる仕様と、その出どころが両方要る"
    >
      <Field
        name="brand"
        label="ブランド"
        value={brand}
        onValueChange={setBrand}
        error={state.field === "brand" ? state.message : null}
        toolParamDescription="ブランド名"
      />
      <Field
        name="name"
        label="商品名"
        value={name}
        onValueChange={setName}
        error={state.field === "name" ? state.message : null}
        toolParamDescription="商品名（ブランド名を含めない）"
      />
      <Field
        name="manufacturer"
        label="製造元"
        value={manufacturer}
        onValueChange={setManufacturer}
        optional
        hint="ブランドと製造元が違うときだけ書きます。"
        toolParamDescription="製造元の会社名"
      />
      <Select
        name="identityKind"
        label="同じ商品だと見分ける鍵"
        value={identityKind}
        onValueChange={setIdentityKind}
        options={IDENTITY_OPTIONS}
        placeholder="選んでください"
        optional
        hint="上にあるものほど確かです。無ければ空のままで構いません（後から足せます）。"
        toolParamDescription="同一性の鍵の種類"
      />
      <Field
        name="identityValue"
        label="鍵の値"
        value={identityValue}
        onValueChange={setIdentityValue}
        optional
        hint="上で選んだ鍵の値です。選んでいなければ書かなくて構いません。"
        toolParamDescription="同一性の鍵の値"
      />
      <TextArea
        name="specifications"
        label="仕様"
        value={specifications}
        onValueChange={setSpecifications}
        hint={SPEC_HINT}
        error={state.field === "specifications" ? state.message : null}
        toolParamDescription="比較表の列になる仕様（1 行に「項目名: 値」）"
      />
      <TextArea
        name="description"
        label="説明"
        value={description}
        onValueChange={setDescription}
        rows={4}
        optional
        toolParamDescription="商品の説明文"
      />
      <Field
        name="officialUrl"
        label="仕様の出どころ"
        value={officialUrl}
        onValueChange={setOfficialUrl}
        hint="公式のページを想定しています。ここに書いた場所が、後から「どこに書いてあったか」の答えになります。"
        error={state.field === "officialUrl" ? state.message : null}
        toolParamDescription="仕様の出どころの URL"
      />

      <ProductFormResult state={state} doneLinkLabel="登録した商品を見る" />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この商品を登録する"}
      </Button>
    </ToolForm>
  );
}

export type ProductEditDefaults = {
  readonly productId: string;
  readonly brand: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly description: string;
  readonly specifications: string;
  readonly officialUrl: string;
};

/**
 * 商品を直す欄。
 *
 * 登録の欄と別部品にしてある。同じ部品に「今は登録・今は修正」の分岐を持たせると、
 * 空欄の意味が場合によって変わる（登録では未入力、修正では触らない）。
 * 分岐の中に意味の違いを隠すと、読んだ人はどちらの意味か確かめられない。
 */
export function UpdateProductForm({ defaults }: { readonly defaults: ProductEditDefaults }) {
  const operation = adminOperation("product.update");
  const [state, action, pending] = useActionState(updateProductAction, INITIAL_PRODUCT_FORM_STATE);
  const [brand, setBrand] = useState(defaults.brand);
  const [name, setName] = useState(defaults.name);
  const [manufacturer, setManufacturer] = useState(defaults.manufacturer);
  const [description, setDescription] = useState(defaults.description);
  const [specifications, setSpecifications] = useState(defaults.specifications);
  const [officialUrl, setOfficialUrl] = useState(defaults.officialUrl);
  const [cleared, setCleared] = useState<readonly string[]>([]);

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="商品の内容を直す。仕様や出どころを空にする変更は、使っている記事があれば断られる"
    >
      <FormValue name="productId" value={defaults.productId} />

      <Field
        name="brand"
        label="ブランド"
        value={brand}
        onValueChange={setBrand}
        error={state.field === "brand" ? state.message : null}
        toolParamDescription="ブランド名"
      />
      <Field
        name="name"
        label="商品名"
        value={name}
        onValueChange={setName}
        error={state.field === "name" ? state.message : null}
        toolParamDescription="商品名"
      />
      <Field
        name="manufacturer"
        label="製造元"
        value={manufacturer}
        onValueChange={setManufacturer}
        optional
        toolParamDescription="製造元の会社名"
      />
      <TextArea
        name="description"
        label="説明"
        value={description}
        onValueChange={setDescription}
        rows={4}
        optional
        toolParamDescription="商品の説明文"
      />
      <TextArea
        name="specifications"
        label="仕様"
        value={specifications}
        onValueChange={setSpecifications}
        hint={SPEC_HINT}
        error={state.field === "specifications" ? state.message : null}
        toolParamDescription="比較表の列になる仕様（1 行に「項目名: 値」）"
      />
      <Field
        name="officialUrl"
        label="仕様の出どころ"
        value={officialUrl}
        onValueChange={setOfficialUrl}
        optional
        error={state.field === "officialUrl" ? state.message : null}
        toolParamDescription="仕様の出どころの URL"
      />
      {/*
        消すことを、空欄ではなく**選ぶ操作**にする。
        空欄を消去の合図にすると、打ち間違えて消えた項目と、
        消すつもりで消した項目が記録の上で同じ形になる。
      */}
      <CheckboxGroup
        name="clear"
        label="この項目を消す"
        options={[
          { value: "clearManufacturer", label: "製造元" },
          { value: "clearDescription", label: "説明" },
        ]}
        selected={cleared}
        onSelectedChange={setCleared}
        optional
        hint="選んだ項目は空になります。選ばなければ、欄を空にしても今の値のままです。"
        toolParamDescription="値を消す項目（省略すると何も消さない）"
      />

      <ProductFormResult state={state} doneLinkLabel="直した商品を見る" />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "保存しています…" : "この内容で保存する"}
      </Button>
    </ToolForm>
  );
}

/**
 * 押した後の知らせ（この画面のぶん）。
 *
 * 骨格は共通の `FormResult`。ここが足すのは**この画面にしか無い知らせ** —
 * 直した内容が何本の記事に及ぶか、の 1 件。
 *
 * 元はこのファイルが `FormResult` を自前で持ち、完了後のリンクを
 * `<p><Link/></p>` として別に置いていた。content-form 側は `Callout` の
 * `action` に置いていて、**同じ意味のものが画面ごとに違う場所に出ていた**。
 * 共通側へ寄せた結果、置き場所は `action` の 1 つになった。
 */
function ProductFormResult({
  state,
  doneLinkLabel,
}: {
  readonly state: ProductFormState;
  readonly doneLinkLabel: string;
}) {
  return (
    <FormResult
      state={state}
      doneAction={
        state.productPath === undefined ? null : <Link href={state.productPath}>{doneLinkLabel}</Link>
      }
    >
      {/* 0 件のときは黙る。0 と書くと、何かの警告に見える。 */}
      {state.status === "done" &&
      state.referencingArticles !== undefined &&
      state.referencingArticles > 0 ? (
        <Callout
          tone="info"
          reason={`この商品を主題にしている記事が ${state.referencingArticles} 本あります。直した内容はその記事の比較表にも及びます。`}
        />
      ) : null}
    </FormResult>
  );
}
