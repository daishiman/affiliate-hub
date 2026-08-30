import { AdminShell } from "@/presentation/admin/admin-shell";
import { SaveBrandForm } from "@/presentation/admin/maintain/brand-form";
import {
  brandPolitenessOptions,
  brandVocabularyOptions,
  currentActor,
  settingsUseCases,
} from "@/presentation/composition";
import { Callout, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブランドを直す画面。
 *
 * 作る画面と**同じ部品**を使う（`brand-form.tsx` の冒頭を見よ）。
 * 違いは番号を隠して一緒に送ることだけ。
 *
 * 一覧から 1 件を選び直すのではなく、一覧の結果から探す。
 * `findById` を別に呼ぶと、一覧に出ている行と直せる行が食い違う状態が作れる
 * （見本と本物の混ぜ方が 2 か所で決まるため）。
 */
export default async function EditBrandPage({
  params,
}: {
  readonly params: Promise<{ readonly brand: string }>;
}) {
  const { brand: brandId } = await params;
  const actor = await currentActor();
  const brands = await (await settingsUseCases()).listBrands.execute(actor, {});
  const found = brands.ok ? (brands.value.rows.find((r) => r.brandId === brandId) ?? null) : null;

  return (
    <AdminShell
      routeId="settings/brands/[brand]"
      routeParams={{ brand: brandId }}
      title="ブランドを直す"
      lead="読者に見える名前・問い合わせ先・文体を直します。"
      actions={
        <>
          <TextLink href="/admin/settings/brands/new">ブランドを作る</TextLink>
          <TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>
        </>
      }
    >
      {!brands.ok ? (
        <ErrorView
          title="ブランドを読み出せませんでした"
          body={brands.error.message}
          suggestedAction={brands.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>}
        />
      ) : found === null ? (
        /*
         * 「読めなかった」と「そのブランドが無い」を分ける。
         * 消された後の URL を開いた人に「読み出せませんでした」と出すと、
         * 直らないものを何度も読み込みに行かせる。
         */
        <Section title="ブランドを直す">
          <EmptyView
            title="そのブランドがありません"
            body="消されたか、URL が違います。一覧から選び直してください。"
            action={<TextLink href="/admin/settings/workspaces">ブランドの一覧へ</TextLink>}
          />
        </Section>
      ) : (
        <>
          {found.missing.length > 0 && (
            <Callout
              tone="warn"
              title="このブランドでは記事を公開できません"
              reason={`公開の前に ${found.missing.join("・")} が要ります。読者が訂正を求める先を示せないためです。`}
            />
          )}

          <Section title={found.displayName}>
            <SaveBrandForm
              politenessOptions={brandPolitenessOptions().map((o) => ({
                value: o.key,
                label: o.label,
              }))}
              vocabularyOptions={brandVocabularyOptions().map((o) => ({
                value: o.key,
                label: o.label,
              }))}
              initial={{
                brandId: found.brandId,
                displayName: found.displayName,
                // 未設定は空欄で出す。「未設定」という文字を入れると、
                // そのまま保存した人の問い合わせ先が「未設定」になる。
                legalName: found.legalName ?? "",
                contactEmail: found.contactEmail ?? "",
                positioning: found.positioning,
                politeness: found.politeness,
                firstPerson: found.firstPerson,
                vocabulary: found.vocabulary,
                avoidPhrases: found.avoidPhrases,
                disclaimer: found.disclaimer ?? "",
                locale: found.locale,
                timeZone: found.timeZone,
                defaultCta: found.defaultCta,
              }}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
