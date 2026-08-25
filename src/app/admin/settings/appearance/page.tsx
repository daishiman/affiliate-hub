import { AdminShell } from "@/presentation/admin/admin-shell";
import { appearanceOptions, readAppearance } from "@/presentation/appearance";
import { AppearancePicker, Note, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 画面の見た目。
 *
 * `/admin/settings` から移出した。ここでの選択は**この端末のブラウザにだけ**効く。
 * 読者に見える色は各ブログの設計図で決まるので、混ぜない。
 * 混ぜると「自分の画面を暗くしたらブログも暗くなった」が起きる。
 */
export default async function AppearanceSettingsPage() {
  const current = await readAppearance();
  const options = appearanceOptions();

  return (
    <AdminShell
      routeId="settings/appearance"
      title="画面の見た目"
      lead="この端末だけに効きます。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      <Section title="明るさと配色">
        {/*
          読者向けブログでも同じ部品を使う（あちらは明るさだけを出す）。
          管理画面用の見た目切り替えを別に作らないこと。
        */}
        <AppearancePicker
          current={current}
          schemeOptions={options.schemeOptions}
          modeOptions={options.modeOptions}
          description="選ぶとすぐ変わります。次に開いたときも同じ見た目になります。"
        />
        <Note>
          読者に見える色は、各ブログの設計図（
          <TextLink href="/admin/sites">ブログの一覧</TextLink>）で決まります。
        </Note>
      </Section>
    </AdminShell>
  );
}
