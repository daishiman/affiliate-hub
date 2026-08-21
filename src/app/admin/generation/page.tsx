import Link from "next/link";
import type { ReactNode } from "react";
import {
  currentActor,
  generationUseCases,
  sampleGenerationInputForTrial,
} from "@/presentation/composition";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  Callout,
  Card,
  DataTable,
  EmptyView,
  ErrorView,
  MaterialReview,
  ModelPicker,
  Note,
  Page,
  SectionHeading,
  SeeAlso,
  StackedList,
  StackedRow,
  StubNotice,
} from "@/presentation/ui";
import {
  MODEL_CHOICE_SEPARATOR,
  selectModelFromRows,
} from "@/application/usecases/generation/list-selectable-models";
import styles from "../admin.module.css";

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
  const material = params.material ?? "";
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

  const [plan, readiness, review, draft] = await Promise.all([
    uc.readPlan.execute(actor, {}),
    // 何も渡していない状態を出す。「そろわないと始められない」ことを実物で示す。
    uc.checkInput.execute(actor, {}),
    material === ""
      ? Promise.resolve(null)
      : uc.reviewMaterial.execute(actor, { text: material }),
    trial === null
      ? Promise.resolve(null)
      : uc.draft.execute(actor, {
          provided: trial === "ready" ? sampleGenerationInputForTrial() : {},
          model,
        }),
  ]);

  if (!plan.ok) {
    return (
      <Shell>
        <ErrorView
          title="生成の仕組みを出せませんでした"
          body={plan.error.message}
          suggestedAction={plan.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const p = plan.value;

  return (
    <Shell>
      <Callout
        tone="info"
        title="AI に自由に書かせません"
        reason="承認済みの商品・主張・根拠・書き手・読者を渡して書かせます。渡していない項目があるあいだは生成を始められません。足りない分を AI に補わせると、素材に無いことがどこから来たのか追えなくなります。"
      />

      {p.breaches.length > 0 && (
        <Callout
          tone="warn"
          title="決まりが崩れています"
          reason={p.breaches.join(" / ")}
        />
      )}

      <Card>
        <SectionHeading level={2}>渡す項目（{p.inputs.length}件）</SectionHeading>
        {readiness.ok && readiness.value.blockedReason !== null && (
          <Callout tone="warn" title="いまは生成を始められません" reason={readiness.value.blockedReason} />
        )}
        <DataTable
          caption={`人が決める項目。そろっている項目: ${readiness.ok ? readiness.value.filled : 0} / ${p.inputs.length}`}
          columns={[
            {
              key: "label",
              header: "項目",
              rowHeader: true,
              cell: (f) => (
                <>
                  {f.label}
                  {f.addedByDesign && (
                    <span className={styles.linkNote}>（設計で追加した項目）</span>
                  )}
                </>
              ),
            },
            { key: "why", header: "なぜ人が決めるか", cell: (f) => f.why },
            {
              key: "optionalWhen",
              header: "空にできる場合",
              cell: (f) => f.optionalWhen ?? "空にできません",
            },
          ]}
          rows={p.inputs}
          rowKey={(f) => f.key}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>指示文の組み立て（{p.blocks.length}つの塊・{p.promptVersion}）</SectionHeading>
        <p className={styles.sectionLead}>
          順番も内容も固定します。1 文字でも変えるときは新しい版を作り、いまの版は書き換えません。書き換えると、過去に出した記事をどの指示で書いたか追えなくなります。
        </p>
        <DataTable
          caption="指示文を組み立てる塊。順番も内容も固定してある。"
          columns={[
            { key: "order", header: "順", align: "numeric", cell: (b) => b.order },
            { key: "label", header: "塊", rowHeader: true, cell: (b) => b.label },
            { key: "role", header: "担うこと", cell: (b) => b.role },
            { key: "mustNot", header: "入れてはならないもの", cell: (b) => b.mustNotContain },
          ]}
          rows={p.blocks}
          rowKey={(b) => b.id}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>手順（{p.skills.length}件）</SectionHeading>
        <DataTable
          caption="記事ができるまでに動く手順と、それぞれを担う役。"
          columns={[
            { key: "label", header: "手順", rowHeader: true, cell: (s) => s.label },
            { key: "responsibility", header: "やること", cell: (s) => s.responsibility },
            { key: "startsWhen", header: "動かす条件", cell: (s) => s.startsWhen },
            { key: "agent", header: "担う役", cell: (s) => s.agentLabel },
          ]}
          rows={p.skills}
          rowKey={(s) => s.id}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>役の分け方（{p.agents.length}件）</SectionHeading>
        <p className={styles.sectionLead}>
          書いた役に、自分の書いたものを確かめさせません。確かめる役は書く道具を持たず、書いたときのやり取りも引き継ぎません。
        </p>
        <DataTable
          caption="役の分け方。書く役と確かめる役が持てる道具の違いも並べる。"
          columns={[
            { key: "label", header: "役", rowHeader: true, cell: (a) => a.label },
            { key: "kind", header: "区分", cell: (a) => a.kindLabel },
            { key: "responsibility", header: "やること", cell: (a) => a.responsibility },
            { key: "mustNot", header: "やらないこと", cell: (a) => a.mustNot },
            {
              key: "canGenerate",
              header: "書く道具",
              cell: (a) => (a.canGenerate ? "持ちます" : "持ちません"),
            },
            {
              key: "freshContext",
              header: "前のやり取り",
              cell: (a) => (a.freshContext ? "引き継ぎません" : "引き継ぎます"),
            },
          ]}
          rows={p.agents}
          rowKey={(a) => a.id}
        />
        <Note>
          指摘を受けて書き直すのは {p.maxRevisionRounds} 回まで。それで片づかないものは、片づいたことにせず担当者へ回します。
        </Note>
      </Card>

      <Card>
        <SectionHeading level={2}>どこから先が人の判断か</SectionHeading>
        <DataTable
          caption="段階ごとに、次へ進める判断を人と AI のどちらが持つか。"
          columns={[
            { key: "label", header: "段階", rowHeader: true, cell: (s) => s.label },
            {
              key: "advancedBy",
              header: "次へ進めるのは",
              cell: (s) => (s.advancedBy === "human" ? "担当者" : "AI"),
            },
            { key: "why", header: "理由", cell: (s) => s.why },
            {
              key: "skills",
              header: "動く手順",
              cell: (s) => (s.skillLabels.length === 0 ? "—" : s.skillLabels.join("・")),
            },
          ]}
          rows={p.stages}
          rowKey={(s) => s.state}
        />
        <SeeAlso>
          <Link href="/admin/content">記事の進行を見る</Link>
        </SeeAlso>
      </Card>

      <Card>
        <SectionHeading level={2}>受け取りの形（{p.outputFields.length}項目）</SectionHeading>
        <p className={styles.sectionLead}>
          決めた形で返らない返答は受け取りません。形が合わないときは {p.maxSchemaRetries}{" "}
          回までやり直し、それでも合わなければ失敗として残します。成功したことにはしません。
        </p>
        <Callout
          tone="warn"
          title="AI が自分で付けた点数は合否に使いません"
          reason={`${p.selfReportedFields.join("・")} は書いた側の自己申告です。自分の答案に自分で点を付けたものなので、公開してよいかの判断には使いません。判断は品質検査と確かめ役の結果で行います。`}
        />
        <StackedList>
          {p.outputFields.map((f) => (
            <StackedRow key={f}>{f}</StackedRow>
          ))}
        </StackedList>
      </Card>

      <Card>
        <SectionHeading level={2}>下書きを作らせてみる</SectionHeading>
        <p className={styles.sectionLead}>
          実際に押して確かめられます。必ず要る 17
          項目（上の表のうち「順位の決め方」以外）がそろっていない状態では、何が足りないかを返して始めません。
          そろった状態で押すと、選んだモデルで下書きを 1 本作ります。
          <strong>先にどのモデルで書くかを選んでください。</strong>
          既定のモデルは置いていません（置くと、選んだ覚えのないモデルで書かれた記事が、選んで書いたものと同じ形で残ります）。
        </p>

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
          <Callout
            tone="warn"
            title="選ばれたモデルは一覧にありません"
            reason="いま選べるモデルの一覧に無い組み合わせが届いたため、選ばれていないものとして扱いました。上の欄から選び直してください（鍵を失効させた直後や、目録から外れたモデルを開いたままだったときに起きます）。"
          />
        )}

        <p className={styles.linkList}>
          <Link href={trialHref("empty", modelChoice)}>そろっていない状態で試す</Link>
          {" ／ "}
          <Link href={trialHref("ready", modelChoice)}>そろった状態（見本の素材）で試す</Link>
          {trial !== null && (
            <>
              {" ／ "}
              <Link href="/admin/generation">結果を消す</Link>
            </>
          )}
        </p>

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
            <Callout
              tone="info"
              title={`下書きができました（${draft.value.modelId}・${draft.value.promptVersion}）`}
              reason={`見積り ${draft.value.estimatedCostMinor} ${draft.value.currency}。この画面では保存しません。保存と公開は担当者が別の操作で行います。`}
            />
            <StackedList>
              {draft.value.instructionBlocks.map((b) => (
                <StackedRow key={b.id}>
                  {b.label}（{b.charCount} 文字）
                </StackedRow>
              ))}
            </StackedList>
          </>
        ) : (
          <ErrorView
            title="下書きは作られませんでした"
            body={draft.error.message}
            suggestedAction={draft.error.suggestedAction ?? null}
            action={<Link href="/admin/generation">結果を消す</Link>}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>取り込んだ文章の確認</SectionHeading>
        <p className={styles.sectionLead}>
          外から取った文章の中に「これまでの指示を無視して」と書いておけば、こちらの決まりを上書きできてしまいます。渡す前にここで確かめます。
        </p>
        {review !== null && !review.ok ? (
          <ErrorView
            title="確かめられませんでした"
            body={review.error.message}
            suggestedAction={review.error.suggestedAction ?? null}
          />
        ) : (
          <MaterialReview
            action="/admin/generation"
            fieldName="material"
            value={material}
            accepted={review === null || !review.ok ? null : review.value.accepted}
            heldReason={review !== null && review.ok ? review.value.heldReason : null}
            findings={review !== null && review.ok ? review.value.findings : []}
            whatHappensNext={review !== null && review.ok ? review.value.whatHappensNext : null}
          />
        )}
        {material === "" && (
          <EmptyView
            title="まだ何も貼られていません"
            body="確かめたい文章を上の欄に貼って「確かめる」を押してください。"
          />
        )}
      </Card>
    </Shell>
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

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/generation"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "生成の仕組み" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="生成の仕組み"
        lead="AI に何を渡し、何を渡さず、どこから先を人が決めるかをまとめた画面です。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
