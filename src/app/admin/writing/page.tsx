import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, writingMethodUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  ErrorView,
  FactSourceBadge,
  Note,
  Page,
  SectionHeading,
  SeeAlso,
  StackedList,
  StackedRow,
  type FactSource,
} from "@/presentation/ui";
import styles from "../admin.module.css";

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

  if (!result.ok) {
    return (
      <Shell>
        <ErrorView
          title="書き方の決めごとを出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const m = result.value;

  return (
    <Shell>
      <Callout
        tone="info"
        title="この画面と公開前の検査は同じ決めごとを見ています"
        reason="節の並びも文体の決まりも、コードの中の 1 つの定義から出しています。手引きを別に書くと、どちらかが古くなり「手引きどおりに書いたのに落ちる」が起きます。"
      />

      <Card>
        <SectionHeading level={2}>記事の型</SectionHeading>
        <StackedList>
          {m.types.map((t) => (
            <StackedRow key={t.key}>
              {t.key === m.articleType ? (
                <span>{t.label}（表示中）</span>
              ) : (
                <Link href={`/admin/writing?type=${t.key}`}>{t.label}を見る</Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
        <Note>書き出し: {m.opening}</Note>
      </Card>

      <Card>
        <SectionHeading level={2}>
          {m.articleTypeLabel}の節（{m.sections.length}件・うち欠かせないもの {m.requiredCount}件）
        </SectionHeading>
        {/* 元の `caption` は「順番を入れ替えないでください」という指示だった。
            caption は何の表かを言う場所なので、指示は本文（この段落）へ移した。
            指示を caption に置くと、表を読み上げたときに名前の代わりに出る。 */}
        <p className={styles.sectionLead}>上から順に並べます。順番を入れ替えないでください。</p>
        <DataTable
          caption={`${m.articleTypeLabel}に置く節を、記事に出る順に並べたもの`}
          columns={[
            { key: "order", header: "順", align: "numeric", cell: (s) => s.order },
            { key: "label", header: "節", rowHeader: true, cell: (s) => s.label },
            {
              key: "required",
              header: "欠かせないか",
              cell: (s) => (s.required ? "欠かせません" : "あるとよい"),
            },
            { key: "purpose", header: "なぜ置くか", cell: (s) => s.purpose },
          ]}
          // 順番はこの表の中身そのものなので、行に持たせてから渡す。
          rows={m.sections.map((s, i) => ({ ...s, order: i + 1 }))}
          rowKey={(s) => s.id}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>段落の並べ方</SectionHeading>
        <p className={styles.sectionLead}>
          先に答えを言い、後から理由と根拠を出します。読み進めるかどうかを、読者が最初に決められるようにするためです。
        </p>
        <StackedList ordered>
          {m.paragraphOrder.map((p) => (
            <StackedRow key={p.step} note={p.description}>
              {p.step}
              
            </StackedRow>
          ))}
        </StackedList>
      </Card>

      <Card>
        <SectionHeading level={2}>文体の決まり（{m.styleRules.length}件）</SectionHeading>
        <DataTable
          caption="文体の決まりと、それを置いている理由"
          columns={[
            { key: "rule", header: "決まり", rowHeader: true, cell: (r) => r.rule },
            { key: "why", header: "なぜ", cell: (r) => r.why },
          ]}
          rows={m.styleRules}
          rowKey={(r) => r.id}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>事実の種類ごとの書き分け</SectionHeading>
        <p className={styles.sectionLead}>
          メーカーの公表値と自分たちで測った値を同じ見た目で並べると、読者には区別がつきません。種類ごとに表示と語尾を変えます。
        </p>
        <DataTable
          caption="事実の種類ごとに決まっている、記事での見え方と語尾"
          columns={[
            { key: "label", header: "種類", rowHeader: true, cell: (f) => f.label },
            {
              key: "badge",
              header: "記事での見え方",
              cell: (f) => <FactSourceBadge source={f.kind as FactSource} />,
            },
            { key: "allowed", header: "使ってよい語尾", cell: (f) => f.allowed.join(" / ") },
            { key: "forbidden", header: "使わない語尾", cell: (f) => f.forbidden.join(" / ") },
          ]}
          rows={m.factRules}
          rowKey={(f) => f.kind}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>読者の知識量ごとの説明の深さ</SectionHeading>
        <DataTable
          caption="読者の知識量ごとに変える、説明の深さ"
          columns={[
            { key: "level", header: "読者", rowHeader: true, cell: (g) => g.levelLabel },
            { key: "jargon", header: "専門用語", cell: (g) => g.jargon },
            // 「数字」は数字そのものではなく数字の扱い方の説明なので、右寄せにしない。
            { key: "numbers", header: "数字", cell: (g) => g.numbers },
            { key: "structure", header: "並べ方", cell: (g) => g.structure },
          ]}
          rows={m.knowledgeGuide}
          rowKey={(g) => g.level}
        />
        <SeeAlso>
          <Link href="/admin/personas">書き手と読者像を見る</Link>
        </SeeAlso>
      </Card>

      <Card>
        <SectionHeading level={2}>会話の決まり</SectionHeading>
        {/*
          **これは表ではなかった。**以前ここは `<table className={styles.rankTable}>` で、
          `<thead>` を持たない「項目と値の対」だった。列に名前が付く表ではないので、
          `DataTable` へ通そうとすると「項目 / 値」という中身の無い見出しを
          発明することになる。同じ中身は管理画面の 22 箇所で既に `<dl>` で
          書かれていて、そちらが多数派だった。その 27 箇所（この 5 件を含む）は
          同じ日に `DefinitionList` へ上げてある（残課題 142）。
        */}
        <DefinitionList
          items={[
            {
              term: "1 回の発言の長さ",
              description: `${m.conversation.minLength}〜${m.conversation.maxLength} 文字`,
            },
            {
              term: "続けてよい回数",
              description: `${m.conversation.maxConsecutive} 回まで（間に本文を入れます）`,
            },
            { term: "基本の並び", description: m.conversation.basePattern.join(" → ") },
          ]}
        />
        <Callout tone="warn" title="会話だけに根拠を置きません" reason={m.conversation.rule} />
        <SeeAlso>
          <Link href="/admin/generation">生成の仕組みを見る</Link>
        </SeeAlso>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/writing"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "書き方の決めごと" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="書き方の決めごと"
        lead="記事の型ごとの節の並び、段落の順序、文体、事実の書き分け、会話の決まりをまとめた画面です。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
