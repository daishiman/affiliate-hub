"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, ToolForm } from "@/presentation/ui";

/**
 * 商品の絞り込み欄。
 *
 * 入力の作法（Enter で次の欄・空欄は未入力）は共通部品 `Field` が持っている。
 * ここで独自に入力欄を書き起こすと、この画面だけ作法がずれる。
 *
 * 絞り込みの結果は URL に残す（`?q=…`）。
 * 画面内の状態だけに持たせると、共有も再読み込みもできない。
 *
 * --- 素の `<form>` から `ToolForm` へ変えた（2026-08-22）---
 *
 * 中の `Field` には `toolParamDescription`（AI へ何の値かを説明する宣言）が
 * 最初から書いてあった。だが包む側が素の `<form>` で、道具として名乗っていない。
 * **説明はどこにも届いていなかった。**
 *
 * 送信先が Server Action ではなく `router.push` なのは変えていない。絞り込みは
 * 状態を変えないので、結果は URL に載るだけでよい。名乗る名前は目録の
 * `filter_products` と同じにする。別名を作ると、同じ操作が 2 つあるように見える。
 */
export function ProductSearchForm({ initialText }: { readonly initialText: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);

  return (
    <ToolForm
      toolName="filter_products"
      toolDescription="登録済みの商品を言葉で絞り込む"
      onSubmit={(e) => {
        e.preventDefault();
        const query = text.trim();
        router.push(query === "" ? "/admin/products" : `/admin/products?q=${encodeURIComponent(query)}`);
      }}
    >
      <Field
        label="商品をさがす"
        value={text}
        onValueChange={setText}
        optional
        hint="商品名・メーカー名・説明文のどれかに含まれる言葉でさがします。"
        toolParamDescription="商品を絞り込むための言葉。空のときはすべての商品を返す。"
      />
      <Button type="submit" tone="primary">
        さがす
      </Button>
    </ToolForm>
  );
}
