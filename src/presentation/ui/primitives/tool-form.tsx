"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

/**
 * 人と AI の両方から使えるフォーム。
 *
 * 仕様の要求のひとつに「画面でできることは AI からもできる」がある。
 * これを別々に実装すると、片方だけ機能が増えて必ずずれる。
 *
 * ここでは **同じフォームに宣言を添える**形にする。
 *   toolname            … この操作の名前 (AI が呼ぶときの識別子)
 *   tooldescription     … 何をする操作か
 *   toolparamdescription … 各入力欄が何の値か (Field 側で指定)
 *
 * 属性名がすべて小文字なのは仕様どおり。React の慣習 (camelCase) とは違うが、
 * ここで勝手に変えると読み取られない。型の追加は ./webmcp.d.ts。
 *
 * 実際の呼び出しは REST / WebMCP / バックエンド MCP の 3 つの入口が
 * **同じ application 層のユースケース**を叩く。この部品は宣言だけを担う。
 */
export function ToolForm({
  toolName,
  toolDescription,
  children,
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "children"> & {
  /** AI が呼ぶときの名前。ユースケース名と揃える（別名を作らない）。 */
  readonly toolName: string;
  /** 何をする操作か。1 文で、利用者向けの言葉で書く。 */
  readonly toolDescription: string;
  readonly children: ReactNode;
}) {
  return (
    <form {...rest} toolname={toolName} tooldescription={toolDescription}>
      {children}
    </form>
  );
}
