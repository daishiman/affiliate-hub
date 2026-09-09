import { PATTERN_WRITING_EMPHASIS } from "@/domain/authoring/pattern-writing-emphasis";
import { SITE_PATTERNS, SITE_PATTERN_LABEL } from "@/domain/authoring/site-blueprint";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, platformUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ListView,
  Note,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 共通の雛形。
 *
 * **ブログ 1 本ずつの「書き方の決めごと」は、ここを参照している。**
 * 各ブログの画面で見えている違いは重みだけで、節も文体の決まりも
 * この 1 つの雛形から出ている。ここを直すと全ブログに効く。
 *
 * 逆に言えば、ブログ 1 本だけを例外にする欄はここに無い。
 * 欄を作ると、例外が増えたときに公開前の検査がどれを見るか決まらなくなる。
 * 1 本だけ変えたい要求が出たら、それは型を増やす話として扱う。
 */
export default async function WritingTemplatePage() {
  const [actor, platform] = await Promise.all([currentActor(), platformUseCases()]);
  const listed = await platform.listSites.execute(actor, {});
  /*
    **「取れなかった」と「1 本も無い」を同じ見た目にしない。**
    まとめて空扱いにすると、保存先が落ちている日に
    「まだブログを作っていない」と読まれ、作り直しに向かわせてしまう。
  */
  const sites = listed.ok ? listed.value.items : [];

  return (
    <AdminShell
      routeId="writing/template"
      title="共通の雛形"
      lead="全ブログが参照している、書き方の決めごとの元です。"
      actions={<TextLink href="/admin/sites">ブログを選ぶ</TextLink>}
    >
      <Callout
        tone="info"
        title="ここを直すと、全部のブログに効きます"
        reason="ブログごとの画面は、この雛形を参照して「特に外せない節」に印を付けているだけです。決めごと自体を複製していないので、雛形が古いブログは生まれません。"
      />

      <Section
        title={`型ごとの重み（${SITE_PATTERNS.length}種）`}
        lead="ブログの型が決まると、雛形のどこを強く見るかが自動で決まります。ブログごとに手で選ぶ欄はありません。"
      >
        <DataTable
          caption="ブログの型ごとに、特に外せない節とその理由"
          columns={[
            { key: "pattern", label: "ブログの型" },
            { key: "sections", label: "特に外せない節" },
            { key: "why", label: "なぜ" },
          ]}
          rows={SITE_PATTERNS.map((pattern) => ({
            key: pattern,
            cells: [
              SITE_PATTERN_LABEL[pattern],
              PATTERN_WRITING_EMPHASIS[pattern].emphasized.join("、"),
              PATTERN_WRITING_EMPHASIS[pattern].note,
            ],
          }))}
        />
        <Note>
          重みは印を足すだけで、欠かせない節を減らしません。型ごとに省けるようにすると、
          「この型では書かなくてよい」がブログ側の設定で作れてしまいます。
        </Note>
      </Section>

      <Section
        title="この雛形を使っているブログ"
        lead="それぞれのブログでどう見えるかは、ブログ側の画面で確かめます。"
      >
        {!listed.ok ? (
          <ErrorView
            title="ブログの一覧を出せませんでした"
            body={listed.error.message}
            suggestedAction={listed.error.suggestedAction ?? null}
            action={<TextLink href="/admin/sites">ブログの画面へ</TextLink>}
          />
        ) : sites.length === 0 ? (
          <EmptyView
            title="ブログがまだありません"
            body={listed.value.emptyReason ?? "ブログが登録されていません。"}
            action={<TextLink href="/admin/sites">ブログの画面へ</TextLink>}
          />
        ) : (
          <ListView
            rows={sites.map((site) => ({
              key: site.slug,
              label: `${site.name}（${site.patternLabel}）の書き方を見る`,
              href: `/admin/sites/${encodeURIComponent(site.slug)}/writing`,
            }))}
          />
        )}
      </Section>

      <Prose>
        ブログ 1 本だけ決めごとを変えたい場合は、この画面に欄を足すのではなく、
        ブログの型を見直します。型が足りないなら型を増やします。
      </Prose>
    </AdminShell>
  );
}
