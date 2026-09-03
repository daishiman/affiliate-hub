import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  BlogLayoutBandForm,
  BlogLayoutSlotForm,
} from "@/presentation/admin/publish/blog-layout-form";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/publish/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/publish/blog-site-switch";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import {
  Callout,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 版面の枠と帯。
 *
 * 枠は増やせない。**設計図が数える枠を全部並べ、保存済みの値を重ねて出す**。
 * 未保存の枠を隠すと、「サイドバーに何も出ない」の原因が
 * 「枠が無い」なのか「出さない設定」なのか、画面から判別できなくなる。
 */
export default async function BlogLayoutPage({
  searchParams,
}: {
  // Next.js 16 では searchParams は Promise。await せずに読むと undefined になる。
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/layout"
        title="版面の枠と帯"
        lead="ヘッダー・サイドバー・帯に何を出すか決めます。"
      >
        <ErrorView
          title="いまは編集できません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const [params, sites] = await Promise.all([searchParams, blogSiteOptions()]);
  const siteSlug = pickSiteSlug(params, sites.options);

  if (siteSlug === null) {
    return (
      <AdminShell
        routeId="blog/layout"
        title="版面の枠と帯"
        lead="ヘッダー・サイドバー・帯に何を出すか決めます。"
      >
        <Section title="ブログ">
          <EmptyView
            title="対象のブログがありません"
            body={sites.emptyReason ?? "先にブログのつながりを 1 本作ってください。"}
            action={<TextLink href="/admin/site-network/new">つながりに 1 本足す</TextLink>}
          />
        </Section>
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const layout = await entry.readLayout.execute(actor, { siteSlug });

  return (
    <AdminShell
      routeId="blog/layout"
      title="版面の枠と帯"
      lead="ヘッダー・サイドバー・帯に何を出すか決めます。"
      actions={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
    >
      <BlogSiteSwitch basePath="/admin/blog/layout" current={siteSlug} options={sites.options} />

      {!layout.ok ? (
        <ErrorView
          title="版面を読めませんでした"
          body={layout.error.message}
          suggestedAction={layout.error.suggestedAction ?? null}
        />
      ) : (
        <>
          <Callout
            tone={layout.value.untouchedCount === 0 ? "info" : "warn"}
            title={
              layout.value.untouchedCount === 0
                ? "すべての枠に、出す / 出さないの判断が入っています"
                : `${layout.value.untouchedCount} 個の枠が、一度も触られていません`
            }
            reason={
              layout.value.untouchedCount === 0
                ? "読者の画面に出るものは、すべて誰かが決めた結果です。"
                : "触られていない枠は出ません。出すつもりだった枠が混ざっていないか確認してください。"
            }
          />

          <Section
            title="枠"
            lead="ヘッダー・サイドバー・固定サイドバー・フッターに置ける場所です。増やせません。"
          >
            <Prose>
              枠の名前は設計図が決めています。名前を変えたいときは見出しを書き換えてください。
            </Prose>
            {layout.value.slots.map((slot) => (
              <SubSection
                key={`${slot.region}:${slot.slotKey}`}
                title={`${slot.regionLabel} / ${slot.slotKey}`}
                lead={slot.untouched ? "まだ一度も触られていません。" : undefined}
              >
                <BlogLayoutSlotForm
                  siteSlug={siteSlug}
                  region={slot.region}
                  slotKey={slot.slotKey}
                  title={slot.title}
                  body={slot.body}
                  position={slot.position}
                  enabled={slot.enabled}
                />
              </SubSection>
            ))}
          </Section>

          <Section title="トップの帯" lead="トップページに縦に並ぶ、記事のまとまりです。">
            {layout.value.bands.map((band) => (
              <SubSection
                key={band.band}
                title={band.label}
                lead={band.untouched ? "まだ一度も触られていません。" : undefined}
              >
                <BlogLayoutBandForm
                  siteSlug={siteSlug}
                  band={band.band}
                  title={band.title}
                  position={band.position}
                  itemLimit={band.itemLimit}
                  enabled={band.enabled}
                />
              </SubSection>
            ))}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
