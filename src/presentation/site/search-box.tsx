"use client";

import { useState } from "react";
import { Button, Field, ToolForm, UI_COPY } from "@/presentation/ui";

/**
 * 記事を探す入力欄。
 *
 * `method="get"` の素の送信にしてある。JavaScript が動かない環境でも探せる。
 * 結果の取得はサーバー側 (`/search?q=...`) が
 * **画面と同じユースケース** (`search`) を呼ぶ。
 *
 * `ToolForm` を通すので、この操作はそのまま AI から呼べる道具にもなる
 * （要求 E-5: 画面の状態と道具の状態を 1 つにする）。
 */
export function SearchBox({
  action,
  initialQuery = "",
}: {
  readonly action: string;
  readonly initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  return (
    <ToolForm
      action={action}
      method="get"
      toolName="searchArticles"
      toolDescription="このブログの公開記事を言葉で探す"
    >
      <Field
        name="q"
        label={UI_COPY.reader.searchLabel}
        hint={UI_COPY.reader.searchHint}
        value={query}
        onValueChange={setQuery}
        toolParamDescription="探したい言葉。商品名でも用途でもよい"
      />
      <Button type="submit">{UI_COPY.reader.searchSubmit}</Button>
    </ToolForm>
  );
}
