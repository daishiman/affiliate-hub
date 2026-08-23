import {
  MODEL_CHOICE_SEPARATOR,
  selectModelFromRows,
} from "@/application/usecases/generation/list-selectable-models";
import { AdminShell } from "@/presentation/admin/admin-shell";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import {
  currentActor,
  generationUseCases,
  sampleGenerationInputForTrial,
} from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ListView,
  ModelPicker,
  Note,
  Prose,
  Row,
  Section,
  StubNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 生成の仕組み。
 *
 * 「AI がどう書くか」を見せる画面ではない。
 * **何を渡し、何を渡さず、どこから先は人が決めるか**を見せる。
 *
 * この画面が無いと、出てきた文章を信じてよいかを人が判断できない。
 * 「AI が書きました」だけでは、素材に無いことが混ざったかどうかを確かめようがない。
 */
export default async function GenerationPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  // 「そろっていない状態」と「そろった状態」のどちらで試したか。
  const trial = params.trial === "ready" ? "ready" : params.trial === "empty" ? "empty" : null;
  // 画面で選ばれたモデル。**ここではまだ「文字列が届いた」だけである。**
  const modelChoice = params.model ?? "";

  const actor = await currentActor();
  const uc = await generationUseCases();

  const models = await uc.listModels.execute(actor, {});
  const modelRows = models.ok ? models.value.rows : [];
  /**
   * 届いた文字列を、選ばれたモデルへ直す。
   *
   * **一覧に無ければ `null` のまま渡す。** URL は誰でも書けるので、
   * 届いた値をそのままモデルの指定として使うと、目録に無い名前で
   * 呼び出しに行ける。選ばれていないものは、選ばれていないまま渡す。
   */
  const model = modelChoice === "" ? null : selectModelFromRows(modelRows, modelChoice);
  const modelChoiceRejected = modelChoice !== "" && model === null;

  const [plan, draft] = await Promise.all([
    uc.readPlan.execute(actor, {}),
    trial === null
      ? Promise.resolve(null)
      : uc.draft.execute(actor, {
          provided: trial === "ready" ? sampleGenerationInputForTrial() : {},
          model,
        }),
  ]);

  return (
    <AdminShell
      routeId="generation"
      title="生成の仕組み"
      lead="どこから先を人が決めるか。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      {!plan.ok ? (
        <ErrorView
          title="生成の仕組みを出せませんでした"
          body={plan.error.message}
          suggestedAction={plan.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          {/*
            画面の性質そのものなので、告知の枠を外して本文にした。
            枠付きの告知は「いま何かが起きている」と読める。
            いつ来ても同じことが書いてある物は、枠に入れると告知が信用されなくなる。
          */}
          <Prose>
            承認済みの商品・主張・根拠・書き手・読者を渡して書かせます。
            段階ごとに、次へ進めるのが担当者か AI かが決まっています。
          </Prose>

          {plan.value.breaches.length > 0 && (
            <Callout
              tone="warn"
              title="決まりが崩れています"
              reason={plan.value.breaches.join(" / ")}
            />
          )}

          <GenerationPlan plan={plan.value} />

          <Section
            title="下書きを作らせてみる"
            lead="実際に押して確かめられます。先にモデルを選んでください。"
          >
            <Prose>
              必ず要る 17 項目がそろっていない状態では、何が足りないかを返して始めません。
              そろった状態で押すと、選んだモデルで下書きを 1 本作ります。
              既定のモデルは置いていません（置くと、選んだ覚えのないモデルで書かれた記事が、選んで書いたものと同じ形で残ります）。
            </Prose>

            {!models.ok ? (
              <ErrorView
                title="選べるモデルを出せませんでした"
                body={models.error.message}
                suggestedAction={models.error.suggestedAction ?? null}
              />
            ) : (
              <ModelPicker
                action="/admin/generation"
                fieldName="model"
                separator={MODEL_CHOICE_SEPARATOR}
                groups={models.value.rows}
                selected={model === null ? "" : modelChoice}
                emptyReason={models.value.emptyReason}
                hiddenFields={trial === null ? [] : [{ name: "trial", value: trial }]}
                submitLabel="このモデルを選ぶ"
              />
            )}

            {modelChoiceRejected && (
              <ActionNote tone="danger">
                いま選べる一覧に無い組み合わせが届いたため、選ばれていないものとして扱いました。上の欄から選び直してください。
              </ActionNote>
            )}

            <Row>
              <TextLink href={trialHref("empty", modelChoice)}>
                そろっていない状態で試す
              </TextLink>
              <TextLink href={trialHref("ready", modelChoice)}>
                そろった状態（見本の素材）で試す
              </TextLink>
              {trial === null ? null : (
                <TextLink href="/admin/generation">結果を消す</TextLink>
              )}
            </Row>

            {trial === "ready" && (
              <StubNotice
                what="ここで渡している 18 項目の素材"
                blockedBy="商品・主張・根拠の各画面で承認した素材を組み立てて渡すようにすること"
                stubId="generation:sample-input"
              />
            )}

            {draft === null ? (
              <EmptyView
                title="まだ試していません"
                body="上のどちらかを押すと、その場で結果が出ます。作った下書きは保存しません。"
              />
            ) : draft.ok ? (
              <>
                <ActionNote>
                  下書きができました（{draft.value.modelId}・{draft.value.promptVersion}）。見積り{" "}
                  {draft.value.estimatedCostMinor} {draft.value.currency}。
                  この画面では保存しません。保存と公開は担当者が別の操作で行います。
                </ActionNote>
                <ListView
                  rows={draft.value.instructionBlocks.map((b) => ({
                    key: b.id,
                    label: `${b.label}（${b.charCount} 文字）`,
                  }))}
                />
              </>
            ) : (
              <ErrorView
                title="下書きは作られませんでした"
                body={draft.error.message}
                suggestedAction={draft.error.suggestedAction ?? null}
                action={<TextLink href="/admin/generation">結果を消す</TextLink>}
              />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}

/**
 * 試す入口の行き先。
 *
 * **選んだモデルを持ち回る。** 落とすと、押すたびに選び直しになり、
 * そのうち誰かが「初期値を入れよう」と言い出す。
 */
function trialHref(trial: "empty" | "ready", modelChoice: string): string {
  const query = new URLSearchParams({ trial });
  if (modelChoice !== "") query.set("model", modelChoice);
  return `/admin/generation?${query.toString()}`;
}

type Plan = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof generationUseCases>>["readPlan"]["execute"]>
>;

function GenerationPlan({ plan: p }: { readonly plan: Plan }) {
  return (
    <>
      <Section title="渡す物と渡し方">
        {/*
          渡す物と渡し方は、それぞれ 1 枚の画面に移した。
          ここへ残したのは「**誰が次へ進めるか**」の側で、
          素材の過不足を確かめに来た人と、判断の境目を確かめに来た人は別人である。
        */}
        <ListView
          rows={[
            {
              key: "inputs",
              label: `渡す項目（${p.inputs.length}件）`,
              href: "/admin/generation/inputs",
              note: "AI に渡す素材と、その過不足。",
            },
            {
              key: "prompt",
              label: `指示文の組み立て（${p.promptVersion}）`,
              href: "/admin/generation/prompt",
              note: "塊の順番と、受け取る形。",
            },
          ]}
        />
      </Section>

      <Section title={`手順（${p.skills.length}件）`}>
        <DataTable
          caption="手順ごとの、やることと動かす条件と担う役"
          columns={[
            { key: "skill", label: "手順" },
            { key: "responsibility", label: "やること" },
            { key: "startsWhen", label: "動かす条件" },
            { key: "agent", label: "担う役" },
          ]}
          rows={p.skills.map((s) => ({
            key: s.id,
            cells: [s.label, s.responsibility, s.startsWhen, s.agentLabel],
          }))}
        />
      </Section>

      <Section
        title={`役の分け方（${p.agents.length}件）`}
        lead="書いた役に、自分の書いたものを確かめさせません。"
      >
        <DataTable
          caption="役ごとの、やること・やらないことと、持っている道具"
          columns={[
            { key: "agent", label: "役" },
            { key: "kind", label: "区分" },
            { key: "responsibility", label: "やること" },
            { key: "mustNot", label: "やらないこと" },
            { key: "canGenerate", label: "書く道具" },
            { key: "freshContext", label: "前のやり取り" },
          ]}
          rows={p.agents.map((a) => ({
            key: a.id,
            cells: [
              a.label,
              a.kindLabel,
              a.responsibility,
              a.mustNot,
              a.canGenerate ? "持ちます" : "持ちません",
              a.freshContext ? "引き継ぎません" : "引き継ぎます",
            ],
          }))}
        />
        <Note>
          指摘を受けて書き直すのは {p.maxRevisionRounds}{" "}
          回まで。それで片づかないものは、片づいたことにせず担当者へ回します。
        </Note>
      </Section>

      <Section title="どこから先が人の判断か">
        <DataTable
          caption="段階ごとの、次へ進める人と、その理由"
          columns={[
            { key: "stage", label: "段階" },
            { key: "by", label: "次へ進めるのは" },
            { key: "why", label: "理由" },
            { key: "skills", label: "動く手順" },
          ]}
          rows={p.stages.map((s) => ({
            key: s.state,
            cells: [
              s.label,
              s.advancedBy === "human" ? "担当者" : "AI",
              s.why,
              s.skillLabels.length === 0 ? "—" : s.skillLabels.join("・"),
            ],
          }))}
        />
        <Note>
          <TextLink href="/admin/content">記事の進行を見る</TextLink>
        </Note>
      </Section>
    </>
  );
}
