/**
 * 系統①の静的解析を **本物の workerd の中で** 動かすための入口。
 *
 * --- なぜこれが要るのか ---
 * `HTMLRewriter` は Workers の実行環境にしか無い。Node の側で偽物を
 * 用意すると、確かめているのは偽物の振る舞いであって、本番で動く
 * 読み取りではない。「静かに間違える」を避けるためにこの読み取りを
 * 選んだのに、検査で偽物に差し替えたら意味が無くなる。
 *
 * そこでこのファイルを esbuild で束ね、Miniflare に読ませて、
 * 検査からは HTTP で問いかける。**実装は本物をそのまま呼ぶ**ので、
 * 束ね方が壊れれば検査も落ちる。
 *
 * このファイルは `tests/**\/*.test.ts` に当たらない名前にしてある
 * （Vitest が入口そのものを検査として拾わないため）。
 */
import { createStaticAuditCollector } from "@/infrastructure/seo/aeo-measurement/static-audit-collector";

/** 検査から渡す「このページはこう返る」という設定。 */
export type ObserveRequest = {
  readonly url: string;
  readonly kind?: "html" | "llms";
  /** 返す HTML。`null` なら本文を返さない。 */
  readonly html?: string | null;
  readonly status?: number;
  /** 網に出られなかった場合を作る。 */
  readonly throwName?: string;
};

const worker = {
  async fetch(request: Request): Promise<Response> {
    const spec = (await request.json()) as ObserveRequest;

    const collector = createStaticAuditCollector({
      fetch: (async () => {
        if (spec.throwName !== undefined) {
          const error = new Error("injected");
          error.name = spec.throwName;
          throw error;
        }
        return new Response(spec.html ?? "", {
          status: spec.status ?? 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }) as typeof fetch,
    });

    const result = spec.kind === "llms"
      ? await collector.observeLlmsTxt(spec.url)
      : await collector.observe(spec.url);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  },
};

export default worker;
