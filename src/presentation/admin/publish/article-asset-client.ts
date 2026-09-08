"use client";

import type { ProductPick } from "@/presentation/prose";

/**
 * 編集画面から「商品を探す」「画像を送る」を呼ぶための、薄い包み。
 *
 * `ProseEditor` はこの 2 つを**関数として**受け取る（`onSearchProducts` /
 * `onUploadImage`）。URL を知らせない形にしてあるのは、編集部品を
 * 管理画面の外（見本・テスト・別の入口）へ持ち出せるようにするためで、
 * 「どこへ問い合わせるか」を知っているのはこのファイルだけになる。
 *
 * **失敗を握りつぶさない。** 例外を投げて編集部品に断りを出させる。
 * 空配列を返して「見つからなかった」ことにすると、置き場が落ちている日に
 * 書き手は「商品が消えた」と受け取る。
 */

export async function searchArticleProducts(query: string): Promise<readonly ProductPick[]> {
  const response = await fetch(`/api/article-products?q=${encodeURIComponent(query)}`, {
    headers: { accept: "application/json" },
  }).catch(() => null);
  if (response === null || !response.ok) throw new Error("商品を探せませんでした。");
  const body: unknown = await response.json().catch(() => null);
  const items = productPicksFrom(body);
  if (items === null) throw new Error("商品を探せませんでした。");
  return items;
}

export async function uploadArticleImage(articleId: string, file: File): Promise<string> {
  const form = new FormData();
  form.set("articleId", articleId);
  form.set("file", file);
  const response = await fetch("/api/article-images", { method: "POST", body: form });
  const body: unknown = await response.json().catch(() => null);
  // 断りの文言は口の側が持っている。ここで言い換えると、
  // 「大きすぎます」が「送れませんでした」に化けて、直し方が伝わらなくなる。
  const url = stringField(body, "url");
  if (!response.ok || url === null) {
    throw new Error(stringField(body, "message") ?? "画像を送れませんでした。");
  }
  return url;
}

function productPicksFrom(value: unknown): readonly ProductPick[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items: ProductPick[] = [];
  for (const item of value.items) {
    const id = stringField(item, "id");
    const name = stringField(item, "name");
    if (id === null || name === null) return null;
    // transport に項目が増えても、editor へ渡す view model は id/name だけに閉じる。
    items.push({ id, name });
  }
  return items;
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
