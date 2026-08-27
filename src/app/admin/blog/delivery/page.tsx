import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogDeliveryCheck } from "@/presentation/admin/blog-delivery-check";
import { BlogDeliveryForm } from "@/presentation/admin/blog-delivery-form";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/blog-site-switch";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { DELIVERY_HEALTH_LABEL } from "@/domain/blogops";
import {
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 配信の部品。
 *
 * feed も sitemap も、切っても画面は何も変わらない。
 * だからこの画面は**切った事実そのものを見せる場所**として作ってある。
 * 一覧に「出す / 切る」と覚え書きを並べ、切った理由が読めるようにする。
 */
export default async function BlogDeliveryPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/delivery"
        title="配信の部品"
        lead="読者と機械へ届く経路の出し入れを決めます。"
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
        routeId="blog/delivery"
        title="配信の部品"
        lead="読者と機械へ届く経路の出し入れを決めます。"
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
      routeId="blog/delivery"
      title="配信の部品"
      lead="読者と機械へ届く経路の出し入れを決めます。"
      actions={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
    >
      <BlogSiteSwitch basePath="/admin/blog/delivery" current={siteSlug} options={sites.options} />

      {!layout.ok ? (
        <ErrorView
          title="配信の設定を読めませんでした"
          body={layout.error.message}
          suggestedAction={layout.error.suggestedAction ?? null}
        />
      ) : (
        <>
        <Section
          title="点検"
          lead="出す設定になっていることと、実際に出せることは別です。"
        >
          <Prose>
            押すと 9 種を組み立て直し、結果をこの表に残します。表の日時は、その結果が
            いつのものかを表します。設定を変えても日時は動きません。
          </Prose>
          <BlogDeliveryCheck siteSlug={siteSlug} />
          <DataTable
            caption="配信物ごとの最後の点検結果"
            columns={[
              { key: "part", label: "配信物" },
              { key: "state", label: "状態" },
              { key: "detail", label: "見たこと" },
              { key: "checkedAt", label: "点検した日時" },
            ]}
            rows={layout.value.deliveryHealth.map((row) => ({
              key: row.part,
              cells: [
                row.label,
                DELIVERY_HEALTH_LABEL[row.state],
                row.detail === "" ? "—" : row.detail,
                row.checkedAt === null
                  ? "—"
                  : row.checkedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
              ],
            }))}
          />
        </Section>

        <Section title="経路" lead="切っても画面は変わりません。切った理由を覚え書きに残してください。">
          <Prose>
            検索エンジンと AI がこのブログを見つける道です。切ると、新しい記事が
            見つけられるまでの時間が伸びます。
          </Prose>
          {layout.value.deliveryParts.map((part) => (
            <SubSection
              key={part.part}
              title={part.label}
              lead={part.untouched ? "まだ一度も触られていません。" : undefined}
            >
              <BlogDeliveryForm
                siteSlug={siteSlug}
                part={part.part}
                enabled={part.enabled}
                note={part.note}
                position={part.position}
              />
            </SubSection>
          ))}
        </Section>
        </>
      )}
    </AdminShell>
  );
}
