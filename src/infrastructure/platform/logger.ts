import type { LoggerPort } from "@/application/ports";
import { redactSensitive } from "@/domain/compliance/audit-log";

/**
 * 構造化ログ。
 *
 * 秘密情報の伏せ字は「気をつける」ではなく、出口 1 箇所で機械的に行う。
 * 監査ログと同じ `redactSensitive` を通すので、規則が 2 つに分かれない。
 */
type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, fields?: Readonly<Record<string, unknown>>): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...(fields ? redactSensitive(fields) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger: LoggerPort = {
  info: (event, fields) => emit("info", event, fields),
  warn: (event, fields) => emit("warn", event, fields),
  error: (event, fields) => emit("error", event, fields),
};

/** テスト用。出力を配列に貯める。 */
export function memoryLogger(): LoggerPort & { readonly lines: unknown[] } {
  const lines: unknown[] = [];
  return {
    lines,
    info: (event, fields) => lines.push({ level: "info", event, fields }),
    warn: (event, fields) => lines.push({ level: "warn", event, fields }),
    error: (event, fields) => lines.push({ level: "error", event, fields }),
  };
}
