"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "@/presentation/ui";

/**
 * 商品の絞り込み欄。
 *
 * 入力の作法（Enter で次の欄・空欄は未入力）は共通部品 `Field` が持っている。
 * ここで独自に入力欄を書き起こすと、この画面だけ作法がずれる。
 *
 * 絞り込みの結果は URL に残す（`?q=…`）。
 * 画面内の状態だけに持たせると、共有も再読み込みもできない。
 */
export function ProductSearchForm({ initialText }: { readonly initialText: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);

  return (
    <form
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
    </form>
  );
}
