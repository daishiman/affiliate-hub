import { createDeps } from "@/infrastructure/composition";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import { resolveRedirect } from "@/domain/monetization";
import { logger } from "@/infrastructure/platform/logger";

export const dynamic = "force-dynamic";

/**
 * 成果リンクの転送の入口（仕様 03 §1.2）。
 *
 * 読者がここを通ることで、**ASP が発行した URL を 1 文字も変えずに**
 * 「どのリンクが押されたか」を数えられる。URL に印を足すと多くの ASP で
 * 規約違反になり、成果そのものが計上されなくなる。
 *
 * 守ることが 4 つある。
 *
 *   1. **転送先を推測しない。** 合言葉から URL を組み立てず、
 *      保存済みの値だけを返す。組み立てる経路を 1 つでも作ると、
 *      合言葉を細工して任意の場所へ飛ばせる入口（オープンリダイレクト）になる。
 *   2. **記録の失敗で転送を止めない**（仕様 §1.2 の劣化契約）。
 *      読者は買いに行こうとしているので、こちらの都合で止めない。
 *      数えられなかったことは記録側の問題として残す。
 *   3. **状態ごとに違う番号を返す。** 知らない合言葉は 404、
 *      止めた・期限切れは 410。どちらも 404 にすると、
 *      「消したリンク」と「打ち間違い」が区別できなくなる。
 *   4. **キャッシュさせない。** 転送を中継に覚えられると、
 *      止めたリンクが生き続け、クリックも数えられない。
 */

/** 合言葉の形。ここを通らないものは保存先を引かずに落とす。 */
const CODE_PATTERN = /^[a-z0-9]{6,32}$/;

const NO_STORE = { "cache-control": "no-store" } as const;

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await context.params;
  if (!CODE_PATTERN.test(code)) {
    return textResponse(404, "このリンクは見つかりませんでした。");
  }

  const deps = createDeps({ db: await tryGetDb() });
  const resolved = await deps.redirectResolver
    .resolve(code)
    // 投げられても、読者には読める言葉を返す（既定の 500 の画面を見せない）。
    // 転送先が分からない以上どこへも送れないが、
    // 「消えた」ではなく「いま確認できない」と伝えられる。
    .catch((cause: unknown) => {
      logger.warn("redirect_resolve_threw", { code, reason: String(cause) });
      return { ok: false as const, error: { code: "storage_failure" as const } };
    });
  if (!resolved.ok) {
    // 保存先を引けなかった。**404 にしない。** 404 は「そんなリンクは無い」で、
    // 読者はリンクが消されたと受け取る。ここは「いま確認できない」である。
    return textResponse(
      503,
      "いまリンク先を確認できませんでした。少し時間をおいてもう一度お試しください。",
    );
  }

  const outcome = resolveRedirect(resolved.value, new Date());
  if (outcome.kind === "unknown") {
    return textResponse(404, "このリンクは見つかりませんでした。");
  }
  if (outcome.kind === "gone") {
    return textResponse(410, outcome.reason);
  }

  // 転送を先に確定させてから記録する。順番を逆にすると、
  // 記録が遅い日に読者の待ち時間がそのぶん延びる。
  const response = new Response(null, {
    status: 302,
    headers: { ...NO_STORE, location: outcome.url },
  });

  // `resolved.value` は上の `resolveRedirect` が redirect を返した時点で null ではない。
  const resolution = resolved.value as NonNullable<typeof resolved.value>;
  try {
    const recorded = await deps.clickTracking.recordClick({
      resolution,
      occurredAt: new Date(),
    });
    if (!recorded.ok) {
      // 数えられなかったことは残すが、読者には見せない（仕様 §1.2）。
      // 読者にできることが無いうえ、買いに行く手を止めてしまう。
      logger.warn("measurement_delivery_failed", { code, reason: recorded.error.code });
    }
  } catch (cause) {
    // **投げられても転送は返す。** 記録側は `Result` を返す約束だが、
    // その約束が破れた日（新しい保存先の実装が例外を投げる等）に
    // 読者が販売ページへ行けなくなるのは、こちらの都合を読者に負わせている。
    logger.warn("measurement_delivery_threw", { code, reason: String(cause) });
  }

  return response;
}
