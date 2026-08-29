import { AdminShell } from "@/presentation/admin/admin-shell";
import { CreateRankingModelForm } from "@/presentation/admin/ranking-model-form";
import {
  currentActor,
  rankingCriteriaOptions,
  rankingUseCases,
} from "@/presentation/composition";
import { Callout, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 評価基準を作る画面。
 *
 * **報酬額・広告主の予算・販売実績の欄は無い。** 足し忘れではなく、
 * 選べる指標が domain の許可一覧（`ALLOWED_RANKING_CRITERIA`）から来ているため、
 * この画面に増やそうとしても増やせない。順位が広告の並びになる道を
 * 画面の作りではなく型で塞いでいる。
 */
export default async function NewRankingModelPage() {
  const actor = await currentActor();
  // すでに使われている種類を入力の助けに渡す。選択肢にはしない——
  // 種類そのものを登録する場所がまだ無く、ここで一覧を作ると正解が 2 つになる。
  const existing = await (await rankingUseCases()).listModels.execute(actor, {});
  const knownCategories = existing.ok
    ? [...new Set(existing.value.items.map((m) => m.categoryId))]
    : [];
  /*
   * 読めなかったことを黙って空にしない。
   * 空の助けは「これまでに使った種類は 1 つも無い」と読めてしまい、
   * すでに `cat_laptop` がある状態で別名を打ち込む道ができる。
   * 種類が分かれると、同じ商品群が二度と同じ基準で並ばない。
   * フォームそのものは使えるので、ここは断りではなく注意書きにする。
   */
  const helperFailure = existing.ok ? null : existing.error;

  return (
    <AdminShell
      routeId="rankings/models/new"
      title="評価基準を作る"
      lead="何をどれだけ重く見て並べるかを決めます。"
      actions={<TextLink href="/admin/rankings/models">基準の一覧へ戻る</TextLink>}
    >
      <Callout
        tone="info"
        title="順位に入れられないもの"
        reason="報酬額・広告主の予算・販売実績は指標に選べません。読者から見て検証できない順位を作らないためです。"
      />

      {helperFailure !== null ? (
        <Callout
          tone="warn"
          title="すでに使われている種類を読めませんでした"
          reason={`${helperFailure.message}${
            helperFailure.suggestedAction === undefined
              ? ""
              : ` ${helperFailure.suggestedAction}`
          }`}
        />
      ) : null}

      <Section
        title="この基準の決めごと"
        lead="重みの合計は 100% にします。合わないうちは登録できません。"
      >
        <CreateRankingModelForm
          criteria={rankingCriteriaOptions()}
          knownCategories={knownCategories}
        />
      </Section>
    </AdminShell>
  );
}
