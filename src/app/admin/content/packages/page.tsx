import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  contentPackageUseCases,
  currentActor,
  editorialContentNotice,
} from "@/presentation/composition";
import {
  ActionNote,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 企画の一覧。
 *
 * **企画は記事ではない。記事を何本も生む親である。**
 * 「どの商品を・誰が・誰に向けて・何のために」までを企画が決め、
 * 媒体と長さと締めの一言を記事（`/admin/content`）が決める。
 *
 * この画面ができるまで、企画は見本の 1 件しか無かった。
 * つまり作られた記事はすべて同じ企画にぶら下がっていて、
 * 「この記事は何の企画か」の答えがどの記事についても同じだった。
 *
 * 一覧に「足りないもの」を出しているのは、**足りないまま先へ進めるのを
 * 防ぐため**ではなく、進めない理由をここで見せるため。主張と根拠が空の企画は
 * 生成の直前で断られる。断られる場所より前に理由が見えていないと、
 * 書き始めてから引き返すことになる。
 */
export default async function ContentPackagesPage() {
  const actor = await currentActor();
  const packages = await (await contentPackageUseCases()).listPackages.execute(actor, {});

  return (
    <AdminShell
      routeId="content/packages"
      title="企画"
      lead="何のために記事を書くかを決めます。"
      actions={
        <>
          <TextLink href="/admin/content/packages/new">企画を立てる</TextLink>
          <TextLink href="/admin/content">記事へ戻る</TextLink>
        </>
      }
    >
      {!packages.ok ? (
        <ErrorView
          title="企画の一覧を出せませんでした"
          body={packages.error.message}
          suggestedAction={packages.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事へ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await editorialContentNotice()} />

          {packages.value.items.length === 0 ? (
            <Section title="企画">
              <EmptyView
                title="企画がまだありません"
                body={packages.value.emptyReason ?? "何のために記事を書くかが決まっていません。"}
                action={<TextLink href="/admin/content/packages/new">企画を立てる</TextLink>}
              />
            </Section>
          ) : (
            <>
              <Prose>
                企画が {packages.value.items.length} 件あります。1
                つの企画から、読者と切り口の組み合わせだけ記事を書き分けられます。
              </Prose>

              <Section title="立てた企画">
                <DataTable
                  caption="企画の一覧"
                  columns={[
                    { key: "objective", label: "達成したいこと" },
                    { key: "status", label: "進み具合" },
                    { key: "author", label: "書き手" },
                    { key: "audiences", label: "読者" },
                    { key: "angles", label: "切り口" },
                    { key: "variants", label: "書いた記事" },
                  ]}
                  rows={packages.value.items.map((pkg) => ({
                    key: pkg.packageId,
                    cells: [
                      pkg.objective,
                      pkg.statusLabel,
                      pkg.authorName,
                      pkg.audienceNames.join("、"),
                      pkg.angleLabels.join("、"),
                      `${pkg.variantCount} 本`,
                    ],
                  }))}
                />
              </Section>

              {packages.value.items
                .filter((pkg) => pkg.missing.length > 0)
                .map((pkg) => (
                  <ActionNote key={pkg.packageId} tone="danger">
                    「{pkg.objective}」は、まだ書き始められません（
                    {pkg.missing.join(" / ")}が登録されていません）。
                  </ActionNote>
                ))}
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
