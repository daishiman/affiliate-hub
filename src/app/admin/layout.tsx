import type { ReactNode } from "react";
import { adminWebMcpDescriptors } from "@/presentation/composition";
import { WebMcpProvider } from "@/presentation/ui";

/**
 * 管理画面の共通の入れ物。
 *
 * 現在地と退避先の表示は `AppShell` が持っている。
 * 現在地はページごとに違うため、`AppShell` は各ページで包む。
 * ここは管理画面共通の設定（表示名など）だけを持つ。
 */
export const metadata = {
  title: "管理 | affiliate-hub",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/*
        管理画面を開いている AI に、読み取りだけを知らせる（WebMCP）。
        承認・公開・調整は載せない。人が画面で確認して実行する操作だから。
      */}
      <WebMcpProvider descriptors={adminWebMcpDescriptors()} />
    </>
  );
}
