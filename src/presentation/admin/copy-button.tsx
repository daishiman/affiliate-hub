"use client";

import { useState } from "react";
import { Button } from "@/presentation/ui";

/**
 * 文字列をコピーする。
 *
 * --- 文字列を必ず画面にも出す ---
 *
 * 書き込み用のクリップボードは、ブラウザや設定によっては使えない。
 * このボタンだけが持ち出しの道になっていると、使えない環境の人はそこで止まる。
 * だから**呼ぶ側は文面そのものも画面に出したうえで**このボタンを添える。
 * 使えなかったときは、その旨と「画面の文を選んでコピーしてください」を出す。
 */
export function CopyButton({ label, text }: { readonly label: string; readonly text: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  const copy = async (): Promise<void> => {
    const clipboard = navigator.clipboard as { writeText?: (v: string) => Promise<void> } | undefined;
    if (typeof clipboard?.writeText !== "function") {
      setNotice("この環境ではコピーできません。下の文をそのまま選んでコピーしてください。");
      return;
    }
    try {
      await clipboard.writeText(text);
      setNotice("コピーしました。");
    } catch {
      setNotice("コピーできませんでした。下の文をそのまま選んでコピーしてください。");
    }
  };

  return (
    <>
      <Button tone="secondary" onClick={copy}>
        {label}
      </Button>
      {notice === null ? null : <p>{notice}</p>}
    </>
  );
}
