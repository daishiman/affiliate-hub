import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { WebMcpProvider } from "@/components/webmcp-provider";

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
        {children}
        {/* ページを開いている AI エージェントにツールを公開する (WebMCP) */}
        <WebMcpProvider />
      </body>
    </html>
  );
}
