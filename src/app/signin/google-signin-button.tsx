"use client";

import { useState } from "react";
import { Button } from "@/presentation/ui";

/**
 * Google でログインする、その 1 操作だけを持つ部品。
 *
 * **共通の部品置き場（`src/presentation/ui/`）には置かない。**
 * あちらは「表示だけを行う」場所で、通信を持つものは置けない。
 * この部品はログインの入口へ問い合わせるので、使う画面の隣に置く。
 *
 * ここが何をしているか:
 *   ログインの入口へ「Google で始めたい」と伝え、返ってきた行き先へ画面を移す。
 *
 * **秘密の値はこの部品を通らない。** 押した先で使う識別子と秘密の値は
 * サーバー側にしかなく、ここが知っているのは「Google を使う」ということだけ。
 * 画面の中に鍵を置くと、ブラウザの開発者ツールから誰でも読める。
 */
export function GoogleSignInButton({ callbackUrl }: { readonly callbackUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: callbackUrl }),
      });
      const body = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || typeof body.url !== "string") {
        // ここで理由を細かく出さない。「どの設定が抜けているか」は
        // 入ろうとした人ではなく、運用する人が見るものである。
        setError("いまログインを始められませんでした。少し待ってからもう一度お試しください。");
        setBusy(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("通信ができませんでした。接続を確かめて、もう一度お試しください。");
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        tone="primary"
        busy={busy}
        busyLabel="Google の画面へ移動しています"
        onClick={start}
      >
        Google でログイン
      </Button>
      {error !== null && (
        <p role="alert" style={{ marginTop: "0.75rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
