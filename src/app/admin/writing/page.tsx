import { AdminShell } from "@/presentation/admin/admin-shell";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
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
 */
export default async function WritingPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const actor = await currentActor();
  const result = await writingMethodUseCases().readMethod.execute(actor, {
    articleType: params.type,
  });

  return (
    <AdminShell
      routeId="writing"
      title="書き方の決めごと"
      lead="記事の型ごとの節の並びと、文章の決まりです。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="書き方の決めごとを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <WritingMethod method={result.value} />
      )}
    </AdminShell>
  );
}

type Method = SuccessOf<
  ReturnType<ReturnType<typeof writingMethodUseCases>["readMethod"]["execute"]>
>;

function WritingMethod({ method: m }: { readonly method: Method }) {
  return (
    <>
      <Callout
        tone="info"
        title="この画面と公開前の検査は同じ決めごとを見ています"
        reason="節の並びも文体の決まりも、コードの中の 1 つの定義から出しています。手引きを別に書くと、どちらかが古くなり「手引きどおりに書いたのに落ちる」が起きます。"
      />

      <Section title="記事の型">
        <ListView
          rows={m.types.map((t) =>
            t.key === m.articleType
              ? { key: t.key, label: `${t.label}（表示中）` }
              : { key: t.key, label: `${t.label}を見る`, href: `/admin/writing?type=${t.key}` },
          )}
        />
        <Note>書き出し: {m.opening}</Note>
      </Section>

      <Section
        title={`${m.articleTypeLabel}の節（${m.sections.length}件・うち欠かせないもの ${m.requiredCount}件）`}
      >
        <DataTable
          caption="記事の型ごとの節と順序"
          columns={[
            { key: "label", label: "節" },
            { key: "order", label: "順", numeric: true },
            { key: "required", label: "欠かせないか" },
            { key: "purpose", label: "なぜ置くか" },
          ]}
          rows={m.sections.map((s, i) => ({
            key: s.id,
            cells: [s.label, i + 1, s.required ? "欠かせません" : "あるとよい", s.purpose],
          }))}
        />
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
          <TextLink href="/admin/personas">書き手と読者像を見る</TextLink>
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
