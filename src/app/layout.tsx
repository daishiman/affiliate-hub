import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
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
