import { createDeps } from "@/infrastructure/composition";
import { createRecordTelemetryUseCase } from "@/application/usecases/analytics/record-telemetry";
import { readerActor } from "@/presentation/composition";
import { readConsentSignals } from "@/presentation/telemetry/consent-server";

export const dynamic = "force-dynamic";

/**
 * 計測の受け口。
 *
 * 3 つを守る。
 *   1. **同意の判定はサーバー側でやり直す。** 送られてきた「同意しています」を
 *      信じると、判定を迂回する道ができる。判定材料は cookie とヘッダから
 *      自分で読み直す。
 *   2. **必ず 204 を返す。** 記録の成否を読者の画面に伝えない。
 *      伝えても読者にできることは無く、エラー表示が出るだけ害になる。
 *   3. 大きすぎる本文は読まない。まとめ書きの上限を超えたものは捨てる。
 */
const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS = 50;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });

    const parsed = JSON.parse(raw) as {
      events?: unknown;
      readerKey?: unknown;
    };
    const events = Array.isArray(parsed.events) ? parsed.events.slice(0, MAX_EVENTS) : [];
    if (events.length === 0) return new Response(null, { status: 204 });

    const signals = await readConsentSignals();
    const useCase = createRecordTelemetryUseCase({ sink: createDeps().telemetry });
    await useCase.execute(readerActor(), {
      events: events as never,
      signals,
      readerKey: typeof parsed.readerKey === "string" ? parsed.readerKey : null,
    });
  } catch {
    // 記録できなくても読者の画面は動く。ここで失敗を返さない。
  }
  return new Response(null, { status: 204 });
}
