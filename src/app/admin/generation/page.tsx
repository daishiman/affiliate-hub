import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  currentActor,
  generationUseCases,
  sampleGenerationInputForTrial,
} from "@/presentation/composition";
import {
  Callout,
  Card,
  EmptyView,
  ErrorView,
  MaterialReview,
  Page,
  StubNotice,
} from "@/presentation/ui";
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

  const actor = await currentActor();
  const uc = generationUseCases();

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
        <h2 className={styles.sectionTitle}>渡す項目（{p.inputs.length}件）</h2>
        {readiness.ok && readiness.value.blockedReason !== null && (
          <Callout tone="warn" title="いまは生成を始められません" reason={readiness.value.blockedReason} />
        )}
        <table className={styles.rankTable}>
          <caption>
            そろっている項目: {readiness.ok ? readiness.value.filled : 0} / {p.inputs.length}
          </caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">なぜ人が決めるか</th>
              <th scope="col">空にできる場合</th>
            </tr>
          </thead>
          <tbody>
            {p.inputs.map((f) => (
              <tr key={f.key}>
                <th scope="row">
                  {f.label}
                  {f.addedByDesign && <span className={styles.linkNote}>（設計で追加した項目）</span>}
                </th>
                <td>{f.why}</td>
                <td>{f.optionalWhen ?? "空にできません"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>指示文の組み立て（{p.blocks.length}つの塊・{p.promptVersion}）</h2>
        <p className={styles.sectionLead}>
          順番も内容も固定します。1 文字でも変えるときは新しい版を作り、いまの版は書き換えません。書き換えると、過去に出した記事をどの指示で書いたか追えなくなります。
        </p>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">順</th>
              <th scope="col">塊</th>
              <th scope="col">担うこと</th>
              <th scope="col">入れてはならないもの</th>
            </tr>
          </thead>
          <tbody>
            {p.blocks.map((b) => (
              <tr key={b.id}>
                <td className={styles.numeric}>{b.order}</td>
                <th scope="row">{b.label}</th>
                <td>{b.role}</td>
                <td>{b.mustNotContain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>手順（{p.skills.length}件）</h2>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">手順</th>
              <th scope="col">やること</th>
              <th scope="col">動かす条件</th>
              <th scope="col">担う役</th>
            </tr>
          </thead>
          <tbody>
            {p.skills.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                <td>{s.responsibility}</td>
                <td>{s.startsWhen}</td>
                <td>{s.agentLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>役の分け方（{p.agents.length}件）</h2>
        <p className={styles.sectionLead}>
          書いた役に、自分の書いたものを確かめさせません。確かめる役は書く道具を持たず、書いたときのやり取りも引き継ぎません。
        </p>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">役</th>
              <th scope="col">区分</th>
              <th scope="col">やること</th>
              <th scope="col">やらないこと</th>
              <th scope="col">書く道具</th>
              <th scope="col">前のやり取り</th>
            </tr>
          </thead>
          <tbody>
            {p.agents.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.label}</th>
                <td>{a.kindLabel}</td>
                <td>{a.responsibility}</td>
                <td>{a.mustNot}</td>
                <td>{a.canGenerate ? "持ちます" : "持ちません"}</td>
                <td>{a.freshContext ? "引き継ぎません" : "引き継ぎます"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.linkNote}>
          指摘を受けて書き直すのは {p.maxRevisionRounds} 回まで。それで片づかないものは、片づいたことにせず担当者へ回します。
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>どこから先が人の判断か</h2>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">段階</th>
              <th scope="col">次へ進めるのは</th>
              <th scope="col">理由</th>
              <th scope="col">動く手順</th>
            </tr>
          </thead>
          <tbody>
            {p.stages.map((s) => (
              <tr key={s.state}>
                <th scope="row">{s.label}</th>
                <td>{s.advancedBy === "human" ? "担当者" : "AI"}</td>
                <td>{s.why}</td>
                <td>{s.skillLabels.length === 0 ? "—" : s.skillLabels.join("・")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.linkNote}>
          <Link href="/admin/content">記事の進行を見る</Link>
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>受け取りの形（{p.outputFields.length}項目）</h2>
        <p className={styles.sectionLead}>
          決めた形で返らない返答は受け取りません。形が合わないときは {p.maxSchemaRetries}{" "}
          回までやり直し、それでも合わなければ失敗として残します。成功したことにはしません。
        </p>
        <Callout
          tone="warn"
          title="AI が自分で付けた点数は合否に使いません"
          reason={`${p.selfReportedFields.join("・")} は書いた側の自己申告です。自分の答案に自分で点を付けたものなので、公開してよいかの判断には使いません。判断は品質検査と確かめ役の結果で行います。`}
        />
        <ul className={styles.linkList}>
          {p.outputFields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>下書きを作らせてみる</h2>
        <p className={styles.sectionLead}>
          実際に押して確かめられます。必ず要る 17
          項目（上の表のうち「順位の決め方」以外）がそろっていない状態では、何が足りないかを返して始めません。そろった状態で押すと、生成
          AI への接続まで進みます。接続先はまだ選定と鍵の登録が済んでいないため、そこで止まります。
        </p>
        <p className={styles.linkList}>
          <Link href="/admin/generation?trial=empty">そろっていない状態で試す</Link>
          {" ／ "}
          <Link href="/admin/generation?trial=ready">そろった状態（見本の素材）で試す</Link>
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
            <ul className={styles.linkList}>
              {draft.value.instructionBlocks.map((b) => (
                <li key={b.id}>
                  {b.label}（{b.charCount} 文字）
                </li>
              ))}
            </ul>
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
        <h2 className={styles.sectionTitle}>取り込んだ文章の確認</h2>
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
