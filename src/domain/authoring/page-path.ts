/**
 * ページ単位設定のパスを、保存と公開読み取りで同じ形へ寄せる。
 *
 * URL routingや権限には依存しない純粋なdomain policyである。
 * application usecaseへ置くと、公開read modelが管理usecaseへ逆依存するため、
 * 双方がこの1本だけを参照する。
 */
export function normalizePagePath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withSlash.replace(/\/+$/, "");
  return withoutTrailing === "" ? "/" : withoutTrailing;
}
