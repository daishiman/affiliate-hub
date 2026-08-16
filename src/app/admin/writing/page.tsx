import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, writingMethodUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  ErrorView,
  FactSourceBadge,
  type FactSource,
  Page,
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
        <h2 className={styles.sectionTitle}>記事の型</h2>
        <ul className={styles.linkList}>
          {m.types.map((t) => (
            <li key={t.key}>
              {t.key === m.articleType ? (
                <span>{t.label}（表示中）</span>
              ) : (
                <Link href={`/admin/writing?type=${t.key}`}>{t.label}を見る</Link>
              )}
            </li>
          ))}
        </ul>
        <p className={styles.linkNote}>書き出し: {m.opening}</p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>
          {m.articleTypeLabel}の節（{m.sections.length}件・うち欠かせないもの {m.requiredCount}件）
        </h2>
        <table className={styles.rankTable}>
          <caption>上から順に並べます。順番を入れ替えないでください。</caption>
          <thead>
            <tr>
              <th scope="col">順</th>
              <th scope="col">節</th>
              <th scope="col">欠かせないか</th>
              <th scope="col">なぜ置くか</th>
            </tr>
          </thead>
          <tbody>
            {m.sections.map((s, i) => (
              <tr key={s.id}>
                <td className={styles.numeric}>{i + 1}</td>
                <th scope="row">{s.label}</th>
                <td>{s.required ? "欠かせません" : "あるとよい"}</td>
                <td>{s.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>段落の並べ方</h2>
        <p className={styles.sectionLead}>
          先に答えを言い、後から理由と根拠を出します。読み進めるかどうかを、読者が最初に決められるようにするためです。
        </p>
        <ol className={styles.linkList}>
          {m.paragraphOrder.map((p) => (
            <li key={p.step}>
              {p.step}
              <span className={styles.linkNote}>{p.description}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>文体の決まり（{m.styleRules.length}件）</h2>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">決まり</th>
              <th scope="col">なぜ</th>
            </tr>
          </thead>
          <tbody>
            {m.styleRules.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.rule}</th>
                <td>{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>事実の種類ごとの書き分け</h2>
        <p className={styles.sectionLead}>
          メーカーの公表値と自分たちで測った値を同じ見た目で並べると、読者には区別がつきません。種類ごとに表示と語尾を変えます。
        </p>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">種類</th>
              <th scope="col">記事での見え方</th>
              <th scope="col">使ってよい語尾</th>
              <th scope="col">使わない語尾</th>
            </tr>
          </thead>
          <tbody>
            {m.factRules.map((f) => (
              <tr key={f.kind}>
                <th scope="row">{f.label}</th>
                <td>
                  <FactSourceBadge source={f.kind as FactSource} />
                </td>
                <td>{f.allowed.join(" / ")}</td>
                <td>{f.forbidden.join(" / ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>読者の知識量ごとの説明の深さ</h2>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">読者</th>
              <th scope="col">専門用語</th>
              <th scope="col">数字</th>
              <th scope="col">並べ方</th>
            </tr>
          </thead>
          <tbody>
            {m.knowledgeGuide.map((g) => (
              <tr key={g.level}>
                <th scope="row">{g.levelLabel}</th>
                <td>{g.jargon}</td>
                <td>{g.numbers}</td>
                <td>{g.structure}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.linkNote}>
          <Link href="/admin/personas">書き手と読者像を見る</Link>
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>会話の決まり</h2>
        <table className={styles.rankTable}>
          <tbody>
            <tr>
              <th scope="row">1 回の発言の長さ</th>
              <td>
                {m.conversation.minLength}〜{m.conversation.maxLength} 文字
              </td>
            </tr>
            <tr>
              <th scope="row">続けてよい回数</th>
              <td>{m.conversation.maxConsecutive} 回まで（間に本文を入れます）</td>
            </tr>
            <tr>
              <th scope="row">基本の並び</th>
              <td>{m.conversation.basePattern.join(" → ")}</td>
            </tr>
          </tbody>
        </table>
        <Callout tone="warn" title="会話だけに根拠を置きません" reason={m.conversation.rule} />
        <p className={styles.linkNote}>
          <Link href="/admin/generation">生成の仕組みを見る</Link>
        </p>
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
