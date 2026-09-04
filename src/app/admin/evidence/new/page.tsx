import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateEvidenceForm } from "@/presentation/admin/material/evidence-form";
import { evidenceTypeOptions } from "@/presentation/composition";
import { Callout, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 根拠を登録する画面。
 *
 * **一覧の中に登録欄を混ぜていない。** `/admin/evidence` は
 * 「出所の足りていない箇所をさがす」画面で、ここは「出所を 1 つ足す」画面。
 * 混ぜると、探しに来た人の目の前に常に空の入力欄が並ぶ。
 *
 * この画面には読み出しが 1 つも無い。既にある根拠を見せる必要が無く、
 * 見せると「似た資料が既にあるか」を人に確かめさせることになる。
 * 重なりは題名で後から見つけられるので、登録は登録だけにする。
 */
export default function NewEvidencePage() {
  return (
    <AdminShell
      routeId="evidence/new"
      title="根拠を登録する"
      lead="記事に書くことの出所になる資料を 1 つ登録します。"
      actions={<TextLink href="/admin/evidence">根拠へ戻る</TextLink>}
    >
      <Callout
        tone="info"
        title="登録できるのは出所のはっきりした資料だけです"
        reason="誰の情報かと、使ってよい条件を必ず書きます。後から下ろすことになった資料に支えられていた内容は、まとめて根拠なしへ落ちます。"
      />

      <Section
        title="この資料のこと"
        lead="登録すると番号が出ます。言えることを書くときに、その番号で指します。"
      >
        <CreateEvidenceForm
          types={evidenceTypeOptions().map((t) => ({ value: t.key, label: t.label }))}
        />
      </Section>
    </AdminShell>
  );
}
