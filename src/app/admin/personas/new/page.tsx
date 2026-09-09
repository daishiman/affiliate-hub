import { redirect } from "next/navigation";
import { legacyAdminRedirect } from "@/presentation/admin/legacy-admin-redirect";

/**
 * 旧 URL「書き手を作る」の殻。**転送だけを行う。**
 *
 * この画面の中身は `/admin/sites/[site]/...` へ移った。
 * ここを消さないのは、ブックマークや過去のリンクから来た人を
 * 404 に落とさないためである。404 は「消えた」と読まれる。
 *
 * 行き先の組み立てをここに書かない。書くと、5 本の殻それぞれで
 * 規則がずれた状態が作れる。作れるものはいつか作られる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md
 */
export default async function LegacyNewPersonaPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}) {
  redirect(await legacyAdminRedirect("/admin/personas/new", await searchParams));
}
