import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, generationUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  ErrorView,
  ListView,
  Note,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 指示文の組み立て。
 *
 * `/admin/generation` から移出した。塊の順番と、それぞれが
 * 「入れてはならないもの」を並べる。**版を書き換えない**という決まりが
 * この画面の中心で、書き換えると過去に出した記事をどの指示で書いたか追えなくなる。
 *
 * 受け取りの形（返答の項目）も一緒に置いた。渡し方と受け取り方は
 * 同じ 1 つの取り決めで、片方だけ直すと必ずずれる。
 */
export default async function GenerationPromptPage() {
  const actor = await currentActor();
  const plan = await (await generationUseCases()).readPlan.execute(actor, {});

  return (
    <AdminShell
      routeId="generation/prompt"
      title="指示文の組み立て"
      lead="塊の順番と、受け取る形。"
      actions={<TextLink href="/admin/generation">生成の仕組みへ戻る</TextLink>}
    >
      {!plan.ok ? (
        <ErrorView
          title="指示文の組み立てを出せませんでした"
          body={plan.error.message}
          suggestedAction={plan.error.suggestedAction ?? null}
          action={<TextLink href="/admin/generation">生成の仕組みへ戻る</TextLink>}
        />
      ) : (
        <>
          {plan.value.breaches.length === 0 ? null : (
            <Callout
              tone="warn"
              title="決まりが崩れています"
              reason={plan.value.breaches.join(" / ")}
            />
          )}

          <Section
            title={`塊の順番（${plan.value.blocks.length}つ・${plan.value.promptVersion}）`}
            lead="順番も内容も固定します。1 文字でも変えるときは新しい版を作ります。"
          >
            <Prose>
              いまの版は書き換えません。書き換えると、過去に出した記事をどの指示で書いたか追えなくなります。
            </Prose>
            <DataTable
              caption={`指示文の塊（${plan.value.promptVersion}）`}
              columns={[
                { key: "order", label: "順", numeric: true },
                { key: "label", label: "塊" },
                { key: "role", label: "担うこと" },
                { key: "mustNot", label: "入れてはならないもの" },
              ]}
              rows={plan.value.blocks.map((b) => ({
                key: b.id,
                cells: [b.order, b.label, b.role, b.mustNotContain],
              }))}
            />
          </Section>

          <Section
            title={`受け取りの形（${plan.value.outputFields.length}項目）`}
            lead="決めた形で返らない返答は受け取りません。"
          >
            <Prose>
              形が合わないときは {plan.value.maxSchemaRetries}{" "}
              回までやり直し、それでも合わなければ失敗として残します。成功したことにはしません。
            </Prose>
            <Prose>
              {plan.value.selfReportedFields.join("・")}{" "}
              は書いた側の自己申告です。自分の答案に自分で点を付けたものなので、公開してよいかの判断には使いません。判断は品質検査と確かめ役の結果で行います。
            </Prose>
            <ListView
              rows={plan.value.outputFields.map((f) => ({ key: f, label: f }))}
            />
            <Note>
              何を渡すかは{" "}
              <TextLink href="/admin/generation/inputs">渡す項目</TextLink> にあります。
            </Note>
          </Section>
        </>
      )}
    </AdminShell>
  );
}
