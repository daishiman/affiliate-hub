import {
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 成果リンクを登録したときに写した商品の見え方（プラットフォーム層 §19.2）。
 *
 * **写しであって、商品そのものではない。**
 * 商品の表（`products`）には作る入口がまだ無く、実運用では 1 行も入らない。
 * そこを引いて名前を埋めようとすると、引けなかったときに
 * 「名前の無いカード」か「その場で作った名前」のどちらかが読者へ出る。
 * どちらも業務データの創作なので、**登録する人が見ている名前をここへ写す**。
 *
 * --- 正本と写した時刻 ---
 * 正本は「登録の操作をした人が ASP の管理画面で見ている表記」である。
 * 写した時刻はその行の `created_at`（差し替えは上書きせず新しい行を作るので、
 * 行の作成時刻と写した時刻は必ず一致する）。
 *
 * --- 古くなったとき ---
 * 商品名が変わっても、この写しは自動では変わらない。
 * 直すときは**上書きせず、新しいリンクを登録し直す**（`original_url` と同じ扱い）。
 * 上書きを許すと、差し替え前に押されたクリックと差し替え後のクリックが
 * 同じ行に混ざり、どちらの表記で押されたのかが後から言えなくなる。
 *
 * 規範: docs/product/design-decisions.md §2、src/db/schema.ts（`affiliateLinks`）
 */
export type ProductSnapshot = {
  /** 発行したときの商品名。読者のカードにそのまま出る。**空を許さない。** */
  readonly productName: string;
  /** 作り手・ブランド。分からないときは空文字ではなく未設定（null）。 */
  readonly brand: string | null;
  /** 1 文の説明。分からないときは未設定（null）。 */
  readonly oneLine: string | null;
};

/**
 * 入力から写しを作る。
 *
 * **分からない欄を推測で埋めない。** 名前が無ければ作らずに断る。
 * 空文字を null に寄せるのは、「空欄で登録した」と「入れなかった」を
 * 保存先で区別できないため（区別できない 2 つを別の値で持つと、
 * 後から片方だけを直す作業ができなくなる）。
 */
export function captureProductSnapshot(input: {
  productName: string;
  brand?: string | null;
  oneLine?: string | null;
}): Result<ProductSnapshot, DomainError> {
  const productName = input.productName.trim();
  if (productName === "") {
    return err(
      validationError(
        "商品名が必要です。ASP の管理画面に出ている表記をそのまま入れてください。",
        "productName",
      ),
    );
  }
  return ok({
    productName,
    brand: blankToNull(input.brand),
    oneLine: blankToNull(input.oneLine),
  });
}

function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
