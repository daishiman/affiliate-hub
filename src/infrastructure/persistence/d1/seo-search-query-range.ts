/** 収集と画面読取で共有する、実在する日付・両端を含む31日以内の範囲。 */
export function inclusiveSearchQueryDates(from: string, to: string): readonly string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  if (new Date(start).toISOString().slice(0, 10) !== from || new Date(end).toISOString().slice(0, 10) !== to) return null;
  const length = Math.floor((end - start) / 86_400_000) + 1;
  if (length < 1 || length > 31) return null;
  return Array.from({ length }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}
