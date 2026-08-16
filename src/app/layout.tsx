import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { readAppearance } from "@/presentation/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "affiliate-hub",
  description: "アフィリエイト案件と成果データを一元管理する",
};

/**
 * 見た目（配色 × 明暗）を**ここ 1 箇所だけ**で当てる。
 *
 * 画面ごとに属性を付けると、付け忘れた画面だけ既定色になる。
 * 実際の色の解決は CSS のトークンが行うので、ここがすることは属性を置くだけ。
 *
 * サーバー側で cookie を読んでいるのは、**最初の描画から正しい色にする**ため。
 * 画面が出てから JS で直す作りにすると、一瞬だけ前の色が見える（FOUC）。
 * この方式なら JS が動かない環境でも選択が効く。
 *
 * 読者向けブログの配色はブログ側が決めるため、`SiteShell` が内側で上書きする。
 * ここで決まるのは「その人の既定」であり、ブログの中ではブランドが優先される。
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const appearance = await readAppearance();

  return (
    <html
      lang="ja"
      {...appearanceAttributes(appearance)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          ページを開いている AI への公開（WebMCP）は、ここではなく画面の枠で行う。
          全ページ共通で載せると「そのページでできないこと」まで並んでしまう。
        */}
        {children}
      </body>
    </html>
  );
}
