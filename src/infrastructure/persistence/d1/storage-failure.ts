import { domainError, err } from "@/domain/shared";

/**
 * 保存先が落ちたときの返し方。**握りつぶさない。**
 *
 * 同じ関数が保存先ごとに 5 つ書かれていた。文面が少しずつ違うため、
 * 利用者から見ると「同じ種類の不調なのに、画面によって言われることが違う」。
 * どれが正しい対処なのかを読む側が決められなくなるので、1 か所に集めた。
 *
 * 例外の中身をそのまま画面へ出さない（§26.3）。接続文字列や内部の経路が
 * 混じることがあり、それは利用者にとって役に立たないうえ、外へ出してよい情報でもない。
 * 代わりに例外の**種類の名前だけ**を残し、原因追跡の手がかりにする。
 */
export function storageFailure(what: string, cause: unknown) {
  return err(
    domainError("UPSTREAM_UNAVAILABLE", `${what}に失敗しました。時間をおいてもう一度お試しください。`, {
      retryable: true,
      suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      details: { reason: cause instanceof Error ? cause.name : "unknown" },
    }),
  );
}

/**
 * 保存された分と見本を重ねる。
 *
 * **保存されたほうを先に置いてから見本で埋める。** 逆にすると、
 * 見本と同じ ID を保存し直しても古い見本が返り、取りやめや承認が効かなくなる。
 * 「操作したはずのものが次に開くと元へ戻る」は、いちばん気づきにくい壊れ方。
 *
 * 見本を消さない理由: まだ 1 件も作っていない状態で一覧が空になると、
 * 「まだ作っていない」のか「壊れている」のかを画面から見分けられない。
 */
export function mergeWithSamples<T extends { readonly id: unknown }>(
  stored: readonly T[],
  samples: readonly T[],
): readonly T[] {
  const taken = new Set(stored.map((item) => String(item.id)));
  return [...stored, ...samples.filter((item) => !taken.has(String(item.id)))];
}
