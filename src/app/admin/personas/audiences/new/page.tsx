import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateAudiencePersonaForm } from "@/presentation/admin/write/persona-form";
import { Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 読者像を 1 つ作る画面。
 *
 * 書き手を作る画面と分けている。**決める順番も、決める人も違う**からで、
 * 書き手は「名乗れるか」の話、読者像は「何を比べたいか」の話である。
 */
export default function NewAudiencePersonaPage() {
  return (
    <AdminShell
      routeId="personas/audiences/new"
      title="読者像を作る"
      lead="誰に向けて書くか、何を比べたいかを決めます。"
      actions={<TextLink href="/admin/personas/audiences">読者像の一覧へ戻る</TextLink>}
    >
      <Section title="決める">
        <Prose>
          「何で決めるか」に書いたものが、そのまま比較表の列になります。
          ここが空のままだと、列の立たない比較表ができます。
        </Prose>
        <CreateAudiencePersonaForm />
      </Section>
    </AdminShell>
  );
}
