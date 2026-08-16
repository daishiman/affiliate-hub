/**
 * WebMCP の宣言属性を React の型に足す。
 *
 * `toolname` / `tooldescription` / `toolparamdescription` はすべて小文字。
 * React の慣習に合わせて camelCase にすると読み取られないので、そのまま出す。
 *
 * ここで型を足しておかないと、呼び出し側が `as any` を書き始める。
 */
import "react";

declare module "react" {
  // 型引数の名前は元の宣言と揃える必要があるため、未使用でも T のままにする。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    /** この操作の名前。application 層のユースケース名と揃える。 */
    toolname?: string;
    /** 何をする操作かの 1 文。 */
    tooldescription?: string;
    /** この入力欄が何の値か。 */
    toolparamdescription?: string;
  }
}
