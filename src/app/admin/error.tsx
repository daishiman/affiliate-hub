"use client";

import { ErrorView, Button } from "@/presentation/ui";

/**
 * 管理画面の想定外の失敗。
 *
 * ここに落ちてきた時点で、何が起きたかは機械にしか分からない。
 * だから画面には 3 つだけ書く。
 * 「何が起きたか」「いま何が確かなのか」「次に何ができるか」。
 *
 * `error.message` を本文へ出さない。本番の Next.js は本文を伏せるため、
 * 出しても空文字が並ぶだけで、利用者には何も伝わらない。
 * 代わりに `digest` を出す。問い合わせのときに記録と突き合わせられる唯一の手がかり。
 *
 * Error boundary は Client Component でなければならない（Next.js の決まり）。
 * 第 2 引数が `reset` ではなく `retry` である点に注意。
 */
export default function AdminError({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  return (
    <ErrorView
      title="この画面を表示できませんでした"
      body={
        error.digest === undefined
          ? "原因を特定できていません。"
          : `原因を特定できていません。記録の照合番号は ${error.digest} です。`
      }
      safeToUse="保存済みの内容は失われていません。この画面に出ていない値は、まだ確定していないものです。"
      suggestedAction="もう一度読み込んでください。それでも直らないときは、照合番号を添えて連絡してください。"
      action={<Button onClick={retry}>もう一度読み込む</Button>}
    />
  );
}
