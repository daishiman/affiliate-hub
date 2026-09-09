import {
  type SiteWritingMethod,
  cloneWritingMethodForSite,
} from "@/application/usecases/authoring/clone-writing-method-for-site";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { resolveSiteOrNotFound } from "@/presentation/admin/resolve-site";
import { currentActor, writingMethodUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  ErrorView,
  FactSourceBadge,
  type FactSource,
  FactList,
  ListView,
  Note,
  SeeAlso,
  Section,
  StepList,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 書き方の決めごと。
 *
 * 手引きを別の文書として書くと、コードの検査とずれる。
 * ずれると「手引きどおりに書いたのに公開前の検査で落ちる」が起きる。
 * この画面は、検査が実際に見ている定義をそのまま出している。
 *
 * **ブログごとに変わるのは重みだけ**である (A7)。節も文体の決まりも共通のまま、
 * このブログの型で特に外せない節に印を付ける。決めごとを丸ごと複製すると、
 * 10 本のブログで 10 通りの決まりができ、検査がどれを見るか決まらなくなる。
 */
export default async function SiteWritingPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly site: string }>;
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { site } = await params;
  const { siteSlug, siteName, pattern } = await resolveSiteOrNotFound(site);
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  const query = await searchParams;
  const actor = await currentActor();
  const result = await writingMethodUseCases().readMethod.execute(actor, {
    articleType: query.type,
  });

  return (
    <AdminShell
      routeId="sites/[site]/writing"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": siteName }}
      title="書き方の決めごと"
      lead="記事の型ごとの節の並びと、文章の決まりです。"
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="書き方の決めごとを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <WritingMethod
          method={cloneWritingMethodForSite(result.value, pattern)}
          sitePath={sitePath}
        />
      )}
    </AdminShell>
  );
}

function WritingMethod({
  method: m,
  sitePath,
}: {
  readonly method: SiteWritingMethod;
  readonly sitePath: string;
}) {
  return (
    <>
      <Callout
        tone="info"
        title="この画面と公開前の検査は同じ決めごとを見ています"
        reason="節の並びも文体の決まりも、コードの中の 1 つの定義から出しています。手引きを別に書くと、どちらかが古くなり「手引きどおりに書いたのに落ちる」が起きます。"
        action={<TextLink href="/admin/writing/template">共通の雛形を見る</TextLink>}
      />

      <Section title="記事の型">
        <ListView
          rows={m.types.map((t) =>
            t.key === m.articleType
              ? { key: t.key, label: `${t.label}（表示中）` }
              : { key: t.key, label: `${t.label}を見る`, href: `${sitePath}/writing?type=${t.key}` },
          )}
        />
        <Note>書き出し: {m.opening}</Note>
      </Section>

      <Section
        title={`${m.articleTypeLabel}の節（${m.sections.length}件・うち欠かせないもの ${m.requiredCount}件・このブログで特に見るもの ${m.emphasizedCount}件）`}
      >
        <DataTable
          caption="記事の型ごとの節と順序"
          columns={[
            { key: "label", label: "節" },
            { key: "order", label: "順", numeric: true },
            { key: "required", label: "欠かせないか" },
            { key: "emphasis", label: "このブログで特に" },
            { key: "purpose", label: "なぜ置くか" },
          ]}
          rows={m.sections.map((s, i) => ({
            key: s.id,
            cells: [
              s.label,
              i + 1,
              s.required ? "欠かせません" : "あるとよい",
              /*
                印の無い行を空欄にせず「—」にする。空欄だと、印が付かないのか
                まだ決めていないのかが読み分けられない。
              */
              s.emphasized ? "強く見ます" : "—",
              s.purpose,
            ],
          }))}
        />
        {/*
          **強調の説明は、強調の列の隣に置く。**
          画面の先頭に注意書きとして置くと、表を見るころには読み終えて忘れている。
          常時表示の注意書きは 1 画面 2 個までという上限もあり、
          「どこかに書いてある」より「見る物の隣に書いてある」を選ぶ。
        */}
        <Note>
          {m.patternLabel}のブログなので、{m.emphasizedCount}件に「強く見ます」が付いています。
          {m.emphasis.note} 決めごと自体は全ブログ共通で、変わるのは重みだけです。
        </Note>
      </Section>

      <Section
        title="段落の並べ方"
        lead="先に答えを言い、後から理由と根拠を出します。読み進めるかどうかを、読者が最初に決められるようにするためです。"
      >
        <StepList
          rows={m.paragraphOrder.map((p) => ({
            key: p.step,
            label: p.step,
            note: p.description,
          }))}
        />
      </Section>

      <Section title={`文体の決まり（${m.styleRules.length}件）`}>
        <DataTable
          caption="守る決まりと、その理由"
          columns={[
            { key: "rule", label: "決まり" },
            { key: "why", label: "なぜ" },
          ]}
          rows={m.styleRules.map((r) => ({ key: r.id, cells: [r.rule, r.why] }))}
        />
      </Section>

      <Section
        title="事実の種類ごとの書き分け"
        lead="メーカーの公表値と自分たちで測った値を同じ見た目で並べると、読者には区別がつきません。種類ごとに表示と語尾を変えます。"
      >
        <DataTable
          caption="事実の種類ごとの、記事での見え方と語尾"
          columns={[
            { key: "label", label: "種類" },
            { key: "badge", label: "記事での見え方" },
            { key: "allowed", label: "使ってよい語尾" },
            { key: "forbidden", label: "使わない語尾" },
          ]}
          rows={m.factRules.map((f) => ({
            key: f.kind,
            cells: [
              f.label,
              <FactSourceBadge key={f.kind} source={f.kind as FactSource} />,
              f.allowed.join(" / "),
              f.forbidden.join(" / "),
            ],
          }))}
        />
      </Section>

      <Section title="読者の知識量ごとの説明の深さ">
        <DataTable
          caption="読者の知識量ごとに、どこまで踏み込むか"
          columns={[
            { key: "level", label: "読者" },
            { key: "jargon", label: "専門用語" },
            { key: "numbers", label: "数字" },
            { key: "structure", label: "並べ方" },
          ]}
          rows={m.knowledgeGuide.map((g) => ({
            key: g.level,
            cells: [g.levelLabel, g.jargon, g.numbers, g.structure],
          }))}
        />
        <SeeAlso>
          <TextLink href={`${sitePath}/authors`}>このブログの書き手を見る</TextLink>
        </SeeAlso>
      </Section>

      <Section title="会話の決まり">
        <FactList
          rows={[
            {
              key: "length",
              label: "1 回の発言の長さ",
              value: `${m.conversation.minLength}〜${m.conversation.maxLength} 文字`,
            },
            {
              key: "consecutive",
              label: "続けてよい回数",
              value: `${m.conversation.maxConsecutive} 回まで（間に本文を入れます）`,
            },
            {
              key: "pattern",
              label: "基本の並び",
              value: m.conversation.basePattern.join(" → "),
            },
          ]}
        />
        <Callout tone="warn" title="会話だけに根拠を置きません" reason={m.conversation.rule} />
        <SeeAlso>
          <TextLink href="/admin/generation">生成の仕組みを見る</TextLink>
        </SeeAlso>
      </Section>
    </>
  );
}
