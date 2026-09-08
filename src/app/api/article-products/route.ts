import { productUseCases, signedInActor } from "@/presentation/composition";
import { err, domainError } from "@/domain/shared";
import { statusOf } from "@/presentation/http/error-response";

export const dynamic = "force-dynamic";

/** 一度に返す上限。多く返しても選べないし、選ぶ手間だけ増える。 */
const LIMIT = 8;

/**
 * 記事に商品カードを挿すとき、**選ぶための一覧**を返す口。
 *
 * --- なぜ id の手入力欄を作らないのか ---
 *
 * 商品 id は覚えられる文字列ではないので、手で入れる欄を置くと
 * 書き手は別の画面から写して貼ることになる。写し間違いは静かに通り、
 * 記事には**別の商品のカード**が出る。読者から見ると、書いた人が
 * その商品を勧めたことになる。取り違えの責任だけが残る。
 * だから挿し方は「探して選ぶ」1 本にしてある（受け入れ条件 A4）。
 *
 * --- 何を返さないか ---
 *
 * 報酬に関する情報は 1 つも返さない。この口が呼ぶのは編集側の読み取り
 * （`filterProducts`）で、その入口には `guardEditorial` が掛かっている。
 * 報酬情報を持つ port をうっかり渡すと**型が通らない**ので、
 * 「気をつける」ではなく「書けない」で守られている。
 *
 * 作業場所も送られてきた値では決めない。`actor.workspaceId` から取る。
 */
export async function GET(request: Request) {
  const actor = await signedInActor();
  if (actor === null) {
    return Response.json(
      { message: "ログインしてから、もう一度お試しください。" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const text = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  // 空の問い合わせで全件を返さない。探す前から一覧が出ると、
  // 「選んだ」ではなく「先頭を押した」になる。
  if (text === "") {
    return Response.json({ items: [] }, { headers: { "cache-control": "no-store" } });
  }

  if (text.length > 200) {
    return Response.json({ message: "検索語は200文字以内にしてください。" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const found = await productUseCases()
    .then(({ filterProducts }) => filterProducts.execute(actor, { text, limit: LIMIT }))
    .catch(() => err(domainError("UPSTREAM_UNAVAILABLE", "商品を探せませんでした。もう一度お試しください。")));
  if (!found.ok) {
    return Response.json(
      { message: found.error.message },
      { status: statusOf(found.error), headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    {
      items: found.value.items.map((item) => ({
        id: item.productId,
        // ブランドを名前に混ぜるのは、同じ商品名が別ブランドにあるため。
        // 一覧で見分けが付かないと、選ぶ操作が当てずっぽうになる。
        name: item.brand === "" ? item.name : `${item.brand} ${item.name}`,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
