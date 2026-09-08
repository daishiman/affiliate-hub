/** D1's bound string limit is 2 MB; keep ample room for encoding and platform changes. */
export const D1_JSON_PAYLOAD_MAX_BYTES = 512 * 1024;
export const D1_JSON_PAYLOAD_MAX_ROWS = 4_000;

type ChunkOptions = {
  readonly maxBytes?: number;
  readonly maxRows?: number;
};

/**
 * Encode rows as bound JSON arrays while limiting UTF-8 bytes as well as row count.
 * Oversized content is never included in the thrown error.
 */
export function jsonArrayChunks<T>(rows: readonly T[], options: ChunkOptions = {}): readonly string[] {
  const maxBytes = options.maxBytes ?? D1_JSON_PAYLOAD_MAX_BYTES;
  const maxRows = options.maxRows ?? D1_JSON_PAYLOAD_MAX_ROWS;
  if (!Number.isInteger(maxBytes) || maxBytes < 3 || !Number.isInteger(maxRows) || maxRows < 1) {
    throw new RangeError("D1 JSON chunk limits are invalid");
  }

  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let parts: string[] = [];
  let bytes = 2; // []

  const flush = () => {
    if (parts.length === 0) return;
    chunks.push(`[${parts.join(",")}]`);
    parts = [];
    bytes = 2;
  };

  for (const row of rows) {
    const encoded = JSON.stringify(row);
    if (typeof encoded !== "string") throw new RangeError("A D1 JSON row cannot be encoded");
    const rowBytes = encoder.encode(encoded).byteLength;
    if (rowBytes + 2 > maxBytes) throw new RangeError("A D1 JSON row exceeds the payload limit");
    const nextBytes = bytes + rowBytes + (parts.length === 0 ? 0 : 1);
    if (parts.length >= maxRows || nextBytes > maxBytes) flush();
    parts.push(encoded);
    bytes += rowBytes + (parts.length === 1 ? 0 : 1);
  }
  flush();
  return chunks;
}
