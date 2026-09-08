/** Multipart全体を上限内で受け取り、申告Content-Lengthを信用せず実測する。 */
export async function boundedFormData(
  request: Request,
  limit: number,
): Promise<{ ok: true; form: FormData } | { ok: false; status: 400 | 413 }> {
  if (Number(request.headers.get("content-length")) > limit) {
    await request.body?.cancel().catch(() => undefined);
    return { ok: false, status: 413 };
  }
  const reader = request.body?.getReader();
  if (reader === undefined) return { ok: false, status: 400 };
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(new Uint8Array(value));
    }
    const form = await new Response(new Blob(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    return { ok: true, form };
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}
