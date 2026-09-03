import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, generationUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  MaterialReview,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 渡す項目。
 *
 * `/admin/generation` から移出した。ここに集めたのは「**素材の側**」で、
 * 何を渡すか・いま何がそろっているか・外から取った文章を渡してよいか、
 * という 1 つの問いの 3 つの面である。
 *
 * 指示文の組み立て（`/admin/generation/prompt`）と分けたのは、
 * あちらが「渡し方」の話で、直す人も直す理由も違うため。
 */
export default async function GenerationInputsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const material = params.material ?? "";

  const actor = await currentActor();
  const uc = await generationUseCases();

  const [plan, readiness, review] = await Promise.all([
    uc.readPlan.execute(actor, {}),
    // 何も渡していない状態を出す。「そろわないと始められない」ことを実物で示す。
    uc.checkInput.execute(actor, {}),
    material === "" ? Promise.resolve(null) : uc.reviewMaterial.execute(actor, { text: material }),
  ]);

  return (
    <AdminShell
      routeId="generation/inputs"
      title="渡す項目"
      lead="AI に渡す素材と、その過不足。"
      actions={<TextLink href="/admin/generation">生成の仕組みへ戻る</TextLink>}
    >
      {!plan.ok ? (
        <ErrorView
          title="渡す項目を出せませんでした"
          body={plan.error.message}
          suggestedAction={plan.error.suggestedAction ?? null}
          action={<TextLink href="/admin/generation">生成の仕組みへ戻る</TextLink>}
        />
      ) : (
        <>
          <Section
            title={`渡す項目（${plan.value.inputs.length}件）`}
            lead="渡していない項目があるあいだは生成を始められません。"
          >
            <Prose>
              足りない分を AI に補わせると、素材に無いことがどこから来たのか追えなくなります。
            </Prose>
            {readiness.ok && readiness.value.blockedReason !== null ? (
              <Callout
                tone="warn"
                title="いまは生成を始められません"
                reason={readiness.value.blockedReason}
              />
            ) : null}
            <DataTable
              caption={`そろっている項目: ${readiness.ok ? readiness.value.filled : 0} / ${plan.value.inputs.length}`}
              columns={[
                { key: "label", label: "項目" },
                { key: "why", label: "なぜ人が決めるか" },
                { key: "optional", label: "空にできる場合" },
              ]}
              rows={plan.value.inputs.map((f) => ({
                key: f.key,
                cells: [
                  f.addedByDesign ? `${f.label}（設計で追加した項目）` : f.label,
                  f.why,
                  f.optionalWhen ?? "空にできません",
                ],
              }))}
            />
          </Section>

          <Section
            title="取り込んだ文章の確認"
            lead="外から取った文章は、渡す前にここで確かめます。"
          >
            <Prose>
              文章の中に「これまでの指示を無視して」と書いておけば、こちらの決まりを上書きできてしまいます。
            </Prose>
            {review !== null && !review.ok ? (
              <ErrorView
                title="確かめられませんでした"
                body={review.error.message}
                suggestedAction={review.error.suggestedAction ?? null}
              />
            ) : (
              <MaterialReview
                action="/admin/generation/inputs"
                fieldName="material"
                value={material}
                accepted={review === null || !review.ok ? null : review.value.accepted}
                heldReason={review !== null && review.ok ? review.value.heldReason : null}
                findings={review !== null && review.ok ? review.value.findings : []}
                whatHappensNext={review !== null && review.ok ? review.value.whatHappensNext : null}
              />
            )}
            {material === "" ? (
              <EmptyView
                title="まだ何も貼られていません"
                body="確かめたい文章を上の欄に貼って「確かめる」を押してください。"
              />
            ) : null}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
